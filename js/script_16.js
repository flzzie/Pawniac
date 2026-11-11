(function(){
  // Double Move has no check, so it needs its own move generator (script_53.js loads later: look it up at call time)
  function CF(g){ return (window.PawniacChessFor ? window.PawniacChessFor(g && g.variant) : Chess); }
  var FILES = 'abcdefgh';
  var PKEY = 'pawniac-input';
  var P = {dnd:true, premove:true};
  try{ var raw = localStorage.getItem(PKEY); if(raw) Object.assign(P, JSON.parse(raw)); }catch(e){}
  function saveP(){ try{ localStorage.setItem(PKEY, JSON.stringify(P)); }catch(e){} }
  function applyBody(){ document.body.classList.toggle('dnd-on', !!P.dnd); }
  applyBody();

  var PQ = [];            // queued premoves [{gid, from, to}]: up to 2 in Double Move (one per move of your turn), 1 elsewhere
  var firedFen = null;    // the position the last queued premove was played from (stops one premove firing twice)
  var pmSel = null;       // piece picked up for a premove
  var D = null;           // active pointer interaction
  var suppressUntil = 0;  // swallow the click that follows a drag

  // ---------- helpers ----------
  function ctx(){
    var g = gameState;
    if(!g || g.status !== 'active' || !ME) return null;
    var scr = document.getElementById('screen-game');
    if(!scr || scr.style.display !== 'block') return null;
    var me = myRole(g);
    if(!me) return null;
    return {g:g, me:me, myTurn:me.side === g.turn};
  }
  // same conditions the normal click-to-move uses
  function canMoveNow(c){
    return c.myTurn && !pendingPromotion && !!c.g.announced &&
      ((c.g.mode === 'team' && c.me.role === 'hand') || (c.g.mode === 'random' && c.me.role === 'solo'));
  }
  // premoves: Standard Chess, Piece Auction (once the army is placed) and Double Move, while it is the opponent's turn
  function isPmVariant(g){ return !!g && (g.variant === 'standard' || g.variant === 'auction' || g.variant === 'double'); }
  function canPremoveNow(c){
    return P.premove && isPmVariant(c.g) && c.g.mode === 'random' && !c.myTurn;
  }
  function pmMax(g){ return g && g.variant === 'double' ? 2 : 1; }
  // queue a premove; when the queue is full the new one replaces the last
  function pmAdd(g, from, to){
    if(PQ.length >= pmMax(g)) PQ.pop();
    PQ.push({gid:currentGameId, from:from, to:to});
  }
  // the pieces as they will stand after the premoves already queued (so a queued piece can be premoved again)
  function fenAfter(fen, from, to){
    var parts = fen.split(' '), rows = parts[0].split('/').map(function(r){
      var a = [];
      for(var i = 0; i < r.length; i++){ var ch = r.charAt(i); if(ch >= '1' && ch <= '8'){ for(var k = 0; k < +ch; k++) a.push(''); } else a.push(ch); }
      return a;
    });
    function at(sq){ return [8 - parseInt(sq.charAt(1), 10), FILES.indexOf(sq.charAt(0))]; }
    var f = at(from), t = at(to), pc = rows[f[0]][f[1]];
    if(!pc) return fen;
    rows[f[0]][f[1]] = '';
    if((pc === 'P' && t[0] === 0) || (pc === 'p' && t[0] === 7)) pc = pc === 'P' ? 'Q' : 'q';
    if((pc === 'K' || pc === 'k') && Math.abs(t[1] - f[1]) === 2){            // castling: the rook comes along
      var rf = t[1] > f[1] ? 7 : 0, rt = t[1] > f[1] ? 5 : 3;
      rows[f[0]][rt] = rows[f[0]][rf]; rows[f[0]][rf] = '';
    }
    rows[t[0]][t[1]] = pc;
    parts[0] = rows.map(function(row){
      var o = '', n = 0;
      row.forEach(function(x){ if(x){ if(n){ o += n; n = 0; } o += x; } else n++; });
      return o + (n || '');
    }).join('/');
    return parts.join(' ');
  }
  window.PawniacFenAfter = fenAfter;       // the bot screen (script_34.js) uses the same helper
  function pmBase(g){
    var fen = g.fen, n = PQ.length >= pmMax(g) ? PQ.length - 1 : PQ.length;
    for(var i = 0; i < n; i++) fen = fenAfter(fen, PQ[i].from, PQ[i].to);
    return fen;
  }
  function cellOf(target){
    return (target && target.closest) ? target.closest('#screen-game .sq[data-sq]') : null;
  }

  // squares a piece could premove to (ignores enemy blockers and checks, like lichess).
  // Squares holding YOUR OWN piece count too: that is how you premove a recapture,
  // because the square only becomes capturable after your opponent takes your piece.
  function pmDests(chess, from, color){
    var p = chess.get(from);
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
          if(own(s)) break;        // can aim at your own piece (recapture) but not past it
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
      if(f === 4 && r === home && !(window.gameState && window.gameState.variant === 'auction')){
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

  // ---------- the floating piece ----------
  function clearOver(){
    document.querySelectorAll('#screen-game .dnd-over').forEach(function(x){ x.classList.remove('dnd-over'); });
  }
  function removeGhosts(){
    document.querySelectorAll('.dnd-ghost').forEach(function(x){ if(x.parentNode) x.parentNode.removeChild(x); });
  }
  function killGhost(d){
    if(d && d.ghost && d.ghost.parentNode) d.ghost.parentNode.removeChild(d.ghost);
    document.querySelectorAll('.dnd-src').forEach(function(x){ x.classList.remove('dnd-src'); });
  }
  function startGhost(){
    var cell = document.querySelector('#screen-game .sq[data-sq="' + D.from + '"]');
    var pe = cell && cell.querySelector('img.piece-img, span:not(.coord)');
    if(!pe) return false;
    var r = cell.getBoundingClientRect();
    var gh = pe.cloneNode(true);
    gh.removeAttribute('onerror');
    gh.removeAttribute('id');
    gh.className = 'dnd-ghost';
    if(gh.tagName === 'IMG'){
      D.w = D.h = r.width * 0.95;
      gh.style.width = D.w + 'px';
      gh.style.height = D.h + 'px';
      gh.draggable = false;
    } else {
      D.w = D.h = r.width;
      gh.style.fontSize = getComputedStyle(cell).fontSize;
      gh.style.width = D.w + 'px';
      gh.style.height = D.h + 'px';
      gh.style.display = 'block';
      gh.style.textAlign = 'center';
    }
    document.body.appendChild(gh);
    cell.classList.add('dnd-src');
    document.body.classList.add('dnd-dragging');
    D.ghost = gh;
    D.drag = true;
    return true;
  }
  function moveGhost(e){
    D.ghost.style.transform = 'translate(' + (e.clientX - D.w / 2) + 'px,' + (e.clientY - D.h / 2) + 'px)';
    var cell = cellOf(document.elementFromPoint(e.clientX, e.clientY));
    var sq = cell ? cell.dataset.sq : null;
    if(sq !== D.over){
      clearOver();
      D.over = sq;
      if(cell && sq !== D.from && D.dests.indexOf(sq) >= 0) cell.classList.add('dnd-over');
    }
  }
  // after a successful drop: keep the piece on the target square until the server confirms
  function snapGhost(d, cell){
    var gh = d.ghost;
    if(!gh) return;
    var r = cell.getBoundingClientRect();
    if(gh.tagName === 'IMG'){
      var w = r.width * 0.8;
      gh.style.width = w + 'px';
      gh.style.height = w + 'px';
      gh.style.transform = 'translate(' + (r.left + (r.width - w) / 2) + 'px,' + (r.top + (r.height - w) / 2) + 'px)';
    } else {
      gh.style.transform = 'translate(' + r.left + 'px,' + r.top + 'px)';
    }
    var src = document.querySelector('#screen-game .sq[data-sq="' + d.from + '"]');
    if(src){ src.classList.remove('dnd-src'); src.classList.add('dnd-gone'); }
    setTimeout(function(){
      if(gh.parentNode){
        gh.parentNode.removeChild(gh);
        if(ctx()) drawGame();       // safety: the move never arrived, put the board back
      }
    }, 1500);
  }

  // ---------- pointer events ----------
  document.addEventListener('pointerdown', function(e){
    if(D || !e.isPrimary) return;
    if(e.pointerType === 'mouse' && e.button !== 0) return;
    var cell = cellOf(e.target);
    if(!cell) return;
    var c = ctx();
    if(!c) return;
    var sq = cell.dataset.sq, chess = new (CF(c.g))(c.g.fen), mode = null, dests = [];
    if(canMoveNow(c)){
      if(!P.dnd) return;                              // normal clicking handles it
      var allowed = allowedFromSquares(chess, c.g.announced);
      if(!allowed.some(function(m){ return m.from === sq; })) return;
      mode = 'move';
      dests = allowed.filter(function(m){ return m.from === sq; }).map(function(m){ return m.to; });
    } else if(canPremoveNow(c)){
      var pch = new (CF(c.g))(pmBase(c.g));
      var pc = pch.get(sq);
      if(!pc || pc.color !== c.me.side) return;
      // a piece is already picked up and this square of yours is one of its targets: that is a
      // recapture premove, so queue it instead of switching the selection to this piece
      if(pmSel && pmSel !== sq && pmDests(pch, pmSel, c.me.side).indexOf(sq) >= 0){
        e.preventDefault();
        pmAdd(c.g, pmSel, sq);
        pmSel = null;
        drawGame();
        return;
      }
      mode = 'premove';
      dests = pmDests(pch, sq, c.me.side);
    } else {
      return;
    }
    e.preventDefault();
    try{ if(e.target.releasePointerCapture) e.target.releasePointerCapture(e.pointerId); }catch(err){}
    if(mode === 'move'){
      if(selectedSquare !== sq){ selectedSquare = sq; drawGame(); }
    } else {
      if(pmSel !== sq){ pmSel = sq; drawGame(); }
    }
    D = {mode:mode, from:sq, id:e.pointerId, x:e.clientX, y:e.clientY, drag:false, ghost:null, dests:dests, w:0, h:0, over:null};
  });

  document.addEventListener('pointermove', function(e){
    if(!D || e.pointerId !== D.id || !P.dnd) return;
    if(!D.drag){
      if(Math.hypot(e.clientX - D.x, e.clientY - D.y) < 5) return;
      if(!startGhost()){ D = null; return; }
    }
    upgradeDrag(D);
    moveGhost(e);
  });

  // the opponent moved while you were holding a piece for a premove: it is your turn now,
  // so the same drag becomes a normal move instead of being thrown away
  function upgradeDrag(d){
    if(d.mode !== 'premove') return;
    var c = ctx();
    if(!c || !canMoveNow(c)) return;
    var allowed = allowedFromSquares(new (CF(c.g))(c.g.fen), c.g.announced);
    d.mode = 'move';
    d.dests = allowed.filter(function(m){ return m.from === d.from; }).map(function(m){ return m.to; });
    var cell = document.querySelector('#screen-game .sq[data-sq="' + d.from + '"]');
    if(cell) cell.classList.add('dnd-src');
  }
  function drop(d, to){
    var c = ctx();
    if(!c) return false;
    upgradeDrag(d);
    if(d.mode === 'move'){
      if(!canMoveNow(c)) return false;
      if(!to){ selectedSquare = null; drawGame(); return false; }
      if(to === d.from){ drawGame(); return false; }          // dropped back: stays selected
      var chess = new (CF(c.g))(c.g.fen);
      var allowed = allowedFromSquares(chess, c.g.announced);
      var destMoves = allowed.filter(function(m){ return m.from === d.from; });
      var destSquares = new Set(destMoves.map(function(m){ return m.to; }));
      var fromSquares = new Set(allowed.map(function(m){ return m.from; }));
      if(!destSquares.has(to)){ selectedSquare = null; drawGame(); return false; }
      var needsPromo = destMoves.some(function(m){ return m.to === to && m.promotion; });
      selectedSquare = d.from;
      handleSquareClick(to, fromSquares, destSquares, destMoves);   // same code path as clicking
      return !needsPromo;
    }
    // premove
    if(!canPremoveNow(c)) return false;
    if(to && to !== d.from){
      var ch2 = new (CF(c.g))(pmBase(c.g));
      if(pmDests(ch2, d.from, c.me.side).indexOf(to) >= 0){
        pmAdd(c.g, d.from, to);
      }
      pmSel = null;
    } else if(!to){
      pmSel = null;
    }
    drawGame();
    return false;
  }

  document.addEventListener('pointerup', function(e){
    if(!D || e.pointerId !== D.id) return;
    var d = D; D = null;
    clearOver();
    document.body.classList.remove('dnd-dragging');
    if(!d.drag) return;                       // plain click: the piece was already selected on pointerdown
    suppressUntil = Date.now() + 150;
    var cell = cellOf(document.elementFromPoint(e.clientX, e.clientY));
    var to = cell ? cell.dataset.sq : null;
    var sent = false;
    try{ sent = drop(d, to); }catch(err){ console.error('drop failed', err); }
    if(sent && cell) snapGhost(d, cell); else killGhost(d);
  });
  document.addEventListener('pointercancel', function(e){
    if(!D || e.pointerId !== D.id) return;
    var d = D; D = null;
    clearOver();
    document.body.classList.remove('dnd-dragging');
    killGhost(d);
  });

  // a drag ends with a click event: swallow it so it can't select another piece
  document.addEventListener('click', function(e){
    if(Date.now() < suppressUntil){ e.stopPropagation(); e.preventDefault(); }
  }, true);

  // ---------- premove clicks ----------
  document.addEventListener('click', function(e){
    var cell = cellOf(e.target);
    if(!cell) return;
    var c = ctx();
    if(!c || !canPremoveNow(c)) return;
    var sq = cell.dataset.sq, chess = new (CF(c.g))(pmBase(c.g)), p = chess.get(sq);
    if(p && p.color === c.me.side) return;                   // your own pieces are handled on pointerdown
    if(pmSel && pmDests(chess, pmSel, c.me.side).indexOf(sq) >= 0){
      pmAdd(c.g, pmSel, sq);
      pmSel = null;
      drawGame();
      return;
    }
    if(pmSel || PQ.length){ pmSel = null; PQ = []; drawGame(); }  // clicked elsewhere: cancel everything queued
  });
  function cancelPremove(){
    PQ = []; pmSel = null;
    if(ctx()) drawGame();
  }
  document.addEventListener('contextmenu', function(e){
    if((PQ.length || pmSel) && e.target.closest && e.target.closest('#screen-game .board')){
      e.preventDefault();
      cancelPremove();
    }
  });
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && (PQ.length || pmSel)) cancelPremove();
  });

  // ---------- hook into the game screen ----------
  // plays the next queued premove. In Double Move the second one plays after the first has landed (drawGame calls
  // this again with the new position). If one is no longer legal it is dropped together with the ones after it,
  // because those were planned on a board that did not happen.
  function runPremove(g){
    var pm = PQ.shift(); pmSel = null;
    if(!pm) return;
    var mv = new (CF(g))(g.fen).moves({verbose:true}).filter(function(m){
      return m.from === pm.from && m.to === pm.to;
    })[0];
    if(!mv){ PQ = []; return; }
    firedFen = g.fen;
    makeMove(pm.from, pm.to, mv.promotion ? 'q' : undefined);
  }
  function decorate(){
    var g = gameState, scr = document.getElementById('screen-game');
    if(!g || !scr || scr.style.display !== 'block') return;
    var c = ctx();
    if(!c) return;
    function mark(sq, cls){
      var el = scr.querySelector('.sq[data-sq="' + sq + '"]');
      if(el) el.classList.add(cls);
      return el;
    }
    var chess = new (CF(g))(g.fen);
    if(canMoveNow(c)){
      if(P.dnd) allowedFromSquares(chess, g.announced).forEach(function(m){ mark(m.from, 'dnd-from'); });
    } else if(canPremoveNow(c)){
      var side = c.me.side;
      if(P.dnd){
        new (CF(g))(pmBase(g)).board().forEach(function(row, ri){
          row.forEach(function(p, ci){ if(p && p.color === side) mark(FILES[ci] + (8 - ri), 'dnd-from'); });
        });
      }
      PQ.forEach(function(q){ mark(q.from, 'pm-from'); mark(q.to, 'pm-to'); });
      if(pmSel){
        var pch = new (CF(g))(pmBase(g));
        mark(pmSel, 'pm-from');
        pmDests(pch, pmSel, side).forEach(function(s){
          var el = mark(s, 'pm-dest');
          var q = pch.get(s);
          if(el && q) el.classList.add('pm-cap');          // any occupied square gets the capture ring
        });
      }
    }
  }
  var prevDraw = window.drawGame;
  window.drawGame = function(){
    var g = gameState;
    try{
      var std = !!g && g.status === 'active' && isPmVariant(g) && P.premove;
      if(PQ.length && (!std || PQ[0].gid !== currentGameId)) PQ = [];
      if(pmSel && !std) pmSel = null;
      if(std){
        var me = myRole(g);
        if(me && g.turn === me.side){        // opponent just moved
          if(pmSel){                          // you were half-way through a premove: keep the piece selected as a normal move
            var sq0 = pmSel; pmSel = null;
            var pc0 = new (CF(g))(g.fen).get(sq0);
            if(pc0 && pc0.color === me.side && !PQ.length) selectedSquare = sq0;
          }
          if(PQ.length && g.fen !== firedFen) runPremove(g);   // a queued premove plays now (the next one once this has landed)
        }
      }
    }catch(e){ console.error('premove failed', e); }
    prevDraw();
    try{
      if(!D) removeGhosts();
      decorate();
    }catch(e){ console.error('drag decorate failed', e); }
  };

  // ---------- Settings page: extra card with both options ----------
  function row(key, label, hint){
    return '<div class="set-row"><div><div class="set-label">' + label + '</div><div class="hint">' + hint + '</div></div>' +
      '<div class="set-ctl"><label class="switch"><input type="checkbox" data-in="' + key + '"' + (P[key] ? ' checked' : '') + '><span></span></label></div></div>';
  }
  function addCard(){
    var scr = document.getElementById('screen-settings');
    if(!scr || !scr.firstElementChild || scr.querySelector('#inputCard')) return;
    var card = document.createElement('div');
    card.className = 'card';
    card.id = 'inputCard';
    card.innerHTML = '<h2>Moving pieces</h2><p class="desc">Saved on this device.</p>' +
      row('dnd', 'Drag and drop', 'Drag pieces to move them (clicking still works). Works in every game mode.') +
      row('premove', 'Premoves', 'Standard Chess, Piece Auction and Double Move. Queue a move on your opponent\'s turn and it plays automatically if it is legal (Double Move: up to 2, one for each move of your turn). Right-click or Esc cancels them.');
    var reset = document.getElementById('setReset');
    var host = reset && reset.closest('.card');
    if(host) scr.insertBefore(card, host); else scr.appendChild(card);
    card.querySelectorAll('[data-in]').forEach(function(cb){
      cb.onchange = function(){
        P[cb.dataset.in] = cb.checked;
        saveP();
        applyBody();
        if(!P.premove){ PQ = []; pmSel = null; }
      };
    });
  }
  var scr0 = document.getElementById('screen-settings');
  if(scr0) new MutationObserver(addCard).observe(scr0, {childList:true});
})();
