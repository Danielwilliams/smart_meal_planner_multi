import os
import logging
from typing import List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from dotenv import load_dotenv
from app.routers import auth, preferences, menu, cart, kroger_auth, order, store, grocery_list

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

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
    ]

    if ENVIRONMENT == "production":
        # Add production-specific origins if needed
        logger.info("Configuring production CORS settings...")
    else:
        logger.info("Configuring development CORS settings...")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "https://smartmealplannerio.vercel.app",
            "https://www.smartmealplannerio.com",
            "https://api.smartmealplannerio.com",
        ],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        allow_headers=["Content-Type", "Authorization"],
    )

   # Handle CORS preflight OPTIONS requests
    @app.options("/{full_path:path}")
    async def preflight_handler(full_path: str):
        return JSONResponse(
            content={"message": "CORS preflight successful"},
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
                "Access-Control-Allow-Headers": "Authorization, Content-Type"
            },
            status_code=200
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
    app.include_router(kroger_auth.router)
    app.include_router(grocery_list.router)
    app.include_router(store.router)

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
