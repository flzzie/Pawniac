// node tools/build_lichess_set.js chess.js lichess_puzzles.js  ->  js/puzzle_lichess.js
// Replays each puzzle's game, checks that the whole solution line is legal and (for mates) ends in checkmate.
const fs = require('fs');
const [chessPath, inFile] = process.argv.slice(2);
const mod = require(require('path').resolve(chessPath));
const Chess = mod.Chess || mod;
const src = fs.readFileSync(inFile, 'utf8');
const data = JSON.parse(src.slice(src.indexOf('=') + 1).trim().replace(/;$/, ''));
const out = []; let bad = 0;
for (const p of data) {
  try {
    const c = new Chess();
    for (const san of p.p.split(/\s+/).filter(Boolean)) if (!c.move(san)) throw new Error('pgn ' + san);
    const f = c.fen(); let ok = true;
    for (const u of p.s) {
      const m = c.move({from: u.slice(0, 2), to: u.slice(2, 4), promotion: u.slice(4, 5) || undefined});
      if (!m) { ok = false; break; }
    }
    if (!ok) throw new Error('solution');
    if (/mateIn/.test(p.t) && !c.in_checkmate()) throw new Error('not mate');
    out.push({i: p.i, f, s: p.s, r: p.r, t: p.t.split(' ').filter(x => !/^(mateIn\d|long|veryLong|short|oneMove)$/.test(x)).join(' '), k: p.k});
  } catch (e) { bad++; }
}
fs.writeFileSync('js/puzzle_lichess.js', '// Real Lichess puzzles (CC0). f = position, s = solution line (you, reply, you, ...), r = rating.\nwindow.PAWNIAC_LICHESS_SET = ' + JSON.stringify(out) + ';\n');
console.log('kept', out.length, 'dropped', bad);
