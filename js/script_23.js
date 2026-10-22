(function(){
  var T=['p','n','b','r','q'];
  var GL={p:'\u265F\uFE0E',n:'\u265E\uFE0E',b:'\u265D\uFE0E',r:'\u265C\uFE0E',q:'\u265B\uFE0E',k:'\u265A\uFE0E'};
  var NM={p:'Pawn',n:'Knight',b:'Bishop',r:'Rook',q:'Queen',k:'King'};
  var VALS={p:1,n:3,b:3,r:5,q:9};
  var LIM={nominate:25000,bid:25000,place:90000};   // seconds before an idle player is auto-handled
  var auc=false, PL=null, busy=false;

  function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function opp(s){return s==='w'?'b':'w';}
  function nm(g,s){return g.seats[s==='w'?'white':'black']||'';}
  function shuffle(a){for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t;}return a;}

  // ================= auction rules =================
  // capacity: pawns on rank 2 (max 8), everything else shares the back rank with the king (max 7)
  function roomFor(au,s,t){var b=au.bought[s];return t==='p'?b.p<8:(b.n+b.b+b.r+b.q)<7;}
  function canBid(au,s,t,min){return !au.done[s]&&roomFor(au,s,t)&&au.coins[s]>=min;}
  function canNom(au,s){return !au.done[s]&&au.coins[s]>=1&&T.some(function(t){return roomFor(au,s,t);});}
  function nomOk(au,t){return canBid(au,'w',t,1)||canBid(au,'b',t,1);}

  function startNom(au){
    au.item='';au.bid=0;au.bidder='';au.np=0;au.phase='nominate';
    if(au.unsold>=3||au.round>=60||(!canNom(au,'w')&&!canNom(au,'b'))){au.phase='place';au.turn='';au.turnAt=serverNow();return;}
    if(!canNom(au,au.nom)) au.nom=opp(au.nom);
    au.turn=au.nom;au.turnAt=serverNow();
  }
  function sell(au,w){
    au.coins[w]-=au.bid;au.bought[w][au.item]++;
    au.lastW=w;au.lastT=au.item;au.lastBid=au.bid;
    au.unsold=0;au.round++;au.nom=opp(au.nom);startNom(au);
  }
  function noSale(au){
    au.lastW='';au.lastT=au.item;au.lastBid=0;
    au.unsold++;au.round++;au.nom=opp(au.nom);startNom(au);
  }
  function doAct(au,s,a){
    if(au.phase==='nominate'){
      if(au.turn!==s) return false;
      if(a.k==='stop'){au.done[s]=true;startNom(au);return true;}
      if(a.k==='nom'&&T.indexOf(a.t)>=0&&nomOk(au,a.t)&&canNom(au,s)){
        au.item=a.t;au.bid=0;au.bidder='';au.np=0;au.phase='bid';au.turnAt=serverNow();
        if(canBid(au,s,a.t,1)) au.turn=s; else {au.turn=opp(s);au.np=1;}
        return true;
      }
      return false;
    }
    if(au.phase==='bid'){
      if(au.turn!==s) return false;
      var o=opp(s);
      if(a.k==='bid'){
        var x=Math.floor(a.x);
        if(!(x>au.bid)||!canBid(au,s,au.item,x)) return false;
        au.bid=x;au.bidder=s;au.np=0;au.turnAt=serverNow();
        if(canBid(au,o,au.item,x+1)) au.turn=o; else sell(au,s);
        return true;
      }
      if(a.k==='pass'){
        if(au.bidder){sell(au,au.bidder);return true;}
        au.np++;
        if(au.np>=2||!canBid(au,o,au.item,1)) noSale(au); else {au.turn=o;au.turnAt=serverNow();}
        return true;
      }
    }
    return false;
  }

  // ================= layouts + starting position =================
  function validPlace(au,s,str){
    var m=/^([KQRBN.]{8})\|([P.]{8})$/.exec(str||''); if(!m) return false;
    var b=au.bought[s],c={K:0,Q:0,R:0,B:0,N:0};
    m[1].split('').forEach(function(ch){if(ch!=='.')c[ch]++;});
    var pc=m[2].split('').filter(function(ch){return ch==='P';}).length;
    return c.K===1&&c.Q===b.q&&c.R===b.r&&c.B===b.b&&c.N===b.n&&pc===b.p;
  }
  function randLayout(b){
    var back=['','','','','','','',''],pw=[0,0,0,0,0,0,0,0],list=['k'];
    ['q','r','b','n'].forEach(function(t){for(var i=0;i<b[t];i++)list.push(t);});
    var slots=shuffle([0,1,2,3,4,5,6,7]);list.forEach(function(t,i){back[slots[i]]=t;});
    var files=shuffle([0,1,2,3,4,5,6,7]);for(var i=0;i<b.p;i++)pw[files[i]]=1;
    return {back:back,pawns:pw};
  }
  function toStr(L){return L.back.map(function(x){return x?x.toUpperCase():'.';}).join('')+'|'+L.pawns.map(function(x){return x?'P':'.';}).join('');}
  function rowFen(str,upper){
    var o='',e=0;
    str.split('').forEach(function(c){
      if(c==='.'){e++;}else{if(e){o+=e;e=0;}o+=upper?c.toUpperCase():c.toLowerCase();}
    });
    return o+(e?e:'');
  }
  function finalize(g){
    var au=g.auction,w=au.place.w.split('|'),b=au.place.b.split('|');
    var fen=rowFen(b[0],false)+'/'+rowFen(b[1],false)+'/8/8/8/8/'+rowFen(w[1],true)+'/'+rowFen(w[0],true)+' w - - 0 1',turn='w';
    try{
      // if only Black's king starts in check, Black moves first so the position stays legal
      var bIn=new Chess(fen.replace(' w ',' b ')).in_check(),wIn=new Chess(fen).in_check();
      if(bIn&&!wIn){turn='b';fen=fen.replace(' w ',' b ');}
    }catch(e){}
    au.phase='done';au.turn='';
    g.fen=fen;g.turn=turn;g.status='active';g.announced='std';
    g.moveAt=serverNow();g.moveCount=0;
    g.statsApplied={};g.statsApplied[g.seats.white]=true;g.statsApplied[g.seats.black]=true;   // auction games don't touch W/L records
  }

  // ================= game creation =================
  function newAuctionGame(seats,tc,status){
    var B=15+Math.floor(Math.random()*36);   // 15..50 coins, same for both players
    var z=function(){return {p:0,n:0,b:0,r:0,q:0};};
    return {mode:'random',variant:'auction',status:status||'waiting',fen:new Chess().fen(),turn:'w',announced:'std',
      moveLog:[],winner:null,drawOffer:'',clock:freshClock(tc),seats:seats,
      auction:{budget:B,coins:{w:B,b:B},bought:{w:z(),b:z()},done:{w:false,b:false},nom:'w',phase:'nominate',item:'',bid:0,bidder:'',
        turn:'w',np:0,unsold:0,round:0,turnAt:serverNow(),lastW:'',lastT:'',lastBid:0,place:{w:'',b:''}}};
  }
  async function createAuctionRoom(){
    var code=genCode();
    await kset('hb:game:'+code,newAuctionGame({white:'',black:''},selectedTC,'waiting'),true);
    currentGameId=code;renderWaiting(code);
  }
  async function auctionQuick(){
    var hint=document.getElementById('quickHint');
    if(hint) hint.innerHTML='Searching... <span class="backlink" id="btnCancelQuick">cancel</span>';
    var cb=document.getElementById('btnCancelQuick');if(cb) cb.onclick=cancelQuickMatch;
    document.getElementById('btnQuick').disabled=true;
    var snap=await db.ref('hb/queue/random').once('value'),q=snap.exists()?snap.val():{},now=serverNow();
    var cand=Object.keys(q).find(function(u){return u!==ME.username&&!q[u].gameId&&q[u].tc===selectedTC&&q[u].variant==='auction'&&(now-q[u].joinedAt)<60000;});
    if(cand){
      var code=genCode(),meW=Math.random()<0.5;
      var game=newAuctionGame(meW?{white:ME.username,black:cand}:{white:cand,black:ME.username},selectedTC,'auction');
      await kset('hb:game:'+code,game,true);
      await db.ref('hb/queue/random/'+cand+'/gameId').set(code);
      await db.ref('hb/queue/random/'+ME.username).remove();
      currentGameId=code;enterGameScreen(code);
    }else{
      var me=db.ref('hb/queue/random/'+ME.username);
      await me.set({joinedAt:now,gameId:'',tc:selectedTC,variant:'auction'});
      me.onDisconnect().remove();
      activeListenerRef=db.ref('hb/queue/random/'+ME.username+'/gameId');
      activeListenerRef.on('value',function(s){
        var gid=s.val();
        if(gid){stopPoll();db.ref('hb/queue/random/'+ME.username).remove();currentGameId=gid;enterGameScreen(gid);}
      });
    }
  }

  // ================= talking to the database =================
  function actTx(gid,fn){
    return db.ref(dbPath('hb:game:'+gid)).transaction(function(cur){
      if(!cur) return cur;
      if(cur.status!=='auction'||!cur.auction) return;
      return fn(cur)?cur:undefined;
    }).catch(function(e){console.error('auction write failed',e);});
  }
  function send(a){
    var gid=currentGameId,me=gameState&&myRole(gameState);if(!me) return;var s=me.side;
    actTx(gid,function(g){
      var au=g.auction;
      if(a.k==='place'){
        if(au.phase!=='place'||au.place[s]||!validPlace(au,s,a.str)) return false;
        au.place[s]=a.str;if(au.place.w&&au.place.b) finalize(g);return true;
      }
      return doAct(au,s,a);
    });
  }
  function abortAuction(){
    actTx(currentGameId,function(g){
      g.status='finished';g.winner='abort';g.statusNote='auction aborted';
      g.statsApplied={};g.statsApplied[g.seats.white]=true;g.statsApplied[g.seats.black]=true;return true;
    });
  }
  function timeoutTx(ph,gid){
    actTx(gid,function(g){
      var au=g.auction;
      if(au.phase!==ph||serverNow()-au.turnAt<=LIM[ph]) return false;
      if(ph==='nominate'){
        var ok=T.filter(function(t){return nomOk(au,t);});
        return ok.length>0&&doAct(au,au.turn,{k:'nom',t:ok[Math.floor(Math.random()*ok.length)]});
      }
      if(ph==='bid') return doAct(au,au.turn,{k:'pass'});
      ['w','b'].forEach(function(s){if(!au.place[s]) au.place[s]=toStr(randLayout(au.bought[s]));});
      finalize(g);return true;
    });
  }
  setInterval(function(){
    var g=gameState,scr=document.getElementById('screen-game');
    if(!g||g.variant!=='auction'||g.status!=='auction'||!scr||scr.style.display!=='block'||!myRole(g)) return;
    var au=g.auction,lim=LIM[au.phase];if(!lim) return;
    var left=lim-(serverNow()-au.turnAt),el=document.getElementById('auTimer');
    if(el) el.textContent=Math.max(0,Math.ceil(left/1000))+'s';
    if(left>-1000||busy) return;
    busy=true;setTimeout(function(){busy=false;},4000);
    timeoutTx(au.phase,currentGameId);
  },1000);

  // ================= drawing =================
  function pieceSpan(t,side){return '<span class="au-g '+(side==='w'?'wh':'bk')+'">'+GL[t]+'</span>';}
  function panel(g,au,s,my,isMe){
    var b=au.bought[s];
    var army=['q','r','b','n','p'].map(function(t){return b[t]?'<span class="au-pc">'+GL[t]+'<b>\u00d7'+b[t]+'</b></span>':'';}).join('')||'<span class="hint">no pieces yet</span>';
    return '<div class="au-p'+(isMe?' me':'')+'"><div class="au-nm">'+esc(nm(g,s))+(isMe?' (you)':'')+'</div><div class="au-coins">'+au.coins[s]+' <small>coins</small></div>'+
      '<div class="au-army">'+army+'</div><div class="hint">'+(b.n+b.b+b.r+b.q)+'/7 pieces &middot; '+b.p+'/8 pawns'+(au.done[s]?' &middot; stopped buying':'')+'</div></div>';
  }
  function slotRow(strOrArr,isPawn,my,editable){
    var h='<div class="au-row">';
    for(var i=0;i<8;i++){
      var v=isPawn?(typeof strOrArr==='string'?(strOrArr.charAt(i)==='P'?'p':''):(strOrArr[i]?'p':'')):(typeof strOrArr==='string'?(strOrArr.charAt(i)==='.'?'':strOrArr.charAt(i).toLowerCase()):strOrArr[i]);
      h+='<div class="au-slot '+((i+(isPawn?1:0))%2?'dk':'lt')+'"'+(editable?' data-'+(isPawn?'pawn':'back')+'="'+i+'"':'')+'>'+(v?pieceSpan(v,my):'')+'</div>';
    }
    return h+'</div>';
  }
  function used(){
    var u={k:0,q:0,r:0,b:0,n:0,p:0};
    PL.back.forEach(function(x){if(x)u[x]++;});PL.pawns.forEach(function(x){if(x)u.p++;});return u;
  }
  function placeHtml(au,my){
    var b=au.bought[my];
    if(au.place[my]){
      var p=au.place[my].split('|');
      return '<div class="au-lot"><div style="margin-bottom:6px;"><b>Your army is locked in.</b> Waiting for your opponent...</div>'+slotRow(p[1],true,my,false)+slotRow(p[0],false,my,false)+'</div>';
    }
    if(!PL||PL.gid!==currentGameId) PL={gid:currentGameId,back:['','','','','','','',''],pawns:[0,0,0,0,0,0,0,0],sel:null};
    var tot={k:1,q:b.q,r:b.r,b:b.b,n:b.n,p:b.p},u=used();
    var tray=['k','q','r','b','n','p'].filter(function(t){return tot[t]>0;}).map(function(t){
      var left=tot[t]-u[t];
      return '<button class="'+(PL.sel===t?'':'secondary')+'" data-sel="'+t+'"'+(left<=0?' disabled':'')+'>'+pieceSpan(t,my)+' '+NM[t]+' \u00d7'+left+'</button>';
    }).join('');
    var all=Object.keys(tot).every(function(t){return u[t]===tot[t];});
    return '<div class="au-lot"><div style="margin-bottom:6px;"><b>Place your army</b> <span class="hint">(<span id="auTimer"></span>)</span></div>'+
      '<div class="hint">Pick a piece, then a square. Click a placed piece to take it back. Pawns go on your 2nd rank, everything else on your back rank.</div>'+
      '<div class="au-acts">'+tray+'</div>'+
      '<div class="hint" style="margin-top:10px;">Pawn rank</div>'+slotRow(PL.pawns,true,my,true)+
      '<div class="hint">Back rank</div>'+slotRow(PL.back,false,my,true)+
      '<div class="au-acts"><button class="secondary" id="auRand">Randomize</button><button class="secondary" id="auClear">Clear</button><button id="auLock"'+(all?'':' disabled')+'>Lock in</button></div></div>';
  }
  function drawAuction(g){
    var el=document.getElementById('screen-game'),au=g.auction,me=myRole(g),my=me?me.side:'w',o=opp(my);
    var timer=' <span class="hint">(<span id="auTimer"></span>)</span>';
    var mine=!!me&&au.turn===my,turnName=esc(nm(g,au.turn)),body='';
    var last=au.lastT?(au.lastW?esc(nm(g,au.lastW))+' bought a '+NM[au.lastT].toLowerCase()+' for '+au.lastBid+' coins.':'The '+NM[au.lastT].toLowerCase()+' went unsold.'):'';
    if(au.phase==='nominate'){
      if(mine) body='<div class="au-lot">Your turn: put a piece up for auction.'+timer+'<div class="au-acts">'+
        T.slice().reverse().map(function(t){return '<button data-nom="'+t+'"'+(nomOk(au,t)?'':' disabled')+'>'+GL[t]+' '+NM[t]+' <small>('+VALS[t]+')</small></button>';}).join('')+
        '<button class="secondary" data-stop="1">Stop buying</button></div></div>';
      else body='<div class="au-lot">'+turnName+' is choosing a piece...'+timer+'</div>';
    }else if(au.phase==='bid'){
      body='<div class="au-lot"><div class="au-big">'+GL[au.item]+'</div><div><b>'+NM[au.item]+'</b> (standard value '+VALS[au.item]+')</div><div style="margin:6px 0;">'+
        (au.bidder?'Current bid: <b>'+au.bid+'</b> by '+esc(nm(g,au.bidder)):'No bids yet')+'</div>';
      if(mine){
        var min=au.bid+1;
        body+='<div class="au-acts"><input type="number" id="auBid" min="'+min+'" max="'+au.coins[my]+'" value="'+min+'"><button id="auBidBtn">Bid</button><button class="secondary" id="auPass">'+(au.bidder?'Drop out':'Pass')+'</button></div><div class="hint">Your move'+timer+'</div>';
      }else body+='<div class="hint">Waiting for '+turnName+timer+'</div>';
      body+='</div>';
    }else if(au.phase==='place'){
      body=me?placeHtml(au,my):'<div class="au-lot">The players are placing their armies...'+timer+'</div>';
    }
    el.innerHTML='<div class="card"><h2>Piece Auction</h2><p class="desc">Everyone always has a king. Bid coins for pieces one at a time ('+au.budget+' coins each this game). Pawns go on the 2nd rank and everything else shares the back rank with the king, so you can hold at most 8 pawns and 7 other pieces.</p>'+
      '<div class="au-top">'+panel(g,au,my,my,!!me)+panel(g,au,o,my,false)+'</div>'+(last?'<p class="au-last">'+last+'</p>':'')+body+
      (me?'<div style="margin-top:12px;"><span class="backlink" id="auAbort">Abort game</span></div>':'')+'</div>';

    el.querySelectorAll('[data-nom]').forEach(function(b){b.onclick=function(){send({k:'nom',t:b.dataset.nom});};});
    el.querySelectorAll('[data-stop]').forEach(function(b){b.onclick=function(){send({k:'stop'});};});
    var bb=document.getElementById('auBidBtn'),inp=document.getElementById('auBid');
    function doBid(){bb.disabled=true;send({k:'bid',x:parseInt(inp.value,10)});}
    if(bb){bb.onclick=doBid;inp.onkeydown=function(e){if(e.key==='Enter')doBid();};}
    var ps=document.getElementById('auPass');if(ps) ps.onclick=function(){ps.disabled=true;send({k:'pass'});};
    var ab=document.getElementById('auAbort');if(ab) ab.onclick=function(){if(confirm('Abort this game? No result for either player.'))abortAuction();};
    if(au.phase==='place'&&me&&!au.place[my]&&PL){
      var b=au.bought[my],tot={k:1,q:b.q,r:b.r,b:b.b,n:b.n,p:b.p};
      el.querySelectorAll('[data-sel]').forEach(function(x){x.onclick=function(){PL.sel=(PL.sel===x.dataset.sel?null:x.dataset.sel);drawGame();};});
      el.querySelectorAll('[data-back]').forEach(function(x){x.onclick=function(){
        var i=+x.dataset.back;
        if(PL.back[i]) PL.back[i];
        if(PL.back[i]){PL.back[i]='';}
        else if(PL.sel&&PL.sel!=='p'&&used()[PL.sel]<tot[PL.sel]){PL.back[i]=PL.sel;if(used()[PL.sel]>=tot[PL.sel])PL.sel=null;}
        drawGame();};});
      el.querySelectorAll('[data-pawn]').forEach(function(x){x.onclick=function(){
        var i=+x.dataset.pawn;
        if(PL.pawns[i]){PL.pawns[i]=0;}
        else if(PL.sel==='p'&&used().p<tot.p){PL.pawns[i]=1;if(used().p>=tot.p)PL.sel=null;}
        drawGame();};});
      document.getElementById('auRand').onclick=function(){var L=randLayout(b);PL.back=L.back;PL.pawns=L.pawns;PL.sel=null;drawGame();};
      document.getElementById('auClear').onclick=function(){PL.back=['','','','','','','',''];PL.pawns=[0,0,0,0,0,0,0,0];PL.sel=null;drawGame();};
      document.getElementById('auLock').onclick=function(){this.disabled=true;send({k:'place',str:toStr(PL)});};
    }
  }

  // ================= hooks into the rest of the site =================
  var prevDraw=window.drawGame;
  window.drawGame=function(){
    var g=gameState;
    if(g&&g.variant==='auction'&&g.status==='auction'){try{drawAuction(g);}catch(e){console.error('auction draw failed',e);}return;}
    prevDraw();
    if(g&&g.variant==='auction'){
      var a=document.querySelector('#screen-game .announce');if(a) a.style.display='none';
      document.querySelectorAll('#screen-game .status-msg').forEach(function(e){if(e.textContent.indexOf('Click a highlighted')===0) e.textContent='Your move: click a piece, then a square.';});
      document.querySelectorAll('#screen-game .result-banner .rc').forEach(function(d){if(/^Updating rating/.test(d.textContent)) d.remove();});
      var an=document.getElementById('btnAnalyzeGame');if(an) an.remove();   // custom start positions can't be analysed yet
    }
  };
  var pk=window.kset;
  window.kset=function(key,value,shared){
    if(shared!==false&&typeof key==='string'&&key.indexOf('hb:game:')===0&&value&&value.variant==='auction'&&value.status==='active'&&!value.announced) value.announced='std';
    return pk(key,value,shared);
  };
  var pw=window.drawWaiting;
  window.drawWaiting=function(code,game){
    if(game&&game.variant==='auction'&&game.status==='auction'){stopPoll();enterGameScreen(code);return;}
    return pw(code,game);
  };
  var pt=window.takeSeat;
  window.takeSeat=async function(code,key){
    var g=await kget('hb:game:'+code,true);
    if(!g||g.variant!=='auction') return pt(code,key);
    if(g.status!=='waiting'||g.seats[key]) return;
    Object.keys(g.seats).forEach(function(k){if(g.seats[k]===ME.username) g.seats[k]='';});
    g.seats[key]=ME.username;
    if(allSeatsFilled(g)){g.status='auction';g.auction.turnAt=serverNow();}
    await kset('hb:game:'+code,g,true);
  };
  var pr=window.acceptRematch;
  window.acceptRematch=async function(){
    var g0=gameState;
    if(!g0||g0.variant!=='auction') return pr();
    var gid=currentGameId,f=await kget('hb:game:'+gid,true);
    if(!f||f.status!=='finished'||f.rematchGameId||!myRole(f)) return;
    var s=f.seats,code=genCode();
    await kset('hb:game:'+code,newAuctionGame({white:s.black,black:s.white},(f.clock&&f.clock.tcKey)||'none','auction'),true);
    await db.ref(dbPath('hb:game:'+gid+'/rematchGameId')).set(code);
  };
  var pa=window.afterAuth;
  window.afterAuth=async function(){
    try{
      if(!new URLSearchParams(location.search).get('room')){
        var last=await kget('hb:lastgame',false);
        if(last&&last.gameId&&(Date.now()-last.savedAt)<7*86400000){
          var g=await kget('hb:game:'+last.gameId,true);
          if(g&&g.variant==='auction'&&g.status==='auction'&&myRoleForUser(g,ME.username)){currentGameId=last.gameId;enterGameScreen(last.gameId);return;}
        }
      }
    }catch(e){console.error(e);}
    return pa();
  };

  // ---------- lobby: third variant button ----------
  document.getElementById('navbar').addEventListener('click',function(e){
    var a=e.target.closest('[data-nav]');if(a&&a.dataset.nav==='play') auc=false;
  },true);
  var pl=window.renderLobby;
  window.renderLobby=function(){
    pl();
    try{
      var el=document.getElementById('screen-lobby'),grp=el.querySelector('.modes');
      if(!grp||el.querySelector('[data-variant="auction"]')) return;
      grp.querySelectorAll('[data-variant]').forEach(function(b){
        var o=b.onclick;b.onclick=function(){auc=false;if(o) o.call(b);};
      });
      var nb=document.createElement('div');
      nb.className='modebtn';nb.dataset.variant='auction';
      nb.innerHTML='Piece Auction<div class="hint">Bid coins, build your army</div>';
      nb.onclick=function(){auc=true;window.renderLobby();};
      grp.appendChild(nb);
      if(!auc) return;
      grp.querySelectorAll('[data-variant]').forEach(function(b){b.classList.toggle('active',b===nb);});
      var tg=document.getElementById('qmToggle');if(tg) tg.style.display='none';
      var qb=document.getElementById('btnQuick'),qc=qb.closest('.card'),qd=qc.querySelector('p.desc');
      if(qd) qd.textContent='1v1 Piece Auction. Get matched with someone looking to play right now. Unrated.';
      qb.textContent='Find opponent';qb.onclick=auctionQuick;
      var cb=document.getElementById('btnCreate'),fm=cb.closest('.card').querySelector('.modes');
      if(fm) fm.style.display='none';
      cb.onclick=createAuctionRoom;
      var r=document.getElementById('lobbyRating');
      if(r){r.removeAttribute('id');r.textContent='Piece Auction games are unrated.';}
    }catch(e){console.error('auction lobby failed',e);}
  };
})();
