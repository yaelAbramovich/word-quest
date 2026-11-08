(function(){
const MAX=6;
let H;

function newWord(){
 const w=pickWeighted(1)[0];
 H={w,L:letters(w),guessed:new Set(),wrong:0,done:false};
 $("hmInfo").innerHTML=""; draw();
 speak(w.w); // hearing the word first helps with spelling
}

function draw(){
 const parts=[
  `<circle cx="80" cy="42" r="10"/>`,
  `<line x1="80" y1="52" x2="80" y2="88"/>`,
  `<line x1="80" y1="62" x2="64" y2="78"/>`,
  `<line x1="80" y1="62" x2="96" y2="78"/>`,
  `<line x1="80" y1="88" x2="66" y2="114"/>`,
  `<line x1="80" y1="88" x2="94" y2="114"/>`];
 $("hmSvg").innerHTML=`<g class="gal"><line x1="10" y1="130" x2="90" y2="130"/><line x1="30" y1="130" x2="30" y2="15"/><line x1="30" y1="15" x2="80" y2="15"/><line x1="80" y1="15" x2="80" y2="32"/></g><g class="man">${parts.slice(0,H.wrong).join("")}</g>`;
 $("hmWord").innerHTML=[...H.w.w.toUpperCase()].map(ch=>/[A-Z]/.test(ch)?`<span class="hl">${H.guessed.has(ch)||H.done?ch:""}</span>`:`<span class="hs"></span>`).join("");
 $("hmLives").textContent="❤️".repeat(MAX-H.wrong)+"🖤".repeat(H.wrong);
 $("hmClue").innerHTML=`<b>התרגום:</b> ${H.w.he}`;
 document.querySelectorAll("#view .key").forEach(k=>{
  const ch=k.dataset.k, used=H.guessed.has(ch);
  k.disabled=used||H.done;
  k.classList.toggle("hit",used&&H.L.includes(ch));
  k.classList.toggle("miss",used&&!H.L.includes(ch));
 });
 $("hmNext").disabled=!H.done;
}

function end(won){
 H.done=true;
 if(won){ good(H.w); celebrate("יפה מאוד! 🎉"); } else bad(H.w);
 speakWithSentence(H.w);
 draw();
 $("hmInfo").innerHTML=wordCard(H.w,won?"✓ ניצלת את האיש!":"😢 הפעם לא הצלחנו — המילה הייתה:",true);
}
function key(ch){
 if(H.done||H.guessed.has(ch)) return;
 H.guessed.add(ch);
 if(!H.L.includes(ch)) H.wrong++;
 if(H.wrong>=MAX) return end(false);
 if([...new Set(H.L)].every(x=>H.guessed.has(x))) return end(true);
 draw();
}
function hint(){
 if(H.done||H.wrong>=MAX-1) return;
 const left=[...new Set(H.L)].filter(x=>!H.guessed.has(x));
 H.wrong++; key(left[Math.floor(Math.random()*left.length)]);
}

games.hangman={render(c){
 c.innerHTML=`<p class="sub">הקשיבי למילה, קראי את התרגום, והשלימי את האיות באנגלית.</p>
 <div class="tools top"><button id="hmHear">🔊 השמעה</button><button id="hmHint">💡 רמז (עולה חיים)</button></div>
 <button class="next top" id="hmNext" disabled>למילה הבאה ←</button>
 <div class="hm"><svg id="hmSvg" viewBox="0 0 120 140" width="150" height="175" aria-hidden="true"></svg><div id="hmLives" class="lives"></div></div>
 <div class="clue" id="hmClue"></div>
 <div class="hword" id="hmWord" dir="ltr"></div>
 ${keyboardHTML(false)}
 <div id="hmInfo"></div>
`;
 bindKeyboard(c,key);
 $("hmHear").onclick=()=>speak(H.w.w,true);
 $("hmHint").onclick=hint;
 $("hmNext").onclick=newWord;
 newWord();
}};
})();
