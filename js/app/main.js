// แอปผู้ป่วย: วาดหน้าจอ รับการกด และแจ้งเตือนเมื่อสถานะเปลี่ยน (จาก staff หรือหมอ)
import { connect } from '../transport.js';
import { C, freshUI, loadSession, saveSession, visit, dept, qText, ahead, stage, nextTarget, followDate, refillDate, visibleChat, doctorTyping, unreadCount, template } from './ctx.js';
import { loginScreen, homeScreen, regScreen, lgMatch, lgMatchHTML } from './entry.js';
import { nowTab } from './now.js';
import { navTab, resultsTab, careTab, mapSVG } from './tabs.js';
import { ACT3, enter3d, ensureLoop3 } from './map3d.js';
import { queueAlert, aheadOf } from '../lib/queue.js';
import { IC, LOGO } from '../ui/icons.js';
import { speak, voiceName } from '../ui/voice.js';
import { prefs, applyPrefs, setTheme, cycleFs, THEMES } from '../ui/prefs.js';
import { showSheet, closeSheet, toast, runSheetAction, trapFocus, sheetOpen } from '../ui/sheet.js';

const $ = id => document.getElementById(id);
const TABS = [['now', 'ตอนนี้', IC.now], ['nav', 'นำทาง', IC.nav], ['results', 'ผลและยา', IC.rx], ['care', 'ติดตาม', IC.care]];
let resetScroll = false, lastTab, prev = null, faceT = [], chatTimer = null;

// ---------- render ----------
function topbar() {
  const c = { live: ['', 'Live'], off: ['off', 'ออฟไลน์'], local: ['local', 'ในเครื่อง'] }[C.T.status];
  const tip = { live: 'เชื่อมต่อ server แบบสด ทุกเครื่องเห็นคิวเดียวกัน', off: 'เชื่อมต่อ server ไม่ได้ ข้อมูลอาจไม่อัปเดต', local: 'ไม่มี server ข้อมูลอยู่ในเบราว์เซอร์นี้ ซิงก์กับแท็บอื่นในเครื่องเดียวกัน' }[C.T.status];
  return `<header class="top">
    ${LOGO(44)}<div class="brand"><b>Closely DR.</b><span>× IE BUU</span></div>
    <span class="conn ${c[0]}" title="${tip}" role="status" aria-label="สถานะการเชื่อมต่อ: ${c[1]} ${tip}"><i aria-hidden="true"></i>${c[1]}</span>
    <button class="fsbtn" data-act="themeSheet" aria-label="เลือกธีมสี">${IC.palette}<small aria-hidden="true">ธีม</small></button>
    <button class="fsbtn" data-act="fs" aria-label="ขนาดตัวอักษร ระดับ ${prefs.fs + 1} จาก 3 กดเพื่อเปลี่ยน">ก+<small aria-hidden="true">${prefs.fs + 1}/3</small></button>
  </header>`;
}

function screenView() {
  const U = C.U;
  if (U.screen === 'login') return loginScreen();
  if (U.screen === 'home') return homeScreen();
  if (U.screen === 'reg') return regScreen();
  return U.tab === 'nav' ? navTab() : U.tab === 'results' ? resultsTab() : U.tab === 'care' ? careTab() : nowTab();
}

/** จำปุ่ม/ช่องที่โฟกัสอยู่ เพื่อคืนโฟกัสหลังวาดหน้าจอใหม่ (สำคัญกับผู้ใช้คีย์บอร์ด) */
function focusKey(inner) {
  const a = document.activeElement;
  if (!a || !inner.contains(a) || a === inner) return null;
  if (a.id) return '#' + CSS.escape(a.id);
  if (a.dataset.act) return `[data-act="${CSS.escape(a.dataset.act)}"]` + (a.dataset.arg !== undefined ? `[data-arg="${CSS.escape(a.dataset.arg)}"]` : '');
  return null;
}

function render() {
  const U = C.U, inner = $('appInner');
  if (U.screen === 'app' && !visit()) { // คิวถูกลบ (เช่น staff กดรีเซ็ต)
    U.visitId = null; U.screen = U.logged ? 'home' : 'login'; saveSession();
  }
  const ph = document.querySelector('.phone');
  if (ph) ph.dataset.sb = U.screen === 'login' && U.face !== null ? 'dark' : '';
  const sc = inner.querySelector('.scroll'), keep = sc ? sc.scrollTop : 0;
  const fid = focusKey(inner);
  const v = screenView();
  const ti = Math.max(0, TABS.findIndex(t => t[0] === U.tab)), from = lastTab ?? ti;
  const credit = `<p class="credit">Prototype by <b>IE BUU</b> · Service Design Thinking Workshop</p>`;
  const r = visit(), dot = k => (k === 'results' && r?.result && U.seenResult !== r.result.at) || (k === 'care' && r && (unreadCount(r) || r.care.phase === 'assess'));
  const tabs = v.tabs ? `<nav class="cnav" aria-label="เมนูหลัก" style="--i:${from};--n:${TABS.length}">
    <div class="cwrap" aria-hidden="true"><div class="cbar"><span></span><svg viewBox="0 0 110 76"><path d="M0 0H8C14 0 16 3 18 6A38 38 0 0 0 92 6C94 3 96 0 102 0H110V76H0Z"/></svg><span></span></div></div>
    <div class="bubble" aria-hidden="true">${TABS[ti][2]}</div>
    ${TABS.map(([k, t, ic], i) => `<button class="ctab" ${i === ti ? 'aria-current="page"' : ''} data-act="tab" data-arg="${k}"><span class="ti" aria-hidden="true">${ic}</span><span class="tl">${t}</span>${dot(k) ? '<span class="dot" aria-hidden="true"></span><span class="sr">มีเรื่องใหม่</span>' : ''}</button>`).join('')}
  </nav>${credit}` : `<div class="credit-solo">${credit}</div>`;
  inner.innerHTML = (v.full ? '' : topbar()) + `<main class="scroll${v.full ? ' full' : ''}" id="scr" tabindex="0" aria-label="เนื้อหา">${v.body}</main>` + `<div class="bottom"><div class="dock">${v.dock || ''}</div>${tabs}</div>`;
  const ns = inner.querySelector('.scroll'), bt = inner.querySelector('.bottom');
  if (ns && bt) ns.style.paddingBottom = (bt.offsetHeight + 28) + 'px';
  const cn = inner.querySelector('.cnav');
  if (cn) { if (from !== ti) { void cn.offsetWidth; cn.style.setProperty('--i', ti); cn.classList.add('moved'); } lastTab = ti; } else lastTab = undefined;
  if (ns && !resetScroll) ns.scrollTop = keep;
  resetScroll = false;
  if (ns && U.screen === 'app' && U.tab === 'care' && U.care.view === 'chat') { ns.scrollTop = ns.scrollHeight; U.chatSeen = visibleChat().length; saveSession(); }
  if ($('m3d')) ensureLoop3();
  if (fid) { const el = inner.querySelector(fid); if (el) { el.focus({ preventScroll: true }); if (el.setSelectionRange && typeof el.value === 'string') { try { const l = el.value.length; el.setSelectionRange(l, l); } catch { /* ไม่รองรับ */ } } } }
  scheduleChat();
}

/** คำตอบหมอจำลองตั้งเวลาไว้ → วาดใหม่เมื่อถึงเวลา */
function scheduleChat() {
  clearTimeout(chatTimer);
  const v = visit();
  if (!v || !doctorTyping(v)) return;
  const next = Math.min(...v.chat.map(m => Date.parse(m.at)).filter(t => t > Date.now()));
  chatTimer = setTimeout(() => {
    const onChat = C.U.tab === 'care' && C.U.care.view === 'chat' && C.U.screen === 'app';
    render();
    if (!onChat && unreadCount()) toast('ข้อความใหม่จากหมอ');
  }, Math.max(50, next - Date.now() + 30));
}

function renderSide() {
  const side = $('side');
  if (!side) return;
  side.innerHTML = `
    <h1 style="display:flex;align-items:center;gap:10px">${LOGO(36, false)}แอปผู้ป่วยนอก</h1>
    <p class="lede">Closely DR. × IE BUU สำหรับ workshop Design Thinking / Customer Journey Map ข้อมูลทั้งหมดเป็นข้อมูลสมมติ</p>
    <h2>หน้าเจ้าหน้าที่</h2>
    <div class="grp"><a class="dchip staffact" href="staff.html" target="_blank" rel="noopener">เปิดหน้า staff (แท็บใหม่)</a></div>
    <p class="hint">กดเรียกคิว บันทึกผลตรวจ ส่งยา และตัดสินแทนหมอได้ที่หน้า staff แอปนี้จะอัปเดตตามทันที</p>
    <h2>ธีมแถบบน-ล่าง</h2>
    <div class="grp">${THEMES.map(([k, t, c]) => `<button class="dchip" aria-pressed="${prefs.theme === k}" data-act="theme" data-arg="${k}"><span class="tdot" style="background:${c}"></span>${t}</button>`).join('')}</div>
    <h2>เสียงอ่าน</h2>
    <div class="grp"><button class="dchip" data-act="voiceTest">ทดลองเสียงพยาบาล</button></div>
    <h2>การเชื่อมต่อ</h2>
    <p class="hint" style="margin:0">${{ live: 'Live: ต่อ server แล้ว ทุกเครื่องเห็นคิวเดียวกัน', off: 'ออฟไลน์: ต่อ server ไม่ได้', local: 'ในเครื่อง: ไม่มี server (GitHub Pages) เปิดหน้า staff ในเบราว์เซอร์เดียวกันเพื่อซิงก์' }[C.T.status]}</p>
    <div class="note">
      <p><b>การ์ดสถานะสด</b></p>
      <p>การ์ดสถานะทั้งใบเปลี่ยนสีตามขั้นเหมือนไฟ andon: เหลือง = รอ, เขียว = ไปได้, น้ำเงิน = ต้องทำ, ขาว = เสร็จ ปุ่มสูง 60–64px คอนทราสต์ AA ขึ้นไป</p>
    </div>`;
}

const renderAll = () => { renderSide(); render(); };

// ---------- แจ้งเตือนเมื่อสถานะเปลี่ยน ----------
function finishStage(key) { Object.assign(C.U, { feelAsk: key, feelScore: null, feelReasons: [] }); }
const toCare = (view = 'main') => () => { Object.assign(C.U, { screen: 'app', tab: 'care' }); C.U.care.view = view; if (view === 'quiz') { C.U.care.qStep = 0; C.U.care.ans = {}; } };
function alertGo(title, body, badge, tone, label, go) {
  showSheet({ tone, badge, title, body, actions: [
    { label, main: true, fn: () => { closeSheet(); go(); resetScroll = true; render(); } },
    { label: 'ไว้ทีหลัง', fn: () => closeSheet() }] });
}
function alertNav(title, body, badge, tone = 'go') {
  showSheet({ tone, badge, title, body, actions: [
    { label: IC.nav + 'นำทาง', main: true, fn: () => { closeSheet(); Object.assign(C.U, { screen: 'app', tab: 'nav', navTo: null }); resetScroll = true; render(); } },
    { label: 'รับทราบ', fn: () => closeSheet() }] });
}

/** เทียบสถานะก่อน/หลัง แล้วแจ้งเตือน (ทำงานทั้งตอน staff กดและตอนผู้ป่วยกดเอง) */
function diffAlerts() {
  const v = visit();
  if (!v) { prev = null; return; }
  const a = aheadOf(v.qn, C.T.state.queues[v.dept].calling);
  const p = prev && prev.id === v.id ? prev : null;
  prev = { id: v.id, stage: v.stage, rx: v.rx, deliv: v.deliv, left: !!v.left_at, ahead: a, phase: v.care.phase, round: v.care.round, rdeliv: v.care.rdeliv, chat: v.chat.length, lastFrom: v.chat[v.chat.length - 1]?.from };
  if (!p) return;
  const dn = dept().name, room = dept().exam_room, D = C.D, steps = D.app.delivery.steps;
  if (p.stage !== v.stage) {
    if (v.stage === 'waiting') { finishStage('vitals'); alertNav('คัดกรองเสร็จแล้ว', `ไปรอหน้าห้องตรวจ${dn} ตอนนี้รออีก ${a} คิว`, 'คัดกรองเสร็จ'); }
    else if (v.stage === 'consult') { finishStage('waiting'); alertNav(`ถึงคิวคุณแล้ว ${qText()}`, `เข้า${room}ได้เลย`, 'ถึงคิว'); }
    else if (v.stage === 'pharmacy') { finishStage('consult'); C.U.chatSeen = visibleChat(v).length; saveSession(); alertNav('พบแพทย์เสร็จแล้ว', 'ผลตรวจและวิธีกินยาอยู่ในแท็บผลและยา เลือกวิธีรับยาได้เลย', 'มีผลตรวจใหม่', 'act'); }
    else if (v.stage === 'done') {
      finishStage('pharmacy');
      if (v.rx === 'self') alertGo('เสร็จที่โรงพยาบาลแล้ว', `หมอจะส่งแบบประเมินอาการมาให้ตอบภายใน ${D.care.quiz.due_days} วัน`, 'เสร็จสิ้น', 'done', 'ดูการติดตาม', toCare());
    }
    return;
  }
  if (v.stage === 'waiting') {
    const al = queueAlert(p.ahead, a, D.app.alerts);
    if (al === 'back') alertNav('ใกล้แล้ว กลับมารอได้', `เหลืออีก ${a} คิว กลับมานั่งรอหน้าห้องตรวจ`, 'กลับมารอ', 'wait');
    if (al === 'ready') alertNav(`เหลืออีก ${a} คิว`, 'เตรียมตัว อยู่หน้าห้องตรวจ คิวใกล้ถึงคุณแล้ว', 'เตรียมตัว', 'wait');
  }
  if (!p.left && v.left_at) finishStage('visit');
  if (v.rx === 'delivery' && v.deliv > p.deliv) {
    if (v.deliv === 4) alertGo('ยาส่งถึงบ้านแล้ว', `หมอจะส่งแบบประเมินอาการมาให้ตอบภายใน ${D.care.quiz.due_days} วัน`, 'ส่งถึงแล้ว', 'go', 'ดูการติดตาม', toCare());
    else toast('ยา: ' + steps[v.deliv]);
  }
  const c = v.care;
  if (p.phase !== c.phase) {
    if (c.phase === 'assess') alertGo('หมอส่งแบบประเมินมาแล้ว', `ตอบ ${D.care.quiz.questions.length} ข้อ ใช้เวลาประมาณ 2 นาที`, 'แบบประเมินใหม่', 'act', 'ตอบเลย', toCare('quiz'));
    else if (c.phase === 'followup') alertGo('หมอนัดให้มาตรวจ', `${followDate(v).date} แอปจะเตือนล่วงหน้า 3 วัน 1 วัน และเช้าวันนัด`, 'นัดติดตาม', 'act', 'ดูรายละเอียด', toCare());
    else if (c.phase === 'refill') alertGo(`หมอสั่งส่งยารอบที่ ${c.round + 1}`, `ส่งถึงบ้าน ${refillDate(c.round, v)} ภายใน ${D.app.delivery.window_min.join('–')} นาทีหลังเริ่มจัดส่ง`, 'ส่งยาต่อ', 'go', 'ดูสถานะ', toCare());
    else if (c.phase === 'waitq' && c.round > p.round) alertGo(`ยารอบที่ ${c.round} ส่งถึงแล้ว`, 'หมอจะส่งแบบประเมินรอบถัดไปมาให้ตอบ', 'ส่งถึงแล้ว', 'go', 'ดูสถานะ', toCare());
  } else if (c.phase === 'refill' && c.rdeliv > p.rdeliv) toast(`ยารอบที่ ${c.round + 1}: ${steps[c.rdeliv]}`);
  // ข้อความใหม่จากหมอ (ไม่นับคำตอบอัตโนมัติหลังข้อความของผู้ป่วย และคำทักทายตอนบันทึกผล)
  if (p.chat > 0 && v.chat.length > p.chat) {
    const added = v.chat.slice(p.chat);
    const fromDoctor = added.find((m, i) => m.from === 'doc' && (i === 0 ? p.lastFrom : added[i - 1].from) !== 'me');
    const onChat = C.U.screen === 'app' && C.U.tab === 'care' && C.U.care.view === 'chat';
    if (fromDoctor && !onChat) alertGo('ข้อความใหม่จากหมอ', `${template()?.doctor || 'หมอ'}: ${fromDoctor.t}`, 'แชท', 'act', 'เปิดแชท', toCare('chat'));
  }
}

// ---------- การกระทำ ----------
const act = (type, payload) => C.T.act(type, payload);
function doLogin() {
  faceT.forEach(clearTimeout); faceT = [];
  const a = C.D.app.demo_account, U = C.U;
  Object.assign(U, { face: null, otpOpen: false, screen: 'home', logged: true, lgName: '' });
  if (!U.reg.name) U.reg.name = a.full;
  if (!U.reg.phone) U.reg.phone = a.phone;
  saveSession(); resetScroll = true; render(); toast('ยินดีต้อนรับ คุณ' + U.reg.name);
}
function restart(screen) {
  const U = C.U, keep = { logged: U.logged };
  closeSheet();
  if (screen === 'login') keep.logged = false;
  const name = U.reg.name, phone = U.reg.phone;
  C.U = freshUI(keep);
  if (screen === 'reg' && keep.logged) Object.assign(C.U.reg, { name, phone });
  C.U.screen = screen; C.U.regStartedAt = new Date().toISOString();
  prev = null; saveSession(); resetScroll = true; render();
}

const ACT = {
  ...ACT3,
  // ส่วนบน
  fs() { toast(cycleFs()); },
  theme(k) { setTheme(k); renderSide(); },
  themeSheet() {
    showSheet({ say: false, title: 'เลือกธีมสี', body: 'เปลี่ยนสีแถบด้านบนและเมนูด้านล่าง สีบอกสถานะคิวยังเหมือนเดิม', actions:
      THEMES.map(([k, t, c]) => ({ label: `<span class="tdot lg" style="background:${c}"></span>${t}${prefs.theme === k ? `<span class="chk">${IC.check}<span class="sr">เลือกอยู่</span></span>` : ''}`, cls: 'th', fn: () => { setTheme(k); closeSheet(); renderAll(); toast('เปลี่ยนเป็นธีม' + t + 'แล้ว'); } }))
        .concat([{ label: 'ปิด', main: true, fn: () => closeSheet() }]) });
    return 'norender';
  },
  speak(_, b) { speak(b.dataset.say); return 'norender'; },
  voiceTest() { speak('สวัสดีค่ะ หนูเป็นผู้ช่วยของโรงพยาบาลนะคะ ถ้าอยากฟังข้อความไหน กดปุ่มฟังได้เลยค่ะ'); toast(voiceName() ? 'เสียง: ' + voiceName() : 'เครื่องนี้ไม่มีเสียงภาษาไทย'); return 'norender'; },
  // เข้าสู่ระบบ
  lgSubmit() { doLogin(); return 'norender'; },
  faceStart() {
    faceT.forEach(clearTimeout); C.U.face = 0; speak('กรุณามองที่กล้องค่ะ');
    faceT = [setTimeout(() => { C.U.face = 1; render(); }, 1300),
      setTimeout(() => { C.U.face = 2; render(); speak('ยืนยันตัวตนสำเร็จ ยินดีต้อนรับค่ะ'); try { navigator.vibrate && navigator.vibrate(80); } catch { /* */ } }, 3800),
      setTimeout(doLogin, 5000)];
  },
  faceCancel() { faceT.forEach(clearTimeout); faceT = []; C.U.face = null; },
  otpOpen() { C.U.otpOpen = true; setTimeout(() => $('otpPh')?.focus(), 0); },
  otpSend() { toast('ต้นแบบ: ข้ามขั้นตอนกรอก OTP'); setTimeout(doLogin, 600); return 'norender'; },
  guest() { Object.assign(C.U, { screen: 'home', logged: false }); saveSession(); resetScroll = true; },
  // หน้าแรก + ลงทะเบียน
  startReg() { Object.assign(C.U, { screen: 'reg', regStep: 1, regStartedAt: new Date().toISOString() }); resetScroll = true; },
  lookupOpen() { C.U.lookupOpen = true; setTimeout(() => $('lk')?.focus(), 0); },
  async lookup() {
    const { id } = await act('lookup', { phone: C.U.lookupPhone });
    Object.assign(C.U, { visitId: id, screen: 'app', tab: 'now', lookupOpen: false });
    C.U.seenResult = visit()?.result?.at || null; C.U.chatSeen = visibleChat().length;
    prev = null; diffAlerts(); saveSession(); resetScroll = true; toast('พบคิว ' + qText());
  },
  pickDept(k) { C.U.reg.dept = k; C.U.reg.sym = []; },
  regNext() { C.U.regStep++; resetScroll = true; setTimeout(() => document.querySelector('.scroll .inp')?.focus(), 0); },
  regBack() { if (C.U.regStep > 1) C.U.regStep--; else C.U.screen = 'home'; },
  regGo(n) { C.U.regStep = +n; },
  toggleSym(s) { const a = C.U.reg.sym; a.includes(s) ? a.splice(a.indexOf(s), 1) : a.push(s); },
  async submitReg() {
    const U = C.U;
    const { id } = await act('register', { dept: U.reg.dept, name: U.reg.name, phone: U.reg.phone, symptoms: U.reg.sym, started_at: U.regStartedAt, login: U.logged ? 'account' : null });
    Object.assign(U, { visitId: id, screen: 'app', tab: 'now', navTo: null, addrOpen: false, seenResult: null, chatSeen: 0 });
    U.care = { view: 'main', qStep: 0, ans: {}, draft: '' };
    prev = null; diffAlerts(); finishStage('register'); saveSession(); resetScroll = true; toast('รับคิวแล้ว ' + qText());
  },
  // แท็บ
  tab(t) {
    const U = C.U;
    if (t === 'nav' && U.tab !== 'nav' && U.mapMode === '3d') enter3d();
    Object.assign(U, { tab: t, navTo: null });
    if (t === 'results' && visit()?.result) { U.seenResult = visit().result.at; saveSession(); }
    if (t === 'care') U.care.view = 'main';
    resetScroll = true;
  },
  goNav() { Object.assign(C.U, { tab: 'nav', navTo: null }); resetScroll = true; },
  navGo(k) { C.U.navTo = k === 'next' ? null : k; },
  mapMode(m) { if (m === '3d' && C.U.mapMode !== '3d') enter3d(); C.U.mapMode = m; },
  async arrive(to) {
    const v = visit();
    await act('arrive', { id: v.id, place: to });
    Object.assign(C.U, { navTo: null, tab: 'now' });
    toast('บันทึกแล้ว'); resetScroll = true;
    if (to === 'entrance' && v.stage === 'done' && !v.left_at) setTimeout(() => showSheet({ tone: 'go', badge: 'ถึงทางออก', title: 'ถึงทางออกแล้ว กลับบ้านเลยไหมคะ', body: 'กดยืนยันเพื่อจบการตรวจวันนี้ แอปจะย้ายไปติดตามการรักษาที่บ้าน', actions: [
      { label: IC.home + 'กลับบ้านแล้ว', main: true, fn: () => { closeSheet(); run('checkout'); } }, { label: 'ยังก่อน', fn: () => closeSheet() }] }), 300);
  },
  async checkout() {
    await act('checkout', { id: visit().id });
    Object.assign(C.U, { tab: 'now' }); resetScroll = true;
    speak('จบการตรวจวันนี้แล้ว ขอบคุณค่ะ เดินทางกลับบ้านปลอดภัยนะคะ'); toast('จบการตรวจวันนี้แล้ว');
  },
  // รับยา
  rxDelivery() { C.U.addrOpen = !C.U.addrOpen; if (C.U.addrOpen) setTimeout(() => $('ad')?.focus(), 0); },
  async rxConfirm() {
    if (!C.U.addr.trim()) { toast('กรุณากรอกที่อยู่'); return 'norender'; }
    await act('rxDelivery', { id: visit().id, addr: C.U.addr });
    C.U.addrOpen = false; toast('บันทึกแล้ว กลับบ้านได้เลย');
  },
  async rxSelf() { await act('rxSelf', { id: visit().id }); C.U.addrOpen = false; toast('บันทึกแล้ว'); },
  async rxReset() { await act('rxReset', { id: visit().id }); C.U.addrOpen = true; },
  async pickedUp() { await act('dispensed', { id: visit().id }); },
  // ความรู้สึก
  feel(n) { C.U.feelScore = +n; if (+n >= 4) return ACT.feelSend(); },
  feelReason(r) { const a = C.U.feelReasons; a.includes(r) ? a.splice(a.indexOf(r), 1) : a.push(r); },
  async feelSend() {
    const U = C.U, key = U.feelAsk;
    U.feelAsk = null;
    await act('feeling', { id: visit().id, stage: key, score: U.feelScore, reasons: U.feelReasons });
    toast('บันทึกแล้ว ขอบคุณ');
  },
  feelSkip() { C.U.feelAsk = null; },
  leaveAsk() {
    const v = visit(), done = !!v.left_at, logged = C.U.logged;
    showSheet({ say: false, badge: done ? 'จบการตรวจแล้ว' : 'คิว ' + qText(), tone: done ? 'go' : 'wait',
      title: done ? 'ต้องการทำอะไรต่อ' : 'ออกจากคิวนี้บนเครื่องนี้',
      body: done ? 'การติดตามการรักษายังอยู่ในบัญชีของคุณ เข้าสู่ระบบใหม่เมื่อไหร่ก็ดูได้' : 'คิวยังอยู่ในระบบ ค้นหากลับมาได้ด้วยเบอร์โทร',
      actions: [
        { label: IC.rx + 'รับคิวใหม่ ตรวจแผนกอื่น', main: true, fn: () => { restart('reg'); toast(logged ? 'เลือกแผนกที่จะตรวจ ชื่อและเบอร์กรอกไว้ให้แล้ว' : 'เลือกแผนกที่จะตรวจ'); } },
        { label: logged ? 'ลงชื่อออก' : 'กลับหน้าเข้าสู่ระบบ', fn: () => { restart('login'); toast(logged ? 'ลงชื่อออกแล้ว' : 'กลับหน้าเข้าสู่ระบบ'); } },
        { label: 'ยกเลิก', fn: () => closeSheet() }] });
    return 'norender';
  },
  // ติดตาม
  careView(view) {
    const U = C.U;
    U.care.view = view;
    if (view === 'quiz') { U.care.qStep = 0; U.care.ans = {}; }
    resetScroll = true;
  },
  quizPick(o) { const q = C.D.care.quiz.questions[C.U.care.qStep]; C.U.care.ans[q.k] = o; },
  quizNext() { C.U.care.qStep++; resetScroll = true; },
  quizBack() { if (C.U.care.qStep > 0) C.U.care.qStep--; else C.U.care.view = 'main'; },
  async quizSend() {
    await act('quizSend', { id: visit().id, ans: C.U.care.ans });
    Object.assign(C.U.care, { view: 'main', qStep: 0 }); resetScroll = true; toast('ส่งให้หมอแล้ว');
  },
  chatQuick(t) { C.U.care.draft = t; return ACT.chatSend(); },
  async chatSend() {
    const t = C.U.care.draft.trim();
    if (!t) return 'norender';
    C.U.care.draft = '';
    await act('chatSend', { id: visit().id, text: t });
  },
  /** โหมดสาธิต: กดแทนเจ้าหน้าที่/หมอ บนมือถือเครื่องเดียว (ใช้ action ชุดเดียวกับหน้า staff) */
  demoPanel() {
    const v = visit(), c = v.care, id = v.id, list = [];
    const add = (label, type, payload = { id }) => list.push({ label, fn: async () => { closeSheet(); try { await act(type, payload); } catch (e) { toast(e.message); } } });
    if (v.stage === 'vitals') add('คัดกรองเสร็จ', 'vitalsDone');
    if (v.stage === 'waiting') { add('เรียกคิวถัดไป (' + dept().name + ')', 'callNext', { dept: v.dept }); add('เรียกคิวนี้เลย', 'callVisit'); }
    if (v.stage === 'consult') add('บันทึกผลตรวจ', 'saveResult');
    if (v.stage === 'pharmacy' && v.rx === 'self') add('จ่ายยาแล้ว', 'dispensed');
    if (v.rx === 'delivery' && v.deliv < 4) add('เลื่อนสถานะการส่งยา', 'advDeliv');
    if (v.stage === 'done' && !v.left_at) add('ผู้ป่วยออกจาก รพ.', 'checkout');
    if (v.result && c.phase === 'waitq') add('หมอ: ส่งแบบประเมิน', 'docSendQ');
    if (c.phase === 'review') { add('หมอตัดสิน: นัดมาตรวจ', 'docFollow'); if (c.round < c.rounds) add('หมอตัดสิน: ส่งยาต่อ', 'docRefill'); }
    if (c.phase === 'refill') add('เลื่อนสถานะส่งยารอบต่อไป', 'advRefill');
    if (v.result) add('หมอ: ส่งข้อความ', 'docMsg');
    showSheet({ say: false, tone: 'act', badge: 'โหมดสาธิต', title: 'กดแทนเจ้าหน้าที่',
      body: list.length ? 'ปุ่มที่กดได้เปลี่ยนตามขั้นตอนของคุณ ในห้องเรียนจริงใช้หน้า staff บนคอมของผู้คุมแทนได้' : 'ขั้นนี้ไม่มีอะไรให้เจ้าหน้าที่กด รอผู้ป่วยทำขั้นต่อไป',
      actions: [...list, { label: 'ปิด', main: true, fn: () => closeSheet() }] });
    return 'norender';
  },
  mic() { toast('ต้นแบบนี้ยังไม่บันทึกเสียง'); return 'norender'; },
  calAdd() { toast('ลงปฏิทินแล้ว'); return 'norender'; },
  reschedule() {
    Object.assign(C.U, { tab: 'care' });
    C.U.care.view = 'chat';
    C.U.care.draft = C.D.care.chat.reschedule_text.replace('{date}', followDate().short);
    resetScroll = true;
  },
};

let busy = false;
async function run(name, arg, btn) {
  const fn = ACT[name];
  if (!fn || busy) return;
  busy = true;
  try {
    const res = await fn(arg, btn);
    if (res !== 'norender') render();
  } catch (e) {
    toast(e.message || 'เกิดข้อผิดพลาด');
    render();
  } finally { busy = false; }
}

// ---------- events ----------
document.addEventListener('click', e => {
  const sb = e.target.closest('[data-sheet]');
  if (sb) { runSheetAction(sb.dataset.sheet); return; }
  if (e.target.id === 'scrim') { closeSheet(); return; }
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  run(b.dataset.act, b.dataset.arg, b);
});
document.addEventListener('input', e => {
  const k = e.target.dataset.bind;
  if (!k) return;
  const ps = k.split('.');
  let o = C.U;
  for (let i = 0; i < ps.length - 1; i++) o = o[ps[i]];
  o[ps[ps.length - 1]] = e.target.value;
  if (k === 'lgName') { const m = $('lgMatch'); if (m) m.innerHTML = lgMatchHTML(); return; }
  // อัปเดตเฉพาะสถานะปุ่มระหว่างพิมพ์ ไม่วาดใหม่ทั้งหน้า
  const U = C.U, btn = document.querySelector('.dock .btn.main');
  if (U.screen === 'reg' && U.regStep === 2 && btn) btn.disabled = U.reg.name.trim().length < 2;
  if (U.screen === 'reg' && U.regStep === 3 && btn) btn.disabled = U.reg.phone.replace(/\D/g, '').length < 9;
  if (U.screen === 'home' && k === 'lookupPhone') { const l = document.querySelector('[data-act="lookup"]'); if (l) l.disabled = U.lookupPhone.replace(/\D/g, '').length < 9; }
});
document.addEventListener('keydown', e => {
  trapFocus(e);
  if (e.key === 'Escape') { closeSheet(); return; }
  if (e.key !== 'Enter' || sheetOpen()) return;
  if (e.target.id === 'lgName') { e.preventDefault(); if (lgMatch()) doLogin(); return; }
  if (e.target.id === 'chatIn') { e.preventDefault(); run('chatSend'); return; }
  if (e.target.matches('input.inp')) { e.preventDefault(); const b = document.querySelector('.dock .btn.main:not(:disabled), .dock [data-act="lookup"]:not(:disabled), .lg-card [data-act="otpSend"]'); b && b.click(); }
});

function fitPhone() {
  const ph = document.querySelector('.phone');
  if (!ph) return;
  if (innerWidth <= 560) { ph.style.zoom = ''; return; }
  const sc = Math.min(1, (innerHeight - 48) / 862);
  ph.style.zoom = sc < 0.995 ? sc.toFixed(3) : '';
}

// ---------- start ----------
async function start() {
  applyPrefs();
  try {
    C.T = await connect();
  } catch (e) {
    $('appInner').innerHTML = `<div class="scroll" style="padding:24px"><h1 class="q">เปิดแอปไม่ได้</h1><p class="sub">${e.message}</p><p class="sub">ถ้าเปิดไฟล์จากเครื่องโดยตรง (file://) ให้รันผ่าน local server ตามวิธีใน README</p></div>`;
    console.error(e);
    return;
  }
  C.D = C.T.D;
  C.mapSVG = mapSVG;
  const saved = loadSession();
  C.U = freshUI({ logged: !!saved.logged, visitId: saved.visitId || null, seenResult: saved.seenResult || null, chatSeen: saved.chatSeen || 0 });
  if (saved.name) C.U.reg.name = saved.name;
  if (saved.phone) C.U.reg.phone = saved.phone;
  if (visit()) C.U.screen = 'app';
  else if (saved.logged) C.U.screen = 'home';
  diffAlerts();
  C.T.onChange(() => { diffAlerts(); render(); });
  C.T.onStatus(renderAll);
  addEventListener('resize', fitPhone);
  fitPhone();
  setInterval(() => { if (!document.hidden && !document.activeElement?.matches('input,textarea')) render(); }, 30000);
  renderAll();
  document.body.dataset.ready = C.T.mode;
}
start();
