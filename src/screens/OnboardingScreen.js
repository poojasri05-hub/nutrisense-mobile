import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Dimensions
} from 'react-native';
import colors from '../theme/colors';

const { width } = Dimensions.get('window');

const goals = ['Lose Weight', 'Gain Muscle', 'Stay Healthy', 'Manage Diabetes', 'Control BP'];
const conditions = ['None', 'Diabetes', 'Hypertension', 'Thyroid', 'PCOD', 'Allergies'];

export default function OnboardingScreen({ onDone }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: '', age: '', weight: '', height: '',
    goal: '', condition: ''
  });

  const next = () => {
    if (step < 3) setStep(step + 1);
    else onDone();
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>🍽️ NutriSense</Text>
        <Text style={styles.tagline}>Your AI Nutritionist</Text>
        <View style={styles.steps}>
          {[0,1,2,3].map(i => (
            <View key={i} style={[styles.dot, step === i && styles.activeDot]} />
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {step === 0 && (
          <View style={styles.stepBox}>
            <Text style={styles.stepTitle}>👋 Welcome! What's your name?</Text>
            <TextInput
              style={styles.input}
              placeholder="Your name"
              placeholderTextColor={colors.subtext}
              value={form.name}
              onChangeText={v => setForm({ ...form, name: v })}
            />
            <Text style={styles.stepTitle}>🎂 How old are you?</Text>
            <TextInput
              style={styles.input}
              placeholder="Age"
              placeholderTextColor={colors.subtext}
              keyboardType="numeric"
              value={form.age}
              onChangeText={v => setForm({ ...form, age: v })}
            />
          </View>
        )}

        {step === 1 && (
          <View style={styles.stepBox}>
            <Text style={styles.stepTitle}>⚖️ Your weight (kg)?</Text>
            <TextInput
              style={styles.input}
              placeholder="Weight in kg"
              placeholderTextColor={colors.subtext}
              keyboardType="numeric"
              value={form.weight}
              onChangeText={v => setForm({ ...form, weight: v })}
            />
            <Text style={styles.stepTitle}>📏 Your height (cm)?</Text>
            <TextInput
              style={styles.input}
              placeholder="Height in cm"
              placeholderTextColor={colors.subtext}
              keyboardType="numeric"
              value={form.height}
              onChangeText={v => setForm({ ...form, height: v })}
            />
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepBox}>
            <Text style={styles.stepTitle}>🎯 What's your goal?</Text>
            {goals.map(g => (
              <TouchableOpacity
                key={g}
                style={[styles.chip, form.goal === g && styles.activeChip]}
                onPress={() => setForm({ ...form, goal: g })}>
                <Text style={[styles.chipText, form.goal === g && styles.activeChipText]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepBox}>
            <Text style={styles.stepTitle}>🏥 Any medical conditions?</Text>
            {conditions.map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.chip, form.condition === c && styles.activeChip]}
                onPress={() => setForm({ ...form, condition: c })}>
                <Text style={[styles.chipText, form.condition === c && styles.activeChipText]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.button} onPress={next}>
        <Text style={styles.buttonText}>
          {step === 3 ? "Let's Start! 🚀" : 'Next →'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { alignItems: 'center', paddingTop: 60, paddingBottom: 20 },
  logo: { fontSize: 32, fontWeight: 'bold', color: colors.primary },
  tagline: { fontSize: 14, color: colors.subtext, marginTop: 4 },
  steps: { flexDirection: 'row', marginTop: 16, gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  activeDot: { backgroundColor: colors.primary, width: 24 },
  content: { padding: 24 },
  stepBox: { gap: 12 },
  stepTitle: { fontSize: 18, color: colors.text, fontWeight: '600', marginTop: 16 },
  input: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    color: colors.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chip: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 8,
  },
  activeChip: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.subtext, fontSize: 16 },
  activeChipText: { color: '#000', fontWeight: 'bold' },
  button: {
    backgroundColor: colors.primary,
    margin: 24,
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  buttonText: { color: '#000', fontSize: 18, fontWeight: 'bold' },
});