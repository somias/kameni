import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { requestNotificationPermission, disableNotifications } from '../lib/messaging';

export default function SettingsPage() {
  const { user, userData, refreshUser, signOut } = useAuth();
  const { addToast } = useToast();
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
      <h1 className="text-xl font-bold text-gray-900 mb-6">Settings</h1>

      <div className="space-y-4">
        {/* Profile info */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Profile</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Name</span>
              <span className="text-sm font-medium text-gray-900">{userData?.displayName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Email</span>
              <span className="text-sm font-medium text-gray-900">{userData?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Role</span>
              <span className="text-sm font-medium text-gray-900 capitalize">{userData?.role}</span>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Notifications</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-900">Push Notifications</p>
              <p className="text-xs text-gray-500">Get reminders and booking updates</p>
            </div>
            <button
              onClick={handleToggleNotifications}
              disabled={toggling}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                userData?.notificationsEnabled ? 'bg-red-600' : 'bg-gray-300'
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
          className="w-full py-3 text-sm font-medium text-red-600 bg-white border border-gray-200 rounded-xl hover:bg-red-50 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
