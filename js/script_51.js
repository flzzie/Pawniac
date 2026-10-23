/* PAWNIAC STEP 52: SUPPORTERS PAGE at pawniac.fun/#/supporters, linked from the footer (not the nav bar) */
(function(){
  // ========  ========
  var SHEET_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ8mNyFPJO7yTmQg4-EpRFV1vmlzRNBR1fQF2_QANGG7h1_bc5Ea8OKZJ8P0RiKyAlOkkyKCQ-80OE3/pub?gid=171644938&single=true&output=csv';
  var CONTACT   = 'support@pawniac.fun';              
  var DEADLINE  = new Date(2026, 11, 31, 23, 59, 59); // Founding cutoff: Dec 31, 2026
  var BACKUP    = [];                                 // shown only if the sheet can't load
  // ============================

  var ROUTE = '#/supporters';
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  var css = ''
  + '#sup{--bg:#f6f1e6;--card:#fffdf7;--ink:#2b2823;--muted:#6d675b;--line:#e4ddcf;--accent:#1f6f5c;--accent-ink:#fff;--gold:#a9741b;--gold-bg:#f7e9c8;'
  + 'position:fixed;inset:0;z-index:100000;overflow-y:auto;background:var(--bg);color:var(--ink);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.55;text-align:left;}'
  + 'html[data-theme="dark"] #sup{--bg:#1d1b18;--card:#26231f;--ink:#efe9dc;--muted:#a39c8c;--line:#3a372f;--accent:#4fb59a;--accent-ink:#10231d;--gold:#e8be6a;--gold-bg:#3b3220;}'
  + '@media (prefers-color-scheme: dark){html:not([data-theme]) #sup{--bg:#1d1b18;--card:#26231f;--ink:#efe9dc;--muted:#a39c8c;--line:#3a372f;--accent:#4fb59a;--accent-ink:#10231d;--gold:#e8be6a;--gold-bg:#3b3220;}}'
  + '#sup[hidden]{display:none;} #sup *{box-sizing:border-box;}'
  + '#sup .sp-main{max-width:860px;margin:0 auto;padding:32px 20px 72px;}'
  + '#sup a.sp-back{display:inline-block;margin:0 0 28px;color:var(--muted);text-decoration:none;font-size:15px;cursor:pointer;}'
  + '#sup a.sp-back:hover{color:var(--ink);}'
  + '#sup h1.sp-h1{font-family:Georgia,"Iowan Old Style","Times New Roman",serif;font-size:clamp(36px,6vw,54px);line-height:1.05;letter-spacing:-1px;margin:0 0 14px;color:var(--ink);font-weight:700;'
  + 'text-decoration:underline;text-decoration-color:var(--accent);text-decoration-thickness:5px;text-underline-offset:9px;}'
  + '#sup p.sp-lead{font-size:18px;color:var(--muted);margin:0 0 28px;max-width:52ch;}'
  + '#sup .sp-banner{display:inline-flex;align-items:center;gap:8px;padding:9px 16px;border-radius:999px;background:var(--gold-bg);color:var(--gold);font-weight:600;font-size:15px;margin-bottom:40px;}'
  + '#sup .sp-banner[hidden]{display:none;}'
  + '#sup h2.sp-h2{font-family:Georgia,"Iowan Old Style",serif;font-size:24px;margin:0 0 16px;color:var(--ink);font-weight:700;}'
  + '#sup .sp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px;margin-bottom:44px;}'
  + '#sup .sp-card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:20px;display:flex;flex-direction:column;gap:10px;}'
  + '#sup .sp-logo{width:48px;height:48px;border-radius:50%;background:var(--accent);color:var(--accent-ink);display:flex;align-items:center;justify-content:center;font:700 22px Georgia,serif;overflow:hidden;}'
  + '#sup .sp-logo img{width:100%;height:100%;object-fit:cover;display:block;}'
  + '#sup .sp-name{color:var(--ink);font-weight:700;font-size:18px;}'
  + '#sup a.sp-name{text-decoration:none;border-bottom:2px solid var(--line);align-self:flex-start;}'
  + '#sup a.sp-name:hover{border-color:var(--accent);}'
  + '#sup a:focus-visible{outline:3px solid var(--accent);outline-offset:3px;}'
  + '#sup .sp-tag{align-self:flex-start;font-size:13px;font-weight:700;color:var(--gold);background:var(--gold-bg);padding:3px 10px;border-radius:999px;}'
  + '#sup .sp-desc{margin:0;font-size:15px;color:var(--muted);display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2;overflow:hidden;}'
  + '#sup .sp-since{font-size:14px;color:var(--muted);}'
  + '#sup .sp-card.sp-empty{border-style:dashed;background:transparent;justify-content:center;text-align:center;color:var(--muted);}'
  + '#sup .sp-empty b{color:var(--ink);display:block;font-size:17px;margin-bottom:4px;}'
  + '#sup .sp-cta{border-top:1px solid var(--line);padding-top:28px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;}'
  + '#sup .sp-cta p{margin:0;font-size:17px;}'
  + '#sup .sp-cta a{background:var(--accent);color:var(--accent-ink);font-weight:600;padding:12px 22px;border-radius:10px;text-decoration:none;}'
  + '#sup .sp-cta a:hover{filter:brightness(1.06);}'
  + '#sup p.sp-note{font-size:14px;color:var(--muted);margin:20px 0 0;}';

  var style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  // ---- data helpers: only https links and your own logos/ folder are accepted from the sheet ----
  function safeUrl(u){ return /^https:\/\//i.test(u || '') ? u.trim() : ''; }
  function safeLogo(u){ u = (u || '').trim(); return (/^https:\/\//i.test(u) || (/^logos\/[\w.\-\/]+$/.test(u) && u.indexOf('..') < 0)) ? u : ''; }
  function parseDate(s){
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((s || '').trim());
    if(!m) return null;
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    return d.getMonth() === +m[2] - 1 ? d : null;
  }
  function parseCSV(t){
    var rows = [], row = [], f = '', q = false;
    for(var i = 0; i < t.length; i++){
      var c = t[i];
      if(q){ if(c === '"'){ if(t[i+1] === '"'){ f += '"'; i++; } else q = false; } else f += c; }
      else if(c === '"') q = true;
      else if(c === ','){ row.push(f); f = ''; }
      else if(c === '\n' || c === '\r'){ if(c === '\r' && t[i+1] === '\n') i++; row.push(f); f = ''; rows.push(row); row = []; }
      else f += c;
    }
    if(f !== '' || row.length){ row.push(f); rows.push(row); }
    return rows;
  }
  function fromCSV(text){
    var rows = parseCSV(text), head = (rows.shift() || []).map(function(h){ return h.trim().toLowerCase(); }), out = [];
    rows.forEach(function(r){
      var o = {}; head.forEach(function(h, i){ o[h] = (r[i] || '').trim(); });
      if(o.name && parseDate(o.joined)) out.push(o);
      else if(o.name) console.warn('Supporters: row skipped (joined must look like 2026-11-02):', o.name);
    });
    return out;
  }

  // ---- the page ----
  var root = null, fEl, rEl, rSec, loaded = false, prevTitle = '';
  function el(tag, cls, text){ var e = document.createElement(tag); if(cls) e.className = cls; if(text != null) e.textContent = text; return e; }

  function card(c, founding){
    var d = parseDate(c.joined), box = el('div', 'sp-card');
    var logo = el('div', 'sp-logo'), lg = safeLogo(c.logo), initial = c.name.charAt(0).toUpperCase();
    if(lg){ var im = document.createElement('img'); im.src = lg; im.alt = ''; im.onerror = function(){ im.remove(); logo.textContent = initial; }; logo.appendChild(im); }
    else logo.textContent = initial;
    box.appendChild(logo);
    var url = safeUrl(c.url), name;
    if(url){ name = el('a', 'sp-name', c.name + ' \u2197'); name.href = url; name.target = '_blank'; name.rel = 'noopener noreferrer'; }
    else name = el('span', 'sp-name', c.name);
    box.appendChild(name);
    if(c.desc) box.appendChild(el('p', 'sp-desc', c.desc));
    if(founding) box.appendChild(el('span', 'sp-tag', '\u2605 Founding supporter'));
    box.appendChild(el('div', 'sp-since', (c.type ? c.type + ' \u00B7 ' : '') + 'Joined ' + months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear()));
    return box;
  }

  function render(list){
    fEl.textContent = ''; rEl.textContent = '';
    var later = 0, open = new Date() <= DEADLINE;
    list.slice().sort(function(a, b){ return parseDate(a.joined) - parseDate(b.joined); }).forEach(function(c){
      var isF = parseDate(c.joined) <= DEADLINE;          // founding is decided by the join date
      (isF ? fEl : rEl).appendChild(card(c, isF));
      if(!isF) later++;
    });
    rSec.hidden = !later;
    if(open){
      var e = el('div', 'sp-card sp-empty'), inner = el('div');
      inner.appendChild(el('b', null, 'Your community could be here'));
      inner.appendChild(document.createTextNode('Join before Dec 31 for the Founding tag.'));
      e.appendChild(inner); fEl.appendChild(e);
    }
  }

  function build(){
    root = el('div'); root.id = 'sup'; root.hidden = true;
    var main = el('div', 'sp-main');
    var back = el('a', 'sp-back', '\u2190 Back to Pawniac'); back.href = '#';
    back.onclick = function(e){ e.preventDefault(); close(true); };
    main.appendChild(back);
    main.appendChild(el('h1', 'sp-h1', 'Supporters'));
    main.appendChild(el('p', 'sp-lead', 'Chess communities helping Pawniac grow. Pawniac is free with no ads, and these communities are backing it early.'));
    var banner = el('div', 'sp-banner');
    if(new Date() <= DEADLINE){
      var days = Math.ceil((DEADLINE - new Date()) / 86400000);
      banner.textContent = '\u2605 Founding window closes Dec 31, 2026 \u00B7 ' + days + (days === 1 ? ' day left' : ' days left');
    } else banner.hidden = true;
    main.appendChild(banner);
    var fSec = el('section'); fSec.appendChild(el('h2', 'sp-h2', 'Founding supporters')); fEl = el('div', 'sp-grid'); fSec.appendChild(fEl); main.appendChild(fSec);
    rSec = el('section'); rSec.hidden = true; rSec.appendChild(el('h2', 'sp-h2', 'Supporters')); rEl = el('div', 'sp-grid'); rSec.appendChild(rEl); main.appendChild(rSec);
    var cta = el('div', 'sp-cta');
    cta.appendChild(el('p', null, 'Run a chess.com club, Discord server, Lichess team or subreddit? Get it on this page.'));
    var join = el('a', null, 'Message me'); join.href = CONTACT; if(/^https?:/i.test(CONTACT)){ join.target = '_blank'; join.rel = 'noopener noreferrer'; }
    cta.appendChild(join); main.appendChild(cta);
    main.appendChild(el('p', 'sp-note', 'Communities are listed in the order they joined. Founding supporters joined by Dec 31, 2026 and keep the tag permanently.'));
    root.appendChild(main); document.body.appendChild(root);
    render(BACKUP.filter(function(c){ return c.name && parseDate(c.joined); }));
  }

  function load(){
    if(loaded || !SHEET_CSV) return; loaded = true;
    fetch(SHEET_CSV + (SHEET_CSV.indexOf('?') < 0 ? '?' : '&') + 't=' + Math.floor(Date.now() / 60000))
      .then(function(r){ if(!r.ok) throw new Error(r.status); return r.text(); })
      .then(function(t){ render(fromCSV(t)); })
      .catch(function(err){ loaded = false; console.warn('Supporters: could not load the sheet, showing backup.', err); });
  }

  function show(){
    if(!root) build();
    if(!root.hidden) return;
    prevTitle = document.title; document.title = 'Supporters | Pawniac';
    root.hidden = false; root.scrollTop = 0;
    document.documentElement.style.overflow = 'hidden';
    load();
  }
  function hide(){
    if(!root || root.hidden) return;
    root.hidden = true; document.documentElement.style.overflow = '';
    if(prevTitle) document.title = prevTitle;
  }
  function close(updateUrl){
    if(updateUrl && location.hash.indexOf(ROUTE) === 0) history.pushState(null, '', location.pathname + location.search);
    hide();
  }
  function sync(){ if(location.hash.toLowerCase().indexOf(ROUTE) === 0) show(); else hide(); }

  window.addEventListener('hashchange', sync);
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && root && !root.hidden) close(true); });
  sync();

  // ---- footer link (next to Privacy Policy), re-added if the footer is rebuilt ----
  function addFooterLink(){
    if(document.getElementById('sup-footer-link')) return;
    var all = document.querySelectorAll('a'), priv = null;
    for(var i = 0; i < all.length; i++){ if(/^privacy policy$/i.test(all[i].textContent.trim())) priv = all[i]; }
    if(!priv) return;
    var a = document.createElement('a'); a.id = 'sup-footer-link'; a.href = ROUTE; a.textContent = 'Supporters'; a.className = priv.className;
    var prev = priv.previousElementSibling;
    var dot = (prev && prev.textContent.trim() === '\u00B7') ? prev.cloneNode(true) : document.createTextNode(' \u00B7 ');
    priv.after(dot, a);
  }
  var timer = null;
  new MutationObserver(function(){ clearTimeout(timer); timer = setTimeout(addFooterLink, 300); })
    .observe(document.body, {childList: true, subtree: true});
  addFooterLink();
})();
