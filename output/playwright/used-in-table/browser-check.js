async (page) => {
 const url='http://localhost:3000/api/documents/6ad5dbebe38dfe7d41151551/references';
 const current=Array.from({length:8},(_,i)=>({documentID:'6ad5dbebe38dfe7d41151551',ownerDocumentID:`fixture-${i}`,ownerType:'collection',ownerSlug:'products',title:`浏览器验证 ${i+1} · 较长的产品标题用于检查小屏幕换行`,path:'inquiry.documents',editURL:'/admin/collections/products/6adcb636f43c3bb2c41ea3f2',kind:'current'}));
 // Browser-only responses: no persisted product/document writes.
 await page.route(url,route=>route.fulfill({json:{current,historicalCount:2}}));
 try {
  await page.reload();
  const panel=page.getByRole('region',{name:'Used in',exact:true});
  await panel.getByRole('button',{name:'Show all 8',exact:true}).waitFor();
  if(await panel.getByRole('link').count()!==5) throw new Error('Expected initial five rows');
  await panel.getByRole('button',{name:'Show all 8',exact:true}).click();
  if(await panel.getByRole('link').count()!==8) throw new Error('Expected all eight rows');
  await page.setViewportSize({width:390,height:844});
  await panel.scrollIntoViewIfNeeded();
  await panel.screenshot({path:'/Users/jason/ecolitea.com 2.0/output/playwright/used-in-table/documents-mobile.png'});
  const layout=await panel.evaluate(el=>({width:el.getBoundingClientRect().width,viewport:window.innerWidth,documentWidth:document.documentElement.scrollWidth}));
  if(layout.documentWidth>layout.viewport) throw new Error(`Page overflow: ${JSON.stringify(layout)}`);
  return {documentsFixture:{initialRows:5,expandedRows:8},mobile:layout};
 } finally {
  await page.unroute(url);
  await page.setViewportSize({width:1440,height:1000});
  await page.reload();
 }
}
