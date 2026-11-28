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

  css += '#screen-improve,#improvePublic{--card:#fffdf8;--soft:#e4efe9;--gold:#b98a2e}' +
  '[data-theme=dark] #screen-improve,[data-theme=dark] #improvePublic{--card:#23211d;--soft:#1f3a31;--gold:#e0b45a}' +
  '.imp.wide{max-width:1040px;gap:0;padding:0 0 56px}' +
  '.ih{position:relative;overflow:hidden;border-radius:20px;padding:44px 28px 36px;margin-top:8px;background:radial-gradient(900px 420px at 85% -10%,var(--soft),transparent 60%),var(--card);border:1px solid var(--line);display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:28px;align-items:center}' +
  '.ih:before{content:"";position:absolute;inset:0;opacity:.07;pointer-events:none;background-image:linear-gradient(45deg,var(--ink) 25%,transparent 25%,transparent 75%,var(--ink) 75%),linear-gradient(45deg,var(--ink) 25%,transparent 25%,transparent 75%,var(--ink) 75%);background-size:56px 56px;background-position:0 0,28px 28px}' +
  '.ih > *{position:relative}' +
  '.ih h2{font-size:clamp(32px,5.2vw,54px);line-height:1.05;letter-spacing:-1.5px;margin:12px 0 14px}' +
  '.ih h2 em{font-style:normal;color:var(--accent)}' +
  '.ih .lead{font-size:17px;color:var(--muted);line-height:1.6;margin:0 0 20px;max-width:46ch}' +
  '.ih form{margin:0}.ih form button{padding:12px 20px;font-weight:700}.ih input[type=email]{padding:12px 14px}' +
  '.ih .hint{margin-top:8px}' +
  '.iradar{width:100%;max-width:380px;justify-self:center}' +
  '.iradar .pol{fill:var(--accent);fill-opacity:.22;stroke:var(--accent);stroke-width:2.5;stroke-linejoin:round;animation:impMorph 9s ease-in-out infinite}' +
  '@keyframes impMorph{0%,100%{d:path("M190 40 L300 108 L286 228 L190 292 L92 232 L78 112 Z")}50%{d:path("M190 80 L276 126 L300 214 L190 262 L108 214 L112 130 Z")}}' +
  '.iradar .gr{fill:none;stroke:var(--line);stroke-width:1}.iradar text{font-size:12px;fill:var(--muted);font-weight:600}' +
  '.iradar .dot{fill:var(--accent)}' +
  '.isec{margin-top:56px}.isec h3{font-size:clamp(22px,3.4vw,30px);letter-spacing:-.5px;margin:0 0 6px}' +
  '.isec .kick{color:var(--gold);font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;margin-bottom:6px}' +
  '.isec > p{color:var(--muted);margin:0 0 20px;max-width:60ch;line-height:1.6}' +
  '.igrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}' +
  '.ic{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px;display:flex;flex-direction:column;gap:8px;transition:transform .2s,border-color .2s}' +
  '.ic:hover{transform:translateY(-3px);border-color:var(--accent)}' +
  '.ic b{font-size:16px}.ic span{color:var(--muted);font-size:14px;line-height:1.55}' +
  '.in{width:34px;height:34px;border-radius:10px;background:var(--soft);color:var(--accent);display:grid;place-items:center;font-weight:800}' +
  '.isteps{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:0;border:1px solid var(--line);border-radius:16px;overflow:hidden;background:var(--card)}' +
  '.is{padding:22px;border-right:1px solid var(--line);display:flex;flex-direction:column;gap:6px}.is:last-child{border-right:0}' +
  '.is .n{font-size:34px;font-weight:800;color:var(--accent);line-height:1;letter-spacing:-1px}.is b{font-size:15px}.is span{font-size:13.5px;color:var(--muted);line-height:1.55}' +
  '.irev{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px;align-items:stretch}' +
  '.iq{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px;display:flex;flex-direction:column;gap:10px}' +
  '.iq .who{font-size:12px;color:var(--muted);font-weight:700;letter-spacing:.06em;text-transform:uppercase}' +
  '.iq p{margin:0;line-height:1.6;font-size:14.5px}.iq .rule{border-left:3px solid var(--gold);padding-left:12px;font-weight:700}' +
  '.itg{display:flex;gap:6px;flex-wrap:wrap}.itg i{font-style:normal;font-size:12px;border:1px solid var(--line);border-radius:999px;padding:2px 10px;color:var(--muted)}' +
  '.istats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-top:22px}' +
  '.istat{text-align:center;padding:18px;border:1px solid var(--line);border-radius:16px;background:var(--card)}.istat b{display:block;font-size:30px;letter-spacing:-1px;color:var(--accent)}.istat span{font-size:13px;color:var(--muted)}' +
  '.icta{margin-top:56px;border-radius:20px;padding:36px 24px;text-align:center;background:var(--accent);color:#fff;display:flex;flex-direction:column;gap:10px;align-items:center}' +
  '.icta h3{margin:0;font-size:clamp(22px,4vw,32px);color:#fff}.icta p{margin:0;opacity:.9}.icta button{background:#fff;color:#1b1a17;border:0;border-radius:10px;padding:12px 22px;font-weight:800;cursor:pointer}' +
  '.itop{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}' +
  '@media(max-width:760px){.ih{grid-template-columns:1fr;padding:30px 20px}.irev{grid-template-columns:1fr}.is{border-right:0;border-bottom:1px solid var(--line)}.is:last-child{border-bottom:0}}' +
  '@media(prefers-reduced-motion:reduce){.iradar .pol{animation:none}.ic{transition:none}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var scr = document.createElement('div'); scr.id = 'screen-improve'; scr.style.display = 'none';
  document.querySelector('.wrap').insertBefore(scr, $('pnFooter') || null);
  // for people who are not logged in: the same page on its own, no login needed
  var pub = document.createElement('div'); pub.id = 'improvePublic'; pub.style.cssText = 'display:none;position:fixed;inset:0;z-index:9000;overflow:auto;padding:24px 16px';
  document.body.appendChild(pub);

  function radarSvg(){
    var ax = ['Tactics','Calculation','Strategy','Opening','Defence','Endgame'], cx = 190, cy = 165, R = 120, g = '', l = '';
    function P(i, v){ var a = -Math.PI / 2 + i * Math.PI / 3; return [cx + R * v * Math.cos(a), cy + R * v * Math.sin(a)]; }
    [.33, .66, 1].forEach(function(v){ g += '<polygon class="gr" points="' + ax.map(function(_, i){ return P(i, v).map(function(n){ return n.toFixed(0); }).join(','); }).join(' ') + '"/>'; });
    ax.forEach(function(t, i){ var e = P(i, 1.2), an = e[0] < cx - 5 ? 'end' : e[0] > cx + 5 ? 'start' : 'middle'; l += '<text x="' + e[0].toFixed(0) + '" y="' + (e[1] + 4).toFixed(0) + '" text-anchor="' + an + '">' + t + '</text>'; });
    return '<svg class="iradar" viewBox="0 0 380 330" role="img" aria-label="A skill radar that changes as a player improves">' + g + '<path class="pol" d="M190 40 L300 108 L286 228 L190 292 L92 232 L78 112 Z"/>' + l + '</svg>';
  }
  function form(){
    return '<form id="impForm"><input type="email" id="impMail" placeholder="you@example.com" autocomplete="email" maxlength="254" aria-label="Email address" required><button type="submit" id="impGo">Notify me</button></form>' +
      '<div id="impMsg" class="hint" role="status"></div><div class="hint">One email when it opens. Nothing else.</div>';
  }
  function visitorHtml(note){
    var feats = [
      ['1','The Check-Up','Twenty short positions across six areas. In ten minutes you get a skill radar and a ranked list of what is costing you games.'],
      ['2','Five minutes a day','Short training on your weakest area, one at a time, in four-week Sprints. Test again at the end and see the change.'],
      ['3','Real feedback','Ask a stronger player to look at one moment from your game. You get a written answer about your thinking, not an engine dump.'],
      ['4','Training partners','Get matched with someone strong where you are weak, and the other way round. Plan a session, debrief, repeat.']];
    var steps = [
      ['01','Take the Check-Up','Find out where you actually lose points.'],
      ['02','Train a little each day','Five minutes on one weakness at a time.'],
      ['03','Ask for a review','Write what you were thinking. Get a reply.'],
      ['04','Pass it on','Strong players volunteer a few minutes. Anyone can earn the Reviewer title.']];
    return '<div class="imp wide">' +
      '<div class="itop"><span class="imp-pill">Coming soon</span></div>' +
      '<div class="ih"><div><h2>Stop repeating the <em>same mistakes</em>.</h2>' +
      '<p class="lead">A free place to actually get better at chess. Find your weak spots, train them daily, and get written feedback from stronger players who volunteer their time.</p>' +
      form() + '</div>' + radarSvg() + '</div>' +
      '<div class="istats"><div class="istat"><b>Free</b><span>no ads, no paywall</span></div><div class="istat"><b>10 min</b><span>for the Check-Up</span></div><div class="istat"><b>5 min</b><span>a day to improve</span></div><div class="istat"><b>150-300</b><span>words of real feedback</span></div></div>' +
      '<div class="isec"><div class="kick">What you get</div><h3>Four things, one loop</h3><p>Each part feeds the next, and your history is remembered so nobody starts from zero.</p><div class="igrid">' +
      feats.map(function(f){ return '<div class="ic"><div class="in">' + f[0] + '</div><b>' + f[1] + '</b><span>' + f[2] + '</span></div>'; }).join('') + '</div></div>' +
      '<div class="isec"><div class="kick">How it works</div><h3>From stuck to better</h3><div class="isteps" style="margin-top:14px">' +
      steps.map(function(x){ return '<div class="is"><div class="n">' + x[0] + '</div><b>' + x[1] + '</b><span>' + x[2] + '</span></div>'; }).join('') + '</div></div>' +
      '<div class="isec"><div class="kick">A real answer looks like this</div><h3>Feedback about your thinking</h3><p>You describe the moment and what you were thinking. A volunteer answers in three parts and tags the pattern so it shows up in your Record.</p>' +
      '<div class="irev"><div class="iq"><div class="who">You wrote</div><p>"I played Nxe4 because I thought it won a pawn and the knight was safe. I did not look at what the bishop on c4 could do."</p></div>' +
      '<div class="iq"><div class="who">Reviewer answered</div><p><b>What you missed.</b> After Nxe4 the bishop takes on f7 with check and drags your king out, so the pawn is poisoned.</p><p class="rule">Before grabbing a pawn, check which of my pieces become loose.</p><div class="itg"><i>Missed threat</i><i>Wrong trade</i></div></div></div></div>' +
      '<div class="icta"><h3>Be there when it opens</h3><p>Leave your email and we will tell you the day it is ready.</p><button type="button" id="impTop">Add my email</button></div>' +
      (note ? '<div style="margin-top:18px;display:flex;gap:12px;align-items:center">' + note + '</div>' : '') + '</div>';
  }
  function bind(root){
    var tb = root.querySelector('#impTop'); if(tb) tb.onclick = function(){ var m = root.querySelector('#impMail'); m.scrollIntoView({behavior:'smooth', block:'center'}); setTimeout(function(){ m.focus(); }, 500); };
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
