// ผังขั้นตอนวันนี้: สถานะและเวลาจริงของแต่ละขั้น + เวลารวม
// เวลาทุกค่ามาจาก events ของ visit ถ้าไม่มีข้อมูลจะได้ 0 ไม่ใช่ NaN
import { minutesBetween } from './util.js';
import { route } from './floor.js';

/** เวลาที่เข้าขั้น stage ครั้งล่าสุด (หรือ null) */
export function stageStart(visit, stage) {
  const ev = (visit.events || []).filter(e => e.stage === stage);
  return ev.length ? ev[ev.length - 1].at : null;
}

/** นาทีที่อยู่ในขั้น stage (ขั้นที่ยังไม่จบนับถึง now) */
export function stageMinutes(visit, stages, stage, now = new Date()) {
  const start = stageStart(visit, stage);
  if (!start) return 0;
  const i = stages.findIndex(s => s.key === stage);
  for (let j = i + 1; j < stages.length; j++) {
    const nx = stageStart(visit, stages[j].key);
    if (nx) return minutesBetween(start, nx);
  }
  if (stage === 'done') return visit.left_at ? minutesBetween(start, visit.left_at) : minutesBetween(start, now);
  return minutesBetween(start, now);
}

/** เวลารวมตั้งแต่เริ่มลงทะเบียนจนถึงตอนนี้ (หรือถึงตอนกด "กลับบ้าน") */
export function totalMinutes(visit, now = new Date()) {
  const first = (visit.events || [])[0];
  if (!first) return 0;
  return minutesBetween(first.at, visit.left_at || now);
}

/** ข้อความนาที: < 1 → "ไม่ถึง 1" */
export const fmtMin = m => (!(m >= 1) ? 'ไม่ถึง 1' : String(Math.round(m)));

/**
 * แถวของผังขั้นตอน
 * [{kind:'walk', m}, {kind:'stage', key, name, sym, placeName, status:'ok'|'now'|'next', minutes}]
 */
export function flowRows(D, visit, now = new Date()) {
  const stages = D.stages, cur = stages.findIndex(s => s.key === visit.stage), rows = [];
  stages.forEach((st, i) => {
    if (i > 0) {
      const r = route(D, stages[i - 1].place, st.place, visit.dept);
      if (r.m > 0) rows.push({ kind: 'walk', m: r.m });
    }
    const done = i < cur || (visit.left_at && i === cur);
    const isNow = i === cur && !done;
    let minutes = null;
    if ((done || isNow) && st.key !== 'done') minutes = stageMinutes(visit, stages, st.key, now);
    rows.push({ kind: 'stage', key: st.key, name: st.name, sym: st.sym, place: st.place, status: done ? 'ok' : isNow ? 'now' : 'next', minutes });
  });
  return rows;
}
