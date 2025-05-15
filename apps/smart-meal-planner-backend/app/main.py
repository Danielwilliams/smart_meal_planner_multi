import os
import logging
from typing import List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from dotenv import load_dotenv

# Import S3 helper for initialization
from app.utils.s3.s3_utils import s3_helper

# Import regular routers
from app.routers import (
    auth,
    preferences,
    menu,
    cart,
    kroger_auth,
    order,
    store,
    grocery_list
)

# Import store-specific routers directly
from app.routers.kroger_store import router as kroger_store_router
from app.routers.walmart_store import router as walmart_store_router
from app.routers.instacart_store import router as instacart_store_router
from app.routers.instacart_cart import router as instacart_cart_router
from app.routers.instacart_debug import router as instacart_debug_router
from app.routers.instacart_status import router as instacart_status_router
from app.routers import saved_recipes 
from app.routers import organizations
from app.routers import organization_clients
from app.routers import invitations
from app.routers import recipe_admin  # Add recipe admin router
from app.routers import scraped_recipes  # Add scraped recipes router
from app.routers import ai_status  # Add AI status router
from app.routers import custom_menu  # Add custom menu router

# Import the alternate routers with fixed paths
from app.routers import organization_clients_alt
from app.routers import invitations_alt
from app.routers import saved_recipes_alt
from app.routers import client_resources  # Add client resources router
from app.routers import test_invitation # Test invitation router for debugging


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
    
    # Configure CORS
    origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://smartmealplannerio.vercel.app",
        "https://www.smartmealplannerio.com",
        "https://api.smartmealplannerio.com",
        "https://smart-meal-planner-multi.vercel.app",
        # Allow production domain
        "https://smartmealplannerio.com"
    ]

    if ENVIRONMENT == "production":
        # Add production-specific origins if needed
        logger.info("Configuring production CORS settings...")
    else:
        logger.info("Configuring development CORS settings...")

    # Set up CORS middleware with explicit origin list
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        allow_headers=["Content-Type", "Authorization", "X-Instacart-API-Key", "Accept"],
        expose_headers=["Content-Type", "X-Process-Time"],
        max_age=600  # 10 minutes cache for preflight requests
    )

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
    app.include_router(kroger_store_router)
    app.include_router(walmart_store_router)
    app.include_router(instacart_store_router)
    app.include_router(instacart_cart_router)
    app.include_router(instacart_status_router)

    # Only include debug router in development environment
    if ENVIRONMENT == "development":
        logger.info("Registering Instacart debug router (development only)...")
        app.include_router(instacart_debug_router)
    app.include_router(kroger_auth.router)
    app.include_router(grocery_list.router)
    app.include_router(store.router)
    app.include_router(saved_recipes.router)
    app.include_router(organizations.router)
    app.include_router(organization_clients.router)
    app.include_router(invitations.router)
    
    # Add the alternate routers with fixed paths
    app.include_router(organization_clients_alt.router)
    app.include_router(invitations_alt.router)
    app.include_router(saved_recipes_alt.router)
    app.include_router(client_resources.router)
    app.include_router(test_invitation.router)
    
    app.include_router(recipe_admin.router)
    app.include_router(scraped_recipes.router)
    app.include_router(ai_status.router)
    app.include_router(custom_menu.router)

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request, exc):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail}
        )

    @app.get("/health")
    async def health_check():
        return {"status": "healthy"}
        
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

# Now we can use @app.on_event
@app.on_event("startup")
async def startup_event():
    """Run startup tasks."""
    try:
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
        from app.migrations import run_migrations
        run_migrations()
        logger.info("Database migrations completed")
        
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
