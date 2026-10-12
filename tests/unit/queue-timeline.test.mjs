import test from 'node:test';
import assert from 'node:assert/strict';
import { D } from './helpers.mjs';
import { aheadOf, zoneOf, queueAlert, aheadText, waitMinutes, waitText, queueLabel } from '../../js/lib/queue.js';
import { flowRows, totalMinutes, stageMinutes, fmtMin } from '../../js/lib/timeline.js';

const A = D.app.alerts;

test('queueLabel / aheadOf', () => {
  assert.equal(queueLabel(D.depts.med, 13), 'A013');
  assert.equal(aheadOf(13, 9), 4);
  assert.equal(aheadOf(13, 20), 0);
  assert.equal(aheadOf(undefined, 9), 0);
});

test('zoneOf: 3 โซน ตามเกณฑ์ 10 / 2 คิว', () => {
  assert.equal(zoneOf(25, A), 0);
  assert.equal(zoneOf(11, A), 0);
  assert.equal(zoneOf(10, A), 1);
  assert.equal(zoneOf(3, A), 1);
  assert.equal(zoneOf(2, A), 2);
  assert.equal(zoneOf(0, A), 2);
});

test('queueAlert: แจ้งเตือนเมื่อข้ามเกณฑ์ 10 และ 2 คิว ครั้งเดียว', () => {
  assert.equal(queueAlert(11, 10, A), 'back');
  assert.equal(queueAlert(10, 9, A), null);
  assert.equal(queueAlert(3, 2, A), 'ready');
  assert.equal(queueAlert(2, 1, A), null);
  assert.equal(queueAlert(25, 1, A), 'ready', 'ข้ามสองเกณฑ์ → แจ้งอันที่ใกล้กว่า');
  assert.equal(queueAlert(4, 0, A), null, 'ถึงคิวแล้วใช้การแจ้งเตือน "ถึงคิว" แทน');
  assert.equal(queueAlert(null, 2, A), null, 'เปิดแอปครั้งแรกไม่แจ้ง');
  assert.equal(queueAlert(2, 5, A), null, 'คิวถอยหลังไม่แจ้ง');
});

test('ข้อความรอ', () => {
  assert.equal(aheadText(1), 'คิวถัดไปคือคุณ');
  assert.equal(aheadText(4), 'รออีก 4 คิว');
  assert.equal(waitMinutes(4, 5), 20);
  assert.equal(waitMinutes(-3, 5), 0);
  assert.match(waitText(75), /^1 <small>ชม.<\/small> 15/);
});

const at = (m) => new Date(Date.parse('2026-10-12T08:00:00+07:00') + m * 60000).toISOString();
const visit = (stage, evs, extra = {}) => ({ dept: 'med', stage, events: evs.map(([s, m]) => ({ stage: s, at: at(m) })), ...extra });

test('timeline: เวลาแต่ละขั้นจาก events และขั้นปัจจุบันนับถึงตอนนี้', () => {
  const v = visit('waiting', [['register', 0], ['vitals', 3], ['waiting', 10]]);
  const now = new Date(at(31));
  assert.equal(stageMinutes(v, D.stages, 'register', now), 3);
  assert.equal(stageMinutes(v, D.stages, 'vitals', now), 7);
  assert.equal(stageMinutes(v, D.stages, 'waiting', now), 21);
  assert.equal(stageMinutes(v, D.stages, 'consult', now), 0);
  assert.equal(totalMinutes(v, now), 31);
  const rows = flowRows(D, v, now).filter(r => r.kind === 'stage');
  assert.deepEqual(rows.map(r => r.status), ['ok', 'ok', 'now', 'next', 'next', 'next']);
});

test('timeline: จบทุกขั้นแล้วไม่มี NaN', () => {
  const v = visit('done', [['register', 0], ['vitals', 3], ['waiting', 10], ['consult', 31], ['pharmacy', 40], ['done', 45]], { left_at: at(50) });
  const now = new Date(at(500));
  const rows = flowRows(D, v, now);
  for (const r of rows) {
    if (r.kind === 'walk') assert.ok(Number.isFinite(r.m));
    else if (r.minutes !== null) assert.ok(Number.isFinite(r.minutes), r.key);
  }
  assert.deepEqual(rows.filter(r => r.kind === 'stage').map(r => r.status), ['ok', 'ok', 'ok', 'ok', 'ok', 'ok']);
  assert.equal(totalMinutes(v, now), 50, 'หยุดนับเมื่อกดกลับบ้าน');
  assert.equal(stageMinutes(v, D.stages, 'done', now), 5);
});

test('timeline: ข้อมูลเวลาเสีย / ไม่มี events → 0 ไม่ใช่ NaN', () => {
  assert.equal(totalMinutes({ events: [] }), 0);
  assert.equal(totalMinutes({ events: [{ stage: 'register', at: 'bad' }] }), 0);
  const v = { dept: 'med', stage: 'vitals', events: [{ stage: 'register', at: 'oops' }, { stage: 'vitals', at: undefined }] };
  for (const r of flowRows(D, v)) if (r.kind === 'stage' && r.minutes !== null) assert.ok(Number.isFinite(r.minutes));
  assert.equal(fmtMin(NaN), 'ไม่ถึง 1');
  assert.equal(fmtMin(0.4), 'ไม่ถึง 1');
  assert.equal(fmtMin(7.6), '8');
});
