const path=require('path'), fs=require('fs');
const esbuild=require(path.resolve('node_modules/.pnpm/esbuild@0.28.2/node_modules/esbuild'));
const root=process.cwd();const dir=path.join(root,'output/playwright/products-listing-carousel');
(async()=>{
 const shared={bundle:true,alias:{'@':path.join(root,'src'),'next/image':path.join(dir,'next-image.ts'),'next/link':path.join(dir,'next-link.ts')},define:{'process.env.NODE_ENV':'"development"','process.env.NEXT_PUBLIC_SERVER_URL':'"http://localhost:3000"'},logLevel:'warning'};
 await esbuild.build({...shared,entryPoints:[path.join(dir,'fixture-server.tsx')],outfile:path.join(dir,'fixture-server.cjs'),platform:'node',external:['react','react-dom','react-dom/server','react/jsx-runtime','react/compiler-runtime'],format:'cjs'});
 await esbuild.build({...shared,entryPoints:[path.join(dir,'fixture-client.tsx')],outfile:path.join(dir,'fixture-client.js'),platform:'browser',format:'iife'});
 const {html}=require('./fixture-server.cjs');
 fs.writeFileSync(path.join(dir,'fixture.html'),`<!doctype html><html lang="en" style="--font-geist-sans:Arial,sans-serif"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/fixture-client.css"></head><body><div id="fixture">${html}</div><script>window.process={env:{NODE_ENV:"development"}};</script><script src="/fixture-client.js"></script></body></html>`);
 console.log('Built fixture from production components (no CMS writes)');
})();
