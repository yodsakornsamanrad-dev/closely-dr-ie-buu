'use strict';
// Closely DR. x IE BUU — แอปผู้ป่วย (prototype)
// หลักการ: หน้า "ตอนนี้" บอกสิ่งเดียวที่ต้องทำต่อไป สีของแผงคือสถานะ (Andon)
// เส้นทางการรักษาแสดงเป็น flow process chart ตามสัญลักษณ์ ASME ของวิศวกรรมอุตสาหการ

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* private mode */ } },
};
const api = (url, body) => Closely.api(url, body); // transport.js: server หรือโหมด GitHub Pages
const pad = n => String(n).padStart(2, '0');
const localNow = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
const minutesBetween = (a, b) => Math.max(0, Math.round((new Date(b) - new Date(a)) / 60000));
const fmtMin = m => m >= 60 ? `${Math.floor(m / 60)} ชม. ${m % 60} นาที` : `${m} นาที`;

// ---------- icons ----------
const ICON = {
  speaker: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
  nav: '<path d="M12 3l7 18-7-4.5L5 21z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
  home: '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>',
  counter: '<path d="M3 10h18M5 10v10h14V10M8 4h8l2 6H6z"/>',
};
const ic = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;

// ASME flow process chart symbols
const SYMBOL = {
  operation: '<circle class="shape" cx="14" cy="14" r="10"/>',
  inspection: '<rect class="shape" x="4.5" y="4.5" width="19" height="19"/>',
  delay: '<path class="shape" d="M5 4.5h9a9.5 9.5 0 0 1 0 19H5z"/>',
  transport: '<path class="shape" d="M3 10.5h13V5l9 9-9 9v-5.5H3z"/>',
  storage: '<path class="shape" d="M4 5h20L14 23z"/>',
};
const sym = name => `<svg class="sym" viewBox="0 0 28 28" aria-hidden="true">${SYMBOL[name] || SYMBOL.operation}</svg>`;
const SYMBOL_NAME = { operation: 'ปฏิบัติงาน', inspection: 'ตรวจ', delay: 'รอ', transport: 'เดิน' };
const DEFAULT_SYMBOL = { register: 'operation', vitals: 'inspection', waiting: 'delay', consult: 'operation', pharmacy: 'operation', done: 'transport' };

const TIMES = [
  ['morning', 'เช้า', '<path d="M3 18h18M7 18a5 5 0 0 1 10 0M12 6v3M5.5 10.5l1.8 1.8M18.5 10.5l-1.8 1.8"/>'],
  ['noon', 'กลางวัน', '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>'],
  ['evening', 'เย็น', '<path d="M3 18h18M7 18a5 5 0 0 1 10 0M12 4v5M9.5 6.5L12 9l2.5-2.5"/>'],
  ['bedtime', 'ก่อนนอน', '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/>'],
];
const MEAL = { before: 'ก่อนอาหาร 30 นาที', after: 'หลังอาหาร', any: 'เวลาไหนก็ได้' };
const FACES = [[1, '😣', 'แย่มาก'], [2, '🙁', 'ไม่ดี'], [3, '😐', 'เฉย ๆ'], [4, '🙂', 'ดี'], [5, '😀', 'ดีมาก']];
const SYMPTOMS = ['มีไข้', 'ไอ', 'ปวดหัว', 'เวียนหัว', 'ปวดเข่า', 'ปวดหลัง', 'ตามัว', 'มาตามนัด'];

const S = {
  cfg: null, board: [], visit: null, visitId: null,
  screen: 'home', tab: 'now', reg: null, lookup: false, lookupErr: '',
  prev: null, pickMode: null, pickErr: '', altDest: null, fb: null, skipFb: new Set(), dirty: false,
};

const st = id => S.cfg.stations.find(s => s.id === id);
const stageOf = key => S.cfg.journey.find(j => j.key === key);
const stageIdx = key => S.cfg.journey.findIndex(j => j.key === key);
const stageStation = (v, key) => { const s = stageOf(key)?.station; return s === 'DEPT' ? v.deptInfo.station : s; };
const here = v => st(v.location) || st('ENT');

// ---------- speech, toast, alert ----------
function speak(text) {
  if (!('speechSynthesis' in window)) return toast('อุปกรณ์นี้อ่านออกเสียงไม่ได้');
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'th-TH'; u.rate = 0.85;
  speechSynthesis.speak(u);
}
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 3200);
}
// แจ้งเตือนแบบแผง Andon เลื่อนขึ้นจากด้านล่าง สีเดียวกับสถานะ
function alertBox(tone, title, body, withNav = false) {
  const m = $('#modal');
  m.innerHTML = `<section class="andon ${tone}" role="alertdialog" aria-labelledby="mt" aria-describedby="mb">
      <div class="andon-top"><span></span><button class="speak" data-act="say" data-text="${esc(title + ' ' + body)}" aria-label="ฟังอีกครั้ง">${ic('speaker')}</button></div>
      <div class="andon-title" id="mt">${esc(title)}</div>
      <p class="andon-note" id="mb">${esc(body)}</p>
      <div class="andon-actions">
        ${withNav ? `<button class="btn lg" data-act="go-route">${ic('nav')}นำทาง</button>` : ''}
        <button class="btn ${withNav ? 'line' : 'lg'}" data-act="close-modal">รับทราบ</button>
      </div></section>`;
  m.hidden = false;
  $('#modal .btn').focus();
  if (navigator.vibrate) navigator.vibrate([300, 120, 300]);
  speak(title + ' ' + body);
}

// ---------- data ----------
async function refresh() {
  try {
    const [cfg, board] = await Promise.all([api('/api/config'), api('/api/board')]);
    S.cfg = cfg; S.board = board;
    if (S.visitId) {
      try { S.visit = await api('/api/visit/' + encodeURIComponent(S.visitId)); }
      catch { setVisit(null); }
    }
    notifyChanges();
    render();
  } catch {
    toast('เชื่อมต่อไม่ได้ ลองเปิดแอปใหม่อีกครั้ง');
  }
}

function setVisit(v) {
  S.visit = v; S.visitId = v ? v.id : null; S.prev = null;
  store.set('visitId', S.visitId);
}

function notifyChanges() {
  const v = S.visit;
  if (!v) { S.prev = null; return; }
  const p = S.prev;
  S.prev = { id: v.id, stage: v.stage, ahead: v.queue.ahead, ds: v.medPickup && v.medPickup.status };
  if (!p || p.id !== v.id) return;
  const near = S.cfg.settings.nearQueueAlert ?? 2;
  const room = st(v.target)?.name || '';
  if (p.stage !== v.stage) {
    S.altDest = null; S.pickMode = null;
    const msg = {
      waiting: ['wait', 'คัดกรองเสร็จแล้ว', `ไปนั่งรอหน้า${room} แอปจะเตือนเมื่อใกล้ถึงคิว`, true],
      consult: ['go', 'ถึงคิวคุณแล้ว', `คิว ${v.queueLabel} เข้า${room}ได้เลย`, true],
      pharmacy: ['act', 'พบแพทย์เสร็จแล้ว', 'เลือกได้ว่าจะรับยาที่ห้องยา หรือให้ส่งถึงบ้าน', false],
      done: ['done', 'เสร็จสิ้นวันนี้', 'ขอให้หายไว ๆ ดูวิธีกินยาได้ที่เมนูผลและยา', false],
    }[v.stage];
    if (msg) { S.tab = 'now'; alertBox(...msg); }
  } else if (v.stage === 'waiting' && p.ahead > near && v.queue.ahead <= near) {
    alertBox('wait', `อีก ${v.queue.ahead} คิวถึงคุณ`, `กลับมารอหน้า${room}ได้แล้ว`, v.location !== v.target);
  } else if (p.ds !== S.prev.ds && v.medPickup?.mode === 'delivery') {
    const s = S.cfg.settings.deliverySteps.find(x => x.key === v.medPickup.status);
    if (s) toast(s.label);
  }
}

// ---------- routing on the floor map ----------
function door(s) {
  const cy = S.cfg.settings.corridorY;
  return { x: s.x + s.w / 2, y: s.y + s.h < cy ? s.y + s.h : s.y };
}
function route(from, to) {
  const cy = S.cfg.settings.corridorY;
  const a = door(from), b = door(to);
  let pts = [a, { x: a.x, y: cy }, { x: b.x, y: cy }, b];
  pts = pts.filter((p, i) => i === 0 || p.x !== pts[i - 1].x || p.y !== pts[i - 1].y);
  pts = pts.filter((p, i) => { // ตัดจุดที่อยู่แนวเดียวกัน
    if (i === 0 || i === pts.length - 1) return true;
    const q = pts[i - 1], r = pts[i + 1];
    return (p.x - q.x) * (r.y - p.y) - (p.y - q.y) * (r.x - p.x) !== 0;
  });
  const segs = [];
  for (let i = 1; i < pts.length; i++) segs.push({ dx: pts[i].x - pts[i - 1].x, dy: pts[i].y - pts[i - 1].y, len: Math.round(Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)) });
  const steps = segs.map((s, i) => {
    if (i === 0) return `ออกจาก${from.short} เดินตรงไป ${s.len} เมตร`;
    const p = segs[i - 1];
    return `เลี้ยว${p.dx * s.dy - p.dy * s.dx > 0 ? 'ขวา' : 'ซ้าย'} เดินตรงไป ${s.len} เมตร`;
  });
  steps.push(`ถึง${to.name} สังเกต${to.landmark}`);
  const dist = segs.reduce((n, s) => n + s.len, 0);
  return { pts, steps, dist, min: Math.max(1, Math.ceil(dist / S.cfg.settings.walkingSpeedMps / 60)) };
}
function mapSvg(from, to, r) {
  const { width: W, height: H } = S.cfg.settings.map;
  const cy = S.cfg.settings.corridorY;
  const rooms = S.cfg.stations.map(s => {
    const isTo = s.id === to.id, isFrom = s.id === from.id;
    const fill = isTo ? '#0057B8' : '#FFFFFF';
    const ink = isTo ? '#FFFFFF' : isFrom ? '#1C2733' : '#55606B';
    return `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" fill="${fill}" stroke="#1C2733" stroke-width="${isTo || isFrom ? 0.5 : 0.25}"/>
      <text x="${s.x + s.w / 2}" y="${s.y + s.h / 2 + 0.7}" font-size="${Math.min(2, (s.w - 0.8) / (s.short.length * 0.62)).toFixed(2)}" text-anchor="middle" font-weight="${isTo ? 700 : 600}" fill="${ink}">${esc(s.short)}</text>`;
  }).join('');
  const line = r.pts.map(p => `${p.x},${p.y}`).join(' ');
  const a = r.pts[0];
  return `<svg class="map" viewBox="0 0 ${W} ${H}" role="img" aria-label="แผนผังทางเดินจาก${esc(from.name)}ไป${esc(to.name)}" font-family="IBM Plex Sans Thai Looped, sans-serif">
    <rect x="0" y="${cy - 4}" width="${W}" height="8" fill="#E9EBE7"/>
    ${rooms}
    <polyline points="${line}" fill="none" stroke="#0057B8" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${a.x}" cy="${a.y}" r="1.7" fill="#1C2733" stroke="#fff" stroke-width="0.5"/>
    <text x="${a.x + 2.4}" y="${a.y - 1.4}" font-size="1.8" font-weight="700" fill="#1C2733">คุณ</text>
  </svg>`;
}

// ---------- render ----------
function render() {
  const view = $('#view');
  const a = document.activeElement;
  if (a && view.contains(a) && /INPUT|TEXTAREA/.test(a.tagName)) { S.dirty = true; return; } // ไม่รีเฟรชระหว่างพิมพ์
  S.dirty = false;
  const tabs = $('#tabs');
  if (S.screen === 'register') view.innerHTML = viewRegister();
  else if (!S.visit) view.innerHTML = viewHome();
  else view.innerHTML = { now: viewNow, route: viewRoute, care: viewCare }[S.tab](S.visit);
  tabs.hidden = !(S.visit && S.screen !== 'register');
  if (!tabs.hidden) {
    const v = S.visit;
    for (const b of tabs.querySelectorAll('button')) {
      const on = b.dataset.tab === S.tab;
      on ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current');
      b.querySelector('.badge')?.remove();
      const unseen = b.dataset.tab === 'care' && v.diagnosis && !store.get('seen-care-' + v.id);
      if (unseen && !on) b.insertAdjacentHTML('beforeend', '<i class="badge" aria-label="มีผลตรวจใหม่"></i>');
    }
    if (S.tab === 'care' && v.diagnosis) store.set('seen-care-' + v.id, '1');
  }
}

// ----- home -----
function viewHome() {
  const local = Closely.mode === 'local';
  return `<section class="pad">
      <h1>รับคิวโรงพยาบาล</h1>
      <p class="muted">ดูคิว ทางเดิน ผลตรวจ และยา ได้ในที่เดียว</p>
      <div class="stack">
        <button class="btn lg" data-act="start-reg">รับคิว</button>
        ${S.lookup ? `<label for="lookup-phone" class="muted">เบอร์โทรที่ใช้รับคิว</label>
          <input id="lookup-phone" class="field num" type="tel" inputmode="numeric" maxlength="10" placeholder="08xxxxxxxx" autocomplete="tel">
          ${S.lookupErr ? `<p class="err">${esc(S.lookupErr)}</p>` : ''}
          <div class="row"><button class="btn line" data-act="lookup-cancel">ยกเลิก</button><button class="btn" data-act="lookup-go">ค้นหาคิว</button></div>
          <p class="muted small">ลองเบอร์ตัวอย่าง 0810000003</p>`
        : '<button class="btn line" data-act="lookup">มีคิวแล้ว ค้นหาด้วยเบอร์โทร</button>'}
      </div></section>
    <section class="pad">
      <h2>คิวที่กำลังเรียก</h2>
      <ul class="board">${S.board.map(b => `<li><b>${esc(b.name)}</b><span class="now">${esc(b.nowServing)}</span>
        <span class="muted small">รอ ${b.waiting} คิว ประมาณ ${b.etaMin} นาที</span></li>`).join('')}</ul>
    </section>
    ${local ? `<section class="pad muted small">ข้อมูลเก็บในเบราว์เซอร์เครื่องนี้ เปิด<a href="staff.html" target="_blank">หน้าเจ้าหน้าที่</a>ในแท็บใหม่เพื่อจำลองการเรียกคิว
      <button class="btn quiet" data-act="download-yaml">ดาวน์โหลดข้อมูล (YAML)</button></section>` : ''}`;
}

// ----- register: 1 คำถามต่อ 1 หน้าจอ, 4 ขั้น -----
const REG_STEPS = 4;
function viewRegister() {
  const r = S.reg;
  const head = `<p class="step">${r.step + 1}/${REG_STEPS}</p>`;
  const err = r.err ? `<p class="err" role="alert">${esc(r.err)}</p>` : '';
  const foot = (label = 'ถัดไป', act = 'reg-next') => `${err}<div class="stack" style="margin-top:20px">
    <button class="btn lg" data-act="${act}">${label}</button>
    <button class="btn quiet" data-act="reg-back">${r.step === 0 ? 'ยกเลิก' : 'ย้อนกลับ'}</button></div>`;
  let body;
  if (r.step === 0) {
    body = `<h1>ตรวจแผนกไหน</h1><div class="stack">
      ${S.cfg.departments.map(d => `<button class="choice" data-act="reg-dept" data-id="${d.id}" aria-pressed="${r.dept === d.id && !r.unsure}">
        <span><b>${esc(d.name)}</b><small>${esc(d.hint)}</small></span>${ic('next')}</button>`).join('')}
      <button class="choice" data-act="reg-dept" data-id="${S.cfg.departments[0].id}" data-unsure="1" aria-pressed="${!!r.unsure}">
        <span><b>ไม่แน่ใจ</b><small>พยาบาลจะช่วยเลือกให้ที่จุดคัดกรอง</small></span>${ic('next')}</button></div>
      ${err}<button class="btn quiet" style="margin-top:12px" data-act="reg-back">ยกเลิก</button>`;
  } else if (r.step === 1) {
    body = `<h1><label for="reg-name">ชื่อและนามสกุลผู้ป่วย</label></h1>
      <input id="reg-name" class="field" value="${esc(r.name)}" placeholder="สมศรี ใจดี" autocomplete="name">${foot()}`;
  } else if (r.step === 2) {
    body = `<h1><label for="reg-phone">เบอร์โทรศัพท์</label></h1><p class="muted">ใช้ค้นหาคิวนี้อีกครั้งจากเครื่องไหนก็ได้</p>
      <input id="reg-phone" class="field num" type="tel" inputmode="numeric" maxlength="10" value="${esc(r.phone)}" placeholder="08xxxxxxxx" autocomplete="tel">${foot()}`;
  } else {
    const d = S.cfg.departments.find(x => x.id === r.dept);
    body = `<h1>ตรวจสอบก่อนรับคิว</h1>
      <dl class="summary">
        <div><dt>แผนก</dt><dd>${r.unsure ? 'ให้พยาบาลช่วยเลือก' : esc(d.name)}</dd></div>
        <div><dt>ชื่อ</dt><dd>${esc(r.name)}</dd></div>
        <div><dt>เบอร์โทร</dt><dd class="num">${esc(r.phone)}</dd></div>
      </dl>
      <p style="margin:20px 0 10px">มีอาการอะไรบ้าง <span class="muted">(ข้ามได้)</span></p>
      <div class="chips">${SYMPTOMS.map(s => `<button class="chip" data-act="reg-sym" data-s="${esc(s)}" aria-pressed="${r.symptoms.includes(s)}">${esc(s)}</button>`).join('')}</div>
      ${foot('รับคิว', 'reg-submit')}`;
  }
  return `<section class="pad">${head}${body}</section>`;
}
function readRegInputs() {
  const r = S.reg;
  if ($('#reg-name')) r.name = $('#reg-name').value.trim();
  if ($('#reg-phone')) r.phone = $('#reg-phone').value.replace(/\D/g, '');
}

// ----- now: andon + process chart -----
function navLine(v, target) {
  if (!target || v.location === target.id) return '';
  const r = route(here(v), target);
  return { r, html: `<button class="btn" data-act="go-route">${ic('nav')}นำทางไป${esc(target.short)} ${r.dist} ม.</button>` };
}
function andon(v) {
  const q = v.queue;
  const target = st(v.target);
  const nav = navLine(v, target);
  let tone, title, big = '', facts = '', note = '', actions = '', speech;

  if (v.stage === 'vitals' && nav) {
    tone = 'act'; title = `ไป${target.name}`;
    facts = [['ระยะทาง', `${nav.r.dist} ม.`], ['เดินประมาณ', `${nav.r.min} นาที`]];
    actions = nav.html; speech = `ขั้นต่อไป ไป${target.name} ระยะทาง ${nav.r.dist} เมตร`;
  } else if (v.stage === 'vitals') {
    tone = 'wait'; title = 'รอพยาบาลเรียกวัดความดัน';
    note = 'นั่งรอที่จุดคัดกรอง พยาบาลจะเรียกตามคิว'; speech = title;
  } else if (v.stage === 'waiting') {
    tone = 'wait'; big = esc(v.queueLabel);
    title = q.ahead === 0 ? 'คิวถัดไปคือคุณ' : `รออีก ${q.ahead} คิว`;
    facts = [['เรียกถึง', q.nowServing], ['รอประมาณ', q.ahead === 0 ? `ไม่เกิน ${v.deptInfo.avgMinutes} นาที` : `${q.etaMin} นาที`]];
    note = q.ahead > (S.cfg.settings.nearQueueAlert ?? 2)
      ? `ไปเข้าห้องน้ำหรือซื้อน้ำได้ แอปจะเตือนเมื่อเหลือ ${S.cfg.settings.nearQueueAlert ?? 2} คิว` : `อยู่ใกล้${target.name}ไว้นะ`;
    actions = nav ? nav.html.replace('class="btn"', 'class="btn line"') : '';
    speech = `คิวของคุณ ${v.queueLabel.split('').join(' ')} ${title} ตอนนี้เรียกถึง ${q.nowServing.split('').join(' ')} รอประมาณ ${q.etaMin} นาที`;
  } else if (v.stage === 'consult') {
    tone = 'go'; big = esc(v.queueLabel); title = 'ถึงคิวคุณแล้ว';
    note = `เข้า${target.name}ได้เลย`; actions = nav ? nav.html : '';
    speech = `ถึงคิวคุณแล้ว เข้า${target.name}ได้เลย`;
  } else if (v.stage === 'pharmacy' && !v.medPickup) {
    tone = 'act'; title = 'รับยาแบบไหนดี';
    note = `ยา ${v.medicines.length} รายการ`;
    if (S.pickMode === 'delivery') {
      actions = `<label for="addr">ที่อยู่สำหรับส่งยา</label>
        <textarea id="addr" class="field" placeholder="บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด">${esc(v.patient?.address || '')}</textarea>
        ${S.pickErr ? `<p class="err">${esc(S.pickErr)}</p>` : ''}
        <button class="btn lg" data-act="pickup" data-mode="delivery">ยืนยันส่งยาถึงบ้าน</button>
        <button class="btn line" data-act="pick-mode" data-mode="">ย้อนกลับ</button>
        <p class="small" style="margin:0">ส่งโดย ${esc(S.cfg.settings.deliveryPartner)} ยาแยกซองตามมื้อ ไม่มีค่าส่ง</p>`;
    } else {
      actions = `<button class="choice" data-act="pick-mode" data-mode="delivery"><span><b>ส่งยาถึงบ้าน</b><small>ไม่ต้องรอคิวห้องยา กลับบ้านได้เลย</small></span>${ic('home')}</button>
        <button class="choice" data-act="pickup" data-mode="pickup"><span><b>รับเองที่ห้องยา</b><small>แสดงเลขคิว ${esc(v.queueLabel)} ที่ช่องจ่ายยา</small></span>${ic('counter')}</button>`;
    }
    speech = 'พบแพทย์เสร็จแล้ว เลือกได้ว่าจะให้ส่งยาถึงบ้าน หรือรับเองที่ห้องยา';
  } else if (v.stage === 'pharmacy' && v.medPickup.mode === 'pickup') {
    tone = 'act'; title = `รับยาที่${st('PHA').name}`;
    note = `แสดงเลขคิว ${v.queueLabel} ที่ช่องจ่ายยา`;
    actions = nav ? nav.html : ''; speech = `${title} ${note}`;
  } else if (v.stage === 'pharmacy') {
    const steps = S.cfg.settings.deliverySteps;
    const i = steps.findIndex(s => s.key === v.medPickup.status);
    tone = 'go'; title = 'กลับบ้านได้เลย';
    note = `ยากำลังส่งไปที่บ้าน: ${steps[i]?.label || ''} (พัสดุ ${v.medPickup.trackingNo || '-'})`;
    actions = `<div class="ticks" aria-hidden="true">${steps.map((s, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('')}</div>`;
    speech = `${title} ${note}`;
  } else {
    tone = 'done'; title = 'เสร็จสิ้นวันนี้';
    note = v.followUp ? `นัดครั้งต่อไป: ${v.followUp}` : 'ขอให้หายไว ๆ';
    actions = `<button class="btn line" data-act="tab" data-tab="care">ดูผลตรวจและวิธีกินยา</button>`;
    speech = `${title} ${note}`;
  }
  const factsHtml = facts ? `<dl class="facts">${facts.map(([k, val]) => `<div><dt>${k}</dt><dd>${esc(val)}</dd></div>`).join('')}</dl>` : '';
  return `<section class="andon ${tone} ${tone === 'go' ? 'pulse' : ''}" aria-label="สถานะตอนนี้">
      <div class="andon-top"><span>${big ? esc(v.deptInfo.name) : `<span class="num">${esc(v.queueLabel)}</span>  ${esc(v.deptInfo.name)}`}</span><button class="speak" data-act="say" data-text="${esc(speech)}" aria-label="ฟังสถานะ">${ic('speaker')}</button></div>
      ${big ? `<div class="andon-big">${big}</div>` : ''}
      <div class="andon-title">${esc(title)}</div>
      ${factsHtml}
      ${note ? `<p class="andon-note">${esc(note)}</p>` : ''}
      ${actions ? `<div class="andon-actions">${actions}</div>` : ''}
    </section>`;
}

function processChart(v) {
  const enter = {};
  for (const e of v.events) if (e.type === 'stage') enter[e.stage] = e.at;
  const ci = stageIdx(v.stage);
  const nowIso = localNow();
  const rows = [];
  S.cfg.journey.forEach((j, i) => {
    if (i > 0) {
      const a = st(stageStation(v, S.cfg.journey[i - 1].key)), b = st(stageStation(v, j.key));
      if (a && b && a.id !== b.id) {
        rows.push(`<li class="move ${i <= ci ? 'done' : 'todo'}">${sym('transport')}<span>เดิน ${route(a, b).dist} ม.</span><span></span></li>`);
      }
    }
    const state = v.stage === 'done' || i < ci ? 'done' : i === ci ? 'cur' : 'todo';
    const next = S.cfg.journey[i + 1];
    let t = '';
    if (j.key !== 'done' && enter[j.key]) {
      const end = state === 'done' && next && enter[next.key] ? enter[next.key] : state === 'cur' ? nowIso : null;
      if (end) t = `${minutesBetween(enter[j.key], end)} นาที`;
    }
    const label = state === 'cur' && j.key !== 'done' ? `${j.label} (ตอนนี้)` : j.label;
    rows.push(`<li class="${state}">${sym(j.symbol || DEFAULT_SYMBOL[j.key])}<span class="label">${esc(label)}</span><span class="t">${t}</span></li>`);
  });
  const start = v.events[0]?.at;
  const total = start ? minutesBetween(start, v.stage === 'done' ? (enter.done || nowIso) : nowIso) : 0;
  const used = [...new Set(S.cfg.journey.map(j => j.symbol || DEFAULT_SYMBOL[j.key]))];
  return `<section class="pad">
      <h2>ขั้นตอนวันนี้</h2>
      <p class="muted">${v.stage === 'done' ? 'ใช้เวลาทั้งหมด' : 'ใช้เวลาไปแล้ว'} <span class="num">${fmtMin(total)}</span></p>
      <ol class="chart">${rows.join('')}</ol>
      <div class="legend">${used.map(s => `<span>${sym(s)}${SYMBOL_NAME[s] || ''}</span>`).join('')}</div>
    </section>`;
}

function feedbackBlock(v) {
  const ci = stageIdx(v.stage);
  const stage = S.cfg.journey.slice(0, ci)
    .filter(j => j.key !== 'done' && !(v.feedback || []).some(f => f.stage === j.key) && !S.skipFb.has(v.id + j.key)).pop();
  if (!stage) return '';
  const f = S.fb && S.fb.stage === stage.key ? S.fb : null;
  return `<section class="pad rule">
      <h2>ขั้นตอน "${esc(stage.label)}" เป็นอย่างไร</h2>
      <div class="faces">${FACES.map(([n, e, t]) => `<button data-act="feedback" data-stage="${stage.key}" data-score="${n}" aria-pressed="${f?.score === n}" aria-label="${t}">${e}<small>${t}</small></button>`).join('')}</div>
      ${f ? `<label for="fb-comment" style="display:block;margin:14px 0 6px">อะไรที่ทำให้ไม่สะดวก</label>
        <textarea id="fb-comment" class="field" placeholder="เช่น รอนาน หาทางไม่เจอ"></textarea>
        <div class="row" style="margin-top:10px"><button class="btn line" data-act="fb-send" data-skip="1">ข้าม</button><button class="btn" data-act="fb-send">ส่ง</button></div>`
      : `<button class="btn quiet" data-act="skip-fb" data-stage="${stage.key}">ไม่ตอบ</button>`}
    </section>`;
}

function viewNow(v) {
  return `${andon(v)}${feedbackBlock(v)}${processChart(v)}
    <section class="pad rule"><button class="btn quiet" data-act="logout">ออกจากคิวนี้บนเครื่องนี้</button></section>`;
}

// ----- route -----
function viewRoute(v) {
  const main = st(v.target);
  const to = st(S.altDest) || main;
  const from = here(v);
  const others = S.cfg.stations.filter(s => s.public && s !== main);
  const chips = `<section class="pad rule"><h2>ไปที่อื่น</h2><div class="chips">
      ${main ? `<button class="chip" data-act="dest" data-id="" aria-pressed="${to === main}">${esc(main.short)} (ขั้นต่อไป)</button>` : ''}
      ${others.map(s => `<button class="chip" data-act="dest" data-id="${s.id}" aria-pressed="${to === s}">${esc(s.short)}</button>`).join('')}</div></section>`;
  if (!to) return chips;
  if (from.id === to.id) {
    return `<section class="pad"><p class="from">คุณอยู่ที่</p><p class="dest">${esc(to.name)}</p>
      <p class="muted" style="margin-top:8px">${esc(to.landmark)}</p></section>${chips}`;
  }
  const r = route(from, to);
  return `<section class="pad">
      <p class="from">จาก${esc(from.name)} ไป</p>
      <p class="dest">${esc(to.name)}</p>
      <div class="metrics"><div><span class="muted small">ระยะทาง</span><b>${r.dist} ม.</b></div><div><span class="muted small">เดินประมาณ</span><b>${r.min} นาที</b></div></div>
    </section>
    <section class="pad" style="padding-top:0">${mapSvg(from, to, r)}</section>
    <section class="pad" style="padding-top:0">
      <div class="row" style="align-items:center;margin-bottom:8px"><h2 style="margin:0">เดินตามนี้</h2>
        <button class="speak" style="flex:none" data-act="say" data-text="${esc(r.steps.join(' จากนั้น '))}" aria-label="ฟังเส้นทาง">${ic('speaker')}</button></div>
      <ol class="steps">${r.steps.map((s, i) => `<li class="${i === r.steps.length - 1 ? 'end' : ''}">${esc(s)}</li>`).join('')}</ol>
      <button class="btn lg" style="margin-top:16px" data-act="arrive" data-id="${to.id}">${ic('check')}ถึง${esc(to.short)}แล้ว</button>
    </section>${chips}`;
}

// ----- care: ผลตรวจ + ยา -----
function medBlock(m) {
  const when = m.asNeeded
    ? '<p class="warn"><b>กินเฉพาะตอนมีอาการ</b></p>'
    : `<div class="when">${TIMES.map(([k, t, path]) => `<div class="${(m.times || []).includes(k) ? 'on' : ''}"><svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>${t}</div>`).join('')}</div>`;
  return `<div class="med"><b>${esc(m.name)}</b><div class="muted">${esc(m.forWhat)}</div>${when}
    <div class="dose">ครั้งละ <strong>${esc(m.dose)}</strong> ${esc(MEAL[m.meal] || '')} ${m.days ? `ติดต่อกัน ${esc(m.days)} วัน` : ''}</div>
    ${m.note ? `<p class="warn">${esc(m.note)}</p>` : ''}</div>`;
}
function medSpeech(m) {
  const when = m.asNeeded ? 'เฉพาะตอนมีอาการ' : TIMES.filter(([k]) => (m.times || []).includes(k)).map(t => t[1]).join(' ');
  return `${m.name} ${m.forWhat} ครั้งละ ${m.dose} ${when} ${MEAL[m.meal] || ''}. ${m.note || ''}`;
}
function viewCare(v) {
  if (!v.diagnosis) {
    return `<section class="empty"><h1>ผลตรวจจะขึ้นที่นี่หลังพบแพทย์</h1>
      <p class="muted">รวมถึงยาที่ได้รับ วิธีกิน และวันนัดครั้งต่อไป</p>
      <button class="btn line" data-act="tab" data-tab="now">กลับไปดูคิว</button></section>`;
  }
  const dx = v.diagnosis;
  const speech = `ผลตรวจวันนี้ ${dx.name}. ${dx.explain}. ยาที่ได้รับ ${v.medicines.map(medSpeech).join(' ')}`;
  return `<section class="pad">
      <div class="row" style="align-items:flex-start"><p class="dx">${esc(dx.name)}</p>
        <button class="speak" style="flex:none" data-act="say" data-text="${esc(speech)}" aria-label="ฟังผลตรวจและวิธีกินยา">${ic('speaker')}</button></div>
      <p>${esc(dx.explain)}</p>
      <p class="muted small">${esc(dx.doctor)} เวลา <span class="num">${esc(dx.at.slice(11, 16))}</span> น.</p>
    </section>
    <section class="pad rule"><h2>ยา ${v.medicines.length} รายการ</h2>${v.medicines.map(medBlock).join('')}</section>
    ${v.advice.length ? `<section class="pad rule"><h2>คำแนะนำ</h2><ul class="plain">${v.advice.map(a => `<li>${esc(a)}</li>`).join('')}</ul></section>` : ''}
    ${v.followUp ? `<section class="pad rule"><h2>นัดครั้งต่อไป</h2><p style="font-weight:700;font-size:1.15rem">${esc(v.followUp)}</p></section>` : ''}
    <p class="pad muted small">ข้อมูลสมมติเพื่อการเรียนการสอน ไม่ใช่คำแนะนำทางการแพทย์</p>`;
}

// ---------- actions ----------
const actions = {
  size() {
    const order = ['m', 'l', 'xl'];
    const next = order[(order.indexOf(store.get('size') || 'm') + 1) % order.length];
    store.set('size', next);
    document.documentElement.dataset.size = next;
    $('.size-btn').textContent = next === 'xl' ? 'ก−' : 'ก+';
    $('.size-btn').setAttribute('aria-label', next === 'xl' ? 'ตัวอักษรขนาดปกติ' : 'ขยายตัวอักษร');
  },
  'download-yaml'() { Closely.downloadYaml().catch(e => toast(e.message)); },
  tab(el) { S.tab = el.dataset.tab; render(); scrollTo(0, 0); },
  say(el) { speak(el.dataset.text); },
  'close-modal'() { $('#modal').hidden = true; window.speechSynthesis?.cancel(); },
  'go-route'() { $('#modal').hidden = true; S.altDest = null; S.tab = 'route'; render(); scrollTo(0, 0); },
  'start-reg'() { S.reg = { step: 0, dept: null, unsure: false, name: '', phone: '', symptoms: [], err: '', startedAt: localNow() }; S.screen = 'register'; render(); },
  lookup() { S.lookup = true; S.lookupErr = ''; render(); $('#lookup-phone')?.focus(); },
  'lookup-cancel'() { S.lookup = false; render(); },
  async 'lookup-go'() {
    const phone = $('#lookup-phone').value.replace(/\D/g, '');
    try {
      const { id } = await api('/api/find?phone=' + phone);
      setVisit(await api('/api/visit/' + id));
      S.lookup = false; S.tab = 'now'; notifyChanges(); render();
    } catch (e) { S.lookupErr = e.message; render(); $('#lookup-phone').value = phone; }
  },
  'reg-dept'(el) { Object.assign(S.reg, { dept: el.dataset.id, unsure: !!el.dataset.unsure, err: '', step: 1 }); render(); $('#reg-name')?.focus(); },
  'reg-sym'(el) { const s = el.dataset.s, l = S.reg.symptoms; S.reg.symptoms = l.includes(s) ? l.filter(x => x !== s) : [...l, s]; render(); },
  'reg-back'() { readRegInputs(); S.reg.err = ''; if (S.reg.step === 0) { S.screen = 'home'; S.reg = null; } else S.reg.step--; render(); },
  'reg-next'() {
    readRegInputs();
    const r = S.reg;
    r.err = r.step === 1 && r.name.length < 2 ? 'กรอกชื่ออย่างน้อย 2 ตัวอักษร'
      : r.step === 2 && !/^0\d{8,9}$/.test(r.phone) ? 'เบอร์โทรต้องมี 9–10 หลัก และขึ้นต้นด้วย 0' : '';
    if (!r.err) r.step++;
    render();
    (r.step === 2 ? $('#reg-phone') : r.step === 1 ? $('#reg-name') : null)?.focus();
  },
  async 'reg-submit'(el) {
    const r = S.reg;
    el.disabled = true;
    try {
      const symptoms = [r.unsure ? 'ไม่แน่ใจแผนก' : '', ...r.symptoms].filter(Boolean).join(', ');
      const v = await api('/api/register', { name: r.name, phone: r.phone, dept: r.dept, symptoms, startedAt: r.startedAt });
      setVisit(v); S.screen = 'home'; S.tab = 'now'; S.reg = null;
      notifyChanges(); render(); scrollTo(0, 0);
      speak(`ได้คิว ${v.queueLabel.split('').join(' ')} แล้ว ขั้นต่อไป ไป${st(v.target).name}`);
    } catch (e) { r.err = e.message; render(); }
  },
  async feedback(el) {
    const stage = el.dataset.stage, score = Number(el.dataset.score);
    if (score <= 3) { S.fb = { stage, score }; render(); $('#fb-comment')?.focus(); return; } // ถามเหตุผลเฉพาะตอนไม่พอใจ
    await sendFeedback(stage, score, '');
  },
  async 'fb-send'(el) { await sendFeedback(S.fb.stage, S.fb.score, el.dataset.skip ? '' : ($('#fb-comment')?.value || '')); },
  'skip-fb'(el) { S.skipFb.add(S.visitId + el.dataset.stage); render(); },
  logout() { if (confirm('ออกจากคิวนี้บนเครื่องนี้? คิวยังอยู่ ค้นหาด้วยเบอร์โทรได้')) { setVisit(null); render(); } },
  dest(el) { S.altDest = el.dataset.id || null; render(); },
  async arrive(el) {
    try {
      S.visit = await api(`/api/visit/${S.visitId}/arrive`, { station: el.dataset.id });
      S.altDest = null; S.tab = 'now';
      toast(`บันทึกแล้ว: อยู่ที่${st(el.dataset.id).short}`);
      render(); scrollTo(0, 0);
    } catch (e) { toast(e.message); }
  },
  'pick-mode'(el) { S.pickMode = el.dataset.mode || null; S.pickErr = ''; render(); $('#addr')?.focus(); },
  async pickup(el) {
    try {
      S.visit = await api(`/api/visit/${S.visitId}/pickup`, { mode: el.dataset.mode, address: $('#addr')?.value || '' });
      S.pickMode = null; S.pickErr = ''; if (S.prev) S.prev.ds = S.visit.medPickup?.status;
      toast(el.dataset.mode === 'delivery' ? 'สั่งส่งยาถึงบ้านแล้ว' : 'ไปรับยาที่ห้องยาได้เลย');
      render();
    } catch (e) { S.pickErr = e.message; render(); }
  },
};
async function sendFeedback(stage, score, comment) {
  try {
    S.visit = await api(`/api/visit/${S.visitId}/feedback`, { stage, score, comment });
    S.fb = null; toast('ขอบคุณที่บอกเรา'); render();
  } catch (e) { toast(e.message); }
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || !actions[el.dataset.act]) return;
  e.preventDefault();
  actions[el.dataset.act](el);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('#modal').hidden) return actions['close-modal']();
  if (e.key !== 'Enter' || e.target.tagName === 'TEXTAREA') return;
  if (e.target.id === 'lookup-phone') actions['lookup-go']();
  else if (/^reg-/.test(e.target.id)) actions['reg-next']();
});
document.addEventListener('focusout', () => setTimeout(() => { if (S.dirty) render(); }, 0));

// ---------- start ----------
(async function init() {
  const size = store.get('size') || 'm';
  document.documentElement.dataset.size = size;
  if (size === 'xl') $('.size-btn').textContent = 'ก−';
  const params = new URLSearchParams(location.search);
  const qs = params.get('visit');
  const tab = { queue: 'now', result: 'care', meds: 'care' }[params.get('tab')] || params.get('tab');
  if (['now', 'route', 'care'].includes(tab)) S.tab = tab;
  S.visitId = qs || store.get('visitId');
  if (qs) store.set('visitId', qs);
  try { await Closely.ready; } catch (e) { $('#view').innerHTML = `<section class="empty"><h1>เปิดแอปไม่ได้</h1><p>${esc(e.message)}</p></section>`; return; }
  await refresh();
  const live = $('#live');
  const LIVE = { live: ['on', 'สด'], offline: ['', 'ออฟไลน์'], local: ['on', 'ในเครื่อง'] };
  Closely.subscribe(refresh, state => { live.className = 'live ' + LIVE[state][0]; live.textContent = LIVE[state][1]; });
  setInterval(() => { if (S.visit && S.tab === 'now' && $('#modal').hidden) render(); }, 30000); // เวลาในแต่ละขั้นเดินต่อ
})();
