// ธีมแถบบน-ล่าง และขนาดตัวอักษร — จำค่าไว้ในเครื่อง (localStorage)
const KEY = 'closely-prefs';
export const THEMES = [['sky', 'ฟ้า', '#7DDCF0'], ['navy', 'กรมท่า', '#12234A'], ['teal', 'เขียวหัวเป็ด', '#0E5A63'], ['lavender', 'ลาเวนเดอร์', '#D2CCFF']];
export const FS_LABELS = ['ตัวอักษรเล็ก 12px', 'ตัวอักษรปกติ 14px', 'ตัวอักษรใหญ่ 16px'];

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
const p = read();
export const prefs = {
  theme: THEMES.some(t => t[0] === p.theme) ? p.theme : 'sky',
  fs: [0, 1, 2].includes(p.fs) ? p.fs : 1,
};
function save() { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* ใช้ได้แต่ไม่จำ */ } }

export function applyPrefs() {
  document.documentElement.dataset.chrome = prefs.theme;
  document.documentElement.dataset.fs = prefs.fs;
}
export function setTheme(k) { prefs.theme = k; save(); applyPrefs(); }
export function cycleFs() { prefs.fs = (prefs.fs + 1) % 3; save(); applyPrefs(); return FS_LABELS[prefs.fs]; }
