import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useBooking } from '../hooks/useBooking';
import { generateSessionsForWeek } from '../lib/sessions';
import {
  getWeekStart,
  getWeekDates,
  toISODate,
  formatDate,
  formatTime,
  dayNames,
} from '../lib/utils';
import type { Slot, Session, Booking, Announcement } from '../types';
import LoadingSkeleton from '../components/LoadingSkeleton';
import PushPrompt from '../components/PushPrompt';
import InstallPrompt from '../components/InstallPrompt';

export default function WeeklySchedule() {
  const { user, userData } = useAuth();
  const { bookSession, cancelBooking } = useBooking();
  const isCoach = userData?.role === 'coach';
  const [weekStart, setWeekStart] = useState(() => getWeekStart());
  const [sessions, setSessions] = useState<Session[]>([]);
  const [bookings, setBookings] = useState<Record<string, Booking>>({});
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingInProgress, setBookingInProgress] = useState<string | null>(null);

  const weekDates = getWeekDates(weekStart);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch slots
      const slotsSnap = await getDocs(collection(db, 'slots'));
      const slots = slotsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Slot));

      // Generate sessions for the week
      await generateSessionsForWeek(slots, weekStart);

      // Fetch sessions for the week
      const startDate = toISODate(weekDates[0]);
      const endDate = toISODate(weekDates[6]);
      const sessionsQuery = query(
        collection(db, 'sessions'),
        where('date', '>=', startDate),
        where('date', '<=', endDate)
      );
      const sessionsSnap = await getDocs(sessionsQuery);
      const sessionsData = sessionsSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() } as Session)
      );
      setSessions(sessionsData);

      // Fetch user bookings for these sessions
      if (user) {
        const bookingsMap: Record<string, Booking> = {};
        for (const session of sessionsData) {
          const bookingId = `${user.uid}_${session.id}`;
          const bookingSnap = await getDoc(doc(db, 'bookings', bookingId));
          if (bookingSnap.exists()) {
            const b = { id: bookingSnap.id, ...bookingSnap.data() } as Booking;
            if (b.status === 'confirmed') {
              bookingsMap[session.id] = b;
            }
          }
        }
        setBookings(bookingsMap);
      }

      // Fetch announcement
      const announcementSnap = await getDoc(doc(db, 'announcements', 'current'));
      if (announcementSnap.exists() && announcementSnap.data().message) {
        setAnnouncement(announcementSnap.data() as Announcement);
      } else {
        setAnnouncement(null);
      }
    } catch (err) {
      console.error('Error loading schedule:', err);
    } finally {
      setLoading(false);
    }
  }, [weekStart, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleBook = async (session: Session) => {
    setBookingInProgress(session.id);
    await bookSession(session);
    await loadData();
    setBookingInProgress(null);
  };

  const handleCancel = async (booking: Booking) => {
    setBookingInProgress(booking.sessionId);
    await cancelBooking(booking);
    await loadData();
    setBookingInProgress(null);
  };

  const prevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  };

  const nextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  };

  const thisWeek = () => setWeekStart(getWeekStart());

  const isCurrentWeek =
    toISODate(weekStart) === toISODate(getWeekStart());

  // Group sessions by date
  const sessionsByDate: Record<string, Session[]> = {};
  for (const session of sessions) {
    if (!sessionsByDate[session.date]) sessionsByDate[session.date] = [];
    sessionsByDate[session.date].push(session);
  }
  // Sort sessions within each date by startTime
  for (const date in sessionsByDate) {
    sessionsByDate[date].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  return (
    <div>
      <InstallPrompt />
      <PushPrompt />

      {/* Announcement banner */}
      {announcement && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <div className="flex items-start gap-2">
            <span className="text-red-600 font-medium text-sm shrink-0">📢</span>
            <p className="text-sm text-red-800">{announcement.message}</p>
          </div>
        </div>
      )}

      {/* Week navigation */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={prevWeek}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Previous week"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>

        <div className="text-center">
          <h1 className="text-lg font-semibold text-gray-900">
            {formatDate(toISODate(weekDates[0]))} – {formatDate(toISODate(weekDates[6]))}
          </h1>
          {!isCurrentWeek && (
            <button
              onClick={thisWeek}
              className="text-xs text-red-600 hover:underline mt-0.5"
            >
              Back to this week
            </button>
          )}
        </div>

        <button
          onClick={nextWeek}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Next week"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {loading ? (
        <LoadingSkeleton count={4} />
      ) : sessions.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg font-medium">No sessions this week</p>
          <p className="text-sm mt-1">Check back later or try another week</p>
        </div>
      ) : (
        <div className="space-y-3">
          {weekDates.map((date) => {
            const dateStr = toISODate(date);
            const daySessions = sessionsByDate[dateStr];
            if (!daySessions || daySessions.length === 0) return null;

            return (
              <div key={dateStr}>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  {dayNames[date.getDay()]} · {formatDate(dateStr)}
                </h2>
                <div className="space-y-2">
                  {daySessions.map((session) => {
                    const booking = bookings[session.id];
                    const isFull = session.bookingCount >= session.maxCapacity;
                    const isCancelled = session.status === 'cancelled';
                    const isPast = session.date < toISODate(new Date());
                    const spotsLeft = session.maxCapacity - session.bookingCount;
                    const fillPercent = (session.bookingCount / session.maxCapacity) * 100;
                    const isProcessing = bookingInProgress === session.id;

                    return (
                      <div
                        key={session.id}
                        className={`bg-white rounded-xl border p-4 transition-all ${
                          isCancelled || isPast
                            ? 'border-gray-200 opacity-60'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-gray-900">
                              {formatTime(session.startTime)} – {formatTime(session.endTime)}
                            </p>
                            <p className="text-sm text-gray-500">{session.location}</p>
                          </div>

                          <div className="text-right">
                            {isCancelled ? (
                              <span className="inline-block px-3 py-1 text-xs font-medium bg-gray-100 text-gray-500 rounded-full">
                                Cancelled
                              </span>
                            ) : isPast ? (
                              <span className="inline-block px-3 py-1 text-xs font-medium bg-gray-100 text-gray-500 rounded-full">
                                Past
                              </span>
                            ) : isCoach ? null : booking ? (
                              <button
                                onClick={() => handleCancel(booking)}
                                disabled={isProcessing}
                                className="px-4 py-1.5 text-sm font-medium border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                              >
                                {isProcessing ? '...' : 'Cancel'}
                              </button>
                            ) : isFull ? (
                              <span className="inline-block px-3 py-1 text-xs font-medium bg-gray-100 text-gray-500 rounded-full">
                                Full
                              </span>
                            ) : (
                              <button
                                onClick={() => handleBook(session)}
                                disabled={isProcessing}
                                className="px-4 py-1.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                              >
                                {isProcessing ? '...' : 'Book'}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Spots progress bar */}
                        {!isCancelled && (
                          <div className="mt-3">
                            <div className="flex justify-between text-xs text-gray-500 mb-1">
                              <span>{session.bookingCount} / {session.maxCapacity} booked</span>
                              <span>{spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full transition-all ${
                                  fillPercent >= 80
                                    ? 'bg-red-500'
                                    : fillPercent >= 50
                                    ? 'bg-yellow-500'
                                    : 'bg-green-500'
                                }`}
                                style={{ width: `${Math.min(100, fillPercent)}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
