import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  TextInput, Image, ActivityIndicator, RefreshControl, useWindowDimensions, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { apiCall } from '../../utils/api';
import { Colors, Spacing, FontSizes, Radius, Shadows } from '../../constants/theme';

const CATEGORIES = ['All', 'Tops', 'Bottoms', 'Shoes', 'Accessories', 'Dresses'];

export default function WardrobeScreen() {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const numColumns = SCREEN_WIDTH > 1024 ? 4 : SCREEN_WIDTH > 768 ? 3 : 2;
  const cardWidth = (SCREEN_WIDTH - Spacing.screenPadding * 2 - Spacing.sm * (numColumns - 1)) / numColumns;

  const [items, setItems] = useState<any[]>([]);
  const [filteredItems, setFilteredItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [sortBy, setSortBy] = useState('');
  const router = useRouter();

  const filterItems = (all_items: any[], query: string, cat: string) => {
    // Category Mapping (STRICT) - Matches server.py constants
    const TOPS = ["t-shirt", "shirt", "hoodie", "jacket", "top", "blouse", "crop top", "tank top", "sweater"];
    const BOTTOMS = ["jeans", "trousers", "shorts", "pants", "skirt", "leggings", "joggers"];
    const SHOES = ["shoes", "sneakers", "sandals", "footwear", "heels", "flats", "boots", "loafers"];
    const ACCESSORIES = ["accessory", "belt", "bracelet", "watch", "handbag", "backpack", "scarf", "sunglasses", "hat"];
    const DRESSES = ["dress", "gown", "jumpsuit"];

    let filtered = [...all_items];

    if (cat !== 'All') {
      const cat_lower = cat.toLowerCase();
      filtered = filtered.filter(item => {
        const item_cat = (item.category || '').toLowerCase();
        if (cat_lower === 'tops') return TOPS.includes(item_cat);
        if (cat_lower === 'bottoms') return BOTTOMS.includes(item_cat);
        if (cat_lower === 'shoes') return SHOES.includes(item_cat);
        if (cat_lower === 'accessories') return ACCESSORIES.includes(item_cat);
        if (cat_lower === 'dresses') return DRESSES.includes(item_cat);
        return item_cat === cat_lower;
      });
    }

    if (query) {
      const q = query.toLowerCase();
      filtered = filtered.filter(item => 
        (item.name?.toLowerCase() || '').includes(q) ||
        (item.category?.toLowerCase() || '').includes(q) ||
        (item.color?.toLowerCase() || '').includes(q)
      );
    }

    setFilteredItems(filtered);
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    filterItems(items, text, category);
  };

  const handleCategoryChange = (cat: string) => {
    setCategory(cat);
    filterItems(items, searchQuery, cat);
  };

  const fetchItems = useCallback(async () => {
    try {
      console.log('Wardrobe: fetching items...');
      setLoading(true);
      const data = await apiCall('/wardrobe');
      const wardrobeItems = data.items || [];
      console.log('Wardrobe: items fetched:', wardrobeItems.length);
      setItems(wardrobeItems);
      filterItems(wardrobeItems, searchQuery, category);
    } catch (e) {
      console.error('Wardrobe: fetch failed:', e);
    } finally {
      console.log('Wardrobe: fetch finishing');
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery, category]);

  useFocusEffect(
    useCallback(() => {
      fetchItems();
    }, [fetchItems])
  );

  const onRefresh = () => { setRefreshing(true); fetchItems(); };

  const deleteItem = async (itemId: string) => {
    const idToDelete = itemId;
    if (!idToDelete) {
      console.error('Delete attempted without ID');
      return;
    }
    
    console.log('Prompting delete for:', idToDelete);

    const performDelete = async () => {
      try {
        console.log('Executing API delete for:', idToDelete);
        const response = await apiCall(`/wardrobe/${idToDelete}`, { method: 'DELETE' });
        console.log('Delete API response:', response);
        
        // Update local state immediately for better UX
        setItems(prev => prev.filter(i => (i.item_id || i.id) !== idToDelete));
        setFilteredItems(prev => prev.filter(i => (i.item_id || i.id) !== idToDelete));
        
        if (Platform.OS === 'web') {
          alert('Item removed from your wardrobe');
        } else {
          Alert.alert('Success', 'Item removed from your wardrobe');
        }
      } catch (e: any) {
        console.error('Delete failed:', e);
        if (Platform.OS === 'web') {
          alert(`Error: ${e.message || 'Failed to delete item'}`);
        } else {
          Alert.alert('Error', e.message || 'Failed to delete item');
        }
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to remove this item?')) {
        performDelete();
      }
    } else {
      Alert.alert('Delete Item', 'Are you sure you want to remove this item?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: performDelete }
      ]);
    }
  };

  const renderItem = ({ item, index }: { item: any; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 80).duration(400)} style={[styles.cardWrap, { width: cardWidth }]}>
      <View style={styles.card}>
        <TouchableOpacity
          testID={`wardrobe-item-${item?.item_id}`}
          onPress={() => router.push(`/clothing/${item?.item_id}`)}
          activeOpacity={0.8}
        >
          {item?.image_base64 ? (
            <Image source={{ uri: `data:image/jpeg;base64,${item.image_base64}` }} style={styles.cardImage} resizeMode="contain" />
          ) : (
            <View style={[styles.cardImage, styles.placeholderImage]}>
              <Ionicons name="shirt-outline" size={40} color={Colors.textTertiary} />
            </View>
          )}
          
          <View style={styles.cardInfo}>
            <Text style={styles.cardName} numberOfLines={1}>{item?.name || 'Unnamed Item'}</Text>
            <View style={styles.cardMeta}>
              <View style={[styles.colorDot, { backgroundColor: getColorHex(item?.color || 'Grey') }]} />
              <Text style={styles.cardCategory}>{item?.category || 'Uncategorized'}</Text>
            </View>
            <Text style={styles.cardWear}>Worn {item?.wear_count || 0}x</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.deleteIcon} 
          onPress={() => {
            const id = item?.item_id || item?.id;
            if (id) {
              deleteItem(id);
            } else {
              console.warn('Item has no ID:', item);
              Alert.alert('Error', 'This item cannot be deleted (missing ID)');
            }
          }}
          activeOpacity={0.7}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
        >
          <Feather name="trash-2" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>My Wardrobe</Text>
          <Text style={styles.headerSubtitle}>{items.length} items</Text>
        </View>
        <TouchableOpacity
          testID="add-clothing-btn"
          style={styles.addBtn}
          onPress={() => router.push('/add-clothing')}
        >
          <Feather name="plus" size={22} color={Colors.onPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Feather name="search" size={18} color={Colors.textTertiary} />
          <TextInput
            testID="wardrobe-search-input"
            placeholder="Search items, colors..."
            style={styles.searchInput}
            placeholderTextColor={Colors.textTertiary}
            value={searchQuery}
            onChangeText={handleSearch}
          />
        </View>
        <TouchableOpacity 
          style={styles.filterBtn}
          onPress={() => router.push('/recommendations')}
        >
          <Ionicons name="cart-outline" size={20} color={Colors.secondary} />
          <Text style={{ marginLeft: 4, color: Colors.secondary, fontFamily: 'Lato_700Bold' }}>Store</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={CATEGORIES}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterList}
        keyExtractor={(item) => item}
        renderItem={({ item: cat }) => (
          <TouchableOpacity
            testID={`filter-${cat}`}
            style={[styles.filterChip, category === cat && styles.filterChipActive]}
            onPress={() => handleCategoryChange(cat)}
          >
            <Text style={[styles.filterText, category === cat && styles.filterTextActive]}>{cat}</Text>
          </TouchableOpacity>
        )}
      />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.secondary} />
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="search-outline" size={64} color={Colors.textTertiary} />
          <Text style={styles.emptyTitle}>No items found</Text>
          <Text style={styles.emptySubtitle}>Try searching for something else or clear filters</Text>
          <TouchableOpacity style={styles.emptyAddBtn} onPress={() => { handleSearch(''); setCategory('All'); }}>
            <Text style={styles.emptyAddBtnText}>Clear Search</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          key={numColumns} // Force re-render when columns change
          testID="wardrobe-grid"
          data={filteredItems}
          numColumns={numColumns}
          keyExtractor={(item) => item.item_id}
          renderItem={renderItem}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.gridRow}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.secondary} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

function getColorHex(colorName: string): string {
  const colorMap: Record<string, string> = {
    'Black': '#1a1a1a', 'White': '#f5f5f5', 'Red': '#e74c3c', 'Blue': '#3498db',
    'Green': '#2ecc71', 'Yellow': '#f1c40f', 'Pink': '#e91e8f', 'Purple': '#9b59b6',
    'Orange': '#e67e22', 'Brown': '#8b6914', 'Gray': '#7f8c8d', 'Grey': '#7f8c8d',
    'Beige': '#d4b896', 'Navy': '#2c3e50', 'Cream': '#fffdd0', 'Maroon': '#800000',
  };
  return colorMap[colorName] || Colors.textTertiary;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    height: 60,
    minHeight: 60,
    flexShrink: 0,
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    paddingHorizontal: Spacing.screenPadding,
    backgroundColor: Colors.surface,
  },
  headerTitle: { 
    fontFamily: 'PlayfairDisplay_700Bold', 
    fontSize: FontSizes.h2, 
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  headerSubtitle: { fontFamily: 'Lato_400Regular', fontSize: FontSizes.caption, color: Colors.textSecondary, marginTop: 2 },
  addBtn: {
    backgroundColor: Colors.secondary, width: 48, height: 48,
    borderRadius: Radius.full, justifyContent: 'center', alignItems: 'center',
    ...Shadows.glow,
  },
  searchRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: Spacing.screenPadding, 
    marginBottom: Spacing.sm 
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceHighlight,
    borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.border, flex: 1,
  },
  filterBtn: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    height: 48,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginLeft: Spacing.sm,
  },
  searchInput: {
    flex: 1, color: Colors.textPrimary, fontFamily: 'Lato_400Regular',
    fontSize: FontSizes.bodyMd, marginLeft: Spacing.sm,
  },
  filterList: {
    paddingHorizontal: Spacing.screenPadding,
    height: 60,
    minHeight: 60,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  filterChip: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Radius.full, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border, marginRight: Spacing.sm,
  },
  filterChipActive: { backgroundColor: Colors.secondary, borderColor: Colors.secondary },
  filterText: { fontFamily: 'Lato_400Regular', fontSize: FontSizes.caption, color: Colors.textSecondary },
  filterTextActive: { color: Colors.onPrimary, fontFamily: 'Lato_700Bold' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xl },
  emptyTitle: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: FontSizes.h3, color: Colors.textPrimary, marginTop: Spacing.lg },
  emptySubtitle: { fontFamily: 'Lato_400Regular', fontSize: FontSizes.bodyMd, color: Colors.textSecondary, marginTop: Spacing.sm, textAlign: 'center' },
  emptyAddBtn: {
    backgroundColor: Colors.secondary, paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md, borderRadius: Radius.full, marginTop: Spacing.lg,
  },
  emptyAddBtnText: { color: Colors.onPrimary, fontFamily: 'Lato_700Bold', fontSize: FontSizes.bodyLg },
  grid: { paddingHorizontal: Spacing.screenPadding, paddingBottom: 100, overflow: 'hidden' },
  gridRow: { justifyContent: 'flex-start', gap: Spacing.sm },
  cardWrap: { marginBottom: Spacing.md },
  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    overflow: 'hidden', borderWidth: 0.5, borderColor: Colors.border, ...Shadows.soft,
  },
  cardImage: { width: '100%', height: 180, backgroundColor: Colors.surfaceHighlight },
  placeholderImage: { justifyContent: 'center', alignItems: 'center' },
  cardInfo: { padding: Spacing.sm },
  cardName: { fontFamily: 'Lato_700Bold', fontSize: FontSizes.bodyMd, color: Colors.textPrimary },
  cardMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  colorDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  cardCategory: { fontFamily: 'Lato_400Regular', fontSize: FontSizes.caption, color: Colors.textSecondary },
  cardWear: { fontFamily: 'Lato_400Regular', fontSize: FontSizes.tiny, color: Colors.textTertiary, marginTop: 2 },
  deleteIcon: {
    position: 'absolute', top: 10, right: 10,
    backgroundColor: 'rgba(255,0,0,0.8)', width: 32, height: 32,
    borderRadius: 16, justifyContent: 'center', alignItems: 'center',
    zIndex: 100, // Explicitly set very high zIndex
    elevation: 5, // For Android
  },
});
