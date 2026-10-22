(function(){
  var onlineRef = null, playingRef = null, playingGid = null, connRef = null, connCb = null;
  var liveRef = null, liveCb = null, qRef = null, qCb = null;

  // ----- tell the server we're here (removed automatically when the tab closes) -----
  function announce(){
    if(onlineRef){
      var r = onlineRef;
      r.onDisconnect().remove().then(function(){ if(onlineRef === r) r.set(true); }).catch(function(){});
    }
    if(playingRef){
      var p = playingRef, gid = playingGid;
      p.onDisconnect().remove().then(function(){ if(playingRef === p) p.set(gid); }).catch(function(){});
    }
  }
  function goOnline(){
    if(!ME || onlineRef) return;
    onlineRef = db.ref('hb/live/online/' + ME.username);
    connRef = db.ref('.info/connected');
    connCb = connRef.on('value', function(s){ if(s.val() === true) announce(); });
  }
  function setPlaying(gid){
    if(gid === playingGid) return;
    if(playingRef){
      try{ playingRef.onDisconnect().cancel(); }catch(e){}
      playingRef.remove().catch(function(){});
    }
    playingGid = gid;
    playingRef = gid ? db.ref('hb/live/playing/' + ME.username) : null;
    if(playingRef) announce();
  }
  function goOffline(){
    try{ if(connRef) connRef.off('value', connCb); }catch(e){}
    connRef = null; connCb = null;
    setPlaying(null);
    if(onlineRef){
      try{ onlineRef.onDisconnect().cancel(); }catch(e){}
      onlineRef.remove().catch(function(){});
      onlineRef = null;
    }
  }

  var beat = 0;
  setInterval(function(){
    try{
      if(!ME){ return; }
      goOnline();
      var g = gameState;
      var onGame = document.getElementById('screen-game').style.display === 'block';
      var want = (g && onGame && g.status === 'active' && currentGameId && myRole(g)) ? currentGameId : null;
      setPlaying(want);
      // every ~30s, put the flags back (covers a second tab of yours closing and clearing them)
      if(++beat % 15 === 0){
        if(onlineRef) onlineRef.set(true).catch(function(){});
        if(playingRef) playingRef.set(playingGid).catch(function(){});
      }
    }catch(e){ console.error('live presence failed', e); }
  }, 2000);

  var prevLogout = window.logout;
  window.logout = async function(){ goOffline(); return prevLogout(); };

  // ----- the sidebar -----
  function detachLive(){
    try{ if(liveRef) liveRef.off('value', liveCb); }catch(e){}
    try{ if(qRef) qRef.off('value', qCb); }catch(e){}
    liveRef = null; qRef = null;
  }
  function attachLive(){
    detachLive();
    var d = {online:null, playing:null, search:null};
    function show(n){ return n === null ? '-' : (n < 0 ? '?' : n); }
    function plural(n, one, many){ return n === 1 ? one : many; }
    function paint(){
      var a = document.getElementById('liveOnline'), b = document.getElementById('livePlaying'), c = document.getElementById('liveSearch');
      if(!a) return;
      a.textContent = show(d.online);
      b.textContent = show(d.playing);
      c.textContent = show(d.search);
      document.getElementById('liveOnlineLbl').textContent = plural(d.online, 'player online', 'players online');
      document.getElementById('livePlayingLbl').textContent = plural(d.playing, 'game in progress', 'games in progress');
      document.getElementById('liveSearchLbl').textContent = plural(d.search, 'player looking for a match', 'players looking for a match');
      var bad = d.online < 0 || d.playing < 0;
      document.getElementById('liveHint').textContent = bad
        ? "Live stats need the new Firebase rule (see the setup note)."
        : 'Updates live. Counts people with Pawniac open.';
    }
    liveRef = db.ref('hb/live');
    liveCb = liveRef.on('value', function(s){
      var v = s.exists() ? s.val() : {};
      d.online = Object.keys(v.online || {}).length;
      var gids = {};
      Object.keys(v.playing || {}).forEach(function(u){ gids[v.playing[u]] = 1; });
      d.playing = Object.keys(gids).length;
      paint();
    }, function(){ d.online = -1; d.playing = -1; paint(); });
    qRef = db.ref('hb/queue/random');
    qCb = qRef.on('value', function(s){
      var v = s.exists() ? s.val() : {}, now = serverNow();
      d.search = Object.keys(v).filter(function(u){ return v[u] && !v[u].gameId && (now - v[u].joinedAt) < 60000; }).length;
      paint();
    }, function(){ d.search = -1; paint(); });
  }

  function addSidebar(){
    var el = document.getElementById('screen-lobby');
    if(!el || el.querySelector('.lobby-cols')) return;
    var left = document.createElement('div');
    left.className = 'lobby-left';
    while(el.firstChild) left.appendChild(el.firstChild);      // moves the existing lobby (buttons keep working)
    var side = document.createElement('aside');
    side.className = 'lobby-right';
    side.innerHTML =
      '<div class="card"><h2>Live now</h2>' +
        '<div class="live-row"><span class="live-dot"></span><b id="liveOnline">-</b><span id="liveOnlineLbl">players online</span></div>' +
        '<div class="live-row"><span class="live-ico">&#9822;</span><b id="livePlaying">-</b><span id="livePlayingLbl">games in progress</span></div>' +
        '<div class="live-row"><span class="live-ico">&#8987;</span><b id="liveSearch">-</b><span id="liveSearchLbl">players looking for a match</span></div>' +
        '<div class="hint" id="liveHint" style="margin-top:8px;"></div>' +
      '</div>';
    var cols = document.createElement('div');
    cols.className = 'lobby-cols';
    cols.appendChild(left);
    cols.appendChild(side);
    el.appendChild(cols);
    attachLive();
  }

  var prevLobby = window.renderLobby;
  window.renderLobby = function(){
    prevLobby();
    try{ addSidebar(); }catch(e){ console.error('live sidebar failed', e); }
  };
  var prevShow = window.showScreen;
  window.showScreen = function(n){
    if(n !== 'lobby') detachLive();
    prevShow(n);
  };
})();
