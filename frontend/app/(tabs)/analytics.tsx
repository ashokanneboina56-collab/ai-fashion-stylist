import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl,
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

  const fetchAnalytics = useCallback(async () => {
    try {
      const data = await apiCall('/analytics');
      setAnalytics(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); fetchAnalytics(); }, [fetchAnalytics]));

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}><ActivityIndicator size="large" color={Colors.secondary} /></View>
      </SafeAreaView>
    );
  }

  const categories = analytics?.categories || {};
  const colors = analytics?.colors || {};
  const styles_data = analytics?.styles || {};
  const maxCatCount = Math.max(...Object.values(categories).map(Number), 1);
  const maxColorCount = Math.max(...Object.values(colors).map(Number), 1);

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

        {analytics?.most_worn && (
          <Animated.View entering={FadeInUp.delay(300)} style={styles.section}>
            <Text style={styles.sectionTitle}>Most Worn</Text>
            <View style={styles.itemHighlight}>
              <View style={styles.highlightIcon}>
                <Feather name="trending-up" size={20} color={Colors.secondary} />
              </View>
              <View style={styles.highlightInfo}>
                <Text style={styles.highlightName}>{analytics.most_worn.name}</Text>
                <Text style={styles.highlightMeta}>{analytics.most_worn.category} - Worn {analytics.most_worn.wear_count}x</Text>
              </View>
            </View>
          </Animated.View>
        )}

        {analytics?.least_worn && (
          <Animated.View entering={FadeInUp.delay(400)} style={styles.section}>
            <Text style={styles.sectionTitle}>Least Worn</Text>
            <View style={styles.itemHighlight}>
              <View style={[styles.highlightIcon, { backgroundColor: 'rgba(207,102,121,0.15)' }]}>
                <Feather name="trending-down" size={20} color={Colors.error} />
              </View>
              <View style={styles.highlightInfo}>
                <Text style={styles.highlightName}>{analytics.least_worn.name}</Text>
                <Text style={styles.highlightMeta}>{analytics.least_worn.category} - Worn {analytics.least_worn.wear_count}x</Text>
              </View>
            </View>
          </Animated.View>
        )}

        {Object.keys(categories).length > 0 && (
          <Animated.View entering={FadeInUp.delay(500)} style={styles.section}>
            <Text style={styles.sectionTitle}>Categories</Text>
            <View style={styles.chartCard}>
              {Object.entries(categories).map(([cat, count]) => (
                <View key={cat} style={styles.barRow}>
                  <Text style={styles.barLabel}>{cat}</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${(Number(count) / maxCatCount) * 100}%` }]} />
                  </View>
                  <Text style={styles.barCount}>{String(count)}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {Object.keys(colors).length > 0 && (
          <Animated.View entering={FadeInUp.delay(600)} style={styles.section}>
            <Text style={styles.sectionTitle}>Color Distribution</Text>
            <View style={styles.chartCard}>
              <View style={styles.colorGrid}>
                {Object.entries(colors).map(([color, count]) => (
                  <View key={color} style={styles.colorItem}>
                    <View style={[styles.colorCircle, { backgroundColor: getColorHex(color) }]} />
                    <Text style={styles.colorName}>{color}</Text>
                    <Text style={styles.colorCount}>{String(count)}</Text>
                  </View>
                ))}
              </View>
            </View>
          </Animated.View>
        )}

        {Object.keys(styles_data).length > 0 && (
          <Animated.View entering={FadeInUp.delay(700)} style={styles.section}>
            <Text style={styles.sectionTitle}>Style Insights</Text>
            <View style={styles.chartCard}>
              <View style={styles.styleGrid}>
                {Object.entries(styles_data).map(([style, count]) => (
                  <View key={style} style={styles.styleChip}>
                    <Text style={styles.styleChipText}>{style}</Text>
                    <Text style={styles.styleChipCount}>{String(count)}</Text>
                  </View>
                ))}
              </View>
            </View>
          </Animated.View>
        )}

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
  header: { paddingHorizontal: Spacing.screenPadding, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  headerTitle: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: FontSizes.h1, color: Colors.textPrimary },
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
});
