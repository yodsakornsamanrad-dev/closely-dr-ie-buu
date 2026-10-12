'use strict';
// เลือกวิธีคุยกับข้อมูลอัตโนมัติ
//  - server : มี Node server (npm start / Render) → เรียก api/ และรับ real-time ผ่าน Server-Sent Events
//  - local  : GitHub Pages ไม่มี server → รัน core.js ในเบราว์เซอร์ เก็บข้อมูลใน localStorage
//             แท็บอื่นในเบราว์เซอร์เดียวกัน (เช่น แอปผู้ป่วย + หน้า staff) อัปเดตตามกันทันที
//             ดาวน์โหลด / นำเข้า db.yaml ได้จากหน้า staff
(function () {
  const KEY = 'closely-db-v1';
  const listeners = new Set();
  let mode = null, core = null, db = null, seedJson = null, yamlLib = null, memoryOnly = false;

  const yaml = async () => (yamlLib ||= await import(new URL('vendor/yaml/index.js', document.baseURI).href));

  async function detect() {
    if (new URLSearchParams(location.search).get('mode') === 'local') return 'local';
    try {
      const r = await fetch('api/config', { cache: 'no-store' });
      if (r.ok && (r.headers.get('content-type') || '').includes('json')) return 'server';
    } catch { /* ไม่มี server */ }
    return 'local';
  }

  function readSaved() {
    try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch { memoryOnly = true; } // private mode / storage เต็ม → ใช้ต่อได้แต่หายเมื่อปิดแท็บ
    listeners.forEach(fn => fn());
  }
  const freshSeed = () => CloselyCore.rebaseSeed(JSON.parse(seedJson));

  const ready = (async () => {
    mode = await detect();
    if (mode === 'server') return;
    const Y = await yaml();
    const r = await fetch('seed.yaml', { cache: 'no-store' });
    if (!r.ok) throw new Error('โหลด seed.yaml ไม่ได้');
    seedJson = JSON.stringify(Y.parse(await r.text()));
    db = readSaved();
    if (!db) { db = freshSeed(); persist(); }
    core = CloselyCore.createCore({
      get db() { return db; },
      set db(v) { db = v; },
      save() { db.meta.updatedAt = CloselyCore.now(); persist(); },
      seed: freshSeed,
    });
    // แท็บอื่นแก้ข้อมูล → โหลดใหม่
    window.addEventListener('storage', e => {
      if (e.key !== KEY) return;
      const next = readSaved();
      if (next) { db = next; listeners.forEach(fn => fn()); }
    });
  })();

  async function api(url, body) {
    await ready;
    url = url.replace(/^\/+/, '');
    if (mode === 'server') {
      const r = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'เกิดข้อผิดพลาด');
      return j;
    }
    const u = new URL(url, 'http://local/');
    try {
      // ส่ง JSON ไป-กลับ ให้พฤติกรรมเหมือนเรียก server จริง (UI แก้ object ไม่กระทบข้อมูล)
      const input = body ? JSON.parse(JSON.stringify(body)) : {};
      return JSON.parse(JSON.stringify(core.handle(body ? 'POST' : 'GET', u.pathname, input, u.searchParams)));
    } catch (e) {
      if (!e.status) console.error(e);
      throw new Error(e.status ? e.message : 'เกิดข้อผิดพลาด');
    }
  }

  // onStatus(state) : 'live' | 'offline' | 'local'
  async function subscribe(onChange, onStatus = () => {}) {
    await ready;
    if (mode === 'server') {
      const es = new EventSource('api/events');
      es.onopen = () => onStatus('live');
      es.onerror = () => onStatus('offline');
      es.onmessage = () => onChange();
    } else {
      listeners.add(onChange);
      onStatus('local');
    }
  }

  async function yamlText() {
    await ready;
    if (mode === 'server') return (await fetch('api/db.yaml', { cache: 'no-store' })).text();
    const Y = await yaml();
    return '# Closely DR. x IE BUU — ข้อมูลจากโหมด GitHub Pages (เก็บในเบราว์เซอร์)\n' + Y.stringify(db, { lineWidth: 0, aliasDuplicateObjects: false });
  }

  async function downloadYaml() {
    const blob = new Blob([await yamlText()], { type: 'text/yaml;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `closely-db-${CloselyCore.now().replace(/[:T]/g, '-')}.yaml`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function importYaml(text) {
    await ready;
    if (mode !== 'local') throw new Error('นำเข้า YAML ได้เฉพาะโหมด GitHub Pages (โหมด server ให้แก้ data/db.yaml โดยตรง)');
    const Y = await yaml();
    const next = Y.parse(text);
    for (const k of ['meta', 'settings', 'journey', 'departments', 'queues', 'stations', 'patients', 'visits']) {
      if (!next || !(k in next)) throw new Error(`ไฟล์ YAML ไม่มีหัวข้อ "${k}"`);
    }
    db = next;
    persist();
  }

  window.Closely = {
    ready, api, subscribe, downloadYaml, importYaml,
    get mode() { return mode; },
    get memoryOnly() { return memoryOnly; },
  };
})();
