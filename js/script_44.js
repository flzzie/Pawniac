(function(){
  var C = window.__anCtx, H = window.__anHook;
  if(!C || !H || typeof Chess === 'undefined') return;
  var VAL = C.VAL, NAMES = C.NAMES, FL = 'abcdefgh';
  var KN = [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]];
  var ORTH = [[1,0],[-1,0],[0,1],[0,-1]], DIAG = [[1,1],[1,-1],[-1,1],[-1,-1]];
  var BEST = ['You played the best move possible in this position.', 'Spot on, this is exactly what the engine wanted.', 'The best move here, and you found it.', 'Exactly right: no other move does better.', "That is the engine's number one choice."];

  // ---------------- small helpers ----------------
  function esc(s){ return String(s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function winPct(cp){ cp = Math.max(-1000, Math.min(1000, cp)); return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1); }
  function isM(cp){ return Math.abs(cp) >= 9000; }
  function fullNo(fen){ return parseInt(String(fen).split(' ')[5], 10) || 1; }
  function T(f){ try{ f(); }catch(e){ console.error('coach45', e); } }
  function sqn(r, f){ return FL[f] + (r + 1); }
  function relR(r, col){ return col === 'w' ? r + 1 : 8 - r; }
  function parse(fen){
    var rows = String(fen).split(' ')[0].split('/'), b = [];
    for(var i = 0; i < 8; i++){
      var row = [], s = rows[7 - i];
      for(var k = 0; k < s.length; k++){
        var ch = s[k];
        if(/\d/.test(ch)){ for(var z = 0; z < +ch; z++) row.push(null); }
        else row.push({t:ch.toLowerCase(), c:(ch === ch.toUpperCase() ? 'w' : 'b')});
      }
      b.push(row);
    }
    return b;   // b[rank-1][file]
  }
  function at(B, r, f){ return (r >= 0 && r < 8 && f >= 0 && f < 8) ? B[r][f] : undefined; }
  function attackers(B, r, f, col){
    var out = [], d = col === 'w' ? -1 : 1, p;
    [-1, 1].forEach(function(s){ p = at(B, r + d, f + s); if(p && p.c === col && p.t === 'p') out.push({r:r + d, f:f + s, t:'p'}); });
    KN.forEach(function(k){ p = at(B, r + k[0], f + k[1]); if(p && p.c === col && p.t === 'n') out.push({r:r + k[0], f:f + k[1], t:'n'}); });
    for(var a = -1; a <= 1; a++) for(var b = -1; b <= 1; b++){
      if(!a && !b) continue; p = at(B, r + a, f + b);
      if(p && p.c === col && p.t === 'k') out.push({r:r + a, f:f + b, t:'k'});
    }
    ORTH.concat(DIAG).forEach(function(dv, ix){
      var rr = r + dv[0], ff = f + dv[1];
      while(at(B, rr, ff) === null){ rr += dv[0]; ff += dv[1]; }
      var q = at(B, rr, ff);
      if(q && q.c === col && (q.t === 'q' || (ix < 4 ? q.t === 'r' : q.t === 'b'))) out.push({r:rr, f:ff, t:q.t});
    });
    return out;
  }
  function each(B, fn){ for(var r = 0; r < 8; r++) for(var f = 0; f < 8; f++) if(B[r][f]) fn(B[r][f], r, f); }
  function kingPos(B, col){ var k = null; each(B, function(p, r, f){ if(p.t === 'k' && p.c === col) k = {r:r, f:f}; }); return k; }
  function mat(B, col, noPawn){ var s = 0; each(B, function(p){ if(p.c === col && (!noPawn || p.t !== 'p')) s += VAL[p.t] || 0; }); return s; }
  function count(B, col, t){ var n = 0; each(B, function(p){ if(p.c === col && p.t === t) n++; }); return n; }
  function pawns(B, col){ var a = []; each(B, function(p, r, f){ if(p.c === col && p.t === 'p') a.push({r:r, f:f}); }); return a; }
  function passedList(B, col){
    var en = pawns(B, col === 'w' ? 'b' : 'w');
    return pawns(B, col).filter(function(p){
      return !en.some(function(e){ return Math.abs(e.f - p.f) <= 1 && (col === 'w' ? e.r > p.r : e.r < p.r); });
    });
  }
  function isoList(B, col){
    var mine = pawns(B, col);
    return mine.filter(function(p){ return !mine.some(function(q){ return Math.abs(q.f - p.f) === 1; }); });
  }
  function keys(a){ return a.map(function(p){ return p.r * 8 + p.f; }); }
  function pureKP(B){ var ok = true; each(B, function(p){ if(p.t !== 'p' && p.t !== 'k') ok = false; }); return ok; }
  function kOpp(B){
    var a = kingPos(B, 'w'), b = kingPos(B, 'b'); if(!a || !b) return false;
    return (a.f === b.f && Math.abs(a.r - b.r) === 2) || (a.r === b.r && Math.abs(a.f - b.f) === 2);
  }
  function hasQueen(B){ var q = false; each(B, function(p){ if(p.t === 'q') q = true; }); return q; }
  function reach(B, r, f, enemy){   // can an enemy knight (2 hops) or a same-coloured bishop reach this square?
    var hit = false;
    each(B, function(p, pr, pf){
      if(p.c !== enemy) return;
      if(p.t === 'b' && (pr + pf) % 2 === (r + f) % 2) hit = true;
      if(p.t === 'n'){
        KN.forEach(function(k){
          var r1 = pr + k[0], f1 = pf + k[1];
          if(r1 === r && f1 === f) hit = true;
          KN.forEach(function(k2){ if(r1 + k2[0] === r && f1 + k2[1] === f) hit = true; });
        });
      }
    });
    return hit;
  }
  function lineMat(fen, ucis, n, col){
    var c = new Chess(fen), B0 = parse(fen), oc = col === 'w' ? 'b' : 'w', base = mat(B0, col) - mat(B0, oc), d = [], cap = [];
    for(var k = 0; k < Math.min(n, ucis.length); k++){
      var u = ucis[k], mv = c.move({from:u.slice(0, 2), to:u.slice(2, 4), promotion:u[4]});
      if(!mv) break;
      var B = parse(c.fen()); d.push(mat(B, col) - mat(B, oc) - base); cap.push(mv.captured || null);
    }
    return {d:d, cap:cap};
  }
  function endLine(fen, ucis, n){
    var c = new Chess(fen), used = 0;
    for(var k = 0; k < Math.min(n, ucis.length); k++){
      var u = ucis[k], mv = c.move({from:u.slice(0, 2), to:u.slice(2, 4), promotion:u[4]});
      if(!mv) break; used++;
    }
    return {stale: used === ucis.length && used > 0 && c.moves().length === 0 && !c.in_check(), side:c.turn()};
  }
  function mob(fen, sq, col){ return new Chess(C.flipTurn(fen, col)).moves({square:sq, verbose:true}).length; }
  function trapped(fen, vcol){
    var att = vcol === 'w' ? 'b' : 'w', res = [];
    C.winsFor(fen, att).forEach(function(w){
      if(w.piece === 'p' || w.piece === 'k' || VAL[w.piece] < 3) return;
      var mv = new Chess(C.flipTurn(fen, vcol)).moves({square:w.to, verbose:true}), safe = false;
      mv.forEach(function(x){
        if(safe) return;
        var c2 = new Chess(C.flipTurn(fen, vcol)); c2.move({from:x.from, to:x.to, promotion:x.promotion});
        if(!C.winsFor(c2.fen(), att).some(function(y){ return y.to === x.to; })) safe = true;
      });
      if(!safe) res.push({sq:w.to, piece:w.piece});
    });
    return res;
  }
  function boxed(B, col){   // back-rank king with no escape square and an enemy rook/queen able to reach that rank
    var kp = kingPos(B, col), en = col === 'w' ? 'b' : 'w', br = col === 'w' ? 0 : 7;
    if(!kp || kp.r !== br || (kp.f > 2 && kp.f < 5)) return null;
    var __own = false; each(B, function(p, r, f){ if(p.c === col && (p.t === 'r' || p.t === 'q') && r === br) __own = true; });
    if(__own) return null;
    for(var a = -1; a <= 1; a++) for(var b = -1; b <= 1; b++){
      if((!a && !b) || !a) continue; var r = kp.r + a, f = kp.f + b, p = at(B, r, f);   // sideways squares are covered by the checking rook, so only forward squares count
      if(p === undefined || (col === 'w' ? a < 0 : a > 0)) continue; if(p && p.c === col) continue;
      if(!attackers(B, r, f, en).length) return null;
    }
    var can = false;
    each(B, function(p, r, f){
      if(p.c !== en || (p.t !== 'r' && p.t !== 'q')) return;
      if(r === br){ can = true; return; }
      var dirs = p.t === 'r' ? ORTH : ORTH.concat(DIAG);
      dirs.forEach(function(dv){
        var rr = r + dv[0], ff = f + dv[1];
        while(at(B, rr, ff) === null){ if(rr === br) can = true; rr += dv[0]; ff += dv[1]; }
        if(rr === br && at(B, rr, ff) === undefined) return;
      });
    });
    return can ? kp : null;
  }
  function mateThreat(fen, vc){
    try{
      var en = vc === 'w' ? 'b' : 'w';
      return new Chess(C.flipTurn(fen, en)).moves({verbose:true}).some(function(x){ return /#$/.test(x.san) && (x.piece === 'r' || x.piece === 'q'); });
    }catch(e){ return false; }
  }
  function lufts(B, col, kp){
    var best = null, dir = col === 'w' ? 1 : -1;
    for(var f = kp.f - 1; f <= kp.f + 1; f++){
      var p = at(B, kp.r + dir, f);
      if(p && p.c === col && p.t === 'p' && at(B, kp.r + 2 * dir, f) === null){
        if(!best || Math.abs(f - 3.5) > Math.abs(best.f - 3.5)) best = {f:f, r:kp.r + 2 * dir};
      }
    }
    return best ? sqn(best.r, best.f) : null;
  }
  function removesGuard(fen, ucis, col){
    var c = new Chess(fen), u = ucis, m0 = c.move({from:u[0].slice(0, 2), to:u[0].slice(2, 4), promotion:u[0][4]});
    if(!m0 || !m0.captured || u.length < 3) return null;
    var m1 = c.move({from:u[1].slice(0, 2), to:u[1].slice(2, 4), promotion:u[1][4]}); if(!m1) return null;
    var m2 = c.move({from:u[2].slice(0, 2), to:u[2].slice(2, 4), promotion:u[2][4]}); if(!m2 || !m2.captured) return null;
    var c0 = new Chess(fen), gp = c0.get(m0.to); if(!gp) return null;
    c0.remove(m0.to);
    var w1 = C.winsFor(fen, col).some(function(x){ return x.to === m2.to; });
    var w2 = C.winsFor(c0.fen(), col).some(function(x){ return x.to === m2.to; });
    var L = lineMat(fen, u, 3, col);
    if(!w1 && w2 && L.d.length === 3 && L.d[2] >= 1) return {g:gp.type, gsq:m0.to, tsq:m2.to, line:C.sanLine(fen, u, 3)};
    return null;
  }
  function mvText(A, j){ var m = A.moves[j]; return fullNo(A.fens[j]) + (m.color === 'w' ? '.' : '...') + m.san; }

  // ---------------- the detectors: everything for one move ----------------
  function gen(A, i){
    A.c45 = A.c45 || {};
    if(A.c45[i]) return A.c45[i];
    var m = A.moves[i], S = A.stats[i], evB = A.ev[i], evA = A.ev[i + 1], fenB = A.fens[i], fenA = A.fens[i + 1];
    var col = m.color, oc = col === 'w' ? 'b' : 'w', mine = col === A.me, sg = col === 'w' ? 1 : -1;
    var cpB = S.cpBefore, cpA = S.cpAfter, BB = parse(fenB), BA = parse(fenA), fl = m.flags || '';
    var castle = fl.indexOf('k') >= 0 || fl.indexOf('q') >= 0;
    var o = {pros:[], cons:[], notes:[], tips:[], chip:null, f:{}};
    A.c45[i] = o;
    if(isM(cpB) || isM(cpA)) return o;
    function good(a, b){ if(mine) o.pros.push(a); else o.notes.push(b || a); }
    function bad(a, b){ if(mine) o.cons.push(a); else o.notes.push(b || a); }
    var pv0 = [S.uci].concat(evA.pv || []);

    // ---- sacrifice / brilliant (mine)
    T(function(){
      if(!mine || S.label === 'book') return;
      var L = lineMat(fenB, pv0, 5, col); if(L.d.length < 3) return;
      var dip = 0, k0 = -1, k;
      for(k = 1; k < L.d.length; k += 2) if(L.d[k] < dip){ dip = L.d[k]; k0 = k; }
      var last = L.d.length % 2 ? L.d.length - 1 : L.d.length - 2, fin = L.d[last];
      var __thr = C.winsFor(fenA, oc).filter(function(w){ return w.net >= 2; }); var __pm = i >= 1 ? A.moves[i - 1] : null; var __rec = !!(__pm && __pm.color !== col && __pm.captured && m.captured && m.to === __pm.to); if(dip <= -2 && fin >= 0 && S.loss < 4 && cpA > -150 && __thr.length && !__rec && (__thr[0].net - (m.captured ? VAL[m.captured] : 0)) >= 2){
        var lost = NAMES[L.cap[k0]] || 'piece';
        if(S.uci === evB.best && cpB < 250 && fin >= 1){ o.chip = {t:'Brilliant', c:'#1baca6'}; o.f.brill = 1; o.pros.push('You gave up a ' + lost + ' here, but the line shows you win it back with interest.'); }
        else { o.f.sac = 1; o.pros.push('Sacrifice that works: you give up a ' + lost + ', and the engine line shows it pays back.'); }
      }
    });
    // ---- only move (mine)
    T(function(){
      if(!mine || S.uci !== evB.best || !evB.alts || !evB.alts.length || Math.abs(cpB) >= 350) return;
      var a0 = evB.alts[0];
      if(winPct(sg * (a0.ref !== undefined ? a0.ref : evB.cp)) - winPct(sg * a0.cp) < 20) return;
      var why = null;
      if(isM(a0.cp) && sg * a0.cp < 0) why = 'allow checkmate in ' + Math.max(1, Math.round((10000 - Math.abs(a0.cp)) / 10));
      else {
        var L = lineMat(fenB, a0.pv, 6, col);
        for(var k = 1; k < L.d.length; k += 2) if(L.d[k] <= -1){ why = 'lose a ' + NAMES[L.cap[k]]; break; }
      }
      o.f.only = 1;
      o.notes.push('There was only one good move here, and you found it. Every other move would ' + (why || 'let the evaluation slide a long way') + '.');
    });
    // ---- punished their mistake / let them off
    T(function(){
      if(!mine || i < 1 || A.moves[i - 1].color === col) return;
      var pS = A.stats[i - 1];
      if(['inaccuracy', 'mistake', 'blunder'].indexOf(pS.label) < 0 || isM(pS.cpBefore) || isM(pS.cpAfter)) return;
      if(S.label === 'best' || S.label === 'excellent'){ o.f.punish = 1; o.pros.push('They slipped, and you made them pay.'); }
      else if(S.loss >= 5 && evB.best && S.uci !== evB.best){
        var bs = C.tryMove(fenB, evB.best); if(bs) o.cons.push('They slipped here and you let them off. Better was ' + bs.san + '.');
      }
    });
    // ---- greedy pawn grab
    T(function(){
      if(m.captured !== 'p' || S.loss < 10) return;
      var rep = evA.best ? C.tryMove(fenA, evA.best) : null;
      if(rep && (/[+#]/.test(rep.san) || C.winsFor(fenA, oc).some(function(w){ return w.net >= 2; })))
        bad('Taking this pawn cost you time and safety. Sometimes a pawn is bait.', 'Their pawn grab looks greedy: you can punish it with ' + rep.san + '.');
    });
    // ---- desperado
    T(function(){
      var thr = C.winsFor(fenB, oc).filter(function(w){ return w.to === m.from && VAL[w.piece] >= 3; });
      if(!thr.length) return;
      var still = function(sq){ return C.winsFor(fenA, oc).some(function(w){ return w.to === sq; }); };
      if(m.captured && still(m.to)) good('The ' + NAMES[m.piece] + ' was lost anyway, so taking a ' + NAMES[m.captured] + ' with it first was smart.', 'Their ' + NAMES[m.piece] + ' was lost anyway, so they grabbed a ' + NAMES[m.captured] + ' with it first.');
      else if(mine && S.loss >= 3 && still(thr[0].to)){
        var cp = C.capsFor(fenB, col).filter(function(x){ return x.from === thr[0].to && x.captured; })[0];
        if(cp) o.cons.push('Your ' + NAMES[thr[0].piece] + ' on ' + thr[0].to + ' was lost anyway. It could have taken a ' + NAMES[cp.captured] + ' on ' + cp.to + ' first.');
      }
    });
    // ---- zwischenzug
    T(function(){
      if(!mine || i < 1) return;
      var pv = A.moves[i - 1];
      if(pv.color === col || !pv.captured || (m.captured && m.to === pv.to) || S.label === 'blunder' || S.loss >= 5) return;
      if(!C.capsFor(fenB, col).some(function(x){ return x.to === pv.to && x.captured; })) return;
      if(/\+/.test(m.san)) o.pros.push('Instead of taking back, you inserted a check that wins more.');
      else if(C.capsFor(fenA, col).some(function(x){ return x.from === m.to && x.captured && VAL[x.captured] > VAL[pv.captured]; }) && !C.winsFor(fenA, oc).some(function(w){ return w.to === m.to; }))
        o.pros.push('Instead of taking back right away, you made a bigger threat first.');
    });
    // ---- recapture
    T(function(){
      if(!mine || i < 1) return;
      var pv = A.moves[i - 1];
      if(pv.color !== col && pv.captured && VAL[pv.captured] >= 3 && m.captured && m.to === pv.to){
        var P = parse(A.fens[i - 1]), Q = BA;
        if(mat(P, col) - mat(P, oc) === mat(Q, col) - mat(Q, oc)) o.notes.push('Takes back the piece, and material is level again.');
      }
    });
    // ---- exchange
    T(function(){
      var nx = A.moves[i + 1];
      if((m.piece === 'n' || m.piece === 'b') && m.captured === 'r') good('Wins the exchange: a rook for a minor piece.', 'They win the exchange: a rook for a minor piece.');
      else if(m.piece === 'r' && (m.captured === 'n' || m.captured === 'b') && nx && nx.captured === 'r' && nx.to === m.to) bad('Loses the exchange: you give a rook for a minor piece.', 'They lose the exchange: a rook for a minor piece.');
    });
    // ---- passive piece activated
    T(function(){
      if(!mine || (m.piece !== 'n' && m.piece !== 'b') || m.captured || castle || S.loss >= 5) return;
      var mb = mob(fenB, m.from, col), ma = mob(fenA, m.to, col), rim = m.piece === 'n' && (m.from[0] === 'a' || m.from[0] === 'h');
      if(m.piece === 'n' ? ((mb <= 3 || rim) && ma >= 5) : (mb <= 4 && ma >= 7)) { o.pros.push('Improves your worst-placed piece.'); o.f.activate = 1; }
    });
    // ---- pieces still at home (moves 10 to 16)
    T(function(){
      var fn = fullNo(fenB);
      if(!mine || fn < 10 || fn > 16 || S.loss < 5 || castle || m.captured || /[+#]/.test(m.san) || Math.abs(cpB) >= 400) return;
      if(new Chess(fenB).in_check()) return;
      if(C.winsFor(fenB, oc).some(function(w){ return w.net >= 2; })) return;
      var bm = evB.best ? C.tryMove(fenB, evB.best) : null; if(bm && /[x+#]/.test(bm.san)) return;
      var home = col === 'w' ? {b1:'n', g1:'n', c1:'b', f1:'b'} : {b8:'n', g8:'n', c8:'b', f8:'b'}, c = new Chess(fenB), hit = null;
      Object.keys(home).forEach(function(s){ var p = c.get(s); if(!hit && p && p.color === col && p.type === home[s] && s !== m.from) hit = {s:s, t:p.type}; });
      if(hit) o.cons.push('Your ' + NAMES[hit.t] + ' on ' + hit.s + ' is still undeveloped while you push on.');
    });
    // ---- trapped piece
    T(function(){
      if(S.loss < 0) return;
      [oc, col].forEach(function(vc){
        var after = trapped(fenA, vc); if(!after.length) return;
        var before = trapped(fenB, vc), t = after.filter(function(x){ return !before.some(function(y){ return y.sq === x.sq; }); })[0];
        if(!t) return;
        var txt = 'the ' + NAMES[t.piece] + ' on ' + t.sq;
        if(vc === oc && mine && cpA * 1 >= 100) o.pros.push('Traps ' + txt + ': it is attacked and every square it can reach gets captured, so you win it.');
        else if(vc === col && mine && S.loss >= 5){ o.cons.push('Leaves your ' + NAMES[t.piece] + ' on ' + t.sq + ' trapped.'); if(m.piece === 'p') o.tips.push('Before pushing pawns near a piece, check where it can retreat.'); }
        else if(!mine && vc === A.me) o.notes.push('Their move traps your ' + NAMES[t.piece] + ' on ' + t.sq + ': it is attacked and every square it can reach gets captured.');
        else if(!mine && vc === oc && S.loss >= 5) o.notes.push('Their ' + NAMES[t.piece] + ' on ' + t.sq + ' is trapped, so you can win it.');
      });
    });
    // ---- removing the defender
    T(function(){
      if(!mine) return;
      var g;
      if(S.loss < 3 && (g = removesGuard(fenB, pv0, col))) o.pros.push('Wins material by removing the guard: the ' + NAMES[g.g] + ' on ' + g.gsq + ' was guarding ' + g.tsq + '. ' + g.line + '.');
      else if(S.loss >= 5 && evB.best && S.uci !== evB.best && (g = removesGuard(fenB, evB.pv, col)))
        o.cons.push('You missed a way to win material by removing the guard. The ' + NAMES[g.g] + ' on ' + g.gsq + ' was guarding ' + g.tsq + ': ' + g.line + '.');
    });
    // ---- double check
    T(function(){
      var k = kingPos(BA, oc); if(!k || !/\+/.test(m.san)) return;
      if(attackers(BA, k.r, k.f, col).length >= 2)
        good('Double check: two pieces attack the king at once, so blocking or capturing with another piece does not help. The king has to move, which often wins the game.', 'You are in double check, so only a king move works.');
    });
    // ---- back rank
    T(function(){
      [oc, col].forEach(function(vc){
        if(fullNo(fenA) < 10) return;
        if(fullNo(fenA) < 10) return;
        var kp = boxed(BA, vc); if(!kp || boxed(BB, vc) || !mateThreat(fenA, vc)) return;
        var sq = sqn(kp.r, kp.f), eight = vc === 'w' ? '1st' : '8th';
        if(vc === A.me){
          var lf = lufts(BA, vc, kp), txt = 'Your king on ' + sq + ' has no escape squares, so a rook on the back rank would be mate.' + (lf ? ' A pawn move like ' + lf + ' gives it room.' : '');
          if(mine) o.cons.push(txt); else o.notes.push(txt);
        } else {
          var t2 = 'Their king on ' + sq + ' has no escape squares: a rook on the ' + eight + ' rank would be mate.';
          if(mine) o.pros.push(t2); else o.notes.push(t2);
        }
      });
    });
    // ---- promotion threat
    T(function(){
      var seven = col === 'w' ? 6 : 1, dir = col === 'w' ? 1 : -1;
      passedList(BA, col).forEach(function(p){
        var q0 = BB[p.r][p.f], had = q0 && q0.t === 'p' && q0.c === col;
        if(p.r !== seven || at(BA, p.r + dir, p.f) !== null || had) return;
        var s = sqn(p.r, p.f);
        good('Your pawn on ' + s + ' queens next move unless it is stopped.', 'Their pawn on ' + s + ' is one step from queening, so you must stop it now.');
      });
    });
    // ---- bishop pair (open positions only)
    T(function(){
      var central = 0; each(BA, function(p, r, f){ if(p.t === 'p' && (f === 3 || f === 4)) central++; });
      if(central > 3) return;
      var mb = count(BA, col, 'b'), ob = count(BA, oc, 'b');
      if(count(BB, col, 'b') === 2 && mb < 2 && ob === 2) bad('You gave up the bishop pair in an open position, where two bishops are strong.', 'They gave up the bishop pair, which helps you in this open position.');
      if(count(BB, oc, 'b') === 2 && ob < 2 && mb === 2 && !C.capsFor(fenA, oc).some(function(x){ return x.to === m.to && x.captured; })) good('You keep the bishop pair in an open position: a lasting advantage.', 'They took a bishop and keep the bishop pair in this open position.');
    });
    // ---- creates a weakness (hole)
    T(function(){
      if(m.piece !== 'p' || m.promotion || S.loss < 5 || S.label === 'book') return;
      var f0 = FL.indexOf(m.from[0]), r0 = +m.from[1] - 1, dir = col === 'w' ? 1 : -1;
      [-1, 1].forEach(function(s){
        var f = f0 + s, r = r0 + dir; if(f < 0 || f > 7 || r < 0 || r > 7) return;
        var rel = relR(r, col); if(rel < 3 || rel > 5 || BA[r][f]) return;
        var guard = false;
        for(var rr = 0; rr < 8; rr++) [-1, 1].forEach(function(d2){ var q = at(BA, rr, f + d2); if(q && q.t === 'p' && q.c === col && relR(rr, col) < rel) guard = true; });
        if(guard || !reach(BA, r, f, oc)) return;
        bad('Creates a weakness: this pawn move leaves a hole on ' + sqn(r, f) + ', where an enemy knight or bishop could settle with no pawn able to chase it away.', 'Their pawn move leaves a hole on ' + sqn(r, f) + ': a good square for your pieces.');
      });
    });
    // ---- same piece twice
    T(function(){
      if(i < 2 || m.piece === 'p' || m.piece === 'k' || m.captured || castle || /[+#]/.test(m.san)) return;
      var pm = A.moves[i - 2];
      if(pm.color !== col || pm.to !== m.from || pm.piece !== m.piece || pm.captured || fullNo(fenB) > 10) return;
      if(['inaccuracy', 'mistake', 'blunder'].indexOf(S.label) < 0) return;
      if(window.__pawBook && window.__pawBook.inBook(fenA)) return;
      var B2 = parse(A.fens[i - 2]);
      if(attackers(B2, +pm.from[1] - 1, FL.indexOf(pm.from[0]), oc).length) return;   // it was a retreat from an attack
      bad(m.piece === 'q' ? 'Early queen moves are risky: it can get chased by minor pieces. Develop your knights and bishops first.' : 'You moved the same piece twice in the opening instead of developing another one.',
          'They moved the same piece twice in the opening, which loses time.');
    });
    // ---- stalemate tricks
    T(function(){
      if(Math.abs(cpA) > 80) return;
      if(cpB >= 300){
        var r = endLine(fenB, pv0, 14);
        if(r.stale && r.side === oc) bad('Careful! This allows a stalemate trick: after ' + C.sanLine(fenB, pv0, 6) + ' your opponent has no legal moves, and the game is a draw.', 'They found a stalemate trick: after ' + C.sanLine(fenB, pv0, 6) + ' the game is a draw.');
      } else if(cpB <= -300 && S.uci === evB.best){
        var r2 = endLine(fenB, evB.pv || [], 14);
        if(r2.stale && r2.side === col) good('A stalemate trick! This saves the game.', 'They found a stalemate trick, which saves the game for them.');
      }
    });
    // ---- opposition (pure king and pawn endings)
    T(function(){
      if(!pureKP(BA) || !pawns(BA, 'w').concat(pawns(BA, 'b')).length) return;
      if(kOpp(BA) && S.loss < 5) good('You have the opposition: their king has to give way.', 'Your opponent has the opposition: your king has to give way.');
      var nx2 = A.fens[i + 2];
      if(mine && S.loss >= 5 && m.piece === 'k' && !kOpp(BB) && nx2 && pureKP(parse(nx2)) && kOpp(parse(nx2)) && nx2.split(' ')[1] === col) o.cons.push('You lost the opposition: now your king has to give way.');
    });
    // ---- rook behind the passed pawn (no queens)
    T(function(){
      if(m.piece !== 'r' || hasQueen(BA)) return;
      var f = FL.indexOf(m.to[0]), rr = +m.to[1] - 1, pp = passedList(BA, col).filter(function(x){ return x.f === f; })[0];
      if(pp){
        var behind = col === 'w' ? rr < pp.r : rr > pp.r;
        if(behind) good('Your rook is behind your passed pawn, so it supports it all the way.', 'Their rook is behind their passed pawn, so it supports it all the way.');
        else bad('Your rook is in front of your own passed pawn, which blocks it.', 'Their rook is in front of their own passed pawn, which blocks it.');
      } else if(mine && S.loss >= 5){
        var th = passedList(BA, oc)[0];
        if(th && th.f !== f) o.tips.push('Put your rook behind their passed pawn on ' + sqn(th.r, th.f) + '.');
      }
    });
    // ---- gains a tempo on the queen
    T(function(){
      if(m.piece === 'q' || m.piece === 'k' || m.captured) return;
      var qs = null; each(BA, function(p, r, f){ if(p.t === 'q' && p.c === oc) qs = {r:r, f:f}; });
      if(!qs || VAL[m.piece] >= 9) return;
      var mr = +m.to[1] - 1, mf = FL.indexOf(m.to[0]);
      if(attackers(BA, qs.r, qs.f, col).some(function(a){ return a.r === mr && a.f === mf; }) && !C.winsFor(fenA, oc).some(function(w){ return w.to === m.to; }))
        good('Gains a tempo: it attacks the queen with a smaller piece, so the queen has to move.', 'Their ' + NAMES[m.piece] + ' attacks your queen: it has to move.');
    });
    // ---- loses the right to castle
    T(function(){
      var rb = fenB.split(' ')[2] || '', ra = fenA.split(' ')[2] || '', re = col === 'w' ? /[KQ]/ : /[kq]/;
      if(m.piece !== 'k' || castle || !re.test(rb) || re.test(ra) || !mine || S.loss < 2 || mat(BB, oc, true) < 13) return;
      if(new Chess(fenB).in_check()) return;
      o.cons.push('Moving the king gives up your right to castle.');
    });
    // ---- passed / isolated pawn created
    T(function(){
      var pb = passedList(BB, col).map(function(p){ return p.f; }), pa = passedList(BA, col), ib = isoList(BB, col).map(function(p){ return p.f; }), ia = isoList(BA, col);
      pa.filter(function(p){ return pb.indexOf(p.f) < 0; }).slice(0, 1).forEach(function(p){ good('Creates a passed pawn on ' + sqn(p.r, p.f) + '.', 'Their move creates a passed pawn on ' + sqn(p.r, p.f) + '.'); });
      ia.filter(function(p){ return ib.indexOf(p.f) < 0; }).slice(0, 1).forEach(function(p){ bad('Leaves an isolated pawn on ' + sqn(p.r, p.f) + ': no pawn next to it can defend it.', 'Their move leaves them an isolated pawn on ' + sqn(p.r, p.f) + ': a target.'); });
    });
    // ---- pawn break
    T(function(){
      if(m.piece !== 'p' || m.captured || m.promotion || S.loss >= 5) return;
      var r = +m.to[1] - 1, f = FL.indexOf(m.to[0]), dir = col === 'w' ? 1 : -1, hit = null;
      [-1, 1].forEach(function(s){ var q = at(BA, r + dir, f + s); if(q && q.c === oc && q.t === 'p') hit = sqn(r + dir, f + s); });
      if(hit && attackers(BA, r, f, col).length && !C.winsFor(fenA, oc).some(function(w){ return w.to === m.to; }))
        good('Pawn break: challenges their pawn on ' + hit + '.', 'Their pawn break challenges your pawn on ' + hit + '.');
    });
    // ---- king under attack
    T(function(){
      if(mat(BA, oc, true) < 13) return;
      var zone = function(B){
        var k = kingPos(B, oc), seen = {}; if(!k) return 0;
        for(var a = -1; a <= 1; a++) for(var b = -1; b <= 1; b++){
          if(at(BA, k.r + a, k.f + b) === undefined) continue;
          attackers(B, k.r + a, k.f + b, col).forEach(function(x){ if(x.t !== 'p' && x.t !== 'k') seen[x.r * 8 + x.f] = 1; });
        }
        return Object.keys(seen).length;
      };
      if(zone(BA) >= 3 && zone(BB) <= 2) good('Several of your pieces now aim at the squares around their king: an attack is building.', 'Several of their pieces now aim at the squares around your king. Watch your king safety.');
    });
    // ---- threats: stops the threat
    T(function(){
      var tb = C.winsFor(fenB, oc).filter(function(w){ return w.net >= 2 || (w.free && VAL[w.piece] >= 3); });
      if(!tb.length || !mine) return;
      var ta = C.winsFor(fenA, oc), w = tb[0];
      if(ta.some(function(x){ return x.from === w.from && x.to === w.to; }) || m.from === w.to) return;
      o.notes.push(m.to === w.from ? 'This removes the attacker that was going to win your ' + NAMES[w.piece] + '.' : (m.captured ? 'This stops the threat to your ' + NAMES[w.piece] + ' on ' + w.to + '.' : 'This defends the ' + NAMES[w.piece] + ' that was under attack.'));
    });
    // ---- perpetual check
    T(function(){
      if(Math.abs(cpA) > 25 || !evA.pv || evA.pv.length < 5) return;
      var c = new Chess(fenA), chk = {w:0, b:0};
      for(var k = 0; k < Math.min(8, evA.pv.length); k++){
        var u = evA.pv[k], who = c.turn(), mv = c.move({from:u.slice(0, 2), to:u.slice(2, 4), promotion:u[4]});
        if(!mv) break; if(/\+/.test(mv.san)) chk[who]++;
      }
      if(chk.w >= 3 || chk.b >= 3) o.notes.push('Perpetual check: in the engine line one side keeps giving check, so the game ends in a draw.');
    });
    // ---- gave away the win / great save
    T(function(){
      if(Math.abs(cpA) > 80) return;
      if(cpB >= 300) bad('You let the win slip.', 'Your opponent let the win slip.');
      else if(cpB <= -300) good('A great save.', 'Your opponent found a great save.');
    });
    // ---- already decided (beyond +-5.5)
    T(function(){
      if(mine && S.loss >= 5 && Math.abs(cpB) >= 550 && Math.abs(cpA) >= 550 && cpB * cpA > 0) o.notes.push('The game was already decided, so this changes nothing.');
    });
    // ---- opposite-side castling and turning point
    T(function(){
      if(!castle) return;
      var first = {};
      for(var j = 0; j <= i; j++){
        var f2 = A.moves[j].flags || '', s = f2.indexOf('k') >= 0 ? 'k' : (f2.indexOf('q') >= 0 ? 'q' : null);
        if(s && !first[A.moves[j].color]) first[A.moves[j].color] = {s:s, j:j};
      }
      if(first.w && first.b && first.w.s !== first.b.s && Math.max(first.w.j, first.b.j) === i)
        o.notes.push('You castled on opposite sides, so the game usually turns into a pawn-storm race: each side attacks the other king, and speed matters more than defence.'.replace('You castled', mine ? 'You castled' : 'The kings are castled'));
    });
    T(function(){
      var t = turning(A);
      if(t === i) o.notes.push('Turning point: this is where the game changed.');
    });
    return o;
  }
  function turning(A){
    if(A.c45t !== undefined) return A.c45t;
    var best = -1, bi = -1;
    A.moves.forEach(function(m, i){
      if(isM(A.ev[i].cp) || isM(A.ev[i + 1].cp)) return;
      var d = Math.abs(winPct(A.ev[i + 1].cp) - winPct(A.ev[i].cp));
      if(d > best){ best = d; bi = i; }
    });
    A.c45t = best >= 15 ? bi : -1;
    return A.c45t;
  }


  // ---------------- own engine, only used to fill in a missing "2nd best move" for Only move ----------------
  var SF = ['https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js', 'https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js', 'https://unpkg.com/stockfish.js@10.0.2/stockfish.js'];
  var EW = null, chain = Promise.resolve();
  function handshake(w){
    return new Promise(function(res, rej){
      var t = setTimeout(function(){ try{ w.terminate(); }catch(e){} rej(new Error('timeout')); }, 25000);
      w.onmessage = function(e){ if(String(e.data).indexOf('uciok') >= 0){ clearTimeout(t); w.onmessage = null; res(w); } };
      w.onerror = function(){ clearTimeout(t); rej(new Error('worker')); };
      w.postMessage('uci');
    });
  }
  function loadEng(){
    if(EW) return EW;
    EW = (async function(){
      if(window.PawniacSF){ try{ return await window.PawniacSF.get(); }catch(e){} }
      for(var a = 0; a < 2; a++) for(var i = 0; i < SF.length; i++){
        try{
          var r = await fetch(SF[i]); if(!r.ok) throw 0;
          var t = await r.text(); if(t.length < 20000) throw 0;
          return await handshake(new Worker(URL.createObjectURL(new Blob([t], {type:'application/javascript'}))));
        }catch(e){}
      }
      return null;
    })();
    EW.then(function(w){ if(!w) EW = null; });
    return EW;
  }
  function toCp(t, v){ return t === 'mate' ? (v === 0 ? -10000 : (v > 0 ? 10000 - 10 * v : -(10000 - 10 * (-v)))) : v; }
  async function multi3(fen){
    var w = await loadEng(); if(!w) throw new Error('engine');
    var sign = fen.split(' ')[1] === 'w' ? 1 : -1;
    return new Promise(function(res, rej){
      var lines = {}, g = setTimeout(function(){ w.removeEventListener('message', h); rej(new Error('timeout')); }, 30000);
      function h(e){
        var s = String(e.data);
        if(s.indexOf('info') === 0 && s.indexOf(' score ') > 0 && s.indexOf(' pv ') > 0 && !/lowerbound|upperbound/.test(s)){
          var m = /score (cp|mate) (-?\d+)/.exec(s), p = / pv (.+)$/.exec(s), d = / depth (\d+)/.exec(s), mp = / multipv (\d+)/.exec(s);
          if(m && p) lines[mp ? +mp[1] : 1] = {cp:sign * toCp(m[1], window.PawniacSF ? window.PawniacSF.cp(s, m[1], +m[2]) : +m[2]), pv:p[1].trim().split(/\s+/), depth:d ? +d[1] : 0};
        } else if(s.indexOf('bestmove') === 0){
          clearTimeout(g); w.removeEventListener('message', h);
          var main = lines[1], alts = [];
          if(main) for(var k = 2; k <= 3; k++){ var L = lines[k]; if(L && L.pv.length && L.depth >= main.depth - 1) alts.push({cp:L.cp, best:L.pv[0], pv:L.pv, ref:main.cp}); }
          res(alts);
        }
      }
      w.addEventListener('message', h);
      w.postMessage('setoption name Skill Level value 20');
      w.postMessage('setoption name Contempt value 0');
      w.postMessage('setoption name MultiPV value 3');
      w.postMessage('position fen ' + fen);
      w.postMessage('go depth 14 movetime 2000');
    });
  }
  function needAlts(A, i){
    var m = A.moves[i], S = A.stats[i], e = A.ev[i];
    return m.color === A.me && S.uci === e.best && !(e.alts && e.alts.length) && Math.abs(S.cpBefore) < 350 && !isM(S.cpBefore) && !isM(S.cpAfter);
  }
  function ensureAlts(A, i){
    A.c45a = A.c45a || {};
    if(A.c45a[i]) return A.c45a[i];
    if(!needAlts(A, i)) return null;
    var e = A.ev[i];
    var pr = chain.then(function(){ return multi3(A.fens[i]); }).then(function(alts){
      e.alts = alts; delete A.c45[i];
      var p = document.getElementById('anPanel');
      if(p && H.data() === A && A.sel === i + 1){ var w = p.querySelector('.an-c45'); if(w) w.remove(); patchPanel(); }
    }).catch(function(){});
    chain = pr; A.c45a[i] = pr;
    return pr;
  }

  // ---------------- put it into the page ----------------
  function ul(arr){ return '<ul>' + arr.map(function(t){ return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>'; }
  window.__c45Html = function(A, k, txt){
    try{
      var i = k - 1, m = A.moves[i], mine = m.color === A.me, o = gen(A, i);
      var pros = o.pros.slice(), cons = o.cons.slice();
      if(/creates a passed pawn/i.test(txt)) pros = pros.filter(function(t){ return !/^Creates a passed pawn/.test(t); });
      var notes = o.notes.filter(function(t){ return !(/^This (defends|stops|removes)/.test(t) && /Saves your/.test(txt)); });
      var h = '';
      if(notes.length) h += notes.map(function(t){ return '<p class="an-note">' + esc(t) + '</p>'; }).join('');
      if(mine && (pros.length || cons.length)){
        var both = pros.length && cons.length;
        h += '<div class="an-pc" style="margin:8px 0;' + (both ? '' : 'grid-template-columns:1fr;') + '">' + (pros.length ? '<div class="an-pros"><h4>Pros</h4>' + ul(pros) + '</div>' : '') + (cons.length ? '<div class="an-cons"><h4>Cons</h4>' + ul(cons) + '</div>' : '') + '</div>';
      }
      if(mine && o.tips.length) h += '<div class="an-tip">\uD83D\uDCA1 ' + esc(o.tips[0]) + '</div>';
      return h ? '<div class="an-sec an-c45"><h4>More from the coach</h4>' + h + '</div>' : '';
    }catch(e){ return ''; }
  };
  function patchPanel(){
    var p = document.getElementById('anPanel'), A = H.data();
    if(!p || !A || !A.stats || !A.stats.length || p.querySelector('.an-c45') || A.sel < 1) return;
    var i = A.sel - 1, m = A.moves[i], S = A.stats[i], mine = m.color === A.me, o = gen(A, i);
    if(mine){
      if(S.label === 'best') p.querySelectorAll('p.an-note').forEach(function(e){
        if(e.textContent.replace(/\u2019/g, "'").trim() === "This is the engine's top choice.") e.textContent = BEST[(i * 5 + 2) % BEST.length];
      });
      p.querySelectorAll('li').forEach(function(li){   // silence rule: no filler line
        if(/^Keeps your position healthy and your pieces coordinated\.?$/.test(li.textContent.trim())){
          var list = li.parentNode; li.remove();
          if(!list.children.length){
            var box = list.parentNode, pc = box.parentNode; box.remove();
            if(pc && pc.classList.contains('an-pc')){ if(!pc.children.length) pc.remove(); else pc.style.gridTemplateColumns = '1fr'; }
          }
        }
      });
      if(o.chip){ var ch = p.querySelector('.an-title .an-chip'); if(ch){ ch.textContent = o.chip.t; ch.style.background = o.chip.c; } }
    }
    var txt = p.textContent, pros = o.pros.slice(), cons = o.cons.slice();
    if(/creates a passed pawn/i.test(txt)) pros = pros.filter(function(t){ return !/^Creates a passed pawn/.test(t); });
    var notes = o.notes.filter(function(t){ return !(/^This (defends|stops|removes)/.test(t) && /Saves your/.test(txt)); });
    var h = '';
    if(notes.length) h += notes.map(function(t){ return '<p class="an-note">' + esc(t) + '</p>'; }).join('');
    if(mine && (pros.length || cons.length)){
      var both = pros.length && cons.length;
      h += '<div class="an-pc" style="margin:8px 0;' + (both ? '' : 'grid-template-columns:1fr;') + '">' + (pros.length ? '<div class="an-pros"><h4>Pros</h4>' + ul(pros) + '</div>' : '') + (cons.length ? '<div class="an-cons"><h4>Cons</h4>' + ul(cons) + '</div>' : '') + '</div>';
    }
    if(mine && o.tips.length) h += '<div class="an-tip">\uD83D\uDCA1 ' + esc(o.tips[0]) + '</div>';
    var wrap = document.createElement('div'); wrap.className = 'an-sec an-c45';
    wrap.innerHTML = h ? '<h4>More from the coach</h4>' + h : '';
    if(!h) wrap.style.display = 'none';
    p.appendChild(wrap);
    if(mine) ensureAlts(A, i);
  }
  function patchReport(){
    var r = document.getElementById('anReportTab'), A = H.data();
    if(!r || !A || !A.stats || !A.stats.length || r.querySelector('.an-c45r')) return;
    var mineIdx = [], best = null, worst = null, why = '';
    A.moves.forEach(function(m, j){ if(m.color === A.me) mineIdx.push(j); });
    mineIdx.forEach(function(j){
      var S = A.stats[j], o = gen(A, j), sc = 0, w = '';
      if(o.f.brill){ sc = 100; w = 'a brilliant sacrifice'; }
      else if(o.f.sac){ sc = 80; w = 'a sacrifice that pays off'; }
      else if(o.f.only){ sc = 70; w = 'the only good move'; }
      else if(o.f.punish){ sc = 60; w = 'punishing their mistake'; }
      else if(S.label === 'best' && !isM(S.cpAfter)){ sc = Math.max(0, (winPct(S.cpAfter) - winPct(S.cpBefore)) / 5); w = 'the engine\u2019s top choice'; }
      if(sc >= 1 && (!best || sc > best.sc)) best = {j:j, sc:sc, w:w};
      if(S.loss >= 8 && (!worst || S.loss > worst.loss)) worst = {j:j, loss:S.loss};
    });
    var rows = '', link = function(j){ return '<span class="an-moment" data-c45="' + (j + 1) + '">' + esc(mvText(A, j)) + '</span>'; };
    if(best) rows += '<p class="an-note">\u2B50 Best moment: ' + link(best.j) + ' (' + best.w + ').</p>';
    if(worst) rows += '<p class="an-note">\uD83D\uDCC9 Costliest moment: ' + link(worst.j) + ', it cost about ' + Math.round(worst.loss) + '% of your winning chances.</p>';
    var t = turning(A); if(t >= 0) rows += '<p class="an-note">\uD83D\uDD04 Turning point of the game: ' + link(t) + '.</p>';
    var pend = (A.c45fill || r.style.display === 'none') ? [] : mineIdx.filter(function(j){ return needAlts(A, j) && !(A.c45a && A.c45a[j]); }).slice(0, 4);
    var d = document.createElement('div'); d.className = 'an-sec an-c45r';
    d.innerHTML = (rows || pend.length) ? '<h4>Highlights</h4>' + rows + (pend.length ? '<p class="an-note" style="opacity:.7">Checking for only moves... this updates in a few seconds.</p>' : '') : '';
    if(!rows && !pend.length) d.style.display = 'none';
    r.insertBefore(d, r.firstChild);
    if(pend.length){
      A.c45fill = 1;
      Promise.all(pend.map(function(j){ return ensureAlts(A, j); })).then(function(){
        var x = document.getElementById('anReportTab');
        if(x && H.data() === A){ var old = x.querySelector('.an-c45r'); if(old) old.remove(); patchReport(); }
      });
    }
    d.querySelectorAll('[data-c45]').forEach(function(el){
      el.onclick = function(){
        var b = document.querySelector('.an-tabbtn[data-tab="board"]'); if(b) b.click();
        setTimeout(function(){ var x = document.querySelector('#anMoves [data-ply="' + el.getAttribute('data-c45') + '"]'); if(x) x.click(); }, 30);
      };
    });
  }
  var scr = document.getElementById('screen-analyze'), busy = false;
  if(!scr) return;
  new MutationObserver(function(){
    if(busy) return; busy = true;
    try{ patchPanel(); patchReport(); }catch(e){ console.error('coach45', e); }
    busy = false;
  }).observe(scr, {childList:true, subtree:true});
})();
