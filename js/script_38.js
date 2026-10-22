(function(){
  var D = null, self = false, supUntil = 0;

  function cellOf(t){ return (t && t.closest) ? t.closest('#screen-quiz .sq.qz-cell[data-qsq]') : null; }
  function cellFor(sq){ return document.querySelector('#screen-quiz .sq.qz-cell[data-qsq="' + sq + '"]'); }
  function press(cell){ self = true; try{ cell.click(); } finally { self = false; } }
  function clearGhost(){
    document.querySelectorAll('.dnd-ghost').forEach(function(x){ x.remove(); });
    document.querySelectorAll('#screen-quiz .dnd-src').forEach(function(x){ x.classList.remove('dnd-src'); });
    document.body.classList.remove('dnd-dragging');
  }

  // the quiz handles clicks itself; we trigger them from pointer events, so real clicks are blocked
  document.addEventListener('click', function(e){
    if(self) return;
    if(cellOf(e.target)){ e.stopPropagation(); e.preventDefault(); }
  }, true);

  document.addEventListener('pointerdown', function(e){
    if(D || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    var cell = cellOf(e.target);
    if(!cell) return;
    e.preventDefault();
    var sq = cell.dataset.qsq, hadPiece = !!cell.querySelector('img.piece-img, span:not(.coord)');
    press(cell);                                   // select the piece, or play the move if this is a target square
    if(!hadPiece) return;
    var now = cellFor(sq);                         // the board was redrawn: find the square again
    if(!now || !now.classList.contains('from')) return;   // not selected (wrong piece, or the move was just played)
    D = {from:sq, id:e.pointerId, x:e.clientX, y:e.clientY, drag:false, ghost:null, w:0};
  });

  document.addEventListener('pointermove', function(e){
    if(!D || e.pointerId !== D.id) return;
    if(!D.drag){
      if(Math.hypot(e.clientX - D.x, e.clientY - D.y) < 5) return;
      var cell = cellFor(D.from), pe = cell && cell.querySelector('img.piece-img, span:not(.coord)');
      if(!pe){ D = null; return; }
      var r = cell.getBoundingClientRect(), gh = pe.cloneNode(true);
      gh.removeAttribute('onerror');
      gh.className = 'dnd-ghost';
      gh.draggable = false;
      D.w = r.width * 0.95;
      gh.style.width = D.w + 'px';
      gh.style.height = D.w + 'px';
      if(gh.tagName !== 'IMG'){
        gh.style.fontSize = getComputedStyle(cell).fontSize;
        gh.style.display = 'block';
        gh.style.textAlign = 'center';
      }
      document.body.appendChild(gh);
      cell.classList.add('dnd-src');
      document.body.classList.add('dnd-dragging');
      D.ghost = gh; D.drag = true;
    }
    D.ghost.style.transform = 'translate(' + (e.clientX - D.w / 2) + 'px,' + (e.clientY - D.w / 2) + 'px)';
  });

  document.addEventListener('pointerup', function(e){
    if(!D || e.pointerId !== D.id) return;
    var d = D; D = null;
    if(!d.drag) return;                            // plain click: already handled on pointerdown
    supUntil = Date.now() + 150;
    var target = cellOf(document.elementFromPoint(e.clientX, e.clientY));
    clearGhost();
    if(target && target.dataset.qsq !== d.from) press(target);   // same code path as clicking the target square
  });

  document.addEventListener('pointercancel', function(e){
    if(!D || e.pointerId !== D.id) return;
    D = null; clearGhost();
  });
})();
