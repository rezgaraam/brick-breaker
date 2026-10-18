// PWA check: node pwa-check.js <chromium-binary> <site-root>
//   e.g. node pwa-check.js ~/Library/Caches/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-mac-arm64/chrome-headless-shell .
// Serves the site, opens it in headless Chromium over CDP, checks manifest + service worker,
// then kills the server and reloads: the page must still come up from the SW cache.
const {spawn}=require('child_process'),http=require('http'),fs=require('fs'),path=require('path');
const [bin,root]=process.argv.slice(2),PORT=8765,DBG=9333;
const types={'.html':'text/html','.js':'text/javascript','.webmanifest':'application/manifest+json','.png':'image/png'};
const base=path.resolve(root);
const server=http.createServer((req,res)=>{
  let p;try{p=decodeURIComponent(req.url.split('?')[0])}catch{res.writeHead(400);res.end();return}
  const f=path.resolve(base,'.'+(p==='/'?'/index.html':p));
  if(!f.startsWith(base+path.sep)){res.writeHead(403);res.end();return}   // stay inside the site root
  fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);res.end();return}res.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'});res.end(d)});
}).listen(PORT,'127.0.0.1');                                             // loopback only
const chrome=spawn(bin,['--headless','--disable-gpu','--no-first-run',`--remote-debugging-port=${DBG}`,`--user-data-dir=${require('os').tmpdir()+'/bb-pwa-profile-'+Date.now()}`,`http://127.0.0.1:${PORT}/index.html`],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  let page;for(let i=0;i<50&&!page;i++){try{page=(await (await fetch(`http://127.0.0.1:${DBG}/json/list`)).json()).find(t=>t.type==='page'&&t.url.includes('index.html'))}catch{}if(!page)await sleep(200)}
  if(!page)throw new Error('no page target');
  const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
  let id=0,pending={},onload=null;
  ws.onmessage=m=>{const d=JSON.parse(m.data);if(d.id&&pending[d.id]){pending[d.id](d);delete pending[d.id]}if(d.method==='Page.loadEventFired'&&onload){onload();onload=null}};
  const send=(method,params={})=>new Promise(r=>{const i=++id;pending[i]=r;ws.send(JSON.stringify({id:i,method,params}))});
  const ev=async expr=>{const r=await send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true});return r.result?.exceptionDetails?.text??r.result?.result?.value};
  await send('Page.enable');
  const out={};
  out.manifestLink=await ev(`document.querySelector('link[rel=manifest]')?.getAttribute('href')`);
  out.manifest=await ev(`fetch('manifest.webmanifest').then(r=>r.json()).then(m=>m.name+' / '+m.display+' / '+m.icons.length+' icons')`);
  out.icons=await ev(`Promise.all(['icon-192.png','icon-512.png'].map(u=>fetch(u).then(r=>r.status)))`);
  for(let i=0;i<50&&out.swState!=='activated';i++){out.swState=await ev(`navigator.serviceWorker.ready.then(r=>r.active?.state)`);if(out.swState!=='activated')await sleep(100)} // ready can resolve while still activating
  for(let i=0;i<50&&!out.controlled;i++){out.controlled=await ev(`!!navigator.serviceWorker.controller`);if(!out.controlled)await sleep(100)}
  out.cached=await ev(`caches.open('bb-v1').then(c=>c.keys()).then(k=>k.map(r=>r.url.split('/').pop()||'(root)').sort())`);
  await new Promise(r=>server.close(r));                     // go offline for real
  const loaded=new Promise(r=>onload=r);await send('Page.navigate',{url:page.url});await Promise.race([loaded,sleep(5000)]); // a hard reload (ignoreCache) would bypass the SW
  out.offline={title:await ev(`document.title`),canvas:await ev(`document.getElementById('c')?.width`),levels:await ev(`typeof LEVELS!=='undefined'&&LEVELS.length`),manifest:await ev(`fetch('manifest.webmanifest').then(r=>r.ok).catch(()=>false)`)};
  console.log(JSON.stringify(out,null,1));
  const ok=out.swState==='activated'&&out.controlled&&out.cached.length===5&&out.offline.levels===100&&out.offline.manifest===true;
  console.log(ok?'ok: installable, cached, works offline':'FAIL: see above');
  ws.close();chrome.kill();process.exit(ok?0:1);
})().catch(e=>{console.error('FAIL',e.message);chrome.kill();process.exit(1)});
