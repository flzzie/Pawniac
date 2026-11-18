// Puzzles from my games: the mistakes and blunders from every game you have analysed on this device,
// turned into "find the better move" puzzles. Everything stays on this device (localStorage), nothing is uploaded.
(function(){
  'use strict';
  var KEY = 'pawniac-puzzles-v1';
  var Z = function(){ return window.__anCore; };
  var NAMES = {n:'knight', b:'bishop', r:'rook', q:'queen', k:'king', p:'pawn'};
  var root = null, ST = null;

  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'}[c]; }); }
  function load(){ try{ return JSON.parse(localStorage.getItem(KEY) || '[]') || []; }catch(e){ return []; } }
  function save(arr){ try{ localStorage.setItem(KEY, JSON.stringify(arr)); }catch(e){} }
  function update(id, fn){ var a = load(), it = a.filter(function(x){ return x.id === id; })[0]; if(it){ fn(it); save(a); } }

  // unsolved first, then the ones you failed most, then the oldest
  function order(arr){
    return arr.slice().sort(function(a, b){
      if((a.solved > 0) !== (b.solved > 0)) return a.solved > 0 ? 1 : -1;
      if(a.fails !== b.fails) return b.fails - a.fails;
      return a.t - b.t;
    });
  }

  function start(){
    var all = load();
    ST = {items:order(all), k:0, sel:null, state:'ask', hint:0, msg:'', cls:'', busy:false, done:0};
    draw();
  }

  function sanOf(fen, uci){ try{ var m = Z().tryMove(fen, uci); return m ? m.san : uci; }catch(e){ return uci; } }

  function hintLines(it, level){
    var out = [], m = null; try{ m = Z().tryMove(it.fen, it.best); }catch(e){}
    if(level >= 1 && m) out.push('The best move is made with the ' + NAMES[m.piece] + '.');
    if(level >= 2 && m) out.push('Look at your ' + NAMES[m.piece] + ' on ' + m.from + '.');
    return out;
  }

  function draw(){
    if(!root) return;
    var all = load();
    if(!all.length){
      root.innerHTML = '<div class="card"><h2>Puzzles from my games</h2><p class="desc">Nothing here yet. Analyse a game (yours, with your colour chosen) and your mistakes and blunders show up here as puzzles. They are kept only on this device.</p></div>';
      return;
    }
    if(!ST || !ST.items.length) start();
    if(ST.k >= ST.items.length){
      var solved = load().filter(function(x){ return x.solved > 0; }).length;
      root.innerHTML = '<div class="card"><h2>Round complete</h2><div class="an-score">' + ST.done + ' / ' + ST.items.length + '</div><p class="desc">solved this round without showing the answer. In total ' + solved + ' of ' + all.length + ' puzzles from your games are solved.</p>' +
        '<div class="an-prbtns"><button id="pzAgain">Go again</button><button class="secondary" id="pzClear">Delete all puzzles</button></div></div>';
      document.getElementById('pzAgain').onclick = start;
      document.getElementById('pzClear').onclick = function(){
        var bx = this.parentNode;
        bx.innerHTML = '<p class="desc" style="margin:0 0 8px;width:100%;">Delete all your saved puzzles? This cannot be undone.</p><button id="pzYes">Yes, delete them</button> <button class="secondary" id="pzNo">Cancel</button>';
        document.getElementById('pzYes').onclick = function(){ save([]); ST = null; draw(); };
        document.getElementById('pzNo').onclick = function(){ draw(); };
      };
      return;
    }
    var it = ST.items[ST.k], flip = it.me === 'b', dests = [], C = Z();
    if(ST.sel && ST.state === 'ask'){
      try{ dests = new Chess(it.fen).moves({verbose:true}).filter(function(x){ return x.from === ST.sel; }).map(function(x){ return x.to; }); }catch(e){}
    }
    var arrows = ST.state !== 'ask' ? [{from:it.best.slice(0, 2), to:it.best.slice(2, 4), color:'#1f9d55'}] : [];
    var opts = {sel:ST.sel, dests:dests, hintFrom:(ST.hint >= 2 && ST.state === 'ask') ? it.best.slice(0, 2) : null};
    var solvedN = all.filter(function(x){ return x.solved > 0; }).length;
    var side = '<div class="an-title">Puzzle ' + (ST.k + 1) + ' of ' + ST.items.length + '</div>' +
      '<p class="an-note" style="margin-top:8px;">' + (it.me === 'w' ? 'White' : 'Black') + ' to move. In your game you played <b>' + esc(it.played) + '</b> here (a ' + esc(it.label) + ', move ' + esc(it.no) + '). Find the better move: click a piece, then a square.</p>' +
      '<p class="an-note" style="opacity:.7;">' + solvedN + ' of ' + all.length + ' puzzles solved so far.</p>';
    if(ST.state === 'ask'){
      if(ST.hint >= 1) side += '<div class="an-fb"><b>Hint:</b> ' + hintLines(it, ST.hint).map(esc).join(' ') + '</div>';
      if(ST.msg) side += '<div class="an-fb ' + ST.cls + '">' + esc(ST.msg) + '</div>';
      side += '<div class="an-prbtns"><button class="secondary" id="pzHint"' + (ST.busy || ST.hint >= 2 ? ' disabled' : '') + '>' + (ST.hint === 0 ? 'Hint' : 'More help') + '</button><button class="secondary" id="pzShow"' + (ST.busy ? ' disabled' : '') + '>Show the answer</button><button class="secondary" id="pzSkip"' + (ST.busy ? ' disabled' : '') + '>Skip</button></div>';
    } else {
      side += '<div class="an-fb ' + (ST.cls || '') + '">' + esc(ST.msg) + '</div>';
      side += '<div class="an-title" style="margin-top:14px;">The best move was ' + esc(it.bestSan) + '</div>' +
        (it.better ? '<p class="an-note">' + esc(it.better) + '</p>' : '') + (it.line ? '<span class="an-line">' + esc(it.line) + '</span>' : '') +
        (it.why ? '<p class="an-note" style="margin-top:6px;"><b>What went wrong in the game:</b> ' + esc(it.why) + '</p>' : '');
      side += '<div class="an-prbtns"><button id="pzNext">' + (ST.k + 1 >= ST.items.length ? 'Finish round' : 'Next puzzle') + '</button></div>';
    }
    root.innerHTML = '<div class="card"><div class="an-main"><div>' + C.boardHtml(it.fen, null, arrows, flip, opts) + '</div><div class="an-side">' + side + '</div></div></div>';
    if(ST.state === 'ask'){
      root.querySelectorAll('.sq[data-sq]').forEach(function(cell){ cell.style.cursor = 'pointer'; cell.onclick = function(){ click(cell.dataset.sq); }; });
      var h = document.getElementById('pzHint'); if(h) h.onclick = function(){ ST.hint = Math.min(2, ST.hint + 1); draw(); };
      var sh = document.getElementById('pzShow'); if(sh) sh.onclick = function(){ finish(false, 'Here is the answer.', 'wrong'); };
      var sk = document.getElementById('pzSkip'); if(sk) sk.onclick = function(){ next(); };
    } else {
      document.getElementById('pzNext').onclick = next;
    }
  }

  function next(){ ST.k++; ST.sel = null; ST.state = 'ask'; ST.hint = 0; ST.msg = ''; ST.cls = ''; ST.busy = false; draw(); }

  function finish(ok, msg, cls){
    var it = ST.items[ST.k];
    ST.state = 'done'; ST.msg = msg; ST.cls = cls; ST.sel = null;
    if(ok){ if(ST.hint === 0) ST.done++; update(it.id, function(x){ x.solved = (x.solved || 0) + 1; }); it.solved = (it.solved || 0) + 1; }
    else update(it.id, function(x){ x.fails = (x.fails || 0) + 1; });
    draw();
  }

  function click(sq){
    if(!ST || ST.state !== 'ask' || ST.busy) return;
    var it = ST.items[ST.k], c = new Chess(it.fen), p = c.get(sq);
    if(ST.sel){
      var legal = c.moves({verbose:true}).filter(function(x){ return x.from === ST.sel && x.to === sq; });
      if(legal.length){ attempt(ST.sel, sq); return; }
    }
    ST.sel = (p && p.color === it.me) ? sq : null;
    draw();
  }

  async function attempt(from, to){
    var it = ST.items[ST.k], c = new Chess(it.fen), mv = c.move({from:from, to:to, promotion:'q'});
    if(!mv) return;
    var uci = from + to + (mv.promotion || '');
    ST.sel = null;
    if(uci === it.playedUci){ ST.msg = 'That is the move you played in the game. Look for something better.'; ST.cls = 'wrong'; draw(); return; }
    if(it.ok && it.ok.indexOf(uci) >= 0){ finish(true, 'Correct! ' + mv.san + (uci === it.best ? ' is the engine\'s choice.' : ' is just as good as the engine\'s first choice.'), 'good'); return; }
    ST.busy = true; ST.msg = 'Checking ' + mv.san + '...'; ST.cls = ''; draw();
    var good = false, Cc = Z();
    try{
      var eng = await Cc.getEngine(function(){});
      var r = await Cc.evalFen(eng, c.fen(), 500, 1);
      var mine = it.me === 'w' ? r.cp : -r.cp;          // your point of view after your move
      good = Cc.winPct(it.cp) - Cc.winPct(mine) <= 4;
    }catch(e){ console.error(e); }
    ST.busy = false;
    if(!ST || ST.items[ST.k] !== it || ST.state !== 'ask') return;
    if(good) finish(true, 'Also strong! ' + mv.san + ' is not the engine\'s first choice, but it is just as good.', 'good');
    else { ST.msg = 'Not quite: ' + mv.san + ' does not solve the problem. Try again' + (ST.hint < 2 ? ' or ask for a hint.' : '.'); ST.cls = 'wrong'; draw(); }
  }

  window.PawniacPuzzles = {
    mount: function(el){ root = el; start(); },
    count: function(){ return load().length; },
    _test: {load:load}
  };
})();
