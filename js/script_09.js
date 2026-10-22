(function(){
  // ---------- settings storage (this device only) ----------
  var KEY = 'pawniac-settings';
  var DEFAULTS = {
    sound:true,
    sMove:true, sCapture:true, sCheck:true, sRandomize:true, sTick:true, sStart:true, sWin:true, sLoss:true, sDraw:true,
    coords:true, dots:true, lastMove:true,
    autoQueen:false, confirmDraw:false, autoDecline:false,
    tabFlash:true
  };
  var S = Object.assign({}, DEFAULTS);
  try{ var raw = localStorage.getItem(KEY); if(raw) Object.assign(S, JSON.parse(raw)); }catch(e){}
  function save(){ try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){} }

  function applyClasses(){
    var c = document.body.classList;
    c.toggle('no-coords', !S.coords);
    c.toggle('no-dots', !S.dots);
    c.toggle('no-last', !S.lastMove);
  }
  applyClasses();

  // ---------- sounds: gate every existing sound function ----------
  var SOUND_FN = {
    playMoveSound:'sMove', playCaptureSound:'sCapture', playCheckSound:'sCheck', playRandomizeSound:'sRandomize',
    playLowTimeTick:'sTick', playGameStartSound:'sStart', playWinSound:'sWin', playLossSound:'sLoss', playDrawSound:'sDraw'
  };
  var ORIG = {};
  Object.keys(SOUND_FN).forEach(function(name){
    var orig = window[name];
    ORIG[name] = orig;
    window[name] = function(){
      if(S.sound && S[SOUND_FN[name]]) return orig.apply(this, arguments);
    };
  });

  // ---------- the Settings screen + nav tab ----------
  var screen = document.createElement('div');
  screen.id = 'screen-settings';
  screen.style.display = 'none';
  document.querySelector('.wrap').appendChild(screen);

  // ---------- username menu: click your name -> "My profile" / "Settings" ----------
  function openSettings(){
    var inGame = document.getElementById('screen-game').style.display === 'block' && gameState && gameState.status === 'active';
    if(inGame && !confirm('Your clock keeps running while you are away. Leave the game view?')) return;
    stopPoll();
    renderSettings();
  }
  function closeUserMenu(){ var m = document.getElementById('userMenu'); if(m) m.style.display = 'none'; }

  var prevUserbox = window.renderUserbox;
  window.renderUserbox = function(p){
    prevUserbox(p);
    var box = document.getElementById('userbox');
    var n = box.querySelector('.name');
    if(!n) return;
    n.classList.remove('user-link');       // step 5 made the name open the profile directly; the menu replaces that
    delete n.dataset.user;
    n.classList.add('menu-trigger');
    n.innerHTML = ME.username + ' <span class="caret">&#9662;</span>';
    var menu = document.createElement('div');
    menu.id = 'userMenu';
    menu.className = 'user-menu';
    menu.innerHTML = '<div class="um-item" data-go="profile">My profile</div><div class="um-item" data-go="settings">Settings</div>';
    box.appendChild(menu);
    n.onclick = function(e){
      e.stopPropagation();
      menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
    };
    menu.querySelectorAll('.um-item').forEach(function(it){
      it.onclick = function(e){
        e.stopPropagation();
        closeUserMenu();
        if(it.dataset.go === 'profile') openProfile(ME.username);
        else openSettings();
      };
    });
  };
  document.addEventListener('click', function(e){ if(!e.target.closest('#userbox')) closeUserMenu(); });
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape') closeUserMenu(); });

  var prevShow = window.showScreen;
  window.showScreen = function(n){
    prevShow(n);
    screen.style.display = (n === 'settings') ? 'block' : 'none';
    closeUserMenu();
  };

  function row(key, label, hint, preview, extraCls){
    return '<div class="set-row' + (extraCls ? ' ' + extraCls : '') + '"><div><div class="set-label">' + label + '</div>' +
      (hint ? '<div class="hint">' + hint + '</div>' : '') + '</div><div class="set-ctl">' +
      (preview ? '<button class="secondary set-play" data-play="' + preview + '" title="Preview">&#9654;</button>' : '') +
      '<label class="switch"><input type="checkbox" data-set="' + key + '"' + (S[key] ? ' checked' : '') + '><span></span></label></div></div>';
  }

  function renderSettings(){
    showScreen('settings');
    var dim = S.sound ? '' : 'set-dim';
    screen.innerHTML =
      '<div class="card"><h2>Sound</h2>' +
        '<p class="desc">Saved on this device.</p>' +
        row('sound', 'All sounds', 'Master switch') +
        row('sMove', 'Move', '', 'playMoveSound', dim) +
        row('sCapture', 'Capture', '', 'playCaptureSound', dim) +
        row('sCheck', 'Check', '', 'playCheckSound', dim) +
        row('sRandomize', 'Randomize piece', 'The roll in random-button mode', 'playRandomizeSound', dim) +
        row('sStart', 'Game start', '', 'playGameStartSound', dim) +
        row('sTick', 'Low-time ticking', 'Ticks each second when your clock is low', 'playLowTimeTick', dim) +
        row('sWin', 'You win', '', 'playWinSound', dim) +
        row('sLoss', 'You lose', '', 'playLossSound', dim) +
        row('sDraw', 'Draw', '', 'playDrawSound', dim) +
      '</div>' +
      '<div class="card"><h2>Board</h2>' +
        row('coords', 'Show coordinates', 'Rank and file letters on the squares') +
        row('dots', 'Show legal-move dots', 'Dots and rings on squares you can move to') +
        row('lastMove', 'Highlight last move', '') +
      '</div>' +
      '<div class="card"><h2>Gameplay</h2>' +
        row('autoQueen', 'Always promote to Queen', 'Skips the promotion picker') +
        row('confirmDraw', 'Confirm before offering a draw', 'Asks "Offer a draw?" first') +
        row('autoDecline', 'Auto-decline draw offers', 'Offers from your opponent are declined straight away') +
      '</div>' +
      '<div class="card"><h2>Notifications</h2>' +
        row('tabFlash', 'Flash the tab title on your turn', 'Only while you are on another tab or window') +
      '</div>' +
      '<div class="card"><button class="secondary" id="setReset">Reset to defaults</button></div>';

    screen.querySelectorAll('[data-set]').forEach(function(cb){
      cb.onchange = function(){
        S[cb.dataset.set] = cb.checked;
        save(); applyClasses();
        if(cb.dataset.set === 'sound') renderSettings();   // dims / un-dims the individual sounds
      };
    });
    screen.querySelectorAll('[data-play]').forEach(function(b){
      b.onclick = function(){ var f = ORIG[b.dataset.play]; if(f) f(); };   // preview ignores the toggles
    });
    document.getElementById('setReset').onclick = function(){
      S = Object.assign({}, DEFAULTS); save(); applyClasses(); renderSettings();
    };
  }
  window.renderSettings = renderSettings;

  // ---------- flash the tab title when it is your turn ----------
  var BASE_TITLE = document.title || 'Pawniac';
  var flash = {timer:null, key:null};
  function stopFlash(){
    if(flash.timer){ clearInterval(flash.timer); flash.timer = null; }
    document.title = BASE_TITLE;
  }
  function startFlash(msg){
    if(flash.timer) return;
    var alt = false;
    document.title = '\u265F ' + msg;
    flash.timer = setInterval(function(){
      alt = !alt;
      document.title = alt ? BASE_TITLE : '\u265F ' + msg;
    }, 1000);
  }
  document.addEventListener('visibilitychange', function(){ if(!document.hidden) stopFlash(); });
  window.addEventListener('focus', stopFlash);

  function checkTurnFlash(g){
    if(!S.tabFlash || !g || g.status !== 'active'){ if(g && g.status !== 'active') stopFlash(); return; }
    var me = myRole(g); if(!me) return;
    var needs = g.turn === me.side &&
      (g.mode === 'team' ? (me.role === 'brain' ? !g.announced : !!g.announced) : true);
    var key = currentGameId + ':' + (g.moveLog || []).length + ':' + (g.announced || '');
    if(needs){
      if(key !== flash.key){
        flash.key = key;
        if(document.hidden || !document.hasFocus()){
          startFlash(g.mode === 'team' ? (me.role === 'brain' ? 'Call a piece!' : 'Move your piece!') : 'Your move!');
        }
      }
    } else {
      flash.key = null;
    }
  }

  // ---------- hook into the game screen ----------
  var declBusy = false;
  var prevDraw = window.drawGame;
  window.drawGame = function(){
    // Always-queen: resolve the promotion before the picker is ever drawn
    if(S.autoQueen && pendingPromotion){
      var pp = pendingPromotion;
      pendingPromotion = null;
      selectedSquare = null;
      makeMove(pp.from, pp.to, 'q');
    }
    prevDraw();
    var g = gameState; if(!g) return;
    var me = myRole(g);
    if(g.status === 'active' && me){
      if(S.autoDecline && g.drawOffer && g.drawOffer !== me.side){
        var acc = document.getElementById('btnAcceptDraw');
        if(acc){ var box = acc.closest('.draw-offer'); if(box) box.remove(); }
        if(!declBusy){
          declBusy = true;
          Promise.resolve(declineDraw()).then(function(){ setTimeout(function(){ declBusy = false; }, 500); });
        }
      } else if(S.confirmDraw){
        var ob = document.getElementById('btnOfferDraw');
        if(ob) ob.onclick = function(){ if(confirm('Offer a draw?')) offerDraw(me.side); };
      }
    }
    checkTurnFlash(g);
  };
})();
