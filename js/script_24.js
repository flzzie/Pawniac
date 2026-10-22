(function(){
  function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}

  // same game object step 22 builds (challenges need it)
  window.__newAuctionGame=function(seats,tc,status){
    var B=15+Math.floor(Math.random()*36),z=function(){return {p:0,n:0,b:0,r:0,q:0};};
    return {mode:'random',variant:'auction',status:status||'waiting',fen:new Chess().fen(),turn:'w',announced:'std',
      moveLog:[],winner:null,drawOffer:'',clock:freshClock(tc),seats:seats,
      auction:{budget:B,coins:{w:B,b:B},bought:{w:z(),b:z()},done:{w:false,b:false},nom:'w',phase:'nominate',item:'',bid:0,bidder:'',
        turn:'w',np:0,unsold:0,round:0,turnAt:serverNow(),lastW:'',lastT:'',lastBid:0,place:{w:'',b:''}}};
  };

  // ---------- 1. rating snapshot when both seats are filled ----------
  var pk=window.kset;
  window.kset=async function(key,value,shared){
    try{
      if(shared!==false&&typeof key==='string'&&key.indexOf('hb:game:')===0&&value&&typeof value==='object'){
        if(value.wantAuction){   // game accepted from a challenge: turn it into an auction game
          var ag=window.__newAuctionGame(value.seats,(value.clock&&value.clock.tcKey)||'none','auction');
          Object.keys(value).forEach(function(k){delete value[k];});
          Object.assign(value,ag);
        }
        if(value.variant==='auction'&&!value.ratingSnapshot&&value.seats&&value.seats.white&&value.seats.black){
          var a=(await kget('hb:leaderboardAuc:'+value.seats.white,true))||{rating:1200,games:0};
          var b=(await kget('hb:leaderboardAuc:'+value.seats.black,true))||{rating:1200,games:0};
          value.ratingSnapshot={white:a.rating,black:b.rating};
        }
      }
    }catch(e){console.error('auction rating snapshot failed',e);}
    return pk(key,value,shared);
  };

  // ---------- 2. rating change at the end of the game ----------
  var ps=window.settleMyRating;
  window.settleMyRating=async function(g){
    if(!g||g.variant!=='auction') return ps(g);
    if(g.mode!=='random'||g.status!=='finished'||!g.ratingSnapshot||!g.winner||g.winner==='abort') return;
    var gid=currentGameId,me=myRole(g);if(!me) return;
    var side=me.side;
    if(myRatingChangeCache[gid]||settlingGames[gid]) return;
    if(g.ratingApplied&&g.ratingApplied[side]) return;
    settlingGames[gid]=true;
    var myStart=side==='w'?g.ratingSnapshot.white:g.ratingSnapshot.black;
    var oppStart=side==='w'?g.ratingSnapshot.black:g.ratingSnapshot.white;
    var change=computeEloChange(myStart,oppStart,scoreForSide(g.winner,side));
    var path='hb:leaderboardAuc:'+ME.username;
    var prof=(await kget(path,true))||{rating:myStart,games:0};
    var newRating=prof.rating+change;
    myRatingChangeCache[gid]={change:change,newRating:newRating};
    await kset(path,{rating:newRating,games:prof.games+1},true);
    await db.ref(dbPath('hb:game:'+gid+'/ratingApplied/'+side)).set(true);
    if(gameState&&currentGameId===gid) drawGame();
  };

  // result banner shows "Updating rating..." (step 22 removed it)
  var pd=window.drawGame;
  window.drawGame=function(){
    pd();
    try{
      var g=gameState;
      if(!g||g.variant!=='auction'||g.status!=='finished'||g.winner==='abort'||!myRole(g)) return;
      var bn=document.querySelector('#screen-game .result-banner');if(!bn) return;
      var has=Array.prototype.some.call(bn.querySelectorAll('.rc'),function(d){return /^You:|^Updating/.test(d.textContent);});
      if(!has){var d=document.createElement('div');d.className='rc';d.textContent='Updating rating...';bn.appendChild(d);}
    }catch(e){console.error(e);}
  };

  // ---------- 3. lobby text: rated + your rating ----------
  var pl=window.renderLobby;
  window.renderLobby=function(){
    pl();
    try{
      var el=document.getElementById('screen-lobby');
      if(!el.querySelector('[data-variant="auction"].active')) return;
      var qd=document.getElementById('btnQuick').closest('.card').querySelector('p.desc');
      if(qd) qd.textContent=qd.textContent.replace('Unrated.','Rated.');
      var h=Array.prototype.filter.call(el.querySelectorAll('.hint'),function(x){return x.textContent==='Piece Auction games are unrated.';})[0];
      if(h) kget('hb:leaderboardAuc:'+ME.username,true).then(function(p){
        p=p||{rating:1200,games:0};h.textContent='Your Piece Auction rating: '+p.rating+' \u00b7 '+p.games+' games';
      });
    }catch(e){console.error(e);}
  };

  // ---------- 4. leaderboard tab ----------
  var plb=window.renderLeaderboard;
  window.renderLeaderboard=async function(v){
    var r=await plb.apply(this,arguments);
    try{
      var scr=document.getElementById('screen-leaderboard');
      var first=scr.querySelector('.modes [data-v]');if(!first) return r;
      var modes=first.parentNode,card=modes.closest('.card');
      if(!modes.querySelector('[data-v="auction"]')){
        var t=document.createElement('div');t.className='modebtn';t.dataset.v='auction';t.textContent='Piece Auction';
        t.onclick=function(){window.renderLeaderboard('auction');};modes.appendChild(t);
      }
      if(v==='auction'){
        modes.querySelectorAll('[data-v]').forEach(function(x){x.classList.toggle('active',x.dataset.v==='auction');});
        var snap=await db.ref('hb/leaderboardAuc').once('value'),users=snap.exists()?snap.val():{};
        var rows=Object.keys(users).map(function(u){return {username:u,rating:users[u].rating||1200,games:users[u].games||0};})
          .filter(function(u){return u.games>0;}).sort(function(a,b){return b.rating-a.rating;}).slice(0,50);
        while(modes.nextSibling) card.removeChild(modes.nextSibling);
        card.insertAdjacentHTML('beforeend','<p class="desc">Ranked by rating. Only rated Piece Auction games count.</p>'+
          (rows.length?rows.map(function(u,i){
            return '<div class="seat"><span class="who">#'+(i+1)+' '+esc(u.username)+(u.username===ME.username?' (you)':'')+'</span><span class="taken">'+u.rating+' &middot; '+u.games+' games</span></div>';
          }).join(''):'<p class="desc">No rated Piece Auction games yet.</p>'));
      }
    }catch(e){console.error('auction leaderboard failed',e);}
    return r;
  };

  // ---------- 5. rating on profiles ----------
  var po=window.openProfile;
  window.openProfile=async function(name){
    var r=await po.apply(this,arguments);
    try{
      var scr=document.getElementById('screen-profile'),gr=scr.querySelector('.pf-grid'),nm=scr.querySelector('.pf-name');
      if(gr&&nm&&nm.textContent.indexOf(name)===0&&!gr.querySelector('[data-auc]')){
        var v=(await db.ref('hb/leaderboardAuc/'+name).once('value')).val();
        if(!gr.querySelector('[data-auc]')){
          var d=document.createElement('div');d.className='pf-box';d.dataset.auc='1';
          d.innerHTML='<div class="hint">Piece Auction</div><div class="pf-big">'+(v?v.rating:'-')+'</div><div class="hint">'+(v?v.games:0)+' games</div>';
          gr.appendChild(d);
        }
      }
    }catch(e){console.error(e);}
    return r;
  };
})();
