// Value stream ของผู้ป่วย: รวมสถิติย้อนหลัง (demo-patients.yaml) กับเวลาจริงจากแอปวันนี้
import { stageMinutes, stageStart } from './timeline.js';

/** ขั้นนี้จบแล้วหรือยัง (มีขั้นถัดไป หรือขั้นกลับบ้านที่กดออกจาก รพ. แล้ว) */
function finished(v, stages, key) {
  if (!stageStart(v, key)) return false;
  if (key === 'done') return !!v.left_at;
  const i = stages.findIndex(s => s.key === key);
  return stages.slice(i + 1).some(s => stageStart(v, s.key));
}

export function valueStream(D, state) {
  const hist = D.demo.value_stream_history, live = state.visits.filter(v => !v.demo);
  const rows = D.stages.map(st => {
    const h = hist.stages.find(x => x.key === st.key) || { avg: 0, max: 0, mood: null, comments: [] };
    const mins = live.filter(v => finished(v, D.stages, st.key)).map(v => stageMinutes(v, D.stages, st.key));
    const feels = live.flatMap(v => v.feelings.filter(f => f.stage === st.key));
    const n = hist.n + mins.length;
    const avg = n ? (h.avg * hist.n + mins.reduce((a, b) => a + b, 0)) / n : 0;
    const max = Math.max(h.max, ...mins.map(Math.round), 0);
    const moodN = (h.mood != null ? hist.n : 0) + feels.length;
    const mood = moodN ? ((h.mood ?? 0) * (h.mood != null ? hist.n : 0) + feels.reduce((a, f) => a + f.score, 0)) / moodN : null;
    const reasons = {};
    feels.forEach(f => f.reasons.forEach(r => { reasons[r] = (reasons[r] || 0) + 1; }));
    return {
      key: st.key, name: st.name, sym: st.sym, value: st.value,
      avg: Math.round(avg * 10) / 10, max, mood: mood == null ? null : Math.round(mood * 10) / 10,
      liveCount: mins.length, comments: h.comments, reasons,
    };
  });
  const lead = rows.reduce((a, r) => a + r.avg, 0);
  const sum = val => rows.filter(r => r.value === val).reduce((a, r) => a + r.avg, 0);
  const va = sum('VA'), nva = sum('NVA');
  return {
    rows, lead: Math.round(lead), va: Math.round(va),
    pce: lead ? Math.round(va / lead * 100) : 0, nvaPct: lead ? Math.round(nva / lead * 100) : 0,
    histN: hist.n, liveN: live.length,
  };
}
