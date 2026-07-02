import Constants from 'expo-constants';

const isExpoGo = Constants.appOwnership === 'expo';

export async function registerForPushNotifications() {
  if (isExpoGo) return false;
  try {
    const Notifications = await import('expo-notifications');
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch (e) {
    return false;
  }
}

export async function scheduleDailyReminder() {
  if (isExpoGo) return;
  try {
    const Notifications = await import('expo-notifications');
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🥗 NutriSense',
        body:  "Don't forget to log your meals today!",
      },
      trigger: { hour: 20, minute: 0, repeats: true },
    });
  } catch (e) {}
}

export async function sendMealLoggedNotification(foodName, calories) {
  if (isExpoGo) return;
  try {
    const Notifications = await import('expo-notifications');
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '✅ Meal Logged',
        body:  `${foodName} — ${calories} kcal added to your diary`,
      },
      trigger: null,
    });
  } catch (e) {}
}