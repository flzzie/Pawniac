(function(){
  // Titles are stored in the database at hb/titles/<username> (for example "GM").
  // Players cannot write there; only you can, from the Firebase Console.
  var T = {}, loaded = false, queued = false;
  function esc(s){ return String(s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function load(){
    try{
      db.ref('hb/titles').once('value').then(function(s){
        var v = s.exists() ? s.val() : {};
        T = {};
        Object.keys(v || {}).forEach(function(k){ if(/^[A-Za-z]{2,4}$/.test(String(v[k]))) T[k] = String(v[k]).toUpperCase() === 'MOD' ? 'Mod' : String(v[k]).toUpperCase(); });
        loaded = true; paint();
      }).catch(function(){});
    }catch(e){}
  }
  function badge(t){ return '<span class="ttl t-' + esc(t) + '" title="' + esc(t) + '">' + esc(t) + '</span>'; }
  function tag(el, name){
    if(!name || !T[name] || el.dataset.ttl === T[name]) return;
    el.dataset.ttl = T[name];
    // profile name: the badge is drawn by CSS (::before), so the text stays clean
    // and the other steps that check the name text keep working
    if(el.classList.contains('pf-name')) return;
    el.insertAdjacentHTML('afterbegin', badge(T[name]));
  }
  function paint(){
    queued = false;
    if(!loaded) return;
    document.querySelectorAll('.user-link[data-user]').forEach(function(el){ tag(el, el.dataset.user); });
    var ub = document.querySelector('#userbox .name');
    if(ub && typeof ME !== 'undefined' && ME && ME.username) tag(ub, ME.username);
    document.querySelectorAll('.pf-name, .lb-name').forEach(function(el){
      var n = (el.textContent || '').trim().split(/\s+/)[0];
      tag(el, n);
    });
  }
  function schedule(){ if(!queued){ queued = true; requestAnimationFrame(paint); } }
  new MutationObserver(schedule).observe(document.body, {childList:true, subtree:true});
  load();
  // pick up a title you just added: refresh whenever the lobby or leaderboard opens
  var prevShow = window.showScreen, last = 0;
  window.showScreen = function(n){
    prevShow(n);
    if((n === 'lobby' || n === 'leaderboard') && Date.now() - last > 60000){ last = Date.now(); load(); }
  };
})();
