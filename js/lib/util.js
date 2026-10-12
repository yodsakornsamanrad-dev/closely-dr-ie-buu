// เครื่องมือเล็ก ๆ ที่ใช้ทั้งในเบราว์เซอร์และใน Node (ไม่แตะ DOM)

export const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const pad2 = n => String(n).padStart(2, '0');
export const pad3 = n => String(n).padStart(3, '0');
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// ตัวเลขที่ปลอดภัย: NaN / Infinity / ไม่ใช่ตัวเลข → ค่าสำรอง
export const num = (v, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback);

/** เวลา ISO 8601 พร้อม offset ของเครื่อง เช่น 2026-10-12T08:10:00+07:00 */
export function isoLocal(d = new Date()) {
  const off = -d.getTimezoneOffset(), sign = off >= 0 ? '+' : '-', a = Math.abs(off);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}${sign}${pad2(Math.floor(a / 60))}:${pad2(a % 60)}`;
}
export const hhmmOf = d => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
export const hhmm = t => `${pad2(Math.floor(t / 60))}:${pad2(Math.floor(t % 60))}`;
export const minutesBetween = (a, b) => {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Number.isFinite(ms) ? Math.max(0, ms / 60000) : 0;
};

const TH_DAY = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const TH_DAY_FULL = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const TH_MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
/** "จ. 12 ต.ค. 2569" (full: "จันทร์ 12 ต.ค. 2569") */
export function thaiDate(d, { full = false, year = true } = {}) {
  const day = (full ? TH_DAY_FULL : TH_DAY)[d.getDay()];
  return `${day} ${d.getDate()} ${TH_MON[d.getMonth()]}${year ? ' ' + (d.getFullYear() + 543) : ''}`;
}
/** "12 ต.ค." */
export const thaiShort = d => `${d.getDate()} ${TH_MON[d.getMonth()]}`;

/** แทน {name} ในข้อความ */
export const fill = (s, vars) => String(s ?? '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
