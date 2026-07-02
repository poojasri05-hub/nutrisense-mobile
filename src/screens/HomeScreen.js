import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Dimensions
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import COLORS from '../theme/colors';

const SCREEN_WIDTH = Dimensions.get('window').width;

const TIPS = [
  { icon: '💧', tip: 'Drink 8 glasses of water today' },
  { icon: '🥦', tip: 'Eat 5 servings of vegetables' },
  { icon: '🏃', tip: '30 min walk burns ~150 calories' },
  { icon: '😴', tip: 'Sleep 7–9 hrs for better metabolism' },
  { icon: '🥚', tip: 'Eggs are a complete protein source' },
  { icon: '🍌', tip: 'Banana is great pre-workout fuel' },
];

export default function HomeScreen({ route, navigation }) {
  const [profile, setProfile]         = useState(null);
  const [todayStats, setTodayStats]   = useState({ calories: 0, protein: 0, carbs: 0, fat: 0, scans: 0 });
  const [recentScans, setRecentScans] = useState([]);
  const [tip] = useState(TIPS[Math.floor(Math.random() * TIPS.length)]);

  useFocusEffect(
    useCallback(() => { loadData(); }, [])
  );

  const loadData = async () => {
    try {
      // Load profile
      const session = route.params?.session;
      if (session?.user?.id) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        setProfile(data);
      }

      // Load today's stats from local storage
      const saved = await AsyncStorage.getItem('scan_history');

      if (saved) {
        const history = JSON.parse(saved);
        const today = new Date().toDateString();
        const todayItems = history.filter(
          h => new Date(h.date).toDateString() === today
        );
        setTodayStats({
          calories: todayItems.reduce((s, h) => s + (h.calories || 0), 0),
          protein:  todayItems.reduce((s, h) => s + (h.protein  || 0), 0),
          carbs:    todayItems.reduce((s, h) => s + (h.carbs    || 0), 0),
          fat:      todayItems.reduce((s, h) => s + (h.fat      || 0), 0),
          scans:    todayItems.length,
        });
        setRecentScans(history.slice(0, 3));
      } else {
        // History was cleared — reset everything so stale data doesn't linger
        setTodayStats({ calories: 0, protein: 0, carbs: 0, fat: 0, scans: 0 });
        setRecentScans([]);
      }
    } catch (e) {
      console.error('HomeScreen loadData error:', e);
    }
  };

  const calorieGoal  = profile?.calorie_goal || 2000;
  const progressPct  = Math.min((todayStats.calories / calorieGoal) * 100, 100);
  const progressColor =
    progressPct > 90 ? '#FF6B6B' :
    progressPct > 70 ? '#FFE66D' : COLORS.primary;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>{greeting()} 👋</Text>
          <Text style={styles.userName}>
            {profile?.name || route.params?.session?.user?.email?.split('@')[0] || 'there'}
          </Text>
        </View>
        <TouchableOpacity style={styles.avatarBtn} onPress={handleSignOut}>
          <Text style={styles.avatarText}>
            {(profile?.name || 'U').charAt(0).toUpperCase()}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Calorie Progress Card */}
      <View style={styles.calorieCard}>
        <View style={styles.calorieTop}>
          <View>
            <Text style={styles.calorieLabel}>Today's Calories</Text>
            <View style={styles.calorieRow}>
              <Text style={styles.calorieValue}>{todayStats.calories}</Text>
              <Text style={styles.calorieGoal}> / {calorieGoal} kcal</Text>
            </View>
          </View>
          <View style={styles.circleProgress}>
            <Text style={styles.circlePercent}>{Math.round(progressPct)}%</Text>
            <Text style={styles.circleLabel}>done</Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBg}>
          <View style={[styles.progressFill, {
            width: `${progressPct}%`,
            backgroundColor: progressColor,
          }]} />
        </View>
        <Text style={styles.progressSub}>
          {progressPct >= 100
            ? '🎯 Daily goal reached!'
            : `${calorieGoal - todayStats.calories} kcal remaining`}
        </Text>

        {/* Macro Row */}
        <View style={styles.macroRow}>
          {[
            { label: 'Protein', value: todayStats.protein, unit: 'g',    color: '#4ECDC4' },
            { label: 'Carbs',   value: todayStats.carbs,   unit: 'g',    color: '#FFE66D' },
            { label: 'Fat',     value: todayStats.fat,     unit: 'g',    color: '#FF6B6B' },
            { label: 'Scans',   value: todayStats.scans,   unit: '',     color: '#C3B1E1' },
          ].map(m => (
            <View key={m.label} style={styles.macroItem}>
              <Text style={[styles.macroValue, { color: m.color }]}>
                {m.value}{m.unit}
              </Text>
              <Text style={styles.macroLabel}>{m.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.quickActions}>
        {[
          { icon: '🔍', label: 'Scan Food',    screen: 'Scan',        color: '#E8F5E9' },
          { icon: '🤖', label: 'Ask AI',       screen: 'Chat',        color: '#E3F2FD' },
          { icon: '📊', label: 'My History',   screen: 'History',     color: '#FFF3E0' },
          { icon: '🗺️', label: 'Restaurants',  screen: 'Restaurants', color: '#FCE4EC' },
        ].map(action => (
          <TouchableOpacity
            key={action.screen}
            style={[styles.actionBtn, { backgroundColor: action.color }]}
            onPress={() => navigation.navigate(action.screen)}
          >
            <Text style={styles.actionIcon}>{action.icon}</Text>
            <Text style={styles.actionLabel}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Daily Tip */}
      <View style={styles.tipCard}>
        <Text style={styles.tipIcon}>{tip.icon}</Text>
        <View style={styles.tipContent}>
          <Text style={styles.tipTitle}>Daily Tip</Text>
          <Text style={styles.tipText}>{tip.tip}</Text>
        </View>
      </View>

      {/* Recent Scans */}
      {recentScans.length > 0 && (
        <>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Recent Scans</Text>
            <TouchableOpacity onPress={() => navigation.navigate('History')}>
              <Text style={styles.seeAll}>See all →</Text>
            </TouchableOpacity>
          </View>
          {recentScans.map(scan => (
            <View key={scan.id} style={styles.recentCard}>
              <View style={styles.recentIcon}>
                <Text style={styles.recentIconText}>🍽️</Text>
              </View>
              <View style={styles.recentInfo}>
                <Text style={styles.recentName}>{scan.foodName}</Text>
                <Text style={styles.recentDate}>
                  {new Date(scan.date).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                  })}
                </Text>
              </View>
              <View style={styles.recentCal}>
                <Text style={styles.recentCalValue}>{scan.calories}</Text>
                <Text style={styles.recentCalLabel}>kcal</Text>
              </View>
            </View>
          ))}
        </>
      )}

      {/* Empty state */}
      {recentScans.length === 0 && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>🥗</Text>
          <Text style={styles.emptyTitle}>Start tracking!</Text>
          <Text style={styles.emptySub}>Search for a food to see your nutrition data here</Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => navigation.navigate('Scan')}
          >
            <Text style={styles.emptyBtnText}>Search Food</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 20, paddingTop: 16,
  },
  headerLeft:     { flex: 1 },
  greeting:       { fontSize: 14, color: COLORS.textSecondary },
  userName:       { fontSize: 24, fontWeight: '800', color: COLORS.text, marginTop: 2 },
  avatarBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText:     { color: '#fff', fontSize: 18, fontWeight: '700' },
  calorieCard: {
    margin: 16, marginTop: 0, padding: 20,
    backgroundColor: COLORS.card, borderRadius: 20,
    shadowColor: '#000', shadowOpacity: 0.06,
    shadowRadius: 10, elevation: 3,
  },
  calorieTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  calorieLabel:   { fontSize: 13, color: COLORS.textSecondary, marginBottom: 4 },
  calorieRow:     { flexDirection: 'row', alignItems: 'baseline' },
  calorieValue:   { fontSize: 36, fontWeight: '800', color: COLORS.text },
  calorieGoal:    { fontSize: 15, color: COLORS.textSecondary },
  circleProgress: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: COLORS.primary,
  },
  circlePercent:  { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  circleLabel:    { fontSize: 10, color: COLORS.textSecondary },
  progressBg:     { height: 10, backgroundColor: '#f0f0f0', borderRadius: 5, marginBottom: 8 },
  progressFill:   { height: 10, borderRadius: 5 },
  progressSub:    { fontSize: 12, color: COLORS.textSecondary, marginBottom: 16 },
  macroRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingTop: 16, borderTopWidth: 0.5,
    borderTopColor: COLORS.border || '#eee',
  },
  macroItem:      { alignItems: 'center' },
  macroValue:     { fontSize: 18, fontWeight: '700' },
  macroLabel:     { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  sectionTitle:   { fontSize: 17, fontWeight: '700', color: COLORS.text, marginHorizontal: 16, marginBottom: 12 },
  sectionRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 16, marginBottom: 12 },
  seeAll:         { fontSize: 14, color: COLORS.primary, fontWeight: '600' },
  quickActions: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 12, paddingHorizontal: 16, marginBottom: 20,
  },
  actionBtn: {
    width: (SCREEN_WIDTH - 56) / 2,
    padding: 16, borderRadius: 16,
    alignItems: 'center',
  },
  actionIcon:     { fontSize: 28, marginBottom: 6 },
  actionLabel:    { fontSize: 13, fontWeight: '600', color: '#000000' },
  tipCard: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 20,
    padding: 16, backgroundColor: COLORS.primary + '15',
    borderRadius: 16, borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  tipIcon:        { fontSize: 28, marginRight: 12 },
  tipContent:     { flex: 1 },
  tipTitle:       { fontSize: 12, fontWeight: '700', color: COLORS.primary, marginBottom: 2 },
  tipText:        { fontSize: 14, color: COLORS.text, lineHeight: 20 },
  recentCard: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 10,
    padding: 14, backgroundColor: COLORS.card,
    borderRadius: 14,
  },
  recentIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
  },
  recentIconText: { fontSize: 20 },
  recentInfo:     { flex: 1 },
  recentName:     { fontSize: 15, fontWeight: '600', color: COLORS.text, textTransform: 'capitalize' },
  recentDate:     { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  recentCal:      { alignItems: 'center' },
  recentCalValue: { fontSize: 18, fontWeight: '700', color: COLORS.primary },
  recentCalLabel: { fontSize: 11, color: COLORS.textSecondary },
  emptyCard: {
    margin: 16, padding: 32, backgroundColor: COLORS.card,
    borderRadius: 20, alignItems: 'center',
  },
  emptyIcon:      { fontSize: 48, marginBottom: 12 },
  emptyTitle:     { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  emptySub:       { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 20 },
  emptyBtn: {
    backgroundColor: COLORS.primary, borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 32,
  },
  emptyBtnText:   { color: '#fff', fontWeight: '700', fontSize: 15 },
});