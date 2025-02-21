import psycopg2
from psycopg2.extras import RealDictCursor
from fastapi import HTTPException
import logging
from app.config import RECAPTCHA_SECRET_KEY, DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT

# Set up logging
logger = logging.getLogger(__name__)

def get_db_connection():
    """Get database connection using configuration settings"""
    try:
        logger.info(f"Attempting to connect to database at {DB_HOST}:{DB_PORT}")
        conn = psycopg2.connect(
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST,
            port=DB_PORT
        )
        return conn
    except psycopg2.OperationalError as e:
        logger.error(f"Failed to connect to database: {str(e)}")
        logger.error(f"Database connection parameters: host={DB_HOST}, port={DB_PORT}, dbname={DB_NAME}, user={DB_USER}")
        raise HTTPException(
            status_code=500,
            detail="Unable to connect to database. Please try again later."
        )
    except Exception as e:
        logger.error(f"Unexpected error connecting to database: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while connecting to database."
        )
