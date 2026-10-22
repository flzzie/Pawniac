(function(){
  var NAME_RE = /^[A-Za-z0-9_]{3,20}$/;
  var FILES = 'abcdefgh';
  var VNAME = {hb:'Hand & Brain', team:'Hand & Brain team', std:'Standard', auction:'Piece Auction'};
  var PAGE = 20;
  var done = {}, busy = {}, fails = {};
  var G = null, token = 0, okOnce = false;
  // a link like  .../#/game/12  that somebody opened before logging in
  var pendingN = (/^#\/game\/(\d+)\/?$/.exec(location.hash) || [])[1] || null;

  function esc(s){ return String(s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

  // ---------- helpers about a game ----------
  function worthy(g){
    return !!g && g.status === 'finished' && !!g.winner && g.winner !== 'abort' && !!g.moveLog && g.moveLog.length >= 2 &&
      (g.variant !== 'auction' || !!startFen(g));
  }
  function variantOf(g){
    if(g.variant === 'auction') return 'auction';
    return g.mode === 'team' ? 'team' : (g.variant === 'standard' ? 'std' : 'hb');
  }
  // Piece Auction games start from the armies the players placed. Those layouts are saved in the game,
  // so the starting position can be rebuilt exactly the way the auction built it.
  function rowFen(str, upper){
    var o = '', e = 0;
    str.split('').forEach(function(c){
      if(c === '.'){ e++; }
      else { if(e){ o += e; e = 0; } o += upper ? c.toUpperCase() : c.toLowerCase(); }
    });
    return o + (e ? e : '');
  }
  function startFen(g){
    if(!g || g.variant !== 'auction') return null;
    try{
      var pl = g.auction && g.auction.place;
      if(!pl || !pl.w || !pl.b) return null;
      var w = pl.w.split('|'), b = pl.b.split('|');
      var fen = rowFen(b[0], false) + '/' + rowFen(b[1], false) + '/8/8/8/8/' + rowFen(w[1], true) + '/' + rowFen(w[0], true) + ' w - - 0 1';
      var bIn = new Chess(fen.replace(' w ', ' b ')).in_check(), wIn = new Chess(fen).in_check();
      if(bIn && !wIn) fen = fen.replace(' w ', ' b ');      // same rule the auction used: Black moves first
      return fen;
    }catch(e){ return null; }
  }
  function sideNames(g, side){
    var s = g.seats || {};
    if(g.mode === 'team') return (side === 'w' ? [s.whiteBrain, s.whiteHand] : [s.blackBrain, s.blackHand]).filter(Boolean);
    return [side === 'w' ? s.white : s.black].filter(Boolean);
  }
  function tcText(sec, inc){
    if(!(sec > 0)) return 'No clock';
    return (Math.round(sec / 60 * 100) / 100) + '+' + (inc || 0);
  }
  function dateText(ts){
    if(typeof ts !== 'number') return '';
    return new Date(ts).toLocaleDateString(undefined, {year:'numeric', month:'short', day:'numeric'});
  }
  function namesHtml(arr){
    return arr.map(function(x){
      return NAME_RE.test(x) ? '<span class="user-link" data-user="' + esc(x) + '">' + esc(x) + '</span>' : esc(x);
    }).join(' &amp; ');
  }

  // =====================================================================
  //  1. give every finished game its number (1, 2, 3 ...) and add it to both players' history
  // =====================================================================
  async function claimNumber(gid){
    var numRef = db.ref('hb/game/' + gid + '/num');
    var cur = (await numRef.once('value')).val();
    if(cur) return cur;
    var res = await db.ref('hb/gameCount').transaction(function(c){ return (c || 0) + 1; });
    if(!res.committed) return null;
    var n = res.snapshot.val();
    var tx = await numRef.transaction(function(c){ return c ? undefined : n; });
    if(!tx.committed) return tx.snapshot.val();       // someone else numbered it first
    await db.ref('hb/gameByNum/' + n).set(gid);
    return n;
  }

  async function handleFinished(g, gid){
    if(!ME || !gid || !worthy(g) || done[gid] || busy[gid] || (fails[gid] || 0) >= 3) return;
    var me = myRole(g);
    if(!me) return;
    busy[gid] = true;
    try{
      var n = g.num;
      if(!n){
        // White (or White's Brain) numbers the game; the others only step in if that player never does
        var first = g.mode === 'team' ? (g.seats || {}).whiteBrain : (g.seats || {}).white;
        if(ME.username !== first) await sleep(6000);
        n = await claimNumber(gid);
      }
      if(!n){ fails[gid] = (fails[gid] || 0) + 1; return; }
      db.ref('hb/gameByNum/' + n).transaction(function(c){ return c ? undefined : gid; }).catch(function(){});
      var entry = {
        n: n,
        res: g.winner === 'draw' ? 'd' : (g.winner === me.side ? 'w' : 'l'),
        ts: (typeof g.moveAt === 'number') ? g.moveAt : serverNow(),
        opp: sideNames(g, me.side === 'w' ? 'b' : 'w').join(' & '),
        side: me.side,
        v: variantOf(g),
        sec: (g.clock && g.clock.initialSec) || 0,
        inc: (g.clock && g.clock.incrementSec) || 0
      };
      await db.ref('hb/history/' + ME.username + '/' + n).transaction(function(c){ return c ? undefined : entry; });
      done[gid] = true;
    }catch(e){
      fails[gid] = (fails[gid] || 0) + 1;
      console.error('game history failed (did you publish the new Firebase rules?)', e);
    }finally{
      busy[gid] = false;
    }
  }

  // hook: every time a finished game is on screen, or its rating is settled
  var prevDraw = window.drawGame;
  window.drawGame = function(){
    prevDraw();
    try{
      var g = gameState;
      if(g && g.status === 'finished' && currentGameId){
        handleFinished(g, currentGameId);
        if(g.num && !document.querySelector('#screen-game .gh-gn')){
          var banner = document.querySelector('#screen-game .result-banner');
          if(banner){
            var d = document.createElement('div');
            d.className = 'rc gh-gn';
            d.innerHTML = 'Game <span class="gh-n" data-gn="' + g.num + '">#' + g.num + '</span>';
            banner.appendChild(d);
          }
        }
      }
    }catch(e){ console.error(e); }
  };
  var prevSettle = window.settleMyRating;
  window.settleMyRating = function(g){
    try{ if(g && currentGameId) handleFinished(g, currentGameId); }catch(e){ console.error(e); }
    return prevSettle.apply(this, arguments);
  };

  // =====================================================================
  //  2. the game page  (#/game/NUMBER): replay + players + result
  // =====================================================================
  var screen = document.createElement('div');
  screen.id = 'screen-gamepage';
  screen.style.display = 'none';
  document.querySelector('.wrap').appendChild(screen);
  var prevShow = window.showScreen;
  window.showScreen = function(n){
    prevShow(n);
    screen.style.display = (n === 'gamepage') ? 'block' : 'none';
  };

  function inActiveGame(){
    var s = document.getElementById('screen-game');
    return !!s && s.style.display === 'block' && !!gameState && gameState.status === 'active';
  }
  function guardOk(){
    return !inActiveGame() || confirm('Your clock keeps running while you are away. Leave the game view?');
  }
  function goToGame(n){
    if(!guardOk()) return;
    var h = '#/game/' + n;
    if(location.hash === h){ openGame(n); return; }
    okOnce = true;
    location.hash = h;           // the hashchange handler below opens it (so the back button works)
  }

  function boardHtml(fen, last, flip){
    var b = new Chess(fen).board(), idx = [0,1,2,3,4,5,6,7];
    var rows = flip ? idx.slice().reverse() : idx, cols = flip ? idx.slice().reverse() : idx;
    var h = '<div class="board">';
    rows.forEach(function(r){
      cols.forEach(function(f){
        var sq = FILES[f] + (8 - r), p = b[r][f], cls = 'sq ' + (((r + f) % 2 === 0) ? 'light' : 'dark');
        if(last && (sq === last.from || sq === last.to)) cls += ' last';
        var co = '';
        if(f === cols[0]) co += '<span class="coord rank">' + (8 - r) + '</span>';
        if(r === rows[7]) co += '<span class="coord file">' + FILES[f] + '</span>';
        var sym = '';
        if(p){
          sym = '<img class="piece-img" src="' + pieceImgUrl(p.color, p.type) + '" alt="" draggable="false" onerror="this.outerHTML=\'<span style=&quot;font-size:1em;line-height:1;&quot;>' + PIECE_UNICODE[p.color][p.type] + '</span>\'">';
        }
        h += '<div class="' + cls + '">' + co + sym + '</div>';
      });
    });
    return h + '</div>';
  }

  function movesHtml(){
    var m = G.moves;
    if(!m.length) return '<div class="movelog-wrap empty">No moves.</div>';
    var items = [];
    if(G.blackFirst) items.push(null);                       // empty White slot on move 1
    for(var j = 0; j < m.length; j++) items.push(j);
    function cell(k){
      var white = (k % 2 === 0), idx = items[k];
      if(idx === undefined || idx === null) return '<span class="' + (white ? 'move-white' : 'move-black') + '"></span>';
      var cls = white ? 'move-white' : 'move-black';
      if(G.sel === idx + 1) cls += ' current';
      return '<span class="' + cls + '" data-ply="' + (idx + 1) + '">' + esc(sanToFigurine(m[idx].san, white ? 'w' : 'b')) + '</span>';
    }
    var h = '';
    for(var i = 0; i < items.length; i += 2) h += '<div class="move-row"><span class="move-num">' + (i / 2 + 1) + '</span>' + cell(i) + cell(i + 1) + '</div>';
    return '<div class="movelog-wrap">' + h + '</div>';
  }

  function paint(){
    if(!G || !document.getElementById('ghBoard')) return;
    var last = G.sel > 0 ? {from:G.moves[G.sel - 1].from, to:G.moves[G.sel - 1].to} : null;
    document.getElementById('ghBoard').innerHTML = boardHtml(G.fens[G.sel], last, G.flip);
    document.getElementById('ghMoves').innerHTML = movesHtml();
    var cnt = document.getElementById('ghPly');
    if(cnt) cnt.textContent = G.sel + ' / ' + G.moves.length;
    var cur = document.querySelector('#ghMoves .current'), wrap = document.querySelector('#ghMoves .movelog-wrap');
    if(cur && wrap) wrap.scrollTop = Math.max(0, cur.offsetTop - wrap.clientHeight / 2);
  }
  function step(k){
    if(!G) return;
    G.sel = Math.max(0, Math.min(G.moves.length, k));
    paint();
  }

  function hms(ms){
    var t = Math.max(0, Math.round(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    return h + ':' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function gamePgn(g, n){
    var s = g.seats || {};
    var w = g.mode === 'team' ? (s.whiteBrain + ' & ' + s.whiteHand) : s.white;
    var b = g.mode === 'team' ? (s.blackBrain + ' & ' + s.blackHand) : s.black;
    var res = g.winner === 'w' ? '1-0' : g.winner === 'b' ? '0-1' : g.winner === 'draw' ? '1/2-1/2' : '*';
    var c = g.clock && g.clock.initialSec > 0 ? g.clock : null, times = g.moveTimes || [];
    var sf = startFen(g), off = (sf && sf.split(' ')[1] === 'b') ? 1 : 0;
    var rem = {w:c ? c.initialSec * 1000 : 0, b:c ? c.initialSec * 1000 : 0}, mt = '';
    (g.moveLog || []).forEach(function(san, i){
      var side = (i + off) % 2 === 0 ? 'w' : 'b', spent = (typeof times[i] === 'number' && times[i] >= 0) ? times[i] : null, tags = '';
      if(spent !== null) tags += ' {[%emt ' + hms(spent) + ']}';
      if(c){
        rem[side] = Math.max(0, rem[side] - (i === 0 || spent === null ? 0 : spent)) + (c.incrementSec || 0) * 1000;
        if(spent !== null || i === 0) tags += ' {[%clk ' + hms(rem[side]) + ']}';
      }
      var num = Math.floor((i + off) / 2) + 1;
      mt += (side === 'w' ? num + '. ' : (i === 0 ? num + '... ' : '')) + san + tags + ' ';
    });
    var tc = c ? (c.initialSec + '+' + (c.incrementSec || 0)) : '-';
    return '[Event "Pawniac game #' + n + '"]\n' + (sf ? '[SetUp "1"]\n[FEN "' + sf + '"]\n' : '') + '[White "' + String(w || 'White').replace(/"/g, '') + '"]\n[Black "' + String(b || 'Black').replace(/"/g, '') +
      '"]\n[Result "' + res + '"]\n[TimeControl "' + tc + '"]\n\n' + mt + res;
  }
  function openAnalysis(g, n){
    var nav = document.querySelector('#navbar [data-nav="analyze"]');
    if(!nav) return;
    nav.click();
    var again = document.getElementById('anNewBtn');
    if(again) again.click();
    var box = document.getElementById('anPgn'), go = document.getElementById('anGo');
    if(!box || !go) return;
    box.value = gamePgn(g, n);
    box.dispatchEvent(new Event('input'));
    var me = myRole(g);
    if(me){                                   // you played in it: pick your side and start straight away
      var sideBtn = document.getElementById(me.side === 'w' ? 'anSideW' : 'anSideB');
      if(sideBtn) sideBtn.click();
      go.click();
    }                                         // otherwise the PGN is filled in and you choose a side
  }

  function msgCard(t, d){ return '<div class="card"><h2>' + t + '</h2><p class="desc" style="margin:0;">' + d + '</p></div>'; }

  async function openGame(n){
    if(!ME) return;
    var my = ++token;
    stopPoll();
    showScreen('gamepage');
    screen.innerHTML = msgCard('Game #' + n, 'Loading...');
    var code = null, g = null;
    try{
      code = (await db.ref('hb/gameByNum/' + n).once('value')).val();
      if(code) g = (await db.ref('hb/game/' + code).once('value')).val();
    }catch(e){
      console.error(e);
      if(my === token) screen.innerHTML = msgCard('Game #' + n, 'Could not load this game (publish the new Firebase rules).');
      return;
    }
    if(my !== token) return;
    if(!g){
      screen.innerHTML = msgCard('Game #' + n + ' not found', "There is no game with that number. Games played before numbering was added do not have one.");
      return;
    }
    var sf = startFen(g), c = sf ? new Chess(sf) : new Chess(), fens = [c.fen()], moves = [];
    (g.moveLog || []).forEach(function(san){
      if(moves.length !== fens.length - 1) return;
      var mv = c.move(san);
      if(mv){ moves.push(mv); fens.push(c.fen()); }
    });
    var me = myRole(g);
    G = {n:n, code:code, g:g, fens:fens, moves:moves, sel:moves.length, flip:!!(me && me.side === 'b'), blackFirst:!!(sf && sf.split(' ')[1] === 'b')};

    var res = g.winner === 'w' ? 'White wins' : g.winner === 'b' ? 'Black wins' : g.winner === 'draw' ? 'Draw' : 'No result';
    var note = g.statusNote || (moves.length && /#$/.test(moves[moves.length - 1].san) ? 'checkmate' : '');
    var meta = [VNAME[variantOf(g)] || 'Game', tcText(g.clock && g.clock.initialSec, g.clock && g.clock.incrementSec), dateText(g.moveAt)].filter(Boolean).join(' \u00b7 ');
    var canAn = worthy(g) && moves.length >= 2;
    screen.innerHTML =
      '<div class="card">' +
        '<div class="gh-head"><div><div class="gh-title">Game #' + n + '</div><div class="hint" style="margin-top:4px;">' + esc(meta) + '</div></div>' +
        '<div class="gh-ctl" style="margin:0;"><button class="secondary" id="ghCopy">Copy link</button>' + (canAn ? '<button id="ghAn">Analyze this game</button>' : '') + '</div></div>' +
        '<div class="board-wrap">' +
          '<div><div id="ghBoard"></div>' +
            '<div class="gh-ctl"><button class="secondary" id="ghFirst">&laquo;</button><button class="secondary" id="ghPrev">&lsaquo;</button><button class="secondary" id="ghNext">&rsaquo;</button><button class="secondary" id="ghLast">&raquo;</button><button class="secondary" id="ghFlip">Flip</button><span class="gh-ply" id="ghPly"></span></div></div>' +
          '<div class="panel" style="max-width:380px;">' +
            '<div class="gh-pl"><span class="gh-dot w"></span>' + namesHtml(sideNames(g, 'w')) + '</div>' +
            '<div class="gh-pl"><span class="gh-dot b"></span>' + namesHtml(sideNames(g, 'b')) + '</div>' +
            '<div class="result-banner" style="margin-top:10px;">' + res + (note ? '<div class="rc">' + esc(note) + '</div>' : '') + '</div>' +
            '<div id="ghMoves"></div>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.getElementById('ghFirst').onclick = function(){ step(0); };
    document.getElementById('ghPrev').onclick = function(){ step(G.sel - 1); };
    document.getElementById('ghNext').onclick = function(){ step(G.sel + 1); };
    document.getElementById('ghLast').onclick = function(){ step(G.moves.length); };
    document.getElementById('ghFlip').onclick = function(){ G.flip = !G.flip; paint(); };
    var cp = document.getElementById('ghCopy');
    cp.onclick = async function(){
      var link = location.origin + location.pathname + '#/game/' + n;
      try{ await navigator.clipboard.writeText(link); cp.textContent = 'Copied!'; setTimeout(function(){ cp.textContent = 'Copy link'; }, 1500); }
      catch(e){ prompt('Copy this link:', link); }
    };
    var an = document.getElementById('ghAn');
    if(an) an.onclick = function(){ openAnalysis(g, n); };
    paint();
  }
  window.openGameNumber = openGame;

  // clicks: "#12" links and moves in the list
  document.addEventListener('click', function(e){
    var a = e.target.closest ? e.target.closest('[data-gn]') : null;
    if(a && /^\d+$/.test(a.dataset.gn)){ e.preventDefault(); goToGame(+a.dataset.gn); return; }
    var p = e.target.closest ? e.target.closest('#ghMoves [data-ply]') : null;
    if(p) step(+p.dataset.ply);
  });
  document.addEventListener('keydown', function(e){
    if(!G || screen.style.display !== 'block') return;
    var t = e.target && e.target.tagName;
    if(t === 'TEXTAREA' || t === 'INPUT' || t === 'SELECT') return;
    if(e.key === 'ArrowRight'){ step(G.sel + 1); e.preventDefault(); }
    else if(e.key === 'ArrowLeft'){ step(G.sel - 1); e.preventDefault(); }
    else if(e.key === 'Home'){ step(0); }
    else if(e.key === 'End'){ step(G.moves.length); }
  });

  // address bar: #/game/NUMBER (also the back / forward buttons)
  window.addEventListener('hashchange', function(e){
    var m = /^#\/game\/(\d+)\/?$/.exec(location.hash);
    if(!m || !ME) return;
    if(okOnce) okOnce = false;
    else if(!guardOk()){
      try{
        var old = String(e.oldURL || '').split('#')[1];
        history.replaceState(null, '', location.pathname + location.search + (old ? '#' + old : ''));
      }catch(x){}
      return;
    }
    openGame(+m[1]);
  });

  // a link opened before logging in: go there once login is done
  var prevAfter = window.afterAuth;
  window.afterAuth = async function(){
    var r = await prevAfter.apply(this, arguments);
    if(pendingN){
      var n = pendingN;
      pendingN = null;
      var s = document.getElementById('screen-game');
      if(!(s && s.style.display === 'block')){      // do not pull you out of a live game
        try{ history.replaceState(null, '', location.pathname + location.search + '#/game/' + n); }catch(e){}
        openGame(+n);
      }
    }
    return r;
  };

  // =====================================================================
  //  3. "Recent games" on every profile
  // =====================================================================
  function rowHtml(it){
    var v = it.v, n = String(it.n);
    var r = v.res === 'w' ? ['Win', 'gr-w'] : v.res === 'l' ? ['Loss', 'gr-l'] : ['Draw', 'gr-d'];
    var opp = String(v.opp || '').split(' & ').filter(Boolean);
    var meta = [VNAME[v.v] || 'Game', tcText(v.sec, v.inc), dateText(v.ts)].filter(Boolean).join(' \u00b7 ');
    return '<div class="seat"><span class="who"><span class="gh-n" data-gn="' + esc(n) + '">#' + esc(n) + '</span> <span class="gr ' + r[1] + '">' + r[0] + '</span> vs ' +
      (opp.length ? namesHtml(opp) : '-') + '</span><span class="taken" style="font-weight:500;font-size:12.5px;">' + esc(meta) + '</span></div>';
  }

  async function loadHist(name, before){
    var card = document.getElementById('pfHist');
    var rowsEl = document.getElementById('pfHistRows'), moreEl = document.getElementById('pfHistMore');
    if(!card || !rowsEl || !moreEl) return;
    var list = [];
    try{
      var q = db.ref('hb/history/' + name).orderByChild('ts');
      q = (before === null) ? q.limitToLast(PAGE) : q.endAt(before - 1).limitToLast(PAGE);
      var snap = await q.once('value');
      snap.forEach(function(c){ var v = c.val(); if(v && typeof v.ts === 'number') list.push({n:c.key, v:v}); });
    }catch(e){
      console.error(e);
      if(before === null && document.getElementById('pfHist') === card) rowsEl.innerHTML = '<p class="desc" style="margin:0;">Could not load games (publish the new Firebase rules).</p>';
      return;
    }
    if(document.getElementById('pfHist') !== card) return;      // moved to another profile meanwhile
    list.sort(function(a, b){ return b.v.ts - a.v.ts; });
    if(before === null) rowsEl.innerHTML = '';
    if(!list.length && before === null){
      rowsEl.innerHTML = '<p class="desc" style="margin:0;">No games yet.</p>';
      moreEl.innerHTML = '';
      return;
    }
    rowsEl.insertAdjacentHTML('beforeend', list.map(rowHtml).join(''));
    if(list.length >= PAGE){
      moreEl.innerHTML = '<button class="secondary" id="pfHistBtn" style="margin-top:12px;">Show more</button>';
      document.getElementById('pfHistBtn').onclick = function(){ this.disabled = true; loadHist(name, list[list.length - 1].v.ts); };
    } else moreEl.innerHTML = '';
  }

  function decorateProfile(name){
    var scr = document.getElementById('screen-profile');
    var nm = scr && scr.querySelector('.pf-name');
    if(!scr || scr.style.display !== 'block' || !nm || nm.textContent.indexOf(name) < 0) return;
    if(scr.querySelector('#pfHist')) return;
    var card = document.createElement('div');
    card.className = 'card';
    card.id = 'pfHist';
    card.innerHTML = '<h2>Recent games</h2><div id="pfHistRows"><p class="desc" style="margin:0;">Loading...</p></div><div id="pfHistMore"></div>';
    scr.appendChild(card);
    loadHist(name, null);
  }
  var prevOpen = window.openProfile;
  window.openProfile = async function(name){
    var r = await prevOpen.apply(this, arguments);
    try{ decorateProfile(name); }catch(e){ console.error('game history card failed', e); }
    return r;
  };
})();
