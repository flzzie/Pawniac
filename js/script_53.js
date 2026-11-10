/* Pawniac: Double Move chess, the rules (pure logic, no page code).
 *
 * Rules:
 *   - White plays ONE move to open the game. After that each side plays TWO moves per turn.
 *   - There is no check and no checkmate. Pieces move as normal, but you may leave your king attacked.
 *     CAPTURING THE KING WINS THE GAME on the spot (it can happen on either of your two moves).
 *   - If you have no legal second move, your turn simply ends.
 *   - Castling needs the squares between king and rook to be empty (and the usual rights); it is allowed even
 *     if the king is attacked or passes through an attacked square, because kings can be captured anyway.
 *   - Draws: a side with no move at the end of a turn (stalemate), threefold repetition (counted per finished
 *     turn), 50 full moves without a capture or pawn move, or bare kings.
 *
 * chess.js cannot be used for this (it forbids leaving the king in check), so this file has its own small move
 * generator, PawniacDouble.Chess (also window.PawniacKChess). It answers the same questions chess.js does:
 *   new Chess(fen), fen(), turn(), get(sq), board(), moves({verbose}), move({from,to,promotion}), in_check().
 *
 * A game state is  {fen, turn, movesLeft, pos, sides}
 *   movesLeft  how many moves the side to move still has this turn (1 or 2)
 *   pos        list of "pieces turn castling" keys, one per finished turn (for repetition)
 *   sides      one letter per move played ("w"/"b"), so the move list can be shown grouped by turn
 * For the second move of a turn the FEN is rewritten so the SAME side is to move again (en passant cleared).
 *
 * This function is stringified into the bot's web worker, so it must not use anything outside itself.
 */
(function(root){
  function makeRules(){
    var FILES = 'abcdefgh';
    var START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    var KN = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
    var KG = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
    var BD = [[-1,-1],[-1,1],[1,-1],[1,1]];
    var RD = [[-1,0],[1,0],[0,-1],[0,1]];
    function sq(r, c){ return FILES.charAt(c) + (8 - r); }
    function opp(c){ return c === 'w' ? 'b' : 'w'; }
    function inb(r, c){ return r >= 0 && r < 8 && c >= 0 && c < 8; }

    function KChess(fen){ this.load(fen || START); }
    KChess.prototype = {
      load: function(fen){
        var p = String(fen).split(' '), rows = p[0].split('/'), r, c, i, ch;
        this.b = [];
        for(r = 0; r < 8; r++){
          var row = [], s = rows[r] || '';
          for(i = 0; i < s.length; i++){
            ch = s.charAt(i);
            if(ch >= '1' && ch <= '8'){ for(c = 0; c < parseInt(ch, 10); c++) row.push(null); }
            else row.push({type:ch.toLowerCase(), color:(ch === ch.toLowerCase() ? 'b' : 'w')});
          }
          while(row.length < 8) row.push(null);
          this.b.push(row);
        }
        this.t = p[1] === 'b' ? 'b' : 'w';
        this.castle = p[2] && p[2] !== '-' ? p[2] : '';
        this.ep = p[3] && p[3] !== '-' ? p[3] : '';
        this.half = parseInt(p[4], 10) || 0;
        this.full = parseInt(p[5], 10) || 1;
        return true;
      },
      fen: function(){
        var out = [], r, c;
        for(r = 0; r < 8; r++){
          var s = '', e = 0;
          for(c = 0; c < 8; c++){
            var x = this.b[r][c];
            if(!x){ e++; continue; }
            if(e){ s += e; e = 0; }
            s += x.color === 'w' ? x.type.toUpperCase() : x.type;
          }
          if(e) s += e;
          out.push(s);
        }
        return out.join('/') + ' ' + this.t + ' ' + (this.castle || '-') + ' ' + (this.ep || '-') + ' ' + this.half + ' ' + this.full;
      },
      turn: function(){ return this.t; },
      get: function(name){
        var c = FILES.indexOf(name.charAt(0)), r = 8 - parseInt(name.charAt(1), 10);
        if(!inb(r, c)) return null;
        var x = this.b[r][c]; return x ? {type:x.type, color:x.color} : null;
      },
      board: function(){
        return this.b.map(function(row){ return row.map(function(x){ return x ? {type:x.type, color:x.color} : null; }); });
      },
      // is square (r,c) attacked by a piece of colour `by`
      attacked: function(r, c, by){
        var b = this.b, i, x, rr, cc, d;
        var pr = r + (by === 'w' ? 1 : -1);
        for(i = -1; i <= 1; i += 2){
          if(inb(pr, c + i)){ x = b[pr][c + i]; if(x && x.color === by && x.type === 'p') return true; }
        }
        for(i = 0; i < 8; i++){
          rr = r + KN[i][0]; cc = c + KN[i][1];
          if(inb(rr, cc)){ x = b[rr][cc]; if(x && x.color === by && x.type === 'n') return true; }
          rr = r + KG[i][0]; cc = c + KG[i][1];
          if(inb(rr, cc)){ x = b[rr][cc]; if(x && x.color === by && x.type === 'k') return true; }
        }
        for(i = 0; i < 8; i++){
          d = i < 4 ? BD[i] : RD[i - 4];
          rr = r + d[0]; cc = c + d[1];
          while(inb(rr, cc)){
            x = b[rr][cc];
            if(x){
              if(x.color === by && (x.type === 'q' || x.type === (i < 4 ? 'b' : 'r'))) return true;
              break;
            }
            rr += d[0]; cc += d[1];
          }
        }
        return false;
      },
      in_check: function(){
        for(var r = 0; r < 8; r++) for(var c = 0; c < 8; c++){
          var x = this.b[r][c];
          if(x && x.type === 'k' && x.color === this.t) return this.attacked(r, c, opp(this.t));
        }
        return false;
      },
      // every move the pieces can make (the king may be left attacked)
      gen: function(){
        var out = [], b = this.b, me = this.t, r, c, i, x, rr, cc, d, y, self = this;
        function add(fr, fc, tr, tc, piece, flags, promo){
          var cap = b[tr][tc];
          out.push({color:me, from:sq(fr, fc), to:sq(tr, tc), piece:piece, captured:cap ? cap.type : (flags.indexOf('e') >= 0 ? 'p' : undefined),
            promotion:promo, flags:flags, fr:fr, fc:fc, tr:tr, tc:tc});
        }
        for(r = 0; r < 8; r++) for(c = 0; c < 8; c++){
          x = b[r][c];
          if(!x || x.color !== me) continue;
          if(x.type === 'p'){
            var dir = me === 'w' ? -1 : 1, start = me === 'w' ? 6 : 1, last = me === 'w' ? 0 : 7;
            rr = r + dir;
            if(inb(rr, c) && !b[rr][c]){
              if(rr === last) ['q','r','b','n'].forEach(function(p){ add(r, c, rr, c, 'p', 'np', p); });
              else{
                add(r, c, rr, c, 'p', 'n');
                if(r === start && !b[rr + dir][c]) add(r, c, rr + dir, c, 'p', 'b');
              }
            }
            for(i = -1; i <= 1; i += 2){
              cc = c + i;
              if(!inb(rr, cc)) continue;
              y = b[rr][cc];
              if(y && y.color !== me){
                if(rr === last) ['q','r','b','n'].forEach(function(p){ add(r, c, rr, cc, 'p', 'cp', p); });
                else add(r, c, rr, cc, 'p', 'c');
              }else if(!y && this.ep === sq(rr, cc)) add(r, c, rr, cc, 'p', 'e');
            }
          }else if(x.type === 'n' || x.type === 'k'){
            var tbl = x.type === 'n' ? KN : KG;
            for(i = 0; i < 8; i++){
              rr = r + tbl[i][0]; cc = c + tbl[i][1];
              if(!inb(rr, cc)) continue;
              y = b[rr][cc];
              if(!y || y.color !== me) add(r, c, rr, cc, x.type, y ? 'c' : 'n');
            }
            if(x.type === 'k'){
              var home = me === 'w' ? 7 : 0;
              if(r === home && c === 4){
                var ks = me === 'w' ? 'K' : 'k', qs = me === 'w' ? 'Q' : 'q';
                var rk = function(col){ var z = b[home][col]; return z && z.type === 'r' && z.color === me; };
                if(this.castle.indexOf(ks) >= 0 && rk(7) && !b[home][5] && !b[home][6]) add(r, c, home, 6, 'k', 'k');
                if(this.castle.indexOf(qs) >= 0 && rk(0) && !b[home][1] && !b[home][2] && !b[home][3]) add(r, c, home, 2, 'k', 'q');
              }
            }
          }else{
            var from = x.type === 'b' ? 0 : (x.type === 'r' ? 4 : 0), to = x.type === 'b' ? 4 : (x.type === 'r' ? 8 : 8);
            for(i = from; i < to; i++){
              d = i < 4 ? BD[i] : RD[i - 4];
              rr = r + d[0]; cc = c + d[1];
              while(inb(rr, cc)){
                y = b[rr][cc];
                if(!y) add(r, c, rr, cc, x.type, 'n');
                else{ if(y.color !== me) add(r, c, rr, cc, x.type, 'c'); break; }
                rr += d[0]; cc += d[1];
              }
            }
          }
        }
        return out;
      },
      san: function(m, all){
        if(m.flags === 'k') return 'O-O';
        if(m.flags === 'q') return 'O-O-O';
        var s = '', cap = m.captured !== undefined;
        if(m.piece === 'p'){
          if(cap) s += m.from.charAt(0) + 'x';
          s += m.to;
          if(m.promotion) s += '=' + m.promotion.toUpperCase();
          return s;
        }
        s += m.piece.toUpperCase();
        var same = all.filter(function(o){ return o !== m && o.piece === m.piece && o.to === m.to; });
        if(same.length){
          var sameFile = same.some(function(o){ return o.from.charAt(0) === m.from.charAt(0); });
          var sameRank = same.some(function(o){ return o.from.charAt(1) === m.from.charAt(1); });
          if(!sameFile) s += m.from.charAt(0);
          else if(!sameRank) s += m.from.charAt(1);
          else s += m.from;
        }
        return s + (cap ? 'x' : '') + m.to;
      },
      moves: function(o){
        var list = this.gen(), self = this;
        if(o && o.verbose) return list.map(function(m){ return self.pub(m, list); });
        return list.map(function(m){ return self.san(m, list); });
      },
      pub: function(m, list){
        var out = {color:m.color, from:m.from, to:m.to, piece:m.piece, flags:m.flags, san:this.san(m, list)};
        if(m.captured !== undefined) out.captured = m.captured;
        if(m.promotion) out.promotion = m.promotion;
        return out;
      },
      move: function(mv, opts){
        var list = this.gen(), m = null, i;
        for(i = 0; i < list.length; i++){
          if(list[i].from === mv.from && list[i].to === mv.to && (!list[i].promotion || list[i].promotion === (mv.promotion || 'q'))){ m = list[i]; break; }
        }
        if(!m) return null;
        var res = this.pub(m, (opts && opts.nosan) ? [m] : list);
        if(opts && opts.nosan) res.san = '';
        var b = this.b, me = this.t, piece = b[m.fr][m.fc];
        // castling rook
        if(m.flags === 'k'){ b[m.fr][5] = b[m.fr][7]; b[m.fr][7] = null; }
        if(m.flags === 'q'){ b[m.fr][3] = b[m.fr][0]; b[m.fr][0] = null; }
        if(m.flags === 'e'){ b[m.fr][m.tc] = null; }
        b[m.tr][m.tc] = m.promotion ? {type:m.promotion, color:me} : piece;
        b[m.fr][m.fc] = null;
        // castling rights
        var cs = this.castle;
        function strip(chars){ for(var k = 0; k < chars.length; k++) cs = cs.replace(chars.charAt(k), ''); }
        if(m.piece === 'k') strip(me === 'w' ? 'KQ' : 'kq');
        if(m.fr === 7 && m.fc === 0 || m.tr === 7 && m.tc === 0) strip('Q');
        if(m.fr === 7 && m.fc === 7 || m.tr === 7 && m.tc === 7) strip('K');
        if(m.fr === 0 && m.fc === 0 || m.tr === 0 && m.tc === 0) strip('q');
        if(m.fr === 0 && m.fc === 7 || m.tr === 0 && m.tc === 7) strip('k');
        this.castle = cs;
        this.ep = (m.flags === 'b') ? sq((m.fr + m.tr) / 2, m.fc) : '';
        this.half = (m.piece === 'p' || m.captured !== undefined) ? 0 : this.half + 1;
        if(me === 'b') this.full++;
        this.t = opp(me);
        return res;
      },
      hasKing: function(color){
        for(var r = 0; r < 8; r++) for(var c = 0; c < 8; c++){ var x = this.b[r][c]; if(x && x.type === 'k' && x.color === color) return true; }
        return false;
      }
    };

    // same position, but `color` to move and no en passant square
    function flip(fen, color){
      var p = fen.split(' ');
      p[1] = color; p[3] = '-';
      return p.join(' ');
    }
    // pieces + side to move + castling rights (the en passant square is left out on purpose)
    function key(fen){
      var p = fen.split(' ');
      return p[0] + ' ' + p[1] + ' ' + p[2];
    }
    function bareKings(fen){
      return fen.split(' ')[0].replace(/[\/0-9kK]/g, '').length === 0;
    }

    function start(){
      var f = new KChess().fen();
      return {fen:f, turn:'w', movesLeft:1, pos:[key(f)], sides:''};
    }

    // all single moves available to the side to move
    function moves(st){
      return new KChess(st.fen).moves({verbose:true});
    }

    /* Play one move.
       Returns null if the move is impossible, otherwise
         {mv, mover, ended, over, winner, note, next}
       ended = this move finished the mover's turn;  over = the game is over (winner 'w' | 'b' | 'draw').
       `next` is the new state. opts.fast skips SAN and repetition bookkeeping (used by the bot search). */
    function apply(st, m, opts){
      var fast = !!(opts && opts.fast);
      var c = new KChess(st.fen);
      var mover = c.turn();
      var mv = c.move({from:m.from, to:m.to, promotion:m.promotion || 'q'}, {nosan:fast});
      if(!mv) return null;

      var fen = c.fen();                      // the opponent is to move here
      var next = {fen:fen, turn:opp(mover), movesLeft:2, pos:st.pos, sides:fast ? '' : ((st.sides || '') + mover)};
      var out = {mv:mv, mover:mover, ended:true, over:false, winner:null, note:'', next:next};

      function finish(winner, note){ out.over = true; out.winner = winner; out.note = note || ''; return out; }

      if(mv.captured === 'k') return finish(mover, 'king captured');
      if(bareKings(fen)) return finish('draw', 'draw - insufficient material');

      // first of two moves: the mover keeps the move if they have a second one
      if(st.movesLeft === 2){
        var again = flip(fen, mover);
        if(new KChess(again).gen().length > 0){
          next.fen = again; next.turn = mover; next.movesLeft = 1;
          out.ended = false;
          return out;
        }
      }

      // the turn is over: stalemate, 50-move rule and repetition are decided now
      if(c.gen().length === 0) return finish('draw', 'draw - stalemate');
      if(parseInt(fen.split(' ')[4], 10) >= 200) return finish('draw', 'draw - 50-move rule');
      if(!fast){
        var k = key(fen), n = 1;
        (st.pos || []).forEach(function(x){ if(x === k) n++; });
        next.pos = (st.pos || []).concat([k]);
        if(n >= 3) return finish('draw', 'draw - threefold repetition');
      }
      return out;
    }

    // a result when the side to move runs out of time
    function flagResult(st){
      var loser = st.turn;
      if(bareKings(st.fen)) return {winner:'draw', note:'draw - insufficient material on time'};
      return {winner:opp(loser), note:'won on time'};
    }

    return {Chess:KChess, start:start, moves:moves, apply:apply, flagResult:flagResult, flip:flip, key:key, bareKings:bareKings, opp:opp};
  }

  root.PawniacDoubleMake = makeRules;
  if(typeof module !== 'undefined' && module.exports) module.exports = makeRules;
  try{
    var PD = makeRules();
    root.PawniacDouble = PD;
    root.PawniacKChess = PD.Chess;
    // the right chess object for a game: Double Move games need the one that lets kings be captured
    root.PawniacChessFor = function(variant){ return variant === 'double' ? PD.Chess : root.Chess; };
  }catch(e){}
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : this));
