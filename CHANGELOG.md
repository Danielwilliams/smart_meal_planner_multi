# Smart Meal Planner Changelog

## Recent Enhancements

### Snack Instructions Enhancement (June 3, 2025)
- Added automatic instruction generation for complex snacks
- Improved user experience by providing clear preparation steps for all snacks
- Tailored instructions based on ingredient type and snack complexity
- See [SNACK_INSTRUCTIONS_ENHANCEMENT.md](/apps/smart-meal-planner-backend/SNACK_INSTRUCTIONS_ENHANCEMENT.md) for details

## Major Fixes and Improvements

### Database Connection Handling
- Implemented thread-local storage for database connections
- Added connection pool management to prevent connection exhaustion
- Fixed connection leakage issues by ensuring proper closing of connections
- Added connection validation to prevent "connection already closed" errors
- Implemented middleware for cleaning up connections after requests
- Set proper statement timeouts to prevent hanging queries
- Fixed autocommit issues to prevent "set_session cannot be used inside a transaction" errors

### Router Improvements
- Updated organization_clients_alt.py to use get_db_cursor() properly
- Fixed organization_branding.py to handle JSON data correctly
- Fixed client_resources.py to use autocommit correctly
- Standardized database access patterns across all routers

### UI Enhancements
- Restricted "Generate Menu" functionality to organization accounts only
- Added appropriate UI messages for client accounts
- Improved client profile interface to match user permissions

### Other Improvements
- Standardized diet tags format in database
- Enhanced unit quantity recognition
- Implemented specialized connection pool for high-concurrency operations
- Fixed shopping list concurrency issues
- Added support for user-specific recipes
- Enhanced security for Kroger passwords

## Database Migration History
- All migrations have been successfully applied
- Database schema is now up-to-date with the latest version

## Project Cleanup (Current)
- Removed redundant database backup files
- Consolidated documentation files
- Organized project structure
- Removed outdated SQL migration files
- Archived legacy test files and examples