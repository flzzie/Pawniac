(function(){
  // Purely visual. The move is applied instantly like before; the piece just glides there
  // (0.15 seconds) and a captured piece fades out. Nothing in the game waits for it.
  var DUR = 150;
  var reduce = false;
  try{ reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){}

  var lastGid = null, lastFen = null;

  function cellOf(sq){ return document.querySelector('#screen-game .sq[data-sq="' + sq + '"]'); }
  function pieceEl(cell){ return cell ? cell.querySelector('img.piece-img, span:not(.coord)') : null; }
  function placement(f){ return String(f || '').split(' ')[0]; }

  // which single legal move turns the old position into the new one?
  function findMove(oldFen, newFen){
    try{
      var c = new Chess(oldFen), target = placement(newFen), list = c.moves({verbose:true});
      for(var i = 0; i < list.length; i++){
        var m = list[i];
        c.move({from:m.from, to:m.to, promotion:m.promotion});
        var same = placement(c.fen()) === target;
        c.undo();
        if(same) return m;
      }
    }catch(e){}
    return null;
  }

  function slide(from, to){
    var a = cellOf(from), b = cellOf(to), el = pieceEl(b);
    if(!a || !b || !el) return;
    var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    var dx = ra.left - rb.left, dy = ra.top - rb.top;
    if(!dx && !dy) return;
    el.style.transition = 'none';
    el.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    el.style.position = 'relative';
    el.style.zIndex = '6';
    void el.offsetWidth;                         // apply the starting position, then glide
    el.style.transition = 'transform ' + DUR + 'ms ease-out';
    el.style.transform = '';
    setTimeout(function(){ el.style.transition = ''; el.style.zIndex = ''; }, DUR + 40);
  }

  function fadeGhost(html, sq){
    var cell = cellOf(sq);
    if(!cell || !html) return;
    var r = cell.getBoundingClientRect(), box = document.createElement('div');
    box.innerHTML = html;
    var g = box.firstElementChild;
    if(!g) return;
    g.removeAttribute('id');
    g.className = '';
    g.style.cssText = 'position:fixed;left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height +
      'px;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:5;margin:0;padding:0;' +
      'transition:opacity ' + DUR + 'ms ease-out, transform ' + DUR + 'ms ease-out;opacity:1;';
    if(g.tagName === 'IMG'){ g.style.objectFit = 'contain'; g.style.padding = (r.width * 0.05) + 'px'; }
    else { g.style.fontSize = getComputedStyle(cell).fontSize; g.style.lineHeight = '1'; }
    document.body.appendChild(g);
    void g.offsetWidth;
    g.style.opacity = '0';
    g.style.transform = 'scale(.55)';
    setTimeout(function(){ if(g.parentNode) g.parentNode.removeChild(g); }, DUR + 60);
  }

  var prevDraw = window.drawGame;
  window.drawGame = function(){
    var g = window.gameState, snap = null;
    try{
      if(!reduce && g && g.fen){
        var gid = (typeof currentGameId !== 'undefined') ? currentGameId : null;
        if(gid !== lastGid){ lastGid = gid; lastFen = null; }
        if(lastFen && g.fen !== lastFen && !document.querySelector('.dnd-ghost')){   // not after a drag: the dragged piece is already there
          var m = findMove(lastFen, g.fen);
          if(m){
            var capSq = m.to;
            if(m.flags.indexOf('e') >= 0) capSq = m.to.charAt(0) + m.from.charAt(1);   // en passant
            var capCell = m.captured ? cellOf(capSq) : null, capEl = pieceEl(capCell);
            snap = {m:m, capSq:capSq, capHtml: capEl ? capEl.outerHTML : null};
          }
        }
      }
    }catch(e){ console.error('animation prepare failed', e); }

    prevDraw();

    try{
      if(snap){
        slide(snap.m.from, snap.m.to);
        if(snap.m.flags.indexOf('k') >= 0){            // castling: the rook glides too
          var rk = snap.m.to.charAt(1);
          slide('h' + rk, 'f' + rk);
        } else if(snap.m.flags.indexOf('q') >= 0){
          var rq = snap.m.to.charAt(1);
          slide('a' + rq, 'd' + rq);
        }
        if(snap.capHtml) fadeGhost(snap.capHtml, snap.capSq);
      }
      if(g && g.fen) lastFen = g.fen;
    }catch(e){ console.error('animation failed', e); }
  };
})();
