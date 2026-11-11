const {chromium,expect}=require('@playwright/test');
const fs=require('fs'),path=require('path');
const dir=__dirname;
(async()=>{
 const browser=await chromium.launch({headless:true});const results=[];
 try{
  const encoder=await browser.newPage();
  const recorded=await encoder.evaluate(async()=>{
   const mime=['video/mp4;codecs=avc1.42001E','video/mp4'].find(m=>MediaRecorder.isTypeSupported(m));
   if(!mime)return null;
   const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;
   const ctx=canvas.getContext('2d');let step=0;
   const draw=()=>{ctx.fillStyle=step++%2?'#1c3445':'#203e58';ctx.fillRect(0,0,640,360);ctx.fillStyle='white';ctx.font='32px sans-serif';ctx.fillText('Video playback fixture',130,190)};
   draw();const timer=setInterval(draw,100);
   const stream=canvas.captureStream(10), chunks=[];const recorder=new MediaRecorder(stream,{mimeType:mime});
   const done=new Promise(resolve=>{recorder.ondataavailable=e=>chunks.push(e.data);recorder.onstop=resolve});
   recorder.start();await new Promise(r=>setTimeout(r,1500));recorder.stop();await done;clearInterval(timer);stream.getTracks().forEach(t=>t.stop());
   return Array.from(new Uint8Array(await new Blob(chunks,{type:mime}).arrayBuffer()));
  });
  if(!recorded)throw new Error('Local MP4 recorder unsupported');
  fs.writeFileSync(path.join(dir,'fixture.mp4'),Buffer.from(recorded));await encoder.close();
  for(const width of [1280,375]){
   const context=await browser.newContext({viewport:{width,height:900}});await context.route('http://127.0.0.1:4177/**',route=>{
    const name=new URL(route.request().url()).pathname.slice(1)||'fixture.html';const file=path.join(dir,name);
    if(!fs.existsSync(file))return route.fulfill({status:404,body:'not found'});
    route.fulfill({body:fs.readFileSync(file),contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.mp4')?'video/mp4':'text/html'});
   });
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text())});
   await page.goto('http://127.0.0.1:4177/',{waitUntil:'networkidle'});
   const hero=page.locator('[data-hero="product-listing"]');
   await expect(hero.getByRole('heading',{name:'Made for your next adventure'})).toBeVisible();
   await page.getByRole('button',{name:'Pause slideshow'}).click();await page.getByRole('button',{name:'Play slideshow'}).blur();
   const rect=await hero.boundingBox();
   if(width>=768){
    const copy=await hero.getByRole('heading',{name:'Made for your next adventure'}).evaluate(n=>n.parentElement.getBoundingClientRect().toJSON());
    const previous=await hero.getByRole('button',{name:'Previous slide'}).boundingBox();
    expect(copy.x).toBeGreaterThanOrEqual(previous.x+previous.width+16);
   }
   await page.screenshot({path:path.join(dir,`fixture-${width}-first.png`)});
   await page.getByRole('button',{name:'Next slide',exact:true}).click();
   console.log('After next',JSON.stringify({errors,groups:await hero.locator('[aria-roledescription=slide]').evaluateAll(nodes=>nodes.map(n=>({title:n.textContent,hidden:n.getAttribute('aria-hidden')})))}));
   await expect(hero.getByRole('heading',{name:'A fresh perspective'})).toBeVisible();
   await expect(hero).toHaveAttribute('data-website-theme','default');
   await page.screenshot({path:path.join(dir,`fixture-${width}-light-right.png`)});
   await page.getByRole('button',{name:'Next slide',exact:true}).click();
   const video=hero.locator('video');await expect(video).toHaveJSProperty('paused',true);
   await page.getByRole('button',{name:'Play slideshow'}).click();
   await expect(video).toHaveJSProperty('paused',false);
   await page.screenshot({path:path.join(dir,`fixture-${width}-video.png`)});
   await page.getByRole('button',{name:'Previous slide',exact:true}).click();
   await expect(video).toHaveJSProperty('paused',true);
   const nav=page.getByRole('navigation',{name:'Product categories',exact:true}).first();
   const track=nav.getByRole('region',{name:'Product categories',exact:true});
   const before=await track.evaluate(n=>n.scrollLeft);
   await nav.getByRole('button',{name:'Next items'}).click();
   await expect.poll(()=>track.evaluate(n=>n.scrollLeft)).toBeGreaterThan(before+50);
   await expect(nav.getByRole('button',{name:'Previous items'})).toBeVisible();
   await nav.locator('a[href="#category-6"]').click();
   await expect(page).toHaveURL(/#category-6$/);
   const category=page.locator('#category-6');await expect(category).toBeInViewport();
   results.push({width,heroWidth:rect.width,heroHeight:rect.height,errors,videoPlayed:true,videoPausedAfterLeaving:true,categoryHash:'category-6'});
   await context.close();
  }
  const nojs=await browser.newContext({javaScriptEnabled:false,viewport:{width:375,height:900}});
  await nojs.route('http://127.0.0.1:4177/**',route=>{const name=new URL(route.request().url()).pathname.slice(1)||'fixture.html';const f=path.join(dir,name);return route.fulfill({body:fs.readFileSync(f),contentType:name.endsWith('.css')?'text/css':'text/html'})});
  const p=await nojs.newPage();await p.goto('http://127.0.0.1:4177/',{waitUntil:'networkidle'});
  await expect(p.getByRole('heading',{name:'Made for your next adventure'})).toBeVisible();
  await expect(p.getByRole('heading',{name:'A fresh perspective'})).not.toBeVisible();
  await expect(p.getByRole('link',{name:'Explore the range'})).toHaveAttribute('href','#category-0');
  await p.screenshot({path:path.join(dir,'fixture-375-no-js.png')});await nojs.close();
  if(results.some(r=>r.errors.length))throw new Error(JSON.stringify(results));
  fs.writeFileSync(path.join(dir,'fixture-results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
