/* Pawniac: Double Move chess, the bot.
 * Stockfish only understands one move per turn, so Double Move uses its own small search (alpha-beta over
 * single moves, where the same side simply keeps the move for its second half of the turn). It runs in a
 * web worker so the page never freezes. window.PawniacDoubleBot is used by the "Play vs Bot" screen (script_34.js):
 *   new PawniacDoubleBot.Game()   a chess.js-like object that follows the Double Move rules
 *   PawniacDoubleBot.pick(game, ms, skill)  ->  Promise of a move like "e2e4" (or "e7e8q")
 */
(function(root){
  // ---------------- the search (pure; runs in the worker, and in Node for the tests) ----------------
  function makeSearch(PD){
    var Chess = PD.Chess;
    var VAL = {p:100, n:320, b:330, r:500, q:900, k:0};
    var ORD = {p:100, n:320, b:330, r:500, q:900, k:50000};   // move ordering only: look at king captures first
    var MATE = 100000;
    var nodes = 0, deadline = 0, stopped = false;

    // material + a little for central knights/bishops and advanced pawns, from White's point of view
    function evalWhite(fen){
      var rows = fen.split(' ')[0].split('/'), s = 0;
      for(var i = 0; i < 8; i++){
        var f = 0, row = rows[i];
        for(var j = 0; j < row.length; j++){
          var ch = row.charAt(j);
          if(ch >= '1' && ch <= '8'){ f += parseInt(ch, 10); continue; }
          var low = ch.toLowerCase(), white = ch !== low, v = VAL[low];
          var centre = 3 - Math.max(Math.abs(f - 3.5), Math.abs(i - 3.5)) + 0.5;      // 0 .. 3
          if(low === 'n' || low === 'b') v += centre * 6;
          else if(low === 'p') v += (white ? (6 - i) : (i - 1)) * 5 + (f > 1 && f < 6 ? centre * 2 : 0);
          else if(low === 'q') v += centre * 2;
          s += white ? v : -v;
          f++;
        }
      }
      return s;
    }
    function stand(st){ var e = evalWhite(st.fen); return st.turn === 'w' ? e : -e; }

    function orderKey(m){
      var k = 0;
      if(m.captured) k += 10 * ORD[m.captured] - VAL[m.piece] / 10 + 1000;
      if(m.promotion) k += 800;
      return k;
    }
    function sorted(list){ return list.sort(function(a, b){ return orderKey(b) - orderKey(a); }); }

    // score of a finished game for the side to move in st
    function terminal(st, r, depth){
      if(r.winner === 'draw') return 0;
      return r.winner === st.turn ? MATE + depth : -MATE - depth;
    }

    // captures only, to settle the position at the horizon (the opponent is about to play TWO moves)
    function quiesce(st, depth, alpha, beta){
      var stand0 = stand(st);
      if(depth <= 0) return stand0;
      if(stand0 >= beta) return stand0;
      if(stand0 > alpha) alpha = stand0;
      var list = sorted(new Chess(st.fen).moves({verbose:true}).filter(function(m){ return m.captured; }));
      var best = stand0;
      for(var i = 0; i < list.length; i++){
        var r = PD.apply(st, list[i], {fast:true}); if(!r) continue;
        var sc;
        if(r.over) sc = terminal(st, r, 0);
        else if(r.next.turn === st.turn) sc = quiesce(r.next, depth - 1, alpha, beta);
        else sc = -quiesce(r.next, depth - 1, -beta, -alpha);
        if(sc > best){ best = sc; if(sc > alpha) alpha = sc; }
        if(alpha >= beta) break;
      }
      return best;
    }

    function negamax(st, depth, alpha, beta){
      if((++nodes & 63) === 0 && Date.now() > deadline){ stopped = true; }
      if(stopped) return 0;
      if(depth <= 0) return quiesce(st, 2, alpha, beta);
      var list = sorted(new Chess(st.fen).moves({verbose:true}));
      if(!list.length) return stand(st);
      var best = -Infinity;
      for(var i = 0; i < list.length; i++){
        var r = PD.apply(st, list[i], {fast:true}); if(!r) continue;
        var sc;
        if(r.over) sc = terminal(st, r, depth);
        else if(r.next.turn === st.turn) sc = negamax(r.next, depth - 1, alpha, beta);
        else sc = -negamax(r.next, depth - 1, -beta, -alpha);
        if(stopped) return 0;
        if(sc > best) best = sc;
        if(sc > alpha) alpha = sc;
        if(alpha >= beta) break;
      }
      return best;
    }

    function uci(m){ return m.from + m.to + (m.promotion || ''); }

    // req: {fen, turn, movesLeft, maxDepth, budget (ms), noise}
    function search(req){
      var st = {fen:req.fen, turn:req.turn, movesLeft:req.movesLeft || 1, pos:[], sides:''};
      var list = sorted(new Chess(st.fen).moves({verbose:true}));
      if(!list.length) return {move:null};
      var noise = req.noise || 0;
      if(req.maxDepth <= 0){      // beginner: mostly random, likes captures
        var caps = list.filter(function(m){ return m.captured; });
        var pool = (caps.length && Math.random() < 0.5) ? caps : list;
        return {move:uci(pool[Math.floor(Math.random() * pool.length)]), depth:0};
      }
      nodes = 0; stopped = false; deadline = Date.now() + req.budget;
      var bestMove = list[0], bestScore = -Infinity, doneDepth = 0;
      for(var d = 1; d <= req.maxDepth; d++){
        var iterBest = null, iterScore = -Infinity, alpha = -Infinity;
        for(var i = 0; i < list.length; i++){
          var m = list[i], r = PD.apply(st, m, {fast:true}); if(!r) continue;
          var sc;
          if(r.over) sc = terminal(st, r, d);
          else if(r.next.turn === st.turn) sc = negamax(r.next, d - 1, noise ? -Infinity : alpha, Infinity);
          else sc = -negamax(r.next, d - 1, -Infinity, noise ? Infinity : -alpha);
          if(stopped) break;
          if(noise && Math.abs(sc) < MATE / 2) sc += (Math.random() - 0.5) * 2 * noise;
          if(sc > iterScore){ iterScore = sc; iterBest = m; }
          if(!noise && sc > alpha) alpha = sc;
          if(sc >= MATE) break;
        }
        if(stopped) break;                                   // out of time: keep the last fully searched depth
        if(iterBest){ bestMove = iterBest; bestScore = iterScore; doneDepth = d; }
        if(bestScore >= MATE) break;
        // put the best move first for the next, deeper pass
        list.sort(function(a, b){ return (b === bestMove) - (a === bestMove); });
      }
      return {move:uci(bestMove), depth:doneDepth, score:bestScore, nodes:nodes};
    }
    return {search:search};
  }
  root.PawniacDoubleMakeSearch = makeSearch;
  if(typeof module !== 'undefined' && module.exports) module.exports = makeSearch;
  if(typeof window === 'undefined' || typeof document === 'undefined') return;

  // ---------------- a chess.js-like game that follows the Double Move rules ----------------
  var PD = window.PawniacDouble;
  if(!PD){ console.error('Double Move bot: rules (script_53.js) not loaded'); return; }

  function Game(){
    this.st = PD.start();
    this.c = new PD.Chess(this.st.fen);
    this.over = null;
  }
  Game.prototype = {
    turn: function(){ return this.st.turn; },          // after a mate this is the side that was mated
    left: function(){ return this.st.movesLeft; },
    fen: function(){ return this.st.fen; },            // for the second move of a turn this already has the same side to move
    board: function(){ return this.c.board(); },
    get: function(sq){ return this.c.get(sq); },
    moves: function(o){ return this.c.moves(o); },
    in_check: function(){ return this.c.in_check(); },
    move: function(m){
      if(this.over) return null;
      var r = PD.apply(this.st, {from:m.from, to:m.to, promotion:m.promotion});
      if(!r) return null;
      this.st = r.next; this.c = new PD.Chess(r.next.fen);
      if(r.over) this.over = r;
      return r.mv;
    },
    game_over: function(){ return !!this.over; },
    in_checkmate: function(){ return !!this.over && this.over.note === 'king captured'; },   // the game ended because a king was captured
    in_stalemate: function(){ return !!this.over && /stalemate/.test(this.over.note); },
    insufficient_material: function(){ return !!this.over && /insufficient/.test(this.over.note); },
    in_threefold_repetition: function(){ return !!this.over && /repetition/.test(this.over.note); },
    in_draw: function(){ return !!this.over && this.over.winner === 'draw'; }
  };

  // ---------------- worker plumbing ----------------
  var worker = null, jobs = {}, jobId = 0, workerBad = false;
  function startWorker(){
    if(worker || workerBad) return worker;
    try{
      var src = 'var PD=(' + window.PawniacDoubleMake.toString() + ')();var S=(' + makeSearch.toString() + ')(PD);' +
        'onmessage=function(e){var r;try{r=S.search(e.data.req);}catch(x){r={move:null,error:String(x)};}postMessage({id:e.data.id,res:r});};';
      var url = URL.createObjectURL(new Blob([src], {type:'text/javascript'}));
      worker = new Worker(url);
      worker.onmessage = function(e){ var j = jobs[e.data.id]; if(j){ delete jobs[e.data.id]; j(e.data.res); } };
      worker.onerror = function(){ workerBad = true; var o = jobs; jobs = {}; worker = null; Object.keys(o).forEach(function(k){ o[k](null); }); };
    }catch(e){ workerBad = true; worker = null; }
    return worker;
  }

  function limits(skill){
    // skill is the bot level on the 0..20 scale (Beginner 0, Easy 5, Medium 10, Hard 15, Expert 20)
    if(skill <= 2)  return {maxDepth:0, noise:0};
    if(skill <= 7)  return {maxDepth:1, noise:60};
    if(skill <= 12) return {maxDepth:2, noise:15};
    if(skill <= 17) return {maxDepth:3, noise:0};
    return {maxDepth:5, noise:0};
  }
  var chain = Promise.resolve();
  function pick(game, ms, skill){
    var p = chain.then(function(){ return run(game, ms, skill); });
    chain = p.catch(function(){});
    return p;
  }
  function randomUci(game){
    var l = game.moves({verbose:true}); if(!l.length) return null;
    var m = l[Math.floor(Math.random() * l.length)];
    return m.from + m.to + (m.promotion || '');
  }
  function run(game, ms, skill){
    var lim = limits(skill), budget = Math.max(400, Math.min(7000, ms * 4));
    var req = {fen:game.fen(), turn:game.turn(), movesLeft:game.left(), maxDepth:lim.maxDepth, noise:lim.noise, budget:budget};
    return new Promise(function(resolve){
      var w = startWorker();
      if(!w){ resolve(randomUci(game)); return; }
      var id = ++jobId, done = false;
      var guard = setTimeout(function(){ if(!done){ done = true; delete jobs[id]; resolve(randomUci(game)); } }, budget + 8000);
      jobs[id] = function(res){
        if(done) return; done = true; clearTimeout(guard);
        resolve(res && res.move ? res.move : randomUci(game));
      };
      try{ w.postMessage({id:id, req:req}); }catch(e){ done = true; clearTimeout(guard); delete jobs[id]; resolve(randomUci(game)); }
    });
  }

  root.PawniacDoubleBot = {Game:Game, pick:pick, _limits:limits};
})(typeof window !== 'undefined' ? window : this);
