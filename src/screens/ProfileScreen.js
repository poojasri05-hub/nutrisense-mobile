import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ScrollView, Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { getProfile, updateProfile } from '../services/api';
import COLORS from '../theme/colors';

const GOAL_OPTIONS = [1500, 1800, 2000, 2200, 2500, 3000];
const DIET_TYPES = [
  { id: 'balanced',    label: '⚖️ Balanced'    },
  { id: 'highprotein', label: '💪 High Protein' },
  { id: 'lowcarb',     label: '🥩 Low Carb'     },
  { id: 'vegetarian',  label: '🥗 Vegetarian'   },
  { id: 'vegan',       label: '🌱 Vegan'        },
];

export default function ProfileScreen() {
  const [name, setName]               = useState('');
  const [age, setAge]                 = useState('');
  const [weight, setWeight]           = useState('');
  const [height, setHeight]           = useState('');
  const [calorieGoal, setCalorieGoal] = useState(2000);
  const [dietType, setDietType]       = useState('balanced');
  const [editing, setEditing]         = useState(false);
  const [todayCalories, setTodayCalories] = useState(0);
  const [todayProtein, setTodayProtein]   = useState(0);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
      loadTodayStats();
    }, [])
  );

  const loadProfile = async () => {
    try {
      // Try backend first
      const profile = await getProfile();
      if (profile) {
        setName(profile.name || '');
        setAge(profile.age?.toString() || '');
        setWeight(profile.weight?.toString() || '');
        setHeight(profile.height?.toString() || '');
        setCalorieGoal(profile.calorie_goal || 2000);
        setDietType(profile.diet_type || 'balanced');
        return;
      }
    } catch (e) {
      console.log('Backend profile failed, using local');
    }
    // Fallback to local
    try {
      const saved = await AsyncStorage.getItem('user_profile');
      if (saved) {
        const p = JSON.parse(saved);
        setName(p.name || '');
        setAge(p.age || '');
        setWeight(p.weight || '');
        setHeight(p.height || '');
        setCalorieGoal(p.calorieGoal || 2000);
        setDietType(p.dietType || 'balanced');
      }
    } catch (e) {}
  };

  const loadTodayStats = async () => {
    try {
      const saved = await AsyncStorage.getItem('scan_history');
      if (saved) {
        const history = JSON.parse(saved);
        const today = new Date().toDateString();
        const todayItems = history.filter(h => new Date(h.date).toDateString() === today);
        setTodayCalories(todayItems.reduce((s, h) => s + (h.calories || 0), 0));
        setTodayProtein(todayItems.reduce((s, h) => s + (h.protein || 0), 0));
      }
    } catch (e) {}
  };

  const saveProfile = async () => {
    try {
      // Save to backend
      await updateProfile({
        name,
        age: parseInt(age) || null,
        weight: parseFloat(weight) || null,
        height: parseFloat(height) || null,
        calorie_goal: calorieGoal,
        diet_type: dietType,
      });
      // Also save locally as backup
      await AsyncStorage.setItem('user_profile', JSON.stringify({
        name, age, weight, height, calorieGoal, dietType
      }));
      setEditing(false);
      Alert.alert('✅ Saved', 'Profile updated successfully!');
    } catch (e) {
      // If backend fails, save locally
      try {
        await AsyncStorage.setItem('user_profile', JSON.stringify({
          name, age, weight, height, calorieGoal, dietType
        }));
        setEditing(false);
        Alert.alert('✅ Saved locally', 'Profile saved on device');
      } catch (err) {
        Alert.alert('Error', 'Could not save profile');
      }
    }
  };

  const calculateBMI = () => {
    const w = parseFloat(weight);
    const h = parseFloat(height) / 100;
    if (!w || !h) return null;
    const bmi = (w / (h * h)).toFixed(1);
    let category = '';
    if (bmi < 18.5)    category = 'Underweight';
    else if (bmi < 25) category = 'Normal ✅';
    else if (bmi < 30) category = 'Overweight';
    else               category = 'Obese';
    return { bmi, category };
  };

  const calculateBMR = () => {
    const w = parseFloat(weight);
    const h = parseFloat(height);
    const a = parseFloat(age);
    if (!w || !h || !a) return null;
    return Math.round(10 * w + 6.25 * h - 5 * a + 5);
  };

  const progressPercent = Math.min((todayCalories / calorieGoal) * 100, 100);
  const progressColor   = progressPercent > 90 ? '#FF6B6B' : progressPercent > 70 ? '#FFE66D' : COLORS.primary;
  const bmiData         = calculateBMI();
  const bmrData         = calculateBMR();

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{name ? name.charAt(0).toUpperCase() : '👤'}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{name || 'Your Name'}</Text>
          <Text style={styles.profileSub}>
            {DIET_TYPES.find(d => d.id === dietType)?.label || '⚖️ Balanced'} diet
          </Text>
        </View>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => editing ? saveProfile() : setEditing(true)}
        >
          <Text style={styles.editBtnText}>{editing ? 'Save' : 'Edit'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Today's Progress</Text>
        <View style={styles.progressRow}>
          <Text style={styles.progressCals}>{todayCalories}</Text>
          <Text style={styles.progressGoal}>/ {calorieGoal} kcal</Text>
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progressPercent}%`, backgroundColor: progressColor }]} />
        </View>
        <Text style={styles.progressLabel}>
          {progressPercent >= 100 ? '🎯 Goal reached!' : `${calorieGoal - todayCalories} kcal remaining`}
        </Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{todayCalories}</Text>
            <Text style={styles.statLabel}>Consumed</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{todayProtein}g</Text>
            <Text style={styles.statLabel}>Protein</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{calorieGoal}</Text>
            <Text style={styles.statLabel}>Goal</Text>
          </View>
        </View>
      </View>

      {editing && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Edit Profile</Text>
          <Text style={styles.inputLabel}>Name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={COLORS.textSecondary} />
          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Text style={styles.inputLabel}>Age</Text>
              <TextInput style={styles.input} value={age} onChangeText={setAge} placeholder="" keyboardType="numeric" placeholderTextColor={COLORS.textSecondary} />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.inputLabel}>Weight (kg)</Text>
              <TextInput style={styles.input} value={weight} onChangeText={setWeight} placeholder="" keyboardType="numeric" placeholderTextColor={COLORS.textSecondary} />
            </View>
          </View>
          <Text style={styles.inputLabel}>Height (cm)</Text>
          <TextInput style={styles.input} value={height} onChangeText={setHeight} placeholder="" keyboardType="numeric" placeholderTextColor={COLORS.textSecondary} />
          <Text style={styles.inputLabel}>Daily Calorie Goal</Text>
          <View style={styles.goalChips}>
            {GOAL_OPTIONS.map(g => (
              <TouchableOpacity key={g} style={[styles.chip, calorieGoal === g && styles.chipActive]} onPress={() => setCalorieGoal(g)}>
                <Text style={[styles.chipText, calorieGoal === g && styles.chipTextActive]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.inputLabel}>Diet Type</Text>
          <View style={styles.dietChips}>
            {DIET_TYPES.map(d => (
              <TouchableOpacity key={d.id} style={[styles.chip, dietType === d.id && styles.chipActive]} onPress={() => setDietType(d.id)}>
                <Text style={[styles.chipText, dietType === d.id && styles.chipTextActive]}>{d.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {(bmiData || bmrData) && (
        <View style={styles.statsCards}>
          {bmiData && (
            <View style={styles.statsCard}>
              <Text style={styles.statsCardTitle}>BMI</Text>
              <Text style={styles.statsCardValue}>{bmiData.bmi}</Text>
              <Text style={styles.statsCardSub}>{bmiData.category}</Text>
            </View>
          )}
          {bmrData && (
            <View style={styles.statsCard}>
              <Text style={styles.statsCardTitle}>BMR</Text>
              <Text style={styles.statsCardValue}>{bmrData}</Text>
              <Text style={styles.statsCardSub}>kcal/day base</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>💡 Daily Tips</Text>
        {[
          '🥤 Drink 8 glasses of water today',
          '🚶 Take a 30 min walk after meals',
          '🥗 Fill half your plate with vegetables',
          '😴 Sleep 7–9 hours for better metabolism',
        ].map(tip => <Text key={tip} style={styles.tip}>{tip}</Text>)}
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: COLORS.background },
  profileHeader:   { flexDirection: 'row', alignItems: 'center', margin: 16, padding: 16, backgroundColor: COLORS.card, borderRadius: 16 },
  avatar:          { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  avatarText:      { fontSize: 24, color: '#fff', fontWeight: '700' },
  profileInfo:     { flex: 1, marginLeft: 12 },
  profileName:     { fontSize: 18, fontWeight: '700', color: COLORS.text },
  profileSub:      { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  editBtn:         { backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 16 },
  editBtnText:     { color: '#fff', fontWeight: '600', fontSize: 14 },
  card:            { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, margin: 16, marginTop: 0 },
  cardTitle:       { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  progressRow:     { flexDirection: 'row', alignItems: 'baseline', marginBottom: 8 },
  progressCals:    { fontSize: 36, fontWeight: '700', color: COLORS.text },
  progressGoal:    { fontSize: 16, color: COLORS.textSecondary, marginLeft: 6 },
  progressBarBg:   { height: 12, backgroundColor: '#f0f0f0', borderRadius: 6, marginBottom: 6 },
  progressBarFill: { height: 12, borderRadius: 6 },
  progressLabel:   { fontSize: 13, color: COLORS.textSecondary, marginBottom: 16 },
  statsRow:        { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 12, borderTopWidth: 0.5, borderTopColor: COLORS.border || '#eee' },
  statItem:        { alignItems: 'center' },
  statValue:       { fontSize: 18, fontWeight: '700', color: COLORS.text },
  statLabel:       { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  statDivider:     { width: 0.5, backgroundColor: COLORS.border || '#eee' },
  inputLabel:      { fontSize: 13, color: COLORS.textSecondary, marginBottom: 6, marginTop: 8 },
  input:           { backgroundColor: COLORS.background, borderRadius: 10, padding: 12, fontSize: 15, color: COLORS.text, borderWidth: 0.5, borderColor: COLORS.border || '#eee', marginBottom: 4 },
  row:             { flexDirection: 'row', gap: 12 },
  halfInput:       { flex: 1 },
  goalChips:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  dietChips:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:            { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, backgroundColor: COLORS.background, borderWidth: 0.5, borderColor: COLORS.border || '#eee' },
  chipActive:      { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText:        { fontSize: 13, color: COLORS.textSecondary },
  chipTextActive:  { color: '#fff', fontWeight: '600' },
  statsCards:      { flexDirection: 'row', gap: 12, marginHorizontal: 16, marginBottom: 16 },
  statsCard:       { flex: 1, backgroundColor: COLORS.card, borderRadius: 14, padding: 16, alignItems: 'center' },
  statsCardTitle:  { fontSize: 13, color: COLORS.textSecondary, marginBottom: 4 },
  statsCardValue:  { fontSize: 28, fontWeight: '700', color: COLORS.primary },
  statsCardSub:    { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  tip:             { fontSize: 14, color: COLORS.text, paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: COLORS.border || '#f0f0f0' },
});