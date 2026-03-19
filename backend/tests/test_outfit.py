import pytest
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://fashion-ai-phase2.preview.emergentagent.com').rstrip('/')

class TestOutfitEndpoints:
    """Outfit-related endpoint tests"""
    
    def test_get_outfit_history_empty(self, authenticated_client):
        """Test GET /outfit/history returns empty initially"""
        response = authenticated_client.get(f"{BASE_URL}/api/outfit/history")
        
        assert response.status_code == 200, f"Get history failed: {response.text}"
        data = response.json()
        assert "history" in data
        assert isinstance(data["history"], list)
    
    def test_get_saved_outfits(self, authenticated_client):
        """Test GET /outfit/saved returns saved outfits"""
        response = authenticated_client.get(f"{BASE_URL}/api/outfit/saved")
        
        assert response.status_code == 200, f"Get saved outfits failed: {response.text}"
        data = response.json()
        assert "outfits" in data
        assert isinstance(data["outfits"], list)
