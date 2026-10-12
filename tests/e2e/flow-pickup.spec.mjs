// flow รับยาเองที่ห้องยา (โหมด server: ไฟ Live, ทุกหน้าจอเห็นคิวเดียวกัน) + ค้นหาคิวด้วยเบอร์โทร
import { test, expect } from '@playwright/test';
import { SERVER, STATIC, openPatient, openStaff, sheet, act, row, register, noNaN } from './helpers.mjs';

test.beforeEach(async ({ request }) => {
  await request.post(SERVER + '/api/act', { data: { type: 'reset', payload: {} } });
});

test('รับยาเองที่ห้องยา โหมด server', async ({ browser }) => {
  const pc = await browser.newContext(), sc = await browser.newContext(); // คนละเครื่อง
  const { p, check: checkP } = await openPatient(pc, SERVER);
  const { s, check: checkS } = await openStaff(sc, SERVER);
  await expect(p.locator('.lg-card')).toBeVisible();

  await act(p, 'guest');
  await expect(p.locator('.conn')).toContainText('Live');
  await register(p, { dept: 'eye', name: 'มาลี ทดสอบ', phone: '0899990000', sym: 'ตาแห้ง' });
  await expect(p.locator('.qno')).toHaveText('C004');
  await act(p, 'feelSkip');

  await row(s, 'C004').locator('[data-act="vitalsDone"]').click();
  await sheet(p, 'คัดกรองเสร็จแล้ว', 'รับทราบ');
  await row(s, 'C004').locator('[data-act="callVisit"]').click();
  await sheet(p, 'ถึงคิวคุณแล้ว C004', 'รับทราบ');
  await row(s, 'C004').locator('select').selectOption('DRY');
  await row(s, 'C004').locator('[data-act="saveResult"]').click();
  await sheet(p, 'พบแพทย์เสร็จแล้ว', 'รับทราบ');

  await act(p, 'rxSelf');
  await expect(p.locator('.ticket')).toContainText('รับยาที่การเงิน');
  await act(p, 'goNav');
  await expect(p.locator('.from b')).toContainText('การเงิน & ห้องยา');
  await act(p, 'arrive', 'pharm');

  await row(s, 'C004').locator('[data-act="dispensed"]').click();
  await sheet(p, 'เสร็จที่โรงพยาบาลแล้ว', 'ไว้ทีหลัง');
  await expect(p.locator('.ticket')).toContainText('ขั้นสุดท้าย');

  // เดินไปทางออก → ถึงแล้ว → ยืนยันกลับบ้าน
  await act(p, 'goNav');
  await act(p, 'arrive', 'entrance');
  await sheet(p, 'ถึงทางออกแล้ว', 'กลับบ้านแล้ว');
  await expect(p.locator('.ticket.t-done')).toContainText('จบการตรวจวันนี้แล้ว');
  await noNaN(p);
  await act(p, 'tab', 'care');
  await expect(p.locator('.ticket')).toContainText('รอหมอส่งแบบประเมิน');

  // ข้อมูลอยู่ใน server: เครื่องอื่นค้นหาคิวด้วยเบอร์โทรได้
  const other = await browser.newContext();
  const { p: p2, check: check2 } = await openPatient(other, SERVER);
  await act(p2, 'guest');
  await act(p2, 'lookupOpen');
  await p2.fill('#lk', '089 999 0000');
  await act(p2, 'lookup');
  await expect(p2.locator('.qno')).toHaveCount(0);
  await expect(p2.locator('.ticket')).toContainText('จบการตรวจวันนี้');

  checkP(); checkS(); check2();
  await pc.close(); await sc.close(); await other.close();
});

test('โหมดสาธิตในแอปผู้ป่วย: กดแทนเจ้าหน้าที่บนเครื่องเดียว (GitHub Pages)', async ({ context }) => {
  const { p, check } = await openPatient(context, STATIC);
  await act(p, 'guest');
  await register(p, { dept: 'unsure', name: 'ไม่แน่ใจ แผนก', phone: '0811112222' });
  await expect(p.locator('.qno')).toHaveText('A013');
  await act(p, 'feelSkip');
  await act(p, 'demoPanel');
  await p.locator('#sheet.on').getByRole('button', { name: 'คัดกรองเสร็จ' }).click();
  await sheet(p, 'คัดกรองเสร็จแล้ว', 'รับทราบ');
  await act(p, 'demoPanel');
  await p.locator('#sheet.on').getByRole('button', { name: 'เรียกคิวนี้เลย' }).click();
  await sheet(p, 'ถึงคิวคุณแล้ว', 'รับทราบ');
  await expect(p.locator('.ticket.t-go')).toBeVisible();
  check();
});

test('ค้นหาคิวด้วยเบอร์ที่ไม่มี → แจ้งว่าไม่พบ', async ({ context }) => {
  const { p, check } = await openPatient(context, STATIC);
  await act(p, 'guest');
  await act(p, 'lookupOpen');
  await expect(p.locator('[data-act="lookup"]')).toBeDisabled();
  await p.fill('#lk', '0800000000');
  await act(p, 'lookup');
  await expect(p.locator('#toast')).toContainText('ไม่พบคิว');
  check();
});
