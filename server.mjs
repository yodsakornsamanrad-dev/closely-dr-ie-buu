// Closely DR. x IE BUU — server (โหมดทั้งห้องใช้คิวเดียวกัน)
// คงแนวคิดจาก server.js เดิม: เก็บข้อมูลเป็น YAML, real-time ด้วย Server-Sent Events,
// แก้ data/state.yaml ด้วย editor ระหว่างรันได้ (server จะโหลดใหม่และ push ให้ทุกหน้าจอ)
// business logic อยู่ใน js/lib/core.js (ตัวเดียวกับที่โหมด GitHub Pages ใช้ในเบราว์เซอร์)
//
//   node server.mjs            เปิดเฉพาะเครื่องนี้ http://localhost:5190
//   node server.mjs --lan      ให้มือถือใน Wi-Fi เดียวกันเข้าได้
//   node server.mjs --static   เสิร์ฟไฟล์อย่างเดียว ไม่มี API (จำลอง GitHub Pages)
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadData } from './js/lib/data.js';
import { createCore, initialState } from './js/lib/core.js';
import { usageLogYaml, stateYaml, parseStateYaml } from './js/lib/usage-log.js';
import { isoLocal } from './js/lib/util.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const args = new Set(process.argv.slice(2));
const STATIC_ONLY = args.has('--static');
const PORT = Number(process.env.PORT) || (STATIC_ONLY ? 5191 : 5190);
// บนเครื่องตัวเองเปิดเฉพาะ localhost; --lan หรือ cloud host (มี PORT ให้มา) ต้องรับจากภายนอก
const HOST = process.env.HOST || (args.has('--lan') || process.env.PORT ? '0.0.0.0' : '127.0.0.1');
const STATE_FILE = process.env.STATE_FILE ? path.resolve(process.env.STATE_FILE) : path.join(ROOT, 'data', 'state.yaml');
const now = () => isoLocal(new Date());

const D = await loadData(name => fs.promises.readFile(path.join(ROOT, name), 'utf8'));

// ---------- YAML storage ----------
let state, ownMtime = 0;
const HEADER = '# Closely DR. x IE BUU — ข้อมูลที่แอปใช้งานอยู่ (แก้ไขไฟล์นี้ได้ระหว่างรัน แอปจะอัปเดตทันที)\n# ลบไฟล์นี้ (npm run reset) เพื่อเริ่มใหม่จากข้อมูลตั้งต้น\n';
function writeState() {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, HEADER + stateYaml(state));
  ownMtime = fs.statSync(STATE_FILE).mtimeMs;
}
if (!STATIC_ONLY) {
  try { state = parseStateYaml(fs.readFileSync(STATE_FILE, 'utf8')); ownMtime = fs.statSync(STATE_FILE).mtimeMs; }
  catch (e) {
    if (fs.existsSync(STATE_FILE)) console.warn(`[${now()}] data/state.yaml ใช้ไม่ได้ (${e.message.split('\n')[0]}) → เริ่มจากข้อมูลตั้งต้น`);
    state = initialState(D); writeState();
  }
  // แก้ state.yaml ด้วย editor ระหว่างรัน → โหลดใหม่และ push ให้ทุกหน้าจอ
  fs.watchFile(STATE_FILE, { interval: 700 }, cur => {
    if (!cur.mtimeMs || cur.mtimeMs === ownMtime) return;
    ownMtime = cur.mtimeMs;
    try { state = parseStateYaml(fs.readFileSync(STATE_FILE, 'utf8')); console.log(`[${now()}] state.yaml ถูกแก้ไขจากภายนอก → โหลดใหม่แล้ว`); broadcast(); }
    catch (e) { console.error(`[${now()}] state.yaml รูปแบบไม่ถูกต้อง — ใช้ข้อมูลเดิมต่อ:`, e.message.split('\n')[0]); }
  });
}
const core = createCore(D, { get: () => state, set: s => { state = s; writeState(); broadcast(); } });

// ---------- real-time (SSE) ----------
const clients = new Set();
let rev = 0;
function broadcast() { rev++; for (const res of clients) res.write(`data: ${rev}\n\n`); }
setInterval(() => { for (const res of clients) res.write(': ping\n\n'); }, 25000).unref();

// ---------- http ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.yaml': 'text/yaml; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.md': 'text/markdown; charset=utf-8' };
// เสิร์ฟเฉพาะไฟล์ที่ GitHub Pages จะเสิร์ฟ (ไม่เปิด node_modules, tests, .git)
const PUBLIC = /^(index\.html|staff\.html|favicon\.svg|server-mode\.json|(css|js|vendor|data)\/[\w./-]+)$/;

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.setEncoding('utf8');
    req.on('data', c => { s += c; if (s.length > 2e6) { reject(Object.assign(new Error('ข้อมูลใหญ่เกินไป'), { status: 413 })); req.destroy(); } });
    req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch { reject(Object.assign(new Error('JSON ไม่ถูกต้อง'), { status: 400 })); } });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/server-mode.json' && !STATIC_ONLY) return sendJson(res, 200, { server: true });
    if (url.pathname.startsWith('/api/')) {
      if (STATIC_ONLY) return sendJson(res, 404, { error: 'โหมด static ไม่มี API' });
      if (url.pathname === '/api/events') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
        res.write(`data: ${rev}\n\n`);
        clients.add(res);
        req.on('close', () => clients.delete(res));
        return;
      }
      if (url.pathname === '/api/state' && req.method === 'GET') return sendJson(res, 200, state);
      if (url.pathname === '/api/log.yaml') {
        res.writeHead(200, { 'Content-Type': 'text/yaml; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end(usageLogYaml(D, state, { mode: 'server' }));
      }
      if (url.pathname === '/api/act' && req.method === 'POST') {
        const { type, payload } = await readBody(req);
        return sendJson(res, 200, core.act(type, payload));
      }
      return sendJson(res, 404, { error: 'ไม่พบ API' });
    }
    let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    if (rel === '' ) rel = 'index.html';
    if (rel === 'staff') rel = 'staff.html';
    const file = path.join(ROOT, rel);
    if (!PUBLIC.test(rel) || rel.includes('..') || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('ไม่พบหน้านี้');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    if (!e.status) console.error(e);
    sendJson(res, e.status || 500, { error: e.status ? e.message : 'เซิร์ฟเวอร์ผิดพลาด' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`\n  Closely DR. x IE BUU — ${STATIC_ONLY ? 'โหมด static (เหมือน GitHub Pages ไม่มี server)' : 'โหมด server'}`);
  console.log(`  แอปผู้ป่วย      : http://localhost:${PORT}/`);
  console.log(`  หน้าเจ้าหน้าที่    : http://localhost:${PORT}/staff.html`);
  if (HOST === '0.0.0.0') {
    for (const list of Object.values(os.networkInterfaces())) {
      for (const a of list || []) if (a.family === 'IPv4' && !a.internal) console.log(`  มือถือใน Wi-Fi เดียวกัน : http://${a.address}:${PORT}/`);
    }
  }
  if (!STATIC_ONLY) console.log(`  ข้อมูล YAML    : ${STATE_FILE}\n`);
});
