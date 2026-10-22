(function(){
  var LINES = [
  // ---- first moves ----
  "King's Pawn Opening|e4","Queen's Pawn Opening|d4","English Opening|c4","Zukertort Opening|Nf3","Bird's Opening|f4","Larsen's Opening|b3",
  "King's Fianchetto Opening|g3","Open Game|e4 e5","Sicilian Defence|e4 c5","French Defence|e4 e6","Caro-Kann Defence|e4 c6",
  "Scandinavian Defence|e4 d5","Closed Game|d4 d5","Indian Defence|d4 Nf6",
  // ---- open games ----
  "King's Knight Opening|e4 e5 Nf3 Nc6","Italian Game|e4 e5 Nf3 Nc6 Bc4","Giuoco Piano|e4 e5 Nf3 Nc6 Bc4 Bc5",
  "Giuoco Pianissimo|e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O",
  "Giuoco Piano: Moeller attack|e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4 cxd4 Bb4+ Nc3 Nxe4 O-O Bxc3 d5 Bf6 Re1 Ne7 Rxe4 d6",
  "Evans Gambit|e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Ba5 d4 exd4 O-O","Two Knights Defence|e4 e5 Nf3 Nc6 Bc4 Nf6",
  "Two Knights: 4.d3|e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Be7 O-O O-O",
  "Two Knights: Knight Attack|e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Na5 Bb5+ c6 dxc6 bxc6 Be2 h6 Nf3 e4 Ne5 Bd6",
  "Fried Liver Attack|e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nxd5 Nxf7 Kxf7 Qf3+ Ke6 Nc3 Nb4",
  "Max Lange Attack|e4 e5 Nf3 Nc6 Bc4 Nf6 d4 exd4 O-O Nxe4 Re1 d5 Bxd5 Qxd5 Nc3 Qa5",
  "Hungarian Defence|e4 e5 Nf3 Nc6 Bc4 Be7 d4 exd4 Nxd4 Nf6 Nc3 O-O",
  "Ruy Lopez|e4 e5 Nf3 Nc6 Bb5","Ruy Lopez: Morphy Defence|e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6",
  "Ruy Lopez: Closed, Breyer|e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3 Nb8 d4 Nbd7",
  "Ruy Lopez: Marshall Attack|e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 O-O c3 d5 exd5 Nxd5 Nxe5 Nxe5 Rxe5 c6 d4 Bd6 Re1 Qh4 g3 Qh3 Be3 Bg4 Qd3 Rae8",
  "Ruy Lopez: Open Variation|e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Nxe4 d4 b5 Bb3 d5 dxe5 Be6 c3 Be7 Nbd2 O-O Qe2 Nc5 Bc2 Bf5",
  "Ruy Lopez: Berlin Defence|e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6 Bxc6 dxc6 dxe5 Nf5 Qxd8+ Kxd8 Nc3 Ke8 h3 h5",
  "Ruy Lopez: Exchange Variation|e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 O-O f6 d4 exd4 Nxd4 c5 Nb3 Qxd1 Rxd1 Bg4 f3 Bd7",
  "Ruy Lopez: Arkhangelsk Variation|e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O b5 Bb3 Bb7 Re1 Bc5 c3 d6 d4 Bb6",
  "Ruy Lopez: Schliemann Defence|e4 e5 Nf3 Nc6 Bb5 f5 Nc3 fxe4 Nxe4 d5 Nxe5 dxe4 Nxc6 Qg5",
  "Ruy Lopez: Steinitz Defence|e4 e5 Nf3 Nc6 Bb5 d6 d4 Bd7 Nc3 Nf6 O-O Be7 Re1 exd4 Nxd4 O-O",
  "Ruy Lopez: Classical Defence|e4 e5 Nf3 Nc6 Bb5 Bc5 c3 Nf6 O-O O-O d4 Bb6",
  "Ruy Lopez: Bird's Defence|e4 e5 Nf3 Nc6 Bb5 Nd4 Nxd4 exd4 O-O c6 Bc4 Nf6 d3 d5 exd5 cxd5 Bb3",
  "Scotch Game|e4 e5 Nf3 Nc6 d4 exd4 Nxd4","Scotch Game: Classical Variation|e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Bc5 Be3 Qf6 c3 Nge7 Bc4 O-O O-O Bb6",
  "Scotch Game: Schmidt Variation|e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6 e5 Qe7 Qe2 Nd5 c4 Ba6",
  "Scotch Game: Steinitz Variation|e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Qh4 Nb5","Scotch Gambit|e4 e5 Nf3 Nc6 d4 exd4 Bc4 Nf6 e5 d5 Bb5 Ne4 Nxd4 Bd7",
  "Four Knights Game|e4 e5 Nf3 Nc6 Nc3 Nf6","Four Knights: Spanish Variation|e4 e5 Nf3 Nc6 Nc3 Nf6 Bb5 Bb4 O-O O-O d3 d6 Bg5 Bxc3 bxc3 Qe7 Re1 Nd8 d4 Ne6",
  "Four Knights: Scotch Variation|e4 e5 Nf3 Nc6 Nc3 Nf6 d4 exd4 Nxd4 Bb4 Nxc6 bxc6 Bd3 d5 exd5 cxd5 O-O O-O Bg5 c6",
  "Four Knights: Italian Variation|e4 e5 Nf3 Nc6 Nc3 Nf6 Bc4 Bb4 O-O O-O d3 d6 Bg5 Bxc3 bxc3 Qe7",
  "Three Knights Game|e4 e5 Nf3 Nc6 Nc3 g6 d4 exd4 Nxd4 Bg7 Be3 Nf6 Bc4 O-O",
  "Petrov's Defence|e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5 Bd3 Nc6 O-O Be7 c4 Nb4 Be2 O-O Nc3 Bf5",
  "Petrov's Defence: 3.d4|e4 e5 Nf3 Nf6 d4 Nxe4 Bd3 d5 Nxe5 Nd7 Nxd7 Bxd7","Petrov's Defence: Cochrane Gambit|e4 e5 Nf3 Nf6 Nxe5 d6 Nxf7 Kxf7 d4",
  "Philidor Defence|e4 e5 Nf3 d6 d4 Nf6 Nc3 Nbd7 Bc4 Be7 O-O O-O Re1 c6 a4","Philidor: Exchange|e4 e5 Nf3 d6 d4 exd4 Nxd4 Nf6 Nc3 Be7 Be2 O-O O-O",
  "Latvian Gambit|e4 e5 Nf3 f5 Nxe5 Qf6 d4 d6 Nc4 fxe4 Nc3 Qg6","Elephant Gambit|e4 e5 Nf3 d5 Nxe5 dxe4 Nc3 Nf6",
  "Damiano Defence|e4 e5 Nf3 f6 Nxe5 fxe5 Qh5+ Ke7 Qxe5+ Kf7 Bc4+ d5 Bxd5+ Kg6",
  "Ponziani Opening|e4 e5 Nf3 Nc6 c3 Nf6 d4 Nxe4 d5 Ne7 Nxe5 Ng6","Ponziani: 3...d5|e4 e5 Nf3 Nc6 c3 d5 Qa4 f6",
  "Vienna Game|e4 e5 Nc3 Nf6 Bc4 Nxe4 Qh5 Nd6 Bb3 Be7 Nf3 Nc6 Nxe5 O-O","Vienna: Frankenstein-Dracula|e4 e5 Nc3 Nf6 Bc4 Nxe4 Qh5 Nd6 Bb3 Nc6 Nb5 g6 Qf3 f5 Qd5 Qe7 Nxc7+ Kd8 Nxa8 b6",
  "Vienna Gambit|e4 e5 Nc3 Nf6 f4 d5 fxe5 Nxe4 Nf3 Be7 d4 O-O Bd3 f5 exf6 Bxf6",
  "King's Gambit Accepted|e4 e5 f4 exf4 Nf3 d6","King's Gambit: Kieseritzky|e4 e5 f4 exf4 Nf3 g5 h4 g4 Ne5 Nf6 Bc4 d5 exd5 Bd6",
  "King's Gambit: Muzio-type|e4 e5 f4 exf4 Nf3 g5 Bc4 g4 O-O gxf3 Qxf3 Qf6 e5 Qxe5 Bxf7+ Kxf7 d4 Qxd4+",
  "King's Gambit: Bishop's Gambit|e4 e5 f4 exf4 Bc4 Nf6 Nc3 c6 Nf3 d5 exd5 cxd5 Bb3",
  "King's Gambit Declined|e4 e5 f4 Bc5 Nf3 d6 c3 Nf6 fxe5 dxe5 Nxe5 Nxe4","Falkbeer Countergambit|e4 e5 f4 d5 exd5 e4 d3 Nf6 dxe4 Nxe4 Nf3 Bc5",
  "Centre Game|e4 e5 d4 exd4 Qxd4 Nc6 Qe3 Nf6 Nc3 Bb4 Bd2 O-O O-O-O Re8","Danish Gambit|e4 e5 d4 exd4 c3 dxc3 Bc4 cxb2 Bxb2 d5 Bxd5 Nf6 Bxf7+ Kxf7 Qxd8 Bb4+",
  "Bishop's Opening|e4 e5 Bc4 Nf6 d3 c6 Nf3 d5 Bb3 Bd6 Nc3",
  // ---- Sicilian ----
  "Sicilian Defence: Open|e4 c5 Nf3","Sicilian: Najdorf|e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6",
  "Najdorf: English Attack|e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3 Be6 f3 Be7 Qd2 O-O O-O-O Nbd7 g4",
  "Najdorf: 6.Bg5|e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Bg5 e6 f4 Be7 Qf3 Qc7 O-O-O Nbd7",
  "Najdorf: Poisoned Pawn|e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Bg5 e6 f4 Qb6 Qd2 Qxb2 Rb1 Qa3",
  "Najdorf: 6.Be2|e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be2 e5 Nb3 Be7 O-O O-O Be3 Be6 f4 Qc7 Kh1 Nbd7",
  "Najdorf: 6.Bc4|e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Bc4 e6 Bb3 Nbd7",
  "Sicilian: Dragon|e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7 f3 O-O Qd2 Nc6 Bc4 Bd7 O-O-O Rc8 Bb3 Ne5 h4 h5",
  "Sicilian: Classical Dragon|e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be2 Bg7 Be3 Nc6 O-O O-O Nb3 a6",
  "Sicilian: Accelerated Dragon|e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 g6 c4 Bg7 Be3 Nf6 Nc3 O-O Be2 d6 O-O Bd7 Qd2 Nxd4 Bxd4 Bc6",
  "Sicilian: Sveshnikov|e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5 Ndb5 d6 Bg5 a6 Na3 b5 Bxf6 gxf6 Nd5 f5",
  "Sicilian: Taimanov|e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nc6 Nc3 Qc7 Be3 a6 Be2 Nf6 O-O Bb4",
  "Sicilian: Kan|e4 c5 Nf3 e6 d4 cxd4 Nxd4 a6 Nc3 Qc7 Bd3 Nf6 O-O Nc6 Nxc6 bxc6 e5 Nd5",
  "Sicilian: Scheveningen|e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 e6 Be2 Be7 O-O O-O f4 Nc6 Be3 Bd7 Kh1 Rc8",
  "Sicilian: Keres Attack|e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 e6 g4",
  "Sicilian: Richter-Rauzer|e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 Nc6 Bg5 e6 Qd2 Be7 O-O-O O-O f4 Nxd4 Qxd4 Qa5",
  "Sicilian: Sozin Attack|e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 Nc6 Bc4 e6 Be3 Be7 Qe2 O-O O-O-O a6 Bb3 Qc7",
  "Sicilian: Four Knights|e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nf6 Nc3 Nc6 Ndb5 Bb4 a3 Bxc3+ Nxc3 d5 exd5 exd5",
  "Sicilian: Alapin|e4 c5 c3 Nf6 e5 Nd5 d4 cxd4 Nf3 Nc6 cxd4 d6 Bc4 Nb6 Bb5 dxe5",
  "Sicilian: Alapin, 2...d5|e4 c5 c3 d5 exd5 Qxd5 d4 Nf6 Nf3 e6 Be2 Nc6 O-O cxd4 cxd4 Be7 Nc3 Qd6",
  "Sicilian: Closed|e4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7 d3 d6 f4 e6 Nf3 Nge7 O-O O-O","Sicilian: Grand Prix Attack|e4 c5 Nc3 Nc6 f4 g6 Nf3 Bg7",
  "Sicilian: Rossolimo|e4 c5 Nf3 Nc6 Bb5 g6 Bxc6 dxc6 d3 Bg7 h3 Nf6 Nc3 Nd7","Sicilian: Rossolimo, 3...e6|e4 c5 Nf3 Nc6 Bb5 e6 O-O Nge7 Re1 a6 Bf1 d5",
  "Sicilian: Moscow Variation|e4 c5 Nf3 d6 Bb5+ Bd7 Bxd7+ Qxd7 c4 Nc6 Nc3 Nf6 O-O g6 d4 cxd4 Nxd4 Bg7",
  "Smith-Morra Gambit|e4 c5 d4 cxd4 c3 dxc3 Nxc3 Nc6 Nf3 d6 Bc4 e6 O-O Nf6 Qe2 Be7 Rd1 e5",
  "Sicilian: Nimzowitsch|e4 c5 Nf3 Nf6 e5 Nd5 Nc3 e6 Nxd5 exd5 d4 Nc6",
  // ---- French / Caro-Kann / Scandinavian / others ----
  "French: main line|e4 e6 d4 d5","French: Advance|e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6 Be2 cxd4 cxd4 Nge7 Nc3 Nf5",
  "French: Winawer|e4 e6 d4 d5 Nc3 Bb4 e5 c5 a3 Bxc3+ bxc3 Ne7 Qg4 Qc7 Qxg7 Rg8 Qxh7 cxd4 Ne2 Nbc6 f4 Bd7",
  "French: Tarrasch|e4 e6 d4 d5 Nd2 Nf6 e5 Nfd7 Bd3 c5 c3 Nc6 Ne2 cxd4 cxd4 f6 exf6 Nxf6 O-O Bd6 Nf3 O-O",
  "French: Tarrasch, 3...c5|e4 e6 d4 d5 Nd2 c5 exd5 exd5 Ngf3 Nc6 Bb5 Bd6","French: Classical|e4 e6 d4 d5 Nc3 Nf6 Bg5 Be7 e5 Nfd7 Bxe7 Qxe7 f4 O-O Nf3 c5",
  "French: Rubinstein|e4 e6 d4 d5 Nc3 dxe4 Nxe4 Nd7 Nf3 Ngf6 Nxf6+ Nxf6","French: Exchange|e4 e6 d4 d5 exd5 exd5 Nf3 Bd6 Bd3 Nf6 O-O O-O",
  "French: King's Indian Attack|e4 e6 d3 d5 Nd2 Nf6 Ngf3 c5 g3 Nc6 Bg2 Be7 O-O O-O Re1",
  "Caro-Kann: main line|e4 c6 d4 d5","Caro-Kann: Advance|e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 c5 Be3 cxd4 Nxd4 Nc6",
  "Caro-Kann: Short Variation|e4 c6 d4 d5 e5 Bf5 h4 h6 g4 Bd7 Ne2 e6","Caro-Kann: Classical|e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7 h5 Bh7 Bd3 Bxd3 Qxd3 e6",
  "Caro-Kann: Karpov Variation|e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nd7 Nf3 Ngf6 Nxf6+ Nxf6","Caro-Kann: Exchange|e4 c6 d4 d5 exd5 cxd5 Bd3 Nc6 c3 Nf6 Bf4 Bg4 Qb3 Qd7 Nd2 e6",
  "Caro-Kann: Panov Attack|e4 c6 d4 d5 exd5 cxd5 c4 Nf6 Nc3 e6 Nf3 Be7 cxd5 Nxd5 Bd3 Nc6 O-O O-O Re1 Bf6",
  "Caro-Kann: Two Knights|e4 c6 Nc3 d5 Nf3 Bg4 h3 Bxf3 Qxf3 e6 d4 Nf6 Bd3 Nbd7 O-O Bd6","Caro-Kann: Fantasy|e4 c6 d4 d5 f3 e6",
  "Scandinavian: main line|e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3 c6 Bc4 Bf5 Bd2 e6 Qe2","Scandinavian: Qd6|e4 d5 exd5 Qxd5 Nc3 Qd6 d4 Nf6 Nf3 a6 g3",
  "Scandinavian: Modern|e4 d5 exd5 Nf6 d4 Nxd5 Nf3 g6 Be2 Bg7 O-O O-O c4 Nb6 Nc3 Nc6","Scandinavian: Icelandic Gambit|e4 d5 exd5 Nf6 c4 e6 dxe6 Bxe6 d4",
  "Pirc Defence|e4 d6 d4 Nf6 Nc3 g6 Nf3 Bg7 Be2 O-O O-O c6 a4 Nbd7","Pirc: Austrian Attack|e4 d6 d4 Nf6 Nc3 g6 f4 Bg7 Nf3 O-O Bd3 Na6 O-O c5",
  "Pirc: 150 Attack|e4 d6 d4 Nf6 Nc3 g6 Be3 Bg7 Qd2 c6 f3 b5 Nge2 Nbd7 Bh6 Bxh6 Qxh6 Bb7",
  "Modern Defence|e4 g6 d4 Bg7 Nc3 d6 Nf3 Nf6 Be2 O-O O-O c6","Alekhine's Defence|e4 Nf6 e5 Nd5 d4 d6 Nf3 Bg4 Be2 e6 O-O Be7",
  "Alekhine: Four Pawns Attack|e4 Nf6 e5 Nd5 d4 d6 c4 Nb6 f4 dxe5 fxe5 Nc6 Be3 Bf5 Nc3 e6 Nf3 Be7",
  "Alekhine: Exchange|e4 Nf6 e5 Nd5 d4 d6 c4 Nb6 exd6 cxd6 Nc3 g6 Be3 Bg7 Rc1 O-O b3 Nc6",
  "Owen's Defence|e4 b6 d4 Bb7 Bd3 Nf6 Qe2 e6 Nf3 c5 c3 Be7 O-O O-O","Nimzowitsch Defence|e4 Nc6 Nf3 e5 d4 exd4 Nxd4 Nf6 Nc3 Bb4 Nxc6 bxc6",
  // ---- queen's pawn ----
  "Queen's Gambit|d4 d5 c4","Queen's Gambit Declined|d4 d5 c4 e6 Nc3 Nf6",
  "QGD: Orthodox Defence|d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 Nbd7 Rc1 c6 Bd3 dxc4 Bxc4 Nd5 Bxe7 Qxe7 O-O Nxc3 Rxc3 e5",
  "QGD: Ragozin Defence|d4 d5 c4 e6 Nc3 Nf6 Nf3 Bb4 Bg5 h6 Bh4 dxc4","QGD: Exchange Variation|d4 d5 c4 e6 Nc3 Nf6 cxd5 exd5 Bg5 Be7 e3 O-O Bd3 Nbd7 Nge2 Re8 O-O Nf8",
  "QGD: Tarrasch Defence|d4 d5 c4 e6 Nc3 c5 cxd5 exd5 Nf3 Nc6 g3 Nf6 Bg2 Be7 O-O O-O Bg5 cxd4 Nxd4 h6",
  "QGD: Cambridge Springs|d4 d5 c4 e6 Nc3 Nf6 Bg5 Nbd7 e3 c6 Nf3 Qa5 Nd2 Bb4 Qc2 O-O Be2 e5",
  "Queen's Gambit Accepted|d4 d5 c4 dxc4 Nf3 Nf6 e3 e6 Bxc4 c5 O-O a6 Qe2 b5 Bb3 Bb7 Rd1 Nbd7 Nc3 Qb6",
  "Slav Defence|d4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5 e3 e6 Bxc4 Bb4 O-O Nbd7 Qe2 Bg6 e4 O-O","Slav: Exchange|d4 d5 c4 c6 cxd5 cxd5 Nc3 Nf6 Nf3 Nc6 Bf4 Bf5 e3 e6",
  "Semi-Slav Defence|d4 d5 c4 c6 Nf3 Nf6 Nc3 e6 e3 Nbd7 Bd3 dxc4 Bxc4 b5 Bd3 a6 e4 c5",
  "Semi-Slav: Moscow Variation|d4 d5 c4 c6 Nf3 Nf6 Nc3 e6 Bg5 h6 Bh4 dxc4 e4 g5 Bg3 b5","Albin Countergambit|d4 d5 c4 e5 dxe5 d4 Nf3 Nc6 g3 Be6 Nbd2 Qd7",
  "Chigorin Defence|d4 d5 c4 Nc6 Nc3 Nf6 Nf3 Bg4 cxd5 Bxf3 gxf3 Nxd5","London System|d4 d5 Bf4 Nf6 e3 e6 Nf3 c5 c3 Nc6 Nbd2 Bd6 Bg3 O-O Bd3 b6",
  "London System: ...e6 set-up|d4 d5 Nf3 Nf6 Bf4 e6 e3 Bd6 Bg3 O-O Nbd2 c5 c3 Nc6 Bd3 Qe7","London vs King's Indian|d4 Nf6 Nf3 g6 Bf4 Bg7 e3 O-O h3 d6",
  "London: 1...Nf6|d4 Nf6 Bf4 d5 e3 c5 c3 Nc6 Nd2 e6 Ngf3 Bd6 Bg3 O-O Bd3",
  "Colle System|d4 d5 Nf3 Nf6 e3 e6 Bd3 c5 b3 Nc6 O-O Bd6 Bb2 O-O Nbd2 b6","Torre Attack|d4 Nf6 Nf3 e6 Bg5 h6 Bh4 d5 e3 Be7 Nbd2 O-O Bd3 b6",
  "Trompowsky Attack|d4 Nf6 Bg5 Ne4 Bf4 d5 e3 c5 c3 Nc6 Nd2 Nxd2 Kxd2 e6","Stonewall Attack|d4 d5 e3 Nf6 Bd3 e6 f4 c5 c3 Nc6 Nd2 Bd6 Ngf3 O-O O-O Qe7",
  "Veresov Attack|d4 d5 Nc3 Nf6 Bg5 Nbd7 f3 c6 e4 dxe4 fxe4 e5","Blackmar-Diemer Gambit|d4 d5 e4 dxe4 Nc3 Nf6 f3 exf3 Nxf3 Bg4 h3 Bxf3 Qxf3 e6",
  "Englund Gambit|d4 e5 dxe5 Nc6 Nf3 Qe7 Bf4 Qb4+ Bd2 Qxb2",
  "Dutch Defence|d4 f5 g3 Nf6 Bg2 e6 Nf3 d5 O-O Bd6 c4 c6 Qc2 Qe7 Nc3 O-O","Dutch: Stonewall|d4 f5 c4 Nf6 g3 e6 Bg2 d5 Nf3 c6 O-O Bd6 b3 Qe7 Bb2 b6",
  "Dutch: Leningrad|d4 f5 g3 Nf6 Bg2 g6 Nf3 Bg7 O-O O-O c4 d6 Nc3 Qe8","Dutch: Classical|d4 f5 g3 Nf6 Bg2 e6 Nf3 Be7 O-O O-O c4 d6 Nc3 Qe8",
  "Dutch: Staunton Gambit|d4 f5 e4 fxe4 Nc3 Nf6 Bg5 e6 Nxe4 Be7 Bxf6 Bxf6 Nf3 O-O",
  // ---- indian defences ----
  "Nimzo-Indian Defence|d4 Nf6 c4 e6 Nc3 Bb4","Nimzo-Indian: Rubinstein|d4 Nf6 c4 e6 Nc3 Bb4 e3 O-O Bd3 d5 Nf3 c5 O-O Nc6 a3 Bxc3 bxc3 dxc4 Bxc4 Qc7",
  "Nimzo-Indian: Classical|d4 Nf6 c4 e6 Nc3 Bb4 Qc2 O-O a3 Bxc3+ Qxc3 b6 Bg5 Bb7 e3 d6 f3 Nbd7","Nimzo-Indian: Saemisch|d4 Nf6 c4 e6 Nc3 Bb4 a3 Bxc3+ bxc3 c5 e3 Nc6 Bd3 O-O Ne2 b6",
  "Nimzo-Indian: Leningrad|d4 Nf6 c4 e6 Nc3 Bb4 Bg5 h6 Bh4 c5 d5 d6","Queen's Indian Defence|d4 Nf6 c4 e6 Nf3 b6 g3 Ba6 b3 Bb4+ Bd2 Be7 Bg2 c6 Bc3 d5",
  "Queen's Indian: 4.g3 Bb7|d4 Nf6 c4 e6 Nf3 b6 g3 Bb7 Bg2 Be7 O-O O-O Nc3 Ne4 Qc2 Nxc3 Qxc3 c5","Bogo-Indian Defence|d4 Nf6 c4 e6 Nf3 Bb4+ Bd2 Qe7 g3 Nc6 Nc3 Bxc3 Bxc3 Ne4",
  "Catalan Opening|d4 Nf6 c4 e6 g3 d5 Bg2 Be7 Nf3 O-O O-O dxc4 Qc2 a6 Qxc4 b5 Qc2 Bb7 Bd2 Nbd7",
  "King's Indian Defence|d4 Nf6 c4 g6 Nc3 Bg7 e4 d6","King's Indian: Classical|d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7 Ne1 Nd7 Be3 f5 f3 f4 Bf2 g5",
  "King's Indian: Saemisch|d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 f3 O-O Be3 e5 d5 Nh5 Qd2 f5 O-O-O Na6",
  "King's Indian: Four Pawns Attack|d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 f4 O-O Nf3 c5 d5 e6 Be2 exd5 cxd5 Bg4",
  "King's Indian: Averbakh|d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Be2 O-O Bg5 c5 d5 e6 Qd2 exd5 exd5 Re8",
  "King's Indian: Fianchetto|d4 Nf6 c4 g6 Nf3 Bg7 g3 O-O Bg2 d6 O-O Nbd7 Nc3 e5 e4 c6 h3 Qb6",
  "Grunfeld Defence|d4 Nf6 c4 g6 Nc3 d5","Grunfeld: Exchange|d4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4 Nxc3 bxc3 Bg7 Nf3 c5 Rb1 O-O Be2 cxd4 cxd4 Qa5+ Bd2 Qxa2 O-O Bg4",
  "Grunfeld: Russian System|d4 Nf6 c4 g6 Nc3 d5 Nf3 Bg7 Qb3 dxc4 Qxc4 O-O e4 Bg4 Be3 Nfd7","Grunfeld: 4.Bf4|d4 Nf6 c4 g6 Nc3 d5 Bf4 Bg7 e3 O-O Rc1 c5 dxc5",
  "Neo-Gruenfeld|d4 Nf6 c4 g6 g3 Bg7 Bg2 d5 cxd5 Nxd5 Nf3 O-O O-O Nb6 Nc3 Nc6",
  "Modern Benoni|d4 Nf6 c4 c5 d5 e6 Nc3 exd5 cxd5 d6 e4 g6 Nf3 Bg7 Be2 O-O O-O Re8","Benko Gambit|d4 Nf6 c4 c5 d5 b5 cxb5 a6 bxa6 Bxa6 Nc3 d6 e4 Bxf1 Kxf1 g6 g3 Bg7",
  "Czech Benoni|d4 Nf6 c4 c5 d5 e5 Nc3 d6 e4 Be7 Nf3 O-O Be2","Budapest Gambit|d4 Nf6 c4 e5 dxe5 Ng4 Bf4 Nc6 Nf3 Bb4+ Nbd2 Qe7",
  "Old Indian Defence|d4 Nf6 c4 d6 Nc3 Nbd7 e4 e5 Nf3 Be7 Be2 c6 O-O O-O",
  // ---- flank openings ----
  "English: Four Knights|c4 e5 Nc3 Nf6 Nf3 Nc6 g3 d5 cxd5 Nxd5 Bg2 Nb6 O-O Be7 d3 O-O","English: Reversed Sicilian|c4 e5 Nc3 Nc6 g3 g6 Bg2 Bg7 e3 d6 Nge2 Be6",
  "English: Symmetrical|c4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7 Nf3 e6 O-O Nge7 d4 cxd4 Nxd4 O-O","English: Anglo-Indian|c4 Nf6 Nc3 e6 Nf3 d5 d4 Be7 Bg5 O-O e3 h6 Bh4 b6",
  "English: Anglo-Indian, g6|c4 Nf6 Nc3 g6 e4 d6 d4 Bg7","Reti Opening|Nf3 d5 c4 e6 g3 Nf6 Bg2 Be7 O-O O-O b3 c5 Bb2 Nc6 e3 b6",
  "Reti: Anglo-Slav|Nf3 d5 c4 c6 b3 Nf6 g3 Bf5 Bb2 e6 Bg2 Nbd7 O-O Be7","King's Indian Attack|Nf3 d5 g3 Nf6 Bg2 e6 O-O Be7 d3 O-O Nbd2 c5 e4 Nc6",
  "Zukertort: King's Indian set-up|Nf3 Nf6 g3 g6 Bg2 Bg7 O-O O-O d3 d6 Nbd2 Nc6 e4 e5 c3 a5","Zukertort: English transposition|Nf3 c5 c4 Nf6 Nc3 e6 g3 b6 Bg2 Bb7 O-O Be7 d4 cxd4 Qxd4 d6",
  "Bird's Opening: Dutch set-up|f4 d5 Nf3 Nf6 e3 g6 Be2 Bg7 O-O O-O d3 c5 Qe1 Nc6","From's Gambit|f4 e5 fxe5 d6 exd6 Bxd6 Nf3 g5 g3 g4 Nh4",
  "Larsen's Opening: main line|b3 e5 Bb2 Nc6 e3 d5 Bb5 Bd6","Polish Opening|b4 e5 Bb2 Bxb4 Bxe5 Nf6 Bxf6 Qxf6 c3 Bd6","Grob Opening|g4 d5 Bg2 Bxg4 c4 c6 cxd5 cxd5 Qb3 Qd7",
  "Dunst Opening|Nc3 d5 e4 d4 Nce2 e5 d3 Nc6 Nf3 Bd6 Ng3 Nf6","Mieses Opening|d3 d5 Nf3 Nf6 g3 g6 Bg2 Bg7 O-O O-O Nbd2 Nc6 e4 e5 c3 a5"
  ];

  var BOOK = {}, NAME = {}, NEXT = {};
  function key(f){ return String(f).split(' ').slice(0, 3).join(' '); }
  LINES.forEach(function(s){
    try{
      var p = s.split('|'), c = new Chess(), t = p[1].split(' ');
      BOOK[key(c.fen())] = 1;
      for(var i = 0; i < t.length; i++){
        var k0 = key(c.fen()), mv = c.move(t[i]);
        if(!mv) break;                                   // a bad move in a line only cuts that line short
        (NEXT[k0] = NEXT[k0] || {})[mv.san.replace(/[+#]/g, '')] = 1;
        var k1 = key(c.fen());
        BOOK[k1] = 1;
        if(i === t.length - 1 && !NAME[k1]) NAME[k1] = p[0];
      }
    }catch(e){}
  });

  function ply(fen){ var p = fen.split(' '); return ((parseInt(p[5], 10) || 1) - 1) * 2 + (p[1] === 'b' ? 1 : 0); }
  function theory(fb){
    var n = NEXT[key(fb)];
    return n ? Object.keys(n).slice(0, 6).join(', ') : '';
  }

  // Judge a move fairly in the opening. cpB / cpA are from the mover's point of view.
  function rate(fb, fa, label, loss, cpB, cpA){
    var ka = key(fa);
    if(BOOK[ka] && loss < 20){
      var nm = NAME[ka], th = theory(fb);
      return {label:'book', loss:0, note:'Opening theory' + (nm ? ': ' + nm : '') + '. A standard move that strong players have used for a long time.' + (th ? ' Book moves in the position before it: ' + th + '.' : '')};
    }
    if(!(label === 'inaccuracy' || label === 'mistake' || label === 'blunder')) return null;
    if(Math.abs(cpB) >= 9000 || Math.abs(cpA) >= 9000) return null;      // forced mates are never softened
    if(ply(fb) < 24){
      // the engine's opening scores are noisy (especially on Fast), so small drops are not errors yet
      var l2 = loss < 14 ? 'good' : (loss < 22 ? 'inaccuracy' : (loss < 32 ? 'mistake' : 'blunder')), th2 = theory(fb);
      return {label:l2, loss:loss, note:'This is outside my opening book' + (th2 ? ', where the usual moves are ' + th2 : '') + '. In the first moves small differences are choices, not errors.'};
    }
    return null;
  }
  // ---------- Lichess opening list (free, ~3,500 openings): downloaded once, saved on this device ----------
  var LSRC = ['https://raw.githubusercontent.com/lichess-org/chess-openings/master/', 'https://cdn.jsdelivr.net/gh/lichess-org/chess-openings@master/'];
  var LKEY = 'pawniac-lichess-openings-v1', LI = null;
  function fetchText(u){ return fetch(u).then(function(r){ if(!r.ok) throw new Error('http ' + r.status); return r.text(); }); }
  function download(){
    var rows = [], got = 0;
    return Promise.all(['a', 'b', 'c', 'd', 'e'].map(function(f){
      return fetchText(LSRC[0] + f + '.tsv').catch(function(){ return fetchText(LSRC[1] + f + '.tsv'); }).then(function(txt){
        var lines = txt.replace(/\r/g, '').split('\n'), h = lines[0].split('\t'), ni = h.indexOf('name'), pi = h.indexOf('pgn');
        if(ni < 0 || pi < 0){ ni = 1; pi = 2; }
        for(var i = 1; i < lines.length; i++){ var c = lines[i].split('\t'); if(c[ni] && c[pi]) rows.push(c[ni] + '\t' + c[pi]); }
        got++;
      }).catch(function(e){ console.warn('opening file failed', f, e); });
    })).then(function(){ return {rows:rows, full:got === 5}; });
  }
  function addRows(rows){
    return new Promise(function(resolve){
      var list = [];
      rows.forEach(function(s){
        var p = s.split('\t');
        var t = (p[1] || '').replace(/\d+\.(\.\.)?/g, ' ').trim().split(/\s+/).filter(Boolean);
        if(t.length) list.push({n:p[0], t:t, k:t.join(' ')});
      });
      list.sort(function(a, b){ return a.k < b.k ? -1 : (a.k > b.k ? 1 : 0); });   // neighbours share their first moves, so far fewer moves are replayed
      var c = new Chess(), ks = [key(c.fen())], prev = [], i = 0;
      function step(){
        try{
          var end = Math.min(list.length, i + 120);
          for(; i < end; i++){
            var L = list[i], t = L.t, cp = 0;
            while(cp < prev.length && cp < t.length && prev[cp] === t[cp]) cp++;
            while(prev.length > cp){ c.undo(); prev.pop(); ks.pop(); }
            var ok = true;
            for(var j = cp; j < t.length; j++){
              var mv = c.move(t[j]);
              if(!mv){ ok = false; break; }
              var k0 = ks[ks.length - 1];
              (NEXT[k0] = NEXT[k0] || {})[mv.san.replace(/[+#]/g, '')] = 1;
              var k1 = key(c.fen());
              ks.push(k1); prev.push(t[j]);
              BOOK[k1] = 1;
            }
            if(ok){ var kf = ks[ks.length - 1]; if(!NAME[kf]) NAME[kf] = L.n; }
          }
        }catch(e){ console.error('opening list failed', e); resolve(); return; }
        if(i < list.length) setTimeout(step, 0); else resolve();
      }
      step();
    });
  }
  function ensureLichess(){
    if(LI) return LI;
    LI = (async function(){
      var rows = null;
      try{ var c = JSON.parse(localStorage.getItem(LKEY) || 'null'); if(c && c.rows && c.rows.length > 1000 && Date.now() - c.t < 30 * 86400000) rows = c.rows; }catch(e){}
      if(!rows){
        var d = await download();
        rows = d.rows;
        if(d.full && rows.length > 1000){ try{ localStorage.setItem(LKEY, JSON.stringify({t:Date.now(), rows:rows})); }catch(e){} }
      }
      if(!rows || rows.length < 50) return false;
      await addRows(rows);
      return true;
    })().catch(function(e){ console.error('lichess openings failed', e); return false; }).then(function(ok){ if(!ok) LI = null; return ok; });
    return LI;
  }
  var _ps44 = window.showScreen;
  window.showScreen = function(n){ if(n === 'analyze') ensureLichess(); return _ps44.apply(this, arguments); };
  window.__pawBook = {rate:rate, inBook:function(f){ return !!BOOK[key(f)]; }, name:function(f){ return NAME[key(f)] || null; }};

  // ---------- plug into the Analyze report (step 16 calls window.__anPlus) ----------
  function fullNo(fen){ return parseInt(String(fen).split(' ')[5], 10) || 1; }
  window.__anPlus = {
    get ready(){ ensureLichess(); return Promise.race([LI, new Promise(function(r){ setTimeout(r, 8000); })]); },
    adjust: function(A, i, label, loss){
      if(A.hdr && (A.hdr.FEN || A.hdr.SetUp === '1')) return null;
      var sg = A.moves[i].color === 'w' ? 1 : -1;
      var r = rate(A.fens[i], A.fens[i + 1], label, loss, sg * A.ev[i].cp, sg * A.ev[i + 1].cp);
      return r ? {label:r.label, loss:r.loss} : null;
    },
    openingCard: function(A){
      if(A.hdr && (A.hdr.FEN || A.hdr.SetUp === '1')) return null;
      var last = -1, name = null;
      for(var i = 0; i < A.moves.length; i++){
        var k = key(A.fens[i + 1]);
        if(!BOOK[k]) break;
        last = i;
        if(NAME[k]) name = NAME[k];
      }
      if(last < 0) return null;
      var lines = [name ? 'Opening: ' + name + '.' : 'The game started with known opening theory.'];
      var n = Math.ceil((last + 1) / 2);
      lines.push('Both sides followed my opening book for ' + n + (n === 1 ? ' move.' : ' moves.'));
      if(last + 1 < A.moves.length){
        var mv = A.moves[last + 1], S = A.stats[last + 1], mine = mv.color === A.me, mn = fullNo(A.fens[last + 1]);
        var bad = (S.label === 'inaccuracy' || S.label === 'mistake' || S.label === 'blunder');
        var th = theory(A.fens[last + 1]);
        lines.push((mine ? 'You' : 'Your opponent') + ' left the book on move ' + mn + ' with ' + mv.san + '. ' +
          (bad ? 'The engine rates it as ' + (S.label === 'inaccuracy' ? 'an inaccuracy' : 'a ' + S.label) + (mine ? ', so this is a good place to review.' : ', so you could have punished it.')
               : 'The engine is fine with it, so this is just a different choice.') + (th ? ' Book moves there: ' + th + '.' : ''));
      } else lines.push('The game stayed inside my opening book to the very end.');
      return {name:name, lines:lines, note:'My book covers the main lines of the common openings. Leaving it is not automatically a mistake.'};
    },
    bookWhy: function(A, i){
      var m = A.moves[i], nm = NAME[key(A.fens[i + 1])];
      var out = ['Opening theory' + (nm ? ' (' + nm + ')' : '') + ': a standard move here, played by strong players for a long time.'];
      var fl = m.flags || '';
      if(fl.indexOf('k') >= 0 || fl.indexOf('q') >= 0) out.push('It gets the king safe and brings a rook toward the centre.');
      else if(m.piece === 'p' && ['d4','e4','d5','e5','c4','c5'].indexOf(m.to) >= 0) out.push('It fights for the centre.');
      else if((m.piece === 'n' || m.piece === 'b') && m.from.charAt(1) === (m.color === 'w' ? '1' : '8')) out.push('It develops a piece.');
      return out;
    },
    whyList: function(){ return null; },
    whyText: function(){ return null; }
  };
})();
