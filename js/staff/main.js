// หน้าเจ้าหน้าที่: ผังชั้น 3D, จอเรียกคิว, ตารางผู้ป่วยวันนี้, ติดตามหลังกลับบ้าน (หมอตัดสิน), value stream
// ดาวน์โหลด / นำเข้า / รีเซ็ต YAML และแชร์ลิงก์แอปผู้ป่วยด้วย QR code
import { connect, downloadText } from '../transport.js';
import { initFloor, floorHTML, ensureFloorLoop, redrawFloor, updateFloorUI, FLOOR_ACT, ST } from './floor.js';
import { valueStream } from '../lib/valuestream.js';
import { queueLabel } from '../lib/queue.js';
import { esc, isoLocal } from '../lib/util.js';
import { IC, ASME, SYMNAME, LOGO } from '../ui/icons.js';
import { toast } from '../ui/sheet.js';
import qrcode from '../../vendor/qrcode.mjs';

const $ = id => document.getElementById(id);
let T, D;
const U = { showDone: false, docId: null, docPicked: false, tpl: {} };

const stageOf = k => D.stages.find(s => s.key === k);
const stagePill = k => { const s = stageOf(k); return `<span class="stg g-${k}">${ASME[s.sym]}${s.name}</span>`; };
const appVisits = () => T.state.visits.filter(v => !v.demo);

// ---------- ส่วนต่าง ๆ ----------
function barHTML() {
  const c = { live: ['', 'Live'], off: ['off', 'ออฟไลน์'], local: ['local', 'ในเครื่อง'] }[T.status];
  return `<h1 style="display:flex;align-items:center;gap:10px">${LOGO(40, false)}หน้าเจ้าหน้าที่<span>Closely DR. × IE BUU</span></h1>
    <span class="conn sconn ${c[0]}" role="status" aria-label="สถานะการเชื่อมต่อ: ${c[1]}"><i aria-hidden="true"></i>${c[1]}</span>
    <a class="sbtn" href="./" target="_blank" rel="noopener">เปิดแอปผู้ป่วย</a>
    <button class="sbtn" data-act="share">${IC.phone}แชร์ลิงก์</button>
    <button class="sbtn" data-act="yaml">ดาวน์โหลด YAML</button>
    <label class="sbtn" for="importFile" tabindex="0" role="button" id="importLbl">นำเข้า YAML</label><input type="file" id="importFile" accept=".yaml,.yml,text/yaml" class="sr" tabindex="-1">
    <button class="sbtn" data-act="reset">รีเซ็ตข้อมูล</button>`;
}

function callersHTML() {
  return D.deptList.map(d => {
    const q = T.state.queues[d.key], wait = Math.max(0, q.last_issued - q.calling);
    return `<div class="caller"><span class="d">${d.name}</span><span class="w">กำลังเรียก</span><span class="n" aria-live="polite">${queueLabel(d, q.calling)}</span>
      <span class="w">รอ ${wait} คิว</span><button class="sbtn pri" data-act="callNext" data-arg="${d.key}" ${wait ? '' : 'disabled'}>เรียกคิวถัดไป</button></div>`;
  }).join('');
}

function actionFor(v) {
  switch (v.stage) {
    case 'vitals': return `<button class="sbtn" data-act="vitalsDone" data-arg="${v.id}">คัดกรองเสร็จ</button>`;
    case 'waiting': return `<button class="sbtn" data-act="callVisit" data-arg="${v.id}">เรียกคิวนี้</button>`;
    case 'consult': {
      const sel = U.tpl[v.id] || D.depts[v.dept].result;
      return `<label class="sr" for="dx-${v.id}">ผลวินิจฉัยสำเร็จรูปของ ${v.queue}</label><select class="dxsel" id="dx-${v.id}" data-tpl="${v.id}">${D.templates.map(t => `<option value="${t.id}" ${t.id === sel ? 'selected' : ''}>${t.dx}</option>`).join('')}</select><button class="sbtn" data-act="saveResult" data-arg="${v.id}">บันทึกผลตรวจ</button>`;
    }
    case 'pharmacy':
      if (v.rx === 'self') return `<button class="sbtn" data-act="dispensed" data-arg="${v.id}">จ่ายยาแล้ว</button>`;
      return `<span style="color:#4A5568">รอผู้ป่วยเลือกวิธีรับยา</span>`;
    default:
      if (v.rx === 'delivery' && v.deliv < 4) return `<button class="sbtn" data-act="advDeliv" data-arg="${v.id}">เลื่อนสถานะการส่งยา</button> <small style="color:#465166">${D.app.delivery.steps[v.deliv]}</small>`;
      if (!v.left_at && !v.demo) return `<button class="sbtn" data-act="checkout" data-arg="${v.id}">ผู้ป่วยออกจาก รพ.</button>`;
      return '<span style="color:#4A5568">เสร็จแล้ว</span>';
  }
}
const needsAction = v => v.stage !== 'done' || (v.rx === 'delivery' && v.deliv < 4) || (!v.left_at && !v.demo);

function tableHTML() {
  const list = T.state.visits.filter(v => U.showDone || needsAction(v)).sort((a, b) => a.queue.localeCompare(b.queue));
  return `<div class="tools"><label><input type="checkbox" id="showDone" ${U.showDone ? 'checked' : ''}>แสดงที่เสร็จแล้ว</label>
      <button class="sbtn" data-act="addMock">เพิ่มผู้ป่วยจำลอง 3 คน</button></div>
    <div class="tblwrap" tabindex="0" role="region" aria-label="ตารางผู้ป่วยวันนี้"><table><caption class="sr">ผู้ป่วยวันนี้ ${list.length} คน</caption><thead><tr><th scope="col">คิว</th><th scope="col">ชื่อ</th><th scope="col">แผนก</th><th scope="col">ขั้นตอน</th><th scope="col">การกระทำ</th></tr></thead><tbody>
      ${list.map(v => `<tr class="${v.demo ? '' : 'me'}"><td class="q">${v.queue}</td><td>${esc(v.name)}${v.demo ? '' : ' <small style="color:#1E5BB8;font-weight:700">(ในแอป)</small>'}</td><td>${D.depts[v.dept].name}${v.dept_chosen === D.unsure.key ? ' <small style="color:#465166">(ไม่แน่ใจ)</small>' : ''}</td><td>${stagePill(v.stage)}</td><td>${actionFor(v)}</td></tr>`).join('') || '<tr><td colspan="5" style="color:#465166">ไม่มีผู้ป่วยที่ต้องดำเนินการ</td></tr>'}
    </tbody></table></div>`;
}

function doctorHTML() {
  const cands = T.state.visits.filter(v => v.result).sort((a, b) => (a.demo - b.demo) || b.result.at.localeCompare(a.result.at));
  // ค่าเริ่มต้นตามผู้ป่วยในแอปล่าสุดที่พบแพทย์แล้ว จนกว่า staff จะเลือกเอง
  if (!U.docPicked || !cands.some(v => v.id === U.docId)) { U.docId = cands[0]?.id || null; U.docPicked = false; }
  const v = cands.find(x => x.id === U.docId), c = v?.care, qs = D.care.quiz.questions;
  const pick = cands.length ? `<label class="sr" for="docPick">เลือกผู้ป่วย</label><select class="dxsel" id="docPick">${cands.map(x => `<option value="${x.id}" ${x.id === U.docId ? 'selected' : ''}>${x.queue} ${esc(x.name)}${x.demo ? '' : ' (ในแอป)'}</option>`).join('')}</select>` : '';
  const ans = v ? qs.filter(q => c.ans[q.k]).map(q => `<li class="${(q.risk || []).includes(c.ans[q.k]) ? 'r' : ''}"><span>${q.q}</span><b>${esc(c.ans[q.k])}</b></li>`).join('') : '';
  const on = !!v;
  return `<h2>ติดตามหลังกลับบ้าน <span style="font-weight:500;color:#465166;font-size:15px">หมอเป็นผู้ตัดสินทุกขั้น</span></h2>
  <div class="docgrid">
    <div class="dcard"><h3>แบบประเมินที่หมอตั้ง</h3><p class="dsub">${D.care.quiz.title}</p>
      <ol>${qs.map(q => `<li>${q.q}</li>`).join('')}</ol>
      <button class="sbtn pri" data-act="docSendQ" ${on && c.phase === 'waitq' ? '' : 'disabled'}>ส่งแบบประเมินให้ผู้ป่วย</button></div>
    <div class="dcard"><h3>${on ? `${v.queue} ${esc(v.name)}` : 'ยังไม่มีผู้ป่วยที่พบแพทย์แล้ว'}</h3>${pick}
      ${on ? `<p class="dsub">สถานะ: <b>${D.care.phases[c.phase].staff}</b> รอบที่ ${c.round} จาก ${c.rounds}</p>` : ''}
      ${ans ? `<ul class="dans">${ans}</ul>` : '<p class="dsub">ยังไม่มีคำตอบ</p>'}
      <div class="dbtns"><button class="sbtn pri" data-act="docFollow" ${on && c.phase === 'review' ? '' : 'disabled'}>นัดมาตรวจ</button>
      <button class="sbtn pri" data-act="docRefill" ${on && c.phase === 'review' && c.round < c.rounds ? '' : 'disabled'}>ส่งยารอบต่อไป</button></div>
      <button class="sbtn" data-act="advRefill" ${on && c.phase === 'refill' ? '' : 'disabled'}>เลื่อนสถานะส่งยา${on && c.phase === 'refill' ? ` (${D.app.delivery.steps[c.rdeliv]})` : ''}</button></div>
    <div class="dcard"><h3>แชทกับผู้ป่วย</h3><div class="dchat">${on ? v.chat.filter(m => Date.parse(m.at) <= Date.now()).slice(-4).map(m => `<p class="${m.from}"><b>${m.from === 'doc' ? 'หมอ' : 'ผู้ป่วย'}:</b> ${esc(m.t)}</p>`).join('') : ''}</div>
      <button class="sbtn" data-act="docMsg" ${on ? '' : 'disabled'} style="margin-top:auto">ส่งข้อความถามอาการ</button></div>
  </div>`;
}

function valueStreamHTML() {
  const vs = valueStream(D, T.state), mx = Math.max(1, ...vs.rows.map(r => r.avg));
  const faces = D.app.faces;
  return `<h2>Value stream ของผู้ป่วย <span style="font-weight:500;color:#465166;font-size:15px">ข้อมูลย้อนหลัง ${vs.histN} ราย + ในแอปวันนี้ ${vs.liveN} ราย</span></h2>
    <dl class="kpis">
      <div class="kpi"><dt>Lead time เฉลี่ย</dt><dd>${vs.lead} <small>นาที</small></dd><dd class="kp">ตั้งแต่ลงทะเบียนถึงกลับบ้าน</dd></div>
      <div class="kpi"><dt>เวลาที่เพิ่มคุณค่า (VA)</dt><dd>${vs.va} <small>นาที</small></dd><dd class="kp">พบแพทย์ + รับยา</dd></div>
      <div class="kpi"><dt>PCE</dt><dd>${vs.pce}<small>%</small></dd><dd class="kp">VA ÷ lead time</dd></div>
      <div class="kpi"><dt>สัดส่วนความสูญเปล่า (NVA)</dt><dd>${vs.nvaPct}<small>%</small></dd><dd class="kp">ส่วนใหญ่มาจากการรอเรียกคิว</dd></div>
    </dl>
    <div class="tblwrap" tabindex="0" role="region" aria-label="ตาราง value stream"><table><caption class="sr">เวลาและความรู้สึกแต่ละขั้น</caption><thead><tr><th scope="col"><span class="sr">สัญลักษณ์</span></th><th scope="col">ขั้นตอน</th><th scope="col">ประเภท</th><th scope="col" style="width:28%">เวลาเฉลี่ย (นาที)</th><th scope="col">สูงสุด</th><th scope="col">อารมณ์เฉลี่ย</th><th scope="col">ความเห็นผู้ป่วย</th></tr></thead><tbody>
      ${vs.rows.map(r => {
        const low = r.mood != null && r.mood < 3, face = r.mood != null ? faces[Math.min(4, Math.max(0, Math.round(r.mood) - 1))] : null;
        const reasons = Object.entries(r.reasons).sort((a, b) => b[1] - a[1]).map(([t, n]) => `<q>${esc(t)} <small>(${n} คนในแอป)</small></q>`).join('');
        return `<tr class="${low ? 'low' : ''}"><td class="ssym" title="${SYMNAME[r.sym]}"><span class="sr">${SYMNAME[r.sym]}</span>${ASME[r.sym]}</td><td><b>${r.name}</b>${r.liveCount ? `<br><small style="color:#465166">ในแอป ${r.liveCount} ราย</small>` : ''}</td><td><span class="vtag v-${r.value}">${r.value}</span></td>
        <td><div style="display:flex;align-items:center;gap:8px"><div class="bar ${r.value}" style="width:${r.avg / mx * 100}%"></div><span class="num" style="font-weight:700">${r.avg}</span></div></td>
        <td class="num">${r.max}</td><td class="mood">${face ? `<span aria-hidden="true">${face[0]}</span><small>${r.mood.toFixed(1)}</small>` : '–'}${low ? '<span class="lowtag">ต่ำ</span>' : ''}</td>
        <td class="cm">${r.comments.map(c => `<q>${esc(c)}</q>`).join('')}${reasons}${!r.comments.length && !reasons ? '<span style="color:#5B6676">ยังไม่มี</span>' : ''}</td></tr>`;
      }).join('')}
    </tbody></table></div>`;
}

function renderRest() {
  $('sbar').innerHTML = barHTML();
  $('callers').innerHTML = callersHTML();
  $('patients').innerHTML = tableHTML();
  $('doctor').innerHTML = doctorHTML();
  $('vstream').innerHTML = valueStreamHTML();
}
function renderFloor() { $('floor').innerHTML = floorHTML(); ensureFloorLoop(); }

// ---------- แชร์ลิงก์ ----------
function patientUrl() { return new URL('./', location.href).href.replace(/index\.html$/, ''); }
function share() {
  const url = patientUrl(), qr = qrcode(0, 'M');
  qr.addData(url); qr.make();
  const local = /^(localhost|127\.|\[::1\])/.test(location.hostname);
  $('shareBody').innerHTML = `<div class="qrbox" role="img" aria-label="QR code ของลิงก์แอปผู้ป่วย">${qr.createSvgTag({ cellSize: 6, margin: 3, scalable: true })}</div>
    <p class="qrurl"><a href="${esc(url)}" target="_blank" rel="noopener">${esc(url)}</a></p>
    <div class="qracts"><button class="sbtn pri" data-act="copyLink">คัดลอกลิงก์</button><button class="sbtn" data-act="closeShare">ปิด</button></div>
    ${local ? '<p class="qrnote">ลิงก์นี้เป็นเครื่องของคุณเอง (localhost) มือถือเครื่องอื่นเปิดไม่ได้ ใช้ลิงก์ GitHub Pages หรือรัน <code>npm run start:lan</code> แล้วเปิดหน้านี้ด้วยเลข IP</p>' : ''}
    <p class="qrnote">${T.mode === 'local' ? 'โหมดไม่มี server: แต่ละเครื่องเก็บข้อมูลของตัวเอง ให้แต่ละกลุ่มเปิดแอปผู้ป่วยกับหน้า staff ในเบราว์เซอร์เดียวกัน' : 'โหมด server: ทุกเครื่องที่เปิดลิงก์นี้เห็นคิวเดียวกัน'}</p>`;
  $('shareDlg').showModal();
}

// ---------- การกระทำ ----------
const ACT = {
  ...FLOOR_ACT,
  async callNext(k) { const r = await T.act('callNext', { dept: k }); toast(`เรียกคิว ${r.called}`); },
  async callVisit(id) { const r = await T.act('callVisit', { id }); toast(`เรียกคิว ${r.called}`); },
  async vitalsDone(id) { await T.act('vitalsDone', { id }); toast('คัดกรองเสร็จ'); },
  async saveResult(id) { await T.act('saveResult', { id, template: U.tpl[id] }); toast('บันทึกผลตรวจแล้ว'); },
  async dispensed(id) { await T.act('dispensed', { id }); toast('จ่ายยาแล้ว'); },
  async advDeliv(id) { await T.act('advDeliv', { id }); const v = T.state.visits.find(x => x.id === id); toast('ยา: ' + D.app.delivery.steps[v.deliv]); },
  async checkout(id) { await T.act('checkout', { id }); toast('ผู้ป่วยออกจาก รพ. แล้ว'); },
  async addMock() { await T.act('addMock'); toast('เพิ่มผู้ป่วยจำลอง 3 คนแล้ว'); },
  async docSendQ() { await T.act('docSendQ', { id: U.docId }); toast('ส่งแบบประเมินแล้ว'); },
  async docFollow() { await T.act('docFollow', { id: U.docId }); toast('นัดมาตรวจแล้ว'); },
  async docRefill() { await T.act('docRefill', { id: U.docId }); toast('สั่งส่งยารอบต่อไปแล้ว'); },
  async advRefill() { await T.act('advRefill', { id: U.docId }); toast('เลื่อนสถานะส่งยาแล้ว'); },
  async docMsg() { await T.act('docMsg', { id: U.docId }); toast('ส่งข้อความแล้ว'); },
  async yaml() {
    const text = await T.exportYaml();
    downloadText(text, `closely-usage-${isoLocal().slice(0, 16).replace(/[:T]/g, '-')}.yaml`);
    toast('ดาวน์โหลด YAML แล้ว');
  },
  async reset() {
    if (!confirm('รีเซ็ตข้อมูลทั้งหมดกลับเป็นข้อมูลตั้งต้น? คิวและบันทึกการใช้งานทั้งหมดจะหายไป (ดาวน์โหลด YAML เก็บไว้ก่อนได้)')) return;
    await T.act('reset'); ST.skey = null; toast('รีเซ็ตข้อมูลแล้ว');
  },
  share() { share(); },
  closeShare() { $('shareDlg').close(); },
  async copyLink() {
    try { await navigator.clipboard.writeText(patientUrl()); toast('คัดลอกลิงก์แล้ว'); }
    catch { toast('คัดลอกไม่ได้ กดค้างที่ลิงก์เพื่อคัดลอก'); }
  },
};

async function run(name, arg) {
  const fn = ACT[name];
  if (!fn) return;
  try {
    const full = await fn(arg);
    if (full === true) renderFloor();
  } catch (e) { toast(e.message || 'เกิดข้อผิดพลาด'); }
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  run(b.dataset.act, b.dataset.arg);
});
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.id === 'importLbl') { e.preventDefault(); $('importFile').click(); }
});
document.addEventListener('change', async e => {
  if (e.target.id === 'showDone') { U.showDone = e.target.checked; $('patients').innerHTML = tableHTML(); $('showDone').focus(); }
  if (e.target.id === 'docPick') { U.docId = e.target.value; U.docPicked = true; $('doctor').innerHTML = doctorHTML(); $('docPick').focus(); }
  if (e.target.dataset.tpl) U.tpl[e.target.dataset.tpl] = e.target.value;
  if (e.target.id === 'importFile') {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try { await T.importYaml(await f.text()); ST.skey = null; toast(`นำเข้า ${f.name} แล้ว`); }
    catch (err) { toast(err.message); }
  }
});

async function start() {
  try { T = await connect(); }
  catch (e) { document.getElementById('staff').innerHTML = `<h1>เปิดหน้าเจ้าหน้าที่ไม่ได้</h1><p>${esc(e.message)}</p>`; console.error(e); return; }
  D = T.D;
  initFloor({ D, T });
  renderFloor();
  renderRest();
  T.onChange(() => {
    const keep = document.activeElement?.id;
    renderRest(); updateFloorUI(); ST.skey = null; redrawFloor();
    if (keep && $(keep)) $(keep).focus();
  });
  T.onStatus(() => { $('sbar').innerHTML = barHTML(); });
  setInterval(() => { if (!document.hidden && !$('doctor').contains(document.activeElement)) $('doctor').innerHTML = doctorHTML(); }, 5000);
  document.body.dataset.ready = T.mode;
}
start();
