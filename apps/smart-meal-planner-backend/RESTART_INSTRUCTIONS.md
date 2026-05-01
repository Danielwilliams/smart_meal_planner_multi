# Restart Instructions for Database Connection Fix

We've made significant changes to the database connection handling. Here's what you need to do to apply the fix:

1. Deploy the updated files:
   - app/db_simplified.py
   - app/routers/menu.py
   - app/routers/grocery_list.py
   - app/routers/meal_grocery_list.py
   - app/main.py

2. Restart the application with:
   ```
   # Railway
   railway up

   # Heroku
   heroku restart -a your-app-name
   ```

3. Monitor the logs for any connection errors after restart

## What Changed

We've removed the specialized connection pools approach in favor of a single unified pool. Key changes:

1. The `pool_type` parameter has been completely removed
2. All router files have been updated to remove the parameter
3. Setting `autocommit=True` is now the primary way to optimize read-heavy operations

## Verifying the Fix

After deploying, check that:

1. The frontend loads properly
2. Menu generation works without hanging
3. Shopping lists can be accessed while menus are generating

If you encounter any issues, check the logs for connection-related errors and increase the log level if needed.