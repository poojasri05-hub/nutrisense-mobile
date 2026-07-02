import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, Alert, Dimensions, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { getScanHistory, deleteScan } from '../services/api';
import { getDailyCompliance } from '../services/dietMonitor';
import { supabase } from '../services/supabase';
import COLORS from '../theme/colors';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function HistoryScreen({ route }) {
  const [history, setHistory]             = useState([]);
  const [activeTab, setActiveTab]         = useState('list');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds]     = useState(new Set());
  const [dailyCompliance, setDailyCompliance] = useState(null);

  useFocusEffect(
    useCallback(() => { loadHistory(); }, [])
  );

  const loadHistory = async () => {
    try {
      const cloudData = await getScanHistory();
      if (cloudData && cloudData.length > 0) {
        const formatted = cloudData.map(item => ({
          id:       item.id,
          foodName: item.food_name,
          date:     item.scanned_at,
          calories: item.calories,
          protein:  item.protein,
          carbs:    item.carbs,
          fat:      item.fat,
          fiber:    item.fiber,
        }));
        setHistory(formatted);
        await loadCompliance();
        return;
      }
    } catch (e) {
      console.error('Cloud history failed, falling back to local:', e);
    }
    try {
      const saved = await AsyncStorage.getItem('scan_history');
      if (saved) {
        setHistory(JSON.parse(saved));
      } else {
        setHistory([]);
      }
    } catch (e) {}
    await loadCompliance();
  };

  const loadCompliance = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('diet_type')
        .eq('id', session.user.id)
        .single();
      const dietType = profile?.diet_type || 'balanced';
      const compliance = await getDailyCompliance(dietType);
      setDailyCompliance(compliance);
    } catch (e) {
      console.error('loadCompliance error:', e);
    }
  };

  const persistLocal = async (updated) => {
    try {
      await AsyncStorage.setItem('scan_history', JSON.stringify(updated));
    } catch (e) {}
  };

  const clearHistory = () => {
    Alert.alert('Clear History', 'Delete all scan history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive',
        onPress: async () => {
          try {
            await Promise.all(history.map(item => deleteScan(item.id)));
          } catch (e) {}
          await AsyncStorage.removeItem('scan_history');
          setHistory([]);
          setDailyCompliance(null);
          exitSelectionMode();
        }
      }
    ]);
  };

  const toggleSelected = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const enterSelectionMode = (initialId) => {
    setSelectionMode(true);
    if (initialId) setSelectedIds(new Set([initialId]));
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const selectAll = () => {
    setSelectedIds(new Set(history.map(h => h.id)));
  };

  const deleteSelected = () => {
    if (selectedIds.size === 0) return;
    Alert.alert(
      'Delete Selected',
      `Delete ${selectedIds.size} selected scan${selectedIds.size > 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await Promise.all(Array.from(selectedIds).map(id => deleteScan(id)));
            } catch (e) {}
            const updated = history.filter(item => !selectedIds.has(item.id));
            setHistory(updated);
            await persistLocal(updated);
            exitSelectionMode();
            await loadCompliance();
          }
        }
      ]
    );
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const totalCaloriesToday = () => {
    const today = new Date().toDateString();
    return history
      .filter(h => new Date(h.date).toDateString() === today)
      .reduce((sum, h) => sum + (h.calories || 0), 0);
  };

  const totalProteinToday = () => {
    const today = new Date().toDateString();
    return history
      .filter(h => new Date(h.date).toDateString() === today)
      .reduce((sum, h) => sum + (h.protein || 0), 0);
  };

  const getLast7DaysData = () => {
    const days = [], labels = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = d.toDateString();
      const total = history
        .filter(h => new Date(h.date).toDateString() === dayStr)
        .reduce((sum, h) => sum + (h.calories || 0), 0);
      days.push(total);
      labels.push(d.toLocaleDateString('en-IN', { weekday: 'short' }));
    }
    return { days, labels };
  };

  const getMacroData = () => {
    const today = new Date().toDateString();
    const todayItems = history.filter(h => new Date(h.date).toDateString() === today);
    return {
      protein: todayItems.reduce((sum, h) => sum + (h.protein || 0), 0),
      carbs:   todayItems.reduce((sum, h) => sum + (h.carbs   || 0), 0),
      fat:     todayItems.reduce((sum, h) => sum + (h.fat     || 0), 0),
      fiber:   todayItems.reduce((sum, h) => sum + (h.fiber   || 0), 0),
    };
  };

  const chartConfig = {
    backgroundGradientFrom: '#fff',
    backgroundGradientTo:   '#fff',
    color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
    labelColor: () => COLORS.textSecondary,
    strokeWidth: 2,
    barPercentage: 0.6,
    decimalPlaces: 0,
    propsForDots: { r: '5', strokeWidth: '2', stroke: COLORS.primary },
  };

  const { days, labels } = getLast7DaysData();
  const macros = getMacroData();

  const renderComplianceCard = () => {
    if (!dailyCompliance || dailyCompliance.dietLabel === 'Balanced') return null;
    return (
      <View style={[
        styles.complianceCard,
        dailyCompliance.compliant ? styles.complianceGood : styles.complianceBad
      ]}>
        <View style={styles.complianceLeft}>
          <Text style={styles.complianceTitle}>
            {dailyCompliance.compliant ? '✅' : '⚠️'} {dailyCompliance.dietLabel} Today
          </Text>
          <Text style={styles.complianceMsg}>
            {dailyCompliance.compliant
              ? `Great job! All ${dailyCompliance.totalScans} meals followed your diet.`
              : `${dailyCompliance.violations} of ${dailyCompliance.totalScans} meals had violations.`
            }
          </Text>
          {dailyCompliance.macroWarning && (
            <Text style={styles.complianceWarning}>⚡ {dailyCompliance.macroWarning}</Text>
          )}
        </View>
        <View style={styles.complianceScore}>
          <Text style={styles.complianceScoreValue}>{dailyCompliance.score}%</Text>
          <Text style={styles.complianceScoreLabel}>adherence</Text>
        </View>
      </View>
    );
  };

  const renderCharts = () => (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{totalCaloriesToday()}</Text>
          <Text style={styles.summaryLabel}>kcal today</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{totalProteinToday()}g</Text>
          <Text style={styles.summaryLabel}>protein today</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{history.length}</Text>
          <Text style={styles.summaryLabel}>total scans</Text>
        </View>
      </View>
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Calories — Last 7 Days</Text>
        {days.some(d => d > 0) ? (
          <LineChart
            data={{ labels, datasets: [{ data: days.map(d => d || 1) }] }}
            width={SCREEN_WIDTH - 48} height={200}
            chartConfig={chartConfig} bezier style={styles.chart}
          />
        ) : (
          <View style={styles.noData}>
            <Text style={styles.noDataText}>No data yet — scan some foods!</Text>
          </View>
        )}
      </View>
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Today's Macros (grams)</Text>
        {(macros.protein + macros.carbs + macros.fat) > 0 ? (
          <BarChart
            data={{
              labels: ['Protein', 'Carbs', 'Fat', 'Fiber'],
              datasets: [{ data: [macros.protein, macros.carbs, macros.fat, macros.fiber] }],
            }}
            width={SCREEN_WIDTH - 48} height={200}
            chartConfig={{ ...chartConfig, color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})` }}
            style={styles.chart} showValuesOnTopOfBars
          />
        ) : (
          <View style={styles.noData}>
            <Text style={styles.noDataText}>No data yet — scan some foods!</Text>
          </View>
        )}
      </View>
      <View style={styles.macroPills}>
        {[
          { label: 'Protein', value: macros.protein, color: '#4ECDC4' },
          { label: 'Carbs',   value: macros.carbs,   color: '#FFE66D' },
          { label: 'Fat',     value: macros.fat,     color: '#A8E6CF' },
          { label: 'Fiber',   value: macros.fiber,   color: '#C3B1E1' },
        ].map(m => (
          <View key={m.label} style={[styles.pill, { borderTopColor: m.color }]}>
            <Text style={styles.pillValue}>{m.value}g</Text>
            <Text style={styles.pillLabel}>{m.label}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const renderList = () => (
    history.length === 0 ? (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>📋</Text>
        <Text style={styles.emptyText}>No scans yet</Text>
        <Text style={styles.emptySubText}>Search for a food in the Scan tab to get started</Text>
      </View>
    ) : (
      <FlatList
        data={history}
        keyExtractor={item => item.id}
        renderItem={({ item }) => {
          const isSelected = selectedIds.has(item.id);
          return (
            <TouchableOpacity
              style={[styles.card, isSelected && styles.cardSelected]}
              activeOpacity={0.8}
              onPress={() => selectionMode ? toggleSelected(item.id) : null}
              onLongPress={() => !selectionMode && enterSelectionMode(item.id)}
            >
              {selectionMode && (
                <View style={styles.checkboxWrap}>
                  <Ionicons
                    name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={24}
                    color={isSelected ? COLORS.primary : COLORS.textSecondary}
                  />
                </View>
              )}
              <View style={styles.cardLeft}>
                <Text style={styles.foodName}>{item.foodName}</Text>
                <Text style={styles.date}>{formatDate(item.date)}</Text>
                <View style={styles.macroRow}>
                  <Text style={styles.macro}>🔥 {item.calories} kcal</Text>
                  <Text style={styles.macro}>💪 {item.protein}g</Text>
                  <Text style={styles.macro}>🌾 {item.carbs}g</Text>
                </View>
              </View>
              {!selectionMode && (
                <View style={styles.calBadge}>
                  <Text style={styles.calValue}>{item.calories}</Text>
                  <Text style={styles.calLabel}>kcal</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={{ padding: 16, paddingBottom: selectionMode ? 90 : 16 }}
        showsVerticalScrollIndicator={false}
      />
    )
  );

  return (
    <View style={styles.container}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        {selectionMode ? (
          <>
            <View>
              <Text style={styles.headerLabel}>Selected</Text>
              <Text style={styles.headerValue}>{selectedIds.size}</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity onPress={selectAll} style={{ marginRight: 16 }}>
                <Text style={styles.clearBtn}>Select All</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={exitSelectionMode}>
                <Text style={styles.clearBtn}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <View>
              <Text style={styles.headerLabel}>Today's calories</Text>
              <Text style={styles.headerValue}>{totalCaloriesToday()} kcal</Text>
            </View>
            <View style={styles.headerActions}>
              {history.length > 0 && (
                <TouchableOpacity onPress={() => enterSelectionMode(null)} style={{ marginRight: 16 }}>
                  <Text style={styles.clearBtn}>Select</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={clearHistory}>
                <Text style={styles.clearBtn}>Clear All</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* ── Daily Diet Compliance Card ──────────────────────────────────── */}
      {!selectionMode && renderComplianceCard()}

      {/* ── Tab Row ────────────────────────────────────────────────────── */}
      {!selectionMode && (
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'list' && styles.tabActive]}
            onPress={() => setActiveTab('list')}
          >
            <Text style={[styles.tabText, activeTab === 'list' && styles.tabTextActive]}>📋 History</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'charts' && styles.tabActive]}
            onPress={() => setActiveTab('charts')}
          >
            <Text style={[styles.tabText, activeTab === 'charts' && styles.tabTextActive]}>📊 Charts</Text>
          </TouchableOpacity>
        </View>
      )}

      {activeTab === 'list' || selectionMode ? renderList() : renderCharts()}

      {/* ── Selection Delete Bar ────────────────────────────────────────── */}
      {selectionMode && (
        <View style={styles.selectionBar}>
          <TouchableOpacity
            style={[styles.deleteSelectedBtn, selectedIds.size === 0 && styles.deleteSelectedBtnDisabled]}
            onPress={deleteSelected}
            disabled={selectedIds.size === 0}
          >
            <Ionicons name="trash-outline" size={18} color="#fff" />
            <Text style={styles.deleteSelectedText}>
              Delete {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:            { flex: 1, backgroundColor: COLORS.background },
  header:               { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', margin: 16, padding: 16, backgroundColor: COLORS.primary, borderRadius: 16 },
  headerLabel:          { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  headerValue:          { fontSize: 28, fontWeight: '700', color: '#fff' },
  headerActions:        { flexDirection: 'row', alignItems: 'center' },
  clearBtn:             { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '600' },
  tabRow:               { flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, backgroundColor: COLORS.card, borderRadius: 12, padding: 4 },
  tab:                  { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabActive:            { backgroundColor: COLORS.primary },
  tabText:              { fontSize: 14, color: COLORS.textSecondary, fontWeight: '500' },
  tabTextActive:        { color: '#fff', fontWeight: '600' },
  chartCard:            { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, margin: 16, marginTop: 0 },
  chartTitle:           { fontSize: 15, fontWeight: '600', color: COLORS.text, marginBottom: 12 },
  chart:                { borderRadius: 12, marginLeft: -8 },
  noData:               { height: 100, justifyContent: 'center', alignItems: 'center' },
  noDataText:           { color: COLORS.textSecondary, fontSize: 14 },
  summaryGrid:          { flexDirection: 'row', gap: 10, margin: 16, marginBottom: 8 },
  summaryCard:          { flex: 1, backgroundColor: COLORS.card, borderRadius: 12, padding: 12, alignItems: 'center' },
  summaryValue:         { fontSize: 20, fontWeight: '700', color: COLORS.primary },
  summaryLabel:         { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  macroPills:           { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 24 },
  pill:                 { flex: 1, backgroundColor: COLORS.card, borderRadius: 10, padding: 10, alignItems: 'center', borderTopWidth: 3 },
  pillValue:            { fontSize: 16, fontWeight: '700', color: COLORS.text },
  pillLabel:            { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  card:                 { backgroundColor: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardSelected:         { borderWidth: 1.5, borderColor: COLORS.primary, backgroundColor: COLORS.primary + '10' },
  checkboxWrap:         { marginRight: 12 },
  cardLeft:             { flex: 1 },
  foodName:             { fontSize: 16, fontWeight: '600', color: COLORS.text, textTransform: 'capitalize' },
  date:                 { fontSize: 12, color: COLORS.textSecondary, marginTop: 2, marginBottom: 8 },
  macroRow:             { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  macro:                { fontSize: 12, color: COLORS.textSecondary },
  calBadge:             { backgroundColor: COLORS.primary + '20', borderRadius: 10, padding: 10, alignItems: 'center', minWidth: 60 },
  calValue:             { fontSize: 20, fontWeight: '700', color: COLORS.primary },
  calLabel:             { fontSize: 11, color: COLORS.primary },
  empty:                { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon:            { fontSize: 48, marginBottom: 12 },
  emptyText:            { fontSize: 18, fontWeight: '600', color: COLORS.text, marginBottom: 8 },
  emptySubText:         { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' },
  selectionBar:         { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: COLORS.background, borderTopWidth: 0.5, borderTopColor: COLORS.border || '#eee' },
  deleteSelectedBtn:    { flexDirection: 'row', backgroundColor: '#E53935', borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', gap: 8 },
  deleteSelectedBtnDisabled: { backgroundColor: '#E5393580' },
  deleteSelectedText:   { color: '#fff', fontWeight: '700', fontSize: 15 },

  // ── Diet Compliance Card ─────────────────────────────────────────────────
  complianceCard:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 16, marginBottom: 10, padding: 14, borderRadius: 14, borderLeftWidth: 4 },
  complianceGood:       { backgroundColor: '#4CAF5015', borderLeftColor: '#4CAF50' },
  complianceBad:        { backgroundColor: '#FF6B6B15', borderLeftColor: '#FF6B6B' },
  complianceLeft:       { flex: 1 },
  complianceTitle:      { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  complianceMsg:        { fontSize: 12, color: COLORS.textSecondary },
  complianceWarning:    { fontSize: 12, color: '#FF6B6B', marginTop: 4 },
  complianceScore:      { alignItems: 'center', marginLeft: 12 },
  complianceScoreValue: { fontSize: 22, fontWeight: '800', color: COLORS.primary },
  complianceScoreLabel: { fontSize: 10, color: COLORS.textSecondary },
});