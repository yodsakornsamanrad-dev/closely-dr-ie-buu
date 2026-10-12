# Closely DR. × IE BUU

แอปโรงพยาบาลบนมือถือ (แผนกผู้ป่วยนอก OPD) สำหรับ workshop **Design Thinking / Customer Journey Map**
ของภาควิชาวิศวกรรมอุตสาหการ (IE) มหาวิทยาลัยบูรพา

- **แอปผู้ป่วย** (`index.html`): ล็อกอิน → รับคิว → คัดกรอง → รอคิว → พบแพทย์ → รับยา/ส่งยาถึงบ้าน → กลับบ้าน → ติดตามอาการกับหมอ
- **หน้าเจ้าหน้าที่** (`staff.html`): ผังชั้น OPD 3D (สด/Replay), จอเรียกคิว, ตารางผู้ป่วย, หมอตัดสินหลังกลับบ้าน, Value stream, ดาวน์โหลด/นำเข้า YAML, แชร์ลิงก์ QR
- ข้อมูลทั้งหมดอยู่ในไฟล์ **YAML** และบันทึกการใช้งานส่งออกเป็น YAML เพื่อทำ Journey Map

> ข้อมูลผู้ป่วย ผลวินิจฉัย และยา **เป็นข้อมูลสมมติทั้งหมด** ไม่ใช่คำแนะนำทางการแพทย์ ห้ามใส่ข้อมูลผู้ป่วยจริงใน repo (PDPA)

ลิงก์หลังขึ้น GitHub Pages: **https://yodsakornsamanrad-dev.github.io/closely-dr-ie-buu/** (หน้า staff: `…/closely-dr-ie-buu/staff.html`)
รูปแบบทั่วไป: `https://<ชื่อบัญชี GitHub>.github.io/closely-dr-ie-buu/`

## วิธีรันในเครื่อง

ต้องมี Node.js 18 ขึ้นไป (ไม่มีขั้น build)

```
npm install          # ครั้งแรกเท่านั้น (ใช้สำหรับเทส ตัวแอปไม่ต้องติดตั้งอะไร)
npm start            # โหมด server  → http://localhost:5190/  และ /staff.html
npm run start:lan    # โหมด server ให้มือถือใน Wi-Fi เดียวกันเข้าได้ (ดูเลข IP ที่ขึ้นในหน้าต่าง)
npm run static       # จำลอง GitHub Pages (ไม่มี server) → http://localhost:5191/
```

หรือดับเบิลคลิก `start.cmd` บน Windows
เปิดไฟล์ `index.html` ตรง ๆ (file://) **ไม่ได้** เพราะเบราว์เซอร์ไม่ยอมโหลด ES modules และ YAML จากไฟล์ในเครื่อง ต้องรันผ่าน server ตัวใดตัวหนึ่งข้างบน (หรือ `npx serve .`, `python -m http.server`)

### 2 โหมด (แอปเลือกเอง ไฟมุมขวาบนบอกโหมด)

| | โหมดไม่มี server (GitHub Pages) | โหมด server (`npm start`) |
|---|---|---|
| ไฟสถานะ | **ในเครื่อง** (สี่เหลี่ยมน้ำเงิน) | **Live** (จุดเขียว) / **ออฟไลน์** (วงแดง ถ้าต่อ server ไม่ได้) |
| เก็บข้อมูล | `localStorage` ของเบราว์เซอร์นั้น | `data/state.yaml` ไฟล์เดียวที่ทุกเครื่องใช้ร่วมกัน |
| real-time | ซิงก์ระหว่างแท็บในเบราว์เซอร์เดียวกัน (`BroadcastChannel`) | ทุกเครื่องเห็นคิวเดียวกัน (Server-Sent Events) |
| YAML | ดาวน์โหลด / นำเข้า จากหน้า staff | ดาวน์โหลด / นำเข้า จากหน้า staff + แก้ `data/state.yaml` ระหว่างรันได้ |

ใส่ `?mode=local` ท้ายลิงก์เพื่อบังคับโหมดไม่มี server แม้รัน `npm start` อยู่

## วิธีใช้ในห้องเรียน

**แบบ A: ทุกคนใช้ลิงก์ GitHub Pages (ไม่ต้องมี server)**
1. ผู้สอนเปิด `staff.html` กด **แชร์ลิงก์** ให้นักศึกษาสแกน QR
2. นักศึกษาเล่นเป็นผู้ป่วยบนมือถือ ส่วนที่เจ้าหน้าที่/หมอต้องกด ทำได้ 2 ทาง:
   - กด **"โหมดสาธิต: กดแทนเจ้าหน้าที่"** ท้ายแท็บ "ตอนนี้" หรือ "ติดตาม" (มือถือเครื่องเดียวจบ)
   - หรือเปิด `staff.html` เป็นอีกแท็บในเบราว์เซอร์เดียวกัน (เหมาะกับคอม: เพื่อนคนหนึ่งเป็นผู้ป่วย อีกคนเป็นเจ้าหน้าที่)
3. จบแล้วแต่ละกลุ่มกด **ดาวน์โหลด YAML** ในหน้า staff ส่งให้ผู้สอน ผู้สอน **นำเข้า YAML** ของแต่ละกลุ่มมาดู Value stream ได้

> ข้อจำกัด: โหมดนี้แต่ละเบราว์เซอร์มีข้อมูลของตัวเอง หน้า staff บนคอมผู้สอนจะ**ไม่เห็น**คิวในมือถือนักศึกษา

**แบบ B: ทั้งห้องใช้คิวเดียวกัน (โหมด server)**
1. ผู้สอนรัน `npm run start:lan` บนโน้ตบุ๊ก ทุกคนต่อ Wi-Fi เดียวกัน
2. เปิด `http://<IP โน้ตบุ๊ก>:5190/staff.html` บนจอโปรเจกเตอร์ กด **แชร์ลิงก์** ได้ QR ของลิงก์นั้น
3. นักศึกษาเล่นเป็นผู้ป่วยบนมือถือ ผู้สอนกดเรียกคิว บันทึกผลตรวจ ส่งยา ในหน้า staff ทุกจอขยับพร้อมกัน
4. ไฟล์ `data/state.yaml` อัปเดตทุกครั้งที่กด ดาวน์โหลด usage log ได้จากปุ่ม **ดาวน์โหลด YAML**
   (Wi-Fi บางที่กันเครื่องคุยกัน ถ้ามือถือเปิดไม่ได้ให้ใช้ hotspot มือถือผู้สอนแทน)

**ทางลัดในแอปผู้ป่วย**: บัญชีเดโมพิมพ์ชื่อ "สมชาย" · ค้นหาคิวด้วยเบอร์ผู้ป่วยจำลอง เช่น `0810000004` (คิว A010)
ขั้นตอนที่ใช้สอน: ไปจุดคัดกรอง → แถบโซน 3 ช่อง (ไปทำธุระได้ / กลับมารอ / เตรียมตัว) แจ้งเตือนที่ 10 และ 2 คิว →
ถามความรู้สึกหลังแต่ละขั้น → ผัง ASME พร้อมเวลาจริง → Value stream (lead time, VA, PCE, NVA) ในหน้า staff

## โครงสร้างไฟล์

```
index.html, staff.html       หน้าเว็บ 2 หน้า (GitHub Pages เสิร์ฟตรงจาก root ของ repo)
css/app.css, css/staff.css   หน้าตาจาก design/closely-prototype.html
js/lib/                      logic ล้วน ไม่แตะหน้าจอ (มี unit test)
  core.js                    action ทั้งหมด: ลงทะเบียน เรียกคิว บันทึกผล ส่งยา แบบประเมิน ฯลฯ (ใช้ทั้ง server และเบราว์เซอร์)
  floor.js                   เส้นทาง ระยะเดิน คำบอกทางเลี้ยวซ้าย/ขวา
  queue.js                   เหลือกี่คิว โซน 3 ช่อง จุดแจ้งเตือน
  timeline.js                เวลาแต่ละขั้น + เวลารวม
  crowd.js                   ความหนาแน่น replay ทั้งวัน คอขวด
  iso3d.js                   แผนที่ 3D แบบ isometric (SVG)
  valuestream.js             Value stream (รวมข้อมูลย้อนหลังกับข้อมูลจริงวันนี้)
  usage-log.js, data.js      YAML ไป-กลับ และโหลด data/*.yaml
js/transport.js              เลือกโหมด server / ไม่มี server อัตโนมัติ
js/app/                      หน้าจอแอปผู้ป่วย (entry, now, tabs, map3d, main)
js/staff/                    หน้า staff (floor = ผัง 3D + replay, main = ส่วนอื่นทั้งหมด)
js/ui/                       ไอคอน เสียงอ่าน ธีม/ขนาดตัวอักษร แผ่นแจ้งเตือน
data/*.yaml                  ข้อมูลอ้างอิง (แก้ได้ แอปอ่านใหม่ทุกครั้งที่เปิด)
vendor/js-yaml.mjs           js-yaml 4.1.0 (MIT) อ่าน/เขียน YAML
vendor/qrcode.mjs            qrcode-generator 1.4.4 (MIT) สร้าง QR ในเบราว์เซอร์ ไม่เรียกบริการภายนอก
server.mjs                   Node server (ไม่มี dependency): ไฟล์ static + API + SSE + data/state.yaml
tests/unit/                  node:test
tests/e2e/                   Playwright + axe (390×844 และ 1280×800)
design/closely-prototype.html  ต้นแบบดีไซน์ที่ใช้อ้างอิง
.github/workflows/pages.yml  เทส แล้ว deploy GitHub Pages จาก main
```

## รูปแบบ YAML

### ข้อมูลอ้างอิง `data/`

| ไฟล์ | เนื้อหา |
|---|---|
| `app.yaml` | ขั้น journey 6 ขั้น (key ห้ามเปลี่ยน: register, vitals, waiting, consult, pharmacy, done) + สัญลักษณ์ ASME + VA/NNVA/NVA, ความเร็วเดิน 0.7 ม./วิ, จุดแจ้งเตือน 10/2 คิว, ขั้นส่งยา 5 ขั้น, หน้าความรู้สึก, เหตุผล, บัญชีเดโม |
| `departments.yaml` | แผนก ตัวอักษรคิว อาการ ห้องตรวจ ผลสำเร็จรูปตั้งต้น และเลขคิวตอนเริ่ม |
| `floor-map.yaml` | ห้อง พิกัด ทางเดิน จุดที่เดินไปได้ จุดสังเกต, ความหนาแน่นพื้นฐาน, ค่าจำลอง replay, ข้อเสนอแก้คอขวด, ต้นไม้/คนเดินบนแผนที่ 3D |
| `results.yaml` | ผลวินิจฉัยสำเร็จรูป (ความดัน, เบาหวาน, ไข้หวัด, ข้อเข่าเสื่อม, ตาแห้ง) ยาแต่ละตัวพร้อมมื้อ คำเตือน คำแนะนำ |
| `care.yaml` | แบบประเมินอาการ คำตอบที่น่าเป็นห่วง รอบส่งยา วันนัด ชื่อสถานะ ข้อความแชทหมอจำลอง |
| `demo-patients.yaml` | ผู้ป่วยจำลองในหน้า staff, ชื่อสำหรับ "เพิ่มผู้ป่วยจำลอง", สถิติ value stream ย้อนหลัง |

### บันทึกการใช้งาน (ปุ่ม "ดาวน์โหลด YAML")

ไฟล์มี 2 ส่วน: `sessions` อ่านง่ายสำหรับทำ Journey Map (เฉพาะผู้ป่วยที่ใช้แอปจริง ไม่รวมผู้ป่วยจำลอง) และ `state` ข้อมูลเต็มสำหรับ **นำเข้า YAML** กลับ

```yaml
exported_at: 2026-10-12T10:42:00+07:00
mode: no-server                 # no-server = GitHub Pages, server = npm start
note: ข้อมูลสมมติจาก workshop ไม่มีข้อมูลผู้ป่วยจริง
sessions:
  - session_id: s-20261012-0009
    queue: A013
    department: med               # แผนกที่ออกคิว (department_chosen: unsure ถ้าเลือก "ไม่แน่ใจ")
    symptoms: [ไอ]
    events:                       # stage = เข้าขั้นนั้น, action = สิ่งที่ผู้ป่วยกด (เรียงตามเวลา)
      - { stage: register, at: "2026-10-12T08:10:00+07:00" }
      - { stage: vitals, at: "2026-10-12T08:13:00+07:00" }
      - { action: arrive, place: screen, at: "2026-10-12T08:15:00+07:00" }
      - { stage: waiting, at: "2026-10-12T08:21:00+07:00" }
      - { action: rx, mode: delivery, at: "2026-10-12T09:02:00+07:00" }
      - { action: delivery, step: 1, label: จัดยาแยกซองตามมื้อ, at: "…" }
      - { action: checkout, at: "…" }
    feelings:                     # 1 แย่มาก … 5 ดีมาก, stage: visit = ภาพรวมทั้งวัน
      - { stage: waiting, score: 2, reasons: [รอนาน] }
    result: HT                    # id ใน results.yaml
    medicine: { mode: delivery, delivery_step: ส่งถึงแล้ว }
    care:
      phase: waitq                # meds, waitq, assess, review, followup, refill
      round: 2
      quiz_answers: { bp: 140–159, head: นาน ๆ ครั้ง }
      decision: refill            # followup = นัดมาตรวจ, refill = ส่งยารอบต่อไป, null = ยังไม่ตัดสิน
      chat_messages: 1
state:
  schema: closely-state/1
  queues: { med: { calling: 13, last_issued: 13 }, … }
  visits: [ … ]                   # ข้อมูลเต็มของทุกคิว (รวมผู้ป่วยจำลอง)
```

โหมด server เก็บ `state` ไว้ที่ `data/state.yaml` (ไม่ขึ้น git) แก้ไฟล์ระหว่างรันได้ แอปทุกจอจะอัปเดตทันที
ลบไฟล์นี้ (`npm run reset`) หรือกด **รีเซ็ตข้อมูล** ในหน้า staff เพื่อเริ่มใหม่จากข้อมูลตั้งต้น

## ทดสอบ

```
npm run test:unit    # เส้นทาง/ระยะ, เลี้ยวซ้าย-ขวา, โซนคิว, เวลารวม (NaN), crowd/คอขวด, core, YAML ไป-กลับ
npm run test:e2e     # Playwright headless: flow ส่งยาถึงบ้าน + flow รับยาเอง, axe, คีย์บอร์ด, ตัวอักษร 3 ระดับ, reduced motion, ธีมมืด
npm test             # ทั้งสองอย่าง
```

e2e ใช้ Chrome ที่ติดตั้งในเครื่อง (`channel: 'chrome'`) แบบ headless เท่านั้น ไม่เปิดหน้าต่าง ไม่บันทึกภาพ
ถ้าเครื่องไม่มี Chrome: `npx playwright install chromium` แล้วตั้ง `PW_CHANNEL=chromium`

## ขึ้น GitHub

repo: https://github.com/yodsakornsamanrad-dev/closely-dr-ie-buu (ตั้ง `origin` ไว้แล้ว)

```
git push -u origin main
```

แล้วใน GitHub: **Settings → Pages → Build and deployment → Source = GitHub Actions**
workflow `.github/workflows/pages.yml` จะรันเทสก่อน ถ้าผ่านจึง deploy (ดูความคืบหน้าในแท็บ **Actions**)
เสร็จแล้วแชร์ลิงก์ `https://yodsakornsamanrad-dev.github.io/closely-dr-ie-buu/` หรือกด **แชร์ลิงก์** ในหน้า staff ให้เพื่อนสแกน QR

ถ้า repo อยู่ใต้ org หรือชื่ออื่น เปลี่ยน remote ก่อน push: `git remote set-url origin https://github.com/<บัญชี>/closely-dr-ie-buu.git`

## ข้อจำกัด

- โหมด GitHub Pages ซิงก์ได้เฉพาะแท็บในเบราว์เซอร์เดียวกัน (ไม่มี server กลาง) ใช้ "โหมดสาธิต" หรือโหมด server แทน
- private / incognito: ข้อมูลหายเมื่อปิดแท็บ
- สแกนใบหน้าและ OTP เป็นการจำลอง ไม่เปิดกล้อง ไม่ส่ง SMS
- แชทกับหมอตอบอัตโนมัติจากคำในข้อความ (จำลอง)
- เสียงอ่านใช้เสียงภาษาไทยที่มีในเครื่อง บางเครื่อง (เช่น Windows ที่ไม่ได้ลงภาษาไทย) อาจไม่มีเสียง
- ตัวเลขความหนาแน่นและ replay เป็นการจำลองจากค่าใน `floor-map.yaml` บวกผู้ป่วยในระบบจริง
- หน้า staff ออกแบบสำหรับจอใหญ่และใช้ธีมสว่างเสมอ
