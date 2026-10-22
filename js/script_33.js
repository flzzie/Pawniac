(function(){
  var HOUR = 3600000;
  function hourOf(ms){ return Math.floor(ms / HOUR); }

  // ---------- 1. every account gets a profile record (so "On Pawniac since" always shows) ----------
  function ensureProfile(){
    if(!ME || !ME.username) return;
    var name = ME.username, created = null;
    try{ created = Date.parse(auth.currentUser.metadata.creationTime); }catch(e){}
    db.ref('hb/profile/' + name).transaction(function(c){
      if(c) return;                                   // already there: leave it alone
      return {bio:'', joined: created || Date.now()};
    }).catch(function(e){ console.error('profile record failed', e); });
  }
  var prevAfter = window.afterAuth;
  window.afterAuth = async function(){
    try{ ensureProfile(); }catch(e){}
    return prevAfter.apply(this, arguments);
  };

  // ---------- 2. counting ----------
  // played: one entry per finished game inside an hourly bucket (so two players never double count)
  var counted = {};
  function countGame(g, gid){
    if(!ME || !gid || counted[gid]) return;
    counted[gid] = true;
    var hr = hourOf(typeof g.moveAt === 'number' ? g.moveAt : serverNow());
    db.ref('hb/counters/played/h/' + hr + '/' + gid).transaction(function(c){ return c ? undefined : true; })
      .then(function(r){
        if(r.committed) return db.ref('hb/counters/played/total').transaction(function(c){ return (c || 0) + 1; });
      }).catch(function(e){ console.error('played counter failed', e); });
  }
  var prevDraw = window.drawGame;
  window.drawGame = function(){
    prevDraw();
    try{
      var g = gameState;
      if(g && g.status === 'finished' && g.winner && g.winner !== 'abort' && g.moveLog && g.moveLog.length >= 2 && myRole(g)) countGame(g, currentGameId);
    }catch(e){ console.error(e); }
  };

  // analyzed: each finished analysis counts once
  var lastA = null;
  function checkAnalysis(){
    try{
      var A = window.__anHook && window.__anHook.data();
      if(!A || A === lastA || !ME) return;
      lastA = A;
      var hr = hourOf(serverNow());
      db.ref('hb/counters/analyzed/h/' + hr).push(true)
        .then(function(){ return db.ref('hb/counters/analyzed/total').transaction(function(c){ return (c || 0) + 1; }); })
        .catch(function(e){ console.error('analyzed counter failed', e); });
    }catch(e){}
  }
  var scr = document.getElementById('screen-analyze');
  if(scr) new MutationObserver(checkAnalysis).observe(scr, {childList:true, subtree:true});

  // ---------- 3. showing them in the "Live now" bar ----------
  function fmt(n){ return (n === null || n === undefined) ? '-' : (n < 0 ? '?' : Number(n).toLocaleString()); }
  function last24(kind){
    var from = hourOf(serverNow()) - 23;
    return db.ref('hb/counters/' + kind + '/h').orderByKey().startAt(String(from)).once('value').then(function(s){
      var n = 0;
      s.forEach(function(h){ n += h.numChildren(); });
      return n;
    });
  }
  function num(path){
    return db.ref(path).once('value').then(function(s){ return s.exists() ? Number(s.val()) || 0 : 0; });
  }
  function loadCounters(){
    if(!document.getElementById('stPlayed24')) return;
    function put(id, p){
      p.then(function(v){ var e = document.getElementById(id); if(e) e.textContent = fmt(v); })
       .catch(function(){ var e = document.getElementById(id); if(e) e.textContent = '?'; });
    }
    put('stPlayed24', last24('played'));
    put('stAnalyzed24', last24('analyzed'));
    // all-time played: our own counter, or the numbered-games counter if that is higher (older games)
    put('stPlayedAll', Promise.all([num('hb/counters/played/total'), num('hb/gameCount').catch(function(){ return 0; }), num('hb/counters/played/bot').catch(function(){ return 0; })]).then(function(a){ return Math.max(a[0], a[1]) + a[2]; }));
    put('stAnalyzedAll', num('hb/counters/analyzed/total'));
  }

  var prevLobby = window.renderLobby;
  window.renderLobby = function(){
    prevLobby();
    try{
      var hint = document.getElementById('liveHint');
      if(!hint || document.getElementById('stPlayed24')) return;
      var tmp = document.createElement('div');
      tmp.innerHTML =
        '<div class="live-row"><span class="live-ico">&#9812;</span><b id="stPlayed24">-</b><span>games played today &middot; <b id="stPlayedAll" style="font-size:inherit;">-</b> total</span></div>' +
        '<div class="live-row"><span class="live-ico">&#9998;</span><b id="stAnalyzed24">-</b><span>games analyzed today &middot; <b id="stAnalyzedAll" style="font-size:inherit;">-</b> total</span></div>';
      while(tmp.firstChild) hint.parentNode.insertBefore(tmp.firstChild, hint);
      loadCounters();
    }catch(e){ console.error('counters row failed', e); }
  };
  setInterval(function(){ loadCounters(); }, 30000);
})();
