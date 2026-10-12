import { expect } from '@playwright/test';

export const SERVER = 'http://localhost:5290';
export const STATIC = 'http://localhost:5291';

/** เก็บ error ใน console / หน้าเว็บ แล้วตรวจตอนจบว่าไม่มี */
export function watchConsole(page) {
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  return () => expect(errors, 'ไม่ควรมี error ใน console').toEqual([]);
}

export async function openPatient(ctx, base) {
  const p = await ctx.newPage();
  const check = watchConsole(p);
  await p.goto(base + '/');
  await expect(p.locator('body')).toHaveAttribute('data-ready', /server|local/);
  return { p, check };
}
export async function openStaff(ctx, base) {
  const s = await ctx.newPage();
  const check = watchConsole(s);
  await s.goto(base + '/staff.html');
  await expect(s.locator('body')).toHaveAttribute('data-ready', /server|local/);
  return { s, check };
}

/** แผ่นแจ้งเตือนที่เด้งขึ้น: ตรวจหัวข้อ แล้วกดปุ่มตามข้อความ */
export async function sheet(p, title, button) {
  const sh = p.locator('#sheet.on');
  await expect(sh).toBeVisible();
  await expect(sh.locator('h2')).toContainText(title);
  await sh.getByRole('button', { name: button }).click();
  await expect(p.locator('#sheet.on')).toHaveCount(0);
}

export const act = (p, name, arg) => (arg === undefined ? p.locator(`[data-act="${name}"]`) : p.locator(`[data-act="${name}"][data-arg="${arg}"]`)).first().click();

/** แถวในตารางผู้ป่วยของหน้า staff */
export const row = (s, queue) => s.locator('#patients tr', { has: s.locator('td.q', { hasText: queue }) });

export async function register(p, { dept = 'med', name, phone, sym } = {}) {
  await act(p, 'startReg');
  await act(p, 'pickDept', dept);
  await act(p, 'regNext');
  if (name) await p.fill('#nm', name);
  await act(p, 'regNext');
  if (phone) await p.fill('#ph', phone);
  await act(p, 'regNext');
  if (sym) await act(p, 'toggleSym', sym);
  await act(p, 'submitReg');
  await expect(p.locator('.ticket')).toBeVisible();
}

export async function noNaN(p) {
  await expect(p.locator('body')).not.toContainText(/NaN|undefined|Infinity/);
}

/** ไม่มี scroll แนวนอน */
export async function noHorizontalOverflow(p) {
  const over = await p.evaluate(() => {
    const out = [];
    const sc = document.querySelector('.scroll');
    const de = document.documentElement;
    if (de.scrollWidth > de.clientWidth + 1 || innerWidth > de.clientWidth + 1) out.push('page ' + de.scrollWidth + '/' + innerWidth + '>' + de.clientWidth);
    if (sc && sc.scrollWidth > sc.clientWidth + 1) out.push('scroll ' + sc.scrollWidth + '>' + sc.clientWidth);
    return out;
  });
  expect(over).toEqual([]);
}
