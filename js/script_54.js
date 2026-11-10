(function(){
  // ===== Double Move chess: online play (lobby card, quick match, friend rooms, clocks, rating, leaderboard) =====
  // The rules live in script_53.js (window.PawniacDouble). A game is stored like every other game
  // (hb/game/CODE) with variant:'double' plus these extra fields:
  //   movesLeft   moves the side to move still has this turn (1 or 2). White's very first move is a single one.
  //   mvSides     one letter per move played ('w' / 'b'), to show the move list grouped by turn
  //   pos         one key per finished turn, for threefold repetition
  //   lastMoves   the moves of the turn that is being played / was just played (highlighted on the board)
  var PD = window.PawniacDouble;
  if(!PD){ console.error('Double Move: rules (script_53.js) not loaded'); return; }

  var dbl = false;                       // is the Double Move card selected in the lobby?
  var LB = 'hb:leaderboardDbl:';         // rating path (hb/leaderboardDbl/NAME = {rating, games})

  function esc(s){ return String(s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function opp(s){ return s === 'w' ? 'b' : 'w'; }
  function nm(g, s){ return (g.seats && g.seats[s === 'w' ? 'white' : 'black']) || ''; }
  function isDbl(g){ return !!g && g.variant === 'double'; }
  function stateOf(g){ return {fen:g.fen, turn:g.turn, movesLeft:g.movesLeft || 1, pos:g.pos || [], sides:g.mvSides || ''}; }

  // ================= game creation =================
  function newDoubleGame(seats, tc, status){
    var st = PD.start();
    return {mode:'random', variant:'double', status:status || 'waiting', fen:st.fen, turn:'w', announced:'std',
      movesLeft:1, mvSides:'', pos:st.pos, lastMoves:[],
      moveLog:[], winner:null, drawOffer:'', clock:freshClock(tc), seats:seats};
  }
  window.__newDoubleGame = newDoubleGame;

  async function createDoubleRoom(){
    var code = genCode();
    await kset('hb:game:' + code, newDoubleGame({white:'', black:''}, selectedTC, 'waiting'), true);
    currentGameId = code; renderWaiting(code);
  }
  async function doubleQuick(){
    var hint = document.getElementById('quickHint');
    if(hint) hint.innerHTML = 'Searching... <span class="backlink" id="btnCancelQuick">cancel</span>';
    var cb = document.getElementById('btnCancelQuick'); if(cb) cb.onclick = cancelQuickMatch;
    document.getElementById('btnQuick').disabled = true;
    var snap = await db.ref('hb/queue/random').once('value'), q = snap.exists() ? snap.val() : {}, now = serverNow();
    var cand = Object.keys(q).find(function(u){
      return u !== ME.username && !q[u].gameId && q[u].tc === selectedTC && q[u].variant === 'double' && (now - q[u].joinedAt) < 60000;
    });
    if(cand){
      var code = genCode(), meW = Math.random() < 0.5;
      var game = newDoubleGame(meW ? {white:ME.username, black:cand} : {white:cand, black:ME.username}, selectedTC, 'active');
      await kset('hb:game:' + code, game, true);
      await db.ref('hb/queue/random/' + cand + '/gameId').set(code);
      await db.ref('hb/queue/random/' + ME.username).remove();
      currentGameId = code; enterGameScreen(code);
    }else{
      var me = db.ref('hb/queue/random/' + ME.username);
      await me.set({joinedAt:now, gameId:'', tc:selectedTC, variant:'double'});
      me.onDisconnect().remove();
      activeListenerRef = db.ref('hb/queue/random/' + ME.username + '/gameId');
      activeListenerRef.on('value', function(s){
        var gid = s.val();
        if(gid){ stopPoll(); db.ref('hb/queue/random/' + ME.username).remove(); currentGameId = gid; enterGameScreen(gid); }
      });
    }
  }

  // ================= making a move =================
  var prevMake = window.makeMove;
  window.makeMove = async function(from, to, promotion){
    var g = await kget('hb:game:' + currentGameId, true);
    if(!isDbl(g)) return prevMake.apply(this, arguments);
    if(g.status !== 'active') return;
    var me = myRole(g);
    if(!me || me.side !== g.turn) return;

    var st = stateOf(g), mover = g.turn;

    // flag fell before the move landed: the mover loses on time
    if(g.clock && g.clock.initialSec > 0 && g.clock.turnStartedAt){
      var mine = mover === 'w' ? g.clock.whiteMs : g.clock.blackMs;
      if(serverNow() - g.clock.turnStartedAt >= mine){
        var fr = PD.flagResult(st);
        g.status = 'finished'; g.winner = fr.winner; g.statusNote = fr.note;
        if(mover === 'w') g.clock.whiteMs = 0; else g.clock.blackMs = 0;
        g.clock.turnStartedAt = 0;
        await kset('hb:game:' + currentGameId, g, true);
        return;
      }
    }

    var r = PD.apply(st, {from:from, to:to, promotion:promotion || 'q'});
    if(!r) return;
    var secondOfTurn = st.movesLeft === 1 && !!st.sides;     // White's single opening move is not a "second" move

    g.fen = r.next.fen; g.turn = r.next.turn; g.movesLeft = r.next.movesLeft;
    g.pos = r.next.pos; g.mvSides = r.next.sides;
    g.announced = 'std'; g.drawOffer = '';
    g.lastMove = {from:r.mv.from, to:r.mv.to};
    g.lastMoves = (secondOfTurn ? (g.lastMoves || []) : []).concat([{from:r.mv.from, to:r.mv.to}]);
    g.moveLog = g.moveLog || [];
    g.moveLog.push(r.mv.san);

    // the clock only changes hands (and the increment is only paid) when the turn is over
    if((r.ended || r.over) && g.clock && g.clock.initialSec > 0){
      var now = serverNow();
      var elapsed = g.clock.turnStartedAt ? now - g.clock.turnStartedAt : 0;
      var incMs = (g.clock.incrementSec || 0) * 1000;
      if(mover === 'w') g.clock.whiteMs = Math.max(0, g.clock.whiteMs - elapsed) + incMs;
      else g.clock.blackMs = Math.max(0, g.clock.blackMs - elapsed) + incMs;
      g.clock.turnStartedAt = now;
    }

    if(r.over){
      g.status = 'finished'; g.winner = r.winner;
      if(r.note) g.statusNote = r.note;
    }

    var saved = await kset('hb:game:' + currentGameId, g, true);
    if(!saved){ alert("Your move couldn't be saved to the server. Check your connection / Firebase rules (see browser console)."); return; }
    refreshGame();
  };

  // ================= database hooks =================
  var pk = window.kset;
  window.kset = async function(key, value, shared){
    try{
      if(shared !== false && typeof key === 'string' && key.indexOf('hb:game:') === 0 && value && typeof value === 'object'){
        if(value.wantDouble){      // a game accepted from a challenge: turn it into a Double Move game
          var dg = newDoubleGame(value.seats, (value.clock && value.clock.tcKey) || 'none', 'active');
          Object.keys(value).forEach(function(k){ delete value[k]; });
          Object.assign(value, dg);
        }
        if(value.variant === 'double'){
          value.announced = 'std';
          var s = value.seats;
          if(s && s.white && s.black){
            if(!value.ratingSnapshot){
              var a = (await kget(LB + s.white, true)) || {rating:1200, games:0};
              var b = (await kget(LB + s.black, true)) || {rating:1200, games:0};
              value.ratingSnapshot = {white:a.rating, black:b.rating};
            }
            if(!value.statsApplied){        // Double Move games do not touch the Hand & Brain / Standard win-loss records
              value.statsApplied = {}; value.statsApplied[s.white] = true; value.statsApplied[s.black] = true;
            }
          }
        }
      }
    }catch(e){ console.error('double move write hook failed', e); }
    return pk(key, value, shared);
  };

  var pt = window.takeSeat;
  window.takeSeat = async function(code, key){
    var g = await kget('hb:game:' + code, true);
    if(!isDbl(g)) return pt(code, key);
    if(g.status !== 'waiting' || g.seats[key]) return;
    Object.keys(g.seats).forEach(function(k){ if(g.seats[k] === ME.username) g.seats[k] = ''; });
    g.seats[key] = ME.username;
    if(allSeatsFilled(g)) g.status = 'active';
    await kset('hb:game:' + code, g, true);
  };

  var pr = window.acceptRematch;
  window.acceptRematch = async function(){
    var g0 = gameState;
    if(!isDbl(g0)) return pr();
    var gid = currentGameId, f = await kget('hb:game:' + gid, true);
    if(!f || f.status !== 'finished' || f.rematchGameId || !myRole(f)) return;
    var s = f.seats, code = genCode();
    await kset('hb:game:' + code, newDoubleGame({white:s.black, black:s.white}, (f.clock && f.clock.tcKey) || 'none', 'active'), true);
    await db.ref(dbPath('hb:game:' + gid + '/rematchGameId')).set(code);
  };

  // ================= rating =================
  var ps = window.settleMyRating;
  window.settleMyRating = async function(g){
    if(!isDbl(g)) return ps(g);
    if(g.mode !== 'random' || g.status !== 'finished' || !g.ratingSnapshot || !g.winner || g.winner === 'abort') return;
    var gid = currentGameId, me = myRole(g); if(!me) return;
    var side = me.side;
    if(myRatingChangeCache[gid] || settlingGames[gid]) return;
    if(g.ratingApplied && g.ratingApplied[side]) return;
    settlingGames[gid] = true;
    var myStart = side === 'w' ? g.ratingSnapshot.white : g.ratingSnapshot.black;
    var oppStart = side === 'w' ? g.ratingSnapshot.black : g.ratingSnapshot.white;
    var change = computeEloChange(myStart, oppStart, scoreForSide(g.winner, side));
    var path = LB + ME.username;
    var prof = (await kget(path, true)) || {rating:myStart, games:0};
    var newRating = prof.rating + change;
    myRatingChangeCache[gid] = {change:change, newRating:newRating};
    await kset(path, {rating:newRating, games:prof.games + 1}, true);
    await db.ref(dbPath('hb:game:' + gid + '/ratingApplied/' + side)).set(true);
    if(gameState && currentGameId === gid) drawGame();
  };

  // ================= the move list: grouped by turn =================
  function sidesFor(log, sides){
    var out = '';
    for(var i = 0; i < log.length; i++){
      var c = sides && sides.charAt(i);
      out += c || (i === 0 ? 'w' : (((i - 1) >> 1) % 2 === 0 ? 'b' : 'w'));
    }
    return out;
  }
  function renderDoubleLog(log, sides){
    if(!log || !log.length) return '<div class="movelog-wrap empty">No moves yet.</div>';
    var sd = sidesFor(log, sides), turns = [], i;
    for(i = 0; i < log.length; i++){
      var t = turns[turns.length - 1];
      if(t && t.s === sd.charAt(i)) t.m.push(log[i]); else turns.push({s:sd.charAt(i), m:[log[i]]});
    }
    var rows = [], n = 0;
    turns.forEach(function(t, ti){
      var cur = ti === turns.length - 1;
      if(t.s === 'w'){ n++; rows.push({n:n, w:t.m, b:[], wc:cur, bc:false}); }
      else {
        var r = rows[rows.length - 1];
        if(!r || r.b.length){ n++; r = {n:n, w:[], b:[], wc:false, bc:false}; rows.push(r); }
        r.b = t.m; r.bc = cur;
      }
    });
    var h = '';
    rows.forEach(function(r){
      h += '<div class="move-row dm-row"><span class="move-num">' + r.n + '</span>' +
        '<span class="move-white' + (r.wc ? ' current' : '') + '">' + r.w.map(function(x){ return sanToFigurine(x, 'w'); }).join(' ') + '</span>' +
        '<span class="move-black' + (r.bc ? ' current' : '') + '">' + r.b.map(function(x){ return sanToFigurine(x, 'b'); }).join(' ') + '</span></div>';
    });
    return '<div class="movelog-wrap">' + h + '</div>';
  }
  window.__renderDoubleLog = renderDoubleLog;
  var prevLog = window.renderMoveLog;
  window.renderMoveLog = function(log, g){
    if(g && g.variant === 'double') return renderDoubleLog(log, g.mvSides);
    return prevLog.apply(this, arguments);
  };

  // ================= the game screen =================
  function bannerHtml(g, me){
    if(g.status !== 'active') return '';
    var left = g.movesLeft || 1, first = !(g.moveLog && g.moveLog.length);
    var mine = !!me && me.side === g.turn;
    var idx = left === 2 ? 1 : 2, title, sub = '';
    if(first){
      title = mine ? 'Opening move' : 'White opens';
      sub = 'White plays just one move to start. After that, each side plays two moves per turn.';
    }else if(mine){
      title = 'Your move ' + idx + ' of 2';
      sub = idx === 1 ? 'Capture the enemy king to win. There is no check.' : 'Make your second move. Capture the king to win.';
    }else{
      title = esc(nm(g, g.turn) || (g.turn === 'w' ? 'White' : 'Black')) + ': move ' + idx + ' of 2';
    }
    return '<div class="dm-banner' + (mine ? ' mine' : '') + '"><div class="dm-t">' + title + '</div>' + (sub ? '<div class="dm-s">' + sub + '</div>' : '') + '</div>';
  }
  var prevDraw = window.drawGame;
  window.drawGame = function(){
    prevDraw();
    var g = gameState;
    if(!isDbl(g)) return;
    try{
      var scr = document.getElementById('screen-game'), panel = scr && scr.querySelector('.panel');
      var a = scr && scr.querySelector('.announce'); if(a) a.style.display = 'none';
      document.querySelectorAll('#screen-game .status-msg').forEach(function(e){
        if(e.textContent.indexOf('Click a highlighted') === 0) e.textContent = 'Click a piece, then a square.';
      });
      if(panel && !panel.querySelector('.dm-banner')) panel.insertAdjacentHTML('afterbegin', bannerHtml(g, myRole(g)));
      (g.lastMoves || []).forEach(function(m){
        [m.from, m.to].forEach(function(sq){
          var c = scr.querySelector('.sq[data-sq="' + sq + '"]'); if(c) c.classList.add('last');
        });
      });
      var an = document.getElementById('btnAnalyzeGame'); if(an) an.remove();     // the analyzer only knows one move per turn
    }catch(e){ console.error('double move draw failed', e); }
  };

  // ================= lobby: fourth variant card =================
  document.getElementById('navbar').addEventListener('click', function(e){
    var a = e.target.closest('[data-nav]'); if(a && a.dataset.nav === 'play') dbl = false;
  }, true);
  var pl = window.renderLobby;
  window.renderLobby = function(){
    pl();
    try{
      var el = document.getElementById('screen-lobby'), grp = el.querySelector('.modes');
      if(!grp || el.querySelector('[data-variant="double"]')) return;
      grp.querySelectorAll('[data-variant]').forEach(function(b){
        var o = b.onclick; b.onclick = function(ev){ dbl = false; if(o) return o.call(b, ev); };
      });
      var nb = document.createElement('div');
      nb.className = 'modebtn dm-card'; nb.dataset.variant = 'double';
      nb.innerHTML = 'Double Move<div class="hint">Two moves every turn</div>';
      nb.onclick = function(){ dbl = true; window.renderLobby(); };
      grp.appendChild(nb);
      if(!dbl) return;
      grp.querySelectorAll('[data-variant]').forEach(function(b){ b.classList.toggle('active', b === nb); });
      var tg = document.getElementById('qmToggle'); if(tg) tg.style.display = 'none';
      var qb = document.getElementById('btnQuick'), qc = qb.closest('.card'), qd = qc.querySelector('p.desc');
      if(qd) qd.textContent = '1v1 Double Move chess: after White’s opening move, each side plays two moves per turn. Get matched with someone looking to play right now. Rated.';
      qb.textContent = 'Find opponent'; qb.onclick = doubleQuick;
      var cb = document.getElementById('btnCreate'), fm = cb.closest('.card').querySelector('.modes');
      if(fm) fm.style.display = 'none';
      cb.onclick = createDoubleRoom;
      var r = document.getElementById('lobbyRating');
      if(r){
        r.textContent = 'Double Move rating: ...';
        kget(LB + ME.username, true).then(function(p){
          p = p || {rating:1200, games:0};
          if(r.isConnected) r.textContent = 'Your Double Move rating: ' + p.rating + ' · ' + p.games + ' games';
        });
      }
    }catch(e){ console.error('double move lobby failed', e); }
  };

  // ================= leaderboard tab + profile box =================
  var plb = window.renderLeaderboard, lbSeq = 0;
  window.renderLeaderboard = async function(v){
    var my = ++lbSeq, want = (v === 'double');
    var scr = document.getElementById('screen-leaderboard');
    if(want && scr) scr.style.visibility = 'hidden';
    var r;
    try{
      r = await plb.call(window, want ? 'hb' : v);
      var first = scr.querySelector('.modes [data-v]');
      if(!first) return r;
      var modes = first.parentNode, card = modes.closest('.card');
      if(!modes.querySelector('[data-v="double"]')){
        var t = document.createElement('div'); t.className = 'modebtn'; t.dataset.v = 'double'; t.textContent = 'Double Move';
        t.onclick = function(){ window.renderLeaderboard('double'); };
        modes.appendChild(t);
      }
      if(want && my === lbSeq){
        modes.querySelectorAll('[data-v]').forEach(function(x){ x.classList.toggle('active', x.dataset.v === 'double'); });
        var html;
        try{
          var snap = await db.ref('hb/leaderboardDbl').once('value'), users = snap.exists() ? snap.val() : {};
          var rows = Object.keys(users).map(function(u){ var x = users[u] || {}; return {username:u, rating:Number(x.rating) || 1200, games:Number(x.games) || 0}; })
            .filter(function(u){ return u.games > 0; }).sort(function(a, b){ return b.rating - a.rating; }).slice(0, 50);
          html = '<p class="desc">Ranked by rating. Only rated Double Move games count.</p>' +
            (rows.length ? rows.map(function(u, i){
              return '<div class="seat"><span class="who">#' + (i + 1) + ' ' + esc(u.username) + (ME && u.username === ME.username ? ' (you)' : '') +
                '</span><span class="taken">' + u.rating + ' &middot; ' + u.games + ' games</span></div>';
            }).join('') : '<p class="desc">No rated Double Move games yet. Play one to get on the board.</p>');
        }catch(e){
          console.error('double move leaderboard failed', e);
          html = '<p class="desc">Could not load the Double Move leaderboard. In the Firebase console, publish a rule for "leaderboardDbl" (same as "leaderboardAuc").</p>';
        }
        if(my === lbSeq){
          while(modes.nextSibling) card.removeChild(modes.nextSibling);
          card.insertAdjacentHTML('beforeend', html);
          try{ PW.replace('#/leaderboard/doublemove'); }catch(e){}
        }
      }
    }catch(e){ console.error('double move leaderboard tab failed', e); }
    finally{ if(my === lbSeq && scr) scr.style.visibility = ''; }
    return r;
  };

  var po = window.openProfile;
  window.openProfile = async function(name){
    var r = await po.apply(this, arguments);
    try{
      var scr = document.getElementById('screen-profile'), gr = scr.querySelector('.pf-grid'), nmEl = scr.querySelector('.pf-name');
      if(gr && nmEl && nmEl.textContent.indexOf(name) === 0 && !gr.querySelector('[data-dbl]')){
        var v = (await db.ref('hb/leaderboardDbl/' + name).once('value')).val();
        if(!gr.querySelector('[data-dbl]')){
          var d = document.createElement('div'); d.className = 'pf-box'; d.dataset.dbl = '1';
          d.innerHTML = '<div class="hint">Double Move</div><div class="pf-big">' + (v ? v.rating : '-') + '</div><div class="hint">' + (v ? v.games : 0) + ' games</div>';
          gr.appendChild(d);
        }
      }
    }catch(e){ console.error(e); }
    return r;
  };

  // ================= page links: /doublemove/ and /leaderboard/doublemove/ =================
  var cur = null, boot = true;
  function dblActive(){
    var a = document.querySelector('#screen-lobby [data-variant].active');
    return !!a && a.dataset.variant === 'double';
  }
  function openDouble(){
    window.renderLobby();
    var b = document.querySelector('#screen-lobby [data-variant="double"]'); if(b) b.click();
  }
  var prevShow = window.showScreen;
  window.showScreen = function(n){ cur = n; prevShow(n); };
  setInterval(function(){          // keep the address bar right while the Double Move card is open
    try{ if(cur === 'lobby' && dblActive() && PW.hash() !== '#/doublemove') PW.replace('#/doublemove'); }catch(e){}
  }, 400);
  window.addEventListener('hashchange', function(){
    if(!ME) return;
    var h = PW.hash().toLowerCase();
    if(/^#\/doublemove\/?$/.test(h)){ if(!(cur === 'lobby' && dblActive())) openDouble(); }
    else if(/^#\/leaderboard\/doublemove\/?$/.test(h)){ if(cur !== 'leaderboard') window.renderLeaderboard('double'); }
  });
  var prevAfter = window.afterAuth;
  window.afterAuth = async function(){
    var h = boot ? PW.hash().toLowerCase() : '';
    boot = false;
    var r = await prevAfter.apply(this, arguments);
    try{
      var gs = document.getElementById('screen-game');
      if(h && !(gs && gs.style.display === 'block')){
        if(/^#\/doublemove\/?$/.test(h)) openDouble();
        else if(/^#\/leaderboard\/doublemove\/?$/.test(h)) window.renderLeaderboard('double');
      }
    }catch(e){ console.error(e); }
    return r;
  };
})();
