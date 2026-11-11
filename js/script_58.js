/* Pawniac: custom background, saved only on this device.
 * The picture never leaves the player's browser (it goes into IndexedDB, nothing is uploaded), so nobody else can see it
 * and there is nothing to moderate. Settings has a card to choose / remove it and set how dark and how blurred it is.
 */
(function(){
  var SKEY = 'pawniac-bg', DB_NAME = 'pawniac-bg', STORE = 'img', MAX_FILE = 12 * 1024 * 1024, MAX_SIDE = 1920;
  // box: 'solid' (the normal look) or 'match' (cards blend into the picture). tint = [r,g,b] average of the picture, used to judge how bright it is.
  var S = {on:true, dim:55, blur:0, box:'solid', tint:null};
  try{ var raw = localStorage.getItem(SKEY); if(raw) Object.assign(S, JSON.parse(raw)); }catch(e){}
  if(S.box !== 'solid') S.box = 'match';   // the earlier see-through option became part of "match"

  function saveS(){ try{ localStorage.setItem(SKEY, JSON.stringify(S)); }catch(e){} }
  var url = null, blob = null, memoryOnly = false;

  // ---------- storage (IndexedDB, with an in-memory fallback for private windows) ----------
  function open(){
    return new Promise(function(res, rej){
      try{
        var r = indexedDB.open(DB_NAME, 1);
        r.onupgradeneeded = function(){ r.result.createObjectStore(STORE); };
        r.onsuccess = function(){ res(r.result); };
        r.onerror = function(){ rej(r.error); };
      }catch(e){ rej(e); }
    });
  }
  function idb(mode, fn){
    return open().then(function(db){
      return new Promise(function(res, rej){
        var tx = db.transaction(STORE, mode), out = fn(tx.objectStore(STORE));
        tx.oncomplete = function(){ db.close(); res(out && out.result); };
        tx.onerror = tx.onabort = function(){ db.close(); rej(tx.error); };
      });
    });
  }
  function load(){ return idb('readonly', function(st){ return st.get('bg'); }); }
  function store(b){ return idb('readwrite', function(st){ return st.put(b, 'bg'); }); }
  function wipe(){ return idb('readwrite', function(st){ return st.delete('bg'); }); }

  // ---------- the background layer ----------
  var css = document.createElement('style');
  css.textContent =
    '#pwBg{position:fixed;inset:0;z-index:-1;pointer-events:none;overflow:hidden;display:none;}' +
    '#pwBg .i{position:absolute;inset:-30px;background-size:cover;background-position:center;background-repeat:no-repeat;}' +
    '#pwBg .d{position:absolute;inset:0;background:#f4f1ea;}' +
    '[data-theme=dark] #pwBg .d{background:#16140f;}' +
    'html.pw-bg body::before,html.pw-bg #screen-auth::before{display:none;}' +
    // text that sits straight on the picture (the footer) gets a soft backing so it stays readable on any image
    'html.pw-bg #pnFooter{background:#f4f1ea;border-radius:10px;padding:8px 14px;width:fit-content;max-width:calc(100% - 32px);margin-left:auto;margin-right:auto;}' +
    'html[data-theme=dark].pw-bg #pnFooter{background:#16140f;}' +
    // "Boxes" = match: cards stop being solid panels. The picture shows straight through (no blur, so no smudges), with just a
    // little of the same dimming the page already has, and the buttons / chips inside them follow along.
    'html.pw-bg.pw-box .card,html.pw-bg.pw-box .navbar{background:var(--pw-box);border-color:var(--pw-box-line);box-shadow:none;}' +
    'html.pw-bg.pw-box .modebtn:not(.active),html.pw-bg.pw-box .tcbtn:not(.active),html.pw-bg.pw-box .seat,html.pw-bg.pw-box .clock:not(.active),html.pw-bg.pw-box button.secondary{background:var(--pw-box-in);border-color:var(--pw-box-line);}' +
    // text boxes, the selected (green) tiles / chips and the footer follow along too
    'html.pw-bg.pw-box input[type=text],html.pw-bg.pw-box input[type=email],html.pw-bg.pw-box input[type=password],html.pw-bg.pw-box input[type=number],html.pw-bg.pw-box textarea{background:var(--pw-box-in);border-color:var(--pw-box-line);}' +
    'html.pw-bg.pw-box .modebtn.active,html.pw-bg.pw-box .tcbtn.active{background:var(--pw-act);}' +
    'html.pw-bg.pw-box .code-display,html.pw-bg.pw-box .announce:not(.empty){background:var(--pw-box-in);}' +
    'html.pw-bg.pw-box #pnFooter,html[data-theme=dark].pw-bg.pw-box #pnFooter{background:var(--pw-box);}' +
    'html.pw-bg.pw-box button.secondary:hover,html.pw-bg.pw-box .modebtn:not(.active):hover,html.pw-bg.pw-box .tcbtn:not(.active):hover{background:var(--pw-box);}' +
    '#bgCard .bg-prev{width:100%;height:110px;border-radius:8px;border:1px solid rgba(128,128,128,.3);background-size:cover;background-position:center;margin:6px 0 12px;}' +
    '#bgCard .bg-none{display:flex;align-items:center;justify-content:center;font-size:13px;opacity:.7;}' +
    '#bgCard input[type=range]{width:150px;accent-color:#1f6f5c;}' +
    '#bgCard select{font:inherit;font-size:13.5px;padding:8px 10px;border-radius:7px;border:1px solid rgba(128,128,128,.4);background:transparent;color:inherit;}' +
    '#bgCard select option{color:#22201b;background:#fffdf9;}' +
    '#bgCard .bg-btns{display:flex;gap:10px;flex-wrap:wrap;margin:4px 0 10px;}';
  document.head.appendChild(css);
  var layer = document.createElement('div');
  layer.id = 'pwBg';
  layer.innerHTML = '<div class="i"></div><div class="d"></div>';
  document.body.appendChild(layer);

  // average colour of the picture, from a tiny copy of it
  function findTint(){
    return new Promise(function(res){
      if(!url){ res(null); return; }
      var img = new Image();
      img.onload = function(){
        try{
          var c = document.createElement('canvas'); c.width = c.height = 16;
          var g = c.getContext('2d'); g.drawImage(img, 0, 0, 16, 16);
          var d = g.getImageData(0, 0, 16, 16).data, r = 0, gr = 0, b = 0, n = d.length / 4;
          for(var i = 0; i < d.length; i += 4){ r += d[i]; gr += d[i + 1]; b += d[i + 2]; }
          res([Math.round(r / n), Math.round(gr / n), Math.round(b / n)]);
        }catch(e){ res(null); }
      };
      img.onerror = function(){ res(null); };
      img.src = url;
    });
  }
  function lum(c){ return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255; }
  // Same colour the page dims the picture with, a bit stronger on bright pictures (dark theme) / dark pictures (light theme) so text stays readable
  function boxColours(){
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    var base = dark ? '22,20,15' : '244,241,234';
    var L = S.tint ? lum(S.tint) : 0.5;
    var a = Math.min(0.72, 0.28 + 0.4 * (dark ? L : 1 - L));
    var st = document.documentElement.style;
    st.setProperty('--pw-box', 'rgba(' + base + ',' + a.toFixed(2) + ')');
    st.setProperty('--pw-box-in', 'rgba(' + base + ',' + (a * 0.55).toFixed(2) + ')');
    st.setProperty('--pw-act', 'rgba(31,111,92,' + (dark ? 0.42 : 0.2) + ')');
    st.setProperty('--pw-box-line', dark ? 'rgba(255,255,255,.16)' : 'rgba(0,0,0,.13)');
  }

  function apply(){
    var on = !!(url && S.on);
    document.documentElement.classList.toggle('pw-bg', on);
    document.documentElement.classList.toggle('pw-box', on && S.box !== 'solid');
    layer.style.display = on ? 'block' : 'none';
    if(!on) return;
    if(S.box !== 'solid') boxColours();
    var i = layer.querySelector('.i'), d = layer.querySelector('.d');
    i.style.backgroundImage = 'url("' + url + '")';
    i.style.filter = S.blur ? 'blur(' + S.blur + 'px)' : 'none';
    d.style.opacity = String(Math.max(0, Math.min(0.9, S.dim / 100)));
  }
  function setBlob(b){
    if(url){ try{ URL.revokeObjectURL(url); }catch(e){} }
    blob = b; url = b ? URL.createObjectURL(b) : null;
    apply();
    var mine = url;
    findTint().then(function(t){ if(url !== mine) return; S.tint = t; saveS(); apply(); });
  }
  // light / dark switch: recolour the boxes
  new MutationObserver(function(){ if(S.box !== 'solid') apply(); }).observe(document.documentElement, {attributes:true, attributeFilter:['data-theme']});

  // ---------- turning a chosen file into a reasonably small picture ----------
  function shrink(file){
    return new Promise(function(res, rej){
      if(!/^image\/(png|jpeg|webp)$/.test(file.type)){ rej(new Error('Please choose a PNG, JPG or WebP picture.')); return; }
      if(file.size > MAX_FILE){ rej(new Error('That picture is too big. Please choose one under 12 MB.')); return; }
      var img = new Image(), src = URL.createObjectURL(file);
      img.onload = function(){
        try{
          var w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, MAX_SIDE / Math.max(w, h));
          var c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          URL.revokeObjectURL(src);
          c.toBlob(function(b){ b ? res(b) : rej(new Error('Could not read that picture.')); }, 'image/jpeg', 0.85);
        }catch(e){ rej(new Error('Could not read that picture.')); }
      };
      img.onerror = function(){ URL.revokeObjectURL(src); rej(new Error('Could not read that picture.')); };
      img.src = src;
    });
  }

  // ---------- Settings page card ----------
  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function draw(card, msg){
    card.innerHTML =
      '<h2>Background</h2><p class="desc">Your own picture behind the site. It is saved only on this device: it is never uploaded and nobody else can see it.</p>' +
      (url ? '<div class="bg-prev" style="background-image:url(\'' + url + '\')"></div>' : '<div class="bg-prev bg-none">No picture chosen</div>') +
      '<div class="bg-btns"><button id="bgPick" type="button">' + (url ? 'Change picture' : 'Choose picture') + '</button>' +
      (url ? '<button id="bgRemove" type="button">Remove</button>' : '') +
      '<input type="file" id="bgFile" accept="image/png,image/jpeg,image/webp" style="display:none"></div>' +
      '<div class="hint" id="bgMsg" style="min-height:18px;' + (msg && msg.bad ? 'color:#d62d2d;' : '') + '">' + (msg ? esc(msg.text) : (memoryOnly && url ? 'Private window: this picture will be forgotten when you close it.' : '')) + '</div>' +
      (url ?
        '<div class="set-row"><div><div class="set-label">Use my background</div></div><div class="set-ctl"><label class="switch"><input type="checkbox" id="bgOn"' + (S.on ? ' checked' : '') + '><span></span></label></div></div>' +
        '<div class="set-row"><div><div class="set-label">Darken</div><div class="hint">Higher = easier to read the site</div></div><div class="set-ctl"><input type="range" id="bgDim" min="0" max="90" value="' + S.dim + '"></div></div>' +
        '<div class="set-row"><div><div class="set-label">Blur</div></div><div class="set-ctl"><input type="range" id="bgBlur" min="0" max="20" value="' + S.blur + '"></div></div>' +
        '<div class="set-row"><div><div class="set-label">Boxes</div><div class="hint">Match = cards blend into your picture instead of sitting on it as solid boxes</div></div><div class="set-ctl"><select id="bgBox">' +
          [['solid', 'Solid'], ['match', 'Match my picture']].map(function(o){ return '<option value="' + o[0] + '"' + (S.box === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
        '</select></div></div>' : '');
    var file = card.querySelector('#bgFile');
    card.querySelector('#bgPick').onclick = function(){ file.click(); };
    file.onchange = function(){
      var f = file.files && file.files[0]; if(!f) return;
      draw(card, {text:'Working...'});
      shrink(f).then(function(b){
        setBlob(b); S.on = true; saveS();
        return store(b).then(function(){ memoryOnly = false; }, function(){ memoryOnly = true; });
      }).then(function(){ draw(card, {text:'Background saved on this device.'}); })
        .catch(function(e){ draw(card, {text:e.message || 'Could not use that picture.', bad:true}); });
    };
    var rm = card.querySelector('#bgRemove');
    if(rm) rm.onclick = function(){
      setBlob(null); wipe().catch(function(){});
      draw(card, {text:'Background removed.'});
    };
    var on = card.querySelector('#bgOn'), dim = card.querySelector('#bgDim'), bl = card.querySelector('#bgBlur');
    if(on) on.onchange = function(){ S.on = on.checked; saveS(); apply(); };
    if(dim) dim.oninput = function(){ S.dim = +dim.value; saveS(); apply(); };
    if(bl) bl.oninput = function(){ S.blur = +bl.value; saveS(); apply(); };
    var bx = card.querySelector('#bgBox');
    if(bx) bx.onchange = function(){
      S.box = bx.value; saveS(); apply();
      if(S.box === 'match' && !S.tint) findTint().then(function(t){ S.tint = t; saveS(); apply(); });
    };
  }
  function addCard(){
    var scr = document.getElementById('screen-settings');
    if(!scr || !scr.firstElementChild || scr.querySelector('#bgCard')) return;
    var card = document.createElement('div');
    card.className = 'card'; card.id = 'bgCard';
    var reset = document.getElementById('setReset'), host = reset && reset.closest('.card');
    if(host) scr.insertBefore(card, host); else scr.appendChild(card);
    draw(card);
  }
  var scr0 = document.getElementById('screen-settings');
  if(scr0) new MutationObserver(addCard).observe(scr0, {childList:true});

  // ---------- on page load ----------
  load().then(function(b){ if(b) setBlob(b); }).catch(function(){ memoryOnly = true; });
  window.PawniacBackground = {_state:function(){ return {S:S, has:!!url}; }};
})();
