// Logged-out home page: public landing screen, login / sign-up popup, guest bot entry, public counters.
(function(){
  var scr = document.createElement('div');
  scr.id = 'screen-home'; scr.style.display = 'none';
  (function(){ var w = document.querySelector('.wrap'), f = document.getElementById('pnFooter'); if(f && f.parentNode === w) w.insertBefore(scr, f); else w.appendChild(scr); })();
  var modalOn = false;
  var IMG = function(c, t){ return '/images/' + c + t + '.svg'; };

  // ---------- screen switching ----------
  var prevShow = window.showScreen;
  window.showScreen = function(n){
    prevShow(n);
    if(n !== 'auth' && n !== 'home'){ modalOn = false; }
    var isModal = (n === 'auth' && modalOn);
    scr.style.display = (n === 'home' || isModal) ? 'block' : 'none';
    document.body.classList.toggle('hm-modal', isModal);
    var nv = document.getElementById('navbar');
    if(nv && !auth.currentUser && (n === 'home' || n === 'auth' || (n === 'bot' && window.PawniacGuestBot && window.PawniacGuestBot.active()))) nv.style.display = 'none';
    if(n !== 'bot' && window.PawniacGuestBot) window.PawniacGuestBot.leave();
  };

  function show(){
    modalOn = false;
    render();
    showScreen('home');
    var ub = document.getElementById('userbox');
    if(ub){
      ub.innerHTML = '<div class="hm-top"><button class="secondary" id="hmLogin">Log in</button><button id="hmSign">Sign up free</button></div>';
      document.getElementById('hmLogin').onclick = function(){ openAuth('login'); };
      document.getElementById('hmSign').onclick = function(){ openAuth('signup'); };
    }
    loadStats();
  }
  function openAuth(mode){
    try{ authMode = mode; }catch(e){}
    modalOn = true;
    window.renderAuthScreen();
  }
  function closeModal(){ if(document.body.classList.contains('hm-modal') && !auth.currentUser) show(); }
  window.PawniacHome = {show: show, openAuth: openAuth};

  // the login card: popup over the home page (errors and Discord/Google returns keep it open)
  var prevAuth = window.renderAuthScreen;
  window.renderAuthScreen = function(err, info){
    if(err || info || modalOn){
      modalOn = true;
      prevAuth.apply(this, arguments);
      showScreen('auth');   // re-evaluates the popup state
      return;
    }
    if(auth.currentUser){ prevAuth.apply(this, arguments); return; }
    show();
  };
  document.addEventListener('mousedown', function(e){
    if(document.body.classList.contains('hm-modal') && e.target && e.target.id === 'screen-auth') closeModal();
  });
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape') closeModal(); });

  // ---------- page ----------
  var POS = {'0,0':'bR','0,2':'bB','0,3':'bQ','0,4':'bK','0,5':'bB','0,7':'bR','0,6':'bN','1,0':'bP','1,1':'bP','1,2':'bP','1,3':'bP','1,5':'bP','1,6':'bP','1,7':'bP',
    '2,2':'bN','3,4':'bP','3,1':'wB','4,4':'wP','5,5':'wN','6,0':'wP','6,1':'wP','6,2':'wP','6,3':'wP','6,5':'wP','6,6':'wP','6,7':'wP',
    '7,0':'wR','7,1':'wN','7,2':'wB','7,3':'wQ','7,4':'wK','7,7':'wR'};
  function board(){
    var h = '';
    for(var r = 0; r < 8; r++) for(var c = 0; c < 8; c++){
      var p = POS[r + ',' + c], light = (r + c) % 2 === 0, cls = light ? 'l' : 'd';
      if((r === 3 && c === 1) || (r === 7 && c === 5)) cls += ' h';
      h += '<div class="' + cls + '">' + (p ? '<img src="' + IMG(p[0], p[1]) + '" alt="" draggable="false">' : '') + '</div>';
    }
    return h;
  }
  var MODES = [
    ['N','Standard','Classic chess with Pawniac ratings, clocks and quick match.'],
    ['B','Hand & Brain','Brain calls the piece, Hand picks the move. Call the piece or the move and play it.'],
    ['Q','Piece Auction','Bid to win pieces and build your army before the fight starts.'],
    ['R','Double Move','Two moves per turn, no checkmate. Capture the king to win.']
  ];
  function render(){
    scr.innerHTML =
    '<div class="hm-hero card"><div class="hm-copy">' +
      '<span class="hm-chip">Same board. New rules.</span>' +
      '<h1>Chess, but every<br>game is different.</h1>' +
      '<p>Hand &amp; Brain, Piece Auction, Double Move and standard chess, all in your browser. Every mode has its own rating, and you can review any game afterwards. No download needed.</p>' +
      '<div class="hm-btns"><button id="hmPlay">Play now, it’s free</button><button class="secondary" id="hmBot">Play a bot as a guest</button></div>' +
      '<div class="hint">Sign up takes under a minute, or continue with Discord or Google.</div>' +
    '</div><div class="hm-board"><div class="hm-grid">' + board() + '</div></div></div>' +
    '<div class="hm-stats" id="hmStats"></div>' +
    '<h2 class="hm-h">Pick how you want to play</h2>' +
    '<p class="hm-sub">Each mode keeps its own rating and leaderboard, so one never mixes with another.</p>' +
    '<div class="hm-modes">' + MODES.map(function(m, i){
      return '<div class="card hm-mode"><div class="hm-ico"><img src="' + IMG('w', m[0]) + '" alt=""></div><h3>' + m[1].replace('&','&amp;') + '</h3><p>' + m[2] + '</p><a data-i="' + i + '">Play ' + m[1].replace('&','&amp;') + ' &rarr;</a></div>';
    }).join('') + '</div>' +
    '<div class="card hm-disc"><div><h2>Join the Pawniac Discord</h2><p>Find opponents, hear about new variants first, and suggest what we build next.</p></div><a class="hm-dbtn" href="https://discord.gg/PAN5362gFd" target="_blank" rel="noopener">Join the server</a></div>' +
    '<div class="hm-final"><h2>Your first game is one click away</h2><button id="hmCreate">Create a free account</button></div>';
    document.getElementById('hmPlay').onclick = function(){ openAuth('signup'); };
    document.getElementById('hmCreate').onclick = function(){ openAuth('signup'); };
    document.getElementById('hmBot').onclick = function(){ if(window.PawniacGuestBot) window.PawniacGuestBot.enter(); };
    scr.querySelectorAll('.hm-mode a').forEach(function(a){ a.onclick = function(){ openAuth('signup'); }; });
  }

  // ---------- public counters (same numbers as the lobby bar) ----------
  function num(path){
    return db.ref(path).once('value').then(function(s){ return s.exists() ? Number(s.val()) || 0 : 0; }, function(){ return 0; });
  }
  function loadStats(){
    Promise.all([num('hb/counters/played/total'), num('hb/gameCount'), num('hb/counters/played/bot'), num('hb/counters/analyzed/total'), num('hb/counters/players/total')]).then(function(a){
      var items = [
        [Math.max(a[0], a[1]) + a[2], 'games played on Pawniac'],
        [a[3], 'games analyzed by players'],
        [a[4], 'players have joined']
      ].filter(function(x){ return x[0] > 0; });
      var el = document.getElementById('hmStats');
      if(!el) return;
      el.innerHTML = items.map(function(x){ return '<div class="card hm-stat"><b>' + x[0].toLocaleString() + '</b><span>' + x[1] + '</span></div>'; }).join('');
    });
  }

  // ---------- count new players once, when the username is first claimed ----------
  var prevClaim = window.claimUsername;
  if(typeof prevClaim === 'function'){
    window.claimUsername = async function(user){
      var had = false;
      try{ had = (await db.ref('hb/usernameByUid/' + user.uid).once('value')).exists(); }catch(e){}
      var r = await prevClaim.apply(this, arguments);
      try{
        if(!had && (await db.ref('hb/usernameByUid/' + user.uid).once('value')).exists())
          db.ref('hb/counters/players/total').transaction(function(c){ return (c || 0) + 1; }).catch(function(){});
      }catch(e){}
      return r;
    };
  }

  // if Firebase already reported "logged out" before this file loaded, the plain login card is showing: swap it for the home page
  try{
    var sa = document.getElementById('screen-auth');
    if(sa && sa.style.display === 'block' && !auth.currentUser && !/draw-offer/.test(sa.innerHTML)) show();
  }catch(e){}
})();
