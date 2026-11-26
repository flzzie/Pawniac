// Open games: post a game (variant + time control) and see everyone else's posted games in the Play lobby.
// One click on "Play" starts the game. It uses the same queue as Quick match (hb/queue/random), so nobody
// needs a challenge, and Quick match players can still be paired with a posted game automatically.
(function(){
  'use strict';
  var QP = 'hb/queue/random';
  var VNAME = {hb:'Hand & Brain', standard:'Standard', auction:'Piece Auction', double:'Double Move'};
  var VKEYS = ['standard', 'hb', 'auction', 'double'];
  var LB = {hb:'hb:leaderboard:', standard:'hb:leaderboardStd:', auction:'hb:leaderboardAuc:', double:'hb:leaderboardDbl:'};
  var STALE_MS = 30 * 60 * 1000;       // a post nobody has refreshed for 30 minutes is ignored
  var BEAT_MS = 25000;
  var PREF = 'pawniac-opengame-v1';

  var S = {v:'standard', tc:'5+3', mine:null, list:[], qCb:null, qRef:null, beat:0, busy:false, cache:{}};
  try{ var p = JSON.parse(localStorage.getItem(PREF) || 'null'); if(p){ if(VNAME[p.v]) S.v = p.v; if(p.tc) S.tc = p.tc; } }catch(e){}

  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]; }); }
  function tcLabel(key){
    if(key === 'none') return 'No clock';
    var m = /^c?(\d+)\+(\d+)$/.exec(key || '');
    return m ? m[1] + '+' + m[2] : String(key || '');
  }
  function waited(ms){
    var s = Math.max(0, Math.round((serverNow() - ms) / 1000));
    if(s < 45) return 'just now';
    if(s < 3600) return Math.max(1, Math.round(s / 60)) + 'm';
    return Math.floor(s / 3600) + 'h';
  }
  function inGame(){
    var g = (typeof gameState !== 'undefined') ? gameState : null, sc = document.getElementById('screen-game');
    return !!(ME && g && g.status === 'active' && sc && sc.style.display === 'block' && myRole(g));
  }
  var noteText = '', noteAt = 0;
  function note(t){ noteText = t || ''; noteAt = Date.now(); var el = document.getElementById('ogNote'); if(el) el.textContent = noteText; }
  function save(){ try{ localStorage.setItem(PREF, JSON.stringify({v:S.v, tc:S.tc})); }catch(e){} }

  // ---------- posting my own game ----------
  async function post(){
    if(!ME || S.busy) return;
    if(inGame()){ note('Finish your current game first.'); return; }
    S.busy = true;
    try{
      try{ stopPoll(); }catch(e){}
      await dropMine(false);
      var ref = db.ref(QP + '/' + ME.username);
      await ref.set({joinedAt:serverNow(), gameId:'', tc:S.tc, variant:S.v});
      try{ ref.onDisconnect().remove(); }catch(e){}
      var gref = db.ref(QP + '/' + ME.username + '/gameId');
      var cb = gref.on('value', function(s){
        var gid = s.val();
        if(!gid) return;
        dropMine(false, true);
        currentGameId = gid;
        enterGameScreen(gid);
      });
      S.mine = {ref:ref, gref:gref, cb:cb, v:S.v, tc:S.tc};
      S.beat = setInterval(heartbeat, BEAT_MS);
    }catch(e){ console.error('post failed', e); note('Could not post your game. Try again.'); }
    S.busy = false;
    paint();
  }
  async function dropMine(repaint, force){
    var m = S.mine; S.mine = null;
    if(S.beat){ clearInterval(S.beat); S.beat = 0; }
    if(m){
      try{ m.gref.off('value', m.cb); }catch(e){}
      try{ m.ref.onDisconnect().cancel(); }catch(e){}
      try{ var cur = (await m.ref.once('value')).val(); if(cur && (force || !cur.gameId)) await m.ref.remove(); }catch(e){}
    }
    if(repaint !== false) paint();
  }
  function heartbeat(){
    if(!S.mine || !ME) return;
    if(inGame()){ dropMine(); return; }         // started a game some other way: stop advertising
    S.mine.ref.update({joinedAt:serverNow()}).catch(function(){});
  }

  // ---------- accepting somebody else's game ----------
  async function accept(name){
    if(!ME || S.busy) return;
    if(inGame()){ note('Finish your current game first.'); return; }
    S.busy = true; note('Starting...');
    var code = null;
    try{
      var qref = db.ref(QP + '/' + name);
      var e = (await qref.once('value')).val();
      if(!e || e.gameId){ note('That game was just taken.'); S.busy = false; return; }
      var v = VNAME[e.variant] ? e.variant : 'hb', std = v === 'standard', lbp = std ? 'hb:leaderboardStd:' : 'hb:leaderboard:';
      var mp = (await kget(lbp + ME.username, true)) || {rating:1200, games:0};
      var op = (await kget(lbp + name, true)) || {rating:1200, games:0};
      var meW = Math.random() < 0.5;
      code = genCode();
      var game = {
        mode:'random', status:'active', fen:new Chess().fen(), turn:'w', announced:std ? 'std' : null,
        moveLog:[], winner:null, drawOffer:'', clock:freshClock(e.tc),
        seats: meW ? {white:ME.username, black:name} : {white:name, black:ME.username},
        ratingSnapshot: meW ? {white:mp.rating, black:op.rating} : {white:op.rating, black:mp.rating},
        wantAuction: v === 'auction', wantDouble: v === 'double'
      };
      if(std) game.variant = 'standard';
      var saved = await kset('hb:game:' + code, game, true);
      if(!saved){ note("Couldn't start the game."); S.busy = false; return; }
      var taken = false;
      try{
        var tr = await db.ref(QP + '/' + name + '/gameId').transaction(function(cur){ return cur ? undefined : code; });
        taken = !tr.committed;
      }catch(err){ taken = true; }
      if(taken){                                   // somebody else got there first
        try{ await db.ref(dbPath('hb:game:' + code)).remove(); }catch(e2){}
        note('That game was just taken.'); S.busy = false; return;
      }
      await dropMine(false);
      try{ stopPoll(); }catch(e3){}
      S.busy = false;
      currentGameId = code;
      enterGameScreen(code);
    }catch(err2){
      console.error('accept failed', err2);
      note("Couldn't join that game.");
      S.busy = false;
    }
  }

  // ---------- the list ----------
  async function details(names){
    var now = Date.now(), out = {};
    await Promise.all(names.map(async function(n){
      var c = S.cache[n];
      if(c && now - c.at < 15000){ out[n] = c; return; }
      var st = null;
      try{ st = (await db.ref('hb/status/' + n).once('value')).val(); }catch(e){}
      out[n] = {at:now, st:st, rating:(c && c.rating) || {}};
      S.cache[n] = out[n];
    }));
    return out;
  }
  async function ratingOf(n, v){
    var c = S.cache[n] || (S.cache[n] = {at:0, rating:{}});
    c.rating = c.rating || {};
    if(c.rating[v] == null){
      try{ var p = await kget(LB[v] + n, true); c.rating[v] = p && typeof p.rating === 'number' ? p.rating : 1200; }catch(e){ c.rating[v] = 1200; }
    }
    return c.rating[v];
  }
  async function refresh(snapVal){
    var now = serverNow(), arr = [];
    Object.keys(snapVal || {}).forEach(function(n){
      var e = snapVal[n];
      if(!e || e.gameId || n === (ME && ME.username)) return;
      var v = e.variant || 'hb';
      if(!VNAME[v] || typeof e.joinedAt !== 'number' || now - e.joinedAt > STALE_MS) return;
      arr.push({name:n, v:v, tc:e.tc, at:e.joinedAt});
    });
    arr.sort(function(a, b){ return a.at - b.at; });
    arr = arr.slice(0, 14);
    var det = await details(arr.map(function(x){ return x.name; }));
    arr = arr.filter(function(x){
      var st = det[x.name] && det[x.name].st;
      if(!st || typeof st.t !== 'number') return true;               // no status info: show it
      if(st.s === 'offline' || st.s === 'playing') return false;
      return !(now - st.t > 5 * 60 * 1000 && st.s !== 'online');       // long idle
    });
    await Promise.all(arr.map(function(x){ return ratingOf(x.name, x.v).then(function(r){ x.rating = r; }); }));
    S.list = arr;
    paint();
  }

  function paint(){
    var card = document.getElementById('ogCard');
    if(!card) return;
    var m = S.mine, tcs = (typeof TIME_CONTROLS !== 'undefined') ? TIME_CONTROLS : [{key:'5+3', label:'5+3'}];
    var h = '<h2>Open games</h2>';
    if(m){
      h += '<div class="og-mine"><span class="live-dot"></span> Your game is posted: <b>' + esc(VNAME[m.v]) + '</b>, <b>' + esc(tcLabel(m.tc)) + '</b>. Waiting for someone to join. Stay on Pawniac while you wait.</div>' +
        '<div style="margin-top:10px;"><button type="button" class="secondary" id="ogCancel">Remove my game</button></div>';
    } else {
      h += '<p class="desc" style="margin:0 0 8px;">Post a game, then anyone can join it with one click.</p>' +
        '<div class="og-pick"><select id="ogVar" aria-label="Variant">' + VKEYS.map(function(k){ return '<option value="' + k + '"' + (k === S.v ? ' selected' : '') + '>' + esc(VNAME[k]) + '</option>'; }).join('') + '</select>' +
        '<select id="ogTc" aria-label="Time control">' + tcs.map(function(t){ return '<option value="' + esc(t.key) + '"' + (t.key === S.tc ? ' selected' : '') + '>' + esc(t.label) + '</option>'; }).join('') + '</select></div>' +
        '<div style="margin-top:10px;"><button type="button" id="ogPost">Post my game</button></div>';
    }
    h += '<div class="hint" id="ogNote" style="min-height:1.3em;margin-top:8px;">' + esc(Date.now() - noteAt < 8000 ? noteText : '') + '</div><div class="og-list">';
    if(!S.list.length) h += '<p class="desc" style="margin:4px 0 0;">Nobody has posted a game right now.</p>';
    S.list.forEach(function(x){
      h += '<div class="og-item"><div class="og-who"><b data-user="' + esc(x.name) + '">' + esc(x.name) + '</b><span class="og-meta">' + esc(x.rating) + ' &middot; ' + esc(VNAME[x.v]) + ' &middot; ' + esc(tcLabel(x.tc)) + ' &middot; ' + waited(x.at) + '</span></div>' +
        '<button type="button" class="og-play" data-name="' + esc(x.name) + '">Play</button></div>';
    });
    h += '</div>';
    card.innerHTML = h;
    var pb = document.getElementById('ogPost'); if(pb) pb.onclick = post;
    var cb = document.getElementById('ogCancel'); if(cb) cb.onclick = function(){ dropMine(); };
    var vs = document.getElementById('ogVar'); if(vs) vs.onchange = function(){ S.v = vs.value; save(); };
    var ts = document.getElementById('ogTc'); if(ts) ts.onchange = function(){ S.tc = ts.value; save(); };
    card.querySelectorAll('.og-play').forEach(function(b){ b.onclick = function(){ accept(b.getAttribute('data-name')); }; });
  }

  // ---------- put the card in the lobby ----------
  var css = '#ogCard .og-pick{display:flex;gap:8px;flex-wrap:wrap}#ogCard .og-pick select{flex:1;min-width:110px;border:1px solid #d8d1bf;border-radius:7px;padding:9px 10px;font-size:13.5px;font-family:inherit;background:#fff;color:inherit}' +
    '[data-theme=dark] #ogCard .og-pick select{background:#1b1a17;border-color:#4a463b;color:#e8e4d8}' +
    '#ogCard .og-item{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 0;border-top:1px solid rgba(127,127,127,.22)}' +
    '#ogCard .og-list{margin-top:6px}#ogCard .og-who b{display:block;font-size:15px}#ogCard .og-meta{display:block;font-size:12px;opacity:.75;margin-top:2px}' +
    '#ogCard .og-play{padding:7px 16px;flex:none}#ogCard .og-mine{font-size:14px;line-height:1.4}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function mount(){
    var lob = document.getElementById('screen-lobby');
    if(!lob || !ME) return;
    var old = document.getElementById('ogCard'); if(old) old.remove();
    var card = document.createElement('div'); card.className = 'card'; card.id = 'ogCard';
    var qb = lob.querySelector('#btnQuick'), qcard = qb && qb.closest('.card');   // goes just above Quick match
    if(qcard && qcard.parentNode) qcard.parentNode.insertBefore(card, qcard);
    else (lob.querySelector('.lobby-left') || lob).appendChild(card);
    paint();
    listen();
  }
  function listen(){
    if(S.qRef) return;
    S.qRef = db.ref(QP);
    S.qCb = S.qRef.on('value', function(s){
      if(!document.getElementById('ogCard')) return;
      refresh(s.exists() ? s.val() : {}).catch(function(e){ console.error(e); });
    }, function(){ S.list = []; paint(); });
  }

  var prevLobby = window.renderLobby;
  window.renderLobby = function(){
    var r = prevLobby.apply(this, arguments);
    try{ mount(); }catch(e){ console.error('open games failed', e); }
    return r;
  };
  var prevLogout = window.logout;
  window.logout = async function(){
    try{ await dropMine(false); }catch(e){}
    return prevLogout.apply(this, arguments);
  };
  window.PawniacOpenGames = {_state:S, post:post, accept:accept};
})();
