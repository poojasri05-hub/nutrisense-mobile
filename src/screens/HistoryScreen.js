import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, Alert, Dimensions, ScrollView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { getScanHistory, deleteScan } from '../services/api';
import COLORS from '../theme/colors';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function HistoryScreen({ route }) {
  const [history, setHistory]     = useState([]);
  const [activeTab, setActiveTab] = useState('list');

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
        return;
      }
    } catch (e) {
      console.error('Cloud history failed, falling back to local:', e);
    }
    // Fallback to local
    try {
      const saved = await AsyncStorage.getItem('scan_history');
      if (saved) setHistory(JSON.parse(saved));
    } catch (e) {}
  };

  const clearHistory = () => {
    Alert.alert('Clear History', 'Delete all scan history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive',
        onPress: async () => {
          try {
            // Delete each item from backend
            await Promise.all(history.map(item => deleteScan(item.id)));
          } catch (e) {}
          await AsyncStorage.removeItem('scan_history');
          setHistory([]);
        }
      }
    ]);
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
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardLeft}>
              <Text style={styles.foodName}>{item.foodName}</Text>
              <Text style={styles.date}>{formatDate(item.date)}</Text>
              <View style={styles.macroRow}>
                <Text style={styles.macro}>🔥 {item.calories} kcal</Text>
                <Text style={styles.macro}>💪 {item.protein}g</Text>
                <Text style={styles.macro}>🌾 {item.carbs}g</Text>
              </View>
            </View>
            <View style={styles.calBadge}>
              <Text style={styles.calValue}>{item.calories}</Text>
              <Text style={styles.calLabel}>kcal</Text>
            </View>
          </View>
        )}
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
      />
    )
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>Today's calories</Text>
          <Text style={styles.headerValue}>{totalCaloriesToday()} kcal</Text>
        </View>
        <TouchableOpacity onPress={clearHistory}>
          <Text style={styles.clearBtn}>Clear All</Text>
        </TouchableOpacity>
      </View>
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
      {activeTab === 'list' ? renderList() : renderCharts()}
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: COLORS.background },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', margin: 16, padding: 16, backgroundColor: COLORS.primary, borderRadius: 16 },
  headerLabel:    { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  headerValue:    { fontSize: 28, fontWeight: '700', color: '#fff' },
  clearBtn:       { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '600' },
  tabRow:         { flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, backgroundColor: COLORS.card, borderRadius: 12, padding: 4 },
  tab:            { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabActive:      { backgroundColor: COLORS.primary },
  tabText:        { fontSize: 14, color: COLORS.textSecondary, fontWeight: '500' },
  tabTextActive:  { color: '#fff', fontWeight: '600' },
  chartCard:      { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, margin: 16, marginTop: 0 },
  chartTitle:     { fontSize: 15, fontWeight: '600', color: COLORS.text, marginBottom: 12 },
  chart:          { borderRadius: 12, marginLeft: -8 },
  noData:         { height: 100, justifyContent: 'center', alignItems: 'center' },
  noDataText:     { color: COLORS.textSecondary, fontSize: 14 },
  summaryGrid:    { flexDirection: 'row', gap: 10, margin: 16, marginBottom: 8 },
  summaryCard:    { flex: 1, backgroundColor: COLORS.card, borderRadius: 12, padding: 12, alignItems: 'center' },
  summaryValue:   { fontSize: 20, fontWeight: '700', color: COLORS.primary },
  summaryLabel:   { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  macroPills:     { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 24 },
  pill:           { flex: 1, backgroundColor: COLORS.card, borderRadius: 10, padding: 10, alignItems: 'center', borderTopWidth: 3 },
  pillValue:      { fontSize: 16, fontWeight: '700', color: COLORS.text },
  pillLabel:      { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  card:           { backgroundColor: COLORS.card, borderRadius: 14, padding: 16, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLeft:       { flex: 1 },
  foodName:       { fontSize: 16, fontWeight: '600', color: COLORS.text, textTransform: 'capitalize' },
  date:           { fontSize: 12, color: COLORS.textSecondary, marginTop: 2, marginBottom: 8 },
  macroRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  macro:          { fontSize: 12, color: COLORS.textSecondary },
  calBadge:       { backgroundColor: COLORS.primary + '20', borderRadius: 10, padding: 10, alignItems: 'center', minWidth: 60 },
  calValue:       { fontSize: 20, fontWeight: '700', color: COLORS.primary },
  calLabel:       { fontSize: 11, color: COLORS.primary },
  empty:          { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon:      { fontSize: 48, marginBottom: 12 },
  emptyText:      { fontSize: 18, fontWeight: '600', color: COLORS.text, marginBottom: 8 },
  emptySubText:   { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' },
});