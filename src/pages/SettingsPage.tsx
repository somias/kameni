import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../hooks/useTheme';
import { requestNotificationPermission, disableNotifications } from '../lib/messaging';

type ThemeOption = 'light' | 'system' | 'dark';
const themeOptions: { value: ThemeOption; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
  { value: 'dark', label: 'Dark' },
];

export default function SettingsPage() {
  const { user, userData, refreshUser, signOut } = useAuth();
  const { addToast } = useToast();
  const { theme, setTheme } = useTheme();
  const [toggling, setToggling] = useState(false);

  const handleToggleNotifications = async () => {
    if (!user || !userData) return;
    setToggling(true);
    try {
      if (userData.notificationsEnabled) {
        await disableNotifications(user.uid);
        addToast('Notifications disabled', 'info');
      } else {
        const success = await requestNotificationPermission(user.uid);
        if (success) {
          addToast('Notifications enabled!', 'success');
        } else {
          addToast('Could not enable notifications', 'error');
        }
      }
      await refreshUser();
    } catch {
      addToast('Failed to update notification settings', 'error');
    } finally {
      setToggling(false);
    }
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">Settings</h1>

      <div className="space-y-4">
        {/* Profile info */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Profile</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Name</span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{userData?.displayName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Email</span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{userData?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Role</span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">{userData?.role}</span>
            </div>
          </div>
        </div>

        {/* Appearance */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Appearance</h2>
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {themeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  theme === opt.value
                    ? 'bg-red-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Notifications</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-900 dark:text-gray-100">Push Notifications</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Get reminders and booking updates</p>
            </div>
            <button
              onClick={handleToggleNotifications}
              disabled={toggling}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                userData?.notificationsEnabled ? 'bg-red-600' : 'bg-gray-300 dark:bg-gray-600'
              } ${toggling ? 'opacity-50' : ''}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow ${
                  userData?.notificationsEnabled ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>
        </div>

        {/* Sign out */}
        <button
          onClick={signOut}
          className="w-full py-3 text-sm font-medium text-red-600 dark:text-red-500 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
