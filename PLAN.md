# PLAN — Closely DR. × IE BUU (ทำของจริงจากต้นแบบ)

สำรวจเมื่อ 2026-10-12 · อ้างอิงหน้าตาและพฤติกรรมจาก `design/closely-prototype.html`
(ในโจทย์เขียนว่า `design/prototype.html` แต่ไฟล์จริงชื่อ `closely-prototype.html`)

## 1. สิ่งที่พบในโค้ดเดิม

| ส่วน | สภาพตอนนี้ |
|---|---|
| `server.js` | Node http server (CommonJS) port 5190, เก็บทุกอย่างใน `data/db.yaml`, real-time ผ่าน SSE (`/api/events`), เฝ้าไฟล์ db.yaml ถ้าแก้ด้วย editor จะโหลดใหม่, โหมด LAN (`HOST=0.0.0.0`) |
| `public/core.js` | business logic แบบ UMD ใช้ร่วมกันทั้ง server และเบราว์เซอร์ (`createCore(store).handle(method, path, body)`), `rebaseSeed` เลื่อนเวลาข้อมูลตัวอย่างให้เป็น "วันนี้" |
| `public/transport.js` | เลือกโหมดเอง: เรียก `api/config` ได้ = server, ไม่ได้ = local (รัน core.js ในเบราว์เซอร์ + localStorage + event `storage`), `?mode=local` บังคับโหมด local, ดาวน์โหลด/นำเข้า YAML |
| `public/app.js`, `staff.js`, `styles.css` | UI ดีไซน์เดิม (Andon, Chakra Petch) ไม่ตรงกับ prototype ใหม่ |
| `data/seed.yaml` | ไฟล์เดียวรวม meta / settings / journey / departments / queues / stations / diagnosisTemplates / patients / visits (ข้อมูลสมมติ) |
| YAML library | แพ็กเกจ npm `yaml` (eemeli) ใช้ทั้ง server และคัดลอก browser build ไปที่ `_site/vendor/yaml/` |
| `scripts/build-pages.js` + `.github/workflows/pages.yml` | มี **ขั้น build** คัดลอก `public/` → `_site/` แล้ว deploy, ไม่มีเทส |
| เทส | ไม่มี |
| git | โฟลเดอร์นี้ยังไม่เป็น git repo |

prototype: ไฟล์เดียว 2,010 บรรทัด, state เป็นผู้ป่วยคนเดียว (`S`) + ผู้ป่วยอื่นแบบคงที่ (`OTHERS`), ข้อมูลฝังในโค้ด, แผงสาธิตด้านซ้าย (กดแทน staff/หมอ, ข้ามหน้าจอ 21 ปุ่ม)

## 2. สิ่งที่จะคงไว้จากโค้ดเดิม

- **สถาปัตยกรรม 2 โหมด**: logic ชุดเดียว (`core`) รันได้ทั้งใน Node และในเบราว์เซอร์ + ตัวเลือกโหมดอัตโนมัติ (`api/config` probe, `?mode=local`)
- **server mode**: SSE real-time, เขียน YAML ทุกครั้งที่ข้อมูลเปลี่ยน, watch ไฟล์แล้วโหลดใหม่, `npm start` / `start:lan` / `start.cmd`, port 5190, route `/staff`
- ชื่อสถานะ journey 6 ขั้น (`register, vitals, waiting, consult, pharmacy, done`), ประเภท VA/NNVA/NVA, สัญลักษณ์ ASME, 5 ขั้นส่งยา
- ผลวินิจฉัยสำเร็จรูป 4 แบบใน seed เดิม (HT, DM, OA, DRY) + ผลจาก prototype (HT แบบละเอียด) รวมไว้ใน `results.yaml`
- `rebaseSeed` (เลื่อนเวลาข้อมูลตัวอย่างให้เป็นวันนี้) และ value-stream analytics จาก events จริง
- README ส่วนวิธีแชร์แบบ Render / Codespaces

## 3. โครงสร้างไฟล์ใหม่ (ไม่มีขั้น build — root ของ repo = เว็บที่ GitHub Pages เสิร์ฟ)

```
index.html                 แอปผู้ป่วย (กรอบ iPhone 13 เฉพาะจอคอม ≥ 561px)
staff.html                 หน้าเจ้าหน้าที่
css/app.css                tokens + ธีม + แอปผู้ป่วย (ยกจาก prototype)
css/staff.css              หน้า staff
js/lib/                    ฟังก์ชันล้วน ไม่แตะ DOM → unit test ใน Node ได้
  floor.js                 place / route / ระยะ / walkTime / stepsOf (เลี้ยวซ้าย-ขวา) จาก floor-map.yaml
  queue.js                 ahead, โซน 3 ช่อง, จุดแจ้งเตือน 10 / 2 คิว, ข้อความรอ
  timeline.js              เวลาแต่ละขั้น + เวลารวม (กัน NaN)
  crowd.js                 ความหนาแน่น, simCD (replay), KPI, คอขวด + ข้อเสนอ
  iso3d.js                 projection + ตัวสร้าง SVG (prism, คน, เก้าอี้, ต้นไม้)
  usage-log.js             สร้าง usage log จาก visits + YAML ไป-กลับ
  core.js                  actions ทั้งหมด (ต่อยอดจาก public/core.js เดิม แปลงเป็น ES module)
js/data.js                 โหลด data/*.yaml ผ่าน js-yaml
js/transport.js            โหมด server (fetch + SSE) / no-server (core ในเบราว์เซอร์ + localStorage + BroadcastChannel)
js/prefs.js                ธีม + ขนาดตัวอักษร (localStorage)
js/voice.js                pickVoice / speak เสียงผู้หญิงภาษาไทย
js/icons.js, js/logo.js
js/app/*.js                หน้าจอผู้ป่วย: login, home, reg, now, nav, map3d, results, care, sheet
js/staff/*.js              staff: floor3d + replay, callers, table, doctor, value stream, YAML, QR share
data/
  app.yaml                 ขั้น journey, สัญลักษณ์, ขั้นส่งยา, หน้าความรู้สึก, เหตุผล, บัญชีเดโม (สมมติ)
  departments.yaml         แผนก ตัวอักษรคิว อาการ ห้องตรวจ เวลาเฉลี่ย
  floor-map.yaml           ห้อง พิกัด ทางเดิน ประตู จุดสังเกต (2D + 3D)
  results.yaml             ผลวินิจฉัยสำเร็จรูป ยา มื้อ คำเตือน คำแนะนำ
  care.yaml                แบบประเมิน ความเสี่ยง วันนัด รอบส่งยา คำตอบหมอจำลอง
  demo-patients.yaml       ผู้ป่วยจำลอง + visits ตัวอย่าง + สถิติ value stream ย้อนหลัง
  state.yaml               (server mode เท่านั้น, gitignore) ข้อมูลที่ใช้งานอยู่
vendor/js-yaml.mjs         js-yaml 4.1.0 (ESM, MIT)
vendor/qrcode.mjs          ตัวสร้าง QR ในเบราว์เซอร์ (qrcode-generator, MIT)
server.mjs                 server เดิมปรับเป็น ESM: เสิร์ฟ root, API, SSE, เขียน data/state.yaml
tests/unit/*.test.mjs      node:test (ไม่ต้องติดตั้งอะไรเพิ่ม)
tests/e2e/*.spec.mjs       Playwright + @axe-core/playwright (390×844 และ 1280×800)
.github/workflows/pages.yml  เทสก่อน แล้ว deploy root (ไม่มี build)
```

### ข้อมูลและการซิงก์

- ข้อมูลอ้างอิง (`data/*.yaml`) อ่านอย่างเดียว; ข้อมูลที่เปลี่ยน (visits, queues, care, chat, feelings) อยู่ใน **state** ก้อนเดียว
- no-server: state อยู่ใน `localStorage`, แท็บอื่นรู้ผ่าน `BroadcastChannel('closely')` (สำรองด้วย event `storage`) → ไฟ **ในเครื่อง**
- server: state อยู่ใน `data/state.yaml`, push ผ่าน SSE → ไฟ **Live**; SSE หลุด/`navigator.onLine=false` → **ออฟไลน์**
- แอปผู้ป่วยจำ `visitId` ของตัวเองใน sessionStorage/localStorage; staff เห็นทุก visit
- **usage log** (`ดาวน์โหลด YAML` ในหน้า staff) ตามรูปแบบในโจทย์: `exported_at, mode, sessions[] { session_id, queue, department, events[], feelings[], care{quiz_answers, decision} }` + แนบ `state` เต็มไว้ใต้ `state:` เพื่อให้ **นำเข้า YAML** กลับมาได้ครบ

## 4. ลำดับงาน (commit ทีละก้อน)

1. `git init` + commit โค้ดเดิมเป็น baseline (ย้อนดูได้เสมอ)
2. vendor js-yaml / qrcode, แยกข้อมูล prototype → `data/*.yaml`
3. `js/lib/*` + unit tests (เส้นทาง, เลี้ยว, โซน, เวลารวม/NaN, crowd/คอขวด, YAML ไป-กลับ)
4. `core.js` + `transport.js` + `server.mjs` (ทั้ง 2 โหมด)
5. แอปผู้ป่วย: shell + แถบบน + ธีม/ก+ + เมนู notch → login/face/OTP/guest → home/reg/lookup → แท็บตอนนี้ทุกสถานะ → นำทาง 2D → ผลและยา → ติดตาม (quiz, chat, refill) → แผนที่ 3D
6. staff.html: KPI + ผัง 3D live/replay + แผงจุดบริการ + คอขวด → จอเรียกคิว → ตาราง → ติดตามหลังกลับบ้าน → value stream → YAML ดาวน์โหลด/นำเข้า/รีเซ็ต → แชร์ลิงก์ QR
7. รันจริงด้วย local server + headless Chrome ตรวจทุกครั้งที่จบส่วนใหญ่
8. Playwright e2e (flow ส่งยาถึงบ้าน + flow รับยาเอง, 2 ขนาดจอ, console ไม่มี error), axe, คีย์บอร์ด, ฟอนต์ 3 ระดับ, reduced motion, ธีมมืด
9. แก้บั๊กจนผ่าน → `REVIEW.md` → README ภาษาไทย + `.gitignore` + workflow → **หยุดรอก่อน push**

## 5. การตัดสินใจ (บันทึกเหตุผล)

- **แผงสาธิตด้านซ้ายไม่ย้ายมา** ปุ่ม "กดแทนเจ้าหน้าที่/หมอ" ย้ายไปอยู่ใน `staff.html` (ใช้งานจริงผ่านการซิงก์); ปุ่ม "ข้ามไปหน้าจอ" ทุกปุ่มมีหน้าจอเทียบเท่า และทำทางลัด `?demo=<ชื่อหน้าจอ>` ไว้เปิดตรงสำหรับเทส/สอน
- เลขคิวคิดแบบ prototype: `ahead = เลขคิวของฉัน − เลขที่กำลังเรียก` (คิวที่ไม่ได้อยู่ในแอปถือเป็นผู้ป่วย walk-in)
- เวลาในขั้นใช้เวลาจริงจาก events (ไม่ใช่ค่าคงที่ `DUR` ใน prototype) ถ้าขั้นใดไม่มีเวลา ใช้ 0 ไม่ใช่ NaN
- Playwright ใช้ Chrome ที่ติดตั้งในเครื่อง (`channel: 'chrome'`) เพราะเครื่องนี้ดาวน์โหลด browser ของ Playwright ไม่ได้; ใน GitHub Actions ติดตั้ง chromium ตามปกติ
- ใช้ js-yaml ตามโจทย์ แทน `yaml` เดิม (server ใช้ไฟล์ vendor ตัวเดียวกัน จึงไม่ต้องพึ่ง npm ตอนรัน)

## 6. เรื่องที่ต้องถามก่อน (ย้อนกลับไม่ได้ / เปลี่ยนรูปแบบเดิม)

1. **ลบโค้ดเดิม** `public/`, `scripts/build-pages.js`, `_site/`, `server.js` (แทนด้วย `server.mjs`) — จะ commit baseline ไว้ก่อนจึงกู้คืนได้จาก git
2. **เปลี่ยนรูปแบบ YAML** จาก `seed.yaml` + `db.yaml` ไฟล์เดียว เป็น `data/*.yaml` หลายไฟล์ + `state.yaml` — ไฟล์ `db.yaml` เดิมจะนำเข้าแอปใหม่ไม่ได้ (เป็นข้อมูลสมมติทั้งหมด)
