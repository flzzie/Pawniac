// pawniac.fun/improve  (Pawniac Improve).
// Everyone sees "Coming soon" with an email box (hb/notify/<email key>, write only, read by staff).
// Staff (pawniac_is_admin) see the work-in-progress board instead, with a "view as visitor" switch.
// NOTE: this is a screen in a public static site, so the hiding is for the interface only. Nothing private is stored here.
(function(){
  'use strict';
  var KEY = 'improve';
  function $(id){ return document.getElementById(id); }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function admin(){ try{ return !!(window.pawniacIsAdmin && window.pawniacIsAdmin()); }catch(e){ return false; } }
  function emailKey(e){ return e.toLowerCase().replace(/\./g, ',').replace(/[#$\[\]\/]/g, '_'); }
  var EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
  var asVisitor = false, signups = null;

  var css = '#screen-improve,#improvePublic{--bg:#f4f1ea;--ink:#22201b;--muted:#7a766c;--line:#d9d3c4;--accent:#1f6f5c}' +
    '[data-theme=dark] #screen-improve,[data-theme=dark] #improvePublic{--bg:#1b1a17;--ink:#e8e4d8;--muted:#a39c8c;--line:#3a372f;--accent:#4fb59a}' +
    '#improvePublic{background:var(--bg);color:var(--ink)}' +
    '.imp{max-width:640px;margin:0 auto;padding:8px 0 40px;display:flex;flex-direction:column;gap:16px}' +
    '.imp h2{margin:0}.imp .sub{color:var(--muted);line-height:1.6;margin:0}' +
    '.imp-card{border:1px solid var(--line);border-radius:12px;padding:18px;display:flex;flex-direction:column;gap:10px}' +
    '.imp-pill{align-self:flex-start;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;border:1px solid var(--accent);color:var(--accent);border-radius:999px;padding:3px 12px}' +
    '.imp form{display:flex;gap:8px;flex-wrap:wrap}.imp input[type=email]{flex:1 1 220px;min-width:0}' +
    '.imp a{color:var(--accent);font-weight:600}.imp #impMsg:empty{display:none}' +
    '.imp-ok{color:var(--accent);font-weight:600}.imp-err{color:#b3261e}' +
    '.imp ul{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px}' +
    '.imp-done{opacity:.6;text-decoration:line-through}' +
    '.imp-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:space-between}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var scr = document.createElement('div'); scr.id = 'screen-improve'; scr.style.display = 'none';
  document.querySelector('.wrap').insertBefore(scr, $('pnFooter') || null);
  // for people who are not logged in: the same page on its own, no login needed
  var pub = document.createElement('div'); pub.id = 'improvePublic'; pub.style.cssText = 'display:none;position:fixed;inset:0;z-index:9000;overflow:auto;padding:24px 16px';
  document.body.appendChild(pub);

  function visitorHtml(note){
    return '<div class="imp"><span class="imp-pill">Coming soon</span>' +
      '<h2>Improve at chess, together</h2>' +
      '<p class="sub">A free place to get better: a short check-up that finds your weak spots, five minutes of training a day, and written feedback on your games from stronger players who volunteer their time. Free, run by volunteers, no ads.</p>' +
      '<div class="imp-card"><b>Get an email when it opens</b>' +
      '<form id="impForm"><input type="email" id="impMail" placeholder="you@example.com" autocomplete="email" maxlength="254" aria-label="Email address" required>' +
      '<button type="submit" id="impGo">Notify me</button></form>' +
      '<div id="impMsg" class="hint" role="status"></div>' +
      '<div class="hint">We only use your email to tell you when this opens.</div></div>' +
      (note || '') + '</div>';
  }
  function bind(root){
    var f = root.querySelector('#impForm'); if(!f) return;
    f.onsubmit = async function(ev){
      ev.preventDefault();
      var m = root.querySelector('#impMsg'), v = root.querySelector('#impMail').value.trim();
      if(!EMAIL_RE.test(v)){ m.className = 'hint imp-err'; m.textContent = 'That does not look like an email address.'; return; }
      root.querySelector('#impGo').disabled = true;
      try{
        await db.ref('hb/notify/' + emailKey(v)).set({email:v.toLowerCase(), ts:firebase.database.ServerValue.TIMESTAMP});
        m.className = 'hint imp-ok'; m.textContent = 'Done. We will email you when it opens.';
        root.querySelector('#impMail').value = '';
      }catch(e){
        // a repeat sign-up is refused by the rules (the address is already on the list): that is fine
        var dup = e && /permission/i.test(String(e.message || e));
        m.className = dup ? 'hint imp-ok' : 'hint imp-err';
        m.textContent = dup ? 'You are already on the list.' : 'Could not save that. Please try again later.';
      }
      root.querySelector('#impGo').disabled = false;
    };
  }

  var PLAN = [
    ['Page, Coming soon, email sign-up', true],
    ['Check-Up: 20 positions, skill radar, ranked weaknesses', false],
    ['Your Record (weakness tags, history)', false],
    ['Daily Training and 4-week Sprints', false],
    ['Credits and review tickets', false],
    ['Volunteer Academy and queue', false],
    ['Training Partners (matching, session plan)', false],
    ['Organizer dashboard and quarterly report', false]];
  function staffHtml(){
    var n = signups ? Object.keys(signups).length : '...';
    var list = signups ? Object.keys(signups).map(function(k){ return signups[k]; }).sort(function(a, b){ return (b.ts || 0) - (a.ts || 0); }) : [];
    return '<div class="imp"><div class="imp-bar"><span class="imp-pill">Staff view, visitors see Coming soon</span><button class="secondary" id="impAs">View as visitor</button></div>' +
      '<h2>Pawniac Improve: build status</h2>' +
      '<div class="imp-card"><b>Plan</b><ul>' + PLAN.map(function(p){ return '<li class="' + (p[1] ? 'imp-done' : '') + '">' + esc(p[0]) + (p[1] ? ' (done)' : '') + '</li>'; }).join('') + '</ul></div>' +
      '<div class="imp-card"><b>Email sign-ups: ' + esc(n) + '</b>' +
      (list.length ? '<ul>' + list.slice(0, 200).map(function(x){ return '<li>' + esc(x.email) + ' <span class="hint">' + esc(x.ts ? new Date(x.ts).toLocaleDateString() : '') + '</span></li>'; }).join('') + '</ul>' : '<div class="hint">Nobody yet.</div>') +
      '</div></div>';
  }
  async function loadSignups(){
    try{ signups = (await db.ref('hb/notify').once('value')).val() || {}; }catch(e){ signups = {}; }
  }
  function draw(){
    if(admin() && !asVisitor){
      scr.innerHTML = staffHtml();
      var b = $('impAs'); if(b) b.onclick = function(){ asVisitor = true; draw(); };
    }else{
      scr.innerHTML = visitorHtml(admin() ? '<button class="secondary" id="impBack" style="align-self:flex-start">Back to staff view</button>' : '');
      var bb = $('impBack'); if(bb) bb.onclick = function(){ asVisitor = false; draw(); };
      bind(scr);
    }
  }
  window.renderImprove = async function(){
    if(typeof stopPoll === 'function') stopPoll();
    showScreen(KEY);
    try{ PW.replace('#/improve'); }catch(e){}
    draw();
    if(admin() && signups === null){ await loadSignups(); draw(); }
    window.scrollTo(0, 0);
  };
  var prevShow = window.showScreen;
  window.showScreen = function(n){
    prevShow(n);
    scr.style.display = (n === KEY) ? 'block' : 'none';
    if(n !== KEY) pub.style.display = 'none';
  };

  // the page needs no login: a logged-out visit to /improve/ shows it over the login screen
  var RT = /^#\/improve\/?$/i;
  function loggedIn(){ return typeof ME !== 'undefined' && !!ME && !!ME.username; }
  function showPublic(){
    pub.innerHTML = visitorHtml('<a href="/" style="align-self:flex-start">Go to Pawniac</a>');
    pub.style.display = 'block'; bind(pub);
  }
  function check(){ if(RT.test(PW.hash()) && !loggedIn()) showPublic(); }
  document.addEventListener('DOMContentLoaded', check);
  setTimeout(check, 0);
  var prevAfter = window.afterAuth, boot = true;
  window.afterAuth = async function(){
    var h = boot ? PW.hash() : ''; boot = false; pub.style.display = 'none';
    var r = await prevAfter.apply(this, arguments);
    try{ if(RT.test(h)) window.renderImprove(); }catch(e){ console.error(e); }
    return r;
  };
  window.addEventListener('hashchange', function(){
    if(RT.test(PW.hash()) && scr.style.display !== 'block'){ if(loggedIn()) window.renderImprove(); else showPublic(); }
  });
})();
