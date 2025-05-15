"""
Middleware package for FastAPI application
"""

from app.middleware.cors_middleware import setup_cors_middleware

__all__ = ['setup_cors_middleware']