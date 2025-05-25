"""
CORS Middleware for FastAPI

This middleware ensures that direct cross-origin requests from the frontend
can be handled properly, similar to how the Kroger integration works.
"""

from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI
import logging

logger = logging.getLogger(__name__)

def setup_cors_middleware(app: FastAPI) -> None:
    """
    Set up CORS middleware for the application to allow direct frontend requests,
    similar to how the Kroger integration works.
    
    Args:
        app: The FastAPI application instance
    """
    # Use a more permissive CORS policy to allow direct frontend requests
    origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://smartmealplannerio.vercel.app",
        "https://www.smartmealplannerio.com",
        "https://api.smartmealplannerio.com",
        "https://smartmealplannerio.com",
        "https://smart-meal-planner-multi.vercel.app",
    ]
    
    logger.info("Setting up enhanced CORS middleware to allow direct frontend requests")
    
    # Add middleware with explicit configuration
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,  # Enable credentials for authentication
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        allow_headers=[
            "Content-Type", 
            "Authorization", 
            "X-Instacart-API-Key",
            "X-Requested-With",
            "Accept"
        ],
        expose_headers=["Content-Type", "X-Process-Time"],
        max_age=600  # 10 minutes cache for preflight requests
    )
    
    logger.info(f"Enhanced CORS middleware configured with origins: {', '.join(str(o) for o in origins)}")