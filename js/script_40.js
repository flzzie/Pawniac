(function(){
  var HOUR = 3600000, S = {}, DBG = {counted:0, failed:0, lastError:null};
  window.__pawniacCounters = DBG;   // for checking in the console (F12)

  function worthy(g){
    return !!g && g.status === 'finished' && !!g.winner && g.winner !== 'abort' && !!g.moveLog && g.moveLog.length >= 2;
  }

  async function count(g, gid){
    var s = S[gid] || (S[gid] = {entry:false, total:false, tries:0, next:0, busy:false});
    if(s.busy || (s.entry && s.total) || s.tries >= 6 || Date.now() < s.next) return;
    s.busy = true;
    try{
      if(!s.entry){
        var hr = Math.floor((typeof g.moveAt === 'number' ? g.moveAt : serverNow()) / HOUR);
        var r = await db.ref('hb/counters/played/h/' + hr + '/' + gid).transaction(function(c){ return c ? undefined : true; });
        s.entry = true;
        if(!r.committed) s.total = true;      // someone already counted this game (the old code or the other player)
      }
      if(!s.total){
        await db.ref('hb/counters/played/total').transaction(function(c){ return (c || 0) + 1; });
        s.total = true;
      }
      DBG.counted++;
    }catch(e){
      s.tries++;
      s.next = Date.now() + 8000 * s.tries;   // try again a bit later
      DBG.failed++; DBG.lastError = String((e && e.code) || e);
      console.error('played counter failed (try ' + s.tries + ')', e);
    }finally{
      s.busy = false;
    }
  }

  setInterval(function(){
    try{
      if(typeof ME === 'undefined' || !ME || !gameState || !currentGameId) return;
      if(!worthy(gameState) || !myRole(gameState)) return;
      count(gameState, currentGameId);
    }catch(e){ console.error('counter poll failed', e); }
  }, 2000);
})();
