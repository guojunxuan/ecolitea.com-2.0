const { chromium } = require('@playwright/test');
const fs = require('fs');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  await page.goto('http://localhost:3000/products',{waitUntil:'networkidle'});
  console.log((await page.locator('body').innerText()).slice(0,5000));
  console.log(JSON.stringify(await page.locator('[data-hero="product-listing"]').evaluateAll(nodes=>nodes.map(n=>({rect:n.getBoundingClientRect().toJSON(),slides:n.querySelectorAll('[aria-roledescription="slide"]').length})))));
  await page.screenshot({path:'output/playwright/products-listing-carousel/desktop-initial.png'});
  fs.writeFileSync('output/playwright/products-listing-carousel/page.html',await page.content());
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
