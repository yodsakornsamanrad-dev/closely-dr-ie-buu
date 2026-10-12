'use strict';
// สร้างโฟลเดอร์ _site สำหรับ GitHub Pages (โหมดไม่มี server)
//   public/*                  → _site/
//   data/seed.yaml            → _site/seed.yaml
//   yaml (browser build)      → _site/vendor/yaml/
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, '_site');
const yamlBrowser = path.join(path.dirname(require.resolve('yaml/package.json')), 'browser', 'dist');

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(path.join(root, 'public'), out, { recursive: true });
fs.copyFileSync(path.join(root, 'data', 'seed.yaml'), path.join(out, 'seed.yaml'));
fs.cpSync(yamlBrowser, path.join(out, 'vendor', 'yaml'), { recursive: true });
fs.writeFileSync(path.join(out, '.nojekyll'), '');
console.log('สร้าง _site/ เรียบร้อย — อัปโหลดขึ้น GitHub Pages ได้เลย');
