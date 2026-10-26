(function(){
  // =====================================================================
  //  constants + helpers
  // =====================================================================
  var VAL = {p:1, n:3, b:3, r:5, q:9, k:0};
  var NAMES = {p:'pawn', n:'knight', b:'bishop', r:'rook', q:'queen', k:'king'};
  var LABEL = {
    book:{t:'Book move', c:'#6b8fb5'}, best:{t:'Best move', c:'#1f9d55'}, excellent:{t:'Excellent', c:'#4caf50'}, good:{t:'Good', c:'#5f9ea0'},
    inaccuracy:{t:'Inaccuracy', c:'#d4a800'}, mistake:{t:'Mistake', c:'#e67e22'}, blunder:{t:'Blunder', c:'#d64545'}
  };
  var SF_URLS = [
    'https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js',
    'https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js',
    'https://unpkg.com/stockfish.js@10.0.2/stockfish.js'
  ];
  var ORTH = [[1,0],[-1,0],[0,1],[0,-1]], DIAG = [[1,1],[1,-1],[-1,1],[-1,-1]];
  function esc(s){ return String(s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function cap(s){ return s.charAt(0).toUpperCase() + s.slice(1); }
  function plural(n, w){ return n + ' ' + w + (n === 1 ? '' : 's'); }
  function winPct(cp){ cp = Math.max(-1000, Math.min(1000, cp)); return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1); }
  function isMate(cp){ return Math.abs(cp) >= 9000; }
  function mateN(cp){ return Math.max(0, Math.round((10000 - Math.abs(cp)) / 10)); }
  function fmtEval(cp){
    if(isMate(cp)) return (cp > 0 ? '+' : '-') + 'M' + mateN(cp);
    var v = cp / 100, ab = Math.abs(cp), wd = ab >= 900 ? ' (crushing)' : (ab >= 500 ? ' (winning)' : '');
    return (v >= 0 ? '+' : '') + v.toFixed(2) + wd;
  }
  // takes an eval from the player's point of view and prints it from WHITE's point of view (+ = White ahead, - = Black ahead)
  function fw(cp, me){ return fmtEval(me === 'w' ? cp : -cp); }
  function fmtSec(s){ s = Math.round(s); return s < 60 ? s + 's' : Math.floor(s / 60) + 'm ' + (s % 60 < 10 ? '0' : '') + (s % 60) + 's'; }
  function fenParts(fen){ var p = fen.split(' '); return {turn:p[1], rights:p[2] || '-', full:parseInt(p[5], 10) || 1}; }
  function moveNumText(fen){ var p = fenParts(fen); return p.full + (p.turn === 'w' ? '.' : '...'); }
  function flipTurn(fen, color){ var p = fen.split(' '); p[1] = color; p[3] = '-'; return p.join(' '); }
  function tryMove(fen, uci){
    try{ var c = new Chess(fen); return c.move({from:uci.slice(0, 2), to:uci.slice(2, 4), promotion:uci.slice(4, 5) || undefined}); }
    catch(e){ return null; }
  }
  function sqName(f, r){ return 'abcdefgh'[f] + (r + 1); }   // r = rank - 1
  // everything below speaks from the point of view of the player (A.me)
  function pov(A, cpW){ return A.me === 'w' ? cpW : -cpW; }
  function whoWords(cp){
    if(isMate(cp)) return cp > 0 ? 'You have a forced checkmate' : 'Your opponent has a forced checkmate';
    var a = Math.abs(cp), up = cp > 0;
    if(a < 25) return 'The position is dead equal';
    if(a < 60) return 'The position is roughly equal';
    if(a < 120) return up ? 'You are slightly better' : 'You are slightly worse';
    if(a < 250) return up ? 'You are clearly better' : 'You are clearly worse';
    if(a < 500) return up ? 'You have a big advantage' : 'You have a big disadvantage';
    return up ? 'You are winning' : 'You are losing';
  }

  // =====================================================================
  //  engine (Stockfish worker with a small fallback)
  // =====================================================================
  var ENGINE = null;
  function sfHandshake(w){
    return new Promise(function(res, rej){
      var t = setTimeout(function(){ try{ w.terminate(); }catch(e){} rej(new Error('engine did not answer')); }, 25000);
      w.onmessage = function(e){ if(String(e.data).indexOf('uciok') >= 0){ clearTimeout(t); w.onmessage = null; res(w); } };
      w.onerror = function(){ clearTimeout(t); rej(new Error('worker error')); };
      w.postMessage('uci');
    });
  }
  async function loadStockfish(){
    if(window.PawniacSF){ try{ return await window.PawniacSF.get(); }catch(e){ console.warn('local engine not available, using the CDN one', e); } }
    var lastErr = null;
    for(var i = 0; i < SF_URLS.length; i++){
      try{
        var r = await fetch(SF_URLS[i]);
        if(!r.ok) throw new Error('HTTP ' + r.status);
        var txt = await r.text();
        if(txt.length < 20000) throw new Error('unexpected file');
        var w = new Worker(URL.createObjectURL(new Blob([txt], {type:'application/javascript'})));
        await sfHandshake(w);
        return w;
      }catch(e){ lastErr = e; console.warn('stockfish source failed', SF_URLS[i], e); }
    }
    throw lastErr || new Error('no engine source worked');
  }
  async function getEngine(setStatus){
    if(ENGINE) return ENGINE;
    setStatus('Loading the chess engine (first time only)...');
    try{
      ENGINE = {kind:'stockfish', w:await loadStockfish()};
      setStatus('Warming up the engine...');
      ENGINE.w.postMessage('ucinewgame');
      try{ await sfEval(ENGINE.w, 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 300, 1); }catch(e){}
    }catch(e){ ENGINE = {kind:'basic'}; }
    return ENGINE;
  }
  // search to a fixed depth so results do not depend on how fast the device is;
  // the time cap only stops positions that are very slow to search
  // time per position: Fast 0.35 s, Balanced 0.5 s, Deep 0.7 s (the engine searches as deep as it can in that time)
  function sfLimits(ms){
    if(ms <= 300) return {depth:40, cap:350};
    if(ms <= 800) return {depth:40, cap:500};
    return {depth:40, cap:700};
  }
  function scoreToCp(L){
    if(!L) return 0;
    if(L.type === 'mate') return L.val === 0 ? -10000 : (L.val > 0 ? 10000 - 10 * L.val : -(10000 - 10 * (-L.val)));
    return L.val;
  }
  // multi = how many lines to search (1 = just the best move; 3 also returns the next two best moves)
  function sfEval(w, fen, ms, multi){
    multi = multi || 1;
    return new Promise(function(resolve, reject){
      var lines = {};
      var guard = setTimeout(function(){ w.removeEventListener('message', h); reject(new Error('engine timed out')); }, 90000);
      function h(e){
        var line = String(e.data);
        if(line.indexOf('info') === 0 && line.indexOf(' score ') > 0 && line.indexOf(' pv ') > 0 && !/lowerbound|upperbound/.test(line)){
          var m = /score (cp|mate) (-?\d+)/.exec(line), p = / pv (.+)$/.exec(line), d = / depth (\d+)/.exec(line), mp = / multipv (\d+)/.exec(line);
          if(m && p) lines[mp ? parseInt(mp[1], 10) : 1] = {type:m[1], val:(window.PawniacSF ? window.PawniacSF.cp(line, m[1], parseInt(m[2], 10)) : parseInt(m[2], 10)), pv:p[1].trim().split(/\s+/), depth:d ? parseInt(d[1], 10) : 0};
        } else if(line.indexOf('bestmove') === 0){
          clearTimeout(guard); w.removeEventListener('message', h);
          var bm = line.split(' ')[1], main = lines[1] || null, alts = [];
          if(multi > 1 && main){
            for(var k = 2; k <= multi; k++){
              var L = lines[k];
              if(L && L.pv.length && L.depth >= main.depth - 1) alts.push({cp:scoreToCp(L), best:L.pv[0], pv:L.pv});
            }
          }
          resolve({cp:scoreToCp(main), best:(bm && bm !== '(none)') ? bm : null, pv:main ? main.pv : [], depth:main ? main.depth : 0, alts:alts});
        }
      }
      w.addEventListener('message', h);
      w.postMessage('setoption name Skill Level value 20');
      w.postMessage('setoption name Contempt value 0');
      w.postMessage('setoption name MultiPV value ' + multi);
      w.postMessage('position fen ' + fen);
      var lim = sfLimits(ms);
      w.postMessage('go depth ' + lim.depth + ' movetime ' + lim.cap);
    });
  }
  var BV = {p:100, n:320, b:330, r:500, q:900, k:0};
  function basicStatic(chess){
    var b = chess.board(), s = 0;
    for(var r = 0; r < 8; r++) for(var f = 0; f < 8; f++){
      var p = b[r][f]; if(!p) continue;
      var v = BV[p.type], cen = (3.5 - Math.abs(3.5 - f)) + (3.5 - Math.abs(3.5 - r));
      if(p.type === 'n' || p.type === 'b') v += cen * 6;
      else if(p.type === 'p') v += cen * 2 + (p.color === 'w' ? (6 - r) : (r - 1)) * 4;
      s += p.color === 'w' ? v : -v;
    }
    return s;
  }
  function orderMoves(moves){
    return moves.sort(function(a, b){
      var sa = (a.captured ? BV[a.captured] * 10 - BV[a.piece] : 0) + (a.promotion ? 800 : 0);
      var sb = (b.captured ? BV[b.captured] * 10 - BV[b.piece] : 0) + (b.promotion ? 800 : 0);
      return sb - sa;
    });
  }
  var TIMEOUT = {t:1};
  function quiesce(chess, alpha, beta, deadline, qd){
    if(Date.now() > deadline) throw TIMEOUT;
    var stand = (chess.turn() === 'w' ? 1 : -1) * basicStatic(chess);
    if(stand >= beta) return beta;
    if(stand > alpha) alpha = stand;
    if(qd >= 4) return alpha;
    var moves = orderMoves(chess.moves({verbose:true}).filter(function(m){ return m.captured || m.promotion; }));
    for(var i = 0; i < moves.length; i++){
      chess.move(moves[i]);
      var sc = -quiesce(chess, -beta, -alpha, deadline, qd + 1);
      chess.undo();
      if(sc >= beta) return beta;
      if(sc > alpha) alpha = sc;
    }
    return alpha;
  }
  function negamax(chess, depth, alpha, beta, ply, deadline){
    if(Date.now() > deadline) throw TIMEOUT;
    if(chess.in_checkmate()) return -(30000 - ply);
    if(chess.in_draw() || chess.in_stalemate() || chess.in_threefold_repetition()) return 0;
    if(depth <= 0) return quiesce(chess, alpha, beta, deadline, 0);
    var moves = orderMoves(chess.moves({verbose:true})), best = -Infinity;
    for(var i = 0; i < moves.length; i++){
      chess.move(moves[i]);
      var sc = -negamax(chess, depth - 1, -beta, -alpha, ply + 1, deadline);
      chess.undo();
      if(sc > best) best = sc;
      if(best > alpha) alpha = best;
      if(alpha >= beta) break;
    }
    return best;
  }
  function basicEval(fen, ms){
    var chess = new Chess(fen), deadline = Date.now() + ms;
    var root = orderMoves(chess.moves({verbose:true}));
    var bestMove = root[0], bestScore = 0, doneDepth = 0;
    for(var depth = 1; depth <= 4; depth++){
      try{
        var curBest = null, curScore = -Infinity, alpha = -Infinity;
        for(var i = 0; i < root.length; i++){
          chess.move(root[i]);
          var sc = -negamax(chess, depth - 1, -Infinity, -alpha, 1, deadline);
          chess.undo();
          if(sc > curScore){ curScore = sc; curBest = root[i]; }
          if(sc > alpha) alpha = sc;
        }
        bestMove = curBest; bestScore = curScore; doneDepth = depth;
        root = [curBest].concat(root.filter(function(m){ return m !== curBest; }));
      }catch(e){ if(e !== TIMEOUT) throw e; break; }
    }
    var cp = bestScore;
    if(Math.abs(cp) > 29000){ var n = Math.ceil((30000 - Math.abs(cp)) / 2); cp = (cp > 0 ? 1 : -1) * (10000 - 10 * n); }
    var uci = bestMove ? bestMove.from + bestMove.to + (bestMove.promotion || '') : null;
    return {cp:cp, best:uci, pv:uci ? [uci] : [], depth:doneDepth, alts:[]};
  }
  // evaluation of a position from WHITE's point of view
  async function evalFen(eng, fen, ms, multi){
    var c = new Chess(fen), turn = fenParts(fen).turn;
    if(c.game_over()){
      var cp0 = 0;
      if(c.in_checkmate()) cp0 = turn === 'w' ? -10000 : 10000;
      return {cp:cp0, best:null, pv:[], depth:0, alts:[]};
    }
    var r = eng.kind === 'stockfish' ? await sfEval(eng.w, fen, ms, multi) : basicEval(fen, ms);
    var sign = turn === 'w' ? 1 : -1;
    return {cp:sign * r.cp, best:r.best, pv:r.pv, depth:r.depth,
            alts:(r.alts || []).map(function(a){ return {cp:sign * a.cp, best:a.best, pv:a.pv}; })};
  }

  // =====================================================================
  //  position reading
  // =====================================================================
  function features(fen){
    var c = new Chess(fen), b = c.board();
    function blank(){ return {mat:0, nonPawn:0, minors:0, dev:0, bishops:0, pawnsFiles:[0,0,0,0,0,0,0,0], pawns:[], rooks:[], centre:0, king:null}; }
    var F = {w:blank(), b:blank()};
    for(var r = 0; r < 8; r++) for(var f = 0; f < 8; f++){
      var p = b[r][f]; if(!p) continue;
      var o = F[p.color], sq = 'abcdefgh'[f] + (8 - r);
      if(p.type === 'k'){ o.king = {f:f, r:r}; continue; }
      o.mat += VAL[p.type];
      if(p.type !== 'p') o.nonPawn += VAL[p.type];
      if(p.type === 'p'){ o.pawnsFiles[f]++; o.pawns.push({f:f, r:r}); if(sq === 'd4' || sq === 'e4' || sq === 'd5' || sq === 'e5') o.centre++; }
      if(p.type === 'n' || p.type === 'b'){ o.minors++; if(r !== (p.color === 'w' ? 7 : 0)) o.dev++; }
      if(p.type === 'b') o.bishops++;
      if(p.type === 'r') o.rooks.push({f:f, r:r});
    }
    ['w', 'b'].forEach(function(col){
      var o = F[col], opp = F[col === 'w' ? 'b' : 'w'];
      o.doubled = 0; o.isolated = 0; o.passed = 0; o.openRooks = 0; o.castled = false; o.shield = 0;
      for(var ff = 0; ff < 8; ff++){
        if(o.pawnsFiles[ff] > 1) o.doubled += o.pawnsFiles[ff] - 1;
        if(o.pawnsFiles[ff] > 0){
          var left = ff > 0 ? o.pawnsFiles[ff - 1] : 0, right = ff < 7 ? o.pawnsFiles[ff + 1] : 0;
          if(!left && !right) o.isolated += o.pawnsFiles[ff];
        }
      }
      o.pawns.forEach(function(pw){
        var passed = true;
        opp.pawns.forEach(function(q){ if(Math.abs(q.f - pw.f) <= 1 && (col === 'w' ? q.r < pw.r : q.r > pw.r)) passed = false; });
        if(passed) o.passed++;
      });
      o.rooks.forEach(function(rk){ if(o.pawnsFiles[rk.f] === 0) o.openRooks++; });
      var k = o.king;
      if(k){
        var homeR = col === 'w' ? 7 : 0, dir = col === 'w' ? -1 : 1;
        o.castled = (k.r === homeR) && (k.f >= 6 || k.f <= 2);
        for(var df = -1; df <= 1; df++){
          var kf = k.f + df; if(kf < 0 || kf > 7) continue;
          for(var dr = 1; dr <= 2; dr++){
            var kr = k.r + dir * dr; if(kr < 0 || kr > 7) continue;
            var pp = b[kr][kf];
            if(pp && pp.type === 'p' && pp.color === col){ o.shield++; break; }
          }
        }
      }
      o.weak = o.doubled + o.isolated;
    });
    F.total = F.w.nonPawn + F.b.nonPawn;
    var fp = fenParts(fen);
    F.phase = F.total <= 20 ? 'endgame' : ((fp.full <= 10 && F.total >= 40) ? 'opening' : 'middlegame');
    return F;
  }

  // captures `color` could make in this position (as if it were their turn)
  function capsFor(fen, color){ try{ return new Chess(flipTurn(fen, color)).moves({verbose:true}); }catch(e){ return []; } }
  // is square s strictly between squares a and b on a straight line (file, rank or diagonal)?
  function onLine(a, b, s){
    var af = a.charCodeAt(0) - 97, ar = parseInt(a.charAt(1), 10), bf = b.charCodeAt(0) - 97, br = parseInt(b.charAt(1), 10), sf = s.charCodeAt(0) - 97, sr = parseInt(s.charAt(1), 10);
    var df = bf - af, dr = br - ar;
    if(!(df === 0 || dr === 0 || Math.abs(df) === Math.abs(dr))) return false;
    var n = Math.max(Math.abs(df), Math.abs(dr)), sx = df / n, sy = dr / n;
    for(var q = 1; q < n; q++){ if(af + sx * q === sf && ar + sy * q === sr) return true; }
    return false;
  }
  // what the side to move can win by capturing on `sq`, counting every recapture (cheapest attacker first)
  function seeGain(c, sq, depth){
    depth = depth || 0;
    if(depth > 7) return 0;
    var caps = c.moves({verbose:true}).filter(function(x){ return x.to === sq && x.captured; });
    if(!caps.length) return 0;
    caps.sort(function(p, q){ return (p.piece === 'k' ? 100 : VAL[p.piece]) - (q.piece === 'k' ? 100 : VAL[q.piece]); });
    var x = caps[0];
    c.move({from:x.from, to:x.to, promotion:x.promotion});
    var g = VAL[x.captured] - seeGain(c, sq, depth + 1);
    c.undo();
    return Math.max(0, g);
  }
  // captures that win material for `color`: free pieces, or trades that win points
  function winsFor(fen, color){
    var res = [];
    capsFor(fen, color).forEach(function(m){
      if(!m.captured || m.captured === 'k') return;
      var c2 = new Chess(flipTurn(fen, color));
      c2.move({from:m.from, to:m.to, promotion:m.promotion});
      var recap = c2.moves({verbose:true}).filter(function(x){ return x.to === m.to && x.captured; });
      var net = VAL[m.captured] - seeGain(c2, m.to);
      if(net >= 1) res.push({from:m.from, to:m.to, piece:m.captured, san:m.san, net:net, free:!recap.length});
    });
    return res.sort(function(a, b){ return b.net - a.net; });
  }

  // ---------- tactics: fork, pin, skewer, discovered attack, back-rank / smothered mate ----------
  // after `mv` is played by `color`, which valuable enemy pieces does the moved piece attack at once?
  function forkOf(fen, mv, color){
    try{
      var c = new Chess(fen), made = c.move({from:mv.from, to:mv.to, promotion:mv.promotion});
      if(!made) return null;
      var after = c.fen(), enemy = color === 'w' ? 'b' : 'w';
      // 1. the forking piece must be safe: if it can just be taken, it is not a fork
      var unsafe = false;
      capsFor(after, enemy).filter(function(x){ return x.to === mv.to; }).forEach(function(x){
        if(unsafe) return;
        var c3 = new Chess(flipTurn(after, enemy));
        c3.move({from:x.from, to:x.to, promotion:x.promotion});
        if(VAL[made.piece] - seeGain(c3, mv.to) >= 1) unsafe = true;
      });
      if(unsafe) return null;
      // 2. each target must actually be winnable: unprotected, or worth more than the forking piece
      var seen = {}, t = [];
      capsFor(after, color).forEach(function(x){
        if(x.from !== mv.to || !x.captured || x.captured === 'k' || seen[x.to]) return;
        if(!(VAL[x.captured] >= 3 || VAL[x.captured] > VAL[mv.piece])) return;
        var c4 = new Chess(flipTurn(after, color));
        c4.move({from:x.from, to:x.to, promotion:x.promotion});
        if(VAL[x.captured] - seeGain(c4, x.to) >= 1){ seen[x.to] = 1; t.push('the ' + NAMES[x.captured] + ' on ' + x.to); }
      });
      var check = /[+#]/.test(made.san);
      if(check && t.length >= 1){ t.push('the king'); return t.slice(0, 3).join(' and '); }
      return t.length >= 2 ? t.slice(0, 3).join(' and ') : null;
    }catch(e){ return null; }
  }
  function kingSq(c, color){
    var b = c.board();
    for(var r = 0; r < 8; r++) for(var f = 0; f < 8; f++){
      var p = b[r][f];
      if(p && p.type === 'k' && p.color === color) return 'abcdefgh'[f] + (8 - r);
    }
    return null;
  }
  // the first two pieces met when sliding from `sq` in direction d
  function firstTwo(c, sq, d){
    var f = 'abcdefgh'.indexOf(sq.charAt(0)), r = parseInt(sq.charAt(1), 10) - 1, found = [];
    for(var k = 1; k < 8 && found.length < 2; k++){
      var nf = f + d[0] * k, nr = r + d[1] * k;
      if(nf < 0 || nf > 7 || nr < 0 || nr > 7) break;
      var s = sqName(nf, nr), p = c.get(s);
      if(p) found.push({sq:s, type:p.type, color:p.color});
    }
    return found;
  }
  // names the tactic that the move `mv` (a verbose chess.js move) creates in position `fen`, or null
  function tacticOf(fen, mv){
    try{
      var col = mv.color, enemy = col === 'w' ? 'b' : 'w';
      var c = new Chess(fen), made = c.move({from:mv.from, to:mv.to, promotion:mv.promotion});
      if(!made) return null;
      if(made.san.slice(-1) === '#'){
        var ek = kingSq(c, enemy);
        if(!ek) return null;
        if((made.piece === 'r' || made.piece === 'q') && ek.charAt(1) === (enemy === 'w' ? '1' : '8') && made.to.charAt(1) === ek.charAt(1))
          return {name:'back-rank mate', text:'a back-rank mate: the king is boxed in by its own pawns'};
        if(made.piece === 'n'){
          var kf = 'abcdefgh'.indexOf(ek.charAt(0)), kr = parseInt(ek.charAt(1), 10) - 1, blocked = true;
          for(var df = -1; df <= 1; df++) for(var dr = -1; dr <= 1; dr++){
            if(!df && !dr) continue;
            var nf = kf + df, nr = kr + dr;
            if(nf < 0 || nf > 7 || nr < 0 || nr > 7) continue;
            var q = c.get(sqName(nf, nr));
            if(!q || q.color !== enemy) blocked = false;
          }
          if(blocked) return {name:'smothered mate', text:'a smothered mate: the king is surrounded by its own pieces'};
        }
        return null;
      }
      var fk = forkOf(fen, mv, col);
      if(fk) return {name:'fork', text:'a fork: it attacks ' + fk + ' at once'};
      // pin / skewer made by the piece that just moved
      var __cap = capsFor(c.fen(), enemy).some(function(x){ return x.to === made.to && VAL[x.piece] <= VAL[made.piece]; });
      if(!__cap && (made.piece === 'b' || made.piece === 'r' || made.piece === 'q')){
        var dirs = made.piece === 'b' ? DIAG : (made.piece === 'r' ? ORTH : ORTH.concat(DIAG));
        for(var di = 0; di < dirs.length; di++){
          var two = firstTwo(c, made.to, dirs[di]);
          if(two.length < 2 || two[0].color !== enemy || two[1].color !== enemy) continue;
          var a = two[0], b2 = two[1];
          if(a.type !== 'k' && (b2.type === 'k' || (VAL[a.type] >= 3 && VAL[b2.type] >= 5 && VAL[b2.type] > VAL[a.type])))
            return {name:'pin', text:'a pin: the ' + NAMES[a.type] + ' on ' + a.sq + ' is stuck in front of the ' + NAMES[b2.type] + ' on ' + b2.sq};
          if((a.type === 'k' || (VAL[a.type] >= 5 && VAL[a.type] > VAL[b2.type])) && b2.type !== 'k' && VAL[b2.type] >= 3)
            return {name:'skewer', text:'a skewer: the ' + NAMES[a.type] + ' on ' + a.sq + ' has to move, and then the ' + NAMES[b2.type] + ' on ' + b2.sq + ' falls'};
        }
      }
      // discovered attack: moving this piece uncovers one of your own sliders
      var key = function(x){ return x.from + x.to; };
      var worth = function(x){ return (x.piece === 'b' || x.piece === 'r' || x.piece === 'q') && x.captured && x.captured !== 'k' && (VAL[x.captured] >= 5 || VAL[x.captured] > VAL[x.piece]); };
      var before = {};
      capsFor(fen, col).forEach(function(x){ if(worth(x)) before[key(x)] = 1; });
      // the moved piece must really have been standing between the slider and its target (a line through made.from) and must not step back onto that line;
      // this stops "discoveries" that only appear because a check or pin was lifted
      var onLine = function(a, b, s){
        var af = a.charCodeAt(0) - 97, ar = parseInt(a.charAt(1), 10), bf = b.charCodeAt(0) - 97, br = parseInt(b.charAt(1), 10), sf = s.charCodeAt(0) - 97, sr = parseInt(s.charAt(1), 10);
        var df = bf - af, dr = br - ar;
        if(!(df === 0 || dr === 0 || Math.abs(df) === Math.abs(dr))) return false;
        var n = Math.max(Math.abs(df), Math.abs(dr)), sx = df / n, sy = dr / n;
        for(var q = 1; q < n; q++){ if(af + sx * q === sf && ar + sy * q === sr) return true; }
        return false;
      };
      var disc = capsFor(c.fen(), col).filter(function(x){ return worth(x) && x.from !== made.to && !before[key(x)] && onLine(x.from, x.to, made.from) && !onLine(x.from, x.to, made.to); });
      if(disc.length) return {name:'discovered attack', text:'a discovered attack: moving the ' + NAMES[made.piece] + ' uncovers the ' + NAMES[disc[0].piece] + ' on ' + disc[0].from + ', which now attacks the ' + NAMES[disc[0].captured] + ' on ' + disc[0].to};
    }catch(e){ console.error('tactic detection failed', e); }
    return null;
  }
  // the tactic in the final (mating) move of a line
  function mateMoveTactic(fen, pv){
    try{
      var c = new Chess(fen);
      for(var k = 0; k < pv.length; k++){
        var u = pv[k], before = c.fen(), mv = c.move({from:u.slice(0, 2), to:u.slice(2, 4), promotion:u.slice(4, 5) || undefined});
        if(!mv) return null;
        if(mv.san.slice(-1) === '#') return tacticOf(before, mv);
      }
    }catch(e){}
    return null;
  }
  var TACT_TIP = {
    'fork':'Before each move, look for a square where one piece can attack two of their pieces at once (knights are the usual culprits).',
    'pin':'Look for lines running through two of their pieces, and check that none of your own pieces is lined up in front of your king or queen.',
    'skewer':'When a king, queen or rook sits on a line with something behind it, attack the front piece. Check your own lines for the same danger.',
    'discovered attack':'Every time you move a piece, ask what it uncovers behind it. The best discoveries come with a threat of their own.',
    'back-rank mate':'Give your king an escape square (a "luft" pawn move) and check that no rook or queen can land on your back rank with check.',
    'smothered mate':'When your king is hemmed in by your own pieces, watch out for knight checks.'
  };
  function noteT(A, tc, i){
    if(!tc || !TACT_TIP[tc.name]) return;
    var l = A.rep.tacts[tc.name] || (A.rep.tacts[tc.name] = []);
    if(l.indexOf(i) < 0) l.push(i);
  }

  function weakPawns(fen, color){
    var c = new Chess(fen), b = c.board(), cnt = [0,0,0,0,0,0,0,0], list = [];
    for(var r = 0; r < 8; r++) for(var f = 0; f < 8; f++){ var p = b[r][f]; if(p && p.type === 'p' && p.color === color) cnt[f]++; }
    for(var r2 = 0; r2 < 8; r2++) for(var f2 = 0; f2 < 8; f2++){
      var q = b[r2][f2]; if(!q || q.type !== 'p' || q.color !== color) continue;
      var iso = !(f2 > 0 ? cnt[f2 - 1] : 0) && !(f2 < 7 ? cnt[f2 + 1] : 0);
      if(iso) list.push({sq:'abcdefgh'[f2] + (8 - r2), why:'isolated'});
      else if(cnt[f2] > 1) list.push({sq:'abcdefgh'[f2] + (8 - r2), why:'doubled'});
    }
    return list;
  }
  function newWeak(fenB, fenA, color){
    var b4 = weakPawns(fenB, color), af = weakPawns(fenA, color);
    var fresh = af.filter(function(a){ return !b4.some(function(b){ return b.sq === a.sq && b.why === a.why; }); });
    if(!fresh.length) return null;
    var w = fresh[0];
    return w.why === 'isolated'
      ? 'the pawn on ' + w.sq + ' is now isolated (no friendly pawn on a neighbouring file)'
      : 'you now have doubled pawns on the ' + w.sq[0] + '-file';
  }
  function quality(fen, sq, color){
    var c = new Chess(fen), p = c.get(sq);
    if(!p || p.color !== color) return null;
    var f = 'abcdefgh'.indexOf(sq.charAt(0)), r = parseInt(sq.charAt(1), 10) - 1;
    if(p.type === 'b'){
      var sc = (f + r) % 2, n = 0, b = c.board();
      for(var rr = 0; rr < 8; rr++) for(var ff = 0; ff < 8; ff++){
        var q = b[rr][ff];
        if(q && q.type === 'p' && q.color === color && ((ff + (7 - rr)) % 2) === sc) n++;
      }
      return {t:'bishop', q:n >= 5 ? 'bad' : (n <= 3 ? 'good' : 'ok')};
    }
    if(p.type === 'n'){
      var rim = (f === 0 || f === 7), cen = (f >= 2 && f <= 5 && r >= 2 && r <= 5);
      return {t:'knight', q:rim ? 'bad' : (cen ? 'good' : 'ok')};
    }
    return null;
  }
  function qWord(x){
    if(x.t === 'bishop') return x.q === 'good' ? 'good bishop' : (x.q === 'bad' ? 'bad bishop (hemmed in by its own pawns)' : 'bishop');
    return x.q === 'good' ? 'well-placed knight' : (x.q === 'bad' ? 'poorly placed knight (on the rim)' : 'knight');
  }

  function evalBlock(fen, cpMe, me){
    // a forced mate overrides everything: no positional talk
    if(isMate(cpMe)){
      var mn = mateN(cpMe);
      return [cpMe > 0
        ? 'You have a forced checkmate' + (mn ? ' in ' + mn : '') + '. Nothing else matters: just play the mating line.'
        : 'Your opponent has a forced checkmate' + (mn ? ' in ' + mn : '') + '. Only forcing resistance (checks, or captures that break the attack) can delay it.'];
    }
    var opp = me === 'w' ? 'b' : 'w', F = features(fen), M = F[me], O = F[opp], lines = [];
    lines.push(whoWords(cpMe) + ' (' + fw(cpMe, me) + ').');
    lines.push('That figure is about ' + Math.abs(cpMe / 100).toFixed(1) + ' pawns in ' + (cpMe >= 0 ? 'your' : "your opponent's") + ' favour. Engines squeeze the whole board into that one number.');
    var md = M.mat - O.mat, matIdx = lines.length;
    lines.push(md === 0 ? 'Material is even (pawn 1, minor piece 3, rook 5, queen 9).' : (md > 0 ? 'You are up ' : 'You are down ') + plural(Math.abs(md), 'point') + ' of material.');
    var fac = [];
    function add(s, t){ if(s) fac.push({s:s, t:t}); }
    if(F.phase !== 'endgame'){
      var dd = M.dev - O.dev;
      add(dd, dd > 0 ? 'you have developed ' + plural(dd, 'more minor piece') : 'your opponent has developed ' + plural(-dd, 'more minor piece'));
      if(M.castled !== O.castled && F.total >= 30) add(M.castled ? 1 : -1, M.castled ? 'you have castled while their king is still in the centre' : 'they have castled while your king is still in the centre');
      else if(M.castled && O.castled && M.shield !== O.shield) add(M.shield - O.shield, M.shield > O.shield ? 'your king has the sturdier pawn shield' : 'their king has the sturdier pawn shield');
    }
    if(M.bishops >= 2 && O.bishops < 2) add(1, 'you have the bishop pair');
    if(O.bishops >= 2 && M.bishops < 2) add(-1, 'they have the bishop pair');
    var wk = O.weak - M.weak;
    add(wk, wk > 0 ? 'their pawn structure is shakier than yours' : 'your pawn structure is shakier than theirs');
    var pp = M.passed - O.passed;
    add(pp, pp > 0 ? 'you have ' + plural(pp, 'extra passed pawn') : 'they have ' + plural(-pp, 'extra passed pawn'));
    var rk = M.openRooks - O.openRooks;
    add(rk, rk > 0 ? 'your rooks are on open files' : 'their rooks are on open files');
    var ce = M.centre - O.centre;
    if(F.phase !== 'endgame') add(ce, ce > 0 ? 'you hold more of the centre' : 'they hold more of the centre');
    var lead = cpMe >= 0 ? 1 : -1;
    var sup = fac.filter(function(x){ return x.s * lead > 0; }).sort(function(a, b){ return Math.abs(b.s) - Math.abs(a.s); }).slice(0, 3);
    var agn = fac.filter(function(x){ return x.s * lead < 0; }).sort(function(a, b){ return Math.abs(b.s) - Math.abs(a.s); }).slice(0, 1);
    var matLead = md > 0 ? 'you' : (md < 0 ? 'your opponent' : null), evLead = cpMe >= 60 ? 'you' : (cpMe <= -60 ? 'your opponent' : null);
    if(matLead && evLead && matLead !== evLead) lines[matIdx] += ' Even so, ' + evLead + (evLead === 'you' ? ' have' : ' has') + ' the better position' + (sup.length ? ' (' + sup[0].t + ')' : '') + ': activity, king safety and threats outweigh the extra material.';
    if(Math.abs(cpMe) < 60) lines.push('The factors roughly cancel out' + (fac.length ? ': ' + fac.slice(0, 2).map(function(x){ return x.t; }).join('; ') : '') + '.');
    else {
      if(sup.length) lines.push('What supports it: ' + sup.map(function(x){ return x.t; }).join('; ') + '.');
      if(agn.length) lines.push('Working the other way: ' + agn[0].t + '.');
    }
    return lines;
  }

  function describeMove(mv, ply){
    var bits = [], tags = [], pname = NAMES[mv.piece], fl = mv.flags || '';
    if(fl.indexOf('k') >= 0 || fl.indexOf('q') >= 0){
      bits.push('castles ' + (fl.indexOf('k') >= 0 ? 'kingside' : 'queenside') + ', tucking the king away and bringing a rook toward the centre'); tags.push('castle');
    } else {
      if(mv.captured){ bits.push('captures the ' + NAMES[mv.captured] + ' on ' + mv.to + (fl.indexOf('e') >= 0 ? ' (en passant)' : '')); tags.push('capture'); }
      if(mv.promotion){ bits.push('promotes the pawn to a ' + NAMES[mv.promotion]); tags.push('promo'); }
      var home = mv.color === 'w' ? '1' : '8';
      if((mv.piece === 'n' || mv.piece === 'b') && mv.from.charAt(1) === home && ply < 30){ bits.push('develops the ' + pname + ' to ' + mv.to); tags.push('develop'); }
      if(mv.piece === 'p' && ['d4', 'e4', 'd5', 'e5'].indexOf(mv.to) >= 0 && !mv.captured){ bits.push('stakes a claim in the centre'); tags.push('centre'); }
      if(mv.piece === 'k'){ bits.push('moves the king to ' + mv.to); tags.push('kingmove'); }
      if(mv.piece === 'q' && ply < 12 && !mv.captured) tags.push('earlyqueen');
      if(!bits.length) bits.push(mv.piece === 'p' ? 'pushes the pawn to ' + mv.to : 'moves the ' + pname + ' from ' + mv.from + ' to ' + mv.to);
    }
    var last = mv.san.charAt(mv.san.length - 1);
    if(last === '#'){ bits.push('delivers checkmate'); tags.push('mate'); }
    else if(last === '+'){ bits.push('gives check'); tags.push('check'); }
    return {text:bits.join(', '), tags:tags};
  }
  function pvInfo(fen, ucis, plies, side){
    var c = new Chess(fen), net = 0, firstCap = null, sans = [], last = null;
    function count(mv, k){
      var v = 0;
      if(mv.captured) v += VAL[mv.captured];
      if(mv.promotion) v += VAL[mv.promotion] - 1;
      if(v){ net += (mv.color === side ? v : -v); if(!firstCap) firstCap = {san:mv.san, color:mv.color, captured:mv.captured, to:mv.to, piece:mv.piece, ply:k}; }
    }
    for(var k = 0; k < ucis.length; k++){
      // past the horizon we only keep going to finish a capture sequence
      if(k >= plies && !(last && last.captured)) break;
      if(k >= plies + 4) break;
      var u = ucis[k], mv = c.move({from:u.slice(0, 2), to:u.slice(2, 4), promotion:u.slice(4, 5) || undefined});
      if(!mv) break;
      sans.push(mv.san);
      count(mv, k);
      last = mv;
    }
    // the line stops right after a capture: let the other side take back if that is sensible
    var guard = 0;
    while(last && last.captured && guard < 4){
      var rec = c.moves({verbose:true}).filter(function(x){ return x.to === last.to && x.captured; });
      if(!rec.length) break;
      rec.sort(function(p, q){ return (p.piece === 'k' ? 100 : VAL[p.piece]) - (q.piece === 'k' ? 100 : VAL[q.piece]); });
      var r0 = rec[0], mv2 = c.move({from:r0.from, to:r0.to, promotion:r0.promotion});
      if(!mv2) break;
      var worse = VAL[last.piece] < VAL[mv2.piece] && c.moves({verbose:true}).some(function(x){ return x.to === mv2.to && x.captured; });
      if(worse){ c.undo(); break; }
      count(mv2, 99); last = mv2; guard++;
    }
    return {net:net, firstCap:firstCap, sans:sans};
  }
  function sanLine(fen, ucis, max){
    var fp = fenParts(fen), num = fp.full, c = new Chess(fen), out = [], first = true;
    for(var k = 0; k < ucis.length && k < max; k++){
      var u = ucis[k], mv = c.move({from:u.slice(0, 2), to:u.slice(2, 4), promotion:u.slice(4, 5) || undefined});
      if(!mv) break;
      var white = mv.color === 'w', s = '';
      if(white) s = num + '. '; else if(first) s = num + '... ';
      out.push(s + mv.san);
      if(!white) num++;
      first = false;
    }
    return out.join(' ');
  }
  // plies in a forced-mate line: 2n-1 if the side to move is the one mating, 2n if it is being mated
  function mateLine(fen, pv, n, stmMates){ return sanLine(fen, pv, stmMates ? 2 * n - 1 : 2 * n); }

  // =====================================================================
  //  opening book (main lines only)
  // =====================================================================
  var BOOK_SRC = [
    ['e4', "King's Pawn Opening"], ['d4', "Queen's Pawn Opening"], ['c4', 'English Opening'], ['Nf3', 'Reti Opening'],
    ['g3', "King's Fianchetto Opening"], ['b3', 'Nimzo-Larsen Attack'], ['f4', "Bird's Opening"],
    ['e4 e5', 'Open Game (1.e4 e5)'], ['e4 e5 Nf3 Nc6', "King's Knight Opening"],
    ['e4 e5 Nf3 Nc6 Bb5', 'Ruy Lopez'], ['e4 e5 Nf3 Nc6 Bb5 a6', 'Ruy Lopez: Morphy Defence'],
    ['e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3', 'Ruy Lopez: Closed, main line'],
    ['e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Nxe4 d4 b5 Bb3 d5 dxe5 Be6', 'Ruy Lopez: Open Variation'],
    ['e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6 Bxc6 dxc6 dxe5 Nf5 Qxd8 Kxd8', 'Ruy Lopez: Berlin Defence'],
    ['e4 e5 Nf3 Nc6 Bc4', 'Italian Game'], ['e4 e5 Nf3 Nc6 Bc4 Bc5', 'Italian Game: Giuoco Piano'],
    ['e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3', 'Italian Game: Giuoco Pianissimo'], ['e4 e5 Nf3 Nc6 Bc4 Bc5 b4', 'Evans Gambit'],
    ['e4 e5 Nf3 Nc6 Bc4 Nf6', 'Italian Game: Two Knights Defence'], ['e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nxd5 Nxf7', 'Fried Liver Attack'],
    ['e4 e5 Nf3 Nc6 d4 exd4 Nxd4', 'Scotch Game'], ['e4 e5 Nf3 Nc6 d4 exd4 Bc4', 'Scotch Gambit'],
    ['e4 e5 Nf3 Nc6 Nc3 Nf6', 'Four Knights Game'], ['e4 e5 Nf3 Nc6 Nc3 Nf6 Bb5', 'Four Knights: Spanish Variation'],
    ['e4 e5 Nf3 Nf6', "Petrov's Defence"], ['e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5 Bd3 Nc6 O-O Be7', "Petrov's Defence: main line"],
    ['e4 e5 Nf3 d6', 'Philidor Defence'], ['e4 e5 f4', "King's Gambit"], ['e4 e5 f4 exf4', "King's Gambit Accepted"], ['e4 e5 f4 Bc5', "King's Gambit Declined"],
    ['e4 e5 Bc4', "Bishop's Opening"], ['e4 e5 Nc3', 'Vienna Game'], ['e4 e5 d4 exd4 Qxd4', 'Centre Game'],
    ['e4 c5', 'Sicilian Defence'], ['e4 c5 Nf3', 'Sicilian Defence: Open'],
    ['e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6', 'Sicilian: Najdorf'], ['e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6', 'Sicilian: Dragon'],
    ['e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5', 'Sicilian: Sveshnikov'], ['e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nc6', 'Sicilian: Taimanov'],
    ['e4 c5 Nf3 e6 d4 cxd4 Nxd4 a6', 'Sicilian: Kan'], ['e4 c5 c3', 'Sicilian: Alapin'], ['e4 c5 Nc3', 'Sicilian: Closed'],
    ['e4 c5 Nf3 Nc6 Bb5', 'Sicilian: Rossolimo'], ['e4 c5 Nf3 d6 Bb5', 'Sicilian: Moscow Variation'],
    ['e4 e6', 'French Defence'], ['e4 e6 d4 d5', 'French Defence: main line'], ['e4 e6 d4 d5 e5', 'French: Advance Variation'],
    ['e4 e6 d4 d5 Nc3 Bb4', 'French: Winawer'], ['e4 e6 d4 d5 Nd2', 'French: Tarrasch'], ['e4 e6 d4 d5 Nc3 Nf6', 'French: Classical'], ['e4 e6 d4 d5 exd5', 'French: Exchange'],
    ['e4 c6', 'Caro-Kann Defence'], ['e4 c6 d4 d5', 'Caro-Kann: main line'], ['e4 c6 d4 d5 e5', 'Caro-Kann: Advance Variation'],
    ['e4 c6 d4 d5 exd5 cxd5 c4', 'Caro-Kann: Panov Attack'], ['e4 c6 d4 d5 Nc3 dxe4 Nxe4', 'Caro-Kann: Classical'],
    ['e4 d5', 'Scandinavian Defence'], ['e4 d5 exd5 Qxd5 Nc3 Qa5', 'Scandinavian: main line'], ['e4 d5 exd5 Nf6', 'Scandinavian: Modern Variation'],
    ['e4 d6 d4 Nf6 Nc3 g6', 'Pirc Defence'], ['e4 g6', 'Modern Defence'], ['e4 Nf6 e5 Nd5', "Alekhine's Defence"],
    ['d4 d5', 'Closed Game (1.d4 d5)'], ['d4 d5 c4', "Queen's Gambit"], ['d4 d5 c4 e6', "Queen's Gambit Declined"],
    ['d4 d5 c4 e6 Nc3 Nf6 Bg5', "Queen's Gambit Declined: Orthodox"], ['d4 d5 c4 dxc4', "Queen's Gambit Accepted"],
    ['d4 d5 c4 c6', 'Slav Defence'], ['d4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4', 'Slav: main line'],
    ['d4 d5 Bf4', 'London System'], ['d4 d5 Nf3 Nf6 Bf4', 'London System'], ['d4 Nf6 Bf4', 'London System'],
    ['d4 d5 Nf3 Nf6 e3 e6 Bd3', 'Colle System'], ['d4 d5 c4 e6 Nf3 Nf6 g3', 'Catalan Opening'], ['d4 Nf6 c4 e6 g3', 'Catalan Opening'],
    ['d4 Nf6', 'Indian Defence'], ['d4 Nf6 c4 e6', 'Indian Game: e6 systems'], ['d4 Nf6 c4 e6 Nc3 Bb4', 'Nimzo-Indian Defence'],
    ['d4 Nf6 c4 e6 Nf3 b6', "Queen's Indian Defence"], ['d4 Nf6 c4 g6', "King's Indian Defence"], ['d4 Nf6 c4 g6 Nc3 Bg7 e4 d6', "King's Indian: Classical set-up"],
    ['d4 Nf6 c4 g6 Nc3 d5', 'Grunfeld Defence'], ['d4 Nf6 c4 c5', 'Benoni Defence'], ['d4 f5', 'Dutch Defence'],
    ['c4 e5', 'English: Reversed Sicilian'], ['c4 c5', 'English: Symmetrical'], ['c4 Nf6', 'English: Anglo-Indian'],
    ['Nf3 d5', 'Reti: 1...d5'], ['Nf3 Nf6 g3', "Reti / King's Indian Attack set-up"],
    ['e4 e5 Nf3 Nc6 Bc4 Bc5 c3', 'Italian Game: Giuoco Piano, 4.c3'], ['e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4 cxd4 Bb4+', 'Giuoco Piano: Greco main line'],
    ['e4 e5 Nf3 Nc6 Bc4 Bc5 d3', 'Italian Game: Giuoco Pianissimo, 4.d3'], ['e4 e5 Nf3 Nc6 Bc4 Bc5 d3 Nf6 c3 d6 O-O O-O', 'Giuoco Pianissimo: main line'],
    ['e4 e5 Nf3 Nc6 Bc4 Bc5 d3 Nf6 O-O d6 c3', 'Giuoco Pianissimo: 5.O-O'], ['e4 e5 Nf3 Nc6 Bc4 Bc5 O-O Nf6 d3 d6', 'Giuoco Pianissimo: 4.O-O'],
    ['e4 e5 Nf3 Nc6 Bc4 Bc5 Nc3', 'Italian Game: Four Knights set-up'], ['e4 e5 Nf3 Nc6 Bc4 Bc5 Bxf7+', 'Italian Game: Jerome Gambit'],
    ['e4 e5 Nf3 Nc6 Bc4 Nf6 d3', 'Two Knights: 4.d3'], ['e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Na5 Bb5+ c6 dxc6 bxc6 Be2', 'Two Knights: Knight Attack, main line'],
    ['e4 e5 Nf3 Nc6 Bc4 Nf6 d4 exd4 O-O Nxe4', 'Two Knights: Max Lange Attack set-up'], ['e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 Bc5', 'Two Knights: Traxler'],
    ['e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7', 'Ruy Lopez: Closed'], ['e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6', 'Ruy Lopez: Exchange'],
    ['e4 e5 Nf3 Nc6 Bb5 Nf6 d3', 'Ruy Lopez: Berlin, 4.d3'], ['e4 e5 Nf3 Nc6 Bb5 f5', 'Ruy Lopez: Schliemann'],
    ['e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6 e5 Qe7 Qe2 Nd5 c4', 'Scotch: Mieses variation'], ['e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Bc5', 'Scotch: Classical'],
    ['e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6', 'Scotch: Schmidt'], ['e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Qh4', 'Scotch: Steinitz'],
    ['e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5', 'Najdorf: English Attack'], ['e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Bg5 e6', 'Najdorf: 6.Bg5'],
    ['e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be2 e5', 'Najdorf: 6.Be2'], ['e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 g6', 'Sicilian: Accelerated Dragon'],
    ['e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 e6', 'Sicilian: Scheveningen set-up'], ['e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nf6 Nc3 d6', 'Sicilian: Scheveningen'],
    ['e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 d6', 'Sicilian: Classical'], ['e4 c5 Nf3 e6 Nc3', 'Sicilian: Paulsen set-up'],
    ['d4 d5 c4 e6 Nc3 Nf6 Nf3 Be7', "Queen's Gambit Declined: main line"], ['d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3', "Queen's Gambit Declined: Orthodox, main line"],
    ['d4 d5 c4 e6 Nf3 Nf6 Nc3 Be7', "Queen's Gambit Declined: 4.Nf3"], ['d4 d5 c4 c6 Nf3 Nf6 Nc3 e6', 'Semi-Slav Defence'],
    ['d4 d5 Bf4 Nf6 e3 e6 Nf3 Bd6 Bg3 O-O Nbd2 c5 c3 Nc6', 'London System: main line'], ['d4 Nf6 Nf3 g6 Bf4', 'London System: vs King\'s Indian'],
    ['d4 Nf6 Nf3 e6 e3', 'Queen\'s Pawn: 2.Nf3 e6 3.e3'], ['d4 d5 Nf3 Nf6 c4', "Queen's Gambit: 2.Nf3 move order"],
    ['d4 Nf6 c4 e6 Nc3 Bb4 e3 O-O Bd3 d5 Nf3 c5', 'Nimzo-Indian: Rubinstein'], ['d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5', "King's Indian: Classical main line"],
    ['e4 e6 d4 d5 Nc3 Nf6 Bg5 Be7 e5 Nfd7', 'French: Classical main line'], ['e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6', 'Caro-Kann: Classical main line'],
    ['e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3 c6', 'Scandinavian: Qa5 main line']
  ];
  var BOOK = BOOK_SRC.map(function(x){ return {m:x[0].split(' '), n:x[1]}; });
  function bookInfo(A){
    if(A.hdr.FEN || A.hdr.SetUp === '1') return null;
    try{ var oc = (window.__anPlus && window.__anPlus.openingCard) ? window.__anPlus.openingCard(A) : null; if(oc) return oc; }catch(e){ console.error(e); }
    var game = A.moves.map(function(m){ return m.san.replace(/[+#]/g, ''); });
    var bestLen = 0, name = null, nameLen = 0;
    BOOK.forEach(function(L){
      var k = 0;
      while(k < L.m.length && k < game.length && L.m[k] === game[k]) k++;
      if(k > bestLen) bestLen = k;
      if(k === L.m.length && k >= nameLen){ name = L.n; nameLen = k; }
    });
    if(bestLen === 0) return null;
    var lines = [];
    lines.push(name ? 'Opening: ' + name + '.' : 'No named opening matched this game.');
    if(bestLen < A.moves.length){
      var mv = A.moves[bestLen], S = A.stats[bestLen], mine = mv.color === A.me, mn = mvNo(A, bestLen);
      var bad = (S.label === 'inaccuracy' || S.label === 'mistake' || S.label === 'blunder');
      if(mine) lines.push('You left my opening book on move ' + mn + ' with ' + mv.san + '. ' + (bad ? 'The engine rates it as ' + (S.label === 'inaccuracy' ? 'an inaccuracy' : 'a ' + S.label) + ', so this is a good place to review.' : 'The engine is fine with it.'));
      else lines.push('Your opponent left my opening book on move ' + mn + ' with ' + mv.san + '. ' + (bad ? 'The engine rates it as ' + (S.label === 'inaccuracy' ? 'an inaccuracy' : 'a ' + S.label) + ', so you could have punished it.' : 'The engine finds it fine.'));
    } else lines.push('The game stayed inside my opening book to the very end.');
    return {name:name, lines:lines};
  }

  // =====================================================================
  //  PGN + clocks
  // =====================================================================
  function parsePgn(text){
    text = String(text || '').replace(/\r/g, '').trim();
    if(!text) throw new Error('Paste a PGN or upload a .pgn file first.');
    text = text.split(/\n(?=\[Event )/)[0];
    var c = new Chess();
    if(!c.load_pgn(text, {sloppy:true})) throw new Error("I couldn't read that PGN. Check that it is a normal chess game (not a variant).");
    var hdr = c.header() || {}, hist = c.history({verbose:true});
    if(!hist.length) throw new Error('That PGN has no moves.');
    var r = hdr.FEN ? new Chess(hdr.FEN) : new Chess(), fens = [r.fen()], moves = [];
    hist.forEach(function(mv){
      var made = r.move({from:mv.from, to:mv.to, promotion:mv.promotion});
      if(!made) throw new Error('Move ' + mv.san + ' could not be replayed.');
      moves.push(made); fens.push(r.fen());
    });
    // clock tags like { [%clk 0:04:52] }, one per move in order
    var body = text.replace(/^(\s*\[[^\]]*\]\s*\n)+/, ''), clocks = [], re = /\[%clk\s+(\d+):(\d+):(\d+(?:\.\d+)?)\]/g, mm;
    while((mm = re.exec(body)) !== null) clocks.push(parseInt(mm[1], 10) * 3600 + parseInt(mm[2], 10) * 60 + parseFloat(mm[3]));
    return {moves:moves, fens:fens, hdr:hdr, clocks:(clocks.length >= moves.length ? clocks : null)};
  }
  function tcFromText(txt){
    var m = /\[TimeControl\s+"([^"]*)"\]/.exec(txt || '');
    if(!m) return null;
    var v = /^(\d+)(?:\+(\d+))?$/.exec(m[1]);
    if(!v) return {min:0, inc:0};
    return {min:Math.round(parseInt(v[1], 10) / 60 * 100) / 100, inc:parseInt(v[2] || '0', 10)};
  }
  function detectSide(txt){
    var u = (typeof ME !== 'undefined' && ME && ME.username) ? ME.username.toLowerCase() : '';
    if(!u) return null;
    function has(tag){
      var m = new RegExp('\\[' + tag + '\\s+"([^"]*)"\\]').exec(txt || '');
      return !!m && m[1].toLowerCase().split(/[^a-z0-9_]+/).indexOf(u) >= 0;
    }
    var w = has('White'), b = has('Black');
    return (w && !b) ? 'w' : ((b && !w) ? 'b' : null);
  }

  // =====================================================================
  //  analysis build (everything from the player's side)
  // =====================================================================
  function build(parsed, ev, side, tc){
    var A = {moves:parsed.moves, fens:parsed.fens, hdr:parsed.hdr, clocks:parsed.clocks, ev:ev, stats:[], cache:{}, sel:0,
             me:side, opp:side === 'w' ? 'b' : 'w', tc:tc, rep:{theme:{}, sq:{}, tacts:{}, state:null}};
    A.flip = (side === 'b');
    if(!parsed.hdr.FEN && parsed.fens[0].split(' ')[0] === 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR' && Math.abs(ev[0].cp) > 60) ev[0].cp = 25;
    // how many moves of this game are known opening theory
    var bookN = 0; A.book = [];
    try{
      if(!parsed.hdr.FEN && parsed.hdr.SetUp !== '1'){
        var gs = parsed.moves.map(function(mm){ return mm.san.replace(/[+#]/g, ''); });
        if(window.__pawBook){
          for(var z9 = 0; z9 < parsed.moves.length; z9++){ if(window.__pawBook.inBook(parsed.fens[z9 + 1])) bookN = z9 + 1; else break; }
        } else BOOK.forEach(function(L){ var k = 0; while(k < L.m.length && k < gs.length && L.m[k] === gs[k]) k++; if(k > bookN) bookN = k; });
        for(var q = 0; q < bookN; q++){
          var nm = null;
          BOOK.forEach(function(L){
            if(L.m.length !== q + 1) return;
            for(var z = 0; z <= q; z++) if(L.m[z] !== gs[z]) return;
            nm = L.n;
          });
          A.book[q] = {n:(window.__pawBook && window.__pawBook.name(parsed.fens[q + 1])) || nm};
        }
      }
    }catch(e){ bookN = 0; }
    A.moves.forEach(function(m, i){
      var sign = m.color === 'w' ? 1 : -1, cpB = sign * ev[i].cp, cpA = sign * ev[i + 1].cp;
      var loss = Math.max(0, winPct(cpB) - winPct(cpA)), uci = m.from + m.to + (m.promotion || ''), label;
      try{
        var evI = ev[i], tops = [{u:evI.best, cp:evI.cp}].concat((evI.alts || []).map(function(x){ return {u:x.best, cp:x.cp}; }));
        var hit = tops.filter(function(x){ return x.u === uci; })[0];
        if(hit){ var l2 = Math.max(0, winPct(sign * evI.cp) - winPct(sign * hit.cp)); if(l2 < loss) loss = l2; if(!isMate(cpA) && !isMate(sign * hit.cp)) cpA = sign * hit.cp; }
      }catch(e){}
      if(uci === ev[i].best) label = 'best';
      else if(loss < 2) label = 'excellent';
      else if(loss < 5) label = 'good';
      else if(loss < 10) label = 'inaccuracy';
      else if(loss < 15) label = 'mistake';
      else label = 'blunder';
      if(i < bookN && loss < 12) label = 'book';                              // known theory is never an inaccuracy
      else if(label === 'inaccuracy' && i < 20 && loss < 8) label = 'good';   // opening evals are noisy: small differences are just choices
      if((label === 'inaccuracy' || label === 'mistake' || label === 'blunder') && !isMate(cpB)){
        var winning = (cpB >= 400 && cpA >= 250), lost = (cpB <= -400 && cpA <= -250), equalish = (Math.abs(cpB) <= 60 && Math.abs(cpA) <= 120);
        if(winning || lost) label = (label === 'blunder') ? 'inaccuracy' : 'good';   // already decided: nothing here changes the result
        else if(equalish && label === 'inaccuracy') label = 'good';
        else if(i < 20 && label === 'mistake' && loss < 12) label = 'inaccuracy';
      }
      var plus = null;
      try{ plus = window.__anPlus ? window.__anPlus.adjust(A, i, label, loss) : null; }catch(e){ console.error(e); }
      if(plus){ label = plus.label; loss = plus.loss; }
      A.stats.push({uci:uci, cpBefore:cpB, cpAfter:cpA, loss:loss, label:label, phase:features(A.fens[i]).phase});
    });
    A.time = timeReport(A);
    for(var i = 0; i < A.moves.length; i++) if(A.moves[i].color === A.me) explain(A, i);   // in order, so repeats are counted correctly
    return A;
  }
  function myIdx(A){ var r = []; A.moves.forEach(function(m, i){ if(m.color === A.me) r.push(i); }); return r; }
  function mvNo(A, i){ return fenParts(A.fens[i]).full; }

  // ---- time per move ----
  function timeReport(A){
    var tc = A.tc || {min:0, inc:0}, inc = tc.inc || 0, init = (tc.min || 0) * 60;
    var R = {has:false, spent:{}, mine:[], init:init, inc:inc};
    if(A.clocks){
      var firstMine = null;
      for(var q = 0; q < A.moves.length; q++) if(A.moves[q].color === A.me){ firstMine = q; break; }
      if(!init && firstMine !== null) init = Math.round(A.clocks[firstMine] + inc);
      R.init = init;
      var prev = init > 0 ? init : null;
      for(var i = 0; i < A.moves.length; i++){
        if(A.moves[i].color !== A.me) continue;
        var clk = A.clocks[i];
        if(typeof clk !== 'number') continue;
        if(prev !== null){ var t = Math.max(0, prev + inc - clk); R.spent[i] = t; R.mine.push({i:i, t:t}); }
        prev = clk;
      }
      R.last = prev; R.has = R.mine.length > 0;
    }
    var est = init > 0 ? init + 40 * inc : 0;
    R.est = est; R.base = est / 40; R.far = Math.max(R.base * 3, 8);
    return R;
  }
  // do your mistakes come when the clock is low?
  function timePressure(A){
    var out = [];
    if(!A.clocks) return out;
    var init = A.time.init || 0, lowT = Math.max(30, init * 0.1), n = 0, nLow = 0, bad = 0, badLow = 0;
    myIdx(A).forEach(function(i){
      var clk = A.clocks[i];
      if(typeof clk !== 'number') return;
      var lb = A.stats[i].label, isBad = (lb === 'mistake' || lb === 'blunder'), low = clk < lowT;
      n++; if(isBad) bad++;
      if(low){ nLow++; if(isBad) badLow++; }
    });
    if(n < 8) return out;
    var lowTxt = 'under ' + fmtSec(lowT);
    if(nLow >= 3 && badLow >= 2 && badLow >= bad * 0.5)
      out.push(badLow + ' of your ' + plural(bad, 'mistake') + ' and blunders came with ' + lowTxt + ' on the clock, in just ' + nLow + ' of your ' + n + ' moves. Time pressure is costing you points: spend less early.');
    else if(nLow >= 3 && badLow === 0)
      out.push('You played ' + nLow + ' moves with ' + lowTxt + ' left and made no mistakes in them. You keep your head under time pressure.');
    else if(bad >= 2 && badLow === 0)
      out.push('None of your ' + plural(bad, 'big mistake') + ' came in time trouble. They happened with plenty of time, so the fix is a safety check before each move, not speed.');
    return out;
  }
  function timeFindings(A){
    var R = A.time, out = [];
    if(!R.has) return out;
    var m = R.mine, total = m.reduce(function(a, x){ return a + x.t; }, 0), avg = total / m.length;
    out.push('You used about ' + fmtSec(avg) + ' per move on average' + (R.base ? ' (a rough budget for this time control is ' + fmtSec(R.base) + ').' : '.'));
    var open = m.slice(0, 10), openT = open.reduce(function(a, x){ return a + x.t; }, 0);
    if(R.init > 0 && open.length >= 8 && openT > R.init * 0.25) out.push('You spent ' + Math.round(openT / R.init * 100) + '% of your clock in the first ' + open.length + ' moves. Opening moves should be quick; save the time for the middlegame.');
    var long = m.filter(function(x){ return x.t > R.far; });
    long.slice(0, 4).forEach(function(x){
      var lb = A.stats[x.i].label, slip = (lb === 'inaccuracy' || lb === 'mistake' || lb === 'blunder');
      out.push('Move ' + mvNo(A, x.i) + ' (' + A.moves[x.i].san + ') took ' + fmtSec(x.t) + ', far past a sensible limit of about ' + fmtSec(R.far) + (slip ? ', and it still turned out to be a ' + lb + '.' : '. The move was fine, but that is a lot of clock.'));
    });
    if(long.length > 4) out.push('...and ' + (long.length - 4) + ' more very long thinks.');
    if(m.length >= 9){
      var n3 = Math.floor(m.length / 3);
      function av(a){ return a.reduce(function(s, x){ return s + x.t; }, 0) / (a.length || 1); }
      var t1 = av(m.slice(0, n3)), t2 = av(m.slice(n3, 2 * n3)), t3 = av(m.slice(2 * n3));
      if(t1 < t2 && t2 < t3 && t3 >= 1.4 * t1 && t3 > 3) out.push('You slowed down gradually: about ' + fmtSec(t1) + ' per move early, ' + fmtSec(t2) + ' in the middle and ' + fmtSec(t3) + ' late. Decide earlier which positions deserve the long thinks.');
    }
    var fast = m.filter(function(x){ return x.t <= 2 && x.i >= 10 && (A.stats[x.i].label === 'mistake' || A.stats[x.i].label === 'blunder'); });
    if(fast.length) out.push('Quick blunders: ' + fast.slice(0, 3).map(function(x){ return 'move ' + mvNo(A, x.i) + ' (' + A.moves[x.i].san + ')'; }).join(', ') + ' took ' + (fast.length > 1 ? 'almost no time' : fmtSec(fast[0].t)) + '. A 5-second safety check (what can they take or threaten after this?) would have caught it.');
    if(R.init > 0 && R.last < R.init * 0.1) out.push('You finished with only ' + fmtSec(R.last) + ' left. That is time trouble, which is why spending less early matters.');
    timePressure(A).forEach(function(t){ out.push(t); });
    if(out.length === 1) out.push('No time problems stood out. Good clock management.');
    return out;
  }
  function timeSuggest(A){
    var R = A.time, tc = A.tc || {min:0, inc:0};
    var est = R.est || ((tc.min || 0) * 60 + 40 * (tc.inc || 0));
    if(!est) return null;
    var base = est / 40;
    return 'Rough guide for ' + (tc.min || Math.round(R.init / 60)) + '+' + (tc.inc || 0) + ' (about ' + fmtSec(base) + ' per move on average): opening moves up to about ' + fmtSec(Math.max(2, base * 0.5)) +
      ', normal moves about ' + fmtSec(base) + ', and tough decisions up to about ' + fmtSec(Math.max(8, base * 3)) + '. Past that, play your best candidate and move on.';
  }

  // ---- who did what over the game ----
  function stretches(A){
    var mine = myIdx(A), firstBad = null, slips = 0, run = 0, best = {len:0, a:null, b:null}, start = null;
    mine.forEach(function(i){
      var l = A.stats[i].label, clean = !(l === 'inaccuracy' || l === 'mistake' || l === 'blunder');
      if(firstBad === null){ if(l === 'mistake' || l === 'blunder') firstBad = i; else if(l === 'inaccuracy') slips++; }
      if(clean){ if(!run) start = i; run++; if(run > best.len) best = {len:run, a:start, b:i}; } else run = 0;
    });
    return {firstBad:firstBad, slips:slips, best:best};
  }
  function sideSummary(A){
    var counts = {book:0, best:0, excellent:0, good:0, inaccuracy:0, mistake:0, blunder:0}, accSum = 0, n = 0;
    var phases = {opening:[], middlegame:[], endgame:[]}, maxAdv = -99999, maxAdvIdx = -1;
    myIdx(A).forEach(function(i){
      var s = A.stats[i]; n++; counts[s.label]++;
      accSum += Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * s.loss) - 3.1669));
      phases[s.phase].push(s.loss);
      if(s.cpBefore > maxAdv){ maxAdv = s.cpBefore; maxAdvIdx = i; }
    });
    var phaseAvg = {};
    Object.keys(phases).forEach(function(k){ phaseAvg[k] = phases[k].length >= 3 ? phases[k].reduce(function(a, b){ return a + b; }, 0) / phases[k].length : null; });
    return {counts:counts, acc:accSum / (n || 1), n:n, phaseAvg:phaseAvg, maxAdv:maxAdv, maxAdvIdx:maxAdvIdx};
  }
  function coachNotes(A, S){
    var pros = [], cons = [], good = S.counts.best + S.counts.excellent + (S.counts.book || 0), st = stretches(A);
    if(st.firstBad === null) pros.push('No serious mistakes all game. That is rare and worth being proud of.');
    else pros.push('Until move ' + mvNo(A, st.firstBad) + ', nothing went seriously wrong' + (st.slips ? ' (just ' + plural(st.slips, 'small slip') + ', nothing to worry about).' : '.'));
    if(st.best.len >= 6) pros.push('Your cleanest stretch ran from move ' + mvNo(A, st.best.a) + ' to move ' + mvNo(A, st.best.b) + ' (' + st.best.len + ' solid moves in a row).');
    if(S.acc >= 90) pros.push('Excellent accuracy (' + Math.round(S.acc) + '%).');
    else if(S.acc >= 78) pros.push('Solid accuracy (' + Math.round(S.acc) + '%).');
    else if(S.acc >= 62) cons.push('Accuracy of ' + Math.round(S.acc) + '% is inconsistent. A few moves swung the game.');
    else cons.push('Accuracy of ' + Math.round(S.acc) + '% means many moves gave away ground.');
    if(good >= Math.ceil(S.n * 0.6)) pros.push(good + ' of your ' + S.n + ' moves were best or excellent.');
    if(S.counts.blunder > 0) cons.push(plural(S.counts.blunder, 'blunder') + '. Review these first (see the Practice tab).');
    if(S.counts.mistake > 0) cons.push(plural(S.counts.mistake, 'mistake') + ' cost you real advantage.');
    var bestP = null, worstP = null;
    ['opening', 'middlegame', 'endgame'].forEach(function(k){
      var v = S.phaseAvg[k]; if(v === null) return;
      if(bestP === null || v < S.phaseAvg[bestP]) bestP = k;
      if(worstP === null || v > S.phaseAvg[worstP]) worstP = k;
    });
    if(bestP && worstP && bestP !== worstP){
      if(S.phaseAvg[bestP] < 4) pros.push('Your ' + bestP + ' was your strongest phase.');
      if(S.phaseAvg[worstP] >= 6) cons.push('Your ' + worstP + ' was the weak spot. That is where most of the damage happened.');
    }
    var res = A.hdr.Result, won = (res === '1-0' && A.me === 'w') || (res === '0-1' && A.me === 'b');
    if(S.maxAdv >= 300 && !won && res && res !== '*') cons.push('You were clearly winning around move ' + mvNo(A, S.maxAdvIdx) + ' but did not convert. Trade pieces, keep the king safe, avoid tricks.');
    return {pros:pros, cons:cons};
  }

  // =====================================================================
  //  the coach: explaining one of YOUR moves
  // =====================================================================
  var LESSON = {
    hang:'Before every move, run a safety check: after my move, which of my pieces can be captured or attacked? Is each one protected?',
    mate:'Whenever your king is exposed, list every check your opponent has before you move.',
    missed:'Look for forcing moves first: checks, then captures, then threats. They often hide the winning idea.',
    free:'Before you play your plan, ask: is anything of theirs hanging or undefended? Free material beats any plan.',
    opening:'In the opening: develop knights and bishops, fight for the centre, castle early, and avoid moving the same piece twice.',
    king:'Get the king safe before starting an attack.',
    quiet:'Not every mistake is a tactic. Compare candidate moves by what each one improves: your worst-placed piece, king safety, or a pawn break.',
    structure:'Before pushing pawns or moving the pieces next to your king, check what the move weakens: king cover, pawn chains, squares your pieces needed.',
    threat:'Before each move, ask "what is my opponent threatening right now?" and answer that first.',
    endgame:'Endgames are decided by king activity, passed pawns and rook activity. Check all three before every endgame move.',
    conv:'When you are winning: simplify, trade pieces, remove their counterplay, and double-check every move for safety.'
  };
  // how each pattern reads in the report: "You <text> ..."
  var PNAME = {
    hang:'left a piece capturable', mate:'allowed a forced mate', missed:'missed a tactic or a forced win that was on the board',
    opening:'broke opening principles', king:'left your king in the centre too long', structure:'weakened your pawn structure or king cover',
    free:'passed up free material', threat:"ignored your opponent's threat", endgame:'slipped in the endgame', conv:'let a winning position slip'
  };
  // theme[key] is the list of move indexes where that idea caught you out
  function bump(A, key, mi){ var t = A.rep.theme[key] || (A.rep.theme[key] = []); t.push(mi); return t.length; }
  function movesList(A, arr){ return arr.map(function(j){ return mvNo(A, j); }).join(', '); }
  function evLine(S, me){
    var d = S.cpAfter - S.cpBefore, txt = '';
    if(!isMate(S.cpBefore) && !isMate(S.cpAfter)){
      txt = d < -15 ? 'This move cost you about ' + (Math.abs(d) / 100).toFixed(1) + ' pawns.'
          : d > 15 ? 'This move improved your position by about ' + (d / 100).toFixed(1) + ' pawns.'
          : 'Your position stayed about the same.';
    }
    return 'Eval: ' + fw(S.cpBefore, me) + '  ->  ' + fw(S.cpAfter, me) + (txt ? '. ' + txt : '');
  }

  // ---- positional comments on your good moves ----
  function posNotes(m, fA, me, opp){
    var out = [], f = 'abcdefgh'.indexOf(m.to.charAt(0)), rk = parseInt(m.to.charAt(1), 10), rel = me === 'w' ? rk : 9 - rk, dir = me === 'w' ? 1 : -1;
    if(m.piece === 'r'){
      var own = fA[me].pawnsFiles[f], their = fA[opp].pawnsFiles[f];
      if(!own && !their) out.push('Your rook takes an open file, with no pawns in the way. Rooks belong on open files.');
      else if(!own) out.push('Your rook sits on a half-open file, pressing on their pawn.');
      if(rel === 7 && !m.captured) out.push('A rook on the seventh rank attacks pawns and cramps their king.');
    }
    if(m.piece === 'n' && rel >= 4 && rel <= 6){
      var prot = fA[me].pawns.some(function(p){ return Math.abs(p.f - f) === 1 && (8 - p.r) === rk - dir; });
      var chase = fA[opp].pawns.some(function(p){ var pr = 8 - p.r; return Math.abs(p.f - f) === 1 && (me === 'w' ? pr > rk : pr < rk); });
      if(prot && !chase) out.push('Your knight reaches an outpost on ' + m.to + ': a pawn protects it and no enemy pawn can ever chase it away.');
    }
    if(m.piece === 'b' && ['b2', 'g2', 'b7', 'g7'].indexOf(m.to) >= 0 && !m.captured) out.push('The bishop on the long diagonal eyes the whole board and their king.');
    if(m.piece === 'p' && !m.promotion){
      var isP = !fA[opp].pawns.some(function(q){ return Math.abs(q.f - f) <= 1 && (me === 'w' ? (8 - q.r) > rk : (8 - q.r) < rk); });
      if(isP && rel >= 5) out.push('Your passed pawn advances. Passed pawns are strongest with the king or a rook behind them.');
    }
    return out.slice(0, 2);
  }
  // ---- endgame tips for mistakes made in the endgame ----
  function endgameTips(m, fenB, fB, me, opp){
    var tips = [], onlyKP = fB.w.nonPawn === 0 && fB.b.nonPawn === 0, noQ = !/[qQ]/.test(fenB.split(' ')[0]), k = fB[me].king;
    if(k && m.piece !== 'k' && noQ && Math.max(Math.abs(k.f - 3.5), Math.abs(k.r - 3.5)) >= 2.5)
      tips.push('In the endgame your king is a fighting piece. Yours is still on the edge: bring it toward the centre and the pawns.');
    if(fB[opp].passed > 0) tips.push('They have a passed pawn. Stop it early: put your rook behind it or bring your king over to blockade it.');
    else if(fB[me].passed > 0 && m.piece !== 'p') tips.push('You have a passed pawn. Push it with support, or place a rook behind it. Passed pawns win endgames.');
    if(onlyKP) tips.push('In king-and-pawn endings the opposition and counting moves decide everything. Count the race before you move a pawn.');
    else if(fB[me].nonPawn === 5 && fB[opp].nonPawn === 5) tips.push('In rook endings an active rook is worth more than a pawn: keep it behind passed pawns or on the 7th rank, never passive.');
    return tips.slice(0, 2);
  }

  // ---- a move when a forced mate is involved: only mate talk ----
  function explainMate(A, i){
    var m = A.moves[i], S = A.stats[i], me = A.me, fenB = A.fens[i], fenA = A.fens[i + 1], evB = A.ev[i], evA = A.ev[i + 1], label = S.label;
    var tm = A.time.spent[i], why = [], better = null, lessonKey = null, repeat = [], whyTitle = 'The mate', tc = null;
    var bm = (evB.best && evB.best !== S.uci) ? tryMove(fenB, evB.best) : null;
    var mB = S.cpBefore, mA = S.cpAfter, nB = isMate(mB) ? mateN(mB) : 0, nA = isMate(mA) ? mateN(mA) : 0;
    if(m.san.slice(-1) === '#'){
      tc = tacticOf(fenB, m);
      why.push('Checkmate' + (tc ? ': ' + tc.text : '') + '. The game is over.');
    } else if(mB >= 9000 && mA >= 9000){
      if(S.uci === evB.best) why.push('You found the fastest forced mate (mate in ' + nB + '): <span class="an-line">' + esc(mateLine(fenB, evB.pv, nB, true)) + '</span>');
      else if(nA <= nB - 1) why.push('A different way to keep the forced mate, and just as fast (mate in ' + nB + ').');
      else why.push('You still have a forced mate, but this move makes it slower: mate in ' + nA + ' after it, instead of ' + nB + '.');
      if(bm && nA > nB - 1) better = {san:bm.san, text:'It keeps the fastest mate (in ' + nB + ').', line:mateLine(fenB, evB.pv, nB, true)};
    } else if(mB >= 9000){
      why.push('You had a forced checkmate in ' + nB + ' and this move throws it away: <span class="an-line">' + esc(mateLine(fenB, evB.pv, nB, true)) + '</span>');
      tc = mateMoveTactic(fenB, evB.pv);
      if(tc){ why.push('The mate is ' + tc.text + '.'); noteT(A, tc, i); }
      if(bm) better = {san:bm.san, text:'It keeps the forced mate going.', line:mateLine(fenB, evB.pv, nB, true)};
      lessonKey = 'missed';
    } else if(mA >= 9000){
      why.push('Your move creates a forced checkmate in ' + nA + '! <span class="an-line">' + esc(mateLine(fenA, evA.pv, nA, false)) + '</span>');
      tc = mateMoveTactic(fenA, evA.pv);
      if(tc) why.push('It ends with ' + tc.text + '.');
    } else if(mB <= -9000 && mA <= -9000){
      var nBo = mateN(mB), nAo = mateN(mA);
      if(S.uci === evB.best || nAo >= nBo) why.push('You are facing a forced mate (in ' + nBo + ') and this is the most stubborn defence: it delays the mate as long as possible.');
      else why.push('You are facing a forced mate, and this move lets them deliver it faster (in ' + nAo + ' instead of ' + nBo + ').');
      whyTitle = 'The mating attack';
    } else if(mA <= -9000){
      var n2 = mateN(mA);
      why.push('This move allows a forced checkmate in ' + n2 + ': <span class="an-line">' + esc(mateLine(fenA, evA.pv, n2, true)) + '</span>');
      tc = mateMoveTactic(fenA, evA.pv);
      if(tc){ why.push('It ends with ' + tc.text + '.'); noteT(A, tc, i); }
      if(bm) better = {san:bm.san, text:'It avoids the mate.', line:sanLine(fenB, evB.pv, 5)};
      lessonKey = 'mate';
    } else why.push('There is a forced mate on the board here.');
    if(lessonKey){
      var c = bump(A, lessonKey, i);
      if(c >= 2) repeat.push('Pattern: you ' + PNAME[lessonKey] + ' again (earlier on move ' + movesList(A, A.rep.theme[lessonKey].slice(0, -1)) + '). ' + LESSON[lessonKey]);
    }
    return {
      mine:true, mode:'mate', whyTitle:whyTitle, label:label, i:i, title:moveNumText(fenB) + ' ' + m.san,
      evalLine:evLine(S, me), what:'', why:why, better:better, pros:[], cons:[], notes:[], trade:null, missed:null, weakT:null, threat:null, plan:null,
      repeat:repeat, equal:[], posi:[], endTips:[], advice:null,
      engine:evalBlock(fenA, S.cpAfter, me),
      lesson:(lessonKey && (label === 'mistake' || label === 'blunder')) ? LESSON[lessonKey] : null,
      time:(typeof tm === 'number') ? {t:tm, far:tm > A.time.far} : null
    };
  }

  function explainMine(A, i){
    var m = A.moves[i], S = A.stats[i], me = A.me, opp = A.opp, fenB = A.fens[i], fenA = A.fens[i + 1];
    var evB = A.ev[i], evA = A.ev[i + 1], label = S.label;
    if(isMate(S.cpBefore) || isMate(S.cpAfter)) return explainMate(A, i);
    var bad = (label === 'mistake' || label === 'blunder'), minor = (label === 'inaccuracy');
    var mode = bad ? 'full' : (minor ? 'short' : 'ok');
    var d = describeMove(m, i), fA = features(fenA), fB = features(fenB);
    var pros = [], cons = [], why = [], notes = [], repeat = [], lessonKey = null, better = null, plan = null, threat = null, missed = null, trade = null, weakT = null;

    // ----- engine alternative
    var bestSan = null, bm = null, bestInfo = null;
    if(evB.best && evB.best !== S.uci){ bm = tryMove(fenB, evB.best); if(bm){ bestSan = bm.san; bestInfo = pvInfo(fenB, evB.pv, 5, me); } }
    var refInfo = (evA.best && evA.pv.length) ? pvInfo(fenA, evA.pv, 6, me) : null;
    var refLine = (evA.best && evA.pv.length) ? sanLine(fenA, evA.pv, 4) : '';
    var hangNow = []; try{ hangNow = evA.best ? winsFor(fenA, opp) : []; }catch(e){}

    // ----- positives of the move itself
    if(d.tags.indexOf('develop') >= 0) pros.push('Develops a piece, bringing more of your army into the game.');
    if(d.tags.indexOf('castle') >= 0) pros.push('Gets your king safe and activates a rook.');
    if(d.tags.indexOf('centre') >= 0) pros.push('Fights for the centre, where pieces are most active.');
    if(d.tags.indexOf('capture') >= 0){
      try{
        var cAfter = new Chess(fenA), back = cAfter.moves({verbose:true}).filter(function(x){ return x.to === m.to && x.captured; }).length;
        var cnet = VAL[m.captured] - seeGain(cAfter, m.to);
        var prv0 = i >= 1 ? A.moves[i - 1] : null;
        if(prv0 && prv0.color !== m.color && prv0.captured && prv0.to === m.to){
          var tot = cnet - VAL[prv0.captured];
          if(tot === 0) notes.push('Recapture: you take back on ' + m.to + ', so the trade is even. Nobody wins material.');
          else if(tot > 0) pros.push('Recapture that comes out ahead: about ' + plural(tot, 'point') + ' net over the exchange.');
          else cons.push('You take back, but the exchange still costs you about ' + plural(-tot, 'point') + ' net.');
        }
        else if(m.captured === 'p' && m.piece === 'p' && !back) pros.push('Wins a pawn.');
        else if(!back) pros.push('Wins a free ' + NAMES[m.captured] + ' (' + plural(VAL[m.captured], 'point') + ').');
        else if(cnet >= 1) pros.push('Wins material: you take a ' + NAMES[m.captured] + ' and, even if they take back, you stay about ' + plural(cnet, 'point') + ' ahead.');
        else if(cnet === 0) notes.push('An even trade: your ' + NAMES[m.piece] + ' for their ' + NAMES[m.captured] + '. Nobody wins material here, so judge it by what it does to the position.');
        else cons.push('You take a ' + NAMES[m.captured] + ', but they win material back: about ' + plural(Math.abs(cnet), 'point') + ' net.');
      }catch(e){ pros.push('Takes a ' + NAMES[m.captured] + '.'); }
    }
    if(d.tags.indexOf('promo') >= 0) pros.push('Promotes: a huge material gain.');
    if(d.tags.indexOf('mate') >= 0) pros.push('Checkmate!');
    else if(d.tags.indexOf('check') >= 0) pros.push('Gives check, forcing a reply and gaining a tempo.');
    // a tactic you played yourself
    try{
      var myT = tacticOf(fenB, m);
      if(myT && myT.name !== 'back-rank mate' && myT.name !== 'smothered mate' && S.loss < 8) pros.push('You played ' + myT.text + '.');
    }catch(e){}

    // ----- missed free material
    try{
      var wins = winsFor(fenB, me).filter(function(w){ return w.free || w.net >= 2; });
      if(wins.length && !wins.some(function(w){ return w.from === m.from && w.to === m.to; }) && label !== 'best' && S.loss >= 3){
        var w0 = wins[0], thing = (w0.free && w0.piece === 'p') ? 'a free pawn' : (w0.free ? 'a free ' + NAMES[w0.piece] : 'material (a ' + NAMES[w0.piece] + ')');
        missed = 'You could have won ' + thing + ' on ' + w0.to + ' with ' + w0.san + '.';
        var sc = (A.rep.sq[w0.to] = (A.rep.sq[w0.to] || 0) + 1);
        if(sc >= 2) repeat.push('Again, the same chance on ' + w0.to + '. This is the ' + (sc === 2 ? 'second' : sc === 3 ? 'third' : sc + 'th') + ' time you let it go.');
        bump(A, 'free', i); lessonKey = 'free';
      }
    }catch(e){ console.error(e); }

    // ----- trades and piece quality
    try{
      var gave = null, got = null, nxt = A.moves[i + 1], prv = i >= 1 ? A.moves[i - 1] : null;
      if(m.captured && (m.captured === 'n' || m.captured === 'b') && (m.piece === 'n' || m.piece === 'b') && nxt && nxt.captured && nxt.to === m.to){
        gave = quality(fenB, m.from, me); got = quality(fenB, m.to, opp);
      } else if(prv && prv.captured && (prv.captured === 'n' || prv.captured === 'b') && (prv.piece === 'n' || prv.piece === 'b') && m.captured && m.to === prv.to){
        gave = quality(A.fens[i - 1], prv.to, me); got = quality(A.fens[i - 1], prv.from, opp);
      }
      if(gave && got){
        var rank = {bad:0, ok:1, good:2}, bishopsBefore = fB[me].bishops;
        if(rank[gave.q] > rank[got.q]) trade = 'You traded your ' + qWord(gave) + ' for their ' + qWord(got) + '. Usually you want to keep the better piece and swap off the worse one.';
        else if(rank[gave.q] < rank[got.q]) trade = 'Good trade: you gave up your ' + qWord(gave) + ' for their ' + qWord(got) + '.';
        else if(gave.t === 'bishop' && bishopsBefore >= 2) trade = 'You gave up the bishop pair in this trade. Keep it in mind: two bishops are strong in open positions.';
      }
    }catch(e){ console.error(e); }

    // ----- pawn pushes
    if(m.piece === 'p' && !m.captured && !m.promotion){
      var f0 = 'abcdefgh'.indexOf(m.to.charAt(0)), r0 = parseInt(m.to.charAt(1), 10), dir = me === 'w' ? 1 : -1, hits = [];
      [-1, 1].forEach(function(df){
        var ff = f0 + df, rr = r0 + dir; if(ff < 0 || ff > 7 || rr < 1 || rr > 8) return;
        var q = new Chess(fenA).get('abcdefgh'[ff] + rr);
        if(q && q.color === opp && q.type !== 'p') hits.push('the ' + NAMES[q.type] + ' on ' + 'abcdefgh'[ff] + rr);
      });
      if(hits.length) notes.push('The pawn push attacks ' + hits.join(' and ') + ', so it has to move.');
      if(fA[me].passed > fB[me].passed) notes.push('It creates a passed pawn: nothing of theirs can stop it with pawns alone.');
      var nw1 = newWeak(fenB, fenA, me); if(nw1) notes.push('Structure: ' + nw1 + '.');
      if(fA[me].shield < fB[me].shield && fA.total >= 25) notes.push('It thins the pawn shield in front of your king.');
      var relRank = me === 'w' ? r0 : 9 - r0;
      if(relRank >= 4 && f0 >= 2 && f0 <= 5 && !hits.length) notes.push('It gains space in the centre.');
      if(hangNow.some(function(h){ return h.to === m.to; })) notes.push('Careful: the pawn on ' + m.to + ' can be picked off.');
    }
    // ----- weak pawns of theirs that you now target
    try{
      var tgt = weakPawns(fenA, opp), before = {};
      capsFor(fenB, me).forEach(function(x){ before[x.from + x.to] = 1; });
      capsFor(fenA, me).forEach(function(x){
        if(weakT || x.captured !== 'p' || before[x.from + x.to]) return;
        if(!(x.from === m.to || onLine(x.from, x.to, m.from))) return;     // only the moved piece, or a piece it really uncovered, can be the new attacker
        var hit = tgt.filter(function(t){ return t.sq === x.to; })[0];
        if(hit) weakT = 'Your ' + NAMES[x.piece] + ' now eyes their ' + hit.why + ' pawn on ' + hit.sq + '. Weak pawns are targets: keep pressing on them.';
      });
    }catch(e){}
    // ----- king safety
    var __wasChk = false; try{ __wasChk = new Chess(fenB).in_check(); }catch(e){}
    if(d.tags.indexOf('kingmove') >= 0 && fB.total >= 25 && !__wasChk) cons.push('Moving the king around before the endgame costs safety.');
    if(m.piece !== 'p' && fA[me].shield < fB[me].shield && fA.total >= 25) cons.push('Loosens the pawns around your king.');

    // ----- more coaching points (each one is computed from the position, never guessed)
    try{
      var extra = [], rel = function(sq){ var rk = parseInt(sq.charAt(1), 10); return me === 'w' ? rk : 9 - rk; };
      var cA = new Chess(fenA), FL = 'abcdefgh', mf = FL.indexOf(m.to.charAt(0));
      var isCastle = d.tags.indexOf('castle') >= 0;
      // 1. rescued a piece that was under attack
      var thrB = winsFor(fenB, opp).filter(function(x){ return x.to === m.from; });
      if(thrB.length && !m.captured && !isCastle && !winsFor(fenA, opp).some(function(x){ return x.to === m.to; }))
        extra.push('Saves your ' + NAMES[m.piece] + ': it was under attack on ' + m.from + ' and is safe on ' + m.to + '.');
      // 2. a real threat (not already described as a fork)
      if(!m.captured && !isCastle && (typeof myT === 'undefined' || !myT)){
        var tempo = capsFor(fenA, me).filter(function(x){
          if(x.from !== m.to || !x.captured || x.captured === 'k' || VAL[x.captured] < 3) return false;
          var c5 = new Chess(flipTurn(fenA, me)); c5.move({from:x.from, to:x.to, promotion:x.promotion});
          return VAL[x.captured] - seeGain(c5, x.to) >= 1;
        });
        if(tempo.length) extra.push('Makes a threat: your ' + NAMES[m.piece] + ' now attacks their ' + NAMES[tempo[0].captured] + ' on ' + tempo[0].to + ', so they have to deal with it.');
      }
      // 3. knight outpost: protected by a pawn, and no enemy pawn can ever challenge it
      if(m.piece === 'n' && rel(m.to) >= 4 && rel(m.to) <= 6){
        var orr = parseInt(m.to.charAt(1), 10), odir = me === 'w' ? 1 : -1;
        var backed = [-1, 1].some(function(df){ var fl = FL.charAt(mf + df); if(!fl) return false; var q1 = cA.get(fl + (orr - odir)); return !!q1 && q1.type === 'p' && q1.color === me; });
        var kicked = [-1, 1].some(function(df){
          if(mf + df < 0 || mf + df > 7) return false;
          for(var r2 = orr + odir; r2 >= 1 && r2 <= 8; r2 += odir){ var q2 = cA.get(FL.charAt(mf + df) + r2); if(q2 && q2.type === 'p' && q2.color === opp) return true; }
          return false;
        });
        if(backed && !kicked) extra.push('Your knight reaches an outpost on ' + m.to + ': a pawn protects it and no enemy pawn can ever chase it away. A knight like this is very hard to dislodge.');
      }
      // 4. rooks: open files and the 7th rank
      if(m.piece === 'r' && m.from.charAt(0) !== m.to.charAt(0)){
        if(fA[me].pawnsFiles[mf] === 0 && fA[opp].pawnsFiles[mf] === 0) extra.push('Your rook takes the open ' + m.to.charAt(0) + '-file: with no pawns in the way it can invade their position.');
        else if(fA[me].pawnsFiles[mf] === 0 && fA[opp].pawnsFiles[mf] > 0 && fA.phase !== 'opening') extra.push('Your rook goes to a half-open file (none of your pawns on it), where it presses on their pawn.');
      }
      if(m.piece === 'r' && rel(m.to) === 7 && !m.captured){
        var pawns7 = 0; for(var f7 = 0; f7 < 8; f7++){ var q7 = cA.get(FL.charAt(f7) + m.to.charAt(1)); if(q7 && q7.type === 'p' && q7.color === opp) pawns7++; }
        if(pawns7 >= 1) extra.push('A rook on the 7th rank attacks their pawns from behind and cramps their king. This is one of the strongest places for a rook.');
      }
      // 5. passed pawns
      if(!(m.piece === 'p' && !m.captured) && fA[me].passed > fB[me].passed) extra.push('You now have a passed pawn: no enemy pawn can stop it by pawns alone, so it is a long-term asset.');
      if(fA[opp].passed > fB[opp].passed) cons.push('This leaves your opponent with a passed pawn.');
      var nw2 = (m.piece === 'p' && m.captured) ? newWeak(fenB, fenA, me) : null; if(nw2) notes.push('After the capture ' + nw2 + '.');
      // 6. endgame ideas
      if(fA.phase === 'endgame'){
        if(m.piece === 'k' && !isCastle) extra.push('In the endgame the king is a fighting piece, so bringing it toward the centre and the pawns is right.');
        if(m.piece === 'p' && !m.captured){
          var pr = parseInt(m.to.charAt(1), 10), pd = me === 'w' ? 1 : -1, free = true;
          [-1, 0, 1].forEach(function(df){
            if(mf + df < 0 || mf + df > 7) return;
            for(var r3 = pr + pd; r3 >= 1 && r3 <= 8; r3 += pd){ var q3 = cA.get(FL.charAt(mf + df) + r3); if(q3 && q3.type === 'p' && q3.color === opp) free = false; }
          });
          if(free) extra.push('Pushing a passed pawn in the endgame forces their pieces to stop it, which ties them down.');
        }
      }
      extra.slice(0, 2).forEach(function(t){ pros.push(t); });
    }catch(e){ console.error('coaching points failed', e); }

    // ----- why a mistake is a mistake
    if(bad || minor){
      if(bad){
        if(refInfo && refInfo.net <= -2){
          var fc = refInfo.firstCap, sentence;
          if(fc && fc.color !== me && fc.ply === 0 && fc.to === m.to){
            var h0 = hangNow.filter(function(x){ return x.to === m.to; })[0];
            sentence = 'The ' + NAMES[m.piece] + ' you just moved to ' + m.to + ' can be taken by ' + fc.san + (h0 && h0.free ? ', and nothing protects it.' : ', and the trade does not work out for you.');
          } else if(fc && fc.color !== me) sentence = 'After ' + (refInfo.sans[0] || 'their best reply') + ', you lose a ' + NAMES[fc.captured] + ' on ' + fc.to + '.';
          else sentence = 'The forcing continuation leaves you down material.';
          why.push(sentence + ' In the engine line you end up about ' + plural(Math.abs(refInfo.net), 'point') + ' down: <span class="an-line">' + esc(refLine) + '</span>');
          cons.push('Loses material (about ' + plural(Math.abs(refInfo.net), 'point') + ').'); lessonKey = lessonKey || 'hang';
        } else if(hangNow.length && hangNow[0].net >= 2){
          var hg = hangNow[0];
          why.push('It leaves your ' + NAMES[hg.piece] + ' on ' + hg.to + ' en prise: ' + hg.san + ' wins it' + (hg.free ? ' for free.' : ' favourably.'));
          cons.push('Leaves a piece capturable.'); lessonKey = lessonKey || 'hang';
        }
        // the tactic they now have
        try{
          var fm = evA.best ? tryMove(fenA, evA.best) : null;
          if(fm){
            var tcF = tacticOf(fenA, fm);
            if(tcF){ why.push('Their best reply, ' + fm.san + ', is ' + tcF.text + '.'); noteT(A, tcF, i); }
          }
        }catch(e){}
        // threat you missed: they were already threatening what they then took
        try{
          var thr = winsFor(fenB, opp), nx = A.moves[i + 1];
          if(nx && nx.captured){
            var t0 = thr.filter(function(x){ return x.from === nx.from && x.to === nx.to; })[0];
            if(t0) threat = 'Your opponent was already threatening ' + t0.san + ' (winning your ' + NAMES[t0.piece] + ') before your move, and your move did not deal with it.';
          }
        }catch(e){}
        // the tactic you missed
        var tcM = bm ? tacticOf(fenB, bm) : null;
        if(bm && bestInfo && bestInfo.net >= 2){
          var how = bm.captured ? ' (a capture)' : (/[+#]/.test(bestSan) ? ' (a check)' : '');
          why.push('You missed a tactic: ' + bestSan + (tcM ? ', ' + tcM.text : how) + '. It wins about ' + plural(bestInfo.net, 'point') + ' of material.');
          cons.push(tcM ? 'Missed a ' + tcM.name + '.' : 'Missed a material-winning tactic.'); lessonKey = lessonKey || 'missed';
          noteT(A, tcM, i);
        } else if(bm && tcM && S.loss >= 10){
          why.push('You missed a tactic: ' + bestSan + ' is ' + tcM.text + '.');
          cons.push('Missed a ' + tcM.name + '.'); lessonKey = lessonKey || 'missed';
          noteT(A, tcM, i);
        }
        // their plan after your move
        if(refInfo && refInfo.sans.length >= 3 && refInfo.sans[0].charAt(0) === refInfo.sans[2].charAt(0) && /[NBRQK]/.test(refInfo.sans[0].charAt(0)))
          plan = 'Your opponent wants ' + refInfo.sans[0] + ', then ' + refInfo.sans[2] + '. Their pieces are heading somewhere useful while yours are not.';
        else if(refInfo && refInfo.sans.length) plan = 'Your opponent\'s best answer is ' + refInfo.sans[0] + '.';
      }
      var prev = i >= 2 ? A.moves[i - 2] : null;
      if(i < 24 && d.tags.indexOf('capture') < 0){
        if(d.tags.indexOf('earlyqueen') >= 0){ why.push('Bringing the queen out this early invites attacks that gain them developing moves for free.'); cons.push('Early queen sortie: loses time.'); lessonKey = lessonKey || 'opening'; }
        else if(prev && prev.piece === m.piece && prev.to === m.from && m.piece !== 'p' && m.piece !== 'k'){ why.push('You moved the same ' + NAMES[m.piece] + ' twice in the opening instead of developing a new piece.'); cons.push('Moves the same piece twice.'); lessonKey = lessonKey || 'opening'; }
      }
      var rights = fenParts(fenA).rights, mine = me === 'w' ? /[KQ]/.test(rights) : /[kq]/.test(rights);
      if(!why.length && fenParts(fenB).full >= 9 && mine && d.tags.indexOf('castle') < 0 && fA.total >= 30){
        why.push('Your king is still in the centre and you can still castle. Getting it to safety first usually comes before other plans.');
        cons.push('King stays in the centre.'); lessonKey = lessonKey || 'king';
      }
      if(!why.length){
        var bits = [];
        var nw3 = newWeak(fenB, fenA, me); if(nw3) bits.push(nw3);
        if(fA[me].shield < fB[me].shield && fA.total >= 25) bits.push('it thins the pawn shield in front of your king');
        if(fB[me].bishops >= 2 && fA[me].bishops < 2) bits.push('it gives up the bishop pair');
        if(fA[me].centre < fB[me].centre) bits.push('it gives up a central pawn');
        if(bits.length){
          why.push('There is no immediate tactic, but ' + bits.join(' and ') + '.'); cons.push(cap(bits[0]) + '.');
          lessonKey = 'structure';
        } else {
          why.push('Nothing concrete goes wrong here: no piece is lost and no tactic appears. The engine just rates ' + (bestSan ? bestSan : 'another move') + ' a little higher (' + fw(S.cpBefore, me) + ' before your move, ' + fw(S.cpAfter, me) + ' after).');
          if(bm){ var bd3 = describeMove(bm, i); notes.push('The idea behind ' + bestSan + ': it ' + bd3.text + '.'); }
          cons.push('A slightly less precise choice than ' + (bestSan || 'the engine move') + ', but not a real error.');
          lessonKey = 'quiet';
        }
      }
    } else {
      if(label === 'book'){
        var bw = null;
        try{ bw = window.__anPlus ? window.__anPlus.bookWhy(A, i) : null; }catch(e){}
        why.push.apply(why, bw || ['This is a known opening move.']);
      }
      else if(label === 'best') why.push("This is the engine's top choice.");
      else if(label === 'excellent') why.push("Practically as good as the engine's favourite.");
      else why.push('A fine move. A slightly stronger option existed, but nothing is lost.');
      if(d.tags.indexOf('mate') >= 0) why.push('It ends the game.');
      else if(S.cpAfter >= 250) why.push('You are clearly better here, so the job is to keep control and avoid tricks.');
      else if(S.cpAfter <= -150) why.push('The position is difficult, but this is a resilient defence.');
      else if(Math.abs(S.cpAfter) < 60) why.push('The game stays balanced.');
      if(m.captured && VAL[m.captured] === VAL[m.piece] && S.cpAfter >= 150) pros.push('An even trade when ahead: simplifying makes the advantage easier to convert.');
      if(!pros.length && !notes.length){
        var wl = null;
        try{ wl = window.__anPlus ? window.__anPlus.whyList(A, i, S.uci, [S.uci].concat(evA.pv || [])) : null; }catch(e){}
        if(wl && wl.length) wl.forEach(function(t){ pros.push(t); });
        else pros.push('Keeps your position healthy and your pieces coordinated.');
      }
      if(S.cpAfter <= -150) cons.push('Even with good moves, the position is worse for you.');
    }

    // ----- what you should have played
    if(bm && S.loss >= 2){
      var bd = describeMove(bm, i), reason;
      if(bestInfo && bestInfo.net >= 1) reason = 'It wins about ' + plural(bestInfo.net, 'point') + ' of material by force.';
      else if(bd.tags.indexOf('check') >= 0 || bd.tags.indexOf('mate') >= 0) reason = 'The check gains time and pushes them back.';
      else if(bd.tags.indexOf('castle') >= 0) reason = 'It gets your king safe first.';
      else if(bd.tags.indexOf('develop') >= 0) reason = m.piece === 'q' ? 'Minor pieces come out before the queen, so the queen does not become a target.' : 'It adds a new piece to the game instead of moving one you already have.';
      else if(bd.tags.indexOf('centre') >= 0) reason = 'It takes the centre.';
      else reason = 'It keeps the eval at ' + fw(S.cpBefore, me) + ' where your move dropped it to ' + fw(S.cpAfter, me) + '.';
      var wt = null;
      try{ wt = window.__anPlus ? window.__anPlus.whyText(A, i, evB.best, evB.pv) : null; }catch(e){}
      better = {san:bestSan, text:wt || (cap(bd.text) + '. ' + reason), line:sanLine(fenB, evB.pv, 5)};
    }

    // ----- several equally good moves (only when the engine really rates them the same)
    var equal = [];
    try{
      if(evB.alts && evB.alts.length && evB.best && !isMate(evB.cp)){
        var setU = [evB.best];
        evB.alts.forEach(function(a){ if(a.best && !isMate(a.cp) && Math.abs(a.cp - evB.cp) <= 15 && setU.indexOf(a.best) < 0) setU.push(a.best); });
        if(setU.length >= 2){
          setU.slice(0, 3).forEach(function(u){
            var mv2 = tryMove(fenB, u);
            if(mv2){
              var pvU = (u === evB.best) ? evB.pv : ((evB.alts.filter(function(a){ return a.best === u; })[0] || {}).pv || [u]);
              var wtU = null;
              try{ wtU = window.__anPlus ? window.__anPlus.whyText(A, i, u, pvU) : null; }catch(e){}
              equal.push({san:mv2.san, text:wtU || (cap(describeMove(mv2, i).text) + '.'), played:u === S.uci});
            }
          });
          if(equal.length < 2) equal = [];
        }
      }
    }catch(e){ console.error(e); }

    // ----- positional comments (good moves) and endgame tips (slips in the endgame)
    var posi = (!bad && !minor) ? posNotes(m, fA, me, opp) : [];
    var endTips = ((bad || minor) && S.phase === 'endgame') ? endgameTips(m, fenB, fB, me, opp) : [];

    // ----- converting an advantage / defending a worse position
    var st = S.cpBefore >= 250 ? 'win' : (S.cpBefore <= -250 ? 'lose' : null), advice = null;
    var first = (A.rep.state !== st);
    A.rep.state = st;
    if(st && (first || bad)){
      var al = [], atitle = st === 'win' ? 'Converting your advantage' : 'Defending a worse position';
      if(st === 'win'){
        if(bad) al.push('You were winning here, so this is exactly the moment to slow down: when ahead, every move must be safe first.');
        if(fB[me].mat > fB[opp].mat && fB.total >= 12) al.push('You are ahead in material: trade pieces (not pawns) to simplify. Fewer pieces means fewer tricks for them.');
        else if(fB[me].passed > 0) al.push('You have a passed pawn. Push it with support from your king or a rook behind it.');
        else al.push('The engine says you are winning. Keep your king safe, trade their active pieces and avoid unnecessary risks.');
        try{
          var oppMoves = new Chess(fenA).moves().length;
          if(fA.total <= 12 && oppMoves <= 3) al.push('Watch out for stalemate: after this move they have only ' + plural(oppMoves, 'legal move') + '. Make sure your next move still leaves them one.');
        }catch(e){}
        if(bad){ bump(A, 'conv', i); }
      } else {
        if(fB[me].mat < fB[opp].mat) al.push('You are behind: avoid trades, keep your pieces on, and look for counterplay (checks, a passed pawn, an attack on their king).');
        else al.push('You are worse: look for the most resilient move. Keep every piece protected, make threats of your own, and aim for a fortress or perpetual check.');
      }
      advice = {title:atitle, lines:al};
    }

    // ----- repeated themes (real patterns: same kind of error, with the earlier move numbers)
    if(lessonKey && lessonKey !== 'free' && lessonKey !== 'quiet'){
      var c = bump(A, lessonKey, i);
      if(c >= 2) repeat.push('Pattern: you ' + PNAME[lessonKey] + ' again (earlier on move ' + movesList(A, A.rep.theme[lessonKey].slice(0, -1)) + '). ' + LESSON[lessonKey]);
    }
    if(threat){
      var ct = bump(A, 'threat', i);
      if(ct >= 2) repeat.push('Pattern: you ' + PNAME.threat + ' again (earlier on move ' + movesList(A, A.rep.theme.threat.slice(0, -1)) + '). ' + LESSON.threat);
    }
    if(endTips.length){
      var ce = bump(A, 'endgame', i);
      if(ce >= 2) repeat.push('Pattern: you ' + PNAME.endgame + ' again (earlier on move ' + movesList(A, A.rep.theme.endgame.slice(0, -1)) + '). ' + LESSON.endgame);
    }
    var tm = A.time.spent[i];
    return {
      mine:true, mode:mode, label:label, i:i, whyTitle:'Why it is a turning point',
      title:moveNumText(fenB) + ' ' + m.san,
      evalLine:evLine(S, me),
      what:'This move ' + d.text + '.',
      why:why, better:better, pros:pros, cons:cons, notes:notes, trade:trade, missed:missed, weakT:weakT, threat:threat, plan:plan, repeat:repeat,
      equal:equal, posi:posi, endTips:endTips, advice:advice,
      engine:evalBlock(fenA, S.cpAfter, A.me),
      lesson:(bad && lessonKey) ? LESSON[lessonKey] : null,
      time:(typeof tm === 'number') ? {t:tm, far:tm > A.time.far} : null
    };
  }

  // an opponent's move: what it does, how good it was, what it threatens (only things the engine can back up)
  function explainOpp(A, i){
    var m = A.moves[i], S = A.stats[i], fenB = A.fens[i], fenA = A.fens[i + 1], me = A.me, opp = A.opp;
    var evA = A.ev[i + 1], evB = A.ev[i], cpA = pov(A, evA.cp), cpB = pov(A, evB.cp);
    var d = describeMove(m, i), lines = [], title = moveNumText(fenB) + ' ' + m.san, what = 'Your opponent ' + d.text + '.';
    // forced mate: only mate talk
    if(isMate(cpA) || isMate(cpB)){
      if(m.san.slice(-1) === '#') lines.push('That is checkmate.');
      else if(cpA >= 9000){ var n1 = mateN(cpA); lines.push('Their move allows you a forced mate in ' + n1 + ': ' + mateLine(fenA, evA.pv, n1, false)); }
      else if(cpA <= -9000){ var n2 = mateN(cpA); lines.push('After this move your opponent has a forced mate in ' + n2 + (evA.pv.length ? ': ' + mateLine(fenA, evA.pv, n2, true) : '') + '.'); }
      else lines.push('There is a forced mate on the board.');
      return {mine:false, title:title, what:what, lines:lines, tip:null, engine:evalBlock(fenA, cpA, me)};
    }
    var fA = features(fenA), fB = features(fenB), purpose = [];
    try{
      var tc = tacticOf(fenB, m);
      if(tc) purpose.push('It is ' + tc.text + '.');
      var thr = winsFor(fenA, opp).filter(function(w){ return w.net >= 2; });
      if(thr.length) purpose.push('It threatens ' + thr[0].san + ', winning your ' + NAMES[thr[0].piece] + '. Deal with that.');
      else if(d.tags.indexOf('check') >= 0) purpose.push('It is check, so you must answer it first.');
      var f = 'abcdefgh'.indexOf(m.to.charAt(0));
      if(m.piece === 'r' && !fA[opp].pawnsFiles[f] && !fA[me].pawnsFiles[f]) purpose.push('Their rook takes an open file.');
      if(fA[opp].passed > fB[opp].passed) purpose.push('It creates a passed pawn for them.');
      if(fA[opp].shield < fB[opp].shield && fA.total >= 25) purpose.push('It loosens the pawns around their own king, which gives you something to aim at.');
    }catch(e){ console.error(e); }
    purpose.slice(0, 2).forEach(function(t){ lines.push(t); });
    var gap = Math.abs(S.cpAfter - S.cpBefore) / 100;
    if(S.label === 'book') lines.push('A known opening move' + ((A.book && A.book[i] && A.book[i].n) ? ' (' + A.book[i].n + ')' : '') + '.');
    else if(S.label === 'best') lines.push("The engine agrees with this move.");
    else if(S.label === 'excellent' || S.label === 'good') lines.push("A solid move, close to the engine's favourite.");
    else if(S.label === 'inaccuracy') lines.push('A small inaccuracy: it costs them about ' + gap.toFixed(1) + ' pawns.');
    else {
      lines.push('They slipped: this move costs them about ' + gap.toFixed(1) + ' pawns.');
      var rep = evA.best ? tryMove(fenA, evA.best) : null;
      if(rep){ lines.push('Your best reply now is ' + rep.san + '.'); lines.push('Line: ' + sanLine(fenA, evA.pv, 4)); }
    }
    return {mine:false, title:title, what:what, lines:lines, tip:null, engine:evalBlock(fenA, cpA, me)};
  }
  function explain(A, i){
    if(A.cache[i]) return A.cache[i];
    var out, mine = A.moves[i].color === A.me;
    try{ out = mine ? explainMine(A, i) : explainOpp(A, i); }
    catch(e){
      console.error('explain failed', e);
      out = mine ? {mine:true, mode:'ok', whyTitle:'', label:A.stats[i].label, title:A.moves[i].san, evalLine:'', what:'', why:["I couldn't build the full explanation for this move (" + e.message + ')'], better:null, pros:[], cons:[], notes:[], repeat:[], equal:[], posi:[], endTips:[], advice:null, engine:[], lesson:null, time:null}
                 : {mine:false, title:A.moves[i].san, what:'', lines:[], tip:null, engine:[]};
    }
    A.cache[i] = out;
    return out;
  }

  // =====================================================================
  //  UI state
  // =====================================================================
  var A = null, running = false, cancelFlag = false, activeTab = 'board', PR = null;
  var formSide = null, formMin = 5, formInc = 3, sideManual = false, tcManual = false, tcFilled = false;
  var screen = document.createElement('div');
  screen.id = 'screen-analyze'; screen.style.display = 'none';
  document.querySelector('.wrap').appendChild(screen);

  var nav = document.getElementById('navbar');
  var link = document.createElement('a');
  link.dataset.nav = 'analyze'; link.textContent = 'Analyze';
  nav.insertBefore(link, nav.querySelector('[data-nav="leaderboard"]'));
  link.onclick = function(){
    var inGame = document.getElementById('screen-game').style.display === 'block' && gameState && gameState.status === 'active';
    if(inGame && !confirm('Your clock keeps running while you are away. Leave the game view?')) return;
    stopPoll(); renderAnalyze();
  };
  var prevShow = window.showScreen;
  window.showScreen = function(n){
    prevShow(n);
    screen.style.display = (n === 'analyze') ? 'block' : 'none';
    if(n === 'analyze') nav.querySelectorAll('[data-nav]').forEach(function(a){ a.classList.toggle('active', a.dataset.nav === 'analyze'); });
    else if(running) cancelFlag = true;
  };
  function speedMs(){ var v = 800; try{ v = parseInt(localStorage.getItem('pawniac-analyze-ms'), 10) || 800; }catch(e){} return v; }

  function renderAnalyze(){
    showScreen('analyze');
    if(!document.getElementById('anInputWrap')) screen.innerHTML = '<div id="anInputWrap"></div><div id="anRes"></div>';
    renderInputBox();
    if(A) renderResults(); else document.getElementById('anRes').innerHTML = '';
  }

  function refreshForm(){
    var w = document.getElementById('anSideW'), b = document.getElementById('anSideB');
    if(w) w.classList.toggle('active', formSide === 'w');
    if(b) b.classList.toggle('active', formSide === 'b');
    var mi = document.getElementById('anTcMin'), ii = document.getElementById('anTcInc'), note = document.getElementById('anTcNote');
    if(mi && document.activeElement !== mi) mi.value = formMin;
    if(ii && document.activeElement !== ii) ii.value = formInc;
    if(note) note.textContent = tcFilled ? 'filled in from the game' : '';
  }
  function autoFill(text){
    if(!sideManual){ var s = detectSide(text); if(s) formSide = s; }
    if(!tcManual){ var t = tcFromText(text); if(t){ formMin = t.min; formInc = t.inc; tcFilled = true; } }
    refreshForm();
  }

  function renderInputBox(){
    var wrap = document.getElementById('anInputWrap');
    if(!wrap) return;
    if(A){
      var title = (A.hdr.White || 'White') + ' vs ' + (A.hdr.Black || 'Black') + (A.hdr.Result ? ' \u00b7 ' + A.hdr.Result : '');
      wrap.innerHTML = '<div class="card an-compact"><span>Analyzing as ' + (A.me === 'w' ? 'White' : 'Black') + ': <b>' + esc(title) + '</b></span><button class="secondary" id="anNewBtn">New analysis</button></div>';
      document.getElementById('anNewBtn').onclick = function(){ A = null; PR = null; activeTab = 'board'; renderInputBox(); document.getElementById('anRes').innerHTML = ''; };
      return;
    }
    var ms = speedMs();
    wrap.innerHTML =
      '<div class="card an-in"><h2>Analyze a game</h2>' +
        '<p class="desc">Paste a PGN or upload a .pgn file. A chess engine runs in your browser (free, nothing is uploaded). The whole report is written for you, as a coach would: your mistakes, your missed chances, your clock use, then a short practice round on your errors.</p>' +
        '<textarea id="anPgn" placeholder="1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 ..."></textarea>' +
        '<div class="an-row"><span class="hint" style="min-width:92px;">You played:</span><div class="tcbtn an-sidebtn" id="anSideW">White</div><div class="tcbtn an-sidebtn" id="anSideB">Black</div></div>' +
        '<div class="an-row"><span class="hint" style="min-width:92px;">Time control:</span><input type="number" id="anTcMin" min="0" max="180" step="any"><span class="hint">min +</span><input type="number" id="anTcInc" min="0" max="60"><span class="hint">sec per move</span><span class="hint" id="anTcNote"></span></div>' +
        '<div class="hint" style="margin-top:4px;">0 min means unknown or no clock. Time per move is read from the [%clk] tags in the PGN (Lichess and Chess.com exports have them).</div>' +
        '<div class="an-row">' +
          '<button id="anGo">Analyze</button><button class="secondary" id="anFileBtn">Upload .pgn</button>' +
          '<input type="file" id="anFile" accept=".pgn,.txt,text/plain" style="display:none;">' +
          '<select id="anSpeed" aria-label="Analysis depth"><option value="300"' + (ms === 300 ? ' selected' : '') + '>Fast (0.35 s per move)</option><option value="800"' + (ms === 800 ? ' selected' : '') + '>Balanced (0.5 s per move)</option><option value="2000"' + (ms === 2000 ? ' selected' : '') + '>Deep (0.7 s per move)</option></select>' +
        '</div><div id="anProg"></div></div>';
    refreshForm();
    document.getElementById('anSideW').onclick = function(){ formSide = 'w'; sideManual = true; refreshForm(); };
    document.getElementById('anSideB').onclick = function(){ formSide = 'b'; sideManual = true; refreshForm(); };
    document.getElementById('anTcMin').oninput = function(){ formMin = Math.max(0, parseFloat(this.value) || 0); tcManual = true; tcFilled = false; refreshForm(); };
    document.getElementById('anTcInc').oninput = function(){ formInc = Math.max(0, parseInt(this.value, 10) || 0); tcManual = true; tcFilled = false; refreshForm(); };
    document.getElementById('anPgn').oninput = function(){ autoFill(this.value); };
    document.getElementById('anGo').onclick = function(){ start(document.getElementById('anPgn').value); };
    var fb = document.getElementById('anFileBtn'), fi = document.getElementById('anFile');
    fb.onclick = function(){ fi.click(); };
    fi.onchange = function(){
      var f = fi.files && fi.files[0]; fi.value = '';
      if(!f) return;
      var r = new FileReader();
      r.onload = function(){ document.getElementById('anPgn').value = r.result; autoFill(r.result); };
      r.readAsText(f);
    };
    document.getElementById('anSpeed').onchange = function(){ try{ localStorage.setItem('pawniac-analyze-ms', this.value); }catch(e){} };
  }
  function setProg(html, pct){
    var el = document.getElementById('anProg');
    if(!el) return;
    el.innerHTML = html ? '<div class="an-bar"><div style="width:' + (pct || 0) + '%"></div></div><div class="hint">' + html + '</div>' : '';
  }

  async function start(text){
    if(running){ cancelFlag = true; return; }
    try{
      if(!formSide) throw new Error('Pick which side you played ("White" or "Black") first.');
      var parsed = parsePgn(text), side = formSide, tc = {min:formMin, inc:formInc};
      running = true; cancelFlag = false;
      var go = document.getElementById('anGo'); if(go) go.textContent = 'Cancel';
      var eng = await getEngine(function(t){ setProg(t, 3); });
      var ms = speedMs(), ev = [], total = parsed.fens.length;
      var note = eng.kind === 'stockfish' ? 'Stockfish engine' : 'basic built-in engine (Stockfish could not be loaded, so the analysis is weaker)';
      for(var i = 0; i < total; i++){
        if(cancelFlag) throw new Error('Analysis cancelled.');
        setProg('Analyzing position ' + (i + 1) + ' of ' + total + ' with the ' + note + '...', Math.round(i / total * 100));
        // before YOUR moves, also look at the 2nd and 3rd best moves (to spot equally good options)
        var multi = (i < parsed.moves.length && parsed.moves[i].color === side) ? 3 : 1;
        ev.push(await evalFen(eng, parsed.fens[i], ms, multi));
        await new Promise(function(r){ setTimeout(r, 0); });
      }
      if(eng.kind === 'stockfish'){
        var sg0 = side === 'w' ? 1 : -1, sus = [];
        for(var q0 = 0; q0 < parsed.moves.length; q0++){
          if(parsed.moves[q0].color !== side || isMate(ev[q0].cp) || isMate(ev[q0 + 1].cp)) continue;
          var l0 = winPct(sg0 * ev[q0].cp) - winPct(sg0 * ev[q0 + 1].cp);
          if(l0 >= 5) sus.push({i:q0, l:l0});
        }
        sus.sort(function(a, b){ return b.l - a.l; });
        sus = (ms > 300) ? sus.slice(0, 3) : []; var dl0 = Date.now() + 8000;
        for(var z0 = 0; z0 < sus.length; z0++){
          if(cancelFlag) throw new Error('Analysis cancelled.');
          setProg('Double-checking suspicious move ' + (z0 + 1) + ' of ' + sus.length + ' at higher depth...', 92 + z0);
          var qi = sus[z0].i;
          try{
            if(Date.now() > dl0) break;
            var e1 = await evalFen(eng, parsed.fens[qi], 1500, 1), e2 = await evalFen(eng, parsed.fens[qi + 1], 1500, 1);
            e1.alts = ev[qi].alts || [];
            ev[qi] = e1; ev[qi + 1] = e2;
          }catch(err){ console.warn('deep re-check failed', err); }
        }
      }
      setProg('Writing your report...', 99);
      try{ if(window.__anPlus && window.__anPlus.ready) await window.__anPlus.ready; }catch(e){}
      A = build(parsed, ev, side, tc);
      A.engineKind = eng.kind; A.sel = 0; activeTab = 'board'; PR = null;
      setProg('', 0);
      renderInputBox(); renderResults();
    }catch(e){
      console.error(e);
      setProg('', 0);
      var p2 = document.getElementById('anProg');
      if(p2) p2.innerHTML = '<div class="an-err">' + esc(e.message || e) + '</div>';
    }finally{
      running = false;
      var g2 = document.getElementById('anGo'); if(g2) g2.textContent = 'Analyze';
    }
  }

  // ---- board drawing (opts: sel, dests, hintFrom, click) ----
  function boardHtml(fen, last, arrows, flip, opts){
    opts = opts || {};
    var c = new Chess(fen), b = c.board(), idx = [0, 1, 2, 3, 4, 5, 6, 7];
    var rows = flip ? idx.slice().reverse() : idx, cols = flip ? idx.slice().reverse() : idx;
    var h = '<div class="an-bw"><div class="board">';
    rows.forEach(function(r){
      cols.forEach(function(f){
        var file = 'abcdefgh'[f], rank = 8 - r, sq = file + rank, p = b[r][f];
        var cls = 'sq ' + (((r + f) % 2 === 0) ? 'light' : 'dark');
        if(last && (sq === last.from || sq === last.to)) cls += ' last';
        if(opts.sel === sq || opts.hintFrom === sq) cls += ' from';
        if(opts.dests && opts.dests.indexOf(sq) >= 0) cls += ' dest' + (p ? ' capture' : '');
        var sym = '';
        if(p){
          var uf = PIECE_UNICODE[p.color][p.type];
          sym = '<img class="piece-img" src="' + pieceImgUrl(p.color, p.type) + '" alt="" draggable="false" onerror="this.outerHTML=\'<span style=&quot;font-size:1em;line-height:1;&quot;>' + uf + '</span>\'">';
        }
        var co = '';
        if(f === cols[0]) co += '<span class="coord rank">' + rank + '</span>';
        if(r === rows[7]) co += '<span class="coord file">' + file + '</span>';
        h += '<div class="' + cls + '" data-sq="' + sq + '">' + co + sym + '</div>';
      });
    });
    h += '</div>';
    if(arrows && arrows.length){
      h += '<svg class="an-arrows" viewBox="0 0 8 8">';
      arrows.forEach(function(a, n){
        var f1 = a.from.charCodeAt(0) - 97, r1 = 8 - parseInt(a.from.charAt(1), 10), f2 = a.to.charCodeAt(0) - 97, r2 = 8 - parseInt(a.to.charAt(1), 10);
        var x1 = (flip ? 7 - f1 : f1) + .5, y1 = (flip ? 7 - r1 : r1) + .5, x2 = (flip ? 7 - f2 : f2) + .5, y2 = (flip ? 7 - r2 : r2) + .5;
        var dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy) || 1;
        x2 -= dx / len * .32; y2 -= dy / len * .32;
        h += '<defs><marker id="anArr' + n + '" markerWidth="4" markerHeight="4" refX="2.2" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4z" fill="' + a.color + '"/></marker></defs>' +
             '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + a.color + '" stroke-width=".17" stroke-linecap="round" opacity=".8" marker-end="url(#anArr' + n + ')"/>';
      });
      h += '</svg>';
    }
    return h + '</div>';
  }

  function graphHtml(){
    var n = A.fens.length, W = 600, H = 90, pts = [];
    for(var i = 0; i < n; i++){ var x = n > 1 ? i / (n - 1) * W : 0; pts.push(x.toFixed(1) + ',' + (H - winPct(A.ev[i].cp) / 100 * H).toFixed(1)); }
    var cx = n > 1 ? A.sel / (n - 1) * W : 0;
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" id="anGraph"><rect width="' + W + '" height="' + H + '" fill="#2b2924"/>' +
      '<polygon points="0,' + H + ' ' + pts.join(' ') + ' ' + W + ',' + H + '" fill="#f4f1ea"/>' +
      '<line x1="0" y1="' + H / 2 + '" x2="' + W + '" y2="' + H / 2 + '" stroke="#999" stroke-width="1" stroke-dasharray="4 4" opacity=".6"/>' +
      '<line x1="' + cx + '" y1="0" x2="' + cx + '" y2="' + H + '" stroke="#e0532e" stroke-width="2"/></svg>';
  }
  function kmHtml(){
    var km = myIdx(A).filter(function(j){ return A.stats[j].loss >= 8; })
      .sort(function(a, b){ return A.stats[b].loss - A.stats[a].loss; }).slice(0, 5).sort(function(a, b){ return a - b; });
    if(!km.length) return '';
    return '<div class="an-km"><b>Key moments</b>' + km.map(function(j){
      return '<span class="an-kmc" data-ply="' + (j + 1) + '" style="border-left-color:' + LABEL[A.stats[j].label].c + '" title="' + LABEL[A.stats[j].label].t + '">' + moveNumText(A.fens[j]) + esc(A.moves[j].san) + '</span>';
    }).join('') + '</div>';
  }
  function movesHtml(){
    var h = kmHtml();
    for(var i = 0; i < A.moves.length; i += 2){
      var cells = '';
      for(var k = 0; k < 2; k++){
        var j = i + k;
        if(j >= A.moves.length){ cells += '<span></span>'; continue; }
        var mine = A.moves[j].color === A.me, dot = '', clock = '';
        if(mine){
          var L = LABEL[A.stats[j].label];
          dot = '<span class="an-dot" style="background:' + L.c + '" title="' + L.t + '"></span>';
          var tm = A.time.spent[j];
          if(typeof tm === 'number' && tm > A.time.far) clock = ' <span title="Took ' + fmtSec(tm) + '">\u23F1</span>';
        } else dot = '<span class="an-dot" style="background:#b8b3a4" title="Opponent"></span>';
        cells += '<span class="an-m' + (mine ? '' : ' opp') + (A.sel === j + 1 ? ' sel' : '') + '" data-ply="' + (j + 1) + '">' + dot + esc(A.moves[j].san) + clock + '</span>';
      }
      h += '<div class="an-mrow"><span class="an-n">' + mvNo(A, i) + '</span>' + cells + '</div>';
    }
    return h;
  }
  function sec(title, inner){ return inner ? '<div class="an-sec"><h4>' + title + '</h4>' + inner + '</div>' : ''; }
  function ps(arr){ return arr.map(function(t){ return '<p class="an-note">' + esc(t) + '</p>'; }).join(''); }
  function equalHtml(E){
    if(!E.equal || !E.equal.length) return '';
    return sec('Equally good options', '<p class="an-note">The engine rates these moves about the same, so choose by plan:</p>' +
      E.equal.map(function(x){ return '<p class="an-note"><b>' + esc(x.san) + '</b>' + (x.played ? ' (you played this)' : '') + ': ' + esc(x.text) + '</p>'; }).join(''));
  }
  function adviceHtml(E){
    return (E.advice && E.advice.lines.length) ? sec(E.advice.title, ps(E.advice.lines)) : '';
  }

  function panelHtml(){
    if(A.sel === 0){
      return '<div class="an-title">Start of the game</div><p class="desc" style="margin-top:8px;">You are analyzing as ' + (A.me === 'w' ? 'White' : 'Black') + '. Step through with the arrows (or your keyboard arrow keys), click a move, or click the thin bar under the board. Your moves get a coloured dot and a coach explanation. Your opponent\'s moves get a short note on what they do. Evals use the standard sign everywhere: + means White is ahead, - means Black is ahead.</p>' +
        sec('How the engine sees it', ps(evalBlock(A.fens[0], pov(A, A.ev[0].cp), A.me)));
    }
    var E = explain(A, A.sel - 1);
    if(!E.mine){
      return '<div class="an-title">' + esc(E.title) + ' <span class="hint">your opponent</span></div><p class="an-note" style="margin-top:8px;">' + esc(E.what) + '</p>' +
        (E.lines.length ? ps(E.lines) : '') + sec('Where that leaves you', ps(E.engine));
    }
    var L = LABEL[E.label];
    var h = '<div class="an-title">' + esc(E.title) + ' <span class="an-chip" style="background:' + L.c + '">' + L.t + '</span></div><div class="an-evline">' + esc(E.evalLine) + ' <span style="opacity:.6">(depth ' + (A.ev[A.sel - 1].depth || '?') + ')</span></div>';
    if(E.time) h += '<div class="an-time">\u23F1 ' + fmtSec(E.time.t) + (E.time.far ? ' <span class="an-bad">(far too long; guide: about ' + fmtSec(A.time.far) + ')</span>' : '') + '</div>';
    if(E.mode === 'mate'){
      h += sec(E.whyTitle, E.why.map(function(w){ return '<p class="an-note">' + w + '</p>'; }).join(''));
      if(E.better) h += sec('Better was ' + esc(E.better.san), '<p class="an-note">' + esc(E.better.text) + '</p><span class="an-line">' + esc(E.better.line) + '</span>');
      if(E.repeat.length) h += sec('A pattern', ps(E.repeat));
      h += sec('Where that leaves you', ps(E.engine));
      if(E.lesson) h += '<div class="an-tip">\uD83D\uDCA1 ' + esc(E.lesson) + '</div>';
      return h;
    }
    if(E.mode === 'short'){
      h += '<p class="an-note">' + (A.stats[A.sel - 1].loss >= 10 ? 'A real slip: it gives away a noticeable part of your advantage.' : 'Small slip, nothing much to worry about.') + '</p>';
      if(E.better) h += '<p class="an-note">' + (A.stats[A.sel - 1].loss >= 10 ? 'Better was' : 'Slightly better was') + ' <b>' + esc(E.better.san) + '</b>' + (E.better.text ? ': ' + esc(E.better.text) : '.') + '</p>';
      if(E.missed) h += '<p class="an-note">' + esc(E.missed) + '</p>';
      if(E.trade) h += '<p class="an-note">' + esc(E.trade) + '</p>';
      h += equalHtml(E);
      if(E.endTips.length) h += sec('Endgame tip', ps(E.endTips));
      h += adviceHtml(E);
      if(E.repeat.length) h += ps(E.repeat);
      return h;
    }
    h += sec('What the move does', ps([E.what]));
    if(E.mode === 'full'){
      if(E.why.length) h += sec(E.whyTitle, E.why.map(function(w){ return '<p class="an-note">' + w + '</p>'; }).join(''));
      if(E.threat) h += sec('A threat you missed', ps([E.threat]));
      if(E.better) h += sec('Better was ' + esc(E.better.san), '<p class="an-note">' + esc(E.better.text) + '</p><span class="an-line">' + esc(E.better.line) + '</span>');
      if(E.plan) h += sec("Your opponent's plan", ps([E.plan]));
    } else if(E.why.length){
      h += '<p class="an-note">' + E.why.map(function(w){ return esc(w.replace(/<[^>]+>/g, '')); }).join(' ') + '</p>';
    }
    if(E.posi.length) h += sec('Positional', ps(E.posi));
    h += equalHtml(E);
    if(E.missed) h += sec('Missed material', ps([E.missed]));
    if(E.trade) h += sec('Trade', ps([E.trade]));
    if(E.weakT) h += sec('Targeting weak pawns', ps([E.weakT]));
    if(E.notes.length) h += sec('Pawns and structure', ps(E.notes));
    if(E.endTips.length) h += sec('Endgame tip', ps(E.endTips));
    h += adviceHtml(E);
    if(E.repeat.length) h += sec('A pattern', ps(E.repeat));
    if(E.pros.length || E.cons.length){
      var both = E.pros.length && E.cons.length;
      h += '<div class="an-sec an-pc"' + (both ? '' : ' style="grid-template-columns:1fr;"') + '>' +
        (E.pros.length ? '<div class="an-pros"><h4>Pros</h4><ul>' + E.pros.map(function(p){ return '<li>' + esc(p) + '</li>'; }).join('') + '</ul></div>' : '') +
        (E.cons.length ? '<div class="an-cons"><h4>Cons</h4><ul>' + E.cons.map(function(p){ return '<li>' + esc(p) + '</li>'; }).join('') + '</ul></div>' : '') + '</div>';
    }
    if(E.mode === 'full' && E.engine.length) h += sec('Where that leaves you', ps(E.engine));
    if(E.lesson) h += '<div class="an-tip">\uD83D\uDCA1 ' + esc(E.lesson) + '</div>';
    return h;
  }

  function reportHtml(){
    var S = sideSummary(A), N = coachNotes(A, S), st = stretches(A);
    var chips = ['book', 'best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder'].filter(function(k){ return k !== 'book' || S.counts.book; }).map(function(k){
      return '<span class="an-chip" style="background:' + LABEL[k].c + '">' + S.counts[k] + ' ' + LABEL[k].t.toLowerCase() + '</span>';
    }).join('');
    var swings = myIdx(A).map(function(i){ return {i:i, loss:A.stats[i].loss}; }).filter(function(x){ return x.loss >= 10; })
      .sort(function(a, b){ return b.loss - a.loss; }).slice(0, 3).sort(function(a, b){ return a.i - b.i; });
    var moments = swings.length ? '<p class="desc" style="margin:14px 0 0;">Your turning points: ' + swings.map(function(x){
      return '<span class="an-moment" data-ply="' + (x.i + 1) + '">' + esc(moveNumText(A.fens[x.i]) + ' ' + A.moves[x.i].san) + ' (' + LABEL[A.stats[x.i].label].t.toLowerCase() + ')</span>';
    }).join(', ') + '. Click one to jump to it.</p>' : '<p class="desc" style="margin:14px 0 0;">No big turning points against you. A clean game.</p>';

    // ---- real patterns ----
    var recur = [], sqHit = false;
    Object.keys(A.rep.sq).forEach(function(s){ if(A.rep.sq[s] >= 2){ sqHit = true; recur.push('You passed up the same free material on ' + s + ' ' + A.rep.sq[s] + ' times.'); } });
    Object.keys(A.rep.theme).forEach(function(k){
      var l = A.rep.theme[k];
      if(k === 'free' && sqHit) return;
      if(l.length >= 2 && PNAME[k]) recur.push('You ' + PNAME[k] + ' ' + l.length + ' times (moves ' + movesList(A, l) + '). ' + (LESSON[k] || ''));
    });
    Object.keys(A.rep.tacts).forEach(function(name){
      var l = A.rep.tacts[name];
      if(l.length >= 2) recur.push('You missed or fell for a ' + name + ' ' + l.length + ' times (moves ' + movesList(A, l) + '). ' + TACT_TIP[name]);
    });
    // which piece caused most of your big mistakes
    var byPiece = {};
    myIdx(A).forEach(function(i){
      var lb = A.stats[i].label;
      if(lb === 'mistake' || lb === 'blunder'){ var p = A.moves[i].piece; (byPiece[p] = byPiece[p] || []).push(i); }
    });
    Object.keys(byPiece).forEach(function(p){
      if(byPiece[p].length >= 3) recur.push('Most of your big mistakes were ' + NAMES[p] + ' moves (moves ' + movesList(A, byPiece[p]) + '). Slow down and double-check before moving your ' + NAMES[p] + '.');
    });
    // do the mistakes cluster right after you were checked?
    var afterCheck = myIdx(A).filter(function(i){
      var lb = A.stats[i].label, pv = i > 0 ? A.moves[i - 1] : null;
      return (lb === 'mistake' || lb === 'blunder') && pv && /[+]/.test(pv.san);
    });
    if(afterCheck.length >= 2) recur.push('You went wrong ' + afterCheck.length + ' times right after being checked (moves ' + movesList(A, afterCheck) + '). List every legal way out of check before choosing one.');

    var bk = bookInfo(A);
    var bookCard = bk ? '<div class="card"><h2>Opening</h2>' + ps(bk.lines) + '<p class="hint">' + esc(bk.note || 'My opening book only has main lines, so leaving it is not automatically a mistake.') + '</p></div>' : '';

    var tf = timeFindings(A), sug = timeSuggest(A), timeBody;
    if(A.time.has) timeBody = ps(tf) + (sug ? '<p class="hint" style="margin-top:8px;">' + esc(sug) + '</p>' : '');
    else timeBody = '<p class="an-note">There are no clock tags in this PGN, so I cannot check time per move. Games from Lichess or Chess.com include them. (Games played on Pawniac do not record per-move times yet.)</p>' + (sug ? '<p class="an-note">' + esc(sug) + '</p>' : '');
    var ds = A.ev.map(function(e){ return e.depth || 0; }).filter(function(d){ return d > 0; });
    var avgD = ds.length ? Math.round(ds.reduce(function(a, b){ return a + b; }, 0) / ds.length) : 0;
    var eng = A.engineKind === 'stockfish' ? 'Analysed with Stockfish running in your browser (average search depth ' + avgD + ').' : 'Stockfish could not be loaded, so this used a small built-in engine. Explanations are less reliable.';
    var title = esc((A.hdr.White || 'White') + ' vs ' + (A.hdr.Black || 'Black')) + (A.hdr.Result ? ' &middot; ' + esc(A.hdr.Result) : '');
    var nPr = practiceItems().length;
    return '<div class="card"><h2>' + title + '</h2><p class="desc" style="margin-bottom:12px;">' + eng + '</p>' +
        '<div class="an-sum"><div class="hint" style="margin:0;">Your game as ' + (A.me === 'w' ? 'White' : 'Black') + '</div><div class="an-acc">' + Math.round(S.acc) + '%</div><div class="hint" style="margin:0 0 6px;">accuracy</div><div class="an-counts">' + chips + '</div>' +
        (N.pros.length ? sec('What went well', '<ul>' + N.pros.map(function(t){ return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>') : '') +
        (N.cons.length ? sec('To work on', '<ul>' + N.cons.map(function(t){ return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>') : '') +
        (recur.length ? sec('Patterns', '<ul>' + recur.map(function(t){ return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>') : '') + '</div>' + moments + '</div>' +
      bookCard +
      '<div class="card"><h2>Time per move</h2>' + timeBody + '</div>' +
      '<div class="card"><h2>Learn from your mistakes</h2><p class="desc">' + (nPr ? 'A quick round on ' + plural(nPr, 'position') + ' from your game where you made a mistake or blunder. Find the better move.' : 'You made no mistakes or blunders, so there is nothing to practise. Nice.') + '</p>' +
        (nPr ? '<button id="anToPractice">Start practice</button>' : '') + '</div>';
  }

  function boardTabHtml(){
    return '<div class="card"><div class="an-main"><div><div class="an-boardcol"><div id="anEvalBar" class="an-evalbar"><div></div></div><div id="anBoard"></div></div>' +
      '<div class="an-graphstrip" id="anGraphBox"></div>' +
      '<div class="an-ctrl"><button class="secondary" id="anFirst">&laquo;</button><button class="secondary" id="anPrev">&lsaquo;</button><button class="secondary" id="anNext">&rsaquo;</button><button class="secondary" id="anLast">&raquo;</button><button class="secondary" id="anFlip">Flip</button></div></div>' +
      '<div class="an-side"><div id="anPanel"></div><div class="an-moves" id="anMoves"></div></div></div></div>';
  }

  function renderResults(){
    var res = document.getElementById('anRes');
    if(!res || !A) return;
    var tabs = [['board', 'Board'], ['report', 'Report'], ['practice', 'Practice']];
    res.innerHTML =
      '<div class="an-tabs">' + tabs.map(function(t){ return '<button class="an-tabbtn' + (activeTab === t[0] ? ' active' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' +
      '<div id="anBoardTab" style="display:' + (activeTab === 'board' ? 'block' : 'none') + '">' + boardTabHtml() + '</div>' +
      '<div id="anReportTab" style="display:' + (activeTab === 'report' ? 'block' : 'none') + '">' + reportHtml() + '</div>' +
      '<div id="anPracticeTab" style="display:' + (activeTab === 'practice' ? 'block' : 'none') + '"></div>';
    res.querySelectorAll('.an-tabbtn').forEach(function(b){ b.onclick = function(){ activeTab = b.dataset.tab; renderResults(); }; });
    res.querySelectorAll('.an-moment').forEach(function(el){
      el.onclick = function(){ activeTab = 'board'; renderResults(); goto(+el.dataset.ply); window.scrollTo({top:res.offsetTop, behavior:'smooth'}); };
    });
    var tp = document.getElementById('anToPractice');
    if(tp) tp.onclick = function(){ activeTab = 'practice'; renderResults(); };
    document.getElementById('anFirst').onclick = function(){ goto(0); };
    document.getElementById('anPrev').onclick = function(){ goto(A.sel - 1); };
    document.getElementById('anNext').onclick = function(){ goto(A.sel + 1); };
    document.getElementById('anLast').onclick = function(){ goto(A.moves.length); };
    document.getElementById('anFlip').onclick = function(){ A.flip = !A.flip; paintSel(); };
    paintSel();
    if(activeTab === 'practice') renderPractice();
  }
  function goto(k){ if(!A) return; A.sel = Math.max(0, Math.min(A.moves.length, k)); paintSel(); }

  function paintSel(){
    if(!A || !document.getElementById('anBoard')) return;
    var fen = A.fens[A.sel], last = null, arrows = [];
    if(A.sel > 0){
      var m = A.moves[A.sel - 1], S = A.stats[A.sel - 1];
      last = {from:m.from, to:m.to};
      var bad = ['good', 'inaccuracy', 'mistake', 'blunder'].indexOf(S.label) >= 0, bu = A.ev[A.sel - 1].best;
      if(m.color === A.me && bad && bu) arrows.push({from:bu.slice(0, 2), to:bu.slice(2, 4), color:'#1f9d55'});
    }
    document.getElementById('anBoard').innerHTML = boardHtml(fen, last, arrows, A.flip);
    var bar = document.querySelector('#anEvalBar div');
    if(bar){
      bar.style.height = winPct(A.ev[A.sel].cp) + '%';
      var onTop = (A.flip !== (A.me === 'b'));      // your side is at the top of the board
      onTop = !!A.flip;
      bar.style.top = onTop ? '0' : 'auto'; bar.style.bottom = onTop ? 'auto' : '0';
    }
    document.getElementById('anPanel').innerHTML = panelHtml();
    var mv = document.getElementById('anMoves'), keep = mv.scrollTop;
    mv.innerHTML = movesHtml(); mv.scrollTop = keep;
    var selEl = mv.querySelector('.sel');
    if(selEl && (selEl.offsetTop < mv.scrollTop || selEl.offsetTop > mv.scrollTop + mv.clientHeight - 30)) mv.scrollTop = selEl.offsetTop - 60;
    mv.querySelectorAll('[data-ply]').forEach(function(el){ el.onclick = function(){ goto(+el.dataset.ply); }; });
    var gb = document.getElementById('anGraphBox');
    if(gb){
      gb.innerHTML = graphHtml();
      var gsvg = document.getElementById('anGraph');
      gsvg.onclick = function(e){ var r = gsvg.getBoundingClientRect(); goto(Math.round((e.clientX - r.left) / r.width * (A.fens.length - 1))); };
    }
  }
  document.addEventListener('keydown', function(e){
    if(!A || screen.style.display !== 'block' || activeTab !== 'board') return;
    var t = e.target && e.target.tagName;
    if(t === 'TEXTAREA' || t === 'INPUT' || t === 'SELECT') return;
    if(e.key === 'ArrowRight'){ goto(A.sel + 1); e.preventDefault(); }
    else if(e.key === 'ArrowLeft'){ goto(A.sel - 1); e.preventDefault(); }
    else if(e.key === 'Home'){ goto(0); } else if(e.key === 'End'){ goto(A.moves.length); }
  });

  // =====================================================================
  //  Learn from your mistakes (practice)
  // =====================================================================
  function practiceItems(){
    var idx = myIdx(A).filter(function(i){ return (A.stats[i].label === 'mistake' || A.stats[i].label === 'blunder') && A.ev[i].best; });
    if(idx.length > 8) idx = idx.slice().sort(function(a, b){ return A.stats[b].loss - A.stats[a].loss; }).slice(0, 8);
    return idx.sort(function(a, b){ return a - b; });
  }
  function startPractice(){
    PR = {items:practiceItems(), k:0, score:0, res:[], sel:null, tries:0, hint:0, state:'ask', msg:'', msgCls:'', busy:false, fin:false, points:0};
  }
  // hints get more specific with every press: 1 = the idea, 2 = which piece, 3 = its square
  function hintTexts(i, level){
    var out = [], fen = A.fens[i], best = A.ev[i].best, bm = best ? tryMove(fen, best) : null;
    if(!bm) return out;
    var me = A.me, opp = A.opp, s1;
    if(level >= 1){
      try{
        var thr = winsFor(fen, opp).filter(function(w){ return w.net >= 2; });
        var tc = tacticOf(fen, bm), fl = bm.flags || '';
        if(isMate(A.stats[i].cpBefore) && A.stats[i].cpBefore > 0) s1 = 'There is a forced checkmate here. List every check you have.';
        else if(tc && tc.name === 'fork') s1 = 'Look for a move that attacks two valuable things at once.';
        else if(tc && tc.name === 'pin') s1 = 'Look for a line running through two of their pieces: a pin is available.';
        else if(tc && tc.name === 'skewer') s1 = 'A skewer is on: attack the valuable piece so that it must move and exposes another one behind it.';
        else if(tc && tc.name === 'discovered attack') s1 = 'Move a piece out of the way so that another one of yours uncovers an attack.';
        else if(tc && tc.name === 'back-rank mate') s1 = 'Their king has no escape squares. Think about the back rank.';
        else if(bm.captured) s1 = 'A capture works here. Which of their pieces is loose, or can be won with a good trade?';
        else if(/[+#]/.test(bm.san)) s1 = 'A forcing check is the key. Checks first, then captures, then threats.';
        else if(thr.length) s1 = 'Your opponent is threatening to win material (' + thr[0].san + ' takes your ' + NAMES[thr[0].piece] + '). Deal with that first.';
        else if(fl.indexOf('k') >= 0 || fl.indexOf('q') >= 0) s1 = 'Think about your king: can it be made safe right now?';
        else if(i < 24 && (bm.piece === 'n' || bm.piece === 'b') && bm.from.charAt(1) === (me === 'w' ? '1' : '8')) s1 = 'Think development: which of your pieces is still sitting at home?';
        else s1 = 'There is no big tactic. Ask which of your pieces is worst placed, and how to improve it.';
      }catch(e){ s1 = 'Run a safety check first: what is attacked, and what is defended?'; }
      out.push(s1);
    }
    if(level >= 2) out.push('The best move is made with your ' + NAMES[bm.piece] + '.');
    if(level >= 3) out.push('That piece is highlighted on the board.');
    return out;
  }
  function renderPractice(){
    var box = document.getElementById('anPracticeTab');
    if(!box || !A) return;
    if(!PR) startPractice();
    if(!PR.items.length){ box.innerHTML = '<div class="card"><h2>Learn from your mistakes</h2><p class="desc">No mistakes or blunders in this game, so there is nothing to practise.</p></div>'; return; }
    if(PR.fin){
      var n = PR.items.length, pct = PR.score / n * 100;
      var verdict = pct >= 90 ? 'Excellent. You find the right ideas once you stop and look.' : pct >= 60 ? 'Good. Most of these you can fix by slowing down for a safety check.' : 'Worth another pass. Go back to the Board tab and read the explanations for these moves.';
      box.innerHTML = '<div class="card"><h2>Practice complete</h2><div class="an-score">' + (Math.round(PR.score * 2) / 2) + ' / ' + n + '</div><p class="desc" style="margin-top:6px;">' + verdict + '</p>' +
        PR.res.map(function(r){ return '<div class="seat"><span class="who">Move ' + esc(r.label) + '</span><span class="taken">' + r.pts + ' / 1</span></div>'; }).join('') +
        '<div class="an-prbtns"><button id="prAgain">Practise again</button><button class="secondary" id="prBoard">Back to the board</button></div></div>';
      document.getElementById('prAgain').onclick = function(){ startPractice(); renderPractice(); };
      document.getElementById('prBoard').onclick = function(){ activeTab = 'board'; renderResults(); };
      return;
    }
    var i = PR.items[PR.k], m = A.moves[i], E = explain(A, i), fen = A.fens[i], flip = (A.me === 'b');
    var dests = [];
    if(PR.sel && PR.state === 'ask'){
      dests = new Chess(fen).moves({verbose:true}).filter(function(x){ return x.from === PR.sel; }).map(function(x){ return x.to; });
    }
    var opts = {sel:PR.sel, dests:dests, hintFrom:(PR.hint >= 3 && PR.state === 'ask') ? A.ev[i].best.slice(0, 2) : null};
    var arrows = [];
    if(PR.state !== 'ask') arrows.push({from:A.ev[i].best.slice(0, 2), to:A.ev[i].best.slice(2, 4), color:'#1f9d55'});
    var bestMv = tryMove(fen, A.ev[i].best), bestSan = bestMv ? bestMv.san : A.ev[i].best;
    var side = '<div class="an-title">Position ' + (PR.k + 1) + ' of ' + PR.items.length + '</div>' +
      '<p class="an-note" style="margin-top:8px;">In your game you played <b>' + esc(m.san) + '</b> here (a ' + A.stats[i].label + ', move ' + mvNo(A, i) + '). Find a better move: click a piece, then a square.</p>';
    if(PR.state === 'ask'){
      if(PR.hint >= 1) side += '<div class="an-fb"><b>Hint:</b> ' + hintTexts(i, PR.hint).map(esc).join(' ') + '</div>';
      if(PR.msg) side += '<div class="an-fb ' + PR.msgCls + '">' + esc(PR.msg) + '</div>';
      side += '<div class="an-prbtns"><button class="secondary" id="prHint"' + (PR.busy || PR.hint >= 3 ? ' disabled' : '') + '>' + (PR.hint === 0 ? 'Hint' : 'More help') + '</button><button class="secondary danger" id="prShow"' + (PR.busy ? ' disabled' : '') + '>Show answer</button></div>';
    } else {
      side += '<div class="an-fb ' + (PR.msgCls || '') + '">' + esc(PR.msg) + '</div>';
      side += sec('The best move was ' + esc(bestSan), (E.better ? '<p class="an-note">' + esc(E.better.text) + '</p><span class="an-line">' + esc(E.better.line) + '</span>' : '') +
        (E.why && E.why.length ? '<p class="an-note" style="margin-top:6px;"><b>What went wrong in the game:</b> ' + E.why.map(function(w){ return esc(String(w).replace(/<[^>]+>/g, '')); }).join(' ') + '</p>' : '') +
        (E.missed ? '<p class="an-note">' + esc(E.missed) + '</p>' : ''));
      side += '<div class="an-prbtns"><button id="prNext">' + (PR.k + 1 >= PR.items.length ? 'See my score' : 'Next position') + '</button></div>';
    }
    box.innerHTML = '<div class="card"><div class="an-main"><div>' + boardHtml(fen, null, arrows, flip, opts) + '</div><div class="an-side">' + side + '</div></div></div>';
    if(PR.state === 'ask'){
      box.querySelectorAll('.sq[data-sq]').forEach(function(cell){ cell.style.cursor = 'pointer'; cell.onclick = function(){ prClick(cell.dataset.sq); }; });
      var hb = document.getElementById('prHint'); if(hb) hb.onclick = function(){ PR.hint = Math.min(3, PR.hint + 1); renderPractice(); };
      var sb = document.getElementById('prShow'); if(sb) sb.onclick = function(){ prFinish(false, 'Here is the answer.', 'wrong'); };
    } else {
      document.getElementById('prNext').onclick = function(){
        if(PR.k + 1 >= PR.items.length){ PR.fin = true; } else { PR.k++; PR.sel = null; PR.tries = 0; PR.hint = 0; PR.state = 'ask'; PR.msg = ''; PR.msgCls = ''; }
        renderPractice();
      };
    }
  }
  function prClick(sq){
    if(!PR || PR.state !== 'ask' || PR.busy) return;
    var i = PR.items[PR.k], fen = A.fens[i], c = new Chess(fen), p = c.get(sq);
    if(PR.sel){
      var legal = c.moves({verbose:true}).filter(function(x){ return x.from === PR.sel && x.to === sq; });
      if(legal.length){ prAttempt(PR.sel, sq); return; }
    }
    PR.sel = (p && p.color === A.me) ? sq : null;
    renderPractice();
  }
  async function prAttempt(from, to){
    var i = PR.items[PR.k], fen = A.fens[i], c = new Chess(fen), mv = c.move({from:from, to:to, promotion:'q'});
    if(!mv) return;
    var uci = from + to + (mv.promotion || ''), best = A.ev[i].best;
    PR.sel = null;
    if(uci === A.stats[i].uci){ PR.msg = 'That is the move you played in the game. Look for something better.'; PR.msgCls = 'wrong'; renderPractice(); return; }
    if(uci === best){ prFinish(true, 'Correct! ' + mv.san + ' is the engine\'s choice.', 'good'); return; }
    PR.busy = true; PR.msg = 'Checking ' + mv.san + '...'; PR.msgCls = ''; renderPractice();
    var okMove = false;
    try{
      var r = await evalFen(ENGINE, c.fen(), 500, 1);
      okMove = winPct(pov(A, A.ev[i].cp)) - winPct(pov(A, r.cp)) <= 4;
    }catch(e){ console.error(e); }
    PR.busy = false;
    if(!PR || PR.items[PR.k] !== i || PR.state !== 'ask') return;
    if(okMove) prFinish(true, 'Also strong! ' + mv.san + ' is not the engine\'s first choice, but it is just as good.', 'good');
    else { PR.tries++; PR.msg = 'Not quite: ' + mv.san + ' does not solve the problem. Try again' + (PR.hint < 3 ? ' or ask for a hint.' : '.'); PR.msgCls = 'wrong'; renderPractice(); }
  }
  function prFinish(ok, msg, cls){
    var i = PR.items[PR.k], pts = ok ? ((PR.tries === 0 && PR.hint === 0) ? 1 : 0.5) : 0;
    PR.score += pts;
    PR.res.push({label:moveNumText(A.fens[i]) + ' ' + A.moves[i].san, pts:pts});
    PR.state = 'done'; PR.msg = msg + (ok ? (pts === 1 ? ' +1 point.' : ' +0.5 (used a hint or a retry).') : ' 0 points.'); PR.msgCls = cls;
    renderPractice();
  }

  window.__anCtx = {VAL:VAL, NAMES:NAMES, tryMove:tryMove, tacticOf:tacticOf, winsFor:winsFor, capsFor:capsFor, flipTurn:flipTurn, features:features, posNotes:posNotes, sanLine:sanLine, plural:plural};
  // read-only access for the PDF report (step 20)
  window.__anHook = {
    data: function(){ return A; },
    panel: function(k){ var old = A.sel; A.sel = k; try{ return panelHtml(); } finally { A.sel = old; } },
    report: function(){ return reportHtml(); }
  };

  // ---- "Analyze this game" button on a finished game ----
  function gamePgn(g){
    var s = g.seats || {};
    var w = g.mode === 'team' ? (s.whiteBrain + ' & ' + s.whiteHand) : s.white;
    var b = g.mode === 'team' ? (s.blackBrain + ' & ' + s.blackHand) : s.black;
    var res = g.winner === 'w' ? '1-0' : g.winner === 'b' ? '0-1' : g.winner === 'draw' ? '1/2-1/2' : '*';
    var mt = '';
    (g.moveLog || []).forEach(function(san, i){ mt += (i % 2 === 0 ? (i / 2 + 1) + '. ' : '') + san + ' '; });
    var tcTag = (g.clock && g.clock.initialSec > 0) ? '[TimeControl "' + g.clock.initialSec + '+' + (g.clock.incrementSec || 0) + '"]\n' : '';
    return '[Event "Pawniac game"]\n[White "' + String(w || 'White').replace(/"/g, '') + '"]\n[Black "' + String(b || 'Black').replace(/"/g, '') + '"]\n[Result "' + res + '"]\n' + tcTag + '\n' + mt + res;
  }
  var prevDraw = window.drawGame;
  window.drawGame = function(){
    try{ prevDraw(); }
    finally{
      try{
        var g = gameState;
        if(g && g.status === 'finished' && g.winner !== 'abort' && g.moveLog && g.moveLog.length >= 2 && !document.getElementById('btnAnalyzeGame')){
          var back = document.getElementById('btnBack');
          if(back){
            var bt = document.createElement('button');
            bt.className = 'full-btn secondary'; bt.id = 'btnAnalyzeGame'; bt.textContent = 'Analyze this game';
            bt.onclick = function(){
              var pgn = gamePgn(g), me = myRole(g);
              stopPoll(); A = null; PR = null; activeTab = 'board';
              sideManual = false; tcManual = false;
              formSide = me ? me.side : null;
              if(g.clock && g.clock.initialSec > 0){ formMin = g.clock.initialSec / 60; formInc = g.clock.incrementSec || 0; tcFilled = true; } else { formMin = 0; formInc = 0; tcFilled = false; }
              renderAnalyze();
              document.getElementById('anPgn').value = pgn;
              refreshForm();
              if(formSide) start(pgn);
            };
            back.parentNode.insertBefore(bt, back);
          }
        }
      }catch(e){ console.error('analyze button failed', e); }
    }
  };
})();
