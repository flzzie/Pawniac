/* Pawniac: bans and appeals (the player's side).
 * A ban is made with the admin tool (admin_tool.py on the owner's computer). It writes hb/bansByUid/<uid>
 * and removes hb/usernameByUid/<uid>, which every write rule needs, so a banned player cannot play.
 * This file shows them why, and lets them send ONE appeal (hb/appeals/<uid>) the owner reviews with the tool.
 */
(function(){
  // Discord ping for new appeals: paste the Cloudflare Worker address here (see appeal-notify-worker.js). Empty = no ping.
  var APPEAL_NOTIFY_URL = 'https://pawniacappeal.rishiitsrivastava.workers.dev/';
  var prevSignedIn = window.handleSignedIn, watch = null;
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function dateText(ts){ return typeof ts === 'number' ? new Date(ts).toLocaleString(undefined, {year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}) : ''; }
  function stopWatch(){ if(watch){ try{ watch.off(); }catch(e){} watch = null; } }

  async function showBan(user, ban){
    try{ stopPoll(); }catch(e){}
    showScreen('auth');
    try{ document.getElementById('userbox').innerHTML = ''; }catch(e){}
    var el = document.getElementById('screen-auth'), appeal = null;
    try{ appeal = (await db.ref('hb/appeals/' + user.uid).once('value')).val(); }catch(e){}
    var next = ban && typeof ban.nextAppeal === 'number' ? ban.nextAppeal : 0, wait = next > Date.now();
    var body;
    if(appeal){
      body = '<div class="draw-offer">Your appeal was sent' + (appeal.ts ? ' on ' + esc(dateText(appeal.ts)) : '') + '. It will be reviewed. You do not need to send another.</div>';
    } else if(wait){
      body = '<div class="draw-offer">Your last appeal was rejected. You can appeal again on <b>' + esc(dateText(next)) + '</b>.</div>';
    } else {
      body = '<p class="desc">If you think this was a mistake, tell us what happened. You can send one appeal at a time.</p>' +
        '<textarea id="banAppealText" maxlength="1000" rows="5" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #cfd8d3;border-radius:8px;font:inherit;" placeholder="Write your appeal here (at least 20 characters)"></textarea>' +
        '<div id="banAppealMsg" style="margin-top:8px;font-size:13px;color:#b8433f;"></div>' +
        '<div style="margin-top:10px;"><button id="banAppealSend">Send appeal</button></div>';
    }
    el.innerHTML = '<div class="card"><h2>Your account has been banned</h2>' +
      '<p class="desc">' + (ban && ban.reason ? 'Reason: <b>' + esc(ban.reason) + '</b>' : 'This account was banned for breaking the rules.') +
      (ban && ban.ts ? '<br>Date: ' + esc(dateText(ban.ts)) : '') + '</p>' + body +
      '<div style="margin-top:16px;"><span class="backlink" id="banLogout">Log out</span></div></div>';
    var lo = document.getElementById('banLogout');
    if(lo) lo.onclick = function(){ stopWatch(); if(typeof logout === 'function') logout(); else auth.signOut(); };
    var send = document.getElementById('banAppealSend');
    if(send) send.onclick = async function(){
      var t = (document.getElementById('banAppealText').value || '').trim(), msg = document.getElementById('banAppealMsg');
      if(t.length < 20){ msg.textContent = 'Please write at least 20 characters.'; return; }
      send.disabled = true; msg.textContent = '';
      try{
        await db.ref('hb/appeals/' + user.uid).set({message:t.slice(0, 1000), ts:firebase.database.ServerValue.TIMESTAMP});
        if(APPEAL_NOTIFY_URL){      // best effort: the appeal is already saved whatever happens here
          try{
            var tok = await user.getIdToken();
            fetch(APPEAL_NOTIFY_URL, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({token:tok})}).catch(function(){});
          }catch(e){}
        }
        showBan(user, ban);
      }catch(e){
        console.error('appeal failed', e);
        msg.textContent = 'Could not send the appeal. Please try again later.';
        send.disabled = false;
      }
    };
  }

  window.handleSignedIn = async function(user){
    stopWatch();
    var ban = null, known = false;
    try{ var s = await db.ref('hb/bansByUid/' + user.uid).once('value'); known = true; ban = s.exists() ? s.val() : null; }catch(e){ console.error('ban check failed (publish the new Firebase rules)', e); }
    if(ban){ showBan(user, ban); return; }
    // banned while playing: the next change shows the ban screen straight away
    if(known){
      try{
        watch = db.ref('hb/bansByUid/' + user.uid);
        watch.on('value', function(s){
          if(!auth.currentUser || auth.currentUser.uid !== user.uid) return;
          if(s.exists()) showBan(user, s.val());
        }, function(){});
      }catch(e){}
    }
    return prevSignedIn.apply(this, arguments);
  };
  // a banned player's profile says so (the admin tool writes hb/bannedPublic/<name>, which holds only the date)
  var prevOpenProfile = window.openProfile;
  if(typeof prevOpenProfile === 'function') window.openProfile = async function(name){
    var r = await prevOpenProfile.apply(this, arguments);
    try{
      if(!name) return r;
      var b = (await db.ref('hb/bannedPublic/' + name).once('value')).val();
      var card = document.querySelector('#screen-profile .card');
      if(b && card && !card.querySelector('.pf-banned')){
        var d = document.createElement('div');
        d.className = 'draw-offer pf-banned';
        d.style.cssText = 'color:#b8433f;margin-bottom:12px;font-weight:600;';
        d.textContent = 'This player is banned.';
        card.insertBefore(d, card.firstChild);
      }
    }catch(e){}
    return r;
  };
  var prevLogout = window.logout;
  if(typeof prevLogout === 'function') window.logout = function(){ stopWatch(); return prevLogout.apply(this, arguments); };
})();
