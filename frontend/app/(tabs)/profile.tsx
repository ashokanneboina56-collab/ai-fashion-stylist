import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Image, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useAuth } from '../../contexts/AuthContext';
import { apiCall } from '../../utils/api';
import { Colors, Spacing, FontSizes, Radius, Shadows } from '../../constants/theme';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [outfitHistory, setOutfitHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  
  const [savedOutfits, setSavedOutfits] = useState<any[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  const fetchHistory = async () => {
    if (showHistory) { setShowHistory(false); return; }
    setShowHistory(true);
    setShowSaved(false);
    setLoadingHistory(true);
    try {
      const data = await apiCall('/outfit/history');
      setOutfitHistory(data.history || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchSavedOutfits = async () => {
    if (showSaved) { setShowSaved(false); return; }
    setShowSaved(true);
    setShowHistory(false);
    setLoadingSaved(true);
    try {
      const data = await apiCall('/outfit/saved');
      setSavedOutfits(data.outfits || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSaved(false);
    }
  };

  const handleLogout = async () => {
    // In web, Alert.alert can be problematic sometimes, so we can use a simpler approach
    // but standard React Native Alert.alert is usually fine with shim
    const confirmLogout = () => {
      Alert.alert('Logout', 'Are you sure you want to log out?', [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive', 
          onPress: async () => { 
            try {
              // Call API first while we still have the token
              await apiCall('/auth/logout', { method: 'POST' });
            } catch (e) {
              console.error('Logout API failed:', e);
            } finally {
              // Always clear local state and redirect
              await logout(); 
              // Using replace to root to trigger index.tsx logic or just go to login
              router.replace('/(auth)/login'); 
            }
          } 
        },
      ]);
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to log out?')) {
        try {
          await apiCall('/auth/logout', { method: 'POST' });
        } catch (e) {
          console.error('Logout API failed:', e);
        } finally {
          await logout(); 
          router.replace('/(auth)/login'); 
        }
      }
    } else {
      confirmLogout();
    }
  };

  const profileInfoItems = [
    { label: 'Gender', value: user?.gender, icon: 'user' },
    { label: 'Preference', value: user?.dress_preference, icon: 'heart' },
    { label: 'Top Size', value: user?.top_size, icon: 'maximize' },
    { label: 'Bottom Size', value: user?.bottom_size, icon: 'maximize' },
    { label: 'Shoe Size', value: user?.shoe_size, icon: 'maximize' },
  ].filter(item => item.value);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        <Animated.View entering={FadeInUp} style={styles.profileCard}>
          <View style={styles.avatar}>
            {user?.profile_image ? (
              <Image source={{ uri: user.profile_image }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{user?.name?.charAt(0)?.toUpperCase() || 'U'}</Text>
            )}
          </View>
          <Text style={styles.userName}>{user?.name || 'User'}</Text>
          <Text style={styles.userEmail}>{user?.email || ''}</Text>
          {profileInfoItems.length > 0 && (
            <View style={styles.profileInfoRow}>
              {profileInfoItems.map((item, idx) => (
                <View key={idx} style={styles.profileInfoChip}>
                  <Text style={styles.profileInfoChipText}>{item.value}</Text>
                </View>
              ))}
            </View>
          )}
        </Animated.View>

        <View style={styles.menuSection}>
          {/* AI Recommendations - goes to full screen */}
          <TouchableOpacity testID="recommendations-btn" style={styles.menuItem} onPress={() => router.push('/recommendations')}>
            <View style={styles.menuIcon}>
              <Ionicons name="sparkles" size={20} color={Colors.secondary} />
            </View>
            <View style={styles.menuTextWrap}>
              <Text style={styles.menuText}>AI Recommendations</Text>
              <Text style={styles.menuSubtext}>Personalized shopping picks</Text>
            </View>
            <Feather name="chevron-right" size={20} color={Colors.textTertiary} />
          </TouchableOpacity>

          {/* Edit Profile */}
          <TouchableOpacity testID="edit-profile-btn" style={styles.menuItem} onPress={() => router.push('/profile-setup')}>
            <View style={styles.menuIcon}>
              <Feather name="edit-3" size={20} color={Colors.secondary} />
            </View>
            <View style={styles.menuTextWrap}>
              <Text style={styles.menuText}>Edit Profile</Text>
              <Text style={styles.menuSubtext}>Update sizes & preferences</Text>
            </View>
            <Feather name="chevron-right" size={20} color={Colors.textTertiary} />
          </TouchableOpacity>

          {/* Outfit History */}
          <TouchableOpacity testID="outfit-history-btn" style={styles.menuItem} onPress={fetchHistory}>
            <View style={styles.menuIcon}>
              <MaterialCommunityIcons name="history" size={20} color={Colors.secondary} />
            </View>
            <View style={styles.menuTextWrap}>
              <Text style={styles.menuText}>Outfit History</Text>
              <Text style={styles.menuSubtext}>Previously worn outfits</Text>
            </View>
            <Feather name={showHistory ? 'chevron-up' : 'chevron-right'} size={20} color={Colors.textTertiary} />
          </TouchableOpacity>

          {showHistory && (
            <View style={styles.expandedSection}>
              {loadingHistory ? (
                <ActivityIndicator size="small" color={Colors.secondary} style={{ padding: Spacing.lg }} />
              ) : outfitHistory.length === 0 ? (
                <Text style={styles.emptyText}>No outfit history yet. Start wearing outfits to track here!</Text>
              ) : (
                outfitHistory.map((h, index) => (
                  <Animated.View key={h.history_id || index} entering={FadeInUp.delay(index * 100)} style={styles.historyCard}>
                    <View style={styles.historyDate}>
                      <Feather name="calendar" size={14} color={Colors.textTertiary} />
                      <Text style={styles.historyDateText}>
                        {new Date(h.worn_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Text>
                    </View>
                    <View style={styles.historyItems}>
                      {h.top && <Text style={styles.historyItem}>Top: {h.top.name}</Text>}
                      {h.bottom && <Text style={styles.historyItem}>Bottom: {h.bottom.name}</Text>}
                      {h.shoes && <Text style={styles.historyItem}>Shoes: {h.shoes.name}</Text>}
                      {h.accessory && <Text style={styles.historyItem}>Accessory: {h.accessory.name}</Text>}
                    </View>
                    {h.compatibility_score && (
                      <Text style={styles.historyScore}>Match: {h.compatibility_score}%</Text>
                    )}
                  </Animated.View>
                ))
              )}
            </View>
          )}

          <TouchableOpacity testID="saved-outfits-btn" style={styles.menuItem} onPress={fetchSavedOutfits}>
            <View style={styles.menuIcon}>
              <Feather name="bookmark" size={20} color={Colors.secondary} />
            </View>
            <View style={styles.menuTextWrap}>
              <Text style={styles.menuText}>Saved Outfits</Text>
              <Text style={styles.menuSubtext}>Your saved outfit combos</Text>
            </View>
            <Feather name={showSaved ? 'chevron-up' : 'chevron-right'} size={20} color={Colors.textTertiary} />
          </TouchableOpacity>

          {showSaved && (
            <View style={styles.expandedSection}>
              {loadingSaved ? (
                <ActivityIndicator size="small" color={Colors.secondary} style={{ padding: Spacing.lg }} />
              ) : savedOutfits.length === 0 ? (
                <Text style={styles.emptyText}>No saved outfits yet. Save your favorite combos from the Stylist tab!</Text>
              ) : (
                savedOutfits.map((o, index) => (
                  <Animated.View key={o.outfit_id || index} entering={FadeInUp.delay(index * 100)} style={styles.historyCard}>
                    <View style={styles.historyItems}>
                      {o.top && <Text style={styles.historyItem}>Top: {o.top.name}</Text>}
                      {o.bottom && <Text style={styles.historyItem}>Bottom: {o.bottom.name}</Text>}
                      {o.shoes && <Text style={styles.historyItem}>Shoes: {o.shoes.name}</Text>}
                      {o.accessory && <Text style={styles.historyItem}>Accessory: {o.accessory.name}</Text>}
                    </View>
                    {o.compatibility_score && (
                      <Text style={styles.historyScore}>Match: {o.compatibility_score}%</Text>
                    )}
                  </Animated.View>
                ))
              )}
            </View>
          )}
        </View>

        <TouchableOpacity testID="logout-btn" style={styles.logoutBtn} onPress={handleLogout}>
          <Feather name="log-out" size={18} color={Colors.error} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.screenPadding, paddingTop: Spacing.md },
  headerTitle: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: FontSizes.h1, color: Colors.textPrimary },
  profileCard: {
    alignItems: 'center', marginTop: Spacing.lg, marginHorizontal: Spacing.screenPadding,
    backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.xl,
    borderWidth: 0.5, borderColor: Colors.border,
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.secondary,
    justifyContent: 'center', alignItems: 'center', ...Shadows.glow,
  },
  avatarImage: { width: 80, height: 80, borderRadius: 40 },
  avatarText: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: FontSizes.h1, color: Colors.onPrimary },
  userName: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: FontSizes.h2, color: Colors.textPrimary, marginTop: Spacing.md },
  userEmail: { fontFamily: 'Lato_400Regular', fontSize: FontSizes.bodyMd, color: Colors.textSecondary, marginTop: 4 },
  profileInfoRow: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
    gap: Spacing.xs, marginTop: Spacing.md,
  },
  profileInfoChip: {
    paddingHorizontal: Spacing.sm, paddingVertical: 3,
    backgroundColor: 'rgba(212,175,55,0.12)', borderRadius: Radius.full,
  },
  profileInfoChipText: { fontFamily: 'Lato_700Bold', fontSize: FontSizes.tiny, color: Colors.secondary },
  menuSection: { marginTop: Spacing.lg, marginHorizontal: Spacing.screenPadding },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 0.5, borderColor: Colors.border,
  },
  menuIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(212,175,55,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  menuTextWrap: { flex: 1, marginLeft: Spacing.md },
  menuText: { fontFamily: 'Lato_700Bold', fontSize: FontSizes.bodyLg, color: Colors.textPrimary },
  menuSubtext: { fontFamily: 'Lato_400Regular', fontSize: FontSizes.caption, color: Colors.textTertiary, marginTop: 1 },
  expandedSection: { marginBottom: Spacing.sm, paddingHorizontal: Spacing.xs },
  emptyText: {
    fontFamily: 'Lato_400Regular', fontSize: FontSizes.bodyMd, color: Colors.textTertiary,
    textAlign: 'center', padding: Spacing.lg,
  },
  historyCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md,
    marginBottom: Spacing.sm, borderWidth: 0.5, borderColor: Colors.border,
  },
  historyDate: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  historyDateText: { fontFamily: 'Lato_400Regular', fontSize: FontSizes.caption, color: Colors.textTertiary, marginLeft: 6 },
  historyItems: {},
  historyItem: { fontFamily: 'Lato_400Regular', fontSize: FontSizes.bodyMd, color: Colors.textSecondary, marginBottom: 2 },
  historyScore: { fontFamily: 'Lato_700Bold', fontSize: FontSizes.caption, color: Colors.secondary, marginTop: Spacing.sm },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginHorizontal: Spacing.screenPadding, marginTop: Spacing.xl,
    paddingVertical: Spacing.md, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.error,
  },
  logoutText: { fontFamily: 'Lato_700Bold', fontSize: FontSizes.bodyLg, color: Colors.error, marginLeft: Spacing.sm },
});
