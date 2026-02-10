import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  updateDoc,
  writeBatch,
  or,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import type { Notification } from '../types';
import { useMemo } from 'react';

export function useNotifications() {
  const { user, userData } = useAuth();
  const [allNotifications, setAllNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!user) {
      setAllNotifications([]);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      or(
        where('userId', '==', user.uid),
        where('userId', '==', 'all')
      ),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notification));
      setAllNotifications(items);
    }, (err) => {
      // Index not yet created — log the error which contains the index creation link
      console.error('Notifications query error (create the index via the link below):', err);
      setAllNotifications([]);
    });

    return unsubscribe;
  }, [user]);

  // Hide announcement notifications for the coach (they posted them)
  const notifications = useMemo(() => {
    if (userData?.role === 'coach') {
      return allNotifications.filter((n) => n.type !== 'announcement');
    }
    return allNotifications;
  }, [allNotifications, userData?.role]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = async (notificationId: string) => {
    await updateDoc(doc(db, 'notifications', notificationId), { read: true });
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;
    const batch = writeBatch(db);
    unread.forEach((n) => {
      batch.update(doc(db, 'notifications', n.id), { read: true });
    });
    await batch.commit();
  };

  return { notifications, unreadCount, markAsRead, markAllAsRead };
}
