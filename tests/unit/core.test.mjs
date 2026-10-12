import test from 'node:test';
import assert from 'node:assert/strict';
import { D, memoryStore, fakeClock } from './helpers.mjs';
import { createCore, initialState, CoreError, SCHEMA } from '../../js/lib/core.js';
import { buildUsageLog, usageLogYaml, parseImport } from '../../js/lib/usage-log.js';
import { aheadOf } from '../../js/lib/queue.js';

function setup() {
  const clock = fakeClock();
  const store = memoryStore(D, initialState(D, clock()));
  const core = createCore(D, store, clock);
  const visit = id => store.get().visits.find(v => v.id === id);
  return { clock, store, core, visit };
}

test('initialState: ผู้ป่วยจำลองครบ คิวตรงกับ departments.yaml', () => {
  const s = initialState(D, new Date('2026-10-12T10:00:00+07:00'));
  assert.equal(s.schema, SCHEMA);
  assert.equal(s.visits.length, D.demo.patients.length);
  assert.equal(s.queues.med.calling, 9);
  assert.equal(s.queues.med.last_issued, 12);
  assert.ok(s.visits.every(v => v.demo));
  assert.equal(s.visits.find(v => v.queue === 'A009').stage, 'consult');
});

test('flow ส่งยาถึงบ้าน: ลงทะเบียน → คัดกรอง → เรียกคิว → ผลตรวจ → ส่งยา → กลับบ้าน → แบบประเมิน → หมอตัดสิน', () => {
  const { clock, core, store, visit } = setup();
  const { result } = core.act('register', { dept: 'med', name: 'สมชาย ใจดี', phone: '081 234 5678', symptoms: ['ไอ'] });
  const v0 = visit(result.id);
  assert.equal(v0.queue, 'A013');
  assert.equal(v0.stage, 'vitals');
  assert.equal(aheadOf(v0.qn, store.get().queues.med.calling), 4);

  clock.add(3); core.act('arrive', { id: v0.id, place: 'screen' });
  assert.equal(visit(v0.id).arrived, true);
  clock.add(5); core.act('vitalsDone', { id: v0.id });
  assert.equal(visit(v0.id).stage, 'waiting');

  // เรียกคิวถัดไป 3 ครั้ง (A010–A012) ยังไม่ถึง, ครั้งที่ 4 ถึง A013
  for (let i = 0; i < 3; i++) { clock.add(4); core.act('callNext', { dept: 'med' }); }
  assert.equal(visit(v0.id).stage, 'waiting');
  const r = core.act('callNext', { dept: 'med' }).result;
  assert.equal(r.called, 'A013');
  assert.equal(visit(v0.id).stage, 'consult');

  clock.add(9); core.act('saveResult', { id: v0.id, template: 'HT' });
  assert.equal(visit(v0.id).stage, 'pharmacy');
  assert.equal(visit(v0.id).chat.length, 1, 'หมอทักทายในแชท');

  assert.throws(() => core.act('rxDelivery', { id: v0.id, addr: '' }), CoreError);
  core.act('rxDelivery', { id: v0.id, addr: D.app.default_address });
  assert.equal(visit(v0.id).stage, 'done');
  for (let i = 0; i < 4; i++) core.act('advDeliv', { id: v0.id });
  assert.equal(visit(v0.id).deliv, 4);
  assert.equal(visit(v0.id).care.phase, 'waitq');
  assert.throws(() => core.act('advDeliv', { id: v0.id }), CoreError);

  core.act('checkout', { id: v0.id });
  assert.ok(visit(v0.id).left_at);

  core.act('docSendQ', { id: v0.id });
  assert.throws(() => core.act('quizSend', { id: v0.id, ans: { bp: 'ผิด' } }), /ไม่ถูกต้อง/);
  core.act('quizSend', { id: v0.id, ans: { bp: '140–159', head: 'นาน ๆ ครั้ง', note: '' } });
  assert.equal(visit(v0.id).care.phase, 'review');
  core.act('docRefill', { id: v0.id });
  for (let i = 0; i < 4; i++) core.act('advRefill', { id: v0.id });
  assert.equal(visit(v0.id).care.round, 2);
  assert.equal(visit(v0.id).care.phase, 'waitq');
});

test('flow รับยาเองที่ห้องยา', () => {
  const { core, visit } = setup();
  const id = core.act('register', { dept: 'eye', name: 'มาลี ดี', phone: '0899999999' }).result.id;
  core.act('vitalsDone', { id });
  core.act('callVisit', { id });
  core.act('saveResult', { id });
  assert.equal(visit(id).result.id, 'DRY', 'ใช้ผลสำเร็จรูปของแผนกเมื่อไม่ได้เลือก');
  core.act('rxSelf', { id });
  assert.throws(() => core.act('checkout', { id }), /ยังมีขั้นตอน/);
  core.act('dispensed', { id });
  assert.equal(visit(id).stage, 'done');
  assert.equal(visit(id).care.phase, 'waitq');
  core.act('checkout', { id });
  core.act('feeling', { id, stage: 'visit', score: 2, reasons: ['รอนาน', 'ไม่มีในรายการ'] });
  assert.deepEqual(visit(id).feelings[0].reasons, ['รอนาน']);
});

test('register: ไม่แน่ใจแผนก → ออกคิวอายุรกรรม แต่จำว่าเลือก "ไม่แน่ใจ"', () => {
  const { core, visit } = setup();
  const id = core.act('register', { dept: 'unsure', name: 'ทดสอบ ระบบ', phone: '0812223333' }).result.id;
  assert.equal(visit(id).dept, 'med');
  assert.equal(visit(id).dept_chosen, 'unsure');
  assert.throws(() => core.act('register', { dept: 'med', name: 'ก', phone: '0812223333' }), /ชื่อ/);
  assert.throws(() => core.act('register', { dept: 'med', name: 'กข คง', phone: '12' }), /เบอร์/);
});

test('callNext: ไม่มีคิวรอ → แจ้ง 409', () => {
  const { core } = setup();
  core.act('callNext', { dept: 'eye' }); core.act('callNext', { dept: 'eye' });
  assert.throws(() => core.act('callNext', { dept: 'eye' }), e => e.status === 409);
});

test('lookup: หาคิวล่าสุดจากเบอร์โทร', () => {
  const { core } = setup();
  const id = core.act('register', { dept: 'med', name: 'คนที่ หนึ่ง', phone: '0811111111' }).result.id;
  assert.equal(core.act('lookup', { phone: '081-111-1111' }).result.id, id);
  assert.throws(() => core.act('lookup', { phone: '0800000000' }), e => e.status === 404);
});

test('chatSend: หมอตอบตามคำในข้อความ ตั้งเวลาไว้หลังข้อความผู้ป่วย', () => {
  const { core, visit } = setup();
  const id = core.act('register', { dept: 'med', name: 'คนที่ สอง', phone: '0822222222' }).result.id;
  core.act('chatSend', { id, text: 'ลืมกินยา 1 มื้อ ทำอย่างไรดี' });
  const [me, doc] = visit(id).chat;
  assert.equal(me.from, 'me');
  assert.match(doc.t, /ห้ามกินเบิ้ล/);
  assert.ok(Date.parse(doc.at) > Date.parse(me.at));
});

test('state ที่ store เก็บไม่ถูกแก้ถ้า action ผิดพลาด', () => {
  const { core, store } = setup();
  const before = JSON.stringify(store.get());
  assert.throws(() => core.act('saveResult', { id: 'V0001' }));
  assert.equal(JSON.stringify(store.get()), before);
});

test('reset / import', () => {
  const { core, store } = setup();
  core.act('addMock');
  assert.equal(store.get().visits.length, D.demo.patients.length + 3);
  core.act('reset');
  assert.equal(store.get().visits.length, D.demo.patients.length);
  assert.throws(() => core.act('import', { state: { hello: 1 } }), /schema/);
});

test('usage log: รูปแบบตามที่ตกลง และแปลง YAML ไป-กลับได้ครบ', () => {
  const { core, store, clock } = setup();
  const id = core.act('register', { dept: 'ortho', name: 'ทดสอบ ยาม', phone: '0833333333', symptoms: ['ปวดเข่า'] }).result.id;
  clock.add(2); core.act('feeling', { id, stage: 'register', score: 2, reasons: ['รอนาน'] });
  core.act('vitalsDone', { id });
  const log = buildUsageLog(D, store.get(), { mode: 'no-server', now: clock() });
  assert.equal(log.mode, 'no-server');
  assert.match(log.exported_at, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/);
  assert.equal(log.sessions.length, 1, 'ไม่รวมผู้ป่วยจำลอง');
  const s = log.sessions[0];
  assert.match(s.session_id, /^s-20261012-\d{4}$/);
  assert.equal(s.queue, 'B007');
  assert.equal(s.department, 'ortho');
  assert.deepEqual(s.events.filter(e => e.stage).map(e => e.stage), ['register', 'vitals', 'waiting']);
  assert.deepEqual(s.feelings, [{ stage: 'register', score: 2, reasons: ['รอนาน'] }]);
  assert.ok('quiz_answers' in s.care && 'decision' in s.care);

  const text = usageLogYaml(D, store.get(), { mode: 'server', now: clock() });
  assert.match(text, /^# Closely DR/);
  assert.match(text, /mode: server/);
  const back = parseImport(text);
  assert.deepEqual(back, JSON.parse(JSON.stringify(store.get())), 'state ไป-กลับต้องเหมือนเดิม');
  assert.throws(() => parseImport('a: [1, 2'), /อ่านไฟล์ YAML ไม่ได้/);
  assert.throws(() => parseImport('x: 1'), /schema/);
});
