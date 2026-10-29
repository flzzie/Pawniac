(function(){
  var ref = null, cb = null, cur = null;

  function detach(){ try{ if(ref) ref.off('value', cb); }catch(e){} ref = null; cb = null; cur = null; }
  function inActiveGame(){
    var s = document.getElementById('screen-game');
    return !!s && s.style.display === 'block' && !!gameState && gameState.status === 'active';
  }

  function paint(name, gid){
    var scr = document.getElementById('screen-profile');
    if(!scr || scr.style.display !== 'block' || cur !== name) return;
    var old = scr.querySelector('#pfWatch');
    if(!gid){ if(old) old.remove(); return; }
    if(old){ old.dataset.gid = gid; return; }
    var host = scr.querySelector('.pf-status');
    var anchor = host || scr.querySelector('.pf-name');
    if(!anchor) return;
    var b = document.createElement('button');
    b.id = 'pfWatch';
    b.className = 'secondary ch-btn';
    b.style.cssText = 'padding:4px 10px;font-size:11.5px;margin-left:10px;';
    b.textContent = 'Watch live game';
    b.dataset.gid = gid;
    b.onclick = function(){
      if(inActiveGame() && !confirm('Your clock keeps running while you are away. Leave the game view?')) return;
      PW.push('#/watch/' + b.dataset.gid);      // step 36 opens it
    };
    if(host) host.appendChild(b); else anchor.after(b);
  }

  function attach(name){
    detach();
    if(!ME || !name || name === ME.username) return;
    cur = name;
    ref = db.ref('hb/live/playing/' + name);
    cb = ref.on('value', function(s){
      var gid = s.val();
      if(!gid || typeof gid !== 'string'){ paint(name, null); return; }
      db.ref('hb/game/' + gid + '/status').once('value').then(function(st){
        paint(name, st.val() === 'active' ? gid : null);
      }).catch(function(){ paint(name, null); });
    });
  }

  var prevOpen = window.openProfile;
  window.openProfile = async function(name){
    var r = await prevOpen.apply(this, arguments);
    try{ attach(name); }catch(e){ console.error('profile watch failed', e); }
    return r;
  };
  var prevShow = window.showScreen;
  window.showScreen = function(n){
    if(n !== 'profile') detach();
    return prevShow(n);
  };
})();
