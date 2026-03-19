import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://fashion-ai-phase2.preview.emergentagent.com').rstrip('/')

class TestAuthEndpoints:
    """Authentication endpoint tests"""
    
    def test_register_success(self, api_client):
        """Test user registration with valid data"""
        import uuid
        response = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "name": "New User",
            "email": f"newuser_{uuid.uuid4().hex[:8]}@example.com",
            "password": "password123"
        })
        
        assert response.status_code == 200, f"Registration failed: {response.text}"
        data = response.json()
        assert "token" in data, "Token not in response"
        assert "user" in data, "User not in response"
        assert data["user"]["name"] == "New User"
        assert "user_id" in data["user"]
        assert "email" in data["user"]
    
    def test_register_duplicate_email(self, api_client):
        """Test registration with duplicate email fails"""
        import uuid
        email = f"duplicate_{uuid.uuid4().hex[:8]}@example.com"
        
        # First registration
        response1 = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "name": "User One",
            "email": email,
            "password": "password123"
        })
        assert response1.status_code == 200
        
        # Second registration with same email
        response2 = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "name": "User Two",
            "email": email,
            "password": "password456"
        })
        assert response2.status_code == 400, "Duplicate email should fail"
        error = response2.json()
        assert "already registered" in error["detail"].lower()
    
    def test_login_success(self, api_client):
        """Test login with valid credentials"""
        import uuid
        email = f"logintest_{uuid.uuid4().hex[:8]}@example.com"
        password = "testpass123"
        
        # Register first
        api_client.post(f"{BASE_URL}/api/auth/register", json={
            "name": "Login Test User",
            "email": email,
            "password": password
        })
        
        # Login
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == email
    
    def test_login_invalid_credentials(self, api_client):
        """Test login with wrong password"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nonexistent@example.com",
            "password": "wrongpassword"
        })
        
        assert response.status_code == 401, "Invalid credentials should return 401"
        error = response.json()
        assert "invalid" in error["detail"].lower() or "credentials" in error["detail"].lower()
    
    def test_auth_me_with_token(self, authenticated_client):
        """Test /auth/me with valid token"""
        response = authenticated_client.get(f"{BASE_URL}/api/auth/me")
        
        assert response.status_code == 200, f"Auth me failed: {response.text}"
        data = response.json()
        assert "user_id" in data
        assert "name" in data
        assert "email" in data
    
    def test_auth_me_without_token(self, api_client):
        """Test /auth/me without authentication"""
        response = api_client.get(f"{BASE_URL}/api/auth/me")
        
        assert response.status_code == 401, "Should require authentication"
    
    def test_logout(self, authenticated_client):
        """Test logout endpoint"""
        response = authenticated_client.post(f"{BASE_URL}/api/auth/logout")
        
        assert response.status_code == 200, f"Logout failed: {response.text}"
        data = response.json()
        assert "status" in data or "logged out" in str(data).lower()
