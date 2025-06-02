"""
Extremely simplified database connection handling to resolve hanging issues.
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

# Create a connection pool
try:
    connection_pool = pool.ThreadedConnectionPool(
        minconn=5,     # Minimum number of connections in the pool
        maxconn=30,    # Maximum number of connections in the pool
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT
    )
    logger.info(f"Database connection pool created successfully")
except Exception as e:
    logger.error(f"Failed to create database connection pool: {str(e)}")
    connection_pool = None

def get_db_connection():
    """Get database connection from the pool or create a new one"""
    try:
        if connection_pool:
            conn = connection_pool.getconn()
            
            # Make sure connection is in a clean state
            try:
                conn.rollback()
            except:
                pass
                
            return conn
        else:
            # Fall back to direct connection
            conn = psycopg2.connect(
                dbname=DB_NAME,
                user=DB_USER,
                password=DB_PASSWORD,
                host=DB_HOST,
                port=DB_PORT
            )
            return conn
    except Exception as e:
        logger.error(f"Error getting database connection: {str(e)}")
        raise HTTPException(status_code=500, detail="Database connection error")

@contextmanager
def get_db_cursor(dict_cursor=True, autocommit=False):
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
        
        # Yield cursor and connection
        yield cursor, conn
        
    except Exception as e:
        # Handle any errors
        logger.error(f"Database error: {str(e)}")
        if conn:
            try:
                conn.rollback()
            except:
                pass
        raise
        
    finally:
        # Clean up resources
        if cursor:
            try:
                cursor.close()
            except:
                pass
                
        if conn:
            if pooled and connection_pool:
                try:
                    connection_pool.putconn(conn)
                except:
                    pass
            else:
                try:
                    conn.close()
                except:
                    pass

def close_all_connections():
    """Close all connections in the pool"""
    if connection_pool:
        try:
            connection_pool.closeall()
            logger.info("All database connections closed")
        except Exception as e:
            logger.error(f"Error closing connections: {str(e)}")