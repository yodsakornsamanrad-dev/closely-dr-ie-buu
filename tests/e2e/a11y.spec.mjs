// accessibility: axe ทุกหน้าจอหลัก, ใช้คีย์บอร์ดได้, ตัวอักษร 3 ระดับไม่ล้น, reduced motion ไม่มี animation, ธีมมืด, จำธีม/ขนาดตัวอักษร
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { STATIC, openPatient, openStaff, sheet, act, register, noHorizontalOverflow } from './helpers.mjs';

async function axe(page, name) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const bad = r.violations.filter(v => ['serious', 'critical'].includes(v.impact))
    .map(v => `${name}: ${v.id} (${v.impact}) ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')}`);
  expect(bad, `axe ${name}`).toEqual([]);
}

/** พาไปถึงหน้าจอรอคิว */
async function toWaiting(p, s) {
  await act(p, 'guest');
  await register(p, { dept: 'med', name: 'ทดสอบ เข้าถึง', phone: '0812345000' });
  await act(p, 'feelSkip');
  await s.locator('#patients tr', { hasText: 'A013' }).locator('[data-act="vitalsDone"]').click();
  await sheet(p, 'คัดกรองเสร็จแล้ว', 'รับทราบ');
  await act(p, 'feelSkip');
}

test('axe: แอปผู้ป่วยทุกหน้าจอหลัก', async ({ context }) => {
  const { p } = await openPatient(context, STATIC);
  const { s } = await openStaff(context, STATIC);
  await p.bringToFront();
  await axe(p, 'login');
  await act(p, 'guest');
  await axe(p, 'home');
  await act(p, 'startReg');
  await axe(p, 'reg');
  await act(p, 'regBack');
  await register(p, { dept: 'med', name: 'ทดสอบ เข้าถึง', phone: '0812345000' });
  await axe(p, 'now-vitals+feel');
  await act(p, 'feelSkip');
  await s.locator('#patients tr', { hasText: 'A013' }).locator('[data-act="vitalsDone"]').click();
  await expect(p.locator('#sheet.on')).toBeVisible();
  await axe(p, 'sheet');
  await sheet(p, 'คัดกรองเสร็จแล้ว', 'รับทราบ');
  await act(p, 'feelSkip');
  await axe(p, 'now-waiting');
  await act(p, 'tab', 'nav');
  await axe(p, 'nav-2d');
  await act(p, 'mapMode', '3d');
  await axe(p, 'nav-3d');
  await act(p, 'tab', 'results');
  await axe(p, 'results-empty');
  await s.locator('#patients tr', { hasText: 'A013' }).locator('[data-act="callVisit"]').click();
  await sheet(p, 'ถึงคิว', 'รับทราบ');
  await s.locator('#patients tr', { hasText: 'A013' }).locator('[data-act="saveResult"]').click();
  await sheet(p, 'พบแพทย์', 'รับทราบ');
  await act(p, 'tab', 'results');
  await axe(p, 'results');
  await act(p, 'tab', 'care');
  await axe(p, 'care');
  await act(p, 'careView', 'chat');
  await axe(p, 'chat');
});

test('axe: หน้า staff + replay + แชร์ลิงก์', async ({ context }) => {
  const { s } = await openStaff(context, STATIC);
  await axe(s, 'staff');
  await noHorizontalOverflow(s);
  await s.locator('[data-act="stMode"][data-arg="replay"]').click();
  await axe(s, 'staff-replay');
  await s.locator('[data-act="share"]').click();
  await expect(s.locator('#shareDlg svg')).toBeVisible();
  await axe(s, 'staff-share');
});

test('คีย์บอร์ด: เข้าสู่ระบบและลงทะเบียนได้โดยไม่ใช้เมาส์', async ({ context }) => {
  const { p } = await openPatient(context, STATIC);
  // บนคอมมีลิงก์หน้า staff ในแผงข้างก่อน → กด Tab จนถึงช่องชื่อ
  for (let i = 0; i < 15 && !(await p.locator('#lgName').evaluate(e => e === document.activeElement)); i++) await p.keyboard.press('Tab');
  await expect(p.locator('#lgName')).toBeFocused();
  await p.keyboard.type('สมชาย');
  await p.keyboard.press('Enter');
  await expect(p.locator('.hi')).toBeVisible();
  // แท็บไปปุ่ม "รับคิว" แล้วกด Enter
  for (let i = 0; i < 12 && !(await p.locator('[data-act="startReg"]').evaluate(e => e === document.activeElement)); i++) await p.keyboard.press('Tab');
  await expect(p.locator('[data-act="startReg"]')).toBeFocused();
  await p.keyboard.press('Enter');
  await expect(p.locator('#qh')).toHaveText('มาตรวจแผนกไหน');
  // ทุกปุ่มที่มองเห็นต้องมีชื่อ และมีกรอบ focus
  await p.locator('[data-act="pickDept"][data-arg="ortho"]').focus();
  await p.keyboard.press('Enter');
  await expect(p.locator('[data-act="pickDept"][data-arg="ortho"]')).toHaveAttribute('aria-checked', 'true');
  const outline = await p.locator('[data-act="pickDept"][data-arg="ortho"]').evaluate(e => getComputedStyle(e).outlineStyle);
  expect(outline).not.toBe('none');
});

test('ตัวอักษร 3 ระดับ: ไม่ล้นจอ และจำค่าไว้หลังรีโหลด', async ({ context }) => {
  const { p } = await openPatient(context, STATIC);
  const { s } = await openStaff(context, STATIC);
  await p.bringToFront();
  await toWaiting(p, s);
  const sizes = [];
  for (let i = 0; i < 3; i++) {
    await act(p, 'fs');
    sizes.push(await p.evaluate(() => getComputedStyle(document.documentElement).fontSize));
    for (const tab of ['now', 'nav', 'results', 'care']) { await act(p, 'tab', tab); await noHorizontalOverflow(p); }
  }
  expect(new Set(sizes)).toEqual(new Set(['12px', '14px', '16px']));
  // เลือกธีมกรมท่า + ขนาด 16px แล้วรีโหลด
  while (await p.evaluate(() => getComputedStyle(document.documentElement).fontSize) !== '16px') await act(p, 'fs');
  await act(p, 'themeSheet');
  await p.locator('#sheet.on').getByRole('button', { name: 'กรมท่า' }).click();
  await p.reload();
  await expect(p.locator('body')).toHaveAttribute('data-ready', 'local');
  await expect(p.locator('html')).toHaveAttribute('data-chrome', 'navy');
  expect(await p.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('16px');
  await expect(p.locator('.qno')).toHaveText('A013'); // คิวยังอยู่หลังรีโหลด
});

test('reduced motion: ไม่มี animation', async ({ context }) => {
  const { p } = await openPatient(context, STATIC);
  const { s } = await openStaff(context, STATIC);
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.bringToFront();
  await toWaiting(p, s);
  await act(p, 'tab', 'nav');
  await act(p, 'mapMode', '3d');
  await act(p, 'tab', 'care');
  const running = await p.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length);
  expect(running).toBe(0);
  expect(await p.locator('.cbar').evaluate(e => getComputedStyle(e).transitionDuration)).toBe('0s');
});

test('ธีมมืด: สีพื้นเปลี่ยน และผ่าน axe', async ({ context }) => {
  const { p } = await openPatient(context, STATIC);
  const { s } = await openStaff(context, STATIC);
  await p.emulateMedia({ colorScheme: 'dark' });
  await p.bringToFront();
  await toWaiting(p, s);
  const bg = await p.locator('.app').evaluate(e => getComputedStyle(e).backgroundColor);
  expect(bg).toBe('rgb(11, 17, 28)');
  await axe(p, 'dark-now');
  await act(p, 'tab', 'nav');
  await axe(p, 'dark-nav');
  await s.locator('#patients tr', { hasText: 'A013' }).locator('[data-act="callVisit"]').click();
  await sheet(p, 'ถึงคิว', 'รับทราบ');
  await act(p, 'tab', 'now');
  await expect(p.locator('.ticket.t-go')).toBeVisible();
  await axe(p, 'dark-consult');
  await s.locator('#patients tr', { hasText: 'A013' }).locator('[data-act="saveResult"]').click();
  await sheet(p, 'พบแพทย์', 'รับทราบ');
  await expect(p.locator('.ticket.t-act')).toBeVisible();
  await axe(p, 'dark-rx-choice');
});
