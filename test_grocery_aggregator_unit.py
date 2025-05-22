#!/usr/bin/env python3
"""
Unit test for grocery aggregator to debug the formatting issues
"""

import sys
import os
import json
import re

# Add the backend path to sys.path
backend_path = os.path.join(os.path.dirname(__file__), 'apps', 'smart-meal-planner-backend')
sys.path.insert(0, backend_path)

try:
    from app.utils.grocery_aggregator import aggregate_grocery_list, extract_ingredient_quantities_from_menu
    print("✅ Successfully imported grocery aggregator functions")
except ImportError as e:
    print(f"❌ Import error: {e}")
    print("Make sure you're running this from the project root directory")
    sys.exit(1)

def test_grocery_aggregator():
    """Test the grocery aggregator with sample data"""
    
    # Load test menu data
    try:
        with open('test_menu_data.json', 'r') as f:
            test_menu = json.load(f)
        print("✅ Loaded test menu data")
    except FileNotFoundError:
        print("❌ test_menu_data.json not found")
        return
    
    print("\n" + "="*60)
    print("TESTING GROCERY AGGREGATOR")
    print("="*60)
    
    # Test the main aggregation function
    print("\n1. Testing aggregate_grocery_list()...")
    try:
        result = aggregate_grocery_list(test_menu['meal_plan_json'])
        print(f"✅ Function executed successfully")
        print(f"📊 Result type: {type(result)}")
        print(f"📊 Result length: {len(result) if isinstance(result, list) else 'N/A'}")
        
        print("\n📋 First 10 items:")
        for i, item in enumerate(result[:10] if isinstance(result, list) else []):
            print(f"  {i+1}. {item}")
            if isinstance(item, dict):
                name = item.get('name', 'NO_NAME')
                quantity = item.get('quantity', 'NO_QUANTITY')
                print(f"      -> Name: '{name}'")
                print(f"      -> Quantity: '{quantity}'")
                
                # Check for issues
                issues = []
                if '::' in name:
                    issues.append("DOUBLE_COLON")
                if ':' in quantity and any(char.isdigit() for char in quantity.split(':')[0]):
                    issues.append("DUPLICATE_TEXT")
                if re.search(r'\d\.:', quantity):
                    issues.append("WEIRD_DECIMAL")
                    
                if issues:
                    print(f"      ⚠️ Issues found: {', '.join(issues)}")
            print()
            
    except Exception as e:
        print(f"❌ Error in aggregate_grocery_list: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "="*60)
    print("2. Testing extract_ingredient_quantities_from_menu()...")
    try:
        ingredient_quantities, summarized_ingredients = extract_ingredient_quantities_from_menu(test_menu['meal_plan_json'])
        print(f"✅ Function executed successfully")
        print(f"📊 Ingredient quantities found: {len(ingredient_quantities)}")
        print(f"📊 Summarized ingredients: {len(summarized_ingredients)}")
        
        print("\n🔍 Raw ingredient quantities:")
        for ingredient, data in list(ingredient_quantities.items())[:5]:
            print(f"  {ingredient}: {data}")
            
        print("\n📋 Summarized ingredients:")
        for i, item in enumerate(summarized_ingredients[:10]):
            print(f"  {i+1}. {item}")
            
    except Exception as e:
        print(f"❌ Error in extract_ingredient_quantities_from_menu: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "="*60)
    print("3. Testing categorization simulation...")
    
    # Simulate what the frontend does
    from data.categoryMapping import CATEGORY_MAPPING
    
    def test_categorization(item_name):
        """Test how an item gets categorized"""
        clean_name = item_name.lower().strip()
        for category, keywords in CATEGORY_MAPPING.items():
            for keyword in keywords:
                if keyword.lower() in clean_name:
                    return category
        return 'Other'
    
    test_items = ['Flank Steak', 'Beef (ground)', 'Mixed nuts', 'Bacon']
    print("\n🏷️ Categorization test:")
    for item in test_items:
        category = test_categorization(item)
        print(f"  '{item}' -> '{category}'")
    
    print("\n" + "="*60)
    print("ANALYSIS COMPLETE")
    print("="*60)

def test_specific_issues():
    """Test specific formatting issues we're seeing"""
    
    print("\n" + "="*40)
    print("TESTING SPECIFIC ISSUES")
    print("="*40)
    
    # Test cases for the issues we're seeing
    test_cases = [
        {"name": "Beef (ground)", "quantity": "1 lb"},
        {"name": "Bacon", "quantity": "8 slices"}, 
        {"name": "Flank Steak", "quantity": "16 oz"},
        {"name": "Salt", "quantity": "1/2 tsp"},
        {"name": "Chickpeas", "quantity": "1 can"}
    ]
    
    print("🧪 Testing individual item processing...")
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n{i}. Testing: {test_case}")
        
        # Simulate backend processing
        name = test_case['name']
        quantity = test_case['quantity']
        
        # Clean the name (backend logic)
        clean_name = name.replace(':', '').strip()
        display_name = ' '.join(word.capitalize() for word in clean_name.split())
        
        # Process quantity 
        clean_quantity = quantity
        
        print(f"   Input:  name='{name}', quantity='{quantity}'")
        print(f"   Output: name='{display_name}', quantity='{clean_quantity}'")
        
        # Check for issues
        if '::' in display_name:
            print(f"   ❌ DOUBLE COLON issue in name")
        if ':' in clean_quantity and any(char.isdigit() for char in clean_quantity.split(':')[0]):
            print(f"   ❌ DUPLICATE TEXT issue in quantity")
        else:
            print(f"   ✅ No obvious issues detected")

if __name__ == "__main__":
    print("🧪 GROCERY AGGREGATOR UNIT TEST")
    print("=" * 50)
    
    # First test basic functionality
    test_grocery_aggregator()
    
    # Then test specific issues
    test_specific_issues()
    
    print(f"\n✨ Test completed!")
    print("Check the output above to identify where the formatting issues are coming from.")