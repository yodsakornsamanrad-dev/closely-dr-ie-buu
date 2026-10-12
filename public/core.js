// Closely DR. x IE BUU — business logic ที่ใช้ร่วมกัน
// ใช้ได้ทั้งบน Node (server.js) และในเบราว์เซอร์ (โหมด GitHub Pages ไม่มี server)
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CloselyCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const pad = n => String(n).padStart(2, '0');
  function fmt(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  const now = () => fmt(new Date());
  const TIMESTAMP = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/;

  // เลื่อนเวลาทุกค่าใน seed ให้ข้อมูลตัวอย่าง "เพิ่งเกิดขึ้น" ก่อนตอนนี้
  // เพื่อให้ระยะเวลาแต่ละขั้นตอนใน Journey Map ต่อเนื่องกับข้อมูลที่ทดสอบจริง
  function rebaseSeed(seed) {
    const walk = (o, fn) => {
      for (const k in o) {
        if (typeof o[k] === 'string' && TIMESTAMP.test(o[k])) fn(o, k);
        else if (o[k] && typeof o[k] === 'object') walk(o[k], fn);
      }
    };
    let latest = 0;
    walk(seed, (o, k) => { latest = Math.max(latest, new Date(o[k]).getTime()); });
    const shift = Date.now() - latest;
    walk(seed, (o, k) => { o[k] = fmt(new Date(new Date(o[k]).getTime() + shift)); });
    return seed;
  }

  function fail(status, message) { const e = new Error(message); e.status = status; throw e; }

  // store = { db (get/set), save(), seed() } — ที่เก็บข้อมูลจริงขึ้นกับว่ารันที่ไหน
  function createCore(store) {
    let db = store.db;

    // ---------- domain helpers ----------
    const ACTIVE = ['vitals', 'waiting'];
    const dept = id => db.departments.find(d => d.id === id);
    const fmtQueue = (d, n) => `${d.prefix}${String(n).padStart(3, '0')}`;
    const findVisit = id => db.visits.find(v => v.id === id) || fail(404, 'ไม่พบข้อมูลการมาโรงพยาบาลนี้');

    function nextId(list, prefix) {
      const max = list.reduce((m, x) => Math.max(m, Number(String(x.id).slice(prefix.length)) || 0), 0);
      return prefix + String(max + 1).padStart(4, '0');
    }

    function setStage(v, stage) {
      v.stage = stage;
      v.events.push({ at: now(), type: 'stage', stage });
    }

    function stationFor(v, stageKey) {
      const j = db.journey.find(s => s.key === stageKey);
      if (!j || !j.station) return null;
      return j.station === 'DEPT' ? dept(v.dept).station : j.station;
    }

    function queueInfo(v) {
      const d = dept(v.dept);
      const q = db.queues[v.dept];
      const ahead = db.visits.filter(x => x.dept === v.dept && ACTIVE.includes(x.stage) && x.queueNo < v.queueNo).length;
      return { nowServing: q.nowServing ? fmtQueue(d, q.nowServing) : '-', ahead, etaMin: ahead * d.avgMinutes };
    }

    function visitView(v) {
      return {
        ...v,
        patient: db.patients.find(p => p.id === v.patientId) || null,
        deptInfo: dept(v.dept),
        queue: queueInfo(v),
        target: stationFor(v, v.stage),
      };
    }

    function board() {
      return db.departments.map(d => {
        const q = db.queues[d.id];
        const waiting = db.visits.filter(v => v.dept === d.id && ACTIVE.includes(v.stage)).length;
        return { id: d.id, name: d.name, icon: d.icon, nowServing: q.nowServing ? fmtQueue(d, q.nowServing) : '-', waiting, etaMin: waiting * d.avgMinutes };
      });
    }

    function callNext(deptId) {
      const d = dept(deptId) || fail(400, 'ไม่พบแผนก');
      const next = db.visits
        .filter(v => v.dept === d.id && v.stage === 'waiting')
        .sort((a, b) => a.queueNo - b.queueNo)[0];
      if (!next) fail(409, `ไม่มีผู้ป่วยรอเรียกใน ${d.name}`);
      callVisit(next);
      return next;
    }

    function callVisit(v) {
      db.queues[v.dept].nowServing = v.queueNo;
      setStage(v, 'consult');
    }

    function createVisit({ name, phone, deptId, symptoms, startedAt, address = '' }) {
      const d = dept(deptId) || fail(400, 'ไม่พบแผนก');
      let p = phone && db.patients.find(x => x.phone === phone);
      if (p) p.name = name;
      else {
        p = { id: nextId(db.patients, 'P'), name, phone, address, createdAt: now() };
        db.patients.push(p);
      }
      const q = db.queues[d.id];
      q.lastIssued += 1;
      const v = {
        id: nextId(db.visits, 'V'),
        patientId: p.id,
        dept: d.id,
        queueNo: q.lastIssued,
        queueLabel: fmtQueue(d, q.lastIssued),
        symptoms,
        stage: 'register',
        location: 'ENT',
        createdAt: now(),
        diagnosis: null,
        medicines: [],
        advice: [],
        followUp: null,
        medPickup: null,
        events: [{ at: startedAt || now(), type: 'stage', stage: 'register' }],
        feedback: [],
      };
      setStage(v, 'vitals');
      db.visits.push(v);
      return v;
    }

    const avg = a => (a.length ? Math.round((a.reduce((s, x) => s + x, 0) / a.length) * 10) / 10 : null);

    function analytics() {
      return db.journey.filter(j => j.key !== 'done').map(j => {
        const minutes = [];
        for (const v of db.visits) {
          const ev = v.events.filter(e => e.type === 'stage');
          const i = ev.findIndex(e => e.stage === j.key);
          if (i >= 0 && ev[i + 1] && ev[i + 1].at >= ev[i].at) minutes.push((new Date(ev[i + 1].at) - new Date(ev[i].at)) / 60000);
        }
        const fb = db.visits.flatMap(v => (v.feedback || []).filter(f => f.stage === j.key));
        return {
          key: j.key, label: j.label, icon: j.icon,
          visits: minutes.length, avgMinutes: avg(minutes), maxMinutes: minutes.length ? Math.round(Math.max(...minutes)) : null,
          feedbackCount: fb.length, avgScore: avg(fb.map(f => Number(f.score))),
          comments: fb.filter(f => f.comment).map(f => ({ score: f.score, comment: f.comment })),
        };
      });
    }

    const FAKE_NAMES = ['สมชาย ใจงาม', 'มาลี ดอกไม้', 'อำนวย สุขใจ', 'ประภา แสงทอง', 'เฉลิม ชัยดี', 'ลำดวน หอมกลิ่น', 'สมพร มีสุข', 'บุญส่ง ทองคำ'];

    // ---------- routes ----------
    const routes = [
      ['GET', /^\/api\/config$/, () => ({
        meta: db.meta, settings: db.settings, journey: db.journey, departments: db.departments,
        stations: db.stations, diagnosisTemplates: db.diagnosisTemplates,
      })],
      ['GET', /^\/api\/board$/, () => board()],
      ['GET', /^\/api\/visit\/([\w-]+)$/, (m) => visitView(findVisit(m[1]))],
      ['GET', /^\/api\/find$/, (m, b, params) => {
        const phone = String(params.get('phone') || '').replace(/\D/g, '');
        const p = db.patients.find(x => x.phone === phone) || fail(404, 'ไม่พบเบอร์โทรนี้ในระบบ');
        const v = db.visits.filter(x => x.patientId === p.id).sort((a, b2) => b2.createdAt.localeCompare(a.createdAt))[0];
        return v ? { id: v.id } : fail(404, 'ยังไม่มีคิววันนี้');
      }],

      ['POST', /^\/api\/register$/, (m, b) => {
        const name = String(b.name || '').trim();
        const phone = String(b.phone || '').replace(/\D/g, '');
        if (name.length < 2) fail(400, 'กรุณากรอกชื่อ');
        if (!/^0\d{8,9}$/.test(phone)) fail(400, 'เบอร์โทรศัพท์ไม่ถูกต้อง');
        const startedAt = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/.test(b.startedAt || '') ? b.startedAt : null;
        const v = createVisit({ name, phone, deptId: b.dept, symptoms: String(b.symptoms || '').slice(0, 300), startedAt });
        store.save();
        return visitView(v);
      }],
      ['POST', /^\/api\/visit\/([\w-]+)\/arrive$/, (m, b) => {
        const v = findVisit(m[1]);
        const st = db.stations.find(s => s.id === b.station) || fail(400, 'ไม่พบสถานที่');
        v.location = st.id;
        v.events.push({ at: now(), type: 'arrive', station: st.id });
        store.save();
        return visitView(v);
      }],
      ['POST', /^\/api\/visit\/([\w-]+)\/pickup$/, (m, b) => {
        const v = findVisit(m[1]);
        if (!v.medicines.length) fail(409, 'ยังไม่มีรายการยา');
        if (v.medPickup) fail(409, 'เลือกวิธีรับยาไปแล้ว');
        if (b.mode === 'delivery') {
          const address = String(b.address || '').trim();
          if (address.length < 10) fail(400, 'กรุณากรอกที่อยู่ให้ครบ');
          const p = db.patients.find(x => x.id === v.patientId);
          if (p) p.address = address;
          const n = db.visits.filter(x => x.medPickup && x.medPickup.trackingNo).length + 1;
          v.medPickup = { mode: 'delivery', status: 'ordered', address, partner: db.settings.deliveryPartner, trackingNo: `PP-26${String(n).padStart(4, '0')}`, at: now() };
        } else {
          v.medPickup = { mode: 'pickup', status: 'waiting', at: now() };
        }
        v.events.push({ at: now(), type: 'pickup', mode: v.medPickup.mode });
        store.save();
        return visitView(v);
      }],
      ['POST', /^\/api\/visit\/([\w-]+)\/feedback$/, (m, b) => {
        const v = findVisit(m[1]);
        const score = Number(b.score);
        if (!(score >= 1 && score <= 5)) fail(400, 'คะแนนต้องอยู่ระหว่าง 1-5');
        if (!db.journey.some(j => j.key === b.stage)) fail(400, 'ไม่พบขั้นตอน');
        v.feedback = (v.feedback || []).filter(f => f.stage !== b.stage);
        v.feedback.push({ stage: b.stage, score, comment: String(b.comment || '').trim().slice(0, 300), at: now() });
        store.save();
        return visitView(v);
      }],

      // ----- staff / facilitator -----
      ['GET', /^\/api\/staff\/visits$/, () => db.visits.map(visitView)],
      ['GET', /^\/api\/staff\/analytics$/, () => analytics()],
      ['POST', /^\/api\/staff\/call-next$/, (m, b) => { const v = callNext(b.dept); store.save(); return visitView(v); }],
      ['POST', /^\/api\/staff\/advance$/, (m, b) => {
        const v = findVisit(b.visitId);
        if (v.stage === 'vitals') { v.location = 'VIT'; setStage(v, 'waiting'); }
        else if (v.stage === 'waiting') callVisit(v);
        else if (v.stage === 'consult') fail(409, 'ต้องบันทึกผลตรวจก่อน');
        else if (v.stage === 'pharmacy') {
          const mp = v.medPickup;
          if (mp && mp.mode === 'delivery') {
            const steps = db.settings.deliverySteps.map(s => s.key);
            const i = steps.indexOf(mp.status);
            mp.status = steps[Math.min(i + 1, steps.length - 1)];
            v.events.push({ at: now(), type: 'delivery', status: mp.status });
            if (mp.status === 'delivered') setStage(v, 'done');
          } else {
            v.medPickup = { mode: 'pickup', status: 'picked', at: now() };
            v.location = 'PHA';
            setStage(v, 'done');
          }
        } else fail(409, 'ขั้นตอนนี้เสร็จสิ้นแล้ว');
        store.save();
        return visitView(v);
      }],
      ['POST', /^\/api\/staff\/diagnose$/, (m, b) => {
        const v = findVisit(b.visitId);
        if (v.stage !== 'consult') fail(409, 'ผู้ป่วยยังไม่ได้อยู่ในห้องตรวจ');
        const t = db.diagnosisTemplates.find(x => x.id === b.templateId) || fail(400, 'ไม่พบผลวินิจฉัยสำเร็จรูป');
        v.diagnosis = { templateId: t.id, name: t.diagnosis, explain: t.explain, doctor: b.doctor || 'แพทย์ผู้ตรวจ', at: now() };
        v.medicines = structuredClone(t.medicines);
        v.advice = [...t.advice];
        v.followUp = t.followUp;
        v.location = dept(v.dept).station;
        setStage(v, 'pharmacy');
        store.save();
        return visitView(v);
      }],
      ['POST', /^\/api\/staff\/demo-patients$/, (m, b) => {
        const n = Math.min(Number(b.count) || 3, 10);
        for (let i = 0; i < n; i++) {
          const d = db.departments[Math.floor(Math.random() * db.departments.length)];
          const name = FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)];
          const phone = '089' + String(Math.floor(Math.random() * 1e7)).padStart(7, '0');
          const v = createVisit({ name, phone, deptId: d.id, symptoms: 'ผู้ป่วยจำลอง' });
          v.location = 'VIT';
          setStage(v, 'waiting');
        }
        store.save();
        return board();
      }],
      ['POST', /^\/api\/staff\/reset$/, () => { db = store.db = store.seed(); store.save(); return { ok: true }; }],
    ];


    function handle(method, pathname, body = {}, params = new URLSearchParams()) {
      db = store.db;
      const route = routes.find(([m, re]) => m === method && re.test(pathname));
      if (!route) fail(404, 'ไม่พบ API');
      return route[2](pathname.match(route[1]), body, params);
    }

    return { handle };
  }

  return { createCore, rebaseSeed, fmt, now, fail };
});
