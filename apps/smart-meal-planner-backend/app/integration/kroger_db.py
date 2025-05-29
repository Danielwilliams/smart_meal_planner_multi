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
    logger.info(f"SAVING KROGER CREDENTIALS for user {id}")
    logger.info(f"Access token present: {bool(access_token)}")
    logger.info(f"Access token length: {len(access_token) if access_token else 0}")
    logger.info(f"Refresh token present: {bool(refresh_token)}")
    logger.info(f"Refresh token length: {len(refresh_token) if refresh_token else 0}")
    logger.info(f"Store location ID: {store_location_id or 'None'}")
    
    # Verify user ID is valid
    if not id or id <= 0:
        logger.error(f"Invalid user ID: {id}")
        return False
    
    conn = get_db_connection()
    try:
        # First verify the user exists
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT id FROM user_profiles WHERE id = %s", (id,))
            user_result = cur.fetchone()
            
            if not user_result:
                logger.error(f"User with ID {id} not found in database")
                return False
                
            logger.info(f"User ID {id} exists in database: {user_result}")
            
            # Build update statement
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
                
                logger.info(f"Executing query: {query} with param count: {len(params)}")
                cur.execute(query, params)
                conn.commit()
                
                rows_affected = cur.rowcount
                logger.info(f"Updated Kroger tokens for user {id}, rows affected: {rows_affected}")
                
                # Verify the update was successful by reading back
                verification_query = """
                SELECT 
                    kroger_access_token IS NOT NULL as has_access_token,
                    kroger_refresh_token IS NOT NULL as has_refresh_token,
                    kroger_connected_at IS NOT NULL as has_connected_at,
                    kroger_store_location_id
                FROM user_profiles 
                WHERE id = %s
                """
                
                cur.execute(verification_query, (id,))
                verification_result = cur.fetchone()
                
                if verification_result:
                    logger.info(f"Verification result: {verification_result}")
                else:
                    logger.error(f"Verification failed: Could not read back user data")
                
                return rows_affected > 0
            
            logger.warning("No fields to update")
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
            # Don't try to get client_id and client_secret from database - they should come from env vars
            query = """
            SELECT 
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
                "access_token_present": bool(result.get('kroger_access_token')),
                "refresh_token_present": bool(result.get('kroger_refresh_token')),
                "store_location_present": bool(result.get('kroger_store_location_id'))
            }
            logger.info(f"Kroger credentials check for user {id}: {log_details}")

            # Return only the user-specific tokens and location, not client credentials
            return {
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

def get_kroger_password_for_auth(user_id: int, provided_password: str) -> Optional[str]:
    """
    Legacy function - Kroger password functionality has been removed.
    
    Args:
        user_id: The user's ID
        provided_password: The password provided by the user for verification
        
    Returns:
        None: Always returns None since password functionality is removed
    """
    logger.warning(f"Kroger password authentication requested for user {user_id}, but password functionality has been removed")
    return None
        
def update_kroger_tokens(user_id: int, access_token: str, refresh_token: Optional[str] = None) -> bool:
    """
    Update Kroger tokens for a specific user
    
    This function updates the Kroger access and refresh tokens in the database
    for a specific user. It's primarily used during token refresh operations.
    
    Args:
        user_id: The database ID of the user
        access_token: The new access token
        refresh_token: The new refresh token (optional)
        
    Returns:
        bool: True if the update was successful, False otherwise
    """
    logger.info(f"Updating Kroger tokens for user {user_id}")
    
    if not access_token:
        logger.error("No access token provided for update")
        return False
        
    # Use the existing save_kroger_credentials function
    return save_kroger_credentials(
        id=user_id,
        access_token=access_token,
        refresh_token=refresh_token
    )