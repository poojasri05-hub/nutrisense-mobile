import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  TouchableOpacity, ActivityIndicator,
  Alert, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { signIn, signUp } from '../services/supabase';
import COLORS from '../theme/colors';

export default function AuthScreen({ onAuth }) {
  const [mode, setMode]         = useState('login');
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);

  const handle = async () => {
    if (!email.trim() || !password.trim()) {
      return Alert.alert('Error', 'Please fill in all fields');
    }
    if (mode === 'signup' && !name.trim()) {
      return Alert.alert('Error', 'Please enter your name');
    }
    if (password.length < 6) {
      return Alert.alert('Error', 'Password must be at least 6 characters');
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        const data = await signUp(email.trim(), password, name.trim());
        if (data?.session) {
          await AsyncStorage.setItem('supabase_session', JSON.stringify(data.session));
        }
        Alert.alert(
          '✅ Account created!',
          'Please check your email to verify your account, then log in.',
          [{ text: 'OK', onPress: () => setMode('login') }]
        );
      } else {
        const data = await signIn(email.trim(), password);
        if (data?.session) {
          await AsyncStorage.setItem('supabase_session', JSON.stringify(data.session));
        }
        onAuth();
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.inner} showsVerticalScrollIndicator={false}>
        <View style={styles.logoArea}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoEmoji}>🥗</Text>
          </View>
          <Text style={styles.appName}>NutriSense</Text>
          <Text style={styles.tagline}>Your AI nutrition companion</Text>
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, mode === 'login' && styles.tabActive]}
            onPress={() => setMode('login')}
          >
            <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>Login</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, mode === 'signup' && styles.tabActive]}
            onPress={() => setMode('signup')}
          >
            <Text style={[styles.tabText, mode === 'signup' && styles.tabTextActive]}>Sign Up</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          {mode === 'signup' && (
            <>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your name"
                placeholderTextColor={COLORS.textSecondary}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </>
          )}

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@email.com"
            placeholderTextColor={COLORS.textSecondary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Min 6 characters"
            placeholderTextColor={COLORS.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity style={styles.btn} onPress={handle} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>{mode === 'login' ? 'Login' : 'Create Account'}</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}>
            <Text style={styles.switchText}>
              {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Login'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: COLORS.background },
  inner:         { flexGrow: 1, padding: 24, justifyContent: 'center' },
  logoArea:      { alignItems: 'center', marginBottom: 40 },
  logoCircle:    { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  logoEmoji:     { fontSize: 40 },
  appName:       { fontSize: 32, fontWeight: '800', color: COLORS.text },
  tagline:       { fontSize: 15, color: COLORS.textSecondary, marginTop: 4 },
  tabRow:        { flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: 12, padding: 4, marginBottom: 24 },
  tab:           { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabActive:     { backgroundColor: COLORS.primary },
  tabText:       { fontSize: 15, color: COLORS.textSecondary, fontWeight: '500' },
  tabTextActive: { color: '#fff', fontWeight: '700' },
  form:          { gap: 4 },
  label:         { fontSize: 13, color: COLORS.textSecondary, marginBottom: 6, marginTop: 12 },
  input:         { backgroundColor: COLORS.card, borderRadius: 12, padding: 14, fontSize: 15, color: COLORS.text, borderWidth: 0.5, borderColor: COLORS.border || '#eee' },
  btn:           { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 24 },
  btnText:       { color: '#fff', fontWeight: '700', fontSize: 16 },
  switchText:    { textAlign: 'center', color: COLORS.primary, fontSize: 14, marginTop: 16 },
});