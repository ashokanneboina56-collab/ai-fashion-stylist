import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
  ActivityIndicator, Alert, ScrollView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { apiCall } from '../utils/api';
import { Colors, Spacing, FontSizes, Radius, Shadows } from '../constants/theme';

export default function AddClothingScreen() {
  const [image, setImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
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
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!res.canceled && res.assets[0]?.base64) {
      setImage(res.assets[0].base64);
      setResult(null);
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
      setResult(data);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to process image');
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerRow}>
        <TouchableOpacity testID="close-add-clothing" onPress={() => router.back()} style={styles.closeBtn}>
          <Feather name="x" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Clothing</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!image && !result && (
          <Animated.View entering={FadeIn}>
            <Text style={styles.subtitle}>Capture or select a clothing item</Text>
            <View style={styles.optionsRow}>
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
              <View style={styles.actionRow}>
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
            <Image source={{ uri: `data:image/jpeg;base64,${result.image_base64}` }} style={styles.preview} />
            <View style={styles.resultCard}>
              <Text style={styles.resultTitle}>{result.name}</Text>
              <View style={styles.attrGrid}>
                <AttrItem label="Category" value={result.category} icon="tag" />
                <AttrItem label="Color" value={result.color} icon="droplet" />
                <AttrItem label="Texture" value={result.texture} icon="layers" />
                <AttrItem label="Style" value={result.style} icon="star" />
              </View>
              <View style={styles.resultActions}>
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
    width: '100%', height: 350, borderRadius: Radius.md,
    backgroundColor: Colors.surfaceHighlight, marginBottom: Spacing.md,
  },
  processingCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.xl,
    alignItems: 'center', borderWidth: 0.5, borderColor: Colors.border,
  },
  processingText: { fontFamily: 'Lato_700Bold', fontSize: FontSizes.bodyLg, color: Colors.textPrimary, marginTop: Spacing.md },
  processingSubtext: { fontFamily: 'Lato_400Regular', fontSize: FontSizes.bodyMd, color: Colors.textSecondary, marginTop: 4 },
  actionRow: { flexDirection: 'row', gap: Spacing.md },
  retakeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.full, paddingVertical: 14,
  },
  retakeBtnText: { fontFamily: 'Lato_700Bold', fontSize: FontSizes.bodyMd, color: Colors.textPrimary, marginLeft: 6 },
  uploadBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.secondary, borderRadius: Radius.full, paddingVertical: 14,
    ...Shadows.glow,
  },
  uploadBtnText: { fontFamily: 'Lato_700Bold', fontSize: FontSizes.bodyMd, color: Colors.onPrimary, marginLeft: 6 },
  resultCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md,
    borderWidth: 0.5, borderColor: Colors.border,
  },
  resultTitle: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: FontSizes.h2, color: Colors.textPrimary, marginBottom: Spacing.md },
  attrGrid: {},
  resultActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg },
  addAnotherBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.secondary, borderRadius: Radius.full, paddingVertical: 14,
  },
  addAnotherText: { fontFamily: 'Lato_700Bold', fontSize: FontSizes.bodyMd, color: Colors.secondary, marginLeft: 6 },
  goWardrobeBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primary, borderRadius: Radius.full, paddingVertical: 14,
  },
  goWardrobeText: { fontFamily: 'Lato_700Bold', fontSize: FontSizes.bodyMd, color: Colors.onPrimary },
});
