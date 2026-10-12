import test from 'node:test';
import assert from 'node:assert/strict';
import { D, memoryStore, fakeClock } from './helpers.mjs';
import { createCore, initialState } from '../../js/lib/core.js';
import { valueStream } from '../../js/lib/valuestream.js';

test('valueStream: ไม่มีผู้ป่วยในแอป = ค่าย้อนหลังตาม demo-patients.yaml', () => {
  const vs = valueStream(D, initialState(D));
  assert.equal(vs.liveN, 0);
  assert.equal(vs.lead, 72);
  assert.equal(vs.va, 24);
  assert.equal(vs.pce, 33);
  assert.equal(vs.nvaPct, 42);
  assert.equal(vs.rows.find(r => r.key === 'waiting').mood, 2.3);
});

test('valueStream: รวมเวลาจริงและความรู้สึกจากแอปแบบถ่วงน้ำหนัก ไม่มี NaN', () => {
  const clock = fakeClock();
  const store = memoryStore(D, initialState(D, clock()));
  const core = createCore(D, store, clock);
  const { id } = core.act('register', { dept: 'med', name: 'ทดสอบ หนึ่ง', phone: '0811111111' }).result;
  clock.add(5); core.act('vitalsDone', { id });
  clock.add(71); core.act('callVisit', { id }); // รอ 71 นาที
  core.act('feeling', { id, stage: 'waiting', score: 1, reasons: ['รอนาน'] });
  const vs = valueStream(D, store.get());
  const w = vs.rows.find(r => r.key === 'waiting');
  assert.equal(w.liveCount, 1);
  assert.equal(w.avg, Math.round((30 * 40 + 71) / 41 * 10) / 10);
  assert.equal(w.max, 71);
  assert.equal(w.mood, Math.round((2.3 * 40 + 1) / 41 * 10) / 10);
  assert.deepEqual(w.reasons, { รอนาน: 1 });
  assert.equal(vs.rows.find(r => r.key === 'consult').liveCount, 0, 'ขั้นที่ยังไม่จบไม่นับ');
  for (const r of vs.rows) assert.ok(Number.isFinite(r.avg) && Number.isFinite(r.max));
});
