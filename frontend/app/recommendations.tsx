import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Linking, RefreshControl, FlatList, useWindowDimensions, Image, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import { apiCall } from '../utils/api';
import { Colors, Spacing, FontSizes, Radius, Shadows } from '../constants/theme';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const PRICE_FILTERS = ['All', 'Under ₹500', '₹500-₹1000', '₹1000-₹2000', '₹2000-₹5000', 'Above ₹5000'];
const PLATFORM_FILTERS = ['All', 'Amazon', 'Myntra', 'Flipkart'];
const CATEGORY_FILTERS = ['All', 'Tops', 'Bottoms', 'Shoes', 'Accessories', 'Dresses'];

function getStoreColor(store: string): string {
  const colors: Record<string, string> = {
    'Amazon': '#FF9900',
    'Myntra': '#FF3F6C',
    'Flipkart': '#2874F0',
  };
  return colors[store] || Colors.secondary;
}

function getStoreIcon(store: string): string {
  const icons: Record<string, string> = {
    'Amazon': 'shopping-bag',
    'Myntra': 'shopping-bag',
    'Flipkart': 'shopping-cart',
  };
  return icons[store] || 'shopping-bag';
}

export default function RecommendationsScreen() {
  const router = useRouter();
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const numColumns = SCREEN_WIDTH > 1024 ? 4 : SCREEN_WIDTH > 768 ? 2 : 1;

  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [priceFilter, setPriceFilter] = useState('All');
  const [platformFilter, setPlatformFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [showFilters, setShowFilters] = useState(false);

  const fetchRecommendations = useCallback(async (platform?: string) => {
    try {
      let params = '?';
      if (priceFilter !== 'All') params += `price_range=${encodeURIComponent(priceFilter)}&`;
      const currentPlatform = platform || platformFilter;
      if (currentPlatform !== 'All') params += `platform=${encodeURIComponent(currentPlatform)}&`;
      if (categoryFilter !== 'All') params += `category=${encodeURIComponent(categoryFilter)}&`;
      const data = await apiCall(`/recommendations${params}`);
      setRecommendations(data.recommendations || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [priceFilter, platformFilter, categoryFilter]);

  useEffect(() => {
    setLoading(true);
    fetchRecommendations();
  }, [fetchRecommendations]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRecommendations();
  };

  const handlePlatformSelect = (platform: string) => {
    setPlatformFilter(platform);
    setLoading(true);
    fetchRecommendations(platform);
  };

  const handleShopNow = (url: string) => {
    // DO NOT open external links, but we can show an alert or just stay on page
    // as per requirements "DO NOT open external links"
    Alert.alert("Fashion AI Store", "This item is available in our local database for virtual trying.");
  };

  const activeFilterCount = [priceFilter, platformFilter, categoryFilter].filter(f => f !== 'All').length;

  const renderFilterSection = (title: string, options: string[], selected: string, onSelect: (val: string) => void) => (
    <View style={styles.filterSection}>
      <Text style={styles.filterSectionTitle}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.filterChipsRow}>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[styles.filterChip, selected === opt && styles.filterChipActive]}
              onPress={() => onSelect(opt)}
            >
              <Text style={[styles.filterChipText, selected === opt && styles.filterChipTextActive]}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  const renderRecCard = ({ item, index }: { item: any; index: number }) => {
    const storeColor = getStoreColor(item.store || '');
    const imageUrl = item.search_url?.startsWith('/') ? `${BASE_URL}${item.search_url}` : item.search_url;

    return (
      <Animated.View entering={FadeInUp.delay(index * 80).duration(400)} style={styles.recCard}>
        {/* Product Image */}
        {imageUrl && (
          <View style={styles.imageContainer}>
            <Image 
              source={{ uri: imageUrl }} 
              style={styles.productImage} 
              resizeMode="contain"
            />
          </View>
        )}

        {/* Header with store badge */}
        <View style={styles.recHeader}>
          <View style={styles.recTitleWrap}>
            <Text style={styles.recName} numberOfLines={2}>{item.name}</Text>
            <Text style={styles.recCategory}>{item.category}{item.color ? ` · ${item.color}` : ''}</Text>
          </View>
          <View style={[styles.storeBadge, { backgroundColor: storeColor + '20' }]}>
            <Feather name={getStoreIcon(item.store || '') as any} size={12} color={storeColor} />
            <Text style={[styles.storeBadgeText, { color: storeColor }]}>{item.store || 'Shop'}</Text>
          </View>
        </View>

        {/* Match info */}
        <View style={styles.matchRow}>
          <View style={styles.matchScoreWrap}>
            <Ionicons name="sparkles" size={14} color={Colors.secondary} />
            <Text style={styles.matchScore}>{item.match_score || 85}% match</Text>
          </View>
          {item.wardrobe_match && (
            <Text style={styles.wardrobeMatch} numberOfLines={1}>{item.wardrobe_match}</Text>
          )}
        </View>

        {/* Reason */}
        {item.reason && (
          <Text style={styles.recReason} numberOfLines={2}>{item.reason}</Text>
        )}

        {/* Size & Brand */}
        <View style={styles.detailRow}>
          {item.size && (
            <View style={styles.detailChip}>
              <Text style={styles.detailChipText}>Size: {item.size}</Text>
            </View>
          )}
          {item.brand && (
            <View style={styles.detailChip}>
              <Text style={styles.detailChipText}>{item.brand}</Text>
            </View>
          )}
        </View>

        {/* Price & CTA */}
        <View style={styles.recFooter}>
          <Text style={styles.recPrice}>{item.price || '₹999'}</Text>
          <TouchableOpacity
            style={[styles.shopBtn, { backgroundColor: storeColor }]}
            onPress={() => handleShopNow(item.search_url)}
            activeOpacity={0.8}
          >
            <Text style={styles.shopBtnText}>View</Text>
            <Feather name="external-link" size={13} color="#fff" />
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>For You</Text>
          <Text style={styles.headerSubtitle}>Personalized picks</Text>
        </View>
        <TouchableOpacity
          style={[styles.filterToggle, activeFilterCount > 0 && styles.filterToggleActive]}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Feather name="sliders" size={18} color={activeFilterCount > 0 ? Colors.onPrimary : Colors.textSecondary} />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Filters panel */}
      {showFilters && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.filtersPanel}>
          {renderFilterSection('Price Range', PRICE_FILTERS, priceFilter, setPriceFilter)}
          {renderFilterSection('Store', PLATFORM_FILTERS, platformFilter, handlePlatformSelect)}
          {renderFilterSection('Category', CATEGORY_FILTERS, categoryFilter, setCategoryFilter)}
          {activeFilterCount > 0 && (
            <TouchableOpacity
              style={styles.clearFiltersBtn}
              onPress={() => {
                setPriceFilter('All');
                setPlatformFilter('All');
                setCategoryFilter('All');
              }}
            >
              <Feather name="x" size={14} color={Colors.error} />
              <Text style={styles.clearFiltersText}>Clear All Filters</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      )}

      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.secondary} />
          <Text style={styles.loadingText}>AI is finding the best picks for you...</Text>
          <Text style={styles.loadingSubtext}>Analyzing your wardrobe & preferences</Text>
        </View>
      ) : recommendations.length === 0 ? (
        <View style={styles.centered}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="sparkles" size={48} color={Colors.textTertiary} />
          </View>
          <Text style={styles.emptyTitle}>No recommendations yet</Text>
          <Text style={styles.emptySubtext}>Add items to your wardrobe and complete your profile for personalized suggestions</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/(tabs)/wardrobe')}>
            <Text style={styles.emptyBtnText}>Go to Wardrobe</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          key={numColumns}
          data={recommendations}
          numColumns={numColumns}
          keyExtractor={(item, index) => `rec-${index}`}
          renderItem={renderRecCard}
          contentContainerStyle={styles.list}
          columnWrapperStyle={numColumns > 1 ? styles.columnWrapper : null}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.secondary} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  headerBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.screenPadding, paddingVertical: Spacing.sm,
    borderBottomWidth: 0.5, borderBottomColor: Colors.border,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: FontSizes.h3, color: Colors.textPrimary },
  headerSubtitle: { fontFamily: 'Lato_400Regular', fontSize: FontSizes.tiny, color: Colors.textSecondary },
  filterToggle: {
    width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  filterToggleActive: { backgroundColor: Colors.secondary, borderColor: Colors.secondary },
  filterBadge: {
    position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: 8,
    backgroundColor: Colors.error, justifyContent: 'center', alignItems: 'center',
  },
  filterBadgeText: { fontFamily: 'Lato_700Bold', fontSize: 9, color: '#fff' },
  filtersPanel: {
    backgroundColor: Colors.surface, borderBottomWidth: 0.5, borderBottomColor: Colors.border,
    paddingVertical: Spacing.md,
  },
  filterSection: { marginBottom: Spacing.sm },
  filterSectionTitle: {
    fontFamily: 'Lato_700Bold', fontSize: FontSizes.caption, color: Colors.textSecondary,
    paddingHorizontal: Spacing.screenPadding, marginBottom: Spacing.xs,
    textTransform: 'uppercase', letterSpacing: 1,
  },
  filterChipsRow: {
    flexDirection: 'row', paddingHorizontal: Spacing.screenPadding, gap: Spacing.xs,
  },
  filterChip: {
    paddingHorizontal: Spacing.md, paddingVertical: 6,
    borderRadius: Radius.full, backgroundColor: Colors.surfaceHighlight,
    borderWidth: 1, borderColor: Colors.border,
  },
  filterChipActive: { backgroundColor: Colors.secondary, borderColor: Colors.secondary },
  filterChipText: { fontFamily: 'Lato_400Regular', fontSize: FontSizes.caption, color: Colors.textSecondary },
  filterChipTextActive: { color: Colors.onPrimary, fontFamily: 'Lato_700Bold' },
  clearFiltersBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.sm, gap: 4,
  },
  clearFiltersText: { fontFamily: 'Lato_400Regular', fontSize: FontSizes.caption, color: Colors.error },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  loadingText: {
    fontFamily: 'Lato_700Bold', fontSize: FontSizes.bodyLg, color: Colors.textPrimary,
    marginTop: Spacing.lg, textAlign: 'center',
  },
  loadingSubtext: {
    fontFamily: 'Lato_400Regular', fontSize: FontSizes.bodyMd, color: Colors.textSecondary,
    marginTop: Spacing.xs, textAlign: 'center',
  },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.surface,
    justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontFamily: 'PlayfairDisplay_700Bold', fontSize: FontSizes.h2, color: Colors.textPrimary,
    textAlign: 'center',
  },
  emptySubtext: {
    fontFamily: 'Lato_400Regular', fontSize: FontSizes.bodyMd, color: Colors.textSecondary,
    textAlign: 'center', marginTop: Spacing.sm, maxWidth: 280,
  },
  emptyBtn: {
    backgroundColor: Colors.secondary, borderRadius: Radius.full,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, marginTop: Spacing.lg,
  },
  emptyBtnText: { fontFamily: 'Lato_700Bold', fontSize: FontSizes.bodyLg, color: Colors.onPrimary },
  list: { padding: Spacing.screenPadding, paddingBottom: 40 },
  columnWrapper: { justifyContent: 'space-between', gap: Spacing.md },
  imageContainer: {
    width: '100%',
    height: 180,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
    backgroundColor: Colors.surfaceHighlight,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  recCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 0.5, borderColor: Colors.border, ...Shadows.soft,
    flex: 1, // Allow card to grow/shrink in grid
  },
  recHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  recTitleWrap: { flex: 1, marginRight: Spacing.sm },
  recName: { fontFamily: 'Lato_700Bold', fontSize: FontSizes.bodyLg, color: Colors.textPrimary },
  recCategory: { fontFamily: 'Lato_400Regular', fontSize: FontSizes.caption, color: Colors.textSecondary, marginTop: 2 },
  storeBadge: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: Radius.full, gap: 4,
  },
  storeBadgeText: { fontFamily: 'Lato_700Bold', fontSize: FontSizes.tiny },
  matchRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.sm, gap: Spacing.sm },
  matchScoreWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  matchScore: { fontFamily: 'Lato_700Bold', fontSize: FontSizes.caption, color: Colors.secondary },
  wardrobeMatch: {
    fontFamily: 'Lato_400Regular', fontSize: FontSizes.tiny, color: Colors.textTertiary,
    flex: 1,
  },
  recReason: {
    fontFamily: 'Lato_400Regular', fontSize: FontSizes.bodyMd, color: Colors.textSecondary,
    marginTop: Spacing.sm, fontStyle: 'italic', lineHeight: 20,
  },
  detailRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.sm },
  detailChip: {
    paddingHorizontal: Spacing.sm, paddingVertical: 3,
    backgroundColor: Colors.surfaceHighlight, borderRadius: Radius.full,
  },
  detailChipText: { fontFamily: 'Lato_400Regular', fontSize: FontSizes.tiny, color: Colors.textSecondary },
  recFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: Spacing.md, paddingTop: Spacing.sm, borderTopWidth: 0.5, borderTopColor: Colors.border,
  },
  recPrice: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: FontSizes.h3, color: Colors.textPrimary },
  shopBtn: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: 10,
    borderRadius: Radius.full, gap: 6,
  },
  shopBtnText: { fontFamily: 'Lato_700Bold', fontSize: FontSizes.bodyMd, color: '#fff' },
});
