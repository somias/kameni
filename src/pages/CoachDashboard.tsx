import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  setDoc,
  addDoc,
  getDoc,
  deleteField,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
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
import { Link } from 'react-router-dom';

export default function CoachDashboard() {
  const { user, userData } = useAuth();
  const { addToast } = useToast();
  const [weekStart, setWeekStart] = useState(() => getWeekStart());
  const [sessions, setSessions] = useState<Session[]>([]);
  const [bookingsMap, setBookingsMap] = useState<Record<string, Booking[]>>({});
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelModal, setCancelModal] = useState<Session | null>(null);
  const [cancelNote, setCancelNote] = useState('');
  const [editTimeSession, setEditTimeSession] = useState<Session | null>(null);
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [currentAnnouncement, setCurrentAnnouncement] = useState<Announcement | null>(null);

  const weekDates = getWeekDates(weekStart);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const slotsSnap = await getDocs(collection(db, 'slots'));
      const slots = slotsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Slot));

      await generateSessionsForWeek(slots, weekStart);

      const startDate = toISODate(weekDates[0]);
      const endDate = toISODate(weekDates[6]);
      const sessionsQuery = query(
        collection(db, 'sessions'),
        where('date', '>=', startDate),
        where('date', '<=', endDate)
      );
      const sessionsSnap = await getDocs(sessionsQuery);
      const sessionsData = sessionsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Session))
        .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
      setSessions(sessionsData);

      // Fetch bookings for all sessions in batches
      const bMap: Record<string, Booking[]> = {};
      const sessionIds = sessionsData.map((s) => s.id);
      for (let i = 0; i < sessionIds.length; i += 30) {
        const batch = sessionIds.slice(i, i + 30);
        const bQuery = query(
          collection(db, 'bookings'),
          where('sessionId', 'in', batch),
          where('status', '==', 'confirmed')
        );
        const bSnap = await getDocs(bQuery);
        for (const d of bSnap.docs) {
          const booking = { id: d.id, ...d.data() } as Booking;
          if (!bMap[booking.sessionId]) bMap[booking.sessionId] = [];
          bMap[booking.sessionId].push(booking);
        }
      }
      setBookingsMap(bMap);

      // Load current announcement
      const announcementSnap = await getDoc(doc(db, 'announcements', 'current'));
      if (announcementSnap.exists() && announcementSnap.data().message) {
        setCurrentAnnouncement(announcementSnap.data() as Announcement);
      } else {
        setCurrentAnnouncement(null);
      }
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCancelSession = async () => {
    if (!cancelModal) return;
    try {
      await updateDoc(doc(db, 'sessions', cancelModal.id), {
        status: 'cancelled',
        cancelNote,
      });

      const sessionBookings = bookingsMap[cancelModal.id] || [];
      for (const booking of sessionBookings) {
        await addDoc(collection(db, 'notifications'), {
          userId: booking.userId,
          type: 'session_cancelled',
          title: 'Session Cancelled',
          message: `The ${formatTime(cancelModal.startTime)} session on ${formatDate(cancelModal.date)} has been cancelled.${cancelNote ? ` Note: ${cancelNote}` : ''}`,
          read: false,
          relatedSessionId: cancelModal.id,
          createdAt: new Date().toISOString(),
        });
      }

      addToast('Session cancelled', 'info');
      setCancelModal(null);
      setCancelNote('');
      await loadData();
    } catch {
      addToast('Failed to cancel session', 'error');
    }
  };

  const handleEditTime = (session: Session) => {
    setEditTimeSession(session);
    setEditStartTime(session.startTime);
    setEditEndTime(session.endTime);
  };

  const handleSaveTime = async () => {
    if (!editTimeSession) return;
    try {
      await updateDoc(doc(db, 'sessions', editTimeSession.id), {
        startTime: editStartTime,
        endTime: editEndTime,
      });

      // Notify booked users about the time change
      const sessionBookings = bookingsMap[editTimeSession.id] || [];
      for (const booking of sessionBookings) {
        await addDoc(collection(db, 'notifications'), {
          userId: booking.userId,
          type: 'session_time_changed',
          title: 'Session Time Changed',
          message: `The session on ${formatDate(editTimeSession.date)} has been moved to ${formatTime(editStartTime)} – ${formatTime(editEndTime)}.`,
          read: false,
          relatedSessionId: editTimeSession.id,
          createdAt: new Date().toISOString(),
        });
      }

      addToast('Session time updated', 'success');
      setEditTimeSession(null);
      await loadData();
    } catch {
      addToast('Failed to update session time', 'error');
    }
  };

  const handlePostAnnouncement = async () => {
    if (!announcement.trim() || !userData) return;
    try {
      await setDoc(doc(db, 'announcements', 'current'), {
        message: announcement.trim(),
        postedBy: userData.displayName,
        postedByUid: user?.uid,
        postedAt: new Date().toISOString(),
      });

      await addDoc(collection(db, 'notifications'), {
        userId: 'all',
        type: 'announcement',
        title: 'New Announcement',
        message: announcement.trim(),
        read: false,
        createdAt: new Date().toISOString(),
      });

      setCurrentAnnouncement({
        message: announcement.trim(),
        postedBy: userData.displayName,
        postedAt: new Date().toISOString(),
      });
      setAnnouncement('');
      addToast('Announcement posted', 'success');
    } catch {
      addToast('Failed to post announcement', 'error');
    }
  };

  const handleClearAnnouncement = async () => {
    try {
      await updateDoc(doc(db, 'announcements', 'current'), { message: deleteField(), postedBy: deleteField(), postedAt: deleteField() });
      setCurrentAnnouncement(null);
      addToast('Announcement cleared', 'info');
    } catch {
      addToast('Failed to clear announcement', 'error');
    }
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

  const getSessionColor = (session: Session) => {
    if (session.status === 'cancelled') return 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800';
    const pct = (session.bookingCount / session.maxCapacity) * 100;
    if (pct >= 80) return 'border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-950/30';
    if (pct >= 50) return 'border-yellow-200 dark:border-yellow-800 bg-yellow-50/30 dark:bg-yellow-950/30';
    return 'border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-950/30';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Coach Dashboard</h1>
        <Link
          to="/coach/slots"
          className="text-sm text-red-600 dark:text-red-500 hover:underline font-medium"
        >
          Manage Slots
        </Link>
      </div>

      {/* Announcement section */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Announcements</h2>
        {currentAnnouncement && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-3">
            <p className="text-sm text-red-800 dark:text-red-300">{currentAnnouncement.message}</p>
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-red-500">By {currentAnnouncement.postedBy}</p>
              <button
                onClick={handleClearAnnouncement}
                className="text-xs text-red-600 dark:text-red-500 hover:underline"
              >
                Clear
              </button>
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={announcement}
            onChange={(e) => setAnnouncement(e.target.value)}
            placeholder="Type an announcement..."
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
          <button
            onClick={handlePostAnnouncement}
            disabled={!announcement.trim()}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            Post
          </button>
        </div>
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevWeek} className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400">
          {formatDate(toISODate(weekDates[0]))} – {formatDate(toISODate(weekDates[6]))}
        </h2>
        <button onClick={nextWeek} className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {loading ? (
        <LoadingSkeleton count={4} />
      ) : sessions.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          <p className="text-lg font-medium">No sessions this week</p>
          <p className="text-sm mt-1">
            <Link to="/coach/slots" className="text-red-600 dark:text-red-500 hover:underline">Create slots</Link> first
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => {
            const sessionBookings = bookingsMap[session.id] || [];
            const isExpanded = expandedSession === session.id;

            return (
              <div
                key={session.id}
                className={`rounded-xl border p-4 transition-all ${getSessionColor(session)}`}
              >
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedSession(isExpanded ? null : session.id)}
                >
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">
                      {dayNames[new Date(session.date + 'T00:00:00').getDay()]} · {formatDate(session.date)}
                    </p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {formatTime(session.startTime)} – {formatTime(session.endTime)}
                    </p>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <div>
                      <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                        {session.bookingCount}/{session.maxCapacity}
                      </p>
                      {session.status === 'cancelled' && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">Cancelled</span>
                      )}
                    </div>
                    <svg
                      className={`w-5 h-5 text-gray-400 dark:text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    {/* Attendee list */}
                    {sessionBookings.length === 0 ? (
                      <p className="text-sm text-gray-400 dark:text-gray-500">No bookings yet</p>
                    ) : (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                          Attendees ({sessionBookings.length})
                        </p>
                        <div className="space-y-1">
                          {sessionBookings.map((booking) => (
                            <div
                              key={booking.id}
                              className="flex items-center gap-2 py-1"
                            >
                              <span className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-400">
                                {booking.userName.charAt(0).toUpperCase()}
                              </span>
                              <span className="text-sm text-gray-700 dark:text-gray-300">{booking.userName}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {session.status !== 'cancelled' && (
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditTime(session);
                          }}
                          className="flex-1 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                          Edit Time
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCancelModal(session);
                          }}
                          className="flex-1 py-2 text-sm font-medium text-red-600 dark:text-red-500 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                        >
                          Cancel Session
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Cancel modal */}
      {cancelModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Cancel Session</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Cancel the {formatTime(cancelModal.startTime)} session on {formatDate(cancelModal.date)}?
              Booked members will be notified.
            </p>
            <textarea
              value={cancelNote}
              onChange={(e) => setCancelNote(e.target.value)}
              placeholder="Reason (optional)"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent mb-4"
              rows={3}
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setCancelModal(null); setCancelNote(''); }}
                className="flex-1 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Keep
              </button>
              <button
                onClick={handleCancelSession}
                className="flex-1 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Cancel Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit time modal */}
      {editTimeSession && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Edit Session Time</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Change time for {formatDate(editTimeSession.date)}. Booked members will be notified.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start</label>
                <input
                  type="time"
                  value={editStartTime}
                  onChange={(e) => setEditStartTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End</label>
                <input
                  type="time"
                  value={editEndTime}
                  onChange={(e) => setEditEndTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setEditTimeSession(null)}
                className="flex-1 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTime}
                className="flex-1 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
