(function(){
  var FILES = 'abcdefgh';
  var NM = {p:'Pawn', n:'Knight', b:'Bishop', r:'Rook', q:'Queen', k:'King'};
  var GL = {p:'\u265F\uFE0E', n:'\u265E\uFE0E', b:'\u265D\uFE0E', r:'\u265C\uFE0E', q:'\u265B\uFE0E', k:'\u265A\uFE0E'};
  var VALS = {p:1, n:3, b:3, r:5, q:9};
  var T = ['p','n','b','r','q'];
  var PRESETS = [{n:'Beginner', s:0}, {n:'Easy', s:5}, {n:'Medium', s:10}, {n:'Hard', s:15}, {n:'Expert', s:20}];
  var SF_URLS = [
    'https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js',
    'https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js',
    'https://unpkg.com/stockfish.js@10.0.2/stockfish.js'
  ];
  var PKEY = 'pawniac-bot';
  var S = {variant:'std', hbMode:'brain', skill:10, color:'random', tc:'5+3', custom:false, cmin:10, cinc:0};
  try{ var raw = localStorage.getItem(PKEY); if(raw) Object.assign(S, JSON.parse(raw)); }catch(e){}
  function saveS(){ try{ localStorage.setItem(PKEY, JSON.stringify(S)); }catch(e){} }
  S.skill = Math.min(20, Math.max(0, parseInt(S.skill, 10) || 0));
  var G = null;

  // ---------- screen + nav link ----------
  var scr = document.createElement('div');
  scr.id = 'screen-bot'; scr.style.display = 'none';
  document.querySelector('.wrap').appendChild(scr);
  var nav = document.getElementById('navbar');
  var link = document.createElement('a');
  link.dataset.nav = 'bot'; link.textContent = 'Play bot';
  nav.querySelector('[data-nav="play"]').after(link);
  link.onclick = function(){
    var gs = document.getElementById('screen-game');
    if(gs && gs.style.display === 'block' && gameState && gameState.status === 'active' &&
       !confirm('Your clock keeps running while you are away. Leave the game view?')) return;
    stopPoll(); renderBot();
  };
  var prevShow = window.showScreen;
  window.showScreen = function(n){
    prevShow(n);
    scr.style.display = (n === 'bot') ? 'block' : 'none';
    if(n === 'bot') nav.querySelectorAll('[data-nav]').forEach(function(a){ a.classList.toggle('active', a.dataset.nav === 'bot'); });
  };
  function renderBot(){ showScreen('bot'); draw(); }

  // ---------- helpers ----------
  function snd(n){ try{ if(typeof window[n] === 'function') window[n](); }catch(e){} }
  function opp(s){ return s === 'w' ? 'b' : 'w'; }
  function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
  function shuffle(a){ for(var i = a.length - 1; i > 0; i--){ var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function pimg(c, t){
    return '<img class="piece-img" src="' + pieceImgUrl(c, t) + '" alt="" draggable="false" onerror="this.outerHTML=\'<span style=&quot;font-size:1em;line-height:1;&quot;>' + PIECE_UNICODE[c][t] + '</span>\'">';
  }
  function randomMove(fen){
    var l = new Chess(fen).moves({verbose:true});
    if(!l.length) return null;
    var m = l[Math.floor(Math.random() * l.length)];
    return m.from + m.to + (m.promotion || '');
  }
  function levelName(){
    var n = PRESETS[0].n;
    PRESETS.forEach(function(p){ if(S.skill >= p.s) n = p.n; });
    return n;
  }

  // ---------- Stockfish: several sources, two loading methods, retries, cached ----------
  var eng = {w:null, state:'idle', p:null};
  var chain = Promise.resolve();
  function paintEng(){
    var e = document.getElementById('bEng'), b = document.getElementById('bStart');
    if(b) b.disabled = (eng.state !== 'ready');
    if(!e) return;
    if(eng.state === 'ready') e.innerHTML = 'Engine ready.';
    else if(eng.state === 'fail') e.innerHTML = 'Could not load the engine (check your connection or ad blocker). <span class="backlink" id="bRetry">Retry</span>';
    else e.innerHTML = 'Loading the engine... (first time only, then it is saved on your device)';
    var r = document.getElementById('bRetry');
    if(r) r.onclick = function(){ eng.p = null; eng.state = 'idle'; boot(); };
  }
  function setEng(s){ eng.state = s; paintEng(); }
  function mk(blobUrl){
    return new Promise(function(res, rej){
      var w;
      try{ w = new Worker(blobUrl); }catch(e){ rej(e); return; }
      var to = setTimeout(function(){ try{ w.terminate(); }catch(e){} rej(new Error('timeout')); }, 30000);
      w.onmessage = function(e){ if(String(e.data).indexOf('uciok') >= 0){ clearTimeout(to); w.onmessage = null; res(w); } };
      w.onerror = function(){ clearTimeout(to); try{ w.terminate(); }catch(e){} rej(new Error('worker')); };
      w.postMessage('uci');
    });
  }
  async function tryUrl(url){
    var txt = null, cache = null;
    try{
      cache = window.caches ? await caches.open('pawniac-sf-v1') : null;
      var hit = cache ? await cache.match(url) : null;
      if(hit) txt = await hit.text();
      else {
        var r = await fetch(url);
        if(!r.ok) throw new Error('http');
        txt = await r.text();
        if(txt.length < 20000) throw new Error('small');
        if(cache) cache.put(url, new Response(txt)).catch(function(){});
      }
    }catch(e){ txt = null; }
    if(txt){
      try{ return await mk(URL.createObjectURL(new Blob([txt], {type:'application/javascript'}))); }
      catch(e){ if(cache) cache.delete(url).catch(function(){}); }
    }
    // second method: let the worker import the script itself (no CORS needed)
    return await mk(URL.createObjectURL(new Blob(["importScripts('" + url + "');"], {type:'application/javascript'})));
  }
  function loadSF(){
    if(eng.p) return eng.p;
    setEng('loading');
    eng.p = (async function(){
      if(window.PawniacSF){
        try{
          var w0 = await window.PawniacSF.get();
          w0.onerror = function(){ eng.w = null; eng.p = null; eng.state = 'idle'; };
          eng.w = w0; setEng('ready'); return w0;
        }catch(e){ console.warn('local engine not available, using the CDN one', e); }
      }
      for(var a = 0; a < 3; a++){
        for(var i = 0; i < SF_URLS.length; i++){
          try{
            var w = await tryUrl(SF_URLS[i]);
            w.onerror = function(){ eng.w = null; eng.p = null; eng.state = 'idle'; };
            eng.w = w; setEng('ready'); return w;
          }catch(e){ console.warn('bot engine source failed', SF_URLS[i], e); }
        }
        await sleep(1500 * (a + 1));
      }
      setEng('fail');
      return null;
    })();
    eng.p.then(function(w){ if(!w) eng.p = null; });
    return eng.p;
  }
  function boot(){ if(eng.state !== 'ready' && eng.state !== 'loading') loadSF(); else paintEng(); }

  function baseMs(){ return 100 + S.skill * 70; }                          // 100 ms ... 1500 ms
  function thinkMs(side){
    var ms = baseMs();
    if(G && G.clock) ms = Math.min(ms, Math.max(50, remMs(side) / 30));    // think faster when short on time
    return Math.round(ms);
  }
  function run(fen, ms){
    return loadSF().then(function(w){
      if(!w) return randomMove(fen);
      return new Promise(function(res){
        var guard = setTimeout(function(){ w.removeEventListener('message', h); res(randomMove(fen)); }, ms + 10000);
        function h(e){
          var s = String(e.data);
          if(s.indexOf('bestmove') === 0){
            clearTimeout(guard); w.removeEventListener('message', h);
            var m = s.split(' ')[1];
            res(m && m !== '(none)' ? m : randomMove(fen));
          }
        }
        w.addEventListener('message', h);
        w.postMessage('setoption name MultiPV value 1');
        w.postMessage('setoption name Skill Level value ' + S.skill);
        w.postMessage('position fen ' + fen);
        w.postMessage('go movetime ' + ms);
      });
    });
  }
  function best(fen, ms){ var p = chain.then(function(){ return run(fen, ms); }); chain = p.catch(function(){}); return p; }

  // ---------- clock ----------
  function tcVals(){
    if(S.custom) return {init:Math.max(1, S.cmin) * 60, inc:Math.max(0, S.cinc)};
    var t = getTC(S.tc);
    return {init:t.initial || 300, inc:t.increment || 0};
  }
  function mkClock(){
    var v = tcVals(), ms = v.init * 1000;
    return {w:ms, b:ms, inc:v.inc * 1000, t0:Date.now()};
  }
  function remMs(side){
    var c = G && G.clock;
    if(!c) return 0;
    var r = c[side];
    if(G.phase === 'play' && !G.over && G.chess && G.chess.turn() === side) r -= (Date.now() - c.t0);
    return r;
  }
  function flagCheck(){
    if(!G || G.over || G.phase !== 'play' || !G.clock || !G.chess) return;
    var loser = G.chess.turn();
    if(remMs(loser) > 0) return;
    G.clock[loser] = 0;
    var winner = opp(loser);
    if(G.chess.insufficient_material()) finish('Draw (time ran out, but nobody can mate)', 'd');
    else finish(winner === G.me ? 'You win on time!' : 'Bot wins on time', winner === G.me ? 'w' : 'l');
  }
  setInterval(function(){
    if(!G || !G.clock || G.over || G.phase !== 'play') return;
    flagCheck();
    if(G.over) return;
    ['w','b'].forEach(function(s){
      var e = document.getElementById('bk' + s);
      if(e) e.textContent = fmtClock(remMs(s));
    });
  }, 200);
  function clkHtml(color){
    var on = G.phase === 'play' && !G.over && G.chess.turn() === color;
    return '<div class="clock' + (on ? ' active' : '') + '"><span class="label">' + (color === G.me ? 'You' : 'Bot') + '</span><span id="bk' + color + '">' + fmtClock(remMs(color)) + '</span></div>';
  }

  // ---------- starting a game ----------
  function startNew(){
    if(eng.state !== 'ready'){ boot(); return; }
    var me = S.color === 'random' ? (Math.random() < .5 ? 'w' : 'b') : S.color;
    G = {variant:S.variant, hbMode:S.hbMode, me:me, bot:opp(me), phase:'play', chess:null, ann:null, sel:null, last:null,
         log:[], said:'', msg:'', busy:false, over:null, au:null, layout:null, sel2:null, clock:null};
    if(eng.w) try{ eng.w.postMessage('ucinewgame'); }catch(e){}
    if(G.variant === 'auction'){ initAuction(); }
    else { G.chess = new Chess(); G.clock = mkClock(); nextTurn(); }
  }

  // ---------- playing ----------
  function canMove(){
    return !!G && G.phase === 'play' && !G.over && !G.busy && !G.promo && G.chess.turn() === G.me && (G.variant !== 'hb' || !!G.ann);
  }
  function autoQ(){
    try{ return !!JSON.parse(localStorage.getItem('pawniac-settings') || '{}').autoQueen; }catch(e){ return false; }
  }
  function humanMove(m){
    if(m.promotion && !autoQ()){ G.promo = {from:m.from, to:m.to}; G.sel = null; draw(); return; }
    play(m.from, m.to, m.promotion ? 'q' : undefined); nextTurn();
  }
  function allowed(){
    var l = G.chess.moves({verbose:true});
    return (G.variant === 'hb' && G.ann) ? l.filter(function(m){ return m.piece === G.ann; }) : l;
  }
  function play(from, to, promo){
    flagCheck();
    if(G.over) return null;
    var mover = G.chess.turn();
    var mv = G.chess.move({from:from, to:to, promotion:promo || 'q'});
    if(!mv) return null;
    if(G.clock){
      var now = Date.now();
      G.clock[mover] = G.clock[mover] - (now - G.clock.t0) + G.clock.inc;
      G.clock.t0 = now;
    }
    G.last = {from:mv.from, to:mv.to}; G.log.push(mv.san); G.ann = null; G.sel = null;
    snd(/[+#]/.test(mv.san) ? 'playCheckSound' : (mv.captured ? 'playCaptureSound' : 'playMoveSound'));
    return mv;
  }
  function finish(text, r){
    G.over = text; G.busy = false;
    snd(r === 'w' ? 'playWinSound' : (r === 'l' ? 'playLossSound' : 'playDrawSound'));
    draw();
  }
  function checkEnd(){
    var c = G.chess;
    if(!c.game_over()) return false;
    if(c.in_checkmate()){
      var botWon = c.turn() === G.me;
      finish(botWon ? 'Bot wins by checkmate' : 'You win by checkmate!', botWon ? 'l' : 'w');
    } else {
      finish('Draw' + (c.in_stalemate() ? ' (stalemate)' : c.insufficient_material() ? ' (insufficient material)' : c.in_threefold_repetition() ? ' (repetition)' : ' (50-move rule)'), 'd');
    }
    return true;
  }
  function nextTurn(){
    if(!G || G.over) return;
    if(checkEnd()) return;
    if(G.chess.turn() === G.me){
      if(G.variant === 'hb' && !G.ann && G.hbMode === 'brain') brainName();
      else draw();
    } else botMove();
  }
  function brainName(){
    var g = G; g.busy = true; g.msg = 'Your bot Brain is choosing a piece...'; draw();
    best(g.chess.fen(), thinkMs(g.me)).then(function(u){
      if(G !== g || g.over) return;
      var p = u ? g.chess.get(u.slice(0, 2)) : null, types = g.chess.moves({verbose:true}).map(function(m){ return m.piece; });
      g.ann = p ? p.type : types[0];
      g.busy = false; g.msg = ''; draw();
    });
  }
  function botMove(){
    var g = G, t0 = Date.now();
    g.busy = true; g.msg = 'Bot is thinking...'; draw();
    best(g.chess.fen(), thinkMs(g.bot)).then(function(u){
      setTimeout(function(){
        if(G !== g || g.over) return;
        var mv = u ? play(u.slice(0, 2), u.slice(2, 4), u.slice(4, 5) || 'q') : null;
        if(g.over) return;
        if(!mv){ var r = randomMove(g.chess.fen()); if(r) mv = play(r.slice(0, 2), r.slice(2, 4), r.slice(4, 5) || 'q'); }
        if(g.over) return;
        g.busy = false; g.msg = '';
        if(mv) g.said = g.variant === 'hb' ? 'Bot (Brain) named the ' + NM[mv.piece].toLowerCase() + ' and played ' + mv.san + '.' : 'Bot played ' + mv.san + '.';
        nextTurn();
      }, Math.max(0, 300 - (Date.now() - t0)));
    });
  }
  function cellClick(sq){
    if(!canMove()) return;
    var al = allowed();
    if(G.sel){
      var mv = al.filter(function(m){ return m.from === G.sel && m.to === sq; })[0];
          if(mv){ humanMove(mv); return; }
    }
    G.sel = al.some(function(m){ return m.from === sq; }) ? sq : null;
    draw();
  }
  function randomize(){
    if(!G || G.variant !== 'hb' || G.over || G.busy || G.ann || G.chess.turn() !== G.me) return;
    var l = G.chess.moves({verbose:true});
    if(!l.length) return;
    G.ann = l[Math.floor(Math.random() * l.length)].piece;
    snd('playRandomizeSound'); draw();
  }

  // ---------- Piece Auction (same rules as the online version) ----------
  function roomFor(au, s, t){ var b = au.bought[s]; return t === 'p' ? b.p < 8 : (b.n + b.b + b.r + b.q) < 7; }
  function canBid(au, s, t, min){ return !au.done[s] && roomFor(au, s, t) && au.coins[s] >= min; }
  function canNom(au, s){ return !au.done[s] && au.coins[s] >= 1 && T.some(function(t){ return roomFor(au, s, t); }); }
  function nomOk(au, t){ return canBid(au, 'w', t, 1) || canBid(au, 'b', t, 1); }
  function startNom(au){
    au.item = ''; au.bid = 0; au.bidder = ''; au.np = 0; au.phase = 'nominate';
    if(au.unsold >= 3 || au.round >= 60 || (!canNom(au, 'w') && !canNom(au, 'b'))){ au.phase = 'place'; au.turn = ''; return; }
    if(!canNom(au, au.nom)) au.nom = opp(au.nom);
    au.turn = au.nom;
  }
  function sell(au, w){
    au.coins[w] -= au.bid; au.bought[w][au.item]++;
    au.lastW = w; au.lastT = au.item; au.lastBid = au.bid;
    au.unsold = 0; au.round++; au.nom = opp(au.nom); startNom(au);
  }
  function noSale(au){
    au.lastW = ''; au.lastT = au.item; au.lastBid = 0;
    au.unsold++; au.round++; au.nom = opp(au.nom); startNom(au);
  }
  function doAct(au, s, a){
    if(au.phase === 'nominate'){
      if(au.turn !== s) return false;
      if(a.k === 'stop'){ au.done[s] = true; startNom(au); return true; }
      if(a.k === 'nom' && T.indexOf(a.t) >= 0 && nomOk(au, a.t) && canNom(au, s)){
        au.item = a.t; au.bid = 0; au.bidder = ''; au.np = 0; au.phase = 'bid';
        if(canBid(au, s, a.t, 1)) au.turn = s; else { au.turn = opp(s); au.np = 1; }
        return true;
      }
      return false;
    }
    if(au.phase === 'bid'){
      if(au.turn !== s) return false;
      var o = opp(s);
      if(a.k === 'bid'){
        var x = Math.floor(a.x);
        if(!(x > au.bid) || !canBid(au, s, au.item, x)) return false;
        au.bid = x; au.bidder = s; au.np = 0;
        if(canBid(au, o, au.item, x + 1)) au.turn = o; else sell(au, s);
        return true;
      }
      if(a.k === 'pass'){
        if(au.bidder){ sell(au, au.bidder); return true; }
        au.np++;
        if(au.np >= 2 || !canBid(au, o, au.item, 1)) noSale(au); else au.turn = o;
        return true;
      }
    }
    return false;
  }
  function initAuction(){
    var B = 15 + Math.floor(Math.random() * 36), z = function(){ return {p:0, n:0, b:0, r:0, q:0}; };
    G.phase = 'auction';
    G.au = {budget:B, coins:{w:B, b:B}, bought:{w:z(), b:z()}, done:{w:false, b:false}, nom:'w', phase:'nominate', item:'', bid:0,
            bidder:'', turn:'w', np:0, unsold:0, round:0, lastW:'', lastT:'', lastBid:0};
    afterAct();
  }
  function afterAct(){
    var au = G.au;
    if(au.phase === 'place'){
      if(!G.layout) G.layout = randLayout(au.bought[G.me]);
      G.phase = 'place'; draw(); return;
    }
    draw();
    if(au.turn === G.bot){ var g = G; setTimeout(function(){ if(G === g && g.phase === 'auction') botAuc(); }, 800); }
  }
  function aucAct(a){
    if(!G || G.phase !== 'auction') return;
    if(doAct(G.au, G.me, a)){ G.msg = ''; afterAct(); } else { G.msg = 'That is not a valid move.'; draw(); }
  }
  function botAuc(){
    var au = G.au, s = G.bot;
    if(au.turn !== s) return;
    if(au.phase === 'nominate'){
      var ok = T.filter(function(t){ return nomOk(au, t); });
      if(!ok.length) doAct(au, s, {k:'stop'});
      else {
        var w = {p:3, n:3, b:3, r:2, q:1}, pool = [];
        ok.forEach(function(t){ for(var i = 0; i < w[t]; i++) pool.push(t); });
        doAct(au, s, {k:'nom', t:pool[Math.floor(Math.random() * pool.length)]});
      }
    } else if(au.phase === 'bid'){
      var t = au.item, maxB = Math.max(1, Math.round(VALS[t] * au.budget / 18 * (0.7 + Math.random() * 0.7)));
      maxB = Math.min(maxB, au.coins[s]);
      var nx = au.bid + 1;
      if(nx <= maxB && canBid(au, s, t, nx)) doAct(au, s, {k:'bid', x: au.bidder ? nx : Math.max(1, Math.min(maxB, Math.round(maxB * 0.35)))});
      else doAct(au, s, {k:'pass'});
    }
    afterAct();
  }
  function randLayout(b){
    var list = ['k'];
    ['q','r','b','n'].forEach(function(t){ for(var i = 0; i < b[t]; i++) list.push(t); });
    var sl = shuffle([0,1,2,3,4,5,6,7]), back = ['','','','','','','',''];
    list.forEach(function(t, i){ back[sl[i]] = t; });
    var fl = shuffle([0,1,2,3,4,5,6,7]), pw = ['','','','','','','',''];
    for(var i = 0; i < b.p; i++) pw[fl[i]] = 'p';
    return {back:back, pawns:pw};
  }
  function rowF(a, up){
    var o = '', e = 0;
    a.forEach(function(x){ if(!x){ e++; } else { if(e){ o += e; e = 0; } o += up ? x.toUpperCase() : x; } });
    return o + (e ? e : '');
  }
  function startAuctionGame(){
    var L = {}; L[G.me] = G.layout; L[G.bot] = randLayout(G.au.bought[G.bot]);
    var fen = rowF(L.b.back, 0) + '/' + rowF(L.b.pawns, 0) + '/8/8/8/8/' + rowF(L.w.pawns, 1) + '/' + rowF(L.w.back, 1) + ' w - - 0 1';
    try{
      var bIn = new Chess(fen.replace(' w ', ' b ')).in_check(), wIn = new Chess(fen).in_check();
      if(bIn && !wIn) fen = fen.replace(' w ', ' b ');
    }catch(e){}
    var c = new Chess();
    if(!c.load(fen)) c = new Chess();
    G.chess = c; G.phase = 'play'; G.layout = null; G.sel2 = null;
    G.clock = mkClock();                      // the clock starts when the game starts
    nextTurn();
  }

  // ---------- drawing ----------
  function boardHtml(){
    var c = G.chess, b = c.board(), flip = G.me === 'b', idx = [0,1,2,3,4,5,6,7];
    var rows = flip ? idx.slice().reverse() : idx, cols = flip ? idx.slice().reverse() : idx;
    var dests = {}, froms = {}, mv = canMove();
    if(mv){
      var al = allowed();
      al.forEach(function(m){ froms[m.from] = 1; });
      if(G.sel) al.filter(function(m){ return m.from === G.sel; }).forEach(function(m){ dests[m.to] = m.captured ? 2 : 1; });
    }
    var chk = null;
    if(c.in_check()) for(var r0 = 0; r0 < 8; r0++) for(var f0 = 0; f0 < 8; f0++){
      var p0 = b[r0][f0]; if(p0 && p0.type === 'k' && p0.color === c.turn()) chk = FILES[f0] + (8 - r0);
    }
    var h = '<div class="board">';
    rows.forEach(function(r){
      cols.forEach(function(f){
        var sq = FILES[f] + (8 - r), p = b[r][f], cls = 'sq ' + (((r + f) % 2 === 0) ? 'light' : 'dark');
        if(G.last && (sq === G.last.from || sq === G.last.to)) cls += ' last';
        if(sq === G.sel) cls += ' from';
        if(sq === chk) cls += ' in-check';
        if(dests[sq]) cls += ' dest' + (dests[sq] === 2 ? ' capture' : '');
        if(mv && (froms[sq] || dests[sq])) cls += ' selectable';
        var co = '';
        if(f === cols[0]) co += '<span class="coord rank">' + (8 - r) + '</span>';
        if(r === rows[7]) co += '<span class="coord file">' + FILES[f] + '</span>';
        h += '<div class="' + cls + '" data-sq="' + sq + '">' + co + (p ? pimg(p.color, p.type) : '') + '</div>';
      });
    });
    return h + '</div>';
  }

  function draw(){
    window.__botActive = !!G && !G.over;
    if(!G) return drawSetup();
    if(G.phase === 'auction') return drawAuc();
    if(G.phase === 'place') return drawPlace();
    drawPlay();
  }

  function skillHtml(id){
    return '<div class="bt-h">Bot skill: <span id="' + id + 'L">' + S.skill + ' / 20 (' + levelName() + ')</span></div>' +
      '<input type="range" id="' + id + '" min="0" max="20" step="1" value="' + S.skill + '">' +
      '<div class="hint">0 = makes lots of mistakes, 20 = full strength.</div>';
  }
  function wireSkill(id, redraw){
    var r = document.getElementById(id), l = document.getElementById(id + 'L');
    if(!r) return;
    r.oninput = function(){ S.skill = +r.value; if(l) l.textContent = S.skill + ' / 20 (' + levelName() + ')'; };
    r.onchange = function(){ S.skill = +r.value; saveS(); if(redraw) draw(); };
  }

  function drawSetup(){
    var vs = [['std','Standard Chess','Normal chess against the bot'], ['hb','Hand &amp; Brain','Bot names the piece, or you randomize'], ['auction','Piece Auction','Bid coins, build an army, then play']];
    function tb(attr, key, label, on){ return '<div class="tcbtn' + (on ? ' active' : '') + '" data-' + attr + '="' + key + '">' + label + '</div>'; }
    var near = PRESETS[0];
    PRESETS.forEach(function(p){ if(Math.abs(p.s - S.skill) < Math.abs(near.s - S.skill)) near = p; });
    S.skill = near.s;
    var hb = S.variant === 'hb' ? '<div class="bt-h">Who names your piece</div><div class="tc-row">' + tb('hm', 'brain', 'Bot is my Brain', S.hbMode === 'brain') + tb('hm', 'random', 'Random button', S.hbMode === 'random') + '</div>' : '';
    var h = '<div class="card"><h2>Play a bot</h2><p class="desc">You play against Stockfish on your device. Games are timed, not rated, and nothing is saved.</p>' +
      '<div class="modes">' + vs.map(function(v){
        return '<div class="modebtn' + (S.variant === v[0] ? ' active' : '') + '" data-v="' + v[0] + '">' + v[1] + '<div class="hint">' + v[2] + '</div></div>';
      }).join('') + '</div>' +
      '<div class="bt-grid">' +
        '<div><div class="bt-h">Time control</div><div class="tc-row">' +
          TIME_CONTROLS.filter(function(t){ return t.key !== 'none'; }).map(function(t){ return tb('tc', t.key, t.label, !S.custom && S.tc === t.key); }).join('') + tb('tc', 'custom', 'Custom', S.custom) + '</div>' +
          (S.custom ? '<div class="row"><input type="number" id="bMin" min="1" max="180" value="' + S.cmin + '"><span class="hint">min +</span><input type="number" id="bInc" min="0" max="60" value="' + S.cinc + '"><span class="hint">sec</span></div>' : '') + '</div>' +
        '<div><div class="bt-h">Bot level</div><div class="tc-row">' + PRESETS.map(function(p){ return tb('ps', p.s, p.n, S.skill === p.s); }).join('') + '</div></div>' +
        '<div><div class="bt-h">You play</div><div class="tc-row">' + tb('co', 'random', 'Random', S.color === 'random') + tb('co', 'w', 'White', S.color === 'w') + tb('co', 'b', 'Black', S.color === 'b') + '</div>' + hb + '</div>' +
      '</div>' +
      '<button id="bStart" style="margin-top:16px;" disabled>Start game</button><div class="bt-eng hint" id="bEng"></div></div>';
    scr.innerHTML = h;
    scr.querySelectorAll('[data-v]').forEach(function(b){ b.onclick = function(){ S.variant = b.dataset.v; saveS(); drawSetup(); }; });
    scr.querySelectorAll('[data-hm]').forEach(function(b){ b.onclick = function(){ S.hbMode = b.dataset.hm; saveS(); drawSetup(); }; });
    scr.querySelectorAll('[data-tc]').forEach(function(b){
      b.onclick = function(){ if(b.dataset.tc === 'custom') S.custom = true; else { S.custom = false; S.tc = b.dataset.tc; } saveS(); drawSetup(); };
    });
    scr.querySelectorAll('[data-ps]').forEach(function(b){ b.onclick = function(){ S.skill = +b.dataset.ps; saveS(); drawSetup(); }; });
    scr.querySelectorAll('[data-co]').forEach(function(b){ b.onclick = function(){ S.color = b.dataset.co; saveS(); drawSetup(); }; });
    var mi = document.getElementById('bMin'), ii = document.getElementById('bInc');
    if(mi) mi.oninput = function(){ S.cmin = Math.min(180, Math.max(1, parseInt(mi.value, 10) || 1)); saveS(); };
    if(ii) ii.oninput = function(){ S.cinc = Math.min(60, Math.max(0, parseInt(ii.value, 10) || 0)); saveS(); };
    document.getElementById('bStart').onclick = startNew;
    boot(); paintEng();
  }

  function drawPlay(){
    var g = G, c = g.chess, p = '';
    if(g.over){
      p += '<div class="result-banner">' + g.over + '</div><button class="full-btn" id="bAgain">Play again</button><button class="secondary full-btn" id="bNew">Change settings</button>';
    } else {
      p += '<div class="status-msg"><b>You</b> (' + (g.me === 'w' ? 'White' : 'Black') + ') vs <b>Bot</b> (skill ' + S.skill + ')</div>';
      if(g.variant === 'hb') p += '<div class="announce' + (g.ann ? '' : ' empty') + '">' + (g.ann ? 'Announced: ' + NM[g.ann] : 'No piece announced yet') + '</div>';
      if(g.said) p += '<div class="status-msg">' + g.said + '</div>';
      if(c.in_check()) p += '<div class="draw-offer">Check!</div>';
            if(g.promo){
        p += '<div class="hint" style="margin-bottom:10px;">Promote to:</div><div class="types">' +
          [['q','Queen'],['r','Rook'],['b','Bishop'],['n','Knight']].map(function(x){ return '<button data-promo="' + x[0] + '">' + x[1] + '</button>'; }).join('') +
          '</div><button class="secondary" id="bPromoCancel" style="margin-top:10px;">Cancel</button>';
      } else if(g.busy) p += '<div class="status-msg">' + (g.msg || 'Bot is thinking...') + '</div>';
      else if(c.turn() === g.me){
        if(g.variant === 'hb' && !g.ann) p += '<button id="bRand">Randomize piece</button>';
        else p += '<div class="status-msg">Your move: click a piece, then a square.</div>';
      }
      p += skillHtml('bSk2');
      p += '<div class="game-actions"><button class="secondary danger" id="bResign">Resign</button><button class="secondary" id="bNew">New game</button></div>';
    }
    p += renderMoveLog(g.log);
    var top = g.me === 'w' ? 'b' : 'w';
    scr.innerHTML = '<div class="card"><div class="board-wrap"><div class="bt-bw">' + clkHtml(top) + boardHtml() + clkHtml(g.me) + '</div><div class="panel">' + p + '</div></div></div>';
    scr.querySelectorAll('[data-sq]').forEach(function(cell){ cell.onclick = function(){ cellClick(cell.dataset.sq); }; });
    var q = function(id){ return document.getElementById(id); };
    if(q('bRand')) q('bRand').onclick = randomize;
    if(q('bResign')) q('bResign').onclick = function(){ if(confirm('Resign this game?')) finish('You resigned', 'l'); };
    if(q('bNew')) q('bNew').onclick = function(){ if(g.over || confirm('Leave this game?')){ G = null; draw(); } };
        if(q('bAgain')) q('bAgain').onclick = startNew;
    scr.querySelectorAll('[data-promo]').forEach(function(b){
      b.onclick = function(){ var pr = g.promo; if(!pr) return; g.promo = null; play(pr.from, pr.to, b.dataset.promo); nextTurn(); };
    });
    if(q('bPromoCancel')) q('bPromoCancel').onclick = function(){ g.promo = null; draw(); };
    wireSkill('bSk2', false);
  }

  function panelA(s, isMe){
    var au = G.au, b = au.bought[s];
    var army = ['q','r','b','n','p'].map(function(t){ return b[t] ? '<span class="au-pc">' + GL[t] + '<b>\u00d7' + b[t] + '</b></span>' : ''; }).join('') || '<span class="hint">no pieces yet</span>';
    return '<div class="au-p' + (isMe ? ' me' : '') + '"><div class="au-nm">' + (isMe ? 'You' : 'Bot') + '</div><div class="au-coins">' + au.coins[s] + ' <small>coins</small></div>' +
      '<div class="au-army">' + army + '</div><div class="hint">' + (b.n + b.b + b.r + b.q) + '/7 pieces \u00b7 ' + b.p + '/8 pawns' + (au.done[s] ? ' \u00b7 stopped buying' : '') + '</div></div>';
  }
  function drawAuc(){
    var au = G.au, me = G.me, mine = au.turn === me, body = '';
    var last = au.lastT ? (au.lastW ? (au.lastW === me ? 'You' : 'Bot') + ' bought a ' + NM[au.lastT].toLowerCase() + ' for ' + au.lastBid + ' coins.' : 'The ' + NM[au.lastT].toLowerCase() + ' went unsold.') : '';
    if(au.phase === 'nominate'){
      body = mine
        ? '<div class="au-lot">Your turn: put a piece up for auction.<div class="au-acts">' +
          T.slice().reverse().map(function(t){ return '<button data-nom="' + t + '"' + (nomOk(au, t) ? '' : ' disabled') + '>' + GL[t] + ' ' + NM[t] + ' <small>(' + VALS[t] + ')</small></button>'; }).join('') +
          '<button class="secondary" data-stop="1">Stop buying</button></div></div>'
        : '<div class="au-lot">Bot is choosing a piece...</div>';
    } else {
      body = '<div class="au-lot"><div class="au-big">' + GL[au.item] + '</div><div><b>' + NM[au.item] + '</b> (standard value ' + VALS[au.item] + ')</div><div style="margin:6px 0;">' +
        (au.bidder ? 'Current bid: <b>' + au.bid + '</b> by ' + (au.bidder === me ? 'you' : 'the bot') : 'No bids yet') + '</div>' +
        (mine ? '<div class="au-acts"><input type="number" id="auBid" min="' + (au.bid + 1) + '" max="' + au.coins[me] + '" value="' + (au.bid + 1) + '"><button id="auBidBtn">Bid</button><button class="secondary" id="auPass">' + (au.bidder ? 'Drop out' : 'Pass') + '</button></div>'
                : '<div class="hint">Bot is deciding...</div>') + '</div>';
    }
    scr.innerHTML = '<div class="card"><h2>Piece Auction vs bot</h2><p class="desc">Everyone always has a king. Bid coins for pieces one at a time (' + au.budget + ' coins each this game). You can hold at most 8 pawns and 7 other pieces. The clock starts when the game starts.</p>' +
      '<div class="au-top">' + panelA(me, true) + panelA(G.bot, false) + '</div>' + (last ? '<p class="au-last">' + last + '</p>' : '') +
      (G.msg ? '<div class="draw-offer">' + G.msg + '</div>' : '') + body +
      '<div style="margin-top:12px;"><span class="backlink" id="bNew">Leave this game</span></div></div>';
    scr.querySelectorAll('[data-nom]').forEach(function(b){ b.onclick = function(){ aucAct({k:'nom', t:b.dataset.nom}); }; });
    scr.querySelectorAll('[data-stop]').forEach(function(b){ b.onclick = function(){ aucAct({k:'stop'}); }; });
    var bb = document.getElementById('auBidBtn'), inp = document.getElementById('auBid');
    if(bb){ bb.onclick = function(){ aucAct({k:'bid', x:parseInt(inp.value, 10)}); }; inp.onkeydown = function(e){ if(e.key === 'Enter') bb.click(); }; }
    var ps = document.getElementById('auPass'); if(ps) ps.onclick = function(){ aucAct({k:'pass'}); };
    document.getElementById('bNew').onclick = function(){ G = null; draw(); };
  }

  function slotRow(arr, isP, kind){
    var h = '<div class="au-row">';
    for(var i = 0; i < 8; i++){
      var v = arr[i], sel = G.sel2 && G.sel2.k === kind && G.sel2.i === i;
      h += '<div class="au-slot ' + (((i + (isP ? 1 : 0)) % 2) ? 'dk' : 'lt') + (sel ? ' sel' : '') + '" data-slot="' + kind + ':' + i + '">' +
        (v ? '<span class="au-g ' + (G.me === 'w' ? 'wh' : 'bk') + '">' + GL[isP ? 'p' : v] + '</span>' : '') + '</div>';
    }
    return h + '</div>';
  }
  function drawPlace(){
    scr.innerHTML = '<div class="card"><h2>Place your army</h2><p class="desc">The auction is over. Click one slot, then another slot in the same row, to swap them. Pawns stay on your 2nd rank and everything else on your back rank. The bot places its army at random. Your clock starts when you press Start game.</p>' +
      '<div class="au-lot"><div class="hint">Pawn rank</div>' + slotRow(G.layout.pawns, true, 'pawns') + '<div class="hint">Back rank</div>' + slotRow(G.layout.back, false, 'back') +
      '<div class="au-acts"><button class="secondary" id="auShuf">Shuffle</button><button id="auGo">Start game</button></div></div>' +
      '<div style="margin-top:12px;"><span class="backlink" id="bNew">Leave this game</span></div></div>';
    scr.querySelectorAll('[data-slot]').forEach(function(el){
      el.onclick = function(){
        var parts = el.dataset.slot.split(':'), k = parts[0], i = +parts[1], s = G.sel2;
        if(s && s.k === k){ var a = G.layout[k], t = a[s.i]; a[s.i] = a[i]; a[i] = t; G.sel2 = null; }
        else G.sel2 = {k:k, i:i};
        drawPlace();
      };
    });
    document.getElementById('auShuf').onclick = function(){ G.layout = randLayout(G.au.bought[G.me]); G.sel2 = null; drawPlace(); };
    document.getElementById('auGo').onclick = startAuctionGame;
    document.getElementById('bNew').onclick = function(){ G = null; draw(); };
  }

  // ===== v3 add-on: drag & drop, premoves, layout, no slider in game =====
  var st = document.createElement('style');
  st.textContent =
    '#screen-bot{--sq:clamp(30px,9vw,80px);}' +
    '#screen-bot .board{touch-action:none;}' +
    '#screen-bot .board-wrap{justify-content:center;}' +
    '#screen-bot .bt-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:0 32px;}' +
    '#screen-bot .sq.selectable{cursor:grab;}';
  document.head.appendChild(st);

  function killSlider(id){
    var r = document.getElementById(id); if(!r) return;
    var a = r.previousElementSibling, b = r.nextElementSibling;
    if(b && b.classList.contains('hint')) b.remove();
    r.remove();
    if(a && a.classList.contains('bt-h')) a.remove();
  }
  // premoves: Standard and Piece Auction, while it is the bot's turn
  function canPre(){ return !!G && G.phase === 'play' && !G.over && G.variant !== 'hb' && G.chess.turn() === G.bot; }
  // same rules as premoves in the main game: where this piece COULD go once the bot has moved.
  // Ignores enemy pieces in the way and checks. Squares with your OWN piece count too (that is how
  // you premove a recapture), and a pawn can aim at its diagonals even when they are empty now.
  function preDests(from){
    var chess = G.chess, color = G.me, p = chess.get(from);
    if(!p || p.color !== color) return [];
    var f = FILES.indexOf(from[0]), r = parseInt(from[1], 10) - 1, out = [];
    function sqAt(nf, nr){ return (nf < 0 || nf > 7 || nr < 0 || nr > 7) ? null : FILES[nf] + (nr + 1); }
    function own(s){ var q = chess.get(s); return !!q && q.color === color; }
    function ray(dirs, max){
      dirs.forEach(function(d){
        for(var i = 1; i <= max; i++){
          var s = sqAt(f + d[0] * i, r + d[1] * i);
          if(!s) break;
          out.push(s);
          if(own(s)) break;          // can aim at your own piece (recapture) but not past it
        }
      });
    }
    var ORTH = [[1,0],[-1,0],[0,1],[0,-1]], DIAG = [[1,1],[1,-1],[-1,1],[-1,-1]];
    if(p.type === 'n'){
      [[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]].forEach(function(d){ ray([d], 1); });
    } else if(p.type === 'b'){ ray(DIAG, 7); }
    else if(p.type === 'r'){ ray(ORTH, 7); }
    else if(p.type === 'q'){ ray(ORTH.concat(DIAG), 7); }
    else if(p.type === 'k'){
      ray(ORTH.concat(DIAG), 1);
      var home = color === 'w' ? 0 : 7;
      if(f === 4 && r === home){
        [6, 2].forEach(function(cf){ var s = sqAt(cf, home); if(s && !own(s)) out.push(s); });
      }
    } else if(p.type === 'p'){
      var dir = color === 'w' ? 1 : -1, start = color === 'w' ? 1 : 6;
      var one = sqAt(f, r + dir);
      if(one && !own(one)){
        out.push(one);
        var two = sqAt(f, r + 2 * dir);
        if(r === start && two && !own(two)) out.push(two);
      }
      [-1, 1].forEach(function(df){ var s = sqAt(f + df, r + dir); if(s) out.push(s); });   // diagonals: captures and recaptures
    }
    return out;
  }
  var _nt = nextTurn;
  nextTurn = function(){
    if(G && !G.over && G.chess.turn() === G.me){
      if(G.psel){ if(allowed().some(function(m){ return m.from === G.psel; })) G.sel = G.psel; G.psel = null; }
      if(G.pm && G.variant !== 'hb'){
        var pm = G.pm; G.pm = null;
        var m = allowed().filter(function(x){ return x.from === pm.from && x.to === pm.to; })[0];
                if(m){
          if(m.promotion && !autoQ()){ G.promo = {from:m.from, to:m.to}; draw(); return; }
          play(m.from, m.to, m.promotion ? 'q' : undefined); return _nt();
        }
      }
    }
    return _nt();
  };
  var _cc = cellClick;
  cellClick = function(sq){
    if(canPre()){
      var p = G.chess.get(sq);
      if(G.psel && G.psel !== sq && preDests(G.psel).indexOf(sq) >= 0){ G.pm = {from:G.psel, to:sq}; G.psel = null; draw(); return; }
      if(p && p.color === G.me){ G.psel = sq; G.pm = null; } else { G.psel = null; G.pm = null; }
      draw(); return;
    }
    return _cc(sq);
  };
  function mark(sq, cls){ var el = scr.querySelector('.sq[data-sq="' + sq + '"]'); if(el) el.classList.add(cls); return el; }
  var _dp = drawPlay;
  drawPlay = function(){
    _dp();
    try{
      killSlider('bSk2');
      if(!G || G.over) return;
      if(canPre()){
        if(G.pm){ mark(G.pm.from, 'pm-from'); mark(G.pm.to, 'pm-to'); }
        if(G.psel){
          mark(G.psel, 'pm-from');
          preDests(G.psel).forEach(function(s){ var el = mark(s, 'pm-dest'); if(el && G.chess.get(s)) el.classList.add('pm-cap'); });
        }
        scr.querySelectorAll('.sq[data-sq]').forEach(function(c){ var p = G.chess.get(c.dataset.sq); if(p && p.color === G.me) c.classList.add('selectable'); });
      }
      var acts = scr.querySelector('.game-actions');
      if(acts && G.variant !== 'hb' && !scr.querySelector('.bt-pmh')){
        var hh = document.createElement('div');
        hh.className = 'hint bt-pmh'; hh.style.margin = '10px 0';
        hh.textContent = 'Drag pieces to move. Premove while the bot thinks (right-click or Esc cancels).';
        acts.parentNode.insertBefore(hh, acts);
      }
    }catch(e){ console.error('bot decorate failed', e); }
  };
  scr.addEventListener('contextmenu', function(e){
    if(G && (G.pm || G.psel) && e.target.closest && e.target.closest('.board')){ e.preventDefault(); G.pm = null; G.psel = null; draw(); }
  });
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && G && (G.pm || G.psel)){ G.pm = null; G.psel = null; if(scr.style.display === 'block') draw(); }
  });

  // drag and drop
  var D = null, supUntil = 0;
  function cellOf(t){ return (t && t.closest) ? t.closest('#screen-bot .sq[data-sq]') : null; }
  function clearGhost(){
    document.querySelectorAll('.dnd-ghost').forEach(function(x){ x.remove(); });
    document.querySelectorAll('#screen-bot .dnd-src').forEach(function(x){ x.classList.remove('dnd-src'); });
    document.body.classList.remove('dnd-dragging');
  }
  document.addEventListener('pointerdown', function(e){
    if(D || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    var cell = cellOf(e.target);
    if(!cell || !G || G.over || G.phase !== 'play') return;
    var sq = cell.dataset.sq, mode;
    if(canMove()){
      if(!allowed().some(function(m){ return m.from === sq; })) return;
      mode = 'move'; G.sel = sq;
    } else if(canPre()){
      var pc = G.chess.get(sq);
      if(!pc || pc.color !== G.me) return;
      // a piece is already picked up and this square of yours is one of its targets: that is a
      // recapture premove, so queue it instead of switching the selection (same as the main game)
      if(G.psel && G.psel !== sq && preDests(G.psel).indexOf(sq) >= 0){
        e.preventDefault();
        G.pm = {from:G.psel, to:sq}; G.psel = null; draw();
        return;
      }
      mode = 'pre'; G.psel = sq; G.pm = null;
    } else return;
    e.preventDefault();
    D = {mode:mode, from:sq, id:e.pointerId, x:e.clientX, y:e.clientY, drag:false, ghost:null, w:0};
    draw();
  });
  document.addEventListener('pointermove', function(e){
    if(!D || e.pointerId !== D.id) return;
    if(!D.drag){
      if(Math.hypot(e.clientX - D.x, e.clientY - D.y) < 5) return;
      var cell = scr.querySelector('.sq[data-sq="' + D.from + '"]'), pe = cell && cell.querySelector('img.piece-img, span:not(.coord)');
      if(!pe){ D = null; return; }
      var r = cell.getBoundingClientRect(), gh = pe.cloneNode(true);
      gh.removeAttribute('onerror'); gh.className = 'dnd-ghost'; gh.draggable = false;
      D.w = r.width * 0.95; gh.style.width = D.w + 'px'; gh.style.height = D.w + 'px';
      if(gh.tagName !== 'IMG'){ gh.style.fontSize = getComputedStyle(cell).fontSize; gh.style.display = 'block'; gh.style.textAlign = 'center'; }
      document.body.appendChild(gh);
      cell.classList.add('dnd-src'); document.body.classList.add('dnd-dragging');
      D.ghost = gh; D.drag = true;
    }
    D.ghost.style.transform = 'translate(' + (e.clientX - D.w / 2) + 'px,' + (e.clientY - D.w / 2) + 'px)';
  });
  document.addEventListener('pointerup', function(e){
    if(!D || e.pointerId !== D.id) return;
    var d = D; D = null;
    if(!d.drag) return;                                   // plain click: already selected on pointerdown
    supUntil = Date.now() + 150;
    var cell = cellOf(document.elementFromPoint(e.clientX, e.clientY)), to = cell ? cell.dataset.sq : null;
    clearGhost();
    if(!G || G.over) return;
    var mode = d.mode;
    if(mode === 'pre' && canMove()) mode = 'move';         // the bot moved while you were dragging
    if(mode === 'move'){
      if(canMove() && to && to !== d.from){
        var m = allowed().filter(function(x){ return x.from === d.from && x.to === to; })[0];
                if(m){ humanMove(m); return; }
      }
      G.sel = (to === d.from) ? d.from : null; draw(); return;
    }
    if(canPre() && to && to !== d.from && preDests(d.from).indexOf(to) >= 0){ G.pm = {from:d.from, to:to}; G.psel = null; }
    else if(to !== d.from) G.psel = null;
    draw();
  });
  document.addEventListener('pointercancel', function(e){
    if(!D || e.pointerId !== D.id) return;
    D = null; clearGhost();
  });
  document.addEventListener('click', function(e){
    if(Date.now() < supUntil && cellOf(e.target)){ e.stopPropagation(); e.preventDefault(); }
  }, true);
})();
