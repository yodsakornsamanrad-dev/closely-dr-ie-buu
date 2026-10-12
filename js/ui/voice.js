// เสียงอ่านภาษาไทยแบบเสียงผู้หญิง (pickVoice / speak จาก prototype)
// เลือกเสียงภาษาไทยที่เป็นผู้หญิงของเครื่อง เสียงสูงขึ้นเล็กน้อย พูดช้า และลงท้าย "ค่ะ"
let TH_VOICE = null;
const hasTTS = () => typeof speechSynthesis !== 'undefined';

export function pickVoice() {
  try {
    const vs = speechSynthesis.getVoices().filter(v => /^th/i.test(v.lang));
    if (!vs.length) return null;
    const male = /niwat|pattara|male(?!.*female)|ชาย/i, fem = /kanya|narisa|premwadee|achara|female|หญิง|google/i;
    return vs.find(v => fem.test(v.name) && !male.test(v.name)) || vs.find(v => !male.test(v.name)) || vs[0];
  } catch { return null; }
}
try { if (hasTTS()) { TH_VOICE = pickVoice(); speechSynthesis.addEventListener('voiceschanged', () => { TH_VOICE = pickVoice(); }); } } catch { /* ไม่มีเสียง */ }

export function sweeten(t) {
  t = String(t).trim().replace(/[.。]+$/, '');
  return /(ค่ะ|คะ|นะคะ)$/.test(t) ? t : t + ' ค่ะ';
}

export function speak(t) {
  try {
    if (!hasTTS()) return;
    speechSynthesis.cancel();
    if (!TH_VOICE) TH_VOICE = pickVoice();
    const u = new SpeechSynthesisUtterance(sweeten(t));
    u.lang = 'th-TH'; if (TH_VOICE) u.voice = TH_VOICE;
    u.pitch = 1.18; u.rate = 0.86; u.volume = 1;
    speechSynthesis.speak(u);
  } catch { /* เครื่องนี้อ่านออกเสียงไม่ได้ */ }
}
export const voiceName = () => (TH_VOICE ? TH_VOICE.name : null);
