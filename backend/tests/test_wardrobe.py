import pytest
import os
import base64

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://fashion-ai-phase2.preview.emergentagent.com').rstrip('/')

def get_test_image_base64():
    """Generate a simple test image in base64"""
    from PIL import Image
    import io
    
    # Create a simple colored image
    img = Image.new('RGB', (100, 100), color='red')
    buffer = io.BytesIO()
    img.save(buffer, format='JPEG')
    return base64.b64encode(buffer.getvalue()).decode()

class TestWardrobeEndpoints:
    """Wardrobe CRUD operations tests"""
    
    def test_get_wardrobe_empty(self, authenticated_client):
        """Test GET /wardrobe returns empty list initially"""
        response = authenticated_client.get(f"{BASE_URL}/api/wardrobe")
        
        assert response.status_code == 200, f"Get wardrobe failed: {response.text}"
        data = response.json()
        assert "items" in data
        assert isinstance(data["items"], list)
    
    def test_add_wardrobe_item_with_image(self, authenticated_client):
        """Test POST /wardrobe/add creates item with AI detection"""
        image_base64 = get_test_image_base64()
        
        response = authenticated_client.post(f"{BASE_URL}/api/wardrobe/add", json={
            "image_base64": image_base64,
            "name": "Test Red Shirt"
        })
        
        assert response.status_code == 200, f"Add item failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "item_id" in data, "item_id missing"
        assert "name" in data, "name missing"
        assert "category" in data, "category missing"
        assert "color" in data, "color missing"
        assert "texture" in data, "texture missing"
        assert "style" in data, "style missing"
        assert "image_base64" in data, "image_base64 missing"
        assert "wear_count" in data, "wear_count missing"
        assert data["wear_count"] == 0, "Initial wear_count should be 0"
        
        # Store item_id for later tests
        return data["item_id"]
    
    def test_get_wardrobe_item_by_id(self, authenticated_client):
        """Test GET /wardrobe/{item_id} returns item details"""
        # First create an item
        image_base64 = get_test_image_base64()
        create_response = authenticated_client.post(f"{BASE_URL}/api/wardrobe/add", json={
            "image_base64": image_base64,
            "name": "Blue Jeans"
        })
        assert create_response.status_code == 200
        item_id = create_response.json()["item_id"]
        
        # Get the item
        response = authenticated_client.get(f"{BASE_URL}/api/wardrobe/{item_id}")
        
        assert response.status_code == 200, f"Get item failed: {response.text}"
        data = response.json()
        assert data["item_id"] == item_id
        assert "name" in data
        assert "category" in data
    
    def test_get_nonexistent_item(self, authenticated_client):
        """Test GET /wardrobe/{item_id} with invalid ID returns 404"""
        response = authenticated_client.get(f"{BASE_URL}/api/wardrobe/nonexistent_id")
        
        assert response.status_code == 404, "Should return 404 for nonexistent item"
    
    def test_delete_wardrobe_item(self, authenticated_client):
        """Test DELETE /wardrobe/{item_id} removes item"""
        # Create item
        image_base64 = get_test_image_base64()
        create_response = authenticated_client.post(f"{BASE_URL}/api/wardrobe/add", json={
            "image_base64": image_base64,
            "name": "Item to Delete"
        })
        assert create_response.status_code == 200
        item_id = create_response.json()["item_id"]
        
        # Delete item
        delete_response = authenticated_client.delete(f"{BASE_URL}/api/wardrobe/{item_id}")
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        
        # Verify deletion
        get_response = authenticated_client.get(f"{BASE_URL}/api/wardrobe/{item_id}")
        assert get_response.status_code == 404, "Item should be deleted"
    
    def test_wardrobe_filter_by_category(self, authenticated_client):
        """Test GET /wardrobe with category filter"""
        response = authenticated_client.get(f"{BASE_URL}/api/wardrobe?category=Tops")
        
        assert response.status_code == 200, f"Filter failed: {response.text}"
        data = response.json()
        assert "items" in data
    
    def test_wardrobe_search(self, authenticated_client):
        """Test GET /wardrobe with search parameter"""
        response = authenticated_client.get(f"{BASE_URL}/api/wardrobe?search=test")
        
        assert response.status_code == 200, f"Search failed: {response.text}"
        data = response.json()
        assert "items" in data
