(function(){
  var EXPIRE_MS = 120000;    // a challenge lasts 2 minutes
  var HEART_MS  = 45000;     // how often your own status is refreshed
  var IDLE_MS   = 180000;    // no mouse / keyboard / touch for 3 minutes = idle
  var STALE_MS  = 180000;    // a status older than this is treated as offline (the tab probably crashed)
  var PREF_KEY  = 'pawniac-challenge';
  var NAME_RE   = /^[A-Za-z0-9_]{3,20}$/;
  var TS        = firebase.database.ServerValue.TIMESTAMP;
  var LBL       = {online:'Online', idle:'Idle', playing:'In a game', offline:'Offline'};

  function esc(s){ return String(s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function ago(ms){
    var s = Math.max(0, Math.round((serverNow() - ms) / 1000));
    if(s < 60) return 'just now';
    if(s < 3600) return Math.floor(s / 60) + 'm ago';
    if(s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  }
  function tcLabel(key){
    if(key === 'none') return 'No clock';
    var m = /^c?(\d+)\+(\d+)$/.exec(key || '');
    return m ? m[1] + '+' + m[2] : String(key);
  }
  function inGameNow(){
    var g = gameState, s = document.getElementById('screen-game');
    return !!(ME && g && g.status === 'active' && s && s.style.display === 'block' && myRole(g));
  }
  // what a stored status really means right now
  function effOf(v){
    if(!v || typeof v.t !== 'number') return {s:'offline', t:0};
    if(v.s !== 'offline' && serverNow() - v.t > STALE_MS) return {s:'offline', t:v.t};
    return v;
  }

  // =====================================================================
  //  1. your own status
  // =====================================================================
  var meName = null, statusRef = null, connRef = null, connCb = null;
  var lastActive = Date.now(), lastWritten = null, lastWriteAt = 0;

  function bumpActive(){ lastActive = Date.now(); if(lastWritten === 'idle') ownTick(); }
  ['pointerdown', 'keydown', 'mousemove', 'touchstart', 'wheel'].forEach(function(ev){
    document.addEventListener(ev, bumpActive, {passive:true, capture:true});
  });
  document.addEventListener('visibilitychange', function(){ if(!document.hidden) bumpActive(); });

  function computeState(){
    if(inGameNow()) return 'playing';
    return (Date.now() - lastActive > IDLE_MS) ? 'idle' : 'online';
  }
  function writeStatus(st){
    if(!statusRef) return;
    statusRef.set({s:st, t:TS}).catch(function(){});
    lastWritten = st; lastWriteAt = Date.now();
  }
  function startOwn(){
    stopOwn(false);
    meName = ME.username;
    statusRef = db.ref('hb/status/' + meName);
    connRef = db.ref('.info/connected');
    // whenever the connection comes up: arrange "offline" for when it drops, then say we are here
    connCb = connRef.on('value', function(s){
      if(s.val() === true && statusRef){
        statusRef.onDisconnect().set({s:'offline', t:TS}).then(function(){ writeStatus(computeState()); }).catch(function(){});
      }
    });
  }
  function stopOwn(markOffline){
    var p = null;
    try{ if(connRef) connRef.off('value', connCb); }catch(e){}
    if(statusRef){
      try{ statusRef.onDisconnect().cancel(); }catch(e){}
      if(markOffline) p = statusRef.set({s:'offline', t:TS}).catch(function(){});
    }
    connRef = null; connCb = null; statusRef = null; meName = null; lastWritten = null;
    return p;
  }
  function ownTick(){
    if(!ME) return;
    if(meName !== ME.username){ startOwn(); return; }
    var st = computeState();
    if(st !== lastWritten || Date.now() - lastWriteAt >= HEART_MS) writeStatus(st);
  }

  // =====================================================================
  //  2. everyone's status (only listened to on the pages that show names)
  // =====================================================================
  var STATUS = {}, feed = {on:false, loaded:false, failed:false, ref:null};
  var paintTimer = null;
  function schedulePaint(){ if(!paintTimer) paintTimer = setTimeout(function(){ paintTimer = null; paintAll(); }, 120); }

  function feedOn(){
    if(feed.on) return;
    var ref = db.ref('hb/status');
    feed.on = true; feed.loaded = false; feed.failed = false; feed.ref = ref;
    ref.once('value').then(function(s){
      if(!feed.on || feed.ref !== ref) return;
      STATUS = s.val() || {};
      feed.loaded = true;
      var up = function(c){ STATUS[c.key] = c.val(); schedulePaint(); };
      ref.on('child_added', up);
      ref.on('child_changed', up);
      ref.on('child_removed', function(c){ delete STATUS[c.key]; schedulePaint(); });
      schedulePaint();
    }).catch(function(e){ console.error('status feed failed', e); feed.failed = true; schedulePaint(); });
    schedulePaint();
  }
  function feedOff(){
    if(!feed.on) return;
    feed.on = false;
    try{ if(feed.ref) feed.ref.off(); }catch(e){}
    feed.ref = null;
  }
  function eff(n){ return effOf(STATUS[n]); }
  function statusText(n){
    if(feed.failed) return 'status unavailable';
    if(!feed.loaded) return 'checking...';
    var e = eff(n);
    return LBL[e.s] + (e.s === 'offline' && e.t ? ' \u00b7 last seen ' + ago(e.t) : '');
  }

  function dotHtml(n){ return '<span class="st-dot" data-st="' + esc(n) + '"></span>'; }
  function chBtnHtml(n){ return '<button class="secondary ch-btn" data-chto="' + esc(n) + '">Challenge</button>'; }

  function paintAll(){
    document.querySelectorAll('.st-dot[data-st]').forEach(function(d){
      var n = d.dataset.st, st = (!feed.loaded || feed.failed) ? 'unknown' : eff(n).s;
      d.className = 'st-dot st-' + st;
      d.title = statusText(n);
    });
    document.querySelectorAll('[data-stfull]').forEach(function(el){ el.textContent = statusText(el.dataset.stfull); });
    document.querySelectorAll('.ch-btn[data-chto]').forEach(function(b){
      var n = b.dataset.chto, off = feed.loaded && !feed.failed && eff(n).s === 'offline';
      b.disabled = off;
      b.title = off ? 'They are offline right now' : 'Challenge ' + n + ' to a game';
    });
    renderPlayers();
  }
  setInterval(function(){ if(feed.on) paintAll(); }, 30000);   // keeps "last seen 5m ago" fresh

  // names in the leaderboard / knight's tour lists get a dot and a Challenge button
  function decorateRows(){
    if(!ME) return;
    var changed = false;
    document.querySelectorAll('#screen-leaderboard .seat .who .user-link[data-user], #ktBoard .seat .who .user-link[data-user]').forEach(function(a){
      var n = a.dataset.user, who = a.parentNode;
      if(who.querySelector('.st-dot[data-st="' + n + '"]')) return;
      var tmp = document.createElement('span');
      tmp.innerHTML = dotHtml(n);
      who.insertBefore(tmp.firstChild, a);
      if(n !== ME.username && who.closest('#screen-leaderboard')){
        var b = document.createElement('span');
        b.innerHTML = chBtnHtml(n);
        var btn = b.firstChild;
        btn.onclick = function(e){ e.stopPropagation(); openDialog(n); };
        who.appendChild(btn);
      }
      changed = true;
    });
    if(changed) schedulePaint();
  }
  ['screen-leaderboard', 'screen-minigames'].forEach(function(id){
    var el = document.getElementById(id);
    if(el) new MutationObserver(decorateRows).observe(el, {childList:true, subtree:true});
  });

  // =====================================================================
  //  3. the "Players" card on the Leaderboard page
  // =====================================================================
  function rowHtml(n){
    return '<div class="pl-row">' + dotHtml(n) + '<span class="user-link" data-user="' + esc(n) + '">' + esc(n) + '</span>' +
      '<span class="st-txt" data-stfull="' + esc(n) + '"></span><span class="grow"></span>' + chBtnHtml(n) + '</div>';
  }
  function renderPlayers(){
    var el = document.getElementById('plList');
    if(!el) return;
    if(feed.failed){ el.innerHTML = '<p class="hint">Player status needs the new Firebase rules (see the setup note).</p>'; return; }
    if(!feed.loaded){ el.innerHTML = '<p class="hint">Loading...</p>'; return; }
    var order = {online:0, playing:1, idle:2}, me = ME && ME.username;
    var list = Object.keys(STATUS).filter(function(n){ return n !== me && NAME_RE.test(n) && eff(n).s !== 'offline'; })
      .sort(function(a, b){ return (order[eff(a).s] - order[eff(b).s]) || a.localeCompare(b); }).slice(0, 25);
    el.innerHTML = list.length ? list.map(rowHtml).join('') : '<p class="hint">Nobody else is online right now.</p>';
    el.querySelectorAll('.ch-btn[data-chto]').forEach(function(b){ b.onclick = function(){ openDialog(b.dataset.chto); }; });
    el.querySelectorAll('.st-dot[data-st]').forEach(function(d){ d.className = 'st-dot st-' + eff(d.dataset.st).s; d.title = statusText(d.dataset.st); });
    el.querySelectorAll('[data-stfull]').forEach(function(t){ t.textContent = statusText(t.dataset.stfull); });
  }
  function addPlayersCard(){
    var el = document.getElementById('screen-leaderboard');
    if(!el || el.querySelector('#plCard')) return;
    var card = document.createElement('div');
    card.className = 'card';
    card.id = 'plCard';
    card.innerHTML = '<h2>Players</h2>' +
      '<div class="row" style="margin-bottom:6px;"><input type="text" id="plSearch" placeholder="find a player by username" maxlength="20" autocomplete="off"><button class="secondary" id="plGo">Open profile</button></div>' +
      '<div class="hint" id="plMsg" style="margin:0 0 10px;">Open anyone\'s profile to see if they are online and to challenge them.</div>' +
      '<div class="hint" style="margin:6px 0 2px;font-weight:700;">Online now</div><div id="plList"></div>';
    el.insertBefore(card, el.firstChild);
    var input = card.querySelector('#plSearch'), msg = card.querySelector('#plMsg');
    function go(){
      var v = input.value.trim();
      if(!NAME_RE.test(v)){ msg.textContent = 'Enter a username: 3-20 letters, numbers or underscores.'; return; }
      msg.textContent = '';
      window.openProfile(v);
    }
    card.querySelector('#plGo').onclick = go;
    input.onkeydown = function(e){ if(e.key === 'Enter') go(); };
    schedulePaint();
  }

  // =====================================================================
  //  4. challenge dialog (variant + time control + colour)
  // =====================================================================
  var D = null;
  function loadPref(){
    var d = {variant:'hb', tc:'5+3', color:'random', min:10, inc:0, custom:false};
    try{ Object.assign(d, JSON.parse(localStorage.getItem(PREF_KEY) || '{}')); }catch(e){}
    if(['hb', 'standard', 'auction'].indexOf(d.variant) < 0) d.variant = 'hb';
    if(['random', 'w', 'b'].indexOf(d.color) < 0) d.color = 'random';
    if(!/^(none|\d+\+\d+)$/.test(String(d.tc))) d.tc = '5+3';
    d.min = Math.min(180, Math.max(1, parseInt(d.min, 10) || 10)); d.inc = Math.min(60, Math.max(0, parseInt(d.inc, 10) || 0));
    return d;
  }
  function savePref(){ try{ localStorage.setItem(PREF_KEY, JSON.stringify({variant:D.variant, tc:D.tc, color:D.color, min:D.min, inc:D.inc, custom:D.custom})); }catch(e){} }
  function tcKey(){ return D.custom ? 'c' + D.min + '+' + D.inc : D.tc; }

  function stateLine(){
    if(!D.stLoaded) return 'Checking if they are around...';
    if(D.stFailed) return 'Could not check their status.';
    var e = effOf(D.st);
    if(e.s === 'online') return 'Online. They will see your challenge right away.';
    if(e.s === 'idle') return 'Idle. They are on Pawniac but away for a moment.';
    if(e.s === 'playing') return 'In a game. They can accept once they are done (a challenge lasts 2 minutes).';
    return 'Offline' + (e.t ? ' (last seen ' + ago(e.t) + ')' : '') + '. You cannot challenge them right now.';
  }
  function offlineNow(){ return D.stLoaded && !D.stFailed && effOf(D.st).s === 'offline'; }

  function openDialog(name){
    if(!ME) return;
    if(name === ME.username){ return; }
    if(!NAME_RE.test(name)) return;
    if(inGameNow()){ flash('Finish your current game before challenging someone.'); return; }
    var p = loadPref();
    D = {to:name, variant:p.variant, tc:p.tc, color:p.color, min:p.min, inc:p.inc, custom:!!p.custom, st:null, stLoaded:false, stFailed:false};
    renderDialog();
    db.ref('hb/status/' + name).once('value').then(function(s){
      if(!D || D.to !== name) return;
      D.st = s.val(); D.stLoaded = true; renderDialog();
    }).catch(function(){
      if(!D || D.to !== name) return;
      D.stLoaded = true; D.stFailed = true; renderDialog();
    });
  }
  function closeDialog(){
    D = null;
    var ov = document.getElementById('chOv');
    if(ov && ov.parentNode) ov.parentNode.removeChild(ov);
  }
  function renderDialog(){
    if(!D) return;
    var ov = document.getElementById('chOv');
    if(!ov){
      ov = document.createElement('div');
      ov.id = 'chOv';
      ov.className = 'ch-ov';
      ov.addEventListener('mousedown', function(e){ if(e.target === ov) closeDialog(); });
      document.body.appendChild(ov);
    }
    var tcs = TIME_CONTROLS.map(function(t){
      return '<div class="tcbtn' + (!D.custom && D.tc === t.key ? ' active' : '') + '" data-tc="' + t.key + '">' + t.label + '</div>';
    }).join('') + '<div class="tcbtn' + (D.custom ? ' active' : '') + '" data-tc="custom">Custom</div>';
    var custom = D.custom
      ? '<div class="row" style="margin:6px 0 4px;"><input type="number" id="chMin" min="1" max="180" value="' + D.min + '"><span class="hint">min +</span><input type="number" id="chInc" min="0" max="60" value="' + D.inc + '"><span class="hint">sec per move</span></div>' : '';
    var colors = [['random', 'Random'], ['w', 'White'], ['b', 'Black']].map(function(c){
      return '<div class="tcbtn' + (D.color === c[0] ? ' active' : '') + '" data-co="' + c[0] + '">' + c[1] + '</div>';
    }).join('');
    ov.innerHTML = '<div class="ch-box" role="dialog" aria-label="Challenge ' + esc(D.to) + '">' +
      '<h2>Challenge ' + esc(D.to) + '</h2>' +
      '<div class="hint" style="margin:0;"><span class="st-dot st-' + (D.stLoaded && !D.stFailed ? effOf(D.st).s : 'unknown') + '"></span>' + esc(stateLine()) + '</div>' +
      '<div class="lbl">Game</div>' +
      '<div class="modes"><div class="modebtn' + (D.variant === 'hb' ? ' active' : '') + '" data-v="hb">Hand &amp; Brain<div class="hint">Name a piece, then move it</div></div>' +
      '<div class="modebtn' + (D.variant === 'standard' ? ' active' : '') + '" data-v="standard">Standard Chess<div class="hint">Normal chess rules</div></div>' + '<div class="modebtn' + (D.variant === 'auction' ? ' active' : '') + '" data-v="auction">Piece Auction<div class="hint">Bid coins, build your army</div></div></div>' +
      '<div class="lbl">Time control</div><div class="tc-row">' + tcs + '</div>' + custom +
      '<div class="lbl">You play</div><div class="tc-row">' + colors + '</div>' +
      '<div class="ch-acts"><button id="chSend"' + (offlineNow() || inGameNow() ? ' disabled' : '') + '>Send challenge</button><button class="secondary" id="chCancel">Cancel</button></div></div>';
    ov.querySelectorAll('[data-v]').forEach(function(b){ b.onclick = function(){ D.variant = b.dataset.v; savePref(); renderDialog(); }; });
    ov.querySelectorAll('[data-tc]').forEach(function(b){
      b.onclick = function(){
        if(b.dataset.tc === 'custom') D.custom = true; else { D.custom = false; D.tc = b.dataset.tc; }
        savePref(); renderDialog();
      };
    });
    ov.querySelectorAll('[data-co]').forEach(function(b){ b.onclick = function(){ D.color = b.dataset.co; savePref(); renderDialog(); }; });
    var mi = ov.querySelector('#chMin'), ii = ov.querySelector('#chInc');
    if(mi) mi.oninput = function(){ D.min = Math.min(180, Math.max(1, parseInt(mi.value, 10) || 1)); savePref(); };
    if(ii) ii.oninput = function(){ D.inc = Math.min(60, Math.max(0, parseInt(ii.value, 10) || 0)); savePref(); };
    ov.querySelector('#chCancel').onclick = closeDialog;
    ov.querySelector('#chSend').onclick = sendChallenge;
  }
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && D) closeDialog(); });

  // =====================================================================
  //  5. sending a challenge, and the notifications (incoming and outgoing)
  // =====================================================================
  var OUT = null;        // the challenge you sent: {to, ref, cb, t0, state, data}
  var INC = {};          // challenges sent to you: from -> data
  var MSGS = [];         // short messages: {text, until}
  var inboxRef = null, inboxFor = null, busyAcc = false;

  function flash(text){ MSGS.push({text:text, until:Date.now() + 5000}); renderToasts(); }

  function cancelOut(silent){
    if(!OUT) return;
    var o = OUT; OUT = null;
    try{ o.ref.off('value', o.cb); }catch(e){}
    if(o.state === 'pending' || o.state === 'declined') o.ref.remove().catch(function(){});
    if(!silent) renderToasts();
  }
  async function sendChallenge(){
    if(!D || !ME) return;
    if(offlineNow() || inGameNow()) return;
    var to = D.to, data = {from:ME.username, to:to, variant:D.variant, tc:tcKey(), color:D.color, ts:TS, status:'pending'};
    savePref();
    closeDialog();
    cancelOut(true);
    var ref = db.ref('hb/challenges/' + to + '/' + ME.username);
    try{ await ref.set(data); }
    catch(e){
      console.error(e);
      flash(e && e.code === 'PERMISSION_DENIED' ? "Couldn't send: publish the new Firebase rules first." : "Couldn't send the challenge.");
      return;
    }
    var o = {to:to, ref:ref, t0:Date.now(), state:'pending', data:data, cb:null};
    OUT = o;
    o.cb = ref.on('value', function(s){
      if(OUT !== o) return;
      var v = s.val();
      if(!v){
        if(o.state === 'pending'){ o.state = 'gone'; renderToasts(); setTimeout(function(){ if(OUT === o){ OUT = null; renderToasts(); } }, 4000); }
        return;
      }
      if(v.status === 'accepted' && v.gameId){
        var gid = v.gameId;
        try{ ref.off('value', o.cb); }catch(e){}
        ref.remove().catch(function(){});
        OUT = null; renderToasts();
        currentGameId = gid;
        enterGameScreen(gid);
      } else if(v.status === 'declined' && o.state === 'pending'){
        o.state = 'declined'; renderToasts();
        setTimeout(function(){ if(OUT === o) cancelOut(false); }, 6000);
      }
    });
    renderToasts();
  }

  function colorText(c){ return c === 'w' ? 'You play Black' : (c === 'b' ? 'You play White' : 'Colours are random'); }
  function renderToasts(){
    var box = document.getElementById('chToasts');
    if(!box){ box = document.createElement('div'); box.id = 'chToasts'; document.body.appendChild(box); }
    var h = '';
    MSGS.forEach(function(m){ h += '<div class="ch-toast msg">' + esc(m.text) + '</div>'; });
    if(OUT){
      if(OUT.state === 'pending') h += '<div class="ch-toast"><div class="ct">Challenge sent to ' + esc(OUT.to) + '</div><div class="cs">' + ({standard:'Standard', auction:'Piece Auction'}[OUT.data.variant] || 'Hand & Brain') + ' &middot; ' + esc(tcLabel(OUT.data.tc)) + ' &middot; waiting for an answer (<span data-oexp="1"></span>)</div><div class="cb"><button class="secondary" data-oact="cancel">Cancel</button></div></div>';
      else if(OUT.state === 'declined') h += '<div class="ch-toast"><div class="ct">' + esc(OUT.to) + ' declined your challenge.</div></div>';
      else if(OUT.state === 'expired') h += '<div class="ch-toast"><div class="ct">' + esc(OUT.to) + ' did not answer in time.</div></div>';
      else if(OUT.state === 'gone') h += '<div class="ch-toast"><div class="ct">The challenge to ' + esc(OUT.to) + ' was withdrawn.</div></div>';
    }
    Object.keys(INC).forEach(function(f){
      var c = INC[f];
      h += '<div class="ch-toast"><div class="ct">' + esc(f) + ' challenges you!</div><div class="cs">' + ({standard:'Standard Chess', auction:'Piece Auction'}[c.variant] || 'Hand &amp; Brain') + ' &middot; ' + esc(tcLabel(c.tc)) + ' &middot; ' + colorText(c.color) +
        ' &middot; <span data-iexp="' + esc(f) + '"></span></div><div class="cb"><button data-iacc="' + esc(f) + '"' + (inGameNow() ? ' disabled title="Finish your game first"' : '') + '>Accept</button><button class="secondary" data-idec="' + esc(f) + '">Decline</button></div></div>';
    });
    box.innerHTML = h;
    box.querySelectorAll('[data-iacc]').forEach(function(b){ b.onclick = function(){ acceptChallenge(b.dataset.iacc); }; });
    box.querySelectorAll('[data-idec]').forEach(function(b){ b.onclick = function(){ declineChallenge(b.dataset.idec); }; });
    box.querySelectorAll('[data-oact="cancel"]').forEach(function(b){ b.onclick = function(){ cancelOut(false); }; });
    tickToasts();
  }
  function fmtLeft(ms){ var s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60); }
  function tickToasts(){
    var changed = false, now = Date.now();
    MSGS = MSGS.filter(function(m){ if(m.until <= now){ changed = true; return false; } return true; });
    Object.keys(INC).forEach(function(f){
      var left = EXPIRE_MS - (serverNow() - INC[f].ts);
      if(left <= 0){
        delete INC[f]; changed = true;
        if(inboxRef) inboxRef.child(f).remove().catch(function(){});
      } else {
        var s = document.querySelector('[data-iexp="' + f + '"]');
        if(s) s.textContent = fmtLeft(left) + ' left';
        var acc = document.querySelector('[data-iacc="' + f + '"]');
        if(acc) acc.disabled = inGameNow();
      }
    });
    if(OUT && OUT.state === 'pending'){
      var l2 = EXPIRE_MS - (now - OUT.t0);
      if(l2 <= 0){
        OUT.state = 'expired'; changed = true;
        try{ OUT.ref.remove().catch(function(){}); }catch(e){}
        try{ OUT.ref.off('value', OUT.cb); }catch(e){}
        var o2 = OUT; setTimeout(function(){ if(OUT === o2){ OUT = null; renderToasts(); } }, 5000);
      } else {
        var s2 = document.querySelector('[data-oexp]');
        if(s2) s2.textContent = fmtLeft(l2) + ' left';
      }
    }
    if(changed) renderToasts();
  }

  // ---- incoming ----
  function attachInbox(){
    detachInbox();
    inboxFor = ME.username;
    inboxRef = db.ref('hb/challenges/' + ME.username);
    var upd = function(s){
      var v = s.val();
      if(!v || v.status !== 'pending' || typeof v.ts !== 'number'){ delete INC[s.key]; renderToasts(); return; }
      if(serverNow() - v.ts > EXPIRE_MS){ delete INC[s.key]; inboxRef.child(s.key).remove().catch(function(){}); renderToasts(); return; }
      var isNew = !INC[s.key];
      INC[s.key] = v;
      if(isNew) try{ playGameStartSound(); }catch(e){}
      renderToasts();
    };
    inboxRef.on('child_added', upd);
    inboxRef.on('child_changed', upd);
    inboxRef.on('child_removed', function(s){ delete INC[s.key]; renderToasts(); });
  }
  function detachInbox(){
    try{ if(inboxRef) inboxRef.off(); }catch(e){}
    inboxRef = null; inboxFor = null; INC = {};
  }
  async function declineChallenge(from){
    var ref = db.ref('hb/challenges/' + ME.username + '/' + from);
    delete INC[from]; renderToasts();
    try{
      var v = (await ref.once('value')).val();
      if(v) await ref.update({status:'declined'});
      setTimeout(function(){ ref.remove().catch(function(){}); }, 8000);
    }catch(e){ console.error(e); }
  }
  async function acceptChallenge(from){
    if(busyAcc || !ME) return;
    if(inGameNow()){ flash('Finish your current game first.'); return; }
    busyAcc = true;
    try{
      var ref = db.ref('hb/challenges/' + ME.username + '/' + from);
      var c = (await ref.once('value')).val();
      if(!c || c.status !== 'pending' || serverNow() - c.ts > EXPIRE_MS){ delete INC[from]; renderToasts(); flash('That challenge is no longer available.'); return; }
      var sst = (await db.ref('hb/status/' + from).once('value')).val();
      if(effOf(sst).s === 'offline'){
        delete INC[from]; renderToasts();
        ref.remove().catch(function(){});
        flash(from + ' has gone offline, so the challenge was cancelled.');
        return;
      }
      var std = c.variant === 'standard', lbp = std ? 'hb:leaderboardStd:' : 'hb:leaderboard:';
      var mp = (await kget(lbp + ME.username, true)) || {rating:1200, games:0};
      var op = (await kget(lbp + from, true)) || {rating:1200, games:0};
      var meWhite = c.color === 'random' ? Math.random() < 0.5 : (c.color === 'b');   // their colour choice is theirs: 'w' means THEY play White
      var seats = meWhite ? {white:ME.username, black:from} : {white:from, black:ME.username};
      var code = genCode();
      var game = {
        mode:'random', status:'active', fen:new Chess().fen(), turn:'w', announced:std ? 'std' : null,
        moveLog:[], winner:null, drawOffer:'', clock:freshClock(c.tc), seats:seats,
        ratingSnapshot: meWhite ? {white:mp.rating, black:op.rating} : {white:op.rating, black:mp.rating}, wantAuction: c.variant === 'auction'
      };
      if(std) game.variant = 'standard';
      var saved = await kset('hb:game:' + code, game, true);
      if(!saved){ flash("Couldn't start the game."); return; }
      await ref.update({status:'accepted', gameId:code});
      delete INC[from]; renderToasts();
      currentGameId = code;
      enterGameScreen(code);
    }catch(e){
      console.error('accept failed', e);
      flash("Couldn't accept the challenge.");
    }finally{ busyAcc = false; }
  }

  // =====================================================================
  //  6. profile pages
  // =====================================================================
  function decorateProfile(name){
    var scr = document.getElementById('screen-profile');
    var nameEl = scr && scr.querySelector('.pf-name');
    if(!scr || scr.style.display !== 'block' || !nameEl || nameEl.textContent.indexOf(name) !== 0) return;
    if(scr.querySelector('.pf-status')) return;
    var row = document.createElement('div');
    row.className = 'pf-status';
    row.innerHTML = dotHtml(name) + '<span class="st-txt" data-stfull="' + esc(name) + '" style="font-size:13px;opacity:.85;"></span>';
    nameEl.after(row);
    if(ME && name !== ME.username){
      var tmp = document.createElement('span');
      tmp.innerHTML = chBtnHtml(name);
      var btn = tmp.firstChild;
      btn.onclick = function(){ openDialog(name); };
      row.appendChild(btn);
    }
    schedulePaint();
  }

  // =====================================================================
  //  7. hooks into the rest of the page
  // =====================================================================
  var prevShow = window.showScreen;
  window.showScreen = function(n){
    prevShow(n);
    if(n === 'leaderboard' || n === 'profile' || n === 'minigames') feedOn(); else feedOff();
  };
  var prevLb = window.renderLeaderboard;
  window.renderLeaderboard = async function(){
    var r = await prevLb.apply(this, arguments);
    try{ addPlayersCard(); }catch(e){ console.error('players card failed', e); }
    return r;
  };
  var prevOpen = window.openProfile;
  window.openProfile = async function(name){
    var r = await prevOpen.apply(this, arguments);
    try{ decorateProfile(name); }catch(e){ console.error('profile status failed', e); }
    return r;
  };
  var prevLogout = window.logout;
  window.logout = async function(){
    try{ cancelOut(true); detachInbox(); closeDialog(); renderToasts(); }catch(e){}
    try{
      var p = stopOwn(true);
      if(p) await Promise.race([p, new Promise(function(r){ setTimeout(r, 1500); })]);
    }catch(e){}
    return prevLogout();
  };

  // one timer drives everything
  var n10 = 0;
  setInterval(function(){
    try{
      if(ME){
        if(inboxFor !== ME.username) attachInbox();
        if(++n10 % 10 === 0 || meName !== ME.username) ownTick();   // every 10s (and right away after login)
      } else if(inboxFor){
        detachInbox(); renderToasts();
      }
      tickToasts();
    }catch(e){ console.error('status tick failed', e); }
  }, 1000);
})();
