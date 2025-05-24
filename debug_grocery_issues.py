#!/usr/bin/env python3
"""
Debug script to identify grocery list formatting issues
Run this with: python debug_grocery_issues.py
"""

import json
import re

def debug_menu_processing():
    """Debug how the menu data is being processed step by step"""
    
    # Sample menu data that matches your problematic output
    test_menu = {
        "days": [
            {
                "meals": [
                    {
                        "title": "Test Meal",
                        "ingredients": [
                            {"name": "Beef (ground)", "quantity": "1 lb"},
                            {"name": "Flank Steak", "quantity": "16 oz"},
                            {"name": "Bacon", "quantity": "8 slices"},
                            {"name": "Chickpeas", "quantity": "1 can"},
                            {"name": "Salt", "quantity": "1/2 tsp"}
                        ]
                    }
                ],
                "snacks": [
                    {
                        "ingredients": [
                            {"name": "Mixed nuts", "quantity": "1 cup"}
                        ]
                    }
                ]
            }
        ]
    }
    
    print("🔍 DEBUGGING GROCERY LIST PROCESSING")
    print("=" * 50)
    
    print("\n1. Raw menu data:")
    for day in test_menu['days']:
        for meal in day.get('meals', []):
            print(f"   Meal: {meal['title']}")
            for ing in meal.get('ingredients', []):
                print(f"     - {ing['name']}: {ing['quantity']}")
        for snack in day.get('snacks', []):
            for ing in snack.get('ingredients', []):
                print(f"     - {ing['name']}: {ing['quantity']}")
    
    print("\n2. Simulating backend processing...")
    
    # Simulate the backend extraction logic
    ingredient_quantities = {}
    
    for day in test_menu['days']:
        # Process meals
        for meal in day.get('meals', []):
            for ing in meal.get('ingredients', []):
                name = ing.get('name', '').lower().strip()
                quantity = ing.get('quantity', '')
                
                # Extract quantity value and unit
                qty_value = None
                unit = ''
                
                if isinstance(quantity, str):
                    # Enhanced regex
                    qty_match = re.match(r'(\d+(?:[./]\d+)?(?:\.\d+)?)\s*([a-zA-Z]+(?:\s+[a-zA-Z]+)*)?', quantity.strip())
                    if qty_match:
                        qty_str = qty_match.group(1)
                        if '/' in qty_str:
                            parts = qty_str.split('/')
                            qty_value = float(parts[0]) / float(parts[1])
                        else:
                            qty_value = float(qty_str)
                        unit = qty_match.group(2).strip() if qty_match.group(2) else ''
                
                clean_name = name.replace(':', '').strip()
                if clean_name and qty_value is not None:
                    if clean_name not in ingredient_quantities:
                        ingredient_quantities[clean_name] = []
                    ingredient_quantities[clean_name].append({
                        'qty': qty_value,
                        'unit': unit,
                        'display': quantity
                    })
        
        # Process snacks
        for snack in day.get('snacks', []):
            for ing in snack.get('ingredients', []):
                name = ing.get('name', '').lower().strip()
                quantity = ing.get('quantity', '')
                
                qty_value = None
                unit = ''
                
                if isinstance(quantity, str):
                    qty_match = re.match(r'(\d+(?:[./]\d+)?(?:\.\d+)?)\s*([a-zA-Z]+(?:\s+[a-zA-Z]+)*)?', quantity.strip())
                    if qty_match:
                        qty_str = qty_match.group(1)
                        if '/' in qty_str:
                            parts = qty_str.split('/')
                            qty_value = float(parts[0]) / float(parts[1])
                        else:
                            qty_value = float(qty_str)
                        unit = qty_match.group(2).strip() if qty_match.group(2) else ''
                
                clean_name = name.replace(':', '').strip()
                if clean_name and qty_value is not None:
                    if clean_name not in ingredient_quantities:
                        ingredient_quantities[clean_name] = []
                    ingredient_quantities[clean_name].append({
                        'qty': qty_value,
                        'unit': unit,
                        'display': quantity
                    })
    
    print("   Extracted ingredient quantities:")
    for name, data in ingredient_quantities.items():
        print(f"     {name}: {data}")
    
    print("\n3. Simulating backend summarization...")
    
    summarized_ingredients = []
    for ingredient, occurrences in ingredient_quantities.items():
        if not occurrences:
            continue
            
        # Get most common unit
        unit_count = {}
        for o in occurrences:
            unit = o['unit'] or 'piece'
            unit_count[unit] = unit_count.get(unit, 0) + 1
        
        most_common_unit = max(unit_count.items(), key=lambda x: x[1])[0] if unit_count else 'piece'
        
        # Sum quantities
        matching_qty = sum(o['qty'] for o in occurrences if (o['unit'] or 'piece') == most_common_unit)
        
        # Format quantity
        if matching_qty == int(matching_qty):
            formatted_qty = str(int(matching_qty))
        elif matching_qty == float(int(matching_qty * 2)) / 2:
            if matching_qty < 1:
                from fractions import Fraction
                frac = Fraction(matching_qty).limit_denominator(16)
                formatted_qty = str(frac)
            else:
                formatted_qty = f"{matching_qty:.1f}".rstrip('0').rstrip('.')
        else:
            formatted_qty = f"{matching_qty:.2f}".rstrip('0').rstrip('.')
        
        # Clean name
        clean_ingredient_name = ingredient.replace(':', '').strip()
        display_name = ' '.join(word.capitalize() for word in clean_ingredient_name.split())
        
        # Clean unit
        clean_unit = most_common_unit.strip() if most_common_unit else ''
        if clean_unit:
            clean_unit = re.sub(r'^\d+\s*', '', clean_unit)
            clean_unit = re.sub(r'[:\d]', '', clean_unit)
            clean_unit = clean_unit.strip()
            
            if clean_unit.lower() in ['slice', 'slices']:
                clean_unit = 'slices'
            elif clean_unit.lower() in ['can', 'cans']:
                clean_unit = 'cans'
            elif clean_unit.lower() in ['piece', 'pieces']:
                clean_unit = 'pieces'
        
        # Create final quantity text
        if clean_unit and clean_unit != 'piece':
            quantity_text = f"{formatted_qty} {clean_unit}"
        else:
            quantity_text = formatted_qty
        
        result_item = {
            "name": display_name,
            "quantity": quantity_text
        }
        
        summarized_ingredients.append(result_item)
        
        print(f"     {display_name}: {quantity_text}")
    
    print("\n4. Simulating frontend categorization...")
    
    # Category mapping (simplified)
    CATEGORY_MAPPING = {
        "meat-seafood": ["chicken", "beef", "pork", "fish", "steak", "flank steak", "flank", "bacon", "sausage"],
        "produce": ["onion", "garlic", "tomato", "avocado", "lime"],
        "Other": ["mixed nuts", "salt", "chickpeas"]
    }
    
    categorized = {}
    
    for item in summarized_ingredients:
        clean_item_name = item['name'].replace(':', '').strip()
        
        # Format display text
        if item['quantity']:
            if ':' in clean_item_name:
                display_text = clean_item_name
            else:
                display_text = f"{clean_item_name}: {item['quantity']}"
        else:
            display_text = clean_item_name
        
        # Categorize
        normalized_name = clean_item_name.lower()
        category = 'Other'
        for cat, keywords in CATEGORY_MAPPING.items():
            for keyword in keywords:
                if keyword.lower() in normalized_name:
                    category = cat
                    break
            if category != 'Other':
                break
        
        if category not in categorized:
            categorized[category] = []
        categorized[category].append(display_text)
        
        print(f"     '{clean_item_name}' -> '{category}' -> '{display_text}'")
    
    print("\n5. Final categorized result:")
    for category, items in categorized.items():
        print(f"\n   {category}:")
        for item in items:
            print(f"     {item}")
            
            # Check for issues
            issues = []
            if '::' in item:
                issues.append("DOUBLE_COLON")
            if ':' in item and len(item.split(':')) > 2:
                issues.append("MULTIPLE_COLONS")
            if re.search(r'\d+\s+[A-Z][a-z]+:\s*\d+', item):
                issues.append("DUPLICATE_TEXT")
            
            if issues:
                print(f"       ⚠️ Issues: {', '.join(issues)}")
    
    print("\n" + "=" * 50)
    print("✅ Debug analysis complete!")
    
    # Compare with your actual output
    print("\n📊 COMPARISON WITH YOUR ACTUAL OUTPUT:")
    print("Expected: 'Flank Steak: 16 oz' in meat-seafood")
    print("Expected: 'Bacon: 8 slices' (no duplicate text)")
    print("Expected: 'Chickpeas: 1 can' (no duplicate text)")
    
    actual_issues = [
        "Flank Steak:: 16 oz (in beverages)",
        "Bacon: 8 Slice: 8 slices", 
        "Chickpeas: 1 Can: 1 cans"
    ]
    
    print("\nActual issues you're seeing:")
    for issue in actual_issues:
        print(f"  ❌ {issue}")
    
    print("\nThis suggests the issue might be:")
    print("  1. Changes not being applied/reloaded")
    print("  2. Different code path being used")
    print("  3. Data coming from cache or database")
    print("  4. Frontend/backend version mismatch")

if __name__ == "__main__":
    debug_menu_processing()