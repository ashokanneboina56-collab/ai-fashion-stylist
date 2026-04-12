import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
  ActivityIndicator, Alert, ScrollView, Platform, useWindowDimensions, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker'; // This might not be right, checking ImagePicker assets
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { apiCall } from '../utils/api';
import { Colors, Spacing, FontSizes, Radius, Shadows } from '../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function AddClothingScreen() {
  const isMobile = SCREEN_WIDTH < 480;

  const [image, setImage] = useState<string | null>(null);
  const [batchImages, setBatchImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const router = useRouter();

  const pickImage = async (useCamera: boolean) => {
    const permission = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permission Required', 'Please grant camera/gallery access to add clothing items.');
      return;
    }

    const pickerFn = useCamera
      ? ImagePicker.launchCameraAsync
      : ImagePicker.launchImageLibraryAsync;

    const res = await pickerFn({
      mediaTypes: ['images'],
      allowsEditing: !isBatchMode, // Disable editing for multi-select
      allowsMultipleSelection: isBatchMode,
      quality: 0.8,
      base64: true,
    });

    if (!res.canceled && res.assets) {
      if (isBatchMode) {
        const newImages = res.assets.map(a => a.base64).filter(Boolean) as string[];
        setBatchImages(prev => [...prev, ...newImages]);
      } else if (res.assets[0]?.base64) {
        setImage(res.assets[0].base64);
        setResult(null);
      }
    }
  };

  const uploadImage = async () => {
    if (!image) return;
    setUploading(true);
    try {
      const data = await apiCall('/wardrobe/add', {
        method: 'POST',
        body: JSON.stringify({ image_base64: image }),
      });
      
      console.log('DEBUG: Backend Response:', data);

      if (data.is_clothing === false) {
        if (Platform.OS === 'web') {
          alert('Not a clothing item or fashion accessory.');
        } else {
          Alert.alert('Alert', 'This is not a clothing item or fashion accessory.');
        }
        setImage(null);
        setUploading(false);
        return;
      }

      setResult(data);
    } catch (e: any) {
      if (Platform.OS === 'web') {
        alert(e.message || 'Failed to process image');
      } else {
        Alert.alert('Error', e.message || 'Failed to process image');
      }
    } finally {
      setUploading(false);
    }
  };

  const uploadBatch = async () => {
    if (batchImages.length === 0) return;
    setUploading(true);
    try {
      const data = await apiCall('/wardrobe/batch-add', {
        method: 'POST',
        body: JSON.stringify({
          items: batchImages.map(img => ({ image_base64: img }))
        }),
      });
      
      let message = `Successfully uploaded ${data.items?.length || 0} items.`;
      if (data.skipped_count > 0) {
         message += `\n\n${data.skipped_count} items were skipped because they were not identified as clothing.`;
       }
 
       if (Platform.OS === 'web') {
         alert(message);
         if (data.items?.length > 0) router.back();
         else setBatchImages([]);
       } else {
         Alert.alert('Success', message, [
           { text: 'View Wardrobe', onPress: () => router.back() },
           { text: 'OK', onPress: () => setBatchImages([]) }
         ]);
       }
    } catch (e: any) {
        if (Platform.OS === 'web') {
          alert(e.message || 'Failed to process batch upload');
        } else {
          Alert.alert('Error', e.message || 'Failed to process batch upload');
        }
      } finally {
      setUploading(false);
    }
  };

  const removeBatchImage = (index: number) => {
    setBatchImages(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerRow}>
        <TouchableOpacity testID="close-add-clothing" onPress={() => router.back()} style={styles.closeBtn}>
          <Feather name="x" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isBatchMode ? 'Batch Upload' : 'Add Clothing'}</Text>
        <TouchableOpacity onPress={() => {
          setIsBatchMode(!isBatchMode);
          setImage(null);
          setBatchImages([]);
          setResult(null);
        }}>
          <Text style={{ color: Colors.secondary, fontFamily: 'Lato_700Bold' }}>
            {isBatchMode ? 'Single' : 'Batch'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!isBatchMode ? (
          <>
            {!image && !result && (
              <Animated.View entering={FadeIn}>
                <Text style={styles.subtitle}>Capture or select a clothing item</Text>
                <View style={[styles.optionsRow, { flexDirection: isMobile ? 'column' : 'row' }]}>
                  <TouchableOpacity testID="take-photo-btn" style={styles.optionCard} onPress={() => pickImage(true)}>
                    <View style={styles.optionIconWrap}>
                      <Feather name="camera" size={32} color={Colors.secondary} />
                    </View>
                    <Text style={styles.optionText}>Take Photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity testID="pick-gallery-btn" style={styles.optionCard} onPress={() => pickImage(false)}>
                    <View style={styles.optionIconWrap}>
                      <Feather name="image" size={32} color={Colors.secondary} />
                    </View>
                    <Text style={styles.optionText}>Gallery</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            )}

            {image && !result && (
              <Animated.View entering={FadeInUp}>
                <Image source={{ uri: `data:image/jpeg;base64,${image}` }} style={styles.preview} />
                {uploading ? (
                  <View style={styles.processingCard}>
                    <ActivityIndicator size="large" color={Colors.secondary} />
                    <Text style={styles.processingText}>AI is analyzing your clothing...</Text>
                    <Text style={styles.processingSubtext}>Detecting category, color, texture & style</Text>
                  </View>
                ) : (
                  <View style={[styles.actionRow, { flexDirection: isMobile ? 'column' : 'row' }]}>
                    <TouchableOpacity testID="retake-btn" style={styles.retakeBtn} onPress={() => { setImage(null); setResult(null); }}>
                      <Feather name="refresh-cw" size={16} color={Colors.textPrimary} />
                      <Text style={styles.retakeBtnText}>Retake</Text>
                    </TouchableOpacity>
                    <TouchableOpacity testID="upload-btn" style={styles.uploadBtn} onPress={uploadImage}>
                      <Ionicons name="sparkles" size={16} color={Colors.onPrimary} />
                      <Text style={styles.uploadBtnText}>Analyze & Save</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </Animated.View>
            )}

            {result && (
              <Animated.View entering={FadeInUp}>
                <Image source={{ uri: `data:image/jpeg;base64,${result?.image_base64}` }} style={styles.preview} />
                <View style={styles.resultCard}>
                  <Text style={styles.resultTitle}>{result?.name || 'Unnamed Item'}</Text>
                  <View style={styles.attrGrid}>
                    <AttrItem label="Category" value={result?.category || 'Tops'} icon="tag" />
                    <AttrItem label="Color" value={result?.color || 'Unknown'} icon="droplet" />
                    <AttrItem label="Style" value={result?.style || 'Casual'} icon="star" />
                    <AttrItem label="Pattern" value={result?.pattern || 'plain'} icon="layers" />
                  </View>
                  <View style={[styles.resultActions, { flexDirection: isMobile ? 'column' : 'row' }]}>
                    <TouchableOpacity testID="add-another-btn" style={styles.addAnotherBtn} onPress={() => { setImage(null); setResult(null); }}>
                      <Feather name="plus" size={16} color={Colors.secondary} />
                      <Text style={styles.addAnotherText}>Add Another</Text>
                    </TouchableOpacity>
                    <TouchableOpacity testID="go-wardrobe-btn" style={styles.goWardrobeBtn} onPress={() => router.back()}>
                      <Text style={styles.goWardrobeText}>View Wardrobe</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Animated.View>
            )}
          </>
        ) : (
          <View>
            <Text style={styles.subtitle}>Select multiple items to upload</Text>
            <TouchableOpacity style={styles.batchAddBtn} onPress={() => pickImage(false)}>
              <Feather name="plus" size={24} color={Colors.onPrimary} />
              <Text style={styles.batchAddBtnText}>Select Images</Text>
            </TouchableOpacity>

            <View style={styles.batchGrid}>
              {batchImages.map((img, idx) => (
                <View key={idx} style={styles.batchItem}>
                  <Image source={{ uri: `data:image/jpeg;base64,${img}` }} style={styles.batchImage} />
                  <TouchableOpacity style={styles.removeBatchBtn} onPress={() => removeBatchImage(idx)}>
                    <Feather name="trash-2" size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            {batchImages.length > 0 && (
              <TouchableOpacity 
                style={[styles.uploadBtn, { width: '100%', marginTop: Spacing.lg }]} 
                onPress={uploadBatch}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color={Colors.onPrimary} />
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={20} color={Colors.onPrimary} />
                    <Text style={styles.uploadBtnText}>Upload {batchImages.length} Items</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function AttrItem({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <View style={attrStyles.item}>
      <Feather name={icon as any} size={14} color={Colors.secondary} />
      <Text style={attrStyles.label}>{label}</Text>
      <Text style={attrStyles.value}>{value}</Text>
    </View>
  );
}

const attrStyles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  label: { fontFamily: 'Lato_400Regular', fontSize: FontSizes.caption, color: Colors.textTertiary, width: 70, marginLeft: 8 },
  value: { fontFamily: 'Lato_700Bold', fontSize: FontSizes.bodyMd, color: Colors.textPrimary, flex: 1 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.screenPadding, paddingVertical: Spacing.md,
  },
  closeBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: FontSizes.h3, color: Colors.textPrimary },
  content: { paddingHorizontal: Spacing.screenPadding, paddingBottom: 60 },
  subtitle: {
    fontFamily: 'Lato_400Regular', fontSize: FontSizes.bodyLg, color: Colors.textSecondary,
    textAlign: 'center', marginBottom: Spacing.xl, marginTop: Spacing.xl,
  },
  optionsRow: { flexDirection: 'row', gap: Spacing.md },
  optionCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md,
    padding: Spacing.xl, alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  optionIconWrap: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(212,175,55,0.1)',
    justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md,
  },
  optionText: { fontFamily: 'Lato_700Bold', fontSize: FontSizes.bodyLg, color: Colors.textPrimary },
  preview: {
    width: '100%', height: undefined, aspectRatio: 3/4, borderRadius: Radius.md,
    backgroundColor: Colors.surfaceHighlight, marginBottom: Spacing.md,
  },
  processingCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.xl,
    alignItems: 'center', borderWidth: 0.5, borderColor: Colors.border,
  },
  processingText: { fontFamily: 'Lato_700Bold', fontSize: FontSizes.bodyLg, color: Colors.textPrimary, marginTop: Spacing.md },
  processingSubtext: { fontFamily: 'Lato_400Regular', fontSize: FontSizes.bodyMd, color: Colors.textSecondary, marginTop: 4 },
  actionRow: { flexDirection: 'row', gap: Spacing.md, paddingVertical: Spacing.md },
  retakeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.full, paddingVertical: 14,
    height: 56,
  },
  retakeBtnText: { fontFamily: 'Lato_700Bold', fontSize: FontSizes.bodyMd, color: Colors.textPrimary, marginLeft: 6 },
  uploadBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.secondary, borderRadius: Radius.full, paddingVertical: 14,
    height: 56,
    ...Shadows.glow,
  },
  uploadBtnText: { fontFamily: 'Lato_700Bold', fontSize: FontSizes.bodyMd, color: Colors.onPrimary, marginLeft: 6 },
  resultCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md,
    borderWidth: 0.5, borderColor: Colors.border,
  },
  resultTitle: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: FontSizes.h2, color: Colors.textPrimary, marginBottom: Spacing.md },
  attrGrid: {},
  resultActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg, paddingBottom: Spacing.md },
  addAnotherBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.secondary, borderRadius: Radius.full, paddingVertical: 14,
    height: 56,
  },
  addAnotherText: { fontFamily: 'Lato_700Bold', fontSize: FontSizes.bodyMd, color: Colors.secondary, marginLeft: 6 },
  goWardrobeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surfaceHighlight, borderRadius: Radius.full, paddingVertical: 14,
    height: 56,
  },
  goWardrobeText: { fontFamily: 'Lato_700Bold', fontSize: FontSizes.bodyMd, color: Colors.textPrimary },
  batchAddBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.secondary, borderRadius: Radius.md, paddingVertical: 16,
    marginBottom: Spacing.lg, gap: 8,
  },
  batchAddBtnText: { fontFamily: 'Lato_700Bold', fontSize: FontSizes.bodyLg, color: Colors.onPrimary },
  batchGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  batchItem: { width: (SCREEN_WIDTH - Spacing.screenPadding * 2 - Spacing.sm * 2) / 3, aspectRatio: 1, borderRadius: Radius.sm, overflow: 'hidden' },
  batchImage: { width: '100%', height: '100%' },
  removeBatchBtn: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(255,0,0,0.6)', width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
});
