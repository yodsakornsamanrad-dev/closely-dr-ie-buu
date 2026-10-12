// เลือกวิธีคุยกับข้อมูลอัตโนมัติ (คงแนวคิดจาก public/transport.js เดิม)
//  - server : มี Node server (npm start) → เรียก api/ และรับ real-time ผ่าน Server-Sent Events  → ไฟ "Live"
//  - local  : GitHub Pages ไม่มี server → รัน core ในเบราว์เซอร์ เก็บใน localStorage
//             แท็บอื่นในเบราว์เซอร์เดียวกันรู้ทันทีผ่าน BroadcastChannel                       → ไฟ "ในเครื่อง"
//  เชื่อม server ไม่ได้ / เครื่องไม่มีเน็ต                                                          → ไฟ "ออฟไลน์"
//  ?mode=local บังคับโหมด local (ใช้ทดสอบบนเครื่องที่รัน server อยู่)
import { loadData } from './lib/data.js';
import { createCore, initialState, validateState } from './lib/core.js';
import { usageLogYaml, parseImport } from './lib/usage-log.js';

const KEY = 'closely-state-v1';

async function readText(name) {
  const r = await fetch(name, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`โหลด ${name} ไม่ได้ (${r.status})`);
  return r.text();
}

async function detect() {
  if (new URLSearchParams(location.search).get('mode') === 'local') return 'local';
  try {
    // server-mode.json: ในไฟล์ static เป็น false, server.mjs ตอบ true (ไม่มี 404 ใน console บน GitHub Pages)
    const r = await fetch('server-mode.json', { cache: 'no-store' });
    if (r.ok && (await r.json()).server === true) return 'server';
  } catch { /* ไม่มี server */ }
  return 'local';
}

export async function connect() {
  const [D, mode] = await Promise.all([loadData(readText), detect()]);
  const changeFns = new Set(), statusFns = new Set();
  let state = null, status = mode === 'server' ? 'live' : 'local', memoryOnly = false;
  const emitChange = () => changeFns.forEach(fn => fn(state));
  const setStatus = s => { if (s !== status) { status = s; statusFns.forEach(fn => fn(s)); } };

  let act, exportYaml, importYaml;

  if (mode === 'local') {
    const read = () => {
      try { const raw = localStorage.getItem(KEY); return raw ? validateState(JSON.parse(raw)) : null; }
      catch { return null; }
    };
    const bc = 'BroadcastChannel' in window ? new BroadcastChannel('closely') : null;
    const store = {
      get: () => read() || state,
      set(next) {
        state = next;
        try { localStorage.setItem(KEY, JSON.stringify(next)); }
        catch { memoryOnly = true; } // private mode / พื้นที่เต็ม → ใช้ต่อได้แต่หายเมื่อปิดแท็บ
        bc?.postMessage({ type: 'changed', at: next.updated_at });
      },
    };
    state = read();
    if (!state) store.set(initialState(D));
    const core = createCore(D, store);
    const reload = () => { const s = read(); if (s) { state = s; emitChange(); } };
    bc?.addEventListener('message', reload);
    window.addEventListener('storage', e => { if (e.key === KEY) reload(); });
    act = async (type, payload) => {
      try { const { result } = core.act(type, payload); emitChange(); return result; }
      catch (e) { if (!e.status) console.error(e); throw new Error(e.status ? e.message : 'เกิดข้อผิดพลาด'); }
    };
    exportYaml = async () => usageLogYaml(D, state, { mode: 'no-server' });
    importYaml = async text => act('import', { state: parseImport(text) });
  } else {
    const fetchState = async () => {
      const r = await fetch('api/state', { cache: 'no-store' });
      if (!r.ok) throw new Error('โหลดข้อมูลไม่ได้');
      state = await r.json();
    };
    await fetchState();
    act = async (type, payload) => {
      let r;
      try { r = await fetch('api/act', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, payload }) }); }
      catch { setStatus('off'); throw new Error('เชื่อมต่อ server ไม่ได้ ลองใหม่อีกครั้ง'); }
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'เกิดข้อผิดพลาด');
      state = j.state; emitChange();
      return j.result;
    };
    const es = new EventSource('api/events');
    es.onopen = () => setStatus(navigator.onLine === false ? 'off' : 'live');
    es.onerror = () => setStatus('off');
    es.onmessage = async () => { try { await fetchState(); setStatus('live'); emitChange(); } catch { setStatus('off'); } };
    addEventListener('offline', () => setStatus('off'));
    addEventListener('online', () => { if (es.readyState === 1) setStatus('live'); });
    exportYaml = async () => { const r = await fetch('api/log.yaml', { cache: 'no-store' }); if (!r.ok) throw new Error('ดาวน์โหลดไม่ได้'); return r.text(); };
    importYaml = async text => act('import', { state: parseImport(text) });
  }

  return {
    D, mode,
    get state() { return state; },
    get status() { return status; },
    get memoryOnly() { return memoryOnly; },
    act,
    exportYaml, importYaml,
    onChange: fn => changeFns.add(fn),
    onStatus: fn => statusFns.add(fn),
  };
}

/** ดาวน์โหลดข้อความเป็นไฟล์ */
export function downloadText(text, filename, type = 'text/yaml;charset=utf-8') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
