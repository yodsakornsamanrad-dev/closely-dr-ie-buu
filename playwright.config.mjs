// end-to-end tests: 2 ขนาดจอ (มือถือ 390×844 และคอม 1280×800) × 2 โหมด (server และไม่มี server)
// บนเครื่องที่ดาวน์โหลด browser ของ Playwright ไม่ได้ ใช้ Chrome ที่ติดตั้งในเครื่อง (channel: chrome)
// ใน GitHub Actions (CI=true) ใช้ chromium ของ Playwright
import { defineConfig } from '@playwright/test';

const channel = process.env.CI ? undefined : (process.env.PW_CHANNEL || 'chrome');
export const SERVER = 'http://localhost:5290';
export const STATIC = 'http://localhost:5291';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1, // โหมด server ใช้ข้อมูลชุดเดียวกัน
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: { channel, headless: true, locale: 'th-TH', timezoneId: 'Asia/Bangkok', trace: process.env.CI ? 'retain-on-failure' : 'off', screenshot: 'off', video: 'off' },
  projects: [
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: [
    { command: 'node server.mjs', env: { PORT: '5290', HOST: '127.0.0.1', STATE_FILE: '.e2e/state.yaml' }, url: `${SERVER}/api/state`, reuseExistingServer: false },
    { command: 'node server.mjs --static', env: { PORT: '5291', HOST: '127.0.0.1' }, url: `${STATIC}/index.html`, reuseExistingServer: false },
  ],
});
