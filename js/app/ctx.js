// สถานะที่ใช้ร่วมกันระหว่างหน้าจอของแอปผู้ป่วย + ตัวช่วยสร้าง HTML
import { esc, fill, addDays, thaiDate, thaiShort, hhmmOf } from '../lib/util.js';
import { aheadOf, queueLabel } from '../lib/queue.js';
import { IC, ASME } from '../ui/icons.js';

/** C.T = transport, C.D = ข้อมูลอ้างอิง, C.U = สถานะหน้าจอของเครื่องนี้ */
export const C = { T: null, D: null, U: null };

const SESSION_KEY = 'closely-session';
export function freshUI(keep = {}) {
  return {
    screen: 'login', regStep: 1, reg: { dept: null, name: '', phone: '', sym: [] }, regStartedAt: null,
    lookupOpen: false, lookupPhone: '', lgName: '', face: null, otpOpen: false,
    tab: 'now', navTo: null, mapMode: '2d', addrOpen: false, addr: C.D?.app.default_address || '',
    feelAsk: null, feelScore: null, feelReasons: [],
    care: { view: 'main', qStep: 0, ans: {}, draft: '' },
    visitId: null, logged: false, seenResult: null, chatSeen: 0,
    ...keep,
  };
}
export function loadSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || {}; } catch { return {}; }
}
export function saveSession() {
  const U = C.U;
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ visitId: U.visitId, logged: U.logged, name: U.reg.name, phone: U.reg.phone, seenResult: U.seenResult, chatSeen: U.chatSeen })); } catch { /* ไม่จำ */ }
}

// ---------- ข้อมูลของผู้ป่วยบนเครื่องนี้ ----------
export const visit = () => (C.U.visitId && C.T.state.visits.find(x => x.id === C.U.visitId)) || null;
export const deptKey = () => visit()?.dept || (C.U.reg.dept && C.U.reg.dept !== C.D.unsure.key ? C.U.reg.dept : C.D.unsure.fallback);
export const dept = () => C.D.depts[deptKey()];
export const calling = () => C.T.state.queues[deptKey()]?.calling ?? 0;
export const callText = () => queueLabel(dept(), calling());
export const ahead = () => { const v = visit(); return v ? aheadOf(v.qn, calling()) : 0; };
export const qText = () => visit()?.queue || '';
export const stIdx = k => C.D.stages.findIndex(s => s.key === k);
export const stage = k => C.D.stages.find(s => s.key === k);
export const template = () => { const v = visit(); return v?.result ? C.D.template(v.result.id) : null; };
export const spell = t => String(t).split('').join(' ');

/** จุดที่ต้องไปต่อตามขั้นตอนตอนนี้ */
export function nextTarget(v = visit()) {
  switch (v?.stage) {
    case 'vitals': return 'screen';
    case 'waiting': return 'front';
    case 'consult': return 'exam';
    case 'pharmacy': return v.rx === 'delivery' ? 'entrance' : 'pharm';
    default: return 'entrance';
  }
}

// ---------- วันที่ของการติดตาม ----------
const baseDate = v => new Date(v?.result?.at || Date.now());
export function followDate(v = visit()) {
  const f = C.D.care.followup, d = addDays(new Date(v?.care.decided_at || Date.now()), f.days_after);
  return { date: `${thaiDate(d, { full: true })} เวลา ${f.time}`, short: thaiShort(d), note: f.note,
    rem: [...f.reminders_days_before.map(n => `${n} วันก่อนนัด (${thaiDate(addDays(d, -n), { year: false })})`), `เช้าวันนัด ${f.reminder_morning} พร้อมเตือนงดอาหาร`] };
}
export const refillDate = (round, v = visit()) => thaiDate(addDays(baseDate(v), C.D.care.refill_every_days * round));
export const quizDue = (v = visit()) => thaiDate(addDays(baseDate(v), C.D.care.quiz.due_days), { year: false });
export function phaseText(phase, who = 'patient', v = visit()) {
  return fill(C.D.care.phases[phase][who], { date: followDate(v).short });
}
/** ช่วงเวลาที่ยาจะถึงบ้าน เช่น 10:35–11:05 */
export function deliveryWindow(v = visit()) {
  const t = new Date(v?.rx_at || Date.now()), [a, b] = C.D.app.delivery.window_min;
  return `${hhmmOf(new Date(t.getTime() + a * 60000))}–${hhmmOf(new Date(t.getTime() + b * 60000))}`;
}

// ---------- HTML ----------
export const sayBtn = (text, label = 'ฟัง', cls = 'say') => `<button class="${cls}" data-act="speak" data-say="${esc(text)}" aria-label="${esc(label)}: อ่านออกเสียง">${IC.speak}<span>${label}</span></button>`;

export function ticket(tone, label, sym, sayText, inner) {
  return `<section class="ticket t-${tone}" aria-label="สถานะตอนนี้: ${esc(label)}">
    <div class="band"><span class="lbl"><span class="sym">${ASME[sym].replace('<svg', '<svg style="stroke:currentColor;fill:none;stroke-width:3"')}</span>${label}</span>${sayBtn(sayText)}</div>
    <div class="tbody">${inner}</div></section>`;
}

/** ข้อความแชทที่ถึงเวลาแสดงแล้ว (คำตอบหมอจำลองตั้งเวลาไว้ล่วงหน้า) */
export function visibleChat(v = visit(), now = Date.now()) {
  return (v?.chat || []).filter(m => Date.parse(m.at) <= now);
}
export const doctorTyping = (v = visit(), now = Date.now()) => (v?.chat || []).some(m => Date.parse(m.at) > now);
export function unreadCount(v = visit()) {
  const shown = visibleChat(v);
  return shown.slice(C.U.chatSeen).filter(m => m.from === 'doc').length;
}
