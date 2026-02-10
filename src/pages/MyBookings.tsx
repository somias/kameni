import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, documentId } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useBooking } from '../hooks/useBooking';
import { formatDate, formatTime, toISODate } from '../lib/utils';
import type { Booking } from '../types';
import LoadingSkeleton from '../components/LoadingSkeleton';

export default function MyBookings() {
  const { user } = useAuth();
  const { cancelBooking } = useBooking();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [cancelledSessions, setCancelledSessions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const loadBookings = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const today = toISODate(new Date());
      const q = query(
        collection(db, 'bookings'),
        where('userId', '==', user.uid),
        where('status', '==', 'confirmed'),
        where('sessionDate', '>=', today),
        orderBy('sessionDate', 'asc')
      );
      const snap = await getDocs(q);
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Booking));
      setBookings(items);

      // Batch-check which sessions are cancelled
      const cancelled = new Set<string>();
      const sessionIds = [...new Set(items.map((b) => b.sessionId))];
      for (let i = 0; i < sessionIds.length; i += 30) {
        const batch = sessionIds.slice(i, i + 30);
        const sessionsSnap = await getDocs(
          query(
            collection(db, 'sessions'),
            where(documentId(), 'in', batch)
          )
        );
        for (const d of sessionsSnap.docs) {
          if (d.data().status === 'cancelled') {
            cancelled.add(d.id);
          }
        }
      }
      setCancelledSessions(cancelled);
    } catch (err) {
      console.error('Error loading bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, [user]);

  const handleCancel = async (booking: Booking) => {
    if (!window.confirm('Cancel this booking?')) return;
    setCancellingId(booking.id);
    await cancelBooking(booking);
    await loadBookings();
    setCancellingId(null);
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">My Bookings</h1>

      {loading ? (
        <LoadingSkeleton count={3} />
      ) : bookings.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          <p className="text-lg font-medium">No upcoming bookings</p>
          <p className="text-sm mt-1">
            <Link to="/schedule" className="text-red-600 dark:text-red-500 hover:underline">
              Browse the schedule
            </Link>{' '}
            to book a session
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => {
            const isSessionCancelled = cancelledSessions.has(booking.sessionId);
            const isCancelling = cancellingId === booking.id;

            return (
              <div
                key={booking.id}
                className={`bg-white dark:bg-gray-900 rounded-xl border p-4 ${
                  isSessionCancelled ? 'border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-950/30' : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {formatDate(booking.sessionDate)}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {formatTime(booking.sessionStartTime)} – {formatTime(booking.sessionEndTime)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{booking.sessionLocation}</p>
                  </div>

                  <div>
                    {isSessionCancelled ? (
                      <span className="inline-block px-3 py-1 text-xs font-medium bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-full">
                        Cancelled by coach
                      </span>
                    ) : (
                      <button
                        onClick={() => handleCancel(booking)}
                        disabled={isCancelling}
                        className="px-4 py-1.5 text-sm font-medium border border-red-200 dark:border-red-800 text-red-600 dark:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors disabled:opacity-50"
                      >
                        {isCancelling ? '...' : 'Cancel'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
