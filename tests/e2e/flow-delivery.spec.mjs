// flow หลัก (โหมดไม่มี server แบบ GitHub Pages: แอปผู้ป่วย + หน้า staff เป็น 2 แท็บในเบราว์เซอร์เดียวกัน)
// ล็อกอิน → รับคิว → คัดกรอง → รอคิว (staff เรียก) → พบแพทย์ → ส่งยาถึงบ้าน → กลับบ้าน → แบบประเมิน → หมอตัดสิน → แชท → ลงชื่อออก
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { STATIC, openPatient, openStaff, sheet, act, row, register, noNaN, noHorizontalOverflow } from './helpers.mjs';

test('ส่งยาถึงบ้าน: ครบทุกขั้นตั้งแต่ล็อกอินถึงลงชื่อออก + YAML', async ({ context }) => {
  const { p, check: checkP } = await openPatient(context, STATIC);
  const { s, check: checkS } = await openStaff(context, STATIC);
  await p.bringToFront();

  // ล็อกอิน: พิมพ์ชื่อ → "พบบัญชีของคุณ"
  await p.fill('#lgName', 'สมชาย');
  await expect(p.locator('#lgMatch')).toContainText('พบบัญชีของคุณ');
  await act(p, 'lgSubmit');
  await expect(p.locator('.hi')).toContainText('สมชาย ใจดี');
  await expect(p.locator('.conn')).toContainText('ในเครื่อง');

  // รับคิว 4 ขั้น (ชื่อและเบอร์กรอกไว้ให้จากบัญชี)
  await register(p, { dept: 'med', sym: 'ไอ' });
  await expect(p.locator('.qno')).toHaveText('A013');
  await expect(p.locator('.ticket')).toContainText('ไปจุดคัดกรอง วัดความดัน');
  await act(p, 'feel', '5'); // ความรู้สึกหลังลงทะเบียน (4–5 ส่งทันที)
  await expect(p.locator('.feel')).toHaveCount(0);

  // นำทางไปจุดคัดกรอง แล้วกดถึงแล้ว
  await act(p, 'goNav');
  await expect(p.locator('.steps li').first()).toContainText('ออกจากจุดลงทะเบียน');
  await act(p, 'arrive', 'screen');
  await expect(p.locator('.ticket')).toContainText('รอพยาบาลเรียกวัดความดัน');

  // staff: คัดกรองเสร็จ → ผู้ป่วยได้แจ้งเตือน
  await row(s, 'A013').locator('[data-act="vitalsDone"]').click();
  await sheet(p, 'คัดกรองเสร็จแล้ว', 'รับทราบ');
  await expect(p.locator('.ahead')).toHaveText('รออีก 4 คิว');
  await expect(p.locator('.zs.on')).toContainText('กลับมารอ');
  await act(p, 'feelSkip');

  // staff เรียกคิวถัดไป: เหลือ 2 คิว → เตรียมตัว, ถึงคิว
  for (let i = 0; i < 2; i++) await s.locator('[data-act="callNext"][data-arg="med"]').click();
  await sheet(p, 'เหลืออีก 2 คิว', 'รับทราบ');
  await expect(p.locator('.zs.on')).toContainText('เตรียมตัว');
  for (let i = 0; i < 2; i++) await s.locator('[data-act="callNext"][data-arg="med"]').click();
  await sheet(p, 'ถึงคิวคุณแล้ว A013', 'นำทาง');
  await expect(p.locator('.from')).toContainText('ห้องตรวจ 3');
  await act(p, 'tab', 'now');
  await expect(p.locator('.ticket.t-go')).toContainText('ถึงคิวคุณแล้ว');

  // หมอบันทึกผล → ผลและยา
  await row(s, 'A013').locator('[data-act="saveResult"]').click();
  await sheet(p, 'พบแพทย์เสร็จแล้ว', 'รับทราบ');
  await expect(p.locator('.ctab .dot')).toHaveCount(1);
  await act(p, 'tab', 'results');
  await expect(p.locator('.dx h2')).toHaveText('ความดันโลหิตสูง');
  await expect(p.locator('article.med')).toHaveCount(3);
  await expect(p.locator('.prn')).toContainText('กินเฉพาะตอนมีอาการ');
  await act(p, 'tab', 'now');

  // ส่งยาถึงบ้าน
  await act(p, 'rxDelivery');
  await expect(p.locator('#ad')).toBeVisible();
  await act(p, 'rxConfirm');
  await expect(p.locator('.ticket')).toContainText('ขั้นสุดท้าย');
  await expect(p.locator('.ticket')).toContainText('ยากำลังส่งถึงบ้าน');
  for (let i = 0; i < 3; i++) await row(s, 'A013').locator('[data-act="advDeliv"]').click();
  await row(s, 'A013').locator('[data-act="advDeliv"]').click();
  await sheet(p, 'ยาส่งถึงบ้านแล้ว', 'ไว้ทีหลัง');

  // กลับบ้าน
  await act(p, 'checkout');
  await expect(p.locator('.ticket.t-done')).toContainText('จบการตรวจวันนี้แล้ว');
  await expect(p.locator('.feel h3')).toContainText('ภาพรวม');
  await act(p, 'feel', '2');
  await act(p, 'feelReason', 'รอนาน');
  await act(p, 'feelSend');
  await noNaN(p);
  await noHorizontalOverflow(p);

  // หมอส่งแบบประเมิน → ผู้ป่วยตอบ
  await s.locator('[data-act="docSendQ"]').click();
  await sheet(p, 'หมอส่งแบบประเมินมาแล้ว', 'ตอบเลย');
  for (const a of ['140–159', 'นาน ๆ ครั้ง', 'บางครั้ง', 'ลืมบางมื้อ']) { await act(p, 'quizPick', a); await act(p, 'quizNext'); }
  await p.fill('#qn', 'นอนไม่ค่อยหลับ');
  await act(p, 'quizSend');
  await expect(p.locator('.ticket')).toContainText('ส่งคำตอบให้หมอแล้ว');
  await expect(s.locator('.dans li')).toHaveCount(5);

  // หมอตัดสิน: ส่งยารอบต่อไป → ส่งถึงบ้าน
  await s.locator('[data-act="docRefill"]').click();
  await sheet(p, 'หมอสั่งส่งยารอบที่ 2', 'ไว้ทีหลัง');
  for (let i = 0; i < 4; i++) await s.locator('[data-act="advRefill"]').click();
  await sheet(p, 'ยารอบที่ 2 ส่งถึงแล้ว', 'ดูสถานะ');
  await expect(p.locator('.ticket')).toContainText('รอหมอส่งแบบประเมิน');

  // แชทกับหมอ (คำตอบจำลอง)
  await act(p, 'careView', 'chat');
  await act(p, 'chatQuick', 'กินยาแล้วเวียนหัว');
  await expect(p.locator('.typing')).toBeVisible();
  await expect(p.locator('.msg.doc').last()).toContainText('ลุกจากเตียงหรือเก้าอี้ช้า ๆ', { timeout: 6000 });

  // ลงชื่อออก
  await p.bringToFront();
  await act(p, 'tab', 'now');
  await act(p, 'leaveAsk');
  await p.locator('#sheet.on').getByRole('button', { name: 'ลงชื่อออก' }).click();
  await expect(p.locator('#lgName')).toBeVisible();

  // ดาวน์โหลด YAML (usage log) แล้วนำเข้ากลับ
  await s.bringToFront();
  const [dl] = await Promise.all([s.waitForEvent('download'), s.locator('[data-act="yaml"]').click()]);
  const file = await dl.path();
  const text = fs.readFileSync(file, 'utf8');
  expect(text).toContain('mode: no-server');
  expect(text).toMatch(/session_id: s-\d{8}-\d{4}/);
  expect(text).toContain('queue: A013');
  expect(text).toMatch(/stage: waiting/);
  expect(text).toMatch(/reasons: \[รอนาน\]/);
  expect(text).toContain('decision: null');
  s.once('dialog', d => d.accept());
  await s.locator('[data-act="reset"]').click();
  await expect(row(s, 'A013')).toHaveCount(0);
  await s.setInputFiles('#importFile', file);
  await expect(s.locator('#toast')).toContainText('นำเข้า');
  await s.locator('#showDone').check();
  await expect(row(s, 'A013')).toHaveCount(1);
  // หลังรีเซ็ต แอปผู้ป่วยออกจากคิวเดิม (เลขคิวเริ่มใหม่ อาจชนคนอื่น)
  await p.bringToFront();
  await expect(p.locator('#lgName')).toBeVisible();

  checkP(); checkS();
});
