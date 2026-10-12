// business logic ทั้งหมด (ต่อยอดจาก public/core.js เดิม)
// รันได้ทั้งใน Node (server.mjs) และในเบราว์เซอร์ (โหมดไม่มี server)
// store = { get(): state, set(state) } · clock() = Date ปัจจุบัน
import { isoLocal, pad2 } from './util.js';
import { queueLabel } from './queue.js';

export const SCHEMA = 'closely-state/1';

export class CoreError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, msg) => { throw new CoreError(status, msg); };

const ymd = d => `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
const clone = o => JSON.parse(JSON.stringify(o));

function newCare(D) { return { phase: 'meds', round: 1, rounds: D.care.rounds, ans: {}, decision: null, rdeliv: 0, decided_at: null }; }

function blankVisit(D, s, { dept, deptChosen, name, phone, symptoms = [], demo = false, at }) {
  const d = D.depts[dept];
  const q = s.queues[dept];
  q.last_issued += 1;
  s.seq.visit += 1; s.seq.session += 1;
  const date = new Date(at);
  return {
    id: 'V' + String(s.seq.visit).padStart(4, '0'),
    session_id: `s-${ymd(date)}-${String(s.seq.session).padStart(4, '0')}`,
    demo, qn: q.last_issued, queue: queueLabel(d, q.last_issued), dept, dept_chosen: deptChosen || dept,
    name, phone, symptoms, created_at: isoLocal(date),
    stage: 'register', arrived: false, loc: 'reg', rx: null, addr: '', rx_at: null, deliv: 0,
    result: null, left_at: null, care: newCare(D), chat: [], events: [], feelings: [], log: [],
  };
}

/** สร้างข้อมูลเริ่มต้นจาก departments.yaml + demo-patients.yaml (เวลาเลื่อนให้เป็น "วันนี้") */
export function initialState(D, now = new Date()) {
  const s = { schema: SCHEMA, created_at: isoLocal(now), updated_at: isoLocal(now), seq: { visit: 0, session: 0 }, queues: {}, visits: [] };
  for (const d of D.deptList) s.queues[d.key] = { calling: d.queue.calling, last_issued: 0 };
  const order = D.stages.map(x => x.key);
  const demo = [...D.demo.patients].sort((a, b) => b.minutes_ago - a.minutes_ago);
  for (const p of demo) {
    const start = new Date(now.getTime() - p.minutes_ago * 60000);
    s.queues[p.dept].last_issued = p.qn - 1;
    const v = blankVisit(D, s, { dept: p.dept, name: p.name, phone: p.phone, demo: true, at: start });
    const upto = order.indexOf(p.stage);
    // แบ่งเวลาที่ผ่านมาให้แต่ละขั้นตามสัดส่วนเวลาจริงโดยเฉลี่ย
    const w = { register: 3, vitals: 8, waiting: 25, consult: 9, pharmacy: 12, done: 4 };
    const total = order.slice(0, upto + 1).reduce((a, k) => a + w[k], 0);
    let t = start.getTime();
    for (let i = 0; i <= upto; i++) {
      v.events.push({ stage: order[i], at: isoLocal(new Date(t)) });
      t += (w[order[i]] / total) * p.minutes_ago * 60000;
    }
    v.stage = p.stage;
    v.loc = { register: 'reg', vitals: 'screen', waiting: 'front', consult: 'exam', pharmacy: 'pharm', done: 'entrance' }[p.stage];
    v.arrived = upto >= 1;
    if (upto >= order.indexOf('pharmacy')) {
      v.result = { id: p.result || D.depts[p.dept].result, at: v.events[order.indexOf('pharmacy')].at };
      v.rx = p.rx || 'self';
    }
    if (p.stage === 'done') { v.care.phase = 'waitq'; v.left_at = isoLocal(now); }
    s.visits.push(v);
  }
  for (const d of D.deptList) s.queues[d.key].last_issued = Math.max(s.queues[d.key].last_issued, d.queue.last_issued, d.queue.calling);
  s.visits.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return s;
}

/** ตรวจว่า object เป็น state ที่นำเข้าได้ */
export function validateState(s) {
  if (!s || typeof s !== 'object') fail(400, 'ไฟล์ว่างหรือไม่ใช่ข้อมูลของแอปนี้');
  if (s.schema !== SCHEMA) fail(400, `ไฟล์นี้ไม่ใช่ข้อมูลของแอปนี้ (ต้องมี schema: ${SCHEMA})`);
  if (!s.queues || typeof s.queues !== 'object') fail(400, 'ไฟล์ไม่มีหัวข้อ "queues"');
  if (!Array.isArray(s.visits)) fail(400, 'ไฟล์ไม่มีหัวข้อ "visits"');
  if (!s.seq) s.seq = { visit: s.visits.length, session: s.visits.length };
  return s;
}

export function createCore(D, store, clock = () => new Date()) {
  const stamp = () => isoLocal(clock());
  const findVisit = (s, id) => s.visits.find(v => v.id === id) || fail(404, 'ไม่พบคิวนี้ในระบบ');
  const setStage = (v, stage) => { v.stage = stage; v.events.push({ stage, at: stamp() }); };
  const log = (v, type, extra = {}) => v.log.push({ type, at: stamp(), ...extra });
  const need = (cond, msg) => { if (!cond) fail(409, msg); };
  const tplFor = v => D.template(v.result?.id) || D.template(D.depts[v.dept].result);

  function consult(s, v) {
    s.queues[v.dept].calling = Math.max(s.queues[v.dept].calling, v.qn);
    setStage(v, 'consult');
    v.loc = 'front';
  }

  const actions = {
    // ---------- ผู้ป่วย ----------
    register(s, p) {
      const name = String(p.name || '').trim(), phone = String(p.phone || '').replace(/\D/g, '');
      if (name.length < 2) fail(400, 'กรุณากรอกชื่อ-นามสกุล');
      if (phone.length < 9 || phone.length > 10) fail(400, 'เบอร์โทรศัพท์ไม่ถูกต้อง');
      const chosen = p.dept === D.unsure.key ? D.unsure.key : p.dept;
      const dept = chosen === D.unsure.key ? D.unsure.fallback : chosen;
      if (!D.depts[dept]) fail(400, 'ไม่พบแผนก');
      const startedAt = p.started_at && !Number.isNaN(Date.parse(p.started_at)) ? new Date(p.started_at) : clock();
      const v = blankVisit(D, s, { dept, deptChosen: chosen, name, phone, symptoms: (p.symptoms || []).map(String).slice(0, 12), at: clock() });
      v.events.push({ stage: 'register', at: isoLocal(startedAt) });
      setStage(v, 'vitals');
      if (p.login) log(v, 'login', { method: p.login });
      s.visits.push(v);
      return { id: v.id };
    },
    lookup(s, p) {
      const phone = String(p.phone || '').replace(/\D/g, '');
      const list = s.visits.filter(v => v.phone === phone);
      if (!list.length) fail(404, 'ไม่พบคิวของเบอร์นี้');
      return { id: list.sort((a, b) => b.created_at.localeCompare(a.created_at))[0].id };
    },
    arrive(s, p) {
      const v = findVisit(s, p.id);
      if (!D.floor.places[p.place]) fail(400, 'ไม่พบสถานที่');
      v.loc = p.place;
      if (v.stage === 'vitals' && p.place === 'screen') v.arrived = true;
      log(v, 'arrive', { place: p.place });
    },
    rxDelivery(s, p) {
      const v = findVisit(s, p.id);
      need(v.stage === 'pharmacy', 'ยังไม่ถึงขั้นรับยา');
      const addr = String(p.addr || '').trim();
      if (addr.length < 5) fail(400, 'กรุณากรอกที่อยู่');
      Object.assign(v, { rx: 'delivery', addr, deliv: 0, rx_at: stamp() });
      log(v, 'rx', { mode: 'delivery' });
      setStage(v, 'done');
    },
    rxSelf(s, p) {
      const v = findVisit(s, p.id);
      need(v.stage === 'pharmacy', 'ยังไม่ถึงขั้นรับยา');
      Object.assign(v, { rx: 'self', rx_at: stamp() });
      log(v, 'rx', { mode: 'self' });
    },
    rxReset(s, p) {
      const v = findVisit(s, p.id);
      need(v.stage === 'pharmacy', 'จ่ายยาไปแล้ว เปลี่ยนวิธีรับยาไม่ได้');
      v.rx = null;
      log(v, 'rx', { mode: 'reset' });
    },
    checkout(s, p) {
      const v = findVisit(s, p.id);
      need(v.stage === 'done', 'ยังมีขั้นตอนที่ต้องทำในโรงพยาบาล');
      if (v.left_at) return;
      v.left_at = stamp(); v.loc = 'entrance';
      log(v, 'checkout');
    },
    feeling(s, p) {
      const v = findVisit(s, p.id), score = Number(p.score);
      if (!(score >= 1 && score <= 5)) fail(400, 'คะแนนต้องอยู่ระหว่าง 1–5');
      if (p.stage !== 'visit' && !D.stages.some(x => x.key === p.stage)) fail(400, 'ไม่พบขั้นตอน');
      v.feelings = v.feelings.filter(f => f.stage !== p.stage);
      v.feelings.push({ stage: p.stage, score, reasons: (p.reasons || []).filter(r => D.app.reasons.includes(r)), at: stamp() });
    },
    quizSend(s, p) {
      const v = findVisit(s, p.id);
      need(v.care.phase === 'assess', 'หมอยังไม่ได้ส่งแบบประเมิน');
      const ans = {};
      for (const q of D.care.quiz.questions) {
        const a = p.ans?.[q.k];
        if (a == null || a === '') continue;
        if (!q.text && !q.opts.includes(a)) fail(400, `คำตอบข้อ "${q.q}" ไม่ถูกต้อง`);
        ans[q.k] = String(a).slice(0, 300);
      }
      v.care.ans = ans; v.care.phase = 'review';
      log(v, 'quiz', { answers: Object.keys(ans).length });
    },
    chatSend(s, p) {
      const v = findVisit(s, p.id), t = String(p.text || '').trim().slice(0, 300);
      if (!t) fail(400, 'พิมพ์ข้อความก่อนส่ง');
      v.chat.push({ from: 'me', t, at: stamp() });
      const rule = D.care.chat.replies.find(r => t.includes(r.match));
      // คำตอบหมอ (จำลอง) ตั้งเวลาไว้ล่วงหน้า แอปจะแสดง "หมอกำลังพิมพ์..." จนถึงเวลานั้น
      v.chat.push({ from: 'doc', t: rule ? rule.reply : D.care.chat.default_reply, at: isoLocal(new Date(clock().getTime() + D.care.chat.reply_delay_ms)) });
    },

    // ---------- เจ้าหน้าที่ / หมอ ----------
    vitalsDone(s, p) {
      const v = findVisit(s, p.id);
      need(v.stage === 'vitals', 'ผู้ป่วยไม่ได้อยู่ขั้นคัดกรอง');
      Object.assign(v, { arrived: true, loc: 'screen' });
      setStage(v, 'waiting');
    },
    callNext(s, p) {
      const q = s.queues[p.dept] || fail(400, 'ไม่พบแผนก');
      const d = D.depts[p.dept];
      if (q.calling >= q.last_issued) fail(409, `ไม่มีคิวรอใน${d.name}`);
      q.calling += 1;
      const v = s.visits.find(x => x.dept === p.dept && x.qn === q.calling && x.stage === 'waiting');
      if (v) consult(s, v);
      return { called: queueLabel(d, q.calling), id: v?.id || null };
    },
    callVisit(s, p) {
      const v = findVisit(s, p.id);
      need(v.stage === 'waiting', 'ผู้ป่วยไม่ได้รอเรียกคิว');
      consult(s, v);
      return { called: v.queue };
    },
    saveResult(s, p) {
      const v = findVisit(s, p.id);
      need(v.stage === 'consult', 'ผู้ป่วยยังไม่ได้อยู่ในห้องตรวจ');
      const t = D.template(p.template || D.depts[v.dept].result) || fail(400, 'ไม่พบผลวินิจฉัยสำเร็จรูป');
      v.result = { id: t.id, at: stamp() };
      Object.assign(v, { loc: 'exam', rx: v.demo ? 'self' : null });
      if (!v.chat.length) v.chat.push({ from: 'doc', t: D.care.chat.greeting, at: stamp() });
      setStage(v, 'pharmacy');
    },
    advDeliv(s, p) {
      const v = findVisit(s, p.id);
      need(v.rx === 'delivery' && v.deliv < 4, 'ไม่มีการส่งยาที่ต้องเลื่อนสถานะ');
      v.deliv += 1;
      log(v, 'delivery', { step: v.deliv, label: D.app.delivery.steps[v.deliv] });
      if (v.deliv === 4 && v.care.phase === 'meds') v.care.phase = 'waitq';
    },
    dispensed(s, p) {
      const v = findVisit(s, p.id);
      need(v.stage === 'pharmacy' && v.rx === 'self', 'ผู้ป่วยไม่ได้รอรับยาที่ห้องยา');
      v.loc = 'pharm';
      v.care.phase = 'waitq';
      setStage(v, 'done');
    },
    docSendQ(s, p) {
      const v = findVisit(s, p.id);
      need(v.care.phase === 'waitq', 'ยังไม่ถึงเวลาส่งแบบประเมิน');
      v.care.phase = 'assess'; v.care.ans = {};
    },
    docFollow(s, p) {
      const v = findVisit(s, p.id);
      need(v.care.phase === 'review', 'ยังไม่มีคำตอบให้หมอพิจารณา');
      Object.assign(v.care, { phase: 'followup', decision: 'followup', decided_at: stamp() });
    },
    docRefill(s, p) {
      const v = findVisit(s, p.id);
      need(v.care.phase === 'review', 'ยังไม่มีคำตอบให้หมอพิจารณา');
      need(v.care.round < v.care.rounds, 'ส่งยาครบทุกรอบแล้ว');
      Object.assign(v.care, { phase: 'refill', decision: 'refill', rdeliv: 0, decided_at: stamp() });
    },
    advRefill(s, p) {
      const v = findVisit(s, p.id), c = v.care;
      need(c.phase === 'refill', 'ไม่มีการส่งยารอบต่อไป');
      if (c.rdeliv < 4) c.rdeliv += 1;
      log(v, 'refill', { round: c.round + 1, step: c.rdeliv, label: D.app.delivery.steps[c.rdeliv] });
      if (c.rdeliv === 4) Object.assign(c, { round: c.round + 1, phase: 'waitq', decision: null, rdeliv: 0 });
    },
    docMsg(s, p) {
      const v = findVisit(s, p.id);
      v.chat.push({ from: 'doc', t: String(p.text || D.care.chat.doctor_check_in).slice(0, 300), at: stamp() });
    },
    addMock(s) {
      const names = D.demo.mock_names, ids = [];
      D.deptList.slice(0, 3).forEach((d, i) => {
        const v = blankVisit(D, s, { dept: d.key, name: names[(s.seq.visit + i) % names.length], phone: '089' + String(1000000 + s.seq.visit * 7 + i).slice(-7), demo: true, at: clock() });
        v.events.push({ stage: 'register', at: stamp() });
        setStage(v, 'vitals');
        v.loc = 'screen';
        s.visits.push(v);
        ids.push(v.id);
      });
      return { ids };
    },
    reset() { return { replace: initialState(D, clock()) }; },
    import(s, p) { return { replace: validateState(clone(p.state)) }; },
  };

  /** ทำ action แล้วบันทึก คืน { result, state } */
  function act(type, payload = {}) {
    const fn = actions[type] || fail(404, `ไม่รู้จักคำสั่ง ${type}`);
    const s = clone(store.get());
    let result = fn(s, payload) || {};
    let next = s;
    if (result.replace) { next = result.replace; result = { ok: true }; }
    next.updated_at = stamp();
    store.set(next);
    return { result, state: next };
  }

  return { act, actions: Object.keys(actions), template: tplFor };
}
