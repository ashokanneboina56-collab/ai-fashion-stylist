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

export default function SavedOutfitsScreen() {
  const router = useRouter();
  const [savedOutfits, setSavedOutfits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSavedOutfits = useCallback(async () => {
    try {
      const data = await apiCall('/outfit/saved');
      setSavedOutfits(data.outfits || []);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to fetch saved outfits');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSavedOutfits();
  }, [fetchSavedOutfits]);

  const handleUnsave = async (outfitId: string) => {
    const performUnsave = async () => {
      try {
        await apiCall(`/outfit/${outfitId}`, { method: 'DELETE' });
        setSavedOutfits(prev => prev.filter(o => o.outfit_id !== outfitId));
        if (Platform.OS === 'web') {
          alert('Outfit unsaved');
        } else {
          Alert.alert('Success', 'Outfit removed from saved list');
        }
      } catch (e: any) {
        console.error('Unsave failed:', e);
        Alert.alert('Error', e.message || 'Failed to unsave outfit');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to unsave this outfit?')) {
        performUnsave();
      }
    } else {
      Alert.alert('Unsave Outfit', 'Remove this outfit from your saved list?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unsave', style: 'destructive', onPress: performUnsave }
      ]);
    }
  };

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
        <Text style={styles.headerTitle}>Saved Outfits</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSavedOutfits(); }} tintColor={Colors.secondary} />}
      >
        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color={Colors.secondary} /></View>
        ) : savedOutfits.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="bookmark" size={64} color={Colors.textTertiary} />
            <Text style={styles.emptyText}>No saved outfits yet. Save your favorite combos from the Stylist tab!</Text>
          </View>
        ) : (
          savedOutfits.map((o, index) => (
            <Animated.View key={o.outfit_id || index} entering={FadeInUp.delay(index * 100)} style={styles.outfitCard}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.matchScore}>Match Score: {o.compatibility_score}%</Text>
                  <Text style={styles.savedDate}>Saved {new Date(o.created_at).toLocaleDateString()}</Text>
                </View>
                <TouchableOpacity 
                  style={styles.unsaveBtn} 
                  onPress={() => handleUnsave(o.outfit_id)}
                >
                  <Feather name="bookmark" size={18} color={Colors.secondary} />
                  <Text style={styles.unsaveText}>Unsave</Text>
                </TouchableOpacity>
              </View>

              {renderOutfitGrid(o)}
              
              {o.reason && (
                <Text style={styles.reasonText} numberOfLines={2}>{o.reason}</Text>
              )}
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
  outfitCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md,
    marginBottom: Spacing.lg, borderWidth: 0.5, borderColor: Colors.border, ...Shadows.soft,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.md },
  matchScore: { fontFamily: 'Lato_700Bold', fontSize: FontSizes.bodyMd, color: Colors.secondary },
  savedDate: { fontFamily: 'Lato_400Regular', fontSize: FontSizes.tiny, color: Colors.textTertiary, marginTop: 2 },
  unsaveBtn: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(212,175,55,0.1)', 
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full,
  },
  unsaveText: { fontFamily: 'Lato_700Bold', fontSize: 12, color: Colors.secondary, marginLeft: 4 },
  outfitGrid: { gap: Spacing.xs },
  gridRow: { flexDirection: 'row', gap: Spacing.xs },
  miniPiece: { flex: 1, backgroundColor: Colors.surfaceHighlight, borderRadius: Radius.sm, padding: 8, alignItems: 'center' },
  miniImageWrap: { width: '100%', height: 120, justifyContent: 'center', alignItems: 'center' },
  miniImage: { width: '100%', height: '100%' },
  miniLabel: { fontFamily: 'Lato_700Bold', fontSize: 10, color: Colors.textTertiary, marginTop: 4, textTransform: 'uppercase' },
  reasonText: { fontFamily: 'Lato_400Regular', fontSize: FontSizes.caption, color: Colors.textSecondary, marginTop: Spacing.md, fontStyle: 'italic' },
});
