// ความหนาแน่นของแต่ละจุด (แอปผู้ป่วยและหน้า staff), replay ทั้งวัน และคอขวด
import { chairsOf } from './iso3d.js';

export const ZONE_KEYS = ['reg', 'screen', 'med', 'ortho', 'eye', 'pharm', 'wc', 'cafe'];

/** ระดับความหนาแน่นจากจำนวนคน (แอปผู้ป่วย): 0 น้อย, 1 ปานกลาง, 2 คนเยอะ */
export const levelOf = (D, n) => { const [a, b] = D.floor.crowd.level_at; return n < a ? 0 : n < b ? 1 : 2; };
/** ระดับจากสัดส่วนที่นั่ง (หน้า staff) */
export const lvlRatio = (n, cap) => { const r = cap > 0 ? n / cap : 0; return r < 0.45 ? 0 : r < 0.85 ? 1 : 2; };
/** ความจุของโซน = จำนวนเก้าอี้ (ห้องน้ำ 6, ร้านกาแฟ 12) */
export const capOf = (D, k) => chairsOf(D, k).length || (k === 'wc' ? 6 : 12);

/**
 * จำนวนคน / เวลารอ / ระดับ ของทุกโซนตอนนี้
 * me = { id, dept, ahead, stage } ของผู้ป่วยในแอป (หรือ null สำหรับหน้า staff)
 */
export function crowdNow(D, state, me = null) {
  const c = D.floor.crowd, out = {};
  const live = { reg: 0, screen: 0, med: 0, ortho: 0, eye: 0, pharm: 0, wc: 0, cafe: 0 };
  for (const v of state?.visits || []) {
    if (me && v.id === me.id) continue;
    if (v.stage === 'vitals') live.screen++;
    else if (v.stage === 'waiting' && v.dept in live) live[v.dept]++;
    else if (v.stage === 'pharmacy' && v.rx !== 'delivery') live.pharm++;
  }
  for (const k of ZONE_KEYS) {
    let n = (c.base_people[k] || 0) + live[k], w = c.base_wait[k] || 0;
    if (k === 'screen') { if (me && me.stage === 'vitals') n = c.screen_busy + live.screen; w = Math.round(n * c.screen_wait_per_person); }
    if (me && k === me.dept) { n = me.ahead + c.after_you; w = me.ahead * D.app.minutes_per_queue; }
    const cap = capOf(D, k);
    out[k] = { n, w, lvl: levelOf(D, n), cap, rl: lvlRatio(n, cap) };
  }
  return out;
}

// ---------- replay: จำลองจำนวนคนตลอดวัน ----------
const gss = (x, mu, sd) => Math.exp(-0.5 * ((x - mu) / sd) ** 2);
/** วันหยุด (ย้อนหลัง 1–2 วัน = เสาร์อาทิตย์ในข้อมูลตัวอย่าง) คนน้อยกว่า */
export const dayAmp = day => (day === 1 || day === 2 ? 0.22 : 1) * (1 + 0.15 * Math.sin(day * 2.1 + 0.4));

export function simCD(D, t, day) {
  const h = t / 60, A = dayAmp(day), out = {};
  for (const [k, z] of Object.entries(D.floor.replay.zones)) {
    const noise = 1 + 0.12 * Math.sin(t / 7 + k.length * 1.3 + day * 2);
    const n = Math.max(0, Math.round((z.b + z.p * (gss(h, 8.9 + z.lag, 1.3) + 0.45 * gss(h, 13.1 + z.lag, 0.8))) * A * noise));
    const cap = capOf(D, k);
    out[k] = { n, cap, w: z.svc ? Math.round(n * z.svc / z.sv) : 0, lvl: lvlRatio(n, cap), rl: lvlRatio(n, cap) };
  }
  return out;
}
/** อัตราผู้ป่วยมาถึง (คน/นาที) */
export const arrivalRate = (t, day) => 1.6 * dayAmp(day) * (gss(t / 60, 8.6, 1.2) + 0.45 * gss(t / 60, 12.8, 0.8));
/** จำนวนผู้ป่วยสะสมที่มาถึงตั้งแต่เปิด (07:00) จนถึงนาที t */
export function cumArrivals(t, day, open = 420) {
  let a = 0;
  for (let m = open; m < t; m += 1) a += arrivalRate(m, day);
  return Math.round(a);
}

/** ตัวเลข 4 ช่องบนหน้า staff */
export function staffKpi(D, cd, homeToday) {
  const svc = D.floor.replay.service_zones.map(k => cd[k]);
  const inHospital = Object.values(cd).reduce((a, c) => a + c.n, 0);
  const waiting = svc.reduce((a, c) => a + c.n, 0);
  const avgWait = waiting ? Math.round(svc.reduce((a, c) => a + c.w * c.n, 0) / waiting) : 0;
  const cap = svc.reduce((a, c) => a + c.cap, 0);
  const density = cap ? Math.round(waiting / cap * 100) : 0;
  return { inHospital, avgWait, density, densityLevel: density < 45 ? 0 : density < 85 ? 1 : 2, home: homeToday };
}

/** จุดที่รอนานที่สุด ถ้ารอเกินเกณฑ์ = คอขวด พร้อมข้อเสนอ */
export function bottleneck(D, cd) {
  const keys = D.floor.replay.service_zones;
  const worst = keys.slice().sort((a, b) => cd[b].w - cd[a].w)[0];
  const c = cd[worst], b = D.floor.bottleneck;
  return { key: worst, wait: c.w, n: c.n, cap: c.cap, isBottleneck: c.w >= b.wait_min, tip: b.tips[worst] || '' };
}
