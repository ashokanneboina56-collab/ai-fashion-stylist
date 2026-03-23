import { Stack, useRouter, useSegments } from 'expo-router';
import { useFonts, PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import { Lato_400Regular, Lato_700Bold } from '@expo-google-fonts/lato';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import React, { useEffect } from 'react';

function RootLayoutNav() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inProfileSetup = segments[0] === 'profile-setup';

    if (!user && !inAuthGroup) {
      // Redirect to login if not authenticated
      router.replace('/(auth)/login');
    } else if (user) {
      const isRoot = segments.length === 0 || segments[0] === 'index' || segments[0] === '';
      
      if (!user.profile_complete && !inProfileSetup) {
        // Redirect to profile setup if profile is incomplete
        router.replace('/profile-setup');
      } else if (inAuthGroup || isRoot) {
        // Redirect to main app if authenticated and in auth or root index
        router.replace('/(tabs)/wardrobe');
      }
    }
  }, [user, isLoading, segments[0], segments.length]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#D4AF37" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#050505' } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="add-clothing" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="clothing/[id]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="profile-setup" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="recommendations" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="saved-outfits" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="history" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontsError] = useFonts({
    PlayfairDisplay_700Bold,
    Lato_400Regular,
    Lato_700Bold,
  });

  useEffect(() => {
    if (fontsError) {
      console.error('Error loading fonts:', fontsError);
    }
  }, [fontsError]);

  if (!fontsLoaded && !fontsError) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#D4AF37" />
      </View>
    );
  }

  return (
    <AuthProvider>
      <StatusBar style="light" />
      <RootLayoutNav />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: '#050505',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
