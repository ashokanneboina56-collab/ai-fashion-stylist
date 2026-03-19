import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather, FontAwesome5, Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { apiCall } from '../../utils/api';
import { Colors, Spacing, FontSizes, Radius, Shadows } from '../../constants/theme';

export default function ClothingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [predicting, setPredicting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchItem();
  }, [id]);

  const fetchItem = async () => {
    try {
      const data = await apiCall(`/wardrobe/${id}`);
      setItem(data);
    } catch (e) {
      Alert.alert('Error', 'Item not found');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const deleteItem = () => {
    Alert.alert('Delete Item', 'Are you sure you want to remove this item?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await apiCall(`/wardrobe/${id}`, { method: 'DELETE' });
            router.back();
          } catch (e) {
            Alert.alert('Error', 'Failed to delete item');
          }
        },
      },
    ]);
  };

  const predictOutfit = async () => {
    setPredicting(true);
    try {
      router.push('/(tabs)/outfits');
    } catch (e) {
      console.error(e);
    } finally {
      setPredicting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}><ActivityIndicator size="large" color={Colors.secondary} /></View>
      </SafeAreaView>
    );
  }

  if (!item) return null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerRow}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity testID="delete-item-btn" onPress={deleteItem} style={styles.deleteBtn}>
          <Feather name="trash-2" size={20} color={Colors.error} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {item.image_base64 ? (
          <Image source={{ uri: `data:image/jpeg;base64,${item.image_base64}` }} style={styles.heroImage} />
        ) : (
          <View style={[styles.heroImage, styles.placeholder]}>
            <Ionicons name="shirt-outline" size={80} color={Colors.textTertiary} />
          </View>
        )}

        <Animated.View entering={FadeInUp} style={styles.infoCard}>
          <Text style={styles.itemName}>{item.name}</Text>

          <View style={styles.attrSection}>
            <AttrRow icon="tag" label="Category" value={item.category} />
            <AttrRow icon="droplet" label="Color" value={item.color} />
            <AttrRow icon="layers" label="Texture" value={item.texture} />
            <AttrRow icon="star" label="Style" value={item.style} />
            <AttrRow icon="repeat" label="Worn" value={`${item.wear_count || 0} times`} />
            <AttrRow icon="calendar" label="Added" value={new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} />
          </View>

          <TouchableOpacity
            testID="predict-outfit-btn"
            style={styles.predictBtn}
            onPress={predictOutfit}
            disabled={predicting}
          >
            {predicting ? (
              <ActivityIndicator color={Colors.onPrimary} />
            ) : (
              <>
                <FontAwesome5 name="magic" size={16} color={Colors.onPrimary} />
                <Text style={styles.predictBtnText}>Predict Matching Outfit</Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

function AttrRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={attrStyles.row}>
      <View style={attrStyles.iconWrap}>
        <Feather name={icon as any} size={16} color={Colors.secondary} />
      </View>
      <Text style={attrStyles.label}>{label}</Text>
      <Text style={attrStyles.value}>{value}</Text>
    </View>
  );
}

const attrStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  iconWrap: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(212,175,55,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  label: { fontFamily: 'Lato_400Regular', fontSize: FontSizes.bodyMd, color: Colors.textSecondary, marginLeft: Spacing.md, width: 80 },
  value: { fontFamily: 'Lato_700Bold', fontSize: FontSizes.bodyMd, color: Colors.textPrimary, flex: 1, textAlign: 'right' },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.screenPadding, paddingVertical: Spacing.sm,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  deleteBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  heroImage: {
    width: '100%', height: 400, backgroundColor: Colors.surfaceHighlight,
  },
  placeholder: { justifyContent: 'center', alignItems: 'center' },
  infoCard: {
    backgroundColor: Colors.surface, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg,
    marginTop: -24, padding: Spacing.screenPadding, paddingBottom: 100,
    borderWidth: 0.5, borderColor: Colors.border, borderBottomWidth: 0,
  },
  itemName: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: FontSizes.h1, color: Colors.textPrimary },
  attrSection: { marginTop: Spacing.lg },
  predictBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.secondary, borderRadius: Radius.full, paddingVertical: 16,
    marginTop: Spacing.xl, ...Shadows.glow,
  },
  predictBtnText: { fontFamily: 'Lato_700Bold', fontSize: FontSizes.bodyLg, color: Colors.onPrimary, marginLeft: Spacing.sm },
});
