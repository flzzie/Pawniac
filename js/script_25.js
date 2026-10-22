(function(){
  var MAXL=29, LIVES=3, FILES='abcdefgh';
  var PAL=['wk','wq','wr','wb','wn','wp','bk','bq','br','bb','bn','bp'];
  var S={phase:'idle',level:1,rl:1,lives:LIVES,score:0,n:4,pos:null,placed:{},sel:null,secs:0,t0:0,timer:null,seen:{},
         best:null,bestLoaded:false,msg:'',marks:null,last:0,next:'round',done:false,newBest:false,perfect:false,rid:0};

  function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function nPieces(l){return 3+l;}                       // level 1 = 4 pieces (both kings count)
  function secsFor(l){var n=nPieces(l);return Math.max(3,Math.round((2+n*0.6-(l-1)*0.1)*10)/10);}
  function bestTxt(){return S.best?S.best.score+' points (level '+S.best.level+')':'none yet';}

  // ---------- realistic positions: random played-out games ----------
  function count(c){var n=0;c.board().forEach(function(r){r.forEach(function(p){if(p)n++;});});return n;}
  function toMap(c){var m={};c.board().forEach(function(row,r){row.forEach(function(p,f){if(p)m[FILES[f]+(8-r)]=p.color+p.type;});});return m;}
  function keyOf(m){return Object.keys(m).sort().map(function(k){return k+m[k];}).join(',');}
  function gen(n){
    for(var a=0;a<40;a++){
      var c=new Chess(),plies=0,minP=10+Math.floor(Math.random()*14),ok=true;
      while(plies<260){
        var cnt=count(c);
        if(cnt===n&&plies>=minP) break;
        if(c.game_over()){ok=false;break;}
        var caps=[],quiet=[];
        c.moves({verbose:true}).forEach(function(m){(m.captured?caps:quiet).push(m);});
        var pool;
        if(cnt>n) pool=(plies>=6&&caps.length&&Math.random()<0.55)?caps:(quiet.length?quiet:caps);
        else pool=quiet;                                  // already at the target: no more captures
        if(!pool.length){ok=false;break;}
        c.move(pool[Math.floor(Math.random()*pool.length)]);
        plies++;
      }
      if(ok&&plies<260&&count(c)===n) return toMap(c);
    }
    // fallback: a quiet opening position, thinned out (kings always stay)
    var c2=new Chess();
    for(var i=0;i<24;i++){
      var q=c2.moves({verbose:true}).filter(function(m){return !m.captured;});
      if(!q.length) break;
      c2.move(q[Math.floor(Math.random()*q.length)]);
    }
    var m2=toMap(c2),keys=Object.keys(m2).filter(function(k){return m2[k].charAt(1)!=='k';});
    keys.sort(function(){return Math.random()-.5;});
    while(Object.keys(m2).length>n&&keys.length) delete m2[keys.pop()];
    return m2;
  }

  // ---------- drawing ----------
  function pimg(code){
    var c=code.charAt(0),t=code.charAt(1);
    return '<img class="piece-img" src="'+pieceImgUrl(c,t)+'" alt="" draggable="false" onerror="this.outerHTML=\'<span style=&quot;font-size:1em;line-height:1;&quot;>'+PIECE_UNICODE[c][t]+'</span>\'">';
  }
  function boardHtml(map,marks){
    var h='<div class="board">';
    for(var r=0;r<8;r++)for(var f=0;f<8;f++){
      var sq=FILES[f]+(8-r),cls='sq '+(((r+f)%2===0)?'light':'dark');
      if(marks&&marks[sq]) cls+=' bb-'+marks[sq];
      var co='';
      if(f===0) co+='<span class="coord rank">'+(8-r)+'</span>';
      if(r===7) co+='<span class="coord file">'+FILES[f]+'</span>';
      h+='<div class="'+cls+'" data-bsq="'+sq+'">'+co+(map[sq]?pimg(map[sq]):'')+'</div>';
    }
    return h+'</div>';
  }
  function palHtml(){
    function row(c){
      return '<div class="bb-pal">'+PAL.filter(function(p){return p.charAt(0)===c;}).map(function(p){
        return '<div class="tcbtn'+(S.sel===p?' active':'')+'" data-p="'+p+'">'+pimg(p)+'</div>';
      }).join('')+'</div>';
    }
    return row('w')+row('b');
  }
  function infoCard(){
    var over=S.phase==='over';
    return '<div class="card"><h2>Blindfold board</h2>'+
      (over?'<div class="result-banner">'+(S.done?'Perfect run!':'Run over')+'<div class="rc">Score '+S.score+' &middot; reached level '+S.rl+' ('+nPieces(S.rl)+' pieces)'+(S.newBest?' &middot; new personal best!':'')+'</div></div>':'')+
      '<p class="desc">A position from a played-out game is shown for a few seconds, then the pieces vanish. Place them back from memory. A perfect round takes you up a level (one more piece, a little less time per piece). A mistake costs a life, and 3 lives ends the run. Your score is the total number of pieces you placed correctly.</p>'+
      '<div class="status-msg">Your best: '+esc(bestTxt())+'</div><button id="bbStart">'+(over?'Play again':'Start')+'</button></div>';
  }
  function draw(){
    var el=document.getElementById('bbGame');if(!el) return;
    if(S.phase==='idle'||S.phase==='over'){el.innerHTML=infoCard();wire(el);return;}
    var hearts='';for(var i=0;i<LIVES;i++) hearts+=(i<S.lives?'\u2665 ':'\u2661 ');
    var head='<div class="announce'+(S.phase==='show'?'':' empty')+'">Level '+S.rl+' &middot; '+S.n+' pieces</div>'+
             '<div class="status-msg">Lives '+hearts+'&middot; Score '+S.score+'</div>';
    var map,marks=null,panel;
    if(S.phase==='show'){
      map=S.pos;
      panel=head+'<div class="bb-bar"><div id="bbBarIn"></div></div><div class="hint">Memorize it! <b id="bbLeft"></b> left</div>'+
        '<div class="bb-btns"><button class="secondary" id="bbHide">Hide now</button></div>';
    }else if(S.phase==='recall'){
      map=S.placed;
      panel=head+'<div class="hint" style="margin-bottom:8px;">Pick a piece, then click a square. Click a placed piece (with nothing picked) to remove it.</div>'+palHtml()+
        '<div class="hint">Placed '+Object.keys(S.placed).length+' / '+S.n+'</div>'+(S.msg?'<div class="draw-offer" style="margin-top:8px;">'+esc(S.msg)+'</div>':'')+
        '<div class="bb-btns"><button id="bbSubmit">Submit</button><button class="secondary" id="bbClear">Clear</button></div>';
    }else{
      map=S.pos;marks=S.marks;
      panel=head+'<div class="draw-offer">'+(S.perfect?(S.done?'Perfect run! Every level cleared.':'Perfect! All '+S.n+' pieces right.'):S.last+' of '+S.n+' right. You lost a life.')+
        ' +'+S.last+' points.<div class="hint" style="margin-top:6px;">Green = right. Red = wrong or missed. The board shows the real position.</div></div>'+
        '<div class="bb-btns"><button id="bbNext">'+(S.next==='over'?'See results':'Next round')+'</button></div>';
    }
    el.innerHTML='<div class="card"><div class="board-wrap">'+boardHtml(map,marks)+'<div class="panel">'+panel+'</div></div></div>';
    wire(el);
  }
  function wire(el){
    var q=function(id){return document.getElementById(id);};
    if(q('bbStart')) q('bbStart').onclick=startRun;
    if(q('bbHide')) q('bbHide').onclick=toRecall;
    if(q('bbClear')) q('bbClear').onclick=function(){S.placed={};S.msg='';draw();};
    if(q('bbSubmit')) q('bbSubmit').onclick=submit;
    if(q('bbNext')) q('bbNext').onclick=function(){if(S.next==='over') endRun(); else nextRound();};
    el.querySelectorAll('[data-p]').forEach(function(b){
      b.onclick=function(){S.sel=(S.sel===b.dataset.p)?null:b.dataset.p;S.msg='';draw();};
    });
    if(S.phase==='recall') el.querySelectorAll('[data-bsq]').forEach(function(c){c.onclick=function(){placeAt(c.dataset.bsq);};});
  }

  // ---------- game flow ----------
  function stopTimer(){if(S.timer){clearInterval(S.timer);S.timer=null;}}
  function tick(){
    var scr=document.getElementById('screen-minigames'),wrap=document.getElementById('bbWrap');
    if(!scr||scr.style.display!=='block'||!wrap||wrap.style.display==='none'){endActive();return;}
    var left=S.secs*1000-(Date.now()-S.t0);
    if(left<=0){toRecall();return;}
    var bar=document.getElementById('bbBarIn'),tx=document.getElementById('bbLeft');
    if(bar) bar.style.width=(left/(S.secs*1000)*100)+'%';
    if(tx) tx.textContent=(left/1000).toFixed(1)+'s';
  }
  function startRun(){
    S.rid++;S.level=1;S.lives=LIVES;S.score=0;S.seen={};S.done=false;S.newBest=false;nextRound();
  }
  function nextRound(){
    S.rl=S.level;S.n=nPieces(S.level);S.secs=secsFor(S.level);
    var pos,tries=0;
    do{pos=gen(S.n);tries++;}while(S.seen[keyOf(pos)]&&tries<20);   // never the same position twice in a run
    S.seen[keyOf(pos)]=1;S.pos=pos;S.placed={};S.sel=null;S.msg='';S.marks=null;
    S.phase='show';S.t0=Date.now();stopTimer();S.timer=setInterval(tick,100);draw();
  }
  function toRecall(){stopTimer();S.phase='recall';S.placed={};S.sel=null;S.msg='';draw();}
  function placeAt(sq){
    var cur=S.placed[sq];
    if(!S.sel){
      if(cur){delete S.placed[sq];S.msg='';playMoveSound();}
      else S.msg='Pick a piece from the list first.';
      draw();return;
    }
    if(cur===S.sel) delete S.placed[sq];
    else{
      if(!cur&&Object.keys(S.placed).length>=S.n){S.msg='You can only place '+S.n+' pieces. Remove one first.';draw();return;}
      S.placed[sq]=S.sel;
    }
    S.msg='';playMoveSound();draw();
  }
  function submit(){
    var correct=0,marks={};
    Object.keys(S.pos).forEach(function(k){
      if(S.placed[k]===S.pos[k]){correct++;marks[k]='ok';}else marks[k]='bad';
    });
    Object.keys(S.placed).forEach(function(k){if(S.pos[k]!==S.placed[k]) marks[k]='bad';});
    S.marks=marks;S.last=correct;S.score+=correct;S.perfect=(correct===S.n);
    if(S.perfect){
      playWinSound();
      if(S.level>=MAXL){S.next='over';S.done=true;}else{S.level++;S.next='round';}
    }else{
      playLossSound();S.lives--;S.next=S.lives<=0?'over':'round';
    }
    S.phase='result';draw();
  }
  function endRun(){
    stopTimer();S.phase='over';draw();
    saveRun().then(function(){draw();loadBoard();});
  }
  // leaving the page or the tab in the middle of a run still saves your score
  function endActive(){
    if(S.phase==='show'||S.phase==='recall'||S.phase==='result'){
      stopTimer();S.phase='idle';saveRun().then(function(){loadBoard();});
    }else stopTimer();
  }

  // ---------- saving + leaderboard ----------
  async function saveRun(){
    if(!ME||S.score<1) return false;
    var run={score:S.score,level:Math.min(MAXL,S.rl)},rid=S.rid;
    try{
      if(!S.bestLoaded) await loadBoard();
      if(S.best&&!(run.score>S.best.score||(run.score===S.best.score&&run.level>S.best.level))) return false;
      await db.ref('hb/bbLeaderboard/'+ME.username).set(run);
      S.best=run;if(rid===S.rid) S.newBest=true;
      return true;
    }catch(e){console.error('blindfold save failed',e);return false;}
  }
  async function loadBoard(){
    var box=document.getElementById('bbBoard');
    var html;
    try{
      var snap=await db.ref('hb/bbLeaderboard').once('value'),users=snap.exists()?snap.val():{};
      var rows=Object.keys(users).map(function(u){return {u:u,score:users[u].score,level:users[u].level};})
        .filter(function(x){return typeof x.score==='number'&&typeof x.level==='number';});
      var mine=rows.filter(function(x){return ME&&x.u===ME.username;})[0];
      if(mine) S.best={score:mine.score,level:mine.level};
      S.bestLoaded=true;
      rows.sort(function(a,b){return (b.score-a.score)||(b.level-a.level);});
      rows=rows.slice(0,10);
      html=rows.length?rows.map(function(x,i){
        return '<div class="seat"><span class="who">#'+(i+1)+' <span class="user-link" data-user="'+esc(x.u)+'">'+esc(x.u)+'</span>'+(ME&&x.u===ME.username?' (you)':'')+
               '</span><span class="taken">'+x.score+' pts &middot; level '+x.level+'</span></div>';
      }).join(''):'<p class="desc">No runs yet. Be the first!</p>';
    }catch(e){
      console.error(e);
      html='<p class="desc">Could not load the leaderboard (publish the new Firebase rule).</p>';
    }
    box=document.getElementById('bbBoard');
    if(box) box.innerHTML='<div class="card"><h2>Top memories</h2><p class="desc">Most pieces placed correctly in one run, then the highest level.</p>'+html+'</div>';
    if(document.getElementById('bbGame')&&(S.phase==='idle'||S.phase==='over')) draw();
  }

  // ---------- Minigames page: Knight's tour | Blindfold board ----------
  var prevMG=window.renderMinigames;
  window.renderMinigames=function(){
    endActive();S.phase='idle';
    prevMG();
    var scr=document.getElementById('screen-minigames');
    if(!scr) return;
    var tabs=document.createElement('div');
    tabs.className='an-tabs';
    tabs.innerHTML='<button class="an-tabbtn active" data-mg="kt">Knight\'s tour</button><button class="an-tabbtn" data-mg="bb">Blindfold board</button>';
    scr.insertBefore(tabs,scr.firstChild);
    var wrap=document.createElement('div');
    wrap.id='bbWrap';wrap.style.display='none';
    wrap.innerHTML='<div id="bbGame"></div><div id="bbBoard"></div>';
    scr.appendChild(wrap);
    function setTab(t){
      var kg=document.getElementById('ktGame'),kb=document.getElementById('ktBoard');
      if(kg) kg.style.display=(t==='kt')?'':'none';
      if(kb) kb.style.display=(t==='kt')?'':'none';
      wrap.style.display=(t==='bb')?'block':'none';
      tabs.querySelectorAll('[data-mg]').forEach(function(b){b.classList.toggle('active',b.dataset.mg===t);});
      if(t==='bb'){S.phase='idle';draw();loadBoard();}
      else endActive();
    }
    tabs.querySelectorAll('[data-mg]').forEach(function(b){b.onclick=function(){setTab(b.dataset.mg);};});
  };
  var psh=window.showScreen;
  window.showScreen=function(n){
    if(n!=='minigames') endActive();
    return psh(n);
  };

  // ---------- best score on profiles ----------
  var po=window.openProfile;
  window.openProfile=async function(name){
    var r=await po.apply(this,arguments);
    try{
      var scr=document.getElementById('screen-profile'),nm=scr.querySelector('.pf-name');
      if(nm&&nm.textContent.indexOf(name)===0&&!scr.querySelector('[data-bb]')){
        var v=(await db.ref('hb/bbLeaderboard/'+name).once('value')).val();
        if(scr.querySelector('[data-bb]')||nm.textContent.indexOf(name)!==0) return r;
        var d=document.createElement('div');d.className='card';d.dataset.bb='1';
        d.innerHTML='<h2>Blindfold board best</h2><p class="desc" style="margin:0;">'+((v&&typeof v.score==='number')?v.score+' points, level '+v.level:'No runs yet')+'</p>';
        scr.appendChild(d);
      }
    }catch(e){console.error(e);}
    return r;
  };
})();
