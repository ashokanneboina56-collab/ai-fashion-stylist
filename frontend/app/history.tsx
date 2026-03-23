import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Image, Platform, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { apiCall } from '../utils/api';
import { Colors, Spacing, FontSizes, Radius, Shadows } from '../constants/theme';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function HistoryScreen() {
  const router = useRouter();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = useCallback(async () => {
    try {
      const data = await apiCall('/outfit/history');
      setHistory(data.history || []);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to fetch history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const renderOutfitComponent = (item: any, label: string) => {
    if (!item) return null;
    
    const imageSource = item.image_base64 
      ? { uri: `data:image/jpeg;base64,${item.image_base64}` }
      : item.image_url 
        ? { uri: item.image_url.startsWith('/') ? `${BASE_URL}${item.image_url}` : item.image_url }
        : null;

    return (
      <View style={styles.miniPiece}>
        <View style={styles.miniImageWrap}>
          {imageSource ? (
            <Image source={imageSource} style={styles.miniImage} resizeMode="contain" />
          ) : (
            <MaterialCommunityIcons name="hanger" size={24} color={Colors.textTertiary} />
          )}
        </View>
        <Text style={styles.miniLabel} numberOfLines={1}>{label}</Text>
      </View>
    );
  };

  const renderOutfitGrid = (outfit: any) => (
    <View style={styles.outfitGrid}>
      <View style={styles.gridRow}>
        {renderOutfitComponent(outfit.top, 'Top')}
        {renderOutfitComponent(outfit.bottom, 'Bottom')}
      </View>
      <View style={styles.gridRow}>
        {renderOutfitComponent(outfit.shoes, 'Shoes')}
        {outfit.accessory ? renderOutfitComponent(outfit.accessory, 'Accessory') : (
          <View style={styles.miniPiece} />
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Outfit History</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchHistory(); }} tintColor={Colors.secondary} />}
      >
        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color={Colors.secondary} /></View>
        ) : history.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="history" size={64} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>No history yet. Start wearing outfits to track them here!</Text>
          </View>
        ) : (
          history.map((h, index) => (
            <Animated.View key={h.history_id || index} entering={FadeInUp.delay(index * 100)} style={styles.historyCard}>
              <View style={styles.historyHeader}>
                <View style={styles.historyDate}>
                  <Feather name="calendar" size={14} color={Colors.textTertiary} />
                  <Text style={styles.historyDateText}>
                    {new Date(h.worn_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                </View>
                <View style={styles.wearBadge}>
                  <Text style={styles.wearBadgeText}>{h.wear_count || 1}x Worn</Text>
                </View>
              </View>
              
              {renderOutfitGrid(h)}

              <View style={styles.historyFooter}>
                {h.compatibility_score && (
                  <Text style={styles.historyScore}>Style Score: {h.compatibility_score}%</Text>
                )}
                {h.reason && (
                  <Text style={styles.reasonText} numberOfLines={1}>{h.reason}</Text>
                )}
              </View>
            </Animated.View>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { 
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screenPadding,
    backgroundColor: Colors.surface,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { 
    fontFamily: 'PlayfairDisplay_700Bold', 
    fontSize: FontSizes.h3, 
    color: Colors.textPrimary,
  },
  scrollContent: { padding: Spacing.screenPadding },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
  emptyContainer: { alignItems: 'center', marginTop: 100, paddingHorizontal: 40 },
  emptyText: {
    fontFamily: 'Lato_400Regular', fontSize: FontSizes.bodyMd, color: Colors.textTertiary,
    textAlign: 'center', marginTop: Spacing.lg, lineHeight: 22,
  },
  historyCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md,
    marginBottom: Spacing.lg, borderWidth: 0.5, borderColor: Colors.border, ...Shadows.soft,
  },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  historyDate: { flexDirection: 'row', alignItems: 'center' },
  historyDateText: { fontFamily: 'Lato_400Regular', fontSize: FontSizes.caption, color: Colors.textTertiary, marginLeft: 6 },
  wearBadge: { backgroundColor: 'rgba(212,175,55,0.1)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.sm },
  wearBadgeText: { fontFamily: 'Lato_700Bold', fontSize: 10, color: Colors.secondary },
  historyFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.md },
  historyScore: { fontFamily: 'Lato_700Bold', fontSize: 12, color: Colors.secondary },
  reasonText: { fontFamily: 'Lato_400Regular', fontSize: 11, color: Colors.textTertiary, fontStyle: 'italic', flex: 1, textAlign: 'right', marginLeft: 10 },
  outfitGrid: { gap: Spacing.xs },
  gridRow: { flexDirection: 'row', gap: Spacing.xs },
  miniPiece: { flex: 1, backgroundColor: Colors.surfaceHighlight, borderRadius: Radius.sm, padding: 8, alignItems: 'center' },
  miniImageWrap: { width: '100%', height: 120, justifyContent: 'center', alignItems: 'center' },
  miniImage: { width: '100%', height: '100%' },
  miniLabel: { fontFamily: 'Lato_700Bold', fontSize: 10, color: Colors.textTertiary, marginTop: 4, textTransform: 'uppercase' },
});
