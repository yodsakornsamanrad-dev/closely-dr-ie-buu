// แท็บ "นำทาง" (แผนที่ 2D), "ผลและยา" และ "ติดตาม" (แบบประเมิน แชทกับหมอ หมอตัดสิน ส่งยารอบต่อไป)
import { C, visit, dept, stIdx, nextTarget, sayBtn, ticket, template, followDate, refillDate, quizDue, phaseText, visibleChat, doctorTyping, unreadCount } from './ctx.js';
import { route, stepsOf, walkTime } from '../lib/floor.js';
import { esc, hhmmOf } from '../lib/util.js';
import { IC } from '../ui/icons.js';
import { deliveryBlock, demoLink } from './now.js';
import { mapBlock } from './map3d.js';

// ---------- แผนที่ 2D ----------
export function mapSVG(r) {
  const D = C.D, f = D.floor, hl = r.B.hl;
  let s = `<svg viewBox="0 0 ${f.view.w} ${f.view.h}" role="img" aria-label="แผนที่${f.floor_name} เส้นทางจาก ${r.A.name} ไป ${r.B.name}">`;
  s += f.corridors.map(c => `<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" ${c.y === 118 ? 'rx="4" ' : ''}fill="var(--done-bg)"/>`).join('');
  s += `<text x="10" y="139" font-size="10" fill="var(--ink2)">ทางเดินหลัก</text>`;
  for (const { key: k, x, y, w, h, label2d: lab } of f.rooms) {
    const on = k === hl;
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${on ? 'var(--act-bg)' : 'var(--card)'}" stroke="${on ? 'var(--act)' : 'var(--line)'}" stroke-width="${on ? 3 : 1.5}"/>`;
    const cy = y + h / 2 - (lab.length - 1) * 7 + 4;
    lab.forEach((t, i) => { s += `<text x="${x + w / 2}" y="${cy + i * 14}" text-anchor="middle" font-size="${w < 50 ? 10.5 : 12}" font-weight="${on ? 700 : 500}" fill="${on ? 'var(--act-ink)' : 'var(--ink)'}">${esc(t)}</text>`; });
    if (on) s += `<text x="${x + w / 2}" y="${y + h - 8}" text-anchor="middle" font-size="9.5" font-weight="700" fill="var(--act)">ปลายทาง</text>`;
  }
  const el = f.entrance_label;
  s += `<text x="${el.x}" y="${el.y}" text-anchor="end" font-size="11" font-weight="${hl === 'entrance' ? 700 : 500}" fill="${hl === 'entrance' ? 'var(--act)' : 'var(--ink2)'}">${el.text}</text>`;
  if (!r.same) {
    const pts = r.pts.map(p => p.join(',')).join(' ');
    s += `<polyline points="${pts}" fill="none" stroke="var(--card)" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`;
    s += `<polyline points="${pts}" fill="none" stroke="var(--act)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;
    const e = r.pts[r.pts.length - 1];
    s += `<circle cx="${e[0]}" cy="${e[1]}" r="9" fill="var(--card)" stroke="var(--act)" stroke-width="4"/>`;
  }
  const [x, y] = r.A.pt, right = x < 300, lx = right ? x + 13 : x - 47, ly = y - 9;
  s += `<circle cx="${x}" cy="${y}" r="9" fill="var(--ink)" stroke="var(--card)" stroke-width="3"/>`;
  s += `<rect x="${lx}" y="${ly}" width="34" height="18" rx="9" fill="var(--ink)"/><text x="${lx + 17}" y="${ly + 13}" text-anchor="middle" font-size="11" font-weight="700" fill="var(--card)">คุณ</text>`;
  return s + '</svg>';
}

export function navTab() {
  const D = C.D, v = visit(), to = C.U.navTo || nextTarget(v), r = route(D, v.loc, to, v.dept);
  const others = [['next', 'ขั้นต่อไป', IC.next], ['entrance', 'ทางเข้า', IC.door], ['wc', 'ห้องน้ำ', IC.wc], ['cafe', 'ร้านกาแฟ', IC.cup]];
  const chips = `<div class="shead"><h2>ไปที่อื่น</h2></div><div class="chips">${others.map(([k, t, ic]) => {
    const on = (k === 'next' && !C.U.navTo) || C.U.navTo === k;
    return `<button class="chip" aria-pressed="${on}" data-act="navGo" data-arg="${k}">${ic}${t}</button>`;
  }).join('')}</div>`;
  if (r.same) {
    return { body: `<p class="from">ตอนนี้คุณอยู่ที่<b>${r.A.name}</b></p><div class="here">คุณอยู่ที่${r.B.name}แล้ว</div>
      <div style="margin-top:var(--s3)">${mapBlock(r)}</div>${chips}`, dock: '', tabs: true };
  }
  const st = stepsOf(D, r);
  const body = `<p class="from">จาก ${r.A.name}<b>ไป ${r.B.name}</b></p>
    <dl class="stats"><div><dt>ระยะทาง</dt><dd>${r.m} <small>เมตร</small></dd></div><div><dt>เดินประมาณ</dt><dd>${walkTime(D, r.m)} <small>นาที</small></dd></div></dl>
    ${mapBlock(r)}
    <div class="shead"><h2>วิธีไป</h2>${sayBtn(`จาก ${r.A.name} ไป ${r.B.name}. ` + st.join('. '), 'ฟังวิธีไป', 'say2')}</div>
    <ol class="steps">${st.map(s => `<li><span>${s}</span></li>`).join('')}</ol>${chips}
    <p class="help">เวลาเดินคิดจากความเร็วเดินผู้สูงอายุ ${D.app.walking_speed_mps} เมตรต่อวินาที</p>`;
  return { body, dock: `<button class="btn main" data-act="arrive" data-arg="${to}">${IC.check}ถึง${r.B.short}แล้ว</button>`, tabs: true };
}

// ---------- ผลและยา ----------
const MEALS = [['เช้า', 'sunrise'], ['กลางวัน', 'sun'], ['เย็น', 'sunset'], ['ก่อนนอน', 'moon']];
export function resultsTab() {
  const v = visit(), R = template();
  if (!R) {
    const st = C.D.stages[stIdx(v.stage)];
    return { body: `<div class="empty"><div class="ill">${IC.rx}</div><h1 class="q" style="font-size:1.333rem">ผลตรวจจะขึ้นที่นี่หลังพบแพทย์</h1>
      <p class="muted">ตอนนี้: ${st.name}<br>เมื่อแพทย์บันทึกผล แอปจะแจ้งเตือนทันที</p></div>`, dock: '', tabs: true };
  }
  const readAll = `ผลตรวจ ${R.dx}. ${R.plain}. ` + R.meds.map(m => `${m.name} ใช้${m.for} ${m.prn ? 'กินเฉพาะตอนมีอาการ' : 'กินมื้อ' + MEALS.filter((x, i) => m.meals[i]).map(x => x[0]).join(' ')} ครั้งละ ${m.amt} ${m.when}. ข้อควรระวัง ${m.warn}`).join('. ') + '. หมอจะติดตามอาการผ่านแบบประเมินในแอป';
  const meds = R.meds.map(m => `<article class="med"><h3>${m.name}</h3><p class="for">ใช้${m.for}</p>
    ${m.prn ? `<div class="prn">${IC.info}กินเฉพาะตอนมีอาการ</div>`
      : `<div class="meals" role="list" aria-label="มื้อที่ต้องกิน">${MEALS.map(([t, ic], i) => `<div role="listitem" class="meal ${m.meals[i] ? 'on' : ''}">${IC[ic]}${t}<span class="sr">${m.meals[i] ? ' กิน' : ' ไม่ต้องกิน'}</span></div>`).join('')}</div>`}
    <dl class="dose"><div><dt>ครั้งละ</dt><dd>${m.amt}</dd></div><div><dt>${m.prn ? 'ระยะห่าง' : 'กิน'}</dt><dd>${m.when}</dd></div><div><dt>กินนาน</dt><dd>${m.days}</dd></div></dl>
    <div class="warn">${IC.warn}<span>${m.warn}</span></div></article>`).join('');
  const fd = followDate(v);
  const body = `<section class="dx"><p class="lab">ผลวินิจฉัย</p><h2>${R.dx}</h2><p>${R.plain}</p>
      ${sayBtn(readAll, 'ฟังทั้งหมด', 'say2')}
      <p class="doc">${R.doctor} ${dept().name}<br>วันนี้ ${hhmmOf(new Date(v.result.at))}</p></section>
    <div class="shead"><h2>ยา ${R.meds.length} รายการ</h2></div>${meds}
    <div class="shead"><h2>คำแนะนำ</h2></div><ul class="adv">${R.advice.map(a => `<li>${a}</li>`).join('')}</ul>
    <div class="shead"><h2>แผนติดตามจากหมอ</h2></div><div class="appt">${v.care.decision === 'followup' ? `<b>นัด ${fd.date}</b>${fd.note}` : `<b>${phaseText(v.care.phase)}</b>หมอจะตัดสินหลังดูแบบประเมิน ว่าต้องนัดมาตรวจ หรือส่งยารอบต่อไปถึงบ้าน`}</div>
    <button class="btn" style="margin-top:8px" data-act="tab" data-arg="care">${IC.care}ดูสถานะการติดตาม</button>
    <p class="disc">ข้อมูลสมมติ ไม่ใช่คำแนะนำทางการแพทย์</p>`;
  return { body, dock: '', tabs: true };
}

// ---------- ติดตาม ----------
const QUIZ = () => C.D.care.quiz.questions;
export const isRisk = (q, ans) => (q.risk || []).includes(ans[q.k]);

function careHero() {
  const v = visit(), c = v.care, D = C.D, steps = D.app.delivery.steps, win = D.app.delivery.window_min.join(' ถึง '), winTxt = D.app.delivery.window_min.join('–');
  const fd = followDate(v), qz = D.care.quiz, nq = QUIZ().length;
  switch (c.phase) {
    case 'meds':
      if (v.rx === 'delivery' && v.deliv < 4)
        return { html: ticket('act', 'กำลังส่งยารอบที่ 1', 'trans', `ยาจะส่งถึงบ้านภายใน ${win} นาที ตอนนี้${steps[v.deliv]}`, `<h2>ส่งถึงบ้านภายใน ${winTxt} นาที</h2><div class="perf"></div>${deliveryBlock(v.deliv)}`), dock: '' };
      return { html: ticket('done', 'ยังไม่เริ่ม', 'op', 'แผนติดตามจะเริ่มหลังได้รับยา', `<h2>แผนติดตามจะเริ่มหลังได้รับยา</h2><p class="muted" style="margin:0">หมอจะส่งแบบประเมินอาการมาให้ตอบที่บ้าน แล้วตัดสินว่าต้องนัดมาตรวจ หรือส่งยาต่อถึงบ้าน</p>`), dock: '' };
    case 'waitq':
      return { html: ticket('wait', 'รอหมอส่งแบบประเมิน', 'delay', `หมอจะส่งแบบประเมินอาการมาให้ตอบภายใน ${qz.due_days} วัน แอปจะแจ้งเตือนเมื่อได้รับ`,
        `<h2>หมอจะส่งแบบประเมินอาการมาให้ตอบ</h2><p class="muted" style="margin:0">ภายใน ${qz.due_days} วัน${c.round === 1 ? ` (${quizDue(v)})` : ''} แอปจะแจ้งเตือนเมื่อได้รับ</p>
         <div class="tip" style="margin-top:12px">${IC.rx}<span>ระหว่างนี้กินยาตามมื้อ ดูวิธีกินได้ที่แท็บผลและยา</span></div>`), dock: '' };
    case 'assess':
      return { html: ticket('act', 'ต้องทำตอนนี้', 'insp', `หมอส่งแบบประเมินอาการมาแล้ว ตอบ ${nq} ข้อ ใช้เวลาประมาณ 2 นาที`,
        `<h2>ตอบแบบประเมินอาการ</h2><p class="muted" style="margin:0">หมอตั้งคำถามให้ ${nq} ข้อ ใช้เวลาประมาณ 2 นาที</p>
         <div class="tip" style="margin-top:12px">${IC.info}<span>หมอจะใช้คำตอบตัดสินว่าต้องนัดมาตรวจ หรือส่งยาต่อถึงบ้าน</span></div>`),
        dock: `<button class="btn main" data-act="careView" data-arg="quiz">${IC.rx}เริ่มตอบแบบประเมิน</button>` };
    case 'review':
      return { html: ticket('wait', 'หมอกำลังพิจารณา', 'delay', `ส่งคำตอบให้หมอแล้ว หมอจะตัดสินภายใน ${qz.review_hours} ชั่วโมง`,
        `<h2>ส่งคำตอบให้หมอแล้ว</h2><p class="muted" style="margin:0">หมอจะตัดสินภายใน ${qz.review_hours} ชั่วโมง แอปจะแจ้งเตือนทันที</p>
         <ul class="ans">${QUIZ().filter(q => c.ans[q.k]).map(q => `<li class="${isRisk(q, c.ans) ? 'risk' : ''}"><b>${esc(c.ans[q.k])}</b>${q.q}</li>`).join('')}</ul>`), dock: '' };
    case 'followup':
      return { html: ticket('act', 'หมอนัดให้มาตรวจ', 'op', `หมอนัดให้มาตรวจ ${fd.date} ${fd.note}`,
        `<p class="qlab">วันนัด</p><h2 style="font-size:1.5rem">${fd.date}</h2><p class="muted" style="margin:0">${fd.note}</p>
         <ul class="rem" aria-label="การแจ้งเตือน">${fd.rem.map(r => `<li>${IC.bell}<span>แจ้งเตือน ${r}</span></li>`).join('')}</ul>
         <div class="row2"><button class="btn" data-act="calAdd">${IC.cal}ลงปฏิทิน</button><button class="btn" data-act="reschedule">ขอเลื่อนนัด</button></div>`), dock: '' };
    case 'refill':
      if (c.rdeliv === 0)
        return { html: ticket('go', 'หมอสั่งส่งยาต่อ', 'trans', `หมอสั่งส่งยารอบที่ ${c.round + 1} วันที่ ${refillDate(c.round, v)} ส่งถึงบ้านภายใน ${win} นาทีหลังเริ่มจัดส่ง`,
          `<p class="qlab">ส่งยารอบที่ ${c.round + 1} จาก ${c.rounds}</p><h2 style="font-size:1.5rem">${refillDate(c.round, v)}</h2>
           <p class="muted" style="margin:0">ตามที่หมอสั่ง ส่งถึงบ้านภายใน ${winTxt} นาทีหลังเริ่มจัดส่ง ไม่ต้องมาโรงพยาบาล</p>
           <div class="tip" style="margin-top:12px">${IC.bell}<span>แอปจะแจ้งเตือนตอนเริ่มจัดส่ง และตอนยามาถึง</span></div>`), dock: '' };
      return { html: ticket('go', `กำลังส่งยารอบที่ ${c.round + 1}`, 'trans', `ยารอบที่ ${c.round + 1} ตอนนี้${steps[c.rdeliv]}`, `<h2>ส่งถึงบ้านภายใน ${winTxt} นาที</h2><div class="perf"></div>${deliveryBlock(c.rdeliv)}`), dock: '' };
  }
  return { html: '', dock: '' };
}

function careMain() {
  const v = visit(), c = v.care, R = template(), hero = careHero(), D = C.D;
  const shown = visibleChat(v), last = shown[shown.length - 1], unread = unreadCount(v);
  const chat = `<button class="chatcard" data-act="careView" data-arg="chat"><span class="avatar" aria-hidden="true">${R?.doctor_initials || 'หมอ'}</span>
    <span style="flex:1;min-width:0"><b>แชทกับหมอ</b><span class="pv">${last ? (last.from === 'me' ? 'คุณ: ' : '') + esc(last.t) : 'ยังไม่มีข้อความ'}</span></span>
    ${unread ? `<span class="unread">${unread}<span class="sr"> ข้อความใหม่</span></span>` : IC.next}</button>`;
  const cur = { meds: 0, waitq: 1, assess: 1, review: 2, followup: 3, refill: 3 }[c.phase];
  const win = D.app.delivery.window_min.join('–');
  const steps = [
    [`รับยารอบที่ ${c.round}`, `ส่งถึงบ้านภายใน ${win} นาที`],
    ['ตอบแบบประเมินอาการ', 'หมอตั้งคำถามให้'],
    ['หมอพิจารณาผล', `ภายใน ${D.care.quiz.review_hours} ชั่วโมง`],
    ['หมอตัดสินใจ', c.decision === 'followup' ? 'นัดมาตรวจ ' + followDate(v).short : c.decision === 'refill' ? `ส่งยารอบที่ ${c.round + 1} ถึงบ้าน` : 'นัดมาตรวจ หรือ ส่งยาต่อ'],
  ];
  const rows = steps.map(([t, sub], i) => {
    const done = i < cur || (i === 3 && cur === 3), now = i === cur && !done;
    const pill = done ? '<span class="pill p-ok">เสร็จ</span>' : now ? `<span class="pill p-now">${c.phase === 'waitq' ? 'รอหมอส่ง' : 'ตอนนี้'}</span>` : '<span class="pill p-next">ยังไม่ถึง</span>';
    return `<li class="fs ${done ? 'ok' : now ? 'now' : 'next'}"><span class="sym n" aria-hidden="true">${done ? IC.check : i + 1}</span><span class="nm">${t}<small>${sub}</small></span><span class="st">${pill}</span></li>`;
  }).join('');
  const plan = `<div class="plan">
    <div class="who">${IC.care}<span>ทุกการตัดสินใจเรื่องนัดและยา หมอเป็นผู้ตัดสิน</span></div>
    <div>${IC.truck}<span>ส่งยาถึงบ้านภายใน ${win} นาทีทุกรอบ</span></div>
    <div>${IC.cal}<span>ยา 30 วัน แบ่งส่ง ${c.rounds} รอบ ตามที่หมอสั่ง</span></div>
    <div>${IC.rx}<span>ตอบแบบประเมินอาการทุก 7–10 วัน</span></div>
    <div>${IC.bell}<span>แจ้งเตือนทุกขั้น ทั้งนัดหมาย กินยา และยามาถึง</span></div></div>`;
  return {
    body: hero.html + chat + `<h2 class="sec">สถานะการติดตาม <span class="muted" style="font-weight:500;font-size:.857rem">รอบที่ ${c.round} จาก ${c.rounds}</span></h2><ol class="flow">${rows}</ol>`
      + `<h2 class="sec">แผนจากหมอ</h2>${plan}<p class="disc">ข้อมูลสมมติ ไม่ใช่คำแนะนำทางการแพทย์</p>` + demoLink(),
    dock: hero.dock, tabs: true,
  };
}

function quizView() {
  const U = C.U, n = U.care.qStep, qs = QUIZ(), q = qs[n], a = U.care.ans[q.k], R = template();
  const head = `<div class="rhead"><button class="back" data-act="quizBack" aria-label="ย้อนกลับ">${IC.back}ย้อนกลับ</button>
    <div class="prog p5" aria-hidden="true">${qs.map((x, i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</div>
    <span class="stepn" aria-label="ข้อที่ ${n + 1} จาก ${qs.length}">${n + 1}/${qs.length}</span></div>
    <p class="muted" style="margin:0 0 4px;font-size:.857rem">แบบประเมินจาก ${R?.doctor || 'หมอ'}</p>`;
  let body = `<h1 class="q" id="qq">${q.q}</h1>${q.hint ? `<p class="sub" style="margin-bottom:12px">${q.hint}</p>` : ''}
    <div style="margin-bottom:16px">${sayBtn(q.q + (q.opts ? '. ตัวเลือก ' + q.opts.join(', ') : ''), 'ฟังคำถาม', 'say2')}</div>`;
  if (q.text) body += `<label class="sr" for="qn">${q.q}</label><textarea class="inp" id="qn" data-bind="care.ans.${q.k}" placeholder="เช่น นอนไม่ค่อยหลับ ขาบวม">${esc(a || '')}</textarea>`;
  else body += `<div class="dlist" role="radiogroup" aria-labelledby="qq">${q.opts.map(o => `<button class="dopt" role="radio" aria-checked="${a === o}" data-act="quizPick" data-arg="${esc(o)}"><span class="rad"></span><span><b>${o}</b></span></button>`).join('')}</div>`;
  const last = n === qs.length - 1, risky = qs.some(x => isRisk(x, U.care.ans));
  if (last && risky) body += `<div class="warn" style="margin-top:16px">${IC.warn}<span>${C.D.care.quiz.risk_warning}</span></div>`;
  const dock = last ? `<button class="btn main" data-act="quizSend">${IC.send}ส่งให้หมอ</button>` : `<button class="btn main" data-act="quizNext" ${a ? '' : 'disabled'}>ถัดไป</button>`;
  return { body: head + body, dock, tabs: true };
}

function chatView() {
  const v = visit(), R = template(), D = C.D;
  const msgs = visibleChat(v).map(m => `<div class="msg ${m.from}">${esc(m.t)}<time>${hhmmOf(new Date(m.at))}</time>${m.from === 'doc' ? `<button class="lis" data-act="speak" data-say="${esc(m.t)}" aria-label="ฟังข้อความจากหมอ">${IC.speak}ฟัง</button>` : ''}</div>`).join('');
  const body = `<div class="chead"><button class="back" data-act="careView" data-arg="main" aria-label="กลับ">${IC.back}กลับ</button><span class="avatar" aria-hidden="true">${R?.doctor_initials || 'หมอ'}</span>
      <span><b>${R?.doctor || 'หมอ'}</b><small>${dept().name} ${D.care.chat.hours}</small></span></div>
    <div class="emerg">${IC.warn}<span>เรื่องฉุกเฉิน อย่ารอแชท โทร 1669</span></div>
    <div class="msgs" aria-live="polite">${msgs}${doctorTyping(v) ? '<div class="typing">หมอกำลังพิมพ์...</div>' : ''}</div>`;
  const dock = `<div class="qr">${D.care.chat.quick.map(t => `<button class="chip" data-act="chatQuick" data-arg="${esc(t)}">${t}</button>`).join('')}</div>
    <div class="cinput"><button class="cbtn mic" data-act="mic" aria-label="พูดแทนพิมพ์">${IC.mic}</button>
      <label class="sr" for="chatIn">พิมพ์ข้อความถึงหมอ</label><input class="inp" id="chatIn" data-bind="care.draft" placeholder="พิมพ์ข้อความถึงหมอ" value="${esc(C.U.care.draft)}">
      <button class="cbtn send" data-act="chatSend" aria-label="ส่งข้อความ">${IC.send}</button></div>`;
  return { body, dock, tabs: true };
}

export function careTab() {
  const v = visit();
  if (!v.result) {
    return { body: `<div class="empty"><div class="ill">${IC.care}</div><h1 class="q" style="font-size:1.333rem">การติดตามจะเริ่มหลังพบแพทย์</h1>
      <p class="muted">หมอจะส่งแบบประเมินอาการมาให้ตอบที่บ้าน<br>แล้วตัดสินว่าต้องนัดมาตรวจ หรือส่งยาต่อถึงบ้าน</p></div>`, dock: '', tabs: true };
  }
  const view = C.U.care.view;
  if (view === 'quiz' && v.care.phase === 'assess') return quizView();
  if (view === 'chat') return chatView();
  return careMain();
}
