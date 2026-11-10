/* Pawniac: Double Move chess, the rules (pure logic, no page code).
 *
 * Rules (Marseillais style):
 *   - White plays ONE move to open the game. After that each side plays TWO moves per turn.
 *   - If your first move gives check, your turn ends at once (you do not get a second move).
 *   - If you have no legal second move, your turn simply ends.
 *   - Every single move must be legal (it may not leave your own king in check).
 *   - Win by checkmate (it can happen on either of your two moves). Draw by stalemate (checked when a turn
 *     ends), threefold repetition (checked when a turn ends), the 50-move rule, or bare kings.
 *
 * How it is stored: the game keeps a normal FEN, but for the second move of a turn the FEN is rewritten so
 * the SAME side is to move again (en passant square cleared). That means every other part of the site that
 * does  new Chess(g.fen)  and asks for the legal moves just works.
 *
 * A game state is  {fen, turn, movesLeft, pos, sides}
 *   movesLeft  how many moves the side to move still has this turn (1 or 2)
 *   pos        list of "pieces turn castling" keys, one per finished turn (for repetition)
 *   sides      one letter per move played ("w"/"b"), so the move list can be shown grouped
 *
 * This file is used by the page (window.PawniacDouble) and is also stringified into the bot's web worker,
 * so it must stay free of anything except the Chess constructor it is given.
 */
(function(root){
  function makeRules(Chess){
    function opp(c){ return c === 'w' ? 'b' : 'w'; }

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
      var f = new Chess().fen();
      return {fen:f, turn:'w', movesLeft:1, pos:[key(f)], sides:''};
    }

    // all legal single moves for the side to move
    function moves(st){
      return new Chess(st.fen).moves({verbose:true});
    }

    /* Play one move.
       Returns null if the move is illegal, otherwise
         {mv, mover, ended, over, winner, note, next}
       ended = this move finished the mover's turn;  over = the game is over (winner 'w' | 'b' | 'draw').
       `next` is the new state. opts.fast skips repetition bookkeeping (used by the bot search). */
    function apply(st, m, opts){
      var fast = !!(opts && opts.fast);
      var c = new Chess(st.fen);
      var mover = c.turn();
      var mv = c.move({from:m.from, to:m.to, promotion:m.promotion || 'q'});
      if(!mv) return null;

      var fen = c.fen();                      // the opponent is to move here
      var next = {fen:fen, turn:opp(mover), movesLeft:2, pos:st.pos, sides:fast ? '' : ((st.sides || '') + mover)};
      var out = {mv:mv, mover:mover, ended:true, over:false, winner:null, note:'', next:next};

      function finish(winner, note){ out.over = true; out.winner = winner; out.note = note || ''; return out; }

      if(c.in_checkmate()) return finish(mover, 'checkmate');
      if(bareKings(fen)) return finish('draw', 'draw - insufficient material');

      // first of two moves, and it did not give check: the mover keeps the move if they have a second one
      if(st.movesLeft === 2 && !c.in_check()){
        var again = flip(fen, mover);
        var c2 = new Chess(again);
        if(c2.moves().length > 0){
          next.fen = again; next.turn = mover; next.movesLeft = 1;
          out.ended = false;
          return out;
        }
      }

      // the turn is over: stalemate, 50-move rule and repetition are decided now
      if(c.in_stalemate()) return finish('draw', 'draw - stalemate');
      if(parseInt(fen.split(' ')[4], 10) >= 100) return finish('draw', 'draw - 50-move rule');
      if(!fast){
        var k = key(fen), n = 1;
        (st.pos || []).forEach(function(x){ if(x === k) n++; });
        next.pos = (st.pos || []).concat([k]);
        if(n >= 3) return finish('draw', 'draw - threefold repetition');
      }
      return out;
    }

    // a result when the side to move runs out of time (bare kings is the only "cannot lose on time" case)
    function flagResult(st){
      var loser = st.turn;
      if(bareKings(st.fen)) return {winner:'draw', note:'draw - insufficient material on time'};
      return {winner:opp(loser), note:'won on time'};
    }

    return {start:start, moves:moves, apply:apply, flagResult:flagResult, flip:flip, key:key, bareKings:bareKings, opp:opp};
  }

  root.PawniacDoubleMake = makeRules;
  if(typeof module !== 'undefined' && module.exports) module.exports = makeRules;
  try{ if(typeof root.Chess === 'function') root.PawniacDouble = makeRules(root.Chess); }catch(e){}
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : this));
