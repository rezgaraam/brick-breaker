// Frame-time regression check: node bench.js <chromium> <abs path to index.html> [label]
// Stresses level 100 with 20 balls at iPhone size and 3x DPR (env DPR overrides; NOBG=1 skips the brick layer copy
// for experiments), prints update/draw/frame percentiles at 1x/4x/6x CPU throttle and the top self-time functions.
// Exits 1 if more than 1% of frames take over 33ms at 4x throttle.
const {spawn}=require('child_process'),os=require('os');
const [bin,html,label='']=process.argv.slice(2),DPR=+(process.env.DPR||3),NOBG=!!process.env.NOBG,DBG=9335,sleep=ms=>new Promise(r=>setTimeout(r,ms));
const chrome=spawn(bin,['--headless','--hide-scrollbars','--window-size=402,874',`--remote-debugging-port=${DBG}`,`--user-data-dir=${os.tmpdir()}/bb-bench-${Date.now()}`,'file://'+html],{stdio:'ignore'});
(async()=>{
  let page;for(let i=0;i<50&&!page;i++){try{page=(await (await fetch(`http://127.0.0.1:${DBG}/json/list`)).json()).find(t=>t.type==='page')}catch{}if(!page)await sleep(200)}
  const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
  let id=0,pending={};ws.onmessage=m=>{const d=JSON.parse(m.data);if(d.id&&pending[d.id]){pending[d.id](d);delete pending[d.id]}};
  const send=(method,params={})=>new Promise(r=>{const i=++id;pending[i]=r;ws.send(JSON.stringify({id:i,method,params}))});
  const ev=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true});if(r.result?.exceptionDetails)throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0,300));return r.result?.result?.value};
  await send('Emulation.setDeviceMetricsOverride',{width:402,height:874,deviceScaleFactor:DPR,mobile:true});
  await sleep(800);
  await ev(`fit();${NOBG?"{const di=ctx.drawImage.bind(ctx);ctx.drawImage=(i,...a)=>i===bg?0:di(i,...a)}":''}cfg.music=false;cfg.sfx=false;
    level=99;loadLevel();tap();lives=999;
    window.__T={u:[],d:[],f:[],last:0};
    const U=update,D=draw;
    update=function(dt){const t=performance.now();if(__T.last)__T.f.push(t-__T.last);__T.last=t;
      while(balls.length&&balls.length<20)split(balls[0],3);
      const low=balls.reduce((a,b)=>b.y>a.y?b:a,balls[0]);if(low)pad.x=low.x-pad.w/2;
      U(dt);__T.u.push(performance.now()-t)};
    draw=function(){const t=performance.now();D();__T.d.push(performance.now()-t)};
    true`);
  const pct=(a,p)=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.min(s.length-1,Math.floor(p*s.length))]:0};
  const f=n=>n.toFixed(2);
  console.log(`bench ${label} | level 100, 20 balls, 402x874 @${DPR}x${NOBG?' no-bg-blit':''}`);
  console.log('cpu  | update p50/p95/max ms | draw p50/p95/max ms | frame p50/p95/max ms | >16.7ms | >33ms | bricks broken');
  let jank4=0;
  for(const rate of [1,4,6]){
    await send('Emulation.setCPUThrottlingRate',{rate});
    const left0=await ev('left');await ev('__T.u=[];__T.d=[];__T.f=[];__T.last=0;true');await sleep(5000);
    const T=await ev('({u:__T.u,d:__T.d,f:__T.f,left})');
    const slow=T.f.filter(x=>x>16.7).length/T.f.length*100,jank=T.f.filter(x=>x>33.4).length/T.f.length*100;
    if(rate===4)jank4=jank;
    console.log(`${rate}x   | ${f(pct(T.u,.5))}/${f(pct(T.u,.95))}/${f(pct(T.u,1))} | ${f(pct(T.d,.5))}/${f(pct(T.d,.95))}/${f(pct(T.d,1))} | ${f(pct(T.f,.5))}/${f(pct(T.f,.95))}/${f(pct(T.f,1))} | ${slow.toFixed(1)}% | ${jank.toFixed(1)}% | ${left0-T.left}`);
  }
  await send('Emulation.setCPUThrottlingRate',{rate:4});
  await send('Profiler.enable');await send('Profiler.setSamplingInterval',{interval:200});await send('Profiler.start');await sleep(4000);
  const {result:{profile}}=await send('Profiler.stop');
  const self={},byId=Object.fromEntries(profile.nodes.map(n=>[n.id,n]));let total=0;
  const dts=profile.timeDeltas;profile.samples.forEach((sid,i)=>{const n=byId[sid],k=(n.callFrame.functionName||'(anon)')+(n.callFrame.lineNumber>=0?':'+(n.callFrame.lineNumber+1):'');self[k]=(self[k]||0)+(dts[i]||0);total+=dts[i]||0});
  console.log('top self time @4x:');Object.entries(self).sort((a,b)=>b[1]-a[1]).slice(0,10).forEach(([k,v])=>console.log(`  ${(v/total*100).toFixed(1).padStart(5)}%  ${k}`));
  const ok=jank4<=1;console.log(ok?'ok: no dropped frames at 4x':`FAIL: ${jank4.toFixed(1)}% of frames over 33ms at 4x`);
  ws.close();chrome.kill();process.exit(ok?0:1);
})().catch(e=>{console.error('FAIL',e.message);chrome.kill();process.exit(1)});
