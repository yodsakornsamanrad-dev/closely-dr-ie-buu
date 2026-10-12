// คิว: เหลือกี่คิว, โซน 3 ช่อง, จุดแจ้งเตือน และป้ายคิว
import { pad3 } from './util.js';

export const ZONES = ['ไปทำธุระได้', 'กลับมารอ', 'เตรียมตัว'];

export const queueLabel = (dept, n) => `${dept.letter}${pad3(n)}`;
/** จำนวนคิวก่อนหน้า (ไม่ติดลบ) */
export const aheadOf = (qn, calling) => Math.max(0, (Number(qn) || 0) - (Number(calling) || 0));

/** โซน: 0 = ไปทำธุระได้ (> back_at), 1 = กลับมารอ (> ready_at), 2 = เตรียมตัว */
export function zoneOf(ahead, alerts = { back_at: 10, ready_at: 2 }) {
  return ahead > alerts.back_at ? 0 : ahead > alerts.ready_at ? 1 : 2;
}

/** ข้อความ "รออีก n คิว" / "คิวถัดไปคือคุณ" */
export const aheadText = a => (a <= 1 ? 'คิวถัดไปคือคุณ' : `รออีก ${a} คิว`);

/** คำแนะนำตามโซน */
export function zoneTip(a, alerts = { back_at: 10, ready_at: 2 }) {
  const z = zoneOf(a, alerts);
  if (z === 0) return `ยังอีกนาน ไปเข้าห้องน้ำหรือซื้อกาแฟได้ แอปจะเตือนเมื่อเหลือ ${alerts.back_at} คิว`;
  if (z === 1) return `ใกล้แล้ว กลับมานั่งรอหน้าห้องตรวจ แอปจะเตือนอีกครั้งเมื่อเหลือ ${alerts.ready_at} คิว`;
  return a <= 1 ? 'คิวถัดไปคือคุณ อยู่หน้าห้องตรวจ เตรียมตัวได้เลย' : `อีก ${a} คิว เตรียมตัว อยู่หน้าห้องตรวจ`;
}

/** เวลารอโดยประมาณ (นาที) */
export const waitMinutes = (a, perQueue = 5) => Math.max(0, a) * perQueue;
export function waitText(mins) {
  return mins >= 60 ? `${Math.floor(mins / 60)} <small>ชม.</small> ${mins % 60} <small>นาที</small>` : `${mins} <small>นาที</small>`;
}

/**
 * แจ้งเตือนเมื่อคิวขยับข้ามเกณฑ์ (เทียบค่าก่อนหน้ากับค่าใหม่)
 * คืน 'back' (เหลือ back_at คิว), 'ready' (เหลือ ready_at คิว) หรือ null
 * ข้ามหลายเกณฑ์ในครั้งเดียว (เช่น staff เรียกคิวรัว ๆ) → แจ้งอันที่ใกล้กว่า
 */
export function queueAlert(prev, next, alerts = { back_at: 10, ready_at: 2 }) {
  if (prev == null || next == null || next >= prev || next <= 0) return null;
  if (prev > alerts.ready_at && next <= alerts.ready_at) return 'ready';
  if (prev > alerts.back_at && next <= alerts.back_at) return 'back';
  return null;
}
