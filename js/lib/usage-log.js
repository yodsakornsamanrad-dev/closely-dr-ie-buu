// บันทึกการใช้งาน (usage log) สำหรับทำ Customer Journey Map
// ไฟล์ที่ดาวน์โหลดมี 2 ส่วน: sessions (อ่านง่าย ใช้ทำ Journey Map) และ state (ข้อมูลเต็ม ใช้ "นำเข้า YAML" กลับ)
import yaml from '../../vendor/js-yaml.mjs';
import { isoLocal } from './util.js';
import { validateState } from './core.js';

export function buildUsageLog(D, state, { mode = 'no-server', now = new Date(), includeDemo = false } = {}) {
  const sessions = state.visits.filter(v => includeDemo || !v.demo).map(v => {
    const events = [
      ...v.events.map(e => ({ stage: e.stage, at: e.at })),
      ...v.log.map(l => ({ action: l.type, ...l, type: undefined })),
    ].map(e => JSON.parse(JSON.stringify(e))).sort((a, b) => a.at.localeCompare(b.at));
    if (v.left_at && !events.some(e => e.action === 'checkout')) events.push({ action: 'checkout', at: v.left_at });
    return {
      session_id: v.session_id,
      queue: v.queue,
      department: v.dept,
      ...(v.dept_chosen !== v.dept ? { department_chosen: v.dept_chosen } : {}),
      symptoms: v.symptoms,
      events,
      feelings: v.feelings.map(f => ({ stage: f.stage, score: f.score, reasons: f.reasons })),
      result: v.result?.id || null,
      medicine: v.rx ? { mode: v.rx, delivery_step: v.rx === 'delivery' ? D.app.delivery.steps[v.deliv] : undefined } : null,
      care: {
        phase: v.care.phase,
        round: v.care.round,
        quiz_answers: v.care.ans,
        decision: v.care.decision,
        chat_messages: v.chat.filter(m => m.from === 'me').length,
      },
    };
  });
  return {
    exported_at: isoLocal(now),
    mode,
    note: 'ข้อมูลสมมติจาก workshop ไม่มีข้อมูลผู้ป่วยจริง',
    sessions: JSON.parse(JSON.stringify(sessions)),
    state,
  };
}

export const HEADER = '# Closely DR. x IE BUU — usage log สำหรับทำ Customer Journey Map\n# sessions = ข้อมูลแต่ละคิว, state = ข้อมูลเต็มสำหรับ "นำเข้า YAML"\n';

export function usageLogYaml(D, state, opts) {
  return HEADER + yaml.dump(buildUsageLog(D, state, opts), { lineWidth: -1, noRefs: true, flowLevel: 4 });
}

/** อ่านไฟล์ YAML ที่ดาวน์โหลดไป (usage log) หรือไฟล์ state ตรง ๆ → state */
export function parseImport(text) {
  let doc;
  try { doc = yaml.load(text); }
  catch (e) { throw Object.assign(new Error('อ่านไฟล์ YAML ไม่ได้: ' + e.message.split('\n')[0]), { status: 400 }); }
  return validateState(doc && doc.state ? doc.state : doc);
}

export const stateYaml = state => yaml.dump(state, { lineWidth: -1, noRefs: true });
export const parseStateYaml = text => validateState(yaml.load(text));
