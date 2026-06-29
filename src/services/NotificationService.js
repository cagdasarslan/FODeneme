import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

// Yerel bildirimler — oyuncuyu geri çağırmak için (ahır, günlük ödül, seri).
// Web'de no-op; yalnızca native cihazda çalışır.
const isNative = Capacitor.getPlatform() !== 'web';
let permGranted = false;

export async function initNotifications() {
  if (!isNative) return;
  try {
    const res = await LocalNotifications.requestPermissions();
    permGranted = res.display === 'granted';
  } catch (e) { console.warn('[Notif] perm failed:', e); }
}

function atHour(daysFromNow, hour = 19) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  // geçmişse bir sonraki güne kaydır
  if (d.getTime() < Date.now() + 60000) d.setDate(d.getDate() + 1);
  return d;
}

// Tüm hatırlatmaları (yeniden) planla. Uygulama arka plana alınınca çağrılır.
export async function scheduleReminders({ hasFoals = false } = {}) {
  if (!isNative || !permGranted) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: 1 }, { id: 2 }, { id: 3 }] });
    const notifications = [
      {
        id: 1,
        title: '🎁 Günlük ödülün hazır!',
        body: 'Giriş serini sürdür ve havuçlarını topla.',
        schedule: { at: atHour(1, 19) },
      },
      {
        id: 2,
        title: '🔥 Serini kaçırma!',
        body: 'Bugün oynamazsan giriş serin sıfırlanır.',
        schedule: { at: atHour(1, 21) },
      },
    ];
    if (hasFoals) {
      notifications.push({
        id: 3,
        title: '🐴 Tayın seni özledi!',
        body: 'Ahırdaki tayını besle ve tımarla, büyümesi için sana ihtiyacı var.',
        schedule: { at: atHour(0, 12) },
      });
    }
    await LocalNotifications.schedule({ notifications });
  } catch (e) { console.warn('[Notif] schedule failed:', e); }
}
