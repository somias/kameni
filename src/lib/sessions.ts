import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { toISODate } from './utils';
import type { Slot, Session } from '../types';

export async function generateSessionsForWeek(slots: Slot[], weekStartDate: Date): Promise<void> {
  const weekDates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStartDate);
    d.setDate(d.getDate() + i);
    weekDates.push(d);
  }

  const promises: Promise<void>[] = [];

  for (const slot of slots) {
    if (!slot.active) continue;

    // weekStartDate is Monday (1), so we need to map dayOfWeek correctly
    // Monday=1, Tuesday=2, ..., Sunday=0
    // weekDates[0]=Monday, weekDates[1]=Tuesday, ..., weekDates[6]=Sunday
    let dateIndex: number;
    if (slot.dayOfWeek === 0) {
      dateIndex = 6; // Sunday is last
    } else {
      dateIndex = slot.dayOfWeek - 1; // Monday=0, Tuesday=1, etc.
    }

    const sessionDate = weekDates[dateIndex];
    if (!sessionDate) continue;

    const dateStr = toISODate(sessionDate);
    const sessionId = `${slot.id}_${dateStr}`;
    const sessionRef = doc(db, 'sessions', sessionId);

    promises.push(
      getDoc(sessionRef).then(async (snap) => {
        if (!snap.exists()) {
          const session: Omit<Session, 'id'> = {
            slotId: slot.id,
            date: dateStr,
            startTime: slot.startTime,
            endTime: slot.endTime,
            location: slot.location,
            maxCapacity: slot.maxCapacity,
            bookingCount: 0,
            status: 'scheduled',
            createdAt: new Date().toISOString(),
          };
          await setDoc(sessionRef, session);
        }
      })
    );
  }

  await Promise.all(promises);
}
