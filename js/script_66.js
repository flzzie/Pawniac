// General activity streak: a day counts when you finish a game or solve the daily puzzle.
// Shown on the profile (right side of the header). The puzzle's own streak stays on the puzzle page.
(function(){
  'use strict';
  function $(id){ return document.getElementById(id); }
  function loggedIn(){ try{ return !!(ME && ME.username); }catch(e){ return false; } }
  function today(){ return window.PawniacDaily ? window.PawniacDaily.dayKey(0) : new Date().toISOString().slice(0, 10); }
  function yesterday(){ return window.PawniacDaily ? window.PawniacDaily.dayKey(-1) : new Date(Date.now() - 864e5).toISOString().slice(0, 10); }
  function shown(d){ return d ? ((d.last === today() || d.last === yesterday()) ? d.n : 0) : 0; }

  var busy = false;
  async function touch(){
    if(!loggedIn() || busy) return;
    busy = true;
    try{
      var ref = db.ref('hb/streak/' + ME.username), d = (await ref.once('value')).val() || {}, t = today();
      if(d.last === t) return;
      var n = d.last === yesterday() ? (d.n || 0) + 1 : 1;
      var upd = {last:t, n:n, best:Math.max(d.best || 0, n)};
      if(typeof d.hide === 'boolean') upd.hide = d.hide;
      await ref.update(upd);
    }catch(e){ console.error('streak save failed', e); }
    finally{ busy = false; }
  }

  // finished game you played in
  var seen = {}, prevDraw = window.drawGame;
  if(typeof prevDraw === 'function') window.drawGame = function(){
    var r = prevDraw.apply(this, arguments);
    try{
      var g = gameState;
      if(g && g.status === 'finished' && currentGameId && !seen[currentGameId] && typeof myRole === 'function' && myRole(g)){
        seen[currentGameId] = true; touch();
      }
    }catch(e){}
    return r;
  };

  // profile badge
  async function decorate(name){
    var sc = $('screen-profile'), head = sc && sc.querySelector('.pf-head');
    if(!head || sc.style.display !== 'block' || head.querySelector('.pf-streak')) return;
    var d = null;
    try{ d = (await db.ref('hb/streak/' + name).once('value')).val(); }catch(e){}
    if(head.querySelector('.pf-streak')) return;
    var own = loggedIn() && ME.username === name, n = shown(d);
    if(!d || (d.hide && !own) || (!n && !own)) return;
    var box = document.createElement('div'); box.className = 'pf-streak';
    box.style.cssText = 'margin-left:auto;text-align:center;padding:6px 14px;border:1px solid rgba(128,128,128,.3);border-radius:10px;min-width:84px;';
    box.innerHTML = '<div style="font-size:26px;font-weight:700;line-height:1.1;">' + n + '</div><div class="hint" style="margin:0;">day streak</div>' +
      (d.best > n ? '<div class="hint" style="margin:2px 0 0;font-size:11px;">best ' + d.best + '</div>' : '') +
      (own ? '<label class="hint" style="display:block;margin:4px 0 0;font-size:11px;cursor:pointer;"><input type="checkbox" id="pfStreakHide"' + (d.hide ? ' checked' : '') + '> hide</label>' : '');
    head.appendChild(box);
    var cb = box.querySelector('#pfStreakHide');
    if(cb) cb.onchange = function(){ db.ref('hb/streak/' + name + '/hide').set(cb.checked).catch(function(e){ console.error(e); cb.checked = !cb.checked; }); };
  }
  var prevOpen = window.openProfile;
  if(typeof prevOpen === 'function') window.openProfile = async function(name){
    var r = await prevOpen.apply(this, arguments);
    try{ decorate(name); }catch(e){ console.error(e); }
    return r;
  };
  window.PawniacStreak = {touch:touch};
})();
