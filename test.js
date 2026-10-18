// Headless smoke test: node test.js
// Stubs the DOM, loads the game script, plays level 1 with a perfect paddle and
// asserts bricks break, the level is won, and a dropped ball costs a life.
const fs=require('fs'),assert=require('assert'),vm=require('vm');
const src=fs.readFileSync(__dirname+'/index.html','utf8').match(/<script>([\s\S]*)<\/script>/)[1];
const noop=()=>{};
const ctx2d=new Proxy({},{get:()=>noop,set:()=>true});
const g={
  document:{getElementById:()=>({width:360,height:640,getContext:()=>ctx2d,addEventListener:noop,getBoundingClientRect:()=>({left:0,width:360})})},
  localStorage:{},addEventListener:noop,requestAnimationFrame:noop,AudioContext:undefined,Math,Infinity,Object,
};
vm.createContext(g);vm.runInContext(src+';this.G={get state(){return state},get bricks(){return bricks},get balls(){return balls},get lives(){return lives},pad,tap,update,loadLevel,LEVELS}',g);
const G=g.G,dt=1/60,alive=()=>G.bricks.filter(b=>b.hp>0&&b.hp<Infinity).length;

// 0. Every level: 14 columns, and every breakable brick is reachable from below
//    through non-steel cells (canals must not seal bricks off).
for(const [i,L] of G.LEVELS.entries()){
  assert(L.every(r=>r.length===14),`level ${i+1}: row width`);
  const rows=['..............',...L,'..............'],seen=new Set(),q=[[rows.length-1,0]];
  while(q.length){const [r,c]=q.pop(),k=r+','+c;if(r<0||r>=rows.length||c<0||c>13||rows[r][c]==='#'||seen.has(k))continue;seen.add(k);q.push([r+1,c],[r-1,c],[r,c+1],[r,c-1])}
  rows.forEach((row,r)=>[...row].forEach((ch,c)=>assert(ch==='.'||ch==='#'||seen.has(r+','+c),`level ${i+1}: brick at row ${r-1} col ${c} is sealed off`)));
}

// 1. Perfect paddle wins level 1.
G.tap();assert.equal(G.state,'play');
const total=alive();
for(let i=0;i<60*600&&G.state==='play';i++){G.pad.x=G.balls[0].x-G.pad.w/2;G.update(dt)}
assert.equal(G.state,'win',`expected win, got ${G.state} with ${alive()}/${total} bricks left`);
assert.equal(alive(),0);

// 2. Dropping the ball costs a life, then game over at 0.
G.loadLevel();G.tap();
for(let n=3;n>0;n--){G.pad.x=-999;for(let i=0;i<60*20&&G.lives===n;i++)G.update(dt);if(G.lives>0){assert.equal(G.state,'ready');G.tap()}}
assert.equal(G.state,'over');
console.log(`ok: ${G.LEVELS.length} levels valid, won level 1 (${total} bricks), lives drain to game over`);
