(function(){
  // Every page gets its own link, like chess.com/puzzles:
  //   #/standard   #/handandbrain   #/minigames   #/quiz   #/analyze
  //   #/leaderboard   #/leaderboard/standard   #/help
  //   #/profile/NAME   #/settings
  // The address bar always matches the page you are on, the back/forward buttons work,
  // and opening a link (even before logging in) takes you to that page after login.
  var NAME_RE = /^[A-Za-z0-9_]{3,20}$/;
  var curScreen = null, lbV = 'hb', curProfile = null;
  var lastHash = PW.hash(), replaceNext = false, holdReplace = false, ready = false, timer = null;

  // ---------- reading a link ----------
  function parse(hash){
    var s = String(hash || '').replace(/^#\/?/, '').replace(/\/+$/, '');
    if(!s) return null;
    var p = s.split('/');
    try{ p = p.map(decodeURIComponent); }catch(e){ return null; }
    var n = p[0].toLowerCase(), a = (p[1] || '').toLowerCase();
    if(n === 'standard' || n === 'chess') return {n:'standard'};
    if(n === 'handandbrain' || n === 'hand-and-brain' || n === 'hb' || n === 'home' || n === 'play') return {n:'handandbrain'};
    if(n === 'minigames' || n === 'quiz' || n === 'analyze' || n === 'help' || n === 'settings') return {n:n};
    if(n === 'leaderboard') return {n:'leaderboard', v:(a === 'standard' ? 'standard' : 'hb')};
    if(n === 'profile') return {n:'profile', name:(NAME_RE.test(p[1] || '') ? p[1] : null)};
    return null;
  }

  // ---------- which link matches what is on screen ----------
  function pathFor(){
    switch(curScreen){
      case 'lobby':
        var act = document.querySelector('#screen-lobby [data-variant].active');
        return (act && act.dataset.variant === 'standard') ? '/standard' : '/handandbrain';
      case 'minigames': return '/minigames';
      case 'quiz': return '/quiz';
      case 'analyze': return '/analyze';
      case 'help': return '/help';
      case 'settings': return '/settings';
      case 'leaderboard': return lbV === 'standard' ? '/leaderboard/standard' : '/leaderboard';
      case 'profile': return curProfile ? '/profile/' + curProfile : null;
    }
    return null;   // login, waiting room and live games keep whatever link was there
  }
  function sync(){
    timer = null;
    var p = pathFor();
    if(!p) return;
    var h = '#' + p;
    if(PW.hash() !== h){
      if(replaceNext || holdReplace) PW.replace(h);
      else PW.push(h);      // new history entry, so the back button works
    }
    lastHash = h;
    replaceNext = false;
  }
  function schedule(){ if(!timer) timer = setTimeout(sync, 0); }   // wait until the page has finished drawing

  // ---------- keep track of the page ----------
  var prevShow = window.showScreen;
  window.showScreen = function(n){
    curScreen = n;
    if(n === 'auth') ready = false;
    prevShow(n);
    schedule();
  };
  var prevLb = window.renderLeaderboard;
  window.renderLeaderboard = function(v){
    lbV = (v === 'standard') ? 'standard' : 'hb';
    return prevLb.apply(this, arguments);
  };
  var prevOpen = window.openProfile;
  window.openProfile = function(name){
    curProfile = name;
    return prevOpen.apply(this, arguments);
  };

  // ---------- going to a link ----------
  function inGame(){
    var s = document.getElementById('screen-game');
    return !!s && s.style.display === 'block' && !!gameState && gameState.status === 'active';
  }
  function run(r){
    switch(r.n){
      case 'standard':
      case 'handandbrain':
        stopPoll();
        window.renderLobby();
        var want = r.n === 'standard' ? 'standard' : 'hb';
        var b = document.querySelector('#screen-lobby [data-variant="' + want + '"]');
        if(b && !b.classList.contains('active')) b.click();
        break;
      case 'minigames': stopPoll(); window.renderMinigames(); break;
      case 'quiz':      stopPoll(); window.renderQuiz(); break;
      case 'help':      stopPoll(); window.renderHelp(); break;
      case 'settings':  stopPoll(); window.renderSettings(); break;
      case 'leaderboard': stopPoll(); window.renderLeaderboard(r.v); break;
      case 'profile':   stopPoll(); window.openProfile(r.name || ME.username); break;
      case 'analyze':
        var a = document.querySelector('#navbar [data-nav="analyze"]');
        if(a) a.click();
        break;
    }
  }
  function go(r, skipGuard){
    if(!ME || !r) return;
    if(!skipGuard && inGame() && !confirm('Your clock keeps running while you are away. Leave the game view?')){
      try{ PW.replace(lastHash); }catch(e){}
      return;
    }
    replaceNext = true;
    setTimeout(function(){ replaceNext = false; }, 1000);
    // the pages ask their own "leave the game?" question; we already asked once, so silence theirs
    var oc = window.confirm;
    window.confirm = function(){ return true; };
    try{ run(r); }
    catch(e){ console.error('opening link failed', e); }
    finally{ window.confirm = oc; }
  }

  // back / forward buttons, or someone editing the address by hand
  window.addEventListener('hashchange', function(){
    if(!ME || PW.hash() === lastHash) return;
    var r = parse(PW.hash());
    if(r) go(r, false);
  });

  // ---------- opening a link right after loading / logging in ----------
  var prevAfter = window.afterAuth;
  window.afterAuth = async function(){
    if(ready) return prevAfter();           // "Play" in the nav bar also calls this: behave as before
    var want = parse(PW.hash());        // read it before the lobby rewrites the address
    holdReplace = true;
    try{
      await prevAfter();                    // resumes a live game / invite room first, same as always
      ready = true;
      if(want && curScreen === 'lobby') go(want, true);
    }finally{
      setTimeout(function(){ holdReplace = false; }, 400);
    }
  };
})();
