/* LottoSnap service worker — แคชเฉพาะ "เปลือกแอป" (หน้าเว็บ ไอคอน ไลบรารีจาก CDN) ให้เปิดได้เร็ว/ออฟไลน์
   ไม่แคชข้อมูลผลรางวัล (บอท / ผลหวย.com) — แอปเก็บผลล่าสุดไว้ใน localStorage อยู่แล้ว และต้องได้ผลใหม่เสมอ
   เปลี่ยน VERSION ทุกครั้งที่แก้ไฟล์เปลือกแอป เพื่อล้างแคชเก่า */
const VERSION = 'lottosnap-v1';
const SHELL = ['./', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest'];
const CDN_HOSTS = ['cdn.tailwindcss.com', 'cdn.jsdelivr.net', 'unpkg.com', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  // หน้าเว็บ: เอาจากเครือข่ายก่อน (ได้ฉบับใหม่เสมอ) รอไม่เกิน 4 วินาที แล้วใช้ฉบับแคช
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      try {
        const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 4000);
        const r = await fetch(req, { signal: ctl.signal }); clearTimeout(t);
        if (r.ok) cache.put('./', r.clone());
        return r;
      } catch (_) { return (await cache.match('./')) || (await cache.match(req)) || Response.error(); }
    })());
    return;
  }
  // ไลบรารี/ฟอนต์จาก CDN + ไฟล์ของแอปเอง (ไอคอน manifest): ใช้แคชก่อนแล้วอัปเดตเบื้องหลัง
  if (CDN_HOSTS.includes(url.hostname) || (url.origin === location.origin && /\.(png|webmanifest|svg|ico)$/.test(url.pathname))) {
    e.respondWith((async () => {
      const cache = await caches.open(VERSION), hit = await cache.match(req);
      const net = fetch(req).then(r => { if (r.ok || r.type === 'opaque') cache.put(req, r.clone()); return r }).catch(() => hit);
      return hit || net;
    })());
  }
  // อย่างอื่น (ข้อมูลผลรางวัล, API) ไม่แตะ — ผ่านไปตามปกติ
});
