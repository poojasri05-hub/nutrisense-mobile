import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const SUPABASE_URL      = 'https://sdsvsgtphxasqvlqhqaz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkc3ZzZ3RwaHhhc3F2bHFocWF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzNzIzNzksImV4cCI6MjA5Nzk0ODM3OX0.vIPj_aCErkq3EWVmVst4cpgPLLdPlSOGbRWujKNeWwI';

// Secure storage adapter for Supabase auth tokens
const ExpoSecureStoreAdapter = {
  getItem:    (key) => SecureStore.getItemAsync(key),
  setItem:    (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage:          ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession:   true,
    detectSessionInUrl: false,
  },
});

// ─── Auth Functions ────────────────────────────────────────────────────────

export async function signUp(email, password, name) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;

  // Create profile row
  if (data.user) {
    await supabase.from('profiles').insert({
      id:           data.user.id,
      name,
      calorie_goal: 2000,
      diet_type:    'balanced',
    });
  }
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// ─── Profile Functions ─────────────────────────────────────────────────────

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateProfile(userId, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);
  if (error) throw error;
  return data;
}

// ─── Scan History Functions ────────────────────────────────────────────────

export async function saveToCloud(userId, foodName, nutrition) {
  const { data, error } = await supabase
    .from('scan_history')
    .insert({
      user_id:    userId,
      food_name:  foodName,
      calories:   nutrition.calories,
      protein:    nutrition.protein,
      carbs:      nutrition.carbs,
      fat:        nutrition.fat,
      fiber:      nutrition.fiber,
    });
  if (error) throw error;
  return data;
}

export async function getCloudHistory(userId) {
  const { data, error } = await supabase
    .from('scan_history')
    .select('*')
    .eq('user_id', userId)
    .order('scanned_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data;
}

export async function deleteCloudHistory(userId) {
  const { error } = await supabase
    .from('scan_history')
    .delete()
    .eq('user_id', userId);
  if (error) throw error;
}