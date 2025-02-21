import pytest
from fastapi.testclient import TestClient
from app.main import app

import sys

sys.path.append('e:/smart_meal_planner/meal_planner_backend/app')

# meal_planner_backend/app/main.py
from fastapi import FastAPI

app = FastAPI()

client = TestClient(app)

def test_signup_already_registered():
    # Attempt sign-up with an email that already exists
    payload = {
        "name": "Bob",
        "email": "existing@example.com",
        "password": "secret123"
    }
    response = client.post("/auth/signup", json=payload)
    assert response.status_code in [400, 409], "Expected error if email is taken"
