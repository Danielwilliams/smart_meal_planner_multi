#!/usr/bin/env python3
"""
Simple test script to check if user_management module can be imported
"""

try:
    from app.routers import user_management
    print("✅ user_management module imported successfully")
    print(f"Router object: {user_management.router}")
    print(f"Routes: {[route.path for route in user_management.router.routes]}")
except Exception as e:
    print(f"❌ Error importing user_management: {e}")
    import traceback
    traceback.print_exc()