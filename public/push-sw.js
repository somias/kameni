/* eslint-disable no-undef */

const channel = new BroadcastChannel('push-messages');

self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { title: 'Boxing Cardio', body: event.data.text() };
    }
  }

  const title = data.title || 'Boxing Cardio';
  const body = data.body || '';

  // Relay to foreground
  channel.postMessage({ title, body });

  // Show OS notification only if no window is focused
  const promiseChain = self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((clients) => {
      const isFocused = clients.some((c) => c.visibilityState === 'visible');
      if (!isFocused) {
        return self.registration.showNotification(title, {
          body,
          icon: '/icon-192.svg',
          badge: '/icon-192.svg',
          data: { url: data.url || '/schedule' },
        });
      }
    });

  event.waitUntil(promiseChain);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/schedule';
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      })
  );
});
