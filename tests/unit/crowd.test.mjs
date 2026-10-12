import test from 'node:test';
import assert from 'node:assert/strict';
import { D } from './helpers.mjs';
import { crowdNow, simCD, levelOf, lvlRatio, capOf, bottleneck, staffKpi, cumArrivals, ZONE_KEYS } from '../../js/lib/crowd.js';
import { initialState } from '../../js/lib/core.js';

test('levelOf / lvlRatio', () => {
  assert.equal(levelOf(D, 7), 0);
  assert.equal(levelOf(D, 8), 1);
  assert.equal(levelOf(D, 17), 1);
  assert.equal(levelOf(D, 18), 2);
  assert.equal(lvlRatio(4, 10), 0);
  assert.equal(lvlRatio(5, 10), 1);
  assert.equal(lvlRatio(9, 10), 2);
  assert.equal(lvlRatio(3, 0), 0, 'ความจุ 0 ไม่หารด้วยศูนย์');
});

test('capOf: ความจุจากจำนวนเก้าอี้', () => {
  assert.ok(capOf(D, 'med') > capOf(D, 'reg'));
  assert.equal(capOf(D, 'wc'), 6);
  assert.equal(capOf(D, 'cafe'), 12);
});

test('crowdNow: แผนกของฉันมีคน = คิวก่อนหน้า + คนหลังฉัน และเวลารอตามคิว', () => {
  const s = initialState(D, new Date('2026-10-12T10:00:00+07:00'));
  const cd = crowdNow(D, s, { id: 'X', dept: 'med', ahead: 4, stage: 'waiting' });
  assert.equal(cd.med.n, 4 + D.floor.crowd.after_you);
  assert.equal(cd.med.w, 20);
  for (const k of ZONE_KEYS) assert.ok(Number.isFinite(cd[k].n) && Number.isFinite(cd[k].w), k);
});

test('crowdNow: นับผู้ป่วยในระบบเพิ่มจากคนพื้นฐาน', () => {
  const s = { visits: [{ id: 'a', stage: 'waiting', dept: 'eye' }, { id: 'b', stage: 'pharmacy', rx: 'self' }, { id: 'c', stage: 'pharmacy', rx: 'delivery' }] };
  const cd = crowdNow(D, s, null);
  assert.equal(cd.eye.n, D.floor.crowd.base_people.eye + 1);
  assert.equal(cd.pharm.n, D.floor.crowd.base_people.pharm + 1, 'ส่งยาถึงบ้านไม่ต้องรอที่ห้องยา');
});

test('simCD: คนเยอะช่วงเช้ามากกว่าตอนเปิด และวันหยุดคนน้อย', () => {
  const sum = cd => Object.values(cd).reduce((a, c) => a + c.n, 0);
  assert.ok(sum(simCD(D, 9 * 60 + 30, 0)) > sum(simCD(D, 7 * 60, 0)));
  assert.ok(sum(simCD(D, 9 * 60 + 30, 1)) < sum(simCD(D, 9 * 60 + 30, 0)));
  assert.ok(cumArrivals(960, 0) > cumArrivals(600, 0));
  assert.equal(cumArrivals(420, 0), 0);
});

test('bottleneck: เลือกจุดที่รอนานสุด และบอกว่าเป็นคอขวดเมื่อรอ ≥ 15 นาที', () => {
  const base = Object.fromEntries(ZONE_KEYS.map(k => [k, { n: 2, w: 3, cap: 10 }]));
  let b = bottleneck(D, base);
  assert.equal(b.isBottleneck, false);
  b = bottleneck(D, { ...base, pharm: { n: 30, w: 40, cap: 24 } });
  assert.equal(b.key, 'pharm');
  assert.equal(b.isBottleneck, true);
  assert.match(b.tip, /ส่งยาถึงบ้าน/);
});

test('staffKpi: ไม่มีคนรอ → เฉลี่ย 0 ไม่ใช่ NaN', () => {
  const cd = Object.fromEntries(ZONE_KEYS.map(k => [k, { n: 0, w: 0, cap: 10 }]));
  const k = staffKpi(D, cd, 0);
  assert.equal(k.avgWait, 0);
  assert.equal(k.density, 0);
  assert.equal(k.densityLevel, 0);
});
