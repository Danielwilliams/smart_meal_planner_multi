#!/usr/bin/env python3
"""
Test for DNS resolution and basic connectivity
"""

import socket
import requests
import time

def test_domain_resolution(domain):
    print(f"Testing DNS resolution for: {domain}")
    try:
        ip = socket.gethostbyname(domain)
        print(f"✅ Success! Resolved to IP: {ip}")
        return True
    except socket.gaierror as e:
        print(f"❌ Failed to resolve: {e}")
        return False

def test_http_connection(url):
    print(f"Testing HTTP connection to: {url}")
    try:
        start_time = time.time()
        response = requests.get(url, timeout=10)
        duration = time.time() - start_time
        print(f"✅ Connection successful! Status code: {response.status_code}, Time: {duration:.2f}s")
        return True
    except requests.exceptions.ConnectionError as e:
        print(f"❌ Connection error: {e}")
        return False
    except requests.exceptions.Timeout:
        print(f"❌ Connection timed out after 10 seconds")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

# Test Instacart domains
domains_to_test = [
    "instacart.com",
    "www.instacart.com",
    "connect.instacart.com",
    "platform-api.instacart.com",  # This is failing in your tests
    "developer.instacart.com"      # Alternative domain to check
]

print("==== Testing DNS Resolution ====")
successful_domains = []
for domain in domains_to_test:
    if test_domain_resolution(domain):
        successful_domains.append(domain)
    print()

print("==== Testing HTTPS Connectivity ====")
for domain in successful_domains:
    test_http_connection(f"https://{domain}")
    print()

print("==== Testing Instacart Website ====")
website_url = "https://www.instacart.com/developers"
print(f"Testing connection to: {website_url}")
try:
    response = requests.get(website_url, timeout=10)
    print(f"✅ Connection successful! Status code: {response.status_code}")
    print(f"Page title: {response.text.split('<title>')[1].split('</title>')[0] if '<title>' in response.text else 'N/A'}")
except Exception as e:
    print(f"❌ Error: {e}")

print("\n==== Testing Complete ====")
print("If 'platform-api.instacart.com' failed to resolve, the domain may not exist or")
print("there may be network/DNS issues preventing resolution.")
print("Suggestions:")
print("1. Verify the correct API domain from Instacart documentation")
print("2. Check if you can access the Instacart Developer Platform website from your network")
print("3. Try from a different network (e.g., not behind corporate firewall/VPN)")