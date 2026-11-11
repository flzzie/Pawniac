/* Pawniac: custom background, saved only on this device.
 * The picture never leaves the player's browser (it goes into IndexedDB, nothing is uploaded), so nobody else can see it
 * and there is nothing to moderate. Settings has a card to choose / remove it and set how dark and how blurred it is.
 */
(function(){
  var SKEY = 'pawniac-bg', DB_NAME = 'pawniac-bg', STORE = 'img', MAX_FILE = 12 * 1024 * 1024, MAX_SIDE = 1920;
  var S = {on:true, dim:40, blur:0};
  try{ var raw = localStorage.getItem(SKEY); if(raw) Object.assign(S, JSON.parse(raw)); }catch(e){}
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
    '#bgCard .bg-prev{width:100%;height:110px;border-radius:8px;border:1px solid rgba(128,128,128,.3);background-size:cover;background-position:center;margin:6px 0 12px;}' +
    '#bgCard .bg-none{display:flex;align-items:center;justify-content:center;font-size:13px;opacity:.7;}' +
    '#bgCard input[type=range]{width:150px;}' +
    '#bgCard .bg-btns{display:flex;gap:10px;flex-wrap:wrap;margin:4px 0 10px;}';
  document.head.appendChild(css);
  var layer = document.createElement('div');
  layer.id = 'pwBg';
  layer.innerHTML = '<div class="i"></div><div class="d"></div>';
  document.body.appendChild(layer);

  function apply(){
    var on = !!(url && S.on);
    document.documentElement.classList.toggle('pw-bg', on);
    layer.style.display = on ? 'block' : 'none';
    if(!on) return;
    var i = layer.querySelector('.i'), d = layer.querySelector('.d');
    i.style.backgroundImage = 'url("' + url + '")';
    i.style.filter = S.blur ? 'blur(' + S.blur + 'px)' : 'none';
    d.style.opacity = String(Math.max(0, Math.min(0.9, S.dim / 100)));
  }
  function setBlob(b){
    if(url){ try{ URL.revokeObjectURL(url); }catch(e){} }
    blob = b; url = b ? URL.createObjectURL(b) : null;
    apply();
  }

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
        '<div class="set-row"><div><div class="set-label">Blur</div></div><div class="set-ctl"><input type="range" id="bgBlur" min="0" max="20" value="' + S.blur + '"></div></div>' : '');
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
