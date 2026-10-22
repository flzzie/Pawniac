(function(){
  // [name, moves, tier]  tier 1 = very common ... 5 = obscure
  var RAW = [["King's Pawn Opening","e4",1],
    ["Queen's Pawn Opening","d4",1],
    ["English Opening","c4",1],
    ["Zukertort Opening","Nf3",1],
    ["Sicilian Defence","e4 c5",1],
    ["French Defence","e4 e6",1],
    ["Caro-Kann Defence","e4 c6",1],
    ["Scandinavian Defence","e4 d5",1],
    ["Italian Game","e4 e5 Nf3 Nc6 Bc4",1],
    ["Ruy Lopez","e4 e5 Nf3 Nc6 Bb5",1],
    ["Scotch Game","e4 e5 Nf3 Nc6 d4 exd4 Nxd4",1],
    ["Petrov's Defence","e4 e5 Nf3 Nf6",1],
    ["Vienna Game","e4 e5 Nc3",1],
    ["King's Gambit","e4 e5 f4",1],
    ["Four Knights Game","e4 e5 Nf3 Nc6 Nc3 Nf6",1],
    ["Giuoco Piano","e4 e5 Nf3 Nc6 Bc4 Bc5",1],
    ["Philidor Defence","e4 e5 Nf3 d6",1],
    ["Alekhine's Defence","e4 Nf6",1],
    ["Pirc Defence","e4 d6 d4 Nf6 Nc3 g6",1],
    ["Queen's Gambit","d4 d5 c4",1],
    ["Queen's Gambit Declined","d4 d5 c4 e6",1],
    ["Queen's Gambit Accepted","d4 d5 c4 dxc4",1],
    ["Slav Defence","d4 d5 c4 c6",1],
    ["King's Indian Defence","d4 Nf6 c4 g6",1],
    ["Nimzo-Indian Defence","d4 Nf6 c4 e6 Nc3 Bb4",1],
    ["Grünfeld Defence","d4 Nf6 c4 g6 Nc3 d5",1],
    ["London System","d4 d5 Bf4",1],
    ["Dutch Defence","d4 f5",1],
    ["Catalan Opening","d4 Nf6 c4 e6 g3",1],
    ["Réti Opening","Nf3 d5 c4",1],
    ["Bird's Opening","f4",1],
    ["Indian Defence","d4 Nf6",1],
    ["Two Knights Defence","e4 e5 Nf3 Nc6 Bc4 Nf6",2],
    ["Evans Gambit","e4 e5 Nf3 Nc6 Bc4 Bc5 b4",2],
    ["Fried Liver Attack","e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nxd5 Nxf7",2],
    ["Ruy Lopez: Berlin Defence","e4 e5 Nf3 Nc6 Bb5 Nf6",2],
    ["Ruy Lopez: Morphy Defence","e4 e5 Nf3 Nc6 Bb5 a6",2],
    ["Ruy Lopez: Exchange Variation","e4 e5 Nf3 Nc6 Bb5 a6 Bxc6",2],
    ["Ruy Lopez: Closed Variation","e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7",2],
    ["Scotch Gambit","e4 e5 Nf3 Nc6 d4 exd4 Bc4",2],
    ["Center Game","e4 e5 d4 exd4 Qxd4",2],
    ["Danish Gambit","e4 e5 d4 exd4 c3",2],
    ["Bishop's Opening","e4 e5 Bc4",2],
    ["Ponziani Opening","e4 e5 Nf3 Nc6 c3",2],
    ["King's Gambit Accepted","e4 e5 f4 exf4",2],
    ["King's Gambit Declined","e4 e5 f4 Bc5",2],
    ["Falkbeer Countergambit","e4 e5 f4 d5",2],
    ["Sicilian Defence: Najdorf Variation","e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6",2],
    ["Sicilian Defence: Dragon Variation","e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6",2],
    ["Sicilian Defence: Sveshnikov Variation","e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5",2],
    ["Sicilian Defence: Taimanov Variation","e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nc6",2],
    ["Sicilian Defence: Kan Variation","e4 c5 Nf3 e6 d4 cxd4 Nxd4 a6",2],
    ["Sicilian Defence: Alapin Variation","e4 c5 c3",2],
    ["Sicilian Defence: Closed Variation","e4 c5 Nc3",2],
    ["Smith-Morra Gambit","e4 c5 d4 cxd4 c3",2],
    ["Sicilian Defence: Rossolimo Variation","e4 c5 Nf3 Nc6 Bb5",2],
    ["French Defence: Advance Variation","e4 e6 d4 d5 e5",2],
    ["French Defence: Winawer Variation","e4 e6 d4 d5 Nc3 Bb4",2],
    ["French Defence: Tarrasch Variation","e4 e6 d4 d5 Nd2",2],
    ["French Defence: Exchange Variation","e4 e6 d4 d5 exd5",2],
    ["Caro-Kann Defence: Advance Variation","e4 c6 d4 d5 e5",2],
    ["Caro-Kann Defence: Classical Variation","e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5",2],
    ["Caro-Kann Defence: Exchange Variation","e4 c6 d4 d5 exd5 cxd5",2],
    ["Caro-Kann Defence: Panov Attack","e4 c6 d4 d5 exd5 cxd5 c4",2],
    ["Scandinavian Defence: Main Line","e4 d5 exd5 Qxd5 Nc3 Qa5",2],
    ["Scandinavian Defence: Modern Variation","e4 d5 exd5 Nf6",2],
    ["Modern Defence","e4 g6",2],
    ["Queen's Indian Defence","d4 Nf6 c4 e6 Nf3 b6",2],
    ["Benoni Defence","d4 Nf6 c4 c5 d5 e6",2],
    ["King's Indian Defence: Classical Variation","d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2",2],
    ["Trompowsky Attack","d4 Nf6 Bg5",2],
    ["Torre Attack","d4 Nf6 Nf3 e6 Bg5",2],
    ["Colle System","d4 d5 Nf3 Nf6 e3 e6 Bd3",2],
    ["Englund Gambit","d4 e5",2],
    ["English Opening: Symmetrical Variation","c4 c5",2],
    ["English Opening: Reversed Sicilian","c4 e5",2],
    ["Semi-Slav Defence","d4 d5 c4 c6 Nf3 Nf6 Nc3 e6",2],
    ["Grob Opening","g4",2],
    ["Polish Opening","b4",2],
    ["Larsen's Opening","b3",2],
    ["King's Fianchetto Opening","g3",2],
    ["Ruy Lopez: Open Variation","e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Nxe4",3],
    ["Ruy Lopez: Schliemann Defence","e4 e5 Nf3 Nc6 Bb5 f5",3],
    ["Ruy Lopez: Steinitz Defence","e4 e5 Nf3 Nc6 Bb5 d6",3],
    ["Ruy Lopez: Classical Defence","e4 e5 Nf3 Nc6 Bb5 Bc5",3],
    ["Giuoco Pianissimo","e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3",3],
    ["Italian Game: Hungarian Defence","e4 e5 Nf3 Nc6 Bc4 Be7",3],
    ["Scotch Game: Classical Variation","e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Bc5",3],
    ["Scotch Game: Schmidt Variation","e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6",3],
    ["Göring Gambit","e4 e5 Nf3 Nc6 d4 exd4 c3",3],
    ["Petrov's Defence: Classical Attack","e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5",3],
    ["Four Knights Game: Italian Variation","e4 e5 Nf3 Nc6 Nc3 Nf6 Bc4",3],
    ["Four Knights Game: Spanish Variation","e4 e5 Nf3 Nc6 Nc3 Nf6 Bb5",3],
    ["Four Knights Game: Scotch Variation","e4 e5 Nf3 Nc6 Nc3 Nf6 d4",3],
    ["Three Knights Game","e4 e5 Nf3 Nc6 Nc3",3],
    ["Vienna Gambit","e4 e5 Nc3 Nf6 f4",3],
    ["King's Gambit: Bishop's Gambit","e4 e5 f4 exf4 Bc4",3],
    ["Latvian Gambit","e4 e5 Nf3 f5",3],
    ["Elephant Gambit","e4 e5 Nf3 d5",3],
    ["Sicilian Defence: Moscow Variation","e4 c5 Nf3 d6 Bb5",3],
    ["Sicilian Defence: Scheveningen Variation","e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 e6",3],
    ["Sicilian Defence: Classical Variation","e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 Nc6",3],
    ["Sicilian Defence: Accelerated Dragon","e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 g6",3],
    ["Sicilian Defence: Grand Prix Attack","e4 c5 Nc3 Nc6 f4",3],
    ["French Defence: Classical Variation","e4 e6 d4 d5 Nc3 Nf6",3],
    ["French Defence: Rubinstein Variation","e4 e6 d4 d5 Nc3 dxe4",3],
    ["French Defence: Steinitz Variation","e4 e6 d4 d5 Nc3 Nf6 e5 Nfd7",3],
    ["Caro-Kann Defence: Two Knights Attack","e4 c6 Nc3 d5 Nf3",3],
    ["Caro-Kann Defence: Karpov Variation","e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nd7",3],
    ["Caro-Kann Defence: Fantasy Variation","e4 c6 d4 d5 f3",3],
    ["Pirc Defence: Austrian Attack","e4 d6 d4 Nf6 Nc3 g6 f4",3],
    ["Owen's Defence","e4 b6",3],
    ["Nimzowitsch Defence","e4 Nc6",3],
    ["Alekhine's Defence: Modern Variation","e4 Nf6 e5 Nd5 d4 d6 Nf3",3],
    ["Queen's Gambit Declined: Orthodox Defence","d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3",3],
    ["Queen's Gambit Declined: Exchange Variation","d4 d5 c4 e6 cxd5",3],
    ["Queen's Gambit Declined: Tarrasch Defence","d4 d5 c4 e6 Nc3 c5",3],
    ["Slav Defence: Exchange Variation","d4 d5 c4 c6 cxd5 cxd5",3],
    ["Albin Countergambit","d4 d5 c4 e5",3],
    ["Catalan Opening: Open Variation","d4 Nf6 c4 e6 g3 d5 Bg2 dxc4",3],
    ["Nimzo-Indian Defence: Rubinstein Variation","d4 Nf6 c4 e6 Nc3 Bb4 e3",3],
    ["Nimzo-Indian Defence: Classical Variation","d4 Nf6 c4 e6 Nc3 Bb4 Qc2",3],
    ["Bogo-Indian Defence","d4 Nf6 c4 e6 Nf3 Bb4",3],
    ["King's Indian Defence: Sämisch Variation","d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 f3",3],
    ["King's Indian Defence: Fianchetto Variation","d4 Nf6 c4 g6 Nf3 Bg7 g3",3],
    ["Grünfeld Defence: Exchange Variation","d4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4",3],
    ["Old Indian Defence","d4 Nf6 c4 d6",3],
    ["Benko Gambit","d4 Nf6 c4 c5 d5 b5",3],
    ["Budapest Gambit","d4 Nf6 c4 e5",3],
    ["Dutch Defence: Leningrad Variation","d4 f5 g3 Nf6 Bg2 g6",3],
    ["Dutch Defence: Stonewall Variation","d4 f5 c4 Nf6 g3 e6 Bg2 d5",3],
    ["Stonewall Attack","d4 d5 e3 Nf6 Bd3 e6 f4",3],
    ["Veresov Attack","d4 d5 Nc3 Nf6 Bg5",3],
    ["Jobava London System","d4 d5 Nc3 Nf6 Bf4",3],
    ["Blackmar-Diemer Gambit","d4 d5 e4 dxe4 Nc3 Nf6 f3",3],
    ["English Opening: Anglo-Indian Defence","c4 Nf6",3],
    ["English Opening: Four Knights Variation","c4 e5 Nc3 Nf6 Nf3 Nc6",3],
    ["King's Indian Attack","Nf3 d5 g3 Nf6 Bg2 e6 O-O",3],
    ["Ruy Lopez: Arkhangelsk Variation","e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O b5 Bb3 Bb7",4],
    ["Ruy Lopez: Bird's Defence","e4 e5 Nf3 Nc6 Bb5 Nd4",4],
    ["Ruy Lopez: Cozio Defence","e4 e5 Nf3 Nc6 Bb5 Nge7",4],
    ["Max Lange Attack","e4 e5 Nf3 Nc6 Bc4 Nf6 d4 exd4 O-O Bc5 e5 d5",4],
    ["Traxler Counterattack","e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 Bc5",4],
    ["Scotch Game: Steinitz Variation","e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Qh4",4],
    ["Petrov's Defence: Cochrane Gambit","e4 e5 Nf3 Nf6 Nxe5 d6 Nxf7",4],
    ["Philidor Defence: Hanham Variation","e4 e5 Nf3 d6 d4 Nd7",4],
    ["Bishop's Opening: Berlin Defence","e4 e5 Bc4 Nf6",4],
    ["King's Gambit: Kieseritzky Gambit","e4 e5 f4 exf4 Nf3 g5 h4 g4 Ne5",4],
    ["Damiano Defence","e4 e5 Nf3 f6",4],
    ["Sicilian Defence: Richter-Rauzer Attack","e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 Nc6 Bg5",4],
    ["Sicilian Defence: Sozin Attack","e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 Nc6 Bc4",4],
    ["Sicilian Defence: Najdorf, English Attack","e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3",4],
    ["Sicilian Defence: Najdorf, 6.Bg5","e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Bg5",4],
    ["Sicilian Defence: Four Knights Variation","e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nf6 Nc3 Nc6",4],
    ["Sicilian Defence: Kalashnikov Variation","e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 e5 Nb5 d6",4],
    ["Sicilian Defence: Löwenthal Variation","e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 e5 Nb5 a6",4],
    ["Sicilian Defence: Hyperaccelerated Dragon","e4 c5 Nf3 g6",4],
    ["French Defence: King's Indian Attack","e4 e6 d3 d5 Nd2",4],
    ["French Defence: Winawer, Advance Variation","e4 e6 d4 d5 Nc3 Bb4 e5",4],
    ["Caro-Kann Defence: Bronstein-Larsen Variation","e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nf6 Nxf6 gxf6",4],
    ["Pirc Defence: Classical Variation","e4 d6 d4 Nf6 Nc3 g6 Nf3",4],
    ["Alekhine's Defence: Four Pawns Attack","e4 Nf6 e5 Nd5 d4 d6 c4 Nb6 f4",4],
    ["Alekhine's Defence: Exchange Variation","e4 Nf6 e5 Nd5 d4 d6 c4 Nb6 exd6",4],
    ["Queen's Gambit Declined: Ragozin Defence","d4 d5 c4 e6 Nc3 Nf6 Nf3 Bb4",4],
    ["Slav Defence: Accepted Variation","d4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4",4],
    ["Chigorin Defence","d4 d5 c4 Nc6",4],
    ["Catalan Opening: Closed Variation","d4 Nf6 c4 e6 g3 d5 Bg2 Be7 Nf3 O-O O-O",4],
    ["Nimzo-Indian Defence: Sämisch Variation","d4 Nf6 c4 e6 Nc3 Bb4 a3 Bxc3 bxc3",4],
    ["Nimzo-Indian Defence: Leningrad Variation","d4 Nf6 c4 e6 Nc3 Bb4 Bg5",4],
    ["Queen's Indian Defence: Fianchetto Variation","d4 Nf6 c4 e6 Nf3 b6 g3",4],
    ["King's Indian Defence: Four Pawns Attack","d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 f4",4],
    ["King's Indian Defence: Averbakh Variation","d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Be2 O-O Bg5",4],
    ["Grünfeld Defence: Russian System","d4 Nf6 c4 g6 Nc3 d5 Nf3 Bg7 Qb3",4],
    ["Grünfeld Defence: Three Knights Variation","d4 Nf6 c4 g6 Nc3 d5 Nf3",4],
    ["Modern Benoni","d4 Nf6 c4 c5 d5 e6 Nc3 exd5 cxd5 d6",4],
    ["Budapest Gambit: Main Line","d4 Nf6 c4 e5 dxe5 Ng4",4],
    ["Dutch Defence: Staunton Gambit","d4 f5 e4",4],
    ["Nimzo-Larsen Attack","b3 e5 Bb2 Nc6 e3",4],
    ["From's Gambit","f4 e5 fxe5 d6 exd6 Bxd6",4],
    ["Réti Opening: Anglo-Slav Variation","Nf3 d5 c4 c6",4],
    ["Van't Kruijs Opening","e3",4],
    ["Dunst Opening","Nc3",4],
    ["Mieses Opening","d3",4],
    ["Anderssen's Opening","a3",4],
    ["St. George Defence","e4 a6",4],
    ["Scandinavian Defence: Icelandic Gambit","e4 d5 exd5 Nf6 c4 e6",4],
    ["Baltic Defence","d4 d5 c4 Bf5",4],
    ["Vienna Game: Frankenstein-Dracula Variation","e4 e5 Nc3 Nf6 Bc4 Nxe4 Qh5 Nd6 Bb3 Nc6 Nb5 g6",5],
    ["Halloween Gambit","e4 e5 Nf3 Nc6 Nc3 Nf6 Nxe5",5],
    ["Bongcloud Attack","e4 e5 Ke2",5],
    ["Sicilian Defence: Najdorf, Opocensky Variation","e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be2",5],
    ["Sicilian Defence: Scheveningen, Keres Attack","e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 e6 g4",5],
    ["Sicilian Defence: Dragon, Classical Variation","e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be2",5],
    ["Sicilian Defence: Chekhover Variation","e4 c5 Nf3 d6 d4 cxd4 Qxd4",5],
    ["Sicilian Defence: O'Kelly Variation","e4 c5 Nf3 a6",5],
    ["Sicilian Defence: Nimzowitsch Variation","e4 c5 Nf3 Nf6",5],
    ["Sicilian Defence: Wing Gambit","e4 c5 b4",5],
    ["French Defence: McCutcheon Variation","e4 e6 d4 d5 Nc3 Nf6 Bg5 Bb4",5],
    ["French Defence: Burn Variation","e4 e6 d4 d5 Nc3 Nf6 Bg5 dxe4",5],
    ["Scandinavian Defence: Portuguese Gambit","e4 d5 exd5 Nf6 d4 Bg4",5],
    ["Queen's Gambit Declined: Cambridge Springs Defence","d4 d5 c4 e6 Nc3 Nf6 Bg5 Nbd7 e3 c6 Nf3 Qa5",5],
    ["Semi-Slav Defence: Moscow Variation","d4 d5 c4 c6 Nf3 Nf6 Nc3 e6 Bg5 h6",5],
    ["Queen's Indian Defence: Petrosian Variation","d4 Nf6 c4 e6 Nf3 b6 a3",5],
    ["Neo-Grünfeld Defence","d4 Nf6 c4 g6 g3 d5",5],
    ["Czech Benoni","d4 Nf6 c4 c5 d5 e5",5],
    ["Fajarowicz Gambit","d4 Nf6 c4 e5 dxe5 Ne4",5],
    ["Dutch Defence: Classical Variation","d4 f5 g3 Nf6 Bg2 e6 Nf3 Be7 O-O O-O c4 d6",5],
    ["Saragossa Opening","c3",5],
    ["Ware Opening","a4",5],
    ["Clemenz Opening","h3",5],
    ["Desprez Opening","h4",5],
    ["Amar Opening","Nh3",5],
    ["Réti Opening: Accepted Variation","Nf3 d5 c4 dxc4",5],
    ["Caro-Kann Defence: Gurgenidze System","e4 c6 d4 d5 Nc3 g6",5],
    ["Pirc Defence: 150 Attack","e4 d6 d4 Nf6 Nc3 g6 Be3",5],
    ["Philidor Defence: Lion Variation","e4 d6 d4 Nf6 Nc3 Nbd7",5],
    ["Giuoco Piano: Main Line","e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4 cxd4 Bb4",5],
    ["Trompowsky Attack: Classical Variation","d4 Nf6 Bg5 Ne4 Bf4",5],
    ["Polish Opening: Birmingham Gambit","b4 c5",5]];
  var TIERS = ['Common','Familiar','Uncommon','Rare','Obscure'];
  var TCOL = ['#1f9d55','#5f9ea0','#d4a800','#e67e22','#d64545'];
  var LIVES = 3, FILES = 'abcdefgh', MODE_KEY = 'pawniac-quiz-mode';

  function strip(s){ return s.replace(/[+#]/g, ''); }
  function esc(s){ return String(s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

  // ---------- prepare the openings (anything that is not a legal line is skipped) ----------
  var OPN = [];
  RAW.forEach(function(r){
    try{
      var c = new Chess(), toks = r[1].split(' '), sans = [], last = null;
      for(var i = 0; i < toks.length; i++){
        var mv = c.move(toks[i]);
        if(!mv) throw new Error('illegal move ' + toks[i]);
        sans.push(mv.san); last = {from:mv.from, to:mv.to};
      }
      OPN.push({name:r[0], t:r[2], sans:sans, key:sans.map(strip), fen:c.fen(), last:last});
    }catch(e){ console.warn('quiz: skipped opening', r[0], e.message); }
  });

  function related(a, b){            // one line is the start of the other
    var n = Math.min(a.key.length, b.key.length);
    for(var i = 0; i < n; i++) if(a.key[i] !== b.key[i]) return false;
    return true;
  }
  function shared(a, b){
    var n = Math.min(a.key.length, b.key.length), i = 0;
    while(i < n && a.key[i] === b.key[i]) i++;
    return i;
  }
  function sample(w){
    var t = 0, i;
    for(i = 0; i < w.length; i++) t += w[i];
    var r = Math.random() * t;
    for(i = 0; i < w.length; i++){ r -= w[i]; if(r <= 0) return i; }
    return w.length - 1;
  }
  function shuffle(a){ for(var i = a.length - 1; i > 0; i--){ var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function lineText(sans){
    return sans.map(function(s, i){ return (i % 2 === 0 ? (i / 2 + 1) + '. ' : '') + s; }).join(' ');
  }

  // ---------- state ----------
  var S = {phase:'idle', mode:'mixed', k:0, lives:LIVES, score:0, correct:0, streak:0, used:{}, q:null, t0:0, timer:null,
           chess:null, sel:null, dests:[], lastMv:null, best:null, bestLoaded:false, newBest:false, rid:0};
  try{ var m0 = localStorage.getItem(MODE_KEY); if(m0 === 'mixed' || m0 === 'name' || m0 === 'play') S.mode = m0; }catch(e){}

  function level(){ return 1 + 4 * Math.min(1, S.k / 45); }              // 1 = common ... 5 = obscure, over ~45 questions
  function baseTime(){ return Math.max(6, 20 - 0.3 * S.k); }              // 20s at the start, 6s from question ~47
  function bestTxt(){ return S.best ? S.best.score + ' points (' + S.best.q + ' correct)' : 'none yet'; }

  function pickOpening(){
    var d = level(), avail = OPN.filter(function(o){ return !S.used[o.name]; });
    if(!avail.length){ S.used = {}; avail = OPN.slice(); }
    var tiers = [1,2,3,4,5].filter(function(t){ return avail.some(function(o){ return o.t === t; }); });
    var w = tiers.map(function(t){ return Math.exp(-Math.pow(t - d, 2) / (2 * 0.7 * 0.7)); });
    var tier = tiers[sample(w)], pool = avail.filter(function(o){ return o.t === tier; });
    return pool[Math.floor(Math.random() * pool.length)];
  }
  function makeChoices(o){
    var d = level(), h = 0.1 + 0.3 * (d - 1) / 4;                         // later on, wrong answers look more like the right one
    var cands = OPN.filter(function(x){ return x !== o && !related(x, o); }), picked = [];
    for(var n = 0; n < 3 && cands.length; n++){
      var w = cands.map(function(x){
        var v = Math.exp(h * 2 * shared(x, o));
        if(Math.abs(x.t - o.t) > 1) v *= 0.3;
        return v;
      });
      var i = sample(w);
      picked.push(cands[i]); cands.splice(i, 1);
    }
    return shuffle(picked.concat([o]));
  }

  // ---------- timer ----------
  function stopTimer(){ if(S.timer){ clearInterval(S.timer); S.timer = null; } }
  function tick(){
    var scr = document.getElementById('screen-quiz');
    if(!scr || scr.style.display !== 'block'){ endActive(); return; }
    if(S.phase !== 'ask' || !S.q){ stopTimer(); return; }
    var left = S.q.T * 1000 - (Date.now() - S.t0);
    if(left <= 0){ S.q.timeout = true; finishQ(false); return; }
    var bar = document.getElementById('qzBarIn'), tx = document.getElementById('qzLeft'), bw = document.getElementById('qzBar');
    if(bar) bar.style.width = (left / (S.q.T * 1000) * 100) + '%';
    if(tx) tx.textContent = (left / 1000).toFixed(1) + 's';
    if(bw) bw.classList.toggle('low', left < 4000);
  }

  // ---------- game flow ----------
  function startRun(){
    S.rid++; S.k = 0; S.lives = LIVES; S.score = 0; S.correct = 0; S.streak = 0; S.used = {}; S.newBest = false;
    nextQ();
  }
  function nextQ(){
    var o = pickOpening();
    S.used[o.name] = 1;
    var type = S.mode === 'mixed' ? (Math.random() < 0.5 ? 'name' : 'play') : S.mode;
    var T = baseTime() + (type === 'play' ? 2.5 * o.sans.length : 0);
    var q = {o:o, type:type, tier:o.t, T:T, ply:0, picked:-1, ok:false, pts:0, timeout:false, wrong:null, choices:null};
    if(type === 'name') q.choices = makeChoices(o);
    else { S.chess = new Chess(); S.sel = null; S.dests = []; S.lastMv = null; }
    S.k++;
    S.q = q; S.phase = 'ask'; S.t0 = Date.now();
    stopTimer(); S.timer = setInterval(tick, 100);
    draw();
  }
  function finishQ(ok){
    if(S.phase !== 'ask') return;
    stopTimer();
    var q = S.q, left = Math.max(0, q.T * 1000 - (Date.now() - S.t0)), pts = 0;
    if(ok){
      pts = Math.round(10 + 15 * left / (q.T * 1000)) + (q.tier - 1) * 3;      // faster and rarer = more points
      S.score += pts; S.correct++; S.streak++;
      playWinSound();
    } else {
      S.lives--; S.streak = 0;
      playLossSound();
    }
    q.ok = ok; q.pts = pts;
    S.phase = 'result';
    draw();
  }
  function answer(i){
    if(S.phase !== 'ask' || !S.q || S.q.type !== 'name') return;
    S.q.picked = i;
    finishQ(S.q.choices[i] === S.q.o);
  }
  function clickSq(sq){
    if(S.phase !== 'ask' || !S.q || S.q.type !== 'play') return;
    var ch = S.chess, p = ch.get(sq);
    if(S.sel && S.dests.indexOf(sq) >= 0){ doMove(S.sel, sq); return; }
    if(p && p.color === ch.turn()){
      S.sel = sq;
      S.dests = ch.moves({square:sq, verbose:true}).map(function(m){ return m.to; });
    } else { S.sel = null; S.dests = []; }
    draw();
  }
  function doMove(from, to){
    var mv = S.chess.move({from:from, to:to, promotion:'q'});
    if(!mv) return;
    var q = S.q, expected = q.o.key[q.ply];
    S.lastMv = {from:mv.from, to:mv.to};
    S.sel = null; S.dests = [];
    if(strip(mv.san) === expected){
      q.ply++;
      playMoveSound();
      if(q.ply >= q.o.key.length) finishQ(true); else draw();
    } else {
      q.wrong = mv.san;
      finishQ(false);
    }
  }
  function nextOrEnd(){ if(S.lives <= 0) endRun(); else nextQ(); }
  function endRun(){
    stopTimer();
    S.phase = 'over';
    draw();
    saveRun().then(function(){ draw(); loadBoard(); });
  }
  // leaving the page in the middle of a run still saves the score
  function endActive(){
    if(S.phase === 'ask' || S.phase === 'result'){
      stopTimer();
      S.phase = 'idle';
      saveRun().then(function(){ loadBoard(); });
    } else stopTimer();
  }

  // ---------- saving + leaderboard ----------
  async function saveRun(){
    if(!ME || S.score < 1) return false;
    var run = {score:S.score, q:S.correct}, rid = S.rid;
    try{
      if(!S.bestLoaded) await loadBoard();
      if(S.best && !(run.score > S.best.score || (run.score === S.best.score && run.q > S.best.q))) return false;
      await db.ref('hb/quizLeaderboard/' + ME.username).set(run);
      S.best = run;
      if(rid === S.rid) S.newBest = true;
      return true;
    }catch(e){ console.error('quiz save failed (did you publish the new Firebase rules?)', e); return false; }
  }
  async function loadBoard(){
    var html;
    try{
      var snap = await db.ref('hb/quizLeaderboard').once('value'), users = snap.exists() ? snap.val() : {};
      var rows = Object.keys(users).map(function(u){ return {u:u, score:users[u].score, q:users[u].q}; })
        .filter(function(x){ return typeof x.score === 'number' && typeof x.q === 'number'; });
      var mine = rows.filter(function(x){ return ME && x.u === ME.username; })[0];
      if(mine) S.best = {score:mine.score, q:mine.q};
      S.bestLoaded = true;
      rows.sort(function(a, b){ return (b.score - a.score) || (b.q - a.q); });
      rows = rows.slice(0, 10);
      html = rows.length ? rows.map(function(x, i){
        return '<div class="seat"><span class="who">#' + (i + 1) + ' <span class="user-link" data-user="' + esc(x.u) + '">' + esc(x.u) + '</span>' + (ME && x.u === ME.username ? ' (you)' : '') +
               '</span><span class="taken">' + x.score + ' pts &middot; ' + x.q + ' correct</span></div>';
      }).join('') : '<p class="desc">No runs yet. Be the first!</p>';
    }catch(e){
      console.error(e);
      html = '<p class="desc">Could not load the leaderboard (publish the new Firebase rules).</p>';
    }
    var box = document.getElementById('qzBoard');
    if(box) box.innerHTML = '<div class="card"><h2>Top opening experts</h2><p class="desc">Highest score in one run, then most correct answers. All quiz modes count.</p>' + html + '</div>';
    if(document.getElementById('qzGame') && (S.phase === 'idle' || S.phase === 'over')) draw();
  }

  // ---------- drawing ----------
  function pimg(p){
    return '<img class="piece-img" src="' + pieceImgUrl(p.color, p.type) + '" alt="" draggable="false" onerror="this.outerHTML=\'<span style=&quot;font-size:1em;line-height:1;&quot;>' + PIECE_UNICODE[p.color][p.type] + '</span>\'">';
  }
  function boardHtml(fen, last, sel, dests, clickable){
    var b = new Chess(fen).board(), h = '<div class="board">';
    for(var r = 0; r < 8; r++) for(var f = 0; f < 8; f++){
      var sq = FILES[f] + (8 - r), p = b[r][f], cls = 'sq ' + (((r + f) % 2 === 0) ? 'light' : 'dark');
      if(last && (sq === last.from || sq === last.to)) cls += ' last';
      if(sel === sq) cls += ' from';
      if(dests && dests.indexOf(sq) >= 0) cls += ' dest' + (p ? ' capture' : '');
      if(clickable) cls += ' qz-cell';
      var co = '';
      if(f === 0) co += '<span class="coord rank">' + (8 - r) + '</span>';
      if(r === 7) co += '<span class="coord file">' + FILES[f] + '</span>';
      h += '<div class="' + cls + '" data-qsq="' + sq + '">' + co + (p ? pimg(p) : '') + '</div>';
    }
    return h + '</div>';
  }
  function modeBtns(){
    return '<div class="qz-modes">' + [['mixed', 'Mixed'], ['name', 'Name the opening'], ['play', 'Play the opening']].map(function(m){
      return '<div class="tcbtn' + (S.mode === m[0] ? ' active' : '') + '" data-qm="' + m[0] + '">' + m[1] + '</div>';
    }).join('') + '</div>';
  }
  function idleCard(){
    var over = S.phase === 'over';
    return '<div class="card"><h2>Opening quiz</h2>' +
      (over ? '<div class="result-banner">Run over<div class="rc">Score ' + S.score + ' &middot; ' + S.correct + ' correct' + (S.newBest ? ' &middot; new personal best!' : '') + '</div></div>' : '') +
      '<p class="desc">Name chess openings from the moves on the board, or play out an opening from its name. You start with the openings everybody knows, then they get rarer while the clock gets shorter. ' + OPN.length + ' openings in total. A wrong answer or running out of time costs a life, and 3 lives ends the run. Faster answers and rarer openings score more.</p>' +
      '<div class="hint" style="margin-bottom:4px;">Question type</div>' + modeBtns() +
      '<div class="status-msg">Your best: ' + esc(bestTxt()) + '</div><button id="qzStart">' + (over ? 'Play again' : 'Start') + '</button></div>';
  }
  function draw(){
    var el = document.getElementById('qzGame');
    if(!el) return;
    if(S.phase === 'idle' || S.phase === 'over'){
      el.innerHTML = idleCard(); wire(el); return;
    }
    var q = S.q, o = q.o, hearts = '';
    for(var i = 0; i < LIVES; i++) hearts += (i < S.lives ? '\u2665 ' : '\u2661 ');
    var asking = S.phase === 'ask';
    var head = '<div class="announce">Question ' + S.k + ' &middot; <span class="qz-chip" style="background:' + TCOL[q.tier - 1] + '">' + TIERS[q.tier - 1] + '</span></div>' +
      '<div class="status-msg">Lives ' + hearts + '&middot; Score ' + S.score + (S.streak >= 2 ? ' &middot; Streak ' + S.streak : '') + '</div>';
    if(asking){
      var left = Math.max(0, q.T * 1000 - (Date.now() - S.t0));
      head += '<div class="qz-bar" id="qzBar"><div id="qzBarIn" style="width:' + (left / (q.T * 1000) * 100) + '%"></div></div><div class="hint"><b id="qzLeft">' + (left / 1000).toFixed(1) + 's</b> left</div>';
    }
    var board, panel = head;
    if(q.type === 'name'){
      board = boardHtml(o.fen, o.last, null, null, false);
      panel += '<div class="hint" style="margin:12px 0 4px;">Which opening is this?</div><div class="qz-line">' + esc(lineText(o.sans)) + '</div>';
      panel += q.choices.map(function(c, i){
        var cls = 'secondary qz-opt', dis = '';
        if(!asking){
          dis = ' disabled';
          if(c === o) cls += ' qz-ok'; else if(i === q.picked) cls += ' qz-bad';
        }
        return '<button class="' + cls + '" data-c="' + i + '"' + dis + '><b>' + (i + 1) + '</b>' + esc(c.name) + '</button>';
      }).join('');
    } else {
      if(asking) board = boardHtml(S.chess.fen(), S.lastMv, S.sel, S.dests, true);
      else board = boardHtml(o.fen, o.last, null, null, false);
      panel += '<div class="hint" style="margin:12px 0 0;">Play this opening on the board. Move for both sides, starting with White:</div><div class="qz-name">' + esc(o.name) + '</div>';
      if(asking) panel += '<div class="hint">Move ' + (q.ply + 1) + ' of ' + o.sans.length + '</div>';
    }
    if(!asking){
      if(q.ok) panel += '<div class="qz-msg ok"><b>Correct!</b> +' + q.pts + ' points.<br>' + esc(o.name) + '<div class="qz-line" style="margin-bottom:0;">' + esc(lineText(o.sans)) + '</div></div>';
      else panel += '<div class="qz-msg bad"><b>' + (q.timeout ? "Time's up." : (q.type === 'play' ? 'Not that move.' : 'Not quite.')) + '</b> ' +
        (q.type === 'play' && q.wrong ? 'You played ' + esc(q.wrong) + '. ' : '') + 'It was ' + esc(o.name) + '.<div class="qz-line" style="margin-bottom:0;">' + esc(lineText(o.sans)) + '</div></div>';
      panel += '<button id="qzNext">' + (S.lives <= 0 ? 'See results' : 'Next question') + '</button>';
    }
    el.innerHTML = '<div class="card"><div class="board-wrap">' + board + '<div class="panel" style="max-width:420px;">' + panel + '</div></div></div>';
    wire(el);
  }
  function wire(el){
    var q = function(id){ return document.getElementById(id); };
    if(q('qzStart')) q('qzStart').onclick = startRun;
    if(q('qzNext')) q('qzNext').onclick = nextOrEnd;
    el.querySelectorAll('[data-qm]').forEach(function(b){
      b.onclick = function(){ S.mode = b.dataset.qm; try{ localStorage.setItem(MODE_KEY, S.mode); }catch(e){} draw(); };
    });
    el.querySelectorAll('[data-c]').forEach(function(b){ b.onclick = function(){ answer(+b.dataset.c); }; });
    if(S.phase === 'ask' && S.q && S.q.type === 'play') el.querySelectorAll('[data-qsq]').forEach(function(c){ c.onclick = function(){ clickSq(c.dataset.qsq); }; });
  }

  // keys 1-4 pick an answer
  document.addEventListener('keydown', function(e){
    var scr = document.getElementById('screen-quiz');
    if(!scr || scr.style.display !== 'block' || S.phase !== 'ask' || !S.q || S.q.type !== 'name') return;
    var t = e.target && e.target.tagName;
    if(t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return;
    if(e.key >= '1' && e.key <= '4'){ answer(+e.key - 1); e.preventDefault(); }
  });

  // ---------- the Quiz page ----------
  window.renderQuiz = function(){
    endActive();
    S.phase = 'idle';
    showScreen('quiz');
    var scr = document.getElementById('screen-quiz');
    if(!scr) return;
    scr.innerHTML = '<div id="qzGame"></div><div id="qzBoard"></div>';
    draw();
    loadBoard();
  };
  var prevShow = window.showScreen;
  window.showScreen = function(n){
    if(n !== 'quiz') endActive();
    return prevShow(n);
  };

  // best score on profiles
  var prevOpen = window.openProfile;
  window.openProfile = async function(name){
    var r = await prevOpen.apply(this, arguments);
    try{
      var scr = document.getElementById('screen-profile'), nm = scr && scr.querySelector('.pf-name');
      if(nm && nm.textContent.indexOf(name) >= 0 && !scr.querySelector('[data-qz]')){
        var v = (await db.ref('hb/quizLeaderboard/' + name).once('value')).val();
        if(scr.querySelector('[data-qz]') || nm.textContent.indexOf(name) < 0) return r;
        var d = document.createElement('div');
        d.className = 'card'; d.dataset.qz = '1';
        d.innerHTML = '<h2>Opening quiz best</h2><p class="desc" style="margin:0;">' + ((v && typeof v.score === 'number') ? v.score + ' points, ' + v.q + ' correct' : 'No runs yet') + '</p>';
        scr.appendChild(d);
      }
    }catch(e){ console.error(e); }
    return r;
  };
})();
