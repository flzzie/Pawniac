(function(){
  var ADMINS = ['rishiii', 'lutim'];                       // compared in lower case
  var NAME_RE = /^[A-Za-z0-9_]{3,20}$/;
  var TS = firebase.database.ServerValue.TIMESTAMP;
  var DAILY_LIMIT = 20;

  function esc(s){ return String(s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function $(id){ return document.getElementById(id); }
  function isAdmin(){ return !!(typeof ME !== 'undefined' && ME && ADMINS.indexOf(String(ME.username).toLowerCase()) >= 0); }
  function val(p){ return db.ref(p).once('value').then(function(s){ return s.exists() ? s.val() : null; }); }
  function arr(x){ return Array.isArray(x) ? x.filter(Boolean) : (x && typeof x === 'object' ? Object.keys(x).map(function(k){ return x[k]; }) : []); }
  function inActiveGame(){
    var s = $('screen-game');
    return !!s && s.style.display === 'block' && !!gameState && gameState.status === 'active';
  }
  function leaveOk(){ return !inActiveGame() || confirm('Your clock keeps running while you are away. Leave the game view?'); }
  function dayKey(){ return new Date(serverNow()).toISOString().slice(0, 10); }
  function localDay(){ var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function dayNum(s){ var p = String(s).split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000; }
  function card(t, d){ return '<div class="card"><h2>' + t + '</h2><p class="desc" style="margin:0;">' + d + '</p></div>'; }

  // =====================================================================
  //  1. opening names -> families
  // =====================================================================
  var FAM = [
    ['sicilian','Sicilian',/sicilian|najdorf|sveshnikov|taimanov|scheveningen|alapin|rossolimo|smith-morra|grand prix|dragon/i],
    ['french','French',/french/i], ['caro','Caro-Kann',/caro-kann/i], ['scandi','Scandinavian',/scandinavian/i],
    ['italian','Italian',/italian|giuoco|evans gambit|two knights|fried liver|max lange|hungarian defen/i],
    ['ruy','Ruy Lopez',/ruy lopez|spanish/i], ['kg',"King's Gambit",/king's gambit|falkbeer/i],
    ['qg',"Queen's Gambit",/queen's gambit|qgd|qga|tarrasch defen|albin|chigorin/i],
    ['london','London System',/london/i], ['kid',"King's Indian",/king's indian(?! attack)/i],
    ['english','English',/english/i], ['scotch','Scotch',/scotch/i],
    ['vienna','Vienna',/vienna/i], ['pirc','Pirc',/pirc/i], ['slav','Slav',/slav/i], ['nimzo','Nimzo-Indian',/nimzo-indian/i],
    ['qindian',"Queen's Indian",/queen's indian/i], ['dutch','Dutch',/dutch/i], ['catalan','Catalan',/catalan/i],
    ['petrov','Petrov',/petrov/i], ['philidor','Philidor',/philidor/i], ['alekhine','Alekhine',/alekhine/i],
    ['grunfeld','Grunfeld',/gr[uü]nfeld|gruenfeld/i], ['benoni','Benoni',/benoni|benko/i], ['modern','Modern',/^modern/i],
    ['bird','Bird',/bird/i], ['trompowsky','Trompowsky',/trompowsky/i], ['colle','Colle',/colle/i], ['torre','Torre',/torre/i],
    ['larsen','Larsen',/larsen/i], ['bogo','Bogo-Indian',/bogo-indian/i]
  ];
  function familyOf(name){
    if(!name) return null;
    var seg = String(name).split(':')[0].trim();
    for(var i = 0; i < FAM.length; i++) if(FAM[i][2].test(seg)) return {k:FAM[i][0], n:FAM[i][1]};
    var k = 'x_' + seg.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 22);
    return k.length > 2 ? {k:k, n:seg} : null;
  }
  // deepest named opening reached while the game was still "in book"
  function openingName(log){
    var B = window.__pawBook;
    if(!B) return null;
    var c = new Chess(), last = null;
    for(var i = 0; i < log.length && i < 40; i++){
      if(!c.move(log[i])) break;
      var f = c.fen();
      if(!B.inBook(f)) break;
      var n = B.name(f);
      if(n) last = n;
    }
    return last;
  }

  // =====================================================================
  //  2. the list of achievements (plain text badges)
  // =====================================================================
  var CATS = [['games','Games'], ['rating','Rating'], ['openings','Openings'], ['analysis','Analysis'], ['streaks','Streaks'], ['variants','Variants'], ['fun','Fun']];
  var L = [];
  function def(id, cat, name, desc, g, s, tier, goal, cur, base){ L.push({id:id, cat:cat, name:name, desc:desc, g:g, s:s, tier:tier, goal:goal, cur:cur, base:base || 0}); }

  def('g1','games','First Move','Finish your first game.','1','GAME',1,1,function(S){ return S.games; });
  def('g10','games','Regular','Play 10 games.','10','GAMES',1,10,function(S){ return S.games; });
  def('g100','games','Centurion','Play 100 games.','100','GAMES',3,100,function(S){ return S.games; });
  def('g500','games','Veteran','Play 500 games.','500','GAMES',4,500,function(S){ return S.games; });
  def('w1','games','First Blood','Win a game.','1','WIN',1,1,function(S){ return S.wins; });
  def('ws3','games','Hat Trick','Win 3 games in a row.','x3','STREAK',2,3,function(S){ return S.bw; });
  def('ws5','games','On Fire','Win 5 games in a row.','x5','STREAK',3,5,function(S){ return S.bw; });

  [[1300,'Climbing',1],[1400,'Club Player',2],[1600,'Strong Player',3],[1800,'Expert',4],[2000,'Master Level',4]].forEach(function(r){
    def('r' + r[0], 'rating', r[1], 'Reach a rating of ' + r[0] + ' in any rated mode.', String(r[0]), 'RATING', r[2], r[0], function(S){ return S.rating; }, 1200);
  });

  def('op10','openings','Explorer','Play 10 different openings in Standard games.','10','OPENINGS',2,10,function(S){ return S.opDistinct; });
  def('op25','openings','Specialist','Play the same opening 25 times.','25x','SAME',3,25,function(S){ return S.opMax; });
  [['sicilian','Sicilian','SIC','Sicilian Don'], ['french','French','FR','French Connection'], ['caro','Caro-Kann','CK','Caro-Kann Calm'],
   ['scandi','Scandinavian','SCA','Nordic Raid'], ['italian','Italian','ITA','Italian Job'], ['ruy','Ruy Lopez','RL','Spanish Inquisition'],
   ['kg',"King's Gambit",'KG','Gambit Gambler'], ['qg',"Queen's Gambit",'QG',"Queen's Court"], ['london','London System','LON','Tea Time'],
   ['kid',"King's Indian",'KID','Indian Summer'], ['english','English','ENG','God Save the Queen'], ['scotch','Scotch','SCO','Scotch on the Rocks']
  ].forEach(function(o){
    def('ow_' + o[0], 'openings', o[3], 'Win a Standard game that opened as a ' + o[1] + '.', o[2], 'WIN', 2, 1, function(S){ return S.opw[o[0]] ? 1 : 0; });
  });

  def('a1','analysis','Curious','Analyze a game.','1','ANALYZED',1,1,function(S){ return S.an; });
  def('a10','analysis','Student','Analyze 10 games.','10','ANALYZED',2,10,function(S){ return S.an; });
  def('a100','analysis','Scholar','Analyze 100 games.','100','ANALYZED',4,100,function(S){ return S.an; });
  def('brill','analysis','Brilliant!','Find a brilliant move in one of your analyzed games.','!!','BRILLIANT',4,1,function(S){ return S.br; });

  def('s7','streaks','Week Warrior','Open Pawniac 7 days in a row.','7','DAYS',2,7,function(S){ return S.sb; });
  def('s30','streaks','Monthly Regular','Open Pawniac 30 days in a row.','30','DAYS',3,30,function(S){ return S.sb; });
  def('s100','streaks','Devoted','Open Pawniac 100 days in a row.','100','DAYS',4,100,function(S){ return S.sb; });

  def('aucwin','variants','Auctioneer','Win a Piece Auction game.','AUC','WIN',2,1,function(S){ return S.aw; });
  def('hbwin','variants','Hand & Brain','Win a Hand & Brain game.','H&B','WIN',2,1,function(S){ return S.hw; });
  def('teamwin','variants','Dream Team','Win a 2v2 Hand & Brain game.','2v2','WIN',3,1,function(S){ return S.tw; });
  def('kt64','variants',"Knight's Tour",'Visit all 64 squares in the Knight\'s tour minigame.','64','TOUR',3,64,function(S){ return S.kt; });
  def('bbrun','variants','Blindfold','Finish a Blindfold board run.','BF','RUN',2,1,function(S){ return S.bbScore > 0 ? 1 : 0; });
  def('bb10','variants','Memory Lane','Reach level 10 in the Blindfold board.','L10','BLINDFOLD',3,10,function(S){ return S.bbLevel; });
  def('expert','variants','Giant Slayer','Beat the Expert bot.','BOT','EXPERT',4,1,function(S){ return S.be; });
  def('quiz10','variants','Book Worm','Get 10 correct answers in one opening-quiz run.','Q10','QUIZ',2,10,function(S){ return S.quiz; });

  def('fastmate','fun','Blitzkrieg','Win by checkmate in under 15 moves.','#','FAST MATE',2,1,function(S){ return S.f1; });
  def('flag5','fun','Photo Finish','Win on time with under 5 seconds left on your own clock.',':05','FLAG',3,1,function(S){ return S.f2; });
  def('comeback','fun','Houdini','Win a game after being down 5 or more points of material.','\u21BA','COMEBACK',3,1,function(S){ return S.f3; });
  def('knightpromo','fun','Underpromoter','Promote a pawn to a knight.','=N','PROMO',2,1,function(S){ return S.f4; });

  var BYID = {}; L.forEach(function(a){ BYID[a.id] = a; });

  // =====================================================================
  //  3. state, reading and unlocking
  // =====================================================================
  var V = {S:null, U:{}, pin:[], tab:'all', err:null, user:null};
  var SEEN = {}, busy = false, again = false, evalT = null;

  function scheduleEval(ms){ clearTimeout(evalT); evalT = setTimeout(evalAll, ms || 1500); }

  async function gather(){
    var me = ME.username, P = function(p){ return val(p).catch(function(){ return undefined; }); };
    var r = await Promise.all(['hb/achievements/' + me, 'hb/stats/' + me, 'hb/leaderboard/' + me, 'hb/leaderboardStd/' + me, 'hb/leaderboardAuc/' + me,
      'hb/ktLeaderboard/' + me, 'hb/bbLeaderboard/' + me, 'hb/quizLeaderboard/' + me].map(P));
    if(r[0] === undefined) throw new Error('rules');
    var node = r[0] || {}, c = node.c || {}, S = {}, tot = 0, won = 0, st = r[1] || {};
    ['hb', 'team', 'std'].forEach(function(k){
      var x = st[k]; if(!x) return;
      won += +x.w || 0; tot += (+x.w || 0) + (+x.l || 0) + (+x.d || 0);
    });
    S.games = Math.max(c.gp || 0, tot); S.wins = Math.max(c.wn || 0, won); S.bw = Math.max(c.bw || 0, c.ws || 0);
    var rs = [r[2], r[3], r[4]].filter(function(x){ return x && x.games > 0; }).map(function(x){ return +x.rating || 1200; });
    S.rating = rs.length ? Math.max.apply(null, rs) : 1200;
    var op = c.op || {}, ks = Object.keys(op);
    S.opDistinct = ks.filter(function(k){ return (op[k].p || 0) > 0; }).length;
    S.opMax = ks.reduce(function(m, k){ return Math.max(m, op[k].p || 0); }, 0);
    S.opw = {}; ks.forEach(function(k){ if((op[k].w || 0) > 0) S.opw[k] = 1; });
    S.an = c.an || 0; S.br = c.br ? 1 : 0; S.sb = Math.max(c.sb || 0, c.sc || 0);
    S.aw = c.aw ? 1 : 0; S.hw = c.hw ? 1 : 0; S.tw = c.tw ? 1 : 0; S.be = c.be ? 1 : 0;
    S.kt = (r[5] && typeof r[5].sq === 'number') ? r[5].sq : 0;
    S.bbScore = (r[6] && +r[6].score) || 0; S.bbLevel = (r[6] && +r[6].level) || 0; S.quiz = (r[7] && +r[7].q) || 0;
    S.f1 = c.f1 ? 1 : 0; S.f2 = c.f2 ? 1 : 0; S.f3 = c.f3 ? 1 : 0; S.f4 = c.f4 ? 1 : 0;
    return {S:S, u:node.u || {}, pin:arr(node.pin)};
  }

  async function evalAll(){
    if(!ME) return;
    if(busy){ again = true; return; }
    busy = true;
    var me = ME.username;
    try{
      var d = await gather();
      if(!ME || ME.username !== me) return;
      V.S = d.S; V.U = d.u; V.pin = d.pin; V.err = null; V.user = me;
      var got = [];
      var fresh = L.filter(function(a){ return !d.u[a.id] && a.cur(d.S) >= a.goal; });
      for(var i = 0; i < fresh.length; i++){
        var a = fresh[i];
        var res = await db.ref('hb/achievements/' + me + '/u/' + a.id).transaction(function(c){ return c ? undefined : serverNow(); });
        if(res.committed){ V.U[a.id] = res.snapshot.val(); got.push(a); }
      }
      if(got.length) announce(got);
    }catch(e){
      console.error('achievements failed', e);
      V.err = (e && e.message === 'rules') ? 'rules' : 'fail';
    }finally{
      busy = false;
      renderAch();
      if(again){ again = false; setTimeout(evalAll, 600); }
    }
  }

  // =====================================================================
  //  4. pop-up
  // =====================================================================
  function badgeHtml(a, locked, small){
    var gl = String(a.g);
    return '<div class="ac-badge ac-t' + a.tier + (locked ? ' locked' : '') + (small ? ' sm' : '') + '"><span class="ac-g l' + Math.min(gl.length, 5) + '">' + esc(gl) + '</span><span class="ac-s">' + esc(a.s || '') + '</span></div>';
  }
  function showToast(html, click){
    var box = $('acToasts');
    if(!box){ box = document.createElement('div'); box.id = 'acToasts'; document.body.appendChild(box); }
    var t = document.createElement('div');
    t.className = 'ac-toast'; t.innerHTML = html;
    t.onclick = function(){ if(t.parentNode) t.parentNode.removeChild(t); if(click) click(); };
    box.appendChild(t);
    setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); }, 5600);
  }
  function openPage(){ if(!leaveOk()) return; stopPoll(); renderAchievements(); }
  function announce(list){
    try{ if(typeof window.playWinSound === 'function') window.playWinSound(); }catch(e){}
    if(list.length > 3){
      showToast('<div><div class="ac-tt">Achievements unlocked</div><div class="ac-tn">' + list.length + ' new badges!</div><div class="ac-td">Tap to see them all.</div></div>', openPage);
      return;
    }
    list.forEach(function(a, i){
      setTimeout(function(){
        showToast(badgeHtml(a, false, false) + '<div><div class="ac-tt">Achievement unlocked</div><div class="ac-tn">' + esc(a.name) + '</div><div class="ac-td">' + esc(a.desc) + '</div></div>', openPage);
      }, i * 900);
    });
  }

  // =====================================================================
  //  5. the Achievements page
  // =====================================================================
  var scrA = document.createElement('div'); scrA.id = 'screen-achievements'; scrA.style.display = 'none';
  var scrR = document.createElement('div'); scrR.id = 'screen-reports'; scrR.style.display = 'none';
  document.querySelector('.wrap').appendChild(scrA);
  document.querySelector('.wrap').appendChild(scrR);

  var nav = $('navbar');
  var linkA = document.createElement('a'); linkA.dataset.nav = 'achievements'; linkA.textContent = 'Achievements';
  nav.insertBefore(linkA, nav.querySelector('[data-nav="help"]'));
  linkA.onclick = openPage;

  function setAdminNav(){
    var l = nav.querySelector('[data-nav="reports"]');
    if(isAdmin() && !l){
      l = document.createElement('a'); l.dataset.nav = 'reports'; l.textContent = 'Reports';
      linkA.after(l);
      l.onclick = function(){ if(!leaveOk()) return; stopPoll(); renderReports(); };
    } else if(!isAdmin() && l){ l.remove(); }
  }

  function pct(a, cur){ var c = Math.min(cur, a.goal); return Math.max(0, Math.min(100, (c - a.base) / (a.goal - a.base) * 100)); }
  var LOCK = '<svg class="ac-lock" width="11" height="12" viewBox="0 0 11 12" fill="currentColor"><rect x="1" y="5" width="9" height="7" rx="1.5"/><path d="M3 5V3.5a2.5 2.5 0 0 1 5 0V5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';

  function cardHtml(a){
    var U = V.U, S = V.S, have = !!U[a.id];
    if(have){
      var pinned = V.pin.indexOf(a.id) >= 0, full = V.pin.filter(function(id){ return U[id]; }).length >= 3;
      var dt = typeof U[a.id] === 'number' ? new Date(U[a.id]).toLocaleDateString(undefined, {year:'numeric', month:'short', day:'numeric'}) : '';
      return '<div class="ac-card">' + badgeHtml(a, false) + '<div class="ac-body"><div class="ac-name">' + esc(a.name) + '</div><div class="ac-desc">' + esc(a.desc) + '</div>' +
        '<div class="ac-meta"><span>Unlocked ' + esc(dt) + '</span><button class="secondary" data-pin="' + a.id + '"' + (!pinned && full ? ' disabled title="You can pin 3 badges"' : '') + '>' + (pinned ? 'Unpin' : 'Pin') + '</button></div></div></div>';
    }
    var cur = Math.floor(a.cur(S)), p = pct(a, cur);
    return '<div class="ac-card locked">' + badgeHtml(a, true) + '<div class="ac-body"><div class="ac-name">' + LOCK + esc(a.name) + '</div><div class="ac-desc">' + esc(a.desc) + '</div>' +
      '<div class="ac-prog"><div class="ac-bar"><div style="width:' + p.toFixed(0) + '%"></div></div><span>' + Math.min(cur, a.goal) + ' / ' + a.goal + '</span></div></div></div>';
  }

  function renderAch(){
    if(scrA.style.display !== 'block') return;
    if(V.err === 'rules'){ scrA.innerHTML = card('Achievements', 'Could not load your achievements. Publish the new Firebase rules for "achievements" (see the setup note) and refresh.'); return; }
    if(V.err){ scrA.innerHTML = card('Achievements', 'Could not load right now. Try again in a moment.'); return; }
    if(!V.S){ scrA.innerHTML = card('Achievements', 'Loading...'); return; }
    var U = V.U, total = L.length, have = L.filter(function(a){ return U[a.id]; }).length;
    var pins = V.pin.filter(function(id){ return U[id] && BYID[id]; }).slice(0, 3);
    var tabs = '<div class="ac-tab' + (V.tab === 'all' ? ' active' : '') + '" data-tab="all">All<small>' + have + '/' + total + '</small></div>' + CATS.map(function(c){
      var list = L.filter(function(a){ return a.cat === c[0]; }), h = list.filter(function(a){ return U[a.id]; }).length;
      return '<div class="ac-tab' + (V.tab === c[0] ? ' active' : '') + '" data-tab="' + c[0] + '">' + c[1] + '<small>' + h + '/' + list.length + '</small></div>';
    }).join('');
    var items = L.filter(function(a){ return V.tab === 'all' || a.cat === V.tab; });
    items = items.map(function(a, i){ return {a:a, i:i}; }).sort(function(x, y){ return (!!U[y.a.id] - !!U[x.a.id]) || (x.i - y.i); }).map(function(x){ return x.a; });
    var note = V.tab === 'openings' ? '<p class="hint" style="margin:0 0 12px;">Openings are counted from your finished Standard games, using the opening book.</p>' : '';
    scrA.innerHTML =
      '<div class="card"><div class="ac-sum"><div><div class="big">' + have + ' / ' + total + '</div><div class="hint" style="margin:4px 0 0;">achievements unlocked</div></div>' +
        '<div class="grow"><div class="ac-bar"><div style="width:' + (have / total * 100).toFixed(0) + '%"></div></div>' +
        '<div class="hint" style="margin-top:12px;">Pinned on your profile (up to 3):</div>' +
        (pins.length ? '<div class="ac-chips" style="margin-top:6px;">' + pins.map(function(id){ var a = BYID[id]; return '<span class="ac-chip">' + badgeHtml(a, false, true) + esc(a.name) + '</span>'; }).join('') + '</div>' : '<div class="hint" style="margin-top:4px;">None yet. Unlock a badge and press Pin on it.</div>') +
        '</div></div></div>' +
      '<div class="ac-tabs">' + tabs + '</div>' + note + '<div class="ac-grid">' + items.map(cardHtml).join('') + '</div>';
    scrA.querySelectorAll('[data-tab]').forEach(function(t){ t.onclick = function(){ V.tab = t.dataset.tab; renderAch(); }; });
    scrA.querySelectorAll('[data-pin]').forEach(function(b){ b.onclick = function(){ togglePin(b.dataset.pin); }; });
  }

  async function togglePin(id){
    if(!ME || !V.U[id]) return;
    var p = V.pin.filter(function(x){ return V.U[x]; });
    var i = p.indexOf(id);
    if(i >= 0) p.splice(i, 1); else if(p.length < 3) p.push(id); else return;
    V.pin = p; renderAch();
    try{ await db.ref('hb/achievements/' + ME.username + '/pin').set(p.length ? p : null); }
    catch(e){ console.error('pin failed', e); }
  }

  function renderAchievements(){
    showScreen('achievements');
    renderAch();
    evalAll();
  }

  // =====================================================================
  //  6. counting: finished games
  // =====================================================================
  function funFlags(g, log, side, win){
    var out = {f1:false, f2:false, f3:false, f4:false}, n = log.length, VAL = {p:1, n:3, b:3, r:5, q:9, k:0};
    var myMoves = side === 'w' ? Math.ceil(n / 2) : Math.floor(n / 2);
    if(win && /#$/.test(log[n - 1]) && myMoves < 15) out.f1 = true;
    if(win && g.statusNote === 'won on time' && g.clock && g.clock.initialSec > 0){
      var left = side === 'w' ? g.clock.whiteMs : g.clock.blackMs;
      if(typeof left === 'number' && left >= 0 && left < 5000) out.f2 = true;
    }
    var c = new Chess(), run = 0, best = 0;
    try{
      for(var i = 0; i < n; i++){
        var mv = c.move(log[i]);
        if(!mv) break;
        if((i % 2 === 0) !== (side === 'w')) continue;          // only after my own moves
        if(/=N/.test(mv.san)) out.f4 = true;
        var d = 0;
        c.board().forEach(function(row){ row.forEach(function(p){ if(p) d += (p.color === side ? 1 : -1) * (VAL[p.type] || 0); }); });
        run = d <= -5 ? run + 1 : 0;
        if(run > best) best = run;
      }
    }catch(e){}
    if(win && best >= 3) out.f3 = true;                         // down 5+ points for 3 of my moves in a row, then won
    return out;
  }

  function onFinished(g, gid){
    if(!ME || SEEN[gid] || g.status !== 'finished' || !g.winner || g.winner === 'abort') return;
    var log = g.moveLog || [], me = myRole(g);
    if(!me || log.length < 2) return;
    SEEN[gid] = 1;
    var side = me.side, win = g.winner === side, isAuc = g.variant === 'auction', isStd = g.variant === 'standard', isTeam = g.mode === 'team';
    var fam = null, f = {};
    try{ if(isStd) fam = familyOf(openingName(log)); }catch(e){ console.error(e); }
    try{ if(!isAuc) f = funFlags(g, log, side, win); }catch(e){ console.error(e); }
    db.ref('hb/achievements/' + ME.username + '/c').transaction(function(c){
      c = c || {};
      var sg = c.sg || [];
      if(sg.indexOf(gid) >= 0) return;
      sg = sg.concat([gid]); if(sg.length > 40) sg = sg.slice(-40);
      c.sg = sg; c.gp = (c.gp || 0) + 1;
      if(win){ c.wn = (c.wn || 0) + 1; c.ws = (c.ws || 0) + 1; if(c.ws > (c.bw || 0)) c.bw = c.ws; } else c.ws = 0;
      if(win && isAuc) c.aw = 1;
      if(win && !isAuc && !isStd) c.hw = 1;
      if(win && isTeam) c.tw = 1;
      if(fam){ var op = c.op || (c.op = {}), o = op[fam.k] || (op[fam.k] = {p:0, w:0}); o.p = (o.p || 0) + 1; if(win) o.w = (o.w || 0) + 1; }
      if(f.f1) c.f1 = 1; if(f.f2) c.f2 = 1; if(f.f3) c.f3 = 1; if(f.f4) c.f4 = 1;
      return c;
    }).then(function(){ scheduleEval(4500); }).catch(function(e){ console.error('achievement counters failed', e); });
    try{ recordSignals(g, gid, log, side, win, isAuc, isTeam); }catch(e){ console.error(e); }
  }

  // =====================================================================
  //  7. fair-play signals recorded per game (hints for a human, never automatic bans)
  // =====================================================================
  var TAB = {gid:null, leaves:0, turnLeft:{}, away:null, awayPly:0, awayMine:false};
  function activeMine(){
    var g = gameState, s = $('screen-game');
    if(!ME || !g || g.status !== 'active' || !s || s.style.display !== 'block' || !currentGameId) return null;
    return myRole(g) ? g : null;
  }
  function ensureTab(){
    if(TAB.gid !== currentGameId) TAB = {gid:currentGameId, leaves:0, turnLeft:{}, away:null, awayPly:0, awayMine:false};
  }
  function goAway(){
    if(TAB.away && TAB.gid === currentGameId) return;
    var g = activeMine(); if(!g) return;
    ensureTab();
    TAB.away = Date.now(); TAB.awayPly = (g.moveLog || []).length; TAB.awayMine = g.turn === myRole(g).side;
  }
  function comeBack(){
    if(!TAB.away) return;
    var dur = Date.now() - TAB.away, g = activeMine();
    TAB.away = null;
    if(dur < 2500 || !g || TAB.gid !== currentGameId) return;
    TAB.leaves++;
    var ply = (g.moveLog || []).length;
    if(g.turn === myRole(g).side && (TAB.awayMine || ply !== TAB.awayPly)) TAB.turnLeft[ply] = 1;   // gone during my turn
  }
  document.addEventListener('visibilitychange', function(){ if(document.hidden) goAway(); else comeBack(); });
  window.addEventListener('blur', goAway);
  window.addEventListener('focus', comeBack);

  function recordSignals(g, gid, log, side, win, isAuc, isTeam){
    if(log.length < 10) return;
    var t = (TAB.gid === gid) ? TAB : {leaves:0, turnLeft:{}};
    var mine = [], i;
    for(i = 0; i < log.length; i++) if((i % 2 === 0) === (side === 'w')) mine.push(i);
    var mv = 0, run = 0, cur = 0, rep = 0;
    if(!isAuc){
      mine.forEach(function(p){
        if(t.turnLeft[p]){ mv++; cur++; if(cur > run) run = cur; if(cur === 2) rep++; } else cur = 0;
      });
    }
    var k = 0, mean = 0, cv = 0, even = 0;
    if(!isAuc && !isTeam){
      var times = g.moveTimes || [];
      var a = mine.slice(4).map(function(p){ return times[p]; }).filter(function(x){ return typeof x === 'number' && x >= 0; });
      if(a.length >= 12){
        k = a.length;
        var m = a.reduce(function(s, x){ return s + x; }, 0) / k;
        var sd = Math.sqrt(a.reduce(function(s, x){ return s + (x - m) * (x - m); }, 0) / k);
        var sorted = a.slice().sort(function(x, y){ return x - y; }), med = sorted[Math.floor(k / 2)] || 1;
        mean = Math.round(m / 100) / 10; cv = m > 0 ? Math.round(sd / m * 100) / 100 : 0;
        even = Math.round(a.filter(function(x){ return x >= med * 0.7 && x <= med * 1.3; }).length / k * 100);
      }
    }
    db.ref('hb/cheatByUser/' + ME.username + '/' + gid).set({
      ts:TS, num:g.num || 0, v:isAuc ? 'a' : (isTeam ? 't' : (g.variant === 'standard' ? 's' : 'h')), pl:log.length,
      res:g.winner === 'draw' ? 'd' : (win ? 'w' : 'l'), tabs:t.leaves || 0, mv:mv, run:run, rep:rep, k:k, mean:mean, cv:cv, even:even
    }).catch(function(e){ console.error('signals not saved (publish the new Firebase rules)', e); });
  }

  // engine match, worked out when a game is analyzed
  function engStats(A){
    if(A.engineKind !== 'stockfish') return null;
    var skip = (A.book && A.book.length) || 0, n = 0, t1 = 0, t3 = 0;
    for(var i = skip; i < A.moves.length; i++){
      if(A.moves[i].color !== A.me) continue;
      var e = A.ev[i], s = A.stats[i];
      if(!e || !e.best || !s) continue;
      try{ if(new Chess(A.fens[i]).moves().length < 2) continue; }catch(x){ continue; }
      n++;
      if(s.uci === e.best){ t1++; t3++; }
      else if((e.alts || []).some(function(a){ return a.best === s.uci; })) t3++;
    }
    return n >= 10 ? {n:n, top1:Math.round(t1 / n * 100), top3:Math.round(t3 / n * 100)} : null;
  }
  var lastA = null;
  function checkAnalysis(){
    var A = window.__anHook && window.__anHook.data();
    if(!A || !ME || !A.stats || !A.stats.length) return;
    if(A !== lastA){
      lastA = A;
      db.ref('hb/achievements/' + ME.username + '/c/an').transaction(function(n){ return (n || 0) + 1; })
        .then(function(){ scheduleEval(1200); }).catch(function(e){ console.error(e); });
      try{
        var es = engStats(A), nm = (A.me === 'w' ? A.hdr.White : A.hdr.Black) || '';
        if(es && NAME_RE.test(nm) && (nm === ME.username || isAdmin())){
          var m = /#(\d+)/.exec(A.hdr.Event || ''), key = m ? 'n' + m[1] + A.me : 'a' + Date.now().toString(36);
          db.ref('hb/cheatEng/' + nm + '/' + key).set({n:es.n, top1:es.top1, top3:es.top3, ts:TS, by:ME.username, side:A.me,
            ev:String(A.hdr.Event || '').slice(0, 40), res:String(A.hdr.Result || '').slice(0, 8)}).catch(function(e){ console.error(e); });
        }
      }catch(e){ console.error(e); }
    }
    if(!A.__achBr && A.c45){
      var hit = Object.keys(A.c45).some(function(k){ return A.c45[k] && A.c45[k].f && A.c45[k].f.brill; });
      if(hit){
        A.__achBr = 1;
        db.ref('hb/achievements/' + ME.username + '/c/br').set(1).then(function(){ scheduleEval(800); }).catch(function(e){ console.error(e); });
      }
    }
  }
  var anScr = $('screen-analyze');
  if(anScr) new MutationObserver(checkAnalysis).observe(anScr, {childList:true, subtree:true});

  // beating the Expert bot (bot games are not stored anywhere, so read the result screen)
  var botCounted = false;
  setInterval(function(){
    try{
      var scr = $('screen-bot');
      if(!scr || !ME) return;
      var b = scr.querySelector('.result-banner');
      if(!b){ botCounted = false; return; }
      if(botCounted) return;
      botCounted = true;
      if(!/^\s*You win/i.test(b.textContent || '')) return;
      var plies = 0; scr.querySelectorAll('.move-white, .move-black').forEach(function(e){ if((e.textContent || '').trim()) plies++; });
      var skill = 0; try{ skill = +(JSON.parse(localStorage.getItem('pawniac-bot') || '{}').skill) || 0; }catch(e){}
      if(skill >= 20 && plies >= 2) db.ref('hb/achievements/' + ME.username + '/c/be').set(1).then(function(){ scheduleEval(800); }).catch(function(e){ console.error(e); });
    }catch(e){ console.error(e); }
  }, 700);

  // day streak
  var STR = {day:null};
  function touchStreak(){
    if(!ME) return;
    var today = localDay(); STR.day = today;
    db.ref('hb/achievements/' + ME.username + '/c').transaction(function(c){
      c = c || {};
      if(c.sl === today) return;
      var diff = c.sl ? dayNum(today) - dayNum(c.sl) : null;
      if(diff === 1) c.sc = (c.sc || 0) + 1;
      else if(diff !== null && diff < 0) return;
      else c.sc = 1;
      c.sl = today; if(c.sc > (c.sb || 0)) c.sb = c.sc;
      return c;
    }).then(function(){ scheduleEval(800); }).catch(function(e){ console.error('streak failed', e); });
  }

  // =====================================================================
  //  8. reporting a player (profiles only)
  // =====================================================================
  var REASONS = [['cheat', 'Cheating or engine use', 'Playing with outside help.'], ['abuse', 'Abuse or harassment', 'Including offensive names, bios or profile pictures.'],
                 ['stall', 'Stalling or abandoning games', 'Leaving games, running out the clock, refusing to finish.'], ['other', 'Something else', 'Tell us more in the note.']];
  function closeReport(){ var o = $('rpOv'); if(o && o.parentNode) o.parentNode.removeChild(o); }
  function openReport(name){
    if(!ME || name === ME.username || !NAME_RE.test(name)) return;
    closeReport();
    var pick = null;
    var ov = document.createElement('div'); ov.id = 'rpOv'; ov.className = 'ch-ov';
    ov.addEventListener('mousedown', function(e){ if(e.target === ov) closeReport(); });
    ov.innerHTML = '<div class="ch-box" role="dialog" aria-label="Report ' + esc(name) + '"><h2>Report ' + esc(name) + '</h2>' +
      '<div class="hint" style="margin:0 0 4px;">Reports are private and reviewed by a person. False reports can get your own account restricted.</div>' +
      '<div class="lbl">Reason</div>' + REASONS.map(function(r){ return '<button class="rp-opt" data-r="' + r[0] + '">' + esc(r[1]) + '<small>' + esc(r[2]) + '</small></button>'; }).join('') +
      '<div class="lbl">Note (optional)</div><textarea class="pf-edit" id="rpNote" maxlength="300" placeholder="What happened? A game number helps."></textarea>' +
      '<div class="rp-err" id="rpErr"></div>' +
      '<div class="ch-acts"><button id="rpSend">Send report</button><button class="secondary" id="rpCancel">Cancel</button></div></div>';
    document.body.appendChild(ov);
    ov.querySelectorAll('[data-r]').forEach(function(b){ b.onclick = function(){ pick = b.dataset.r; ov.querySelectorAll('[data-r]').forEach(function(x){ x.classList.toggle('active', x === b); }); }; });
    $('rpCancel').onclick = closeReport;
    $('rpSend').onclick = async function(){
      var err = $('rpErr'), btn = this;
      if(!pick){ err.textContent = 'Pick a reason first.'; return; }
      btn.disabled = true; err.textContent = '';
      var day = dayKey(), limRef = db.ref('hb/reportLimits/' + ME.username + '/' + day);
      try{
        var lim = (await limRef.once('value')).val() || {};
        if((lim.n || 0) >= DAILY_LIMIT){ err.textContent = 'You have reached today\'s limit of ' + DAILY_LIMIT + ' reports. Try again tomorrow.'; btn.disabled = false; return; }
        if(lim.t && lim.t[name]){ err.textContent = 'You already reported ' + name + ' today.'; btn.disabled = false; return; }
        var id = day + '_' + ME.username + '_' + name;
        await db.ref('hb/reports/' + id).set({from:ME.username, to:name, reason:pick, note:($('rpNote').value || '').trim().slice(0, 300), status:'open', ts:TS, day:day});
        var t = lim.t || {}; t[name] = 1;
        await limRef.set({n:(lim.n || 0) + 1, t:t});
        closeReport();
        showToast('<div><div class="ac-tt">Report sent</div><div class="ac-tn">Thank you</div><div class="ac-td">A moderator will take a look.</div></div>');
      }catch(e){
        console.error('report failed', e);
        err.textContent = (e && e.code === 'PERMISSION_DENIED') ? 'Could not send. You may already have reported this player today.' : 'Could not send the report. Try again.';
        btn.disabled = false;
      }
    };
  }
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape') closeReport(); });

  // =====================================================================
  //  9. signals summary (staff only) + the Reports page
  // =====================================================================
  function listOf(path, n){
    return db.ref(path).orderByChild('ts').limitToLast(n).once('value').then(function(s){
      var out = []; s.forEach(function(c){ var v = c.val(); if(v){ v.key = c.key; out.push(v); } });
      return out.reverse();
    });
  }
  function flagsOf(r){
    var f = [];
    if(r.tabs >= 5) f.push('left the tab ' + r.tabs + ' times');
    if(r.mv >= 3 && r.run >= 2) f.push('left the tab right before ' + r.mv + ' of their moves (up to ' + r.run + ' in a row)');
    if(r.k >= 15 && r.cv < 0.4) f.push('very even move times (spread ' + r.cv + ', ' + r.even + '% within 30% of the median)');
    return f;
  }
  async function signalsHtml(name){
    var rows = [], eng = [];
    try{
      var res = await Promise.all([listOf('hb/cheatByUser/' + name, 15), listOf('hb/cheatEng/' + name, 10)]);
      rows = res[0]; eng = res[1];
    }catch(e){ console.error(e); return '<div class="sg-box">Could not load the signals (publish the new Firebase rules).</div>'; }
    if(!rows.length && !eng.length) return '<div class="sg-box">No fair-play data recorded for ' + esc(name) + ' yet.</div>';
    await Promise.all(rows.map(function(r){
      if(r.num) return null;
      return db.ref('hb/game/' + r.key + '/num').once('value').then(function(s){ if(s.exists()) r.num = s.val(); }).catch(function(){});
    }));
    var flagged = rows.filter(function(r){ return flagsOf(r).length; }).length;
    var h = '<div class="sg-box"><b>Fair-play signals for ' + esc(name) + '</b><div class="hint" style="margin:2px 0 8px;">Hints only. They cannot prove anything, so look at the games before deciding.</div>';
    if(rows.length){
      h += '<div><b>Recent games</b> (' + flagged + ' of ' + rows.length + ' flagged)</div>';
      rows.forEach(function(r){
        var f = flagsOf(r), res = r.res === 'w' ? 'win' : (r.res === 'l' ? 'loss' : 'draw');
        h += '<div class="sg-row"><span class="' + (f.length ? '' : 'sg-ok') + '">' + (r.num ? '<span class="gh-n" data-gn="' + r.num + '">#' + r.num + '</span>' : esc(r.key)) + ' &middot; ' + res + ' &middot; ' + r.pl + ' plies &middot; left tab ' + r.tabs + 'x' +
          (r.k ? ' &middot; avg ' + r.mean + 's/move, spread ' + r.cv : '') + '</span> ' + f.map(function(x){ return '<span class="sg-flag">' + esc(x) + '</span>'; }).join('') + '</div>';
      });
    }
    if(eng.length){
      h += '<div style="margin-top:8px;"><b>Engine match</b> (from analyzed games)</div>';
      eng.forEach(function(e){
        var hi = e.top1 >= 70 && e.n >= 20;
        h += '<div class="sg-row"><span class="' + (hi ? '' : 'sg-ok') + '">' + esc(e.ev || 'game') + ' as ' + (e.side === 'w' ? 'White' : 'Black') + ': top move ' + e.top1 + '%, top 3 ' + e.top3 + '% over ' + e.n + ' moves</span> ' +
          (hi ? '<span class="sg-flag">unusually high top-move match</span>' : '') + '</div>';
      });
      h += '<div class="hint" style="margin-top:6px;">Typical human play matches the engine\'s first choice about 40 to 60% of the time. Strong players run higher, so this means little by itself.</div>';
    }
    return h + '</div>';
  }

  var R = {list:[], f:'open'};
  function openCount(){ return R.list.filter(function(r){ return r.status !== 'done'; }).length; }
  function paintNavCount(){
    var l = nav.querySelector('[data-nav="reports"]');
    if(l) l.textContent = 'Reports' + (R.loaded && openCount() ? ' (' + openCount() + ')' : '');
  }
  async function loadReports(){
    var s = await db.ref('hb/reports').orderByChild('ts').limitToLast(200).once('value'), out = [];
    s.forEach(function(c){ var v = c.val(); if(v){ v.id = c.key; out.push(v); } });
    out.sort(function(a, b){ return (b.ts || 0) - (a.ts || 0); });
    R.list = out; R.loaded = true; paintNavCount();
  }
  function reportHtml(r){
    var why = REASONS.filter(function(x){ return x[0] === r.reason; })[0];
    var dt = r.ts ? new Date(r.ts).toLocaleString(undefined, {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}) : '';
    return '<div class="rp-item' + (r.status === 'done' ? ' done' : '') + '" data-id="' + esc(r.id) + '"><div class="rp-top"><span><span class="rp-tag">' + esc(why ? why[1] : r.reason) + '</span>' +
      '<span class="user-link" data-user="' + esc(r.from) + '">' + esc(r.from) + '</span> reported <span class="user-link" data-user="' + esc(r.to) + '">' + esc(r.to) + '</span></span><span class="hint" style="margin:0;">' + esc(dt) + '</span></div>' +
      (r.note ? '<div class="rp-note">' + esc(r.note) + '</div>' : '') +
      '<div class="rp-acts"><button class="secondary" data-act="sig">Fair-play signals</button><button class="secondary" data-act="prof">Open profile</button><button data-act="' + (r.status === 'done' ? 'reopen' : 'done') + '">' + (r.status === 'done' ? 'Reopen' : 'Mark done') + '</button></div>' +
      '<div class="rp-sig"></div>' + (r.status === 'done' && r.doneBy ? '<div class="hint" style="margin:6px 0 0;">Done by ' + esc(r.doneBy) + '</div>' : '') + '</div>';
  }
  function drawReports(){
    if(scrR.style.display !== 'block') return;
    var list = R.list.filter(function(r){ return R.f === 'done' ? r.status === 'done' : r.status !== 'done'; });
    scrR.innerHTML = '<div class="card"><h2>Reports</h2><p class="desc">Only visible to staff. Signals are hints for you to review, never automatic.</p>' +
      '<div class="ac-tabs"><div class="ac-tab' + (R.f === 'open' ? ' active' : '') + '" data-f="open">Open<small>' + openCount() + '</small></div><div class="ac-tab' + (R.f === 'done' ? ' active' : '') + '" data-f="done">Done<small>' + (R.list.length - openCount()) + '</small></div></div>' +
      (list.length ? list.map(reportHtml).join('') : '<p class="desc" style="margin:0;">Nothing here.</p>') + '</div>';
    scrR.querySelectorAll('[data-f]').forEach(function(t){ t.onclick = function(){ R.f = t.dataset.f; drawReports(); }; });
    scrR.querySelectorAll('.rp-item').forEach(function(el){
      var r = R.list.filter(function(x){ return x.id === el.dataset.id; })[0];
      el.querySelectorAll('[data-act]').forEach(function(b){
        b.onclick = async function(){
          var a = b.dataset.act;
          if(a === 'prof'){ window.openProfile(r.to); return; }
          if(a === 'sig'){ var box = el.querySelector('.rp-sig'); box.innerHTML = '<div class="sg-box">Loading...</div>'; box.innerHTML = await signalsHtml(r.to); return; }
          try{
            if(a === 'done'){ await db.ref('hb/reports/' + r.id).update({status:'done', doneBy:ME.username, doneAt:serverNow()}); r.status = 'done'; r.doneBy = ME.username; }
            else { await db.ref('hb/reports/' + r.id).update({status:'open', doneBy:null, doneAt:null}); r.status = 'open'; r.doneBy = null; }
            paintNavCount(); drawReports();
          }catch(e){ console.error(e); alert('Could not update the report.'); }
        };
      });
    });
  }
  async function renderReports(){
    showScreen('reports');
    if(!isAdmin()){ scrR.innerHTML = card('Reports', 'This page is only for staff.'); return; }
    scrR.innerHTML = card('Reports', 'Loading...');
    try{ await loadReports(); drawReports(); }
    catch(e){ console.error(e); scrR.innerHTML = card('Reports', 'Could not load the reports (publish the new Firebase rules).'); }
  }

  // =====================================================================
  //  10. profiles: Report button, pinned badges, staff review card
  // =====================================================================
  function stillOn(name){
    var s = $('screen-profile'), n = s && s.querySelector('.pf-name');
    return !!(s && s.style.display === 'block' && n && n.textContent.indexOf(name) >= 0);
  }

  // ---------- profile badges (Founding Supporter, Bug Hunter) ----------
  // stored in Firebase at hb/badges/<username>/<badge_id>
  //   bug_hunter          = true
  //   founding_supporter  = true                                (badge only)
  //                       = "community-slug"                    (badge links to that card on the supporters page,
  //                                                              e.g. "magma-knights-chess-society")
  var BADGE_ORDER = ['founding_supporter', 'bug_hunter'];
  var BADGES = {
    founding_supporter: {
      name: 'Founding Supporter', cls: 'pn-gold',
      tip: 'An early believer. Backed Pawniac from its early stage and promoted it in their community.',
      icon: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 10H5L3 8z"/><rect x="5" y="19" width="14" height="2" rx="1"/></svg>'
    },
    bug_hunter: {
      name: 'Bug Hunter', cls: 'pn-green',
      tip: 'Found and reported a bug that helped make Pawniac better.',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="8" height="12" rx="4"/><path d="M9 8a3 3 0 0 1 6 0M12 12v8M8 12H4M16 12h4M8.5 16.5L5 19M15.5 16.5L19 19M8.5 10L5 7M15.5 10L19 7"/></svg>'
    }
  };

  // is this badge switched on for the user? (true, or for Founding Supporter a community slug)
  function badgeOn(id, v){
    return v === true || (id === 'founding_supporter' && typeof v === 'string' && v.length > 0);
  }
  // where the badge should take people: the owner's card on the supporters page (only for a valid slug)
  function badgeSlug(id, v){
    return (id === 'founding_supporter' && typeof v === 'string' && /^[a-z0-9-]{1,60}$/.test(v)) ? v : '';
  }

  function badgeCss(){
    if($('pnBadgeCss')) return;
    var s = document.createElement('style'); s.id = 'pnBadgeCss';
    s.textContent = `
.pn-badges{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
.pn-badge{position:relative;width:44px;height:44px;border-radius:12px;border:1px solid;display:grid;place-items:center;cursor:default;outline-offset:3px}
a.pn-badge{cursor:pointer;text-decoration:none}
.pn-badge svg{width:24px;height:24px;position:relative;z-index:1}
.pn-gold{color:#ffd777;background:linear-gradient(145deg,#6a4f1a,#2b2111 55%,#57421a);border-color:#d6a547;box-shadow:inset 0 1px 0 rgba(255,236,176,.4),inset 0 -6px 10px rgba(0,0,0,.25),0 0 16px rgba(240,185,74,.28)}
.pn-gold svg{filter:drop-shadow(0 0 5px rgba(255,200,80,.65))}
.pn-green{color:#8cf0a8;background:linear-gradient(145deg,#2c6a46,#12281c 55%,#265a3b);border-color:#4fbf7b;box-shadow:inset 0 1px 0 rgba(190,255,210,.35),inset 0 -6px 10px rgba(0,0,0,.25),0 0 16px rgba(111,207,138,.25)}
.pn-green svg{filter:drop-shadow(0 0 5px rgba(120,240,160,.6))}
.pn-badge::before{content:"";position:absolute;inset:1px;border-radius:inherit;background:linear-gradient(180deg,rgba(255,255,255,.22),rgba(255,255,255,0) 50%);pointer-events:none}
.pn-badge::after{content:"";position:absolute;inset:0;border-radius:inherit;background:linear-gradient(115deg,transparent 35%,rgba(255,255,255,.6) 50%,transparent 65%);background-size:250% 100%;background-position:160% 0;transition:background-position .7s ease;pointer-events:none}
.pn-badge:hover::after,.pn-badge:focus-visible::after{background-position:-60% 0}
.pn-tip{position:absolute;left:50%;bottom:calc(100% + 10px);transform:translate(-50%,4px);width:230px;background:#0f0e0d;border:1px solid #35332f;border-radius:10px;padding:10px 12px;font:12.5px/1.45 system-ui,sans-serif;color:#f2efe9;opacity:0;pointer-events:none;transition:opacity .15s,transform .15s;z-index:50;text-align:left}
.pn-tip b{display:block;font-size:13px;margin-bottom:3px}
.pn-tip i{display:block;margin-top:6px;font-style:normal;font-weight:600;color:#e8be6a}
.pn-tip::after{content:"";position:absolute;top:100%;left:50%;margin-left:-6px;border:6px solid transparent;border-top-color:#0f0e0d}
.pn-badge:hover .pn-tip,.pn-badge:focus-visible .pn-tip{opacity:1;transform:translate(-50%,0)}
@media (prefers-reduced-motion:reduce){.pn-badge::after,.pn-tip{transition:none}}
@media (max-width:480px){.pn-tip{width:190px}}`;
    document.head.appendChild(s);
  }

  async function decorateBadges(name, scr){
    if(!scr || scr.querySelector('#pfBadges')) return;
    var b = null;
    try{ b = await val('hb/badges/' + name); }catch(e){ return; }          // no badges / rules not published: show nothing
    if(!b || !stillOn(name) || scr.querySelector('#pfBadges')) return;
    var ids = BADGE_ORDER.filter(function(id){ return badgeOn(id, b[id]); });
    if(!ids.length) return;
    badgeCss();
    var box = document.createElement('div');
    box.id = 'pfBadges'; box.className = 'pn-badges';
    ids.forEach(function(id){
      var d = BADGES[id], slug = badgeSlug(id, b[id]), el = document.createElement(slug ? 'a' : 'div');
      el.className = 'pn-badge ' + d.cls;
      if(slug){ el.href = '#/supporters/' + slug; }
      else { el.tabIndex = 0; }
      el.setAttribute('aria-label', d.name + '. ' + d.tip + (slug ? ' Opens their community on the supporters page.' : ''));
      el.innerHTML = d.icon + '<span class="pn-tip"><b>' + d.name + '</b>' + d.tip + (slug ? '<i>Click to see their community</i>' : '') + '</span>';
      box.appendChild(el);
    });
    // right under the bio (built in script_07.js):
    //  - other people's profiles: <div class="pf-bio">
    //  - your own profile: <textarea id="pfBio"> followed by the "Save bio" row
    var bio = scr.querySelector('.pf-bio');
    var edit = scr.querySelector('#pfBio');
    if(bio) bio.after(box);
    else if(edit) (edit.nextElementSibling || edit).after(box);
    else { var first = scr.querySelector('.card'); if(first) first.appendChild(box); }
  }

  async function decorateProfile(name){
    if(!ME || !stillOn(name)) return;
    var scr = $('screen-profile');
    decorateBadges(name, scr);
    if(scr.querySelector('#pfAch')) return;
    // Report button (profiles of other players only)
    if(name !== ME.username && !scr.querySelector('#pfReport')){
      var b = document.createElement('button');
      b.id = 'pfReport'; b.className = 'secondary ch-btn'; b.textContent = 'Report';
      b.style.cssText = 'padding:4px 10px;font-size:11.5px;margin-left:10px;';
      b.onclick = function(){ openReport(name); };
      var host = scr.querySelector('.pf-status') || scr.querySelector('.pf-name');
      if(host.classList.contains('pf-status')) host.appendChild(b); else host.after(b);
    }
    var node = null;
    try{ node = await val('hb/achievements/' + name); }catch(e){ node = null; }
    if(!stillOn(name) || scr.querySelector('#pfAch')) return;
    var u = (node && node.u) || {}, pin = arr(node && node.pin).filter(function(id){ return u[id] && BYID[id]; }).slice(0, 3);
    var have = L.filter(function(a){ return u[a.id]; }).length;
    var c = document.createElement('div');
    c.className = 'card'; c.id = 'pfAch';
    c.innerHTML = '<h2>Achievements <span class="hint" style="font-weight:500;">' + have + ' / ' + L.length + '</span></h2>' +
      (pin.length ? '<div class="ac-chips">' + pin.map(function(id){ var a = BYID[id]; return '<span class="ac-chip" title="' + esc(a.desc) + '">' + badgeHtml(a, false, true) + esc(a.name) + '</span>'; }).join('') + '</div>'
                  : '<p class="desc" style="margin:0;">No pinned badges.</p>') +
      (name === ME.username ? '<div style="margin-top:12px;"><span class="backlink" id="pfAchAll">View all achievements</span></div>' : '');
    var first = scr.querySelector('.card');
    if(first) first.after(c); else scr.appendChild(c);
    var all = $('pfAchAll'); if(all) all.onclick = openPage;
    if(isAdmin()){
      var s = document.createElement('div');
      s.className = 'card'; s.id = 'pfStaff';
      s.innerHTML = '<h2>Fair-play review <span class="hint" style="font-weight:500;">staff only</span></h2><div id="pfStaffBody">Loading...</div>';
      c.after(s);
      var body = await signalsHtml(name), rep = '';
      try{
        var rs = await db.ref('hb/reports').orderByChild('to').equalTo(name).once('value'), tot = 0, open = 0;
        rs.forEach(function(x){ tot++; if((x.val() || {}).status !== 'done') open++; });
        rep = '<p class="an-note" style="margin:0 0 8px;">Reports against this player: <b>' + tot + '</b> (' + open + ' open).</p>';
      }catch(e){}
      var sb = $('pfStaffBody'); if(sb) sb.innerHTML = rep + body;
    }
  }

  // =====================================================================
  //  11. wiring into the rest of the site
  // =====================================================================
  var prevShow = window.showScreen, cur = null;
  window.showScreen = function(n){
    var was = cur; cur = n;
    prevShow(n);
    scrA.style.display = (n === 'achievements') ? 'block' : 'none';
    scrR.style.display = (n === 'reports') ? 'block' : 'none';
    if(n === 'achievements' || n === 'reports'){
      nav.querySelectorAll('[data-nav]').forEach(function(a){ a.classList.toggle('active', a.dataset.nav === n); });
      try{ history.replaceState(null, '', location.pathname + location.search + '#/' + n); }catch(e){}
    }
    if((was === 'minigames' || was === 'quiz') && n !== was && ME) scheduleEval(2500);   // minigame scores are saved when you leave
  };

  var prevDraw = window.drawGame;
  window.drawGame = function(){
    prevDraw();
    try{
      var g = gameState;
      if(g && currentGameId && g.status === 'active' && myRole(g)) ensureTab();
      if(g && g.status === 'finished' && currentGameId) onFinished(g, currentGameId);
    }catch(e){ console.error('achievements hook failed', e); }
  };

  var prevOpen = window.openProfile;
  window.openProfile = async function(name){
    var r = await prevOpen.apply(this, arguments);
    try{ await decorateProfile(name); }catch(e){ console.error('profile extras failed', e); }
    return r;
  };

  var ROUTE_A = /^#\/achievements\/?$/i, ROUTE_R = /^#\/reports\/?$/i, boot = true;
  function init(){
    if(!ME) return;
    if(V.user !== ME.username){ V = {S:null, U:{}, pin:[], tab:'all', err:null, user:ME.username}; R = {list:[], f:'open', loaded:false}; }
    setAdminNav();
    touchStreak();
    scheduleEval(2500);
    if(isAdmin() && !R.loaded) loadReports().catch(function(){});
  }
  var prevAfter = window.afterAuth;
  window.afterAuth = async function(){
    var h = boot ? location.hash : '';
    boot = false;
    var r = await prevAfter.apply(this, arguments);
    try{
      init();
      var gs = $('screen-game');
      if(h && !(gs && gs.style.display === 'block')){
        if(ROUTE_A.test(h)) renderAchievements();
        else if(ROUTE_R.test(h) && isAdmin()) renderReports();
      }
    }catch(e){ console.error(e); }
    return r;
  };
  window.addEventListener('hashchange', function(){
    if(!ME) return;
    if(ROUTE_A.test(location.hash)){ if(cur !== 'achievements' && leaveOk()){ stopPoll(); renderAchievements(); } }
    else if(ROUTE_R.test(location.hash)){ if(cur !== 'reports' && isAdmin() && leaveOk()){ stopPoll(); renderReports(); } }
  });

  // housekeeping: log out clears things; a new day counts for the streak
  setInterval(function(){
    try{
      if(!ME){
        if(V.user){ V = {S:null, U:{}, pin:[], tab:'all', err:null, user:null}; R = {list:[], f:'open', loaded:false}; setAdminNav(); }
        return;
      }
      if(STR.day && STR.day !== localDay()) touchStreak();
    }catch(e){}
  }, 60000);
})();
