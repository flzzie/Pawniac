(function(){
  // 1. read ?room=CODE from the URL (if someone opened an invite link)
  var pending = (new URLSearchParams(location.search).get('room') || '').toUpperCase();
  if(!/^[A-Z0-9]{5}$/.test(pending)) pending = null;

  // 2. after login, jump straight into that room
  var origAfterAuth = window.afterAuth;
  window.afterAuth = async function(){
    if(pending){
      var code = pending;
      pending = null;
      history.replaceState(null, '', location.pathname);   // clean the URL
      var exists = await kget('hb:game:' + code, true);
      if(exists){ await joinRoom(code); return; }
      alert("That invite link's room doesn't exist anymore.");
    }
    return origAfterAuth();
  };

  // 3. add a "Copy invite link" button to the waiting room
  var origDrawWaiting = window.drawWaiting;
  window.drawWaiting = function(code, game){
    origDrawWaiting(code, game);
    var box = document.querySelector('#screen-waiting .code-display');
    if(!box) return;
    var btn = document.createElement('button');
    btn.className = 'secondary full-btn';
    btn.textContent = 'Copy invite link';
    btn.onclick = async function(){
      var link = location.origin + location.pathname + '?room=' + code;
      try{
        await navigator.clipboard.writeText(link);
        btn.textContent = 'Copied!';
        setTimeout(function(){ btn.textContent = 'Copy invite link'; }, 1500);
      }catch(e){
        prompt('Copy this invite link:', link);
      }
    };
    box.after(btn);
  };
})();
