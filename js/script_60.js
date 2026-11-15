/* Pawniac: "Understand a position".
 * Give it a position (paste a FEN, set up a board, or send one from an analyzed game). Stockfish evaluates it and
 * this file turns that, plus a look at the pieces and pawns, into a short coach-style reading: who is better,
 * what matters, a plan for each side and the best moves with a reason each.
 * Standard chess only. Everything runs in the browser. The engine's evaluation is exact; the plans are rule-based advice. */
(function(){
  var FILES = 'abcdefgh', PN = {p:'pawn', n:'knight', b:'bishop', r:'rook', q:'queen', k:'king'};
  var START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  var E = {pieces:{}, turn:'w', cs:{K:1, Q:1, k:1, q:1}, flip:false, tool:null, busy:false, root:null, result:null, status:''};

  function core(){ return window.__anCore; }
  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'}[c]; }); }
  function cap(s){ return s.charAt(0).toUpperCase() + s.slice(1); }
  function name(c){ return c === 'w' ? 'White' : 'Black'; }
  function other(c){ return c === 'w' ? 'b' : 'w'; }
  function plural(n, w){ return n + ' ' + w + (n === 1 ? '' : 's'); }

  // ---------- FEN <-> editor ----------
  function parseFen(fen){
    var p = String(fen || '').trim().split(/\s+/), rows = (p[0] || '').split('/'), pcs = {};
    if(rows.length !== 8) return null;
    for(var r = 0; r < 8; r++){
      var f = 0, row = rows[r];
      for(var i = 0; i < row.length; i++){
        var ch = row.charAt(i);
        if(/[1-8]/.test(ch)){ f += +ch; continue; }
        if(!/[prnbqkPRNBQK]/.test(ch) || f > 7) return null;
        pcs[FILES.charAt(f) + (8 - r)] = {color: ch === ch.toUpperCase() ? 'w' : 'b', type: ch.toLowerCase()};
        f++;
      }
      if(f !== 8) return null;
    }
    var rt = p[2] || '-';
    return {pieces:pcs, turn:p[1] === 'b' ? 'b' : 'w', cs:{K:/K/.test(rt) ? 1 : 0, Q:/Q/.test(rt) ? 1 : 0, k:/k/.test(rt) ? 1 : 0, q:/q/.test(rt) ? 1 : 0}};
  }
  function at(sq){ return E.pieces[sq] || null; }
  function toFen(){
    var rows = [];
    for(var r = 8; r >= 1; r--){
      var s = '', n = 0;
      for(var f = 0; f < 8; f++){
        var p = at(FILES.charAt(f) + r);
        if(!p){ n++; continue; }
        if(n){ s += n; n = 0; }
        s += p.color === 'w' ? p.type.toUpperCase() : p.type;
      }
      if(n) s += n;
      rows.push(s);
    }
    function is(sq, c, t){ var p = at(sq); return !!p && p.color === c && p.type === t; }
    var rt = '';
    if(E.cs.K && is('e1', 'w', 'k') && is('h1', 'w', 'r')) rt += 'K';
    if(E.cs.Q && is('e1', 'w', 'k') && is('a1', 'w', 'r')) rt += 'Q';
    if(E.cs.k && is('e8', 'b', 'k') && is('h8', 'b', 'r')) rt += 'k';
    if(E.cs.q && is('e8', 'b', 'k') && is('a8', 'b', 'r')) rt += 'q';
    return rows.join('/') + ' ' + E.turn + ' ' + (rt || '-') + ' - 0 1';
  }
  function validate(fen){
    var pcs = parseFen(fen).pieces, k = {w:0, b:0};
    Object.keys(pcs).forEach(function(sq){
      var p = pcs[sq];
      if(p.type === 'k') k[p.color]++;
      if(p.type === 'p' && (sq.charAt(1) === '1' || sq.charAt(1) === '8')) k.bad = true;
    });
    if(k.w !== 1 || k.b !== 1) return 'Each side needs exactly one king.';
    if(k.bad) return 'Pawns cannot stand on the first or last rank.';
    var ch = new Chess();
    if(!ch.load(fen)) return 'That position is not valid.';
    var mover = fen.split(' ')[1], o = new Chess();
    if(!o.load(core().flipTurn(fen, other(mover))) || o.in_check()) return name(other(mover)) + ' is in check but it is ' + name(mover) + "'s move, which cannot happen in a real game.";
    return null;
  }

  // ---------- reading the position ----------
  function scan(fen){
    var pcs = parseFen(fen).pieces, P = {w:{pawns:[], pieces:[], cnt:{p:0, n:0, b:0, r:0, q:0}, king:null}, b:{pawns:[], pieces:[], cnt:{p:0, n:0, b:0, r:0, q:0}, king:null}};
    Object.keys(pcs).forEach(function(sq){
      var p = pcs[sq], o = P[p.color], f = FILES.indexOf(sq.charAt(0)), r = +sq.charAt(1), it = {type:p.type, sq:sq, f:f, r:r};
      if(p.type === 'k'){ o.king = it; return; }
      o.cnt[p.type]++;
      if(p.type === 'p') o.pawns.push(it); else o.pieces.push(it);
    });
    ['w', 'b'].forEach(function(c){
      var o = P[c], opp = P[other(c)], pf = {};
      o.pawns.forEach(function(p){ pf[p.f] = (pf[p.f] || 0) + 1; });
      o.pf = pf; o.isolated = []; o.doubled = []; o.passed = [];
      o.pawns.forEach(function(p){
        if(o.pawns.length > 1 && !pf[p.f - 1] && !pf[p.f + 1]) o.isolated.push(p);
        var blocked = opp.pawns.some(function(q){ return Math.abs(q.f - p.f) <= 1 && (c === 'w' ? q.r > p.r : q.r < p.r); });
        if(!blocked) o.passed.push(p);
      });
      Object.keys(pf).forEach(function(f){ if(pf[f] > 1) o.doubled.push(+f); });
      o.mat = o.cnt.p + 3 * o.cnt.n + 3 * o.cnt.b + 5 * o.cnt.r + 9 * o.cnt.q;
      o.nonPawn = o.mat - o.cnt.p;
    });
    var open = [], semi = {w:[], b:[]};
    for(var f = 0; f < 8; f++){
      var wp = P.w.pf[f] || 0, bp = P.b.pf[f] || 0;
      if(!wp && !bp) open.push(f); else if(!wp) semi.w.push(f); else if(!bp) semi.b.push(f);
    }
    P.open = open; P.semi = semi;
    var tot = P.w.nonPawn + P.b.nonPawn;
    P.phase = tot <= 20 ? 'endgame' : (tot >= 40 && (P.w.pieces.filter(function(x){ return (x.type === 'n' || x.type === 'b') && x.r === 1; }).length + P.b.pieces.filter(function(x){ return (x.type === 'n' || x.type === 'b') && x.r === 8; }).length) >= 2 ? 'opening' : 'middlegame');
    return P;
  }
  function fileName(f){ return FILES.charAt(f); }
  function sqList(arr){ return arr.map(function(p){ return p.sq; }).join(', '); }
  function fileList(arr){ return arr.map(fileName).join(', '); }

  function kingText(P, c, rights){
    var k = P[c].king, home = c === 'w' ? 1 : 8, dir = c === 'w' ? 1 : -1;
    if(P.phase === 'endgame'){
      // in an endgame the king is judged by where it stands, not by pawn cover
      var d = Math.max(Math.abs(k.f - 3.5), Math.abs(k.r - 4.5));
      return {text:'on ' + k.sq, risk:false, castled:false, canC:false, shield:0, openNear:[], far:d > 2};
    }
    var shield = 0, nf = 0;
    for(var df = -1; df <= 1; df++){ var ff = k.f + df; if(ff < 0 || ff > 7) continue; nf++; if(P[c].pawns.some(function(p){ return p.f === ff && (p.r - k.r) * dir >= 1 && (p.r - k.r) * dir <= 2; })) shield++; }
    var castled = k.r === home && (k.f >= 6 || k.f <= 2);
    var canC = (c === 'w' ? /[KQ]/ : /[kq]/).test(rights);
    var openNear = [k.f - 1, k.f, k.f + 1].filter(function(f){ return f >= 0 && f <= 7 && P.open.indexOf(f) >= 0; });
    var s;   // plain facts only: where the king is, whether it can castle, how many pawns stand in front of it
    if(castled) s = 'castled ' + (k.f >= 6 ? 'short' : 'long') + ', pawns in front on ' + shield + ' of ' + nf + ' files';
    else if(canC) s = 'on ' + k.sq + ', can still castle';
    else if(k.r === home) s = 'on ' + k.sq + ', cannot castle any more';
    else s = 'off its home rank, on ' + k.sq;
    if(openNear.length) s += '; open ' + fileList(openNear) + '-file next to it';
    return {text:s, risk:(!castled && !canC && k.r === home) || (castled && shield <= 1) || openNear.length > 0, castled:castled, canC:canC, shield:shield, openNear:openNear};
  }
  // pieces `c` could win right now (as if it were their move), counting recaptures
  function wins(fen, c){
    var out = [];
    try{
      var t = new Chess(); if(!t.load(core().flipTurn(fen, c))) return out;
      var o = new Chess(); if(!o.load(core().flipTurn(fen, other(c))) || o.in_check()) { if(fen.split(' ')[1] !== c) return out; }
      var seen = {}, mv = t.moves({verbose:true});
      mv.forEach(function(m){
        if(!m.captured || seen[m.to]) return; seen[m.to] = 1;
        var g = core().seeGain(new Chess(core().flipTurn(fen, c)), m.to);
        if(g >= 1){
          var low = mv.filter(function(x){ return x.to === m.to && x.captured; }).sort(function(a, b){ return (a.piece === 'k' ? 100 : core().VAL[a.piece]) - (b.piece === 'k' ? 100 : core().VAL[b.piece]); })[0];
          out.push({sq:m.to, piece:m.captured, gain:g, san:low.san});
        }
      });
    }catch(e){}
    return out.sort(function(a, b){ return b.gain - a.gain; });
  }
  function evalWords(cp){
    var a = Math.abs(cp) / 100, who = cp > 0 ? 'White' : 'Black';
    if(Math.abs(cp) >= 9000) return who + ' has a forced checkmate in ' + Math.max(1, Math.round((10000 - Math.abs(cp)) / 10));
    if(a < 0.3) return 'The position is roughly equal';
    if(a < 0.8) return who + ' is slightly better';
    if(a < 1.8) return who + ' is clearly better';
    if(a < 4) return who + ' is much better';
    return who + ' is winning';
  }
  function fmtEval(cp){
    if(Math.abs(cp) >= 9000) return 'mate in ' + Math.max(1, Math.round((10000 - Math.abs(cp)) / 10));
    return (cp > 0 ? '+' : '') + (cp / 100).toFixed(1);
  }
  function materialText(P){
    var d = P.w.mat - P.b.mat, parts = [];
    var dp = P.w.cnt.p - P.b.cnt.p, dn = P.w.cnt.n + P.w.cnt.b - P.b.cnt.n - P.b.cnt.b, dr = P.w.cnt.r - P.b.cnt.r, dq = P.w.cnt.q - P.b.cnt.q;
    if(!d) return 'Material is equal';
    var who = d > 0 ? 'White' : 'Black', s = d > 0 ? 1 : -1;
    if(dq === 0 && dr === 0 && dn === 0) return who + ' is up ' + plural(Math.abs(dp), 'pawn');
    if(dq === 0 && dn === 0 && dr === s) return who + ' is up a rook' + (dp ? ' and ' + (dp * s > 0 ? plural(Math.abs(dp), 'pawn') : 'but down ' + plural(Math.abs(dp), 'pawn')) : '');
    if(dq === 0 && dr === 0 && dn === s) return who + ' is up a piece' + (dp * s > 0 ? ' and ' + plural(Math.abs(dp), 'pawn') : dp ? ' but down ' + plural(Math.abs(dp), 'pawn') : '');
    if(dq === s && dr === 0 && dn === 0) return who + ' is up a queen' + (dp ? (dp * s > 0 ? ' and ' + plural(Math.abs(dp), 'pawn') : ' but down ' + plural(Math.abs(dp), 'pawn')) : '');
    if(dr === s && dn === -s && dq === 0) return who + ' has the exchange (rook for a minor piece)';
    return who + ' is ahead by about ' + Math.abs(d) + ' points of material';
  }
  function pieceWord(t){ return PN[t]; }

  function understand(fen, R){
    var Z = core(), turn = fen.split(' ')[1], rights = fen.split(' ')[2] || '-', P = scan(fen), cp = R.cp, mv = turn, op = other(turn);
    var M = {fen:fen, turn:turn, cp:cp, evalText:evalWords(cp), evalNum:fmtEval(cp), pct:Z.winPct(cp), phase:P.phase};
    var K = {w:kingText(P, 'w', rights), b:kingText(P, 'b', rights)};
    var W = {w:wins(fen, 'w'), b:wins(fen, 'b')};
    var bp = {w:P.w.cnt.b >= 2, b:P.b.cnt.b >= 2};

    // ---- feature rows ----
    function pawnsText(c){
      var o = P[c], bits = [];
      if(o.isolated.length) bits.push('isolated: ' + sqList(o.isolated));
      if(o.doubled.length) bits.push('doubled: ' + fileList(o.doubled) + '-file');
      if(o.passed.length) bits.push('passed: ' + sqList(o.passed));
      return bits.length ? bits.join('; ') : (o.pawns.length ? 'no isolated, doubled or passed pawns' : 'no pawns');
    }
    function rooksText(c){
      var o = P[c], s = [];
      var rooks = o.pieces.filter(function(x){ return x.type === 'r'; });
      rooks.forEach(function(r){
        if(P.open.indexOf(r.f) >= 0) s.push('rook on the open ' + fileName(r.f) + '-file');
        else if(P.semi[c].indexOf(r.f) >= 0) s.push('rook on the half-open ' + fileName(r.f) + '-file');
        if(r.r === (c === 'w' ? 7 : 2)) s.push('rook on the 7th rank');
      });
      if(bp[c]) s.push('has the bishop pair');
      return s.length ? s.join('; ') : (rooks.length || o.cnt.q ? 'nothing special' : '-');
    }
    M.rows = [
      {label:'Material', kind:'fact', w:plural(P.w.mat, 'point'), b:plural(P.b.mat, 'point'), note:materialText(P) + '.'},
      {label:'King', kind:'fact', w:K.w.text, b:K.b.text},
      {label:'Pawns', kind:'fact', w:pawnsText('w'), b:pawnsText('b')},
      {label:'Pieces', kind:'fact', w:rooksText('w'), b:rooksText('b')}
    ];
    if(P.phase === 'opening'){
      function dev(c){ var minors = P[c].pieces.filter(function(x){ return x.type === 'n' || x.type === 'b'; }), home = c === 'w' ? 1 : 8; var back = minors.filter(function(x){ return x.r === home; }).length; return (minors.length - back) + ' of ' + minors.length + ' minor pieces off their starting squares'; }
      M.rows.push({label:'Development', kind:'fact', w:dev('w'), b:dev('b')});
    }

    // ---- plans ----
    function plans(c){
      var o = P[c], e = P[other(c)], ps = [], ek = K[other(c)], mk = K[c], my = c === turn;
      var wn = W[c].filter(function(x){ return true; });
      if(wn.length){ var t = wn[0]; ps.push((my ? 'Win the ' : 'Look out: the ') + pieceWord(t.piece) + ' on ' + t.sq + (my ? ' (' + t.san + ')' : ' can be won by ' + name(c)) + '.'); }
      if(W[other(c)].length && my){ var th = W[other(c)][0]; ps.push('Deal with the threat to your ' + pieceWord(th.piece) + ' on ' + th.sq + '.'); }
      if(P.phase === 'opening'){
        var minors = o.pieces.filter(function(x){ return x.type === 'n' || x.type === 'b'; }), home = c === 'w' ? 1 : 8;
        if(minors.some(function(x){ return x.r === home; })) ps.push('Develop the remaining knights and bishops.');
        if(!mk.castled && mk.canC) ps.push('Castle to bring the king to safety and connect the rooks.');
        var cen = o.pawns.filter(function(p){ return (p.f === 3 || p.f === 4) && p.r >= 4 && p.r <= 5; }).length;
        if(!cen) ps.push('Fight for the centre with a pawn on ' + (c === 'w' ? 'd4 or e4' : 'd5 or e5') + '.');
      }
      var rooks = o.pieces.filter(function(x){ return x.type === 'r'; });
      var of = P.open.concat(P.semi[c]).filter(function(f){ return true; });
      if(P.open.length && rooks.length && !rooks.some(function(r){ return P.open.indexOf(r.f) >= 0; })) ps.push('Put a rook on the open ' + fileName(P.open[0]) + '-file.');
      else if(P.open.length && rooks.length >= 2 && rooks.filter(function(r){ return P.open.indexOf(r.f) >= 0; }).length === 1) ps.push('Double your rooks on the open ' + fileName(P.open[0]) + '-file.');
      if(e.isolated.length) ps.push('Pressure the isolated pawn on ' + e.isolated[0].sq + '.');
      else if(e.doubled.length) ps.push("Target the doubled pawns on the " + fileName(e.doubled[0]) + "-file.");
      if(o.passed.length){ var pp = o.passed.sort(function(a, b){ return c === 'w' ? b.r - a.r : a.r - b.r; })[0]; ps.push('Support and push the passed pawn on ' + pp.sq + '.'); }
      if(e.passed.length){ var ep = e.passed.sort(function(a, b){ return other(c) === 'w' ? b.r - a.r : a.r - b.r; })[0]; ps.push('Stop the passed pawn on ' + ep.sq + ': put a piece in front of it.'); }
      if(P.phase !== 'endgame' && ek.risk && o.cnt.q) ps.push('Go after the enemy king: it is exposed, so open lines near it.');
      if(P.phase !== 'endgame' && mk.risk) ps.push('Make your own king safer before starting anything.');
      if(P.phase === 'endgame' && mk.far) ps.push('Bring the king towards the centre: in an endgame it is a fighting piece.');
      if(bp[c] && !bp[other(c)]) ps.push('Open the position with pawn breaks so the two bishops can work.');
      var d = (c === 'w' ? 1 : -1) * (P.w.mat - P.b.mat);
      if(d >= 2) ps.push('You are ahead: trade pieces (not pawns) and keep things simple.');
      else if(d <= -2) ps.push('You are behind: keep pieces on the board and look for activity and tricks.');
      if(!ps.length) ps.push('Improve your worst-placed piece and keep your pawns safe.');
      return ps.slice(0, 3);
    }
    M.plans = {w:plans('w'), b:plans('b')};
    var mateNow = Math.abs(R.cp) >= 9000, mateWinner = R.cp > 0 ? 'w' : 'b';
    if(mateNow){
      M.plans[mateWinner] = ['Follow the forcing line below: it ends in checkmate.'];
      M.plans[other(mateWinner)] = ['Look for any defence or check that delays the mate, but the position is lost against best play.'];
    }

    // ---- moves ----
    function lineSans(pv){
      var c = new Chess(); c.load(fen); var out = [], n = fen.split(' '), full = parseInt(n[5], 10) || 1, t = n[1];
      for(var i = 0; i < Math.min(pv.length, 6); i++){
        var m = c.move({from:pv[i].slice(0, 2), to:pv[i].slice(2, 4), promotion:pv[i].slice(4, 5) || undefined});
        if(!m) break;
        var num = (t === 'w' || i === 0) ? (full + (t === 'w' ? '.' : '...')) : '';
        out.push((num ? num + ' ' : '') + m.san);
        if(t === 'b') full++;
        t = other(t);
      }
      return out.join(' ');
    }
    // each reason says only what the rules or the engine line prove; kind is 'fact' (about the move itself) or 'engine' (from the search)
    function reason(m, pvNet, cpSelf, weak){
      var sign = turn === 'w' ? 1 : -1, home = turn === 'w' ? 1 : 8;
      if(Math.abs(cpSelf) >= 9000 && sign * cpSelf > 0) return {t:'Forces checkmate.', k:'engine'};
      if(/#$/.test(m.san)) return {t:'Checkmate.', k:'fact'};
      if(m.promotion) return {t:'Promotes the pawn.', k:'fact'};
      if(weak) return {t:'This gives up much of the advantage compared with the best move.', k:'engine'};
      if(pvNet >= 0.8) return {t:'Wins material' + (m.captured ? ': it takes the ' + pieceWord(m.captured) + ' on ' + m.to : '') + '.', k:'engine'};
      if(/[kq]/.test(m.flags)) return {t:'Castles.', k:'fact'};
      var fromR = +m.from.charAt(1);
      if(m.captured) return {t:'Takes the ' + pieceWord(m.captured) + ' on ' + m.to + '.', k:'fact'};
      if(/\+$/.test(m.san)) return {t:'Gives check.', k:'fact'};
      if(P.phase === 'opening' && (m.piece === 'n' || m.piece === 'b') && fromR === home) return {t:'Develops the ' + pieceWord(m.piece) + '.', k:'fact'};
      if(m.piece === 'r' && P.open.indexOf(FILES.indexOf(m.to.charAt(0))) >= 0) return {t:'Puts the rook on the open ' + m.to.charAt(0) + '-file.', k:'fact'};
      if(m.piece === 'p' && P[turn].passed.some(function(p){ return p.sq === m.from; })) return {t:'Pushes the passed pawn.', k:'fact'};
      return {t:'', k:'fact'};   // nothing provable to say: show the move, its evaluation and the engine line only
    }
    var cands = [{uci:R.best, cp:R.cp, pv:R.pv}].concat((R.alts || []).map(function(a){ return {uci:a.best, cp:a.cp, pv:a.pv}; })), sign = turn === 'w' ? 1 : -1;
    M.moves = cands.map(function(cd, i){
      var m = cd.uci ? Z.tryMove(fen, cd.uci) : null;
      if(!m) return null;
      var info = null; try{ info = Z.pvInfo(fen, cd.pv && cd.pv.length ? cd.pv : [cd.uci], 4, turn); }catch(e){}
      var rs = reason(m, info ? info.net : 0, cd.cp, i > 0 && Math.abs(R.cp) < 9000 && sign * (R.cp - cd.cp) >= 150 || i > 0 && Math.abs(R.cp) >= 9000);
      return {rank:i + 1, san:m.san, evalNum:fmtEval(cd.cp), reason:rs.t, rk:rs.k, line:lineSans(cd.pv && cd.pv.length ? cd.pv : [cd.uci]),
              worse:i === 0 ? 0 : (Math.abs(R.cp) >= 9000 || Math.abs(cd.cp) >= 9000 ? 99 : Math.max(0, sign * (R.cp - cd.cp) / 100))};
    }).filter(Boolean);

    // ---- summary ----
    var facts = [];
    if(!mateNow) {
    if(W[mv].length && W[mv][0].gain >= 1.5) facts.push(name(mv) + ' can win the ' + pieceWord(W[mv][0].piece) + ' on ' + W[mv][0].sq + ' right away.');
    if(W[op].length && W[op][0].gain >= 1.5) facts.push(name(op) + ' is threatening to win the ' + pieceWord(W[op][0].piece) + ' on ' + W[op][0].sq + '.');
    if(P.w.mat !== P.b.mat) facts.push(materialText(P) + '.');
    ['w', 'b'].forEach(function(c){ if(P.phase !== 'endgame' && K[c].risk && (K[c].canC === false || K[c].shield <= 1)) facts.push(name(c) + "'s king: " + K[c].text + '.'); });
    ['w', 'b'].forEach(function(c){ if(P[c].passed.length) facts.push(name(c) + ' has a passed pawn on ' + P[c].passed[0].sq + '.'); });
    ['w', 'b'].forEach(function(c){ if(P[c].isolated.length) facts.push(name(c) + ' has an isolated pawn on ' + P[c].isolated[0].sq + '.'); });
    }
    if(!facts.length && !mateNow) facts.push('Neither side has a clear structural edge, so piece placement decides.');
    M.facts = facts.slice(0, 3);
    var top = M.moves[0];
    M.summary = name(turn) + ' to move. ' + M.evalText + (Math.abs(R.cp) >= 9000 ? '. ' : ' (' + M.evalNum + '). ') + M.facts.join(' ') + (top ? ' The best move is ' + top.san + (top.reason ? ': ' + top.reason.charAt(0).toLowerCase() + top.reason.slice(1) : '.') : '');
    return M;
  }

  // ---------- drawing ----------
  var TOOLS = ['wk', 'wq', 'wr', 'wb', 'wn', 'wp', 'bk', 'bq', 'br', 'bb', 'bn', 'bp'];
  function boardHtml(){
    var rows = [8, 7, 6, 5, 4, 3, 2, 1], cols = [0, 1, 2, 3, 4, 5, 6, 7];
    if(E.flip){ rows = rows.slice().reverse(); cols = cols.slice().reverse(); }
    var h = '<div class="board ps-boardx">';
    rows.forEach(function(r, ri){
      cols.forEach(function(f, ci){
        var sq = FILES.charAt(f) + r, p = at(sq), cls = 'sq ' + (((8 - r) + f) % 2 === 0 ? 'light' : 'dark'), co = '';
        if(ci === 0) co += '<span class="coord rank">' + r + '</span>';
        if(ri === 7) co += '<span class="coord file">' + FILES.charAt(f) + '</span>';
        h += '<div class="' + cls + '" data-psq="' + sq + '">' + co + (p ? '<img class="piece-img" draggable="false" alt="" src="' + pieceImgUrl(p.color, p.type) + '">' : '') + '</div>';
      });
    });
    return h + '</div>';
  }
  function paletteHtml(){
    return '<div class="ps-pal">' + TOOLS.map(function(t){ return '<button class="ps-tool' + (E.tool === t ? ' on' : '') + '" data-tool="' + t + '" title="' + (t.charAt(0) === 'w' ? 'White ' : 'Black ') + PN[t.charAt(1)] + '"><img alt="" src="' + pieceImgUrl(t.charAt(0), t.charAt(1)) + '"></button>'; }).join('') +
      '<button class="ps-tool' + (E.tool === 'x' ? ' on' : '') + '" data-tool="x" title="Remove a piece">&#10005;</button></div>';
  }
  function tag(k){ return '<span class="ps-tag ps-' + k + '">' + (k === 'fact' ? 'Fact' : k === 'engine' ? 'Engine' : 'Advice') + '</span>'; }
  function resultHtml(M){
    if(!M) return '';
    var h = '<div class="card ps-res"><h2>What this position is about</h2>' +
      '<div class="ps-evbar" title="' + esc(M.evalNum) + '"><div style="width:' + Math.round(M.pct) + '%"></div></div>' +
      '<div class="ps-evline">' + tag('engine') + ' <b>' + esc(M.evalText) + '</b> <span>' + (/^mate/.test(M.evalNum) ? '' : esc(M.evalNum)) + '</span></div>' +
      '<p class="ps-sum">' + esc(M.summary) + '</p>';
    h += '<h3 class="ps-h">Side by side ' + tag('fact') + '</h3><div class="ps-tbl"><div class="ps-r ps-hd"><span></span><span>White</span><span>Black</span></div>' +
      M.rows.map(function(r){ return '<div class="ps-r"><span class="ps-l">' + esc(r.label) + '</span><span>' + esc(r.w) + '</span><span>' + esc(r.b) + '</span></div>' + (r.note ? '<div class="ps-note">' + esc(r.note) + '</div>' : ''); }).join('') + '</div>';
    h += '<h3 class="ps-h">Plans ' + tag('advice') + '</h3><div class="ps-plans">' + ['w', 'b'].map(function(c){ return '<div><b>' + name(c) + (c === M.turn ? ' (to move)' : '') + '</b><ul>' + M.plans[c].map(function(t){ return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>'; }).join('') + '</div>';
    h += '<h3 class="ps-h">Best moves ' + tag('engine') + '</h3>' + M.moves.map(function(m){
      return '<div class="ps-mv"><div class="ps-mvh"><b>' + m.rank + '. ' + esc(m.san) + '</b> <span>' + esc(m.evalNum) + '</span>' + (m.worse >= 0.15 && m.worse < 20 ? '<em>about ' + m.worse.toFixed(1) + ' pawns less accurate than the best</em>' : '') + '</div>' + (m.reason ? '<div>' + tag(m.rk || 'fact') + ' ' + esc(m.reason) + '</div>' : '') + '<div class="ps-line">' + esc(m.line) + '</div></div>';
    }).join('');
    h += '<p class="hint" style="margin-top:12px;"><b>Fact</b>: counted from the board or settled by the rules, so it is certain. <b>Engine</b>: from the Stockfish search; strong, but it can change with deeper search. <b>Advice</b>: general rules of thumb, a starting point and not a proof.</p></div>';
    return h;
  }
  function draw(){
    if(!E.root) return;
    var fen = toFen();
    E.root.innerHTML =
      '<div class="card"><h2>Understand a position</h2><p class="desc">Set up any standard chess position, or paste a FEN. The engine evaluates it and the page explains who is better, what matters, a plan for each side and the best moves.</p>' +
      '<div class="ps-grid"><div>' + boardHtml() + '</div><div class="ps-side">' +
        paletteHtml() +
        '<div class="ps-row"><span>To move</span><label><input type="radio" name="psTurn" value="w"' + (E.turn === 'w' ? ' checked' : '') + '> White</label><label><input type="radio" name="psTurn" value="b"' + (E.turn === 'b' ? ' checked' : '') + '> Black</label></div>' +
        '<div class="ps-row"><span>Castling</span>' + [['K', 'White short'], ['Q', 'White long'], ['k', 'Black short'], ['q', 'Black long']].map(function(c){ return '<label><input type="checkbox" data-cs="' + c[0] + '"' + (E.cs[c[0]] ? ' checked' : '') + '> ' + c[1] + '</label>'; }).join('') + '</div>' +
        '<div class="ps-row"><button class="secondary" id="psStart">Start position</button><button class="secondary" id="psClear">Clear board</button><button class="secondary" id="psFlip">Flip</button></div>' +
        '<div class="ps-row"><input id="psFen" type="text" spellcheck="false" placeholder="Paste a FEN here" value="' + esc(fen) + '"><button class="secondary" id="psLoad">Load</button></div>' +
        '<div class="ps-row"><button id="psGo"' + (E.busy ? ' disabled' : '') + '>' + (E.busy ? 'Thinking...' : 'Explain this position') + '</button></div>' +
        '<div class="hint" id="psMsg">' + esc(E.status || '') + '</div>' +
      '</div></div></div>' + resultHtml(E.result);
    bind();
  }
  function bind(){
    var r = E.root;
    r.querySelectorAll('[data-psq]').forEach(function(el){ el.onclick = function(){
      var sq = el.dataset.psq;
      if(!E.tool){ E.status = 'Pick a piece from the row above the board, then click a square.'; draw(); return; }
      if(E.tool === 'x') delete E.pieces[sq];
      else { var c = E.tool.charAt(0), t = E.tool.charAt(1), cur = at(sq); if(cur && cur.color === c && cur.type === t) delete E.pieces[sq]; else E.pieces[sq] = {color:c, type:t}; }
      E.result = null; E.status = ''; draw();
    }; });
    r.querySelectorAll('[data-tool]').forEach(function(el){ el.onclick = function(){ E.tool = (E.tool === el.dataset.tool) ? null : el.dataset.tool; draw(); }; });
    r.querySelectorAll('input[name=psTurn]').forEach(function(el){ el.onchange = function(){ E.turn = el.value; E.result = null; draw(); }; });
    r.querySelectorAll('[data-cs]').forEach(function(el){ el.onchange = function(){ E.cs[el.dataset.cs] = el.checked ? 1 : 0; }; });
    r.querySelector('#psStart').onclick = function(){ setFen(START); };
    r.querySelector('#psClear').onclick = function(){ E.pieces = {}; E.result = null; E.status = ''; draw(); };
    r.querySelector('#psFlip').onclick = function(){ E.flip = !E.flip; draw(); };
    r.querySelector('#psLoad').onclick = function(){ setFen(r.querySelector('#psFen').value); };
    r.querySelector('#psFen').onkeydown = function(e){ if(e.key === 'Enter') setFen(this.value); };
    r.querySelector('#psGo').onclick = run;
  }
  function setFen(fen){
    var p = parseFen(fen);
    if(!p){ E.status = 'That is not a valid FEN.'; draw(); return; }
    E.pieces = p.pieces; E.turn = p.turn; E.cs = p.cs; E.result = null; E.status = ''; draw();
  }
  async function run(){
    if(E.busy) return;
    var fen = toFen(), err = validate(fen);
    if(err){ E.status = err; draw(); return; }
    var mover = fen.split(' ')[1], t = new Chess(); t.load(fen);
    if(t.game_over()){
      E.result = null;
      E.status = t.in_checkmate() ? 'This is checkmate. ' + name(other(mover)) + ' has won.' : 'The game is over here (' + (t.in_stalemate() ? 'stalemate' : 'a draw') + ').';
      draw(); return;
    }
    E.busy = true; E.status = 'Loading the engine...'; draw();
    try{
      var Z = core(), eng = await Z.getEngine(function(s){ E.status = s; var m = E.root && E.root.querySelector('#psMsg'); if(m) m.textContent = s; });
      E.status = 'Thinking about the position...'; var m2 = E.root && E.root.querySelector('#psMsg'); if(m2) m2.textContent = E.status;
      var R = await Z.evalFen(eng, fen, 2500, 3);
      E.result = understand(fen, R); E.status = '';
    }catch(e){
      console.error('position reading failed', e);
      E.result = null; E.status = 'Sorry, something went wrong while reading this position.';
    }
    E.busy = false; draw();
    try{ var rs = E.root.querySelector('.ps-res'); if(rs) rs.scrollIntoView({behavior:'smooth', block:'start'}); }catch(e){}
  }

  window.PawniacPosition = {
    mount: function(root, opts){
      E.root = root; opts = opts || {};
      if(opts.fen){ var p = parseFen(opts.fen); if(p){ E.pieces = p.pieces; E.turn = p.turn; E.cs = p.cs; E.result = null; E.status = ''; } }
      else if(!Object.keys(E.pieces).length){ var s = parseFen(START); E.pieces = s.pieces; E.turn = s.turn; E.cs = s.cs; }
      draw();
      if(opts.fen && opts.auto) run();
    },
    _test: {parseFen:parseFen, understand:understand, scan:scan, validate:validate}
  };
})();
