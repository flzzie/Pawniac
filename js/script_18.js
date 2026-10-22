(function(){
  // ---------- 1. save how long each move took (Hand & Brain 1v1/2v2 and Standard; any time control, rated or not) ----------
  // Step 6 stamps moveAt = the time of the previous move (or of the game starting), so
  // "now - moveAt" is how long this move took. It is stored inside the game as moveTimes[]
  // in milliseconds. -1 means "unknown" (for example the very first move, which also includes
  // the time the players needed to arrive, so it would be misleading).
  var prevKset = window.kset;
  window.kset = function(key, value, shared){
    try{
      if(shared !== false && typeof key === 'string' && key.indexOf('hb:game:') === 0 &&
         value && typeof value === 'object' && value.moveLog){
        var n = value.moveLog.length;
        var before = typeof value.moveCount === 'number' ? value.moveCount : n - 1;
        if(n === before + 1 && (value.status === 'active' || value.status === 'finished')){
          var arr = [], old = value.moveTimes;
          for(var i = 0; i < n - 1; i++) arr.push(old && typeof old[i] === 'number' ? old[i] : -1);
          arr.push(n > 1 && typeof value.moveAt === 'number' ? Math.max(0, Math.round(serverNow() - value.moveAt)) : -1);
          value.moveTimes = arr;
        }
      }
    }catch(e){ console.error('move time failed', e); }
    return prevKset(key, value, shared);
  };

  // ---------- 2. build a PGN that carries the times ----------
  function hms(ms){
    var t = Math.max(0, Math.round(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    return h + ':' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function gamePgn(g){
    var s = g.seats || {};
    var w = g.mode === 'team' ? (s.whiteBrain + ' & ' + s.whiteHand) : s.white;
    var b = g.mode === 'team' ? (s.blackBrain + ' & ' + s.blackHand) : s.black;
    var res = g.winner === 'w' ? '1-0' : g.winner === 'b' ? '0-1' : g.winner === 'draw' ? '1/2-1/2' : '*';
    var c = g.clock && g.clock.initialSec > 0 ? g.clock : null;
    var times = g.moveTimes || [];
    var rem = {w: c ? c.initialSec * 1000 : 0, b: c ? c.initialSec * 1000 : 0};
    var mt = '';
    (g.moveLog || []).forEach(function(san, i){
      var side = i % 2 === 0 ? 'w' : 'b';
      var spent = typeof times[i] === 'number' && times[i] >= 0 ? times[i] : null;
      var tags = '';
      if(spent !== null) tags += ' {[%emt ' + hms(spent) + ']}';
      if(c){
        // same accounting as the Pawniac clock: White's first move is free, the increment is added after every move
        rem[side] = Math.max(0, rem[side] - (i === 0 || spent === null ? 0 : spent)) + (c.incrementSec || 0) * 1000;
        if(spent !== null || i === 0) tags += ' {[%clk ' + hms(rem[side]) + ']}';
      }
      mt += (i % 2 === 0 ? (i / 2 + 1) + '. ' : '') + san + tags + ' ';
    });
    var tc = c ? (c.initialSec + '+' + (c.incrementSec || 0)) : '-';
    return '[Event "Pawniac game"]\n[White "' + String(w || 'White').replace(/"/g, '') + '"]\n[Black "' + String(b || 'Black').replace(/"/g, '') +
      '"]\n[Result "' + res + '"]\n[TimeControl "' + tc + '"]\n\n' + mt + res;
  }

  // ---------- 3. the "Analyze this game" button (made by step 16) now sends that PGN ----------
  // It uses only what is on the page (the Analyze tab, its box and its buttons), so step 16 stays untouched.
  function openAnalysis(pgn){
    var navLink = document.querySelector('#navbar [data-nav="analyze"]');
    if(!navLink) return;
    navLink.click();                                              // opens the Analyze tab
    var again = document.getElementById('anNewBtn');              // a game was already loaded: start fresh
    if(again) again.click();
    var box = document.getElementById('anPgn');
    var go = document.getElementById('anGo');
    if(!box || !go) return;
    box.value = pgn;
    go.click();
  }
  var prevDraw = window.drawGame;
  window.drawGame = function(){
    try{ prevDraw(); }
    finally{
      try{
        var bt = document.getElementById('btnAnalyzeGame');
        if(bt && !bt.dataset.t17){
          bt.dataset.t17 = '1';
          bt.onclick = function(){
            var g = gameState;
            if(!g || g.status !== 'finished') return;
            openAnalysis(gamePgn(g));
          };
        }
      }catch(e){ console.error('analyze button (step 17) failed', e); }
    }
  };
})();
