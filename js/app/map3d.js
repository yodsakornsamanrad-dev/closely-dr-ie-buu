// แผนที่ 3D ในแท็บนำทาง: พื้นสีตามความหนาแน่น เก้าอี้ คน โต๊ะ ต้นไม้ ป้ายจำนวนคน เส้นทางไหล
// ซูม/หมุน/กลับมุมเริ่มต้น เครื่องมือมือลากเลื่อน และซูมดูห้องรอ (คนลุกเข้าห้องตรวจ)
import { C, visit, ahead, qText, callText, dept, stIdx } from './ctx.js';
import { crowdNow } from '../lib/crowd.js';
import { P3, pts3, person, staticScene, seatPos, chairsOf, walkerAt, zrect, LV_COLORS, FLOOR, PAL, SKIN, zoneLabel, screenToMap, clampPan, easeIO } from '../lib/iso3d.js';
import { IC } from '../ui/icons.js';

const RM = matchMedia('(prefers-reduced-motion: reduce)');
/** สถานะมุมกล้องของแผนที่ (อยู่ในหน่วยความจำของหน้าจอนี้เท่านั้น) */
export const V = { ang: 0, zt: 1, zf: 'all', drag: 'pan' };
const M3 = { tau: 1, tauT0: 0, labT0: 0, entry: false, loop: null, last: 0, people: [], exiting: [], pid: 0, qd: null, first: true, skey: null, pan: [0, 0], z: 1, f: null };
let curRoute = null, rotAnim = null, drag = null;

export const enter3d = () => { M3.entry = true; };
const lvName = lvl => C.D.floor.crowd.levels[lvl];
const roomName = k => C.D.room(k).name;

/** ข้อมูลความหนาแน่นจากมุมของผู้ป่วยคนนี้ */
function crowd() {
  const v = visit();
  return crowdNow(C.D, C.T.state, { id: v.id, dept: v.dept, ahead: v.stage === 'waiting' ? ahead() : 3, stage: v.stage });
}

function cam(now) {
  if (M3.entry) { M3.entry = false; if (!RM.matches) { M3.tau = 0; M3.tauT0 = now; M3.labT0 = now; } }
  if (M3.tauT0) { const k = Math.min(1, (now - M3.tauT0) / 750); M3.tau = easeIO(k); if (k >= 1) M3.tauT0 = 0; }
  const labOp = M3.labT0 ? Math.min(1, Math.max(0, (now - M3.labT0 - 700) / 350)) : 1;
  if (labOp >= 1) M3.labT0 = 0;
  const d = visit().dept, r = C.D.room(d);
  const ft = V.zf === 'dept' ? [r.x + r.w / 2, r.open === 'S' ? r.y + 54 : r.y + r.h - 50] : [180, 152];
  ft[0] += M3.pan[0]; ft[1] += M3.pan[1];
  if (RM.matches || !M3.f) { M3.z = V.zt; M3.f = ft.slice(); }
  else {
    M3.z += (V.zt - M3.z) * 0.12; M3.f[0] += (ft[0] - M3.f[0]) * 0.12; M3.f[1] += (ft[1] - M3.f[1]) * 0.12;
    if (Math.abs(V.zt - M3.z) < 0.003) M3.z = V.zt;
  }
  const th = V.ang * Math.PI / 180, z = M3.z, gz = Math.max(0, Math.min(1, (z - 1) / 1.4)), zp = V.zf === 'dept' ? gz : 0;
  const F = P3(M3.f[0], M3.f[1], 0, th, M3.tau), Cx = 210, Cy = 158 - gz * 6;
  return {
    th, z, F, Cx, Cy, zp, labOp, tau: M3.tau,
    Z: q => [(q[0] - F[0]) * z + Cx, (q[1] - F[1]) * z + Cy],
    tf: `translate(${Cx.toFixed(2)} ${Cy.toFixed(2)}) scale(${z.toFixed(3)}) translate(${(-F[0]).toFixed(2)} ${(-F[1]).toFixed(2)})`,
  };
}

/** คนในห้องรอแผนกของฉัน: เดินเข้ามานั่ง และคนหน้าสุดลุกเดินเข้าห้องตรวจเมื่อคิวขยับ */
function syncQueue(k, n) {
  const D = C.D, N = Math.min(n, chairsOf(D, k).length + 14);
  if (M3.qd !== k) { M3.qd = k; M3.people = []; M3.exiting = []; M3.first = true; }
  const [x, y, w, h] = zrect(D, k), S_ = D.room(k).open === 'S', entry = [x + w / 2, S_ ? y + h + 12 : y - 12], desk = [x + w / 2, S_ ? y + 14 : y + h - 14];
  while (M3.people.length > N) M3.exiting.push(M3.people.shift());
  while (M3.people.length < N) { const sp = seatPos(D, k, M3.people.length).p; M3.people.push({ id: M3.pid++, x: M3.first ? sp[0] : entry[0], y: M3.first ? sp[1] : entry[1], a: M3.first ? 1 : 0 }); }
  M3.first = false;
  const inst = RM.matches;
  M3.people.forEach((p, i) => {
    const t = seatPos(D, k, i);
    p.x = inst ? t.p[0] : p.x + (t.p[0] - p.x) * 0.1; p.y = inst ? t.p[1] : p.y + (t.p[1] - p.y) * 0.1;
    p.a = Math.min(1, p.a + 0.06); p.seated = Math.hypot(t.p[0] - p.x, t.p[1] - p.y) < 1.2 && t.seated;
  });
  M3.exiting.forEach(p => { p.seated = false; p.x += (desk[0] - p.x) * 0.06; p.y += (desk[1] - p.y) * 0.06; p.a -= inst ? 1 : 0.022; });
  M3.exiting = M3.exiting.filter(p => p.a > 0);
}

function dynamic(c, cd, r, now) {
  const D = C.D, v = visit(), th = c.th, tau = c.tau, d = v.dept, a = v.stage === 'waiting' ? ahead() : 3, q = qText();
  const P = (x, y, z) => P3(x, y, z, th, tau);
  let s = `<g transform="${c.tf}">`;
  if (!r.same) {
    const rp = pts3(r.pts.map(p => P(p[0], p[1], 0.6)));
    s += `<polyline points="${rp}" fill="none" stroke="#fff" stroke-width="${7 / c.z}" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>`;
    s += `<polyline points="${rp}" fill="none" stroke="var(--act)" stroke-width="${4 / c.z}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${8 / c.z} ${7 / c.z}" stroke-dashoffset="${RM.matches ? 0 : ((-(now / 45) % 15) / c.z).toFixed(2)}"/>`;
  }
  const items = [];
  D.floor.walkers.forEach((w, i) => { const [x, y] = walkerAt(w, now, RM.matches); items.push({ d: P(x, y, 0)[2], s: person(x, y, th, PAL[(i + 2) % PAL.length], SKIN[i % 4], false, 1, tau) }); });
  syncQueue(d, cd[d].n);
  const atFront = v.stage === 'waiting' && v.loc === 'front';
  let youPt = null, youSeated = false;
  M3.people.forEach((p, i) => {
    const kind = i < a ? 'ahead' : i === a ? 'you' : 'after';
    if (kind === 'you' && !atFront) {
      if (c.zp > 0.4) { const g = P(p.x, p.y, 3); items.push({ d: g[2], s: `<g opacity="${c.zp.toFixed(2)}"><ellipse cx="${g[0].toFixed(1)}" cy="${g[1].toFixed(1)}" rx="4" ry="2" fill="none" stroke="var(--act)" stroke-width="1.4" stroke-dasharray="2 1.5"/></g>` }); }
      return;
    }
    const col = kind === 'you' ? 'var(--act)' : c.zp > 0.4 ? (kind === 'ahead' ? '#C98A00' : '#8792A4') : PAL[(p.id * 3) % PAL.length];
    if (kind === 'you') { youPt = [p.x, p.y]; youSeated = p.seated; }
    const bob = RM.matches ? 0 : Math.sin(now / 650 + p.id) * 0.25;
    items.push({ d: P(p.x, p.y, 0)[2] + 0.05, s: person(p.x, p.y + bob, th, col, SKIN[p.id % 4], p.seated, p.a, tau) });
  });
  M3.exiting.forEach(p => items.push({ d: P(p.x, p.y, 0)[2], s: person(p.x, p.y, th, c.zp > 0.4 ? '#C98A00' : PAL[(p.id * 3) % PAL.length], SKIN[p.id % 4], false, Math.max(0, p.a), tau) }));
  if (!youPt) { youPt = r.A.pt; items.push({ d: P(youPt[0], youPt[1], 0)[2], s: person(youPt[0], youPt[1], th, 'var(--act)', '#F2C9A0', false, 1, tau) }); }
  const ph = RM.matches ? 0.3 : (now % 1600) / 1600, g = P(youPt[0], youPt[1], youSeated ? 3 : 0);
  s += `<ellipse cx="${g[0].toFixed(1)}" cy="${g[1].toFixed(1)}" rx="${(5 + 9 * ph).toFixed(1)}" ry="${((5 + 9 * ph) * 0.5).toFixed(1)}" fill="none" stroke="var(--act)" stroke-width="${1.6 / c.z + 0.6}" opacity="${(0.8 * (1 - ph)).toFixed(2)}"/>`;
  items.sort((u, w) => u.d - w.d).forEach(o => { s += o.s; });
  s += `</g><g opacity="${c.labOp.toFixed(2)}">`;
  for (const rm of D.floor.rooms) {
    const { key: k, x, y, w, h } = rm, cc = cd[k], lv = LV_COLORS[cc.lvl], dest = k === r.B.hl, mine = k === d;
    const op = mine ? 1 : 1 - c.zp;
    if (op < 0.03) continue;
    const t = c.Z(P(x + w / 2, y + h / 2, 16));
    if (mine && c.zp > 0.5) {
      const t2 = c.Z(P(x + w / 2, rm.open === 'S' ? y : y + h, 16)), title = 'หน้าห้องตรวจ' + rm.short, sub = `${lvName(cc.lvl)} รอ ${cc.n} คน`, wl = Math.max(title.length, sub.length) * 6.2 + 24;
      const cx = Math.min(420 - wl / 2 - 64, Math.max(wl / 2 + 4, t2[0])), top = Math.max(4, t2[1] - 50);
      s += `<g opacity="${((c.zp - 0.5) * 2).toFixed(2)}"><rect x="${(cx - wl / 2).toFixed(1)}" y="${top.toFixed(1)}" width="${wl.toFixed(1)}" height="38" rx="12" fill="#fff" stroke="var(--act)" stroke-width="2"/><text x="${cx.toFixed(1)}" y="${(top + 16).toFixed(1)}" text-anchor="middle" font-size="12.5" font-weight="700" fill="#0E1930">${title}</text><text x="${cx.toFixed(1)}" y="${(top + 31).toFixed(1)}" text-anchor="middle" font-size="11.5" font-weight="800" fill="${lv[1]}">${sub}</text></g>`;
      continue;
    }
    const bob = dest && !RM.matches ? Math.sin(now / 320) * 2.5 : 0;
    s += zoneLabel(t, rm.short, `${cc.n} คน`, lv, { stroke: dest || mine ? 'var(--act)' : 'rgba(14,25,48,.12)', sw: dest || mine ? 2 : 1, dy: bob, op });
    if (dest) s += `<rect x="${(t[0] - 24).toFixed(1)}" y="${(t[1] - 28 + bob).toFixed(1)}" width="48" height="15" rx="7.5" fill="var(--act)"/><text x="${t[0].toFixed(1)}" y="${(t[1] - 17 + bob).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="700" fill="#fff">ปลายทาง</text>`;
  }
  const yp = c.Z(P(youPt[0], youPt[1], youSeated ? 17 : 19)), status = r.same ? (v.stage === 'waiting' ? 'รอเรียกคิว' : 'อยู่ที่นี่') : `เดินไป${r.B.short}`, lab = `${q} ${status}`, wl = lab.length * 6.3 + 18;
  s += `<g><rect x="${(yp[0] - wl / 2).toFixed(1)}" y="${(yp[1] - 24).toFixed(1)}" width="${wl.toFixed(1)}" height="22" rx="11" fill="var(--ink)"/><text x="${yp[0].toFixed(1)}" y="${(yp[1] - 9).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700" fill="var(--card)">${lab}</text><polygon points="${(yp[0] - 5).toFixed(1)},${(yp[1] - 3).toFixed(1)} ${(yp[0] + 5).toFixed(1)},${(yp[1] - 3).toFixed(1)} ${yp[0].toFixed(1)},${(yp[1] + 3).toFixed(1)}" fill="var(--ink)"/></g>`;
  return s + '</g>';
}

function scene(r, now) {
  const cd = crowd(), c = cam(now), d = visit().dept;
  const key = [c.th.toFixed(4), c.tau.toFixed(3), c.z.toFixed(3), c.F[0].toFixed(1), c.F[1].toFixed(1), C.D.floor.rooms.map(x => cd[x.key].n).join(','), d].join('|');
  let st = null;
  if (key !== M3.skey) { M3.skey = key; st = staticScene(C.D, c, cd, d); }
  return { st, dy: dynamic(c, cd, r, now) };
}

function crowdList() {
  const D = C.D, v = visit(), cd = crowd(), d = v.dept, cur = stIdx(v.stage);
  const route = [];
  D.stages.slice(Math.max(1, cur)).forEach(st => {
    const k = st.place === 'front' || st.place === 'exam' ? d : st.place;
    if (k === 'pharm' && v.rx === 'delivery') return;
    if (v.stage === 'done' && k !== 'entrance') return;
    if (cd[k] && !route.includes(k)) route.push(k);
  });
  const row = (k, mine) => {
    const c = cd[k], lv = LV_COLORS[c.lvl];
    return `<div class="cr"><span><b>${roomName(k)}</b>${mine ? `<span class="mine">${k === d ? 'แผนกของคุณ' : 'ต้องไป'}</span>` : ''}<small>${c.w > 0 ? `รอประมาณ ${c.w} นาที` : 'ไม่ต้องรอ'}</small></span>
      <span class="lvl" style="background:${lv[0]};color:${lv[1]}">${lvName(c.lvl)}<small>${c.n} คน</small></span></div>`;
  };
  const others = ['wc', 'cafe', 'reg', 'screen', 'med', 'ortho', 'eye', 'pharm'].filter(k => !route.includes(k));
  let h = '';
  if (cd.pharm.lvl === 2 && route.includes('pharm') && v.rx !== 'self')
    h += `<div class="tip" style="background:var(--go-bg);color:var(--go-ink);margin:var(--s3) 0 0">${IC.truck}<span>ห้องยาคนเยอะ รอประมาณ ${cd.pharm.w} นาที เลือก "ส่งยาถึงบ้าน" ได้ ถึงภายใน ${D.app.delivery.window_min.join('–')} นาที ไม่ต้องรอ</span></div>`;
  h += `<div class="shead"><h2>จุดที่คุณต้องไป</h2><span class="live"><i></i>อัปเดตทุก 1 นาที</span></div>`;
  h += route.length ? `<div class="crowd">${route.map(k => row(k, true)).join('')}</div>` : `<div class="here">ไม่มีจุดที่ต้องไปต่อในโรงพยาบาลแล้ว</div>`;
  h += `<div class="shead"><h2>จุดอื่นใน${D.floor.floor_name.split(' ')[0]}</h2></div><div class="crowd">${others.map(k => row(k, false)).join('')}</div>`;
  return h;
}

function zoomPanel() {
  const cd = crowd(), d = visit().dept, c = cd[d], lv = LV_COLORS[c.lvl], on = V.zf === 'dept', dn = dept().name;
  const a = visit().stage === 'waiting' ? ahead() : 0;
  const btn = `<button class="btn ${on ? '' : 'main'}" style="margin:8px 8px 0;width:calc(100% - 16px)" data-act="zoom3">${on ? IC.zoomOut + 'ดูทั้งชั้น' : IC.zoomIn + 'ซูมดูห้องรอ' + dn}</button>`;
  if (!on) return btn;
  return `<div class="zstats"><div><span>รอทั้งหมด</span><b>${c.n} <small>คน</small></b><em style="background:${lv[0]};color:${lv[1]}">${lvName(c.lvl)}</em></div>
      <div><span>ก่อนคุณ</span><b>${a} <small>คิว</small></b></div><div><span>กำลังเรียก</span><b>${callText()}</b></div></div>
    <div class="lg3"><span><i style="background:#C98A00;border-radius:50%"></i>รอก่อนคุณ</span><span><i style="background:var(--act);border-radius:50%"></i>คุณ</span><span><i style="background:#8792A4;border-radius:50%"></i>มาหลังคุณ</span></div>` + btn;
}

const dragBtn = () => {
  const p = V.drag === 'pan';
  return `<button class="dm" data-act="dragMode" aria-label="${p ? 'ลากเพื่อเลื่อนแผนที่ กดเพื่อเปลี่ยนเป็นลากเพื่อหมุน' : 'ลากเพื่อหมุนแผนที่ กดเพื่อเปลี่ยนเป็นลากเพื่อเลื่อน'}" title="${p ? 'ลากเพื่อเลื่อน' : 'ลากเพื่อหมุน'}">${p ? IC.hand : IC.rotr}<small>${p ? 'เลื่อน' : 'หมุน'}</small></button><hr>`;
};

/** สวิตช์ 2D / 3D + แผนที่ */
export function mapBlock(r) {
  const U = C.U;
  const seg = `<div class="seg" role="group" aria-label="รูปแบบแผนที่"><button aria-pressed="${U.mapMode === '2d'}" data-act="mapMode" data-arg="2d">แผนที่ 2D</button><button aria-pressed="${U.mapMode === '3d'}" data-act="mapMode" data-arg="3d">แผนที่ 3D</button></div>`;
  if (U.mapMode !== '3d') return seg + `<div class="map">${C.mapSVG(r)}</div>`;
  curRoute = r; M3.skey = null;
  const cd = crowd(), busy = Object.keys(cd).filter(k => cd[k].lvl === 2).map(roomName).join(' และ ') || 'ไม่มี';
  const sc = scene(r, performance.now());
  return seg + `<div class="m3wrap"><div class="m3top"><span>สีพื้นบอกความหนาแน่น ตัวคนเท่าจำนวนจริง</span><span class="live"><i></i>สด</span></div>
    <div id="m3d" role="img" aria-label="แผนที่ 3 มิติ จุดที่คนเยอะตอนนี้: ${busy}. ปลายทาง ${r.B.name}">
      <svg id="m3s" viewBox="0 0 420 300" aria-hidden="true" style="overflow:hidden">${sc.st}</svg><svg id="m3y" viewBox="0 0 420 300" aria-hidden="true" style="overflow:hidden">${sc.dy}</svg></div>
    <div class="m3c" role="group" aria-label="ควบคุมแผนที่">
      ${dragBtn()}<button data-act="z3in" aria-label="ซูมเข้า" title="ซูมเข้า">${IC.plus}</button><button data-act="z3out" aria-label="ซูมออก" title="ซูมออก">${IC.minus}</button><hr>
      <button data-act="rot3" data-arg="-1" aria-label="หมุนซ้าย" title="หมุนซ้าย">${IC.rotl}</button><button data-act="rot3" data-arg="1" aria-label="หมุนขวา" title="หมุนขวา">${IC.rotr}</button><button data-act="home3" aria-label="กลับมุมเริ่มต้น" title="มุมเริ่มต้น">${IC.home}</button></div>
    <div class="lg3">${C.D.floor.crowd.levels.map((l, i) => `<span><i style="background:${FLOOR[i]};box-shadow:inset 0 0 0 1px rgba(0,0,0,.15)"></i>${l}</span>`).join('')}<span><i style="background:var(--act)"></i>เส้นทาง</span></div>
    ${zoomPanel()}
    <p class="help" style="text-align:center;margin:6px 0 0">ลากเพื่อเลื่อนแผนที่ ปุ่มด้านขวาใช้ซูมและหมุน</p>
    </div>${crowdList()}`;
}

export function redraw3d(now = performance.now()) {
  const s1 = document.getElementById('m3s'), s2 = document.getElementById('m3y');
  if (!s1 || !s2 || !curRoute || !visit()) return;
  const sc = scene(curRoute, now);
  if (sc.st !== null) s1.innerHTML = sc.st;
  s2.innerHTML = sc.dy;
}
export function ensureLoop3() {
  if (M3.loop) return;
  if (RM.matches) { redraw3d(); return; }
  const tick = now => {
    if (!document.getElementById('m3d') || document.hidden) { M3.loop = null; return; }
    if (now - M3.last > 40) { M3.last = now; redraw3d(now); }
    M3.loop = requestAnimationFrame(tick);
  };
  M3.loop = requestAnimationFrame(tick);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && document.getElementById('m3d')) ensureLoop3(); });

function rotateTo(target) {
  cancelAnimationFrame(rotAnim);
  if (RM.matches) { V.ang = target; redraw3d(); return; }
  const from = V.ang, t0 = performance.now(), Dur = 450;
  const step = now => { const k = Math.min(1, (now - t0) / Dur); V.ang = from + (target - from) * easeIO(k); redraw3d(); if (k < 1) rotAnim = requestAnimationFrame(step); };
  rotAnim = requestAnimationFrame(step);
}

/** ปุ่มควบคุมแผนที่ 3D — คืน 'norender' ถ้าไม่ต้องวาดหน้าจอใหม่ทั้งหน้า */
export const ACT3 = {
  dragMode() { V.drag = V.drag === 'pan' ? 'rotate' : 'pan'; document.body.dataset.drag = V.drag; },
  zoom3() { M3.pan = [0, 0]; if (V.zf === 'dept') { V.zf = 'all'; V.zt = 1; } else { V.zf = 'dept'; V.zt = 2.4; } },
  z3in() { V.zt = Math.min(4, +(V.zt * 1.4).toFixed(2)); redraw3d(); return 'norender'; },
  z3out() { V.zt = Math.max(1, +(V.zt / 1.4).toFixed(2)); if (V.zt <= 1.01) { V.zt = 1; if (V.zf === 'dept') { V.zf = 'all'; return; } } redraw3d(); return 'norender'; },
  home3() { M3.pan = [0, 0]; V.zt = 1; V.zf = 'all'; rotateTo(0); },
  rot3(d) { rotateTo(Math.round((V.ang + 90 * (+d)) / 90) * 90); return 'norender'; },
};

// ลากบนแผนที่: เลื่อน (ค่าเริ่มต้น) หรือหมุน
document.addEventListener('pointerdown', e => { if (!e.target.closest('#m3d')) return; drag = { x: e.clientX, lx: e.clientX, ly: e.clientY, a: V.ang, id: e.pointerId }; });
document.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  if (V.drag === 'rotate') { const dx = e.clientX - drag.x; if (Math.abs(dx) > 3) { V.ang = drag.a + dx * 0.6; redraw3d(); } return; }
  const el = document.getElementById('m3y'); if (!el) return;
  const dx = e.clientX - drag.lx, dy = e.clientY - drag.ly; drag.lx = e.clientX; drag.ly = e.clientY;
  const d = screenToMap(dx, dy, el.getBoundingClientRect().width, M3.z || 1, V.ang * Math.PI / 180);
  M3.pan[0] -= d[0]; M3.pan[1] -= d[1]; clampPan(M3.pan);
  if (M3.f) { M3.f[0] -= d[0]; M3.f[1] -= d[1]; }
  redraw3d();
});
const endDrag = () => { drag = null; };
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);
