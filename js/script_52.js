/* PAWNIAC STEP 53: DONATOR NAME COLOUR
   - a donator picks two colours in Settings; their name shows that gradient everywhere, with a "Donator" tooltip
   - who is a donator: YOU set hb/donors/<username>/on = true in the Firebase console (users can't set it themselves)
   - the colours live at hb/donors/<username>/c1 and c2 (see the rules in donor-rules.json) */
(function(){
  var HEX = /^#[0-9a-fA-F]{6}$/;
  var DONORS = Object.create(null);      // username -> {on, c1, c2}
  var started = false, timer = null, screen = null;

  var css = ''
  + '.dn-grad{background-image:linear-gradient(90deg,var(--dn1),var(--dn2));-webkit-background-clip:text;background-clip:text;'
  + 'color:transparent;-webkit-text-fill-color:transparent;-webkit-box-decoration-break:clone;box-decoration-break:clone;}'
  + '#donorCard .dn-chip{width:56px;height:30px;padding:0;border:0;border-radius:8px;cursor:pointer;}'
  + '#donorCard .dn-chip:focus-visible{outline:3px solid currentColor;outline-offset:2px;}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function on(name){ var d = DONORS[name]; return !!(d && d.on === true); }

  // ---------- put the gradient on names ----------
  function styleSpan(sp, d){
    if(d && HEX.test(d.c1 || '') && HEX.test(d.c2 || '')){
      sp.className = 'dn-grad'; sp.style.setProperty('--dn1', d.c1); sp.style.setProperty('--dn2', d.c2);
    } else {
      sp.className = 'dn-tag'; sp.style.removeProperty('--dn1'); sp.style.removeProperty('--dn2');
    }
    sp.title = 'Donator';
  }
  function wrap(tn, name){
    var i = tn.nodeValue.indexOf(name); if(i < 0) return;
    var mid = i > 0 ? tn.splitText(i) : tn;
    if(mid.nodeValue.length > name.length) mid.splitText(name.length);
    var sp = document.createElement('span');
    sp.setAttribute('data-dn', name); sp.textContent = name; styleSpan(sp, DONORS[name]);
    mid.parentNode.replaceChild(sp, mid);
  }
  function apply(){
    // 1) refresh or remove names already wrapped
    document.querySelectorAll('[data-dn]').forEach(function(sp){
      var n = sp.getAttribute('data-dn');
      if(on(n)) styleSpan(sp, DONORS[n]); else sp.replaceWith(document.createTextNode(sp.textContent));
    });
    if(!Object.keys(DONORS).some(on)) return;
    // 2) find plain-text names: elements marked data-user, or text that is exactly a donator's name
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {acceptNode: function(n){
      var p = n.parentNode; if(!p || !p.nodeName) return NodeFilter.FILTER_REJECT;
      if(/^(SCRIPT|STYLE|TEXTAREA|INPUT|OPTION|TITLE)$/.test(p.nodeName)) return NodeFilter.FILTER_REJECT;
      if(p.closest && (p.closest('[data-dn]') || p.closest('[data-dn-skip]'))) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }});
    var hits = [], n;
    while((n = w.nextNode())){
      var v = n.nodeValue; if(v.length > 400) continue;
      var t = v.trim(); if(!t) continue;
      if(on(t)){ hits.push([n, t]); continue; }
      var h = n.parentNode.closest && n.parentNode.closest('[data-user]');
      if(h){ var u = h.getAttribute('data-user'); if(u && on(u) && v.indexOf(u) >= 0) hits.push([n, u]); }
    }
    hits.forEach(function(x){ wrap(x[0], x[1]); });
  }
  function schedule(){ clearTimeout(timer); timer = setTimeout(apply, 120); }

  // ---------- the Settings card (donators only) ----------
  function hexNorm(s){
    s = (s || '').trim().replace(/^#/, '');
    if(/^[0-9a-fA-F]{3}$/.test(s)) s = s.split('').map(function(c){ return c + c; }).join('');
    return /^[0-9a-fA-F]{6}$/.test(s) ? '#' + s.toLowerCase() : null;
  }
  function lum(h){
    var c = [1, 3, 5].map(function(i){ var v = parseInt(h.substr(i, 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  var PRESETS = [
    ['Sunset', '#ff5f6d', '#ffc371'], ['Ocean', '#00c6ff', '#0072ff'], ['Aurora', '#00e5a8', '#4aa8ff'],
    ['Berry', '#c471ed', '#f64f59'], ['Gold', '#f7b733', '#fc4a1a'], ['Lime', '#a8e063', '#1fa971']
  ];
  function me(){ return (typeof ME !== 'undefined' && ME && ME.username) ? ME.username : null; }

  function mountCard(){
    screen = screen || document.getElementById('screen-settings'); if(!screen) return;
    var old = document.getElementById('donorCard'), u = me();
    if(!u || !on(u)){ if(old) old.remove(); return; }
    if(old) return;
    var d = DONORS[u], c1 = HEX.test(d.c1) ? d.c1 : '#ff5f6d', c2 = HEX.test(d.c2) ? d.c2 : '#ffc371';
    var card = document.createElement('div'); card.className = 'card'; card.id = 'donorCard';
    card.innerHTML =
      '<h2>Donator name colour</h2>' +
      '<p class="desc">Thank you for supporting Pawniac! Pick two colours. Your name shows this gradient to everyone, everywhere on the site.</p>' +
      '<div data-dn-skip style="font-size:26px;font-weight:700;margin:6px 0 16px"><span id="dnPrev" class="dn-grad" title="Donator"></span></div>' +
      '<div class="set-row"><div class="set-label">Colour 1</div><div class="set-ctl"><input type="color" id="dnP1"> <input type="text" id="dnH1" maxlength="7" placeholder="#ff5f6d" style="width:110px" autocomplete="off"></div></div>' +
      '<div class="set-row"><div class="set-label">Colour 2</div><div class="set-ctl"><input type="color" id="dnP2"> <input type="text" id="dnH2" maxlength="7" placeholder="#ffc371" style="width:110px" autocomplete="off"></div></div>' +
      '<div class="hint" style="margin-top:12px">Presets</div><div id="dnPresets" style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 16px"></div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap"><button type="button" id="dnSave">Save</button><button type="button" class="secondary" id="dnClear">Remove colours</button></div>' +
      '<div class="hint" id="dnMsg" aria-live="polite" style="min-height:1.4em;margin-top:10px"></div>';
    screen.insertBefore(card, screen.lastElementChild);

    var prev = card.querySelector('#dnPrev'), p1 = card.querySelector('#dnP1'), p2 = card.querySelector('#dnP2'),
        h1 = card.querySelector('#dnH1'), h2 = card.querySelector('#dnH2'), msg = card.querySelector('#dnMsg');
    prev.textContent = u;
    function set(which, v){ (which === 1 ? p1 : p2).value = v; (which === 1 ? h1 : h2).value = v; }
    function paint(){
      var a = hexNorm(h1.value), b = hexNorm(h2.value);
      if(a && b){ prev.style.setProperty('--dn1', a); prev.style.setProperty('--dn2', b); }
      var w = [a, b].filter(Boolean).map(lum), note = '';
      if(w.length && Math.min.apply(null, w) < 0.05) note = 'Heads up: a very dark colour can be hard to read in dark mode.';
      else if(w.length && Math.max.apply(null, w) > 0.85) note = 'Heads up: a very light colour can be hard to read in light mode.';
      msg.textContent = note;
    }
    set(1, c1); set(2, c2); paint();
    [[p1, h1], [p2, h2]].forEach(function(pair){
      pair[0].oninput = function(){ pair[1].value = pair[0].value; paint(); };
      pair[1].oninput = function(){ var v = hexNorm(pair[1].value); if(v) pair[0].value = v; paint(); };
    });
    var box = card.querySelector('#dnPresets');
    PRESETS.forEach(function(p){
      var b = document.createElement('button'); b.type = 'button'; b.className = 'dn-chip'; b.title = p[0]; b.setAttribute('aria-label', p[0]);
      b.style.backgroundImage = 'linear-gradient(90deg,' + p[1] + ',' + p[2] + ')';
      b.onclick = function(){ set(1, p[1]); set(2, p[2]); paint(); };
      box.appendChild(b);
    });
    card.querySelector('#dnSave').onclick = function(){
      var a = hexNorm(h1.value), b = hexNorm(h2.value);
      if(!a || !b){ msg.textContent = 'Enter both colours as hex codes, like #ff8800.'; return; }
      set(1, a); set(2, b);
      db.ref('hb/donors/' + u).update({c1: a, c2: b})
        .then(function(){ msg.textContent = 'Saved. Everyone will see your new colours.'; })
        .catch(function(){ msg.textContent = 'Could not save. Check your connection and try again.'; });
    };
    card.querySelector('#dnClear').onclick = function(){
      db.ref('hb/donors/' + u).update({c1: null, c2: null})
        .then(function(){ msg.textContent = 'Colours removed.'; })
        .catch(function(){ msg.textContent = 'Could not remove. Try again.'; });
    };
  }

  // ---------- start once Firebase and the settings screen exist ----------
  function start(){
    if(started) return true;
    if(typeof db === 'undefined' || !db) return false;
    started = true;
    db.ref('hb/donors').on('value', function(s){
      var v = s.val() || {}; DONORS = Object.create(null);
      Object.keys(v).forEach(function(k){
        var o = v[k]; if(!o || typeof o !== 'object') return;
        DONORS[k] = {on: o.on === true, c1: typeof o.c1 === 'string' ? o.c1 : '', c2: typeof o.c2 === 'string' ? o.c2 : ''};
      });
      apply(); mountCard();
    }, function(err){ console.warn('Donator colours: could not read hb/donors', err); });
    return true;
  }
  var tries = 0, iv = setInterval(function(){
    screen = screen || document.getElementById('screen-settings');
    if(screen && !screen.__dn){ screen.__dn = true; new MutationObserver(mountCard).observe(screen, {childList: true}); }
    if(start() && screen) clearInterval(iv);
    if(++tries > 150) clearInterval(iv);
  }, 300);
  new MutationObserver(schedule).observe(document.body, {childList: true, subtree: true});
})();
