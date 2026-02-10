import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { requestNotificationPermission } from '../lib/messaging';

const DISMISSED_KEY = 'push_prompt_dismissed';

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  || ('standalone' in navigator && (navigator as unknown as { standalone: boolean }).standalone);

export default function PushPrompt() {
  const { user, userData, refreshUser } = useAuth();
  const { addToast } = useToast();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!user || !userData) return;
    if (userData.notificationsEnabled) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;
    if (!('Notification' in window)) return;
    if (Notification.permission === 'denied') return;
    // On iOS, push only works in standalone PWA mode
    if (isIOS && !isStandalone) return;

    const timer = setTimeout(() => setShow(true), 2000);
    return () => clearTimeout(timer);
  }, [user, userData]);

  if (!show) return null;

  const handleEnable = async () => {
    if (!user) return;
    const success = await requestNotificationPermission(user.uid);
    if (success) {
      addToast('Notifications enabled!', 'success');
      await refreshUser();
    } else {
      addToast('Could not enable notifications', 'error');
    }
    setShow(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setShow(false);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 flex items-center gap-4">
      <div className="flex-1">
        <p className="font-medium text-gray-900 text-sm">Want notifications?</p>
        <p className="text-xs text-gray-500 mt-0.5">
          Get reminders and updates about your bookings
        </p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleDismiss}
          className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
        >
          Later
        </button>
        <button
          onClick={handleEnable}
          className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Enable
        </button>
      </div>
    </div>
  );
}
