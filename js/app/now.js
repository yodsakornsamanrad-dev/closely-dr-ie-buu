// แท็บ "ตอนนี้": การ์ดสถานะ, คำถามความรู้สึก, ผังขั้นตอน ASME และเวลารวม
import { C, visit, dept, qText, callText, ahead, stage, ticket, spell, phaseText, deliveryWindow, template } from './ctx.js';
import { route, walkTime } from '../lib/floor.js';
import { zoneOf, ZONES, aheadText, zoneTip, waitMinutes, waitText } from '../lib/queue.js';
import { flowRows, totalMinutes, fmtMin } from '../lib/timeline.js';
import { place } from '../lib/floor.js';
import { esc } from '../lib/util.js';
import { IC, ASME, SYMNAME } from '../ui/icons.js';

export function deliveryBlock(d, v = visit()) {
  const steps = C.D.app.delivery.steps, left = C.D.app.delivery.eta_left;
  return `<dl class="meta"><div><dt>ถึงประมาณ</dt><dd style="font-size:1.222rem">${deliveryWindow(v)}</dd></div>
    <div><dt>${d < 4 ? 'อีกประมาณ' : 'สถานะ'}</dt><dd>${d < 4 ? left[d] + ' <small>นาที</small>' : '<small style="font-size:1.111rem;font-weight:700">ส่งถึงแล้ว</small>'}</dd></div></dl>
    <ol class="track" aria-label="ความคืบหน้าการส่งยา ขั้นที่ ${d + 1} จาก ${steps.length}">${steps.map((t, i) => `<li class="${i < d ? 'ok' : i === d ? 'now' : ''}"><span class="m">${i < d ? IC.check : ''}</span><span>${t}${i === d ? ' <span class="sr">(ตอนนี้)</span>' : ''}</span></li>`).join('')}</ol>`;
}

function statusPanel() {
  const D = C.D, v = visit(), q = qText(), a = ahead(), d = dept(), room = d.exam_room, steps = D.app.delivery.steps;
  const win = D.app.delivery.window_min.join('–');
  switch (v.stage) {
    case 'vitals': {
      if (!v.arrived) {
        const r = route(D, v.loc, 'screen', v.dept);
        return {
          html: ticket('act', 'ต้องทำตอนนี้', 'insp', `ไปจุดคัดกรอง วัดความดัน ระยะ ${r.m} เมตร เดิน${walkTime(D, r.m)}นาที`,
            `<h2>ไปจุดคัดกรอง วัดความดัน</h2>
           ${r.same ? '' : `<div class="walk"><span><b>${r.m}</b> เมตร</span><span>เดิน <b>${walkTime(D, r.m)}</b> นาที</span></div>`}
           <div class="perf"></div><p class="qlab">เลขคิวของคุณ</p><p class="qno sm">${q}</p>`),
          dock: `<button class="btn main" data-act="goNav">${IC.nav}นำทางไปจุดคัดกรอง</button>`,
        };
      }
      return {
        html: ticket('wait', 'รอสักครู่', 'insp', 'รอพยาบาลเรียกวัดความดัน',
          `<h2>รอพยาบาลเรียกวัดความดัน</h2><p class="muted" style="margin:0">นั่งรอที่จุดคัดกรองได้เลย</p>
         <div class="perf"></div><p class="qlab">เลขคิวของคุณ</p><p class="qno sm">${q}</p>`), dock: '',
      };
    }
    case 'waiting': {
      const z = zoneOf(a, D.app.alerts), tip = zoneTip(a, D.app.alerts), at = aheadText(a);
      const zone = `<div class="zbar" role="img" aria-label="โซนตอนนี้: ${ZONES[z]}">${ZONES.map((t, i) => `<div class="zs ${i < z ? 'past' : i === z ? 'on' : ''}"><i></i><span>${t}</span></div>`).join('')}</div>`;
      const mins = waitMinutes(a, D.app.minutes_per_queue);
      return {
        html: ticket('wait', 'รอเรียกคิว', 'delay', `เลขคิว ${spell(q)} ${at} กำลังเรียก ${spell(callText())} รอประมาณ ${mins} นาที ${tip}`,
          `<p class="qlab">เลขคิวของคุณ</p><p class="qno">${q}</p><p class="ahead">${at}</p>
         ${zone}
         <div class="tip" style="margin-top:12px">${z === 0 ? IC.wc : IC.bell}<span>${tip}</span></div>
         <div class="perf"></div>
         <dl class="meta"><div><dt>กำลังเรียก</dt><dd>${callText()}</dd></div><div><dt>รอประมาณ</dt><dd>${waitText(mins)}</dd></div></dl>`),
        dock: `<button class="btn" data-act="goNav">${IC.nav}นำทางไปหน้าห้องตรวจ</button>`,
      };
    }
    case 'consult':
      return {
        html: ticket('go', 'ถึงคิวคุณแล้ว', 'op', `ถึงคิวคุณแล้ว เลขคิว ${spell(q)} เข้า${room}ได้เลย`,
          `<p class="qlab">เลขคิวของคุณ</p><p class="qno">${q}</p><h2>ถึงคิวคุณแล้ว<br>เข้า${room}ได้เลย</h2><p class="muted" style="margin:0">${d.name}</p>`),
        dock: `<button class="btn main go" data-act="goNav">${IC.nav}นำทางไป${room}</button>`,
      };
    case 'pharmacy': {
      if (v.rx === 'self') {
        return {
          html: ticket('act', 'ไปรับยา', 'op', `ไปรับยาที่การเงินและห้องยา แสดงเลขคิว ${spell(q)} ที่ช่องจ่ายยา`,
            `<h2>รับยาที่การเงิน &amp; ห้องยา</h2><p class="muted" style="margin:0">แสดงเลขคิวนี้ที่ช่องจ่ายยา</p>
           <div class="perf"></div><p class="qlab">เลขคิวรับยา</p><p class="qno">${q}</p>
           <div class="tip">${IC.info}<span>เปลี่ยนใจได้ ยังเลือกส่งยาถึงบ้านได้จนกว่าจะจ่ายยา</span></div>
           <button class="btn ghost" data-act="rxReset">เปลี่ยนเป็นส่งยาถึงบ้าน</button>`),
          dock: `<button class="btn main" data-act="goNav">${IC.nav}นำทางไปห้องยา</button><button class="btn" data-act="pickedUp">${IC.check}รับยาครบแล้ว</button>`,
        };
      }
      const n = template()?.meds.length || 0;
      return {
        html: ticket('act', 'เลือกวิธีรับยา', 'op', 'พบแพทย์เสร็จแล้ว รับยาแบบไหนดี ส่งยาถึงบ้าน หรือ รับเองที่ห้องยา',
          `<h2>รับยาแบบไหนดี</h2><p class="muted" style="margin:0">ยา ${n} รายการ ดูวิธีกินได้ที่แท็บผลและยา</p>
         <div class="choice">
           <button class="opt" aria-expanded="${C.U.addrOpen}" data-act="rxDelivery"><span class="ic">${IC.truck}</span><span><b>ส่งยาถึงบ้าน</b><span>ถึงบ้านภายใน ${win} นาที ยาแยกซองตามมื้อ รอบต่อไปส่งให้ตามหมอสั่ง</span><br><span class="badge">ไม่ต้องรอ</span></span></button>
           ${C.U.addrOpen ? `<div class="addr"><label class="f" for="ad">ที่อยู่สำหรับส่งยา</label>
              <textarea class="inp" id="ad" data-bind="addr">${esc(C.U.addr)}</textarea>
              <button class="btn main" data-act="rxConfirm">ยืนยันส่งยาถึงบ้าน</button></div>` : ''}
           <button class="opt" data-act="rxSelf"><span class="ic">${IC.counter}</span><span><b>รับเองที่ห้องยา</b><span>รอคิวประมาณ ${D.app.pharmacy_wait_min} นาที</span></span></button>
         </div>`), dock: '',
      };
    }
    case 'done':
    default: {
      if (!v.left_at) {
        const r = route(D, v.loc, 'entrance', v.dept);
        const dl = v.rx === 'delivery' ? `<div class="tip" style="margin-top:12px">${IC.truck}<span>${v.deliv < 4 ? `ยากำลังส่งถึงบ้าน ถึงประมาณ ${deliveryWindow(v)} กลับบ้านได้เลย ไม่ต้องรอ` : 'ยาส่งถึงบ้านแล้ว'}</span></div>` : '';
        return {
          html: ticket('go', 'ขั้นสุดท้าย', 'trans', `ขั้นสุดท้าย เดินไปทางออก ระยะ ${r.m} เมตร เมื่อถึงทางออก กดปุ่ม ถึงทางออกแล้ว กลับบ้าน`,
            `<h2>เดินไปทางออก แล้วกด<br>"ถึงทางออกแล้ว กลับบ้าน"</h2><p class="muted" style="margin:0">ไม่มีขั้นตอนที่ต้องทำในโรงพยาบาลแล้ว</p>
           ${r.same ? '' : `<div class="walk"><span><b>${r.m}</b> เมตร</span><span>เดิน <b>${walkTime(D, r.m)}</b> นาที</span></div>`}${dl}`),
          dock: `<button class="btn main" data-act="checkout">${IC.home}ถึงทางออกแล้ว กลับบ้าน</button>${r.same ? '' : `<button class="btn" data-act="goNav">${IC.nav}นำทางไปทางออก</button>`}`,
        };
      }
      const nextTxt = v.care.phase === 'meds' && v.rx === 'delivery' ? 'รอรับยาที่บ้าน' : phaseText(v.care.phase);
      return {
        html: ticket('done', 'จบการตรวจวันนี้', 'op', 'จบการตรวจวันนี้แล้ว ขอบคุณค่ะ เดินทางกลับบ้านปลอดภัยนะคะ',
          `<h2>จบการตรวจวันนี้แล้ว</h2><p class="muted" style="margin:0">ขอบคุณค่ะ เดินทางกลับบ้านปลอดภัยนะคะ</p>
         <div class="perf"></div><dl class="meta"><div><dt>ใช้เวลาที่ รพ.</dt><dd>${fmtMin(totalMinutes(v))} <small>นาที</small></dd></div><div><dt>ขั้นต่อไป</dt><dd style="font-family:var(--font);font-size:.929rem;line-height:1.35">${nextTxt}</dd></div></dl>
         <div class="tip" style="margin-top:8px">${IC.care}<span>การรักษาต่อจากนี้ ติดตามได้ที่แท็บ "ติดตาม" หมอจะส่งแบบประเมินอาการมาให้</span></div>`),
        dock: `<button class="btn main" data-act="tab" data-arg="care">${IC.care}ดูการติดตามการรักษา</button>`,
      };
    }
  }
}

function feelCard() {
  const U = C.U, D = C.D;
  if (!U.feelAsk) return '';
  const st = stage(U.feelAsk);
  let h = `<section class="feel" aria-labelledby="fh"><h3 id="fh">${st ? `ขั้น "${st.name}" เป็นอย่างไรบ้าง` : 'ภาพรวมการมาโรงพยาบาลวันนี้เป็นอย่างไรบ้าง'}</h3>
    <div class="faces" role="group" aria-label="ให้คะแนน 1 ถึง 5">${D.app.faces.map(([e, t], i) => `<button class="face" aria-pressed="${U.feelScore === i + 1}" data-act="feel" data-arg="${i + 1}"><span class="e" aria-hidden="true">${e}</span>${t}</button>`).join('')}</div>`;
  if (U.feelScore && U.feelScore <= 3) {
    h += `<p style="margin:var(--s4) 0 var(--s2);font-weight:600" id="fr">อะไรที่ทำให้ไม่สะดวก</p>
      <div class="chips" role="group" aria-labelledby="fr">${D.app.reasons.map(r => `<button class="chip" aria-pressed="${U.feelReasons.includes(r)}" data-act="feelReason" data-arg="${esc(r)}">${r}</button>`).join('')}</div>
      <div class="row2"><button class="btn main" data-act="feelSend">ส่ง</button></div>`;
  }
  return h + `<button class="btn ghost" data-act="feelSkip" style="margin-top:4px">ไม่ตอบ</button></section>`;
}

function flowChart() {
  const D = C.D, v = visit();
  const rows = flowRows(D, v).map(r => {
    if (r.kind === 'walk') return `<li class="fw"><span class="sym">${ASME.trans}</span>เดิน ${r.m} ม.</li>`;
    const pill = r.status === 'ok' ? '<span class="pill p-ok">เสร็จ</span>' : r.status === 'now' ? '<span class="pill p-now">ตอนนี้</span>' : '<span class="pill p-next">ยังไม่ถึง</span>';
    return `<li class="fs ${r.status}"><span class="sym" title="${SYMNAME[r.sym]}" role="img" aria-label="${SYMNAME[r.sym]}">${ASME[r.sym]}</span>
      <span class="nm">${r.name}<small>${place(D, r.place, v.dept).name}</small></span>
      <span class="st">${pill}${r.minutes !== null ? `<b>${fmtMin(r.minutes)} นาที</b>` : ''}</span></li>`;
  }).join('');
  return `<h2 class="sec">ขั้นตอนวันนี้</h2><ol class="flow">${rows}</ol>
    <p class="total"><span>${v.left_at ? 'ใช้เวลาทั้งหมดวันนี้' : 'ใช้เวลาไปแล้ว'}</span><b>${fmtMin(totalMinutes(v))} นาที</b></p>
    <div class="legend" aria-label="ความหมายสัญลักษณ์">
      <span>${ASME.op}ทำ</span><span>${ASME.insp}ตรวจ</span><span>${ASME.delay}รอ</span><span>${ASME.trans}เดิน</span></div>`;
}

export function nowTab() {
  const sp = statusPanel(), v = visit();
  const body = sp.html + feelCard() + flowChart() +
    `<p style="text-align:center;margin-top:var(--s5)"><button class="link" data-act="leaveAsk">${v.left_at ? 'รับคิวใหม่ หรือลงชื่อออก' : 'ออกจากคิวนี้บนเครื่องนี้'}</button></p>`;
  return { body, dock: sp.dock, tabs: true };
}
