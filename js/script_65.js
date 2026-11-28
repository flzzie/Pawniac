// Daily puzzle: one hard puzzle a day, the same for everyone, with a streak.
// The puzzles are real Lichess puzzles (CC0) in js/puzzle_lichess.js: [{f: fen, s: [your move, reply, your move, ...], r: rating, t: themes}].
// A move is right if it is the stored move, or if it checkmates (like Lichess).
// The streak lives at hb/puzzle/<username> = {last, streak, best, hide} and shows on the profile unless the player hides it.
(function(){
  'use strict';
  var DAY_SHIFT_MIN = 330;            // the puzzle changes at midnight India time (UTC+5:30). Change this to move it.
  var DATA = window.PAWNIAC_LICHESS_SET || [];
  function $(id){ return document.getElementById(id); }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]; }); }
  function loggedIn(){ return typeof ME !== 'undefined' && !!ME && !!ME.username; }
  function Z(){ return window.__anCore; }

  // ---------- which day is it ----------
  function dayNo(off){ return Math.floor((serverNow() + DAY_SHIFT_MIN * 60000) / 86400000) + (off || 0); }
  function dayKey(off){ return new Date(dayNo(off) * 86400000).toISOString().slice(0, 10); }

  // ---------- state ----------
  var P = null, root = null, ST = {mine:null, loaded:false};
  // a fixed shuffle (stride 97 is coprime with the set size) so the ratings are mixed from day to day
  function puzzleAt(off){ var n = DATA.length; if(!n) return null; var st = 97; while(n % st === 0) st += 2; return DATA[(((dayNo(off) * st) % n) + n) % n]; }
  function uci(m){ return m.from + m.to + (m.promotion || ''); }
  function expected(){ var u = P.pz.s[P.step]; return u ? P.c.moves({verbose:true}).filter(function(m){ return m.from === u.slice(0, 2) && m.to === u.slice(2, 4) && (!u[4] || m.promotion === u[4]); })[0] : null; }
  function start(off){
    var pz = puzzleAt(off);
    if(!pz){ P = null; return; }
    var c = new Chess(pz.f), side = c.turn();
    P = {off:off || 0, pz:pz, c:c, side:side, step:0, sel:null, state:'ask', msg:'', cls:'', hint:0, busy:false, last:null, stepFen:pz.f};
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
      try{ if(window.PawniacStreak) window.PawniacStreak.touch(); }catch(e){}
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
    var mine = Math.ceil(P.pz.s.length / 2), left = Math.ceil((P.pz.s.length - P.step) / 2);
    var info = '<div class="an-title">' + title + '</div>' +
      '<p class="an-note" style="margin-top:8px;">' + (P.side === 'w' ? 'White' : 'Black') + ' to move. Find the best continuation. Click a piece, then where it goes.</p>';
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
    return expected() || {from:'a1', to:'a1', piece:'p'};
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
    var c = P.c, exp = expected(), mv = c.move({from:from, to:to, promotion:(exp && exp.from === from && exp.to === to && exp.promotion) || 'q'});
    if(!mv) return;
    var mate = c.in_checkmate();
    var ok = mate || !!(exp && exp.from === mv.from && exp.to === mv.to && (exp.promotion || '') === (mv.promotion || ''));
    if(!ok){ c.undo(); P.sel = null; P.msg = mv.san + ' is not it. Try again.'; P.cls = 'wrong'; draw(); return; }
    P.sel = null; P.busy = true; P.msg = '';
    var done = mate || P.step + 1 >= P.pz.s.length;
    if(done){
      P.busy = false; P.state = 'solved'; P.msg = mate ? 'Checkmate!' : 'Solved!';
      await recordSolve();
      if(P.off !== 0) P.msg = (mate ? 'Checkmate! ' : '') + 'Well done.';
      else if(!loggedIn()) P.msg = (mate ? 'Checkmate! ' : 'Solved! ') + 'Log in to keep a streak.';
      var th = (P.pz.t || '').split(' ').filter(Boolean).slice(0, 4).join(', ');
      if(th) P.msg += ' Themes: ' + th + '.';
      draw(); return;
    }
    var rep = P.pz.s[P.step + 1], rm = c.move({from:rep.slice(0, 2), to:rep.slice(2, 4), promotion:rep[4] || undefined});
    P.step += 2; P.msg = 'Correct. The reply is ' + (rm ? rm.san : rep) + '.';
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

  window.PawniacDaily = {dayKey:dayKey, _P:function(){ return P; }, _go:function(off){ start(off); draw(); }, _solutions:function(){ var m = expected(); return m ? [m.from + m.to] : []; }};
})();
