import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadData } from '../../js/lib/data.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
export const D = await loadData(name => readFile(root + name, 'utf8'));

export function memoryStore(D0, init) {
  let s = init;
  return { get: () => s, set: v => { s = v; } };
}

/** นาฬิกาที่เลื่อนได้ */
export function fakeClock(start = '2026-10-12T08:00:00+07:00') {
  let t = new Date(start).getTime();
  const clock = () => new Date(t);
  clock.add = min => { t += min * 60000; };
  return clock;
}
