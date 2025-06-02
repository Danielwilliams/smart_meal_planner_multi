# Connection Pool and Autocommit Fix

This document outlines the changes made to fix the concurrency issues and the "set_session cannot be used inside a transaction" error.

## Summary of Changes

### 1. Enhanced DB Connection Pool Implementation
- Created three specialized connection pools:
  - **General Pool (10-40 connections)**: For standard operations
  - **AI Pool (5-20 connections)**: For AI-intensive operations like menu generation
  - **Read Pool (10-30 connections)**: For read-heavy operations like shopping lists

### 2. Fixed Autocommit Mode Setting
- Added `autocommit` parameter to `get_db_cursor` function
- Set autocommit mode BEFORE creating the cursor, not after
- Updated all usages of `conn.autocommit = True` to use the parameter instead
- Prevents "set_session cannot be used inside a transaction" errors

### 3. Updated Key Files
- auth.py: Login and other authentication operations
- menu.py: Menu generation and retrieval 
- grocery_list.py: Shopping list generation
- meal_grocery_list.py: Meal-specific shopping lists

## Technical Details

### Connection Pool Implementation

```python
# Create specialized connection pools
general_pool = pool.ThreadedConnectionPool(minconn=10, maxconn=40, ...)
ai_pool = pool.ThreadedConnectionPool(minconn=5, maxconn=20, ...)
read_pool = pool.ThreadedConnectionPool(minconn=10, maxconn=30, ...)
```

### Autocommit Parameter Implementation

```python
@contextmanager
def get_db_cursor(dict_cursor=True, pool_type='general', autocommit=False):
    """Context manager for safely handling database connections and cursors."""
    conn = None
    cursor = None
    try:
        conn = get_db_connection(pool_type=pool_type)
        
        # Set autocommit BEFORE creating cursor
        if autocommit:
            conn.autocommit = True
            
        # Create cursor
        cursor = conn.cursor(...)
        
        yield cursor, conn
    # Exception handling and cleanup...
```

### Updated Usage Pattern

Before:
```python
with get_db_cursor(dict_cursor=True) as (cursor, conn):
    # This could fail if any SQL has been executed
    conn.autocommit = True
    cursor.execute("SELECT * FROM table")
```

After:
```python
with get_db_cursor(dict_cursor=True, autocommit=True) as (cursor, conn):
    # Autocommit already set correctly
    cursor.execute("SELECT * FROM table")
```

## Benefits

1. **Improved Concurrency**: Different operation types won't block each other
2. **Prevents Transaction Errors**: Autocommit mode is set correctly before any operations
3. **Better Resource Allocation**: AI operations and read operations have dedicated resources
4. **Scalability**: System can handle more concurrent users and operations

## Monitoring

Watch the logs for these patterns to verify the fix is working:
- "Set autocommit=True for {pool_type} connection"
- "{pool_type.upper()} Pool Stats" showing connection usage statistics

## Rollback Plan (If Needed)

1. The original db.py file is backed up as db.py.bak
2. No database schema changes were required for this implementation