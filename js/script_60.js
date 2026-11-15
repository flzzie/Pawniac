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

  // ---------- board geometry (rules only, no engine) ----------
  var KN = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]], KG = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  var VALS = {p:1, n:3, b:3, r:5, q:9, k:100};
  function inb(f, r){ return f >= 0 && f <= 7 && r >= 1 && r <= 8; }
  function sqAt(f, r){ return FILES.charAt(f) + r; }
  // the pieces of colour c that attack square sq, by geometry (pins are handled separately)
  function attackersOf(pcs, sq, c){
    var f = FILES.indexOf(sq.charAt(0)), r = +sq.charAt(1), out = [], pr = c === 'w' ? r - 1 : r + 1;
    [f - 1, f + 1].forEach(function(ff){ if(inb(ff, pr)){ var p = pcs[sqAt(ff, pr)]; if(p && p.color === c && p.type === 'p') out.push({sq:sqAt(ff, pr), type:'p'}); } });
    KN.forEach(function(d){ var ff = f + d[0], rr = r + d[1]; if(inb(ff, rr)){ var p = pcs[sqAt(ff, rr)]; if(p && p.color === c && p.type === 'n') out.push({sq:sqAt(ff, rr), type:'n'}); } });
    KG.forEach(function(d){ var ff = f + d[0], rr = r + d[1]; if(inb(ff, rr)){ var p = pcs[sqAt(ff, rr)]; if(p && p.color === c && p.type === 'k') out.push({sq:sqAt(ff, rr), type:'k'}); } });
    KG.forEach(function(d){
      var ff = f + d[0], rr = r + d[1], diag = d[0] !== 0 && d[1] !== 0;
      while(inb(ff, rr)){
        var p = pcs[sqAt(ff, rr)];
        if(p){ if(p.color === c && (p.type === 'q' || (diag && p.type === 'b') || (!diag && p.type === 'r'))) out.push({sq:sqAt(ff, rr), type:p.type}); break; }
        ff += d[0]; rr += d[1];
      }
    });
    return out;
  }
  // pieces of colour c that are pinned to their own king
  function pinsOf(pcs, c){
    var ks = Object.keys(pcs).filter(function(s){ return pcs[s].color === c && pcs[s].type === 'k'; })[0], out = [];
    if(!ks) return out;
    var f = FILES.indexOf(ks.charAt(0)), r = +ks.charAt(1);
    KG.forEach(function(d){
      var ff = f + d[0], rr = r + d[1], diag = d[0] !== 0 && d[1] !== 0, cand = null;
      while(inb(ff, rr)){
        var sq = sqAt(ff, rr), p = pcs[sq];
        if(p){
          if(!cand){ if(p.color === c) cand = {sq:sq, type:p.type}; else break; }
          else { if(p.color !== c && (p.type === 'q' || (diag && p.type === 'b') || (!diag && p.type === 'r'))) out.push({sq:cand.sq, type:cand.type, by:{sq:sq, type:p.type}, dx:d[0], dy:d[1]}); break; }
        }
        ff += d[0]; rr += d[1];
      }
    });
    return out;
  }
  // a pinned piece may only move along the pin line: can the piece on `from` capture on `to`?
  function pinOk(pins, from, to){
    var pin = pins.filter(function(x){ return x.sq === from; })[0]; if(!pin) return true;
    var vx = FILES.indexOf(to.charAt(0)) - FILES.indexOf(from.charAt(0)), vy = +to.charAt(1) - +from.charAt(1);
    return vx * pin.dy - vy * pin.dx === 0;
  }
  // pieces of colour c that are attacked and have no defender
  function loosePieces(pcs, c){
    var e = other(c), pe = pinsOf(pcs, e), out = [];
    Object.keys(pcs).forEach(function(sq){
      var p = pcs[sq]; if(p.color !== c || p.type === 'k') return;
      var att = attackersOf(pcs, sq, e).filter(function(a){ return pinOk(pe, a.sq, sq); });
      if(att.length && !attackersOf(pcs, sq, c).length) out.push({sq:sq, type:p.type, by:att.sort(function(a, b){ return VALS[a.type] - VALS[b.type]; })[0]});
    });
    return out.sort(function(a, b){ return VALS[b.type] - VALS[a.type]; });
  }
  // king and pawn against king: can the lone king catch the pawn if the pawn simply runs? (the "square" rule)
  function squareRule(pcs, turn){
    var keys = Object.keys(pcs); if(keys.length !== 3) return null;
    var ps = keys.filter(function(s){ return pcs[s].type === 'p'; }); if(ps.length !== 1) return null;
    var sq = ps[0], c = pcs[sq].color, f = FILES.indexOf(sq.charAt(0)), r = +sq.charAt(1), dir = c === 'w' ? 1 : -1, last = c === 'w' ? 8 : 1;
    for(var rr = r + dir; rr !== last + dir; rr += dir) if(pcs[sqAt(f, rr)]) return null;   // something stands in its way
    var n = Math.abs(last - r) - (r === (c === 'w' ? 2 : 7) ? 1 : 0);                       // moves the pawn needs (a pawn on its start rank can jump two)
    var ek = keys.filter(function(s){ return pcs[s].type === 'k' && pcs[s].color !== c; })[0];
    var d = Math.max(Math.abs(FILES.indexOf(ek.charAt(0)) - f), Math.abs(+ek.charAt(1) - last));
    return {pawn:sq, color:c, caught: turn === c ? d <= n : d <= n + 1};
  }
  // ---------- exact king + pawn against king, computed here in the browser (no server) ----------
  // The same method chess engines use for their built-in KPK table: every position is solved once, backwards from the obvious wins and draws.
  var KPK = null;
  function kdist(a, b){ return Math.max(Math.abs((a & 7) - (b & 7)), Math.abs((a >> 3) - (b >> 3))); }
  function kAtt(s){ var o = [], f = s & 7, r = s >> 3; for(var df = -1; df <= 1; df++) for(var dr = -1; dr <= 1; dr++){ if(!df && !dr) continue; var ff = f + df, rr = r + dr; if(ff >= 0 && ff < 8 && rr >= 0 && rr < 8) o.push(ff + 8 * rr); } return o; }
  function pAtt(p){ var o = [], f = p & 7; if((p >> 3) < 7){ if(f > 0) o.push(p + 7); if(f < 7) o.push(p + 9); } return o; }
  function kidx(stm, wk, bk, psq){ return wk | (bk << 6) | (stm << 12) | ((psq & 7) << 13) | ((6 - (psq >> 3)) << 15); }
  function kpkBuild(){
    var N = 196608, db = new Uint8Array(N), INV = 0, UNK = 1, DRAW = 2, WIN = 4, i;
    function dec(ix){ return {wk:ix & 63, bk:(ix >> 6) & 63, stm:(ix >> 12) & 1, psq:((ix >> 13) & 3) + 8 * (6 - (ix >> 15))}; }
    for(i = 0; i < N; i++){
      var d = dec(i), wk = d.wk, bk = d.bk, ps = d.psq;
      if(kdist(wk, bk) <= 1 || wk === ps || bk === ps || (d.stm === 0 && pAtt(ps).indexOf(bk) >= 0)) { db[i] = INV; continue; }
      if(d.stm === 0 && (ps >> 3) === 6 && wk !== ps + 8 && (kdist(bk, ps + 8) > 1 || kdist(wk, ps + 8) === 1)){ db[i] = WIN; continue; }
      if(d.stm === 1){
        var wa = kAtt(wk), pa = pAtt(ps), free = kAtt(bk).filter(function(t){ return wa.indexOf(t) < 0 && pa.indexOf(t) < 0; });
        if(!free.length || (kAtt(bk).indexOf(ps) >= 0 && wa.indexOf(ps) < 0)){ db[i] = DRAW; continue; }
      }
      db[i] = UNK;
    }
    var changed = true;
    while(changed){
      changed = false;
      for(i = 0; i < N; i++){
        if(db[i] !== UNK) continue;
        var e = dec(i), r = 0, good = e.stm === 0 ? WIN : DRAW, bad = e.stm === 0 ? DRAW : WIN;
        if(e.stm === 0){
          kAtt(e.wk).forEach(function(t){ r |= db[kidx(1, t, e.bk, e.psq)]; });
          if((e.psq >> 3) < 6) r |= db[kidx(1, e.wk, e.bk, e.psq + 8)];
          if((e.psq >> 3) === 1 && e.psq + 8 !== e.wk && e.psq + 8 !== e.bk) r |= db[kidx(1, e.wk, e.bk, e.psq + 16)];
        } else kAtt(e.bk).forEach(function(t){ r |= db[kidx(0, e.wk, t, e.psq)]; });
        var res = (r & good) ? good : ((r & UNK) ? UNK : bad);
        if(res !== UNK){ db[i] = res; changed = true; }
      }
    }
    for(i = 0; i < N; i++) if(db[i] === UNK) db[i] = DRAW;   // neither side can force anything: a draw
    return db;
  }
  // result for the side with the pawn: 'win', 'draw', or null (not a legal position)
  function kpkProbe(pawnColor, pawnSq, pawnKing, defKing, pawnSideToMove){
    if(!KPK) KPK = kpkBuild();
    function n(sq){ return FILES.indexOf(sq.charAt(0)) + 8 * (+sq.charAt(1) - 1); }
    var ps = n(pawnSq), wk = n(pawnKing), bk = n(defKing);
    if(pawnColor === 'b'){ ps ^= 56; wk ^= 56; bk ^= 56; }          // turn the board over so the pawn side moves up
    if((ps & 7) > 3){ ps ^= 7; wk ^= 7; bk ^= 7; }                  // the table only stores files a to d
    if((ps >> 3) < 1 || (ps >> 3) > 6) return null;
    var v = KPK[kidx(pawnSideToMove ? 0 : 1, wk, bk, ps)];
    return v === 4 ? 'win' : (v === 2 ? 'draw' : null);
  }
  // key squares: places where the pawn's king wins whoever moves, wherever the other king is (when it cannot simply take the pawn)
  function kpkKeySquares(pawnColor, pawnSq){
    var out = [], all = [], f, r;
    for(f = 0; f < 8; f++) for(r = 1; r <= 8; r++) all.push(sqAt(f, r));
    var pf = FILES.indexOf(pawnSq.charAt(0)), pr = +pawnSq.charAt(1);
    all.forEach(function(s){
      if(s === pawnSq) return;
      var ok = true, seen = 0;
      all.forEach(function(b){
        if(!ok || b === s || b === pawnSq) return;
        var bf = FILES.indexOf(b.charAt(0)), br = +b.charAt(1), sf = FILES.indexOf(s.charAt(0)), sr = +s.charAt(1);
        if(Math.max(Math.abs(bf - sf), Math.abs(br - sr)) <= 1) return;               // kings cannot touch
        if(Math.max(Math.abs(bf - pf), Math.abs(br - pr)) <= 1) return;               // the other king is already on the pawn: the textbook idea does not apply
        var a = kpkProbe(pawnColor, pawnSq, s, b, true), c = kpkProbe(pawnColor, pawnSq, s, b, false);
        if(a === null || c === null) return;
        seen++; if(a !== 'win' || c !== 'win') ok = false;
      });
      if(ok && seen) out.push(s);
    });
    return out;
  }

  // ---------- known endgame patterns (rules of the board; the engine's number only confirms them) ----------
  function sqColour(sq){ return (FILES.indexOf(sq.charAt(0)) + +sq.charAt(1)) % 2; }
  function inventory(pcs){
    var I = {w:{p:[], n:[], b:[], r:[], q:[], k:[]}, b:{p:[], n:[], b:[], r:[], q:[], k:[]}};
    Object.keys(pcs).forEach(function(sq){ var q = pcs[sq]; I[q.color][q.type].push(sq); });
    return I;
  }
  // does colour c have exactly these pieces (plus its king)?
  function exactly(I, c, spec){ return ['p', 'n', 'b', 'r', 'q'].every(function(t){ return I[c][t].length === (spec[t] || 0); }); }
  function endgameFacts(pcs, turn, cp, P, mateNow){
    var out = [], I = inventory(pcs), tot = Object.keys(pcs).length, pawns = I.w.p.length + I.b.p.length;
    function add(k, t){ out.push({k:k, t:t}); }
    // king and pawn against king: solved exactly
    if(tot === 3 && pawns === 1){
      var pc = I.w.p.length ? 'w' : 'b', ps = I[pc].p[0], pk = I[pc].k[0], dk = I[other(pc)].k[0], res = kpkProbe(pc, ps, pk, dk, turn === pc);
      if(res === 'win') add('fact', 'King and pawn against king, solved exactly: ' + name(pc) + ' wins with best play.');
      else if(res === 'draw') add('fact', 'King and pawn against king, solved exactly: this is a draw with best play. The pawn cannot be forced through.');
      var ks = kpkKeySquares(pc, ps);
      if(ks.length) add('fact', 'Key squares for the pawn on ' + ps + ': ' + ks.join(', ') + '. If the ' + name(pc).toLowerCase() + ' king gets to one of them, the pawn promotes whoever is to move.' + (ks.indexOf(pk) >= 0 ? ' The king is already on one.' : ''));
    }
    // opposition (only kings and pawns on the board)
    if(tot === pawns + 2){
      var wk = I.w.k[0], bk = I.b.k[0], wf = FILES.indexOf(wk.charAt(0)), bf = FILES.indexOf(bk.charAt(0)), wr = +wk.charAt(1), br = +bk.charAt(1), df = Math.abs(wf - bf), dr = Math.abs(wr - br), kind = null, clear = true, st, j;
      if(wf === bf && [2, 4, 6].indexOf(dr) >= 0){ kind = dr; st = Math.min(wr, br); for(j = 1; j < dr; j++) if(pcs[sqAt(wf, st + j)]) clear = false; }
      else if(wr === br && [2, 4, 6].indexOf(df) >= 0){ kind = df; st = Math.min(wf, bf); for(j = 1; j < df; j++) if(pcs[sqAt(st + j, wr)]) clear = false; }
      if(kind && clear) add('fact', name(other(turn)) + ' has the ' + (kind === 2 ? 'direct' : 'distant') + ' opposition: the kings face each other with an odd number of squares between them and ' + name(turn) + ' has to move, so ' + name(turn) + ' must give way.');
    }
    // opposite-coloured bishops
    if(I.w.b.length === 1 && I.b.b.length === 1 && sqColour(I.w.b[0]) !== sqColour(I.b.b[0])){
      add('fact', 'Opposite-coloured bishops: each side has one bishop and they move on different colours, so neither can ever challenge the other.');
      if(!['n', 'r', 'q'].some(function(t){ return I.w[t].length + I.b[t].length > 0; })) add('advice', 'With only these bishops and pawns left, such endings are drawn surprisingly often, even a pawn or two down. The side that is behind should try to keep it that way.');
    }
    // dead draws and textbook patterns
    ['w', 'b'].forEach(function(A){
      var D = other(A), sgn = A === 'w' ? 1 : -1;
      if(exactly(I, A, {n:2}) && exactly(I, D, {})) add('fact', 'Two knights cannot force checkmate against a lone king: it only happens if the defender blunders. With correct play this is a draw.');
      if(exactly(I, A, {r:1}) && (exactly(I, D, {b:1}) || exactly(I, D, {n:1})) && Math.abs(cp) <= 60) add('advice', 'A rook against a bishop or a knight is normally a draw: the side with the minor piece should avoid being forked or trapped near the edge.');
      if(exactly(I, A, {b:1, p:1}) && exactly(I, D, {})){
        var bp = I[A].p[0], bf2 = bp.charAt(0), prom2 = A === 'w' ? 8 : 1;
        if((bf2 === 'a' || bf2 === 'h') && sqColour(I[A].b[0]) !== sqColour(bf2 + prom2) && Math.abs(cp) <= 60) add('fact', 'Wrong-coloured bishop with a rook pawn: the bishop cannot cover the pawn\'s promotion square, so the defender draws by getting the king into that corner. The engine agrees that it is a draw.');
      }
      if(exactly(I, A, {r:1, p:1}) && exactly(I, D, {r:1})){
        var ps2 = I[A].p[0], pf2 = FILES.indexOf(ps2.charAt(0)), pr2 = +ps2.charAt(1), ak = I[A].k[0], dk2 = I[D].k[0], ar = I[A].r[0], dr2 = I[D].r[0];
        var seventh = A === 'w' ? 7 : 2, prom = A === 'w' ? 8 : 1, sixth = A === 'w' ? 6 : 3;
        // Lucena: pawn on the 7th, its king on the queening square, the defending king cut off by at least a file with the rook in between
        if(pf2 >= 1 && pf2 <= 6 && pr2 === seventh && ak === FILES.charAt(pf2) + prom){
          var dkf = FILES.indexOf(dk2.charAt(0)), arf = FILES.indexOf(ar.charAt(0));
          if(Math.abs(dkf - pf2) >= 2 && Math.min(pf2, dkf) < arf && arf < Math.max(pf2, dkf) && sgn * cp >= 150){
            add('fact', 'This is a Lucena position, the most famous winning rook ending: ' + name(A) + ' has the pawn on the 7th, its king on the queening square and the defending king cut off. The engine agrees it is winning.');
            add('advice', 'The usual winning method is to build a bridge: bring the rook to the 4th rank, walk the king out to the side, and use the rook to shield it from checks.');
          }
        }
        // Philidor: defending king on the queening rank, defending rook on the 6th rank, pawn not yet on the 6th
        var pawnBack = A === 'w' ? pr2 <= 5 : pr2 >= 4, akBack = A === 'w' ? +ak.charAt(1) <= 5 : +ak.charAt(1) >= 4;
        if(pawnBack && akBack && +dk2.charAt(1) === prom && Math.abs(FILES.indexOf(dk2.charAt(0)) - pf2) <= 1 && +dr2.charAt(1) === sixth && Math.abs(cp) <= 60){
          add('fact', 'This is a Philidor position, the standard drawing set-up in rook endings: ' + name(D) + ' keeps the rook on the 6th rank and the king on the back rank. The engine agrees it is a draw.');
          add('advice', 'Keep the rook on the 6th rank until the pawn moves there, then switch to checking from behind.');
        }
      }
    });
    // material up but the engine still sees a draw: the extra material is shut out (a fortress) or the other side has compensation
    var md = P.w.mat - P.b.mat;
    if(!mateNow && Math.abs(md) >= 3 && Math.abs(cp) <= 50 && out.every(function(x){ return !/draw|Wrong|Philidor/.test(x.t); }))
      add('engine', name(md > 0 ? 'w' : 'b') + ' is up ' + Math.abs(md) + ' points of material, but the engine still rates the position as roughly equal. The extra material is not getting through: look for a fortress, a blocked position or real compensation.');
    return out;
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
      var dir = c === 'w' ? 1 : -1;
      o.backward = []; o.protectedPassed = []; o.connectedPassed = []; o.blockaded = {};
      o.pawns.forEach(function(p){
        var side = o.pawns.some(function(q){ return Math.abs(q.f - p.f) === 1; });
        var behind = o.pawns.some(function(q){ return Math.abs(q.f - p.f) === 1 && (c === 'w' ? q.r <= p.r : q.r >= p.r); });
        var stopAtt = opp.pawns.some(function(q){ return Math.abs(q.f - p.f) === 1 && q.r === p.r + 2 * dir; });
        if(side && !behind && stopAtt) o.backward.push(p);     // cannot be defended by a pawn and cannot step forward safely
      });
      o.passed.forEach(function(p){
        if(o.pawns.some(function(q){ return Math.abs(q.f - p.f) === 1 && q.r === p.r - dir; })) o.protectedPassed.push(p.sq);
        if(o.passed.some(function(q){ return Math.abs(q.f - p.f) === 1; })) o.connectedPassed.push(p.sq);
        var stop = pcs[sqAt(p.f, p.r + dir)]; if(stop && stop.color !== c && stop.type !== 'p') o.blockaded[p.sq] = stop;
      });
      var fl = Object.keys(pf).map(Number).sort(function(a, b){ return a - b; }); o.islands = 0;
      fl.forEach(function(f, i){ if(i === 0 || f !== fl[i - 1] + 1) o.islands++; });
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
    var pcs = parseFen(fen).pieces;
    // the position as if it were colour col's move (null when that would be illegal)
    function asTurn(col){
      var g = new Chess(); if(!g.load(Z.flipTurn(fen, col))) return null;
      var h = new Chess(); if(!h.load(Z.flipTurn(fen, other(col))) || h.in_check()) return null;
      return g;
    }
    // king facts: how many squares it can step to, and how many checks the other side has
    ['w', 'b'].forEach(function(c){
      try{
        var bits = [], g = asTurn(c), h = asTurn(other(c));
        if(g){ var esc0 = g.moves({verbose:true}).filter(function(m){ return m.piece === 'k' && !/[kq]/.test(m.flags); }).length; bits.push(esc0 ? plural(esc0, 'escape square') : 'no escape squares'); }
        if(h){ var ch = h.moves().filter(function(x){ return /[+#]/.test(x); }).length; bits.push(ch ? 'the opponent could give ' + plural(ch, 'check') : 'no checks for the opponent'); }
        if(bits.length) K[c].text += '; ' + bits.join('; ');
      }catch(e){}
    });
    var LP = {w:loosePieces(pcs, 'w'), b:loosePieces(pcs, 'b')}, PINS = {w:pinsOf(pcs, 'w'), b:pinsOf(pcs, 'b')};

    // ---- feature rows ----
    function pawnsText(c){
      var o = P[c], bits = [];
      if(o.isolated.length) bits.push('isolated: ' + sqList(o.isolated));
      if(o.doubled.length) bits.push('doubled: ' + fileList(o.doubled) + '-file');
      if(o.backward.length) bits.push('backward: ' + sqList(o.backward));
      if(o.passed.length) bits.push('passed: ' + o.passed.map(function(p){
        var q = []; if(o.protectedPassed.indexOf(p.sq) >= 0) q.push('protected'); if(o.connectedPassed.indexOf(p.sq) >= 0) q.push('connected'); if(o.blockaded[p.sq]) q.push('blockaded by the ' + pieceWord(o.blockaded[p.sq].type));
        return p.sq + (q.length ? ' (' + q.join(', ') + ')' : ''); }).join(', '));
      if(o.islands > 1) bits.push(o.islands + ' pawn islands');
      return bits.length ? bits.join('; ') : (o.pawns.length ? 'no isolated, doubled, backward or passed pawns' : 'no pawns');
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
    function looseText(c){ return LP[c].length ? LP[c].slice(0, 3).map(function(x){ return pieceWord(x.type) + ' on ' + x.sq + ' (attacked by the ' + pieceWord(x.by.type) + ' on ' + x.by.sq + ')'; }).join('; ') : 'none'; }
    function pinText(c){ return PINS[c].length ? PINS[c].map(function(x){ return pieceWord(x.type) + ' on ' + x.sq + ' (pinned by the ' + pieceWord(x.by.type) + ' on ' + x.by.sq + ')'; }).join('; ') : 'none'; }
    M.rows.push({label:'Loose pieces', kind:'fact', w:looseText('w'), b:looseText('b'), note:'Loose = attacked and not defended by anything.'});
    M.rows.push({label:'Pinned', kind:'fact', w:pinText('w'), b:pinText('b')});
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
    function lineSans(pv, f0){
      var f1 = f0 || fen, c = new Chess(); c.load(f1); var out = [], n = f1.split(' '), full = parseInt(n[5], 10) || 1, t = n[1];
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
    function drawWarn(m){
      try{
        var g = new Chess(fen); g.move({from:m.from, to:m.to, promotion:m.promotion});
        if(g.in_stalemate()) return 'This move is stalemate: the game is drawn.';
        if(g.insufficient_material()) return 'After this move neither side has enough material to win: the game is drawn.';
      }catch(e){}
      return '';
    }
    var cands = [{uci:R.best, cp:R.cp, pv:R.pv}].concat((R.alts || []).map(function(a){ return {uci:a.best, cp:a.cp, pv:a.pv}; })), sign = turn === 'w' ? 1 : -1;
    M.moves = cands.map(function(cd, i){
      var m = cd.uci ? Z.tryMove(fen, cd.uci) : null;
      if(!m) return null;
      var info = null; try{ info = Z.pvInfo(fen, cd.pv && cd.pv.length ? cd.pv : [cd.uci], 4, turn); }catch(e){}
      var rs = reason(m, info ? info.net : 0, cd.cp, i > 0 && Math.abs(R.cp) < 9000 && sign * (R.cp - cd.cp) >= 150 || i > 0 && Math.abs(R.cp) >= 9000);
      return {rank:i + 1, san:m.san, evalNum:fmtEval(cd.cp), reason:rs.t, rk:rs.k, line:lineSans(cd.pv && cd.pv.length ? cd.pv : [cd.uci]),
              warn:drawWarn(m),
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
    // ---- extra facts and engine lines
    M.depth = R.depth || 0;
    M.keyFacts = [];
    try{
      var me0 = new Chess(fen); if(me0.in_check()) M.keyFacts.push({k:'fact', t:name(turn) + ' is in check.'});
      var sr = squareRule(pcs, turn);
      if(sr){
        var pc = name(sr.color), dk = name(other(sr.color));
        M.keyFacts.push({k:'fact', t:sr.caught ? 'Square rule: if the ' + pc.toLowerCase() + ' pawn on ' + sr.pawn + ' simply runs, the ' + dk.toLowerCase() + ' king is in time to catch it.' : 'Square rule: the ' + dk.toLowerCase() + ' king cannot catch the ' + pc.toLowerCase() + ' pawn on ' + sr.pawn + ', so it promotes.'});
      }
      if(sign * cp >= 200){   // the side to move is clearly ahead: a stalemate would throw it away
        var tg = new Chess(fen), traps = [];
        tg.moves({verbose:true}).forEach(function(m){ tg.move({from:m.from, to:m.to, promotion:m.promotion}); if(tg.in_stalemate()) traps.push(m.san); tg.undo(); });
        if(traps.length) M.keyFacts.push({k:'fact', t:'Careful: ' + traps.slice(0, 4).join(' or ') + ' would be stalemate, which only draws the game.'});
      }
    }catch(e){}
    try{ endgameFacts(pcs, turn, cp, P, mateNow).forEach(function(x){ M.keyFacts.push(x); }); }catch(e){ console.error('endgame facts failed', e); }
    if(R.opp && R.opp.best){
      try{
        var oppFen = Z.flipTurn(fen, op), om = Z.tryMove(oppFen, R.opp.best);
        if(om){
          var osg = op === 'w' ? 1 : -1, sw = osg * (R.opp.cp - R.cp) / 100, omate = Math.abs(R.opp.cp) >= 9000 && osg * R.opp.cp > 0 ? Math.max(1, Math.round((10000 - Math.abs(R.opp.cp)) / 10)) : 0;
          M.opp = {name:name(op), san:om.san, evalNum:fmtEval(R.opp.cp), line:lineSans(R.opp.pv && R.opp.pv.length ? R.opp.pv : [R.opp.best], oppFen),
                   text: omate ? name(op) + ' would threaten checkmate in ' + omate + '.' : (sw >= 0.5 ? 'This is the threat to watch: it would gain ' + name(op) + ' about ' + sw.toFixed(1) + ' pawns.' : name(op) + ' has no big threat here: the gain would be under half a pawn.')};
        }
      }catch(e){}
    }
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
      '<div class="ps-evline">' + tag('engine') + ' <b>' + esc(M.evalText) + '</b> <span>' + (/^mate/.test(M.evalNum) ? '' : esc(M.evalNum)) + (M.depth ? (/^mate/.test(M.evalNum) ? '' : ' \u00b7 ') + 'search depth ' + M.depth : '') + '</span></div>' +
      '<p class="ps-sum">' + esc(M.summary) + '</p>';
    if(M.keyFacts && M.keyFacts.length) h += '<h3 class="ps-h">Worth knowing</h3><ul class="ps-kf">' + M.keyFacts.map(function(x){ return '<li>' + tag(x.k) + ' ' + esc(x.t) + '</li>'; }).join('') + '</ul>';
    h += '<h3 class="ps-h">Side by side ' + tag('fact') + '</h3><div class="ps-tbl"><div class="ps-r ps-hd"><span></span><span>White</span><span>Black</span></div>' +
      M.rows.map(function(r){ return '<div class="ps-r"><span class="ps-l">' + esc(r.label) + '</span><span>' + esc(r.w) + '</span><span>' + esc(r.b) + '</span></div>' + (r.note ? '<div class="ps-note">' + esc(r.note) + '</div>' : ''); }).join('') + '</div>';
    h += '<h3 class="ps-h">Plans ' + tag('advice') + '</h3><div class="ps-plans">' + ['w', 'b'].map(function(c){ return '<div><b>' + name(c) + (c === M.turn ? ' (to move)' : '') + '</b><ul>' + M.plans[c].map(function(t){ return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>'; }).join('') + '</div>';
    h += '<h3 class="ps-h">Best moves ' + tag('engine') + '</h3>' + M.moves.map(function(m){
      return '<div class="ps-mv"><div class="ps-mvh"><b>' + m.rank + '. ' + esc(m.san) + '</b> <span>' + esc(m.evalNum) + '</span>' + (m.worse >= 0.15 && m.worse < 20 ? '<em>about ' + m.worse.toFixed(1) + ' pawns less accurate than the best</em>' : '') + '</div>' + (m.reason ? '<div>' + tag(m.rk || 'fact') + ' ' + esc(m.reason) + '</div>' : '') + (m.warn ? '<div>' + tag('fact') + ' ' + esc(m.warn) + '</div>' : '') + '<div class="ps-line">' + esc(m.line) + '</div></div>';
    }).join('');
    if(M.opp) h += '<h3 class="ps-h">If it were ' + esc(M.opp.name) + "'s move " + tag('engine') + '</h3><div class="ps-mv"><div class="ps-mvh"><b>' + esc(M.opp.san) + '</b> <span>' + esc(M.opp.evalNum) + '</span></div><div>' + esc(M.opp.text) + '</div><div class="ps-line">' + esc(M.opp.line) + '</div></div>';
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
      // what would the other side do with a free move? (only when the side to move is not in check)
      try{
        if(!new Chess(fen).in_check()){
          var oppFen = Z.flipTurn(fen, other(mover)), og = new Chess();
          if(og.load(oppFen) && !og.game_over()){ E.status = 'Checking what the other side wants...'; var m3 = E.root && E.root.querySelector('#psMsg'); if(m3) m3.textContent = E.status; R.opp = await Z.evalFen(eng, oppFen, 1500, 1); }
        }
      }catch(e){ R.opp = null; }
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
