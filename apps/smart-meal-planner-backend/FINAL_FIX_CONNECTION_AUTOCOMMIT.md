# Final Fix for Database Connection and Autocommit Issues

## Problem Identified

We encountered two related issues:

1. Concurrency problems where menu generation would block database access for shopping lists
2. "set_session cannot be used inside a transaction" errors when trying to set autocommit mode

## Root Cause Analysis

1. **Transaction State Issue**: When a connection is returned from the connection pool, it may already be in a transaction state. Trying to set autocommit mode inside an active transaction causes the "set_session cannot be used inside a transaction" error.

2. **Single Pool Bottleneck**: Using a single connection pool for all operations means that long-running operations like menu generation would block other operations.

## Solution Implemented

We made the following changes to fix these issues:

### 1. Enhanced Connection Management

- **Pre-transaction Rollback**: Added a rollback operation before setting autocommit to ensure the connection is in a clean state
- **Early Autocommit Setting**: Set autocommit at connection acquisition time rather than after getting the cursor
- **Consistent Parameter Passing**: Updated `get_db_connection` to accept and apply the autocommit parameter

```python
def get_db_connection(pool_type='general', autocommit=False):
    # ...
    conn = connection_pool.getconn()
    
    # Clean up any active transaction first
    try:
        conn.rollback()  # Ensures clean state
    except Exception:
        pass
        
    # Now safe to set autocommit
    if autocommit:
        conn.autocommit = True
    # ...
```

### 2. Specialized Connection Pools

- **General Pool (10-40 connections)**: For standard operations
- **AI Pool (5-20 connections)**: For AI-intensive operations like menu generation
- **Read Pool (10-30 connections)**: For read-heavy operations like shopping lists

### 3. Updated Client Code

- Changed all instances of:
  ```python
  with get_db_cursor(...) as (cursor, conn):
      conn.autocommit = True  # PROBLEMATIC!
  ```
  
  To:
  ```python
  with get_db_cursor(..., autocommit=True) as (cursor, conn):
      # Autocommit already set correctly
  ```

## Files Updated

1. **db.py**: 
   - Added autocommit parameter to `get_db_connection`
   - Added rollback before setting autocommit
   - Removed setting autocommit in `get_db_cursor`

2. **auth.py**, **menu.py**, **grocery_list.py**, **meal_grocery_list.py**:
   - Updated all code to use the autocommit parameter instead of setting it after connection creation

## Testing

The fix should be tested with:

1. Concurrent users generating menus
2. Simultaneous access to shopping lists during menu generation
3. Login and authentication operations

## Benefits

1. **Transaction Safety**: No more "set_session cannot be used inside a transaction" errors
2. **Concurrency**: Different operations don't block each other
3. **Resource Isolation**: AI operations don't consume all database connections
4. **Performance**: Better parallelism for user operations