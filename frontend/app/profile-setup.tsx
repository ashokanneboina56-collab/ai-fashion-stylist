import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Platform, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useAuth } from '../contexts/AuthContext';
import { apiCall } from '../utils/api';
import { Colors, Spacing, FontSizes, Radius, Shadows } from '../constants/theme';

const GENDERS = ['Male', 'Female', 'Non-Binary', 'Prefer not to say'];
const DRESS_PREFERENCES = ['Mens', 'Womens', 'Both'];
const AGE_RANGES = ['18-24', '25-34', '35-44', '45-54', '55+'];
const TOP_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
const BOTTOM_SIZES = ['26', '28', '30', '32', '34', '36', '38', '40', '42'];
const SHOE_SIZES = ['5', '6', '7', '8', '9', '10', '11', '12', '13'];

type StepKey = 'gender' | 'age' | 'dressPreference' | 'sizes';

const STEPS: { key: StepKey; title: string; subtitle: string; icon: string }[] = [
  { key: 'gender', title: 'Gender', subtitle: 'Help us personalize your experience', icon: 'users' },
  { key: 'age', title: 'Age Range', subtitle: 'For better style recommendations', icon: 'calendar' },
  { key: 'dressPreference', title: 'Style Preference', subtitle: 'What type of clothing do you prefer?', icon: 'heart' },
  { key: 'sizes', title: 'Your Sizes', subtitle: 'For accurate shopping suggestions', icon: 'maximize' },
];

export default function ProfileSetupScreen() {
  const { user, updateUser } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [gender, setGender] = useState<string | null>(user?.gender || null);
  const [age, setAge] = useState<string | null>(null);
  const [dressPreference, setDressPreference] = useState<string | null>(user?.dress_preference || null);
  const [topSize, setTopSize] = useState<string | null>(user?.top_size || null);
  const [bottomSize, setBottomSize] = useState<string | null>(user?.bottom_size || null);
  const [shoeSize, setShoeSize] = useState<string | null>(user?.shoe_size || null);

  const currentStep = STEPS[step];
  const isLastStep = step === STEPS.length - 1;
  const progress = (step + 1) / STEPS.length;

  const canProceed = () => {
    switch (currentStep.key) {
      case 'gender': return !!gender;
      case 'age': return !!age;
      case 'dressPreference': return !!dressPreference;
      case 'sizes': return !!topSize || !!bottomSize || !!shoeSize;
      default: return true;
    }
  };

  const handleNext = async () => {
    if (!canProceed()) {
      Alert.alert('Selection Required', 'Please make a selection to continue.');
      return;
    }
    if (isLastStep) {
      await handleSave();
    } else {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleSkip = () => {
    if (isLastStep) {
      handleSave();
    } else {
      setStep(step + 1);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const ageNum = age ? parseInt(age.split('-')[0]) : null;
      const profileData: Record<string, any> = {};
      if (gender) profileData.gender = gender;
      if (ageNum) profileData.age = ageNum;
      if (dressPreference) profileData.dress_preference = dressPreference;
      if (topSize) profileData.top_size = topSize;
      if (bottomSize) profileData.bottom_size = bottomSize;
      if (shoeSize) profileData.shoe_size = shoeSize;

      const updatedProfile = await apiCall('/profile/setup', {
        method: 'PUT',
        body: JSON.stringify(profileData),
      });

      if (user) {
        await updateUser({
          ...user,
          profile_complete: true,
          gender: updatedProfile.gender,
          dress_preference: updatedProfile.dress_preference,
          top_size: updatedProfile.top_size,
          bottom_size: updatedProfile.bottom_size,
          shoe_size: updatedProfile.shoe_size,
        });
      }
      router.replace('/(tabs)/wardrobe');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const renderChip = (label: string, isSelected: boolean, onPress: () => void) => (
    <TouchableOpacity
      key={label}
      style={[styles.chip, isSelected && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {isSelected && <Feather name="check" size={14} color={Colors.onPrimary} style={{ marginRight: 6 }} />}
      <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  const renderStepContent = () => {
    switch (currentStep.key) {
      case 'gender':
        return (
          <Animated.View entering={FadeInUp.duration(400)} style={styles.optionsWrap}>
            {GENDERS.map((g) => renderChip(g, gender === g, () => setGender(g)))}
          </Animated.View>
        );
      case 'age':
        return (
          <Animated.View entering={FadeInUp.duration(400)} style={styles.optionsWrap}>
            {AGE_RANGES.map((a) => renderChip(a, age === a, () => setAge(a)))}
          </Animated.View>
        );
      case 'dressPreference':
        return (
          <Animated.View entering={FadeInUp.duration(400)} style={styles.optionsWrap}>
            {DRESS_PREFERENCES.map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.prefCard, dressPreference === d && styles.prefCardActive]}
                onPress={() => setDressPreference(d)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons
                  name={d === 'Mens' ? 'human-male' : d === 'Womens' ? 'human-female' : 'human-male-female'}
                  size={32}
                  color={dressPreference === d ? Colors.secondary : Colors.textSecondary}
                />
                <Text style={[styles.prefCardText, dressPreference === d && styles.prefCardTextActive]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </Animated.View>
        );
      case 'sizes':
        return (
          <Animated.View entering={FadeInUp.duration(400)}>
            <Text style={styles.sizeLabel}>Top Size</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sizeRow}>
              {TOP_SIZES.map((s) => (
                <TouchableOpacity
                  key={`top-${s}`}
                  style={[styles.sizeChip, topSize === s && styles.sizeChipActive]}
                  onPress={() => setTopSize(s)}
                >
                  <Text style={[styles.sizeChipText, topSize === s && styles.sizeChipTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.sizeLabel}>Bottom Size (Waist)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sizeRow}>
              {BOTTOM_SIZES.map((s) => (
                <TouchableOpacity
                  key={`bottom-${s}`}
                  style={[styles.sizeChip, bottomSize === s && styles.sizeChipActive]}
                  onPress={() => setBottomSize(s)}
                >
                  <Text style={[styles.sizeChipText, bottomSize === s && styles.sizeChipTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.sizeLabel}>Shoe Size (US)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sizeRow}>
              {SHOE_SIZES.map((s) => (
                <TouchableOpacity
                  key={`shoe-${s}`}
                  style={[styles.sizeChip, shoeSize === s && styles.sizeChipActive]}
                  onPress={() => setShoeSize(s)}
                >
                  <Text style={[styles.sizeChipText, shoeSize === s && styles.sizeChipTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.topBar}>
          {step > 0 ? (
            <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
              <Feather name="arrow-left" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 44 }} />
          )}
          <TouchableOpacity onPress={handleSkip}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        {/* Progress bar */}
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.stepHeader}>
            <View style={styles.stepIconWrap}>
              <Feather name={currentStep.icon as any} size={28} color={Colors.secondary} />
            </View>
            <Text style={styles.stepTitle}>{currentStep.title}</Text>
            <Text style={styles.stepSubtitle}>{currentStep.subtitle}</Text>
            <Text style={styles.stepCount}>Step {step + 1} of {STEPS.length}</Text>
          </View>

          {renderStepContent()}
        </ScrollView>

        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.nextBtn, !canProceed() && styles.nextBtnDisabled]}
            onPress={handleNext}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color={Colors.onPrimary} />
            ) : (
              <>
                <Text style={styles.nextBtnText}>{isLastStep ? 'Complete Setup' : 'Continue'}</Text>
                {!isLastStep && <Feather name="arrow-right" size={18} color={Colors.onPrimary} />}
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.screenPadding, paddingVertical: Spacing.sm,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  skipText: { fontFamily: 'Lato_400Regular', fontSize: FontSizes.bodyMd, color: Colors.textSecondary },
  progressBar: {
    height: 3, backgroundColor: Colors.surfaceHighlight,
    marginHorizontal: Spacing.screenPadding, borderRadius: 2,
  },
  progressFill: {
    height: 3, backgroundColor: Colors.secondary, borderRadius: 2,
  },
  content: {
    paddingHorizontal: Spacing.screenPadding, paddingTop: Spacing.xl,
    paddingBottom: 120,
  },
  stepHeader: { alignItems: 'center', marginBottom: Spacing.xl },
  stepIconWrap: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(212,175,55,0.12)',
    justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md,
  },
  stepTitle: {
    fontFamily: 'PlayfairDisplay_700Bold', fontSize: FontSizes.h1,
    color: Colors.textPrimary, textAlign: 'center',
  },
  stepSubtitle: {
    fontFamily: 'Lato_400Regular', fontSize: FontSizes.bodyMd,
    color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.sm,
  },
  stepCount: {
    fontFamily: 'Lato_400Regular', fontSize: FontSizes.caption,
    color: Colors.textTertiary, marginTop: Spacing.sm,
  },
  optionsWrap: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.sm,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderRadius: Radius.full, backgroundColor: Colors.surface,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.secondary, borderColor: Colors.secondary,
  },
  chipText: {
    fontFamily: 'Lato_700Bold', fontSize: FontSizes.bodyLg, color: Colors.textSecondary,
  },
  chipTextActive: { color: Colors.onPrimary },
  prefCard: {
    flex: 1, minWidth: 100, alignItems: 'center', padding: Spacing.lg,
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  prefCardActive: { borderColor: Colors.secondary, backgroundColor: 'rgba(212,175,55,0.08)' },
  prefCardText: {
    fontFamily: 'Lato_700Bold', fontSize: FontSizes.bodyLg, color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },
  prefCardTextActive: { color: Colors.secondary },
  sizeLabel: {
    fontFamily: 'Lato_700Bold', fontSize: FontSizes.bodyLg, color: Colors.textPrimary,
    marginTop: Spacing.lg, marginBottom: Spacing.sm,
  },
  sizeRow: { marginBottom: Spacing.sm },
  sizeChip: {
    width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border, marginRight: Spacing.sm,
  },
  sizeChipActive: { backgroundColor: Colors.secondary, borderColor: Colors.secondary },
  sizeChipText: { fontFamily: 'Lato_700Bold', fontSize: FontSizes.bodyMd, color: Colors.textSecondary },
  sizeChipTextActive: { color: Colors.onPrimary },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: Spacing.screenPadding, paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    paddingTop: Spacing.md, backgroundColor: Colors.background,
    borderTopWidth: 0.5, borderTopColor: Colors.border,
  },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.secondary, borderRadius: Radius.full,
    paddingVertical: 16, gap: 8, ...Shadows.glow,
  },
  nextBtnDisabled: { opacity: 0.5 },
  nextBtnText: { fontFamily: 'Lato_700Bold', fontSize: FontSizes.bodyLg, color: Colors.onPrimary },
});
