(function(){
  // ---------- settings ----------
  var FIRST_MOVE_MS      = 30000;            // each side's first move (Lichess uses 30s)
  var FIRST_MOVE_MS_TEAM = 60000;            // team games need more time to coordinate
  var IDLE_MS            = 24*3600*1000;     // no-clock games: side to move forfeits after 24h of nothing
  var GRACE_MS     = 8000;   // opponent must be gone this long before the box even appears (ignores blips)
  var BACK_HOLD_MS = 5000;   // ...and must be back this long before the countdown is forgotten
  function firstMoveMs(g){ return g && g.mode === 'team' ? FIRST_MOVE_MS_TEAM : FIRST_MOVE_MS; }

  // How long a player must be gone before the opponent may claim. Mirrors the figures Lichess
  // players report: 40s blitz and faster, 80s rapid, 120s slower / no clock.
  function claimDelayMs(c){
    if(!c || !(c.initialSec > 0)) return 120000;
    var est = c.initialSec + 40 * (c.incrementSec || 0);
    return est <= 480 ? 40000 : (est <= 1500 ? 80000 : 120000);
  }

  // ---------- 1. stamp every game with when it last changed ----------
  // moveAt = server time of activation / the last move. Used by the first-move abort and the idle forfeit.
  var prevKset = window.kset;
  window.kset = function(key, value, shared){
    if(shared !== false && typeof key === 'string' && key.indexOf('hb:game:') === 0 && value && typeof value === 'object'){
      var n = (value.moveLog || []).length;
      if(value.status === 'active' && (value.moveCount !== n || !value.moveAt)){
        value.moveCount = n;
        value.moveAt = serverNow();
      }
    }
    return prevKset(key, value, shared);
  };

  // ---------- 2. aborted games never touch ratings or records ----------
  var prevSettle = window.settleMyRating;
  window.settleMyRating = function(g){
    if(g && g.winner === 'abort') return Promise.resolve();
    return prevSettle(g);
  };
  var prevScore = window.scoreForSide;
  window.scoreForSide = function(w, s){ return w === 'abort' ? 'abort' : prevScore(w, s); };
  var prevElo = window.computeEloChange;
  window.computeEloChange = function(a, b, sc){ return sc === 'abort' ? 0 : prevElo(a, b, sc); };

  // ---------- 3. atomically end a game (so two clients can't clash) ----------
  function endGame(gid, mutate){
    return db.ref(dbPath('hb:game:' + gid)).transaction(function(cur){
      if(!cur) return cur;
      if(cur.status !== 'active') return;          // already over: leave it alone
      if(mutate(cur) === false) return;            // mutate can veto
      return cur;
    }).catch(function(e){ console.error('endGame failed', e); });
  }
  function markAborted(c, note){
    var sa = {};
    Object.keys(c.seats || {}).forEach(function(k){ if(c.seats[k]) sa[c.seats[k]] = true; });
    c.status = 'finished'; c.winner = 'abort'; c.statusNote = note; c.statsApplied = sa; c.drawOffer = '';
  }
  function abortGame(){
    if(!confirm('Abort this game? No rating change for either player.')) return;
    endGame(currentGameId, function(c){
      if(c.variant === 'auction') return false;   // Piece Auction games cannot be aborted once the pieces are picked
      if((c.moveLog || []).length >= 2) return false;
      markAborted(c, 'game aborted');
    });
  }

  // ---------- 4. presence: "is this player actually looking at the game?" ----------
  var PRES = {gid:null, names:[], loaded:false, meRef:null, listRef:null, listCb:null, connRef:null, connCb:null, absentSince:null, backSince:null, stuckNow:false};

  function attach(gid){
    PRES.gid = gid; PRES.names = []; PRES.loaded = false; PRES.absentSince = null; PRES.backSince = null; PRES.stuckNow = false;
    var meRef = db.ref('hb/presence/' + gid + '/' + ME.username);
    PRES.meRef = meRef;
    PRES.listRef = db.ref('hb/presence/' + gid);
    PRES.listCb = PRES.listRef.on('value', function(s){
      PRES.names = s.exists() ? Object.keys(s.val()) : [];
      PRES.loaded = true;
    });
    // (re)announce ourselves every time the connection comes up; the server clears it when it drops
    PRES.connRef = db.ref('.info/connected');
    PRES.connCb = PRES.connRef.on('value', function(s){
      if(s.val() === true && PRES.meRef === meRef){
        meRef.onDisconnect().remove().then(function(){ if(PRES.meRef === meRef) meRef.set(true); }).catch(function(){});
      }
    });
  }
  function detach(){
    if(!PRES.gid) return;
    try{
      PRES.listRef.off('value', PRES.listCb);
      PRES.connRef.off('value', PRES.connCb);
      PRES.meRef.onDisconnect().cancel();
      PRES.meRef.remove();
    }catch(e){}
    PRES.gid = null; PRES.names = []; PRES.loaded = false; PRES.meRef = null; PRES.absentSince = null; PRES.backSince = null; PRES.stuckNow = false;
  }

  // Is the opponent side unable to play right now? (empty seat counts as absent)
  function sideStuck(g, opp, names){
    function absent(n){ return !n || names.indexOf(n) < 0; }
    var s = g.seats || {};
    if(g.mode === 'team'){
      var brain = opp === 'w' ? s.whiteBrain : s.blackBrain;
      var hand  = opp === 'w' ? s.whiteHand  : s.blackHand;
      if(absent(brain) && absent(hand)) return true;
      var needed = g.announced ? hand : brain;          // whoever must act next on that side
      return g.turn === opp && absent(needed);
    }
    return absent(opp === 'w' ? s.white : s.black);
  }

  function updateAbsence(){
    var g = gameState;
    if(!g || g.status !== 'active' || !ME || !myRole(g) || !PRES.loaded || PRES.gid !== currentGameId ||
       PRES.names.indexOf(ME.username) < 0){            // if WE look offline, never show a claim
      PRES.absentSince = null; PRES.backSince = null; PRES.stuckNow = false; return;
    }
    var opp = myRole(g).side === 'w' ? 'b' : 'w';
    var stuck = sideStuck(g, opp, PRES.names), now = Date.now();
    PRES.stuckNow = stuck;
    if(stuck){
      PRES.backSince = null;
      if(!PRES.absentSince) PRES.absentSince = now;
    } else if(PRES.absentSince){
      // they reappeared: only forget the countdown if they stay for a few seconds (a flaky connection
      // blinking on and off must not keep restarting it)
      if(!PRES.backSince) PRES.backSince = now;
      else if(now - PRES.backSince >= BACK_HOLD_MS){ PRES.absentSince = null; PRES.backSince = null; }
    }
  }

  // ---------- 5. the "opponent left" box ----------
  function paintAbandon(){
    var g = gameState;
    var box = document.getElementById('abBox');
    var panel = document.querySelector('#screen-game .panel');
    var show = g && g.status === 'active' && PRES.absentSince && PRES.stuckNow &&
               (Date.now() - PRES.absentSince) >= GRACE_MS && panel &&
               document.getElementById('screen-game').style.display === 'block';
    if(!show){ if(box) box.remove(); return; }

    // build the box once; every later call only changes its text / button visibility
    if(!box || !box.querySelector('#abMsg')){
      if(box) box.remove();
      box = document.createElement('div');
      box.id = 'abBox';
      box.className = 'draw-offer ab-box';
      box.innerHTML =
        '<div id="abMsg"></div>' +
        '<div class="draw-offer-btns" id="abBtns" style="display:none;"><button id="abWin">Claim victory</button><button class="secondary" id="abDraw">Call a draw</button></div>' +
        '<div class="hint" id="abHint" style="margin-top:8px;display:none;">Or keep waiting - the game carries on if they come back.</div>';
      panel.insertBefore(box, panel.firstChild);
      document.getElementById('abWin').onclick = function(){ claim('win'); };
      document.getElementById('abDraw').onclick = function(){ claim('draw'); };
    }
    var msg = document.getElementById('abMsg'), btns = document.getElementById('abBtns'), hint = document.getElementById('abHint');
    var n = (g.moveLog || []).length, text, showBtns = false;
    if(n < 2 && g.variant !== 'auction'){
      var left = Math.max(0, Math.ceil((firstMoveMs(g) - (serverNow() - (g.moveAt || serverNow()))) / 1000));
      text = "Your opponent isn't connected. If the game doesn't get going, it is aborted in " + left + "s (no rating change)." + (g.variant === 'auction' ? '' : ' You can also abort it yourself.');
    } else {
      var wait = (g.variant === 'auction' ? Math.min(15000, claimDelayMs(g.clock)) : claimDelayMs(g.clock)) - (Date.now() - PRES.absentSince);
      if(wait > 0){
        text = 'Your opponent left the game. You can claim the result in ' + Math.ceil(wait/1000) + 's. They may still come back.';
      } else {
        text = 'Your opponent left the game.';
        showBtns = true;
      }
    }
    msg.textContent = text;
    btns.style.display = showBtns ? 'flex' : 'none';
    hint.style.display = showBtns ? 'block' : 'none';
  }

  async function claim(kind){
    var gid = currentGameId;
    var g = await kget('hb:game:' + gid, true);
    if(!g || g.status !== 'active') return;
    var me = myRole(g); if(!me) return;
    // re-check with fresh data: they might have just come back
    var snap = await db.ref('hb/presence/' + gid).once('value');
    var names = snap.exists() ? Object.keys(snap.val()) : [];
    var opp = me.side === 'w' ? 'b' : 'w';
    if(!sideStuck(g, opp, names)){ alert('Your opponent is back - the game goes on.'); return; }
    var winner = kind === 'win' ? me.side : 'draw';
    var note = kind === 'win' ? 'won - opponent abandoned the game' : 'draw - claimed after opponent left';
    await endGame(gid, function(c){
      c.status = 'finished'; c.winner = winner; c.statusNote = note; c.drawOffer = '';
    });
  }

  // ---------- 6. automatic rules, checked on every clock tick ----------
  var busy = false;
  function checkAbandon(){
    var g = gameState;
    if(busy || !g || g.status !== 'active' || !g.moveAt || !myRole(g)) return;
    var n = (g.moveLog || []).length, idle = serverNow() - g.moveAt, gid = currentGameId;
    var hasClock = g.clock && g.clock.initialSec > 0;

    if(n < 2 && idle > firstMoveMs(g) && g.variant !== 'auction'){
      busy = true;
      var who = g.turn === 'w' ? 'White' : 'Black';
      endGame(gid, function(c){
        if((c.moveLog || []).length >= 2 || serverNow() - (c.moveAt || 0) <= firstMoveMs(c)) return false;
        markAborted(c, 'game aborted - ' + who + ' did not move in time');
      }).then(function(){ setTimeout(function(){ busy = false; }, 3000); });
    } else if((n >= 2 || g.variant === 'auction') && !hasClock && idle > IDLE_MS){
      busy = true;
      endGame(gid, function(c){
        if((c.clock && c.clock.initialSec > 0) || serverNow() - (c.moveAt || 0) <= IDLE_MS) return false;
        c.status = 'finished';
        c.winner = c.turn === 'w' ? 'b' : 'w';
        c.statusNote = 'won - opponent abandoned (no move for 24h)';
        c.drawOffer = '';
      }).then(function(){ setTimeout(function(){ busy = false; }, 3000); });
    }
  }
  var prevTick = window.clockTick;
  window.clockTick = function(){ checkAbandon(); return prevTick(); };

  // ---------- 7. presence heartbeat loop ----------
  setInterval(function(){
    try{
      var g = gameState;
      var onGame = document.getElementById('screen-game').style.display === 'block';
      var want = (ME && g && onGame && g.status === 'active' && currentGameId && myRole(g)) ? currentGameId : null;
      if(want !== PRES.gid){ detach(); if(want) attach(want); }
      updateAbsence();
    }catch(e){ console.error('presence tick failed', e); }
    try{ paintAbandon(); }catch(e){ console.error('paintAbandon failed', e); }
  }, 1000);

  // ---------- 8. game screen touch-ups ----------
  var prevDraw = window.drawGame;
  window.drawGame = function(){
    prevDraw();
    var g = gameState; if(!g) return;
    var me = myRole(g);
    if(g.status === 'finished' && g.winner === 'abort'){
      var b = document.querySelector('#screen-game .result-banner');
      if(b){
        if(b.firstChild && b.firstChild.nodeType === 3) b.firstChild.nodeValue = 'Game aborted';
        b.querySelectorAll('.rc').forEach(function(d){ if(/^Updating rating/.test(d.textContent)) d.remove(); });
      }
    }
    // before both sides have moved: "Abort" replaces Offer draw / Resign (same as Lichess)
    if(g.status === 'active' && me && g.variant !== 'auction' && (g.moveLog || []).length < 2){
      var acts = document.querySelector('#screen-game .game-actions');
      if(acts && !document.getElementById('btnAbort')){
        var o = document.getElementById('btnOfferDraw'), r = document.getElementById('btnResign');
        if(o) o.style.display = 'none';
        if(r) r.style.display = 'none';
        var a = document.createElement('button');
        a.className = 'secondary danger'; a.id = 'btnAbort'; a.textContent = 'Abort game';
        a.onclick = abortGame;
        acts.appendChild(a);
      }
    }
    paintAbandon();
  };

  // ---------- 9. waiting rooms: a closed tab must not hold a seat forever ----------
  var seatArm = null;   // {code, key, ref}
  function disarmSeat(){
    if(seatArm){ try{ seatArm.ref.onDisconnect().cancel(); }catch(e){} seatArm = null; }
  }
  async function freeSeatNow(){
    if(!seatArm) return;
    var a = seatArm; disarmSeat();
    try{
      var st = await db.ref(dbPath('hb:game:' + a.code + '/status')).once('value');
      var cur = await db.ref(dbPath('hb:game:' + a.code + '/seats/' + a.key)).once('value');
      if(st.val() === 'waiting' && ME && cur.val() === ME.username){
        await db.ref(dbPath('hb:game:' + a.code + '/seats/' + a.key)).set('');
      }
    }catch(e){ console.error(e); }
  }
  var prevDW = window.drawWaiting;
  window.drawWaiting = function(code, game){
    prevDW(code, game);
    var mine = null;
    Object.keys(game.seats || {}).forEach(function(k){ if(game.seats[k] === ME.username) mine = k; });
    if(!mine){ disarmSeat(); return; }
    if(!seatArm || seatArm.code !== code || seatArm.key !== mine){
      disarmSeat();
      var ref = db.ref(dbPath('hb:game:' + code + '/seats/' + mine));
      ref.onDisconnect().set('');        // server clears the seat if we vanish while the room is still waiting
      seatArm = {code:code, key:mine, ref:ref};
    }
  };
  var curScreen = null, prevShow = window.showScreen;
  window.showScreen = function(n){
    var leaving = curScreen === 'waiting' && n !== 'waiting';
    curScreen = n;
    if(leaving){ if(n === 'game') disarmSeat(); else freeSeatNow(); }   // game started -> keep the seat
    prevShow(n);
  };
  var prevLogout = window.logout;
  window.logout = async function(){ await freeSeatNow(); return prevLogout(); };

  // ---------- 10. quick-match queue: closing the tab removes you from it ----------
  var prevQuick = window.quickMatch;
  window.quickMatch = async function(){
    await prevQuick();
    try{ db.ref('hb/queue/random/' + ME.username).onDisconnect().remove(); }catch(e){}
  };

  // ---------- 11. coming back later settles games you walked away from ----------
  // Without this, walking away from a losing game would dodge the rating loss.
  var resumed = {};
  function unsettled(g, me){
    var ratingPending = g.mode === 'random' && g.ratingSnapshot && !(g.ratingApplied && g.ratingApplied[me.side]);
    var statsPending = !(g.statsApplied && g.statsApplied[ME.username]);
    return ratingPending || statsPending;
  }
  var prevAfter = window.afterAuth;
  window.afterAuth = async function(){
    var invite = (new URLSearchParams(location.search).get('room') || '');
    if(!invite){
      try{
        var last = await kget('hb:lastgame', false);
        if(last && last.gameId && !resumed[last.gameId] && (Date.now() - last.savedAt) < 7*86400000){
          var g = await kget('hb:game:' + last.gameId, true);
          var me = g && myRole(g);
          if(me){
            // active games (however old) re-open so a lapsed clock / idle rule can finish them;
            // finished ones re-open once so your rating + record get applied
            if(g.status === 'active' || (g.status === 'finished' && g.winner !== 'abort' && unsettled(g, me))){
              resumed[last.gameId] = true;
              currentGameId = last.gameId;
              enterGameScreen(last.gameId);
              return;
            }
          }
        }
      }catch(e){ console.error(e); }
    }
    return prevAfter();
  };
})();
