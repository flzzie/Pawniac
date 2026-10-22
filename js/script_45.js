(function(){
  // Right-click a square = circle. Right-click and drag = arrow. Same again = removes it.
  // Colours: plain = green, Shift = red, Ctrl/Cmd = blue, Alt = yellow.
  // A normal left click on the board, or any new move, clears them. Works in games, bot games, Analyze and Try a line.
  var COL = {g:'#15781B', r:'#882020', b:'#003088', y:'#e68f00'};
  var ST = {}, drag = null, queued = false;

  function sqOf(el){
    var c = el && el.closest ? el.closest('.sq') : null; if(!c) return null;
    var s = c.dataset.sq || c.dataset.tsq; return s ? {c:c, s:s} : null;
  }
  function boardOf(el){ return el && el.closest ? el.closest('.board') : null; }
  function keyOf(b){
    var scr = b.closest('[id^="screen-"]'), k = scr ? scr.id : 'x';
    if(b.closest('#tlBoard')) k += ':tl'; if(b.closest('#anBoard')) k += ':an';
    return k;
  }
  function sigOf(b){
    var a = [];
    b.querySelectorAll('.sq').forEach(function(c){
      var s = c.dataset.sq || c.dataset.tsq; if(!s) return;
      var im = c.querySelector('img.piece-img'), sp = c.querySelector('span:not(.coord)');
      a.push(s + '=' + (im ? im.getAttribute('src') : (sp ? sp.textContent : '')));
    });
    return a.sort().join('|');
  }
  function colorOf(e){ return e.shiftKey ? 'r' : (e.ctrlKey || e.metaKey) ? 'b' : e.altKey ? 'y' : 'g'; }
  function cellOf(b, sq){ return b.querySelector('.sq[data-sq="' + sq + '"], .sq[data-tsq="' + sq + '"]'); }
  function center(b, sq){
    var c = cellOf(b, sq); if(!c) return null;
    var r = c.getBoundingClientRect(), br = b.getBoundingClientRect();
    return {x:r.left - br.left + r.width / 2, y:r.top - br.top + r.height / 2, s:r.width};
  }
  function ovr(b){ for(var i = 0; i < b.children.length; i++) if(b.children[i].classList && b.children[i].classList.contains('pn-ann')) return b.children[i]; return null; }
  function stampOf(b, S){
    var first = b.querySelector('.sq'), fs = first ? (first.dataset.sq || first.dataset.tsq) : '';
    return S.v + ':' + b.offsetWidth + ':' + fs;
  }
  function render(b, pv){
    var old = ovr(b); if(old) old.remove();
    var S = ST[keyOf(b)], items = S ? S.items.slice() : [];
    if(pv) items.push(pv);
    if(!items.length) return;
    var W = b.offsetWidth, Hh = b.offsetHeight, NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'pn-ann'); svg.setAttribute('width', W); svg.setAttribute('height', Hh);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + Hh);
    if(S && !pv) svg.dataset.stamp = stampOf(b, S);
    items.forEach(function(it){
      var col = COL[it.k] || COL.g;
      if(it.t === 'c'){
        var c = center(b, it.s); if(!c) return;
        var ci = document.createElementNS(NS, 'circle');
        ci.setAttribute('cx', c.x); ci.setAttribute('cy', c.y); ci.setAttribute('r', c.s * 0.44);
        ci.setAttribute('fill', 'none'); ci.setAttribute('stroke', col); ci.setAttribute('stroke-width', c.s * 0.07); ci.setAttribute('opacity', '0.8');
        svg.appendChild(ci);
      } else {
        var a = center(b, it.f), z = center(b, it.to); if(!a || !z) return;
        var dx = z.x - a.x, dy = z.y - a.y, len = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / len, uy = dy / len, s = a.s;
        var head = s * 0.34, sx = a.x + ux * s * 0.2, sy = a.y + uy * s * 0.2, bx = z.x - ux * head, by = z.y - uy * head;
        var ln = document.createElementNS(NS, 'line');
        ln.setAttribute('x1', sx); ln.setAttribute('y1', sy); ln.setAttribute('x2', bx); ln.setAttribute('y2', by);
        ln.setAttribute('stroke', col); ln.setAttribute('stroke-width', s * 0.15); ln.setAttribute('stroke-linecap', 'round'); ln.setAttribute('opacity', '0.8');
        var tri = document.createElementNS(NS, 'polygon');
        tri.setAttribute('points', z.x + ',' + z.y + ' ' + (bx - uy * s * 0.2) + ',' + (by + ux * s * 0.2) + ' ' + (bx + uy * s * 0.2) + ',' + (by - ux * s * 0.2));
        tri.setAttribute('fill', col); tri.setAttribute('opacity', '0.8');
        svg.appendChild(ln); svg.appendChild(tri);
      }
    });
    b.appendChild(svg);
  }
  function sync(){
    queued = false;
    document.querySelectorAll('.board').forEach(function(b){
      var S = ST[keyOf(b)], o = ovr(b);
      if(!S || !S.items.length){ if(o && !drag) o.remove(); return; }
      if(S.sig !== sigOf(b)){ S.items = []; S.v++; if(o) o.remove(); return; }   // a move was made: clear
      if(o && o.dataset.stamp === stampOf(b, S)) return;
      if(!drag) render(b);
    });
  }
  function queue(){ if(!queued){ queued = true; requestAnimationFrame(sync); } }
  function clearBoard(b){
    var S = ST[keyOf(b)];
    if(S && S.items.length){ S.items = []; S.v++; var o = ovr(b); if(o) o.remove(); }
  }
  function toggle(b, item){
    var k = keyOf(b), S = ST[k] || (ST[k] = {items:[], v:0, sig:''});
    var same = function(x){ return x.t === item.t && x.s === item.s && x.f === item.f && x.to === item.to; };
    var idx = -1; S.items.forEach(function(x, i){ if(same(x)) idx = i; });
    if(idx >= 0){ if(S.items[idx].k === item.k) S.items.splice(idx, 1); else S.items[idx].k = item.k; }
    else S.items.push(item);
    S.sig = sigOf(b); S.v++;
    var o = ovr(b); if(o) o.remove();
    render(b);
  }

  window.addEventListener('pointerdown', function(e){
    if(e.button === 2 && boardOf(e.target) && sqOf(e.target)) e.stopImmediatePropagation();   // keep drag and drop from starting
  }, true);
  window.addEventListener('mousedown', function(e){
    var b = boardOf(e.target);
    if(!b) return;
    if(e.button === 0){ clearBoard(b); return; }
    if(e.button !== 2) return;
    var q = sqOf(e.target); if(!q) return;
    e.preventDefault(); e.stopImmediatePropagation();
    drag = {b:b, from:q.s, last:q.s, k:colorOf(e)};
  }, true);
  window.addEventListener('mousemove', function(e){
    if(!drag) return;
    var q = sqOf(e.target); if(!q || q.s === drag.last) return;
    drag.last = q.s;
    render(drag.b, q.s === drag.from ? {t:'c', s:q.s, k:drag.k} : {t:'a', f:drag.from, to:q.s, k:drag.k});
  }, true);
  window.addEventListener('mouseup', function(e){
    if(!drag || e.button !== 2) return;
    var d = drag; drag = null;
    var q = sqOf(e.target);
    if(!q || boardOf(e.target) !== d.b){ render(d.b); return; }
    e.preventDefault();
    toggle(d.b, q.s === d.from ? {t:'c', s:q.s, k:d.k} : {t:'a', f:d.from, to:q.s, k:d.k});
  }, true);
  window.addEventListener('contextmenu', function(e){
    if(boardOf(e.target) && sqOf(e.target)) e.preventDefault();   // no browser menu on the board
  }, true);
  window.addEventListener('keydown', function(e){
    if(e.key === 'Escape') document.querySelectorAll('.board').forEach(clearBoard);
  });
  new MutationObserver(queue).observe(document.body, {childList:true, subtree:true});
  window.addEventListener('resize', queue);
})();
