"""
Test script for saved_recipes endpoint
"""
import requests
import json

# Configuration
API_URL = "https://smartmealplannermulti-production.up.railway.app"  # Replace with your API URL
# Get token from browser local storage or generate one through login
TOKEN = "YOUR_ACCESS_TOKEN_HERE"  # Replace with valid token

headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json"
}

# Test case 1: Save a scraped recipe
def test_save_scraped_recipe():
    scraped_recipe_id = 123  # Replace with a valid recipe ID
    
    payload = {
        "scraped_recipe_id": scraped_recipe_id,
        "recipe_name": "Test Scraped Recipe",
        "recipe_source": "scraped",
        "notes": "Test notes for scraped recipe"
    }
    
    try:
        response = requests.post(f"{API_URL}/saved-recipes/", json=payload, headers=headers)
        print(f"Status code: {response.status_code}")
        print(f"Response: {response.json()}")
        return response.json()
    except Exception as e:
        print(f"Error: {e}")
        return None

# Test case 2: Save a menu recipe
def test_save_menu_recipe():
    menu_id = 456  # Replace with a valid menu ID
    recipe_id = 789  # Replace with a valid recipe ID from the menu
    
    payload = {
        "menu_id": menu_id,
        "recipe_id": recipe_id,
        "recipe_name": "Test Menu Recipe",
        "day_number": 1,
        "meal_time": "dinner",
        "notes": "Test notes for menu recipe"
    }
    
    try:
        response = requests.post(f"{API_URL}/saved-recipes/", json=payload, headers=headers)
        print(f"Status code: {response.status_code}")
        print(f"Response: {response.json()}")
        return response.json()
    except Exception as e:
        print(f"Error: {e}")
        return None

if __name__ == "__main__":
    print("Testing save scraped recipe...")
    test_save_scraped_recipe()
    
    print("\nTesting save menu recipe...")
    test_save_menu_recipe()