// Apteka Order Manager – облачна версия.
// Данните са в Supabase (Франкфурт), затова всеки компютър работи сам –
// няма значение дали главният е включен. Ролята идва от страницата
// (glaven/, pomoshtnik/, sluzhitel/) и от паролата, въведена веднъж на компютъра.

const SUPABASE_URL = 'https://kwftohuxtwxxzwhtwwht.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ovO5h9qCKeHaoGEBAVfImQ_ZyOOfkdS'; // публичен ключ – защитата е в базата (RLS)

const ROLES = {
  glaven:     { email: 'glaven@apteka-zayavki.app',     label: '🛒 Поръчващ',          name: 'Главен' },
  pomoshtnik: { email: 'pomoshtnik@apteka-zayavki.app', label: '📋 Помощник поръчващ', name: 'Помощник поръчващ' },
  sluzhitel:  { email: 'sluzhitel@apteka-zayavki.app',  label: '👀 Служител',          name: 'Служител' },
};
const ROLE = ROLES[window.ROLE] ? window.ROLE : 'sluzhitel';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { storageKey: `apteka-${ROLE}`, persistSession: true, autoRefreshToken: true },
});

// ---------- Разметка ----------
document.body.insertAdjacentHTML('afterbegin', `
<div id="offline" class="offline-bar" hidden>⚠️ Няма връзка с интернет – промените ще се покажат, когато връзката се върне.</div>
<header>
  <h1>💊 Заявки</h1>
  <span class="pill"><span id="conn" class="dot"></span><span id="connText">Свързване…</span></span>
  <span class="grow"></span>
  <button class="pill install" id="installBtn" hidden>📥 Инсталирай на този компютър</button>
  <button class="pill" id="role" title="Изход от този компютър"></button>
  <button class="pill" id="meBtn" title="Смяна на името">👤 <span id="meName"></span></button>
</header>

<main>
  <section class="panel newreq">
    <h2>Нова заявка</h2>
    <p class="sub">Отива веднага при поръчващия.</p>
    <form id="newForm" autocomplete="off">
      <label class="f">Пациент</label>
      <input name="patient" maxlength="120" required placeholder="Име и фамилия">
      <label class="f">Лекарство</label>
      <input name="medicine" maxlength="300" required placeholder="Име, доза, форма">
      <div class="two">
        <div><label class="f">Количество <span class="opt">(незад.)</span></label><input name="qty" maxlength="40" placeholder="1 опак."></div>
        <div><label class="f">Дата</label><input type="date" name="date" required></div>
      </div>
      <label class="f">Телефон <span class="opt">(незадължително)</span></label>
      <input name="phone" maxlength="40" inputmode="tel" placeholder="за да го уведомим">
      <label class="f">Бележка <span class="opt">(незадължително)</span></label>
      <textarea name="note" maxlength="500"></textarea>

      <label class="nzok-toggle">
        <input type="checkbox" id="nzokCheck"> 🏥 Заявката е по НЗОК <span class="opt">(незадължително)</span>
      </label>
      <div id="nzokBox" hidden>
        <label class="f" style="margin-top:8px">Код по НЗОК</label>
        <input name="nzok_code" maxlength="60" placeholder="напр. от протокола">
        <label class="f">МНН / международно име</label>
        <input name="nzok_name" maxlength="200" placeholder="международно непатентно наименование">
        <label class="f">Количество по НЗОК</label>
        <input name="nzok_qty" maxlength="40">
        <label class="f">Допълнителна информация</label>
        <textarea name="nzok_note" maxlength="500" placeholder="напр. номер на протокол, лекар..."></textarea>
      </div>

      <button class="btn primary big" type="submit">Изпрати заявката</button>
      <div id="formMsg" class="msg"></div>
    </form>
  </section>

  <section>
    <div class="bar">
      <div class="tabs" id="tabs">
        <button data-v="board">Табло<span class="count" id="cBoard"></span></button>
        <button data-v="cal">Календар</button>
        <button data-v="all">Всички</button>
      </div>
      <input type="search" class="search" id="search" placeholder="🔍 Търсене: пациент, лекарство, телефон, №">
    </div>

    <div id="vBoard" class="board"></div>

    <div id="vCal" class="panel" hidden>
      <div class="calhead">
        <button class="btn" id="calPrev" aria-label="Предишен месец">‹</button>
        <h2 id="calTitle"></h2>
        <button class="btn" id="calNext" aria-label="Следващ месец">›</button>
        <button class="btn" id="calToday">Днес</button>
        <span class="legend">▇ заявена на тази дата &nbsp; ┅ 📦 очаква се доставка</span>
      </div>
      <div class="calgrid" id="calGrid"></div>
    </div>

    <div id="vAll" class="panel" hidden>
      <div class="chips" id="chips"></div>
      <div class="tablewrap">
        <table>
          <thead><tr><th>№</th><th>Дата</th><th>Пациент</th><th>Лекарство</th><th>Статус</th><th>Последно</th></tr></thead>
          <tbody id="rows"></tbody>
        </table>
      </div>
      <div id="empty" class="empty" hidden>Няма заявки.</div>
    </div>
  </section>
</main>

<dialog id="dlg"><div class="dlg" id="dlgBody"></div></dialog>

<dialog id="nameDlg">
  <form class="dlg" id="nameForm" method="dialog">
    <h3>👋 Как се казвате?</h3>
    <p class="muted" style="margin-top:0">Името се записва към заявките, които въвеждате и променяте. Пита се само веднъж на този компютър.</p>
    <input id="nameInput" maxlength="60" required placeholder="напр. Мария" autocomplete="off">
    <footer><button class="btn primary" type="submit">Готово</button></footer>
  </form>
</dialog>

<dialog id="loginDlg">
  <form class="dlg" id="loginForm">
    <h3>🔒 ${ROLES[ROLE].label}</h3>
    <p class="muted">Първо пускане на този компютър. Въведете паролата за роля „${ROLES[ROLE].name}“.
      Пита се само веднъж.</p>
    <input id="loginPass" type="password" required autocomplete="current-password" placeholder="Парола">
    <div id="loginMsg" class="msg"></div>
    <footer><button class="btn primary" type="submit">Вход</button></footer>
  </form>
</dialog>

<input type="file" id="importFile" accept=".json,application/json" hidden>
<div id="toast"></div>
`);

// ---------- Данни ----------
const STATUSES = { new: 'Нова', ordered: 'Поръчана', arrived: 'Пристигнала', done: 'Взета от клиента', unavailable: 'Няма / отказана' };
const COLORS = { new: 'var(--new)', ordered: 'var(--ordered)', arrived: 'var(--arrived)', done: 'var(--done)', unavailable: 'var(--unavailable)' };
const FLOW = ['new', 'ordered', 'arrived', 'done'];
const NEXT_LABEL = { new: '✓ Поръчах', ordered: '✓ Пристигна', arrived: '✓ Взета от клиента' };
const COLUMNS = [
  ['new', 'Нови', 'чакат да бъдат поръчани'],
  ['ordered', 'Поръчани', 'чакат доставка'],
  ['arrived', 'Пристигнали', 'обадете се на клиента'],
];
const isOrderer = ROLE === 'glaven';
const canSeeBoard = ROLE !== 'sluzhitel';
let requests = [];
let view = 'board';
let allFilter = 'all';
let dayFilter = null;
let openId = null;
let calMonth = new Date(); calMonth.setDate(1);
try { view = ['board', 'cal', 'all'].includes(localStorage.getItem('view')) ? localStorage.getItem('view') : 'board'; } catch {}

// ---------- Помощни ----------
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ymd = d => d.toLocaleDateString('sv-SE');
const today = () => ymd(new Date());
const addDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };
const fmtDate = d => d ? d.split('-').reverse().join('.') : '';
const shortDate = d => d ? d.split('-').reverse().slice(0, 2).join('.') : '';
const fmtTime = iso => new Date(iso).toLocaleString('bg-BG', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const badge = s => `<span class="badge" style="--c:${COLORS[s]}">${esc(STATUSES[s] || s)}</span>`;
const isLate = r => r.expected && r.expected < today() && (r.status === 'new' || r.status === 'ordered');
const hasNzok = r => !!(r.nzok_code || r.nzok_name || r.nzok_qty || r.nzok_note);
const userComment = c => String(c || '').replace(/(^| · )(Очаква се на [\d.]+|Датата на доставка е премахната)$/, '').trim();
const nextOf = s => { const i = FLOW.indexOf(s); return i >= 0 && i < FLOW.length - 1 ? FLOW[i + 1] : null; };

// Грешките от базата идват като текст на български (виж schema.sql).
function failText(error) {
  const m = error?.message || '';
  if (/fetch|network|Failed/i.test(m)) return 'Няма връзка с интернет. Опитайте пак.';
  return m || 'Грешка при връзката';
}
async function rpc(fn, args) {
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw new Error(failText(error));
  return data;
}
// Supabase връща най-много 1000 реда наведнъж – теглим на страници.
async function fetchAll(table, order, ascending, max = Infinity) {
  const out = [];
  for (let from = 0; from < max; from += 1000) {
    const to = Math.min(from + 1000, max) - 1;
    const { data, error } = await sb.from(table).select('*').order(order, { ascending }).range(from, to);
    if (error) throw new Error(failText(error));
    out.push(...data);
    if (data.length < to - from + 1) break;
  }
  return out;
}

function toast(text) {
  const t = $('#toast');
  t.textContent = text; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 3200);
}
function beep() {
  try {
    const ctx = new AudioContext();
    [0, 0.18].forEach(delay => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.15, ctx.currentTime + delay);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.15);
      o.start(ctx.currentTime + delay); o.stop(ctx.currentTime + delay + 0.16);
    });
  } catch {}
}
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// ---------- Име на служителя ----------
let myName = '';
try { myName = localStorage.getItem('me') || ''; } catch {}
function showName() { $('#meName').textContent = myName || 'Въведете име'; }
function askName() { $('#nameInput').value = myName; $('#nameDlg').showModal(); $('#nameInput').focus(); }
$('#nameForm').addEventListener('submit', () => {
  myName = $('#nameInput').value.trim();
  try { localStorage.setItem('me', myName); } catch {}
  showName();
});
$('#meBtn').onclick = askName;
const needName = () => { if (myName) return false; askName(); return true; };

// ---------- Нова заявка ----------
const form = $('#newForm');
form.date.value = today();
$('#nzokCheck').addEventListener('change', e => { $('#nzokBox').hidden = !e.target.checked; });
form.addEventListener('submit', async e => {
  e.preventDefault();
  if (needName()) return;
  const msg = $('#formMsg');
  const body = Object.fromEntries(new FormData(form));
  if (!$('#nzokCheck').checked) { delete body.nzok_code; delete body.nzok_name; delete body.nzok_qty; delete body.nzok_note; }
  body.by = myName;
  const btn = form.querySelector('[type=submit]');
  btn.disabled = true;
  try {
    const row = await rpc('create_request', { p: body });
    upsert(row); render(row.id);
    form.reset(); form.date.value = today(); $('#nzokBox').hidden = true; form.patient.focus();
    msg.className = 'msg ok'; msg.textContent = `✓ Заявка №${row.id} е изпратена`;
    setTimeout(() => { msg.textContent = ''; }, 4000);
  } catch (err) {
    msg.className = 'msg err'; msg.textContent = err.message;
  } finally { btn.disabled = false; }
});

// ---------- Смяна на статус ----------
async function changeStatus(r, status, extra = {}) {
  if (needName()) return false;
  try {
    const row = await rpc('set_status', { p_id: r.id, p: { status, by: myName, ...extra } });
    upsert(row); render();
    toast(`№${r.id} ${r.medicine} → ${STATUSES[status]}`);
    return true;
  } catch (err) { toast(err.message); return false; }
}

// „Поръчах“ пита кога се очаква доставката – така заявката влиза в календара.
function askOrdered(r) {
  openId = null;
  $('#dlgBody').innerHTML = `
    <h3 tabindex="-1" autofocus>Поръчано: ${esc(r.medicine)}</h3>
    <p class="muted" style="margin:-6px 0 14px">за ${esc(r.patient)}</p>
    <label class="f" style="margin-top:0">Кога се очаква доставката?</label>
    <div class="quick">
      <button type="button" data-d="${addDays(0)}">Днес</button>
      <button type="button" class="sel" data-d="${addDays(1)}">Утре</button>
      <button type="button" data-d="${addDays(2)}">Вдругиден</button>
      <button type="button" data-d="">Не знам</button>
    </div>
    <input type="date" id="oDate" value="${addDays(1)}">
    <label class="f">Коментар <span class="opt">(незадължително)</span></label>
    <input id="oComment" maxlength="500" placeholder="напр. от Софарма">
    <footer>
      <button class="btn" type="button" id="oCancel">Отказ</button>
      <button class="btn primary" type="button" id="oOk">✓ Поръчано</button>
    </footer>`;
  const quick = $('#dlgBody .quick');
  const markQuick = () => quick.querySelectorAll('button').forEach(x => x.classList.toggle('sel', x.dataset.d === $('#oDate').value));
  quick.onclick = e => { const b = e.target.closest('[data-d]'); if (b) { $('#oDate').value = b.dataset.d; markQuick(); } };
  $('#oDate').oninput = markQuick;
  $('#oCancel').onclick = () => $('#dlg').close();
  $('#oOk').onclick = async () => {
    if (await changeStatus(r, 'ordered', { expected: $('#oDate').value, comment: $('#oComment').value })) $('#dlg').close();
  };
  if (!$('#dlg').open) $('#dlg').showModal();
}

function goNext(r) {
  const n = nextOf(r.status);
  if (!n) return;
  if (n === 'ordered') askOrdered(r); else changeStatus(r, n);
}
function markUnavailable(r) {
  if (confirm(`„${r.medicine}“ за ${r.patient}: няма / отказана?`)) changeStatus(r, 'unavailable');
}

// ---------- Табло ----------
function cardHtml(r) {
  const n = nextOf(r.status);
  return `<article class="card" data-id="${r.id}" style="--c:${COLORS[r.status]}">
    <div class="top"><span>№${r.id} · ${shortDate(r.date)}</span><span>${esc(r.created_by)}</span></div>
    <div class="med">${esc(r.medicine)}${r.qty ? ` <span class="qty">× ${esc(r.qty)}</span>` : ''}</div>
    <div class="pat">${esc(r.patient)}${r.phone ? ` · <a href="tel:${esc(r.phone)}">${esc(r.phone)}</a>` : ''}</div>
    ${hasNzok(r) ? '<span class="nzok-tag">🏥 НЗОК</span>' : ''}
    ${r.expected && r.status === 'ordered' ? `<span class="exp ${isLate(r) ? 'late' : ''}">📦 ${isLate(r) ? 'закъснява – ' : ''}очаква се ${shortDate(r.expected)}</span>` : ''}
    ${r.note ? `<div class="line">📝 ${esc(r.note)}</div>` : ''}
    ${userComment(r.last_comment) ? `<div class="line">💬 ${esc(userComment(r.last_comment))}</div>` : ''}
    ${isOrderer && n ? `<div class="acts">
      <button class="go" data-act="next" style="--next:${COLORS[n]}">${NEXT_LABEL[r.status]}</button>
      ${r.status !== 'arrived' ? '<button class="no" data-act="no" title="Няма / отказана">Няма</button>' : ''}
    </div>` : ''}
  </article>`;
}

function renderBoard(list, flashId) {
  $('#vBoard').innerHTML = COLUMNS.map(([s, title, hint]) => {
    let items = list.filter(r => r.status === s);
    if (s === 'ordered') items.sort((a, b) => (a.expected || '9999').localeCompare(b.expected || '9999') || a.id - b.id);
    else items.sort((a, b) => a.id - b.id); // най-старите първи
    return `<div class="col">
      <h3><i style="background:${COLORS[s]}"></i>${title}<span class="n">${items.length}</span></h3>
      <div class="hint">${hint}</div>
      ${items.map(cardHtml).join('') || '<div class="none">Няма</div>'}
    </div>`;
  }).join('');
  if (flashId) $(`#vBoard .card[data-id="${flashId}"]`)?.classList.add('flash');
}
$('#vBoard').addEventListener('click', e => {
  if (e.target.closest('a')) return;
  const card = e.target.closest('.card');
  if (!card) return;
  const r = requests.find(x => x.id === Number(card.dataset.id));
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'next') goNext(r);
  else if (act === 'no') markUnavailable(r);
  else openDetail(r.id);
});

// ---------- Календар ----------
const MONTHS = ['Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни', 'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември'];
function renderCalendar(list) {
  $('#calTitle').textContent = `${MONTHS[calMonth.getMonth()]} ${calMonth.getFullYear()}`;
  const byDay = {};
  const add = (d, item) => { if (d) (byDay[d] ||= []).push(item); };
  for (const r of list) { add(r.date, { r, exp: false }); add(r.expected, { r, exp: true }); }
  const start = new Date(calMonth);
  start.setDate(1 - ((start.getDay() + 6) % 7)); // понеделник
  const t = today();
  let html = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map(d => `<div class="wd">${d}</div>`).join('');
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const key = ymd(d);
    const items = byDay[key] || [];
    html += `<div class="day ${d.getMonth() !== calMonth.getMonth() ? 'other' : ''} ${key === t ? 'today' : ''}" data-day="${key}">
      <span class="d">${d.getDate()}</span>
      ${items.slice(0, 4).map(({ r, exp }) => `<div class="ev ${exp ? 'exp' : ''}" data-id="${r.id}" style="--c:${COLORS[r.status]}"
        title="№${r.id} ${esc(r.medicine)} – ${esc(r.patient)} (${esc(STATUSES[r.status])})">${exp ? '📦 ' : ''}${esc(r.medicine)}</div>`).join('')}
      ${items.length > 4 ? `<div class="more">+${items.length - 4} още</div>` : ''}
    </div>`;
  }
  $('#calGrid').innerHTML = html;
}
$('#calGrid').addEventListener('click', e => {
  const ev = e.target.closest('.ev');
  if (ev) return openDetail(Number(ev.dataset.id));
  const day = e.target.closest('[data-day]');
  if (day) { dayFilter = day.dataset.day; allFilter = 'all'; setView('all'); }
});
$('#calPrev').onclick = () => { calMonth.setMonth(calMonth.getMonth() - 1); render(); };
$('#calNext').onclick = () => { calMonth.setMonth(calMonth.getMonth() + 1); render(); };
$('#calToday').onclick = () => { calMonth = new Date(); calMonth.setDate(1); render(); };

// ---------- Всички ----------
function renderAll(list) {
  const counts = {};
  for (const r of list) counts[r.status] = (counts[r.status] || 0) + 1;
  $('#chips').innerHTML =
    (dayFilter ? `<button class="chip day" data-clear>📅 ${fmtDate(dayFilter)} ✕</button>` : '') +
    [['all', 'Всички', list.length], ...Object.entries(STATUSES).map(([k, v]) => [k, v, counts[k] || 0])]
      .map(([k, label, n]) => `<button class="chip ${allFilter === k ? 'on' : ''}" data-f="${k}">${esc(label)} <b>${n}</b></button>`).join('') +
    `<span class="links"><button data-export>⬇ Excel</button>${isOrderer ? '<button data-backup>💾 Архив</button><button data-import>📂 Пренеси / възстанови</button>' : ''}</span>`;
  const rows = list.filter(r => allFilter === 'all' || r.status === allFilter);
  $('#rows').innerHTML = rows.map(r => `
    <tr data-id="${r.id}">
      <td>${r.id}</td>
      <td>${fmtDate(r.date)}</td>
      <td>${esc(r.patient)}${r.phone ? `<div class="muted">${esc(r.phone)}</div>` : ''}</td>
      <td><b>${esc(r.medicine)}</b>${r.qty ? ` <span class="muted">× ${esc(r.qty)}</span>` : ''}</td>
      <td>${badge(r.status)}${r.expected ? `<div class="muted">📦 ${fmtDate(r.expected)}</div>` : ''}</td>
      <td class="muted">${fmtTime(r.updated_at)}<br>${esc(r.updated_by)}</td>
    </tr>`).join('');
  $('#empty').hidden = rows.length > 0;
}
$('#chips').addEventListener('click', e => {
  if (e.target.closest('[data-clear]')) { dayFilter = null; return render(); }
  if (e.target.closest('[data-export]')) return exportCsv();
  if (e.target.closest('[data-backup]')) return backup(false);
  if (e.target.closest('[data-import]')) return $('#importFile').click();
  const b = e.target.closest('[data-f]');
  if (b) { allFilter = b.dataset.f; render(); }
});
$('#rows').addEventListener('click', e => {
  const tr = e.target.closest('tr[data-id]');
  if (tr) openDetail(Number(tr.dataset.id));
});

// ---------- Excel, архив, пренасяне ----------
const csvCell = v => { const s = String(v ?? ''); return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
async function exportCsv() {
  try {
    const all = await fetchAll('requests', 'id', true);
    const head = ['№', 'Дата', 'Пациент', 'Телефон', 'Лекарство', 'Количество', 'Бележка', 'Статус', 'Очаква се',
      'НЗОК код', 'НЗОК МНН', 'НЗОК количество', 'НЗОК бележка', 'Въвел', 'Последна промяна от', 'Последна промяна'];
    const lines = all.map(r => [r.id, fmtDate(r.date), r.patient, r.phone, r.medicine, r.qty, r.note, STATUSES[r.status],
      fmtDate(r.expected), r.nzok_code, r.nzok_name, r.nzok_qty, r.nzok_note,
      r.created_by, r.updated_by, new Date(r.updated_at).toLocaleString('bg-BG')].map(csvCell).join(';'));
    download(`zayavki-${today()}.csv`, '﻿' + [head.join(';'), ...lines].join('\r\n'), 'text/csv;charset=utf-8');
  } catch (err) { toast(err.message); }
}

// Пълен архив (заявки + история) във файл. Същият файл служи и за възстановяване.
async function backup(auto) {
  try {
    const [all, hist] = await Promise.all([fetchAll('requests', 'id', true), fetchAll('history', 'id', true)]);
    const byReq = {};
    for (const h of hist) (byReq[h.request_id] ||= []).push({ status: h.status, comment: h.comment, by: h.by, at: h.at });
    const data = all.map(r => ({ ...r, history: byReq[r.id] || [] }));
    download(`zayavki-arhiv-${today()}.json`, JSON.stringify(data), 'application/json');
    try { localStorage.setItem('lastBackup', today()); } catch {}
    if (!auto) toast(`Архивът е изтеглен (${data.length} заявки)`);
  } catch (err) { if (!auto) toast(err.message); }
}

$('#importFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); } catch { return toast('Файлът не е архив от програмата.'); }
  if (!Array.isArray(data)) return toast('Файлът не е архив от програмата.');
  if (!confirm(`Във файла има ${data.length} заявки. Да ги пренеса? (вече съществуващите номера се пропускат)`)) return;
  let added = 0;
  try {
    for (let i = 0; i < data.length; i += 300) {
      added += await rpc('import_legacy', { p: data.slice(i, i + 300) });
      toast(`Пренасяне… ${Math.min(i + 300, data.length)} / ${data.length}`);
    }
    toast(`✓ Пренесени ${added} заявки`);
    load();
  } catch (err) { toast(err.message); }
});

// ---------- Изгледи ----------
function setView(v) {
  view = v;
  try { localStorage.setItem('view', v); } catch {}
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  $('#vBoard').hidden = v !== 'board';
  $('#vCal').hidden = v !== 'cal';
  $('#vAll').hidden = v !== 'all';
  render();
}
$('#tabs').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) setView(b.dataset.v); });
$('#search').addEventListener('input', () => render());

function render(flashId) {
  const term = $('#search').value.trim().toLowerCase();
  const list = requests.filter(r => !term ||
    [r.patient, r.medicine, r.phone, r.note, String(r.id)].some(v => v.toLowerCase().includes(term)));
  const active = requests.filter(r => ['new', 'ordered', 'arrived'].includes(r.status)).length;
  const fresh = requests.filter(r => r.status === 'new').length;
  $('#cBoard').textContent = active ? `(${active})` : '';
  document.title = fresh ? `(${fresh}) Apteka Order Manager` : 'Apteka Order Manager';
  if (view === 'board') renderBoard(list, flashId);
  if (view === 'cal') renderCalendar(list);
  if (view === 'all') renderAll(dayFilter ? list.filter(r => r.date === dayFilter || r.expected === dayFilter) : list);
}

// ---------- Детайли ----------
async function openDetail(id) {
  const r = requests.find(x => x.id === id);
  if (!r) return;
  openId = id;
  const { data: hist } = await sb.from('history').select('*').eq('request_id', id).order('id');
  const n = nextOf(r.status);
  const cur = FLOW.indexOf(r.status);
  const steps = FLOW.map((s, i) => `${i ? '<span class="arrow">›</span>' : ''}<span class="step ${i <= cur ? 'done' : ''} ${i === cur ? 'cur' : ''}" style="--c:${COLORS[s]}">${esc(STATUSES[s])}</span>`).join('')
    + (r.status === 'unavailable' ? ` <span class="arrow">✕</span> ${badge(r.status)}` : '');

  const ordererTools = `
    ${n ? `<button type="button" class="go-big" id="dNext" style="--c:${COLORS[n]}">${NEXT_LABEL[r.status]}</button>` : ''}
    <label class="f">Очаква се доставка на</label>
    <div class="row" style="margin-top:0">
      <input type="date" id="dExp" value="${esc(r.expected)}" style="flex:1">
    </div>
    <div class="row">
      ${r.status !== 'unavailable' ? '<button type="button" class="btn" id="dNo">Няма / отказана</button>' : ''}
      <select id="dFix"><option value="">Корекция на статус…</option>${Object.entries(STATUSES)
        .filter(([k]) => k !== r.status).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select>
    </div>`;

  $('#dlgBody').innerHTML = `
    <h3 tabindex="-1" autofocus>№${r.id} · ${esc(r.medicine)} ${badge(r.status)}</h3>
    <dl class="kv">
      <dt>Пациент</dt><dd><b>${esc(r.patient)}</b></dd>
      <dt>Телефон</dt><dd>${r.phone ? `<a href="tel:${esc(r.phone)}">${esc(r.phone)}</a>` : '—'}</dd>
      <dt>Количество</dt><dd>${esc(r.qty) || '—'}</dd>
      <dt>Заявена</dt><dd>${fmtDate(r.date)} от ${esc(r.created_by)}</dd>
      <dt>Доставка</dt><dd>${r.expected ? `📦 ${fmtDate(r.expected)}${isLate(r) ? ' <b style="color:var(--danger)">(закъснява)</b>' : ''}` : '—'}</dd>
      ${r.note ? `<dt>Бележка</dt><dd>${esc(r.note)}</dd>` : ''}
      ${hasNzok(r) ? `<dt>🏥 НЗОК</dt><dd>${[
        r.nzok_code && `код: <b>${esc(r.nzok_code)}</b>`,
        r.nzok_name && `МНН: <b>${esc(r.nzok_name)}</b>`,
        r.nzok_qty && `количество: <b>${esc(r.nzok_qty)}</b>`,
      ].filter(Boolean).join(', ') || '—'}${r.nzok_note ? `<br><span class="muted">${esc(r.nzok_note)}</span>` : ''}</dd>` : ''}
    </dl>
    <h4>Статус</h4>
    <div class="steps">${steps}</div>
    ${isOrderer ? ordererTools : '<div class="info">🔒 Статуса го сменя поръчващият. Вие можете да добавите коментар.</div>'}
    <label class="f">Коментар</label>
    <textarea id="dComment" maxlength="500" placeholder="${isOrderer ? 'напр. от Софарма' : 'напр. клиентът звъня, пита кога'}"></textarea>
    <div id="dMsg" class="msg"></div>
    <h4>История</h4>
    <ul class="hist">${(hist || []).slice().reverse().map(h => `
      <li>${badge(h.status)} <span class="muted">${fmtTime(h.at)}${h.by ? ' · ' + esc(h.by) : ''}</span>${h.comment ? `<div>${esc(h.comment)}</div>` : ''}</li>`).join('')}</ul>
    <footer>
      <button class="btn" type="button" id="dEdit">✏️ Редактирай</button>
      <button class="btn" type="button" id="dClose">Затвори</button>
      <button class="btn primary" type="button" id="dSave">Запази</button>
    </footer>`;

  const body = status => {
    const b = { status, comment: $('#dComment').value };
    if (isOrderer) b.expected = $('#dExp').value;
    return b;
  };
  const save = async status => { if (await changeStatus(r, status, body(status))) $('#dlg').close(); };
  if ($('#dNext')) $('#dNext').onclick = () => (n === 'ordered' && !$('#dExp').value ? askOrdered(r) : save(n));
  if ($('#dNo')) $('#dNo').onclick = () => save('unavailable');
  if ($('#dFix')) $('#dFix').onchange = e => {
    const s = e.target.value;
    if (s && confirm(`Смяна на статуса на „${STATUSES[s]}“?`)) save(s); else e.target.value = '';
  };
  $('#dEdit').onclick = () => openEdit(r);
  $('#dClose').onclick = () => $('#dlg').close();
  $('#dSave').onclick = async () => {
    if (needName()) return;
    try {
      const row = await rpc('set_status', { p_id: id, p: { ...body(r.status), by: myName } });
      upsert(row); render();
      $('#dlg').close(); toast('Записано');
    } catch (err) { $('#dMsg').className = 'msg err'; $('#dMsg').textContent = err.message; }
  };
  if (!$('#dlg').open) $('#dlg').showModal();
}
$('#dlg').addEventListener('close', () => { openId = null; });

// ---------- Редакция на заявка (всеки може да поправи грешка) ----------
function openEdit(r) {
  $('#dlgBody').innerHTML = `
    <h3 tabindex="-1" autofocus>✏️ Редакция на №${r.id}</h3>
    <label class="f" style="margin-top:0">Пациент</label>
    <input id="ePatient" maxlength="120" value="${esc(r.patient)}">
    <label class="f">Лекарство</label>
    <input id="eMedicine" maxlength="300" value="${esc(r.medicine)}">
    <div class="two">
      <div><label class="f">Количество</label><input id="eQty" maxlength="40" value="${esc(r.qty)}"></div>
      <div><label class="f">Дата</label><input type="date" id="eDate" value="${esc(r.date)}"></div>
    </div>
    <label class="f">Телефон</label>
    <input id="ePhone" maxlength="40" value="${esc(r.phone)}">
    <label class="f">Бележка</label>
    <textarea id="eNote" maxlength="500">${esc(r.note)}</textarea>
    <label class="nzok-toggle">
      <input type="checkbox" id="eNzokCheck" ${hasNzok(r) ? 'checked' : ''}> 🏥 По НЗОК
    </label>
    <div id="eNzokBox" ${hasNzok(r) ? '' : 'hidden'}>
      <label class="f" style="margin-top:8px">Код по НЗОК</label>
      <input id="eNzokCode" maxlength="60" value="${esc(r.nzok_code)}">
      <label class="f">МНН / международно име</label>
      <input id="eNzokName" maxlength="200" value="${esc(r.nzok_name)}">
      <label class="f">Количество по НЗОК</label>
      <input id="eNzokQty" maxlength="40" value="${esc(r.nzok_qty)}">
      <label class="f">Допълнителна информация</label>
      <textarea id="eNzokNote" maxlength="500">${esc(r.nzok_note)}</textarea>
    </div>
    <div id="eMsg" class="msg"></div>
    <footer>
      <button class="btn" type="button" id="eCancel">Отказ</button>
      <button class="btn primary" type="button" id="eSave">Запази промените</button>
    </footer>`;
  $('#eNzokCheck').addEventListener('change', e => { $('#eNzokBox').hidden = !e.target.checked; });
  $('#eCancel').onclick = () => openDetail(r.id);
  $('#eSave').onclick = async () => {
    if (needName()) return;
    const b = {
      patient: $('#ePatient').value, medicine: $('#eMedicine').value, qty: $('#eQty').value,
      date: $('#eDate').value, phone: $('#ePhone').value, note: $('#eNote').value, by: myName,
    };
    if ($('#eNzokCheck').checked) {
      b.nzok_code = $('#eNzokCode').value; b.nzok_name = $('#eNzokName').value;
      b.nzok_qty = $('#eNzokQty').value; b.nzok_note = $('#eNzokNote').value;
    }
    try {
      const row = await rpc('edit_request', { p_id: r.id, p: b });
      upsert(row); render();
      toast('Промените са записани');
      openDetail(r.id);
    } catch (err) { $('#eMsg').className = 'msg err'; $('#eMsg').textContent = err.message; }
  };
  if (!$('#dlg').open) $('#dlg').showModal();
}

// ---------- Връзка на живо ----------
function upsert(r) {
  const i = requests.findIndex(x => x.id === r.id);
  if (i < 0) requests.unshift(r); else requests[i] = r;
}
function setOnline(ok) {
  $('#conn').className = ok ? 'dot ok' : 'dot';
  $('#connText').textContent = ok ? 'На линия' : 'Няма връзка…';
  $('#offline').hidden = ok || navigator.onLine;
}
async function load() {
  try { requests = await fetchAll('requests_v', 'id', false, 2000); render(); }
  catch (err) { toast(err.message); }
}
async function onChanged(id) {
  const { data: r } = await sb.from('requests_v').select('*').eq('id', id).maybeSingle();
  if (!r) return;
  const old = requests.find(x => x.id === r.id);
  if (old && old.updated_at === r.updated_at && old.last_comment === r.last_comment) return; // вече го имаме (наша промяна)
  upsert(r);
  render(r.id);
  const byOther = r.updated_by !== myName;
  if (!old && byOther) { beep(); toast(`🔔 Нова заявка: ${r.medicine} (${r.patient})`); }
  else if (old && byOther) toast(`№${r.id} ${r.medicine} → ${STATUSES[r.status]} (${r.updated_by})`);
  if (openId === r.id && byOther) openDetail(r.id);
}
function connect() {
  sb.channel('requests')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, p => { if (p.new?.id) onChanged(p.new.id); })
    .subscribe(status => {
      if (status === 'SUBSCRIBED') { setOnline(true); load(); }
      else setOnline(false);
    });
}
addEventListener('online', () => { setOnline(true); load(); });
addEventListener('offline', () => setOnline(false));
// След дълго „спане“ (напр. компютърът е бил приспан) – презареждаме, за да не изпуснем нещо.
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) hiddenAt = Date.now();
  else if (hiddenAt && Date.now() - hiddenAt > 60_000) load();
});

// ---------- Инсталиране като програма (икона на работния плот) ----------
let installEvt = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; $('#installBtn').hidden = false; });
addEventListener('appinstalled', () => { $('#installBtn').hidden = true; toast('✓ Инсталирано – иконата е на работния плот'); });
$('#installBtn').onclick = async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice; installEvt = null; $('#installBtn').hidden = true; };

// ---------- Вход (веднъж на компютър) ----------
function askLogin() {
  return new Promise(resolve => {
    const dlg = $('#loginDlg');
    dlg.addEventListener('cancel', e => e.preventDefault()); // не може да се затвори без парола
    $('#loginForm').onsubmit = async e => {
      e.preventDefault();
      const msg = $('#loginMsg');
      msg.className = 'msg'; msg.textContent = 'Проверка…';
      const { error } = await sb.auth.signInWithPassword({ email: ROLES[ROLE].email, password: $('#loginPass').value });
      if (error) {
        msg.className = 'msg err';
        msg.textContent = /invalid/i.test(error.message) ? 'Грешна парола.' : failText(error);
        return;
      }
      dlg.close(); resolve();
    };
    dlg.showModal(); $('#loginPass').focus();
  });
}
$('#role').onclick = async () => {
  if (!confirm('Изход от този компютър? След това ще трябва паролата отново.')) return;
  await sb.auth.signOut();
  location.reload();
};

(async () => {
  document.body.classList.toggle('helper', ROLE === 'pomoshtnik');
  document.body.classList.toggle('staff', ROLE === 'sluzhitel');
  if (!canSeeBoard) {
    $('#tabs [data-v="board"]').hidden = true; // таблото за управление е само за поръчващия и помощника
    if (view === 'board') view = 'all';
  }
  $('#role').textContent = ROLES[ROLE].label;
  showName();
  setView(view);

  const { data: { session } } = await sb.auth.getSession();
  if (!session) await askLogin();
  connect();
  if (!myName) askName();
  // Главният сваля пълен архив веднъж на ден (в папка „Изтегляния“).
  if (isOrderer) {
    let last = '';
    try { last = localStorage.getItem('lastBackup') || ''; } catch {}
    if (last !== today()) setTimeout(() => backup(true), 5000);
  }
})();
