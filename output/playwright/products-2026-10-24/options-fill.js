async (page) => {
const ids = ["6adcb636f43c3bb2c41ea3f2", "6add5b7e82afd3ebe2331b22", "6add5c1f82afd3ebe2331b24", "6add5c3782afd3ebe2331b26", "6add5c3d82afd3ebe2331b28", "6add5c4582afd3ebe2331b2a", "6add5c4b82afd3ebe2331b2c", "6add5c5382afd3ebe2331b2e", "6add5c5b82afd3ebe2331b30", "6add5c6182afd3ebe2331b32"];
const before=[];
for (const id of ids) {
 const r=await page.request.get(`http://localhost:3000/api/products/${id}?draft=true&depth=0`);
 if(!r.ok()) throw new Error(`Read ${id}: ${r.status()}`);
 const d=await r.json();
 if(d._status!=='draft' || d.options?.length || d.gallery?.length!==3) throw new Error(`Unexpected existing data: ${id}`);
 before.push(d);
}
const canonical=x=>JSON.stringify(x,(_,v)=>v && typeof v==='object' && !Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const protectedData=d=>Object.fromEntries(Object.entries(d).filter(([k])=>!['options','updatedAt'].includes(k)));
const results=[];
for(const d of before) {
 const g=d.gallery;
 const options=[
 {name:'演示配色',display:'swatch',values:[{label:'曜石黑（演示）',swatch:'#1A1A1A',specifications:[{label:'演示配色',value:'曜石黑（演示）'}]},{label:'云雾白（演示）',swatch:'#F2F1ED',specifications:[{label:'演示配色',value:'云雾白（演示）'}]}]},
 {name:'展示方案',display:'text',values:[{label:'标准展示',specifications:[{label:'内容用途',value:'产品详情演示'}]},{label:'场景展示',specifications:[{label:'内容用途',value:'场景创作演示'}]}]},
 {name:'展示场景',display:'image',values:[{label:'产品外观',thumbnail:g[0],gallery:g,specifications:[{label:'素材来源',value:'站内产品 Media'},{label:'展示重点',value:'产品外观'}]},{label:'场景特写',thumbnail:g[1],gallery:[g[1],g[2],g[0]],specifications:[{label:'素材来源',value:'站内场景 Media'},{label:'展示重点',value:'场景应用'}]}]}
 ];
 const r=await page.request.patch(`http://localhost:3000/api/products/${d.id}`,{data:{options,_status:'draft'}});
 if(!r.ok()) throw new Error(`Update ${d.id}: ${r.status()} ${await r.text()}`);
 const after=await (await page.request.get(`http://localhost:3000/api/products/${d.id}?draft=true&depth=0`)).json();
 if(canonical(protectedData(d))!==canonical(protectedData(after))) throw new Error(`Other fields changed: ${d.id}`);
 if(after.options.length!==3 || after.options.some(o=>o.values.length!==2)) throw new Error(`Options missing: ${d.id}`);
 for(let i=0;i<3;i++) {
 const strip=v=>Array.isArray(v)?v.map(strip):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([k])=>k!=='id').map(([k,x])=>[k,strip(x)])):v;
 // Payload may materialize empty optional arrays; verify the requested fields individually.
 for(let j=0;j<2;j++) for(const [k,v] of Object.entries(options[i].values[j])) if(canonical(strip(after.options[i].values[j][k]))!==canonical(v)) throw new Error(`Value mismatch ${d.id}/${i}/${j}/${k}`);
 }
 results.push({id:d.id,title:d.title,status:after._status,groups:after.options.map(o=>({name:o.name,display:o.display,values:o.values.map(v=>v.label)})),otherFieldsPreserved:true,sections:after.sections.length});
}
return {products:results,groups:30,values:60};
}