import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2 import pool
from fastapi import HTTPException
import logging
import time
import threading
from contextlib import contextmanager
from app.config import RECAPTCHA_SECRET_KEY, DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT

# Set up logging
logger = logging.getLogger(__name__)

# Connection monitoring for detecting future issues
_connection_stats = {
    'total_connections': 0,
    'active_connections': 0,
    'peak_connections': 0,
    'connection_errors': 0,
    'last_pool_exhaustion': None,
    'last_reset': time.time()
}
_stats_lock = threading.Lock()

def log_connection_stats():
    """Log current connection pool statistics for monitoring"""
    if connection_pool:
        try:
            with _stats_lock:
                # Get pool info if available
                # Note: psycopg2 doesn't expose direct pool stats, so we track our own
                logger.info(f"Connection Stats - Active: {_connection_stats['active_connections']}, "
                           f"Peak: {_connection_stats['peak_connections']}, "
                           f"Total Requests: {_connection_stats['total_connections']}, "
                           f"Errors: {_connection_stats['connection_errors']}")
        except Exception as e:
            logger.warning(f"Error logging connection stats: {e}")

def update_connection_stats(operation: str, success: bool = True):
    """Update connection statistics for monitoring"""
    with _stats_lock:
        if operation == 'acquire':
            _connection_stats['total_connections'] += 1
            if success:
                _connection_stats['active_connections'] += 1
                _connection_stats['peak_connections'] = max(
                    _connection_stats['peak_connections'], 
                    _connection_stats['active_connections']
                )
            else:
                _connection_stats['connection_errors'] += 1
                if 'pool' in str(operation).lower():  # Pool exhaustion
                    _connection_stats['last_pool_exhaustion'] = time.time()
        elif operation == 'release':
            _connection_stats['active_connections'] = max(0, _connection_stats['active_connections'] - 1)
        
        # Log stats every 50 connections or if there are errors
        if (_connection_stats['total_connections'] % 50 == 0 or 
            _connection_stats['connection_errors'] > 0):
            log_connection_stats()

# Create a connection pool for better concurrency handling
# This allows multiple concurrent operations to use separate connections
try:
    connection_pool = pool.ThreadedConnectionPool(
        minconn=5,     # Minimum number of connections in the pool
        maxconn=30,     # Maximum number of connections in the pool
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT
    )
    logger.info(f"Database connection pool created with 5-30 connections")
except Exception as e:
    logger.error(f"Failed to create database connection pool: {str(e)}")
    # We'll fall back to direct connections if the pool creation fails
    connection_pool = None

def get_db_connection():
    """Get database connection using configuration settings or from the connection pool"""
    try:
        if connection_pool:
            # Check pool health and reset if needed
            if not check_pool_health():
                logger.warning("Connection pool health check failed, attempting reset")
                reset_connection_pool()
            # Get a connection from the pool with retry logic
            logger.debug("Getting connection from pool")
            conn = None
            max_retries = 3

            for attempt in range(1, max_retries + 1):
                try:
                    conn = connection_pool.getconn()
                    logger.debug(f"Connection obtained from pool on attempt {attempt}")

                    # Validate the connection by executing a simple query
                    try:
                        with conn.cursor() as test_cursor:
                            test_cursor.execute("SELECT 1")
                            test_cursor.fetchone()
                        # Connection is valid
                        break
                    except Exception as e:
                        logger.warning(f"Connection validation failed on attempt {attempt}: {str(e)}")
                        try:
                            connection_pool.putconn(conn)
                        except:
                            pass
                        conn = None
                        if attempt == max_retries:
                            raise
                except Exception as e:
                    logger.warning(f"Failed to get connection on attempt {attempt}: {str(e)}")
                    if attempt == max_retries:
                        raise
                    time.sleep(0.5)  # Short delay before retry

            if conn is None:
                raise psycopg2.OperationalError("Failed to obtain a valid connection after multiple attempts")

            update_connection_stats('acquire', True)

            # Check if the connection needs a rollback (might be in transaction)
            try:
                # This ensures the connection is in a clean state
                conn.rollback()
                logger.debug("Rolled back any existing transaction for connection")
            except Exception as e:
                logger.warning(f"Could not rollback connection: {str(e)}")

            return conn
        else:
            # Fall back to direct connection if pool is not available
            logger.info(f"Connecting directly to database at {DB_HOST}:{DB_PORT}")
            conn = psycopg2.connect(
                dbname=DB_NAME,
                user=DB_USER,
                password=DB_PASSWORD,
                host=DB_HOST,
                port=DB_PORT
            )
            update_connection_stats('acquire', True)
            return conn
    except psycopg2.OperationalError as e:
        logger.error(f"Failed to connect to database: {str(e)}")
        logger.error(f"Database connection parameters: host={DB_HOST}, port={DB_PORT}, dbname={DB_NAME}, user={DB_USER}")
        update_connection_stats('acquire', False)
        raise HTTPException(
            status_code=500,
            detail="Unable to connect to database. Please try again later."
        )
    except Exception as e:
        logger.error(f"Unexpected error connecting to database: {str(e)}")
        update_connection_stats('acquire', False)
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while connecting to database."
        )

@contextmanager
def get_db_cursor(dict_cursor=True, autocommit=False):
    """
    Context manager for safely handling database connections and cursors.

    Args:
        dict_cursor (bool): If True, uses RealDictCursor, otherwise uses regular cursor
        autocommit (bool): If True, sets autocommit mode on the connection

    Yields:
        tuple: (cursor, connection) tuple for use in the with block
    """
    conn = None
    cursor = None
    pooled = False
    try:
        # Get connection from pool or directly
        logger.info(f"Attempting to connect to database")
        conn = get_db_connection()
        pooled = connection_pool is not None
        
        # Set autocommit mode if requested - do this AFTER connection is clean
        if autocommit:
            conn.autocommit = True
            logger.debug("Set autocommit=True for connection")

        # Set a statement timeout to prevent hanging queries (10 seconds)
        try:
            with conn.cursor() as timeout_cursor:
                timeout_cursor.execute("SET statement_timeout = 10000")  # 10 seconds in milliseconds
                logger.debug("Set statement_timeout to 10 seconds")
        except Exception as e:
            logger.warning(f"Failed to set statement timeout: {str(e)}")

        # Create cursor
        if dict_cursor:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
        else:
            cursor = conn.cursor()

        # Yield the cursor and connection
        yield cursor, conn

    except Exception as e:
        # Handle exception and rollback if needed
        logger.error(f"Database error in context manager: {str(e)}", exc_info=True)
        if conn:
            try:
                conn.rollback()
                logger.info("Transaction rolled back due to error")
            except Exception as rb_e:
                logger.error(f"Error during rollback: {str(rb_e)}")
        raise

    finally:
        # Always clean up resources
        if cursor:
            try:
                cursor.close()
                logger.debug("Database cursor closed successfully")
            except Exception as e:
                logger.warning(f"Error closing cursor: {str(e)}")

        if conn:
            try:
                if pooled and connection_pool:
                    # Return the connection to the pool instead of closing it
                    connection_pool.putconn(conn)
                    logger.debug("Database connection returned to pool")
                    update_connection_stats('release')
                else:
                    # If not using a pool, close the connection directly
                    conn.close()
                    logger.debug("Database connection closed successfully")
                    update_connection_stats('release')
            except Exception as e:
                logger.warning(f"Error handling connection cleanup: {str(e)}")
                update_connection_stats('release')  # Still count as released even with error

def close_all_connections():
    """Close all connections in the pool when shutting down the application"""
    if connection_pool:
        try:
            connection_pool.closeall()
            logger.info("All database connections in the pool have been closed")
        except Exception as e:
            logger.error(f"Error closing connection pool: {str(e)}")

def check_pool_health():
    """Check if the connection pool is healthy and reset if needed"""
    with _stats_lock:
        # Check if we have too many active connections
        if _connection_stats['active_connections'] > connection_pool._maxconn * 0.9:
            logger.warning(f"Connection pool approaching capacity: {_connection_stats['active_connections']}/{connection_pool._maxconn}")
            return False

        # Check if we have a large number of errors
        if _connection_stats['connection_errors'] > 5:
            logger.warning(f"High connection error count: {_connection_stats['connection_errors']}")
            return False

        # Check if connections have been stuck for too long
        time_since_reset = time.time() - _connection_stats['last_reset']
        if time_since_reset > 3600 and _connection_stats['active_connections'] > connection_pool._maxconn * 0.5:
            logger.warning(f"Connection pool may have leaks: {_connection_stats['active_connections']} connections active for {time_since_reset/60:.1f} minutes")
            return False

        return True

def reset_connection_pool():
    """Reset the connection pool by closing all connections and resetting stats"""
    global connection_pool

    if connection_pool:
        try:
            # Close all connections
            connection_pool.closeall()
            logger.info("Connection pool reset: all connections closed")

            # Reset stats
            with _stats_lock:
                _connection_stats['active_connections'] = 0
                _connection_stats['connection_errors'] = 0
                _connection_stats['last_reset'] = time.time()

            # Recreate the pool
            try:
                connection_pool = pool.ThreadedConnectionPool(
                    minconn=5,     # Minimum number of connections in the pool
                    maxconn=30,     # Maximum number of connections in the pool
                    dbname=DB_NAME,
                    user=DB_USER,
                    password=DB_PASSWORD,
                    host=DB_HOST,
                    port=DB_PORT
                )
                logger.info(f"Database connection pool recreated with 5-30 connections")
                return True
            except Exception as e:
                logger.error(f"Failed to recreate database connection pool: {str(e)}")
                return False
        except Exception as e:
            logger.error(f"Error resetting connection pool: {str(e)}")
            return False
    return False