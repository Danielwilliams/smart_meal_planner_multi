"""
Enhanced main application file showing how to implement and configure specialized connection pools.
"""

from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import time
from app.middleware.cors_middleware import add_cors_middleware
import traceback
import os
import psycopg2

# Import the enhanced DB module with specialized connection pools
from app.db_enhanced import (
    general_pool, ai_pool, read_pool,
    log_connection_stats, close_all_connections,
    _connection_stats
)

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Startup and shutdown event handlers
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Log pool configuration and status
    logger.info("Application starting up...")
    
    # Log initial connection pool status
    try:
        for pool_type in ['general', 'ai', 'read']:
            log_connection_stats(pool_type)
    except Exception as e:
        logger.error(f"Error logging initial pool stats: {e}")
    
    # Perform any other startup tasks
    logger.info("Application startup complete")
    
    yield  # Application runs here
    
    # Shutdown: Close all connections and clean up
    logger.info("Application shutting down...")
    try:
        # Close all database connections in all pools
        close_all_connections()
        logger.info("All database connections closed")
        
        # Log final connection stats
        for pool_type, stats in _connection_stats.items():
            logger.info(f"Final {pool_type} pool stats: {stats}")
    except Exception as e:
        logger.error(f"Error during application shutdown: {e}")
    
    logger.info("Application shutdown complete")

# Create the FastAPI application
app = FastAPI(
    title="Smart Meal Planner API",
    description="API for generating meal plans with AI",
    version="2.0.0",
    lifespan=lifespan
)

# Add CORS middleware
add_cors_middleware(app)

# Add timing middleware to track response times
@app.middleware("http")
async def add_timing_middleware(request: Request, call_next):
    start_time = time.time()
    
    try:
        # Process the request
        response = await call_next(request)
        
        # Calculate processing time
        process_time = time.time() - start_time
        
        # Add timing header
        response.headers["X-Process-Time"] = str(process_time)
        
        # Log timing for monitoring
        logger.debug(f"Request to {request.url.path} processed in {process_time:.4f} seconds")
        
        # If the request took more than 2 seconds, log as warning for further investigation
        if process_time > 2.0:
            logger.warning(f"Slow request: {request.method} {request.url.path} took {process_time:.4f} seconds")
            
            # Log connection pool stats if a request is slow
            for pool_type in ['general', 'ai', 'read']:
                log_connection_stats(pool_type)
        
        return response
    except Exception as e:
        # Calculate time even for failed requests
        process_time = time.time() - start_time
        
        # Log the error with timing information
        logger.error(
            f"Error processing request to {request.url.path} after {process_time:.4f} seconds: {str(e)}\n"
            f"Traceback: {traceback.format_exc()}"
        )
        
        # Re-raise the exception to let FastAPI handle it
        raise

# Import all routers
from app.routers import menu, grocery_list, meal_grocery_list

# Include all routers with appropriate prefixes
app.include_router(menu.router, prefix="/api/menu", tags=["menu"])
app.include_router(grocery_list.router, prefix="/api/menu", tags=["grocery"])
app.include_router(meal_grocery_list.router, prefix="/api/menu", tags=["meal-grocery"])

# Health check endpoint with connection pool status
@app.get("/api/health", tags=["system"])
def health_check():
    """Health check endpoint that validates database connections"""
    health_status = {
        "status": "healthy",
        "database": {
            "general_pool": "unknown",
            "ai_pool": "unknown",
            "read_pool": "unknown"
        },
        "pools": {}
    }
    
    # Check each pool by making a test connection
    pools = [
        ("general_pool", general_pool),
        ("ai_pool", ai_pool),
        ("read_pool", read_pool)
    ]
    
    for pool_name, pool_obj in pools:
        if pool_obj:
            conn = None
            try:
                # Try to get a connection from the pool
                conn = pool_obj.getconn(key=None)
                
                # Run a simple query to validate the connection
                cursor = conn.cursor()
                cursor.execute("SELECT 1")
                result = cursor.fetchone()
                cursor.close()
                
                # If we get here, the connection is working
                health_status["database"][pool_name] = "connected"
                
            except Exception as e:
                # Connection failed
                health_status["database"][pool_name] = f"error: {str(e)}"
                health_status["status"] = "degraded"
                
            finally:
                # Return the connection to the pool
                if conn and pool_obj:
                    pool_obj.putconn(conn)
        else:
            health_status["database"][pool_name] = "pool not initialized"
            health_status["status"] = "degraded"
    
    # Add connection stats to the health check
    for pool_type, stats in _connection_stats.items():
        health_status["pools"][pool_type] = {
            "active": stats["active_connections"],
            "peak": stats["peak_connections"],
            "total_requests": stats["total_connections"],
            "errors": stats["connection_errors"]
        }
    
    return health_status

# Root path redirect to docs
@app.get("/", include_in_schema=False)
def root():
    """Redirect root path to API documentation"""
    return {"message": "Smart Meal Planner API", "docs_url": "/docs"}

# Error handlers
@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle any unhandled exceptions"""
    logger.error(f"Unhandled exception in {request.method} {request.url.path}: {str(exc)}")
    logger.error(traceback.format_exc())
    
    # Log connection pool stats on error
    for pool_type in ['general', 'ai', 'read']:
        log_connection_stats(pool_type)
    
    return {
        "detail": "Internal server error",
        "message": str(exc) if os.getenv("DEBUG") == "true" else "An unexpected error occurred"
    }

# Run the application with uvicorn
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)