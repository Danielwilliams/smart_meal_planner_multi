# Database Connection Fix Instructions

We encountered an error in the database connection handling:
```
ERROR: set_session cannot be used inside a transaction
```

This error occurs when trying to set `conn.autocommit = True` inside a transaction. The solution is to set autocommit mode when establishing the connection, before any operations are performed.

## Fix Implementation

1. Copy the fixed database module to replace the current one:

```bash
cp /mnt/d/smart_meal_planner_multi/apps/smart-meal-planner-backend/app/db_fixed.py /mnt/d/smart_meal_planner_multi/apps/smart-meal-planner-backend/app/db.py
```

2. Update all instances in the code where `conn.autocommit = True` is set after connection creation. Here are the key files to update:

### In auth.py:

Look for the pattern:
```python
with get_db_cursor(dict_cursor=False) as (cursor, conn):
    # Enable autocommit to prevent transaction blocking during menu generation
    conn.autocommit = True
```

Replace with:
```python
with get_db_cursor(dict_cursor=False, autocommit=True) as (cursor, conn):
    # Autocommit is enabled at connection creation time
```

### In menu.py:

Look for the pattern:
```python
with get_db_cursor(dict_cursor=True, pool_type='read') as (cursor, conn):
    # Enable autocommit for faster read operations
    conn.autocommit = True
```

Replace with:
```python
with get_db_cursor(dict_cursor=True, pool_type='read', autocommit=True) as (cursor, conn):
    # Autocommit is enabled at connection creation time
```

### In grocery_list.py:

Look for the pattern:
```python
with get_db_cursor(dict_cursor=True, pool_type='read') as (cursor, conn):
    # Enable autocommit to prevent blocking during menu generation
    conn.autocommit = True
```

Replace with:
```python
with get_db_cursor(dict_cursor=True, pool_type='read', autocommit=True) as (cursor, conn):
    # Autocommit is enabled at connection creation time
```

### In meal_grocery_list.py:

Look for the pattern:
```python
with get_db_cursor(dict_cursor=True, pool_type='read') as (cursor, conn):
    # Enable autocommit for faster read operations
    conn.autocommit = True
```

Replace with:
```python
with get_db_cursor(dict_cursor=True, pool_type='read', autocommit=True) as (cursor, conn):
    # Autocommit is enabled at connection creation time
```

## Summary of Changes

1. Added `autocommit` parameter to `get_db_cursor` function
2. Set autocommit mode BEFORE creating the cursor, not after
3. Updated all usages of `conn.autocommit = True` to use the parameter instead

This ensures that autocommit mode is properly set before any operations are performed, preventing the "set_session cannot be used inside a transaction" error.