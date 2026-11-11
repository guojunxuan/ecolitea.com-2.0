async (page) => {
 const nav=page.getByRole('navigation',{name:'Blog categories'});
 const summary=nav.locator('summary');
 const measure=()=>summary.evaluate(el=>{const s=getComputedStyle(el);return {top:el.getBoundingClientRect().top,height:el.getBoundingClientRect().height,header:parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height'))*16,blur:s.backdropFilter,background:s.backgroundColor,font:s.fontSize,text:el.textContent,pageWidth:document.documentElement.scrollWidth}});
 await page.evaluate(()=>window.scrollTo(0,0));
 await summary.scrollIntoViewIfNeeded();
 await page.screenshot({path:'/Users/jason/ecolitea.com 2.0/output/playwright/blog-mobile-category/initial.png'});
 await page.evaluate(()=>window.scrollTo(0,1000));
 await page.waitForFunction(()=>{const n=document.querySelector('[data-slot="blog-mobile-menu"] summary');return n && Math.abs(n.getBoundingClientRect().top-60)<2});
 const sticky=await measure();
 await page.screenshot({path:'/Users/jason/ecolitea.com 2.0/output/playwright/blog-mobile-category/sticky.png'});
 await summary.click();
 await nav.locator('[data-slot="blog-mobile-menu"]').getByRole('link',{name:'Product Insights',exact:true}).click();
 await page.waitForURL('**/blogs/category/product-insights');
 await page.waitForFunction(()=>document.querySelector('[data-slot="blog-mobile-menu"] summary')?.textContent==='Category: Product Insights');
 const switched=await measure();
 await page.evaluate(()=>window.scrollTo(0,700));
 await page.screenshot({path:'/Users/jason/ecolitea.com 2.0/output/playwright/blog-mobile-category/category.png'});
 await page.setViewportSize({width:1280,height:900});
 const desktop={mobileVisible:await summary.isVisible(),linksVisible:await nav.locator('[data-slot="blog-category-links"]').isVisible(),position:await nav.evaluate(el=>getComputedStyle(el.parentElement).position)};
 await page.setViewportSize({width:390,height:844});
 return {sticky,switched,desktop};
}
