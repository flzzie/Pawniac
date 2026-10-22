(function(){
  var FILES = 'abcdefgh';
  var LAB = {book:['Book move','#6b8fb5'], best:['Best move','#1f9d55'], excellent:['Excellent','#4caf50'], good:['Good','#5f9ea0'],
             inaccuracy:['Inaccuracy','#d4a800'], mistake:['Mistake','#e67e22'], blunder:['Blunder','#d64545']};
  var SF = ['https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js',
            'https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js',
            'https://unpkg.com/stockfish.js@10.0.2/stockfish.js'];
  var L = null, CACHE = {}, E = {p:null, chain:Promise.resolve()}, D = null;

  function esc(s){ return String(s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function winPct(cp){ cp = Math.max(-1000, Math.min(1000, cp)); return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1); }
  function isMate(cp){ return Math.abs(cp) >= 9000; }
  function mateN(cp){ return Math.max(0, Math.round((10000 - Math.abs(cp)) / 10)); }
  function fmt(cp){ return isMate(cp) ? (cp > 0 ? '+' : '-') + 'M' + mateN(cp) : (cp >= 0 ? '+' : '') + (cp / 100).toFixed(2); }
  function words(cp){
    if(isMate(cp)) return (cp > 0 ? 'White' : 'Black') + ' has a forced checkmate';
    var a = Math.abs(cp), s = cp > 0 ? 'White' : 'Black';
    if(a < 25) return 'The position is dead equal';
    if(a < 60) return 'The position is roughly equal';
    if(a < 120) return s + ' is slightly better';
    if(a < 250) return s + ' is clearly better';
    if(a < 500) return s + ' has a big advantage';
    return s + ' is winning';
  }
  function autoQ(){ try{ return !!JSON.parse(localStorage.getItem('pawniac-settings') || '{}').autoQueen; }catch(e){ return false; } }
  function snd(n){ try{ if(typeof window[n] === 'function') window[n](); }catch(e){} }
  function pimg(p){
    return '<img class="piece-img" src="' + pieceImgUrl(p.color, p.type) + '" alt="" draggable="false" onerror="this.outerHTML=\'<span style=&quot;font-size:1em;line-height:1;&quot;>' + PIECE_UNICODE[p.color][p.type] + '</span>\'">';
  }

  // ---------- engine (its own Stockfish worker, loaded the first time you use this) ----------
  function handshake(w){
    return new Promise(function(res, rej){
      var t = setTimeout(function(){ try{ w.terminate(); }catch(e){} rej(new Error('timeout')); }, 25000);
      w.onmessage = function(e){ if(String(e.data).indexOf('uciok') >= 0){ clearTimeout(t); w.onmessage = null; res(w); } };
      w.onerror = function(){ clearTimeout(t); rej(new Error('worker')); };
      w.postMessage('uci');
    });
  }
  function loadEng(){
    if(E.p) return E.p;
    E.p = (async function(){
      if(window.PawniacSF){ try{ return await window.PawniacSF.get(); }catch(e){} }
      for(var a = 0; a < 2; a++) for(var i = 0; i < SF.length; i++){
        try{
          var r = await fetch(SF[i]); if(!r.ok) throw 0;
          var t = await r.text(); if(t.length < 20000) throw 0;
          return await handshake(new Worker(URL.createObjectURL(new Blob([t], {type:'application/javascript'}))));
        }catch(e){}
      }
      return null;
    })();
    E.p.then(function(w){ if(!w) E.p = null; });
    return E.p;
  }
  async function run(fen){
    var c = new Chess(fen), turn = fen.split(' ')[1], sign = turn === 'w' ? 1 : -1;
    if(c.game_over()) return {cp: c.in_checkmate() ? (turn === 'w' ? -10000 : 10000) : 0, best:null, pv:[]};
    var w = await loadEng();
    if(!w) throw new Error('engine');
    return new Promise(function(res, rej){
      var last = null, g = setTimeout(function(){ w.removeEventListener('message', h); rej(new Error('timeout')); }, 40000);
      function h(e){
        var s = String(e.data);
        if(s.indexOf('info') === 0 && s.indexOf(' score ') > 0 && s.indexOf(' pv ') > 0 && !/lowerbound|upperbound/.test(s)){
          var m = /score (cp|mate) (-?\d+)/.exec(s), p = / pv (.+)$/.exec(s);
          if(m && p) last = {t:m[1], v:(window.PawniacSF ? window.PawniacSF.cp(s, m[1], parseInt(m[2], 10)) : parseInt(m[2], 10)), pv:p[1].trim().split(/\s+/)};
        } else if(s.indexOf('bestmove') === 0){
          clearTimeout(g); w.removeEventListener('message', h);
          var bm = s.split(' ')[1], cp = 0;
          if(last) cp = last.t === 'mate' ? (last.v === 0 ? -10000 : (last.v > 0 ? 10000 - 10 * last.v : -(10000 - 10 * (-last.v)))) : last.v;
          res({cp:sign * cp, best:(bm && bm !== '(none)') ? bm : null, pv:last ? last.pv : []});
        }
      }
      w.addEventListener('message', h);
      w.postMessage('setoption name Skill Level value 20');
      w.postMessage('setoption name Contempt value 0');
      w.postMessage('setoption name MultiPV value 1');
      w.postMessage('position fen ' + fen);
      w.postMessage('go depth 15 movetime 3000');
    });
  }
  function ev(fen){
    if(CACHE[fen]) return Promise.resolve(CACHE[fen]);
    var p = E.chain.then(function(){ return run(fen); }).then(function(r){
      if(Object.keys(CACHE).length > 400) CACHE = {};
      CACHE[fen] = r; return r;
    });
    E.chain = p.catch(function(){});
    return p;
  }

  // ---------- the explanation of one move ----------
  function comment(m){
    var C = window.__anCtx, mv = m.mv, col = mv.color, opp = col === 'w' ? 'b' : 'w', sg = col === 'w' ? 1 : -1, side = col === 'w' ? 'White' : 'Black';
    var cpB = sg * m.evB.cp, cpA = sg * m.evA.cp, loss = Math.max(0, winPct(cpB) - winPct(cpA)), lb;
    if(m.uci === m.evB.best) lb = 'best'; else if(loss < 2) lb = 'excellent'; else if(loss < 5) lb = 'good';
    else if(loss < 10) lb = 'inaccuracy'; else if(loss < 15) lb = 'mistake'; else lb = 'blunder';
    var bk = null;     try{ bk = window.__pawBook ? window.__pawBook.rate(m.fenBefore, m.fenAfter, lb, loss, cpB, cpA) : null; }catch(e){}     if(bk){ lb = bk.label; loss = Math.min(loss, bk.loss); }     var bad = (lb === 'inaccuracy' || lb === 'mistake' || lb === 'blunder');
    if(bad && !isMate(cpB) && ((cpB >= 550 && cpA >= 550) || (cpB <= -550 && cpA <= -550))){   // already decided: nothing here changes it
      lb = (lb === 'blunder') ? 'inaccuracy' : 'good'; bad = (lb === 'inaccuracy');
    }
    var lines = [], why = 0, bits = [], fl = mv.flags || '', oside = opp === 'w' ? 'White' : 'Black';
    if(fl.indexOf('k') >= 0) bits.push('castles kingside'); else if(fl.indexOf('q') >= 0) bits.push('castles queenside');
    else {
      if(mv.captured) bits.push('captures the ' + C.NAMES[mv.captured] + ' on ' + mv.to);
      if(mv.promotion) bits.push('promotes to a ' + C.NAMES[mv.promotion]);
    }
    lines.push(side + ' ' + (bits.length ? bits.join(', ') : 'moves the ' + C.NAMES[mv.piece] + ' from ' + mv.from + ' to ' + mv.to) +
      (mv.san.slice(-1) === '+' ? ' and gives check.' : '.'));
    if(mv.san.slice(-1) === '#'){
      var tcm = C.tacticOf(m.fenBefore, mv);
      lines.push('Checkmate' + (tcm ? ': ' + tcm.text : '') + '. The game is over.');
      return {label:lb, loss:loss, lines:lines};
    }
    if(isMate(cpA) && cpA < 0){
      var n1 = mateN(cpA);
      lines.push('This allows a forced checkmate in ' + n1 + ': ' + C.sanLine(m.fenAfter, m.evA.pv, 2 * n1 - 1)); why++;
    } else if(isMate(cpB) && cpB > 0 && !(isMate(cpA) && cpA > 0)){
      var n2 = mateN(cpB);
      lines.push(side + ' had a forced checkmate in ' + n2 + ' and this throws it away: ' + C.sanLine(m.fenBefore, m.evB.pv, 2 * n2 - 1)); why++;
    } else if(isMate(cpA) && cpA > 0){
      var n3 = mateN(cpA);
      lines.push('This keeps a forced checkmate in ' + n3 + ': ' + C.sanLine(m.fenAfter, m.evA.pv, 2 * n3 - 1)); why++;
    }
    try{
      var tc = C.tacticOf(m.fenBefore, mv);
      if(tc && loss < 8){ lines.push(side + ' played ' + tc.text + '.'); why++; }
    }catch(e){}
    try{
      var hw = C.winsFor(m.fenAfter, opp).filter(function(w){ return w.net >= 1; });
      if(hw.length && (loss >= 3 || hw[0].net >= 2)){
        lines.push('After this move ' + hw[0].san + ' wins ' + side + "'s " + C.NAMES[hw[0].piece] + ' on ' + hw[0].to + (hw[0].free ? ' for free.' : ' (about ' + C.plural(hw[0].net, 'point') + ' net).')); why++;
      }
    }catch(e){}
    var reply = m.evA.best ? C.tryMove(m.fenAfter, m.evA.best) : null;
    if(bad && reply){
      try{ var tr = C.tacticOf(m.fenAfter, reply); if(tr){ lines.push(oside + "'s best reply, " + reply.san + ', is ' + tr.text + '.'); why++; } }catch(e){}
    }
    if(lb !== 'best' && loss >= 2 && m.evB.best){
      var bm = C.tryMove(m.fenBefore, m.evB.best);
      if(bm){
        var bt = null; try{ bt = C.tacticOf(m.fenBefore, bm); }catch(e){}
        lines.push('Better was ' + bm.san + (bt ? ', ' + bt.text : (bm.captured ? ' (a capture)' : (/[+#]/.test(bm.san) ? ' (a check)' : ''))) + '. Line: ' + C.sanLine(m.fenBefore, m.evB.pv, 5));
      }
    }
    if(bad && !why) lines.push('No immediate tactic, but the engine rates the alternative higher. The difference is positional: activity, king safety or structure.');
    if(lb === 'best') lines.push('The best move possible in this position.');
    else if(lb === 'excellent') lines.push("Practically as good as the engine's favourite.");
    else if(lb === 'good') lines.push('A fine move. A slightly stronger option existed, but nothing is lost.');
    if(reply && !mv.san.match(/#$/)) lines.push('Best reply for ' + (opp === 'w' ? 'White' : 'Black') + ': ' + reply.san + '. Line: ' + C.sanLine(m.fenAfter, m.evA.pv, 4));
    lines.push(words(m.evA.cp) + ' (' + fmt(m.evA.cp) + ').');     if(bk && bk.note) lines.unshift(bk.note);
    return {label:lb, loss:loss, lines:lines};
  }

  // ---------- state helpers ----------
  function curFen(){ return L.v ? L.moves[L.v - 1].fenAfter : L.fen0; }
  function lastMv(){ return L.v ? {from:L.moves[L.v - 1].mv.from, to:L.moves[L.v - 1].mv.to} : null; }
  function moveNo(fen){ var p = fen.split(' '); return (parseInt(p[5], 10) || 1) + (p[1] === 'w' ? '.' : '...'); }

  async function analyzeMove(m){
    try{
      m.evB = await ev(m.fenBefore);
      m.evA = await ev(m.fenAfter);
      m.res = comment(m); m.state = 'done';
    }catch(e){ console.error('line analysis failed', e); m.state = 'err'; }
    if(L && L.moves.indexOf(m) >= 0 && document.getElementById('tlCard')) draw();
  }
  function makeMove(from, to, promo){
    var fen = curFen(), c = new Chess(fen), mv = c.move({from:from, to:to, promotion:promo || undefined});
    if(!mv) return;
    L.moves.length = L.v;                         // playing from an earlier point replaces the rest of the line
    var m = {mv:mv, uci:from + to + (mv.promotion || ''), fenBefore:fen, fenAfter:c.fen(), state:'pending'};
    L.moves.push(m); L.v++; L.sel = null; L.dests = []; L.promo = null;
    snd(/[+#]/.test(mv.san) ? 'playCheckSound' : (mv.captured ? 'playCaptureSound' : 'playMoveSound'));
    draw();
    analyzeMove(m);
  }
  function tryMake(from, to){
    var l = new Chess(curFen()).moves({verbose:true}).filter(function(x){ return x.from === from && x.to === to; });
    if(!l.length) return;
    if(l[0].promotion && !autoQ()){ L.promo = {from:from, to:to}; L.sel = null; L.dests = []; draw(); return; }
    makeMove(from, to, l[0].promotion ? 'q' : undefined);
  }

  // ---------- drawing ----------
  function boardHtml(fen){
    var c = new Chess(fen), b = c.board(), idx = [0,1,2,3,4,5,6,7], rows = L.flip ? idx.slice().reverse() : idx, cols = rows, last = lastMv(), chk = null;
    if(c.in_check()) for(var r0 = 0; r0 < 8; r0++) for(var f0 = 0; f0 < 8; f0++){
      var p0 = b[r0][f0]; if(p0 && p0.type === 'k' && p0.color === c.turn()) chk = FILES[f0] + (8 - r0);
    }
    var h = '<div class="an-bw"><div class="board">';
    rows.forEach(function(r){ cols.forEach(function(f){
      var sq = FILES[f] + (8 - r), p = b[r][f], cls = 'sq ' + (((r + f) % 2 === 0) ? 'light' : 'dark');
      if(last && (sq === last.from || sq === last.to)) cls += ' last';
      if(L.sel === sq) cls += ' from';
      if(sq === chk) cls += ' in-check';
      if(L.dests.indexOf(sq) >= 0) cls += ' dest' + (p ? ' capture' : '');
      var co = '';
      if(f === cols[0]) co += '<span class="coord rank">' + (8 - r) + '</span>';
      if(r === rows[7]) co += '<span class="coord file">' + FILES[f] + '</span>';
      h += '<div class="' + cls + '" data-tsq="' + sq + '">' + co + (p ? pimg(p) : '') + '</div>';
    }); });
    h += '</div>';
    var e = CACHE[fen];
    if(L.hint && e && e.best){
      var a = e.best.slice(0, 2), z = e.best.slice(2, 4);
      var f1 = a.charCodeAt(0) - 97, r1 = 8 - parseInt(a.charAt(1), 10), f2 = z.charCodeAt(0) - 97, r2 = 8 - parseInt(z.charAt(1), 10);
      var x1 = (L.flip ? 7 - f1 : f1) + .5, y1 = (L.flip ? 7 - r1 : r1) + .5, x2 = (L.flip ? 7 - f2 : f2) + .5, y2 = (L.flip ? 7 - r2 : r2) + .5;
      var dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy) || 1; x2 -= dx / len * .32; y2 -= dy / len * .32;
      h += '<svg class="an-arrows" viewBox="0 0 8 8"><defs><marker id="tlArr" markerWidth="4" markerHeight="4" refX="2.2" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4z" fill="#1f9d55"/></marker></defs>' +
           '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="#1f9d55" stroke-width=".17" stroke-linecap="round" opacity=".85" marker-end="url(#tlArr)"/></svg>';
    }
    return h + '</div>';
  }
  function panelHtml(){
    var fen = curFen(), c = new Chess(fen), e = CACHE[fen], h = '';
    if(L.promo){
      h += '<div class="hint" style="margin-bottom:8px;">Promote to:</div><div class="types">' +
        [['q','Queen'],['r','Rook'],['b','Bishop'],['n','Knight']].map(function(x){ return '<button data-tp="' + x[0] + '">' + x[1] + '</button>'; }).join('') +
        '</div><button class="secondary" id="tlPromoCancel" style="margin:8px 0 12px;">Cancel</button>';
    }
    if(!L.v){
      h += '<div class="an-title">Your line</div><p class="an-note" style="margin-top:8px;">Play any move for White or Black (click or drag). The engine rates each move and explains it. Evals use the standard sign: + means White is ahead.</p>';
    } else {
      var m = L.moves[L.v - 1];
      h += '<div class="an-title">' + esc(moveNo(m.fenBefore) + ' ' + m.mv.san);
      if(m.state === 'done') h += ' <span class="an-chip" style="background:' + LAB[m.res.label][1] + '">' + LAB[m.res.label][0] + '</span>';
      h += '</div>';
      if(m.state === 'pending') h += '<p class="an-note" style="margin-top:8px;">The engine is checking this move...</p>';
      else if(m.state === 'err') h += '<p class="an-note an-err">The engine could not load (check your connection or ad blocker), so this move cannot be rated. <span class="backlink" id="tlRetry">Retry</span></p>';
      else {
        h += '<div class="an-evline">Eval: ' + fmt(m.evB.cp) + '  ->  ' + fmt(m.evA.cp) + '</div>';
        h += m.res.lines.map(function(t){ return '<p class="an-note">' + esc(t) + '</p>'; }).join('');
      }
    }
    h += '<div class="an-sec"><h4>This position</h4>';
    if(c.in_checkmate()) h += '<p class="an-note">Checkmate.</p>';
    else if(c.game_over()) h += '<p class="an-note">The game is drawn here.</p>';
    else if(e) h += '<p class="an-note">' + esc(words(e.cp) + ' (' + fmt(e.cp) + '). ' + (c.turn() === 'w' ? 'White' : 'Black') + ' to move.') + '</p>' +
      (L.hint && e.best ? '<p class="an-note"><b>Engine suggests ' + esc((window.__anCtx.tryMove(fen, e.best) || {san:e.best}).san) + '</b>' + (e.pv.length ? ': ' + esc(window.__anCtx.sanLine(fen, e.pv, 5)) : '') + '</p>' : '');
    else if(L.err) h += '<p class="an-note an-err">The engine could not load. <span class="backlink" id="tlRetry">Retry</span></p>';
    else h += '<p class="an-note">The engine is thinking...</p>';
    return h + '</div>';
  }
  function movesHtml(){
    if(!L.moves.length) return '';
    var h = '<div class="tl-mv">';
    L.moves.forEach(function(m, i){
      if(m.mv.color === 'w' || i === 0) h += '<span class="tl-n">' + moveNo(m.fenBefore) + '</span>';
      var col = (m.state === 'done') ? LAB[m.res.label][1] : '#b8b3a4';
      h += '<span class="an-m' + (L.v === i + 1 ? ' sel' : '') + '" data-tv="' + (i + 1) + '"><span class="an-dot" style="background:' + col + '"></span>' + esc(m.mv.san) + '</span>';
    });
    return h + '</div>';
  }
  function draw(){
    var card = document.getElementById('tlCard');
    if(!card || !L) return;
    var fen = curFen(), c = new Chess(fen), e = CACHE[fen];
    document.getElementById('tlBoard').innerHTML = boardHtml(fen);
    document.getElementById('tlPanel').innerHTML = panelHtml();
    document.getElementById('tlMoves').innerHTML = movesHtml();
    var bar = document.querySelector('#tlBar div');
    if(bar){
      bar.style.height = (e ? winPct(e.cp) : 50) + '%';
      bar.style.top = L.flip ? '0' : 'auto'; bar.style.bottom = L.flip ? 'auto' : '0';
    }
    var q = function(id){ return document.getElementById(id); };
    q('tlEng').disabled = c.game_over();
    q('tlUndo').disabled = !L.v;
    q('tlHint').textContent = L.hint ? 'Hide best move' : 'Best move';
    card.querySelectorAll('[data-tv]').forEach(function(el){ el.onclick = function(){ L.v = +el.dataset.tv; L.sel = null; L.dests = []; L.promo = null; draw(); }; });
    card.querySelectorAll('[data-tp]').forEach(function(b){ b.onclick = function(){ var p = L.promo; if(p) makeMove(p.from, p.to, b.dataset.tp); }; });
    var pc = q('tlPromoCancel'); if(pc) pc.onclick = function(){ L.promo = null; draw(); };
    var rt = q('tlRetry'); if(rt) rt.onclick = function(){ L.err = false; L.asked = {}; L.moves.forEach(function(m){ if(m.state === 'err'){ m.state = 'pending'; analyzeMove(m); } }); draw(); };
    if(!e && !L.asked[fen]){
      L.asked[fen] = 1;
      ev(fen).then(function(){ if(L && curFen() === fen && document.getElementById('tlCard')) draw(); })
             .catch(function(){ if(L && curFen() === fen){ L.err = true; if(document.getElementById('tlCard')) draw(); } });
    }
  }

  // ---------- opening and closing ----------
  function open(){
    var H = window.__anHook, A = H && H.data(), tab = document.getElementById('anBoardTab');
    if(!A || !tab || document.getElementById('tlCard')) return;
    var orig = tab.firstElementChild;
    var card = document.createElement('div');
    card.className = 'card'; card.id = 'tlCard';
    card.innerHTML = '<h2>Try a line</h2><p class="desc">Play your own moves from the position you were looking at. The engine rates every move and tells you why.</p>' +
      '<div class="tl-main"><div><div class="an-boardcol"><div class="an-evalbar" id="tlBar"><div></div></div><div id="tlBoard"></div></div>' +
        '<div class="an-ctrl"><button class="secondary" id="tlUndo">Undo</button><button class="secondary" id="tlReset">Reset</button><button class="secondary" id="tlFlip">Flip</button>' +
        '<button class="secondary" id="tlHint">Best move</button><button class="secondary" id="tlEng">Engine move</button><button id="tlBack">Back to the game</button></div></div>' +
      '<div class="tl-side"><div id="tlPanel"></div><div class="an-moves" id="tlMoves"></div></div></div>';
    orig.style.display = 'none';
    tab.appendChild(card);
    L = {fen0:A.fens[A.sel], v:0, moves:[], sel:null, dests:[], flip:!!A.flip, hint:false, asked:{}, promo:null, err:false};
    var q = function(id){ return document.getElementById(id); };
    q('tlBack').onclick = function(){ card.remove(); orig.style.display = ''; L = null; };
    q('tlUndo').onclick = function(){ if(L.v){ L.moves.length = L.v - 1; L.v--; L.sel = null; L.dests = []; L.promo = null; draw(); } };
    q('tlReset').onclick = function(){ L.moves = []; L.v = 0; L.sel = null; L.dests = []; L.promo = null; draw(); };
    q('tlFlip').onclick = function(){ L.flip = !L.flip; draw(); };
    q('tlHint').onclick = function(){ L.hint = !L.hint; draw(); };
    q('tlEng').onclick = async function(){
      var fen = curFen(), b = q('tlEng');
      try{
        b.disabled = true;
        var e = await ev(fen);
        if(L && curFen() === fen && e.best) makeMove(e.best.slice(0, 2), e.best.slice(2, 4), e.best.slice(4, 5) || undefined);
      }catch(x){ console.error(x); }
      if(L) draw();
    };
    draw();
    loadEng();                                    // warm the engine up
  }

  // button on the Board tab
  function addBtn(){
    var f = document.getElementById('anFlip');
    if(!f || document.getElementById('tlOpen')) return;
    var b = document.createElement('button');
    b.className = 'secondary'; b.id = 'tlOpen'; b.textContent = 'Try a line';
    b.title = 'Play your own moves from here and let the engine rate them';
    f.after(b);
    b.onclick = open;
  }
  var scr = document.getElementById('screen-analyze');
  if(scr) new MutationObserver(function(){
    addBtn();
    if(L && !document.getElementById('tlCard')) L = null;     // the analysis was reset
  }).observe(scr, {childList:true, subtree:true});

  // ---------- moving pieces: click or drag ----------
  function cellOf(t){ return (t && t.closest) ? t.closest('#tlBoard .sq[data-tsq]') : null; }
  function clearGhost(){
    document.querySelectorAll('.dnd-ghost').forEach(function(x){ x.remove(); });
    document.querySelectorAll('#tlBoard .dnd-src').forEach(function(x){ x.classList.remove('dnd-src'); });
    document.body.classList.remove('dnd-dragging');
  }
  document.addEventListener('pointerdown', function(e){
    if(D || !L || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    var cell = cellOf(e.target);
    if(!cell || L.promo) return;
    var sq = cell.dataset.tsq, c = new Chess(curFen()), p = c.get(sq);
    e.preventDefault();
    if(L.sel && L.dests.indexOf(sq) >= 0){ tryMake(L.sel, sq); return; }
    if(p && p.color === c.turn()){
      L.sel = sq;
      L.dests = c.moves({verbose:true}).filter(function(m){ return m.from === sq; }).map(function(m){ return m.to; });
      draw();
      D = {from:sq, id:e.pointerId, x:e.clientX, y:e.clientY, drag:false, ghost:null, w:0};
    } else { L.sel = null; L.dests = []; draw(); }
  });
  document.addEventListener('pointermove', function(e){
    if(!D || e.pointerId !== D.id) return;
    if(!D.drag){
      if(Math.hypot(e.clientX - D.x, e.clientY - D.y) < 5) return;
      var cell = document.querySelector('#tlBoard .sq[data-tsq="' + D.from + '"]'), pe = cell && cell.querySelector('img.piece-img, span:not(.coord)');
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
    if(!d.drag) return;
    var cell = cellOf(document.elementFromPoint(e.clientX, e.clientY)), to = cell ? cell.dataset.tsq : null;
    clearGhost();
    if(L && to && to !== d.from && L.dests.indexOf(to) >= 0) tryMake(d.from, to); else if(L) draw();
  });
  document.addEventListener('pointercancel', function(e){
    if(!D || e.pointerId !== D.id) return;
    D = null; clearGhost(); if(L) draw();
  });

  // arrow keys step through your line (and stop the game's own arrow keys while this is open)
  document.addEventListener('keydown', function(e){
    if(!L || !document.getElementById('tlCard')) return;
    var t = e.target && e.target.tagName;
    if(t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return;
    if(e.key === 'ArrowLeft' || e.key === 'ArrowRight'){
      e.stopPropagation(); e.preventDefault();
      L.v = Math.max(0, Math.min(L.moves.length, L.v + (e.key === 'ArrowRight' ? 1 : -1)));
      L.sel = null; L.dests = []; L.promo = null; draw();
    }
  }, true);
})();
