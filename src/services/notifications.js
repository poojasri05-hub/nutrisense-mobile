import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotifications() {
  if (!Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4CAF50',
    });
  }

  return true;
}

export async function scheduleDailyReminder() {
  await Notifications.cancelAllScheduledNotificationsAsync();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "🥗 NutriSense Daily Reminder",
      body: "Don't forget to log your meals today!",
      sound: true,
    },
    trigger: {
      hour: 12,
      minute: 0,
      repeats: true,
    },
  });
}

export async function sendMealLoggedNotification(foodName, calories) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "✅ Meal Logged!",
      body: `${foodName} — ${calories} kcal added to your diary`,
      sound: true,
    },
    trigger: null, // immediate
  });
}