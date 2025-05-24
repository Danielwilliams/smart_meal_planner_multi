#!/usr/bin/env python3
"""
Test script for cheese quantity handling in grocery aggregator
"""

import os
import sys
import json
from pprint import pprint

# Add the app directory to the path
current_dir = os.path.dirname(os.path.abspath(__file__))
app_dir = os.path.join(current_dir, "app")
sys.path.append(app_dir)

# Import the functions to test
from utils.grocery_aggregator import (
    standardize_ingredient, 
    aggregate_grocery_list
)

def test_standardize_ingredient():
    """
    Test the standardize_ingredient function with various cheese formats
    """
    print("\n=== Testing standardize_ingredient ===\n")
    
    test_cases = [
        # String-based cases
        "cup cheddar cheese",
        "cup mozzarella cheese",
        "cup parmesan cheese",
        "cup feta cheese",
        "cup cheese",
        # Dictionary-based cases
        {"name": "Cheddar Cheese", "quantity": "cup"},
        {"name": "Mozzarella Cheese", "quantity": "cup"},
        {"name": "Parmesan Cheese", "quantity": "cup"},
        {"name": "Feta Cheese", "quantity": "cup"},
        {"name": "Cheese", "quantity": "cup"},
        # Normal cases with quantities for comparison
        "1 cup cheddar cheese",
        "2 cups mozzarella cheese",
        {"name": "Cheddar Cheese", "quantity": "1 cup"},
        {"name": "Mozzarella Cheese", "quantity": "2 cups"}
    ]
    
    for case in test_cases:
        name, amount, unit = standardize_ingredient(case)
        print(f"Input: {case}")
        print(f"  → Name: {name}, Amount: {amount}, Unit: {unit}")
        print()

def test_aggregate_grocery_list():
    """
    Test the aggregate_grocery_list function with a menu containing cheese items
    """
    print("\n=== Testing aggregate_grocery_list ===\n")
    
    # Create a simple test menu structure with various cheese formats
    test_menu = {
        "days": [
            {
                "meals": [
                    {
                        "title": "Meal with Cheese",
                        "ingredients": [
                            {"name": "Cheddar Cheese", "quantity": "cup"},
                            {"name": "Mozzarella Cheese", "quantity": "cup"},
                            {"name": "Parmesan Cheese", "quantity": "cup"},
                            {"name": "Feta Cheese", "quantity": "cup"}
                        ]
                    }
                ]
            }
        ]
    }
    
    # Generate grocery list
    result = aggregate_grocery_list(test_menu)
    
    print("Aggregated grocery list:")
    for item in result:
        print(f"  {item}")
    
    # Filter just cheese items
    cheese_items = [item for item in result if "cheese" in item["name"].lower()]
    
    print("\nCheese items:")
    for item in cheese_items:
        print(f"  {item}")

if __name__ == "__main__":
    # Run the tests
    test_standardize_ingredient()
    test_aggregate_grocery_list()