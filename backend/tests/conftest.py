import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://fashion-ai-phase2.preview.emergentagent.com').rstrip('/')

@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture
def auth_token(api_client):
    """Create test user and return auth token"""
    import uuid
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    password = "test123456"
    
    # Register
    response = api_client.post(f"{BASE_URL}/api/auth/register", json={
        "name": "Test User",
        "email": email,
        "password": password
    })
    
    if response.status_code == 200:
        data = response.json()
        return data["token"]
    return None

@pytest.fixture
def authenticated_client(api_client, auth_token):
    """API client with authentication"""
    if auth_token:
        api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client
