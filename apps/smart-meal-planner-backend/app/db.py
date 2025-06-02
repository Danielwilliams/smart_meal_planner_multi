# app/db.py - Compatibility redirect module
# This file redirects imports from the old db.py to db_super_simple.py

import logging
from app.db_super_simple import (
    get_db_connection, 
    get_db_cursor,
    connection_pool,
    close_all_connections
)

logger = logging.getLogger(__name__)
logger.warning("Using compatibility db.py module - imports redirected to db_super_simple.py")

# Add empty compatibility variables to prevent import errors
_connection_stats = {
    'total_connections': 0,
    'active_connections': 0,
    'peak_connections': 0,
    'connection_errors': 0,
    'last_pool_exhaustion': None,
    'last_reset': None
}

def log_connection_stats():
    """Compatibility function that does nothing"""
    pass

def reset_connection_pool():
    """Compatibility function that calls the actual reset function"""
    from app.db_super_simple import close_all_connections
    return close_all_connections()