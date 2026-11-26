// Daily puzzle: one mate puzzle a day, the same for everyone, with a streak.
// The puzzles are in js/puzzle_data.js (window.PAWNIAC_PUZZLES = [{f: fen, n: mate in n, s: first move}]).
// The streak lives at hb/puzzle/<username> = {last, streak, best, hide} and shows on the profile unless the player hides it.
(function(){
  'use strict';
  var DAY_SHIFT_MIN = 330;            // the puzzle changes at midnight India time (UTC+5:30). Change this to move it.
  var DATA = window.PAWNIAC_PUZZLES || [];
  function $(id){ return document.getElementById(id); }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]; }); }
  function loggedIn(){ return typeof ME !== 'undefined' && !!ME && !!ME.username; }
  function Z(){ return window.__anCore; }

  // ---------- which day is it ----------
  function dayNo(off){ return Math.floor((serverNow() + DAY_SHIFT_MIN * 60000) / 86400000) + (off || 0); }
  function dayKey(off){ return new Date(dayNo(off) * 86400000).toISOString().slice(0, 10); }

  // ---------- tiny mate solver (attacker to move) ----------
  // wins(c, n, co): can the side to move force mate in at most n? co = the attacker may only give checks (fast).
  function wins(c, n, co){
    var ms = c.moves({verbose:true});
    for(var i = 0; i < ms.length; i++){
      c.move(ms[i]);
      var ok = false;
      if(c.in_checkmate()) ok = true;
      else if(n > 1 && !c.game_over() && (c.in_check() || !co)){
        var ds = c.moves({verbose:true});
        ok = ds.length > 0;
        for(var j = 0; ok && j < ds.length; j++){ c.move(ds[j]); if(!wins(c, n - 1, co)) ok = false; c.undo(); }
      }
      c.undo();
      if(ok) return true;
    }
    return false;
  }
  // does this move keep a forced mate within `rem` moves?
  function goodMove(c, mv, rem){
    c.move(mv);
    var ok = false;
    if(c.in_checkmate()) ok = true;
    else if(rem > 1 && !c.game_over()){
      var co = rem - 1 >= 2, ds = c.moves({verbose:true});
      ok = ds.length > 0;
      for(var j = 0; ok && j < ds.length; j++){ c.move(ds[j]); if(!wins(c, rem - 1, co)) ok = false; c.undo(); }
    }
    c.undo();
    return ok;
  }
  // the defender's most stubborn reply (the one that delays mate longest)
  function bestDefence(c, rem){
    var ds = c.moves({verbose:true}), best = null, bestK = -1;
    for(var i = 0; i < ds.length; i++){
      c.move(ds[i]);
      var k = 0;
      for(var t = 1; t <= rem - 1 && !k; t++) if(wins(c, t, t >= 2)) k = t;
      c.undo();
      if(k > bestK){ bestK = k; best = ds[i]; }
    }
    return best;
  }

  // ---------- state ----------
  var P = null, root = null, ST = {mine:null, loaded:false};
  function puzzleAt(off){ return DATA.length ? DATA[((dayNo(off) % DATA.length) + DATA.length) % DATA.length] : null; }
  function start(off){
    var pz = puzzleAt(off);
    if(!pz){ P = null; return; }
    var c = new Chess(pz.f), side = c.turn();
    P = {off:off || 0, pz:pz, c:c, side:side, rem:pz.n, sel:null, state:'ask', msg:'', cls:'', hint:0, busy:false, last:null, stepFen:pz.f};
  }

  // ---------- streak ----------
  function shownStreak(d){
    if(!d || !d.streak) return 0;
    return (d.last === dayKey(0) || d.last === dayKey(-1)) ? d.streak : 0;
  }
  async function loadMine(){
    if(!loggedIn()){ ST.mine = null; ST.loaded = true; return; }
    try{ ST.mine = (await db.ref('hb/puzzle/' + ME.username).once('value')).val() || {}; }catch(e){ ST.mine = {}; }
    ST.loaded = true;
  }
  async function recordSolve(){
    if(!loggedIn() || P.off !== 0) return;
    var d = ST.mine || {}, today = dayKey(0);
    if(d.last === today) return;
    var streak = d.last === dayKey(-1) ? (d.streak || 0) + 1 : 1;
    var upd = {last:today, streak:streak, best:Math.max(d.best || 0, streak)};
    if(typeof d.hide === 'boolean') upd.hide = d.hide;
    try{
      await db.ref('hb/puzzle/' + ME.username).update(upd);
      ST.mine = Object.assign({}, d, upd);
      P.msg = 'Solved! Your streak is now ' + streak + ' day' + (streak === 1 ? '' : 's') + '.';
    }catch(e){ console.error('streak save failed', e); P.msg = 'Solved! (Your streak could not be saved right now.)'; }
  }

  // ---------- drawing ----------
  var NAMES = {n:'knight', b:'bishop', r:'rook', q:'queen', k:'king', p:'pawn'};
  function draw(){
    if(!root) return;
    if(!DATA.length){ root.innerHTML = '<div class="card"><h2>Daily puzzle</h2><p class="desc">No puzzles yet.</p></div>'; return; }
    if(!P) start(0);
    var C = Z(), flip = P.side === 'b', dests = [], pc = P.c, today = P.off === 0;
    if(P.sel && P.state === 'ask'){
      dests = pc.moves({verbose:true}).filter(function(m){ return m.from === P.sel; }).map(function(m){ return m.to; });
    }
    var solved = P.state === 'solved', arrows = [];
    if(P.state === 'shown' && P.show) arrows = [{from:P.show.from, to:P.show.to, color:'#1f9d55'}];
    var opts = {sel:P.sel, dests:dests, hintFrom:(P.hint >= 2 && P.state === 'ask') ? hintMove().from : null};
    var title = today ? 'Daily puzzle' : 'Practice puzzle';
    var info = '<div class="an-title">' + title + '</div>' +
      '<p class="an-note" style="margin-top:8px;">' + (P.side === 'w' ? 'White' : 'Black') + ' to move and mate in <b>' + P.pz.n + '</b>' +
      (P.pz.n > 1 && P.state === 'ask' ? ' (' + P.rem + ' to go)' : '') + '. Click a piece, then where it goes.</p>';
    if(P.state === 'ask'){
      if(P.hint >= 1) info += '<div class="an-fb"><b>Hint:</b> ' + esc(hintText()) + '</div>';
      if(P.msg) info += '<div class="an-fb ' + P.cls + '">' + esc(P.msg) + '</div>';
      info += '<div class="an-prbtns"><button class="secondary" id="dpHint"' + (P.busy || P.hint >= 2 ? ' disabled' : '') + '>' + (P.hint ? 'More help' : 'Hint') + '</button>' +
        '<button class="secondary" id="dpShow"' + (P.busy ? ' disabled' : '') + '>Show the move</button></div>';
    } else {
      info += '<div class="an-fb ' + (solved ? 'good' : '') + '">' + esc(P.msg) + '</div>' +
        '<div class="an-prbtns"><button id="dpMore">Another puzzle</button>' + (today ? '' : '<button class="secondary" id="dpToday">Back to today\'s</button>') + '</div>';
    }
    var streakBox = '';
    if(loggedIn()){
      var d = ST.mine || {}, n = shownStreak(d);
      streakBox = '<div class="card dp-streak"><div class="dp-big">' + n + '</div><div><b>day streak</b><div class="hint" style="margin:2px 0 0;">Best: ' + (d.best || 0) + (d.last === dayKey(0) ? ' &middot; today is done' : (today ? ' &middot; solve today\'s to keep it going' : '')) + '</div></div></div>' +
        '<label class="dp-hide"><input type="checkbox" id="dpHide"' + (d.hide ? ' checked' : '') + '> Hide my streak from my profile</label>';
    } else {
      streakBox = '<div class="card"><div class="hint" style="margin:0;">Log in to keep a daily streak that shows on your profile.</div></div>';
    }
    root.innerHTML = '<div class="dp-wrap"><div class="card"><div class="an-main"><div>' + C.boardHtml(pc.fen(), null, arrows, flip, opts) + '</div><div class="an-side">' + info + '</div></div></div>' +
      '<div class="dp-side">' + streakBox + '</div></div>';
    wire();
  }
  function hintMove(){
    var sols = solutions();
    return sols[0] || {from:'a1', to:'a1', piece:'p'};
  }
  function solutions(){
    var out = [], ms = P.c.moves({verbose:true});
    ms.forEach(function(m){ if(m.promotion && m.promotion !== 'q') return; if(goodMove(P.c, m, P.rem)) out.push(m); });
    return out;
  }
  function hintText(){
    var m = hintMove();
    return P.hint >= 2 ? 'Look at your ' + NAMES[m.piece] + ' on ' + m.from + '.' : 'The move is made with a ' + NAMES[m.piece] + '.';
  }

  function wire(){
    root.querySelectorAll('.sq[data-sq]').forEach(function(cell){ cell.style.cursor = 'pointer'; cell.onclick = function(){ click(cell.dataset.sq); }; });
    var h = $('dpHint'); if(h) h.onclick = function(){ P.hint = Math.min(2, P.hint + 1); draw(); };
    var sh = $('dpShow'); if(sh) sh.onclick = function(){
      var m = hintMove(); P.show = m; P.state = 'shown';
      P.msg = 'The move was ' + m.san + '. Try tomorrow\'s, or another puzzle now. A shown move does not count for your streak.'; draw();
    };
    var mo = $('dpMore'); if(mo) mo.onclick = function(){ start((P.off || 0) + 1); draw(); };
    var td = $('dpToday'); if(td) td.onclick = function(){ start(0); draw(); };
    var hd = $('dpHide'); if(hd) hd.onchange = async function(){
      if(!loggedIn()) return;
      var d = ST.mine || {}; d.hide = hd.checked; ST.mine = d;
      try{
        var cur = (await db.ref('hb/puzzle/' + ME.username).once('value')).val() || {};
        var upd = {last:cur.last || '', streak:cur.streak || 0, best:cur.best || 0, hide:hd.checked};
        await db.ref('hb/puzzle/' + ME.username).update(upd);
      }catch(e){ console.error(e); }
    };
  }

  function click(sq){
    if(!P || P.state !== 'ask' || P.busy) return;
    var c = P.c, p = c.get(sq);
    if(P.sel){
      var legal = c.moves({verbose:true}).filter(function(m){ return m.from === P.sel && m.to === sq; });
      if(legal.length){ attempt(P.sel, sq); return; }
    }
    P.sel = (p && p.color === P.side) ? sq : null;
    draw();
  }

  async function attempt(from, to){
    if(P.busy) return;
    var c = P.c, mv = c.move({from:from, to:to, promotion:'q'});
    if(!mv) return;
    c.undo();
    P.sel = null; P.busy = true; P.msg = ''; draw();
    await new Promise(function(r){ setTimeout(r, 20); });          // let the "checking" paint
    var ok = goodMove(c, mv, P.rem);
    if(!ok){ P.busy = false; P.msg = mv.san + ' is not it. Try again.'; P.cls = 'wrong'; draw(); return; }
    c.move(mv);
    if(c.in_checkmate()){
      P.busy = false; P.state = 'solved'; P.msg = 'Checkmate!';
      await recordSolve();
      if(P.off !== 0) P.msg = 'Checkmate! Well done.';
      else if(!loggedIn()) P.msg = 'Checkmate! Log in to keep a streak.';
      draw(); return;
    }
    P.rem--;
    var def = bestDefence(c, P.rem + 1);
    if(def){ c.move(def); P.msg = 'Correct. The reply is ' + def.san + '.'; }
    P.busy = false; P.cls = 'good'; P.hint = 0; draw();
  }

  // ---------- the screen, the nav link, the route ----------
  var css = '#screen-puzzle .dp-wrap{display:grid;grid-template-columns:1fr;gap:0 18px;align-items:start}' +
    '@media(min-width:900px){#screen-puzzle .dp-wrap{grid-template-columns:minmax(0,1fr) 280px}}' +
    '#screen-puzzle{--sq:clamp(30px,calc((100vw - 520px) / 8),60px)}' +
    '@media(max-width:819px){#screen-puzzle{--sq:clamp(30px,9vw,70px)}}' +
    '@media(min-width:820px){#screen-puzzle .an-main{flex-wrap:nowrap;align-items:flex-start}#screen-puzzle .an-main > div:first-child{flex:0 0 auto}#screen-puzzle .an-side{flex:1 1 0;min-width:0;max-width:none}}' +
    '#screen-puzzle .dp-streak{display:flex;align-items:center;gap:14px}#screen-puzzle .dp-big{font-size:42px;font-weight:800;line-height:1;min-width:48px;text-align:center}' +
    '#screen-puzzle .dp-hide{display:flex;align-items:center;gap:8px;font-size:13px;margin:4px 2px 12px;cursor:pointer}#screen-puzzle .dp-hide input{width:auto;margin:0}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var scr = document.createElement('div'); scr.id = 'screen-puzzle'; scr.style.display = 'none';
  document.querySelector('.wrap').insertBefore(scr, $('pnFooter') || null);
  root = document.createElement('div'); scr.appendChild(root);
  var nav = $('navbar');
  var link = document.createElement('a'); link.setAttribute('data-nav', 'puzzle'); link.textContent = 'Puzzle';
  var dn = nav.querySelector('[data-nav="donate"]');
  if(dn) nav.insertBefore(link, dn); else nav.appendChild(link);

  window.renderPuzzle = async function(){
    if(typeof stopPoll === 'function') stopPoll();
    showScreen('puzzle');
    try{ PW.replace('#/puzzle'); }catch(e){}
    if(!P || P.state !== 'ask') start(0);
    draw();
    await loadMine();
    draw();
    window.scrollTo(0, 0);
  };
  var prevShow = window.showScreen;
  window.showScreen = function(n){
    prevShow(n);
    scr.style.display = (n === 'puzzle') ? 'block' : 'none';
    if(n === 'puzzle') nav.querySelectorAll('[data-nav]').forEach(function(a){ a.classList.toggle('active', a.dataset.nav === 'puzzle'); });
  };
  function open(){
    var s = $('screen-game');
    if(loggedIn() && s && s.style.display === 'block' && typeof gameState !== 'undefined' && gameState && gameState.status === 'active' && !confirm('Your clock keeps running while you are away. Leave the game view?')) return;
    window.renderPuzzle();
  }
  link.onclick = open;
  var RT = /^#\/puzzle\/?$/i;
  window.addEventListener('hashchange', function(){ if(RT.test(PW.hash()) && scr.style.display !== 'block') open(); });
  var boot = true, prevAfter = window.afterAuth;
  if(typeof prevAfter === 'function') window.afterAuth = async function(){
    var h = boot ? PW.hash() : ''; boot = false;
    var r = await prevAfter.apply(this, arguments);
    try{ var gs = $('screen-game'); if(RT.test(h) && !(gs && gs.style.display === 'block')) window.renderPuzzle(); }catch(e){ console.error(e); }
    return r;
  };

  // drag and drop, same helper the other puzzle page uses
  try{
    if(window.PawniacDrag) window.PawniacDrag.enable(root, {
      src:'.sq[data-sq]', dst:'.sq[data-sq]',
      imgOf:function(cell){
        if(!P || P.state !== 'ask' || P.busy) return null;
        var p = P.c.get(cell.dataset.sq);
        return (p && p.color === P.side) ? cell.querySelector('img') : null;
      },
      drop:function(cell, dst){
        if(!P || P.state !== 'ask') return;
        var from = cell.dataset.sq;
        if(dst && dst.dataset.sq !== from){
          var legal = P.c.moves({verbose:true}).some(function(m){ return m.from === from && m.to === dst.dataset.sq; });
          if(legal){ attempt(from, dst.dataset.sq); return; }
        }
        P.sel = null; draw();
      }
    });
  }catch(e){ console.error(e); }

  // ---------- streak on profiles ----------
  async function decorateProfile(name){
    var sc = $('screen-profile'), nameEl = sc && sc.querySelector('.pf-name');
    if(!sc || sc.style.display !== 'block' || !nameEl || nameEl.textContent.indexOf(name) !== 0 || sc.querySelector('.pf-streak')) return;
    var d = null;
    try{ d = (await db.ref('hb/puzzle/' + name).once('value')).val(); }catch(e){}
    if(!d || sc.querySelector('.pf-streak')) return;
    var own = loggedIn() && ME.username === name, n = shownStreak(d);
    if(!n || (d.hide && !own)) return;
    var row = document.createElement('div'); row.className = 'pf-streak';
    row.style.cssText = 'font-size:13px;opacity:.9;margin:4px 0;';
    row.innerHTML = 'Puzzle streak: <b>' + n + ' day' + (n === 1 ? '' : 's') + '</b>' + (d.best > n ? ' &middot; best ' + d.best : '') + (d.hide && own ? ' <span style="opacity:.7;">(hidden from others)</span>' : '');
    var after = sc.querySelector('.pf-status') || nameEl;
    after.after(row);
  }
  var prevOpen = window.openProfile;
  if(typeof prevOpen === 'function') window.openProfile = async function(name){
    var r = await prevOpen.apply(this, arguments);
    try{ decorateProfile(name); }catch(e){ console.error('puzzle streak failed', e); }
    return r;
  };

  window.PawniacDaily = {dayKey:dayKey, _P:function(){ return P; }, _go:function(off){ start(off); draw(); }, _solutions:function(){ return solutions().map(function(m){ return m.from + m.to; }); }};
})();
