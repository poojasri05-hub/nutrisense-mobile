import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, ScrollView,
  Alert, Image
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { recognizeFoodFromImage } from '../services/nutritionApi';
import { searchNutrition, saveScan } from '../services/api';
import { sendMealLoggedNotification } from '../services/notifications';
import { checkFoodAgainstDiet } from '../services/dietMonitor'; // ← NEW
import { supabase } from '../services/supabase';               // ← NEW
import AsyncStorage from '@react-native-async-storage/async-storage';
import COLORS from '../theme/colors';

export default function ScanScreen({ route }) {
  const [mode, setMode]         = useState('home');
  const [foodName, setFoodName] = useState('');
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);
  const [image, setImage]       = useState(null);
  const [dietWarning, setDietWarning] = useState(null); // ← NEW
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  // ── NEW: fetch user's diet type from profile ─────────────────────────────
  const getUserDietType = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return 'balanced';
      const { data } = await supabase
        .from('profiles')
        .select('diet_type')
        .eq('id', session.user.id)
        .single();
      return data?.diet_type || 'balanced';
    } catch (e) {
      return 'balanced';
    }
  };

  const saveToLocalHistory = async (foodName, nutrition) => {
    try {
      const saved = await AsyncStorage.getItem('scan_history');
      const history = saved ? JSON.parse(saved) : [];
      history.unshift({
        id: Date.now().toString(),
        foodName,
        date: new Date().toISOString(),
        ...nutrition,
      });
      await AsyncStorage.setItem('scan_history', JSON.stringify(history.slice(0, 100)));
    } catch (e) {}
  };

  // ── NEW: run diet check after every scan ─────────────────────────────────
  const runDietCheck = async (foodName, nutrition) => {
    const dietType = await getUserDietType();
    if (dietType && dietType !== 'balanced') {
      const warning = checkFoodAgainstDiet(foodName, nutrition, dietType);
      setDietWarning(warning);
    } else {
      setDietWarning(null);
    }
  };

  const analyzeText = async () => {
    if (!foodName.trim()) return Alert.alert('Enter a food name');
    setLoading(true);
    try {
      const nutrition = await searchNutrition(foodName.trim());
      await saveToLocalHistory(foodName.trim(), nutrition);
      await saveScan({ food_name: foodName.trim(), ...nutrition });
      await sendMealLoggedNotification(foodName.trim(), nutrition.calories);
      await runDietCheck(foodName.trim(), nutrition); // ← NEW
      setResult({ foodName: foodName.trim(), image: null, ...nutrition });
      setMode('result');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;
    setLoading(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.5 });
      await analyzeImage(photo.base64, photo.uri);
    } catch (e) {
      Alert.alert('Error', 'Could not take picture');
    } finally {
      setLoading(false);
    }
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission needed', 'Allow access to your gallery');
    const picked = await ImagePicker.launchImageLibraryAsync({
      base64: true, quality: 0.5, mediaTypes: ['images'],
    });
    if (!picked.canceled) {
      setLoading(true);
      await analyzeImage(picked.assets[0].base64, picked.assets[0].uri);
      setLoading(false);
    }
  };

  const analyzeImage = async (base64, uri) => {
    try {
      setImage(uri);
      setMode('loading');
      const foods = await recognizeFoodFromImage(base64);
      const topFood = foods[0].name;
      const nutrition = await searchNutrition(topFood);
      await saveToLocalHistory(topFood, nutrition);
      await saveScan({ food_name: topFood, ...nutrition });
      await sendMealLoggedNotification(topFood, nutrition.calories);
      await runDietCheck(topFood, nutrition); // ← NEW
      setResult({
        foodName:     topFood,
        confidence:   foods[0].confidence,
        alternatives: foods.slice(1, 3),
        image:        uri,
        ...nutrition,
      });
      setMode('result');
    } catch (e) {
      if (e.message === 'NOT_FOOD') {
        Alert.alert(
          '🚫 No food detected',
          "This doesn't look like food! Please scan a food item.",
          [
            { text: 'Try Again',      onPress: () => setMode('camera') },
            { text: 'Search by Name', onPress: () => setMode('text') },
          ]
        );
      } else {
        Alert.alert('Could not recognize food', 'Try searching by name instead',
          [{ text: 'OK', onPress: () => setMode('home') }]
        );
      }
      setMode('home');
    }
  };

  if (mode === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Analyzing food...</Text>
        <Text style={styles.loadingSubText}>This may take a few seconds</Text>
      </View>
    );
  }

  if (mode === 'result' && result) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.resultContainer}>
        {result.image && <Image source={{ uri: result.image }} style={styles.foodImage} />}
        <View style={styles.resultHeader}>
          <Text style={styles.foodName}>{result.foodName}</Text>
          {result.confidence && (
            <View style={styles.confidenceBadge}>
              <Text style={styles.confidenceText}>{result.confidence}% match</Text>
            </View>
          )}
        </View>

        {/* ── NEW: Diet Warning Banner ───────────────────────────────── */}
        {dietWarning && (
          <View style={[
            styles.dietBanner,
            dietWarning.level === 'error'   && styles.dietBannerError,
            dietWarning.level === 'warning' && styles.dietBannerWarning,
            dietWarning.level === 'success' && styles.dietBannerSuccess,
          ]}>
            <Text style={styles.dietBannerTitle}>{dietWarning.title}</Text>
            <Text style={styles.dietBannerMsg}>{dietWarning.message}</Text>
            {dietWarning.tip && (
              <Text style={styles.dietBannerTip}>💡 {dietWarning.tip}</Text>
            )}
          </View>
        )}
        {/* ─────────────────────────────────────────────────────────── */}

        <Text style={styles.perServing}>per 100g serving</Text>
        <View style={styles.macroGrid}>
          {[
            { label: 'Calories', value: result.calories, unit: 'kcal', color: '#FF6B6B' },
            { label: 'Protein',  value: result.protein,  unit: 'g',    color: '#4ECDC4' },
            { label: 'Carbs',    value: result.carbs,    unit: 'g',    color: '#FFE66D' },
            { label: 'Fat',      value: result.fat,      unit: 'g',    color: '#A8E6CF' },
            { label: 'Fiber',    value: result.fiber,    unit: 'g',    color: '#C3B1E1' },
          ].map(macro => (
            <View key={macro.label} style={[styles.macroCard, { borderTopColor: macro.color }]}>
              <Text style={styles.macroValue}>{macro.value}</Text>
              <Text style={styles.macroUnit}>{macro.unit}</Text>
              <Text style={styles.macroLabel}>{macro.label}</Text>
            </View>
          ))}
        </View>
        {result.alternatives?.length > 0 && (
          <View style={styles.altCard}>
            <Text style={styles.altTitle}>Could also be:</Text>
            {result.alternatives.map((alt, i) => (
              <TouchableOpacity
                key={i}
                style={styles.altRow}
                onPress={async () => {
                  setLoading(true);
                  const n = await searchNutrition(alt.name);
                  await runDietCheck(alt.name, n); // ← NEW
                  setResult({ ...result, foodName: alt.name, ...n });
                  setLoading(false);
                }}
              >
                <Text style={styles.altName}>• {alt.name}</Text>
                <Text style={styles.altConfidence}>{alt.confidence}%</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        <TouchableOpacity
          style={styles.btn}
          onPress={() => {
            setResult(null); setImage(null);
            setFoodName(''); setDietWarning(null); // ← NEW: reset warning
            setMode('home');
          }}
        >
          <Text style={styles.btnText}>Scan Another</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (mode === 'camera') {
    if (!permission?.granted) {
      return (
        <View style={styles.center}>
          <Text style={styles.permText}>Camera permission needed</Text>
          <TouchableOpacity style={styles.btn} onPress={requestPermission}>
            <Text style={styles.btnText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.container}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back" />
        <View style={styles.cameraOverlay}>
          <View style={styles.scanFrame} />
          <Text style={styles.scanHint}>Point at food and tap capture</Text>
        </View>
        <View style={styles.cameraControls}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setMode('home')}>
            <Text style={styles.cancelText}>✕</Text>
          </TouchableOpacity>
          {loading ? (
            <ActivityIndicator size="large" color="#fff" />
          ) : (
            <TouchableOpacity style={styles.captureBtn} onPress={takePicture}>
              <View style={styles.captureBtnInner} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.galleryBtn} onPress={pickFromGallery}>
            <Text style={styles.galleryText}>🖼️</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (mode === 'text') {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Search Food</Text>
        <Text style={styles.subtitle}>Type any food name to get nutrition info</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. apple, chicken breast, rice..."
          placeholderTextColor={COLORS.textSecondary}
          value={foodName}
          onChangeText={setFoodName}
          onSubmitEditing={analyzeText}
          returnKeyType="search"
          autoCapitalize="none"
          autoFocus
        />
        <TouchableOpacity style={styles.btn} onPress={analyzeText} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Get Nutrition Info</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.backBtn} onPress={() => setMode('home')}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.center}>
      <Text style={styles.title}>🥗 Food Scanner</Text>
      <Text style={styles.subtitle}>Choose how to scan your food</Text>
      <TouchableOpacity
        style={styles.modeCard}
        onPress={async () => {
          if (!permission?.granted) await requestPermission();
          setMode('camera');
        }}
      >
        <Text style={styles.modeIcon}>📸</Text>
        <View style={styles.modeInfo}>
          <Text style={styles.modeTitle}>Scan with Camera</Text>
          <Text style={styles.modeSub}>Point at food for instant AI recognition</Text>
        </View>
        <Text style={styles.modeArrow}>→</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.modeCard} onPress={pickFromGallery}>
        <Text style={styles.modeIcon}>🖼️</Text>
        <View style={styles.modeInfo}>
          <Text style={styles.modeTitle}>Pick from Gallery</Text>
          <Text style={styles.modeSub}>Choose an existing food photo</Text>
        </View>
        <Text style={styles.modeArrow}>→</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.modeCard} onPress={() => setMode('text')}>
        <Text style={styles.modeIcon}>⌨️</Text>
        <View style={styles.modeInfo}>
          <Text style={styles.modeTitle}>Search by Name</Text>
          <Text style={styles.modeSub}>Type the food name manually</Text>
        </View>
        <Text style={styles.modeArrow}>→</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: COLORS.background },
  center:           { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: COLORS.background },
  resultContainer:  { padding: 24, backgroundColor: COLORS.background },
  title:            { fontSize: 26, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
  subtitle:         { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 32 },
  loadingText:      { fontSize: 18, fontWeight: '600', color: COLORS.text, marginTop: 16 },
  loadingSubText:   { fontSize: 14, color: COLORS.textSecondary, marginTop: 8 },
  permText:         { fontSize: 16, color: COLORS.text, marginBottom: 20, textAlign: 'center' },
  modeCard:         { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 12, width: '100%', borderWidth: 0.5, borderColor: COLORS.border },
  modeIcon:         { fontSize: 32, marginRight: 14 },
  modeInfo:         { flex: 1 },
  modeTitle:        { fontSize: 16, fontWeight: '700', color: COLORS.text },
  modeSub:          { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  modeArrow:        { fontSize: 18, color: COLORS.textSecondary },
  camera:           { flex: 1 },
  cameraOverlay:    { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  scanFrame:        { width: 250, height: 250, borderRadius: 20, borderWidth: 2, borderColor: COLORS.primary, backgroundColor: 'transparent' },
  scanHint:         { color: '#fff', fontSize: 14, marginTop: 16, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  cameraControls:   { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingBottom: 40, paddingHorizontal: 32 },
  cancelBtn:        { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  cancelText:       { color: '#fff', fontSize: 18, fontWeight: '700' },
  captureBtn:       { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#fff' },
  captureBtnInner:  { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' },
  galleryBtn:       { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  galleryText:      { fontSize: 22 },
  foodImage:        { width: '100%', height: 200, borderRadius: 16, marginBottom: 16 },
  resultHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  foodName:         { fontSize: 26, fontWeight: '800', color: COLORS.text, textTransform: 'capitalize', flex: 1 },
  confidenceBadge:  { backgroundColor: COLORS.primary + '20', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  confidenceText:   { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  perServing:       { fontSize: 13, color: COLORS.textSecondary, marginBottom: 20 },
  macroGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  macroCard:        { flex: 1, minWidth: '44%', backgroundColor: COLORS.card, borderRadius: 14, padding: 16, borderTopWidth: 3, alignItems: 'center' },
  macroValue:       { fontSize: 28, fontWeight: '700', color: COLORS.text },
  macroUnit:        { fontSize: 12, color: COLORS.textSecondary },
  macroLabel:       { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  altCard:          { backgroundColor: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 20 },
  altTitle:         { fontSize: 13, color: COLORS.textSecondary, marginBottom: 10 },
  altRow:           { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  altName:          { fontSize: 15, color: COLORS.text },
  altConfidence:    { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  btn:              { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 15, width: '100%', alignItems: 'center', marginBottom: 12 },
  btnText:          { color: '#fff', fontWeight: '700', fontSize: 16 },
  backBtn:          { marginTop: 8 },
  backText:         { color: COLORS.textSecondary, fontSize: 15 },
  input:            { width: '100%', borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: 14, padding: 14, fontSize: 16, color: COLORS.text, marginBottom: 16, backgroundColor: COLORS.card },

  // ── NEW: Diet banner styles ──────────────────────────────────────────────
  dietBanner:        { borderRadius: 14, padding: 14, marginBottom: 16, borderLeftWidth: 4 },
  dietBannerError:   { backgroundColor: '#FF6B6B20', borderLeftColor: '#FF6B6B' },
  dietBannerWarning: { backgroundColor: '#FFE66D20', borderLeftColor: '#FFE66D' },
  dietBannerSuccess: { backgroundColor: '#4CAF5020', borderLeftColor: '#4CAF50' },
  dietBannerTitle:   { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  dietBannerMsg:     { fontSize: 13, color: COLORS.text, lineHeight: 20 },
  dietBannerTip:     { fontSize: 12, color: COLORS.textSecondary, marginTop: 8, fontStyle: 'italic' },
});