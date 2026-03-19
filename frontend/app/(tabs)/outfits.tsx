import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Image, ActivityIndicator, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons, Feather, FontAwesome5 } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeInRight } from 'react-native-reanimated';
import { apiCall } from '../../utils/api';
import { Colors, Spacing, FontSizes, Radius, Shadows } from '../../constants/theme';

export default function OutfitsScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [outfits, setOutfits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [predicting, setPredicting] = useState(false);
  const [savingOutfit, setSavingOutfit] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchItems();
    }, [])
  );

  const fetchItems = async () => {
    try {
      setLoading(true);
      const data = await apiCall('/wardrobe');
      setItems(data.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const predictOutfit = async () => {
    if (!selectedItem) return;
    setPredicting(true);
    setOutfits([]);
    try {
      const data = await apiCall('/outfit/predict', {
        method: 'POST',
        body: JSON.stringify({ item_id: selectedItem.item_id }),
      });
      setOutfits(data.outfits || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setPredicting(false);
    }
  };

  const saveOutfit = async (outfit: any) => {
    try {
      setSavingOutfit(outfit.outfit_id);
      await apiCall('/outfit/save', {
        method: 'POST',
        body: JSON.stringify({
          top_id: outfit.top?.item_id || null,
          bottom_id: outfit.bottom?.item_id || null,
          shoes_id: outfit.shoes?.item_id || null,
          accessory_id: outfit.accessory?.item_id || null,
          compatibility_score: outfit.compatibility_score,
          reason: outfit.reason,
        }),
      });
    } catch (e) {
      console.error(e);
    } finally {
      setSavingOutfit(null);
    }
  };

  const wearOutfit = async (outfit: any) => {
    try {
      await saveOutfit(outfit);
      await apiCall('/outfit/wear', {
        method: 'POST',
        body: JSON.stringify({ outfit_id: outfit.outfit_id }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  const renderOutfitItem = (item: any, label: string) => {
    if (!item) return null;
    return (
      <View style={styles.outfitPiece}>
        {item.image_base64 ? (
          <Image source={{ uri: `data:image/jpeg;base64,${item.image_base64}` }} style={styles.outfitPieceImage} />
        ) : (
          <View style={[styles.outfitPieceImage, styles.placeholder]}>
            <MaterialCommunityIcons name="hanger" size={20} color={Colors.textTertiary} />
          </View>
        )}
        <Text style={styles.outfitPieceLabel}>{label}</Text>
        <Text style={styles.outfitPieceName} numberOfLines={1}>{item.name}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AI Stylist</Text>
        <Text style={styles.headerSubtitle}>Select an item to generate outfits</Text>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={Colors.secondary} /></View>
      ) : items.length < 2 ? (
        <View style={styles.centered}>
          <FontAwesome5 name="magic" size={48} color={Colors.textTertiary} />
          <Text style={styles.emptyTitle}>Add more items</Text>
          <Text style={styles.emptySubtitle}>You need at least 2 items for AI outfit prediction</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>Choose an item</Text>
          <FlatList
            data={items}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.itemList}
            keyExtractor={(item) => item.item_id}
            renderItem={({ item }) => (
              <TouchableOpacity
                testID={`select-item-${item.item_id}`}
                style={[styles.itemChip, selectedItem?.item_id === item.item_id && styles.itemChipSelected]}
                onPress={() => setSelectedItem(item)}
              >
                {item.image_base64 ? (
                  <Image source={{ uri: `data:image/jpeg;base64,${item.image_base64}` }} style={styles.itemChipImage} />
                ) : (
                  <View style={[styles.itemChipImage, styles.placeholder]}>
                    <MaterialCommunityIcons name="hanger" size={16} color={Colors.textTertiary} />
                  </View>
                )}
                <Text style={[styles.itemChipText, selectedItem?.item_id === item.item_id && styles.itemChipTextSelected]} numberOfLines={1}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            )}
          />

          {selectedItem && (
            <View style={styles.generateWrap}>
              <TouchableOpacity
                testID="generate-outfit-btn"
                style={styles.generateBtn}
                onPress={predictOutfit}
                disabled={predicting}
              >
                {predicting ? (
                  <ActivityIndicator color={Colors.onPrimary} />
                ) : (
                  <>
                    <FontAwesome5 name="magic" size={16} color={Colors.onPrimary} />
                    <Text style={styles.generateBtnText}>Generate Outfits</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {predicting && (
            <Animated.View entering={FadeInUp} style={styles.loadingCard}>
              <ActivityIndicator size="large" color={Colors.secondary} />
              <Text style={styles.loadingText}>AI is creating outfit combinations...</Text>
            </Animated.View>
          )}

          {outfits.map((outfit, index) => (
            <Animated.View key={outfit.outfit_id} entering={FadeInRight.delay(index * 200).duration(500)} style={styles.outfitCard}>
              <View style={styles.outfitHeader}>
                <Text style={styles.outfitTitle}>Outfit {index + 1}</Text>
                <View style={styles.scoreBadge}>
                  <Text style={styles.scoreText}>{outfit.compatibility_score}%</Text>
                </View>
              </View>

              <View style={styles.outfitGrid}>
                {renderOutfitItem(outfit.top, 'Top')}
                {renderOutfitItem(outfit.bottom, 'Bottom')}
                {renderOutfitItem(outfit.shoes, 'Shoes')}
                {renderOutfitItem(outfit.accessory, 'Accessory')}
              </View>

              {outfit.reason ? (
                <Text style={styles.outfitReason}>{outfit.reason}</Text>
              ) : null}

              <View style={styles.outfitActions}>
                <TouchableOpacity
                  testID={`wear-outfit-${outfit.outfit_id}`}
                  style={styles.wearBtn}
                  onPress={() => wearOutfit(outfit)}
                >
                  <Feather name="check-circle" size={16} color={Colors.onPrimary} />
                  <Text style={styles.wearBtnText}>Wear Today</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID={`save-outfit-${outfit.outfit_id}`}
                  style={styles.saveBtn}
                  onPress={() => saveOutfit(outfit)}
                >
                  {savingOutfit === outfit.outfit_id ? (
                    <ActivityIndicator size="small" color={Colors.secondary} />
                  ) : (
                    <>
                      <Feather name="bookmark" size={16} color={Colors.secondary} />
                      <Text style={styles.saveBtnText}>Save</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </Animated.View>
          ))}

          <View style={{ height: 120 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.screenPadding, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  headerTitle: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: FontSizes.h1, color: Colors.textPrimary },
  headerSubtitle: { fontFamily: 'Lato_400Regular', fontSize: FontSizes.bodyMd, color: Colors.textSecondary, marginTop: 4 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyTitle: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: FontSizes.h3, color: Colors.textPrimary, marginTop: Spacing.lg },
  emptySubtitle: { fontFamily: 'Lato_400Regular', fontSize: FontSizes.bodyMd, color: Colors.textSecondary, marginTop: Spacing.sm, textAlign: 'center', paddingHorizontal: Spacing.xl },
  sectionTitle: { fontFamily: 'Lato_700Bold', fontSize: FontSizes.bodyLg, color: Colors.textSecondary, paddingHorizontal: Spacing.screenPadding, marginTop: Spacing.md, marginBottom: Spacing.sm },
  itemList: { paddingHorizontal: Spacing.screenPadding },
  itemChip: {
    alignItems: 'center', marginRight: Spacing.sm, padding: Spacing.sm,
    borderRadius: Radius.md, backgroundColor: Colors.surface,
    borderWidth: 1.5, borderColor: Colors.border, width: 90,
  },
  itemChipSelected: { borderColor: Colors.secondary, backgroundColor: Colors.surfaceHighlight },
  itemChipImage: { width: 60, height: 60, borderRadius: Radius.sm },
  placeholder: { backgroundColor: Colors.surfaceHighlight, justifyContent: 'center', alignItems: 'center' },
  itemChipText: { fontFamily: 'Lato_400Regular', fontSize: FontSizes.tiny, color: Colors.textSecondary, marginTop: 4, textAlign: 'center' },
  itemChipTextSelected: { color: Colors.secondary },
  generateWrap: { paddingHorizontal: Spacing.screenPadding, marginTop: Spacing.lg },
  generateBtn: {
    backgroundColor: Colors.secondary, borderRadius: Radius.full,
    paddingVertical: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    ...Shadows.glow,
  },
  generateBtnText: { color: Colors.onPrimary, fontFamily: 'Lato_700Bold', fontSize: FontSizes.bodyLg, marginLeft: Spacing.sm },
  loadingCard: {
    margin: Spacing.screenPadding, padding: Spacing.xl,
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    alignItems: 'center', borderWidth: 0.5, borderColor: Colors.border,
  },
  loadingText: { fontFamily: 'Lato_400Regular', fontSize: FontSizes.bodyMd, color: Colors.textSecondary, marginTop: Spacing.md },
  outfitCard: {
    margin: Spacing.screenPadding, marginBottom: 0,
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    padding: Spacing.md, borderWidth: 0.5, borderColor: Colors.border, ...Shadows.soft,
  },
  outfitHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  outfitTitle: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: FontSizes.h3, color: Colors.textPrimary },
  scoreBadge: { backgroundColor: Colors.secondary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.full },
  scoreText: { fontFamily: 'Lato_700Bold', fontSize: FontSizes.bodyMd, color: Colors.onPrimary },
  outfitGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  outfitPiece: { width: '48%', marginBottom: Spacing.sm },
  outfitPieceImage: { width: '100%', height: 100, borderRadius: Radius.sm, backgroundColor: Colors.surfaceHighlight },
  outfitPieceLabel: { fontFamily: 'Lato_700Bold', fontSize: FontSizes.tiny, color: Colors.secondary, marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 },
  outfitPieceName: { fontFamily: 'Lato_400Regular', fontSize: FontSizes.caption, color: Colors.textSecondary },
  outfitReason: { fontFamily: 'Lato_400Regular', fontSize: FontSizes.bodyMd, color: Colors.textSecondary, marginTop: Spacing.sm, fontStyle: 'italic' },
  outfitActions: { flexDirection: 'row', marginTop: Spacing.md, gap: Spacing.sm },
  wearBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primary, borderRadius: Radius.full, paddingVertical: 12,
  },
  wearBtnText: { color: Colors.onPrimary, fontFamily: 'Lato_700Bold', fontSize: FontSizes.bodyMd, marginLeft: 6 },
  saveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'transparent', borderRadius: Radius.full, paddingVertical: 12,
    borderWidth: 1, borderColor: Colors.secondary,
  },
  saveBtnText: { color: Colors.secondary, fontFamily: 'Lato_700Bold', fontSize: FontSizes.bodyMd, marginLeft: 6 },
});
