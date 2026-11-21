const {openApp,check,done}=require("./helpers");
// long words like the ones that got a crossword cut off on a phone
const LONG=["snappishly","tittered","draggled","solemn","humble","frown","bewildered","peculiar","curiouser","hastily"];
const custom=LONG.map(w=>({w,he:"תרגום "+w,m:"",ex:`The word ${w} is used here.`,exs:[`The word ${w} is used here.`],custom:1}));
(async()=>{
 const app=await openApp({storage:{wqCustom:custom,wqGroup:{name:"ארוכות",words:LONG},wqScopeShared:"1",wqScopeSharedValue:"group"}});
 const {page}=app;
 await page.click("[data-tab=crossword]");
 let bad=[], minWords=99, maxCols=0, maxRows=0;
 for(let i=0;i<30;i++){
  await page.click("#cwNew");
  const m=await page.evaluate(()=>{
   const wrap=document.querySelector(".cwwrap"), wr=wrap.getBoundingClientRect(), grid=document.getElementById("cwGrid");
   const cols=getComputedStyle(grid).gridTemplateColumns.split(" ").length;
   const cells=[...document.querySelectorAll(".cx:not(.off)")];
   const clipped=cells.filter(c=>{const r=c.getBoundingClientRect(); return r.left<wr.left-1||r.right>wr.right+1;}).length;
   return {cols,rows:Math.round(grid.children.length/cols),clipped,scroll:wrap.scrollWidth-wrap.clientWidth,words:document.querySelectorAll("#cwLists li").length};
  });
  minWords=Math.min(minWords,m.words); maxCols=Math.max(maxCols,m.cols); maxRows=Math.max(maxRows,m.rows);
  if(m.clipped||m.scroll>1||m.cols>11||m.rows>11||m.words<4) bad.push(JSON.stringify(m));
 }
 check("30 crosswords with long words: every cell fully on screen, no sideways scrolling, board at most 11x11, at least 4 words",bad.length===0,bad.slice(0,3).join(" ; "));
 console.log("   (max board "+maxCols+"x"+maxRows+", fewest words in a puzzle: "+minWords+")");
 check("no page errors",app.errors.length===0,app.errors.join("|"));
 await app.close(); done();
})();
