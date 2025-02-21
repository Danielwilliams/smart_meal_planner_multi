import os
import requests
from dotenv import load_dotenv

load_dotenv()  # so we can read from .env if not already done in main

WALMART_BASE_URL = os.getenv("WALMART_BASE_URL", "https://api.walmart.com/v3")
WALMART_API_KEY = os.getenv("WALMART_API_KEY")
# If needed:
WALMART_CLIENT_ID = os.getenv("WALMART_CLIENT_ID")
WALMART_CLIENT_SECRET = os.getenv("WALMART_CLIENT_SECRET")

def lookup_item(query: str) -> dict:
    """
    Pseudo code for searching Walmart items by name or UPC, using your API key.
    Adjust the endpoint and params to match actual Walmart item search.
    """
    url = f"{WALMART_BASE_URL}/items"  # or the correct search path
    headers = {
        "Accept": "application/json",
        "WM_SEC.ACCESS_TOKEN": WALMART_API_KEY,  # sometimes used
        # "Authorization": f"Bearer {token}" if using OAuth
    }
    params = {
        "query": query,
        "format": "json"
    }
    resp = requests.get(url, headers=headers, params=params)
    if resp.status_code == 200:
        return resp.json()
    else:
        # handle errors or return None
        print("Walmart lookup_item error:", resp.status_code, resp.text)
        return None

def add_to_cart(user_token: str, item_id: str, quantity: int) -> dict:
    """
    Example function to add an item to the user's cart. 
    user_token might represent a Walmart user session or OAuth token.
    item_id is the Walmart product identifier.
    quantity is how many to add.
    """
    url = f"{WALMART_BASE_URL}/cart"
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {user_token}",
        "WM_SEC.ACCESS_TOKEN": WALMART_API_KEY
    }
    payload = {
        "itemId": item_id,
        "quantity": quantity
    }
    resp = requests.post(url, headers=headers, json=payload)
    if resp.status_code == 200:
        return resp.json()
    else:
        print("Walmart add_to_cart error:", resp.status_code, resp.text)
        return None

def walmart_user_login(username: str, password: str) -> str:
    """
    Pseudo code for logging the user in to Walmart. 
    In reality, Walmart might rely on OAuth or a web-based approach.
    Return a user token if successful.
    """
    # Example:
    url = f"{WALMART_BASE_URL}/login"
    data = {"username": username, "password": password}
    resp = requests.post(url, json=data)
    if resp.status_code == 200:
        return resp.json().get("userToken")
    else:
        print("Walmart user login error:", resp.status_code, resp.text)
        return ""
