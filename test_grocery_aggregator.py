#!/usr/bin/env python3
"""
Test script to debug the grocery aggregator output format
"""

import sys
import os
sys.path.append('apps/smart-meal-planner-backend')

from apps.smart_meal_planner_backend.app.utils.grocery_aggregator import aggregate_grocery_list
import json

# Test with a small subset of your menu data
test_menu = {
    "days": [
        {
            "meals": [
                {
                    "title": "Spicy Beef Tacos",
                    "ingredients": [
                        {"name": "Beef (ground)", "quantity": "1 lb"},
                        {"name": "Taco seasoning", "quantity": "2 tbsp"},
                        {"name": "Bell peppers", "quantity": "2"},
                        {"name": "Bacon", "quantity": "8 slices"}
                    ]
                }
            ],
            "snacks": [
                {
                    "ingredients": [
                        {"name": "Mixed nuts", "quantity": "1 cup"},
                        {"name": "Salt", "quantity": "1/2 tsp"}
                    ]
                }
            ]
        }
    ]
}

print("Testing grocery aggregator with sample data...")
print("Input menu structure:")
print(json.dumps(test_menu, indent=2))
print("\n" + "="*50 + "\n")

result = aggregate_grocery_list(test_menu)

print("Output format:")
print(f"Type: {type(result)}")
print(f"Length: {len(result) if isinstance(result, list) else 'N/A'}")
print("\nItems:")
for i, item in enumerate(result[:10] if isinstance(result, list) else []):
    print(f"{i+1}. {item}")
    if isinstance(item, dict):
        print(f"   Keys: {list(item.keys())}")
        print(f"   Name: '{item.get('name', 'N/A')}'")
        print(f"   Quantity: '{item.get('quantity', 'N/A')}'")
    print()