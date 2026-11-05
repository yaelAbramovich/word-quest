(function(){
const SIZE=10;
const EASY=[[0,1],[1,0],[1,1]];
const HARD=[[0,1],[1,0],[1,1],[0,-1],[-1,0],[-1,-1],[1,-1],[-1,1]];
let G, start=null, dragging=false, sel=[];

function generate(){
 const hard=store.get("wqHard","0")==="1";
 const dirs=hard?HARD:EASY;
 const grid=Array.from({length:SIZE},()=>Array(SIZE).fill(""));
 const placed=[];
 const ws=pickWeighted(7,w=>letters(w).length<=SIZE).sort((a,b)=>letters(b).length-letters(a).length);
 for(const w of ws){
  const L=letters(w);
  for(let t=0;t<300;t++){
   const [dr,dc]=dirs[Math.floor(Math.random()*dirs.length)];
   const r=Math.floor(Math.random()*SIZE), c=Math.floor(Math.random()*SIZE);
   const er=r+dr*(L.length-1), ec=c+dc*(L.length-1);
   if(er<0||ec<0||er>=SIZE||ec>=SIZE) continue;
   let ok=true;
   for(let i=0;i<L.length&&ok;i++){const x=grid[r+dr*i][c+dc*i]; if(x&&x!==L[i]) ok=false}
   if(!ok) continue;
   for(let i=0;i<L.length;i++) grid[r+dr*i][c+dc*i]=L[i];
   placed.push({w,L,found:false,idx:placed.length,cells:[]});
   break;
  }
 }
 const pool=ws.map(letters).join("")+"ABCDEFGHIJKLMNOPQRSTUVWXYZ";
 for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++) if(!grid[r][c]) grid[r][c]=pool[Math.floor(Math.random()*pool.length)];
 return {grid,placed,hard,colors:{},won:false,hintCell:null};
}

function draw(){
 let h="";
 const selSet=new Set(sel.map(x=>x.join()));
 for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
  const k=r+","+c, col=G.colors[k];
  h+=`<div class="ws${selSet.has(k)?" sel":""}${col!==undefined?" f"+col:""}${G.hintCell===k?" hint":""}" data-r="${r}" data-c="${c}">${G.grid[r][c]}</div>`;
 }
 $("wsGrid").innerHTML=h;
 $("wsList").innerHTML=G.placed.map(p=>`<span class="chip${p.found?" done f"+p.idx:""}" ${p.found?`data-say="${p.w.w}"`:""}>${
  p.found?`<b dir="ltr">${p.w.w}</b> — ${p.w.he} 🔊`:G.hard?p.w.he:`<span dir="ltr">${p.w.w}</span>`}</span>`).join("");
 $("wsHard").textContent=G.hard?"🔥 מצב אתגר: פעיל":"🌱 מצב רגיל";
}

function cellAt(x,y){
 const el=document.elementFromPoint(x,y)?.closest(".ws");
 return el?[+el.dataset.r,+el.dataset.c]:null;
}
// snap the drag to the nearest straight line (8 directions)
function line(a,b){
 const dr=b[0]-a[0], dc=b[1]-a[1];
 if(!dr&&!dc) return [a];
 const k=Math.round(Math.atan2(dr,dc)/(Math.PI/4));
 const sr=Math.round(Math.sin(k*Math.PI/4)), sc=Math.round(Math.cos(k*Math.PI/4));
 const len=Math.max(0,Math.round((dr*sr+dc*sc)/(sr*sr+sc*sc)));
 const out=[];
 for(let i=0;i<=len;i++){
  const r=a[0]+sr*i, c=a[1]+sc*i;
  if(r<0||c<0||r>=SIZE||c>=SIZE) break;
  out.push([r,c]);
 }
 return out;
}
function finish(){
 const s=sel.map(([r,c])=>G.grid[r][c]).join(""), rev=[...s].reverse().join();
 const p=G.placed.find(x=>!x.found&&(x.L===s||x.L===rev));
 if(p&&sel.length>1){
  p.found=true; sel.forEach(([r,c])=>G.colors[r+","+c]=p.idx);
  good(p.w); speak(p.w.w);
  $("wsInfo").innerHTML=wordCard(p.w,"✓ מצאת!");
  if(G.placed.every(x=>x.found)){
   S.score+=30; save(); G.won=true;
   celebrate("מצאת את כל המילים! +30 ⭐");
   $("wsInfo").insertAdjacentHTML("afterbegin",`<div class="win">🎉 כל המילים נמצאו! +30 נקודות בונוס</div>`);
  }
 }
 sel=[]; draw();
}

function bind(grid){
 grid.addEventListener("pointerdown",e=>{
  const c=cellAt(e.clientX,e.clientY); if(!c||G.won) return;
  G.hintCell=null;
  if(start&&!dragging){ // second tap of a tap-tap selection
   sel=line(start,c); start=null; finish(); return;
  }
  dragging=true; start=c; sel=[c]; draw();
 });
 grid.addEventListener("pointermove",e=>{
  if(!dragging) return;
  const c=cellAt(e.clientX,e.clientY); if(!c) return;
  sel=line(start,c); draw();
 });
 const up=e=>{
  if(!dragging) return;
  dragging=false;
  if(sel.length>1){ start=null; finish(); }   // dragged
  else draw();                                  // tapped: wait for the second tap
 };
 grid.addEventListener("pointerup",up);
 grid.addEventListener("pointercancel",()=>{dragging=false;start=null;sel=[];draw()});
}

function newGame(){
 G=generate(); start=null; dragging=false; sel=[];
 $("wsInfo").innerHTML=""; draw();
}
function hint(){
 const left=G.placed.filter(p=>!p.found); if(!left.length) return;
 const p=left[Math.floor(Math.random()*left.length)];
 // find where the word's first letter sits by scanning the grid for the word
 for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++)for(const [dr,dc] of HARD){
  let ok=true;
  for(let i=0;i<p.L.length&&ok;i++){const rr=r+dr*i,cc=c+dc*i; if(rr<0||cc<0||rr>=SIZE||cc>=SIZE||G.grid[rr][cc]!==p.L[i]) ok=false}
  if(ok){ G.hintCell=r+","+c; draw(); return; }
 }
}

games.wordsearch={render(c){
 c.innerHTML=`<span class="tag">🔎 תפזורת</span>
 <p class="sub">גררי את האצבע על האותיות (או לחצי על האות הראשונה ואז על האחרונה). כל מילה שנמצאה — נשמעת ומתורגמת.</p>
 <div class="wsgrid" id="wsGrid" dir="ltr"></div>
 <div class="chips" id="wsList"></div>
 <div id="wsInfo"></div>
 <div class="tools"><button id="wsHintBtn">💡 רמז</button><button id="wsHard"></button><button id="wsNew">🔄 תפזורת חדשה</button></div>`;
 bind($("wsGrid"));
 $("wsNew").onclick=newGame; $("wsHintBtn").onclick=hint;
 $("wsHard").onclick=()=>{store.set("wqHard",store.get("wqHard","0")==="1"?"0":"1"); newGame()};
 newGame();
}};
})();
