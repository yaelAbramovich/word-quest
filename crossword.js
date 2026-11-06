(function(){
let P; // current puzzle

function build(ws){
 const N=31, g=Array.from({length:N},()=>Array(N).fill(null)), ent=[];
 const inb=(r,c)=>r>=0&&c>=0&&r<N&&c<N;
 // returns -1 if the word cannot go here, otherwise the number of crossings
 function test(L,r,c,d){
  const dr=d?1:0, dc=d?0:1;
  if(inb(r-dr,c-dc)&&g[r-dr][c-dc]) return -1;
  if(inb(r+dr*L.length,c+dc*L.length)&&g[r+dr*L.length][c+dc*L.length]) return -1;
  let cross=0;
  for(let i=0;i<L.length;i++){
   const rr=r+dr*i, cc=c+dc*i;
   if(!inb(rr,cc)) return -1;
   const cell=g[rr][cc];
   if(cell){ if(cell.ch!==L[i]||cell.dirs[d]) return -1; cross++; }
   else if((inb(rr+dc,cc+dr)&&g[rr+dc][cc+dr])||(inb(rr-dc,cc-dr)&&g[rr-dc][cc-dr])) return -1;
  }
  return cross;
 }
 function put(w,L,r,c,d){
  for(let i=0;i<L.length;i++){
   const rr=r+(d?i:0), cc=c+(d?0:i);
   const cell=g[rr][cc]||(g[rr][cc]={ch:L[i],dirs:[0,0]});
   cell.dirs[d]=1;
  }
  ent.push({w,L,r,c,d});
 }
 for(const w of [...ws].sort((a,b)=>letters(b).length-letters(a).length)){
  const L=letters(w);
  if(!ent.length){ put(w,L,15,15-(L.length>>1),0); continue; }
  const cand=[];
  for(const e of ent){
   const d=1-e.d;
   for(let i=0;i<e.L.length;i++)for(let j=0;j<L.length;j++){
    if(e.L[i]!==L[j]) continue;
    const r=e.d===0?e.r-j:e.r+i, c=e.d===0?e.c+i:e.c-j;
    if(test(L,r,c,d)>0) cand.push({r,c,d});
   }
  }
  if(cand.length){ const p=cand[Math.floor(Math.random()*cand.length)]; put(w,L,p.r,p.c,p.d); }
 }
 return ent;
}

function generate(){
 let best=null;
 for(let t=0;t<60;t++){
  const ent=build(pickWeighted(9,w=>letters(w).length>=3));
  if(ent.length<6) continue;
  const r0=Math.min(...ent.map(e=>e.r)), c0=Math.min(...ent.map(e=>e.c));
  const r1=Math.max(...ent.map(e=>e.r+(e.d?e.L.length-1:0))), c1=Math.max(...ent.map(e=>e.c+(e.d?0:e.L.length-1)));
  const H=r1-r0+1, W=c1-c0+1;
  if(W>11||H>11) continue;
  const score=ent.length*10-W*H/4;
  if(!best||score>best.score) best={ent,r0,c0,W,H,score};
  if(ent.length>=8) break;
 }
 if(!best){ // fallback: should be very rare
  const ent=build(pickWeighted(5,w=>letters(w).length>=3));
  const r0=Math.min(...ent.map(e=>e.r)), c0=Math.min(...ent.map(e=>e.c));
  best={ent,r0,c0,
   W:Math.max(...ent.map(e=>e.c+(e.d?0:e.L.length)))-c0,
   H:Math.max(...ent.map(e=>e.r+(e.d?e.L.length:1)))-r0};
 }
 const {ent,r0,c0,W,H}=best;
 const cells=Array.from({length:H},()=>Array(W).fill(null));
 const entries=ent.map(e=>({w:e.w,L:e.L,d:e.d,r:e.r-r0,c:e.c-c0,solved:false,hinted:false,missed:false,cells:[]}));
 entries.forEach((e,i)=>{
  for(let k=0;k<e.L.length;k++){
   const r=e.r+(e.d?k:0), c=e.c+(e.d?0:k);
   const cell=cells[r][c]||(cells[r][c]={ch:e.L[k],val:"",locked:false,num:0,ents:[-1,-1]});
   cell.ents[e.d]=i; e.cells.push([r,c]);
  }
 });
 let n=0;
 for(let r=0;r<H;r++)for(let c=0;c<W;c++){
  const starts=entries.filter(e=>e.r===r&&e.c===c);
  if(starts.length){ n++; starts.forEach(e=>e.num=n); cells[r][c].num=n; }
 }
 const first=entries.findIndex(e=>e.d===0);
 return {W,H,cells,entries,ei:first<0?0:first,ci:0,bad:new Set(),won:false};
}

const cur=()=>P.entries[P.ei];
const activeCell=()=>cur().cells[P.ci];

function draw(){
 const e=cur(), [ar,ac]=activeCell();
 const inCur=new Set(e.cells.map(x=>x.join()));
 let h="";
 for(let r=0;r<P.H;r++)for(let c=0;c<P.W;c++){
  const cell=P.cells[r][c];
  if(!cell){h+=`<div class="cx off"></div>`;continue}
  const k=r+","+c;
  h+=`<div class="cx${inCur.has(k)?" in":""}${r===ar&&c===ac?" act":""}${cell.locked?" ok":""}${P.bad.has(k)?" bad":""}" data-r="${r}" data-c="${c}">${cell.num?`<i>${cell.num}</i>`:""}${cell.val}</div>`;
 }
 $("cwGrid").style.gridTemplateColumns=`repeat(${P.W},1fr)`;
 $("cwGrid").innerHTML=h;
 $("cwClue").innerHTML=`<b>${e.num} ${e.d?"אנכי ⬇":"אופקי ➡"}</b> · ${e.w.he} <small>(${e.L.length} אותיות)</small>`;
 const list=d=>P.entries.map((x,i)=>x.d===d?`<li data-e="${i}" class="${x.solved?"done":""}${i===P.ei?" cur":""}">${x.num}. ${x.solved?`<b dir="ltr">${x.w.w}</b> — `:""}${x.w.he}</li>`:"").join("");
 $("cwLists").innerHTML=`<h4>➡ אופקי</h4><ul>${list(0)}</ul><h4>⬇ אנכי</h4><ul>${list(1)}</ul>`;
}

function select(ei,ci){
 P.ei=ei;
 if(ci==null){ ci=cur().cells.findIndex(([r,c])=>!P.cells[r][c].val); if(ci<0)ci=0; }
 P.ci=ci; draw();
}
function onCell(r,c){
 const cell=P.cells[r][c], [a,d]=cell.ents;
 const [ar,ac]=activeCell();
 let ei;
 if(ar===r&&ac===c&&a>=0&&d>=0) ei=P.ei===a?d:a;        // tap the active cell again: switch direction
 else if(P.ei===a||P.ei===d) ei=P.ei;                     // keep direction if the cell belongs to it
 else ei=a>=0?a:d;
 select(ei,P.entries[ei].cells.findIndex(([x,y])=>x===r&&y===c));
}

function check(ei){
 const e=P.entries[ei];
 if(e.solved||!e.cells.every(([r,c])=>P.cells[r][c].val)) return;
 if(e.cells.every(([r,c])=>P.cells[r][c].val===P.cells[r][c].ch)) solve(e,true);
 else{
  e.missed=true;
  const keys=e.cells.map(x=>x.join());
  keys.forEach(k=>P.bad.add(k)); draw();
  setTimeout(()=>{keys.forEach(k=>P.bad.delete(k)); if(P===P0)draw()},700);
 }
}
let P0;
function solve(e,earned){
 e.solved=true;
 e.cells.forEach(([r,c])=>{const x=P.cells[r][c];x.locked=true;x.val=x.ch});
 if(earned){ good(e.w); record(e.w,e.hinted?"help":e.missed?"miss":"ok"); }
 speakWithSentence(e.w);
 $("cwInfo").innerHTML=wordCard(e.w,earned?"✓ מצוין!":"");
 if(P.entries.every(x=>x.solved)){
  P.won=true; S.score+=30; save();
  celebrate("פתרת את כל התשבץ! +30 ⭐");
  $("cwInfo").insertAdjacentHTML("afterbegin",`<div class="win">🎉 התשבץ הושלם! +30 נקודות בונוס</div>`);
  draw(); return;
 }
 const nxt=P.entries.findIndex((x,i)=>i!==P.ei&&!x.solved&&x.d===e.d&&i>P.ei);
 const any=nxt>=0?nxt:P.entries.findIndex(x=>!x.solved);
 select(any);
}

function key(k){
 if(P.won) return;
 const e=cur(), [r,c]=activeCell(), cell=P.cells[r][c];
 if(k==="⌫"){
  if(!cell.locked&&cell.val) cell.val="";
  else if(P.ci>0){ P.ci--; const [pr,pc]=activeCell(); if(!P.cells[pr][pc].locked) P.cells[pr][pc].val=""; }
  draw(); return;
 }
 if(!cell.locked) cell.val=k;
 const ents=cell.ents.filter(i=>i>=0);
 const wasSolved=P.entries.filter(x=>x.solved).length;
 ents.forEach(check);
 if(P.entries.filter(x=>x.solved).length!==wasSolved) return; // solve() already moved the selection
 if(P.ci<e.cells.length-1) P.ci++;
 draw();
}

function hint(){
 if(P.won) return;
 const [r,c]=activeCell(), cell=P.cells[r][c];
 if(!cell.locked){ cell.val=cell.ch; cell.ents.filter(i=>i>=0).forEach(i=>P.entries[i].hinted=true); }
 const before=P.entries.filter(x=>x.solved).length;
 cell.ents.filter(i=>i>=0).forEach(check);
 if(P.entries.filter(x=>x.solved).length===before) draw();
}
function reveal(){
 if(P.won||cur().solved) return;
 const e=cur(); bad(e.w); record(e.w,"help"); solve(e,false);
}

function newPuzzle(){
 P=P0=generate();
 $("cwInfo").innerHTML="";
 draw();
}

games.crossword={render(c){
 c.innerHTML=`<span class="tag">🧩 תשבץ</span>
 <p class="sub">בחרי משבצת, הקלידי באנגלית. כשמילה נכונה — תשמעי אותה ותראי את התרגום.</p>
 <div class="cw" id="cwGrid" dir="ltr"></div>
 <div class="clue" id="cwClue"></div>
 <div id="cwInfo"></div>
 ${keyboardHTML(true)}
 <div class="tools"><button id="cwHint">💡 רמז</button><button id="cwReveal">👁 גלי מילה</button><button id="cwNew">🔄 תשבץ חדש</button></div>
 <div class="lists" id="cwLists"></div>`;
 bindKeyboard(c,key);
 $("cwGrid").addEventListener("click",ev=>{
  const x=ev.target.closest(".cx[data-r]"); if(x) onCell(+x.dataset.r,+x.dataset.c);
 });
 $("cwLists").addEventListener("click",ev=>{const li=ev.target.closest("li[data-e]"); if(li) select(+li.dataset.e)});
 $("cwHint").onclick=hint; $("cwReveal").onclick=reveal; $("cwNew").onclick=newPuzzle;
 newPuzzle();
}};
})();
