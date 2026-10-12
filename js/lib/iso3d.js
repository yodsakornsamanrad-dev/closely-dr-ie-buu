// แผนที่ 3D แบบ isometric (SVG string) ใช้ร่วมกันระหว่างแอปผู้ป่วยและหน้า staff
// ไม่แตะ DOM: ทุกฟังก์ชันคืนข้อความ SVG

export const K3 = 0.84;
export const FLOOR = ['#D9F2E4', '#FFF0BC', '#FFD6CE'];
export const LV_COLORS = [['#BFEBD6', '#0A5A3C'], ['#FFE38A', '#5A4200'], ['#FFB4A8', '#8A1C12']];
export const PAL = ['#2F6FD6', '#14A38B', '#E3B12C', '#D9574F', '#5B8DEF', '#1F9D6A', '#E07B39', '#7A5AF8'];
export const SKIN = ['#F2C9A0', '#E8B48A', '#D49A6A', '#F5D3B0'];

/**
 * ฉายพิกัดแผนที่ (x, y, ความสูง z) เป็นพิกัดจอ หมุนรอบกลางชั้นด้วยมุม th
 * tau: 0 = มองจากด้านบน (2D), 1 = isometric เต็มที่ (ใช้ทำ animation ตอนเปิด 3D)
 * คืน [sx, sy, depth]
 */
export function P3(x, y, z, th, tau = 1) {
  const c = Math.cos(th), s = Math.sin(th), dx = x - 180, dy = y - 152, rx = dx * c - dy * s, ry = dx * s + dy * c;
  const k = K3 * (0.72 + 0.28 * tau), sq = 0.866 - 0.366 * tau;
  return [210 + (rx - ry) * 0.866 * k, 178 + (rx + ry) * sq * k - z * k * tau, rx + ry];
}
export const pts3 = a => a.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${Math.round((n >> 16) * f)},${Math.round(((n >> 8) & 255) * f)},${Math.round((n & 255) * f)})`;
}

export const zrect = (D, k) => { const r = D.room(k); return [r.x, r.y, r.w, r.h]; };
const isOpenS = r => r.open === 'S';

const CHAIRS = new WeakMap();
/** ตำแหน่งเก้าอี้ในห้อง (คำนวณจากขนาดห้อง) */
export function chairsOf(D, k) {
  let cache = CHAIRS.get(D);
  if (!cache) CHAIRS.set(D, cache = {});
  if (cache[k]) return cache[k];
  const r = D.room(k), out = [];
  if (!r || r.kind === 'none' || r.kind === 'cafe') return (cache[k] = out);
  const { x, y, w, h } = r, big = w > 100, cols = Math.floor((w - 16) / (big ? 11 : 10)) + 1, dx = (w - 16) / (cols - 1), rows = big ? 4 : 3, sp = big ? 13 : 12;
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) out.push([x + 8 + col * dx, isOpenS(r) ? y + 32 + row * sp : y + h - 32 - row * sp]);
  return (cache[k] = out);
}
/** ที่นั่ง/ที่ยืนลำดับที่ i ในห้อง (เก้าอี้เต็มแล้วยืนต่อแถว) */
export function seatPos(D, k, i) {
  const ch = chairsOf(D, k);
  if (i < ch.length) return { p: ch[i], seated: true };
  const r = D.room(k), j = i - ch.length, cols = Math.max(1, Math.floor((r.w - 12) / 7));
  return { p: [r.x + 6 + (j % cols) * 7, isOpenS(r) ? r.y + r.h - 8 + Math.floor(j / cols) * 7 : r.y + 8 - Math.floor(j / cols) * 7], seated: false };
}

/** ตำแหน่งคนเดินไปมาตามเส้นทาง (เดินกลับไปกลับมา) */
export function walkerAt(w, now, still = false) {
  const p = w.p, seg = [];
  let L = 0;
  for (let i = 1; i < p.length; i++) { const l = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); seg.push(l); L += l; }
  let d = ((still ? 0 : now / 1000) * w.sp + w.off) % (2 * L);
  if (d > L) d = 2 * L - d;
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i]) { const f = d / seg[i]; return [p[i][0] + (p[i + 1][0] - p[i][0]) * f, p[i][1] + (p[i + 1][1] - p[i][1]) * f]; }
    d -= seg[i];
  }
  return p[p.length - 1];
}

/** กล่องสี่เหลี่ยม (โต๊ะ เก้าอี้ พื้นอาคาร) วาดเฉพาะด้านที่หันมาทางผู้ดู */
export function prism(x, y, w, h, z0, z1, th, top, stroke, sw, tau = 1) {
  const C = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  let out = '';
  const pc = P3(x + w / 2, y + h / 2, 0, th, tau);
  for (let i = 0; i < 4; i++) {
    const a = C[i], b = C[(i + 1) % 4], pm = P3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0, th, tau);
    if (pm[2] > pc[2] + 0.01) {
      const f = (b[0] - a[0]) !== 0 ? 0.86 : 0.74;
      out += `<polygon points="${pts3([P3(a[0], a[1], z0, th, tau), P3(b[0], b[1], z0, th, tau), P3(b[0], b[1], z1, th, tau), P3(a[0], a[1], z1, th, tau)])}" fill="${top.startsWith('#') ? shade(top, f) : top}" stroke="${stroke}" stroke-width="${sw * 0.6}" stroke-linejoin="round"/>`;
    }
  }
  return out + `<polygon points="${pts3(C.map(p => P3(p[0], p[1], z1, th, tau)))}" fill="${top}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`;
}

/** คน 1 คน (ตัว + หัว) */
export function person(x, y, th, col, skin, seated, op = 1, tau = 1) {
  const z = seated ? 3 : 0, g = P3(x, y, 0, th, tau), b0 = P3(x, y, z + 0.5, th, tau), b1 = P3(x, y, z + (seated ? 5 : 6.6), th, tau), hd = P3(x, y, z + (seated ? 7.3 : 8.9), th, tau);
  return `<g opacity="${op.toFixed(2)}">${seated ? '' : `<ellipse cx="${g[0].toFixed(1)}" cy="${g[1].toFixed(1)}" rx="3" ry="1.5" fill="rgba(14,25,48,.2)"/>`}<line x1="${b0[0].toFixed(1)}" y1="${b0[1].toFixed(1)}" x2="${b1[0].toFixed(1)}" y2="${b1[1].toFixed(1)}" stroke="${col}" stroke-width="3.8" stroke-linecap="round"/><circle cx="${hd[0].toFixed(1)}" cy="${hd[1].toFixed(1)}" r="2.3" fill="${skin}"/></g>`;
}

function wallSeg(a, b, H, th, fill, tau) {
  const A0 = P3(a[0], a[1], 0, th, tau), B0 = P3(b[0], b[1], 0, th, tau), A1 = P3(a[0], a[1], H, th, tau), B1 = P3(b[0], b[1], H, th, tau);
  return `<polygon points="${pts3([A0, B0, B1, A1])}" fill="${fill}" stroke="rgba(14,25,48,.12)" stroke-width=".5"/><line x1="${A1[0].toFixed(1)}" y1="${A1[1].toFixed(1)}" x2="${B1[0].toFixed(1)}" y2="${B1[1].toFixed(1)}" stroke="var(--chrome)" stroke-width="2.2" stroke-linecap="round"/>`;
}
/** ผนังห้อง แยกด้านไกล (วาดก่อน) และด้านใกล้ (วาดทีหลัง เตี้ยกว่าให้มองทะลุได้) */
export function walls(x, y, w, h, H, th, open, nearH, tau = 1) {
  const C = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], dirs = ['N', 'E', 'S', 'W'], pc = P3(x + w / 2, y + h / 2, 0, th, tau)[2];
  let far = '', near = '';
  for (let i = 0; i < 4; i++) {
    if (dirs[i] === open) continue;
    const a = C[i], b = C[(i + 1) % 4], pm = P3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0, th, tau)[2];
    if (pm < pc) far += wallSeg(a, b, H, th, '#F4F6F9', tau);
    else if (nearH) near += wallSeg(a, b, nearH, th, '#EEF1F5', tau);
  }
  return { far, near };
}

/**
 * ส่วนนิ่งของฉาก: สนาม ต้นไม้ อาคาร พื้นสีตามความหนาแน่น โต๊ะ เก้าอี้ เจ้าหน้าที่ และคนในห้องอื่น
 * c = กล้อง {th, tf, tau}, cd = ความหนาแน่น, skip = ห้องที่วาดคนแบบเคลื่อนไหวแยก (ห้องรอของผู้ป่วย) หรือ null
 */
export function staticScene(D, c, cd, skip) {
  const th = c.th, tau = c.tau ?? 1, P = (x, y, z) => P3(x, y, z, th, tau);
  let s = `<g transform="${c.tf}">`;
  const flat = (x, y, w, h, f, zz = 0.3) => `<polygon points="${pts3([[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(p => P(p[0], p[1], zz)))}" fill="${f}"/>`;
  s += flat(-60, -60, 480, 424, 'var(--lawn)', -8);
  const pc = P(180, 152, 0)[2];
  const tree = ([x, y]) => {
    const g = P(x, y, -8), t = P(x, y, 6), cr = P(x, y, 14);
    return `<ellipse cx="${g[0].toFixed(1)}" cy="${g[1].toFixed(1)}" rx="9" ry="4.5" fill="rgba(14,60,30,.15)"/><line x1="${g[0].toFixed(1)}" y1="${g[1].toFixed(1)}" x2="${t[0].toFixed(1)}" y2="${t[1].toFixed(1)}" stroke="#8B6B4A" stroke-width="2.5"/><circle cx="${cr[0].toFixed(1)}" cy="${cr[1].toFixed(1)}" r="9.5" fill="#4CC27A"/><circle cx="${(cr[0] - 3).toFixed(1)}" cy="${(cr[1] - 3).toFixed(1)}" r="4.5" fill="#7DDB9C" opacity=".8"/>`;
  };
  const trees = D.floor.trees;
  s += trees.filter(t => P(t[0], t[1], 0)[2] < pc).map(tree).join('');
  s += prism(2, 2, 356, 300, -8, 0, th, '#F8FAFC', 'rgba(14,25,48,.15)', 1, tau);
  const ow = walls(2, 2, 356, 300, 14, th, null, 2.5, tau);
  s += ow.far;
  s += D.floor.corridors.map(r => flat(r.x, r.y, r.w, r.h, '#E9EDF2')).join('');
  const items = [];
  for (const r of D.floor.rooms) {
    const { key: k, x, y, w, h } = r, lv = cd[k]?.lvl ?? 0, S_ = isOpenS(r);
    s += flat(x, y, w, h, FLOOR[lv], 0.4);
    s += walls(x, y, w, h, 9, th, r.open, 0, tau).far;
    const dy = S_ ? y + 11 : y + h - 11, sy = S_ ? y + 5 : y + h - 5;
    const desks = r.counter ? [[x + w / 2, w - 18]] : r.desks ? Array.from({ length: r.desks }, (_, i) => [x + w * (i + 1) / (r.desks + 1), 14]) : [];
    desks.forEach(([cx, ww]) => {
      items.push({ d: P(cx, dy, 0)[2], s: prism(cx - ww / 2, dy - 3, ww, 6, 0, 5, th, '#E6D5B5', 'rgba(14,25,48,.25)', 0.6, tau) + prism(cx - 2, dy - 1, 4, 1.2, 5, 9, th, '#2B3445', 'rgba(0,0,0,.3)', 0.4, tau) });
      const sx = r.counter ? [cx - ww / 4, cx + ww / 4] : [cx];
      sx.forEach(px => items.push({ d: P(px, sy, 0)[2], s: person(px, sy, th, '#0F9F8F', '#F2C9A0', false, 1, tau) }));
    });
    chairsOf(D, k).forEach(([cx, cy]) => {
      const back = S_ ? [cx - 2.6, cy + 2, 5.2, 1.3] : [cx - 2.6, cy - 3.3, 5.2, 1.3];
      items.push({ d: P(cx, cy, 0)[2] - 0.1, s: prism(cx - 2.6, cy - 2.6, 5.2, 5.2, 0, 3, th, '#3D8BD9', 'rgba(14,25,48,.25)', 0.4, tau) + prism(back[0], back[1], back[2], back[3], 0, 8, th, '#2F78C4', 'rgba(14,25,48,.25)', 0.4, tau) });
    });
    if (r.kind === 'cafe') [[x + 12, y + 30], [x + 28, y + 55]].forEach(([cx, cy]) => items.push({ d: P(cx, cy, 0)[2], s: prism(cx - 4, cy - 4, 8, 8, 0, 5, th, '#E6D5B5', 'rgba(14,25,48,.25)', 0.5, tau) }));
    if (k !== skip) {
      const n = cd[k]?.n || 0, cap = chairsOf(D, k).length + 10;
      for (let i = 0; i < Math.min(n, cap); i++) {
        const sp = r.kind === 'cafe' ? { p: [x + 8 + (i % 3) * 12, y + 22 + Math.floor(i / 3) * 14], seated: false }
          : r.kind === 'none' ? { p: [x + 12 + (i % 2) * 14, y + 30 + Math.floor(i / 2) * 12], seated: false } : seatPos(D, k, i);
        items.push({ d: P(sp.p[0], sp.p[1], 0)[2] + 0.05, s: person(sp.p[0], sp.p[1], th, PAL[(i * 3 + k.length) % PAL.length], SKIN[i % 4], sp.seated, 1, tau) });
      }
    }
  }
  items.sort((a, b) => a.d - b.d).forEach(o => { s += o.s; });
  s += ow.near;
  s += `<g opacity=".55">${trees.filter(t => P(t[0], t[1], 0)[2] >= pc).map(tree).join('')}</g>`;
  return s + '</g>';
}

/** ป้ายชื่อโซน + จำนวนคน (พิกัดจอ) */
export function zoneLabel(t, name, count, lv, { stroke = 'rgba(14,25,48,.12)', sw = 1, dy = 0, op = 1 } = {}) {
  const w1 = name.length * 5.6 + 12, w2 = count.length * 5.5 + 10, W = w1 + w2 + 6, lx = t[0] - W / 2, ly = t[1] - 11 + dy;
  return `<g opacity="${op.toFixed(2)}"><rect x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" width="${W.toFixed(1)}" height="22" rx="11" fill="#fff" stroke="${stroke}" stroke-width="${sw}"/>
    <text x="${(lx + 8).toFixed(1)}" y="${(ly + 15).toFixed(1)}" font-size="10.5" font-weight="700" fill="#0E1930">${name}</text>
    <rect x="${(lx + w1).toFixed(1)}" y="${(ly + 3).toFixed(1)}" width="${w2.toFixed(1)}" height="16" rx="8" fill="${lv[0]}"/><text x="${(lx + w1 + w2 / 2).toFixed(1)}" y="${(ly + 14.6).toFixed(1)}" text-anchor="middle" font-size="9.5" font-weight="800" fill="${lv[1]}">${count}</text></g>`;
}

/** แปลงระยะลากบนจอเป็นระยะบนแผนที่ (ใช้ตอนลากเลื่อน) */
export function screenToMap(dxPx, dyPx, rectWidth, z, th) {
  if (!rectWidth) return [0, 0];
  const sc = 420 / rectWidth, du = dxPx * sc / z, dv = dyPx * sc / z, a = du / (0.866 * K3), b = dv / (0.5 * K3), rx = (a + b) / 2, ry = (b - a) / 2, c = Math.cos(th), s = Math.sin(th);
  return [rx * c + ry * s, -rx * s + ry * c];
}
export const clampPan = p => { p[0] = Math.max(-190, Math.min(190, p[0])); p[1] = Math.max(-160, Math.min(160, p[1])); return p; };
export const easeIO = k => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
