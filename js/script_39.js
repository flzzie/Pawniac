(function(){
  var TS = firebase.database.ServerValue.TIMESTAMP;
  var ref = null, name = null, cb = null, was = false;

  function detach(){ try{ if(ref) ref.off('value', cb); }catch(e){} ref = null; cb = null; name = null; }
  function attach(){
    if(!ME || name === ME.username) return;
    detach();
    name = ME.username;
    ref = db.ref('hb/status/' + name);
    // whenever the status changes (the normal "online" refresh included) put "playing" back while a bot game is on
    cb = ref.on('value', function(s){
      if(!window.__botActive) return;
      var v = s.val();
      if(!v || v.s !== 'playing') ref.set({s:'playing', t:TS}).catch(function(){});
    });
  }

  setInterval(function(){
    try{
      if(!ME){ detach(); was = false; return; }
      attach();
      var on = !!window.__botActive;
      if(on && !was && ref) ref.once('value').then(function(s){
        var v = s.val();
        if(window.__botActive && (!v || v.s !== 'playing')) ref.set({s:'playing', t:TS}).catch(function(){});
      });
      if(!on && was && ref) ref.set({s:'online', t:TS}).catch(function(){});   // game over: back to online
      was = on;
    }catch(e){ console.error('bot status failed', e); }
  }, 1000);
})();
