import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from './firebase';
import type { PushSubscriptionJSON } from '../types';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray as Uint8Array<ArrayBuffer>;
}

async function getPushServiceWorker(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration('/push-handler/');
  if (existing) return existing;
  return navigator.serviceWorker.register('/push-sw.js', { scope: '/push-handler/' });
}

function serializeSubscription(sub: PushSubscription): PushSubscriptionJSON {
  const json = sub.toJSON();
  return {
    endpoint: json.endpoint!,
    keys: {
      p256dh: json.keys!.p256dh!,
      auth: json.keys!.auth!,
    },
  };
}

export async function requestNotificationPermission(userId: string): Promise<boolean> {
  try {
    if (!('PushManager' in window)) {
      console.error('Push API not supported in this browser');
      return false;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const sw = await getPushServiceWorker();
    const subscription = await sw.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    const serialized = serializeSubscription(subscription);

    await updateDoc(doc(db, 'users', userId), {
      pushSubscriptions: arrayUnion(serialized),
      notificationsEnabled: true,
    });

    return true;
  } catch (err) {
    console.error('Error requesting notification permission:', err);
    return false;
  }
}

export async function disableNotifications(userId: string): Promise<void> {
  try {
    const sw = await navigator.serviceWorker.getRegistration('/push-handler/');
    if (sw) {
      const subscription = await sw.pushManager.getSubscription();
      if (subscription) {
        const serialized = serializeSubscription(subscription);
        await subscription.unsubscribe();
        await updateDoc(doc(db, 'users', userId), {
          pushSubscriptions: arrayRemove(serialized),
          notificationsEnabled: false,
        });
        return;
      }
    }

    await updateDoc(doc(db, 'users', userId), {
      notificationsEnabled: false,
    });
  } catch (err) {
    console.error('Error disabling notifications:', err);
  }
}

export function onForegroundMessage(callback: (payload: { title?: string; body?: string }) => void): () => void {
  const channel = new BroadcastChannel('push-messages');

  const handler = (event: MessageEvent) => {
    callback({ title: event.data?.title, body: event.data?.body });
  };

  channel.addEventListener('message', handler);

  return () => {
    channel.removeEventListener('message', handler);
    channel.close();
  };
}
