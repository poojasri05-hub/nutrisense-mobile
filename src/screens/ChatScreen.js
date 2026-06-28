import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { askNutritionist } from '../services/nutritionApi';
import COLORS from '../theme/colors';

const SUGGESTIONS = [
  "Is 2000 calories enough for me?",
  "Best foods for muscle gain?",
  "How much protein do I need daily?",
  "What should I eat before a workout?",
  "Are carbs bad for weight loss?",
];

export default function ChatScreen() {
  const [messages, setMessages] = useState([
    {
      id: '0',
      role: 'assistant',
      content: "Hi! I'm your AI nutritionist 🥗 Ask me anything about food, calories, diet plans, or nutrition!",
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef(null);

  useEffect(() => {
    loadChatHistory();
  }, []);

  const loadChatHistory = async () => {
    try {
      const saved = await AsyncStorage.getItem('chat_history');
      if (saved) setMessages(JSON.parse(saved));
    } catch (e) {}
  };

  const saveChatHistory = async (msgs) => {
    try {
      await AsyncStorage.setItem('chat_history', JSON.stringify(msgs));
    } catch (e) {}
  };

  const sendMessage = async (text) => {
    const userText = text || input.trim();
    if (!userText) return;

    const userMsg = { id: Date.now().toString(), role: 'user', content: userText };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setLoading(true);

    try {
      const history = updated.slice(-10).map(m => ({
        role: m.role,
        content: m.content,
      }));

      const reply = await askNutritionist(history);
      const assistantMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: reply,
      };
      const final = [...updated, assistantMsg];
      setMessages(final);
      saveChatHistory(final);
    } catch (e) {
      const errMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Sorry, I couldn't connect right now. Check your Groq API key in .env!",
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const clearChat = async () => {
    const initial = [{
      id: '0', role: 'assistant',
      content: "Hi! I'm your AI nutritionist 🥗 Ask me anything about food, calories, diet plans, or nutrition!",
    }];
    setMessages(initial);
    await AsyncStorage.removeItem('chat_history');
  };

  const renderMessage = ({ item }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.msgRow, isUser && styles.msgRowUser]}>
        {!isUser && (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>AI</Text>
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
          <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
            {item.content}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>AI Nutritionist</Text>
          <Text style={styles.headerSub}>Powered by Groq · Llama 3</Text>
        </View>
        <TouchableOpacity onPress={clearChat}>
          <Text style={styles.clearBtn}>Clear</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {loading && (
        <View style={styles.typingRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>AI</Text>
          </View>
          <View style={styles.typingBubble}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.typingText}>Thinking...</Text>
          </View>
        </View>
      )}

      {messages.length <= 1 && (
        <View style={styles.suggestions}>
          <Text style={styles.suggestLabel}>Try asking:</Text>
          <View style={styles.suggestionChips}>
            {SUGGESTIONS.map(s => (
              <TouchableOpacity key={s} style={styles.chip} onPress={() => sendMessage(s)}>
                <Text style={styles.chipText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Ask about nutrition..."
          placeholderTextColor={COLORS.textSecondary}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={300}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={() => sendMessage()}
          disabled={!input.trim() || loading}
        >
          <Text style={styles.sendIcon}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 0.5, borderBottomColor: COLORS.border || '#eee',
    backgroundColor: COLORS.card,
  },
  headerTitle:    { fontSize: 17, fontWeight: '700', color: COLORS.text },
  headerSub:      { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  clearBtn:       { fontSize: 14, color: COLORS.primary, fontWeight: '600' },
  messageList:    { padding: 16, paddingBottom: 8 },
  msgRow:         { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end' },
  msgRowUser:     { flexDirection: 'row-reverse' },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.primary, justifyContent: 'center',
    alignItems: 'center', marginHorizontal: 6,
  },
  avatarText:     { color: '#fff', fontSize: 11, fontWeight: '700' },
  bubble: {
    maxWidth: '75%', padding: 12, borderRadius: 16,
    backgroundColor: COLORS.card, borderBottomLeftRadius: 4,
  },
  bubbleUser: {
    backgroundColor: COLORS.primary,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 4,
  },
  bubbleAI:       { backgroundColor: COLORS.card },
  bubbleText:     { fontSize: 15, color: COLORS.text, lineHeight: 22 },
  bubbleTextUser: { color: '#fff' },
  typingRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8 },
  typingBubble: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.card, padding: 10, borderRadius: 12,
  },
  typingText:     { fontSize: 13, color: COLORS.textSecondary },
  suggestions:    { paddingHorizontal: 16, paddingBottom: 8 },
  suggestLabel:   { fontSize: 12, color: COLORS.textSecondary, marginBottom: 8 },
  suggestionChips:{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: COLORS.card, borderRadius: 20,
    paddingVertical: 6, paddingHorizontal: 12,
    borderWidth: 0.5, borderColor: COLORS.primary,
  },
  chipText:       { fontSize: 12, color: COLORS.primary },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', padding: 12,
    borderTopWidth: 0.5, borderTopColor: COLORS.border || '#eee',
    backgroundColor: COLORS.card, gap: 8,
  },
  input: {
    flex: 1, backgroundColor: COLORS.background, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 15,
    color: COLORS.text, maxHeight: 100,
    borderWidth: 0.5, borderColor: COLORS.border || '#eee',
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: COLORS.textSecondary || '#ccc' },
  sendIcon:       { color: '#fff', fontSize: 20, fontWeight: '700' },
});