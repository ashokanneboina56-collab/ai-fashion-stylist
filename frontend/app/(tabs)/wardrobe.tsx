import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  TextInput, Image, ActivityIndicator, RefreshControl, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { apiCall } from '../../utils/api';
import { Colors, Spacing, FontSizes, Radius, Shadows } from '../../constants/theme';

const CATEGORIES = ['All', 'Tops', 'Bottoms', 'Shoes', 'Accessories', 'Outerwear', 'Dresses', 'Activewear'];
const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function WardrobeScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [sortBy, setSortBy] = useState('');
  const router = useRouter();

  const fetchItems = useCallback(async () => {
    try {
      let params = '';
      if (category !== 'All') params += `?category=${category}`;
      if (search) params += `${params ? '&' : '?'}search=${search}`;
      if (sortBy) params += `${params ? '&' : '?'}sort=${sortBy}`;
      const data = await apiCall(`/wardrobe${params}`);
      setItems(data.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [category, search, sortBy]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchItems();
    }, [fetchItems])
  );

  const onRefresh = () => { setRefreshing(true); fetchItems(); };

  const renderItem = ({ item, index }: { item: any; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 80).duration(400)} style={styles.cardWrap}>
      <TouchableOpacity
        testID={`wardrobe-item-${item.item_id}`}
        style={styles.card}
        onPress={() => router.push(`/clothing/${item.item_id}`)}
        activeOpacity={0.8}
      >
        {item.image_base64 ? (
          <Image source={{ uri: `data:image/jpeg;base64,${item.image_base64}` }} style={styles.cardImage} />
        ) : (
          <View style={[styles.cardImage, styles.placeholderImage]}>
            <Ionicons name="shirt-outline" size={40} color={Colors.textTertiary} />
          </View>
        )}
        <View style={styles.cardInfo}>
          <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
          <View style={styles.cardMeta}>
            <View style={[styles.colorDot, { backgroundColor: getColorHex(item.color) }]} />
            <Text style={styles.cardCategory}>{item.category}</Text>
          </View>
          <Text style={styles.cardWear}>Worn {item.wear_count || 0}x</Text>
        </View>
      </TouchableOpacity>
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
        <View style={styles.searchWrap}>
          <Feather name="search" size={16} color={Colors.textTertiary} />
          <TextInput
            testID="wardrobe-search-input"
            style={styles.searchInput}
            placeholder="Search wardrobe..."
            placeholderTextColor={Colors.textTertiary}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={fetchItems}
            returnKeyType="search"
          />
        </View>
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
            onPress={() => setCategory(cat)}
          >
            <Text style={[styles.filterText, category === cat && styles.filterTextActive]}>{cat}</Text>
          </TouchableOpacity>
        )}
      />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.secondary} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="shirt-outline" size={64} color={Colors.textTertiary} />
          <Text style={styles.emptyTitle}>Your wardrobe is empty</Text>
          <Text style={styles.emptySubtitle}>Add your first clothing item to get started</Text>
          <TouchableOpacity testID="empty-add-btn" style={styles.emptyAddBtn} onPress={() => router.push('/add-clothing')}>
            <Text style={styles.emptyAddBtnText}>Add Clothing</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          testID="wardrobe-grid"
          data={items}
          numColumns={2}
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
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.screenPadding, paddingTop: Spacing.md, paddingBottom: Spacing.sm,
  },
  headerTitle: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: FontSizes.h1, color: Colors.textPrimary },
  headerSubtitle: { fontFamily: 'Lato_400Regular', fontSize: FontSizes.caption, color: Colors.textSecondary, marginTop: 2 },
  addBtn: {
    backgroundColor: Colors.secondary, width: 48, height: 48,
    borderRadius: Radius.full, justifyContent: 'center', alignItems: 'center',
    ...Shadows.glow,
  },
  searchRow: { paddingHorizontal: Spacing.screenPadding, marginBottom: Spacing.sm },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceHighlight,
    borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: {
    flex: 1, color: Colors.textPrimary, fontFamily: 'Lato_400Regular',
    fontSize: FontSizes.bodyMd, marginLeft: Spacing.sm,
  },
  filterList: { paddingHorizontal: Spacing.screenPadding, marginBottom: Spacing.md },
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
  grid: { paddingHorizontal: Spacing.screenPadding, paddingBottom: 100 },
  gridRow: { justifyContent: 'space-between' },
  cardWrap: { width: (SCREEN_WIDTH - Spacing.screenPadding * 2 - Spacing.sm) / 2, marginBottom: Spacing.md },
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
});
