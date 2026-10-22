(function(){
  var QUEUE = 'hb/queue/random';
  var FRESH_MS = 45000;    // a searcher counts as "here" if they pinged in the last 45s
  var BEAT_MS  = 15000;    // ping every 15s while searching
  var qm = '1v1';          // lobby switch: '1v1' or '2v2'
  var TS = null;           // the active 2v2 search

  function isHB(){ return !document.querySelector('#screen-lobby [data-variant="standard"].active'); }
  function wantTeam(){ return qm === '2v2' && isHB(); }
  function setHint(html){ var h = document.getElementById('quickHint'); if(h) h.innerHTML = html; }

  // ---------- 1. searching ----------
  function stopTeamSearch(){
    if(!TS) return;
    var t = TS; TS = null;
    clearInterval(t.beat);
    try{ if(t.qCb) t.qRef.off('value', t.qCb); }catch(e){}
    try{ if(t.idCb) t.idRef.off('value', t.idCb); }catch(e){}
    try{ t.meRef.onDisconnect().cancel(); }catch(e){}
    t.meRef.remove().catch(function(){});
  }
  // leaving the lobby (or any screen change that calls stopPoll) cancels the search
  var prevStop = window.stopPoll;
  window.stopPoll = function(){ stopTeamSearch(); return prevStop.apply(this, arguments); };

  function paintSearch(n){
    if(!TS) return;
    setHint('Searching for a 2v2 game... ' + n + '/4 players <span class="backlink" id="btnCancelTeamQ">cancel</span>');
    var c = document.getElementById('btnCancelTeamQ');
    if(c) c.onclick = function(){ stopTeamSearch(); renderLobby(); };
  }

  function fresh(q, tc){
    var now = serverNow();
    return Object.keys(q).filter(function(u){
      var e = q[u];
      return e && e.variant === 'team' && e.tc === tc && !e.gameId &&
             typeof e.joinedAt === 'number' && (now - e.joinedAt) < FRESH_MS;
    }).sort();
  }

  async function teamQuickMatch(){
    stopTeamSearch();
    var btn = document.getElementById('btnQuick');
    if(btn) btn.disabled = true;
    var meRef = db.ref(QUEUE + '/' + ME.username);
    var t = {tc:selectedTC, meRef:meRef, creating:false, beat:null,
             qRef:db.ref(QUEUE), qCb:null, idRef:meRef.child('gameId'), idCb:null};
    TS = t;
    try{
      await meRef.set({joinedAt:serverNow(), gameId:'', tc:t.tc, variant:'team'});
    }catch(e){
      console.error(e);
      if(TS === t) TS = null;
      setHint("Couldn't join the queue (check the Firebase rules).");
      if(btn) btn.disabled = false;
      return;
    }
    if(TS !== t){ meRef.remove().catch(function(){}); return; }   // cancelled while joining
    meRef.onDisconnect().remove();
    t.beat = setInterval(function(){
      if(TS === t) meRef.child('joinedAt').set(serverNow()).catch(function(){});
    }, BEAT_MS);
    // someone else built the game and put us in it
    t.idCb = t.idRef.on('value', function(s){
      var gid = s.val();
      if(!gid || TS !== t) return;
      stopTeamSearch();
      currentGameId = gid;
      enterGameScreen(gid);
    });
    t.qCb = t.qRef.on('value', function(s){
      if(TS === t) onQueue(t, s.exists() ? s.val() : {});
    });
    paintSearch(1);
  }

  function onQueue(t, q){
    var group = fresh(q, t.tc);
    paintSearch(Math.min(Math.max(group.length, 1), 4));
    var four = group.slice(0, 4);
    // only ONE player builds the game: the first of the four by username (no clashes)
    if(four.length === 4 && four[0] === ME.username && !t.creating){
      t.creating = true;
      createTeamGame(t, four).then(function(ok){ if(!ok && TS === t) t.creating = false; });
    }
  }

  async function createTeamGame(t, four){
    try{
      // re-read right before creating: all four must still be waiting
      var snap = await t.qRef.once('value');
      var still = fresh(snap.exists() ? snap.val() : {}, t.tc);
      if(!four.every(function(n){ return still.indexOf(n) >= 0; }) || TS !== t) return false;

      var ratings = {};
      await Promise.all(four.map(async function(n){
        var p = await kget('hb:leaderboard:' + n, true);
        ratings[n] = (p && typeof p.rating === 'number') ? p.rating : 1200;
      }));
      if(TS !== t) return false;

      // balanced teams: strongest + weakest vs the middle two; colors and roles are random
      var by = four.slice().sort(function(a, b){ return ratings[b] - ratings[a]; });
      var A = [by[0], by[3]], B = [by[1], by[2]];
      var white = Math.random() < 0.5 ? A : B;
      var black = (white === A) ? B : A;
      if(Math.random() < 0.5) white = [white[1], white[0]];
      if(Math.random() < 0.5) black = [black[1], black[0]];
      var avg = function(p){ return Math.round((ratings[p[0]] + ratings[p[1]]) / 2); };

      var code = genCode();
      var game = {
        mode:'team', status:'active', fen:new Chess().fen(), turn:'w', announced:null,
        moveLog:[], winner:null, drawOffer:'', clock:freshClock(t.tc),
        seats:{whiteBrain:white[0], whiteHand:white[1], blackBrain:black[0], blackHand:black[1]},
        ratingSnapshot:{white:avg(white), black:avg(black)},   // team averages
        teamRatings:ratings
      };
      var saved = await kset('hb:game:' + code, game, true);
      if(!saved){
        stopTeamSearch();
        setHint("Couldn't start the 2v2 game (check the Firebase rules).");
        var b = document.getElementById('btnQuick'); if(b) b.disabled = false;
        return false;
      }
      if(TS !== t) return false;
      await Promise.all(four.filter(function(n){ return n !== ME.username; }).map(function(n){
        return db.ref(QUEUE + '/' + n + '/gameId').set(code);
      }));
      stopTeamSearch();
      currentGameId = code;
      enterGameScreen(code);
      return true;
    }catch(e){
      console.error('2v2 match failed', e);
      return false;
    }
  }

  // ---------- 2. rating for team games (same Hand & Brain rating as 1v1) ----------
  // Each side's rating = average of its two players. Both teammates get the same change.
  var prevSettle = window.settleMyRating;
  window.settleMyRating = async function(g){
    if(!g || g.mode !== 'team' || !g.ratingSnapshot) return prevSettle(g);
    if(g.status !== 'finished' || g.winner === 'abort') return;
    var gid = currentGameId, me = myRole(g);
    if(!me) return;
    if(myRatingChangeCache[gid] || settlingGames[gid]) return;
    if(g.ratingApplied && g.ratingApplied[ME.username]) return;
    settlingGames[gid] = true;
    var side = me.side;
    var myStart  = side === 'w' ? g.ratingSnapshot.white : g.ratingSnapshot.black;
    var oppStart = side === 'w' ? g.ratingSnapshot.black : g.ratingSnapshot.white;
    var change = computeEloChange(myStart, oppStart, scoreForSide(g.winner, side));
    var path = 'hb:leaderboard:' + ME.username;
    var prof = (await kget(path, true)) || {rating:1200, games:0};
    var newRating = prof.rating + change;
    myRatingChangeCache[gid] = {change:change, newRating:newRating};
    await kset(path, {rating:newRating, games:prof.games + 1}, true);
    await db.ref(dbPath('hb:game:' + gid + '/ratingApplied/' + ME.username)).set(true);
    if(gameState && currentGameId === gid) drawGame();
  };

  // show the rating change on the result banner, and make sure it gets settled
  var prevDraw = window.drawGame;
  window.drawGame = function(){
    prevDraw();
    try{
      var g = gameState;
      if(!g || g.mode !== 'team' || !g.ratingSnapshot || g.status !== 'finished' || g.winner === 'abort') return;
      if(!myRole(g)) return;
      var banner = document.querySelector('#screen-game .result-banner');
      if(banner && !banner.querySelector('.tm-rc')){
        var rc = myRatingChangeCache[currentGameId];
        var d = document.createElement('div');
        d.className = 'rc tm-rc';
        d.textContent = rc ? 'You: ' + (rc.change >= 0 ? '+' : '') + rc.change + ' (now ' + rc.newRating + ')' : 'Updating rating...';
        banner.appendChild(d);
      }
      settleMyRating(g);
    }catch(e){ console.error('team rating failed', e); }
  };

  // rematch of a rated team game stays rated (colors swap, ratings carry over)
  var prevKset = window.kset;
  window.kset = function(key, value, shared){
    try{
      var g0 = gameState;
      if(shared !== false && typeof key === 'string' && key.indexOf('hb:game:') === 0 && value && typeof value === 'object' &&
         value.mode === 'team' && value.status === 'active' && !value.ratingSnapshot && !(value.moveLog || []).length &&
         g0 && g0.mode === 'team' && g0.status === 'finished' && g0.ratingSnapshot && g0.teamRatings &&
         g0.winner && g0.winner !== 'abort' && value.seats && g0.seats &&
         value.seats.whiteBrain === g0.seats.blackBrain && value.seats.whiteHand === g0.seats.blackHand &&
         value.seats.blackBrain === g0.seats.whiteBrain && value.seats.blackHand === g0.seats.whiteHand){
        var s0 = g0.ratingSnapshot, tr = g0.teamRatings, nr = {};
        var dW = computeEloChange(s0.white, s0.black, scoreForSide(g0.winner, 'w'));
        var dB = computeEloChange(s0.black, s0.white, scoreForSide(g0.winner, 'b'));
        [g0.seats.whiteBrain, g0.seats.whiteHand].forEach(function(n){ nr[n] = (tr[n] || 1200) + dW; });
        [g0.seats.blackBrain, g0.seats.blackHand].forEach(function(n){ nr[n] = (tr[n] || 1200) + dB; });
        var s = value.seats;
        value.ratingSnapshot = {
          white: Math.round((nr[s.whiteBrain] + nr[s.whiteHand]) / 2),
          black: Math.round((nr[s.blackBrain] + nr[s.blackHand]) / 2)
        };
        value.teamRatings = nr;
      }
    }catch(e){ console.error('rematch rating failed', e); }
    return prevKset(key, value, shared);
  };

  // ---------- 3. the 1v1 / 2v2 switch in the Quick match card ----------
  function apply(){
    var tg = document.getElementById('qmToggle'), btn = document.getElementById('btnQuick');
    if(!tg || !btn) return;
    var hb = isHB(), card = btn.closest('.card'), desc = card && card.querySelector('p.desc');
    tg.style.display = hb ? '' : 'none';
    tg.querySelectorAll('[data-qm]').forEach(function(b){
      b.classList.toggle('active', b.dataset.qm === (hb ? qm : '1v1'));
    });
    if(desc){
      if(!card.dataset.d1v1) card.dataset.d1v1 = desc.textContent;
      desc.textContent = wantTeam()
        ? '2v2 Hand & Brain. You get matched with 3 other players. Teams are balanced by rating and the Brain / Hand roles are random. Rated, and it uses your Hand & Brain rating.'
        : card.dataset.d1v1;
    }
    if(!btn.disabled) btn.textContent = wantTeam() ? 'Find a 2v2 game' : 'Find opponent';
  }

  var prevLobby = window.renderLobby;
  window.renderLobby = function(){
    prevLobby();
    try{
      var btn = document.getElementById('btnQuick');
      var card = btn && btn.closest('.card');
      if(!card || card.querySelector('#qmToggle')) return;
      var tg = document.createElement('div');
      tg.className = 'tc-row';
      tg.id = 'qmToggle';
      tg.innerHTML = '<div class="tcbtn" data-qm="1v1">1v1</div><div class="tcbtn" data-qm="2v2">2v2 teams</div>';
      (card.querySelector('p.desc') || card.querySelector('h2')).after(tg);
      tg.querySelectorAll('[data-qm]').forEach(function(b){
        b.onclick = function(){ if(TS || btn.disabled) return; qm = b.dataset.qm; apply(); };
      });
      btn.onclick = function(){ if(wantTeam()) teamQuickMatch(); else window.quickMatch(); };
      apply();
    }catch(e){ console.error('2v2 switch failed', e); }
  };
})();
