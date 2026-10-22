const PIECE_NAMES = {p:"Pawn",n:"Knight",b:"Bishop",r:"Rook",q:"Queen",k:"King"};

const FIGURINE = {
  w: {N:'♘',B:'♗',R:'♖',Q:'♕',K:'♔'},
  b: {N:'♞',B:'♝',R:'♜',Q:'♛',K:'♚'}
};
function sanToFigurine(san, color){
  if(!san) return '';
  const map = FIGURINE[color];
  return san
    .replace(/^([NBRQK])/, (m,p)=>map[p]||p)
    .replace(/=([NBRQK])/, (m,p)=>'='+(map[p]||p));
}
function renderMoveLog(moveLog){
  if(!moveLog || !moveLog.length) return '<div class="movelog-wrap empty">No moves yet.</div>';
  let rows = '';
  for(let i=0;i<moveLog.length;i+=2){
    const num = i/2+1;
    const isLastWhite = i===moveLog.length-1;
    const isLastBlack = i+1===moveLog.length-1;
    const whiteSan = sanToFigurine(moveLog[i], 'w');
    const blackSan = moveLog[i+1]!==undefined ? sanToFigurine(moveLog[i+1], 'b') : '';
    rows += `<div class="move-row">` +
      `<span class="move-num">${num}</span>` +
      `<span class="move-white${isLastWhite?' current':''}">${whiteSan}</span>` +
      `<span class="move-black${isLastBlack?' current':''}">${blackSan}</span>` +
    `</div>`;
  }
  return `<div class="movelog-wrap">${rows}</div>`;
}
const PIECE_UNICODE = {
  w:{p:"\u2659",n:"\u2658",b:"\u2657",r:"\u2656",q:"\u2655",k:"\u2654"},
  b:{p:"\u265F",n:"\u265E",b:"\u265D",r:"\u265C",q:"\u265B",k:"\u265A"}
};
// Cburnett piece set (Wikimedia Commons) - the same set Lichess uses by default
function pieceImgUrl(color, type){
  const colorLetter = color==='w' ? 'l' : 'd';
  return `https://commons.wikimedia.org/wiki/Special:FilePath/Chess_${type}${colorLetter}t45.svg`;
}

// ---- sound effects (synthesized, no audio files to host) ----
let audioCtx = null;
function getAudioCtx(){
  if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if(audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
function beep(freq, duration, type, gainStart, delay){
  type = type || 'sine'; gainStart = gainStart===undefined ? 0.15 : gainStart; delay = delay || 0;
  try{
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(gainStart, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration + 0.02);
  }catch(e){ /* audio not available - fail silently */ }
}
function playMoveSound(){ beep(520, 0.09, 'sine', 0.2); }
function playCaptureSound(){ beep(240, 0.12, 'square', 0.18); }
function playCheckSound(){ beep(880, 0.09, 'sine', 0.2); beep(660, 0.13, 'sine', 0.2, 0.09); }
function playRandomizeSound(){ beep(420, 0.05, 'sine', 0.14); beep(600, 0.05, 'sine', 0.14, 0.05); beep(820, 0.08, 'sine', 0.16, 0.1); }
function playLowTimeTick(){ beep(1050, 0.06, 'square', 0.15); }
function playGameStartSound(){ beep(440, 0.08, 'sine', 0.16); beep(660, 0.1, 'sine', 0.18, 0.08); }
function playWinSound(){ beep(523, 0.1, 'sine', 0.18); beep(659, 0.1, 'sine', 0.18, 0.1); beep(784, 0.18, 'sine', 0.2, 0.2); }
function playLossSound(){ beep(392, 0.12, 'sine', 0.16); beep(330, 0.16, 'sine', 0.16, 0.11); beep(262, 0.22, 'sine', 0.16, 0.24); }
function playDrawSound(){ beep(440, 0.1, 'sine', 0.15); beep(440, 0.14, 'sine', 0.15, 0.13); }

// Lichess doesn't use a fixed low-time threshold - it scales with the clock (roughly
// 40s for a 5-minute game, 60s for a 10-minute game, based on observed alarm timings).
// Fitting a line through those two points gives threshold ≈ 20 + 6.7% of the starting time.
function lowTimeThresholdMs(clock){
  if(!clock || clock.initialSec<=0) return 0;
  const sec = 20 + clock.initialSec * 0.0667;
  return Math.round(sec) * 1000;
}

const firebaseConfig = {
  apiKey: "AIzaSyDZ5T0JcPWZviltGwBqu9AuRz_cEhdqr0s",
  authDomain: "anythingchess-46f24.firebaseapp.com",
  databaseURL: "https://anythingchess-46f24-default-rtdb.firebaseio.com",
  projectId: "anythingchess-46f24",
  storageBucket: "anythingchess-46f24.firebasestorage.app",
  messagingSenderId: "137582626702",
  appId: "1:137582626702:web:14ad934c8298d0411086df"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

function dbPath(key){ return key.replace(/:/g, '/'); }

async function kget(key, shared){
  if(shared === false){
    try{ const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; }catch(e){ return null; }
  }
  try{ const snap = await db.ref(dbPath(key)).once('value'); return snap.exists() ? snap.val() : null; }catch(e){ console.error(e); return null; }
}
async function kset(key, value, shared){
  if(shared === false){
    try{ localStorage.setItem(key, JSON.stringify(value)); return true; }catch(e){ return false; }
  }
  try{ await db.ref(dbPath(key)).set(value); return true; }catch(e){ console.error(e); return false; }
}

let ME = null;
let currentGameId = null;
let pollTimer = null;
let selectedSquare = null;
let pendingPromotion = null;

// ---- server time (avoids clock skew between the two players' devices) ----
let serverOffset = 0;
db.ref('.info/serverTimeOffset').on('value', s=>{ serverOffset = s.val() || 0; });
function serverNow(){ return Date.now() + serverOffset; }

// ---- theme (dark / light) ----
const ICON_ATTR = 'width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const MOON_SVG = `<svg ${ICON_ATTR}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>`;
const SUN_SVG = `<svg ${ICON_ATTR}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`;
function applyTheme(t){
  document.documentElement.setAttribute('data-theme', t);
  const b = document.getElementById('themeToggle');
  if(b){ b.innerHTML = t==='dark' ? SUN_SVG : MOON_SVG; b.title = t==='dark' ? 'Switch to light mode' : 'Switch to dark mode'; }
}
(function(){
  applyTheme(document.documentElement.getAttribute('data-theme') || 'light');
  document.getElementById('themeToggle').onclick = ()=>{
    const next = document.documentElement.getAttribute('data-theme')==='dark' ? 'light' : 'dark';
    applyTheme(next);
    try{ localStorage.setItem('pawniac-theme', next); }catch(e){}
  };
})();

function genCode(){
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c = "";
  for(let i=0;i<5;i++) c += chars[Math.floor(Math.random()*chars.length)];
  return c;
}

// ================= SIGNUP / LOGIN (with email verification) =================

let signingUp = false;

// Throwaway-email services we refuse. Keep this list in sync with the Firebase rules.
const BLOCKED_EMAIL_DOMAINS = [
  'mailinator.com','guerrillamail.com','10minutemail.com','tempmail.com','temp-mail.org',
  'yopmail.com','trashmail.com','sharklasers.com','getnada.com','dispostable.com',
  'throwawaymail.com','maildrop.cc'
];
function isBlockedEmail(email){
  const d = (String(email).split('@')[1] || '').toLowerCase();
  return BLOCKED_EMAIL_DOMAINS.includes(d);
}
function escHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
const pendingKey = uid => 'pawniac-pending-username:' + uid;
function getPending(uid){ try{ return localStorage.getItem(pendingKey(uid)); }catch(e){ return null; } }
function setPending(uid, name){ try{ localStorage.setItem(pendingKey(uid), name); }catch(e){} }
function clearPending(uid){ try{ localStorage.removeItem(pendingKey(uid)); }catch(e){} }

auth.onAuthStateChanged(async (user)=>{
  if(signingUp) return; // doSignup drives its own flow while the account is being created
  stopPoll();
  if(user){
    await handleSignedIn(user);
  } else {
    ME = null;
    currentGameId = null;
    document.getElementById('userbox').innerHTML = '';
    authMode = 'login';
    renderAuthScreen();
  }
});

async function handleSignedIn(user){
  const username = await kget('hb:usernameByUid:'+user.uid, true);
  if(username){
    // Existing player (or a new one who already finished signup).
    ME = {username};
    const profile = await kget('hb:leaderboard:'+username, true) || {rating:1200, games:0};
    renderUserbox(profile);
    await afterAuth();
    return;
  }
  // No username yet = a new account that still has to finish signup.
  try{ await user.reload(); }catch(e){ /* offline - fall through with what we have */ }
  if(!user.emailVerified){ renderVerifyScreen(user); return; }
  await finishSignup(user);
}

function renderUserbox(profile){
  document.getElementById('userbox').innerHTML =
    '<div class="name">'+ME.username+'</div>'+
    '<div class="rating">rating '+profile.rating+' &middot; '+profile.games+' games</div>'+
    '<div style="margin-top:6px;font-size:12px;"><span class="backlink" id="btnLeaderboard">leaderboard</span> &middot; <span class="backlink" id="btnLogout">log out</span></div>';
  const lb = document.getElementById('btnLeaderboard');
  if(lb) lb.onclick = renderLeaderboard;
  const lo = document.getElementById('btnLogout');
  if(lo) lo.onclick = logout;
}

async function logout(){
  stopPoll();
  currentGameId = null;
  document.getElementById('userbox').innerHTML = '';
  await auth.signOut();
  // onAuthStateChanged picks this up and shows the login screen.
}

// ================= AUTH =================
let authMode = 'login';

function friendlyAuthError(e){
  const code = e && e.code;
  if(code==='auth/email-already-in-use') return 'That email is already registered - try logging in.';
  if(code==='auth/invalid-email') return 'Enter a valid email.';
  if(code==='auth/weak-password') return 'Password needs at least 6 characters.';
  if(code==='auth/user-not-found' || code==='auth/wrong-password' || code==='auth/invalid-credential') return 'Wrong email or password.';
  if(code==='auth/too-many-requests') return 'Too many attempts - try again in a bit.';
  if(code==='auth/network-request-failed') return 'Network problem - check your connection and try again.';
  return 'Something went wrong. Please try again.';
}

function renderAuthScreen(err, info){
  showScreen('auth');
  const el = document.getElementById('screen-auth');
  el.innerHTML = `
    <div class="card">
      <h2>${authMode==='login' ? 'Log in' : 'Create an account'}</h2>
      <p class="desc">${authMode==='login' ? 'Log in with your email.' : 'Pick a username, verify with your email, and you are set.'}</p>
      ${err ? '<div class="draw-offer" style="color:#b8433f;">'+err+'</div>' : ''}
      ${info ? '<div class="draw-offer">'+escHtml(info)+'</div>' : ''}
      <div class="row" style="flex-direction:column;align-items:stretch;gap:10px;">
        ${authMode==='signup' ? '<input type="text" id="authUsername" placeholder="username" autocomplete="username">' : ''}
        <input type="email" id="authEmail" placeholder="email" autocomplete="email">
        <input type="password" id="authPassword" placeholder="password" autocomplete="${authMode==='login'?'current-password':'new-password'}">
      </div>
      <div style="margin-top:16px;display:flex;gap:10px;">
        <button id="btnAuthSubmit">${authMode==='login' ? 'Log in' : 'Sign up'}</button>
        <button class="secondary" id="btnAuthSwitch">${authMode==='login' ? "Need an account? Sign up" : "Have an account? Log in"}</button>
      </div>
      ${authMode==='login' ? '<div style="margin-top:14px;"><span class="backlink" id="btnForgot">Forgot password?</span></div>' : ''}
    </div>
  `;
  document.getElementById('btnAuthSwitch').onclick = ()=>{ authMode = authMode==='login'?'signup':'login'; renderAuthScreen(); };
  document.getElementById('btnAuthSubmit').onclick = authMode==='login' ? doLogin : doSignup;
  const forgotBtn = document.getElementById('btnForgot');
  if(forgotBtn) forgotBtn.onclick = doForgotPassword;
  el.querySelectorAll('input').forEach(inp=>{
    inp.onkeydown = (e)=>{ if(e.key==='Enter') document.getElementById('btnAuthSubmit').click(); };
  });
}

async function doSignup(){
  const username = document.getElementById('authUsername').value.trim();
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  if(!username || !email || !password){ renderAuthScreen('Fill in all fields.'); return; }
  if(!USERNAME_RE.test(username)){ renderAuthScreen('Username: 3-20 letters, numbers or underscores.'); return; }
  if(password.length < 6){ renderAuthScreen('Password needs at least 6 characters.'); return; }
  if(isBlockedEmail(email)){ renderAuthScreen('Please use a real email address - temporary email services are not allowed.'); return; }

  const taken = await kget('hb:account:'+username+':uid', true);
  const takenLower = await kget('hb:accountLower:'+username.toLowerCase(), true);
  if(taken || takenLower){ renderAuthScreen('That username is taken (usernames are not case-sensitive).'); return; }

  signingUp = true;
  let cred;
  try{
    cred = await auth.createUserWithEmailAndPassword(email, password);
  } catch(e){
    signingUp = false;
    renderAuthScreen(friendlyAuthError(e));
    return;
  }

  // The username is only CLAIMED after the email is verified (see finishSignup);
  // remember the choice meanwhile.
  setPending(cred.user.uid, username);

  let sendFailed = false;
  try{ await cred.user.sendEmailVerification(); }
  catch(e){ console.error('sendEmailVerification failed', e); sendFailed = true; }

  signingUp = false;
  renderVerifyScreen(cred.user, sendFailed ? "We couldn't send the email just now - press 'Resend email'." : '');
}

// ---- password reset ----
// Always shows the same message whether or not the email has an account,
// so nobody can use this form to find out who is registered.
async function doForgotPassword(){
  const email = document.getElementById('authEmail').value.trim();
  if(!email){ renderAuthScreen('Type your email in the box first, then press "Forgot password?".'); return; }
  const sentMsg = 'If an account exists for ' + email + ', a password reset link is on its way. Check your inbox and spam folder.';
  try{
    await auth.sendPasswordResetEmail(email);
    renderAuthScreen('', sentMsg);
  } catch(e){
    if(e && e.code==='auth/user-not-found'){ renderAuthScreen('', sentMsg); }
    else { console.error(e); renderAuthScreen(friendlyAuthError(e)); }
  }
  const box = document.getElementById('authEmail');
  if(box) box.value = email;
}

async function doLogin(){
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  if(!email || !password){ renderAuthScreen('Fill in all fields.'); return; }
  try{
    await auth.signInWithEmailAndPassword(email, password);
    // onAuthStateChanged -> handleSignedIn takes it from here.
  } catch(e){
    renderAuthScreen(friendlyAuthError(e));
  }
}

// ================= EMAIL VERIFICATION =================
let verifyChecking = false;

function renderVerifyScreen(user, msg, ok){
  stopPoll();
  showScreen('auth');
  const el = document.getElementById('screen-auth');
  el.innerHTML = `
    <div class="card">
      <h2>Verify your email</h2>
      <p class="desc">We sent a verification link to <b>${escHtml(user.email)}</b>. Open it (check your spam folder too), then come back here.</p>
      ${msg ? '<div class="draw-offer"'+(ok?'':' style="color:#b8433f;"')+'>'+escHtml(msg)+'</div>' : ''}
      <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;">
        <button id="btnVerified">I've verified</button>
        <button class="secondary" id="btnResend">Resend email</button>
      </div>
      <div style="margin-top:14px;"><span class="backlink" id="btnVerifyLogout">Log out</span></div>
    </div>
  `;
  document.getElementById('btnVerified').onclick = ()=> checkVerified(user, true);
  document.getElementById('btnResend').onclick = async ()=>{
    document.getElementById('btnResend').disabled = true;
    try{
      await user.sendEmailVerification();
      renderVerifyScreen(user, 'Email sent again - check your inbox and spam.', true);
    } catch(e){
      console.error(e);
      renderVerifyScreen(user, e && e.code==='auth/too-many-requests'
        ? 'Too many emails sent - wait a few minutes and try again.'
        : 'Could not send the email. Try again later.');
    }
  };
  document.getElementById('btnVerifyLogout').onclick = logout;
  // Moves on automatically once the link has been clicked (same device or another).
  pollTimer = setInterval(()=> checkVerified(user, false), 5000);
}

async function checkVerified(user, manual){
  if(verifyChecking) return;
  verifyChecking = true;
  try{
    await user.reload();
    if(user.emailVerified){
      stopPoll();
      await finishSignup(user);
    } else if(manual){
      renderVerifyScreen(user, 'Not verified yet - open the link in the email first.');
    }
  } catch(e){
    console.error(e);
    if(manual) renderVerifyScreen(user, 'Could not check right now - try again.');
  } finally {
    verifyChecking = false;
  }
}

async function finishSignup(user){
  const pending = getPending(user.uid);
  if(!pending){ renderChooseUsername(user); return; }
  await claimUsername(user, pending);
}

function renderChooseUsername(user, err){
  stopPoll();
  showScreen('auth');
  const el = document.getElementById('screen-auth');
  el.innerHTML = `
    <div class="card">
      <h2>Choose a username</h2>
      <p class="desc">Your email is verified. Pick the username other players will see.</p>
      ${err ? '<div class="draw-offer" style="color:#b8433f;">'+escHtml(err)+'</div>' : ''}
      <div class="row" style="flex-direction:column;align-items:stretch;gap:10px;">
        <input type="text" id="chooseUsername" placeholder="username" autocomplete="username">
      </div>
      <div style="margin-top:16px;display:flex;gap:10px;">
        <button id="btnChooseGo">Continue</button>
      </div>
      <div style="margin-top:14px;"><span class="backlink" id="btnChooseLogout">Log out</span></div>
    </div>
  `;
  const go = async ()=>{
    const name = document.getElementById('chooseUsername').value.trim();
    if(!USERNAME_RE.test(name)){ renderChooseUsername(user, 'Username: 3-20 letters, numbers or underscores.'); return; }
    setPending(user.uid, name);
    await claimUsername(user, name);
  };
  document.getElementById('btnChooseGo').onclick = go;
  document.getElementById('chooseUsername').onkeydown = (e)=>{ if(e.key==='Enter') go(); };
  document.getElementById('btnChooseLogout').onclick = logout;
}

async function claimUsername(user, username){
  try{
    // Refresh the login token so the database rules see email_verified = true.
    await user.getIdToken(true);

    const owner = await kget('hb:account:'+username+':uid', true);
    const ownerLower = await kget('hb:accountLower:'+username.toLowerCase(), true);
    if((owner && owner !== user.uid) || (ownerLower && ownerLower !== user.uid)){
      clearPending(user.uid);
      renderChooseUsername(user, 'That username is taken - pick another.');
      return;
    }
    // ONE atomic write: the username and the uid->username link are saved together
    // (the database rules require both at once, so nobody can hoard usernames).
    const updates = {};
    if(!owner) updates['account/'+username] = {uid:user.uid};
    if(!ownerLower) updates['accountLower/'+username.toLowerCase()] = user.uid;
    updates['usernameByUid/'+user.uid] = username;
    try{
      await db.ref('hb').update(updates);
    } catch(e){
      console.error(e);
      clearPending(user.uid);
      renderChooseUsername(user, 'Could not claim that username (taken or not allowed) - try another.');
      return;
    }
    if(!(await kget('hb:leaderboard:'+username, true))){
      await kset('hb:leaderboard:'+username, {rating:1200, games:0}, true);
    }
    clearPending(user.uid);
    ME = {username};
    const profile = await kget('hb:leaderboard:'+username, true) || {rating:1200, games:0};
    renderUserbox(profile);
    await afterAuth();
  } catch(e){
    console.error(e);
    renderChooseUsername(user, 'Something went wrong - please try again.');
  }
}

// ================= LEADERBOARD =================
async function renderLeaderboard(){
  stopPoll();
  showScreen('leaderboard');
  const el = document.getElementById('screen-leaderboard');
  const backLink = '<div style="margin-top:14px;"><span class="backlink" id="btnBackFromLb">Back to lobby</span></div>';
  el.innerHTML = `<div class="card"><h2>Leaderboard</h2><p class="desc">Loading...</p>${backLink}</div>`;
  document.getElementById('btnBackFromLb').onclick = renderLobby;

  let rows = [];
  let loadError = false;
  try{
    const snap = await db.ref('hb/leaderboard').once('value');
    const users = snap.exists() ? snap.val() : {};
    rows = Object.keys(users)
      .map(u=>({username:u, rating:users[u].rating||1200, games:users[u].games||0}))
      .filter(u=>u.games>0)
      .sort((a,b)=>b.rating-a.rating)
      .slice(0,50);
  } catch(e){
    console.error(e);
    loadError = true;
  }

  const rowsHtml = loadError
    ? '<p class="desc">Could not load the leaderboard right now - try again in a moment.</p>'
    : (rows.length ? rows.map((u,i)=>`
    <div class="seat"><span class="who">#${i+1} ${u.username}${u.username===ME.username?' (you)':''}</span><span class="taken">${u.rating} &middot; ${u.games} games</span></div>
  `).join('') : '<p class="desc">No rated games played yet - play a Quick match to get on the board.</p>');
  el.innerHTML = `
    <div class="card">
      <h2>Leaderboard</h2>
      <p class="desc">Ranked by rating. Only rated (Quick match) games count.</p>
      ${rowsHtml}
      ${backLink}
    </div>
  `;
  document.getElementById('btnBackFromLb').onclick = renderLobby;
}

function expectedScore(ra, rb){ return 1/(1+Math.pow(10,(rb-ra)/400)); }

function computeEloChange(myRating, oppRating, myScore){
  const K = 32;
  const expected = expectedScore(myRating, oppRating);
  return Math.round(myRating + K*(myScore - expected)) - myRating;
}

function scoreForSide(winner, side){
  if(winner==='draw') return 0.5;
  return winner===side ? 1 : 0;
}

// Each client applies ONLY its own rating change - the leaderboard write rule only
// allows a user to write their own entry.
let myRatingChangeCache = {};
const settlingGames = {};

async function settleMyRating(g){
  if(!g || g.mode!=='random' || g.status!=='finished' || !g.ratingSnapshot) return;
  const gid = currentGameId; // captured now: currentGameId may change (rematch) while we await
  const me = myRole(g);
  if(!me) return;
  const side = me.side;
  if(myRatingChangeCache[gid] || settlingGames[gid]) return;
  if(g.ratingApplied && g.ratingApplied[side]) return;
  settlingGames[gid] = true;
  const myStart = side==='w' ? g.ratingSnapshot.white : g.ratingSnapshot.black;
  const oppStart = side==='w' ? g.ratingSnapshot.black : g.ratingSnapshot.white;
  const myScore = scoreForSide(g.winner, side);
  const change = computeEloChange(myStart, oppStart, myScore);
  const myUsername = ME.username;
  const myProfile = await kget('hb:leaderboard:'+myUsername, true) || {rating:myStart, games:0};
  const newRating = myProfile.rating + change;
  myRatingChangeCache[gid] = {change, newRating};
  await kset('hb:leaderboard:'+myUsername, {rating:newRating, games:myProfile.games+1}, true);
  await db.ref(dbPath('hb:game:'+gid+'/ratingApplied/'+side)).set(true);
  if(gameState && currentGameId===gid) drawGame();
}

function showScreen(name){
  document.getElementById('screen-auth').style.display = name==='auth' ? 'block':'none';
  document.getElementById('screen-lobby').style.display = name==='lobby' ? 'block':'none';
  document.getElementById('screen-waiting').style.display = name==='waiting' ? 'block':'none';
  document.getElementById('screen-game').style.display = name==='game' ? 'block':'none';
  document.getElementById('screen-leaderboard').style.display = name==='leaderboard' ? 'block':'none';
}

function stopPoll(){
  if(pollTimer){ clearInterval(pollTimer); pollTimer=null; }
  if(activeListenerRef){ activeListenerRef.off(); activeListenerRef=null; }
  if(clockTickTimer){ clearInterval(clockTickTimer); clockTickTimer=null; }
}
let activeListenerRef = null;

// ================= LOBBY =================
let createMode = 'team';
const TIME_CONTROLS = [
  {key:'none', label:'No clock', initial:0, increment:0},
  {key:'1+0', label:'1+0', initial:60, increment:0},
  {key:'3+2', label:'3+2', initial:180, increment:2},
  {key:'5+3', label:'5+3', initial:300, increment:3},
  {key:'10+5', label:'10+5', initial:600, increment:5},
  {key:'15+10', label:'15+10', initial:900, increment:10}
];
let selectedTC = '5+3';

function getTC(key){ return TIME_CONTROLS.find(t=>t.key===key) || TIME_CONTROLS[0]; }

function renderLobby(){
  showScreen('lobby');
  stopPoll();
  currentGameId = null;
  const el = document.getElementById('screen-lobby');
  const tcButtons = TIME_CONTROLS.map(t=>`<div class="tcbtn ${selectedTC===t.key?'active':''}" data-tc="${t.key}">${t.label}</div>`).join('');
  el.innerHTML = `
    <div class="lobby-grid">
      <div class="lobby-main">
        <div class="card">
          <h2>Quick match</h2>
          <p class="desc">1v1, random-button mode. Get matched with someone else looking to play right now. Rated.</p>
          <div class="tc-row">${tcButtons}</div>
          <button id="btnQuick">Find opponent</button>
          <div class="hint" id="quickHint"></div>
        </div>
        <div class="card">
          <h2>Play with friends</h2>
          <p class="desc">Create a room and share the code, or join one someone gave you.</p>
          <div class="modes">
            <div class="modebtn ${createMode==='team'?'active':''}" data-mode="team">Team (4 players)<div class="hint">2 per side: Brain names a piece, Hand moves it</div></div>
            <div class="modebtn ${createMode==='random'?'active':''}" data-mode="random">Random-button (2 players)<div class="hint">Each turn, hit Randomize for your piece type</div></div>
          </div>
          <div class="tc-row">${tcButtons.replace(/data-tc/g,'data-tc2')}</div>
          <button id="btnCreate">Create room</button>
          <div style="margin-top:14px;" class="row">
            <input type="text" id="joinCode" placeholder="room code" maxlength="5">
            <button class="secondary" id="btnJoin">Join</button>
          </div>
        </div>
      </div>
      <div class="lobby-side">
        <div class="card account-card">
          <div>
            <div class="account-name">${ME.username}</div>
            <div class="account-rating" id="lobbyAccountLine">rating - &middot; - games</div>
          </div>
          <span class="backlink" id="lobbyLogout">Log out</span>
        </div>
        <div class="card">
          <h2>Leaderboard</h2>
          <div id="lobbyLbPreview" class="desc">Loading...</div>
          <div style="margin-top:12px;"><span class="backlink" id="lobbyViewLb">View full leaderboard</span></div>
        </div>
      </div>
    </div>
  `;
  el.querySelectorAll('.modebtn').forEach(b=>{
    b.onclick = ()=>{ createMode = b.dataset.mode; renderLobby(); };
  });
  el.querySelectorAll('[data-tc], [data-tc2]').forEach(b=>{
    b.onclick = ()=>{ selectedTC = b.dataset.tc || b.dataset.tc2; renderLobby(); };
  });
  document.getElementById('btnCreate').onclick = createRoom;
  document.getElementById('btnJoin').onclick = ()=>{
    const code = document.getElementById('joinCode').value.trim().toUpperCase();
    if(code) joinRoom(code);
  };
  document.getElementById('btnQuick').onclick = quickMatch;
  document.getElementById('lobbyLogout').onclick = logout;
  document.getElementById('lobbyViewLb').onclick = renderLeaderboard;
  loadLobbySidebar();
}

async function loadLobbySidebar(){
  const profile = await kget('hb:leaderboard:'+ME.username, true) || {rating:1200, games:0};
  const line = document.getElementById('lobbyAccountLine');
  if(line) line.textContent = 'rating '+profile.rating+' \u00b7 '+profile.games+' games';

  const preview = document.getElementById('lobbyLbPreview');
  if(!preview) return;
  try{
    const snap = await db.ref('hb/leaderboard').once('value');
    const users = snap.exists() ? snap.val() : {};
    const rows = Object.keys(users)
      .map(u=>({username:u, rating:users[u].rating||1200, games:users[u].games||0}))
      .filter(u=>u.games>0)
      .sort((a,b)=>b.rating-a.rating)
      .slice(0,5);
    const el2 = document.getElementById('lobbyLbPreview');
    if(!el2) return;
    if(!rows.length){
      el2.className = 'desc';
      el2.innerHTML = 'No rated games played yet.';
    } else {
      el2.className = '';
      el2.innerHTML = rows.map((u,i)=>`
        <div class="lb-row"><span class="lb-rank">#${i+1}</span><span class="lb-name">${u.username}${u.username===ME.username?' (you)':''}</span><span class="lb-rating">${u.rating}</span></div>
      `).join('');
    }
  } catch(e){
    const el2 = document.getElementById('lobbyLbPreview');
    if(el2){ el2.className = 'desc'; el2.innerHTML = 'Could not load right now.'; }
  }
}

function startClock(game){
  if(game.clock && game.clock.initialSec>0) game.clock.turnStartedAt = serverNow();
}

function freshClock(tcKey){
  const tc = getTC(tcKey);
  return {initialSec: tc.initial, incrementSec: tc.increment, tcKey: tc.key, whiteMs: tc.initial*1000, blackMs: tc.initial*1000, turnStartedAt: 0};
}

async function createRoom(){
  const code = genCode();
  const game = {
    mode: createMode,
    status: 'waiting',
    fen: new Chess().fen(),
    turn: 'w',
    announced: null,
    moveLog: [],
    winner: null,
    drawOffer: "",
    clock: freshClock(selectedTC),
    seats: createMode==='team'
      ? {whiteBrain:"", whiteHand:"", blackBrain:"", blackHand:""}
      : {white:"", black:""}
  };
  await kset('hb:game:'+code, game, true);
  currentGameId = code;
  renderWaiting(code);
}

async function joinRoom(code){
  const game = await kget('hb:game:'+code, true);
  if(!game){ alert('No room with that code.'); return; }
  currentGameId = code;
  if(game.status==='active'){ enterGameScreen(code); return; }
  renderWaiting(code);
}

function allSeatsFilled(game){
  return Object.values(game.seats).every(v => !!v);
}

async function takeSeat(code, seatKey){
  const game = await kget('hb:game:'+code, true);
  if(!game || game.status==='active') return;
  if(game.seats[seatKey]) return;
  Object.keys(game.seats).forEach(k=>{ if(game.seats[k]===ME.username) game.seats[k]=""; });
  game.seats[seatKey] = ME.username;
  if(allSeatsFilled(game)){
    game.status = 'active';
    if(game.mode==='random'){
      const wp = await kget('hb:leaderboard:'+game.seats.white, true) || {rating:1200, games:0};
      const bp = await kget('hb:leaderboard:'+game.seats.black, true) || {rating:1200, games:0};
      game.ratingSnapshot = {white:wp.rating, black:bp.rating};
    }
  }
  await kset('hb:game:'+code, game, true);
}

async function leaveSeatOnly(code, seatKey){
  const game = await kget('hb:game:'+code, true);
  if(!game || game.status==='active') return;
  if(game.seats[seatKey]===ME.username) game.seats[seatKey]="";
  await kset('hb:game:'+code, game, true);
  drawWaiting(code, game);
}

async function quickMatch(){
  document.getElementById('quickHint').innerHTML = 'Searching... <span class="backlink" id="btnCancelQuick">cancel</span>';
  document.getElementById('btnCancelQuick').onclick = cancelQuickMatch;
  document.getElementById('btnQuick').disabled = true;
  const queueSnap = await db.ref('hb/queue/random').once('value');
  const queueObj = queueSnap.exists() ? queueSnap.val() : {};
  const now = serverNow();
  const candidate = Object.keys(queueObj).find(u => u!==ME.username && !queueObj[u].gameId && queueObj[u].tc===selectedTC && (now-queueObj[u].joinedAt)<60000);
  if(candidate){
    const code = genCode();
    const iAmWhite = Math.random() < 0.5;
    const clock = freshClock(selectedTC);
    const myProfile = await kget('hb:leaderboard:'+ME.username, true) || {rating:1200, games:0};
    const oppProfile = await kget('hb:leaderboard:'+candidate, true) || {rating:1200, games:0};
    const game = {
      mode:'random', status:'active', fen:new Chess().fen(), turn:'w', announced:null,
      moveLog:[], winner:null, drawOffer:"", clock:clock,
      seats: iAmWhite ? {white:ME.username, black:candidate} : {white:candidate, black:ME.username},
      ratingSnapshot: iAmWhite ? {white:myProfile.rating, black:oppProfile.rating} : {white:oppProfile.rating, black:myProfile.rating}
    };
    await kset('hb:game:'+code, game, true);
    await db.ref('hb/queue/random/'+candidate+'/gameId').set(code);
    await db.ref('hb/queue/random/'+ME.username).remove();
    currentGameId = code;
    enterGameScreen(code);
  } else {
    await db.ref('hb/queue/random/'+ME.username).set({joinedAt: now, gameId: "", tc: selectedTC});
    activeListenerRef = db.ref('hb/queue/random/'+ME.username+'/gameId');
    activeListenerRef.on('value', snap=>{
      const gid = snap.val();
      if(gid){
        stopPoll();
        db.ref('hb/queue/random/'+ME.username).remove();
        currentGameId = gid;
        enterGameScreen(gid);
      }
    });
  }
}

async function cancelQuickMatch(){
  stopPoll();
  await db.ref('hb/queue/random/'+ME.username).remove();
  renderLobby();
}

// ================= WAITING ROOM =================
function renderWaiting(code){
  showScreen('waiting');
  stopPoll();
  kset('hb:lastgame', {gameId: code, savedAt: Date.now()}, false);
  activeListenerRef = db.ref(dbPath('hb:game:'+code));
  activeListenerRef.on('value', snap=>{
    const game = snap.exists() ? snap.val() : null;
    if(!game) return;
    if(game.status==='active'){ stopPoll(); enterGameScreen(code); return; }
    drawWaiting(code, game);
  });
}

function seatLabel(mode, key){
  if(mode==='team'){
    const map = {whiteBrain:'White - Brain', whiteHand:'White - Hand', blackBrain:'Black - Brain', blackHand:'Black - Hand'};
    return map[key];
  }
  return key==='white' ? 'White' : 'Black';
}

function drawWaiting(code, game){
  const el = document.getElementById('screen-waiting');
  const seatKeys = Object.keys(game.seats);
  const rows = seatKeys.map(k=>{
    const occ = game.seats[k];
    if(occ===ME.username){
      return `<div class="seat"><span class="taken">${seatLabel(game.mode,k)} (you)</span><span class="backlink" data-leave="${k}">leave</span></div>`;
    } else if(occ){
      return `<div class="seat"><span class="who">${seatLabel(game.mode,k)}</span><span class="taken">${occ}</span></div>`;
    } else {
      return `<div class="seat"><span class="who">${seatLabel(game.mode,k)}</span><button class="secondary" data-take="${k}">Take seat</button></div>`;
    }
  }).join('');
  el.innerHTML = `
    <div class="card">
      <h2>Waiting for players</h2>
      <p class="desc">Share this code with your ${game.mode==='team'?'3 friends':'friend'}. Pick your seat below - the game starts once every seat is filled.</p>
      <div class="code-display">${code}</div>
      ${rows}
      <div style="margin-top:12px;"><span class="backlink" id="btnLeave">Leave room</span></div>
    </div>
  `;
  el.querySelectorAll('[data-take]').forEach(b=> b.onclick = ()=> takeSeat(code, b.dataset.take));
  el.querySelectorAll('[data-leave]').forEach(b=> b.onclick = ()=> leaveSeatOnly(code, b.dataset.leave));
  document.getElementById('btnLeave').onclick = ()=>{ stopPoll(); clearLastGame(); renderLobby(); };
}

// ================= GAME =================
let gameState = null;
let flipped = false;
let clockTickTimer = null;
let lastSeenMoveCount = null; // null = "just loaded, don't play a move sound for history"
let tickGameTurnKey = null;   // resets the low-time beep counter whenever the turn (or game) changes
let tickLastSecond = null;
let endSoundPlayed = false;   // guards against replaying win/loss/draw on every later snapshot

function enterGameScreen(code){
  currentGameId = code;
  showScreen('game');
  selectedSquare = null;
  stopPoll();
  kset('hb:lastgame', {gameId: code, savedAt: Date.now()}, false);
  gameState = null;
  selectedSquare = null;
  pendingPromotion = null;
  lastSeenMoveCount = null;
  tickGameTurnKey = null;
  tickLastSecond = null;
  endSoundPlayed = false;
  activeListenerRef = db.ref(dbPath('hb:game:'+code));
  activeListenerRef.on('value', snap=>{
    const g = snap.exists() ? snap.val() : null;
    if(!g) return;
    // Rematch accepted: settle the rating of the game just finished, then jump to the new game.
    if(g.status==='finished' && g.rematchGameId && myRole(g)){
      settleMyRating(g);
      enterGameScreen(g.rematchGameId);
      return;
    }
    gameState = g;
    const me = myRole(g);
    flipped = me && me.side==='b';
    // Play a sound for any move that just landed - works for both the mover and the
    // opponent/spectators, since it's driven off the synced state, not the local click.
    const moveCount = g.moveLog ? g.moveLog.length : 0;
    if(lastSeenMoveCount === null){
      // First snapshot of this session - a freshly-active, moveless game means we just
      // walked in as it started (quick match found, or the last friend took their seat).
      if(g.status==='active' && moveCount===0) playGameStartSound();
    } else if(moveCount > lastSeenMoveCount){
      const lastSan = g.moveLog[moveCount-1];
      if(lastSan.includes('+') || lastSan.includes('#')) playCheckSound();
      else if(lastSan.includes('x')) playCaptureSound();
      else playMoveSound();
    }
    lastSeenMoveCount = moveCount;
    if(g.status==='finished' && !endSoundPlayed){
      endSoundPlayed = true;
      if(me){
        if(g.winner==='draw') playDrawSound();
        else if(g.winner===me.side) playWinSound();
        else playLossSound();
      }
    }
    drawGame();
    if(g.status==='finished' && g.mode==='random'){ settleMyRating(g); }
  });
  clockTickTimer = setInterval(clockTick, 500);
}

function clearLastGame(){
  kset('hb:lastgame', null, false);
}

// Remaining ms for a side, using server time so both players see the same clock.
function clockMs(g, side){
  const base = side==='w' ? g.clock.whiteMs : g.clock.blackMs;
  if(g.status==='active' && g.turn===side && g.clock.turnStartedAt) return base - (serverNow() - g.clock.turnStartedAt);
  return base;
}

async function clockTick(){
  const g = gameState;
  if(!g || g.status!=='active' || !g.clock || g.clock.initialSec<=0 || !g.clock.turnStartedAt){ drawClocksOnly(); return; }

  // Low-time tick: one beep per whole second while the side to move is under the
  // adaptive threshold for this time control. Resets whenever the turn (or the
  // game) changes, so it can't carry over incorrectly.
  const turnKey = currentGameId + ':' + g.turn;
  if(turnKey !== tickGameTurnKey){ tickGameTurnKey = turnKey; tickLastSecond = null; }
  const remaining = clockMs(g, g.turn);
  const threshold = lowTimeThresholdMs(g.clock);
  if(threshold > 0 && remaining > 0 && remaining <= threshold){
    const sec = Math.ceil(remaining/1000);
    if(sec !== tickLastSecond){ tickLastSecond = sec; playLowTimeTick(); }
  }

  if(clockMs(g, g.turn) <= 0){
    const gid = currentGameId;
    const fresh = await kget('hb:game:'+gid, true);
    if(fresh && fresh.status==='active' && clockMs(fresh, fresh.turn) <= 0){
      const loser = fresh.turn;
      // FIDE 6.9: if the flag falls and the opponent has no way to checkmate with
      // any sequence of legal moves, the game is a draw rather than a loss.
      const chessNow = new Chess(fresh.fen);
      const isDraw = chessNow.insufficient_material();
      await db.ref(dbPath('hb:game:'+gid)).update({
        status:'finished',
        winner: isDraw ? 'draw' : (loser==='w'?'b':'w'),
        statusNote: isDraw ? 'draw - insufficient material on time' : 'won on time',
        [loser==='w' ? 'clock/whiteMs' : 'clock/blackMs']: 0,
        'clock/turnStartedAt': 0
      });
    }
    return;
  }
  drawClocksOnly();
}

function fmtClock(ms){
  ms = Math.max(0, ms);
  const totalSec = Math.ceil(ms/1000);
  const m = Math.floor(totalSec/60);
  const s = totalSec%60;
  return m+':'+String(s).padStart(2,'0');
}

function drawClocksOnly(){
  const g = gameState;
  if(!g || !g.clock || g.clock.initialSec<=0) return;
  const wEl = document.getElementById('clockWhite');
  const bEl = document.getElementById('clockBlack');
  if(wEl) wEl.textContent = fmtClock(clockMs(g,'w'));
  if(bEl) bEl.textContent = fmtClock(clockMs(g,'b'));
}

async function refreshGame(){
  const g = await kget('hb:game:'+currentGameId, true);
  if(!g) return;
  gameState = g;
  const me = myRole(g);
  flipped = me && me.side==='b';
  drawGame();
}

function myRole(g){
  if(g.mode==='team'){
    if(g.seats.whiteBrain===ME.username) return {side:'w', role:'brain'};
    if(g.seats.whiteHand===ME.username) return {side:'w', role:'hand'};
    if(g.seats.blackBrain===ME.username) return {side:'b', role:'brain'};
    if(g.seats.blackHand===ME.username) return {side:'b', role:'hand'};
  } else {
    if(g.seats.white===ME.username) return {side:'w', role:'solo'};
    if(g.seats.black===ME.username) return {side:'b', role:'solo'};
  }
  return null;
}

function legalTypesNow(chess){
  const moves = chess.moves({verbose:true});
  return [...new Set(moves.map(m=>m.piece))];
}

function allowedFromSquares(chess, announced){
  if(!announced) return [];
  return chess.moves({verbose:true}).filter(m=>m.piece===announced);
}

function drawGame(){
  const g = gameState;
  const chess = new Chess(g.fen);
  const me = myRole(g);
  const mySide = me ? me.side : null;
  const myTurn = mySide === g.turn;
  const el = document.getElementById('screen-game');

  const board = chess.board();
  const rowsOrder = flipped ? [0,1,2,3,4,5,6,7].reverse() : [0,1,2,3,4,5,6,7];
  const colsOrder = flipped ? [0,1,2,3,4,5,6,7].reverse() : [0,1,2,3,4,5,6,7];

  const allowed = allowedFromSquares(chess, g.announced);
  const fromSquares = new Set(allowed.map(m=>m.from));
  const destMoves = selectedSquare ? allowed.filter(m=>m.from===selectedSquare) : [];
  const destSquares = new Set(destMoves.map(m=>m.to));
  const captureSquares = new Set(destMoves.filter(m=>m.captured).map(m=>m.to));

  const canInteract = myTurn && (
    (g.mode==='team' && me.role==='hand' && g.announced) ||
    (g.mode==='random' && me.role==='solo' && g.announced)
  );

  const hasClock = g.clock && g.clock.initialSec>0;
  const topColor = flipped ? 'w' : 'b';
  const botColor = flipped ? 'b' : 'w';
  const clockBox = (color)=>`
      <div class="clock ${g.status==='active' && g.turn===color?'active':''}"><span class="label">${color==='w'?'White':'Black'}</span><span id="clock${color==='w'?'White':'Black'}">${fmtClock(clockMs(g,color))}</span></div>
    `;
  const clockHtml = hasClock ? clockBox(topColor) : '';
  const clockHtmlBottom = hasClock ? clockBox(botColor) : '';

  let checkedKingSquare = null;
  if(chess.in_check()){
    for(let r=0;r<8;r++){
      for(let c=0;c<8;c++){
        const p = board[r][c];
        if(p && p.type==='k' && p.color===chess.turn()){ checkedKingSquare = "abcdefgh"[c]+(8-r); }
      }
    }
  }

  let boardHtml = '<div>';
  boardHtml += clockHtml;
  boardHtml += '<div class="board">';
  for(const r of rowsOrder){
    for(const c of colsOrder){
      const file = "abcdefgh"[c];
      const rank = 8-r;
      const sq = file+rank;
      const piece = board[r][c];
      const isLight = (r+c)%2===0;
      let cls = 'sq ' + (isLight?'light':'dark');
      if(g.lastMove && (sq===g.lastMove.from || sq===g.lastMove.to)) cls += ' last';
      if(sq===selectedSquare) cls += ' from';
      if(sq===checkedKingSquare) cls += ' in-check';
      if(canInteract && destSquares.has(sq)){ cls += ' dest'; if(captureSquares.has(sq)) cls += ' capture'; }
      let symbol = '';
      if(piece){
        const unicodeFallback = PIECE_UNICODE[piece.color][piece.type];
        symbol = `<img class="piece-img" src="${pieceImgUrl(piece.color, piece.type)}" alt="" draggable="false" onerror="this.outerHTML='<span style=&quot;font-size:1em;line-height:1;&quot;>${unicodeFallback}</span>'">`;
      }
      let coordHtml = '';
      if(c===colsOrder[0]) coordHtml += `<span class="coord rank">${rank}</span>`;
      if(r===rowsOrder[rowsOrder.length-1]) coordHtml += `<span class="coord file">${file}</span>`;
      boardHtml += `<div class="${cls}" data-sq="${sq}">${coordHtml}${symbol}</div>`;
    }
  }
  boardHtml += '</div>';
  boardHtml += clockHtmlBottom;
  boardHtml += '</div>';

  let panelHtml = '';
  if(g.status==='finished'){
    let resultText = g.winner==='draw' ? 'Draw' : (g.winner==='w'?'White wins':'Black wins');
    let extra = '';
    if(g.statusNote) extra += '<div class="rc">'+g.statusNote+'</div>';
    if(g.mode==='random'){
      const rc = myRatingChangeCache[currentGameId];
      if(rc) extra += `<div class="rc">You: ${rc.change>=0?'+':''}${rc.change} (now ${rc.newRating})</div>`;
      else if(myRole(g)) extra += '<div class="rc">Updating rating...</div>';
    }
    panelHtml += `<div class="result-banner">${resultText}${extra}</div>`;
    if(me){
      if(g.rematchOffer==='declined'){
        panelHtml += '<div class="status-msg">Rematch declined.</div>';
      } else if(g.rematchOffer && g.rematchOffer!==mySide){
        panelHtml += `<div class="draw-offer">Your opponent wants a rematch.<div class="draw-offer-btns"><button id="btnAcceptRematch">Accept</button><button class="secondary" id="btnDeclineRematch">Decline</button></div></div>`;
      } else if(g.rematchOffer===mySide){
        panelHtml += '<div class="status-msg">Rematch offer sent - waiting for a response.</div>';
      } else {
        panelHtml += '<button class="full-btn" id="btnRematch">Rematch</button>';
      }
    }
    panelHtml += '<button class="secondary full-btn" id="btnBack">Back to lobby</button>';
  } else if(pendingPromotion){
    const promoNames = {q:'Queen', r:'Rook', b:'Bishop', n:'Knight'};
    panelHtml += `<div class="hint" style="margin-bottom:10px;">Promote to:</div>`;
    panelHtml += '<div class="types">' + Object.keys(promoNames).map(p=>
      `<button data-promo="${p}">${promoNames[p]}</button>`
    ).join('') + '</div>';
    panelHtml += `<button class="secondary" id="btnCancelPromo" style="margin-top:10px;">Cancel</button>`;
  } else {
    const legalTypes = legalTypesNow(chess);
    panelHtml += `<div class="announce ${g.announced?'':'empty'}">${g.announced ? 'Announced: '+PIECE_NAMES[g.announced] : 'No piece announced yet'}</div>`;
    if(!myTurn){
      panelHtml += `<div class="status-msg">Waiting on the other side...</div>`;
    } else if(g.mode==='team'){
      if(me.role==='brain' && !g.announced){
        panelHtml += '<div class="types">' + Object.keys(PIECE_NAMES).map(p=>{
          const ok = legalTypes.includes(p);
          return `<button data-type="${p}" ${ok?'':'disabled'}>${PIECE_NAMES[p]}</button>`;
        }).join('') + '</div>';
        panelHtml += `<div class="hint">Only pieces with a legal move can be announced.</div>`;
      } else if(me.role==='brain' && g.announced){
        panelHtml += `<div class="status-msg">Waiting for your Hand to move...</div>`;
      } else if(me.role==='hand' && !g.announced){
        panelHtml += `<div class="status-msg">Waiting for your Brain to announce a piece...</div>`;
      } else if(me.role==='hand' && g.announced){
        panelHtml += `<div class="status-msg">Click a highlighted piece, then a highlighted square.</div>`;
      }
    } else if(g.mode==='random'){
      if(me.role==='solo' && !g.announced){
        panelHtml += '<button id="btnRandomize">Randomize piece</button>';
        panelHtml += `<div class="hint">Only picks from pieces that currently have a legal move.</div>`;
      } else if(me.role==='solo' && g.announced){
        panelHtml += `<div class="status-msg">Click a highlighted piece, then a highlighted square.</div>`;
      }
    }
    if(!me){
      panelHtml += `<div class="status-msg">You are spectating this game.</div>`;
    }

    if(me){
      if(g.drawOffer && g.drawOffer!==mySide){
        panelHtml += `<div class="draw-offer">Your opponent offers a draw.<div class="draw-offer-btns"><button id="btnAcceptDraw">Accept</button><button class="secondary" id="btnDeclineDraw">Decline</button></div></div>`;
      } else if(g.drawOffer && g.drawOffer===mySide){
        panelHtml += `<div class="status-msg">Draw offer sent - waiting for a response.</div>`;
      }
      panelHtml += `<div class="game-actions">`;
      if(!(g.drawOffer && g.drawOffer===mySide)){
        panelHtml += `<button class="secondary" id="btnOfferDraw">Offer draw</button>`;
      }
      panelHtml += `<button class="secondary danger" id="btnResign">Resign</button>`;
      panelHtml += `</div>`;
    }
  }

  panelHtml += renderMoveLog(g.moveLog);

  el.innerHTML = `
    <div class="card">
      <div class="board-wrap">
        ${boardHtml}
        <div class="panel">${panelHtml}</div>
      </div>
    </div>
  `;

  if(g.status!=='finished'){
    el.querySelectorAll('[data-type]:not([disabled])').forEach(btn=>{
      btn.onclick = ()=> announceType(btn.dataset.type);
    });
    const rb = document.getElementById('btnRandomize');
    if(rb) rb.onclick = randomizeType;
    const resignBtn = document.getElementById('btnResign');
    if(resignBtn) resignBtn.onclick = ()=>{ if(confirm('Resign this game?')) resignGame(mySide); };
    const offerBtn = document.getElementById('btnOfferDraw');
    if(offerBtn) offerBtn.onclick = ()=> offerDraw(mySide);
    const acceptBtn = document.getElementById('btnAcceptDraw');
    if(acceptBtn) acceptBtn.onclick = acceptDraw;
    const declineBtn = document.getElementById('btnDeclineDraw');
    if(declineBtn) declineBtn.onclick = declineDraw;
    el.querySelectorAll('[data-promo]').forEach(btn=>{
      btn.onclick = ()=>{
        const pp = pendingPromotion;
        pendingPromotion = null;
        selectedSquare = null;
        if(pp) makeMove(pp.from, pp.to, btn.dataset.promo);
      };
    });
    const cancelPromoBtn = document.getElementById('btnCancelPromo');
    if(cancelPromoBtn) cancelPromoBtn.onclick = ()=>{ pendingPromotion = null; selectedSquare = null; drawGame(); };
    if(canInteract && !pendingPromotion){
      el.querySelectorAll('[data-sq]').forEach(cell=>{
        cell.onclick = ()=> handleSquareClick(cell.dataset.sq, fromSquares, destSquares, destMoves);
      });
    }
  } else {
    const bb = document.getElementById('btnBack');
    if(bb) bb.onclick = ()=>{ stopPoll(); clearLastGame(); renderLobby(); };
    const rmBtn = document.getElementById('btnRematch');
    if(rmBtn) rmBtn.onclick = ()=> offerRematch(mySide);
    const rmAcc = document.getElementById('btnAcceptRematch');
    if(rmAcc) rmAcc.onclick = acceptRematch;
    const rmDec = document.getElementById('btnDeclineRematch');
    if(rmDec) rmDec.onclick = declineRematch;
  }
}

async function announceType(type){
  const g = await kget('hb:game:'+currentGameId, true);
  if(!g || g.announced) return;
  g.announced = type;
  await kset('hb:game:'+currentGameId, g, true);
  refreshGame();
}

async function randomizeType(){
  const g = await kget('hb:game:'+currentGameId, true);
  if(!g || g.announced) return;
  const chess = new Chess(g.fen);
  const moves = chess.moves({verbose:true});
  if(moves.length===0) return;
  // Weighted by move count per type - a rook with one legal move shouldn't be
  // as likely to get picked as a pawn with eight.
  const type = moves[Math.floor(Math.random()*moves.length)].piece;
  playRandomizeSound();
  await announceType(type);
}

function handleSquareClick(sq, fromSquares, destSquares, destMoves){
  if(pendingPromotion) return;
  if(!selectedSquare){
    if(fromSquares.has(sq)){ selectedSquare = sq; drawGame(); }
  } else {
    if(destSquares.has(sq)){
      const promo = destMoves.find(m=>m.to===sq && m.promotion);
      if(promo){
        pendingPromotion = {from:selectedSquare, to:sq, color:promo.color};
        drawGame();
      } else {
        makeMove(selectedSquare, sq);
        selectedSquare = null;
      }
    } else if(fromSquares.has(sq)){
      selectedSquare = sq; drawGame();
    } else {
      selectedSquare = null; drawGame();
    }
  }
}

async function finishGame(g, winner, note){
  g.status = 'finished';
  g.winner = winner;
  g.statusNote = note;
  await kset('hb:game:'+currentGameId, g, true);
}

async function resignGame(mySide){
  const g = await kget('hb:game:'+currentGameId, true);
  if(!g || g.status!=='active' || !mySide) return;
  await finishGame(g, mySide==='w' ? 'b' : 'w', 'resigned');
}

async function offerDraw(mySide){
  const g = await kget('hb:game:'+currentGameId, true);
  if(!g || g.status!=='active' || !mySide) return;
  g.drawOffer = mySide;
  await kset('hb:game:'+currentGameId, g, true);
}

async function acceptDraw(){
  const g = await kget('hb:game:'+currentGameId, true);
  if(!g || g.status!=='active' || !g.drawOffer) return;
  await finishGame(g, 'draw', 'draw agreed');
}

async function declineDraw(){
  const g = await kget('hb:game:'+currentGameId, true);
  if(!g || g.status!=='active') return;
  g.drawOffer = "";
  await kset('hb:game:'+currentGameId, g, true);
}

async function makeMove(from, to, promotion){
  const g = await kget('hb:game:'+currentGameId, true);
  if(!g || g.status!=='active') return;
  const chess = new Chess(g.fen);
  const moverColor = chess.turn();

  // If the mover's time already ran out, the move doesn't count - they lose on time
  // (or draw, per FIDE 6.9, if the opponent has insufficient mating material).
  if(g.clock && g.clock.initialSec>0 && g.clock.turnStartedAt){
    const mine = moverColor==='w' ? g.clock.whiteMs : g.clock.blackMs;
    if(serverNow() - g.clock.turnStartedAt >= mine){
      const isDraw = chess.insufficient_material();
      g.status = 'finished';
      g.winner = isDraw ? 'draw' : (moverColor==='w' ? 'b' : 'w');
      g.statusNote = isDraw ? 'draw - insufficient material on time' : 'won on time';
      if(moverColor==='w') g.clock.whiteMs = 0; else g.clock.blackMs = 0;
      g.clock.turnStartedAt = 0;
      await kset('hb:game:'+currentGameId, g, true);
      return;
    }
  }

  const mv = chess.move({from, to, promotion: promotion || 'q'});
  if(!mv) return;
  g.fen = chess.fen();
  g.turn = chess.turn();
  g.announced = null;
  g.drawOffer = "";
  g.lastMove = {from: mv.from, to: mv.to};
  g.moveLog = g.moveLog || [];
  g.moveLog.push(mv.san);

  // Deduct the time used this turn, then add the increment (every move, including the first).
  if(g.clock && g.clock.initialSec>0){
    const now = serverNow();
    const elapsed = g.clock.turnStartedAt ? now - g.clock.turnStartedAt : 0;
    const incMs = (g.clock.incrementSec||0)*1000;
    if(moverColor==='w') g.clock.whiteMs = Math.max(0, g.clock.whiteMs - elapsed) + incMs;
    else g.clock.blackMs = Math.max(0, g.clock.blackMs - elapsed) + incMs;
    g.clock.turnStartedAt = now;
  }

  // FIDE 9.2: threefold repetition. chess.js only tracks repetition for moves it played
  // itself, so replay the whole game on a fresh instance. Nothing extra is stored in the DB.
  let repetition = false;
  try{
    const replay = new Chess();
    for(const san of g.moveLog) replay.move(san);
    repetition = replay.in_threefold_repetition();
  }catch(e){ console.error('repetition check failed', e); }

  if(chess.game_over()){
    g.status = 'finished';
    if(chess.in_checkmate()){
      g.winner = mv.color;
    } else {
      g.winner = 'draw';
      g.statusNote = chess.in_stalemate() ? 'draw - stalemate'
        : chess.insufficient_material() ? 'draw - insufficient material'
        : 'draw - 50-move rule';
    }
  } else if(repetition){
    g.status = 'finished';
    g.winner = 'draw';
    g.statusNote = 'draw - threefold repetition';
  }

  const saved = await kset('hb:game:'+currentGameId, g, true);
  if(!saved){ alert("Your move couldn't be saved to the server. Check your connection / Firebase rules (see browser console)."); return; }
  refreshGame();
}

// ================= REMATCH =================
async function offerRematch(mySide){
  const gid = currentGameId;
  const g = await kget('hb:game:'+gid, true);
  if(!g || g.status!=='finished' || g.rematchGameId || !mySide) return;
  // If the opponent already asked, clicking Rematch just accepts.
  if(g.rematchOffer && g.rematchOffer!==mySide && g.rematchOffer!=='declined'){ await acceptRematch(); return; }
  await db.ref(dbPath('hb:game:'+gid+'/rematchOffer')).set(mySide);
}

async function declineRematch(){
  await db.ref(dbPath('hb:game:'+currentGameId+'/rematchOffer')).set('declined');
}

async function acceptRematch(){
  const gid = currentGameId;
  const g = await kget('hb:game:'+gid, true);
  if(!g || g.status!=='finished' || g.rematchGameId || !myRole(g)) return;
  const s = g.seats;
  const c = g.clock || {initialSec:0, incrementSec:0};
  // Colors swap for the rematch.
  const seats = g.mode==='team'
    ? {whiteBrain:s.blackBrain, whiteHand:s.blackHand, blackBrain:s.whiteBrain, blackHand:s.whiteHand}
    : {white:s.black, black:s.white};
  const game = {
    mode:g.mode, status:'active', fen:new Chess().fen(), turn:'w', announced:null,
    moveLog:[], winner:null, drawOffer:"", seats,
    clock:{initialSec:c.initialSec, incrementSec:c.incrementSec, whiteMs:c.initialSec*1000, blackMs:c.initialSec*1000, turnStartedAt:0}
  };
  if(g.mode==='random'){
    const snap = g.ratingSnapshot;
    let wR, bR;
    if(snap && g.winner){
      // Ratings after the game just played (same Elo math each client applies to itself).
      bR = snap.white + computeEloChange(snap.white, snap.black, scoreForSide(g.winner,'w')); // old white -> new black
      wR = snap.black + computeEloChange(snap.black, snap.white, scoreForSide(g.winner,'b')); // old black -> new white
    } else {
      const wp = await kget('hb:leaderboard:'+seats.white, true) || {rating:1200};
      const bp = await kget('hb:leaderboard:'+seats.black, true) || {rating:1200};
      wR = wp.rating; bR = bp.rating;
    }
    game.ratingSnapshot = {white:wR, black:bR};
  }
  const code = genCode();
  await kset('hb:game:'+code, game, true);
  // Both players' listeners on the old game see this and move to the new one.
  await db.ref(dbPath('hb:game:'+gid+'/rematchGameId')).set(code);
}

// ================= INIT =================
// Startup is driven by auth.onAuthStateChanged (registered above), which calls
// handleSignedIn() -> afterAuth() once Firebase Auth reports who's logged in.

async function afterAuth(){
  const last = await kget('hb:lastgame', false);
  if(last && last.gameId && (Date.now()-last.savedAt) < 12*60*60*1000){
    const g = await kget('hb:game:'+last.gameId, true);
    if(g && g.status==='active' && myRoleForUser(g, ME.username)){
      currentGameId = last.gameId;
      enterGameScreen(last.gameId);
      return;
    } else if(g && g.status==='waiting'){
      currentGameId = last.gameId;
      renderWaiting(last.gameId);
      return;
    } else {
      clearLastGame();
    }
  }
  renderLobby();
}

function myRoleForUser(g, username){
  if(g.mode==='team'){
    return Object.values(g.seats).includes(username);
  }
  return g.seats.white===username || g.seats.black===username;
}
