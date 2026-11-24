/* PAWNIAC STEP 64: DONATE PAGE
   - a "Donate" tab in the top bar (and a link in the footer, Help and Settings), real address /donate/
   - payment methods are filled in below in DONATE_CONFIG: an empty UPI id or empty wallet address is simply not shown
   - after paying, a logged-in player presses "I've donated" and sends their username, amount and the payment reference;
     staff (script_48 ADMINS) approve it here, which switches on the donator name colours (hb/donors/<name>/on)
   - requests live at hb/donations/<username>/<id> (database rules: firebase-rules-with-donations.json, kept outside the repo)
   - your own QR codes: put the pictures at images/donate-upi.png and images/donate-<coin>.png; they show if the file exists */
(function(){
  var DONATE_CONFIG = {
    upi:    {id: 'rishit.10@fam', name: 'Rishit', qr: 'images/donate-upi.png'},   // your UPI id
    crypto: [             // shown in this order; optional qr: 'images/donate-xxx.png' (shown if the file exists)
      {coin: 'USDT', network: 'Tron (TRC-20)',      addr: 'TBfuGnGaeqrT8f9hxsvvLv7MNV32e29Vt1'},
      {coin: 'USDT', network: 'Polygon',            addr: '0x8992B4776Cb211Fc49Dbe5363BF95B164F254015'},
      {coin: 'USDT', network: 'Solana',             addr: 'WPLNoZweHiZDS74SxztRzxGe69minqFL7kUPv6zeHQE'},
      {coin: 'SOL',  network: 'Solana',             addr: 'WPLNoZweHiZDS74SxztRzxGe69minqFL7kUPv6zeHQE'},
      {coin: 'POL',  network: 'Polygon',            addr: '0x8992B4776Cb211Fc49Dbe5363BF95B164F254015'},
      {coin: 'LTC',  network: 'Litecoin',           addr: 'LUypJecVs2JPp4RFf8jUGqnJWLUUtb99Gz'}
    ]
  };

  function esc(s){ return String(s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function $(id){ return document.getElementById(id); }
  function loggedIn(){ return typeof ME !== 'undefined' && !!ME && !!ME.username; }
  function isAdmin(){ return typeof window.pawniacIsAdmin === 'function' && window.pawniacIsAdmin(); }
  // Discord ping when a donor sends the "I've donated" form: paste the Cloudflare Worker address here (see donate-notify-worker.js). Empty = no ping.
  var DONATE_NOTIFY_URL = 'https://pawniacdonate.rishiitsrivastava.workers.dev/';
  var CONTACT = 'support@pawniac.fun';

  var css = '#screen-donate .dn-addr{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:6px 0 10px}'
  + '#screen-donate .dn-addr code{display:block;padding:8px 10px;border-radius:8px;background:rgba(127,127,127,.15);word-break:break-all;font-size:13px;flex:1 1 220px;user-select:all}'
  + '#screen-donate .dn-qr{max-width:180px;width:100%;border-radius:10px;background:#fff;padding:6px;display:block;margin:8px 0}'
  + '#screen-donate .dn-crow{padding:8px 0;border-top:1px solid rgba(127,127,127,.2)}#screen-donate .dn-clabel{font-size:14px;margin-top:2px}'
  + '#screen-donate .dn-warn{font-size:13px;margin:8px 0;padding:8px 10px;border-radius:8px;background:rgba(220,150,0,.13)}'
  + '#screen-donate .dn-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:space-between;padding:8px 0;border-top:1px solid rgba(127,127,127,.2)}'
  + '#screen-donate .dn-st{font-size:12px;font-weight:700;padding:2px 8px;border-radius:999px;background:rgba(127,127,127,.2)}'
  + '#screen-donate .dn-st.ok{background:rgba(31,157,85,.25)}#screen-donate .dn-st.no{background:rgba(220,60,60,.22)}'
  + '#screen-donate select{background:rgba(127,127,127,.12);color:inherit;border:1px solid rgba(127,127,127,.35);border-radius:8px;padding:9px}#screen-donate option{color:#111}#screen-donate a:not(.dn-open){color:inherit;text-decoration:underline}#screen-donate .dn-open{text-decoration:none}#screen-donate label{display:block;font-size:13px;margin:10px 0 4px}#screen-donate select,#screen-donate input[type=text]{width:100%;max-width:420px;box-sizing:border-box}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var scr = document.createElement('div'); scr.id = 'screen-donate'; scr.style.display = 'none';
  document.querySelector('.wrap').insertBefore(scr, $('pnFooter') || null);   // above the footer
  var nav = $('navbar');
  var link = document.createElement('a'); link.setAttribute('data-nav', 'donate'); link.textContent = 'Donate'; nav.appendChild(link);

  function paintNav(){ link.textContent = 'Donate' + (isAdmin() && D.pending.length ? ' (' + D.pending.length + ')' : ''); }
  function code(){ return 'PAW-' + (loggedIn() ? ME.username : 'yourname'); }
  function copyBtn(txt, label){ return '<button type="button" class="secondary dn-copy" data-c="' + esc(txt) + '">' + (label || 'Copy') + '</button>'; }

  var D = {mine: [], pending: [], msg: ''};
  function when(ts){ return ts ? new Date(ts).toLocaleDateString(undefined, {day:'numeric', month:'short', year:'numeric'}) : ''; }
  function statusTag(s){ return '<span class="dn-st ' + (s === 'approved' ? 'ok' : (s === 'rejected' ? 'no' : '')) + '">' + (s === 'approved' ? 'Approved' : (s === 'rejected' ? 'Not matched' : 'Waiting')) + '</span>'; }

  function cryptoList(){ return (DONATE_CONFIG.crypto || []).filter(function(c){ return c && c.addr; }); }
  function hasUpi(){ return !!(DONATE_CONFIG.upi && DONATE_CONFIG.upi.id); }
  function curKind(){ var k = D.kind; if(k === 'upi' && hasUpi()) return 'upi'; if(k === 'crypto' && cryptoList().length) return 'crypto'; return hasUpi() ? 'upi' : 'crypto'; }
  function curCoin(){ var l = cryptoList(); return l[Math.min(D.ci || 0, l.length - 1)]; }
  function methodName(){ if(curKind() === 'upi') return 'UPI'; var c = curCoin(); return c.coin + ' (' + c.network + ')'; }

  // what a valid payment reference looks like, per method. UPI stays lenient on purpose (apps show different ids).
  function refRule(){
    if(curKind() === 'upi') return {hint: 'UPI reference number (UTR). Usually 12 digits.', ok: function(v){ return v.length >= 6; }, bad: 'Please paste the UPI reference number (at least 6 characters).'};
    var n = curCoin().network;
    if(/solana/i.test(n)) return {hint: 'Transaction signature (a long code of 86 to 88 letters and numbers).', find: /[1-9A-HJ-NP-Za-km-z]{86,88}/, ok: function(v){ return /^[1-9A-HJ-NP-Za-km-z]{86,88}$/.test(v); }, bad: 'That does not look like a Solana transaction signature. Copy it from your wallet or from solscan.io.'};
    if(/polygon/i.test(n)) return {hint: 'Transaction hash (starts with 0x, then 64 characters).', find: /0x[0-9a-fA-F]{64}/, ok: function(v){ return /^0x[0-9a-fA-F]{64}$/.test(v); }, bad: 'That does not look like a Polygon transaction hash (0x followed by 64 characters). Copy it from your wallet or polygonscan.com.'};
    return {hint: 'Transaction hash (64 letters and numbers).', find: /[0-9a-fA-F]{64}/, ok: function(v){ return /^[0-9a-fA-F]{64}$/.test(v); }, bad: 'That does not look like a transaction hash (64 letters and numbers). Copy it from your wallet or a block explorer.'};
  }
  function cleanRef(v){
    v = (v || '').trim(); var r = refRule();
    if(r.find && /^https?:\/\//i.test(v)){ var m = v.match(r.find); if(m) return m[0]; }   // a pasted explorer link is fine: pull the hash out of it
    return v;
  }

  function payCard(){
    var kinds = [], kind = curKind(), loggedOut = !loggedIn();
    if(hasUpi()) kinds.push(['upi', 'UPI (India)']);
    if(cryptoList().length) kinds.push(['crypto', 'Crypto']);
    var h = '<div class="card"><h2>Donate</h2><label for="dnKind" style="margin-top:0;">Payment method</label><select id="dnKind">' +
      kinds.map(function(k){ return '<option value="' + k[0] + '"' + (k[0] === kind ? ' selected' : '') + '>' + k[1] + '</option>'; }).join('') + '</select>';
    if(kind === 'upi'){
      var u = DONATE_CONFIG.upi, uri = 'upi://pay?pa=' + encodeURIComponent(u.id) + '&pn=' + encodeURIComponent(u.name || 'Pawniac') + '&cu=INR&tn=' + encodeURIComponent(code());
      h += '<p class="desc" style="margin-top:12px;">Any UPI app works. In the note write <b>' + esc(code()) + '</b> so we can match it to you.</p>' +
        '<div class="dn-addr"><code>' + esc(u.id) + '</code>' + copyBtn(u.id) + '</div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;"><a href="' + esc(uri) + '" class="dn-open"><button type="button">Open my UPI app</button></a>' + copyBtn(code(), 'Copy the note') + '</div>' +
        (u.qr ? '<img class="dn-qr" src="' + esc(u.qr) + '" alt="UPI QR code" onerror="this.style.display=\'none\'">' : '') +
        '<div class="hint">On a phone, tap "Open my UPI app". On a computer, copy the UPI ID into any UPI app on your phone.</div>';
    } else {
      var l = cryptoList(), c = curCoin();
      h += '<label for="dnCoin">Coin and network</label><select id="dnCoin">' + l.map(function(x, i){ return '<option value="' + i + '"' + (x === c ? ' selected' : '') + '>' + esc(x.coin) + ' on ' + esc(x.network) + '</option>'; }).join('') + '</select>' +
        '<div class="dn-warn"><b>Send only ' + esc(c.coin) + ' on ' + esc(c.network) + ' to this address.</b> A wrong coin or network cannot be recovered. If unsure, send a tiny test first.</div>' +
        '<div class="dn-addr"><code>' + esc(c.addr) + '</code>' + copyBtn(c.addr) + '</div>' +
        (c.qr ? '<img class="dn-qr" src="' + esc(c.qr) + '" alt="' + esc(c.coin) + ' QR code" onerror="this.style.display=\'none\'">' : '');
    }
    h += '<hr style="border:0;border-top:1px solid rgba(127,127,127,.25);margin:16px 0 4px;">';
    if(loggedOut) return h + '<p class="desc">After paying, log in to tell us, so we know which username to thank.</p></div>';
    return h + '<p class="desc" style="margin-bottom:0;">Paid? Tell us here. Staff check it and switch on your donator name. This can take a day.</p>' +
      '<label for="dnAmt">Amount (for example 100 INR or 5 USDT)</label><input type="text" id="dnAmt" maxlength="30" autocomplete="off" value="' + esc(D.amt || '') + '">' +
      '<label for="dnRef">' + esc(refRule().hint) + '</label><input type="text" id="dnRef" maxlength="200" autocomplete="off" value="' + esc(D.ref || '') + '">' +
      '<div style="margin-top:12px;"><button type="button" id="dnSend">I\'ve donated</button></div><div class="hint" id="dnMsg" aria-live="polite" style="min-height:1.4em;margin-top:8px;">' + esc(D.msg) + '</div></div>';
  }
  function mineCard(){
    if(!loggedIn() || !D.mine.length) return '';
    return '<div class="card"><h2>Your donations</h2>' + D.mine.map(function(r){
      return '<div class="dn-row"><span>' + esc(r.method || '') + (r.amount ? ' &middot; ' + esc(r.amount) : '') + ' <span class="hint">' + esc(when(r.ts)) + '</span></span>' + statusTag(r.status) + '</div>';
    }).join('') + '<div class="hint" style="margin-top:8px;">When it says Approved, open Settings to pick your name colours.</div></div>';
  }
  function adminCard(){
    if(!isAdmin()) return '';
    var rows = D.pending.length ? D.pending.map(function(r){
      return '<div class="dn-row" data-id="' + esc(r.id) + '"><span><b>' + esc(r.user) + '</b> &middot; ' + esc(r.method || '') + ' &middot; ' + esc(r.amount || '?') + '<br><span class="hint">ref: ' + esc(r.ref || '') + ' &middot; ' + esc(when(r.ts)) + '</span></span>' +
        '<span style="display:flex;gap:8px;"><button type="button" data-a="ok">Approve</button><button type="button" class="secondary" data-a="no">Reject</button></span></div>';
    }).join('') : '<p class="desc" style="margin:0;">No donations waiting.</p>';
    return '<div class="card"><h2>Donations to check (staff only)</h2><p class="desc">Match the reference against your UPI statement or a block explorer, then approve. Approving switches on the donator name for that player.</p>' + rows + '<div class="hint" id="dnAdm" style="margin-top:8px;"></div></div>';
  }

  function draw(){
    if(scr.style.display !== 'block') return;
    var none = !hasUpi() && !cryptoList().length;
    scr.innerHTML = '<div class="card"><h2>Support Pawniac</h2>' +
      '<p class="desc">Pawniac is free and has no ads. If you enjoy it and want to help with the running costs, you can donate. It is entirely optional and does not change how the site treats you.</p>' +
      '<p class="desc" style="margin-bottom:0;"><b>Thank-you perk:</b> a gradient colour on your username that everyone sees, everywhere on the site, and a "Donator" tag.</p></div>' +
      (none ? '<div class="card"><h2>Payment details</h2><p class="desc">Payment details are not set up yet. To donate now, email <a href="mailto:' + CONTACT + '">' + CONTACT + '</a>.</p></div>' : payCard()) +
      mineCard() + adminCard() +
      '<div class="card"><div class="hint">Donations are non-refundable and a thank-you, not a purchase. See section 9 of the <a data-go="tos" style="cursor:pointer;">Terms of Service</a>. Questions? Email <a href="mailto:' + CONTACT + '">' + CONTACT + '</a>.</div></div>';
    wire();
  }

  function wire(){
    scr.querySelectorAll('.dn-copy').forEach(function(b){
      b.onclick = function(){
        var t = b.getAttribute('data-c');
        function ok(){ var o = b.textContent; b.textContent = 'Copied!'; setTimeout(function(){ b.textContent = o; }, 1500); }
        try{ navigator.clipboard.writeText(t).then(ok, function(){ window.prompt('Copy this:', t); }); }catch(e){ window.prompt('Copy this:', t); }
      };
    });
    var tos = scr.querySelector('[data-go=tos]'); if(tos) tos.onclick = function(){ if(typeof window.renderTerms === 'function') window.renderTerms(); };
    var kd = $('dnKind'); if(kd) kd.onchange = function(){ D.kind = kd.value; D.msg = ''; draw(); };
    var cn = $('dnCoin'); if(cn) cn.onchange = function(){ D.ci = +cn.value; D.msg = ''; draw(); };
    var ia = $('dnAmt'), ir = $('dnRef');
    if(ia) ia.oninput = function(){ D.amt = ia.value; };
    if(ir) ir.oninput = function(){ D.ref = ir.value; };
    var send = $('dnSend');
    if(send) send.onclick = function(){
      var msg = $('dnMsg'), ref = cleanRef($('dnRef').value), amt = $('dnAmt').value.trim(), method = methodName(), rule = refRule();
      if(!rule.ok(ref)){ msg.textContent = rule.bad; return; }
      if(D.mine.some(function(r){ return (r.ref || '').toLowerCase() === ref.toLowerCase(); })){ msg.textContent = 'You already sent this reference.'; return; }
      if(D.mine.filter(function(r){ return r.status === 'pending'; }).length >= 3){ msg.textContent = 'You already have 3 donations waiting. Please wait for them to be checked.'; return; }
      send.disabled = true; msg.textContent = 'Sending...';
      var id = db.ref('hb/donations/' + ME.username).push();
      id.set({user: ME.username, method: method, amount: amt, ref: ref, ts: firebase.database.ServerValue.TIMESTAMP, status: 'pending'})
        .then(function(){
          D.msg = 'Thank you! We will check it and switch on your donator name.'; D.ref = ''; D.amt = '';
          try{      // best effort ping to the site owner on Discord; the donation is already saved whatever happens here
            if(DONATE_NOTIFY_URL) firebase.auth().currentUser.getIdToken().then(function(tok){
              fetch(DONATE_NOTIFY_URL, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({token:tok, id:id.key})}).catch(function(){});
            });
          }catch(e){}
          return loadMine();
        })
        .catch(function(){ send.disabled = false; msg.textContent = 'Could not send. Check your connection, or email ' + CONTACT + '.'; });
    };
    scr.querySelectorAll('[data-a]').forEach(function(b){
      b.onclick = function(){
        var row = b.closest('[data-id]'), id = row.getAttribute('data-id'), r = D.pending.filter(function(x){ return x.id === id; })[0], m = $('dnAdm');
        if(!r) return;
        var ok = b.getAttribute('data-a') === 'ok';
        b.disabled = true;
        var tasks = [db.ref('hb/donations/' + r.user + '/' + id).update({status: ok ? 'approved' : 'rejected', by: ME.username, at: firebase.database.ServerValue.TIMESTAMP})];
        if(ok) tasks.push(db.ref('hb/donors/' + r.user + '/on').set(true));
        Promise.all(tasks).then(function(){ m.textContent = ok ? (r.user + ' is now a donator.') : 'Marked as not matched.'; return loadPending(); })
          .catch(function(){ b.disabled = false; m.textContent = 'Could not save (permission). If approving fails, set hb/donors/' + r.user + '/on to true in the Firebase console.'; });
      };
    });
  }

  function loadMine(){
    if(!loggedIn()) { D.mine = []; draw(); return Promise.resolve(); }
    return db.ref('hb/donations/' + ME.username).limitToLast(10).once('value').then(function(s){
      var o = []; s.forEach(function(c){ var v = c.val(); if(v){ v.id = c.key; o.push(v); } });
      o.sort(function(a, b){ return (b.ts || 0) - (a.ts || 0); }); D.mine = o; draw();
    }).catch(function(){ draw(); });
  }
  function loadPending(){
    if(!isAdmin()) return Promise.resolve();
    // requests live at hb/donations/<username>/<id>; staff read the whole node (there are few) and keep the waiting ones
    return db.ref('hb/donations').once('value').then(function(s){
      var o = []; s.forEach(function(u){ u.forEach(function(c){ var v = c.val(); if(v && v.status === 'pending'){ v.id = c.key; o.push(v); } }); });
      o.sort(function(a, b){ return (a.ts || 0) - (b.ts || 0); }); D.pending = o; paintNav(); draw();
    }).catch(function(){ draw(); });
  }

  // ---------- show / hide, nav, footer, address ----------
  window.renderDonate = function(){
    if(typeof stopPoll === 'function') stopPoll();
    showScreen('donate'); D.msg = '';
    try{ PW.replace('#/donate'); }catch(e){}
    draw(); loadMine(); loadPending();
    window.scrollTo(0, 0);
  };
  var prevShow = window.showScreen;
  window.showScreen = function(n){
    prevShow(n);
    scr.style.display = (n === 'donate') ? 'block' : 'none';
    if(n === 'donate') nav.querySelectorAll('[data-nav]').forEach(function(a){ a.classList.toggle('active', a.dataset.nav === 'donate'); });
    if(n === 'donate' && !loggedIn()) nav.style.display = 'none';
  };
  function inActiveGame(){
    var s = $('screen-game');
    return !!s && s.style.display === 'block' && typeof gameState !== 'undefined' && !!gameState && gameState.status === 'active';
  }
  function open(){
    if(loggedIn() && inActiveGame() && !confirm('Your clock keeps running while you are away. Leave the game view?')) return;
    window.renderDonate();
  }
  link.onclick = open;
  var foot = $('pnFooter');
  if(foot){
    var sep = document.createElement('span'); sep.className = 'sep'; sep.innerHTML = '&middot;';
    var a = document.createElement('a'); a.textContent = 'Donate'; a.style.cursor = 'pointer'; a.onclick = open;
    foot.appendChild(sep); foot.appendChild(a);
  }
  var RT = /^#\/donate\/?$/i;
  window.addEventListener('hashchange', function(){ if(RT.test(PW.hash()) && scr.style.display !== 'block') open(); });
  var boot = true, prevAfter = window.afterAuth;
  if(typeof prevAfter === 'function') window.afterAuth = async function(){
    var h = boot ? PW.hash() : ''; boot = false;
    var r = await prevAfter.apply(this, arguments);
    try{ var gs = $('screen-game'); if(RT.test(h) && !(gs && gs.style.display === 'block')) window.renderDonate(); else if(isAdmin()) loadPending(); }catch(e){ console.error(e); }
    return r;
  };
})();
