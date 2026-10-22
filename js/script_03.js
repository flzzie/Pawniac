(function(){
  // 1. build the nav bar and the three new screens
  var nav = document.createElement('nav');
  nav.className = 'navbar';
  nav.id = 'navbar';
  nav.innerHTML =
    '<a data-nav="play">Play</a>' +
    '<a data-nav="minigames">Minigames</a>' +
    '<a data-nav="quiz">Quiz</a>' +
    '<a data-nav="leaderboard">Leaderboard</a>' +
    '<a data-nav="help">Help</a>';
  document.querySelector('header').after(nav);
  ['minigames','quiz','help'].forEach(function(n){
    var d = document.createElement('div');
    d.id = 'screen-' + n;
    d.style.display = 'none';
    document.querySelector('.wrap').appendChild(d);
  });

  // 2. screen switching now also handles the nav bar
  var SCREENS = ['auth','lobby','waiting','game','leaderboard','minigames','quiz','help'];
  var NAV_OF = {lobby:'play',waiting:'play',game:'play',minigames:'minigames',quiz:'quiz',leaderboard:'leaderboard',help:'help'};
  window.showScreen = function(name){
    SCREENS.forEach(function(s){
      document.getElementById('screen-' + s).style.display = (s === name) ? 'block' : 'none';
    });
    nav.style.display = (name === 'auth') ? 'none' : 'flex';
    nav.querySelectorAll('[data-nav]').forEach(function(a){
      a.classList.toggle('active', a.dataset.nav === NAV_OF[name]);
    });
  };

  // 3. userbox without the leaderboard link (it lives in the nav now)
  window.renderUserbox = function(profile){
    document.getElementById('userbox').innerHTML =
      '<div class="name">' + ME.username + '</div>' +
      '<div class="rating">rating ' + profile.rating + ' &middot; ' + profile.games + ' games</div>' +
      '<div style="margin-top:6px;font-size:12px;"><span class="backlink" id="btnLogout">log out</span></div>';
    var lo = document.getElementById('btnLogout');
    if(lo) lo.onclick = logout;
  };

  // 4. placeholder pages (later steps replace these)
  function renderSoon(screen, title){
    showScreen(screen);
    document.getElementById('screen-' + screen).innerHTML =
      '<div class="card"><h2>' + title + '</h2><p class="desc">Coming soon.</p></div>';
  }
  window.renderMinigames = function(){ renderSoon('minigames','Minigames'); };
  window.renderQuiz      = function(){ renderSoon('quiz','Quiz'); };
  window.renderHelp      = function(){ renderSoon('help','Help'); };

  // 5. nav clicks
  function navTo(k){
    var inGame = document.getElementById('screen-game').style.display === 'block' && gameState && gameState.status === 'active';
    if(k !== 'play' && inGame && !confirm('Your clock keeps running while you are away. Leave the game view?')) return;
    if(k === 'play'){ afterAuth(); return; }   // back to your active game, or the lobby
    stopPoll();
    var go = {minigames:window.renderMinigames, quiz:window.renderQuiz, leaderboard:renderLeaderboard, help:window.renderHelp};
    go[k]();
  }
  nav.querySelectorAll('[data-nav]').forEach(function(a){
    a.onclick = function(){ navTo(a.dataset.nav); };
  });
})();
