import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const ADMIN_URL = 'https://flapark.com/admin';
const VISITS_URL = 'https://flapark.com/admin/visits';

const USER = process.env.FLAP_ADMIN_USER;
const PASS = process.env.FLAP_ADMIN_PASS;

if (!USER || !PASS) {
  throw new Error('Missing FLAP_ADMIN_USER / FLAP_ADMIN_PASS');
}

const twNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
const hh = twNow.getHours();
const mm = twNow.getMinutes();
// 10:30 ~ 19:00 every 30 mins
const inWindow = (hh > 10 || (hh === 10 && mm >= 30)) && (hh < 19 || (hh === 19 && mm === 0));
if (!inWindow && process.env.FORCE_SYNC !== '1') {
  console.log('Outside sync window, skip.');
  process.exit(0);
}

const fmtDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const dateStr = fmtDate(twNow);
const updatedAt = `${dateStr} ${String(twNow.getHours()).padStart(2,'0')}:${String(twNow.getMinutes()).padStart(2,'0')} GMT+8`;

const splitNames = (s='') => String(s).split(/[、，,;；]\s*/).map(x => x.trim()).filter(Boolean);
const decodeHtml = (s='') => s
  .replaceAll('&quot;', '"')
  .replaceAll('&#039;', "'")
  .replaceAll('&amp;', '&')
  .replaceAll('&lt;', '<')
  .replaceAll('&gt;', '>');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded' });

await page.locator('input[type="text"], input[type="email"]').first().fill(USER);
await page.locator('input[type="password"]').first().fill(PASS);
const submit = page.locator('button[type="submit"], button:has-text("登入"), button:has-text("Log in")').first();
if (await submit.count()) {
  await submit.click();
} else {
  await page.keyboard.press('Enter');
}
await page.waitForTimeout(2000);

// still seeing password input means login failed
if (await page.locator('input[type="password"]').count()) {
  const isVisible = await page.locator('input[type="password"]').first().isVisible().catch(() => false);
  if (isVisible) throw new Error('Login failed: still on login page');
}

await page.goto(VISITS_URL, { waitUntil: 'domcontentloaded' });
if (await page.locator('input[type="password"]').count()) {
  const isVisible = await page.locator('input[type="password"]').first().isVisible().catch(() => false);
  if (isVisible) throw new Error('Auth required at visits page');
}

const visits = [];
const allRows = [];
for (let p = 1; p <= 160; p++) {
  const url = p === 1 ? VISITS_URL : `${VISITS_URL}?page=${p}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const rows = await page.$$eval('tbody tr', trs => trs.map(tr => {
    const tds = tr.querySelectorAll('td');
    if (tds.length < 6) return null;
    const parent = (tds[2]?.textContent || '').trim();
    const child = (tds[3]?.textContent || '').trim();
    const phone = (tds[4]?.textContent || '').trim();
    const checkin = (tds[5]?.textContent || '').trim();
    const edit = tr.querySelector('a[href*="/admin/visits/"][href$="/edit"]')?.href || null;
    return { parent, child, phone, checkin, edit };
  }).filter(Boolean));

  if (!rows.length) break;

  let foundToday = 0;
  for (const r of rows) {
    allRows.push(r);
    if (r.checkin.startsWith(dateStr) && r.edit) {
      visits.push(r);
      foundToday++;
    }
  }

  if (foundToday === 0 && visits.length > 0) break;
}

let guardiansTotal = 0;
let mainGuardians = 0;
let childrenTotal = 0;
const hourMap = {};
for (const v of visits) {
  const gs = splitNames(v.parent);
  const cs = splitNames(v.child);
  if (gs.length > 0) mainGuardians += 1;
  guardiansTotal += gs.length;
  childrenTotal += cs.length;
  const m = v.checkin.match(/\s(\d{2}):/);
  if (m) hourMap[m[1]] = (hourMap[m[1]] || 0) + 1;
}

const keyOf = (r) => `${(r.phone || '').replace(/\s+/g, '')}|${splitNames(r.parent)[0] || ''}`;
const beforeSet = new Set(allRows.filter(r => (r.checkin || '').slice(0,10) < dateStr).map(keyOf));
let newCnt = 0, oldCnt = 0;
for (const v of visits) {
  if (beforeSet.has(keyOf(v))) oldCnt++; else newCnt++;
}

const ageList = [];
const re = /\"birthday_year\":\"(\d{4})\",\"birthday_month\":\"(\d{1,2})\",\"birthday_day\":\"(\d{1,2})\"/g;
const calcAge = (y,m,d) => {
  y = Number(y); m = Number(m); d = Number(d);
  if (!y || !m || !d) return null;
  let age = twNow.getFullYear() - y;
  const passed = (twNow.getMonth()+1 > m) || ((twNow.getMonth()+1 === m) && twNow.getDate() >= d);
  if (!passed) age -= 1;
  return age;
};

for (const v of visits) {
  try {
    const html = await page.context().request.get(v.edit).then(r => r.text());
    const txt = decodeHtml(html);
    for (const m of txt.matchAll(re)) {
      const a = calcAge(m[1], m[2], m[3]);
      if (a !== null && a >= 0 && a <= 18) ageList.push(a);
    }
  } catch {}
}

const ageBuckets = {
  '0-2': ageList.filter(a => a <= 2).length,
  '3-5': ageList.filter(a => a >= 3 && a <= 5).length,
  '6-8': ageList.filter(a => a >= 6 && a <= 8).length,
  '9+': ageList.filter(a => a >= 9).length,
};

const revenue = childrenTotal * 300 + guardiansTotal * 200;

if (inWindow && visits.length === 0) {
  throw new Error('Sync safety stop: got 0 visits during business window');
}

const data = {
  date: dateStr,
  visitCount: visits.length,
  mainGuardians,
  secondaryGuardians: Math.max(0, guardiansTotal - mainGuardians),
  guardiansTotal,
  children: childrenTotal,
  totalPeople: guardiansTotal + childrenTotal,
  countingMode: '全家長制（每筆家長欄位依分隔符拆分後逐一計數）',
  updatedAt,
  source: 'flapark.com/admin/visits',
  ageBuckets,
  newCnt,
  oldCnt,
  newPct: visits.length ? Number((newCnt / visits.length * 100).toFixed(1)) : 0,
  oldPct: visits.length ? Number((oldCnt / visits.length * 100).toFixed(1)) : 0,
  hourMap: {
    '10': hourMap['10'] || 0,
    '11': hourMap['11'] || 0,
    '12': hourMap['12'] || 0,
    '13': hourMap['13'] || 0,
    '14': hourMap['14'] || 0,
    '15': hourMap['15'] || 0,
    '16': hourMap['16'] || 0,
    '17': hourMap['17'] || 0,
    '18': hourMap['18'] || 0,
  },
  revenue,
};

await fs.writeFile(path.join(process.cwd(), 'today-data.json'), JSON.stringify(data, null, 2) + '\n', 'utf8');
await browser.close();
console.log('Synced', data);
