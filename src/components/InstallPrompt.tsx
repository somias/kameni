import { useState, useEffect } from 'react';

const DISMISSED_KEY = 'install_prompt_dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  || ('standalone' in navigator && (navigator as unknown as { standalone: boolean }).standalone);

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) return;
    if (isStandalone) return; // Already installed

    // iOS: show manual instructions
    if (isIOS) {
      const timer = setTimeout(() => setShow(true), 2000);
      return () => clearTimeout(timer);
    }

    // Android/Desktop: use beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!show) return null;

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    setShow(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setShow(false);
  };

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">Add to Home Screen</p>
          {isIOS ? (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Tap the <span className="inline-block align-text-bottom">
                <svg className="w-4 h-4 inline text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15m0-3-3-3m0 0-3 3m3-3V15" />
                </svg>
              </span> Share button, then <strong>"Add to Home Screen"</strong>
            </p>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Install for quick access and offline support
            </p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleDismiss}
            className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            Dismiss
          </button>
          {!isIOS && deferredPrompt && (
            <button
              onClick={handleInstall}
              className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Install
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
