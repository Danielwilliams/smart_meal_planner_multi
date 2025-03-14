import os
import logging
from typing import List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from dotenv import load_dotenv

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
from app.routers import saved_recipes 
from app.routers import organizations


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
        description="API for Smart Meal Planner"
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
        "https://smart-meal-planner-multi.vercel.app"
    ]

    if ENVIRONMENT == "production":
        # Add production-specific origins if needed
        logger.info("Configuring production CORS settings...")
    else:
        logger.info("Configuring development CORS settings...")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Allow all origins temporarily
        allow_credentials=True,
        allow_methods=["*"],  # Allow all methods
        allow_headers=["*"],  # Allow all headers
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
    app.include_router(kroger_auth.router)
    app.include_router(grocery_list.router)
    app.include_router(store.router)
    app.include_router(saved_recipes.router)
    app.include_router(organizations.router)

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request, exc):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail}
        )

    @app.get("/health")
    async def health_check():
        return {"status": "healthy"}

    logger.info(f"FastAPI application created successfully in {ENVIRONMENT} mode")
    return app

# Define app BEFORE using @app.on_event
app = create_app()

# Now we can use @app.on_event
@app.on_event("startup")
async def show_routes():
    """Print all loaded routes at startup for debugging."""
    from fastapi.routing import APIRoute
    routes = [route.path for route in app.router.routes]
    logger.info("✅ LOADED ROUTES: %s", routes)

@app.patch("/{full_path:path}")
async def catch_all_patch(full_path: str):
    logger.info(f"Catch-all PATCH route hit for path: {full_path}")
    return {"status": "received", "path": full_path}