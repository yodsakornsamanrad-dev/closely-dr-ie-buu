// แผ่นแจ้งเตือนเด้งจากด้านล่าง (bottom sheet) และ toast
import { IC } from './icons.js';
import { speak } from './voice.js';

let acts = {}, toastT, lastFocus = null;
const $ = id => document.getElementById(id);

export function showSheet({ tone = 'go', badge, title, body, actions, say = true }) {
  const sh = $('sheet');
  if (!sh.classList.contains('on')) lastFocus = document.activeElement;
  acts = {};
  sh.innerHTML = `<div class="grab"></div>${badge ? `<span class="sb t-${tone}" style="background:var(--b);color:var(--bi)">${IC.bell}${badge}</span>` : ''}
    <h2 id="sheetT">${title}</h2><p>${body}</p>
    <div class="acts">${actions.map((a, i) => { acts['s' + i] = a.fn; return `<button class="btn ${a.main ? 'main' : (a.cls || '')}" data-sheet="s${i}">${a.label}</button>`; }).join('')}</div>`;
  $('scrim').classList.add('on');
  sh.classList.add('on');
  sh.removeAttribute('aria-hidden');
  setTimeout(() => { const b = sh.querySelector('button'); b && b.focus(); }, 60);
  if (say) speak(title.replace(/<[^>]+>/g, '') + '. ' + body.replace(/<[^>]+>/g, ''));
  try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch { /* ไม่มีระบบสั่น */ }
}
export function closeSheet() {
  const sh = $('sheet');
  if (!sh.classList.contains('on')) return;
  $('scrim').classList.remove('on');
  sh.classList.remove('on');
  sh.setAttribute('aria-hidden', 'true');
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
}
export const sheetOpen = () => $('sheet').classList.contains('on');
export function runSheetAction(key) { const fn = acts[key]; if (fn) fn(); }

export function toast(t) {
  const el = $('toast');
  el.textContent = t;
  el.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('on'), 2200);
}

/** ให้ Tab วนอยู่ใน sheet ตอนเปิด */
export function trapFocus(e) {
  if (e.key !== 'Tab' || !sheetOpen()) return;
  const bs = [...$('sheet').querySelectorAll('button')];
  if (!bs.length) return;
  const first = bs[0], last = bs[bs.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  else if (!$('sheet').contains(document.activeElement)) { e.preventDefault(); first.focus(); }
}
