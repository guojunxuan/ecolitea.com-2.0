const { chromium, expect } = require('@playwright/test');
const fs = require('fs');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const results=[];
 try{
  for(const width of [1280,375]){
   const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
   const page=await context.newPage();
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://localhost:3000/products',{waitUntil:'networkidle'});
   await expect(page.locator('[data-hero="product-listing"]')).toBeVisible();
   const nav=page.getByRole('navigation',{name:'Product categories',exact:true}).first();
   const cards=nav.getByRole('link');
   const last=cards.last(); const hash=await last.getAttribute('href');
   await last.scrollIntoViewIfNeeded(); await last.click();
   await expect(page).toHaveURL(new RegExp(hash.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$'));
   const target=page.locator(hash); await expect(target).toBeInViewport();
   const position=await target.evaluate(n=>n.getBoundingClientRect().top);
   results.push({width,hash,sectionTop:position,errors});
   await page.screenshot({path:`output/playwright/products-listing-carousel/real-${width}-category.png`});
   await page.goto('http://localhost:3000/products',{waitUntil:'networkidle'});
   await page.screenshot({path:`output/playwright/products-listing-carousel/real-${width}-hero.png`});
   await context.close();
   const nojs=await browser.newContext({javaScriptEnabled:false,viewport:{width,height:900}});
   const staticPage=await nojs.newPage();await staticPage.goto('http://localhost:3000/products',{waitUntil:'networkidle'});
   await expect(staticPage.locator('[aria-roledescription="slide"]').first()).toBeVisible();
   await staticPage.screenshot({path:`output/playwright/products-listing-carousel/real-${width}-no-js.png`});
   await nojs.close();
  }
  fs.writeFileSync('output/playwright/products-listing-carousel/real-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
