import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import HomeScreen       from '../screens/HomeScreen';
import ScanScreen       from '../screens/ScanScreen';
import ChatScreen       from '../screens/ChatScreen';
import HistoryScreen    from '../screens/HistoryScreen';
import ProfileScreen    from '../screens/ProfileScreen';
import RestaurantScreen from '../screens/RestaurantScreen';
import COLORS from '../theme/colors';

const Tab = createBottomTabNavigator();

const icon = (emoji) => ({ focused }) => (
  <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
);

export default function RootNavigator({ session }) {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor:   COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopWidth: 0.5,
          borderTopColor: COLORS.border || '#eee',
          paddingBottom: 6,
          height: 60,
        },
        headerStyle:      { backgroundColor: COLORS.card },
        headerTintColor:  COLORS.text,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarIcon: icon('🏠'), title: 'Home', headerShown: false }}
        initialParams={{ session }}
      />
      <Tab.Screen
        name="Scan"
        component={ScanScreen}
        options={{ tabBarIcon: icon('🔍'), title: 'Scan' }}
        initialParams={{ session }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{ tabBarIcon: icon('🤖'), title: 'AI Chat', headerTitle: 'AI Nutritionist' }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{ tabBarIcon: icon('📋'), title: 'History' }}
        initialParams={{ session }}
      />
      <Tab.Screen
        name="Restaurants"
        component={RestaurantScreen}
        options={{ tabBarIcon: icon('🗺️'), title: 'Nearby', headerTitle: 'Nearby Restaurants' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarIcon: icon('👤'), title: 'Profile' }}
        initialParams={{ session }}
      />
    </Tab.Navigator>
  );
}