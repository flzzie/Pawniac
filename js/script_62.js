// Find my opening: a style quiz plus what your own analysed games say, mixed into a short list of openings to learn.
// Everything stays on this device (answers and the habit data live in localStorage). Nothing is uploaded.
(function(){
  'use strict';
  var QKEY = 'pawniac-opfinder-v1', HKEY = 'pawniac-habits-v1';
  var Z = function(){ return window.__anCore; };
  var root = null, S = null;

  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'}[c]; }); }
  function lsGet(k, d){ try{ var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; }catch(e){ return d; } }
  function lsSet(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }

  // ---------------------------------------------------------------------------------------------
  // The openings. t = traits from 1 (low) to 5 (high):
  //   att attacking, sol solid, tac tactical/sharp, pos positional/strategic, end endgame-friendly,
  //   th how much theory you need, rk risk, open how open the positions get, sys 1 = same setup against nearly everything
  // lvl = lowest level it suits (0 beginner ... 4 expert). rare = offbeat, so many opponents won't know it.
  // cat: w = as White, e4 = Black against 1.e4, d4 = Black against 1.d4
  // rx = the names the analysis gives this opening (so your own games can be matched to it).
  // ---------------------------------------------------------------------------------------------
  function X(cat, id, n, m, rx, a, lvl, rare, d, ideas, watch){
    return {id:id, cat:cat, n:n, m:m, rx:rx, t:{att:a[0], sol:a[1], tac:a[2], pos:a[3], end:a[4], th:a[5], rk:a[6], open:a[7], sys:a[8]}, lvl:lvl, rare:rare ? 1 : 0, d:d, ideas:ideas, watch:watch};
  }
  var DB = [
    // ---------------- White ----------------
    {id:'london', cat:'w', n:'London System', m:'1. d4 d5 2. Bf4 Nf6 3. e3 e6 4. Nf3 c5 5. c3 Nc6 6. Nbd2 Bd6 7. Bg3', rx:/London System/, t:{att:2, sol:5, tac:2, pos:3, end:3, th:1, rk:1, open:2, sys:1}, lvl:0,
     d:'The same set-up in almost every game: pawns on d4, e3, c3, bishop out to f4, knights to f3 and d2. Easy to learn and hard to punish.',
     ideas:['Get the bishop to f4 before playing e3, so it is not locked in.', 'Build the pawn chain d4-e3-c3 and castle kingside.', 'Later push e4 (or c4) when you are ready, to open the game on your terms.'],
     watch:'Black can hit the d4 pawn with ...c5 and ...Qb6 against b2. Do not play it on autopilot: look at what the opponent set up each time.'},
    {id:'colle', cat:'w', n:'Colle System', m:'1. d4 d5 2. Nf3 Nf6 3. e3 e6 4. Bd3 c5 5. c3 Nc6 6. Nbd2 Bd6 7. O-O O-O 8. dxc5', rx:/Colle/, t:{att:3, sol:4, tac:3, pos:3, end:2, th:1, rk:2, open:3, sys:1}, lvl:0,
     d:'Another set-up opening, like the London, but with the bishop on d3 pointing at the black king. The plan is to build e3, c3, Nbd2 and then break with e4.',
     ideas:['Aim the bishop on d3 at h7 and the king.', 'Prepare the central break e4, usually after Nbd2 and castling.', 'The same structure works against most Black replies.'],
     watch:'If you never get e4 in, the position can feel passive. Learn when to take on c5 and when to push e4.'},
    {id:'torre', cat:'w', n:'Torre Attack', m:'1. d4 Nf6 2. Nf3 e6 3. Bg5 c5 4. e3 Be7 5. Nbd2 b6 6. Bd3 Bb7 7. c3 O-O', rx:/Torre/, t:{att:3, sol:3, tac:3, pos:3, end:2, th:2, rk:2, open:3, sys:1}, lvl:1, rare:1,
     d:'A set-up with the bishop on g5 and a quick e3 and Bd3. A little sharper than the London because the bishop pins or hits the knight on f6.',
     ideas:['Bishop to g5 early, pressing on the knight on f6.', 'e3, Bd3 and Nbd2, then castle and look for e4.', 'You can often take on f6 to wreck the black kingside structure.'],
     watch:'Black can answer with ...h6 and ...Bxf3 ideas. Do not give the bishop pair away without getting something for it.'},
    {id:'italian', cat:'w', n:'Italian Game (slow, with c3 and d3)', m:'1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d3 d6 6. O-O a6 7. Bb3', rx:/Italian Game|Giuoco/, t:{att:3, sol:4, tac:3, pos:4, end:3, th:2, rk:2, open:3, sys:0}, lvl:0,
     d:'Develop quickly, aim at f7 and castle. The slow version (c3, d3) is calm and strategic, with a lot of room for plans and not much to memorise.',
     ideas:['Bishop to c4 pointing at f7, knights to f3 and c3.', 'Castle early, then play c3 and d3 and re-route the knight with Nbd2-f1-g3.', 'Later d4 or f4 when the position is ready.'],
     watch:'Do not rush the attack on f7 with an unprepared queen. The Black knight on d4 or ...d5 breaks can get annoying.'},
    {id:'scotch', cat:'w', n:'Scotch Game', m:'1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Nf6 5. Nc3 Bb4 6. Nxc6 bxc6 7. Bd3 d5', rx:/Scotch/, t:{att:4, sol:3, tac:4, pos:3, end:2, th:3, rk:3, open:5, sys:0}, lvl:1,
     d:'Open the centre at once with d4. It leads to open, active positions where development and piece play matter more than long memorised lines.',
     ideas:['Strike with d4 on move 3, then recapture with the knight.', 'Quick development and open lines: bishops and queen are active.', 'Aim for a lead in development, then a safe king.'],
     watch:'You give up the centre tension, so Black may get easy equality if you are passive. Stay active.'},
    {id:'vienna', cat:'w', n:'Vienna Game / Vienna Gambit', m:'1. e4 e5 2. Nc3 Nf6 3. f4 d5 4. fxe5 Nxe4 5. Nf3 Be7 6. d4 O-O', rx:/Vienna/, t:{att:4, sol:2, tac:4, pos:2, end:1, th:3, rk:3, open:4, sys:0}, lvl:1, rare:1,
     d:'A flexible alternative to the Italian and Ruy Lopez. It prepares f4 and a quick attack, and many opponents have not studied it.',
     ideas:['Knight to c3 first, keeping Bc4 and f4 both possible.', 'In the gambit lines, you give up the centre for fast development.', 'Look for Qh5 and Bc4 ideas against f7.'],
     watch:'The gambit lines need some preparation. The quiet Vienna (with Bc4) is a safer way to start.'},
    {id:'ruy', cat:'w', n:'Ruy Lopez (Spanish)', m:'1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O', rx:/Ruy Lopez/, t:{att:3, sol:4, tac:3, pos:5, end:4, th:5, rk:2, open:3, sys:0}, lvl:3,
     d:'The classic, with a long history at every level. Quiet pressure on the knight that guards e5, and a lot of strategic depth.',
     ideas:['Pressure on e5 by pinning the knight on c6 against the king.', 'Build with c3 and d4 to take the centre.', 'Rich middlegames with plenty of plans, and a lot of endgame chances.'],
     watch:'This is the opening with the most theory on this list. Black has many sound ways to reply, so expect to study.'},
    {id:'kgambit', cat:'w', n:"King's Gambit", m:'1. e4 e5 2. f4 exf4 3. Nf3 g5 4. h4 g4 5. Ne5 Nf6 6. Bc4 d5 7. exd5 Bd6', rx:/King's Gambit/, t:{att:5, sol:1, tac:5, pos:1, end:1, th:4, rk:5, open:5, sys:0}, lvl:2, rare:1,
     d:'The romantic attacker\'s opening: give a pawn, open the f-file, and go for the king. Spassky and many others won big games with it.',
     ideas:['Sacrifice the f-pawn to open lines and drag the black king into the open.', 'Fast development and open files matter more than material.', 'Be ready for forcing play from move 3.'],
     watch:'If Black defends well you can be a pawn down with an exposed king. This is high risk and high reward.'},
    {id:'evans', cat:'w', n:'Evans Gambit', m:'1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. b4 Bxb4 5. c3 Ba5 6. d4 exd4 7. O-O', rx:/Evans/, t:{att:5, sol:2, tac:5, pos:2, end:1, th:3, rk:4, open:5, sys:0}, lvl:1, rare:1,
     d:'A fast attacking gambit from the Italian: give a pawn with b4 for a big centre and quick development. Kasparov brought it back at the highest level.',
     ideas:['Sacrifice a pawn (b4) to get c3 and d4 with tempo.', 'Build a big centre and open the position for your bishops.', 'Attack f7 once your pieces are out.'],
     watch:'Black can decline or return the pawn at the right time. Know the safe lines for Black\'s 5...Ba5 and 5...Bc5 replies.'},
    {id:'danish', cat:'w', n:'Danish Gambit', m:'1. e4 e5 2. d4 exd4 3. c3 dxc3 4. Bc4 cxb2 5. Bxb2', rx:/Danish Gambit/, t:{att:5, sol:1, tac:5, pos:1, end:1, th:2, rk:5, open:5, sys:0}, lvl:0, rare:1,
     d:'Give up two pawns for fast development and two bishops aimed at the black king. Many beginners and club players struggle to defend against it.',
     ideas:['Two pawns for open diagonals and quick development.', 'Aim both bishops at f7 and g7.', 'Bring the queen and knights into the attack at once.'],
     watch:'Strong players can simply give back a pawn and be better. Fine as a practical weapon, not as a full long-term repertoire.'},
    {id:'english', cat:'w', n:'English Opening', m:'1. c4 e5 2. Nc3 Nf6 3. Nf3 Nc6 4. g3 d5 5. cxd5 Nxd5 6. Bg2 Nb6 7. O-O', rx:/English Opening/, t:{att:2, sol:4, tac:2, pos:5, end:4, th:3, rk:2, open:2, sys:0}, lvl:2,
     d:'Start with the c-pawn, fianchetto the bishop, and fight for the centre from the side. Flexible and positional, often reached by transposition.',
     ideas:['Control d5 with the c-pawn and the knight on c3.', 'Fianchetto with g3 and Bg2, castle, then choose your plan.', 'Often reverses into a Sicilian with an extra tempo for you.'],
     watch:'Many move orders lead to different structures. You need to know which setup to aim for against each Black reply.'},
    {id:'qg', cat:'w', n:"Queen's Gambit", m:'1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5 Be7 5. e3 O-O 6. Nf3 h6 7. Bh4 Ne4 8. Bxe7 Qxe7', rx:/Queen's Gambit(?! Declined| Accepted)|Queen's Gambit$/, t:{att:2, sol:4, tac:2, pos:5, end:3, th:4, rk:2, open:3, sys:0}, lvl:2,
     d:'The most classical d4 opening. Offer a pawn on c4 to take over the centre. A great school for understanding pawn structure and piece play.',
     ideas:['Pressure on d5 with c4 and Nc3.', 'Take the centre with e3 and Nf3, develop the bishops actively.', 'Understand the main structures: isolated pawn, hanging pawns, minority attack.'],
     watch:'Black has many answers, so the theory adds up quickly. Focus on the main ones first.'},
    {id:'catalan', cat:'w', n:'Catalan Opening', m:'1. d4 Nf6 2. c4 e6 3. g3 d5 4. Bg2 Be7 5. Nf3 O-O 6. O-O dxc4 7. Qc2', rx:/Catalan/, t:{att:2, sol:4, tac:2, pos:5, end:5, th:4, rk:2, open:2, sys:0}, lvl:3,
     d:'A queen\'s gambit with a fianchettoed bishop that bears down the long diagonal. Quiet but extremely strong, with long-lasting pressure and good endgames.',
     ideas:['The bishop on g2 presses on d5 and b7 for the whole game.', 'Take your time: pressure, small edges, and safe positions.', 'Many positions ask only for solid strategy, not calculation.'],
     watch:'Needs patience: no quick tactics. And Black has several comfortable ways to equalise if you hurry.'},
    {id:'ki_att', cat:'w', n:"King's Indian Attack / Réti set-up", m:'1. Nf3 d5 2. g3 Nf6 3. Bg2 e6 4. O-O Be7 5. d3 O-O 6. Nbd2 c5 7. e4 Nc6', rx:/King's Indian Attack|Réti|Zukertort|Reti/, t:{att:3, sol:4, tac:2, pos:4, end:3, th:2, rk:2, open:3, sys:1}, lvl:1,
     d:'Another way to play "one set-up against everything": knights out, fianchetto bishop, castle, d3, Nbd2 and e4. Little theory, flexible, safe.',
     ideas:['Fianchetto the king\'s bishop and castle early.', 'Play d3, Nbd2 and then e4 to claim the centre.', 'Later attack on the kingside with h4, Ng5 or Nh4.'],
     watch:'It can look passive if you never play e4. Adapt when Black sets up strongly in the centre.'},
    {id:'tromp', cat:'w', n:'Trompowsky Attack', m:'1. d4 Nf6 2. Bg5 Ne4 3. Bf4 d5 4. e3 c5 5. c3 Nc6 6. Nd2 Nxd2 7. Qxd2', rx:/Trompowsky/, t:{att:3, sol:3, tac:3, pos:3, end:2, th:2, rk:3, open:3, sys:1}, lvl:1, rare:1,
     d:'Take the opponent out of their comfort zone straight away: bishop to g5 on move 2. Many opponents do not know what to do against it.',
     ideas:['Pin or hit the knight on f6 and take them out of book.', 'Sometimes take on f6 to double their pawns.', 'Plan e3, Nf3 and Bd3, and play a calm game.'],
     watch:'Know Black\'s sharper replies like ...Ne4 and ...c5. Otherwise the early bishop can get chased around.'},

    // ---------------- Black against 1.e4 ----------------
    {id:'caro', cat:'e4', n:'Caro-Kann Defense', m:'1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Bf5 5. Ng3 Bg6 6. h4 h6 7. Nf3 Nd7', rx:/Caro-Kann/, t:{att:1, sol:5, tac:2, pos:4, end:4, th:3, rk:1, open:3, sys:0}, lvl:0,
     d:'Solid and sensible. You support d5 with the c-pawn and get your light-squared bishop out before closing the pawn chain. A favourite of players who like safe structures.',
     ideas:['Play ...c6 and ...d5, then take on e4 and develop the bishop to f5 or g4.', 'Keep a healthy pawn structure and good endgames.', 'Counterattack later with ...c5 or ...e5.'],
     watch:'You can be a little cramped. Learn the Advance and Exchange variations early.'},
    {id:'french', cat:'e4', n:'French Defense', m:'1. e4 e6 2. d4 d5 3. Nc3 Nf6 4. Bg5 Be7 5. e5 Nfd7 6. Bxe7 Qxe7 7. f4 O-O', rx:/French Defense/, t:{att:2, sol:4, tac:2, pos:4, end:3, th:3, rk:2, open:2, sys:0}, lvl:1,
     d:'Build a firm pawn chain with ...e6 and ...d5 and attack the centre from behind. Usually gives clear plans: ...c5 and ...f6 to challenge White.',
     ideas:['Strike back at d4 with ...c5.', 'Break with ...f6 to open the position when ready.', 'Counterplay on the queenside while White attacks the king.'],
     watch:'The light-squared bishop on c8 can be passive. Plan how to get it out or swap it.'},
    {id:'scand', cat:'e4', n:'Scandinavian Defense', m:'1. e4 d5 2. exd5 Qxd5 3. Nc3 Qa5 4. d4 Nf6 5. Nf3 c6 6. Bc4 Bf5 7. Bd2 e6', rx:/Scandinavian/, t:{att:2, sol:4, tac:2, pos:3, end:3, th:1, rk:2, open:3, sys:1}, lvl:0,
     d:'The simplest answer to 1.e4: take the pawn at once and have a straightforward set-up. Very low theory, so you can play it from day one.',
     ideas:['Take on d5 and move the queen to a5 or d6 out of harm.', 'Develop with ...Nf6, ...c6, ...Bf5 and ...e6.', 'Castle and play against White\'s centre.'],
     watch:'The queen gets hit by tempo moves. Do not waste time with it, and do not let White gain space for free.'},
    {id:'najdorf', cat:'e4', n:'Sicilian: Najdorf', m:'1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Be3 e5 7. Nb3 Be6', rx:/Najdorf/, t:{att:4, sol:3, tac:5, pos:3, end:2, th:5, rk:4, open:4, sys:0}, lvl:3,
     d:'The sharpest and most respected Sicilian. Fischer and Kasparov played it all their lives. You fight for the win from move one.',
     ideas:['Take the centre with ...e5 or build with ...e6 and ...b5.', 'Counterattack on the queenside and in the centre.', 'Expect sharp tactical battles with chances for both sides.'],
     watch:'The most theory on this list. You must know the main attacking lines (Be3, Bg5, f4) or you can get run over.'},
    {id:'dragon', cat:'e4', n:'Sicilian: Dragon', m:'1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6 6. Be3 Bg7 7. f3 O-O 8. Qd2 Nc6', rx:/Dragon/, t:{att:5, sol:2, tac:5, pos:2, end:1, th:5, rk:5, open:4, sys:0}, lvl:3,
     d:'The Dragon bishop on g7 stares down the long diagonal. It gives both sides attacking chances and the games are often decided by sharp tactics.',
     ideas:['Fianchetto the bishop and castle, then open the c-file and h-file.', 'Counterattack with ...Rc8 and ...Nxd4 sacrifices.', 'Race against White\'s attack with the black bishop at full power.'],
     watch:'Very high risk, with deep forcing theory. One missed move can lose the game outright.'},
    {id:'accel', cat:'e4', n:'Sicilian: Accelerated Dragon', m:'1. e4 c5 2. Nf3 Nc6 3. d4 cxd4 4. Nxd4 g6 5. Nc3 Bg7 6. Be3 Nf6 7. Bc4 O-O 8. Bb3 d6', rx:/Accelerated Dragon/, t:{att:4, sol:3, tac:4, pos:3, end:2, th:4, rk:3, open:4, sys:0}, lvl:2,
     d:'A Dragon without the worst of the White attacks. You get the fianchettoed bishop quickly, with a bit less sharp theory than the full Dragon.',
     ideas:['Fianchetto and castle, then play ...d6 and ...Rc8.', 'Fight for ...d5 at the right moment.', 'The Maroczy Bind (c4 and e4) is the main way White can try to squeeze you.'],
     watch:'Against the Maroczy Bind, you must know how to free yourself. Passive play loses slowly.'},
    {id:'kan', cat:'e4', n:'Sicilian: Kan / Paulsen', m:'1. e4 c5 2. Nf3 e6 3. d4 cxd4 4. Nxd4 a6 5. Nc3 Qc7 6. Be2 Nf6 7. O-O Nc6', rx:/Kan|Paulsen/, t:{att:3, sol:3, tac:3, pos:4, end:2, th:3, rk:3, open:3, sys:0}, lvl:2,
     d:'A flexible Sicilian: ...e6, ...a6 and ...Qc7 keep many options open. You can adapt your plans to what White does.',
     ideas:['Keep the pawn structure flexible with ...e6 and ...a6.', 'Play ...Qc7, ...Nf6 and ...b5, then develop with ...Bb7.', 'Counterattack in the centre or on the queenside when you are ready.'],
     watch:'Because of the flexibility, different move orders lead to different positions. Learn the key set-ups, not just move lists.'},
    {id:'pirc', cat:'e4', n:'Pirc / Modern Defense', m:'1. e4 d6 2. d4 Nf6 3. Nc3 g6 4. Nf3 Bg7 5. Be2 O-O 6. O-O c6 7. a4 Nbd7', rx:/Pirc|Modern Defense/, t:{att:3, sol:3, tac:3, pos:4, end:3, th:3, rk:3, open:3, sys:1}, lvl:1,
     d:'Let White build a big centre, then attack it. A set-up: ...d6, ...Nf6, ...g6, ...Bg7 and castle, with the same pieces whatever White does.',
     ideas:['Fianchetto the bishop and castle early.', 'Attack White\'s centre with ...c5 or ...e5 at the right moment.', 'Play with a safe king and flexible pawn breaks.'],
     watch:'If White attacks hard (the Austrian Attack with f4), you must know how to defend. Don\'t wait too long to challenge the centre.'},
    {id:'petroff', cat:'e4', n:'Petroff (Russian) Defense', m:'1. e4 e5 2. Nf3 Nf6 3. Nxe5 d6 4. Nf3 Nxe4 5. d4 d5 6. Bd3 Nc6 7. O-O Be7', rx:/Russian Game|Petrov|Petroff/, t:{att:1, sol:5, tac:2, pos:3, end:4, th:3, rk:1, open:3, sys:0}, lvl:1,
     d:'Mirror White\'s attack at once. Symmetrical, very sound, and hard for White to get an advantage. A favourite for solid, drawish results.',
     ideas:['Counterattack the pawn on e4 instead of defending e5.', 'Aim for a symmetrical, safe position.', 'Trade pieces and enjoy a comfortable endgame.'],
     watch:'Symmetry makes it hard to play for a win. Be ready to outplay your opponent in the later middlegame.'},
    {id:'twoknights', cat:'e4', n:'Two Knights Defense', m:'1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 5. exd5 Na5 6. Bb5+ c6 7. dxc6 bxc6 8. Be2 h6 9. Nf3 e4', rx:/Two Knights/, t:{att:4, sol:2, tac:5, pos:2, end:2, th:4, rk:4, open:5, sys:0}, lvl:2,
     d:'Answer Bc4 with ...Nf6 and fight for the initiative. If White plays the aggressive Ng5, you sacrifice a pawn for active play.',
     ideas:['Hit the e4 pawn and counterattack in the centre.', 'After 4.Ng5 d5, give a pawn to get active pieces.', 'Keep the game open and play for tactics.'],
     watch:'The 4.Ng5 line is sharp and demands exact moves. Many players avoid it for that reason.'},
    {id:'alekhine', cat:'e4', n:'Alekhine Defense', m:'1. e4 Nf6 2. e5 Nd5 3. d4 d6 4. Nf3 Bg4 5. Be2 e6 6. O-O Be7 7. c4 Nb6', rx:/Alekhine/, t:{att:3, sol:2, tac:3, pos:3, end:2, th:3, rk:4, open:3, sys:0}, lvl:2, rare:1,
     d:'Provoke White\'s pawns forward and then attack them. You give up space on purpose, hoping your pieces will punish an overextended centre.',
     ideas:['Let White push the pawns, then undermine with ...d6, ...c5 and ...Bg4.', 'Pieces go to active squares while White builds.', 'Counterattack the centre when it gets too big.'],
     watch:'Too much space for White is dangerous if you cannot attack it. Know the Four Pawns Attack.'},
    {id:'philidor', cat:'e4', n:'Philidor Defense', m:'1. e4 e5 2. Nf3 d6 3. d4 Nf6 4. Nc3 Nbd7 5. Bc4 Be7 6. O-O O-O 7. Qe2 c6', rx:/Philidor/, t:{att:1, sol:4, tac:2, pos:3, end:3, th:2, rk:2, open:2, sys:1}, lvl:0, rare:1,
     d:'A small and safe set-up: ...e5 and ...d6, then knights and bishop in place. Low theory, but you give up some space.',
     ideas:['Hold the e5 pawn with ...d6 and ...Nbd7.', 'Develop with ...Be7 and castle.', 'Break with ...exd4 or ...c6 and ...d5 later.'],
     watch:'A passive position if you only defend. Look for the right moment to strike with ...d5.'},
    {id:'berlin', cat:'e4', n:'Ruy Lopez: Berlin Defense', m:'1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. O-O Nxe4 5. d4 Nd6 6. Bxc6 dxc6 7. dxe5 Nf5 8. Qxd8+ Kxd8', rx:/Berlin/, t:{att:1, sol:5, tac:1, pos:4, end:5, th:4, rk:1, open:3, sys:0}, lvl:3,
     d:'Trade queens early and play a long endgame with a very solid position. Famous as the "Berlin Wall": extremely hard to break down.',
     ideas:['Trade queens on d8 and keep the king safe in the centre.', 'Use the bishop pair as compensation for the doubled pawns.', 'Outplay your opponent in the endgame.'],
     watch:'Little scope for attack. It needs patience and good endgame technique.'},

    // ---------------- Black against 1.d4 ----------------
    {id:'kid', cat:'d4', n:"King's Indian Defense", m:'1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 e5 7. O-O Nc6 8. d5 Ne7', rx:/King's Indian Defense/, t:{att:5, sol:2, tac:4, pos:3, end:2, th:5, rk:4, open:3, sys:0}, lvl:2,
     d:'Let White take the centre, then attack it. Typical plan: castle, play ...e5, and launch a kingside pawn storm with ...f5. Fischer and Kasparov made it famous.',
     ideas:['Fianchetto the bishop and castle kingside.', 'Attack the centre with ...e5 and later ...f5.', 'Go for a kingside pawn storm when White closes the centre.'],
     watch:'If White attacks on the queenside faster, you can get squeezed. It needs a lot of theory and good timing.'},
    {id:'nimzo', cat:'d4', n:'Nimzo-Indian Defense', m:'1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. e3 O-O 5. Bd3 d5 6. Nf3 c5 7. O-O Nc6', rx:/Nimzo-Indian/, t:{att:2, sol:4, tac:3, pos:5, end:3, th:4, rk:2, open:3, sys:0}, lvl:2,
     d:'One of the best answers to 1.d4. Pin the knight on c3 with ...Bb4, control the centre with pieces, and avoid weaknesses. A favourite of positional players.',
     ideas:['Pin the knight on c3 and fight for e4.', 'Often trade your bishop for the knight to double White\'s pawns.', 'Control the centre with pieces and play flexible pawn moves.'],
     watch:'Lots of variations (4.Qc2, 4.e3, 4.f3). Learn the main plan for each.'},
    {id:'qgd', cat:'d4', n:"Queen's Gambit Declined", m:'1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5 Be7 5. e3 O-O 6. Nf3 h6 7. Bh4 Ne4 8. Bxe7 Qxe7', rx:/Queen's Gambit Declined/, t:{att:1, sol:5, tac:2, pos:4, end:3, th:3, rk:1, open:2, sys:0}, lvl:1,
     d:'Hold d5 firmly with ...e6 and develop calmly. Extremely solid, and the structures you get teach lessons about strategy.',
     ideas:['Hold d5 with ...e6 and ...Nf6, then develop the knight and bishop.', 'Free your position with ...c5 or ...e5 at the right time.', 'Solve the "bad bishop" on c8 with ...b6 or ...c5.'],
     watch:'The bishop on c8 can be passive. Plan how to free it.'},
    {id:'slav', cat:'d4', n:'Slav Defense', m:'1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. Nc3 dxc4 5. a4 Bf5 6. e3 e6 7. Bxc4 Bb4 8. O-O Nbd7', rx:/Slav/, t:{att:1, sol:5, tac:2, pos:4, end:3, th:4, rk:1, open:3, sys:0}, lvl:1,
     d:'Like the Queen\'s Gambit Declined, but the light bishop gets out before ...e6. Very sound and quite popular at every level.',
     ideas:['Defend d5 with ...c6 and get the bishop out to f5 or g4.', 'Take on c4 at the right moment and keep a healthy centre.', 'Break with ...c5 or ...e5.'],
     watch:'White has many sidelines. Make sure you know your answers to the Exchange Slav and the sharper lines with e4.'},
    {id:'dutch', cat:'d4', n:'Dutch Defense (Stonewall)', m:'1. d4 f5 2. g3 Nf6 3. Bg2 e6 4. Nf3 d5 5. O-O Bd6 6. c4 c6 7. Qc2 O-O', rx:/Dutch/, t:{att:4, sol:3, tac:3, pos:3, end:2, th:3, rk:4, open:2, sys:1}, lvl:1, rare:1,
     d:'Take control of e4 with ...f5 and play for a kingside attack. The Stonewall set-up (pawns on d5, e6, f5, c6) is a solid and clear plan.',
     ideas:['Control e4 with ...f5 and ...Nf6.', 'Play ...d5, ...e6, ...c6 and ...Bd6 as a set-up.', 'Attack on the kingside with the rook on f6 or the knight on e4.'],
     watch:'The e8-h5 diagonal weaknesses can hurt you. Don\'t move the king\'s pawns carelessly.'},
    {id:'grunfeld', cat:'d4', n:'Grünfeld Defense', m:'1. d4 Nf6 2. c4 g6 3. Nc3 d5 4. cxd5 Nxd5 5. e4 Nxc3 6. bxc3 Bg7 7. Nf3 c5 8. Be3 Qa5', rx:/Gr[uü]nfeld/, t:{att:3, sol:3, tac:4, pos:3, end:2, th:5, rk:4, open:4, sys:0}, lvl:3,
     d:'Let White build a big pawn centre, then break it down with piece pressure. Dynamic and respected, but very theoretical.',
     ideas:['Hit the centre with ...d5, then ...c5 and ...Bg7.', 'Use the long diagonal and pressure on d4 to attack.', 'Aim for activity: your pieces are more active than White\'s pawns are strong.'],
     watch:'A lot of theory, and White\'s big centre is dangerous if you play inaccurately.'},
    {id:'qid', cat:'d4', n:"Queen's Indian Defense", m:'1. d4 Nf6 2. c4 e6 3. Nf3 b6 4. g3 Ba6 5. b3 Bb4+ 6. Bd2 Be7 7. Bg2 c6', rx:/Queen's Indian/, t:{att:2, sol:4, tac:2, pos:5, end:3, th:3, rk:1, open:2, sys:0}, lvl:2,
     d:'Fianchetto the queen\'s bishop on b7 and control e4. A very solid way to meet 1.d4 and 1.Nf3 if you do not want a Nimzo or Queen\'s Gambit.',
     ideas:['Control e4 with ...Bb7 and ...Ne4 ideas.', 'Keep the structure flexible and solid.', 'Build with ...d5 or ...c5 later.'],
     watch:'White can try to squeeze you by controlling the centre. Find the right break (...c5 or ...d5).'},
    {id:'benoni', cat:'d4', n:'Modern Benoni', m:'1. d4 Nf6 2. c4 c5 3. d5 e6 4. Nc3 exd5 5. cxd5 d6 6. e4 g6 7. Nf3 Bg7 8. Be2 O-O', rx:/Benoni/, t:{att:4, sol:2, tac:4, pos:3, end:1, th:4, rk:4, open:3, sys:0}, lvl:3,
     d:'Create an unbalanced pawn structure: White has the centre, you get queenside pawn majority and piece activity. Sharp and double-edged.',
     ideas:['Push ...b5 to open the queenside.', 'Use the bishop on g7 against the centre.', 'Counterattack on the e-file and the long diagonal.'],
     watch:'White can attack in the centre with e4-e5 if you let them. Know your timing.'},
    {id:'budapest', cat:'d4', n:'Budapest Gambit', m:'1. d4 Nf6 2. c4 e5 3. dxe5 Ng4 4. Bf4 Nc6 5. Nf3 Bb4+ 6. Nbd2 Qe7 7. a3 Ngxe5', rx:/Budapest/, t:{att:4, sol:1, tac:4, pos:2, end:1, th:2, rk:4, open:4, sys:0}, lvl:1, rare:1,
     d:'Give a pawn on move 2 and win it back with active play. Full of traps, and many opponents are not prepared for it.',
     ideas:['Sacrifice the e-pawn for fast piece play.', 'Win the pawn back with ...Ng4 and ...Nc6.', 'Look for traps involving the knight on e5 or g4.'],
     watch:'Good opponents can keep an extra pawn if you slip. Use it as a surprise weapon, not as your only opening.'},
    {id:'chigorin', cat:'d4', n:'Chigorin Defense', m:'1. d4 d5 2. c4 Nc6 3. Nf3 Bg4 4. cxd5 Bxf3 5. gxf3 Qxd5 6. e3 e5 7. Nc3 Bb4', rx:/Chigorin/, t:{att:4, sol:2, tac:4, pos:2, end:2, th:3, rk:4, open:4, sys:0}, lvl:1, rare:1,
     d:'Bring the knight to c6 and bishop to g4 straight away. Unusual and active, aimed at confusing opponents who know the Queen\'s Gambit.',
     ideas:['Develop the knight and bishop quickly instead of defending d5.', 'Often give up the bishop pair to damage the white pawns.', 'Play for piece activity and a quick ...e5.'],
     watch:'Top players think it is not entirely sound. Fine for club games, but you must know the main lines.'}

    ,
    // ---------------- more as White ----------------
    X('w','ruyex','Ruy Lopez: Exchange Variation','1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Bxc6 dxc6 5. O-O f6 6. d4 exd4 7. Nxd4 c5 8. Nb3 Qxd1 9. Rxd1 Bg4',/Exchange Variation/,[2,4,2,4,5,2,2,2,0],1,0,
      'A simpler Ruy Lopez: trade the bishop for the knight at once. Your pawn majority on the kingside is healthy, Black\'s queenside is doubled, so the endgame is slightly better for you. Fischer used it for the same reason.',
      ['Trade on c6 to double Black\'s pawns.', 'Aim for an endgame where your kingside majority is the better one.', 'Keep it simple: the plan is clear and the theory is light.'],
      'Black gets the bishop pair and an active position if you are careless. Do not trade queens without a plan.'),
    X('w','fourknights','Four Knights Game (Spanish)','1. e4 e5 2. Nf3 Nc6 3. Nc3 Nf6 4. Bb5 Bb4 5. O-O O-O 6. d3 d6 7. Bg5 Bxc3 8. bxc3 Qe7',/Four Knights/,[2,5,2,3,3,1,1,3,1],0,0,
      'Develop both knights, then the bishop, castle and play d3. A symmetrical and very safe opening with almost no theory, popular for solid and quick games.',
      ['Develop knights and bishop, castle early.', 'Play d3 and Bg5 to pin the knight on f6.', 'Be ready to play d4 or Nd5 when the moment is right.'],
      'It can be a little drawish. Find a way to create imbalances, such as the Nd5 jump or a kingside attack, when you want more.'),
    X('w','bishops','Bishop\'s Opening','1. e4 e5 2. Bc4 Nf6 3. d3 c6 4. Nf3 d5 5. Bb3 Bd6 6. Nc3 O-O',/Bishop's Opening/,[2,4,2,3,3,1,2,3,1],0,1,
      'Bishop out first, knights later. It keeps many options open: you can transpose to an Italian, a Vienna or a King\'s Gambit-style position, and your opponent must make decisions early.',
      ['Develop the bishop to c4 to aim at f7.', 'Keep the knight on b1 flexible: c3 or f3 depending on what Black does.', 'Put d3 and Nf3 and castle.'],
      'Black can hit the bishop with ...Nf6 and ...d5. Know where the bishop retreats and keep the centre under control.'),
    X('w','ponziani','Ponziani Opening','1. e4 e5 2. Nf3 Nc6 3. c3 Nf6 4. d4 Nxe4 5. Bd3 d5 6. Nxe5 Nxe5 7. dxe5 Nc5',/Ponziani/,[3,3,3,3,2,2,3,4,0],1,1,
      'Prepare a big centre with c3 and d4. Not many opponents know the theory, and the positions are active without being too sharp.',
      ['Play c3, then d4 to build a strong pawn centre.', 'Many lines lead to open play with plenty of tactics.', 'A good surprise weapon for club games.'],
      'Black has good answers such as 3...Nf6 or 3...d5. Learn the main line against each.'),
    X('w','bird','Bird\'s Opening','1. f4 d5 2. Nf3 Nf6 3. e3 g6 4. Be2 Bg7 5. O-O O-O 6. d3 c5 7. Qe1',/Bird Opening|Bird's Opening/,[3,3,3,3,2,2,3,3,1],1,1,
      'Start with 1.f4 and control e5. Similar to the Dutch Defense with the colours reversed. A set-up opening that takes your opponent out of book on move 1.',
      ['Control e5 with the f-pawn and the knight on f3.', 'Castle, then plan d3, Qe1 and a kingside attack with Qh4.', 'Keep an eye on your king, since f4 weakens the e1-h4 diagonal.'],
      'The weakened e1-h4 diagonal can be used against you by ...Bg4 and ...e5 ideas. Look out for From\'s Gambit (1...e5) and know the answer.'),
    X('w','larsen','Nimzo-Larsen Attack','1. b3 e5 2. Bb2 Nc6 3. e3 d5 4. Bb5 Bd6 5. f4 Qe7 6. Nf3 f6',/Nimzo-Larsen|Larsen/,[3,3,3,4,3,2,3,3,1],1,1,
      'Fianchetto the bishop on move 1, with b3 and Bb2 aiming at e5. A rare and flexible opening where the bishop does much of the work from a distance.',
      ['The bishop on b2 pressures e5 and the long diagonal.', 'Play e3 and Bb5 or Nf3 depending on Black\'s plan.', 'Choose your pawn break: f4 or d4 later.'],
      'You give Black a free centre, so make sure you take your own chances at the right moment.'),
    X('w','jobava','Jobava London','1. d4 d5 2. Nc3 Nf6 3. Bf4 c6 4. Nf3 Bf5 5. e3 e6 6. Nh4 Bg6 7. Nxg6 hxg6',/Jobava|Prie/,[4,3,4,3,2,2,3,3,1],1,1,
      'The aggressive version of the London: knight to c3 first, then the bishop on f4, and often an early Nb5 or e4. Popular in online blitz because it creates quick tactics.',
      ['Knight to c3 and bishop to f4 before playing e3.', 'Prepare Nb5, e4 and a quick attack.', 'Keep the pieces active and use tactical tricks in the centre.'],
      'A sharper and trickier opening than the classic London. If Black knows the lines, the knight on c3 and bishop on f4 can get hit.'),
    X('w','italianmain','Italian Game: Main Line (c3 and d4)','1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d4 exd4 6. cxd4 Bb4+ 7. Bd2 Bxd2+ 8. Nbxd2 d5',/Giuoco Piano|Italian Game: Classical Variation/,[4,3,4,3,2,3,3,4,0],2,0,
      'The sharper Italian: build a big centre with c3 and d4. It leads to open, tactical positions and has been played at every level for centuries.',
      ['Play c3 and d4 to take the centre.', 'Use your lead in development for an attack.', 'Know the move order against ...Nf6 and ...Bb4+.'],
      'Black can hit back in the centre with ...d5. Take care with the isolated d-pawn lines.'),

    // ---------------- White against the Sicilian ----------------
    X('ws','alapin','Alapin Sicilian (2.c3)','1. e4 c5 2. c3 Nf6 3. e5 Nd5 4. d4 cxd4 5. Nf3 Nc6 6. cxd4 d6 7. Bc4 Nb6 8. Bb3 dxe5 9. Nxe5',/Alapin/,[3,4,3,4,3,2,2,3,1],0,0,
      'Skip the huge theory of the open Sicilian. Play c3 and d4, take a big centre, and get a calm position with a plan.',
      ['Play c3 so that after ...cxd4 you recapture with the pawn.', 'Build a pawn centre and develop smoothly.', 'You can reach the same set-ups against many Black replies.'],
      'Black has sharp options like 2...d5 and 2...Nf6. Know the main answer to each.'),
    X('ws','morra','Smith-Morra Gambit','1. e4 c5 2. d4 cxd4 3. c3 dxc3 4. Nxc3 Nc6 5. Nf3 d6 6. Bc4 e6 7. O-O Nf6 8. Qe2 Be7 9. Rd1 e5',/Smith-Morra|Morra/,[5,2,5,2,1,2,4,5,0],1,1,
      'Give a pawn in the Sicilian for fast development and open lines. A trap-laden opening that many Sicilian players hate to face.',
      ['Sacrifice the d-pawn for open files and quick development.', 'Place the rooks on d1 and e1, bishops on c4 and e3, and attack.', 'Aim at the weak d6 and f7 squares.'],
      'Strong players can defend, so don\'t overpress. If Black plays well you have compensation, not a forced win.'),
    X('ws','grandprix','Grand Prix Attack','1. e4 c5 2. Nc3 Nc6 3. f4 g6 4. Nf3 Bg7 5. Bc4 e6 6. f5 Nge7',/Grand Prix/,[5,2,4,2,1,2,4,4,1],1,1,
      'Attack the Sicilian with a quick f4. The plan is simple: knights out, bishop to c4, f5, and go for the black king.',
      ['Play f4 and Nf3 early, then Bc4 or Bb5.', 'Break with f5 and aim at the black kingside.', 'The same set-up works against most Black replies.'],
      'If Black avoids the attack and counters in the centre, your own king can be exposed. Don\'t rush f5 without the pieces to back it up.'),
    X('ws','closed','Closed Sicilian','1. e4 c5 2. Nc3 Nc6 3. g3 g6 4. Bg2 Bg7 5. d3 d6 6. f4 e6 7. Nf3 Nge7 8. O-O O-O',/Closed Sicilian|Sicilian Defense: Closed/,[3,4,3,4,2,2,2,2,1],1,0,
      'Avoid the sharp theory of the open Sicilian. Fianchetto the bishop, play f4 and aim for a kingside attack, with a safe king.',
      ['Fianchetto with g3 and Bg2, and play d3.', 'Play f4, Nf3 and aim for kingside space.', 'Break with e5 or push the f-pawn when ready.'],
      'It is slower than the open Sicilian, and Black can strike back with ...b5 and ...Rb8. Do not be passive.'),
    X('ws','openscil','Open Sicilian: English Attack','1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Be3 e6 7. f3 b5 8. Qd2 Nbd7 9. g4',/English Attack|Open Sicilian/,[5,2,5,3,1,5,4,5,0],3,0,
      'The main way to fight the Sicilian: open the centre with d4 and attack with Be3, f3, Qd2 and a kingside pawn storm (g4). Sharp, theoretical and well known.',
      ['Play d4 and open the position for your pieces.', 'Be3, f3, Qd2, O-O-O and g4 to attack on the kingside.', 'The king goes queenside while the pawns storm.'],
      'The most theory in the Sicilian. If you slip, a counterattack with ...b5 and ...Nc4 can win quickly for Black.'),

    // ---------------- White against the Caro-Kann ----------------
    X('wc','caroadv','Caro-Kann: Advance Variation','1. e4 c6 2. d4 d5 3. e5 Bf5 4. Nf3 e6 5. Be2 c5 6. Be3 Nd7',/Caro-Kann Defense: Advance/,[3,4,2,4,3,2,2,2,1],0,0,
      'Gain space with e5 and keep Black\'s bishop outside the pawn chain. A simple plan: space, solid pieces and a good structure.',
      ['Push e5 to take space and block the bishop on c8.', 'Support the centre with c3 and Be2, and castle.', 'Use your space advantage on the kingside.'],
      'Black strikes back at d4 with ...c5. If you do not keep the centre protected, you can end up with weaknesses.'),
    X('wc','panov','Caro-Kann: Panov Attack','1. e4 c6 2. d4 d5 3. exd5 cxd5 4. c4 Nf6 5. Nc3 e6 6. Nf3 Bb4 7. cxd5 Nxd5 8. Bd2 Nc6 9. Bd3 Nf6 10. O-O O-O',/Panov/,[4,3,3,4,2,3,3,5,0],2,0,
      'Take on d5 and add c4. You get an isolated queen\'s pawn or a pawn centre and lots of piece activity. An attacking way to face the Caro-Kann.',
      ['Exchange on d5 and play c4 to challenge d5.', 'Get active pieces and a lead in development.', 'Play with the isolated d-pawn or a pawn majority.'],
      'Be ready for the endgame if the isolated d-pawn gets weak. Keep the pieces active.'),
    X('wc','carofantasy','Caro-Kann: Fantasy Variation','1. e4 c6 2. d4 d5 3. f3 dxe4 4. fxe4 e5 5. Nf3 exd4 6. Bc4 Nf6 7. O-O Bd6',/Fantasy|Tartakower/,[4,3,3,3,2,1,3,4,1],1,1,
      'Play 3.f3 and aim for a big centre, with little theory to learn. Black has to find the right plan on his own.',
      ['Use f3 to support e4, and develop with Nc3 and Bc4.', 'You get a strong centre and quick development.', 'A simple weapon if you do not want to learn the main lines.'],
      'Black can take on e4 and play ...e5 to gain activity. Do not play it automatically: know when to play Nc3.'),

    // ---------------- White against the French ----------------
    X('wf','frenchadv','French Defense: Advance Variation','1. e4 e6 2. d4 d5 3. e5 c5 4. c3 Nc6 5. Nf3 Qb6 6. a3 Nh6',/French Defense: Advance/,[3,4,2,4,2,2,2,2,1],0,0,
      'Push e5, take space, and support d4 with c3. A clear plan with less theory than the main lines. You often attack on the kingside.',
      ['Play e5 and c3 to build a firm centre.', 'Defend d4 and develop with Nf3 and Be2.', 'Play on the kingside while Black plays on the queenside.'],
      'Black\'s ...Qb6 and ...Bd7 plans put pressure on d4 and b2. Learn how to answer them.'),
    X('wf','frtarrasch','French Defense: Tarrasch Variation','1. e4 e6 2. d4 d5 3. Nd2 Nf6 4. e5 Nfd7 5. Bd3 c5 6. c3 Nc6 7. Ne2 cxd4 8. cxd4 f6',/Tarrasch Variation/,[3,4,3,4,3,3,2,3,1],1,0,
      'Develop the knight to d2, avoiding the Winawer pin. A solid, strategic way to play against the French, with a small but lasting edge.',
      ['Knight to d2 keeps the pin ...Bb4 out of the game.', 'Keep a solid pawn centre with c3.', 'Aim for a slight space advantage.'],
      'You give Black some freedom with ...c5. Study the plans after 3...c5 and 3...Nf6.'),
    X('wf','frenchexch','French Defense: Exchange Variation','1. e4 e6 2. d4 d5 3. exd5 exd5 4. Nf3 Nf6 5. Bd3 Bd6 6. O-O O-O 7. Bg5 Bg4 8. Nbd2 Nbd7',/French Defense: Exchange/,[2,5,2,4,4,1,1,3,1],0,0,
      'Take on d5 and aim for a simple symmetrical position. Easy to play and a good practical choice if you want a calm game with an endgame edge.',
      ['Exchange on d5 for a clear pawn structure.', 'Develop the pieces to natural squares and castle.', 'Use the extra tempo and create an edge in the endgame.'],
      'It is drawish at the top levels. Play for the win by choosing the right plan, such as a minority attack or a kingside attack.'),
    X('wf','kiaf','King\'s Indian Attack vs the French','1. e4 e6 2. d3 d5 3. Nd2 Nf6 4. Ngf3 c5 5. g3 Nc6 6. Bg2 Be7 7. O-O O-O',/King's Indian Attack/,[3,4,2,4,2,1,2,2,1],0,0,
      'Skip the French theory entirely: build a solid set-up with d3, Nd2, Ngf3, g3 and Bg2. The same set-up works against several Black defences.',
      ['Use the same pieces whatever Black does.', 'Play e5 when you are ready to gain space.', 'Aim at the black kingside with Nh4 and f4.'],
      'Black has a free hand in the centre. Do not be passive, and look for the right time for e5.'),

    // ---------------- more against 1.e4 as Black ----------------
    X('e4','sveshnikov','Sicilian: Sveshnikov','1. e4 c5 2. Nf3 Nc6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 e5 6. Ndb5 d6 7. Bg5 a6 8. Na3 b5',/Sveshnikov|Lasker-Pelikan/,[4,2,4,3,2,5,4,3,0],3,0,
      'Accept a weak d5 square in return for active piece play and a strong pawn centre. A modern main line, very theoretical and very respected.',
      ['Put pawns on e5 and d6 and take control of the centre.', 'Attack on the queenside with ...b5 and ...Bg7 or ...Be7.', 'The knight on d5 is annoying but you get counterplay.'],
      'Your d5 square can be a permanent weakness. Learn the main lines carefully before you play it.'),
    X('e4','scheveningen','Sicilian: Scheveningen','1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 e6 6. Be2 Be7 7. O-O O-O',/Scheveningen/,[3,4,3,4,2,4,3,3,0],2,0,
      'A solid pawn structure with ...e6 and ...d6, the "small centre". You wait and counterattack when White commits.',
      ['Play ...e6, ...d6, ...Be7 and castle.', 'Hold the centre and strike with ...d5 or ...b5 at the right moment.', 'Counterattack when White attacks on the kingside.'],
      'White can attack hard with g4 (the Keres Attack). You must be ready to meet it.'),
    X('e4','taimanov','Sicilian: Taimanov','1. e4 c5 2. Nf3 e6 3. d4 cxd4 4. Nxd4 Nc6 5. Nc3 Qc7 6. Be3 a6 7. Qd2 Nf6 8. O-O-O Be7',/Taimanov/,[3,3,3,4,2,3,3,3,0],2,1,
      'A flexible Sicilian with ...e6, ...Nc6 and ...Qc7. Many different plans, and White cannot easily force you into one line.',
      ['Keep the structure flexible and decide your plan after White\'s set-up.', 'Play ...a6 and ...Nf6, and look at ...Ne5 or ...b5.', 'Counterattack in the centre with ...d5.'],
      'Many move orders. Learn what you will do against the English Attack and the Maroczy Bind.'),
    X('e4','marshall','Ruy Lopez: Marshall Attack','1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 O-O 8. c3 d5 9. exd5 Nxd5 10. Nxe5 Nxe5 11. Rxe5 c6 12. d4 Bd6',/Marshall/,[5,2,5,2,1,5,5,5,0],3,1,
      'Sacrifice a pawn in the Ruy Lopez for a strong attack on the white king. One of the most famous gambits, played at the highest level.',
      ['Give a pawn on d5 and play for activity.', 'Attack the white king with ...Qh4, ...Bd6 and ...Bf5.', 'You get a lot of play for the pawn.'],
      'White can avoid it with the Anti-Marshall lines. And you must know the theory exactly, since a single slip loses.'),
    X('e4','winawer','French Defense: Winawer','1. e4 e6 2. d4 d5 3. Nc3 Bb4 4. e5 c5 5. a3 Bxc3+ 6. bxc3 Ne7 7. Qg4 Qc7',/Winawer/,[4,2,4,3,2,4,4,3,0],2,0,
      'Pin the knight with ...Bb4 and give up the bishop for the knight to double White\'s pawns. Sharp and double-edged, but with clear plans.',
      ['Pin the knight on c3 and take it with ...Bxc3+.', 'Attack the doubled pawns and the centre with ...c5 and ...Qc7.', 'Accept the weak dark squares in return for activity.'],
      'White gets the bishop pair and attacking chances on the kingside. You must know the main lines.'),
    X('e4','latvian','Latvian Gambit','1. e4 e5 2. Nf3 f5 3. Nxe5 Qf6 4. d4 d6 5. Nc4 fxe4 6. Nc3 Qg6 7. Ne3 Nf6',/Latvian/,[4,1,5,1,1,2,5,5,0],0,1,
      'An old trappy opening: play ...f5 on move 2 and go for the attack. It is unsound against best play, but it can win many quick games against unprepared opponents.',
      ['Play ...f5 and look for tricks and quick attacks.', 'Use the queen early on f6 or h4.', 'Look for traps on the f-file and e4.'],
      'A good opponent can punish the early ...f5, so use it as a surprise weapon only. Do not make it your main opening.'),

    // ---------------- more against 1.d4 as Black ----------------
    X('d4','semislav','Semi-Slav Defense','1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. Nc3 e6 5. e3 Nbd7 6. Bd3 dxc4 7. Bxc4 b5 8. Bd3 Bb7',/Semi-Slav|Meran|Botvinnik/,[3,3,4,3,2,5,4,3,0],3,0,
      'A fighting defence: a solid centre with ...c6 and ...e6, then sharp play. One of the most complex openings, with a lot of theory.',
      ['Hold the centre with ...c6, ...d5 and ...e6.', 'Break with ...c5 or ...e5, or take on c4 and play ...b5.', 'Rich play for both sides.'],
      'Huge theory, and some lines are very sharp (Botvinnik, Anti-Moscow). Needs real study.'),
    X('d4','tarrasch','Tarrasch Defense','1. d4 d5 2. c4 e6 3. Nc3 c5 4. cxd5 exd5 5. Nf3 Nc6 6. g3 Nf6 7. Bg2 Be7 8. O-O O-O',/Tarrasch Defense/,[3,2,3,3,2,3,3,4,0],2,0,
      'Take the centre openly with ...c5 and play with an isolated d-pawn but active pieces. A principled, open and attacking defence.',
      ['Strike at the centre with ...c5 and accept the isolated d-pawn.', 'Use the active pieces and open lines.', 'Be careful in the endgame, the isolated pawn can be weak.'],
      'Your d5 pawn can become a long-term weakness. Keep the position tactical and the pieces active.'),
    X('d4','qga','Queen\'s Gambit Accepted','1. d4 d5 2. c4 dxc4 3. Nf3 Nf6 4. e3 e6 5. Bxc4 c5 6. O-O a6 7. Qe2 b5 8. Bb3 Nc6',/Queen's Gambit Accepted/,[3,4,3,3,3,3,2,4,0],1,0,
      'Take the pawn and give it back at the right time. Simpler than many other d4 defences, with clear plans and easy development.',
      ['Take on c4, then hit the centre with ...c5.', 'Develop the pieces quickly and castle.', 'Give back the pawn if needed to get a good position.'],
      'White gets a lead in development. Do not get greedy and try to keep the pawn.'),
    X('d4','oldindian','Old Indian Defense','1. d4 Nf6 2. c4 d6 3. Nc3 Nbd7 4. e4 e5 5. Nf3 Be7 6. Be2 O-O 7. O-O c6',/Old Indian/,[2,4,2,3,3,2,2,3,1],1,1,
      'A solid, flexible set-up with ...d6, ...Nbd7 and ...e5. Less theory than the King\'s Indian, and the same ideas.',
      ['Play ...d6 and ...e5 for a firm centre.', 'Develop the pieces to natural squares and castle.', 'Look for ...c6 and a safe position.'],
      'Passive if you don\'t find the right break. Learn the plans with ...exd4 and ...c6.'),
    X('d4','bogo','Bogo-Indian Defense','1. d4 Nf6 2. c4 e6 3. Nf3 Bb4+ 4. Bd2 Qe7 5. g3 Nc6 6. Nc3 Bxc3 7. Bxc3 Ne4',/Bogo-Indian/,[2,4,2,4,3,2,2,3,1],1,0,
      'A simple and safe alternative to the Nimzo: check on b4 and then solid development. Little theory and sound structure.',
      ['Play ...Bb4+ and trade or retreat it.', 'Get the pieces out and castle.', 'Play ...d5 or ...b6 depending on the set-up.'],
      'It can be a little passive. Look for the right moment to play ...d5 and ...c5.'),
    X('d4','albin','Albin Countergambit','1. d4 d5 2. c4 e5 3. dxe5 d4 4. Nf3 Nc6 5. g3 Be6 6. Nbd2 Qd7 7. Bg2 O-O-O',/Albin/,[4,1,4,2,1,3,5,4,0],1,1,
      'Give a pawn in the Queen\'s Gambit for a space-gaining pawn on d4 and attacking chances. Many players do not know the theory.',
      ['Sacrifice the pawn for a strong d4 pawn and space.', 'Use the pieces quickly in a kingside or central attack.', 'Look for traps involving ...Bg4 and ...Nge7.'],
      'It is unsound at the highest level. Use it as a surprise weapon, and be ready for the main Lasker Trap and Alapin line.'),
    X('d4','benko','Benko Gambit','1. d4 Nf6 2. c4 c5 3. d5 b5 4. cxb5 a6 5. bxa6 Bxa6 6. Nc3 g6 7. e4 Bxf1 8. Kxf1 d6 9. Nf3 Bg7 10. g3 O-O',/Benko|Volga/,[3,2,3,5,4,4,4,3,0],3,1,
      'Give a pawn for long-term pressure on the queenside. You get open files and active pieces. Positional, not tactical.',
      ['Open the a- and b-files for the rooks.', 'Put pressure on the queenside with ...Qa5, ...Rb8 and ...Nbd7.', 'Play the long game and use the bishop on g7.'],
      'It needs patience: you are a pawn down for many moves. White can also decline with 4.Nf3 or play the Fianchetto.'),
    X('d4','leningrad','Dutch Defense (Leningrad)','1. d4 f5 2. g3 Nf6 3. Bg2 g6 4. Nf3 Bg7 5. O-O O-O 6. c4 d6 7. Nc3 Qe8',/Dutch Defense: Leningrad/,[4,2,3,3,2,3,4,3,0],2,1,
      'A fianchetto version of the Dutch: the bishop on g7 and a kingside attack with ...e5 and ...Ne4. A real attacking weapon against 1.d4.',
      ['Control e4 with ...f5 and play ...d6.', 'Break with ...e5 or ...c6 and ...Qc7.', 'Attack the white king with ...Ne4 and ...g5.'],
      'It weakens the king a bit. Make sure that you know the plans with ...e5 and ...Qe8.'),

    // ---------------- against 1.c4, 1.Nf3 and other first moves ----------------
    X('oth','symeng','Symmetrical English (as Black)','1. c4 c5 2. Nc3 Nc6 3. g3 g6 4. Bg2 Bg7 5. Nf3 d6 6. O-O e6',/English Opening: Symmetrical/,[2,4,2,4,3,3,2,2,1],1,0,
      'Mirror White\'s moves. The set-up with ...c5, ...Nc6 and ...g6 is simple and safe, and the pieces go to the same squares as in the Sicilian.',
      ['Copy the fianchetto with ...g6 and ...Bg7.', 'Play ...d6 and ...e5 or ...e6 depending on the situation.', 'Counter with ...Rb8 and ...b5.'],
      'The Maroczy-type structures can be a little passive. Learn when to play ...d5.'),
    X('oth','revsic','Reversed Sicilian (answer to 1.c4)','1. c4 e5 2. Nc3 Nf6 3. Nf3 Nc6 4. g3 d5 5. cxd5 Nxd5 6. Bg2 Nb6 7. O-O Be7',/English Opening: King's English/,[3,3,3,4,2,3,3,3,0],1,0,
      'Answer 1.c4 with ...e5, like a Sicilian with an extra tempo. A common and active choice, leading to open positions.',
      ['Take the centre with ...e5 and ...d5.', 'Play ...Nc6 and ...Nf6 and fight for central squares.', 'Look for chances for both sides.'],
      'White has extra tempo options such as Qb3 and Nd5. Know the main lines.'),
    X('oth','hedgehog','Hedgehog (against 1.c4 and 1.Nf3)','1. c4 c5 2. Nf3 Nf6 3. Nc3 e6 4. g3 b6 5. Bg2 Bb7 6. O-O Be7 7. d4 cxd4 8. Qxd4 d6',/Hedgehog/,[2,4,3,5,3,3,2,2,1],2,1,
      'A flexible structure with pawns on a6, b6, d6, e6 and pieces behind them. It looks passive, but you hit back with ...b5 or ...d5 when White overextends.',
      ['Build the structure with ...b6, ...Bb7, ...d6, ...e6.', 'Wait, then strike with ...b5 or ...d5.', 'The pieces behind the pawns are ready to take advantage of White\'s mistakes.'],
      'You are cramped for a long time. You must know the break ideas, or you get squeezed.'),
    X('oth','kidset','King\'s Indian set-up against 1.Nf3','1. Nf3 Nf6 2. g3 g6 3. Bg2 Bg7 4. O-O O-O 5. d3 d6 6. Nbd2 Nc6 7. e4 e5',/Réti|King's Indian Attack/,[3,3,3,3,2,2,3,3,1],0,0,
      'Use the same set-up that White uses against you: fianchetto, castle, ...d6, ...e5. It is the quickest way to learn one plan against 1.Nf3 and 1.c4.',
      ['Fianchetto the bishop, castle and play ...d6.', 'Play ...e5 and ...Nc6 to take the centre.', 'Attack on the kingside with ...f5.'],
      'White can play d4 to take the centre. Make sure that you know the Réti and Catalan answers.')

    ,
    // ---------------- even more ----------------
    X('w','veresov','Veresov Attack','1. d4 d5 2. Nc3 Nf6 3. Bg5 Nbd7 4. f3 c6 5. e4 dxe4 6. fxe4 e5',/Veresov/,[4,3,4,3,2,2,3,4,1],1,1,
      'A tricky d4 opening: knight to c3 and bishop to g5 before Black has settled. Many opponents leave book on move 3 and have to think for themselves.',
      ['Knight to c3 and bishop to g5, pinning or threatening the knight on f6.', 'Play e3 and f3 or Nf3 and build a strong centre.', 'Look for pins and tactics against the knight.'],
      'Black has easy answers if you do not prepare (like 3...Bf5 or 3...Nbd7). Know the replies.'),
    X('w','bdg','Blackmar-Diemer Gambit','1. d4 d5 2. e4 dxe4 3. Nc3 Nf6 4. f3 exf3 5. Nxf3 e6 6. Bd3 Bb4 7. Bd2',/Blackmar/,[5,2,5,2,1,3,5,5,0],1,1,
      'Give a pawn for quick development and attack on the kingside. A rare and aggressive gambit that is fun to play in blitz.',
      ['Give a pawn with 2.e4 for a lead in development.', 'Get the pieces out with Nc3, f3 and Bc4 or Bd3.', 'Look for a quick kingside attack with Qe1 and Bg5.'],
      'Strong players can simply defend and keep the pawn. Use it as a practical weapon, not as a long-term plan.'),
    X('w','qgexch','Queen\'s Gambit: Exchange Variation','1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. cxd5 exd5 5. Bg5 Be7 6. e3 O-O 7. Bd3 Nbd7',/Queen's Gambit Declined: Exchange/,[2,5,2,5,4,2,1,2,0],1,0,
      'Take on d5 and get a clear pawn structure. The plan is the "minority attack" on the queenside with b4-b5, which is easy to learn.',
      ['Exchange on d5 to get a fixed structure.', 'Plan the minority attack with Rb1, b4 and b5.', 'Aim for an endgame advantage.'],
      'It is slow, so Black can get active pieces. Make sure the pieces are well placed before starting the minority attack.'),
    X('w','stonewall','Stonewall Attack','1. d4 d5 2. e3 Nf6 3. Bd3 e6 4. f4 c5 5. c3 Nc6 6. Nf3 Bd6 7. O-O O-O',/Stonewall/,[4,3,3,3,2,1,3,2,1],0,0,
      'A set-up with pawns on d4, e3, f4 and c3 and a bishop on d3, aiming at the kingside. One plan with very little theory.',
      ['Set up the pawns on d4, e3, f4 and c3.', 'Aim the bishop on d3 and knight on e5 at the kingside.', 'Attack with a rook lift and Ne5 and Qh5 ideas.'],
      'The bishop on c1 can be bad, and the e5 square needs to stay under control. Do not let Black take control of e4.'),
    X('w','centre','Center Game','1. e4 e5 2. d4 exd4 3. Qxd4 Nc6 4. Qe3 Nf6 5. Nc3 Bb4 6. Bd2 O-O',/Center Game/,[3,3,3,3,2,2,3,4,0],0,1,
      'Open the centre at once and bring the queen out early. Rare, and many players do not know it. Simple development makes it easy to learn.',
      ['Take the centre and recapture with the queen.', 'Retreat the queen to e3 or a4 and develop the pieces.', 'Play Nc3, Bd2, O-O-O and go for an open game.'],
      'Your queen can be chased by ...Nc6 and ...Nf6. Don\'t lose too much time with her.'),

    X('e4','scanmod','Scandinavian: Modern (3...Qd6)','1. e4 d5 2. exd5 Qxd5 3. Nc3 Qd6 4. d4 Nf6 5. Nf3 a6 6. g3 Bg4 7. Bg2 Nc6',/Scandinavian Defense: Main Line|Scandinavian Defense: Modern/,[2,4,2,3,3,2,2,3,1],0,0,
      'The same Scandinavian idea, but the queen goes to d6 instead of a5. A bit calmer and keeps the queen out of tempo attacks.',
      ['Take on d5 and retreat the queen to d6.', 'Develop ...Nf6, ...Bg4 or ...Bf5 and ...e6.', 'Castle and use the space in the centre.'],
      'White can gain space in the centre. Strike with ...c5 or ...e5 to challenge it.'),
    X('e4','nimzo_def','Nimzowitsch Defense','1. e4 Nc6 2. Nf3 d6 3. d4 Nf6 4. Nc3 Bg4 5. Be3 e6 6. Be2 Be7 7. O-O O-O',/Nimzowitsch Defense/,[2,3,3,4,2,2,3,3,1],1,1,
      'Start with the knight on c6 and keep the position flexible. A rare move that leads to unusual positions and out of book on move 1.',
      ['Develop the knight to c6 before committing the pawns.', 'Hit the centre with ...e5 or ...d5 at the right moment.', 'Play the position, not a memorised line.'],
      'White can take a lot of space. Know your plan against 2.d4 and 2.Nf3.'),
    X('e4','owen','Owen\'s Defense','1. e4 b6 2. d4 Bb7 3. Bd3 e6 4. Nf3 Nf6 5. O-O Be7 6. c4 O-O 7. Nc3 d6',/Owen/,[2,3,2,4,3,1,3,3,1],0,1,
      'Fianchetto the queen\'s bishop at once. A simple and hypermodern set-up with little theory, and the same idea against many White moves.',
      ['Put the bishop on b7 and aim it at e4 and the long diagonal.', 'Play ...e6 and ...Nf6 and castle.', 'Strike at the centre with ...c5 or ...d5 later.'],
      'White gets a big centre. You must attack it and not simply wait.'),
    X('e4','classicalsic','Sicilian: Classical / Richter-Rauzer','1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 Nc6 6. Bg5 e6 7. Qd2 Be7 8. O-O-O O-O',/Richter-Rauzer|Sicilian Defense: Classical/,[3,3,4,3,2,4,3,3,0],2,0,
      'Develop with ...Nc6 and ...Nf6, then ...e6 and ...Be7. A classical and well-tested system that does not leave you too exposed.',
      ['Develop the knights and play ...e6, ...Be7 and castle.', 'Counterattack with ...d5 or ...a6 and ...b5.', 'White often castles queenside, so you can attack with ...h5.'],
      'Know the lines where White plays Bg5 and Qd2, with O-O-O. Sharp in some lines.'),
    X('e4','hungarian','Hungarian Defense','1. e4 e5 2. Nf3 Nc6 3. Bc4 Be7 4. d4 d6 5. O-O Nf6 6. Nc3 O-O 7. h3 exd4',/Hungarian Defense/,[1,5,1,3,3,1,1,3,1],0,1,
      'A very safe reply to the Italian: ...Be7 and ...d6. A solid set-up, with little theory and a robust position.',
      ['Play ...Be7 and ...d6 and wait.', 'Develop the knight to f6 and castle.', 'Take on d4 or play ...exd4 when the moment is right.'],
      'It can be a little passive, so look for the right time to strike with ...d5.'),

    X('d4','antilondon','Anti-London set-up (...c5 and ...Qb6)','1. d4 d5 2. Nf3 Nf6 3. Bf4 c5 4. e3 Nc6 5. c3 Qb6 6. Qb3 c4 7. Qxb6 axb6',/London System/,[2,4,2,3,3,2,2,3,1],0,0,
      'The standard way to meet the London: take the centre with ...c5 and ...Nc6, and use the queen to hit b2. Easy to play and leads to good, equal positions.',
      ['Strike with ...c5 as soon as White plays Bf4.', 'Put the queen on b6 to hit the b2 pawn.', 'Develop with ...Nc6, ...e6 and ...Bd6.'],
      'White can defend b2 and continue developing. Keep your own pieces active and do not trade queens too early.'),
    X('d4','catblack','Open Catalan (as Black)','1. d4 Nf6 2. c4 e6 3. g3 d5 4. Bg2 dxc4 5. Nf3 a6 6. O-O Nc6 7. Qc2 Bd7',/Catalan Opening: Open/,[2,4,2,4,3,3,2,3,0],2,0,
      'Take the pawn on c4 and hold it as long as is safe. White gets the long-diagonal pressure, but you can return the pawn at the right moment.',
      ['Take on c4 and aim to give the pawn back for equality.', 'Use ...a6 and ...b5 to hold the extra pawn.', 'Develop the pieces to safe squares and castle.'],
      'White has strong pressure for the pawn. Be accurate when giving it back.')
  ];

  // ---------------------------------------------------------------------------------------------
  // The quiz. Each option adjusts the profile: w = extra weight for a trait, set = overwrite, add = add to a number
  // ---------------------------------------------------------------------------------------------
  var Q = [
    {id:'lvl', q:'How strong are you right now?', o:[
      {t:'Just starting out (under about 800)', set:{lvl:0}}, {t:'Beginner to club player (about 800 to 1200)', set:{lvl:1}}, {t:'Club player (about 1200 to 1600)', set:{lvl:2}},
      {t:'Strong club player (about 1600 to 2000)', set:{lvl:3}}, {t:'Expert (2000+)', set:{lvl:4}}]},
    {id:'side', q:'What do you want to learn?', o:[
      {t:'An opening for White', set:{sides:'w'}}, {t:'Openings for Black', set:{sides:'b'}}, {t:'Both', set:{sides:'wb'}}]},
    {id:'enjoy', q:'What do you enjoy most in a game?', o:[
      {t:'Attacking the king and going for checkmate', w:{att:2, tac:1}}, {t:'Playing safe, solid chess and waiting for mistakes', w:{sol:2}},
      {t:'Sharp tactics and calculating lines', w:{tac:2, att:1}}, {t:'Slow plans, good squares and long-term strategy', w:{pos:2, sol:1}},
      {t:'Reaching a clean endgame and out-playing people there', w:{end:2, pos:1}}]},
    {id:'theory', q:'How much theory are you willing to learn?', o:[
      {t:'As little as possible. I want a plan, not a list of moves', set:{th:1}}, {t:'A bit: the first 6 to 8 moves', set:{th:2}},
      {t:'A fair amount, if it is worth it', set:{th:3}}, {t:'I love memorising lines, give me everything', set:{th:5}}]},
    {id:'study', q:'How much time can you spend studying openings each week?', o:[
      {t:'Almost none. I just play', set:{cap:1}}, {t:'Up to an hour', set:{cap:2}}, {t:'A few hours', set:{cap:3}}, {t:'A lot. I enjoy it', set:{cap:5}}]},
    {id:'init', q:'Early in the game, would you rather...', o:[
      {t:'Have the initiative and make the opponent react', w:{att:1, tac:1}}, {t:'Stay flexible and react to what the opponent does', w:{sol:1, pos:1}},
      {t:'Make sure I never end up in a bad position', w:{sol:2}}]},
    {id:'risk', q:'How do you feel about risk?', o:[
      {t:'Win or bust. A draw is no better than a loss', set:{rk:5}}, {t:'I take some chances if the position calls for it', set:{rk:3}},
      {t:'I would rather play safe, even if it means more draws', set:{rk:1}}]},
    {id:'open', q:'What kind of positions do you like?', o:[
      {t:'Wide open, with pieces flying everywhere', set:{open:5}}, {t:'A bit of both', set:{open:3}}, {t:'Closed and slow, with pawn chains and manoeuvring', set:{open:1.5}}]},
    {id:'sys', q:'One set-up against everything, or adapt to the opponent?', o:[
      {t:'One set-up. I do not want to learn a lot of different lines', add:{sys:2}}, {t:'A mix is fine', add:{sys:0}},
      {t:'Adapt. I like new positions and learning variations', add:{sys:-2}}]},
    {id:'time', q:'What time control do you play most?', o:[
      {t:'Bullet or blitz (under 10 minutes)', add:{sys:1}, w:{tac:1}}, {t:'Rapid (10 to 30 minutes)', w:{}},
      {t:'Classical or long games', w:{pos:1}, add:{sys:-1}}]},
    {id:'queens', q:'How do you feel about trading queens early?', o:[
      {t:'Happy to. Endgames are where I win', w:{end:2}}, {t:'No strong feeling', w:{}}, {t:'I want queens on the board', w:{att:1, tac:1}}]},
    {id:'surprise', q:'Do you want a well-known opening or a surprise?', o:[
      {t:'Well-known and well-tested', set:{rare:-1}}, {t:'No preference', set:{rare:0}}, {t:'A surprise, so my opponents have not prepared', set:{rare:1}}]},
    {id:'hero', q:'Which player style sounds most like what you want to play?', o:[
      {t:'Tal: sacrifices and attacks, whatever it takes', w:{att:2, tac:2}, set:{rk:5}}, {t:'Karpov: slow squeeze, take small advantages', w:{pos:2, sol:1}},
      {t:'Fischer: sharp but principled, everything is calculated', w:{tac:1, att:1, pos:1}}, {t:'Carlsen: keep it simple, grind them down', w:{end:2, pos:1}},
      {t:'Capablanca: clean, natural, no mistakes', w:{sol:2, end:1}}]},
    {id:'surp2', q:'When your opponent plays something unexpected, you...', o:[
      {t:'Enjoy thinking it through over the board', add:{sys:-1}, w:{tac:1}}, {t:'Would rather have a plan ready for every case', add:{sys:1}, set:{th:null}}]}
  ];

  function profileOf(ans){
    var P = {lvl:2, w:{att:0, sol:0, tac:0, pos:0, end:0}, th:3, cap:5, rk:3, open:3, sys:0, rare:0, sides:'wb'};
    Q.forEach(function(q){
      var i = ans[q.id]; if(i == null || !q.o[i]) return;
      var o = q.o[i];
      if(o.set) Object.keys(o.set).forEach(function(k){ if(o.set[k] === null) return; P[k] = o.set[k]; });
      if(o.add) Object.keys(o.add).forEach(function(k){ P[k] = (P[k] || 0) + o.add[k]; });
      if(o.w) Object.keys(o.w).forEach(function(k){ P.w[k] += o.w[k]; });
    });
    P.sys = Math.max(-2, Math.min(2, P.sys));
    P.th = Math.min(P.th, P.cap);        // the time you can spend studying caps how much theory is sensible
    return P;
  }

  // ---------------------------------------------------------------------------------------------
  // Your own games (saved by the analysis in Habits)
  // ---------------------------------------------------------------------------------------------
  function myGames(){ return lsGet(HKEY, []).filter(function(g){ return g && g.fam; }); }
  function groupGames(games){
    var map = {};
    games.forEach(function(g){
      var k = g.me + '|' + g.fam, o = map[k] || (map[k] = {me:g.me, fam:g.fam, n:0, acc:0, el:0, sc:0, scN:0, bk:0, ops:{}});
      o.n++; o.acc += g.acc || 0; o.el += g.eloss || 0; o.bk += g.bk || 0;
      if(g.score != null){ o.sc += g.score; o.scN++; }
      if(g.op) o.ops[g.op] = (o.ops[g.op] || 0) + 1;
    });
    return Object.keys(map).map(function(k){
      var o = map[k];
      return {me:o.me, fam:o.fam, n:o.n, acc:Math.round(o.acc / o.n), el:Math.round(o.el / o.n * 10) / 10, sc:o.scN ? o.sc / o.scN : null, bk:Math.round(o.bk / o.n), ops:o.ops};
    }).sort(function(a, b){ return b.n - a.n; });
  }
  function ownStats(item, groups){
    // all of your games whose opening name matches this one
    var hit = null;
    groups.forEach(function(g){
      if(g.me !== (WHITE[item.cat] ? 'w' : 'b')) return;
      Object.keys(g.ops).forEach(function(op){
        if(item.rx && item.rx.test(op)){ hit = hit || {n:0, el:0}; hit.n += g.ops[op]; hit.el += g.el * g.ops[op]; }
      });
    });
    if(hit) hit.el = hit.el / hit.n;
    return hit;
  }

  var PEN = {latvian:10, danish:5, albin:5, bdg:4, budapest:3};
  function scoreItem(o, P, groups){
    var t = o.t, s = 0, why = [], k;
    ['att', 'sol', 'tac', 'pos', 'end'].forEach(function(k){ s += Math.min(3, P.w[k] || 0) * (t[k] - 3); });
    s -= Math.abs(t.rk - P.rk) * 1.4;
    s -= Math.abs(t.open - P.open) * 1.0;
    s += P.sys * (t.sys ? 2.5 : -1.0);
    s -= Math.max(0, t.th - P.th) * 5;
    s -= Math.max(0, o.lvl - P.lvl) * 5;
    s += P.rare * (o.rare ? 2.5 : -0.5);
    s -= (PEN[o.id] || 0);        // openings that are fun but not fully sound should not top the list
    var own = ownStats(o, groups);
    if(own){
      if(own.el <= 10){ s += 3 + Math.min(2, own.n * 0.5); why.push('You already play this (' + own.n + ' game' + (own.n > 1 ? 's' : '') + ') and your first moves go well. Keep it.'); }
      else { s -= 1.5; why.push('You have played this ' + own.n + ' time' + (own.n > 1 ? 's' : '') + ', but the first 12 moves cost you about ' + Math.round(own.el) + '% win chance on average. It may need cleaning up, or a different choice.'); }
    }
    // short reasons for the card
    var chips = [];
    if(t.th <= 2) chips.push('Low theory');
    else if(t.th <= P.th) chips.push('Theory fits what you want');
    if(t.sys && P.sys > 0) chips.push('One set-up for most games');
    if(P.w.att >= 2 && t.att >= 4) chips.push('Fits your attacking taste');
    if(P.w.sol >= 2 && t.sol >= 4) chips.push('Solid, like you asked');
    if(P.w.tac >= 2 && t.tac >= 4) chips.push('Lots of tactics');
    if(P.w.pos >= 2 && t.pos >= 4) chips.push('Rich in strategy');
    if(P.w.end >= 2 && t.end >= 4) chips.push('Good endgames');
    if(Math.abs(t.rk - P.rk) <= 1) chips.push(t.rk >= 4 ? 'Risky, as you like it' : (t.rk <= 2 ? 'Safe and sound' : 'Balanced risk'));
    if(P.rare > 0 && o.rare) chips.push('A surprise for your opponents');
    if(o.lvl <= P.lvl) chips.push('Right for your level');
    return {s:s, chips:chips.slice(0, 4), own:own, ownNote:why[0] || ''};
  }

  function rank(P, groups, cat){
    var list = DB.filter(function(o){ return o.cat === cat; }).map(function(o){ var r = scoreItem(o, P, groups); r.o = o; return r; });
    list.sort(function(a, b){ return b.s - a.s; });
    var top = list.length ? list[0].s : 0;
    list.forEach(function(r){ r.pct = Math.max(30, Math.min(99, Math.round(99 - (top - r.s) * 3.2))); });
    return list;
  }

  // ---------------------------------------------------------------------------------------------
  // Board preview with a move stepper
  // ---------------------------------------------------------------------------------------------
  function sanList(str){ return str.replace(/\d+\.(\.\.)?/g, ' ').trim().split(/\s+/).filter(Boolean); }
  function fensFor(str){
    var c = new Chess(), out = [{fen:c.fen(), san:null}];
    sanList(str).forEach(function(m){ var mv = c.move(m); if(mv) out.push({fen:c.fen(), san:mv.san}); });
    return out;
  }
  function lineText(str){ return sanList(str).map(function(m, i){ return (i % 2 === 0 ? (i / 2 + 1) + '. ' : '') + m; }).join(' '); }
  function boardFor(item, step){
    var f = fensFor(item.m), st = Math.max(0, Math.min(step, f.length - 1)), flip = !WHITE[item.cat];
    var arrows = [];
    try{
      if(st > 0){ var c = new Chess(f[st - 1].fen), mv = c.move(f[st].san); if(mv) arrows = [{from:mv.from, to:mv.to, color:'#1f9d55'}]; }
    }catch(e){}
    return {html:Z().boardHtml(f[st].fen, null, arrows, flip, {}), step:st, max:f.length - 1, san:f[st].san, no:Math.ceil(st / 2)};
  }

  // ---------------------------------------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------------------------------------
  var CATNAME = {w:'As White: your main openings', ws:'As White: against the Sicilian (1.e4 c5)', wc:'As White: against the Caro-Kann (1.e4 c6)', wf:'As White: against the French (1.e4 e6)', e4:'As Black against 1.e4', d4:'As Black against 1.d4', oth:'As Black against 1.c4, 1.Nf3 and other moves'};
  var WHITE = {w:1, ws:1, wc:1, wf:1};

  function start(){
    var saved = lsGet(QKEY, null);
    S = {ans:(saved && saved.ans) || {}, step:0, open:null, bstep:0, more:{}, view:(saved && saved.done) ? 'result' : 'intro'};
    draw();
  }

  function draw(){
    if(!root) return;
    if(!Z() || typeof Chess === 'undefined'){ root.innerHTML = '<div class="card"><p class="desc">The chess tools are still loading. Try again in a moment.</p></div>'; return; }
    if(S.view === 'intro') return drawIntro();
    if(S.view === 'quiz') return drawQuiz();
    return drawResult();
  }

  function drawIntro(){
    var games = myGames(), n = games.length;
    root.innerHTML = '<div class="card"><h2>Find my opening</h2>' +
      '<p class="desc">Answer ' + Q.length + ' quick questions about how you like to play. You get a short list of openings that fit you, with the main ideas, the traps to watch for and a board to step through. ' +
      (n >= 3 ? 'It also uses your <b>' + n + ' analysed games</b> to see which openings already work for you and which cost you points early.' : 'Analyse a few of your games first, and it will also use them to see which openings already work for you.') +
      '</p><p class="desc" style="opacity:.75;">Your answers and your game data stay on this device. Nothing is uploaded.</p>' +
      '<div class="an-prbtns"><button id="opStart">Start the quiz</button></div></div>';
    document.getElementById('opStart').onclick = function(){ S.view = 'quiz'; S.step = 0; draw(); };
  }

  function drawQuiz(){
    var q = Q[S.step], sel = S.ans[q.id], pct = Math.round(S.step / Q.length * 100);
    var h = '<div class="card"><div class="op-prog"><div style="width:' + pct + '%"></div></div>' +
      '<div class="an-note" style="opacity:.7;">Question ' + (S.step + 1) + ' of ' + Q.length + '</div><h2 style="margin-top:4px;">' + esc(q.q) + '</h2><div class="op-opts">';
    q.o.forEach(function(o, i){ h += '<button class="op-opt' + (sel === i ? ' on' : '') + '" data-i="' + i + '">' + esc(o.t) + '</button>'; });
    h += '</div><div class="an-prbtns" style="margin-top:12px;">' + (S.step > 0 ? '<button class="secondary" id="opBack">Back</button>' : '') + '</div></div>';
    root.innerHTML = h;
    root.querySelectorAll('.op-opt').forEach(function(b){ b.onclick = function(){
      S.ans[q.id] = parseInt(b.dataset.i, 10);
      if(S.step + 1 >= Q.length){ lsSet(QKEY, {ans:S.ans, done:true}); S.view = 'result'; S.open = null; }
      else S.step++;
      draw();
    }; });
    var bk = document.getElementById('opBack'); if(bk) bk.onclick = function(){ S.step = Math.max(0, S.step - 1); draw(); };
  }

  function insightsHtml(groups, games){
    if(games.length < 3) return '<div class="card"><h3>What your games say</h3><p class="desc">Not enough analysed games yet (' + games.length + '). Analyse at least 3 of your own games and this section shows which openings you reach, and how your first moves go. It is saved on this device.</p></div>';
    var out = [], byMe = {w:[], b:[]};
    groups.forEach(function(g){ byMe[g.me].push(g); });
    ['w', 'b'].forEach(function(me){
      var a = byMe[me]; if(!a.length) return;
      var top = a[0];
      out.push('<li><b>' + (me === 'w' ? 'As White' : 'As Black') + '</b>, you reach the <b>' + esc(top.fam) + '</b> most (' + top.n + ' game' + (top.n > 1 ? 's' : '') + ').</li>');
    });
    var leaky = groups.filter(function(g){ return g.n >= 2 && g.el >= 12; }).sort(function(a, b){ return b.el - a.el; })[0];
    if(leaky) out.push('<li>Your <b>' + esc(leaky.fam) + '</b> games (as ' + (leaky.me === 'w' ? 'White' : 'Black') + ') cost you about <b>' + Math.round(leaky.el) + '%</b> win chance in the first 12 moves. That is the best opening to fix first.</li>');
    var good = groups.filter(function(g){ return g.n >= 2 && g.el <= 6; }).sort(function(a, b){ return b.n - a.n; })[0];
    if(good) out.push('<li>Your <b>' + esc(good.fam) + '</b> games (as ' + (good.me === 'w' ? 'White' : 'Black') + ') start cleanly: about ' + (Math.round(good.el * 10) / 10) + '% lost in the first 12 moves. Keep playing it.</li>');
    var early = games.filter(function(g){ return g.fb && g.fb <= 10; }).length;
    if(early >= 2) out.push('<li>In <b>' + early + ' of ' + games.length + '</b> games your first mistake came before move 10. Learning the first moves of your main openings will help most.</li>');
    var rows = groups.slice(0, 8).map(function(g){
      var v = g.n < 2 ? 'Too few games' : (g.el <= 6 ? 'Works well' : (g.el <= 12 ? 'Okay' : 'Costs you early'));
      return '<tr><td>' + (g.me === 'w' ? 'White' : 'Black') + '</td><td>' + esc(g.fam) + '</td><td>' + g.n + '</td><td>' + g.el + '%</td><td>' + g.acc + '%</td><td>' + (g.sc == null ? '-' : Math.round(g.sc * 100) + '%') + '</td><td>' + v + '</td></tr>';
    }).join('');
    return '<div class="card"><h3>What your games say (' + games.length + ' games)</h3><ul class="op-ins">' + out.join('') + '</ul>' +
      '<div class="op-tbl"><table><thead><tr><th>Colour</th><th>Opening</th><th>Games</th><th>Lost early</th><th>Accuracy</th><th>Score</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<p class="an-note" style="opacity:.7;">"Lost early" is the average win chance your first 12 moves cost. Under 6% is clean. Based on the games analysed on this device, so a small sample can be misleading.</p></div>';
  }

  function cardHtml(r, idx, cat){
    var o = r.o, isOpen = S.open === o.id, h = '';
    h += '<div class="op-item' + (isOpen ? ' open' : '') + '" data-id="' + o.id + '"><button class="op-head" data-id="' + o.id + '">' +
      '<span class="op-rank">' + (idx + 1) + '</span><span class="op-name">' + esc(o.n) + '</span><span class="op-pct">' + r.pct + '% fit</span></button>';
    h += '<div class="op-chips">' + r.chips.map(function(c){ return '<span class="op-chip">' + esc(c) + '</span>'; }).join('') + (r.own ? '<span class="op-chip own">In your games</span>' : '') + '</div>';
    if(isOpen){
      var b = boardFor(o, S.bstep);
      h += '<div class="op-body"><div class="an-main"><div>' + b.html + '<div class="an-prbtns op-step"><button class="secondary" data-act="first">&laquo;</button><button class="secondary" data-act="prev">&lsaquo;</button><button class="secondary" data-act="next">&rsaquo;</button><button class="secondary" data-act="last">&raquo;</button></div></div>' +
        '<div class="an-side"><p>' + esc(o.d) + '</p>' + (r.ownNote ? '<div class="an-fb">' + esc(r.ownNote) + '</div>' : '') +
        '<div class="an-title">The moves</div><span class="an-line">' + esc(lineText(o.m)) + '</span>' +
        '<div class="an-title" style="margin-top:10px;">Main ideas</div><ul class="op-ul">' + o.ideas.map(function(x){ return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
        '<div class="an-title">Watch out</div><p class="an-note">' + esc(o.watch) + '</p>' +
        '<div class="an-prbtns"><button class="secondary" data-act="copy">Copy the moves</button></div></div></div></div>';
    }
    return h + '</div>';
  }

  function drawResult(){
    var P = profileOf(S.ans), games = myGames(), groups = groupGames(games), main = P.sides === 'w' ? ['w'] : (P.sides === 'b' ? ['e4', 'd4'] : ['w', 'e4', 'd4']),
        extra = P.sides === 'w' ? ['ws', 'wc', 'wf'] : (P.sides === 'b' ? ['oth'] : ['ws', 'wc', 'wf', 'oth']), cats = S.extra ? main.concat(extra) : main;
    var h = '<div class="card"><h2>Openings that fit you</h2><p class="desc">Based on your answers' + (games.length >= 3 ? ' and your ' + games.length + ' analysed games' : '') + '. Tap an opening to see its main ideas, a board and the traps. The fit % is a rough guide, not a rating.</p>' +
      '<div class="an-prbtns"><button class="secondary" id="opRetake">Retake the quiz</button></div></div>';
    cats.forEach(function(cat){
      var list = rank(P, groups, cat), base = 3, shown = S.more[cat] ? list.length : Math.min(base, list.length);
      h += '<div class="card"><h3>' + CATNAME[cat] + '</h3>';
      for(var i = 0; i < shown; i++) h += cardHtml(list[i], i, cat);
      if(list.length > shown) h += '<div class="an-prbtns"><button class="secondary" data-more="' + cat + '">More options</button></div>';
      else if(S.more[cat] && list.length > base) h += '<div class="an-prbtns"><button class="secondary" data-less="' + cat + '">Show fewer</button></div>';
      h += '</div>';
    });
    h += '<div class="an-prbtns" style="margin:0 0 12px;"><button class="secondary" id="opExtra">' + (S.extra ? 'Hide the extra sections' : 'Also show picks against the Sicilian, Caro-Kann, French and other first moves') + '</button></div>';
    h += insightsHtml(groups, games);
    h += '<p class="an-note" style="opacity:.7;">Openings are a matter of taste. At most levels, tactics and not hanging pieces matter more than the exact opening, so pick one or two you enjoy and play them often.</p>';
    root.innerHTML = h;
    bind(P, groups);
  }

  function findItem(id){ return DB.filter(function(o){ return o.id === id; })[0]; }
  function bind(P, groups){
    var ex = document.getElementById('opExtra'); if(ex) ex.onclick = function(){ S.extra = !S.extra; draw(); };
    var rt = document.getElementById('opRetake'); if(rt) rt.onclick = function(){ S.view = 'quiz'; S.step = 0; draw(); };
    root.querySelectorAll('.op-head').forEach(function(b){ b.onclick = function(){ S.open = S.open === b.dataset.id ? null : b.dataset.id; S.bstep = 0; if(S.open){ var it = findItem(S.open); S.bstep = it ? sanList(it.m).length : 0; } draw(); }; });
    root.querySelectorAll('[data-more]').forEach(function(b){ b.onclick = function(){ S.more[b.dataset.more] = true; draw(); }; });
    root.querySelectorAll('[data-less]').forEach(function(b){ b.onclick = function(){ S.more[b.dataset.less] = false; draw(); }; });
    root.querySelectorAll('.op-step [data-act]').forEach(function(b){ b.onclick = function(){
      var it = findItem(S.open); if(!it) return; var max = sanList(it.m).length;
      var a = b.dataset.act; S.bstep = a === 'first' ? 0 : (a === 'last' ? max : (a === 'prev' ? Math.max(0, S.bstep - 1) : Math.min(max, S.bstep + 1))); draw();
    }; });
    root.querySelectorAll('[data-act=copy]').forEach(function(b){ b.onclick = function(){
      var it = findItem(S.open); if(!it) return; var txt = lineText(it.m);
      try{ navigator.clipboard.writeText(txt).then(function(){ b.textContent = 'Copied!'; }, function(){ window.prompt('Copy the moves:', txt); }); }catch(e){ window.prompt('Copy the moves:', txt); }
    }; });
  }

  window.PawniacOpenings = {
    mount: function(el){ root = el; start(); },
    _test: {DB:DB, Q:Q, profileOf:profileOf, rank:rank, fensFor:fensFor, groupGames:groupGames}
  };
})();
