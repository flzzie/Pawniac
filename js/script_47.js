(function(){
  // One Stockfish worker for the whole site (analysis + bot share it), loaded from YOUR OWN site (engine/ folder),
  // so the browser can run the fast WebAssembly build. If the engine/ folder is missing, nothing breaks:
  // the old CDN engine is used as before.
  var P = null;
  function dir(){ return new URL('/engine/', location.origin).href; }
  function handshake(w){
    return new Promise(function(res, rej){
      var t = setTimeout(function(){ try{ w.terminate(); }catch(e){} rej(new Error('engine timeout')); }, 60000);
      w.onmessage = function(e){ if(String(e.data).indexOf('uciok') >= 0){ clearTimeout(t); w.onmessage = null; res(w); } };
      w.onerror = function(){ clearTimeout(t); try{ w.terminate(); }catch(e){} rej(new Error('worker error')); };
      w.postMessage('uci');
    });
  }
  function ready(w){
    return new Promise(function(res){
      var t = setTimeout(function(){ w.removeEventListener('message', h); res(); }, 15000);
      function h(e){ if(String(e.data).indexOf('readyok') >= 0){ clearTimeout(t); w.removeEventListener('message', h); res(); } }
      w.addEventListener('message', h);
      w.postMessage('isready');
    });
  }
  // ---- material counter (all game screens) ----
  // PawniacMat.row(fen, color): the little strip next to the board for one side: the pieces that side is
  // ahead by (a bishop up shows a bishop and +3). Works for every variant, promotions and auction armies included.
  (function(){
    var VAL = {p:1, n:3, b:3, r:5, q:9}, ORDER = ['q','r','b','n','p'];
    var GLY = {w:{p:'\u2659', n:'\u2658', b:'\u2657', r:'\u2656', q:'\u2655'}, b:{p:'\u265F', n:'\u265E', b:'\u265D', r:'\u265C', q:'\u265B'}};
    function count(fen){
      var c = {w:{p:0,n:0,b:0,r:0,q:0}, b:{p:0,n:0,b:0,r:0,q:0}};
      String(fen || '').split(' ')[0].split('').forEach(function(ch){
        var lo = ch.toLowerCase();
        if(VAL[lo]) c[ch === lo ? 'b' : 'w'][lo]++;
      });
      return c;
    }
    try{
      var st = document.createElement('style');
      st.textContent = '.pmat{display:flex;align-items:center;gap:1px;min-height:24px;padding:2px 4px;font-size:19px;line-height:1;white-space:nowrap;overflow:hidden}' +
        '.pmat span{display:inline-block;margin-right:-4px}.pmat span.gap{margin-right:3px}' +
        '.pmat b{font-size:13px;font-weight:700;margin-left:8px;opacity:.9;font-variant-numeric:tabular-nums}';
      document.head.appendChild(st);
    }catch(e){}
    window.PawniacMat = {
      lead: function(fen){
        var c = count(fen), s = {w:0, b:0};
        Object.keys(VAL).forEach(function(t){ s.w += VAL[t] * c.w[t]; s.b += VAL[t] * c.b[t]; });
        return s.w - s.b;
      },
      row: function(fen, color){
        try{
          var c = count(fen), me = color === 'w' ? 'w' : 'b', op = me === 'w' ? 'b' : 'w', h = '', score = 0;
          ORDER.forEach(function(t){
            score += VAL[t] * (c[me][t] - c[op][t]);
            var n = c[me][t] - c[op][t];
            for(var i = 0; i < n; i++) h += '<span' + (i === n - 1 ? ' class="gap"' : '') + '>' + GLY[me][t] + '</span>';
          });
          return '<div class="pmat" title="Material">' + h + (score > 0 ? '<b>+' + score + '</b>' : '') + '</div>';
        }catch(e){ return ''; }
      }
    };
  })();
  // The analysis, the move comments, the alternatives and the bot all use this ONE engine. If two of them
  // search at the same moment they steal each other's answers (wrong evals), so every search waits its turn here.
  var Q = Promise.resolve();
  window.PawniacSF = {
    kind: null,
    queue: function(job){
      var p = Q.then(function(){ return job(); });
      Q = p.then(function(){}, function(){});
      return p;
    },
    // The engine's own score is already on the chess.com scale (100 = about a 50% winning chance), so it is used as it is.
    // (An earlier win/draw/loss conversion here blew every clear advantage up to +14.38.)
    cp: function(line, type, val){ return val; },
    get: function(){
      if(P) return P;
      P = (async function(){
        var r = await fetch(dir() + 'engine.json', {cache:'no-cache'});
        if(!r.ok) throw new Error('no local engine');
        var m = await r.json();
        var w = new Worker(dir() + m.js);
        await handshake(w);
        w.postMessage('setoption name UCI_ShowWDL value true');
        w.postMessage('setoption name Threads value 1');
        w.postMessage('setoption name Hash value 64');
        await ready(w);
        window.PawniacSF.kind = m.js;
        return w;
      })();
      P.catch(function(){ P = null; });
      return P;
    }
  };
  // start loading in the background so the first analysis / bot game does not wait
  setTimeout(function(){ try{ window.PawniacSF.get().catch(function(){}); }catch(e){} }, 1500);
})();
