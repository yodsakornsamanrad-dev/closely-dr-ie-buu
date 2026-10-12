// หน้า staff: ผังชั้น OPD 3D โหมดข้อมูลสด / Replay, แถบตัวเลข 4 ช่อง, แผงจุดบริการ และคอขวด
import { P3, person, staticScene, walkerAt, zrect, LV_COLORS, FLOOR, PAL, SKIN, zoneLabel, screenToMap, clampPan } from '../lib/iso3d.js';
import { crowdNow, simCD, staffKpi, bottleneck, cumArrivals } from '../lib/crowd.js';
import { hhmm, hhmmOf, thaiDate, addDays } from '../lib/util.js';
import { IC } from '../ui/icons.js';

const RM = matchMedia('(prefers-reduced-motion: reduce)');
const SPEEDS = [1, 10, 30, 60, 120, 300];
export const ST = { mode: 'live', ang: 0, angT: 0, z: 1, zt: 1, f: null, zf: 'all', t: 9 * 60 + 30, playing: false, speed: 60, date: 0, loop: null, skey: null, lastMin: -1, lastT: 0, lastDraw: 0, drag: null, dragMode: 'pan', sliding: false, pan: [0, 0] };
let X = null; // { D, T }
export const initFloor = ctx => { X = ctx; };

const days = () => Array.from({ length: X.D.floor.replay.days_back }, (_, i) => (i === 0 ? 'วันนี้ ' : '') + thaiDate(addDays(new Date(), -i)));
const roomName = k => X.D.room(k).name;

/** ความหนาแน่นที่หน้า staff ใช้ (ระดับสีคิดจากสัดส่วนที่นั่ง) */
export function staffCD() {
  if (ST.mode === 'live') {
    const cd = crowdNow(X.D, X.T.state, null);
    for (const k in cd) cd[k].lvl = cd[k].rl;
    return cd;
  }
  return simCD(X.D, ST.t, ST.date);
}
function homeToday() {
  const r = X.D.floor.replay;
  if (ST.mode === 'live') return r.live_home_today + X.T.state.visits.filter(v => v.left_at && !v.demo).length;
  return cumArrivals(Math.max(r.open_min, ST.t - 85), ST.date, r.open_min);
}

function kpiHTML(cd) {
  const k = staffKpi(X.D, cd, homeToday());
  const dl = [['ว่าง', '#D9F2E4', '#0A5A3C'], ['ปานกลาง', '#FFF0BC', '#5A4200'], ['แน่น', '#FFD6CE', '#8A1C12']][k.densityLevel];
  return `<div class="skpi"><span>ผู้ป่วยใน รพ.</span><b>${k.inHospital} <small>คน</small></b></div>
    <div class="skpi"><span>รอเฉลี่ย</span><b>${k.avgWait} <small>นาที</small></b></div>
    <div class="skpi"><span>ความหนาแน่น</span><b>${k.density}<small>%</small> <em style="background:${dl[1]};color:${dl[2]}">${dl[0]}</em></b></div>
    <div class="skpi"><span>กลับบ้านแล้ววันนี้</span><b>${k.home} <small>คน</small></b></div>`;
}

function panelHTML(cd) {
  const bc = ['#3DBE7A', '#E3B12C', '#E5483B'];
  const rows = X.D.floor.replay.service_zones.map(k => {
    const c = cd[k], pct = Math.min(100, c.n / c.cap * 100), on = ST.zf === k;
    return `<button class="sprow ${on ? 'on' : ''}" data-act="stZone" data-arg="${k}" aria-pressed="${on}"><b>${roomName(k)}</b><span>${c.n}/${c.cap} รอ ~${c.w} น.</span>
      <span class="sbar2" aria-hidden="true"><i style="width:${pct.toFixed(0)}%;background:${bc[c.lvl]}"></i></span></button>`;
  }).join('');
  const b = bottleneck(X.D, cd);
  const bn = b.isBottleneck
    ? `<div class="bneck" role="status"><b>คอขวดตอนนี้: ${roomName(b.key)}</b> รอ ~${b.wait} นาที (${b.n}/${b.cap} คน)<br>ข้อเสนอ: ${b.tip}</div>`
    : `<div class="bneck ok" role="status"><b>ยังไม่มีคอขวด</b> ทุกจุดรอไม่เกิน ${X.D.floor.bottleneck.wait_min} นาที</div>`;
  return `<h3>จุดบริการ <small>กดเพื่อซูม</small></h3>${rows}${bn}`;
}

function sparkSVG() {
  const r = X.D.floor.replay, vals = [];
  let mx = 1;
  for (let t = r.open_min; t <= r.close_min; t += 5) { const c = simCD(X.D, t, ST.date), v = r.service_zones.reduce((a, k) => a + c[k].n, 0); vals.push([t, v]); if (v > mx) mx = v; }
  const pts = vals.map(([t, v]) => `${t - r.open_min},${(40 - v / mx * 36).toFixed(1)}`).join(' ');
  const W = r.close_min - r.open_min;
  return `<svg class="spark" viewBox="0 0 ${W} 42" preserveAspectRatio="none" aria-hidden="true"><polygon points="0,42 ${pts} ${W},42" fill="#CDEFE3"/><polyline points="${pts}" fill="none" stroke="#0F9F8F" stroke-width="1.5" vector-effect="non-scaling-stroke"/><line id="rpHead" x1="${ST.t - r.open_min}" x2="${ST.t - r.open_min}" y1="0" y2="42" stroke="#0E1930" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
}

function cam() {
  const ft = ST.zf === 'all' ? [180, 152] : (() => { const [x, y, w, h] = zrect(X.D, ST.zf); return [x + w / 2, y + h / 2]; })();
  ft[0] += ST.pan[0]; ft[1] += ST.pan[1];
  if (RM.matches || !ST.f) { ST.z = ST.zt; ST.f = ft.slice(); ST.ang = ST.angT; }
  else {
    ST.z += (ST.zt - ST.z) * 0.12; ST.f[0] += (ft[0] - ST.f[0]) * 0.12; ST.f[1] += (ft[1] - ST.f[1]) * 0.12; ST.ang += (ST.angT - ST.ang) * 0.15;
    if (Math.abs(ST.zt - ST.z) < 0.003) ST.z = ST.zt;
    if (Math.abs(ST.angT - ST.ang) < 0.05) ST.ang = ST.angT;
  }
  const th = ST.ang * Math.PI / 180, z = ST.z, F = P3(ST.f[0], ST.f[1], 0, th), Cx = 210, Cy = 156;
  return { th, z, F, tau: 1, Z: q => [(q[0] - F[0]) * z + Cx, (q[1] - F[1]) * z + Cy], tf: `translate(${Cx} ${Cy}) scale(${z.toFixed(3)}) translate(${(-F[0]).toFixed(2)} ${(-F[1]).toFixed(2)})` };
}

function dynamic(c, cd, now) {
  const D = X.D, th = c.th, svc = D.floor.replay.service_zones;
  let s = `<g transform="${c.tf}">`;
  const tot = svc.reduce((a, k) => a + cd[k].n, 0), nW = Math.max(1, Math.min(D.floor.walkers.length, Math.round(tot / 14)));
  D.floor.walkers.slice(0, nW).map((w, i) => { const [x, y] = walkerAt(w, now, RM.matches); return { d: P3(x, y, 0, th)[2], s: person(x, y, th, PAL[(i + 2) % PAL.length], SKIN[i % 4], false) }; })
    .sort((a, b) => a.d - b.d).forEach(o => { s += o.s; });
  s += '</g><g>';
  for (const rm of D.floor.rooms) {
    const { key: k, x, y, w, h } = rm, cc = cd[k], on = ST.zf === k, t = c.Z(P3(x + w / 2, y + h / 2, 16, th));
    s += zoneLabel(t, rm.short, svc.includes(k) ? `${cc.n}/${cc.cap}` : `${cc.n} คน`, [FLOOR[cc.lvl], LV_COLORS[cc.lvl][1]], { stroke: on ? 'var(--act)' : 'rgba(14,25,48,.12)', sw: on ? 2 : 1 });
  }
  return s + '</g>';
}

function scene(now) {
  const cd = staffCD(), c = cam();
  const key = [c.th.toFixed(4), c.z.toFixed(3), c.F[0].toFixed(1), c.F[1].toFixed(1), X.D.floor.rooms.map(x => cd[x.key].n + ':' + cd[x.key].lvl).join(',')].join('|');
  let st = null;
  if (key !== ST.skey) { ST.skey = key; st = staticScene(X.D, c, cd, null); }
  return { st, dy: dynamic(c, cd, now), cd };
}

const clockHTML = () => (ST.mode === 'live' ? `<i class="ldot"></i>${hhmmOf(new Date())} <small>ข้อมูลสด</small>` : `${hhmm(ST.t)} <small>REPLAY ${days()[ST.date]} ×${ST.speed}</small>`);
const dragBtn = () => {
  const p = ST.dragMode === 'pan';
  return `<button class="dm" data-act="stDrag" aria-label="${p ? 'ลากเพื่อเลื่อนแผนที่ กดเพื่อเปลี่ยนเป็นลากเพื่อหมุน' : 'ลากเพื่อหมุนแผนที่ กดเพื่อเปลี่ยนเป็นลากเพื่อเลื่อน'}" title="${p ? 'ลากเพื่อเลื่อน' : 'ลากเพื่อหมุน'}">${p ? IC.hand : IC.rotr}<small>${p ? 'เลื่อน' : 'หมุน'}</small></button><hr>`;
};

export function floorHTML() {
  ST.skey = null;
  const sc = scene(performance.now()), cd = sc.cd, live = ST.mode === 'live', r = X.D.floor.replay;
  const rp = live ? '' : `<div class="rp"><div class="rprow">
      <label class="sr" for="rpDate">เลือกวันที่</label><select id="rpDate">${days().map((d, i) => `<option value="${i}" ${ST.date === i ? 'selected' : ''}>${d}</option>`).join('')}</select>
      <button class="rpplay" id="rpPlayBtn" data-act="rpPlay" aria-label="${ST.playing ? 'หยุด' : 'เล่น'}">${ST.playing ? '❚❚' : '▶'}</button>
      ${SPEEDS.map(v => `<button class="spd" aria-pressed="${ST.speed === v}" data-act="rpSpeed" data-arg="${v}" aria-label="ความเร็ว ${v} เท่า">×${v}</button>`).join('')}
      <span class="rptime"><b id="rpTime">${hhmm(ST.t)}</b> / ${hhmm(r.close_min)} น.</span></div>
      ${sparkSVG()}<label class="sr" for="rpSlider">เวลา</label><input type="range" id="rpSlider" min="${r.open_min}" max="${r.close_min}" step="1" value="${Math.round(ST.t)}">
      <p class="rpnote">ผู้ป่วยทั้งวัน ${cumArrivals(r.close_min, ST.date, r.open_min)} ราย จำลองจากเวลาเข้า-ออกแต่ละจุด กราฟแสดงจำนวนคนรอในแต่ละช่วงเวลา</p></div>`;
  return `<h2>ผังชั้น OPD 3D</h2>
  <div class="skpis" id="stKpi">${kpiHTML(cd)}</div>
  <div class="sfloor"><div class="s3card">
    <div class="s3top"><div class="sseg" role="group" aria-label="โหมด"><button aria-pressed="${live}" data-act="stMode" data-arg="live">ข้อมูลสด</button><button aria-pressed="${!live}" data-act="stMode" data-arg="replay">ย้อนดู (Replay)</button></div>
      <span class="sclock" id="stClock">${clockHTML()}</span></div>
    <div id="s3d" role="img" aria-label="ผังชั้น OPD 3 มิติ สีพื้นบอกความหนาแน่น"><svg id="s3s" viewBox="0 0 420 300" aria-hidden="true" style="overflow:hidden">${sc.st}</svg><svg id="s3y" viewBox="0 0 420 300" aria-hidden="true" style="overflow:hidden">${sc.dy}</svg></div>
    <div class="m3c" style="top:76px;right:24px" role="group" aria-label="ควบคุมแผนที่">${dragBtn()}<button data-act="stZin" aria-label="ซูมเข้า">${IC.plus}</button><button data-act="stZout" aria-label="ซูมออก">${IC.minus}</button><hr>
      <button data-act="stRot" data-arg="-1" aria-label="หมุนซ้าย">${IC.rotl}</button><button data-act="stRot" data-arg="1" aria-label="หมุนขวา">${IC.rotr}</button><button data-act="stHome" aria-label="กลับมุมเริ่มต้น">${IC.home}</button></div>
    <div class="slg"><span><i style="background:#D9F2E4"></i>ว่าง (ต่ำกว่า 45% ของที่นั่ง)</span><span><i style="background:#FFF0BC"></i>ปานกลาง</span><span><i style="background:#FFD6CE"></i>แน่น (85% ขึ้นไป)</span></div>
    ${rp}</div>
    <div class="spanel" id="stPanel">${panelHTML(cd)}</div></div>`;
}

export function redrawFloor(now = performance.now()) {
  const a = document.getElementById('s3s'), b = document.getElementById('s3y');
  if (!a || !b) return;
  const sc = scene(now);
  if (sc.st !== null) a.innerHTML = sc.st;
  b.innerHTML = sc.dy;
}
/** อัปเดตตัวเลข แผง และนาฬิกา (ไม่วาดผังใหม่) */
export function updateFloorUI() {
  const cd = staffCD(), $ = id => document.getElementById(id);
  if ($('stKpi')) $('stKpi').innerHTML = kpiHTML(cd);
  if ($('stPanel')) $('stPanel').innerHTML = panelHTML(cd);
  if ($('stClock')) $('stClock').innerHTML = clockHTML();
  if ($('rpTime')) $('rpTime').textContent = hhmm(ST.t);
  if ($('rpSlider') && !ST.sliding) $('rpSlider').value = Math.round(ST.t);
  const hd = $('rpHead'), r = X.D.floor.replay;
  if (hd) { hd.setAttribute('x1', ST.t - r.open_min); hd.setAttribute('x2', ST.t - r.open_min); }
  const pb = $('rpPlayBtn');
  if (pb) { pb.textContent = ST.playing ? '❚❚' : '▶'; pb.setAttribute('aria-label', ST.playing ? 'หยุด' : 'เล่น'); }
}

export function ensureFloorLoop() {
  if (ST.loop) return;
  ST.lastT = performance.now();
  const r = X.D.floor.replay;
  const tick = now => {
    if (!document.getElementById('s3d')) { ST.loop = null; return; }
    const dt = now - ST.lastT; ST.lastT = now;
    if (ST.mode === 'replay' && ST.playing) { ST.t = Math.min(r.close_min, ST.t + dt / 1000 * ST.speed / 60); if (ST.t >= r.close_min) ST.playing = false; }
    if (!RM.matches || ST.mode === 'replay') { if (now - ST.lastDraw > 40) { ST.lastDraw = now; redrawFloor(now); } }
    const m = Math.floor(ST.t) + (ST.mode === 'live' ? Math.floor(Date.now() / 60000) : 0);
    if (m !== ST.lastMin) { ST.lastMin = m; updateFloorUI(); }
    ST.loop = requestAnimationFrame(tick);
  };
  ST.loop = requestAnimationFrame(tick);
}

/** ปุ่มของผังชั้น — คืน true ถ้าต้องวาดผังใหม่ทั้งก้อน */
export const FLOOR_ACT = {
  stMode(m) { ST.mode = m; ST.playing = m === 'replay'; if (m === 'replay' && ST.t >= X.D.floor.replay.close_min - 1) ST.t = X.D.floor.replay.open_min; return true; },
  rpPlay() { if (ST.t >= X.D.floor.replay.close_min - 1) ST.t = X.D.floor.replay.open_min; ST.playing = !ST.playing; updateFloorUI(); },
  rpSpeed(v) { ST.speed = +v; return true; },
  stZone(k) { ST.pan = [0, 0]; if (ST.zf === k) { ST.zf = 'all'; ST.zt = 1; } else { ST.zf = k; ST.zt = 2.2; } updateFloorUI(); redrawFloor(); },
  stZin() { ST.zt = Math.min(4, ST.zt * 1.4); redrawFloor(); },
  stZout() { ST.zt = Math.max(1, ST.zt / 1.4); if (ST.zt <= 1.01) { ST.zt = 1; ST.zf = 'all'; updateFloorUI(); } redrawFloor(); },
  stRot(d) { ST.angT = Math.round((ST.angT + 90 * (+d)) / 90) * 90; redrawFloor(); },
  stHome() { ST.pan = [0, 0]; ST.angT = 0; ST.zt = 1; ST.zf = 'all'; updateFloorUI(); redrawFloor(); },
  stDrag() { ST.dragMode = ST.dragMode === 'pan' ? 'rotate' : 'pan'; document.body.dataset.drag = ST.dragMode; return true; },
};

document.addEventListener('pointerdown', e => { if (!e.target.closest('#s3d')) return; ST.drag = { x: e.clientX, lx: e.clientX, ly: e.clientY, a: ST.angT, id: e.pointerId }; });
document.addEventListener('pointermove', e => {
  const d = ST.drag;
  if (!d || e.pointerId !== d.id) return;
  if (ST.dragMode === 'rotate') { const dx = e.clientX - d.x; if (Math.abs(dx) > 3) { ST.angT = ST.ang = d.a + dx * 0.5; redrawFloor(); } return; }
  const el = document.getElementById('s3y'); if (!el) return;
  const dx = e.clientX - d.lx, dy = e.clientY - d.ly; d.lx = e.clientX; d.ly = e.clientY;
  const m = screenToMap(dx, dy, el.getBoundingClientRect().width, ST.z || 1, ST.ang * Math.PI / 180);
  ST.pan[0] -= m[0]; ST.pan[1] -= m[1]; clampPan(ST.pan);
  if (ST.f) { ST.f[0] -= m[0]; ST.f[1] -= m[1]; }
  redrawFloor();
});
const end = () => { ST.drag = null; };
document.addEventListener('pointerup', end);
document.addEventListener('pointercancel', end);
document.addEventListener('input', e => { if (e.target.id !== 'rpSlider') return; ST.sliding = true; ST.t = +e.target.value; ST.lastMin = -1; updateFloorUI(); redrawFloor(); });
document.addEventListener('change', e => {
  if (e.target.id === 'rpSlider') ST.sliding = false;
  if (e.target.id === 'rpDate') { ST.date = +e.target.value; ST.skey = null; ST.lastMin = -1; const sp = document.querySelector('.spark'); if (sp) sp.outerHTML = sparkSVG(); updateFloorUI(); }
});
