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
    'general': {
        'total_connections': 0,
        'active_connections': 0,
        'peak_connections': 0,
        'connection_errors': 0,
        'last_pool_exhaustion': None,
        'last_reset': time.time()
    },
    'ai': {
        'total_connections': 0,
        'active_connections': 0,
        'peak_connections': 0,
        'connection_errors': 0,
        'last_pool_exhaustion': None,
        'last_reset': time.time()
    },
    'read': {
        'total_connections': 0,
        'active_connections': 0,
        'peak_connections': 0,
        'connection_errors': 0,
        'last_pool_exhaustion': None,
        'last_reset': time.time()
    }
}
_stats_lock = threading.Lock()

def log_connection_stats(pool_type='general'):
    """Log current connection pool statistics for monitoring"""
    pool_obj = get_pool_by_type(pool_type)
    if pool_obj:
        try:
            with _stats_lock:
                # Get pool info if available
                stats = _connection_stats.get(pool_type, _connection_stats['general'])
                logger.info(f"{pool_type.upper()} Pool Stats - Active: {stats['active_connections']}, "
                           f"Peak: {stats['peak_connections']}, "
                           f"Total Requests: {stats['total_connections']}, "
                           f"Errors: {stats['connection_errors']}")
        except Exception as e:
            logger.warning(f"Error logging connection stats for {pool_type}: {e}")

def update_connection_stats(operation: str, pool_type: str = 'general', success: bool = True):
    """Update connection statistics for monitoring"""
    with _stats_lock:
        stats = _connection_stats.get(pool_type, _connection_stats['general'])
        
        if operation == 'acquire':
            stats['total_connections'] += 1
            if success:
                stats['active_connections'] += 1
                stats['peak_connections'] = max(
                    stats['peak_connections'], 
                    stats['active_connections']
                )
            else:
                stats['connection_errors'] += 1
                if 'pool' in str(operation).lower():  # Pool exhaustion
                    stats['last_pool_exhaustion'] = time.time()
        elif operation == 'release':
            stats['active_connections'] = max(0, stats['active_connections'] - 1)
        
        # Log stats every 50 connections or if there are errors
        if (stats['total_connections'] % 50 == 0 or 
            stats['connection_errors'] > 0):
            log_connection_stats(pool_type)

# Create specialized connection pools for different types of operations
try:
    # General purpose connection pool (for most operations)
    general_pool = pool.ThreadedConnectionPool(
        minconn=10,     # Minimum number of connections in the pool
        maxconn=40,     # Maximum number of connections in the pool
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT
    )
    logger.info(f"General database connection pool created with 10-40 connections")

    # Dedicated pool for AI operations (menu generation, etc.)
    ai_pool = pool.ThreadedConnectionPool(
        minconn=5,      # AI operations need fewer but dedicated connections
        maxconn=20,     # Still substantial for multiple concurrent AI operations
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT
    )
    logger.info(f"AI operations database connection pool created with 5-20 connections")

    # Read-only operations pool (for shopping lists, browsing recipes, etc.)
    read_pool = pool.ThreadedConnectionPool(
        minconn=10,     # More connections for read operations which are frequent
        maxconn=30,     # Substantial pool for concurrent read operations
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT
    )
    logger.info(f"Read operations database connection pool created with 10-30 connections")
    
except Exception as e:
    logger.error(f"Failed to create database connection pools: {str(e)}")
    # Fall back to None if pool creation fails
    general_pool = None
    ai_pool = None
    read_pool = None

def get_pool_by_type(pool_type='general'):
    """Get the appropriate connection pool based on operation type"""
    if pool_type == 'ai':
        return ai_pool
    elif pool_type == 'read':
        return read_pool
    else:
        return general_pool

def get_db_connection(pool_type='general', timeout=10):
    """Get database connection from the appropriate pool with timeout
    
    Args:
        pool_type: The type of pool to use ('general', 'ai', or 'read')
        timeout: Maximum time in seconds to wait for a connection
    """
    start_time = time.time()
    connection_pool = get_pool_by_type(pool_type)
    
    try:
        if connection_pool:
            # Get a connection from the pool with timeout
            logger.debug(f"Getting connection from {pool_type} pool")
            
            # Implement timeout mechanism
            while time.time() - start_time < timeout:
                try:
                    conn = connection_pool.getconn(key=None, timeout=0.5)  # Small timeout for each attempt
                    logger.debug(f"Connection obtained from {pool_type} pool")
                    update_connection_stats('acquire', pool_type, True)
                    
                    # Set statement timeout on the connection to prevent long-running queries
                    # This timeout is in milliseconds
                    cursor = conn.cursor()
                    cursor.execute(f"SET statement_timeout = {timeout * 1000};")
                    cursor.close()
                    
                    return conn
                except pool.PoolError:
                    # If pool is exhausted, wait a bit and retry
                    time.sleep(0.1)
                    continue
            
            # If we get here, timeout was reached
            logger.error(f"Timeout reached waiting for {pool_type} pool connection")
            update_connection_stats('acquire', pool_type, False)
            raise HTTPException(
                status_code=503,
                detail=f"Database connection pool '{pool_type}' is currently exhausted. Please try again later."
            )
        else:
            # Fall back to direct connection if pool is not available
            logger.info(f"Connecting directly to database at {DB_HOST}:{DB_PORT} (no {pool_type} pool)")
            conn = psycopg2.connect(
                dbname=DB_NAME,
                user=DB_USER,
                password=DB_PASSWORD,
                host=DB_HOST,
                port=DB_PORT,
                connect_timeout=timeout
            )
            update_connection_stats('acquire', pool_type, True)
            return conn
    except psycopg2.OperationalError as e:
        logger.error(f"Failed to connect to database: {str(e)}")
        logger.error(f"Database connection parameters: host={DB_HOST}, port={DB_PORT}, dbname={DB_NAME}, user={DB_USER}")
        update_connection_stats('acquire', pool_type, False)
        raise HTTPException(
            status_code=500,
            detail="Unable to connect to database. Please try again later."
        )
    except Exception as e:
        logger.error(f"Unexpected error connecting to database: {str(e)}")
        update_connection_stats('acquire', pool_type, False)
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while connecting to database."
        )

@contextmanager
def get_db_cursor(dict_cursor=True, pool_type='general', timeout=10):
    """
    Context manager for safely handling database connections and cursors.
    
    Args:
        dict_cursor: If True, uses RealDictCursor, otherwise uses regular cursor
        pool_type: The type of pool to use ('general', 'ai', or 'read')
        timeout: Maximum time in seconds to wait for a connection

    Usage:
    ```
    with get_db_cursor(pool_type='read') as (cursor, conn):
        cursor.execute("SELECT * FROM table")
        results = cursor.fetchall()
        conn.commit()  # if needed
    ```
    """
    conn = None
    cursor = None
    pooled = False
    try:
        # Get connection from pool or directly
        logger.info(f"Attempting to connect to database using {pool_type} pool")
        conn = get_db_connection(pool_type=pool_type, timeout=timeout)
        pool_obj = get_pool_by_type(pool_type)
        pooled = pool_obj is not None

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
                if pooled and pool_obj:
                    # Return the connection to the pool instead of closing it
                    pool_obj.putconn(conn)
                    logger.debug(f"Database connection returned to {pool_type} pool")
                    update_connection_stats('release', pool_type)
                else:
                    # If not using a pool, close the connection directly
                    conn.close()
                    logger.debug("Database connection closed successfully")
                    update_connection_stats('release', pool_type)
            except Exception as e:
                logger.warning(f"Error handling connection cleanup: {str(e)}")
                update_connection_stats('release', pool_type)  # Still count as released even with error

def close_all_connections():
    """Close all connections in all pools when shutting down the application"""
    pools = [
        ('general', general_pool),
        ('ai', ai_pool),
        ('read', read_pool)
    ]
    
    for pool_name, pool_obj in pools:
        if pool_obj:
            try:
                pool_obj.closeall()
                logger.info(f"All database connections in the {pool_name} pool have been closed")
            except Exception as e:
                logger.error(f"Error closing {pool_name} connection pool: {str(e)}")

# For backward compatibility - will use the general pool
def get_db_connection_legacy():
    """Legacy function for backward compatibility"""
    return get_db_connection(pool_type='general')

@contextmanager
def get_db_cursor_legacy(dict_cursor=True):
    """Legacy function for backward compatibility"""
    with get_db_cursor(dict_cursor=dict_cursor, pool_type='general') as (cursor, conn):
        yield cursor, conn