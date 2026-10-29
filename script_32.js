(function(){
  var inner = window.renderLeaderboard, seq = 0, boot = true;

  function esc(s){ return String(s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

  function ensureTab(modes){
    if(modes.querySelector('[data-v="auction"]')) return;
    var t = document.createElement('div');
    t.className = 'modebtn';
    t.dataset.v = 'auction';
    t.textContent = 'Piece Auction';
    t.onclick = function(){ window.renderLeaderboard('auction'); };
    modes.appendChild(t);
  }

  async function paintAuction(my){
    var scr = document.getElementById('screen-leaderboard');
    var first = scr && scr.querySelector('.modes [data-v]');
    if(!first) return;
    var modes = first.parentNode, card = modes.closest('.card');
    ensureTab(modes);
    modes.querySelectorAll('[data-v]').forEach(function(x){ x.classList.toggle('active', x.dataset.v === 'auction'); });
    function body(html){
      while(modes.nextSibling) card.removeChild(modes.nextSibling);
      card.insertAdjacentHTML('beforeend', html);
    }
    body('<p class="desc">Loading...</p>');           // the Hand & Brain rows are gone right away
    var html;
    try{
      var snap = await db.ref('hb/leaderboardAuc').once('value');
      if(my !== seq) return;
      var users = snap.exists() ? snap.val() : {};
      var rows = Object.keys(users).map(function(u){
          var x = users[u] || {};
          return {username:u, rating:Number(x.rating) || 1200, games:Number(x.games) || 0};
        })
        .filter(function(u){ return u.games > 0; })
        .sort(function(a, b){ return b.rating - a.rating; })
        .slice(0, 50);
      html = '<p class="desc">Ranked by rating. Only rated Piece Auction games count.</p>' +
        (rows.length ? rows.map(function(u, i){
          return '<div class="seat"><span class="who">#' + (i + 1) + ' ' + esc(u.username) + (ME && u.username === ME.username ? ' (you)' : '') +
                 '</span><span class="taken">' + u.rating + ' &middot; ' + u.games + ' games</span></div>';
        }).join('') : '<p class="desc">No rated Piece Auction games yet. Play one to get on the board.</p>');
    }catch(e){
      console.error('auction leaderboard failed', e);
      html = '<p class="desc">Could not load the Piece Auction leaderboard. In the Firebase console, publish the rule for "leaderboardAuc" (see below).</p>';
    }
    if(my !== seq) return;
    body(html);
    try{ PW.replace('#/leaderboard/auction'); }catch(e){}
  }

  window.renderLeaderboard = async function(v){
    var want = (v === 'auction') ? 'auction' : (v === 'standard' ? 'standard' : 'hb');
    var my = ++seq, el = document.getElementById('screen-leaderboard');
    if(want === 'auction' && el) el.style.visibility = 'hidden';      // no flash of the wrong board
    try{
      await inner.call(window, want === 'auction' ? 'hb' : want);     // builds the page, tabs and players card
      if(want === 'auction' && my === seq) await paintAuction(my);
    }catch(e){ console.error('leaderboard failed', e); }
    finally{ if(my === seq && el) el.style.visibility = ''; }
  };

  // opening the link  .../#/leaderboard/auction  after loading / logging in
  var prevAfter = window.afterAuth;
  window.afterAuth = async function(){
    var link = false;
    if(boot){ boot = false; link = /^#\/leaderboard\/auction\/?$/i.test(PW.hash()); }
    var r = await prevAfter.apply(this, arguments);
    if(link && ME){
      var gs = document.getElementById('screen-game');
      if(!(gs && gs.style.display === 'block')) window.renderLeaderboard('auction');
    }
    return r;
  };
})();
