// แผนที่ชั้น 1: ตำแหน่ง เส้นทาง ระยะเดิน และคำบอกทาง
import { fill } from './util.js';

/** จุดบนแผนที่ (place key) สำหรับผู้ป่วยแผนก dept */
export function place(D, key, dept = 'med') {
  const f = D.floor, p = f.places[key];
  if (!p) throw new Error(`ไม่พบจุด "${key}" ใน floor-map.yaml`);
  const d = D.depts[dept] || D.deptList[0];
  const vars = { dept: d.name, room: d.exam_room };
  const pt = p.at ? f.exam_points[d.key][p.at] : p.pt;
  return {
    key,
    name: fill(p.name, vars),
    short: fill(p.short, vars),
    mark: fill(p.mark, vars),
    hl: p.hl === 'dept' ? d.key : p.hl,
    pt,
    spur: p.spur || [pt, [pt[0], f.corridor_y]],
  };
}

/** เส้นทางเดินจาก a ไป b: จุดหักเลี้ยว + ระยะ (เมตร) */
export function route(D, a, b, dept) {
  const A = place(D, a, dept), B = place(D, b, dept);
  if (a === b) return { A, B, pts: [A.pt], m: 0, same: true };
  const pts = [];
  for (const p of [...A.spur, ...B.spur.slice().reverse()]) {
    const l = pts[pts.length - 1];
    if (!l || l[0] !== p[0] || l[1] !== p[1]) pts.push(p);
  }
  // ตัดจุดที่อยู่บนเส้นตรงเดียวกันออก เหลือเฉพาะจุดเลี้ยว
  let i = 1;
  while (i < pts.length - 1) {
    const [a0, a1] = pts[i - 1], [b0, b1] = pts[i], [c0, c1] = pts[i + 1];
    if ((b0 - a0) * (c1 - b1) - (b1 - a1) * (c0 - b0) === 0) pts.splice(i, 1); else i++;
  }
  let len = 0;
  for (i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return { A, B, pts, m: Math.max(1, Math.round(len * D.floor.metres_per_unit)), same: false };
}

/** นาทีที่ใช้เดิน (ทศนิยม) */
export const walkMinutes = (D, m) => (Number(m) > 0 ? m / D.app.walking_speed_mps / 60 : 0);
/** ข้อความเวลาเดิน "ไม่ถึง 1" หรือจำนวนนาทีปัดขึ้น */
export function walkTime(D, m) {
  // ปัดเศษทศนิยมจาก floating point ก่อน (42 / 0.7 = 60.000000000000014 ต้องได้ 1 นาที ไม่ใช่ 2)
  const s = Math.round((Number(m) || 0) / D.app.walking_speed_mps * 1000) / 1000;
  return s < 60 ? 'ไม่ถึง 1' : String(Math.ceil(s / 60));
}

/** ทิศเลี้ยวจากช่วงก่อนหน้า v ไปช่วงถัดไป s (แกน y ชี้ลงแบบจอภาพ) */
export function turnDir(v, s) {
  return (v.dx * s.dy - v.dy * s.dx) < 0 ? 'เลี้ยวซ้าย' : 'เลี้ยวขวา';
}

/** คำบอกทางทีละขั้น จบด้วยจุดสังเกตของปลายทาง */
export function stepsOf(D, r) {
  const p = r.pts, n = p.length - 1, out = [], U = D.floor.metres_per_unit;
  const seg = i => ({
    dx: Math.sign(p[i + 1][0] - p[i][0]),
    dy: Math.sign(p[i + 1][1] - p[i][1]),
    m: Math.max(1, Math.round(Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]) * U)),
  });
  for (let i = 0; i < n; i++) {
    const s = seg(i);
    if (i === 0) { out.push(s.m <= 5 && n > 1 ? `ออกจาก${r.A.name} มาที่ทางเดินหลัก` : `ออกจาก${r.A.name} เดินตรงไป ${s.m} เมตร`); continue; }
    const turn = turnDir(seg(i - 1), s);
    out.push(i === n - 1 && s.m <= 5 ? `${turn} ${r.B.name}อยู่ตรงหน้า` : `${turn} แล้วเดินตรงไป ${s.m} เมตร`);
  }
  out.push(`จุดสังเกต: ${r.B.mark}`);
  return out;
}
