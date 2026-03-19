import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useAuth } from '../../contexts/AuthContext';
import { apiCall } from '../../utils/api';
import { Colors, Spacing, FontSizes, Radius } from '../../constants/theme';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleAuth = async () => {
    if (!email || !password || (isRegister && !name)) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }
    setLoading(true);
    try {
      const endpoint = isRegister ? '/auth/register' : '/auth/login';
      const body = isRegister ? { name, email, password } : { email, password };
      const data = await apiCall(endpoint, { method: 'POST', body: JSON.stringify(body) });
      await login(data.token, data.user);
      if (!data.user.profile_complete) {
        router.replace('/profile-setup');
      } else {
        router.replace('/(tabs)/wardrobe');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
      const redirectUri = Linking.createURL('/');
      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUri)}`;
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
      if (result.type === 'success' && result.url) {
        const url = result.url;
        const hashIndex = url.indexOf('#');
        if (hashIndex !== -1) {
          const hash = url.substring(hashIndex + 1);
          const sessionIdMatch = hash.match(/session_id=([^&]+)/);
          if (sessionIdMatch) {
            const data = await apiCall('/auth/google', {
              method: 'POST',
              body: JSON.stringify({ session_id: sessionIdMatch[1] }),
            });
            await login(data.token, data.user);
            if (!data.user.profile_complete) {
              router.replace('/profile-setup');
            } else {
              router.replace('/(tabs)/wardrobe');
            }
          }
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Google login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.brand}>AI</Text>
            <Text style={styles.brandSub}>Fashion Designer</Text>
            <Text style={styles.tagline}>Your personal AI stylist</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{isRegister ? 'Create Account' : 'Welcome Back'}</Text>

            {isRegister && (
              <View style={styles.inputWrap}>
                <Feather name="user" size={18} color={Colors.textSecondary} />
                <TextInput
                  testID="register-name-input"
                  style={styles.input}
                  placeholder="Full Name"
                  placeholderTextColor={Colors.textTertiary}
                  value={name}
                  onChangeText={setName}
                />
              </View>
            )}

            <View style={styles.inputWrap}>
              <Feather name="mail" size={18} color={Colors.textSecondary} />
              <TextInput
                testID="login-email-input"
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={Colors.textTertiary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputWrap}>
              <Feather name="lock" size={18} color={Colors.textSecondary} />
              <TextInput
                testID="login-password-input"
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={Colors.textTertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity testID="toggle-password-btn" onPress={() => setShowPassword(!showPassword)}>
                <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              testID="auth-submit-btn"
              style={styles.primaryBtn}
              onPress={handleAuth}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={Colors.onPrimary} />
              ) : (
                <Text style={styles.primaryBtnText}>{isRegister ? 'Sign Up' : 'Sign In'}</Text>
              )}
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              testID="google-login-btn"
              style={styles.googleBtn}
              onPress={handleGoogleLogin}
              disabled={loading}
            >
              <Ionicons name="logo-google" size={20} color={Colors.textPrimary} />
              <Text style={styles.googleBtnText}>Continue with Google</Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="toggle-auth-mode-btn"
              style={styles.toggleBtn}
              onPress={() => setIsRegister(!isRegister)}
            >
              <Text style={styles.toggleText}>
                {isRegister ? 'Already have an account? ' : "Don't have an account? "}
                <Text style={styles.toggleHighlight}>{isRegister ? 'Sign In' : 'Sign Up'}</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: Spacing.screenPadding },
  header: { alignItems: 'center', marginBottom: Spacing.xl },
  brand: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: FontSizes.display,
    color: Colors.secondary,
    letterSpacing: 4,
  },
  brandSub: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: FontSizes.h2,
    color: Colors.textPrimary,
    marginTop: -4,
  },
  tagline: {
    fontFamily: 'Lato_400Regular',
    fontSize: FontSizes.bodyMd,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  cardTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: FontSizes.h2,
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 14 : 4,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontFamily: 'Lato_400Regular',
    fontSize: FontSizes.bodyLg,
    marginLeft: Spacing.sm,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  primaryBtnText: {
    color: Colors.onPrimary,
    fontFamily: 'Lato_700Bold',
    fontSize: FontSizes.bodyLg,
    letterSpacing: 1,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.lg,
  },
  dividerLine: { flex: 1, height: 0.5, backgroundColor: Colors.border },
  dividerText: {
    color: Colors.textTertiary,
    fontFamily: 'Lato_400Regular',
    fontSize: FontSizes.caption,
    marginHorizontal: Spacing.md,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    paddingVertical: 14,
  },
  googleBtnText: {
    color: Colors.textPrimary,
    fontFamily: 'Lato_700Bold',
    fontSize: FontSizes.bodyMd,
    marginLeft: Spacing.sm,
  },
  toggleBtn: { marginTop: Spacing.lg, alignItems: 'center' },
  toggleText: {
    color: Colors.textSecondary,
    fontFamily: 'Lato_400Regular',
    fontSize: FontSizes.bodyMd,
  },
  toggleHighlight: { color: Colors.secondary, fontFamily: 'Lato_700Bold' },
});
