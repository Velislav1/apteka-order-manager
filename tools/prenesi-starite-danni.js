// Пренасяне на заявките от старата версия (C:\AptekaZayavki\data\zayavki.db).
// Пуска се на ГЛАВНИЯ компютър (там вече има Node.js). Нищо не трие и не праща
// никъде – само прави файл „stari-zayavki.json“ на работния плот. После в новата
// програма (Главен → Всички → „📂 Пренеси / възстанови“) се избира този файл.

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { DatabaseSync } = require('node:sqlite');

const src = process.argv[2] || 'C:\\AptekaZayavki\\data\\zayavki.db';
if (!fs.existsSync(src)) {
  console.error(`\n  Не намирам старата база: ${src}\n`);
  process.exit(1);
}

const db = new DatabaseSync(src, { readOnly: true });
const requests = db.prepare('SELECT * FROM requests ORDER BY id').all();
const history = db.prepare('SELECT * FROM history ORDER BY id').all();
const byReq = {};
for (const h of history) (byReq[h.request_id] ||= []).push({ status: h.status, comment: h.comment, by: h.by, at: h.at });
const data = requests.map(r => ({ ...r, history: byReq[r.id] || [] }));

const desktop = [path.join(os.homedir(), 'Desktop'), path.join(os.homedir(), 'OneDrive', 'Desktop')].find(d => fs.existsSync(d)) || os.homedir();
const out = path.join(desktop, 'stari-zayavki.json');
fs.writeFileSync(out, JSON.stringify(data), 'utf8');
console.log(`\n  ✓ ${data.length} заявки са записани в:\n    ${out}\n`);
console.log('  Сега отворете новата програма (Главен) → „Всички“ → „📂 Пренеси / възстанови“ и изберете този файл.\n');
