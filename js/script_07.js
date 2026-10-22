(function(){
  var viewing = null, recorded = {};
  var NAME_RE = /^[A-Za-z0-9_]{3,20}$/;
  var VNAME = {hb:'Hand & Brain (random)', team:'Hand & Brain (team)', std:'Standard'};

  function esc(s){
    return String(s).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  function fmtMs(ms){
    var t = Math.floor(ms / 100), m = Math.floor(t / 600), s = (t % 600) / 10;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
  }

  // ---- the profile screen ----
  var screen = document.createElement('div');
  screen.id = 'screen-profile';
  screen.style.display = 'none';
  document.querySelector('.wrap').appendChild(screen);

  var origShow = window.showScreen;
  window.showScreen = function(n){
    origShow(n);
    screen.style.display = (n === 'profile') ? 'block' : 'none';
  };

  // your name in the top-right opens your profile
  var origUserbox = window.renderUserbox;
  window.renderUserbox = function(p){
    origUserbox(p);
    var n = document.querySelector('#userbox .name');
    if(n){ n.classList.add('user-link'); n.dataset.user = ME.username; }
  };

  // any element with class "user-link" opens that player's profile
  document.addEventListener('click', function(e){
    var u = e.target.closest('.user-link');
    if(u && u.dataset.user) window.openProfile(u.dataset.user);
  });

  // turn leaderboard names ("#1 name (you)") into links
  function linkify(){
    document.querySelectorAll('#screen-leaderboard .seat .who, #ktBoard .seat .who').forEach(function(w){
      if(w.children.length) return;
      var m = /^#(\d+) ([A-Za-z0-9_]{3,20})( \(you\))?$/.exec(w.textContent);
      if(m) w.innerHTML = '#' + m[1] + ' <span class="user-link" data-user="' + m[2] + '">' + m[2] + '</span>' + (m[3] || '');
    });
  }
  var obs = new MutationObserver(linkify);
  ['screen-leaderboard','screen-minigames'].forEach(function(id){
    obs.observe(document.getElementById(id), {childList:true, subtree:true});
  });

  // ---- recording win/loss/draw counters when a game you played finishes ----
  async function record(g, gid, me){
    var v = g.mode === 'team' ? 'team' : (g.variant === 'standard' ? 'std' : 'hb');
    var res = g.winner === 'draw' ? 'd' : (g.winner === me.side ? 'w' : 'l');
    try{
      await db.ref('hb/stats/' + ME.username + '/' + v).transaction(function(c){
        c = c || {};
        c.w = c.w || 0; c.l = c.l || 0; c.d = c.d || 0;
        c[res] += 1;
        return c;
      });
      await db.ref('hb/game/' + gid + '/statsApplied/' + ME.username).set(true);
    }catch(e){ console.error('could not record game', e); }
  }
  var origDraw = window.drawGame;
  window.drawGame = function(){
    origDraw();
    var g = gameState;
    if(!g || g.status !== 'finished' || !currentGameId) return;
    var me = myRole(g);
    if(!me || recorded[currentGameId]) return;
    recorded[currentGameId] = true;
    if(g.statsApplied && g.statsApplied[ME.username]) return;
    record(g, currentGameId, me);
  };

  // ---- opening a profile ----
  function get(p){
    return db.ref(p).once('value').then(function(s){ return s.exists() ? s.val() : null; }).catch(function(){ return null; });
  }
  function ratingBox(label, r){
    return '<div class="pf-box"><div class="hint">' + label + '</div><div class="pf-big">' + (r ? r.rating : '-') +
           '</div><div class="hint">' + (r ? r.games : 0) + ' games</div></div>';
  }

  window.openProfile = async function(name){
    if(!name || !NAME_RE.test(name)) return;
    var inGame = document.getElementById('screen-game').style.display === 'block' && gameState && gameState.status === 'active';
    if(inGame && !confirm('Your clock keeps running while you are away. Leave the game view?')) return;
    stopPoll();
    viewing = name;
    showScreen('profile');
    screen.innerHTML = '<div class="card"><p class="desc">Loading profile...</p></div>';

    var own = (name === ME.username);
    var acc = await get('hb/account/' + name);
    if(!acc){
      screen.innerHTML = '<div class="card"><h2>Player not found</h2><p class="desc">There is no player called ' + esc(name) + '.</p></div>';
      return;
    }
    var r = await Promise.all([
      get('hb/profile/' + name), get('hb/leaderboard/' + name), get('hb/leaderboardStd/' + name),
      get('hb/stats/' + name), get('hb/ktLeaderboard/' + name)
    ]);
    if(viewing !== name) return;   // user clicked somewhere else while loading
    var prof = r[0], stats = r[3] || {}, kt = r[4];

    if(own && !prof){
      var created = auth.currentUser && auth.currentUser.metadata && Date.parse(auth.currentUser.metadata.creationTime);
      prof = {bio:'', joined: created || Date.now()};
      db.ref('hb/profile/' + name).set(prof).catch(function(){});
    }
    var joined = prof && prof.joined
      ? new Date(prof.joined).toLocaleDateString(undefined, {year:'numeric', month:'short', day:'numeric'}) : '';

    var bioHtml = own
      ? '<textarea class="pf-edit" id="pfBio" maxlength="160" placeholder="Write a short bio (160 characters max)"></textarea>' +
        '<div style="margin-top:10px;display:flex;gap:10px;align-items:center;"><button id="pfSave">Save bio</button><span class="hint" id="pfMsg"></span></div>'
      : '<div class="pf-bio">' + (prof && prof.bio ? esc(prof.bio) : '<span class="hint">No bio yet.</span>') + '</div>';

    var recordRows = ['hb','team','std'].map(function(v){
      var s = stats[v] || {w:0, l:0, d:0};
      return '<div class="seat"><span class="who">' + esc(VNAME[v]) + '</span><span class="taken">' +
             (s.w||0) + 'W &middot; ' + (s.l||0) + 'L &middot; ' + (s.d||0) + 'D</span></div>';
    }).join('');

    var ktText = (kt && typeof kt.sq === 'number') ? kt.sq + '/64 in ' + fmtMs(kt.ms) : 'No runs yet';

    screen.innerHTML =
      '<div class="card">' +
        '<div class="pf-head"><div class="pf-avatar">' + esc(name.charAt(0).toUpperCase()) + '</div><div>' +
          '<div class="pf-name">' + esc(name) + (own ? ' <span class="hint">(you)</span>' : '') + '</div>' +
          (joined ? '<div class="hint">On Pawniac since ' + esc(joined) + '</div>' : '') +
        '</div></div>' + bioHtml +
      '</div>' +
      '<div class="card"><h2>Ratings</h2><div class="pf-grid">' + ratingBox('Hand &amp; Brain', r[1]) + ratingBox('Standard', r[2]) + '</div></div>' +
      '<div class="card"><h2>Record</h2>' + recordRows + '</div>' +
      '<div class="card"><h2>Knight\'s tour best</h2><p class="desc" style="margin:0;">' + esc(ktText) + '</p></div>';

    if(own){
      var box = document.getElementById('pfBio');
      box.value = (prof && prof.bio) || '';
      document.getElementById('pfSave').onclick = async function(){
        var msg = document.getElementById('pfMsg');
        var bio = box.value.slice(0, 160);
        try{
          await db.ref('hb/profile/' + name).set({bio:bio, joined:prof.joined});
          prof.bio = bio;
          msg.textContent = 'Saved';
        }catch(e){
          console.error(e);
          msg.textContent = "Couldn't save (check the Firebase rules).";
        }
      };
    }
  };
})();
