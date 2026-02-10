import { doc, runTransaction, collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { Session, Booking } from '../types';

export function useBooking() {
  const { user, userData } = useAuth();
  const { addToast } = useToast();

  const bookSession = async (session: Session) => {
    if (!user || !userData) return;

    const sessionRef = doc(db, 'sessions', session.id);
    const bookingId = `${user.uid}_${session.id}`;
    const bookingRef = doc(db, 'bookings', bookingId);

    try {
      await runTransaction(db, async (transaction) => {
        const sessionSnap = await transaction.get(sessionRef);
        if (!sessionSnap.exists()) throw new Error('Trening nije pronađen');

        const sessionData = sessionSnap.data();
        if (sessionData.status === 'cancelled') throw new Error('Trening je otkazan');
        if (sessionData.bookingCount >= sessionData.maxCapacity) throw new Error('Trening je popunjen');

        const booking: Omit<Booking, 'id'> = {
          userId: user.uid,
          userName: userData.displayName,
          sessionId: session.id,
          sessionDate: session.date,
          sessionStartTime: session.startTime,
          sessionEndTime: session.endTime,
          sessionLocation: session.location,
          status: 'confirmed',
          checkedIn: false,
          createdAt: new Date().toISOString(),
        };

        transaction.set(bookingRef, booking);
        transaction.update(sessionRef, {
          bookingCount: sessionData.bookingCount + 1,
        });
      });

      // Create in-app notification
      await addDoc(collection(db, 'notifications'), {
        userId: user.uid,
        type: 'booking_confirmed',
        title: 'Rezervacija potvrđena',
        message: `Vaš trening u ${session.startTime} dana ${session.date} je rezervisan!`,
        read: false,
        relatedSessionId: session.id,
        createdAt: new Date().toISOString(),
      });

      addToast('Trening uspješno rezervisan!', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Rezervacija nije uspjela';
      addToast(message, 'error');
    }
  };

  const cancelBooking = async (booking: Booking) => {
    if (!user) return;

    const bookingRef = doc(db, 'bookings', booking.id);
    const sessionRef = doc(db, 'sessions', booking.sessionId);

    try {
      let wasAtCapacity = false;

      await runTransaction(db, async (transaction) => {
        const sessionSnap = await transaction.get(sessionRef);
        if (!sessionSnap.exists()) throw new Error('Trening nije pronađen');

        const sessionData = sessionSnap.data();
        wasAtCapacity = sessionData.bookingCount >= sessionData.maxCapacity;

        transaction.update(bookingRef, { status: 'cancelled' });
        transaction.update(sessionRef, {
          bookingCount: Math.max(0, sessionData.bookingCount - 1),
        });
      });

      // Spot available notification
      if (wasAtCapacity) {
        await addDoc(collection(db, 'notifications'), {
          userId: 'all',
          type: 'spot_available',
          title: 'Mjesto slobodno',
          message: `Oslobodilo se mjesto za trening u ${booking.sessionStartTime} dana ${booking.sessionDate}!`,
          read: false,
          relatedSessionId: booking.sessionId,
          createdAt: new Date().toISOString(),
        });
      }

      addToast('Rezervacija otkazana', 'info');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Otkazivanje rezervacije nije uspjelo';
      addToast(message, 'error');
    }
  };

  return { bookSession, cancelBooking };
}
