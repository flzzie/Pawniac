(function(){
  // ====== DISCORD SETTINGS (Google needs none of this) ======
  var DISCORD_CLIENT_ID    = '1560985686746603570';
  var DISCORD_FUNCTION_URL = 'https://pawniaclogin.rishiitsrivastava.workers.dev/';
  // ==========================================================

  var NAME_RE = /^[A-Za-z0-9_]{3,20}$/;
  var SS_STATE = 'pawniac-discord-state', SS_NAME = 'pawniac-social-name', SS_ROOM = 'pawniac-room';

  // after any login: if the person came from an invite link, go to that room
  var prevAfterAuth = window.afterAuth;
  window.afterAuth = async function(){
    var room = null;
    try{ room = sessionStorage.getItem(SS_ROOM); sessionStorage.removeItem(SS_ROOM); }catch(e){}
    if(room && /^[A-Z0-9]{5}$/.test(room)){
      var exists = await kget('hb:game:' + room, true);
      if(exists){ await joinRoom(room); return; }
    }
    return prevAfterAuth();
  };
  var busyDiscord = false, claiming = false;

  function esc(s){ return String(s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function discordReady(){ return !/^PUT_/.test(DISCORD_CLIENT_ID) && !/^PUT_/.test(DISCORD_FUNCTION_URL); }
  function redirectUri(){ return location.origin + '/'; }

  // ---------- Google ----------
  function authErr(e){
    var c = e && e.code;
    if(c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request') return '';
    if(c === 'auth/account-exists-with-different-credential') return 'That email is already registered another way. Log in with your email and password instead.';
    if(c === 'auth/unauthorized-domain') return 'This website is not in the Firebase "Authorized domains" list yet.';
    if(c === 'auth/operation-not-allowed') return 'Google sign-in is not turned on in Firebase yet.';
    if(c === 'auth/network-request-failed') return 'Network problem. Please try again.';
    return 'Sign-in failed. Please try again.';
  }
  async function googleLogin(){
    var prov = new firebase.auth.GoogleAuthProvider();
    prov.setCustomParameters({prompt:'select_account'});
    try{
      await auth.signInWithPopup(prov);
    }catch(e){
      var c = e && e.code;
      if(c === 'auth/popup-blocked' || c === 'auth/operation-not-supported-in-this-environment'){
        try{ await auth.signInWithRedirect(prov); return; }catch(e2){ e = e2; }
      }
      console.error(e);
      var m = authErr(e);
      if(m) renderAuthScreen(m);
    }
  }

  // ---------- Discord (needs the small Cloud Function) ----------
  function discordLogin(){
    if(!discordReady()){ renderAuthScreen('Discord login is coming soon! For now, please sign up or log in with your email or Google.'); return; }
    var st = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(function(b){ return b.toString(16).padStart(2, '0'); }).join('');
    try{
      sessionStorage.setItem(SS_STATE, st);
      var room = (new URLSearchParams(location.search).get('room') || '').toUpperCase();
      if(/^[A-Z0-9]{5}$/.test(room)) sessionStorage.setItem(SS_ROOM, room);
    }
    catch(e){ renderAuthScreen("Your browser blocked storage, so Discord login can't start."); return; }
    location.href = 'https://discord.com/oauth2/authorize?client_id=' + encodeURIComponent(DISCORD_CLIENT_ID) +
      '&response_type=code&scope=identify&redirect_uri=' + encodeURIComponent(redirectUri()) + '&state=' + st;
  }
  function later(msg){
    try{ sessionStorage.removeItem(SS_ROOM); }catch(e){}
    setTimeout(function(){ busyDiscord = false; if(!auth.currentUser) renderAuthScreen(msg); }, 900);
  }

  // coming back from Discord: the URL has ?code=...&state=...
  (function handleReturn(){
    var q = new URLSearchParams(location.search), code = q.get('code'), st = q.get('state'), err = q.get('error');
    if(!st || !(code || err)) return;
    var saved = null;
    try{ saved = sessionStorage.getItem(SS_STATE); }catch(e){}
    if(!saved || saved !== st) return;
    try{ sessionStorage.removeItem(SS_STATE); }catch(e){}
    ['code', 'state', 'error', 'error_description'].forEach(function(k){ q.delete(k); });
    history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q.toString() : ''));
    if(err || !code){ later('Discord login was cancelled.'); return; }
    busyDiscord = true;
    fetch(DISCORD_FUNCTION_URL, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({code:code, redirectUri:redirectUri()})})
      .then(function(r){
        return r.json().then(function(j){
          if(!r.ok || !j.token) throw new Error(j.error || 'Discord login failed');
          try{ sessionStorage.setItem(SS_NAME, j.name || ''); }catch(e){}
          return j.token;
        });
      })
      .then(function(t){ return auth.signInWithCustomToken(t); })
      .catch(function(e){ console.error(e); later('Discord login failed: ' + (e.message || 'please try again') + '.'); });
  })();

  // ---------- the buttons on the login / sign-up card ----------
  var prevAuth = window.renderAuthScreen;
  window.renderAuthScreen = function(err, info){
    if(busyDiscord && !err && !info){
      showScreen('auth');
      document.getElementById('screen-auth').innerHTML = '<div class="card"><h2>Signing in with Discord...</h2><p class="desc">One moment.</p></div>';
      return;
    }
    prevAuth(err, info);
    try{
      var card = document.querySelector('#screen-auth .card');
      if(!card || card.querySelector('.so-btns')) return;
      var box = document.createElement('div');
      box.innerHTML = '<div class="so-or">or continue with</div><div class="so-btns"><button class="so-g" id="soGoogle">Google</button><button class="so-d" id="soDiscord">Discord</button></div>';
      card.appendChild(box);
      document.getElementById('soGoogle').onclick = googleLogin;
      document.getElementById('soDiscord').onclick = discordLogin;
    }catch(e){ console.error('social buttons failed', e); }
  };

  // ---------- first time with Google / Discord: pick a username ----------
  var prevSI = window.handleSignedIn;
  window.handleSignedIn = async function(user){
    busyDiscord = false;
    var u = null;
    try{ u = await kget('hb:usernameByUid:' + user.uid, true); }catch(e){}
    if(u) return prevSI(user);
    var usesPassword = (user.providerData || []).some(function(p){ return p.providerId === 'password'; });
    if(usesPassword) return prevSI(user);
    askUsername(user);
  };

  function suggest(user){
    var s = '';
    try{ s = sessionStorage.getItem(SS_NAME) || ''; }catch(e){}
    var base = (s || user.displayName || (user.email || '').split('@')[0] || '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 16);
    return base.length >= 3 ? base : (base + 'player').slice(0, 16);
  }
  function askUsername(user, err, val){
    showScreen('auth');
    var el = document.getElementById('screen-auth');
    el.innerHTML = '<div class="card"><h2>Choose your username</h2>' +
      '<p class="desc">This is the name other players see: 3-20 letters, numbers or underscores. You cannot change it later.</p>' +
      (err ? '<div class="draw-offer" style="color:#b8433f;">' + esc(err) + '</div>' : '') +
      '<input type="text" id="soName" maxlength="20" autocomplete="off" value="' + esc(val !== undefined ? val : suggest(user)) + '">' +
      '<div style="margin-top:16px;display:flex;gap:10px;"><button id="soGo">Continue</button><button class="secondary" id="soOut">Cancel</button></div></div>';
    var inp = document.getElementById('soName');
    document.getElementById('soGo').onclick = function(){ claim(user, inp.value.trim()); };
    document.getElementById('soOut').onclick = function(){ auth.signOut(); };
    inp.onkeydown = function(e){ if(e.key === 'Enter') document.getElementById('soGo').click(); };
    inp.focus();
  }
  async function claim(user, name){
    if(claiming) return;
    if(!NAME_RE.test(name)){ askUsername(user, 'Username: 3-20 letters, numbers or underscores.', name); return; }
    claiming = true;
    try{
      try{ await user.getIdToken(true); }catch(e){}
      var owner = await kget('hb:account:' + name + ':uid', true);
      var ownerLower = await kget('hb:accountLower:' + name.toLowerCase(), true);
      if(owner || ownerLower){ askUsername(user, 'That username is taken.', name); return; }
      var updates = {};
      updates['account/' + name] = {uid:user.uid};
      updates['accountLower/' + name.toLowerCase()] = user.uid;
      updates['usernameByUid/' + user.uid] = name;
      try{
        await db.ref('hb').update(updates);
      }catch(e){
        console.error(e);
        askUsername(user, 'That name is not allowed - try another.', name);
        return;
      }
      var profile = {rating:1200, games:0};
      await kset('hb:leaderboard:' + name, profile, true);
      ME = {username:name};
      renderUserbox(profile);
      await afterAuth();
    }catch(e){
      console.error(e);
      askUsername(user, 'Something went wrong. Please try again.', name);
    }finally{ claiming = false; }
  }
})();
