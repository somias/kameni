import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../hooks/useTheme';
import { requestNotificationPermission, disableNotifications } from '../lib/messaging';

type ThemeOption = 'light' | 'system' | 'dark';
const themeOptions: { value: ThemeOption; label: string }[] = [
  { value: 'light', label: 'Svijetlo' },
  { value: 'system', label: 'Sistem' },
  { value: 'dark', label: 'Tamno' },
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
        addToast('Obavještenja isključena', 'info');
      } else {
        const success = await requestNotificationPermission(user.uid);
        if (success) {
          addToast('Obavještenja uključena!', 'success');
        } else {
          addToast('Nije moguće uključiti obavještenja', 'error');
        }
      }
      await refreshUser();
    } catch {
      addToast('Ažuriranje postavki obavještenja nije uspjelo', 'error');
    } finally {
      setToggling(false);
    }
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">Postavke</h1>

      <div className="space-y-4">
        {/* Profile info */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Profil</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Ime</span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{userData?.displayName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Email</span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{userData?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Uloga</span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{userData?.role === 'coach' ? 'Trener' : 'Član'}</span>
            </div>
          </div>
        </div>

        {/* Appearance */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Izgled</h2>
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
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Obavještenja</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-900 dark:text-gray-100">Push obavještenja</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Primajte podsjetnike i ažuriranja rezervacija</p>
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
          Odjavi se
        </button>
      </div>
    </div>
  );
}
