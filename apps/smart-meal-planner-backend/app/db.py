"""
Ultra-simplified database connection module.
This version strips away all complexity to ensure reliable operation.
"""

import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2 import pool
from fastapi import HTTPException
import logging
from contextlib import contextmanager
from app.config import DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT

# Set up logging
logger = logging.getLogger(__name__)

# Create a single connection pool
try:
    connection_pool = pool.ThreadedConnectionPool(
        minconn=5,     # Minimum connections
        maxconn=30,    # Maximum connections 
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT
    )
    logger.info(f"Database connection pool created with 5-30 connections")
except Exception as e:
    logger.error(f"Failed to create database connection pool: {str(e)}")
    connection_pool = None

def get_db_connection():
    """Get a database connection from the pool or create a new one"""
    try:
        if connection_pool:
            # Get connection from pool
            conn = connection_pool.getconn()
            
            # Make sure connection is in a clean state
            try:
                conn.rollback()
            except Exception as e:
                logger.warning(f"Could not rollback connection: {str(e)}")
                
            return conn
        else:
            # Direct connection as fallback
            conn = psycopg2.connect(
                dbname=DB_NAME,
                user=DB_USER,
                password=DB_PASSWORD,
                host=DB_HOST,
                port=DB_PORT
            )
            return conn
            
    except Exception as e:
        logger.error(f"Failed to connect to database: {str(e)}")
        raise HTTPException(status_code=500, detail="Database connection error")

@contextmanager
def get_db_cursor(dict_cursor=True, autocommit=False, pool_type=None):
    """Context manager for database connections and cursors"""
    conn = None
    cursor = None
    pooled = False
    
    try:
        # Get connection
        conn = get_db_connection()
        pooled = connection_pool is not None
        
        # Set autocommit if requested
        if autocommit:
            conn.autocommit = True
            
        # Create cursor
        if dict_cursor:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
        else:
            cursor = conn.cursor()
            
        # Set statement timeout to prevent hanging queries (10 seconds)
        try:
            cursor.execute("SET statement_timeout = 10000")
        except Exception as e:
            logger.warning(f"Failed to set statement timeout: {str(e)}")
        
        # Yield cursor and connection
        yield cursor, conn
        
    except Exception as e:
        # Handle exceptions
        logger.error(f"Database error: {str(e)}")
        if conn:
            try:
                conn.rollback()
                logger.info("Transaction rolled back")
            except Exception as rb_e:
                logger.error(f"Error during rollback: {str(rb_e)}")
        raise
        
    finally:
        # Clean up resources
        if cursor:
            try:
                cursor.close()
                logger.debug("Cursor closed")
            except Exception as e:
                logger.warning(f"Error closing cursor: {str(e)}")
                
        if conn:
            if pooled and connection_pool:
                try:
                    connection_pool.putconn(conn)
                    logger.debug("Connection returned to pool")
                except Exception as e:
                    logger.warning(f"Error returning connection to pool: {str(e)}")
            else:
                try:
                    conn.close()
                    logger.debug("Connection closed")
                except Exception as e:
                    logger.warning(f"Error closing connection: {str(e)}")

def close_all_connections():
    """Close all connections in the pool"""
    if connection_pool:
        try:
            connection_pool.closeall()
            logger.info("All database connections closed")
            return True
        except Exception as e:
            logger.error(f"Error closing all connections: {str(e)}")
            return False
    return False