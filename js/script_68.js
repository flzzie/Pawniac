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

  css += '.ibd{position:relative;width:100%;max-width:340px;aspect-ratio:1;justify-self:center;border-radius:12px;overflow:hidden;box-shadow:0 24px 50px -18px rgba(0,0,0,.45);border:1px solid var(--line)}' +
  '.ibg8{display:grid;grid-template-columns:repeat(8,1fr);height:100%}.ibg8 i.l{background:#ecdcb8}.ibg8 i.d{background:#b58863}' +
  '.ibd .pc{position:absolute;width:12.5%;height:12.5%;filter:drop-shadow(0 2px 2px rgba(0,0,0,.35))}' +
  '.ibd .mv{animation:impMv 9s cubic-bezier(.6,0,.3,1) infinite;z-index:2}' +
  '@keyframes impMv{0%,38%{left:75%;top:12.5%}46%,70%{left:75%;top:25%}80%,100%{left:75%;top:12.5%}}' +
  '.ibd .cap{animation:impCap 9s linear infinite}' +
  '@keyframes impCap{0%,44%{opacity:1}47%,72%{opacity:0}78%,100%{opacity:1}}' +
  '.ibd .ibad{position:absolute;left:75%;top:25%;width:12.5%;height:12.5%;background:#d32f2f;opacity:0;animation:impBad 9s linear infinite}' +
  '@keyframes impBad{0%,46%{opacity:0}50%{opacity:.55}68%{opacity:.55}74%,100%{opacity:0}}' +
  '.ibd .ibq{position:absolute;left:80%;top:20%;width:11%;height:11%;border-radius:50%;background:#d32f2f;color:#fff;font-weight:900;font-size:clamp(12px,2.4vw,18px);display:grid;place-items:center;z-index:3;opacity:0;transform:scale(.3);animation:impQ 9s cubic-bezier(.3,1.6,.5,1) infinite;box-shadow:0 2px 6px rgba(0,0,0,.4)}' +
  '@keyframes impQ{0%,47%{opacity:0;transform:scale(.3)}52%,68%{opacity:1;transform:scale(1)}73%,100%{opacity:0;transform:scale(.3)}}' +
  '.ibd .itk{position:absolute;left:62%;top:40%;width:22%;height:11%;background:#fff;border-radius:999px;display:flex;gap:7%;align-items:center;justify-content:center;z-index:3;box-shadow:0 2px 8px rgba(0,0,0,.3);animation:impTk 9s linear infinite}' +
  '.ibd .itk:after{content:"";position:absolute;left:60%;top:-26%;width:16%;height:30%;background:#fff;border-radius:50%}' +
  '.ibd .itk span{width:12%;aspect-ratio:1;border-radius:50%;background:#444;animation:impDot 1.1s ease-in-out infinite}.ibd .itk span:nth-child(2){animation-delay:.18s}.ibd .itk span:nth-child(3){animation-delay:.36s}' +
  '@keyframes impTk{0%,4%{opacity:0}9%,34%{opacity:1}39%,100%{opacity:0}}' +
  '@keyframes impDot{0%,100%{transform:translateY(0);opacity:.4}50%{transform:translateY(-35%);opacity:1}}' +
  '.imp.wide{position:relative}.imp.wide > *{position:relative;z-index:1}.imp.wide > .ibgp{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden}' +
  '.ibgp img{position:absolute;opacity:.07;animation:impFloat 24s ease-in-out infinite}' +
  '[data-theme=dark] .ibgp img{opacity:.09;filter:invert(.9)}' +
  '@keyframes impFloat{0%,100%{transform:translateY(0) rotate(-4deg)}50%{transform:translateY(-28px) rotate(5deg)}}' +
  '#improvePublic,#screen-improve{background-image:conic-gradient(rgba(0,0,0,.035) 25%,transparent 0 50%,rgba(0,0,0,.035) 0 75%,transparent 0);background-size:84px 84px}' +
  '[data-theme=dark] #improvePublic,[data-theme=dark] #screen-improve{background-image:conic-gradient(rgba(255,255,255,.03) 25%,transparent 0 50%,rgba(255,255,255,.03) 0 75%,transparent 0)}' +
  '@media(prefers-reduced-motion:reduce){.ibd .mv,.ibd .cap,.ibd .ibad,.ibd .ibq,.ibd .itk,.ibd .itk span,.ibgp img{animation:none}.ibd .itk{opacity:1}}' +
  '#improvePublic .imp.wide{min-height:calc(100vh - 48px);justify-content:center;gap:16px}.ih{padding:56px 36px}.ih h2{font-size:clamp(34px,5.6vw,62px)}.imp.wide{position:relative}.imp.wide > *{position:relative;z-index:1}.imp.wide > .ibgp{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden}' +
  '.ibgp img{position:absolute;opacity:.07;animation:impFloat 24s ease-in-out infinite}' +
  '[data-theme=dark] .ibgp img{opacity:.09;filter:invert(.9)}' +
  '@keyframes impFloat{0%,100%{transform:translateY(0) rotate(-4deg)}50%{transform:translateY(-28px) rotate(5deg)}}' +
  '#improvePublic,#screen-improve{background-image:conic-gradient(rgba(0,0,0,.035) 25%,transparent 0 50%,rgba(0,0,0,.035) 0 75%,transparent 0);background-size:84px 84px}' +
  '[data-theme=dark] #improvePublic,[data-theme=dark] #screen-improve{background-image:conic-gradient(rgba(255,255,255,.03) 25%,transparent 0 50%,rgba(255,255,255,.03) 0 75%,transparent 0)}' +
  '@media(prefers-reduced-motion:reduce){.ibd .g,.ibd .ikn,.ibgp img{animation:none}.ibd .g{opacity:.5}}' +
  '#screen-improve,#improvePublic{--card:#fffdf8;--soft:#e4efe9;--gold:#b98a2e}' +
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
    return '<form id="impForm"><input type="email" id="impMail" placeholder="you@example.com" autocomplete="email" maxlength="254" aria-label="Email address" required><button type="submit" id="impGo">Save my spot</button></form>' +
      '<div id="impMsg" class="hint" role="status"></div><div class="hint">One email when your spot opens. Nothing else.</div>';
  }
  // a real position where a natural-looking move (…g6) is a mistake: Black thinks, plays it, red question mark, rewind (engine: -0.5 before, +2.1 for White after)
  var FEN = 'rn1qkbnr/ppp2ppp/3p4/4p3/2B1P1b1/2N2N2/PPPP1PPP/R1BQK2R';
  function boardHtml(){
    var sq = '', pcs = '', rows = FEN.split('/');
    for(var y = 0; y < 8; y++) for(var x = 0; x < 8; x++) sq += '<i class="' + ((x + y) % 2 ? 'd' : 'l') + '"></i>';
    rows.forEach(function(r, y){
      var x = 0;
      r.split('').forEach(function(c){
        if(/\d/.test(c)){ x += +c; return; }
        var w = c === c.toUpperCase(), code = (w ? 'w' : 'b') + c.toUpperCase(), cls = 'pc';
        if(x === 6 && y === 1) cls += ' mv';       // black pawn on g7: the one that moves (g6 is a real mistake)
        pcs += '<img class="' + cls + '" src="/images/' + code + '.svg" alt="" style="left:' + x * 12.5 + '%;top:' + y * 12.5 + '%">';
        x++;
      });
    });
    return '<div class="ibd" aria-hidden="true"><div class="ibg8">' + sq + '</div>' + pcs +
      '<div class="itk"><span></span><span></span><span></span></div>' +
      '<div class="ibad"></div><div class="ibq">?</div></div>';
  }
  function bgPieces(){
    var ps = [['bK',6,8,30],['wQ',78,14,36],['bN',12,70,26],['wR',86,64,30],['wP',46,86,22],['bB',60,4,24]];
    return '<div class="ibgp" aria-hidden="true">' + ps.map(function(p, i){
      return '<img src="/images/' + p[0] + '.svg" alt="" style="left:' + p[1] + '%;top:' + p[2] + '%;width:' + p[3] + 'vw;max-width:' + (p[3] * 8) + 'px;animation-delay:-' + (i * 3.3).toFixed(1) + 's">';
    }).join('') + '</div>';
  }
  function statsHtml(){ return '<div class="istats" id="impStats"></div>'; }
  function visitorHtml(note){
    return '<div class="imp wide">' + bgPieces() +
      '<div class="itop"><span class="imp-pill">Coming soon</span><span class="imp-pill" style="border-color:var(--gold);color:var(--gold)">Invite-only start</span></div>' +
      '<div class="ih"><div><h2>Stop repeating the <em>same mistakes</em>.</h2>' +
      '<p class="lead">Most players play thousands of games and never get better. We are building something to change that, and opening it to a small first group. Early sign-ups go in first.</p>' +
      form() + '</div>' + boardHtml() + '</div>' + statsHtml() +
      (note ? '<div style="margin-top:18px;display:flex;gap:12px;align-items:center">' + note + '</div>' : '') + '</div>';
  }
  function num(path){
    return db.ref(path).once('value').then(function(x){ return x.exists() ? Number(x.val()) || 0 : 0; }, function(){ return 0; });
  }
  function loadStats(root){
    var el = root.querySelector('#impStats'); if(!el) return;
    Promise.all([num('hb/counters/played/total'), num('hb/gameCount'), num('hb/counters/played/bot'), num('hb/counters/analyzed/total'), num('hb/counters/players/total')]).then(function(a){
      var items = [[Math.max(a[0], a[1]) + a[2], 'games played on Pawniac'], [a[3], 'games analyzed by players'], [a[4], 'players have joined']].filter(function(x){ return x[0] > 0; });
      el.innerHTML = items.map(function(x){ return '<div class="istat"><b>' + x[0].toLocaleString() + '</b><span>' + x[1] + '</span></div>'; }).join('');
    });
  }
  function bind(root){
    loadStats(root);
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
    ready();
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
  function ready(){ document.documentElement.classList.remove('imp-route'); }
  function showPublic(){
    pub.innerHTML = visitorHtml('<a href="/" style="align-self:flex-start">Go to Pawniac</a>');
    pub.style.display = 'block'; bind(pub); ready();
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
