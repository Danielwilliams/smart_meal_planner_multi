# Specialized Connection Pool Implementation

We've modified the Smart Meal Planner's database connection handling to use specialized connection pools for different types of operations. This addresses the concurrency issues where menu generation was blocking shopping list access.

## IMPORTANT: Fix for ThreadedConnectionPool.getconn() Error

The initial implementation encountered an error with the ThreadedConnectionPool.getconn() method not accepting a timeout parameter. The code has been updated to remove all timeout parameters from function calls.

## Summary of Changes

1. **Enhanced db.py with three specialized connection pools**:
   - **General Pool (10-40 connections)**: For standard operations
   - **AI Pool (5-20 connections)**: For AI-intensive operations like menu generation
   - **Read Pool (10-30 connections)**: For read-heavy operations like shopping lists

2. **Updated key files to use the appropriate pools**:
   - `menu.py`: Uses AI pool for menu generation, read pool for retrievals
   - `grocery_list.py`: Uses read pool for shopping list operations
   - `meal_grocery_list.py`: Uses read pool for meal-specific shopping lists

3. **Added timeouts to all database operations** to prevent indefinite hanging

## Production Deployment Considerations

1. **Database Impact**:
   - This implementation may increase the total number of database connections (up to 90 max)
   - Ensure your database server can handle this connection load
   - If using a managed database service, check connection limits and adjust if needed

2. **Deployment Approach**:
   - Deploy during off-peak hours if possible
   - Monitor database connection usage after deployment

## Verification Process

After deployment, verify that the issue is resolved by:

1. Generate a menu while simultaneously accessing shopping lists
2. Access recipe browser during menu generation
3. Check server logs for any connection pool errors or timeouts

## Pool Configuration

The pool sizes can be adjusted based on your specific workload:

```python
# General purpose connection pool (for most operations)
general_pool = pool.ThreadedConnectionPool(
    minconn=10,     # Minimum number of connections in the pool
    maxconn=40,     # Maximum number of connections in the pool
    ...
)

# Dedicated pool for AI operations (menu generation, etc.)
ai_pool = pool.ThreadedConnectionPool(
    minconn=5,      # AI operations need fewer but dedicated connections
    maxconn=20,     # Still substantial for multiple concurrent AI operations
    ...
)

# Read-only operations pool (for shopping lists, browsing recipes, etc.)
read_pool = pool.ThreadedConnectionPool(
    minconn=10,     # More connections for read operations which are frequent
    maxconn=30,     # Substantial pool for concurrent read operations
    ...
)
```

## Rollback Plan

If issues arise after deployment:

1. You can revert to the original db.py file (backed up as db.py.bak)
2. No database schema changes were required for this implementation

## Troubleshooting

If you encounter issues:

1. **Connection Timeouts**:
   - Check the timeout values in each pool usage
   - Consider increasing timeouts for complex operations

2. **Pool Exhaustion**:
   - Increase the `maxconn` value for the affected pool
   - Look for connection leaks (connections not being returned to the pool)

3. **Performance Issues**:
   - Ensure each operation is using the appropriate pool
   - Consider adding indexes to frequently queried tables

## Log Monitoring

Watch for these log patterns to identify issues:

- `"Timeout reached waiting for {pool_type} pool connection"`: Indicates pool exhaustion
- `"{pool_type.upper()} Pool Stats"`: Shows connection usage statistics
- `"Error closing {pool_name} connection pool"`: Issues during application shutdown