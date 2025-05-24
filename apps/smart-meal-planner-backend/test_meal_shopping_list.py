#!/usr/bin/env python3
"""
Test script for meal-specific shopping list API

This script tests the new meal-specific shopping list functionality by
making an API request to the endpoint and printing the response.
"""

import requests
import json
import sys
import os
from pprint import pprint

# Configure API details
BASE_URL = "https://smartmealplannermulti-production.up.railway.app"
LOCAL_URL = "http://localhost:8000"

def get_auth_token():
    """
    Get a JWT auth token for API access.
    
    Returns:
        str: JWT token or None if login fails
    """
    # Try to read credentials from environment variables
    email = os.environ.get("SMP_TEST_EMAIL")
    password = os.environ.get("SMP_TEST_PASSWORD")
    
    # If not in environment, prompt user
    if not email or not password:
        print("Enter your Smart Meal Planner credentials:")
        email = input("Email: ")
        password = input("Password: ")
    
    # Login to get token
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": email, "password": password}
    )
    
    if response.status_code == 200:
        token = response.json().get("token")
        print(f"✅ Authentication successful")
        return token
    else:
        print(f"❌ Authentication failed: {response.status_code} - {response.text}")
        return None

def get_menu_list(token):
    """
    Get list of user's menus
    
    Args:
        token (str): JWT authentication token
        
    Returns:
        list: List of menu objects
    """
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{BASE_URL}/menu/history", headers=headers)
    
    if response.status_code == 200:
        menus = response.json()
        print(f"✅ Retrieved {len(menus)} menus")
        return menus
    else:
        print(f"❌ Failed to retrieve menus: {response.status_code} - {response.text}")
        return []

def get_meal_shopping_lists(token, menu_id):
    """
    Get meal-specific shopping lists for a menu
    
    Args:
        token (str): JWT authentication token
        menu_id (int): ID of the menu to get shopping lists for
        
    Returns:
        dict: Meal shopping lists data
    """
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(
        f"{BASE_URL}/menu/{menu_id}/meal-shopping-lists",
        headers=headers
    )
    
    if response.status_code == 200:
        data = response.json()
        meal_lists = data.get("meal_lists", [])
        print(f"✅ Retrieved {len(meal_lists)} meal shopping lists")
        return data
    else:
        print(f"❌ Failed to retrieve meal shopping lists: {response.status_code} - {response.text}")
        return {}

def get_single_meal_shopping_list(token, menu_id, meal_index, day_index=None, is_snack=False):
    """
    Get shopping list for a specific meal
    
    Args:
        token (str): JWT authentication token
        menu_id (int): ID of the menu
        meal_index (int): Index of the meal
        day_index (int, optional): Index of the day
        is_snack (bool, optional): Whether the item is a snack
        
    Returns:
        dict: Meal shopping list data
    """
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{BASE_URL}/menu/{menu_id}/meal-shopping-lists/{meal_index}"
    
    params = {}
    if day_index is not None:
        params["day_index"] = day_index
    if is_snack:
        params["is_snack"] = "true"
    
    response = requests.get(url, headers=headers, params=params)
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Retrieved shopping list for meal {meal_index}")
        return data
    else:
        print(f"❌ Failed to retrieve meal shopping list: {response.status_code} - {response.text}")
        return {}

def main():
    """
    Main test function
    """
    # Get authentication token
    token = get_auth_token()
    if not token:
        sys.exit(1)
    
    # Get user's menus
    menus = get_menu_list(token)
    if not menus:
        sys.exit(1)
    
    # Use the most recent menu for testing
    menu_id = menus[0]["menu_id"]
    print(f"Using menu: {menus[0].get('nickname', f'Menu {menu_id}')} (ID: {menu_id})")
    
    # Test getting all meal shopping lists
    meal_lists_data = get_meal_shopping_lists(token, menu_id)
    
    # Print meal lists summary
    if meal_lists_data and "meal_lists" in meal_lists_data:
        meal_lists = meal_lists_data["meal_lists"]
        print("\nMeal Lists Summary:")
        print(f"Menu: {meal_lists_data.get('title')}")
        print(f"Total meal lists: {len(meal_lists)}")
        
        # Print meal titles organized by day
        days = {}
        for meal in meal_lists:
            day = meal.get("day", meal.get("day_index", 0))
            if day not in days:
                days[day] = []
            
            meal_type = "Snack" if meal.get("is_snack") else "Meal"
            days[day].append(f"{meal_type}: {meal.get('title', 'Untitled')}")
        
        # Print days and meals
        for day, meals in sorted(days.items()):
            print(f"\nDay {day}:")
            for meal in meals:
                print(f"  - {meal}")
        
        # Test getting a single meal shopping list
        if meal_lists:
            first_meal = meal_lists[0]
            meal_index = first_meal.get("meal_index", 0)
            day_index = first_meal.get("day_index", 0)
            is_snack = first_meal.get("is_snack", False)
            
            print(f"\nTesting single meal endpoint with meal_index={meal_index}, day_index={day_index}, is_snack={is_snack}")
            single_meal = get_single_meal_shopping_list(token, menu_id, meal_index, day_index, is_snack)
            
            # Print ingredients from the single meal
            if single_meal and "ingredients" in single_meal:
                ingredients = single_meal["ingredients"]
                print(f"\nIngredients for {single_meal.get('title', 'Untitled Meal')}:")
                for ing in ingredients:
                    print(f"  - {ing.get('name')}: {ing.get('quantity')}")

if __name__ == "__main__":
    main()