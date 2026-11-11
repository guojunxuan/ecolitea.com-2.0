async (page) => {
 const ids=["6adcb636f43c3bb2c41ea3f2", "6add5b7e82afd3ebe2331b22", "6add5c1f82afd3ebe2331b24", "6add5c3782afd3ebe2331b26", "6add5c3d82afd3ebe2331b28", "6add5c4582afd3ebe2331b2a", "6add5c4b82afd3ebe2331b2c", "6add5c5382afd3ebe2331b2e", "6add5c5b82afd3ebe2331b30", "6add5c6182afd3ebe2331b32"];
 const api='http://localhost:3000/api';
 const ownSync=[]; const bannerFallbacks={"6adcb636f43c3bb2c41ea3f2": "将产品外观与真实使用场景放在同一条内容叙事中，让页面编辑更直观。此为本地演示内容。", "6add5b7e82afd3ebe2331b22": "围绕 X5 建立从产品展示到应用场景的内容叙事，所有图片均复用站内素材。此为本地演示内容。"};
 for(const id of ids.slice(0,2)) {
   const r=await page.request.get(api+'/products/'+id+'?draft=true&depth=0');
   if(!r.ok()) throw new Error('Cannot read own product '+id);
   const doc=await r.json(); let changed=false;
   const sections=doc.sections.map(s=>({...s,blocks:s.blocks.map(b=>{
     if(b.blockType!=='productMediaBanner') return b;
     const next={...b};
     if(!next.body || typeof next.body!=='string') {next.body=typeof next.content==='string' ? next.content : bannerFallbacks[id]; changed=true;}
     if(next.playback==null){next.playback='ambient';changed=true;}
     if('content' in next){delete next.content;changed=true;}
     return next;
   })}));
   if(changed){const p=await page.request.patch(api+'/products/'+id,{data:{sections,_status:'draft'}});if(!p.ok()) throw new Error('Own schema sync failed: '+await p.text());}
   ownSync.push({id,changed});
 }
 const media=await (await page.request.get(api+'/media?depth=0&limit=100')).json();
 const mediaIDs=new Set(media.docs.map(m=>m.id));
 const types=new Set(); const counts={}; const products=[];
 let sectionCount=0,blockCount=0;
 for(const id of ids){
  const r=await page.request.get(api+'/products/'+id+'?draft=true&depth=0');const doc=await r.json();
  if(!r.ok() || doc._status!=='draft' || !doc.title || !doc.summary || !doc.slug || doc.category!=='6adcb95ef43c3bb2c41ea3f5') throw new Error('Product essentials failed '+id);
  if(doc.gallery.length!==3 || doc.gallery.some(id=>!mediaIDs.has(id)) || doc.highlights.length!==2 || doc.specifications.length!==2) throw new Error('Gallery or overview failed '+id);
  if(doc.sections.length<2 || new Set(doc.sections.map(s=>s.anchor)).size!==doc.sections.length) throw new Error('Sections invalid '+id);
  for(const s of doc.sections){
   sectionCount++; if(!s.label || !s.anchor || !s.blocks.length) throw new Error('Empty section '+id);
   for(const b of s.blocks){
    blockCount++; types.add(b.blockType);counts[b.blockType]=(counts[b.blockType]||0)+1;
    for(const value of [b.media,b.defaultMedia,...(b.assets||[]),...(b.slides||[]).map(x=>x.media),...(b.tabs||[]).map(x=>x.media),...(b.items||[]).map(x=>x.media)].filter(Boolean)) if(!mediaIDs.has(value)) throw new Error('Missing media '+id);
    if(b.blockType==='productMediaBanner' && (!b.body || b.playback!=='ambient')) throw new Error('Banner current-schema mismatch '+id);
    if(b.blockType==='productMediaTabs' && b.tabs.some(x=>!x.title)) throw new Error('Tab title missing '+id);
    if(b.blockType==='productMediaAccordion' && b.items.some(x=>!x.title)) throw new Error('Accordion title missing '+id);
    if(b.blockType==='productCode' && (!b.html || !(b.minHeight>=100))) throw new Error('Code schema mismatch '+id);
   }
  }
  products.push({id:doc.id,title:doc.title,slug:doc.slug,status:doc._status,gallery:doc.gallery.length,sections:doc.sections.map(s=>({label:s.label,anchor:s.anchor,blocks:s.blocks.map(b=>b.blockType)}))});
 }
 if(types.size!==6 || sectionCount!==29 || products.length!==10) throw new Error('Cohort verification failed');
 const all=await (await page.request.get(api+'/products?draft=true&depth=0&limit=100')).json();
 if(!all.docs.some(x=>x.id==='6adcb533f43c3bb2c41ea3ef')) throw new Error('Original user draft missing');
 return {verified:products.length,sectionCount,blockCount,blockTypes:counts,allDrafts:true,allMediaExist:true,originalUserDraftPreserved:true,ownSchemaSync:ownSync,products};
}