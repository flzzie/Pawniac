(function(){
  // under your name: "N games played" (Hand & Brain + Team + Standard), no rating
  var total = null;
  function paint(){
    var r = document.querySelector('#userbox .rating');
    if(!r) return;
    r.textContent = total === null ? '' : total + (total === 1 ? ' game' : ' games') + ' played';
  }
  async function fetchTotal(){
    if(!ME || !ME.username) return;
    try{
      var s = await kget('hb:stats:' + ME.username, true), t = 0;
      if(s) ['hb', 'team', 'std'].forEach(function(v){
        var x = s[v];
        if(x) t += (Number(x.w) || 0) + (Number(x.l) || 0) + (Number(x.d) || 0);
      });
      total = t;
      paint();
    }catch(e){ console.error('games total failed', e); }
  }
  var prevUB = window.renderUserbox;
  window.renderUserbox = function(p){
    prevUB(p);
    paint();
    fetchTotal();
  };
  // refresh after a game, when you come back to the lobby
  var prevShow = window.showScreen;
  window.showScreen = function(n){
    prevShow(n);
    if(n === 'lobby') fetchTotal();
  };
})();
