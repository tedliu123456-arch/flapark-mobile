import { chromium } from 'playwright';
const USER = process.env.FLAP_ADMIN_USER, PASS = process.env.FLAP_ADMIN_PASS;
const b = await chromium.launch({headless:true});
const p = await b.newPage();
await p.goto('https://flapark.com/admin',{waitUntil:'domcontentloaded'});
await p.locator('input[type="text"], input[type="email"]').first().fill(USER);
await p.locator('input[type="password"]').first().fill(PASS);
await p.locator('button[type="submit"], button:has-text("登入")').first().click();
await p.waitForTimeout(2500);
await p.goto('https://flapark.com/admin/visits',{waitUntil:'domcontentloaded'});
for (const pg of [1,2,3]) {
  const u = pg===1?'https://flapark.com/admin/visits':`https://flapark.com/admin/visits?page=${pg}`;
  await p.goto(u,{waitUntil:'domcontentloaded'});
  const th = await p.$$eval('thead th', ts=>ts.map(t=>(t.textContent||'').trim()));
  const rows = await p.$$eval('tbody tr', trs=>trs.slice(0,8).map(tr=>{
    const td=[...tr.querySelectorAll('td')].map(x=>(x.textContent||'').trim());
    const a=tr.querySelector('a[href*="/admin/visits/"]');
    return {cells:td, edit:a?a.getAttribute('href'):null};
  }));
  console.log(`PAGE ${pg} headers=${JSON.stringify(th)}`);
  for(const r of rows) console.log('  ', JSON.stringify(r));
}
await b.close();
