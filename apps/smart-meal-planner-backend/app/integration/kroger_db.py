import logging
from app.db import get_db_connection
from psycopg2.extras import RealDictCursor
from typing import Optional, Dict, Any

# Add this line to set up logging
logger = logging.getLogger(__name__)

def save_kroger_credentials(
    id: int, 
    access_token: Optional[str] = None, 
    refresh_token: Optional[str] = None, 
    store_location_id: Optional[str] = None
) -> bool:
    """
    Save only user-specific Kroger tokens
    """
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            update_fields = []
            params = []
            
            if access_token:
                update_fields.append("kroger_access_token = %s")
                params.append(access_token)
                update_fields.append("kroger_connected_at = CURRENT_TIMESTAMP")
            
            if refresh_token:
                update_fields.append("kroger_refresh_token = %s")
                params.append(refresh_token)
            
            if store_location_id:
                update_fields.append("kroger_store_location_id = %s")
                params.append(store_location_id)
            
            # Add user ID to params
            params.append(id)
            
            if update_fields:
                query = f"""
                UPDATE user_profiles 
                SET {', '.join(update_fields)}
                WHERE id = %s
                """
                
                cur.execute(query, params)
                conn.commit()
                
                logger.info(f"Updated Kroger tokens for user {id}")
                return cur.rowcount > 0
            
            return False
    
    except Exception as e:
        conn.rollback()
        logger.error(f"Error saving Kroger tokens for user {id}: {e}")
        return False
    finally:
        conn.close()

def get_user_kroger_credentials(id: int) -> Dict[str, Any]:
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Fix: Use kroger_username and kroger_password columns instead of client_id/secret
            query = """
            SELECT 
                kroger_username,
                kroger_password,
                kroger_access_token, 
                kroger_refresh_token, 
                kroger_store_location_id,
                kroger_connected_at
            FROM user_profiles
            WHERE id = %s
            """
            cur.execute(query, (id,))
            result = cur.fetchone()
            
            if not result:
                logger.warning(f"No user found with ID: {id}")
                return {}

            # More detailed logging
            log_details = {
                "username_present": bool(result.get('kroger_username')),
                "access_token_present": bool(result.get('kroger_access_token')),
                "store_location_present": bool(result.get('kroger_store_location_id'))
            }
            logger.info(f"Kroger credentials check for user {id}: {log_details}")

            # Map username/password to client_id/secret in the return for compatibility
            return {
                "client_id": result.get('kroger_username'),
                "client_secret": result.get('kroger_password'),
                "access_token": result.get('kroger_access_token'),
                "refresh_token": result.get('kroger_refresh_token'),
                "store_location_id": result.get('kroger_store_location_id'),
                "connected_at": result.get('kroger_connected_at')
            }
    except Exception as e:
        logger.error(f"Error retrieving Kroger credentials for user {id}: {e}")
        return {}
    finally:
        conn.close()



def disconnect_kroger_account(id: int) -> bool:
    """
    Disconnect Kroger account for a user
    
    :param id: User's ID
    :return: Success status of disconnection
    """
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            query = """
            UPDATE user_profiles 
            SET 
                kroger_access_token = NULL, 
                kroger_refresh_token = NULL, 
                kroger_store_location_id = NULL,
                kroger_connected_at = NULL,
                kroger_last_synced = NULL
            WHERE id = %s
            """
            cur.execute(query, (id,))
            conn.commit()
            return cur.rowcount > 0
    except Exception as e:
        conn.rollback()
        print(f"Error disconnecting Kroger account: {e}")
        return False
    finally:
        conn.close()

def update_kroger_store_location(id: int, store_location_id: str) -> bool:
    """
    Update user's preferred Kroger store location
    
    :param id: User's ID
    :param store_location_id: Kroger store location ID
    :return: Success status of update
    """
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            query = """
            UPDATE user_profiles 
            SET 
                kroger_store_location_id = %s,
                kroger_last_synced = CURRENT_TIMESTAMP
            WHERE id = %s
            """
            cur.execute(query, (store_location_id, id))
            conn.commit()
            return cur.rowcount > 0
    except Exception as e:
        conn.rollback()
        print(f"Error updating Kroger store location: {e}")
        return False
    finally:
        conn.close()
        