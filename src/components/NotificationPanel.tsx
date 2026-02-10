import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../hooks/useNotifications';
import { timeAgo } from '../lib/utils';

interface Props {
  onClose: () => void;
}

export default function NotificationPanel({ onClose }: Props) {
  const { notifications, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();

  const handleClick = async (n: typeof notifications[0]) => {
    if (!n.read) await markAsRead(n.id);
    if (n.relatedSessionId) {
      navigate('/schedule');
      onClose();
    }
  };

  const typeIcon: Record<string, string> = {
    booking_confirmed: '✓',
    booking_cancelled: '✗',
    session_cancelled: '⊘',
    announcement: '📢',
    reminder: '⏰',
    spot_available: '🔓',
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed md:absolute md:right-4 md:top-14 inset-0 md:inset-auto md:w-96 md:max-h-[70vh] bg-white dark:bg-gray-900 md:rounded-xl md:shadow-xl z-50 flex flex-col border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Notifications</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={markAllAsRead}
              className="text-xs text-red-600 dark:text-red-500 hover:underline"
            >
              Mark all as read
            </button>
            <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 md:hidden">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-400 dark:text-gray-500">No notifications yet</p>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                  !n.read ? 'bg-red-50/50 dark:bg-red-950/50' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-lg mt-0.5">{typeIcon[n.type] || '●'}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!n.read ? 'font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.read && (
                    <span className="w-2 h-2 bg-red-600 rounded-full mt-2 shrink-0" />
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}
