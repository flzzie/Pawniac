(function(){
  // Fixes: tabs finishing out of order (a slow tab overwrote the one you clicked last),
  // the Piece Auction tab flashing the Hand & Brain board first, and the link not showing /leaderboard/auction.
  var inner = window.renderLeaderboard, running = null, pending = null;

  function norm(v){ return (v === 'standard' || v === 'auction') ? v : 'hb'; }

  async function once(v){
    var el = document.getElementById('screen-leaderboard');
    var hide = (v === 'auction' && el);
    if(hide) el.style.visibility = 'hidden';          // no flash of the wrong board while it loads
    try{
      await inner.call(window, v);
    } finally {
      if(hide) el.style.visibility = '';
    }
    try{
      var h = '#/leaderboard' + (v === 'standard' ? '/standard' : v === 'auction' ? '/auction' : '');
      if(location.hash !== h && document.getElementById('screen-leaderboard').style.display !== 'none'){
        history.replaceState(null, '', location.pathname + location.search + h);
      }
    }catch(e){}
  }

  // Games that were aborted or had no moves must never touch the leaderboard (this is what listed people who never played)
  var prevSettle = window.settleMyRating;
  window.settleMyRating = async function(g){
    try{
      if(g && (g.winner === 'abort' || (g.variant !== 'auction' && (!g.moveLog || !g.moveLog.length)))) return;
    }catch(e){}
    return prevSettle.apply(this, arguments);
  };

  window.renderLeaderboard = function(v){
    v = norm(v);
    if(running){                                       // one at a time; only the LAST click is kept
      pending = v;
      return running;
    }
    running = (async function(){
      try{
        await once(v);
        while(pending !== null){
          var nx = pending; pending = null;
          await once(nx);
        }
      }catch(e){ console.error('leaderboard failed', e); }
      finally{ running = null; pending = null; }
    })();
    return running;
  };
})();
