import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Image, ActivityIndicator, FlatList, Alert, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons, Feather, FontAwesome5 } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeInRight } from 'react-native-reanimated';
import { apiCall } from '../../utils/api';
import { Colors, Spacing, FontSizes, Radius, Shadows } from '../../constants/theme';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function OutfitsScreen() {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const isLargeScreen = SCREEN_WIDTH > 600;

  const params = useLocalSearchParams<{ initialItemId: string }>();
  const initialItemId = params.initialItemId;
  const router = useRouter();

  const [items, setItems] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [outfits, setOutfits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [predicting, setPredicting] = useState(false);
  const [savingOutfit, setSavingOutfit] = useState<string | null>(null);
  const [occasion, setOccasion] = useState('casual');
  const [source, setSource] = useState('wardrobe'); // 'wardrobe' or 'store'
  const [showOccasions, setShowOccasions] = useState(false);
  const [autoPredictedId, setAutoPredictedId] = useState<string | null>(null);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const data = await apiCall('/wardrobe');
      setItems(data.items || []);
    } catch (e: any) {
      console.error('Fetch items failed:', e);
      Alert.alert('Error', 'Failed to load wardrobe items');
    } finally {
      setLoading(false);
    }
  };

  const predictOutfit = async () => {
    if (!selectedItem) {
      Alert.alert('Selection Required', 'Please choose an item from your wardrobe first.');
      return;
    }
    setPredicting(true);
    setOutfits([]);
    try {
      const data = await apiCall('/outfit/predict', {
        method: 'POST',
        body: JSON.stringify({ 
          item_id: selectedItem.item_id,
          occasion: occasion,
          source: source
        }),
      });
      if (!data.outfits || data.outfits.length === 0) {
        Alert.alert('No Matches', 'AI couldn\'t find a great combination. Try adding more items or changing the source.');
      }
      setOutfits(data.outfits || []);
    } catch (e: any) {
      console.error('Prediction failed:', e);
      Alert.alert('Error', e.message || 'Failed to generate outfits');
    } finally {
      setPredicting(false);
    }
  };

  // Auto-select item if passed via params
  useEffect(() => {
    if (initialItemId && items.length > 0) {
      const item = items.find(i => i.item_id === initialItemId);
      if (item && !selectedItem) {
        setSelectedItem(item);
      }
    }
  }, [initialItemId, items.length, !!selectedItem]);

  // Auto-predict if selectedItem changes and it was from initialItemId
  useEffect(() => {
    if (selectedItem && selectedItem.item_id === initialItemId && 
        autoPredictedId !== initialItemId && !predicting) {
      setAutoPredictedId(initialItemId);
      predictOutfit();
    }
  }, [selectedItem?.item_id, initialItemId, autoPredictedId, predicting]);

  const saveOutfit = async (outfit: any) => {
    try {
      setSavingOutfit(outfit.outfit_id);
      const data = await apiCall('/outfit/save', {
        method: 'POST',
        body: JSON.stringify({
          top_id: outfit.top?.item_id || outfit.top?.product_id || null,
          bottom_id: outfit.bottom?.item_id || outfit.bottom?.product_id || null,
          shoes_id: outfit.shoes?.item_id || outfit.shoes?.product_id || null,
          accessory_id: outfit.accessory?.item_id || outfit.accessory?.product_id || null,
          compatibility_score: outfit.compatibility_score,
          reason: outfit.reason,
        }),
      });
      if (data.status === 'success') {
        // Update local outfit ID if backend generated a new one
        outfit.outfit_id = data.outfit_id;
        Alert.alert('Success', 'Outfit saved to your collection!');
        // Redirect to Profile/Saved Outfits
        router.push('/(tabs)/profile');
      } else if (data.status === 'already_saved') {
        Alert.alert('Already Saved', 'This outfit combination is already in your collection.');
        router.push('/(tabs)/profile');
      }
    } catch (e: any) {
      console.error('Save failed:', e);
      Alert.alert('Error', 'Failed to save outfit');
    } finally {
      setSavingOutfit(null);
    }
  };

  const wearOutfit = async (outfit: any) => {
    try {
      // First, ensure the outfit is saved so we can track history
      let outfitId = outfit.outfit_id;
      
      const wearResult = await apiCall('/outfit/wear', {
        method: 'POST',
        body: JSON.stringify({ outfit_id: outfitId }),
      });
      
      if (wearResult.status === 'success') {
        Alert.alert('Success', 'Outfit marked as worn! Wear counts updated.');
        router.push('/(tabs)/analytics');
      }
    } catch (e: any) {
      // If outfit not found, it means it's a generated one not yet saved
      if (e.message.includes('not found') || e.message.includes('404')) {
        try {
          // Auto-save first
          const saveResult = await apiCall('/outfit/save', {
            method: 'POST',
            body: JSON.stringify({
              top_id: outfit.top?.item_id || outfit.top?.product_id || null,
              bottom_id: outfit.bottom?.item_id || outfit.bottom?.product_id || null,
              shoes_id: outfit.shoes?.item_id || outfit.shoes?.product_id || null,
              accessory_id: outfit.accessory?.item_id || outfit.accessory?.product_id || null,
              compatibility_score: outfit.compatibility_score,
              reason: outfit.reason,
            }),
          });
          
          if (saveResult.status === 'success') {
            await apiCall('/outfit/wear', {
              method: 'POST',
              body: JSON.stringify({ outfit_id: saveResult.outfit_id }),
            });
            Alert.alert('Success', 'Outfit saved and marked as worn!');
            router.push('/(tabs)/analytics');
          }
        } catch (err) {
          Alert.alert('Error', 'Failed to track outfit wear.');
        }
      } else {
        Alert.alert('Error', 'Failed to update history');
      }
    }
  };

  const renderOutfit = (outfit: any) => (
    <View key={outfit.outfit_id} style={styles.outfitCard}>
      <View style={styles.outfitHeader}>
        <View style={styles.scoreBadge}>
          <Text style={styles.scoreText}>{outfit.compatibility_score}% Match</Text>
        </View>
        {outfit.reason && <Text style={styles.outfitReason} numberOfLines={2}>{outfit.reason}</Text>}
      </View>
      
      <View style={styles.outfitGrid}>
        {renderOutfitItem(outfit.top, 'Top')}
        {renderOutfitItem(outfit.bottom, 'Bottom')}
        {renderOutfitItem(outfit.shoes, 'Shoes')}
        {renderOutfitItem(outfit.accessory, 'Accessory')}
      </View>

      <View style={styles.outfitActions}>
        <TouchableOpacity 
          style={styles.saveBtn} 
          onPress={() => saveOutfit(outfit)}
          disabled={savingOutfit === outfit.outfit_id}
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
        <TouchableOpacity style={styles.wearBtn} onPress={() => wearOutfit(outfit)}>
          <Text style={styles.wearBtnText}>Mark as Worn</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderOutfitItem = (item: any, label: string) => {
    if (!item) return null;
    
    // Support both wardrobe (base64) and store (url) images
    const imageSource = item.image_base64 
      ? { uri: `data:image/jpeg;base64,${item.image_base64}` }
      : item.image_url 
        ? { uri: item.image_url.startsWith('/') ? `${BASE_URL}${item.image_url}` : item.image_url }
        : null;

    return (
      <View style={[styles.outfitPiece, { width: isLargeScreen ? '48%' : '100%' }]}>
        <View style={styles.sourceTag}>
          <Text style={styles.sourceTagText}>
            {item.is_store_item ? "From Store" : "From Closet"}
          </Text>
        </View>
        {imageSource ? (
          <Image 
            source={imageSource} 
            style={styles.outfitPieceImage} 
            resizeMode="contain" 
          />
        ) : (
          <View style={[styles.outfitPieceImage, styles.placeholder]}>
            <MaterialCommunityIcons name="hanger" size={20} color={Colors.textTertiary} />
          </View>
        )}
        <Text style={styles.outfitPieceLabel}>{label}</Text>
        <Text style={styles.outfitPieceName} numberOfLines={1}>{item?.name || 'Unnamed'}</Text>
      </View>
    );
  };

  useFocusEffect(
    useCallback(() => {
      fetchItems();
    }, [])
  );

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
              <View style={styles.sourceRow}>
                <TouchableOpacity
                  style={[styles.sourceBtn, source === 'wardrobe' && styles.sourceBtnActive]}
                  onPress={() => setSource('wardrobe')}
                >
                  <Feather name="box" size={16} color={source === 'wardrobe' ? Colors.onPrimary : Colors.textSecondary} />
                  <Text style={[styles.sourceBtnText, source === 'wardrobe' && styles.sourceBtnTextActive]}>My Wardrobe</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sourceBtn, source === 'store' && styles.sourceBtnActive]}
                  onPress={() => setSource('store')}
                >
                  <Feather name="shopping-bag" size={16} color={source === 'store' ? Colors.onPrimary : Colors.textSecondary} />
                  <Text style={[styles.sourceBtnText, source === 'store' && styles.sourceBtnTextActive]}>Online Store</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.occasionRow}>
                <Text style={styles.occasionLabel}>Occasion:</Text>
                {['casual', 'formal', 'sporty'].map((occ) => (
                  <TouchableOpacity
                    key={occ}
                    style={[styles.occChip, occasion === occ && styles.occChipActive]}
                    onPress={() => setOccasion(occ)}
                  >
                    <Text style={[styles.occChipText, occasion === occ && styles.occChipTextActive]}>
                      {occ.charAt(0).toUpperCase() + occ.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
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
            <Animated.View key={outfit.outfit_id} entering={FadeInRight.delay(index * 200).duration(500)}>
              {renderOutfit(outfit)}
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
  outfitPieceImage: { 
    width: '100%', 
    height: 180, 
    borderRadius: Radius.sm, 
    backgroundColor: Colors.surfaceHighlight,
  },
  outfitPieceLabel: { fontFamily: 'Lato_700Bold', fontSize: FontSizes.tiny, color: Colors.secondary, marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 },
  outfitPieceName: { fontFamily: 'Lato_400Regular', fontSize: FontSizes.caption, color: Colors.textSecondary },
  outfitReason: { fontFamily: 'Lato_400Regular', fontSize: FontSizes.bodyMd, color: Colors.textSecondary, marginTop: Spacing.sm, fontStyle: 'italic' },
  outfitActions: { flexDirection: 'row', marginTop: Spacing.md, gap: Spacing.sm },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: 8,
  },
  saveBtnText: {
    color: Colors.secondary,
    fontFamily: 'Lato_700Bold',
    fontSize: FontSizes.bodySm,
  },
  wearBtn: {
    backgroundColor: Colors.secondary,
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: Radius.md,
    gap: 8,
  },
  wearBtnText: {
    color: Colors.onPrimary,
    fontFamily: 'Lato_700Bold',
    fontSize: FontSizes.bodySm,
  },
  occasionRow: {
    flexDirection: 'row',
    alignItems: 'center', 
    flexWrap: 'wrap',
    marginBottom: 12,
    gap: 8,
  },
  occasionLabel: {
    fontFamily: 'Lato_700Bold',
    fontSize: FontSizes.bodySm,
    color: Colors.textSecondary,
    marginRight: 4,
  },
  occChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  occChipActive: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  occChipText: {
    fontSize: FontSizes.caption,
    color: Colors.textSecondary,
    fontFamily: 'Lato_400Regular',
  },
  occChipTextActive: {
    color: Colors.onPrimary,
    fontFamily: 'Lato_700Bold',
  },
  sourceRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  sourceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
    minHeight: 44,
  },
  sourceBtnActive: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  sourceBtnText: {
    fontFamily: 'Lato_700Bold',
    fontSize: FontSizes.bodySm,
    color: Colors.textSecondary,
  },
  sourceBtnTextActive: {
    color: Colors.onPrimary,
  },
  sourceTag: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 1,
  },
  sourceTagText: {
    color: '#fff',
    fontSize: 8,
    fontFamily: 'Lato_700Bold',
    textTransform: 'uppercase',
  },
});
