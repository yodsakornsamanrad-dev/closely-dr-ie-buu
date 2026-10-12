'use strict';
// หน้าเจ้าหน้าที่: จำลองการทำงานของโรงพยาบาล + Value stream / Customer Journey Map จากข้อมูลใน YAML

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const api = (url, body) => Closely.api(url, body); // transport.js: server หรือโหมด GitHub Pages
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => { t.hidden = true; }, 2800);
}

const S = { cfg: null, board: [], visits: [], stats: [], showDone: false, dirty: false };
const FACE = s => s == null ? '–' : s >= 4.5 ? '😀' : s >= 3.5 ? '🙂' : s >= 2.5 ? '😐' : s >= 1.5 ? '🙁' : '😣';

const SYMBOL = {
  operation: '<circle class="shape" cx="14" cy="14" r="10"/>',
  inspection: '<rect class="shape" x="4.5" y="4.5" width="19" height="19"/>',
  delay: '<path class="shape" d="M5 4.5h9a9.5 9.5 0 0 1 0 19H5z"/>',
  transport: '<path class="shape" d="M3 10.5h13V5l9 9-9 9v-5.5H3z"/>',
};
const DEFAULT = { register: ['operation', 'NNVA'], vitals: ['inspection', 'NNVA'], waiting: ['delay', 'NVA'], consult: ['operation', 'VA'], pharmacy: ['operation', 'VA'] };
const VALUE_LABEL = { VA: 'เพิ่มคุณค่า', NNVA: 'จำเป็น ไม่เพิ่มคุณค่า', NVA: 'สูญเปล่า' };
const sym = n => `<svg class="sym" viewBox="0 0 28 28" aria-hidden="true">${SYMBOL[n] || SYMBOL.operation}</svg>`;

async function refresh() {
  [S.cfg, S.board, S.visits, S.stats] = await Promise.all([api('/api/config'), api('/api/board'), api('/api/staff/visits'), api('/api/staff/analytics')]);
  render();
}

function actionCell(v) {
  const btn = (label, act, cls = '') => `<button class="btn ${cls}" data-act="${act}" data-id="${v.id}">${label}</button>`;
  if (v.stage === 'vitals') return btn('คัดกรองเสร็จ', 'advance');
  if (v.stage === 'waiting') return btn('เรียกคิวนี้', 'advance', 'line');
  if (v.stage === 'consult') {
    const tpl = [...S.cfg.diagnosisTemplates].sort((a, b) => (b.dept === v.dept) - (a.dept === v.dept));
    return `<select id="tpl-${v.id}" aria-label="ผลวินิจฉัย">${tpl.map(t => `<option value="${t.id}">${esc(t.diagnosis)}${t.dept === v.dept ? '' : ' (' + t.dept + ')'}</option>`).join('')}</select>
      ${btn('บันทึกผลตรวจ', 'diagnose')}`;
  }
  if (v.stage === 'pharmacy') {
    const mp = v.medPickup;
    if (mp && mp.mode === 'delivery') {
      const steps = S.cfg.settings.deliverySteps;
      const next = steps[steps.findIndex(x => x.key === mp.status) + 1];
      return `<span class="muted">ส่งถึงบ้าน: ${esc(steps.find(x => x.key === mp.status)?.label)}</span> ${next ? btn(next.label, 'advance', 'line') : ''}`;
    }
    return `<span class="muted">${mp ? 'รอรับที่ห้องยา' : 'ยังไม่เลือกวิธีรับยา'}</span> ${btn('จ่ายยาแล้ว', 'advance', 'line')}`;
  }
  return '<span class="muted">เสร็จสิ้น</span>';
}

// Value stream: เวลาเฉลี่ยแต่ละขั้น แยก VA / NNVA / NVA + ความรู้สึกของผู้ป่วย
function valueStream() {
  const rows = S.stats.map(s => {
    const j = S.cfg.journey.find(x => x.key === s.key) || {};
    const [dsym, dval] = DEFAULT[s.key] || ['operation', 'NNVA'];
    return { ...s, symbol: j.symbol || dsym, value: j.value || dval };
  });
  const sum = list => list.reduce((n, r) => n + (r.avgMinutes || 0), 0);
  const lead = sum(rows);
  const va = sum(rows.filter(r => r.value === 'VA'));
  const nva = sum(rows.filter(r => r.value === 'NVA'));
  const max = Math.max(1, ...rows.map(r => r.avgMinutes || 0));
  const pct = x => lead ? Math.round((x / lead) * 100) : 0;
  return `<dl class="kpis">
      <div><dt>Lead time เฉลี่ย</dt><dd>${Math.round(lead)}<small> นาที</small></dd></div>
      <div><dt>เวลาที่เพิ่มคุณค่า (VA)</dt><dd>${Math.round(va)}<small> นาที</small></dd></div>
      <div><dt>Process cycle efficiency</dt><dd>${pct(va)}<small>%</small></dd></div>
      <div class="nva"><dt>เวลาสูญเปล่า (NVA)</dt><dd>${pct(nva)}<small>%</small></dd></div>
    </dl>
    <div class="scroll"><table class="vsm"><thead><tr><th>ขั้นตอน</th><th>ประเภท</th><th class="bar-col">เวลาเฉลี่ย (นาที)</th><th>นานสุด</th><th>ความรู้สึก</th><th>สิ่งที่ผู้ป่วยบอก</th></tr></thead><tbody>
    ${rows.map(r => `<tr>
      <td><span class="stage-name">${sym(r.symbol)}<b>${esc(r.label)}</b></span><span class="muted small">${r.visits} ราย</span></td>
      <td><span class="tag ${r.value}">${r.value}</span><div class="muted small">${VALUE_LABEL[r.value] || ''}</div></td>
      <td class="bar-col"><span class="num">${r.avgMinutes ?? '–'}</span><div class="bar ${r.value}" style="width:${((r.avgMinutes || 0) / max) * 100}%"></div></td>
      <td class="num">${r.maxMinutes ?? '–'}</td>
      <td class="${r.avgScore != null && r.avgScore < 3 ? 'low' : ''}"><span class="emo">${FACE(r.avgScore)}</span> <span class="num">${r.avgScore ?? ''}</span> <span class="muted small">(${r.feedbackCount})</span></td>
      <td>${r.comments.length ? `<ul class="comments">${r.comments.map(c => `<li><span aria-hidden="true">${FACE(c.score)}</span> ${esc(c.comment)}</li>`).join('')}</ul>` : '<span class="muted">–</span>'}</td>
    </tr>`).join('')}
    </tbody></table></div>
    <p class="muted small">เวลา: ตั้งแต่เข้าขั้นตอนจนเข้าขั้นตอนถัดไป   ความรู้สึก: คะแนน 1–5 ที่ผู้ป่วยกดในแอป   PCE = VA ÷ Lead time</p>`;
}

function render() {
  const a = document.activeElement;
  if (a && a.tagName === 'SELECT') { S.dirty = true; return; }
  S.dirty = false;
  const stageLabel = k => S.cfg.journey.find(j => j.key === k)?.label || k;
  const stName = id => S.cfg.stations.find(x => x.id === id)?.short || id;
  const rows = S.visits
    .filter(v => S.showDone || v.stage !== 'done')
    .sort((x, y) => (x.stage === 'done') - (y.stage === 'done') || x.createdAt.localeCompare(y.createdAt));
  const local = Closely.mode === 'local';
  $('#tools').innerHTML = `<button class="btn line" data-act="download">ดาวน์โหลด YAML</button>
    ${local ? '<button class="btn line" data-act="import">นำเข้า YAML</button>' : ''}
    <button class="btn quiet" data-act="reset">รีเซ็ตข้อมูล</button>`;

  $('#view').innerHTML = `
    ${local ? '<p class="note">ข้อมูลเก็บในเบราว์เซอร์นี้เท่านั้น เปิดแอปผู้ป่วยในเบราว์เซอร์เดียวกันจึงจะเห็นคิวเดียวกัน จบ workshop แล้วกด "ดาวน์โหลด YAML" เก็บผลไว้</p>' : ''}
    <section><h2>จอเรียกคิว</h2><div class="andons">
      ${S.board.map(b => `<div class="andon ${b.waiting ? 'wait' : 'idle'}">
        <div>${esc(b.name)}</div>
        <div class="big">${esc(b.nowServing)}</div>
        <div>รอ <span class="num">${b.waiting}</span> คิว ประมาณ <span class="num">${b.etaMin}</span> นาที</div>
        <button class="btn" data-act="call-next" data-dept="${b.id}" ${b.waiting ? '' : 'disabled'}>เรียกคิวถัดไป</button></div>`).join('')}
    </div></section>

    <section><div class="section-head"><h2>ผู้ป่วยวันนี้</h2>
        <div class="tools"><label><input type="checkbox" data-act="toggle-done" ${S.showDone ? 'checked' : ''}> แสดงที่เสร็จแล้ว</label>
        <button class="btn line" data-act="demo">เพิ่มผู้ป่วยจำลอง 3 คน</button></div></div>
      <div class="scroll"><table><thead><tr><th>คิว</th><th>ชื่อ</th><th>แผนก</th><th>ขั้นตอน</th><th>อยู่ที่</th><th>ทำต่อ</th><th><span class="sr">เปิดในแอป</span></th></tr></thead><tbody>
      ${rows.map(v => `<tr><td class="num q">${esc(v.queueLabel)}</td><td>${esc(v.patient?.name)}<div class="muted small">${esc(v.symptoms)}</div></td>
        <td>${esc(v.deptInfo.name)}</td><td><span class="stage ${v.stage}">${esc(stageLabel(v.stage))}</span></td>
        <td>${esc(stName(v.location))}</td><td><div class="act">${actionCell(v)}</div></td>
        <td><a href="./?visit=${v.id}" target="_blank">มุมมองผู้ป่วย</a></td></tr>`).join('')}
      </tbody></table></div></section>

    <section><h2>Value stream ของผู้ป่วย</h2>${valueStream()}</section>`;
}

const actions = {
  async 'call-next'(el) { const v = await api('/api/staff/call-next', { dept: el.dataset.dept }); toast(`เรียกคิว ${v.queueLabel} แล้ว`); },
  async advance(el) { await api('/api/staff/advance', { visitId: el.dataset.id }); },
  async diagnose(el) { await api('/api/staff/diagnose', { visitId: el.dataset.id, templateId: $(`#tpl-${el.dataset.id}`).value, doctor: 'นพ.ทดสอบ ระบบดี' }); toast('บันทึกผลตรวจแล้ว'); },
  async demo() { await api('/api/staff/demo-patients', { count: 3 }); toast('เพิ่มผู้ป่วยจำลอง 3 คนแล้ว'); },
  async download() { await Closely.downloadYaml(); },
  import() {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept: '.yaml,.yml,text/yaml' });
    input.onchange = async () => {
      try {
        if (!input.files[0]) return;
        if (!confirm('แทนที่ข้อมูลทั้งหมดในเบราว์เซอร์นี้ด้วยไฟล์ที่เลือก?')) return;
        await Closely.importYaml(await input.files[0].text());
        toast('นำเข้า YAML แล้ว');
      } catch (e) { toast(e.message); }
    };
    input.click();
  },
  'toggle-done'(el) { S.showDone = el.checked; render(); },
  async reset() { if (confirm('ล้างข้อมูลทั้งหมดกลับเป็นค่าเริ่มต้น (seed.yaml)?')) { await api('/api/staff/reset', {}); toast('รีเซ็ตข้อมูลแล้ว'); } },
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || !actions[el.dataset.act]) return;
  if (el.tagName !== 'INPUT') e.preventDefault();
  Promise.resolve(actions[el.dataset.act](el)).catch(err => toast(err.message));
});
document.addEventListener('focusout', () => setTimeout(() => { if (S.dirty) render(); }, 0));

Closely.ready
  .then(refresh)
  .then(() => Closely.subscribe(() => refresh().catch(() => {})))
  .catch(e => toast(e.message));
