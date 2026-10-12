// ไอคอน SVG inline + สัญลักษณ์ ASME + โลโก้ (ยกจาก prototype)
export const I = (d,extra='') => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true" ${extra}>${d}</svg>`;
export const IC = {
  now: I('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  nav: I('<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
  rx: I('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>'),
  speak: I('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
  back: I('<path d="M15 5l-7 7 7 7"/>'),
  check: I('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  wc: I('<circle cx="8" cy="5" r="2"/><circle cx="16" cy="5" r="2"/><path d="M6 9h4l-.5 6h-3zM16 9l-3 6h6z"/><path d="M8 15v5M16 15v5"/>'),
  info: I('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
  warn: I('<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4.5M12 17.5v.5"/>'),
  home: I('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>'),
  truck: I('<path d="M2 6h11v10H2zM13 9h4l4 4v3h-8"/><circle cx="6" cy="17.5" r="2"/><circle cx="17" cy="17.5" r="2"/>'),
  counter: I('<path d="M3 10h18v10H3zM6 10V5h12v5"/><path d="M10 15h4"/>'),
  phone: I('<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18h2"/>'),
  cal: I('<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
  bell: I('<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>'),
  sunrise: I('<path d="M3 18h18M6 14a6 6 0 0 1 12 0"/><path d="M12 4v3M4.5 8l2 2M19.5 8l-2 2"/>'),
  sun: I('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>'),
  sunset: I('<path d="M3 18h18M6 14a6 6 0 0 1 12 0"/><path d="M12 10V4M9.5 6.5L12 4l2.5 2.5"/>'),
  moon: I('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>'),
  cup: I('<path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM16 10h2a2.5 2.5 0 0 1 0 5h-2"/><path d="M8 3v3M12 3v3"/>'),
  door: I('<path d="M5 21V4l10-1v18M15 21h4V5h-4"/><circle cx="12" cy="12" r=".6"/>'),
  next: I('<path d="M5 12h12M13 7l5 5-5 5"/>'),
  zoomIn: I('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L20 20M10.5 7.5v6M7.5 10.5h6"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  minus: I('<path d="M5 12h14"/>'),
  rotl: I('<path d="M4 5v5h5"/><path d="M5.5 15a7.5 7.5 0 1 0 1.3-8.2L4 10"/>'),
  rotr: I('<path d="M20 5v5h-5"/><path d="M18.5 15a7.5 7.5 0 1 1-1.3-8.2L20 10"/>'),
  hand: I('<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 11V4a1.5 1.5 0 0 1 3 0v7M14 11V5.5a1.5 1.5 0 0 1 3 0V13M17 9.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.5a6 6 0 0 1-4.6-2.2L4.5 14.6a1.5 1.5 0 0 1 2.2-2L8 14"/>'),
  face: I('<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M9 10v1M15 10v1M12 10v4h-1M9.5 16.5a3.5 3.5 0 0 0 5 0"/>'),
  zoomOut: I('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L20 20M7.5 10.5h6"/>'),
  palette: I('<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.9 1.5-2-.4-1.3.4-2.5 1.8-2.5H18a3 3 0 0 0 3-3C21 7.4 17 3 12 3z"/><circle cx="7.5" cy="11.5" r="1.2"/><circle cx="10" cy="7.5" r="1.2"/><circle cx="14.5" cy="7.5" r="1.2"/>'),
  care: I('<path d="M3 12h4l2.5-6 5 12 2.5-6h4"/>'),
  chat: I('<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>'),
  send: I('<path d="M4 12l16-8-5.5 16-3-7z"/><path d="M11.5 13L20 4"/>'),
  mic: I('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>'),
};
export const ASME = {
  op:   '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="11"/></svg>',
  insp: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="5" y="5" width="22" height="22"/></svg>',
  delay:'<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M7 5h9a11 11 0 0 1 0 22H7z"/></svg>',
  trans:'<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M3 12h15V6l11 10-11 10v-6H3z"/></svg>',
};
export const SYMNAME = {op:'ปฏิบัติงาน', insp:'ตรวจสอบ', delay:'รอ', trans:'เคลื่อนย้าย'};
/** โลโก้ Closely DR. (วงกลมเปิด + กากบาท) */
export const LOGO = (sz=44, ring=true) => `<svg class="lgm" width="${sz}" height="${sz}" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="18" fill="#12234A"/>${ring?'<rect x=".75" y=".75" width="62.5" height="62.5" rx="17.3" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="1.5"/>':''}<path d="M43.3 20.7A16 16 0 1 0 43.3 43.3" fill="none" stroke="#7DDCF0" stroke-width="7" stroke-linecap="round"/><path d="M32 25v14M25 32h14" stroke="#fff" stroke-width="5.5" stroke-linecap="round"/><circle cx="49" cy="32" r="3.8" fill="#7DDCF0"/></svg>`;
