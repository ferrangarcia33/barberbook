const SUPABASE_URL = 'https://hepoqufpnmnrddrvqjwc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhlcG9xdWZwbm1ucmRkcnZxandjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyMjgwNzEsImV4cCI6MjA5MzgwNDA3MX0.iCLvHJQ_X7ru5neNpZazGZFf5ZCO3CL-SriQh1cQwVA';

self.addEventListener('fetch', e => {
  e.respondWith(fetch(e.request));
});

self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  const isLateCheck = data.type === 'lateCheck' && !!data.apptId;
  const options = {
    body: (data.body || '').replace(/<[^>]*>/g, ''),
    icon: '/icon.svg',
    tag: isLateCheck ? ('late-check-' + data.apptId) : undefined,
    data: { apptId: data.apptId || null }
  };
  if (isLateCheck) {
    options.actions = [
      { action: 'yes', title: 'Sí, llegó' },
      { action: 'no', title: 'No llegó' }
    ];
  }
  e.waitUntil(self.registration.showNotification(data.title || 'BarberBook ✂️', options));
});

self.addEventListener('notificationclick', e => {
  const apptId = e.notification.data && e.notification.data.apptId;
  e.notification.close();

  if ((e.action === 'yes' || e.action === 'no') && apptId) {
    e.waitUntil(
      Promise.all([
        // Fast path: tell any open app window to update immediately.
        clients.matchAll({ type: 'window' }).then(list => {
          list.forEach(c => c.postMessage({ type: 'LATE_CHECK_ANSWER', apptId: apptId, answer: e.action }));
        }),
        // Durable path: persist the answer server-side so a closed app picks it
        // up on next open via _processPendingPushAnswers().
        fetch(SUPABASE_URL + '/rest/v1/late_checks_pending?id=eq.' + apptId, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_KEY,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ done: true, answer: e.action })
        }).catch(() => {})
      ])
    );
    return;
  }

  e.waitUntil(clients.openWindow('/'));
});
