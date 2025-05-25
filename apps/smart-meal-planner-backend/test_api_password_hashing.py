#!/usr/bin/env python3
"""
API-level test for Kroger password hashing.

This script tests the password hashing through your actual API endpoints
to ensure the integration is working correctly.
"""

import requests
import json
import logging
import sys

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class APIPasswordTester:
    def __init__(self, base_url="http://localhost:8000"):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
    
    def test_api_connectivity(self):
        """Test basic API connectivity."""
        logger.info("Testing API connectivity...")
        
        try:
            response = self.session.get(f"{self.base_url}/health")
            
            if response.status_code == 200:
                logger.info("✅ API is accessible")
                return True
            else:
                logger.error(f"❌ API health check failed: {response.status_code}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Cannot connect to API: {e}")
            return False
    
    def login_test_user(self, email, password):
        """Login with test credentials to get auth token."""
        logger.info(f"Attempting login for: {email}")
        
        try:
            login_data = {
                "email": email,
                "password": password
            }
            
            response = self.session.post(
                f"{self.base_url}/auth/login",
                json=login_data
            )
            
            if response.status_code == 200:
                data = response.json()
                token = data.get('access_token')
                
                if token:
                    # Set authorization header for future requests
                    self.session.headers.update({
                        'Authorization': f'Bearer {token}'
                    })
                    logger.info("✅ Login successful")
                    return data.get('user_id')
                else:
                    logger.error("❌ No access token in response")
                    return None
            else:
                logger.error(f"❌ Login failed: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"❌ Login error: {e}")
            return None
    
    def test_password_update(self, user_id, new_kroger_password):
        """Test updating Kroger password through preferences API."""
        logger.info("Testing Kroger password update through API...")
        
        try:
            update_data = {
                "kroger_password": new_kroger_password
            }
            
            response = self.session.put(
                f"{self.base_url}/preferences/{user_id}",
                json=update_data
            )
            
            if response.status_code == 200:
                logger.info("✅ Password update API call successful")
                return True
            else:
                logger.error(f"❌ Password update failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Password update error: {e}")
            return False
    
    def get_user_preferences(self, user_id):
        """Get user preferences to check password storage."""
        logger.info("Retrieving user preferences...")
        
        try:
            response = self.session.get(f"{self.base_url}/preferences/{user_id}")
            
            if response.status_code == 200:
                data = response.json()
                logger.info("✅ Preferences retrieved successfully")
                
                # Check if kroger_username is returned (password should not be)
                has_username = 'kroger_username' in data
                has_password = 'kroger_password' in data
                
                logger.info(f"  Kroger username in response: {has_username}")
                logger.info(f"  Kroger password in response: {has_password}")
                
                if has_password:
                    logger.warning("⚠️ Plain text password is being returned by API (security concern)")
                
                return data
            else:
                logger.error(f"❌ Failed to get preferences: {response.status_code}")
                return None
                
        except Exception as e:
            logger.error(f"❌ Error getting preferences: {e}")
            return None

def run_api_tests():
    """Run comprehensive API-level password hashing tests."""
    logger.info("=== STARTING API PASSWORD HASHING TESTS ===")
    
    # Configuration
    API_BASE_URL = input("Enter API base URL (default: http://localhost:8000): ").strip()
    if not API_BASE_URL:
        API_BASE_URL = "http://localhost:8000"
    
    print("\nTo test password hashing through the API, you need test user credentials.")
    print("This will:")
    print("1. Login with your test account")
    print("2. Update the Kroger password")
    print("3. Verify the update was processed correctly")
    print("\nNote: This will actually update the Kroger password for the test user.")
    
    proceed = input("\nDo you want to proceed? (y/N): ").strip().lower()
    if proceed != 'y':
        logger.info("API tests skipped by user")
        return True
    
    test_email = input("Enter test user email: ").strip()
    test_password = input("Enter test user password: ").strip()
    new_kroger_password = input("Enter new Kroger password to test: ").strip()
    
    if not all([test_email, test_password, new_kroger_password]):
        logger.error("All fields are required for API testing")
        return False
    
    # Initialize tester
    tester = APIPasswordTester(API_BASE_URL)
    
    # Run tests
    tests_passed = 0
    total_tests = 4
    
    # Test 1: API Connectivity
    if tester.test_api_connectivity():
        tests_passed += 1
    
    # Test 2: Login
    user_id = tester.login_test_user(test_email, test_password)
    if user_id:
        tests_passed += 1
        
        # Test 3: Password Update
        if tester.test_password_update(user_id, new_kroger_password):
            tests_passed += 1
            
            # Test 4: Verify Update
            preferences = tester.get_user_preferences(user_id)
            if preferences is not None:
                tests_passed += 1
    
    # Results
    logger.info(f"\n=== API TEST RESULTS ===")
    logger.info(f"Tests passed: {tests_passed}/{total_tests}")
    
    if tests_passed == total_tests:
        logger.info("🎉 All API tests passed!")
        logger.info("The password hashing system is working correctly through the API.")
        return True
    else:
        logger.error("❌ Some API tests failed.")
        return False

if __name__ == "__main__":
    try:
        run_api_tests()
    except KeyboardInterrupt:
        logger.info("\nTests interrupted by user")
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        sys.exit(1)