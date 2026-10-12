// โหลดข้อมูลอ้างอิงจาก data/*.yaml แล้วจัดรูปให้ใช้ง่าย
// readText(name) → Promise<string> (เบราว์เซอร์ใช้ fetch, Node ใช้ fs)
import yaml from '../../vendor/js-yaml.mjs';

export const DATA_FILES = ['app', 'departments', 'floor-map', 'results', 'care', 'demo-patients'];

export async function loadData(readText) {
  const raw = {};
  await Promise.all(DATA_FILES.map(async f => {
    const text = await readText(`data/${f}.yaml`);
    try { raw[f] = yaml.load(text); }
    catch (e) { throw new Error(`data/${f}.yaml รูปแบบ YAML ไม่ถูกต้อง: ${e.message}`); }
  }));
  return buildData(raw);
}

export function buildData(raw) {
  const app = raw.app, dep = raw.departments, floor = raw['floor-map'], results = raw.results, care = raw.care, demo = raw['demo-patients'];
  const depts = {};
  for (const d of dep.departments) depts[d.key] = d;
  return {
    app, floor, care, demo,
    stages: app.stages,
    deptList: dep.departments,
    depts,
    unsure: dep.unsure,
    templates: results.templates,
    template: id => results.templates.find(t => t.id === id) || null,
    room: k => floor.rooms.find(r => r.key === k) || null,
  };
}
