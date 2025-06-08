#!/usr/bin/env python3
"""
Simple test script to verify the rating system functionality
Tests the database connection and basic rating operations
"""

import sys
import os
import json
import asyncio
from datetime import datetime

# Add the app directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '.'))

def test_database_connection():
    """Test basic database connectivity"""
    print("🔍 Testing database connection...")
    try:
        from app.db import get_db_cursor
        
        with get_db_cursor(dict_cursor=True, autocommit=True) as (cur, conn):
            cur.execute("SELECT 1 as test_value")
            result = cur.fetchone()
            if result and result['test_value'] == 1:
                print("✅ Database connection successful")
                return True
            else:
                print("❌ Database connection failed - unexpected result")
                return False
    except Exception as e:
        print(f"❌ Database connection failed: {str(e)}")
        return False

def test_rating_tables():
    """Test that rating tables and views exist"""
    print("\n🔍 Testing rating database objects...")
    try:
        from app.db import get_db_cursor
        
        with get_db_cursor(dict_cursor=True, autocommit=True) as (cur, conn):
            # Test recipe_interactions table
            cur.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'recipe_interactions'
                )
            """)
            table_exists = cur.fetchone()['exists']
            
            if table_exists:
                print("✅ recipe_interactions table exists")
            else:
                print("❌ recipe_interactions table missing")
                return False
            
            # Test rating views
            views_to_check = ['recipe_ratings_summary', 'user_rating_preferences']
            for view_name in views_to_check:
                cur.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.views 
                        WHERE table_schema = 'public' 
                        AND table_name = %s
                    )
                """, (view_name,))
                view_exists = cur.fetchone()['exists']
                
                if view_exists:
                    print(f"✅ {view_name} view exists")
                else:
                    print(f"❌ {view_name} view missing")
                    return False
            
            # Test rating function
            cur.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.routines 
                    WHERE routine_schema = 'public' 
                    AND routine_name = 'get_or_create_recipe_interaction'
                )
            """)
            function_exists = cur.fetchone()['exists']
            
            if function_exists:
                print("✅ get_or_create_recipe_interaction function exists")
            else:
                print("❌ get_or_create_recipe_interaction function missing")
                return False
            
            return True
            
    except Exception as e:
        print(f"❌ Rating tables test failed: {str(e)}")
        return False

def test_rating_router_import():
    """Test that the rating router can be imported"""
    print("\n🔍 Testing rating router import...")
    try:
        from app.routers.recipe_ratings import router
        
        # Check that the router has routes
        if hasattr(router, 'routes') and len(router.routes) > 0:
            print(f"✅ Rating router imported successfully with {len(router.routes)} routes")
            
            # List the routes
            for route in router.routes:
                if hasattr(route, 'path') and hasattr(route, 'methods'):
                    print(f"   📋 {list(route.methods)} {route.path}")
            
            return True
        else:
            print("❌ Rating router has no routes")
            return False
            
    except Exception as e:
        print(f"❌ Rating router import failed: {str(e)}")
        return False

def test_rating_models():
    """Test that rating Pydantic models are working"""
    print("\n🔍 Testing rating models...")
    try:
        from app.routers.recipe_ratings import RecipeRating, RatingAspects
        
        # Test basic rating model
        rating_data = {
            "rating_score": 4,
            "feedback_text": "Great recipe!",
            "made_recipe": True,
            "would_make_again": True
        }
        
        rating = RecipeRating(**rating_data)
        if rating.rating_score == 4:
            print("✅ RecipeRating model validation works")
        else:
            print("❌ RecipeRating model validation failed")
            return False
        
        # Test rating aspects
        aspects_data = {
            "taste": 5,
            "ease_of_preparation": 3,
            "ingredient_availability": 4
        }
        
        aspects = RatingAspects(**aspects_data)
        if aspects.taste == 5:
            print("✅ RatingAspects model validation works")
        else:
            print("❌ RatingAspects model validation failed")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ Rating models test failed: {str(e)}")
        return False

def test_database_connection_helper():
    """Test the direct database connection function"""
    print("\n🔍 Testing direct database connection...")
    try:
        from app.routers.recipe_ratings import get_direct_db_connection
        
        conn = get_direct_db_connection()
        if conn:
            try:
                # Test a simple query
                with conn.cursor() as cur:
                    cur.execute("SELECT current_timestamp")
                    result = cur.fetchone()
                    if result:
                        print("✅ Direct database connection works")
                        return True
                    else:
                        print("❌ Direct database connection failed - no result")
                        return False
            finally:
                conn.close()
        else:
            print("❌ Failed to create direct database connection")
            return False
            
    except Exception as e:
        print(f"❌ Direct database connection test failed: {str(e)}")
        return False

def test_auth_utils():
    """Test that auth utilities are working"""
    print("\n🔍 Testing authentication utilities...")
    try:
        from app.utils.auth_utils import get_user_from_token
        print("✅ Auth utilities imported successfully")
        return True
        
    except Exception as e:
        print(f"❌ Auth utilities test failed: {str(e)}")
        return False

def run_all_tests():
    """Run all rating system tests"""
    print("🧪 RATING SYSTEM TESTING SUITE")
    print("=" * 50)
    
    tests = [
        ("Database Connection", test_database_connection),
        ("Rating Tables & Views", test_rating_tables), 
        ("Rating Router Import", test_rating_router_import),
        ("Rating Models", test_rating_models),
        ("Direct DB Connection", test_database_connection_helper),
        ("Auth Utils", test_auth_utils)
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        try:
            if test_func():
                passed += 1
            else:
                print(f"❌ {test_name} test failed")
        except Exception as e:
            print(f"❌ {test_name} test crashed: {str(e)}")
    
    print("\n" + "=" * 50)
    print(f"🎯 TEST RESULTS: {passed}/{total} tests passed")
    
    if passed == total:
        print("✅ All rating system tests passed! System is ready for production testing.")
        return True
    else:
        print("❌ Some tests failed. Review the issues above before proceeding.")
        return False

if __name__ == "__main__":
    # Set up environment variables if needed
    try:
        from dotenv import load_dotenv
        load_dotenv()
        print("📝 Environment variables loaded from .env file")
    except:
        print("⚠️ No .env file found, using system environment variables")
    
    success = run_all_tests()
    
    if success:
        print("\n🚀 Rating system is ready for API testing!")
        print("💡 Next steps:")
        print("   1. Start the FastAPI server")
        print("   2. Test rating endpoints with actual HTTP requests")
        print("   3. Verify UI integration in the frontend")
    else:
        print("\n🔧 Fix the failing tests before proceeding to API testing")
    
    sys.exit(0 if success else 1)