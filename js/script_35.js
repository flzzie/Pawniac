(function(){
  var FILES = 'abcdefgh';
  var NMS = {p:'Pawn', n:'Knight', b:'Bishop', r:'Rook', q:'Queen', k:'King'};
  function esc(s){ return String(s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function el(id){ return document.getElementById(id); }
  function dbp(k){ return db.ref(dbPath(k)); }
  function pimg(c, t){
    return '<img class="piece-img" src="' + pieceImgUrl(c, t) + '" alt="" draggable="false" onerror="this.outerHTML=\'<span style=&quot;font-size:1em;line-height:1;&quot;>' + PIECE_UNICODE[c][t] + '</span>\'">';
  }
  function nameHtml(n){ return '<span class="user-link" data-user="' + esc(n) + '">' + esc(n) + '</span>'; }   // step 30 adds the title badge to these
  function names(g, side){
    var s = g.seats || {};
    if(g.mode === 'team'){
      var b = s[side === 'w' ? 'whiteBrain' : 'blackBrain'], h = s[side === 'w' ? 'whiteHand' : 'blackHand'];
      return nameHtml(b || '?') + ' &amp; ' + nameHtml(h || '?');
    }
    return nameHtml(s[side === 'w' ? 'white' : 'black'] || '?');
  }
  function kindOf(g){
    if(g.variant === 'auction') return 'Piece Auction';
    if(g.variant === 'standard') return 'Standard';
    return g.mode === 'team' ? 'Hand & Brain 2v2' : 'Hand & Brain';
  }
  function isMine(g){
    try{ return !!ME && Object.keys(g.seats || {}).some(function(k){ return g.seats[k] === ME.username; }); }catch(e){ return false; }
  }

  // ---------- the screen ----------
  var scr = document.createElement('div');
  scr.id = 'screen-watch'; scr.style.display = 'none';
  document.querySelector('.wrap').appendChild(scr);

  // ---------- list of live games in the lobby ----------
  var L = {ref:null, cb:null, by:{}, cache:{}, tok:0};
  function detachList(){ try{ if(L.ref) L.ref.off('value', L.cb); }catch(e){} L.ref = null; L.cb = null; }
  async function info(gid){
    var c = L.cache[gid];
    if(c && Date.now() - c.t < 20000) return c.g;
    var g = null;
    try{ var s = await dbp('hb:game:' + gid).once('value'); g = s.exists() ? s.val() : null; }catch(e){}
    L.cache[gid] = {g:g, t:Date.now()};
    return g;
  }
  async function paintList(){
    var box = el('watchList'); if(!box) return;
    var tok = ++L.tok, gids = Object.keys(L.by).slice(0, 12);
    if(!gids.length){ box.innerHTML = '<p class="desc">No games in progress right now.</p>'; return; }
    var gs = await Promise.all(gids.map(info));
    if(tok !== L.tok || !el('watchList')) return;
    var rows = [];
    gids.forEach(function(gid, i){
      var g = gs[i];
      if(!g || g.status !== 'active' || !g.seats || isMine(g)) return;
      rows.push('<div class="wt-row"><span class="wt-who">' + names(g, 'w') + ' <span class="wt-tag">vs</span> ' + names(g, 'b') + '</span>' +
        '<span class="wt-tag">' + kindOf(g) + ' &middot; move ' + (Math.floor((g.moveLog || []).length / 2) + 1) + '</span>' +
        '<button class="secondary" data-watch="' + esc(gid) + '">Watch</button></div>');
    });
    box.innerHTML = rows.length ? rows.join('') : '<p class="desc">No other games in progress right now.</p>';
    box.querySelectorAll('[data-watch]').forEach(function(b){ b.onclick = function(){ openWatch(b.dataset.watch); }; });
  }
  function attachList(){
    detachList();
    L.ref = db.ref('hb/live/playing');
    L.cb = L.ref.on('value', function(s){
      var v = s.exists() ? s.val() : {}, by = {};
      Object.keys(v).forEach(function(u){ if(v[u]) by[v[u]] = 1; });
      L.by = by; paintList();
    }, function(){
      var b = el('watchList'); if(b) b.innerHTML = '<p class="desc">Could not load live games (needs the same Firebase rule as the Live now counts).</p>';
    });
  }
  function addCard(){
    var cols = document.querySelector('#screen-lobby .lobby-cols');
    if(!cols || el('watchCard')) return;
    var c = document.createElement('div');
    c.className = 'card'; c.id = 'watchCard';
    c.innerHTML = '<h2>Watch live games</h2><div id="watchList"><p class="desc">Looking for games...</p></div>';
    cols.appendChild(c);
    attachList();
  }
  var prevLobby = window.renderLobby;
  window.renderLobby = function(){
    prevLobby.apply(this, arguments);
    try{ addCard(); }catch(e){ console.error('watch list failed', e); }
  };

  // ---------- watching one game ----------
  var W = null;
  function stopWatch(){
    if(!W) return;
    try{ if(W.ref) W.ref.off('value', W.cb); }catch(e){}
    try{ if(W.spRef) W.spRef.off('value', W.spCb); }catch(e){}
    try{ if(W.pres){ W.pres.onDisconnect().cancel(); W.pres.remove(); } }catch(e){}
    W = null;
  }
  function placement(f){ return String(f || '').split(' ')[0]; }
  function findMove(oldFen, newFen){
    try{
      var c = new Chess(oldFen), t = placement(newFen), l = c.moves({verbose:true});
      for(var i = 0; i < l.length; i++){
        c.move({from:l[i].from, to:l[i].to, promotion:l[i].promotion});
        var same = placement(c.fen()) === t;
        c.undo();
        if(same) return {from:l[i].from, to:l[i].to};
      }
    }catch(e){}
    return null;
  }
  function openWatch(gid){
    if(typeof stopPoll === 'function') stopPoll();
    showScreen('watch');
    stopWatch();
    W = {gid:gid, g:null, prevFen:null, last:null, spec:null};
    try{
      var h = '#/watch/' + gid;
      if(PW.hash() !== h) PW.pushQuiet(h);   // shareable link, back button works
    }catch(e){}
    scr.innerHTML = '<div class="card"><p class="desc">Loading game...</p></div>';
    var me = W;
    W.ref = dbp('hb:game:' + gid);
    W.cb = W.ref.on('value', function(s){
      if(W !== me) return;
      var g = s.exists() ? s.val() : null;
      if(!g || !g.fen){ scr.innerHTML = '<div class="card"><p class="desc">This game is not available.</p><span class="backlink" id="wtBack">&larr; Back to lobby</span></div>'; el('wtBack').onclick = function(){ window.renderLobby(); }; return; }
      if(W.prevFen && g.fen !== W.prevFen){ var m = findMove(W.prevFen, g.fen); if(m) W.last = m; }
      W.prevFen = g.fen; W.g = g;
      draw();
    }, function(){ scr.innerHTML = '<div class="card"><p class="desc">Could not open this game.</p></div>'; });
    try{
      W.pres = db.ref('hb/spectators/' + gid + '/' + ME.username);
      W.pres.onDisconnect().remove();
      W.pres.set(true).catch(function(){});
      W.spRef = db.ref('hb/spectators/' + gid);
      W.spCb = W.spRef.on('value', function(s){ if(W !== me) return; W.spec = s.numChildren(); paintSpec(); }, function(){});
    }catch(e){}
  }
  function paintSpec(){
    var e = el('wtSpec');
    if(e && W && W.spec !== null) e.textContent = W.spec + (W.spec === 1 ? ' person watching' : ' people watching');
  }
  function clk(g, c, side){
    var on = g.status === 'active' && c.turn() === side;
    var t = (g.clock && g.clock.initialSec > 0) ? '<span id="wk' + side + '">' + fmtClock(clockMs(g, side)) + '</span>' : '';
    return '<div class="clock' + (on ? ' active' : '') + '"><span class="label">' + names(g, side) + '</span>' + t + '</div>';
  }
  function boardHtml(c){
    var b = c.board(), chk = null;
    if(c.in_check()) for(var r0 = 0; r0 < 8; r0++) for(var f0 = 0; f0 < 8; f0++){
      var p0 = b[r0][f0]; if(p0 && p0.type === 'k' && p0.color === c.turn()) chk = FILES[f0] + (8 - r0);
    }
    var h = '<div class="board">';
    for(var r = 0; r < 8; r++) for(var f = 0; f < 8; f++){
      var sq = FILES[f] + (8 - r), p = b[r][f], cls = 'sq ' + (((r + f) % 2 === 0) ? 'light' : 'dark');
      if(W.last && (sq === W.last.from || sq === W.last.to)) cls += ' last';
      if(sq === chk) cls += ' in-check';
      var co = '';
      if(f === 0) co += '<span class="coord rank">' + (8 - r) + '</span>';
      if(r === 7) co += '<span class="coord file">' + FILES[f] + '</span>';
      h += '<div class="' + cls + '">' + co + (p ? pimg(p.color, p.type) : '') + '</div>';
    }
    return h + '</div>';
  }
  function draw(){
    if(!W || !W.g) return;
    var g = W.g, c;
    try{ c = new Chess(g.fen); }catch(e){ return; }
    var p = '<div class="status-msg"><b>' + kindOf(g) + '</b> &middot; you are watching</div><div class="wt-spec" id="wtSpec"></div>';
    if(g.status === 'finished'){
      var w = g.winner === 'w' ? 'White wins' : g.winner === 'b' ? 'Black wins' : g.winner === 'abort' ? 'Game aborted' : 'Draw';
      p += '<div class="result-banner">' + w + '</div>';
    } else if(g.status === 'active'){
      p += '<div class="status-msg">' + (c.turn() === 'w' ? 'White' : 'Black') + ' to move</div>';
      if(g.announced && g.announced !== 'std') p += '<div class="announce">Announced: ' + NMS[g.announced] + '</div>';
      else if(!g.announced && g.variant !== 'standard' && g.variant !== 'auction') p += '<div class="announce empty">No piece announced yet</div>';
    }
    if(c.in_check() && g.status === 'active') p += '<div class="draw-offer">Check!</div>';
    p += '<div style="margin:10px 0;"><span class="backlink" id="wtBack">&larr; Back to lobby</span></div>';
    p += renderMoveLog(g.moveLog || []);
    scr.innerHTML = '<div class="card"><div class="board-wrap"><div class="wt-bw">' + clk(g, c, 'b') + boardHtml(c) + clk(g, c, 'w') + '</div><div class="panel">' + p + '</div></div></div>';
    el('wtBack').onclick = function(){ window.renderLobby(); };
    paintSpec();
  }
  setInterval(function(){
    try{
      if(!W || !W.g || W.g.status !== 'active' || !W.g.clock || !(W.g.clock.initialSec > 0)) return;
      ['w', 'b'].forEach(function(s){ var e = el('wk' + s); if(e) e.textContent = fmtClock(clockMs(W.g, s)); });
    }catch(e){}
  }, 500);

  // ---------- link: #/watch/CODE ----------
  var WRE = /^#\/?watch\/([A-Za-z0-9]{3,12})/i;
  window.addEventListener('hashchange', function(){
    if(!ME) return;
    var m = WRE.exec(PW.hash());
    if(m){ if(!(W && W.gid === m[1])) openWatch(m[1]); }
    else if(W){ window.renderLobby(); }                       // back button from a watched game
  });
  var linkDone = false, prevAfter = window.afterAuth;
  window.afterAuth = async function(){
    var m = WRE.exec(PW.hash()), gid = (m && !linkDone) ? m[1] : null;     // read it before the lobby rewrites the address
    var r = await prevAfter.apply(this, arguments);
    if(gid){
      linkDone = true;
      var gs = document.getElementById('screen-game');
      if(!(gs && gs.style.display === 'block')) openWatch(gid);                // not if you were put back into your own live game
    }
    return r;
  };

  var prevShow = window.showScreen;
  window.showScreen = function(n){
    if(n !== 'watch') stopWatch();
    if(n !== 'lobby') detachList();
    prevShow(n);
    scr.style.display = (n === 'watch') ? 'block' : 'none';
  };
})();
