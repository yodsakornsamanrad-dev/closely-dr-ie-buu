// หน้าเข้าสู่ระบบ / สแกนใบหน้า / หน้าแรก / ลงทะเบียน 4 ขั้น
import { C } from './ctx.js';
import { esc } from '../lib/util.js';
import { queueLabel } from '../lib/queue.js';
import { IC, LOGO } from '../ui/icons.js';

const acct = () => C.D.app.demo_account;
export const lgMatch = () => {
  const n = (C.U.lgName || '').replace(/\s+/g, '');
  return n === acct().first || n === acct().full.replace(/\s+/g, '');
};
export function lgMatchHTML() {
  const n = (C.U.lgName || '').trim(), a = acct();
  if (lgMatch()) return `<div class="acct ok"><span class="av" aria-hidden="true">${a.initials}</span><span><b>พบบัญชีของคุณ</b><small>${a.full} ${a.phone_masked}</small></span>${IC.check}</div>
    <button class="btn main" data-act="lgSubmit">เข้าสู่ระบบ</button>`;
  if (n.length >= 2) return `<p class="lg-hint warn">ยังไม่พบชื่อนี้ ลองตรวจตัวสะกดอีกครั้ง หรือใช้สแกนใบหน้าแทน</p>`;
  return `<p class="lg-hint">พิมพ์ชื่อจริงให้ถูกต้อง แล้วปุ่มเข้าสู่ระบบจะปรากฏ</p>`;
}

export function loginScreen() {
  const U = C.U;
  if (U.face !== null) return faceScreen();
  const otp = U.otpOpen
    ? `<label class="f" for="otpPh">เบอร์โทรศัพท์</label><input class="inp num" id="otpPh" data-bind="lookupPhone" inputmode="numeric" autocomplete="tel" placeholder="08x xxx xxxx" value="${esc(U.lookupPhone)}">
    <button class="btn" data-act="otpSend">ส่งรหัส OTP ทาง SMS</button>`
    : `<button class="link" style="justify-self:center" data-act="otpOpen">ใช้เบอร์โทรแทน</button>`;
  const body = `<div class="lg-hero">${LOGO(92, false)}<h1>Closely DR.</h1><p>ดูแลคุณใกล้ชิด ทุกขั้นตอนที่โรงพยาบาล</p></div>
    <div class="lg-card"><h2>เข้าสู่ระบบ</h2>
      <label class="f" for="lgName">ชื่อจริงของคุณ</label>
      <input class="inp" id="lgName" data-bind="lgName" autocomplete="given-name" placeholder="เช่น สมชาย" value="${esc(U.lgName)}">
      <div id="lgMatch" aria-live="polite" style="display:grid;gap:10px">${lgMatchHTML()}</div>
      <div class="or"><span>หรือ</span></div>
      <button class="btn faceb" data-act="faceStart">${IC.face}สแกนใบหน้าเข้าสู่ระบบ</button>
      ${otp}
    </div>
    <button class="guest" data-act="guest">ยังไม่มีบัญชี? <b>รับคิวได้เลย ไม่ต้องสมัคร</b></button>
    <p class="lg-note">เดโม: ลองพิมพ์ "${acct().first}" · <a href="staff.html">หน้าเจ้าหน้าที่</a></p>`;
  return { body, dock: '', tabs: false, full: true };
}

function faceScreen() {
  const ph = C.U.face;
  const t = ['จัดใบหน้าให้อยู่ในกรอบ', 'กำลังสแกนใบหน้า', 'ยืนยันตัวตนสำเร็จ'][ph];
  const sub = ['มองตรงที่กล้อง ถอดแว่นกันแดดและหน้ากาก', 'อยู่นิ่ง ๆ สักครู่นะคะ', `ยินดีต้อนรับ คุณ${acct().first}`][ph];
  const body = `<div class="fscan"><button class="back fb" data-act="faceCancel">${IC.back}ยกเลิก</button>
    <h1 aria-live="polite">${t}</h1><p>${sub}</p>
    <div class="fframe ph${ph}"><svg viewBox="0 0 240 290" aria-hidden="true">
      <defs><linearGradient id="fl" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#2D55E0" stop-opacity="0"/><stop offset=".5" stop-color="#2D55E0" stop-opacity=".55"/><stop offset="1" stop-color="#2D55E0" stop-opacity="0"/></linearGradient>
      <clipPath id="fc"><ellipse cx="120" cy="140" rx="88" ry="114"/></clipPath></defs>
      <ellipse cx="120" cy="140" rx="88" ry="114" fill="var(--act-bg)"/>
      <g clip-path="url(#fc)"><ellipse cx="120" cy="126" rx="46" ry="58" fill="var(--card)" opacity=".85"/><path d="M40 270c6-42 40-66 80-66s74 24 80 66z" fill="var(--card)" opacity=".85"/>
        <rect class="fline" x="30" y="132" width="180" height="16" fill="url(#fl)"/></g>
      <g class="fdots" stroke="#2D55E0" stroke-width="1" fill="#2D55E0"><path d="M102 116L120 140L138 116M104 160L120 140L136 160M104 160H136" fill="none" opacity=".5"/>
        <circle cx="102" cy="116" r="3"/><circle cx="138" cy="116" r="3"/><circle cx="120" cy="140" r="3"/><circle cx="104" cy="160" r="3"/><circle cx="136" cy="160" r="3"/></g>
      <ellipse cx="120" cy="140" rx="96" ry="122" fill="none" stroke="var(--line)" stroke-width="6"/>
      <ellipse class="fprog" cx="120" cy="140" rx="96" ry="122" fill="none" stroke="var(--act)" stroke-width="6" stroke-linecap="round" pathLength="100"/>
      <g class="fok"><circle cx="120" cy="140" r="36" fill="#3CCB95"/><path d="M104 141l11 11 22-24" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></g>
    </svg></div>
    <p class="fnote">ต้นแบบ: จำลองการสแกน ไม่ได้เปิดกล้องจริง</p></div>`;
  return { body, dock: '', tabs: false, full: true };
}

export function boardHTML() {
  const s = C.T.state;
  return C.D.deptList.map(d => {
    const q = s.queues[d.key], wait = Math.max(0, q.last_issued - q.calling);
    return `<div class="brow"><span class="dn">${d.name}</span>
      <span class="cn"><small>กำลังเรียก</small><b>${queueLabel(d, q.calling)}</b></span>
      <span class="dm">รอ <b>${wait}</b> คิว ประมาณ <b>${wait * C.D.app.minutes_per_queue}</b> นาที</span></div>`;
  }).join('');
}

export function homeScreen() {
  const U = C.U;
  const body = `<div class="hero">
      ${U.logged ? `<p class="hi">สวัสดีค่ะ คุณ${esc(U.reg.name || acct().first)}</p>` : ''}<h1 class="q">รับคิวตรวจผู้ป่วยนอก</h1>
      <p class="sub">ไม่ต้องกรอกเอกสาร ตอบ 4 คำถาม แล้วรอคิวที่ไหนก็ได้ แอปจะเตือนเมื่อใกล้ถึงคิว</p>
    </div>
    <h2 class="sec" style="margin-top:8px">คิวที่กำลังเรียกตอนนี้<span class="live"><i></i>อัปเดตอัตโนมัติ</span></h2>
    <div class="board">${boardHTML()}</div>
    <div class="insight">${IC.wc}<span>ระหว่างรอ ไปเข้าห้องน้ำหรือซื้อกาแฟได้ แอปจะเตือนเมื่อเหลือ ${C.D.app.alerts.ready_at} คิว</span></div>`;
  let dock = `<button class="btn main" data-act="startReg">รับคิว</button>`;
  if (U.lookupOpen) {
    dock += `<label class="f" for="lk">เบอร์โทรที่ใช้ตอนรับคิว</label>
      <input class="inp num" id="lk" data-bind="lookupPhone" inputmode="numeric" autocomplete="tel" placeholder="08x xxx xxxx" value="${esc(U.lookupPhone)}">
      <button class="btn" data-act="lookup" ${U.lookupPhone.replace(/\D/g, '').length < 9 ? 'disabled' : ''}>ค้นหาคิว</button>`;
  } else dock += `<button class="btn" data-act="lookupOpen">${IC.phone}มีคิวแล้ว ค้นหาด้วยเบอร์โทร</button>`;
  return { body, dock, tabs: false };
}

export function regScreen() {
  const U = C.U, n = U.regStep, R = U.reg, D = C.D;
  const all = [...D.deptList, D.unsure];
  const head = `<div class="rhead"><button class="back" data-act="regBack" aria-label="ย้อนกลับ">${IC.back}ย้อนกลับ</button>
    <div class="prog" aria-hidden="true">${[1, 2, 3, 4].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</div>
    <span class="stepn" aria-label="ขั้นที่ ${n} จาก 4">${n}/4</span></div>`;
  let body = '', ok = false, label = 'ถัดไป';
  if (n === 1) {
    body = `<h1 class="q" id="qh">มาตรวจแผนกไหน</h1><p class="sub">เลือก 1 ข้อ ถ้าไม่แน่ใจ พยาบาลจะช่วยเลือกให้</p>
      <div class="dlist" role="radiogroup" aria-labelledby="qh">${all.map(d => `
        <button class="dopt ${d.key === D.unsure.key ? 'unsure' : ''}" role="radio" aria-checked="${R.dept === d.key}" data-act="pickDept" data-arg="${d.key}">
          <span class="rad"></span><span><b>${d.name}</b><span>${d.hint}</span></span></button>`).join('')}</div>`;
    ok = !!R.dept;
  } else if (n === 2) {
    body = `<h1 class="q"><label for="nm">ชื่อ-นามสกุล</label></h1><p class="sub">ใช้เรียกชื่อตอนถึงคิว</p>
      <input class="inp" id="nm" data-bind="reg.name" autocomplete="name" placeholder="เช่น สมชาย ใจดี" value="${esc(R.name)}">`;
    ok = R.name.trim().length > 1;
  } else if (n === 3) {
    body = `<h1 class="q"><label for="ph">เบอร์โทรศัพท์</label></h1><p class="sub">ใช้ค้นหาคิวนี้จากมือถือเครื่องอื่นได้ เช่น ของลูกหลาน</p>
      <input class="inp num" id="ph" data-bind="reg.phone" inputmode="numeric" autocomplete="tel" placeholder="08x xxx xxxx" value="${esc(R.phone)}">`;
    ok = R.phone.replace(/\D/g, '').length >= 9;
  } else {
    const d = all.find(x => x.key === R.dept);
    body = `<h1 class="q">ตรวจสอบข้อมูล</h1><p class="sub">ถูกต้องแล้วกด "รับคิว" ด้านล่าง</p>
      <dl class="sum">
        <div><span><dt>แผนก</dt><dd>${d.name}</dd></span><button class="edit" data-act="regGo" data-arg="1" aria-label="แก้แผนก">แก้</button></div>
        <div><span><dt>ชื่อ</dt><dd>${esc(R.name)}</dd></span><button class="edit" data-act="regGo" data-arg="2" aria-label="แก้ชื่อ">แก้</button></div>
        <div><span><dt>เบอร์โทร</dt><dd class="num">${esc(R.phone)}</dd></span><button class="edit" data-act="regGo" data-arg="3" aria-label="แก้เบอร์โทร">แก้</button></div>
      </dl>
      <h2 class="sec" style="margin-top:0">มีอาการอะไรบ้าง <span class="muted" style="font-weight:400;font-size:.889rem">(ข้ามได้)</span></h2>
      <div class="chips">${d.symptoms.map(s => `<button class="chip" aria-pressed="${R.sym.includes(s)}" data-act="toggleSym" data-arg="${esc(s)}">${R.sym.includes(s) ? IC.check : ''}${s}</button>`).join('')}</div>`;
    ok = true; label = 'รับคิว';
  }
  return { body: head + body, dock: `<button class="btn main" data-act="${n < 4 ? 'regNext' : 'submitReg'}" ${ok ? '' : 'disabled'}>${label}</button>`, tabs: false };
}
