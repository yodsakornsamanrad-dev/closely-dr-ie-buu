'use strict';
// Closely DR. x IE BUU — prototype server
// เก็บข้อมูลทั้งหมดใน data/db.yaml และส่งการเปลี่ยนแปลงแบบ real-time ด้วย Server-Sent Events
// business logic อยู่ใน public/core.js (ใช้ร่วมกับโหมด GitHub Pages ที่ไม่มี server)

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const YAML = require('yaml');
const { createCore, rebaseSeed, now, fail } = require('./public/core.js');

const PORT = Number(process.env.PORT) || 5190;
// บนเครื่องตัวเองเปิดเฉพาะ localhost; บน cloud host (มี PORT ให้มา) ต้องรับจากภายนอก
const HOST = process.env.HOST || (process.env.PORT ? '0.0.0.0' : '127.0.0.1');
const DB_FILE = path.join(__dirname, 'data', 'db.yaml');
const SEED_FILE = path.join(__dirname, 'data', 'seed.yaml');
const PUBLIC = path.join(__dirname, 'public');
const YAML_BROWSER = path.join(path.dirname(require.resolve('yaml/package.json')), 'browser', 'dist');

// ---------- YAML storage ----------
const readYaml = file => YAML.parse(fs.readFileSync(file, 'utf8'));
const loadSeed = () => rebaseSeed(readYaml(SEED_FILE));

let db, ownMtime;
if (fs.existsSync(DB_FILE)) { db = readYaml(DB_FILE); ownMtime = fs.statSync(DB_FILE).mtimeMs; }
else { db = loadSeed(); writeDb(); }

function save() { writeDb(); broadcast(); }
function writeDb() {
  db.meta.updatedAt = now();
  const header = '# Closely DR. x IE BUU — ข้อมูลที่แอปใช้งานอยู่ (แก้ไขไฟล์นี้ได้ระหว่างรัน แอปจะอัปเดตทันที)\n';
  fs.writeFileSync(DB_FILE, header + YAML.stringify(db, { lineWidth: 0, aliasDuplicateObjects: false }));
  ownMtime = fs.statSync(DB_FILE).mtimeMs;
}

const core = createCore({
  get db() { return db; },
  set db(v) { db = v; },
  save,
  seed: loadSeed,
});

// แก้ db.yaml ด้วย editor ระหว่างรัน → โหลดใหม่และ push ให้ทุกหน้าจอ
fs.watchFile(DB_FILE, { interval: 700 }, cur => {
  if (cur.mtimeMs === ownMtime) return;
  ownMtime = cur.mtimeMs;
  try {
    db = readYaml(DB_FILE);
    console.log(`[${now()}] db.yaml ถูกแก้ไขจากภายนอก → โหลดใหม่แล้ว`);
    broadcast();
  } catch (e) {
    console.error(`[${now()}] db.yaml รูปแบบ YAML ไม่ถูกต้อง — ใช้ข้อมูลเดิมต่อ:`, e.message);
  }
});

// ---------- real-time (SSE) ----------
const clients = new Set();
let rev = 0;
function broadcast() {
  rev++;
  for (const res of clients) res.write(`data: ${rev}\n\n`);
}
setInterval(() => { for (const res of clients) res.write(': ping\n\n'); }, 25000);

// ---------- http ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.yaml': 'text/yaml; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };

function readBody(req) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.setEncoding('utf8');
    req.on('data', c => { s += c; if (s.length > 1e5) { reject(Object.assign(new Error('ข้อมูลใหญ่เกินไป'), { status: 413 })); req.destroy(); } });
    req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch { reject(Object.assign(new Error('JSON ไม่ถูกต้อง'), { status: 400 })); } });
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

// ไฟล์ static: public/ + ไฟล์ที่โหมด GitHub Pages ต้องใช้ (seed.yaml, vendor/yaml/) เพื่อให้ ?mode=local ทดสอบได้บนเครื่อง
function staticFile(pathname) {
  const rel = pathname === '/' ? 'index.html' : pathname === '/staff' ? 'staff.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  if (rel === 'seed.yaml') return SEED_FILE;
  const [base, sub] = rel.startsWith('vendor/yaml/') ? [YAML_BROWSER, rel.slice('vendor/yaml/'.length)] : [PUBLIC, rel];
  const file = path.resolve(base, sub);
  if (!file.startsWith(base + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) fail(404, 'Not found');
  return file;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/api/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      res.write(`data: ${rev}\n\n`);
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    if (url.pathname === '/api/db.yaml') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(fs.readFileSync(DB_FILE, 'utf8'));
    }
    if (url.pathname.startsWith('/api/')) {
      const body = req.method === 'POST' ? await readBody(req) : {};
      return sendJson(res, 200, core.handle(req.method, url.pathname, body, url.searchParams));
    }
    const file = staticFile(url.pathname);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    if (!e.status) console.error(e);
    sendJson(res, e.status || 500, { error: e.status ? e.message : 'เซิร์ฟเวอร์ผิดพลาด' });
  }
});

server.listen(PORT, HOST, () => {
  console.log('\n  Closely DR. x IE BUU — prototype');
  console.log(`  แอปผู้ป่วย   : http://localhost:${PORT}/`);
  console.log(`  หน้าเจ้าหน้าที่ : http://localhost:${PORT}/staff`);
  if (HOST === '0.0.0.0') {
    for (const list of Object.values(os.networkInterfaces())) {
      for (const a of list || []) if (a.family === 'IPv4' && !a.internal) console.log(`  มือถือในวง Wi-Fi เดียวกัน : http://${a.address}:${PORT}/`);
    }
  }
  console.log(`  ข้อมูล YAML : ${DB_FILE}\n`);
});
