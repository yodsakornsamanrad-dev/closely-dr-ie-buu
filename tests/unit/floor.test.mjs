import test from 'node:test';
import assert from 'node:assert/strict';
import { D } from './helpers.mjs';
import { place, route, stepsOf, walkTime, walkMinutes, turnDir } from '../../js/lib/floor.js';

test('place: จุดของแผนกใช้ชื่อแผนกและห้องตรวจ', () => {
  const p = place(D, 'front', 'ortho');
  assert.equal(p.name, 'หน้าห้องตรวจกระดูกและข้อ');
  assert.deepEqual(p.pt, [179, 128]);
  assert.equal(p.hl, 'ortho');
  assert.equal(place(D, 'exam', 'med').name, 'ห้องตรวจ 3 อายุรกรรม');
  assert.throws(() => place(D, 'nowhere'));
});

test('route: จุดเดียวกัน ระยะ 0', () => {
  const r = route(D, 'reg', 'reg', 'med');
  assert.equal(r.same, true);
  assert.equal(r.m, 0);
});

test('route: ลงทะเบียน → คัดกรอง ผ่านทางเดินหลัก ระยะถูกต้อง', () => {
  const r = route(D, 'reg', 'screen', 'med');
  // (40,160) → (40,135) → (111,135) → (111,160) = 25 + 71 + 25 = 121 หน่วย × 0.15
  assert.deepEqual(r.pts, [[40, 160], [40, 135], [111, 135], [111, 160]]);
  assert.equal(r.m, Math.round(121 * 0.15));
});

test('route: ตัดจุดที่อยู่แนวเดียวกันออก', () => {
  const r = route(D, 'entrance', 'front', 'med');
  for (let i = 1; i < r.pts.length - 1; i++) {
    const [a, b, c] = [r.pts[i - 1], r.pts[i], r.pts[i + 1]];
    assert.notEqual((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]), 0, 'ทุกจุดกลางต้องเป็นจุดเลี้ยว');
  }
  assert.deepEqual(r.pts[0], [168, 292]);
  assert.deepEqual(r.pts[r.pts.length - 1], [63, 128]);
});

test('route: ระยะไป-กลับเท่ากัน และไม่ต่ำกว่า 1 เมตร', () => {
  for (const a of Object.keys(D.floor.places)) for (const b of Object.keys(D.floor.places)) {
    const r1 = route(D, a, b, 'eye'), r2 = route(D, b, a, 'eye');
    assert.equal(r1.m, r2.m, `${a}→${b}`);
    if (a !== b) assert.ok(r1.m >= 1);
  }
});

test('turnDir: ซ้าย/ขวาตามทิศที่หันหน้า (แกน y ชี้ลง)', () => {
  const up = { dx: 0, dy: -1 }, right = { dx: 1, dy: 0 }, left = { dx: -1, dy: 0 }, down = { dx: 0, dy: 1 };
  assert.equal(turnDir(up, right), 'เลี้ยวขวา');
  assert.equal(turnDir(up, left), 'เลี้ยวซ้าย');
  assert.equal(turnDir(right, down), 'เลี้ยวขวา');
  assert.equal(turnDir(right, up), 'เลี้ยวซ้าย');
  assert.equal(turnDir(down, right), 'เลี้ยวซ้าย');
});

test('stepsOf: ลงทะเบียน → คัดกรอง = ออกมาทางเดิน, เลี้ยวขวา, เลี้ยวขวาถึงที่หมาย, จุดสังเกต', () => {
  const st = stepsOf(D, route(D, 'reg', 'screen', 'med'));
  assert.equal(st.length, 4);
  assert.match(st[0], /^ออกจากจุดลงทะเบียน/);
  assert.match(st[1], /^เลี้ยวขวา แล้วเดินตรงไป 11 เมตร$/);
  assert.match(st[2], /^เลี้ยวขวา จุดคัดกรองอยู่ตรงหน้า$/);
  assert.match(st[3], /^จุดสังเกต: /);
});

test('stepsOf: ทางเข้า → หน้าห้องอายุรกรรม เลี้ยวซ้ายไปทางตะวันตก', () => {
  const st = stepsOf(D, route(D, 'entrance', 'front', 'med'));
  assert.match(st[0], /^ออกจากทางเข้า-ออก เดินตรงไป 24 เมตร$/);
  assert.match(st[1], /^เลี้ยวซ้าย/);
  assert.match(st[2], /^เลี้ยวขวา หน้าห้องตรวจอายุรกรรมอยู่ตรงหน้า$/);
});

test('walkTime: ใช้ความเร็ว 0.7 ม./วินาที', () => {
  assert.equal(walkTime(D, 20), 'ไม่ถึง 1');   // 28.6 วินาที
  assert.equal(walkTime(D, 42), '1');          // 60 วินาที
  assert.equal(walkTime(D, 43), '2');          // 61.4 วินาที → ปัดขึ้น
  assert.equal(walkMinutes(D, 0), 0);
  assert.equal(walkMinutes(D, undefined), 0);
  assert.ok(Math.abs(walkMinutes(D, 42) - 1) < 1e-9);
});
