// Headless smoke test: node test.js
// Stubs the DOM, loads the game script, validates every level map, then plays a small
// level with a perfect paddle and asserts it is won, and that dropped balls cost lives.
const fs=require('fs'),assert=require('assert'),vm=require('vm');
const src=fs.readFileSync(__dirname+'/index.html','utf8').match(/<script>([\s\S]*)<\/script>/)[1];
const noop=()=>{};
const ctx2d=new Proxy({},{get:()=>noop,set:()=>true});
const canvas={width:340,height:600,getContext:()=>ctx2d,addEventListener:noop,getBoundingClientRect:()=>({left:0,top:0,width:340,height:600})};
const g={document:{getElementById:()=>canvas,createElement:()=>({getContext:()=>ctx2d}),querySelectorAll:()=>[]},localStorage:{},addEventListener:noop,requestAnimationFrame:noop,AudioContext:undefined,Math,Infinity,Object,Array,JSON};
g.window=g; // browsers always have window; the bridge probes window.webkit
vm.createContext(g);vm.runInContext(src+';this.G={get state(){return state},get left(){return left},get balls(){return balls},get lives(){return lives},get stars(){return stars},set level(v){level=v},pad,tap,update,loadLevel,LEVELS,COLS}',g);
const G=g.G,C=G.COLS,dt=1/60;
assert.equal(G.LEVELS.length,100);assert.equal(G.state,'menu');

// 0. Every level has COLS columns, and every breakable brick can be reached from below by
//    an 8px ball: flood-fill 2x2 windows of non-steel cells (one 5px cell is too narrow).
for(const [i,L] of G.LEVELS.entries()){
  assert(L.every(r=>r.length===C),`level ${i+1}: row width`);
  const pad='.'.repeat(C),rows=[pad,pad,...L,pad,pad],R=rows.length,open=(r,c)=>r>=0&&r<R&&c>=0&&c<C&&rows[r][c]!=='#';
  const seen=new Set(),reached=new Set(),q=[[R-2,0]];
  while(q.length){const [r,c]=q.pop(),k=r*C+c;if(seen.has(k)||!open(r,c)||!open(r,c+1)||!open(r+1,c)||!open(r+1,c+1))continue;seen.add(k);for(const d of[k,k+1,k+C,k+C+1])reached.add(d);q.push([r+1,c],[r-1,c],[r,c+1],[r,c-1])}
  rows.forEach((row,r)=>[...row].forEach((ch,c)=>assert(ch==='.'||ch==='#'||reached.has(r*C+c),`level ${i+1}: brick at row ${r-2} col ${c} is sealed off`)));
}

// 1. A paddle that tracks the ball (with some jitter, so the bounce angle varies) wins a small level.
G.LEVELS.push(Array(4).fill('1'.repeat(C)));G.level=G.LEVELS.length-1;G.loadLevel();
const total=G.left;assert.equal(total,4*C);
G.tap();assert.equal(G.state,'play');
for(let i=0;i<60*1200&&G.state==='play';i++){G.pad.x=G.balls[0].x-G.pad.w/2+(Math.random()-.5)*G.pad.w*.8;G.update(dt)}
assert.equal(G.state,'win',`expected win, got ${G.state} with ${G.left}/${total} bricks left`);
assert.equal(G.left,0);assert(G.stars[G.LEVELS.length-1]>=1,'stars saved on win');

// 2. Dropping the ball costs a life, then game over at 0.
G.loadLevel();G.tap();
for(let n=3;n>0;n--){for(let i=0;i<60*20&&G.lives===n;i++){G.pad.x=-999;G.pad.w=1;G.update(dt)}if(G.lives>0){assert.equal(G.state,'ready');G.tap()}}
assert.equal(G.state,'over');
console.log(`ok: ${G.LEVELS.length-1} levels valid, menu + stars, won a ${total}-brick level, lives drain to game over`);
