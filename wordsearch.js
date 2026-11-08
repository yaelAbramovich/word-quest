(function(){
const SIZE=10;
const EASY=[[0,1],[1,0],[1,1]];
const HARD=[[0,1],[1,0],[1,1],[0,-1],[-1,0],[-1,-1],[1,-1],[-1,1]];
let G, els=[], sel=[], dragging=false, moved=false, down=null, anchor=null, anchorT=0, mode="first";

function generate(){
 const hard=store.get("wqHard","0")==="1";
 const dirs=hard?HARD:EASY;
 const grid=Array.from({length:SIZE},()=>Array(SIZE).fill(""));
 const placed=[];
 const ws=pickWeighted(7,w=>letters(w).length<=SIZE&&letters(w).length>=3).sort((a,b)=>letters(b).length-letters(a).length);
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
   placed.push({w,L,found:false,idx:placed.length});
   break;
  }
 }
 const pool=ws.map(letters).join("")+"ABCDEFGHIJKLMNOPQRSTUVWXYZ";
 for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++) if(!grid[r][c]) grid[r][c]=pool[Math.floor(Math.random()*pool.length)];
 return {grid,placed,hard,colors:{},won:false,hintCell:null,miss:new Set()};
}

// The grid is built once and only its classes change while dragging.
// (Re-creating the cells during a touch drag makes iOS lose the finger.)
function buildGrid(){
 let h="";
 for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++) h+=`<div class="ws" data-r="${r}" data-c="${c}">${G.grid[r][c]}</div>`;
 $("wsGrid").innerHTML=h;
 els=[...$("wsGrid").children];
}
function paint(){
 const selSet=new Set(sel.map(x=>x.join()));
 els.forEach((el,i)=>{
  const r=Math.floor(i/SIZE), c=i%SIZE, k=r+","+c, col=G.colors[k];
  el.className="ws"+(selSet.has(k)?" sel":"")+(G.miss.has(k)?" miss":"")+(col!==undefined?" f"+col:"")+(G.hintCell===k?" hint":"");
 });
}
function drawList(){
 $("wsList").innerHTML=G.placed.map(p=>`<span class="chip${p.found?" done f"+p.idx:""}" ${p.found?`data-sw="${p.w.w}"`:""}>${
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

// the selection may overshoot by a letter or two: accept any unfound word contained in it (longest first)
function finish(){
 const fwd=sel.map(([r,c])=>G.grid[r][c]).join(""), rev=[...fwd].reverse().join("");
 const revCells=[...sel].reverse();
 let hit=null;
 for(const p of G.placed.filter(x=>!x.found).sort((a,b)=>b.L.length-a.L.length)){
  let i=fwd.indexOf(p.L);
  if(i>=0){ hit={p,cells:sel.slice(i,i+p.L.length)}; break; }
  i=rev.indexOf(p.L);
  if(i>=0){ hit={p,cells:revCells.slice(i,i+p.L.length)}; break; }
 }
 if(hit){
  const {p,cells}=hit;
  p.found=true; cells.forEach(([r,c])=>G.colors[r+","+c]=p.idx);
  good(p.w); speakWithSentence(p.w);
  $("wsInfo").innerHTML=wordCard(p.w,"✓ מצאת!",true);
  if(G.placed.every(x=>x.found)){
   S.score+=30; save(); G.won=true;
   celebrate("מצאת את כל המילים! +30 ⭐");
   $("wsInfo").insertAdjacentHTML("afterbegin",`<div class="win">🎉 כל המילים נמצאו! +30 נקודות בונוס</div>`);
  }
  sel=[]; drawList(); paint();
 } else {
  if(sel.length>1){ // wrong: flash red
   const keys=sel.map(x=>x.join()); keys.forEach(k=>G.miss.add(k));
   const g=G; setTimeout(()=>{keys.forEach(k=>g.miss.delete(k)); if(g===G) paint()},450);
  }
  sel=[]; paint();
 }
}

function bind(grid){
 grid.addEventListener("pointerdown",e=>{
  const c=cellAt(e.clientX,e.clientY); if(!c||G.won) return;
  try{ grid.setPointerCapture(e.pointerId); }catch(x){}
  G.hintCell=null; dragging=true; moved=false; down=c;
  mode=(anchor&&Date.now()-anchorT<6000)?"second":"first";
  sel=[c]; paint();
 });
 grid.addEventListener("pointermove",e=>{
  if(!dragging) return;
  const c=cellAt(e.clientX,e.clientY); if(!c) return;
  if(c[0]!==down[0]||c[1]!==down[1]){ moved=true; mode="first"; anchor=null; }
  if(moved){ sel=line(down,c); paint(); }
 });
 const up=()=>{
  if(!dragging) return;
  dragging=false;
  if(moved){ anchor=null; finish(); return; }          // dragged across letters
  if(mode==="second"){ sel=line(anchor,down); anchor=null; finish(); return; }  // second tap
  anchor=down; anchorT=Date.now(); sel=[down]; paint(); // first tap: wait for the second one
 };
 grid.addEventListener("pointerup",up);
 grid.addEventListener("pointercancel",up);   // iOS sometimes ends a drag with "cancel"
}

function newGame(){
 G=generate(); sel=[]; dragging=false; moved=false; anchor=null;
 $("wsInfo").innerHTML=""; buildGrid(); drawList(); paint();
}
function hint(){
 const left=G.placed.filter(p=>!p.found); if(!left.length) return;
 const p=left[Math.floor(Math.random()*left.length)];
 // find where the word's first letter sits by scanning the grid for the word
 for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++)for(const [dr,dc] of HARD){
  let ok=true;
  for(let i=0;i<p.L.length&&ok;i++){const rr=r+dr*i,cc=c+dc*i; if(rr<0||cc<0||rr>=SIZE||cc>=SIZE||G.grid[rr][cc]!==p.L[i]) ok=false}
  if(ok){ G.hintCell=r+","+c; paint(); return; }
 }
}

games.wordsearch={render(c){
 c.innerHTML=`<p class="sub">גררי את האצבע על האותיות (או לחצי על האות הראשונה ואז על האחרונה). כל מילה שנמצאה — נשמעת ומתורגמת.</p>
 <div class="tools top"><button id="wsHintBtn">💡 רמז</button><button id="wsHard"></button><button id="wsNew">🔄 תפזורת חדשה</button></div>
 <div class="wsgrid" id="wsGrid" dir="ltr"></div>
 <div class="chips" id="wsList"></div>
 <div id="wsInfo"></div>`;
 bind($("wsGrid"));
 $("wsNew").onclick=newGame; $("wsHintBtn").onclick=hint;
 $("wsHard").onclick=()=>{store.set("wqHard",store.get("wqHard","0")==="1"?"0":"1"); newGame()};
 newGame();
}};
})();
