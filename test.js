// Headless smoke test: node test.js
// Stubs the DOM, loads the game script, validates every level map, then plays a small
// level with a perfect paddle and asserts it is won, and that dropped balls cost lives.
const fs=require('fs'),assert=require('assert'),vm=require('vm');
const src=fs.readFileSync(__dirname+'/index.html','utf8').match(/<script>([\s\S]*)<\/script>/)[1];
const noop=()=>{};
const ctx2d=new Proxy({},{get:()=>noop,set:()=>true});
const canvas={width:340,height:600,style:{},replaceChildren:noop,append:noop,setAttribute:noop,getContext:()=>ctx2d,addEventListener:noop,getBoundingClientRect:()=>({left:0,top:0,width:340,height:600})};
const g={document:{documentElement:{},addEventListener:noop,body:{clientWidth:340,clientHeight:600},getElementById:()=>canvas,createElement:()=>({getContext:()=>ctx2d,setAttribute:noop,focus:noop}),querySelectorAll:()=>[]},localStorage:{},addEventListener:noop,requestAnimationFrame:noop,AudioContext:undefined,Math,Infinity,Object,Array,JSON};
g.window=g;g.setTimeout=setTimeout;g.clearTimeout=clearTimeout;
let audioCtxs=0;g.AudioContext=function(){audioCtxs++}; // a dummy: only counts creations // browsers always have window; the bridge probes window.webkit
vm.createContext(g);vm.runInContext(src+';this.G={get state(){return state},get left(){return left},get balls(){return balls},get lives(){return lives},get stars(){return stars},get speed(){return speed},crumble,set balls(v){balls=v},set state(v){state=v},get grid(){return grid},get fx(){return fx},get combo(){return combo},set combo(v){combo=v},get ac(){return ac},set ac(v){ac=v},set level(v){level=v},pad,tap,update,loadLevel,LEVELS,COLS,cfg,pause,resume,I18N,split,P,GX,GY,set lives(v){lives=v}}',g);
const G=g.G,C=G.COLS,dt=1/60;
assert.equal(G.LEVELS.length,100);assert.equal(G.state,'menu');

// 0. Every level has COLS columns, and every breakable brick can be reached from below by
//    an 8px ball: flood-fill 2x2 windows of non-steel cells (one 5px cell is too narrow).
for(const [i,L] of G.LEVELS.entries()){
  assert(L.every(r=>r.length===C),`level ${i+1}: row width`);
  // the grey steel wall: top 2 rows solid, 2 steel columns on both sides of every row, bottom 2 rows steel except canals
  assert(L.slice(0,2).every(r=>/^#+$/.test(r))&&L.every(r=>r.startsWith('##')&&r.endsWith('##')),`level ${i+1}: steel frame missing`);
  assert(L.slice(-2).every(r=>r.includes('#')&&r.includes('.')),`level ${i+1}: bottom wall has no canal`);
  // a real canal: an opening in the bottom row whose steel walls run up at least 6 rows with an empty channel inside
  const canalH=(()=>{let best=0;const last=L[L.length-1];
    for(const m of last.matchAll(/\.+/g)){const c0=m.index,c1=c0+m[0].length-1;let h=0;
      for(let r=L.length-1;r>=0&&L[r][c0-1]==='#'&&L[r][c1+1]==='#'&&!L[r].slice(c0,c1+1).includes('#');r--)h++;best=Math.max(best,h)}
    return best})();
  assert(canalH>=6,`level ${i+1}: no steel canal (tallest opening ${canalH} rows)`);
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
// 4. Pause freezes the ball; resume continues.
G.loadLevel();G.tap();for(let i=0;i<10;i++)G.update(dt);
G.pause();assert.equal(G.state,'pause');const p0=JSON.stringify([G.balls[0].x,G.balls[0].y]);
for(let i=0;i<60;i++)G.update(dt);assert.equal(JSON.stringify([G.balls[0].x,G.balls[0].y]),p0,'ball moved while paused');
G.resume();assert.equal(G.state,'play');G.update(dt);assert.notEqual(JSON.stringify([G.balls[0].x,G.balls[0].y]),p0,'ball frozen after resume');

// 5. Every language has exactly the English keys, with the same kinds (string vs function) and arity.
const en=G.I18N.en,sig=o=>Object.keys(o).sort().map(k=>k+':'+(typeof o[k]==='function'?'f'+o[k].length:'s')).join();
for(const[l,o]of Object.entries(G.I18N))assert.equal(sig(o),sig(en),`language ${l} keys differ from en`);

// 6. Ball speed setting scales the launch speed.
for(const m of[.75,1.5]){G.cfg.speed=m;G.level=10;G.loadLevel();G.tap();const b=G.balls[0];
  assert(Math.abs(Math.hypot(b.vx,b.vy)-(280+10)*m)<1e-6,`speed x${m}: ${Math.hypot(b.vx,b.vy)}`)}
G.cfg.speed=1;G.level=G.LEVELS.length-1;

// 7. Review fixes: combo resets with a new ball; music's audio context starts even with effects off; plurals.
G.combo=7;G.loadLevel();assert.equal(G.combo,0,'combo carried into a new level');
G.cfg.sfx=false;G.ac=undefined;audioCtxs=0;G.loadLevel();G.tap();assert(audioCtxs===1&&G.ac,'no AudioContext when SFX is off (music would be silent)');G.cfg.sfx=true;
assert.equal(G.I18N.en.livesN(1),'1 life');assert.equal(G.I18N.fr.livesN(1),'1 vie');assert.equal(G.I18N.es.sayLost(1),'Bola perdida. Queda 1 vida.');

// 8. Steel is unbreakable: two minutes of assisted play with the fireball active (which passes through bricks)
//    on the finale; every steel cell is still steel afterwards.
{const steel=()=>G.grid.filter(h=>h===Infinity).length;
 G.level=99;G.cfg.assist=true;G.loadLevel();const s0=steel(),b0=G.left;G.tap();
 for(let i=0;i<60*120&&G.state==='play';i++){G.fx.fire=9;G.update(dt)}
 assert(s0>0&&steel()===s0,`steel changed: ${s0} -> ${steel()}`);assert(G.left<b0,'nothing was broken, test proves nothing');
 G.cfg.assist=false;G.level=G.LEVELS.length-1;}

// 9. Walls hold: 20 balls hammering the walls for a minute of game time on 5 levels, fireball off and on. A ball
//    whose centre gets inside a steel cell (it then slides through), or that gets past a side wall, fails the test.
{const inSteel=b=>{const c=Math.floor((b.x-G.GX)/G.P),r=Math.floor((b.y-G.GY)/G.P);if(c<0||c>=C||r<0)return false;
   const x=G.GX+c*G.P,y=G.GY+r*G.P;return G.grid[r*C+c]===Infinity&&b.x>x&&b.x<x+G.P-1&&b.y>y&&b.y<y+G.P-1};
 let inside=0,out=0;
 for(const fire of[false,true])for(const lv of[0,2,4,10,99]){
   G.level=lv;G.cfg.assist=true;G.loadLevel();G.lives=999;G.tap();const bottom=G.GY+G.grid.length/C*G.P;
   for(let f=0;f<60*60&&G.state==='play';f++){if(fire)G.fx.fire=9;while(G.balls.length&&G.balls.length<20)G.split(G.balls[0],3);G.update(dt);
     for(const b of G.balls){if(inSteel(b))inside++;if(b.y>G.GY+12&&b.y<bottom-12&&(b.x<G.GX+12||b.x>G.GX+C*G.P-12))out++}}}
 assert.equal(inside+out,0,`balls went into steel ${inside}x and past a side wall ${out}x`);
 G.cfg.assist=false;G.level=G.LEVELS.length-1;}

// 10. Canal walls are stacks of cells with 1px seams; a seam must not act as a floor. 110 balls launched up level 1's
//     canal at 15-55 degrees into the walls must all reach the top (a ghost bounce sent ~4% back down).
{G.level=0;G.loadLevel();const L=G.LEVELS[0],R=L.length,m=/\.+/.exec(L[R-1]),c0=m.index,c1=c0+m[0].length-1;
 let top=R-1;while(top>0&&L[top-1][c0-1]==='#'&&!L[top-1].slice(c0,c1+1).includes('#'))top--;
 const x0=G.GX+c0*G.P,x1=G.GX+(c1+1)*G.P-1,yTop=G.GY+top*G.P,yBot=G.GY+R*G.P;let turned=0;
 for(let xi=0;xi<=10;xi++)for(const deg of[15,25,35,45,55])for(const side of[-1,1]){
   G.loadLevel();G.state='play';const s=G.speed,a=deg*Math.PI/180;
   const b={x:x0+4+(x1-x0-8)*xi/10,y:yBot-6,r:4,vx:side*s*Math.sin(a),vy:-s*Math.cos(a),trail:[]};G.balls=[b];
   for(let f=0;f<600;f++){G.update(1/120);if(b.y<yTop+4)break;if(b.vy>0&&b.y<yBot-8){turned++;break}}}
 assert.equal(turned,0,`${turned} balls turned back inside the canal`);G.level=G.LEVELS.length-1;}

// 11. Crumble: a hit breaks every brick within 3 steps (a 25-cell diamond in a solid field), never steel, and a
//     two-hit brick only loses one hit point.
{G.LEVELS.push(Array(20).fill('#'.repeat(2)+'1'.repeat(C-4)+'#'.repeat(2)));G.level=G.LEVELS.length-1;G.loadLevel();
 const steel=G.grid.filter(h=>h===Infinity).length,l0=G.left;assert.equal(G.crumble(10,28),25,'radius-3 diamond');
 assert.equal(l0-G.left,25);assert.equal(G.grid.filter(h=>h===Infinity).length,steel,'steel touched');
 G.grid[5*C+10]=2;G.crumble(5,10);assert.equal(G.grid[5*C+10],1,'two-hit brick lost more than one hit point');
 G.LEVELS.pop();G.level=G.LEVELS.length-1;}

// 3. Assisted play wins the same level with no paddle input at all.
G.cfg.assist=true;G.loadLevel();G.tap();
for(let i=0;i<60*1200&&G.state==='play';i++)G.update(dt);
assert.equal(G.state,'win',`assisted play: ${G.state} with ${G.left} bricks left`);
G.cfg.assist=false;
console.log(`ok: ${G.LEVELS.length-1} levels valid, menu + stars, steel frame + unbreakable + no tunnelling + canal seams + crumble, pause, ${Object.keys(G.I18N).length} languages, assisted play wins, won a ${total}-brick level, lives drain to game over`);
