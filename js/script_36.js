(function(){
  // A bot game is counted once, when it ends (win, loss, draw, resign or time out) and at least 2 moves were played.
  // Today's count uses the same hourly entries as step 34; the all-time total is kept in hb/counters/played/bot.
  var counted = false;
  function hourOf(ms){ return Math.floor(ms / 3600000); }
  function plies(scr){
    var n = 0;
    scr.querySelectorAll('.move-white, .move-black').forEach(function(e){ if((e.textContent || '').trim()) n++; });
    return n;
  }
  function count(){
    var gid = 'bot' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    var hr = hourOf(serverNow());
    db.ref('hb/counters/played/h/' + hr + '/' + gid).transaction(function(c){ return c ? undefined : true; })
      .then(function(r){
        // bot games have their own total (the lobby adds it on top of the online total, see the step 34 edit)
        if(r.committed) return db.ref('hb/counters/played/bot').transaction(function(c){ return (c || 0) + 1; });
      }).catch(function(e){ console.error('bot game counter failed', e); });
  }
  setInterval(function(){
    try{
      var scr = document.getElementById('screen-bot');
      if(!scr || !ME) return;
      var done = !!scr.querySelector('.result-banner');
      if(!done){ counted = false; return; }               // game running or setup screen: ready for the next one
      if(counted) return;
      counted = true;                                      // never count the same finished game twice
      if(plies(scr) >= 2) count();
    }catch(e){ console.error(e); }
  }, 700);
})();
