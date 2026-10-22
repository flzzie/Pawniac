(function(){
  var lobbyVariant = 'hb';            // 'hb' = Hand & Brain (default), 'standard' = normal chess
  var customTC = {min:10, inc:0};
  var rematchVariant = null;

  function esc(s){
    return String(s).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  function isCustomTC(){ return /^c\d+\+\d+$/.test(selectedTC); }
  function lbPrefix(v){ return (v || lobbyVariant) === 'standard' ? 'hb:leaderboardStd:' : 'hb:leaderboard:'; }

  // Pressing "Play" in the nav always lands on Hand & Brain
  document.getElementById('navbar').addEventListener('click', function(e){
    var a = e.target.closest('[data-nav]');
    if(a && a.dataset.nav === 'play') lobbyVariant = 'hb';
  }, true);

  // ---- custom time controls like "c10+5" ----
  var origGetTC = window.getTC;
  window.getTC = function(key){
    var m = /^c(\d+)\+(\d+)$/.exec(key || '');
    if(m) return {key:key, label:m[1]+'+'+m[2], initial:(+m[1])*60, increment:+m[2]};
    return origGetTC(key);
  };

  // ---- standard games reuse the random-button game, with the piece pre-announced as "any" ----
  var origKset = window.kset;
  window.kset = function(key, value, shared){
    if(shared !== false && typeof key === 'string' && key.indexOf('hb:game:') === 0 &&
       value && typeof value === 'object' && value.status === 'active'){
      if(value.variant === 'standard' && !value.announced) value.announced = 'std';
      else if(rematchVariant && value.variant === undefined){ value.variant = rematchVariant; value.announced = 'std'; }
    }
    return origKset(key, value, shared);
  };
  var origAllowed = window.allowedFromSquares;
  window.allowedFromSquares = function(chess, announced){
    if(announced === 'std') return chess.moves({verbose:true});
    return origAllowed(chess, announced);
  };
  var origDraw = window.drawGame;
  window.drawGame = function(){
    origDraw();
    var g = gameState;
    if(!g || g.variant !== 'standard') return;
    var a = document.querySelector('#screen-game .announce');
    if(a) a.style.display = 'none';
    document.querySelectorAll('#screen-game .status-msg').forEach(function(e){
      if(e.textContent.indexOf('Click a highlighted') === 0) e.textContent = 'Your move: click a piece, then a square.';
    });
  };
  var origAccept = window.acceptRematch;
  window.acceptRematch = async function(){
    rematchVariant = gameState ? gameState.variant : null;
    try{ await origAccept(); } finally { rematchVariant = null; }
  };

  // ---- separate Standard rating ----
  var origSettle = window.settleMyRating;
  window.settleMyRating = async function(g){
    if(!g || g.variant !== 'standard') return origSettle(g);
    if(g.mode !== 'random' || g.status !== 'finished' || !g.ratingSnapshot) return;
    var gid = currentGameId, me = myRole(g);
    if(!me) return;
    var side = me.side;
    if(myRatingChangeCache[gid] || settlingGames[gid]) return;
    if(g.ratingApplied && g.ratingApplied[side]) return;
    settlingGames[gid] = true;
    var myStart = side === 'w' ? g.ratingSnapshot.white : g.ratingSnapshot.black;
    var oppStart = side === 'w' ? g.ratingSnapshot.black : g.ratingSnapshot.white;
    var change = computeEloChange(myStart, oppStart, scoreForSide(g.winner, side));
    var path = 'hb:leaderboardStd:' + ME.username;
    var prof = (await kget(path, true)) || {rating:myStart, games:0};
    var newRating = prof.rating + change;
    myRatingChangeCache[gid] = {change:change, newRating:newRating};
    await kset(path, {rating:newRating, games:prof.games + 1}, true);
    await db.ref(dbPath('hb:game:' + gid + '/ratingApplied/' + side)).set(true);
    if(gameState && currentGameId === gid) drawGame();
  };

  window.takeSeat = async function(code, seatKey){
    var game = await kget('hb:game:' + code, true);
    if(!game || game.status === 'active' || game.seats[seatKey]) return;
    Object.keys(game.seats).forEach(function(k){ if(game.seats[k] === ME.username) game.seats[k] = ''; });
    game.seats[seatKey] = ME.username;
    if(allSeatsFilled(game)){
      game.status = 'active';
      if(game.mode === 'random'){
        var p = lbPrefix(game.variant === 'standard' ? 'standard' : 'hb');
        var wp = (await kget(p + game.seats.white, true)) || {rating:1200, games:0};
        var bp = (await kget(p + game.seats.black, true)) || {rating:1200, games:0};
        game.ratingSnapshot = {white:wp.rating, black:bp.rating};
      }
    }
    await kset('hb:game:' + code, game, true);
  };

  // ---- create room (friends) ----
  window.createRoom = async function(){
    var std = lobbyVariant === 'standard';
    var mode = std ? 'random' : createMode;
    var code = genCode();
    var game = {
      mode:mode, status:'waiting', fen:new Chess().fen(), turn:'w', announced:std ? 'std' : null,
      moveLog:[], winner:null, drawOffer:'', clock:freshClock(selectedTC),
      seats: mode === 'team' ? {whiteBrain:'', whiteHand:'', blackBrain:'', blackHand:''} : {white:'', black:''}
    };
    if(std) game.variant = 'standard';
    await kset('hb:game:' + code, game, true);
    currentGameId = code;
    renderWaiting(code);
  };

  // ---- quick match ----
  window.quickMatch = async function(){
    var v = lobbyVariant, std = v === 'standard', lbp = lbPrefix(v);
    document.getElementById('quickHint').innerHTML = 'Searching... <span class="backlink" id="btnCancelQuick">cancel</span>';
    document.getElementById('btnCancelQuick').onclick = cancelQuickMatch;
    document.getElementById('btnQuick').disabled = true;
    var snap = await db.ref('hb/queue/random').once('value');
    var q = snap.exists() ? snap.val() : {};
    var now = serverNow();
    var cand = Object.keys(q).find(function(u){
      return u !== ME.username && !q[u].gameId && q[u].tc === selectedTC && (q[u].variant || 'hb') === v && (now - q[u].joinedAt) < 60000;
    });
    if(cand){
      var code = genCode(), iAmWhite = Math.random() < 0.5;
      var mp = (await kget(lbp + ME.username, true)) || {rating:1200, games:0};
      var op = (await kget(lbp + cand, true)) || {rating:1200, games:0};
      var game = {
        mode:'random', status:'active', fen:new Chess().fen(), turn:'w', announced:std ? 'std' : null,
        moveLog:[], winner:null, drawOffer:'', clock:freshClock(selectedTC),
        seats: iAmWhite ? {white:ME.username, black:cand} : {white:cand, black:ME.username},
        ratingSnapshot: iAmWhite ? {white:mp.rating, black:op.rating} : {white:op.rating, black:mp.rating}
      };
      if(std) game.variant = 'standard';
      await kset('hb:game:' + code, game, true);
      await db.ref('hb/queue/random/' + cand + '/gameId').set(code);
      await db.ref('hb/queue/random/' + ME.username).remove();
      currentGameId = code;
      enterGameScreen(code);
    } else {
      await db.ref('hb/queue/random/' + ME.username).set({joinedAt:now, gameId:'', tc:selectedTC, variant:v});
      activeListenerRef = db.ref('hb/queue/random/' + ME.username + '/gameId');
      activeListenerRef.on('value', function(s){
        var gid = s.val();
        if(gid){
          stopPoll();
          db.ref('hb/queue/random/' + ME.username).remove();
          currentGameId = gid;
          enterGameScreen(gid);
        }
      });
    }
  };

  // ---- the new Play lobby ----
  window.renderLobby = function(){
    showScreen('lobby');
    stopPoll();
    currentGameId = null;
    var std = lobbyVariant === 'standard', custom = isCustomTC();
    var el = document.getElementById('screen-lobby');
    var tcs = TIME_CONTROLS.map(function(t){
      return '<div class="tcbtn ' + (selectedTC === t.key ? 'active' : '') + '" data-tc="' + t.key + '">' + t.label + '</div>';
    }).join('') + '<div class="tcbtn ' + (custom ? 'active' : '') + '" data-tc="custom">Custom</div>';
    var cbox = custom
      ? '<div class="row" style="margin-bottom:16px;"><input type="number" id="cMin" min="1" max="180" value="' + customTC.min + '"><span class="hint">min +</span><input type="number" id="cInc" min="0" max="60" value="' + customTC.inc + '"><span class="hint">sec per move</span></div>'
      : '';
    var modes = std ? '' :
      '<div class="modes">' +
        '<div class="modebtn ' + (createMode === 'team' ? 'active' : '') + '" data-mode="team">Team (4 players)<div class="hint">2 per side: Brain names a piece, Hand moves it</div></div>' +
        '<div class="modebtn ' + (createMode === 'random' ? 'active' : '') + '" data-mode="random">Random-button (2 players)<div class="hint">Each turn, hit Randomize for your piece type</div></div>' +
      '</div>';
    el.innerHTML =
      '<div class="modes">' +
        '<div class="modebtn ' + (!std ? 'active' : '') + '" data-variant="hb">Hand &amp; Brain<div class="hint">Name a piece, then move it</div></div>' +
        '<div class="modebtn ' + (std ? 'active' : '') + '" data-variant="standard">Standard Chess<div class="hint">Normal chess rules</div></div>' +
      '</div>' +
      '<div class="hint" id="lobbyRating" style="margin:-8px 0 16px;"></div>' +
      '<div class="card"><h2>Time control</h2><div class="tc-row">' + tcs + '</div>' + cbox + '</div>' +
      '<div class="card"><h2>Quick match</h2>' +
        '<p class="desc">1v1, ' + (std ? 'standard chess' : 'random-button mode') + '. Get matched with someone looking to play right now. Rated.</p>' +
        '<button id="btnQuick">Find opponent</button><div class="hint" id="quickHint"></div></div>' +
      '<div class="card"><h2>Play with friends</h2>' +
        '<p class="desc">Create a room and share the invite link or code, or join one someone gave you.</p>' + modes +
        '<button id="btnCreate">Create room</button>' +
        '<div style="margin-top:14px;" class="row"><input type="text" id="joinCode" placeholder="room code" maxlength="5"><button class="secondary" id="btnJoin">Join</button></div></div>';

    el.querySelectorAll('[data-variant]').forEach(function(b){ b.onclick = function(){ lobbyVariant = b.dataset.variant; renderLobby(); }; });
    el.querySelectorAll('[data-mode]').forEach(function(b){ b.onclick = function(){ createMode = b.dataset.mode; renderLobby(); }; });
    el.querySelectorAll('[data-tc]').forEach(function(b){
      b.onclick = function(){
        selectedTC = b.dataset.tc === 'custom' ? 'c' + customTC.min + '+' + customTC.inc : b.dataset.tc;
        renderLobby();
      };
    });
    if(custom){
      var cMin = document.getElementById('cMin'), cInc = document.getElementById('cInc');
      var upd = function(){
        var m = Math.min(180, Math.max(1, parseInt(cMin.value) || 1));
        var i = Math.min(60, Math.max(0, parseInt(cInc.value) || 0));
        customTC = {min:m, inc:i};
        selectedTC = 'c' + m + '+' + i;
      };
      cMin.oninput = upd; cInc.oninput = upd;
    }
    document.getElementById('btnCreate').onclick = createRoom;
    document.getElementById('btnJoin').onclick = function(){
      var code = document.getElementById('joinCode').value.trim().toUpperCase();
      if(code) joinRoom(code);
    };
    document.getElementById('btnQuick').onclick = quickMatch;
    kget(lbPrefix() + ME.username, true).then(function(p){
      var e = document.getElementById('lobbyRating');
      if(!e) return;
      p = p || {rating:1200, games:0};
      e.textContent = 'Your ' + (std ? 'Standard' : 'Hand & Brain') + ' rating: ' + p.rating + ' \u00b7 ' + p.games + ' games';
    });
  };

  // ---- leaderboard with a tab for each rating ----
  window.renderLeaderboard = async function(v){
    v = (v === 'standard') ? 'standard' : 'hb';
    stopPoll();
    showScreen('leaderboard');
    var el = document.getElementById('screen-leaderboard');
    var tabs = '<div class="modes">' +
      '<div class="modebtn ' + (v === 'hb' ? 'active' : '') + '" data-v="hb">Hand &amp; Brain</div>' +
      '<div class="modebtn ' + (v === 'standard' ? 'active' : '') + '" data-v="standard">Standard</div></div>';
    el.innerHTML = '<div class="card"><h2>Leaderboard</h2>' + tabs + '<p class="desc">Loading...</p></div>';
    var body;
    try{
      var snap = await db.ref(v === 'standard' ? 'hb/leaderboardStd' : 'hb/leaderboard').once('value');
      var users = snap.exists() ? snap.val() : {};
      var rows = Object.keys(users)
        .map(function(u){ return {username:u, rating:users[u].rating || 1200, games:users[u].games || 0}; })
        .filter(function(u){ return u.games > 0; })
        .sort(function(a, b){ return b.rating - a.rating; })
        .slice(0, 50);
      body = rows.length ? rows.map(function(u, i){
        return '<div class="seat"><span class="who">#' + (i+1) + ' ' + esc(u.username) + (u.username === ME.username ? ' (you)' : '') +
               '</span><span class="taken">' + u.rating + ' &middot; ' + u.games + ' games</span></div>';
      }).join('') : '<p class="desc">No rated games yet. Play a Quick match to get on the board.</p>';
    }catch(e){
      console.error(e);
      body = '<p class="desc">Could not load the leaderboard right now.</p>';
    }
    el.innerHTML = '<div class="card"><h2>Leaderboard</h2>' + tabs + '<p class="desc">Ranked by rating. Only Quick match games count.</p>' + body + '</div>';
    el.querySelectorAll('[data-v]').forEach(function(b){ b.onclick = function(){ window.renderLeaderboard(b.dataset.v); }; });
  };
})();
