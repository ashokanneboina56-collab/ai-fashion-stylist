import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, Image, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useAuth } from '../../contexts/AuthContext';
import { apiCall } from '../../utils/api';
import { Colors, Spacing, FontSizes, Radius, Shadows } from '../../constants/theme';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

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
          <TouchableOpacity testID="outfit-history-btn" style={styles.menuItem} onPress={() => router.push('/history')}>
            <View style={styles.menuIcon}>
              <MaterialCommunityIcons name="history" size={20} color={Colors.secondary} />
            </View>
            <View style={styles.menuTextWrap}>
              <Text style={styles.menuText}>Outfit History</Text>
              <Text style={styles.menuSubtext}>Previously worn outfits</Text>
            </View>
            <Feather name="chevron-right" size={20} color={Colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity testID="saved-outfits-btn" style={styles.menuItem} onPress={() => router.push('/saved-outfits')}>
            <View style={styles.menuIcon}>
              <Feather name="bookmark" size={20} color={Colors.secondary} />
            </View>
            <View style={styles.menuTextWrap}>
              <Text style={styles.menuText}>Saved Outfits</Text>
              <Text style={styles.menuSubtext}>Your saved outfit combos</Text>
            </View>
            <Feather name="chevron-right" size={20} color={Colors.textTertiary} />
          </TouchableOpacity>
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
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginHorizontal: Spacing.screenPadding, marginTop: Spacing.xl,
    paddingVertical: Spacing.md, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.error,
  },
  logoutText: { fontFamily: 'Lato_700Bold', fontSize: FontSizes.bodyLg, color: Colors.error, marginLeft: Spacing.sm },
});
