import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({headless:true});
  const page = await browser.newPage();
  await page.goto('https://flapark.com/admin',{waitUntil:'domcontentloaded'});
  await page.fill('input[type=text], input[type=email]', 'flap_adm');
  await page.fill('input[type=password]', 'flap80716750');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);

  const splits = s=>String(s).split(/[、，,;；]\s*/).filter(Boolean).map(x=>x.trim());
  const results = {};
  
  // May 2026 days 1-31
  for(let day=1; day<=31; day++){
    const date = '2026-05-'+String(day).padStart(2,'0');
    const visits = [];
    for(let p=1; p<=30; p++){
      const url = p===1 ? 'https://flapark.com/admin/visits' : 'https://flapark.com/admin/visits?page='+p;
      await page.goto(url,{waitUntil:'domcontentloaded'});
      const rows = await page.$$eval('tbody tr', trs => trs.map(tr=>{
        const td = [...tr.querySelectorAll('td')];
        if(td.length<6) return null;
        return {chkin: td[5]?.innerText || '', p: td[2]?.innerText || '', c: td[3]?.innerText || ''};
      }));
      if(!rows.length || !rows[0]) break;
      let found = false;
      for(const r of rows){
        if(r.chkin && r.chkin.startsWith(date)){
          found = true;
          visits.push(r);
        }
      }
      if(!found && visits.length>0) break;
    }
    if(visits.length){
      const gt = visits.reduce((a,v)=>a+splits(v.p).length,0);
      const ct = visits.reduce((a,v)=>a+splits(v.c).length,0);
      results[date] = {v:visits.length, g:gt, ch:ct, p:gt+ct};
      console.log(date, visits.length, gt, ct);
    }
  }
  await browser.close();
  console.log('FINAL'+JSON.stringify(results));
})();