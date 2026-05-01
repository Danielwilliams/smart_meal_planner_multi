#!/usr/bin/env python3
"""
Script to update subscription tables with any missing columns.
This ensures all tables have the correct structure for Stripe integration.
"""

import os
import sys
import logging
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Add the parent directory to the path so we can import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Try to import from app config, but fallback to environment variables if that fails
try:
    from app.config import DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT
except ImportError:
    logger.info("Could not import app config, using environment variables instead")
    DB_NAME = os.getenv('DB_NAME')
    DB_USER = os.getenv('DB_USER')
    DB_PASSWORD = os.getenv('DB_PASSWORD')
    DB_HOST = os.getenv('DB_HOST')
    DB_PORT = os.getenv('DB_PORT')

def get_connection():
    """Create a direct connection to the database"""
    try:
        logger.info(f"Connecting to database {DB_NAME} at {DB_HOST}:{DB_PORT}")
        conn = psycopg2.connect(
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST,
            port=DB_PORT
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        return conn
    except Exception as e:
        logger.error(f"Error connecting to database: {str(e)}")
        raise

def check_table_exists(conn, table_name):
    """Check if a table exists in the database"""
    try:
        with conn.cursor() as cur:
            cur.execute(f"""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = %s
                )
            """, (table_name,))
            return cur.fetchone()[0]
    except Exception as e:
        logger.error(f"Error checking if table {table_name} exists: {str(e)}")
        return False

def check_column_exists(conn, table_name, column_name):
    """Check if a column exists in a table"""
    try:
        with conn.cursor() as cur:
            cur.execute(f"""
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    AND table_name = %s
                    AND column_name = %s
                )
            """, (table_name, column_name))
            return cur.fetchone()[0]
    except Exception as e:
        logger.error(f"Error checking if column {column_name} exists in table {table_name}: {str(e)}")
        return False

def update_tables(conn):
    """Update the subscription tables with any missing columns"""
    try:
        with conn.cursor() as cur:
            # Check if subscription_events table exists
            if check_table_exists(conn, 'subscription_events'):
                logger.info("Checking subscription_events table for missing columns...")
                
                # Check if processed_at column exists
                if not check_column_exists(conn, 'subscription_events', 'processed_at'):
                    logger.info("Adding processed_at column to subscription_events table...")
                    cur.execute("""
                        ALTER TABLE subscription_events
                        ADD COLUMN processed_at TIMESTAMP WITH TIME ZONE
                    """)
                    logger.info("Added processed_at column successfully")
                else:
                    logger.info("processed_at column already exists")
            else:
                logger.warning("subscription_events table does not exist, skipping column checks")
            
            # Check if subscriptions table exists
            if check_table_exists(conn, 'subscriptions'):
                logger.info("Checking subscriptions table for missing columns...")
                
                # Check if stripe_status column exists
                if not check_column_exists(conn, 'subscriptions', 'stripe_status'):
                    logger.info("Adding stripe_status column to subscriptions table...")
                    cur.execute("""
                        ALTER TABLE subscriptions
                        ADD COLUMN stripe_status VARCHAR(50)
                    """)
                    logger.info("Added stripe_status column successfully")
                else:
                    logger.info("stripe_status column already exists")
                    
                # Check if updated_at column exists
                if not check_column_exists(conn, 'subscriptions', 'updated_at'):
                    logger.info("Adding updated_at column to subscriptions table...")
                    cur.execute("""
                        ALTER TABLE subscriptions
                        ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    """)
                    logger.info("Added updated_at column successfully")
                else:
                    logger.info("updated_at column already exists")
            else:
                logger.warning("subscriptions table does not exist, skipping column checks")
                
            # Check if invoices table exists
            if check_table_exists(conn, 'invoices'):
                logger.info("Checking invoices table for missing columns...")
                
                # Check if updated_at column exists
                if not check_column_exists(conn, 'invoices', 'updated_at'):
                    logger.info("Adding updated_at column to invoices table...")
                    cur.execute("""
                        ALTER TABLE invoices
                        ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    """)
                    logger.info("Added updated_at column successfully")
                else:
                    logger.info("updated_at column already exists")
            else:
                logger.warning("invoices table does not exist, skipping column checks")
                
            logger.info("All table updates completed successfully")
            return True
    except Exception as e:
        logger.error(f"Error updating tables: {str(e)}")
        return False

def main():
    """Main function"""
    try:
        conn = get_connection()
        
        # Update tables with missing columns
        success = update_tables(conn)
        
        if success:
            logger.info("Table update completed successfully")
        else:
            logger.error("Table update failed")
            
        conn.close()
    except Exception as e:
        logger.error(f"Error in main function: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()