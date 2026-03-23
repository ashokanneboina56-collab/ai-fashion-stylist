import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { apiCall } from '../../utils/api';
import { Colors, Spacing, FontSizes, Radius, Shadows } from '../../constants/theme';

export default function AnalyticsScreen() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnalytics = useCallback(async (isMounted: { current: boolean }) => {
    try {
      const data = await apiCall('/analytics');
      const historyData = await apiCall('/outfit/history');
      
      if (isMounted.current) {
        setAnalytics({
          ...data,
          history: historyData.history || []
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(useCallback(() => { 
    const isMounted = { current: true };
    fetchAnalytics(isMounted); 
    return () => { isMounted.current = false; };
  }, [fetchAnalytics]));

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}><ActivityIndicator size="large" color={Colors.secondary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAnalytics(); }} tintColor={Colors.secondary} />}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Analytics</Text>
          <Text style={styles.headerSubtitle}>Your wardrobe insights</Text>
        </View>

        <View style={styles.statsRow}>
          <Animated.View entering={FadeInUp.delay(0)} style={styles.statCard}>
            <Ionicons name="shirt-outline" size={24} color={Colors.secondary} />
            <Text style={styles.statNumber}>{analytics?.total_items || 0}</Text>
            <Text style={styles.statLabel}>Items</Text>
          </Animated.View>
          <Animated.View entering={FadeInUp.delay(100)} style={styles.statCard}>
            <Feather name="layers" size={24} color={Colors.secondary} />
            <Text style={styles.statNumber}>{analytics?.total_outfits || 0}</Text>
            <Text style={styles.statLabel}>Outfits</Text>
          </Animated.View>
          <Animated.View entering={FadeInUp.delay(200)} style={styles.statCard}>
            <Feather name="check-circle" size={24} color={Colors.secondary} />
            <Text style={styles.statNumber}>{analytics?.total_worn || 0}</Text>
            <Text style={styles.statLabel}>Worn</Text>
          </Animated.View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Most Worn Item</Text>
          {analytics?.most_worn ? (
            <Animated.View entering={FadeInUp.delay(300)} style={styles.itemHighlight}>
              <View style={styles.highlightIcon}>
                <Ionicons name="star" size={20} color={Colors.secondary} />
              </View>
              <View style={styles.highlightInfo}>
                <Text style={styles.highlightName}>{analytics.most_worn.name}</Text>
                <Text style={styles.highlightMeta}>Worn {analytics.most_worn.wear_count} times • {analytics.most_worn.category}</Text>
              </View>
              {analytics.most_worn.image_base64 && (
                <Image 
                  source={{ uri: `data:image/jpeg;base64,${analytics.most_worn.image_base64}` }} 
                  style={styles.histThumb} 
                />
              )}
            </Animated.View>
          ) : (
            <Text style={styles.emptyText}>No wear data yet</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Category Distribution</Text>
          <View style={styles.chartCard}>
            {Object.entries(analytics?.categories || {}).map(([cat, count]: any, idx) => (
              <View key={cat} style={styles.barRow}>
                <Text style={styles.barLabel}>{cat}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${(count / analytics.total_items) * 100}%` }]} />
                </View>
                <Text style={styles.barCount}>{count}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Colors</Text>
          <View style={styles.colorGrid}>
            {Object.entries(analytics?.colors || {}).sort((a: any, b: any) => b[1] - a[1]).slice(0, 4).map(([color, count]: any) => (
              <View key={color} style={styles.colorItem}>
                <View style={[styles.colorCircle, { backgroundColor: getColorHex(color) }]} />
                <Text style={styles.colorName} numberOfLines={1}>{color}</Text>
                <Text style={styles.colorCount}>{count}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recently Worn Outfits</Text>
          {(analytics?.history || []).map((hist: any, idx: number) => (
            <Animated.View key={hist.history_id} entering={FadeInUp.delay(idx * 100)} style={styles.historyCard}>
              <Text style={styles.historyDate}>
                {hist.worn_date ? new Date(hist.worn_date).toLocaleDateString() : 'Recent'}
              </Text>
              <View style={styles.historyItems}>
                {hist.top && <Image source={{ uri: `data:image/jpeg;base64,${hist.top.image_base64}` }} style={styles.histThumb} />}
                {hist.bottom && <Image source={{ uri: `data:image/jpeg;base64,${hist.bottom.image_base64}` }} style={styles.histThumb} />}
                {hist.shoes && <Image source={{ uri: `data:image/jpeg;base64,${hist.shoes.image_base64}` }} style={styles.histThumb} />}
              </View>
            </Animated.View>
          ))}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { 
    height: 60,
    minHeight: 60,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.screenPadding,
    backgroundColor: Colors.surface,
  },
  headerTitle: { 
    fontFamily: 'PlayfairDisplay_700Bold', 
    fontSize: FontSizes.h2, 
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  headerSubtitle: { fontFamily: 'Lato_400Regular', fontSize: FontSizes.bodyMd, color: Colors.textSecondary, marginTop: 4 },
  statsRow: { flexDirection: 'row', paddingHorizontal: Spacing.screenPadding, gap: Spacing.sm, marginTop: Spacing.md },
  statCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md,
    padding: Spacing.md, alignItems: 'center', borderWidth: 0.5, borderColor: Colors.border,
  },
  statNumber: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: FontSizes.h1, color: Colors.textPrimary, marginTop: Spacing.sm },
  statLabel: { fontFamily: 'Lato_400Regular', fontSize: FontSizes.caption, color: Colors.textSecondary, marginTop: 2 },
  section: { paddingHorizontal: Spacing.screenPadding, marginTop: Spacing.lg },
  sectionTitle: { fontFamily: 'Lato_700Bold', fontSize: FontSizes.bodyLg, color: Colors.textSecondary, marginBottom: Spacing.sm, textTransform: 'uppercase', letterSpacing: 1 },
  itemHighlight: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: Radius.md, padding: Spacing.md, borderWidth: 0.5, borderColor: Colors.border,
  },
  highlightIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(212,175,55,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  highlightInfo: { marginLeft: Spacing.md, flex: 1 },
  highlightName: { fontFamily: 'Lato_700Bold', fontSize: FontSizes.bodyLg, color: Colors.textPrimary },
  highlightMeta: { fontFamily: 'Lato_400Regular', fontSize: FontSizes.caption, color: Colors.textSecondary, marginTop: 2 },
  chartCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    padding: Spacing.md, borderWidth: 0.5, borderColor: Colors.border,
  },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  barLabel: { fontFamily: 'Lato_400Regular', fontSize: FontSizes.caption, color: Colors.textSecondary, width: 80 },
  barTrack: { flex: 1, height: 8, backgroundColor: Colors.surfaceHighlight, borderRadius: 4, marginHorizontal: Spacing.sm },
  barFill: { height: 8, backgroundColor: Colors.secondary, borderRadius: 4 },
  barCount: { fontFamily: 'Lato_700Bold', fontSize: FontSizes.caption, color: Colors.textPrimary, width: 24, textAlign: 'right' },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  colorItem: { alignItems: 'center', width: 60 },
  colorCircle: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: Colors.border },
  colorName: { fontFamily: 'Lato_400Regular', fontSize: FontSizes.tiny, color: Colors.textSecondary, marginTop: 4, textAlign: 'center' },
  colorCount: { fontFamily: 'Lato_700Bold', fontSize: FontSizes.caption, color: Colors.textPrimary },
  styleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  styleChip: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceHighlight,
    borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
  },
  styleChipText: { fontFamily: 'Lato_400Regular', fontSize: FontSizes.caption, color: Colors.textSecondary },
  styleChipCount: { fontFamily: 'Lato_700Bold', fontSize: FontSizes.caption, color: Colors.secondary, marginLeft: Spacing.sm },
  historyCard: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  historyDate: { fontFamily: 'Lato_700Bold', fontSize: FontSizes.caption, color: Colors.textSecondary, marginBottom: 8 },
  historyItems: { flexDirection: 'row', gap: 8 },
  histThumb: { width: 50, height: 50, borderRadius: 4 },
});
