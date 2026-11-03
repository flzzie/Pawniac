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
