import { chromium } from 'playwright';
const USER = process.env.FLAP_ADMIN_USER, PASS = process.env.FLAP_ADMIN_PASS;
const b = await chromium.launch({headless:true});
const p = await b.newPage();
await p.goto('https://flapark.com/admin',{waitUntil:'domcontentloaded'});
await p.locator('input[type="text"], input[type="email"]').first().fill(USER);
await p.locator('input[type="password"]').first().fill(PASS);
await p.locator('button[type="submit"], button:has-text("登入"), button:has-text("Log in")').first().click().catch(()=>p.keyboard.press('Enter'));
await p.waitForTimeout(2500);
await p.goto('https://flapark.com/admin/visits',{waitUntil:'domcontentloaded'});
const rows = await p.$$eval('tbody tr', trs=>trs.slice(0,12).map(tr=>{
  const tds=Array.from(tr.querySelectorAll('td')).map(td=>(td.textContent||'').trim().replace(/\s+/g,' ').slice(0,20));
  const links=Array.from(tr.querySelectorAll('a')).map(a=>({href:a.getAttribute('href'), text:(a.textContent||'').trim().replace(/\s+/g,' ')}));
  return {id:tds[1], checkin:tds[6], status:tds[9], links};
}));
console.log('ROWS:', JSON.stringify(rows,null,1));
await b.close();
