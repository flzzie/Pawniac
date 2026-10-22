(function(){
  function el(id){ return document.getElementById(id); }
  var cur = null, boot = true;

  // ---------- 1. page links: #/auction and #/bot ----------
  function auctionActive(){
    var a = document.querySelector('#screen-lobby [data-variant].active');
    return !!a && a.dataset.variant === 'auction';
  }
  function wanted(){
    if(cur === 'bot') return '#/bot';
    if(cur === 'lobby' && auctionActive()) return '#/auction';
    return null;
  }
  function fix(){
    var h = wanted();
    if(h && location.hash !== h){
      try{ history.replaceState(null, '', location.pathname + location.search + h); }catch(e){}
    }
  }
  function openBot(){ var a = document.querySelector('#navbar [data-nav="bot"]'); if(a) a.click(); }
  function openAuction(){
    window.renderLobby();
    var b = document.querySelector('#screen-lobby [data-variant="auction"]');
    if(b) b.click();
  }
  window.addEventListener('hashchange', function(){
    if(!ME) return;
    var h = location.hash.toLowerCase();
    if(/^#\/bot\/?$/.test(h)){ if(cur !== 'bot') openBot(); }
    else if(/^#\/auction\/?$/.test(h)){ if(!(cur === 'lobby' && auctionActive())) openAuction(); }
  });
  var prevAfter = window.afterAuth;
  window.afterAuth = async function(){
    var h = boot ? location.hash.toLowerCase() : '';
    boot = false;
    var r = await prevAfter.apply(this, arguments);
    try{
      var gs = el('screen-game');
      if(h && !(gs && gs.style.display === 'block')){
        if(/^#\/bot\/?$/.test(h)) openBot();
        else if(/^#\/auction\/?$/.test(h)) openAuction();
      }
    }catch(e){ console.error(e); }
    return r;
  };

  // ---------- 2. players online: count from the status heartbeats (stale entries ignored) ----------
  var ref = null, cb = null, snap = {}, cnt = null, STALE = 180000;
  function paint(){
    var a = el('liveOnline');
    if(!a || cnt === null) return;
    var t = String(cnt);
    if(a.textContent !== t) a.textContent = t;
    var l = el('liveOnlineLbl'), lbl = cnt === 1 ? 'player online' : 'players online';
    if(l && l.textContent !== lbl) l.textContent = lbl;
  }
  function compute(){
    var n = 0, me = ME && ME.username, seen = false;
    Object.keys(snap).forEach(function(u){
      var v = snap[u];
      if(!v || typeof v.t !== 'number' || v.s === 'offline' || serverNow() - v.t > STALE) return;
      n++; if(u === me) seen = true;
    });
    if(me && !seen) n++;
    cnt = n; paint();
  }
  function attach(){
    if(ref || !ME) return;
    ref = db.ref('hb/status');
    cb = ref.on('value', function(s){ snap = s.val() || {}; compute(); }, function(){});
  }
  function detach(){
    try{ if(ref) ref.off('value', cb); }catch(e){}
    ref = null; cb = null;
  }
  var lobby = el('screen-lobby');
  if(lobby) new MutationObserver(paint).observe(lobby, {childList:true, subtree:true, characterData:true});
  setInterval(function(){ if(ref) compute(); }, 20000);

  var prevShow = window.showScreen;
  window.showScreen = function(n){
    cur = n;
    prevShow(n);
    if(n === 'lobby') attach(); else detach();
    setTimeout(fix, 40);
  };
})();
