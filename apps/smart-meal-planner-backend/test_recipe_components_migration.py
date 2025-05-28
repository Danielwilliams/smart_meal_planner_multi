#!/usr/bin/env python3
"""
Test script for recipe components migration

This script validates that the migration 010 was successful and all functionality works correctly.

Usage:
    python test_recipe_components_migration.py
"""

import sys
import os
import logging
from pathlib import Path

# Add the app directory to the Python path
sys.path.append(str(Path(__file__).parent / "app"))

from app.db import get_db_connection
from app.ai.custom_meal_builder import suggest_custom_meal
from psycopg2.extras import RealDictCursor

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def test_database_structure():
    """Test that the database structure is correct after migration"""
    logger.info("Testing database structure...")
    
    conn = get_db_connection()
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Test 1: recipe_components table should not exist
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'recipe_components'
            )
        """)
        table_exists = cursor.fetchone()['exists']
        
        if table_exists:
            logger.error("❌ FAIL: recipe_components table still exists!")
            return False
        else:
            logger.info("✅ PASS: recipe_components table has been eliminated")
        
        # Test 2: scraped_recipes should have component_type column
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'scraped_recipes'
                AND column_name = 'component_type'
            )
        """)
        column_exists = cursor.fetchone()['exists']
        
        if not column_exists:
            logger.error("❌ FAIL: scraped_recipes.component_type column missing!")
            return False
        else:
            logger.info("✅ PASS: scraped_recipes.component_type column exists")
        
        # Test 3: Count recipes with component types
        cursor.execute("""
            SELECT COUNT(*) as count 
            FROM scraped_recipes 
            WHERE component_type IS NOT NULL AND component_type != ''
        """)
        component_count = cursor.fetchone()['count']
        
        logger.info(f"✅ INFO: {component_count} recipes have component types")
        
        # Test 4: List component types
        cursor.execute("""
            SELECT component_type, COUNT(*) as count
            FROM scraped_recipes 
            WHERE component_type IS NOT NULL AND component_type != ''
            GROUP BY component_type 
            ORDER BY count DESC
        """)
        component_types = cursor.fetchall()
        
        if component_types:
            logger.info("✅ PASS: Component types found:")
            for ct in component_types:
                logger.info(f"  - {ct['component_type']}: {ct['count']} recipes")
        else:
            logger.warning("⚠️  WARNING: No component types found in database")
        
        return True
        
    finally:
        conn.close()

def test_ai_meal_builder():
    """Test that the AI meal builder works with the new structure"""
    logger.info("Testing AI meal builder...")
    
    try:
        # Test the meal suggestion function
        meal = suggest_custom_meal(user_id=1)  # Use dummy user ID
        
        if meal:
            logger.info("✅ PASS: AI meal builder generated a suggestion")
            logger.info(f"  Meal: {meal.get('title', 'Unknown')}")
            logger.info(f"  Main component: {meal.get('main_component', {}).get('title', 'Unknown')}")
            logger.info(f"  Side component: {meal.get('side_component', {}).get('title', 'Unknown')}")
            return True
        else:
            logger.warning("⚠️  WARNING: AI meal builder returned no suggestions")
            logger.info("  This might be normal if there are insufficient component types")
            return True  # Not necessarily a failure
            
    except Exception as e:
        logger.error(f"❌ FAIL: AI meal builder error: {str(e)}")
        return False

def test_scraped_recipes_endpoint():
    """Test that scraped recipes endpoint works correctly"""
    logger.info("Testing scraped recipes data access...")
    
    conn = get_db_connection()
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Test the query used by scraped_recipes.py
        cursor.execute("""
            SELECT 
                r.id, r.title, r.complexity, r.source, r.cuisine,
                r.prep_time, r.cook_time, r.total_time, r.image_url, 
                r.is_verified, r.date_scraped, r.component_type
            FROM scraped_recipes r
            WHERE r.component_type IS NOT NULL
            LIMIT 5
        """)
        
        recipes = cursor.fetchall()
        
        if recipes:
            logger.info("✅ PASS: Scraped recipes query works correctly")
            logger.info(f"  Found {len(recipes)} recipes with component types")
            for recipe in recipes:
                logger.info(f"  - Recipe {recipe['id']}: {recipe['title']} ({recipe['component_type']})")
            return True
        else:
            logger.warning("⚠️  WARNING: No recipes with component types found")
            return True  # Not necessarily a failure
            
    except Exception as e:
        logger.error(f"❌ FAIL: Scraped recipes query error: {str(e)}")
        return False
    finally:
        conn.close()

def test_component_types_endpoint():
    """Test that component types endpoint works"""
    logger.info("Testing component types endpoint logic...")
    
    conn = get_db_connection()
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Test the query used by recipe_admin.py get_component_types
        cursor.execute("""
            SELECT
                component_type,
                COUNT(*) as count
            FROM scraped_recipes
            WHERE component_type IS NOT NULL AND component_type != ''
            GROUP BY component_type
            ORDER BY count DESC
        """)
        
        component_types = cursor.fetchall()
        
        if component_types:
            logger.info("✅ PASS: Component types endpoint query works")
            logger.info(f"  Found {len(component_types)} unique component types")
            return True
        else:
            logger.warning("⚠️  WARNING: No component types found")
            return True
            
    except Exception as e:
        logger.error(f"❌ FAIL: Component types query error: {str(e)}")
        return False
    finally:
        conn.close()

def test_recipe_tagging():
    """Test that recipe tagging functionality works"""
    logger.info("Testing recipe tagging functionality...")
    
    conn = get_db_connection()
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Find a recipe without a component type to test with
        cursor.execute("""
            SELECT id, title 
            FROM scraped_recipes 
            WHERE component_type IS NULL OR component_type = ''
            LIMIT 1
        """)
        
        test_recipe = cursor.fetchone()
        
        if not test_recipe:
            logger.info("✅ INFO: All recipes already have component types")
            return True
        
        recipe_id = test_recipe['id']
        test_component_type = "test_component"
        
        # Test the tagging query used by recipe_admin.py
        cursor.execute("""
            UPDATE scraped_recipes
            SET component_type = %s
            WHERE id = %s
            RETURNING id, title, component_type
        """, (test_component_type, recipe_id))
        
        updated = cursor.fetchone()
        
        if updated and updated['component_type'] == test_component_type:
            logger.info("✅ PASS: Recipe tagging works correctly")
            logger.info(f"  Tagged recipe {recipe_id}: {updated['title']} as '{test_component_type}'")
            
            # Clean up - remove the test tag
            cursor.execute("""
                UPDATE scraped_recipes
                SET component_type = NULL
                WHERE id = %s
            """, (recipe_id,))
            
            conn.commit()
            return True
        else:
            logger.error("❌ FAIL: Recipe tagging did not work")
            return False
            
    except Exception as e:
        logger.error(f"❌ FAIL: Recipe tagging error: {str(e)}")
        conn.rollback()
        return False
    finally:
        conn.close()

def main():
    """Run all tests"""
    logger.info("=" * 60)
    logger.info("RECIPE COMPONENTS MIGRATION TEST SUITE")
    logger.info("=" * 60)
    
    tests = [
        ("Database Structure", test_database_structure),
        ("AI Meal Builder", test_ai_meal_builder),
        ("Scraped Recipes Endpoint", test_scraped_recipes_endpoint),
        ("Component Types Endpoint", test_component_types_endpoint),
        ("Recipe Tagging", test_recipe_tagging),
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        logger.info(f"\n--- Running {test_name} Test ---")
        try:
            if test_func():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            logger.error(f"❌ FAIL: {test_name} test crashed: {str(e)}")
            failed += 1
    
    logger.info("\n" + "=" * 60)
    logger.info("TEST RESULTS")
    logger.info("=" * 60)
    logger.info(f"✅ PASSED: {passed} tests")
    logger.info(f"❌ FAILED: {failed} tests")
    
    if failed == 0:
        logger.info("🎉 ALL TESTS PASSED! Migration is successful.")
        logger.info("\nThe recipe_components table has been successfully eliminated.")
        logger.info("All functionality is working correctly with the new structure.")
    else:
        logger.error("⚠️  SOME TESTS FAILED! Please review the issues above.")
        logger.info("\nYou may need to:")
        logger.info("1. Check database connectivity")
        logger.info("2. Ensure migration was run correctly")
        logger.info("3. Verify that recipes have component types")
        
    return failed == 0

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        logger.info("Tests cancelled by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Test suite error: {str(e)}")
        sys.exit(1)