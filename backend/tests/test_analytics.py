import pytest
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://fashion-ai-phase2.preview.emergentagent.com').rstrip('/')

class TestAnalyticsEndpoints:
    """Analytics endpoint tests"""
    
    def test_get_analytics_structure(self, authenticated_client):
        """Test GET /analytics returns correct structure"""
        response = authenticated_client.get(f"{BASE_URL}/api/analytics")
        
        assert response.status_code == 200, f"Analytics failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "total_items" in data
        assert "total_outfits" in data
        assert "total_worn" in data
        assert "categories" in data
        assert "colors" in data
        assert "styles" in data
        assert isinstance(data["total_items"], int)
        assert isinstance(data["categories"], dict)
        assert isinstance(data["colors"], dict)
