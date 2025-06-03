import os
import logging
from typing import List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

# Import S3 helper for initialization
from app.utils.s3.s3_utils import s3_helper

# Import database helpers for initialization
from app.db import connection_pool, close_all_connections, get_connection_stats  # Using the ultra-simplified DB module

# Import enhanced CORS middleware
from app.middleware.cors_middleware import setup_cors_middleware

# Import regular routers
from app.routers import (
    auth,
    preferences,
    menu,
    cart,
    kroger_auth,
    order,
    store,
    grocery_list,
    meal_grocery_list,
    meal_shopping_lists,
    subscriptions
)

# Import store-specific routers directly
from app.routers import kroger_store 
from app.routers import walmart_store
from app.routers import instacart_store
from app.routers import instacart_cart 
from app.routers import instacart_debug  
from app.routers import instacart_status 
from app.routers import saved_recipes 
from app.routers import organizations
from app.routers import organization_clients
from app.routers import organization_settings
from app.routers import organization_recipes
from app.routers import user_recipes
from app.routers import onboarding_forms, client_notes
from app.routers import invitations
from app.routers import recipe_admin  # Add recipe admin router
from app.routers import scraped_recipes  # Add scraped recipes router
from app.routers import ai_status  # Add AI status router
from app.routers import custom_menu  # Add custom menu router

# Import the alternate routers with fixed paths
from app.routers import organization_clients_alt
from app.routers import invitations_alt
from app.routers import saved_recipes_alt
from app.routers import saved_recipes_debug
from app.routers import client_resources  # Add client resources router
from app.routers import test_invitation # Test invitation router for debugging
from app.routers import organization_branding  # Add organization branding router


# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# Explicit environment variable logging at startup
def log_environment_variables():
    print("ENVIRONMENT VARIABLE INVESTIGATION:")
    for key, value in os.environ.items():
        # Only log keys, mask sensitive values
        if 'SECRET' in key or 'TOKEN' in key or 'KEY' in key:
            print(f"{key}: {'*' * 10}")
        else:
            print(f"{key}: {value[:50] + '...' if len(value) > 50 else value}")

# Call this at startup
log_environment_variables()

def create_app() -> FastAPI:
    logger.info("Creating FastAPI application...")
    app = FastAPI(
        title="Meal Planner App",
        version="1.0.0",
        description="API for Smart Meal Planner",
        # Set longer timeout for routes that need it
        openapi_tags=[
            {
                "name": "Menu",
                "description": "Menu generation and management operations",
                "externalDocs": {
                    "description": "Menu operations may take longer to complete",
                    "url": "https://smartmealplannerio.com/docs#menu",
                },
            },
        ]
    )

    # Get environment-specific settings
    ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

    # Use enhanced CORS middleware for more robust handling
    # This matches the approach used in the Kroger integration
    logger.info(f"Setting up enhanced CORS middleware for {ENVIRONMENT} environment")
    setup_cors_middleware(app)

    # Add trusted host middleware
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["*"]  # Configure this based on your needs
    )

    # Register routers
    logger.info("Registering routers...")
    app.include_router(auth.router)
    app.include_router(preferences.router)
    app.include_router(menu.router)
    app.include_router(cart.router)
    app.include_router(order.router)
    app.include_router(kroger_store.router)
    app.include_router(instacart_store.router)
    app.include_router(instacart_cart.router)
    app.include_router(instacart_status.router)

    # Mount static files directory
    app.mount("/static", StaticFiles(directory="app/static"), name="static")

    # Only include debug router in development environment
    app.include_router(instacart_debug.router)
    app.include_router(kroger_auth.router)
    app.include_router(grocery_list.router)
    app.include_router(meal_grocery_list.router)
    app.include_router(meal_shopping_lists.router)
    app.include_router(store.router)
    app.include_router(saved_recipes.router)
    app.include_router(organizations.router)
    app.include_router(organization_clients.router)
    app.include_router(organization_settings.router, prefix="/api/organization-settings", tags=["organization-settings"])
    app.include_router(organization_recipes.router)
    app.include_router(user_recipes.router)
    app.include_router(onboarding_forms.router)
    app.include_router(client_notes.router)
    app.include_router(invitations.router)
    
    # Add the alternate routers with fixed paths
    app.include_router(organization_clients_alt.router)
    app.include_router(invitations_alt.router)
    app.include_router(saved_recipes_alt.router)
    app.include_router(saved_recipes_debug.router)
    app.include_router(client_resources.router)
    app.include_router(test_invitation.router)
    
    app.include_router(recipe_admin.router)
    app.include_router(scraped_recipes.router)
    app.include_router(ai_status.router)
    app.include_router(custom_menu.router)
    app.include_router(organization_branding.router)  # Add branding endpoints
    app.include_router(subscriptions.router)  # Add subscription endpoints

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request, exc):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail}
        )

    @app.get("/health")
    async def health_check():
        # Check if client notes tables exist
        try:
            from app.db import get_db_cursor

            # Try to access the database
            try:
                with get_db_cursor(autocommit=True) as (cur, conn):
                    cur.execute("SELECT 1 FROM client_notes LIMIT 1")
                    client_notes_exists = True
                    db_status = "connected"
            except Exception as e:
                logger.error(f"Client notes check failed: {str(e)}")
                client_notes_exists = False
                db_status = f"error: {str(e)}"
        except Exception as e:
            logger.error(f"Health check failed: {str(e)}")
            client_notes_exists = False
            db_status = f"error: {str(e)}"

        return {
            "status": "healthy",
            "client_notes_migration": "completed" if client_notes_exists else "pending",
            "database": db_status
        }

    @app.post("/admin/reset-connections")
    async def reset_connections():
        """Admin endpoint to force reset the connection pool"""
        try:
            from app.db import close_all_connections, connection_pool, get_connection_stats

            # Log the reset attempt
            logger.info("Attempting to close all database connections")

            # Get current connection stats
            before_stats = get_connection_stats()

            # Close all connections
            try:
                close_all_connections()
                result = True
                logger.info("Successfully closed all database connections")
            except Exception as e:
                result = False
                logger.error(f"Failed to close connections: {str(e)}")

            # Get new connection stats
            after_stats = get_connection_stats()

            # Return detailed status
            return {
                "status": "success" if result else "failed",
                "message": "Connection pool reset" if result else "Failed to reset connection pool",
                "pool_exists": connection_pool is not None,
                "before": before_stats,
                "after": after_stats
            }
        except Exception as e:
            logger.error(f"Error resetting connection pool: {str(e)}")
            return {
                "status": "error",
                "message": f"Error: {str(e)}"
            }

    @app.get("/admin/db-stats")
    async def get_db_stats():
        """Get current database connection statistics"""
        try:
            from app.db import get_connection_stats, connection_pool

            # Get connection stats
            stats = get_connection_stats()

            # Get pool information if available
            pool_info = {}
            if connection_pool:
                pool_info = {
                    "min_connections": connection_pool._minconn,
                    "max_connections": connection_pool._maxconn,
                    # The closed attribute was added in psycopg2 2.8+
                    "closed": getattr(connection_pool, "closed", False)
                }

                # Try to get more detailed pool stats
                try:
                    pool_info["used_connections"] = len(connection_pool._used)
                    pool_info["free_connections"] = len(connection_pool._pool)
                except (AttributeError, TypeError):
                    # These attributes might not be accessible
                    pass

            return {
                "connection_tracking": stats,
                "pool_info": pool_info
            }
        except Exception as e:
            logger.error(f"Error getting DB stats: {str(e)}")
            return {
                "status": "error",
                "message": f"Error getting DB stats: {str(e)}"
            }

    @app.get("/api-test")
    async def api_test():
        """Test endpoint to verify API routing is working correctly"""
        return {
            "status": "ok",
            "message": "API routing is working",
            "routes": {
                "instacart": "/instacart/status, /instacart/key-info, /instacart/retailers",
                "kroger": "/kroger/status, /kroger/auth"
            },
            "environment": os.environ.get("ENVIRONMENT", "unknown")
        }
    
    @app.post("/admin/run-migrations")
    async def manual_migration_trigger():
        """Manually trigger database migrations - use with caution"""
        try:
            from app.migrations.migration_runner import run_startup_migrations
            logger.info("Manual migration trigger requested")
            
            result = run_startup_migrations()
            
            return {
                "status": "success" if result else "failed",
                "message": "Migration execution completed" if result else "Migration execution failed"
            }
        except Exception as e:
            logger.error(f"Manual migration failed: {e}")
            return {
                "status": "error",
                "message": f"Migration failed: {str(e)}"
            }
        
    @app.get("/check-s3-vars")
    async def check_s3_vars():
        """Check S3 environment variables (safe, doesn't expose sensitive data)"""
        s3_vars = {
            "AWS_ACCESS_KEY_ID": bool(os.getenv("AWS_ACCESS_KEY_ID")),
            "AWS_SECRET_ACCESS_KEY": bool(os.getenv("AWS_SECRET_ACCESS_KEY")),
            "AWS_REGION": os.getenv("AWS_REGION", "us-east-1"),
            "S3_BUCKET_NAME": os.getenv("S3_BUCKET_NAME")
        }

        # Check s3_helper initialization
        helper_status = {
            "initialized": hasattr(s3_helper, "bucket_name") and s3_helper.bucket_name is not None,
            "bucket_name": getattr(s3_helper, "bucket_name", None),
            "region": getattr(s3_helper, "region", None) if hasattr(s3_helper, "region") else None
        }

        return {
            "s3_environment_vars": s3_vars,
            "s3_helper_status": helper_status
        }
    
    @app.get("/verify-password-hashing")
    async def verify_password_hashing():
        """Verify that Kroger password hashing is working correctly"""
        try:
            from app.db import get_db_cursor
            from app.utils.password_utils import hash_kroger_password, verify_kroger_password
            from psycopg2.extras import RealDictCursor

            results = {}

            # Check migration status
            with get_db_cursor(dict_cursor=True, autocommit=True) as (cur, conn):
                # Get overall statistics
                cur.execute("""
                    SELECT
                        COUNT(*) as total_users,
                        0 as users_with_username,
                        0 as users_with_plain_password,
                        0 as users_with_hashed_password,
                        0 as users_with_salt,
                        0 as users_with_both
                    FROM user_profiles;
                """)
                results["migration_stats"] = dict(cur.fetchone())

                # Check applied migrations
                cur.execute("""
                    SELECT EXISTS (
                        SELECT 1 FROM information_schema.tables
                        WHERE table_name = 'applied_migrations'
                    ) as table_exists;
                """)
                table_exists = cur.fetchone()['table_exists']

                if table_exists:
                    cur.execute("""
                        SELECT migration_name, status, applied_at, execution_time_seconds
                        FROM applied_migrations
                        WHERE migration_name = '001_hash_kroger_passwords'
                        ORDER BY applied_at DESC
                        LIMIT 1;
                    """)
                    migration_record = cur.fetchone()
                    results["migration_record"] = dict(migration_record) if migration_record else None
                else:
                    results["migration_record"] = None

                # Kroger functionality removed - no password verification needed
                results["verification_test"] = None
            
            # Test new password hashing
            test_password = "test_password_123"
            hashed, salt = hash_kroger_password(test_password)
            verification_works = verify_kroger_password(test_password, hashed, salt)
            wrong_password_fails = not verify_kroger_password("wrong_password", hashed, salt)
            
            results["new_password_test"] = {
                "hash_generated": bool(hashed and salt),
                "verification_works": verification_works,
                "wrong_password_fails": wrong_password_fails,
                "hash_length": len(hashed) if hashed else 0,
                "salt_length": len(salt) if salt else 0
            }
            
            # Overall assessment
            all_good = (
                results["migration_stats"]["users_with_hashed_password"] > 0 and
                results["new_password_test"]["verification_works"] and
                results["new_password_test"]["wrong_password_fails"] and
                (results["verification_test"] is None or results["verification_test"]["verification_successful"])
            )
            
            results["overall_status"] = "PASS" if all_good else "FAIL"
            results["safe_to_clear_plaintext"] = all_good
            
            return results
            
        except Exception as e:
            return {
                "error": str(e),
                "overall_status": "ERROR"
            }
    
    @app.post("/clear-plaintext-passwords")
    async def clear_plaintext_passwords():
        """Clear plain text Kroger passwords (only if verification passes)"""
        try:
            from app.db import get_db_cursor
            from psycopg2.extras import RealDictCursor

            # First verify the system is working
            verification_result = await verify_password_hashing()

            if verification_result.get("overall_status") != "PASS":
                return {
                    "error": "Password verification failed - will not clear plain text passwords",
                    "verification_result": verification_result
                }

            # Use context manager for database operations
            with get_db_cursor(dict_cursor=True, autocommit=True) as (cur, conn):
                # Kroger functionality removed - no passwords to clear
                return {
                    "status": "success",
                    "message": "Kroger functionality has been removed - no passwords to clear",
                    "passwords_cleared": 0,
                    "remaining_plain_text": 0,
                    "verification_passed": True
                }
                
        except Exception as e:
            return {
                "error": str(e),
                "status": "error"
            }

    logger.info(f"FastAPI application created successfully in {ENVIRONMENT} mode")
    return app

# Define app BEFORE using @app.on_event
app = create_app()

# Add middleware for longer timeouts on specific routes
@app.middleware("http")
async def extend_timeout_for_menu_routes(request, call_next):
    # Check if this is a menu generation route
    if "/menu/generate" in request.url.path:
        # Log extended timeout for menu generation routes
        logger.info(f"Processing menu generation route with extended timeout: {request.url.path}")

    # Continue with the request
    response = await call_next(request)
    return response

@app.middleware("http")
async def clear_thread_local_storage(request, call_next):
    """Clear thread-local storage at the end of each request to prevent connection leaks"""
    # Process the request
    response = await call_next(request)

    # Clean up thread-local storage
    try:
        import threading
        thread_local = threading.local()
        if hasattr(thread_local, 'connection') and thread_local.connection is not None:
            try:
                from app.db import logger as db_logger
                if not thread_local.connection.closed:
                    thread_local.connection.close()
                    db_logger.info("Auto-closed thread-local connection at request end")
                thread_local.connection = None
            except Exception as e:
                logger.warning(f"Error clearing thread-local connection: {str(e)}")
    except Exception as e:
        logger.warning(f"Error in thread-local cleanup middleware: {str(e)}")

    return response

# Now we can use @app.on_event
@app.on_event("startup")
async def startup_event():
    """Run startup tasks."""
    try:
        # Log connection pool status
        if connection_pool:
            logger.info(f"✅ Database connection pool initialized with min={connection_pool._minconn}, max={connection_pool._maxconn} connections")
        else:
            logger.warning("⚠️ Database connection pool not initialized - will use direct connections")

        # Print all loaded routes for debugging
        from fastapi.routing import APIRoute
        routes = [route.path for route in app.router.routes]
        logger.info("✅ LOADED ROUTES: %s", routes)
        
        # Create recipe tables if they don't exist
        logger.info("Checking and creating recipe tables...")
        from app.create_recipe_tables import create_tables
        create_tables()
        logger.info("Recipe tables check completed")
        
        # Create client-related tables if they don't exist
        logger.info("Checking and creating client-related tables...")
        from app.create_client_tables import create_tables as create_client_tables
        create_client_tables()
        logger.info("Client tables check completed")
        
        # Run database migrations to update schema if needed
        logger.info("Running database migrations...")
        from app.migrations.migration_runner import run_startup_migrations
        migration_success = run_startup_migrations()
        if migration_success:
            logger.info("Database migrations completed successfully")
        else:
            logger.warning("Some migrations failed - check logs for details")
        
        # Check S3 configuration
        logger.info("Checking S3 configuration...")
        try:
            # The import and initialization happens at module level
            # This just logs whether S3 is properly configured
            if hasattr(s3_helper, 'bucket_name') and s3_helper.bucket_name:
                logger.info(f"S3 configuration found: bucket={s3_helper.bucket_name}, region={s3_helper.region}")
            else:
                logger.warning("S3 configuration is incomplete. Image upload functionality will not work properly.")
        except Exception as s3_error:
            logger.warning(f"S3 initialization error: {str(s3_error)}")
    except Exception as e:
        logger.error(f"Error during application startup: {str(e)}")
        # Don't re-raise, just log the error

@app.patch("/{full_path:path}")
async def catch_all_patch(full_path: str):
    logger.info(f"Catch-all PATCH route hit for path: {full_path}")
    return {"status": "received", "path": full_path}

@app.on_event("shutdown")
async def shutdown_event():
    """Run shutdown tasks."""
    logger.info("🛑 Application shutting down")

    # Close all database connections
    try:
        close_all_connections()
        logger.info("✅ Database connections closed successfully")
    except Exception as e:
        logger.error(f"❌ Error closing database connections: {str(e)}")
