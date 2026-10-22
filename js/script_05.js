(function(){
  var kt = {path:[], start:0, ms:0, done:false, over:false, timer:null, best:null, msg:''};
  var KN = [[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]];

  function esc(s){
    return String(s).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  function fmt(ms){
    var tenths = Math.floor(ms / 100);
    var m = Math.floor(tenths / 600);
    var s = (tenths % 600) / 10;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
  }
  // a run beats another if it covers more squares, or the same squares faster
  function better(a, b){
    return !b || a.sq > b.sq || (a.sq === b.sq && a.ms < b.ms);
  }
  function fmtBest(b){ return b ? b.sq + '/64 in ' + fmt(b.ms) : 'none yet'; }
  function visited(f, r){
    return kt.path.some(function(p){ return p[0]===f && p[1]===r; });
  }
  function movesFrom(cur){
    return KN.map(function(d){ return [cur[0]+d[0], cur[1]+d[1]]; })
      .filter(function(q){ return q[0]>=0 && q[0]<8 && q[1]>=0 && q[1]<8 && !visited(q[0], q[1]); });
  }

  // ---- timer ----
  function stopTimer(){ if(kt.timer){ clearInterval(kt.timer); kt.timer = null; } }
  function startTimer(){ kt.start = Date.now(); kt.timer = setInterval(tick, 100); }
  function tick(){
    var e = document.getElementById('ktTimer');
    if(!e || document.getElementById('screen-minigames').style.display !== 'block'){ stopTimer(); return; }
    e.textContent = fmt(Date.now() - kt.start);
  }
  function resetRun(){
    stopTimer();
    kt.path = []; kt.start = 0; kt.ms = 0; kt.done = false; kt.over = false; kt.msg = '';
  }

  // ---- page ----
  window.renderMinigames = function(){
    showScreen('minigames');
    resetRun();
    document.getElementById('screen-minigames').innerHTML = '<div id="ktGame"></div><div id="ktBoard"></div>';
    draw();
    loadBoard();
  };

  function draw(){
    var el = document.getElementById('ktGame');
    if(!el) return;
    var p = kt.path;
    var cur = p[p.length-1];
    var ended = kt.done || kt.over;
    var legal = (cur && !ended) ? movesFrom(cur) : [];

    var b = '<div class="board">';
    for(var r=7; r>=0; r--){
      for(var f=0; f<8; f++){
        var idx = p.findIndex(function(q){ return q[0]===f && q[1]===r; });
        var isCur = !!cur && cur[0]===f && cur[1]===r;
        var cls = 'sq ' + (((f+r)%2===1) ? 'light' : 'dark');
        if(isCur) cls += ' from';
        else if(idx >= 0) cls += ' last visited-n';
        if(legal.some(function(q){ return q[0]===f && q[1]===r; })) cls += ' dest';
        var inner = isCur ? '<span class="kt-knight">&#9822;&#xFE0E;</span>' : (idx >= 0 ? (idx+1) : '');
        b += '<div class="' + cls + '" data-f="' + f + '" data-r="' + r + '">' + inner + '</div>';
      }
    }
    b += '</div>';

    var msg = kt.done ? (kt.msg || 'All 64 squares visited!')
      : kt.over ? 'No moves left! ' + (kt.msg || 'Restart to try again.')
      : !p.length ? 'Click any square to place your knight. The timer starts on your first move.'
      : 'Visit as many squares as you can, each only once, using knight moves.';

    el.innerHTML =
      '<div class="card">' +
        '<h2>Knight\'s tour</h2>' +
        '<p class="desc">Cover as many squares as you can before you run out of moves. More squares wins; ties go to the faster time. No undo!</p>' +
        '<div class="board-wrap">' + b +
          '<div class="panel">' +
            '<div class="kt-time" id="ktTimer">' + (ended ? fmt(kt.ms) : '0:00.0') + '</div>' +
            '<div class="announce ' + (kt.done ? '' : 'empty') + '">' + p.length + '/64 squares</div>' +
            '<div class="status-msg">' + msg + '<br>Your best: ' + fmtBest(kt.best) + '</div>' +
            '<div class="game-actions" style="border-top:none;margin-top:0;padding-top:0;">' +
              '<button class="secondary" id="ktReset"' + (p.length ? '' : ' disabled') + '>Restart</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    el.querySelectorAll('[data-f]').forEach(function(c){
      c.onclick = function(){ click(+c.dataset.f, +c.dataset.r); };
    });
    document.getElementById('ktReset').onclick = function(){ resetRun(); draw(); };
  }

  function click(f, r){
    if(kt.done || kt.over) return;
    var cur = kt.path[kt.path.length-1];
    if(cur && !movesFrom(cur).some(function(q){ return q[0]===f && q[1]===r; })) return;
    if(!kt.path.length) startTimer();
    kt.path.push([f, r]);

    if(kt.path.length === 64){
      kt.ms = Date.now() - kt.start;
      stopTimer();
      kt.done = true;
      playWinSound();
      saveRun();
    } else if(!movesFrom([f, r]).length){
      // no squares left to jump to: the run is over, stop the clock
      kt.ms = Date.now() - kt.start;
      stopTimer();
      kt.over = true;
      playLossSound();
      saveRun();
    } else {
      playMoveSound();
    }
    draw();
  }

  // ---- saving + leaderboard ----
  async function saveRun(){
    var run = {sq: kt.path.length, ms: kt.ms};
    if(!better(run, kt.best)){
      kt.msg = 'Run: ' + run.sq + '/64 in ' + fmt(run.ms) + '. Your best is still ' + fmtBest(kt.best) + '.';
      draw();
      return;
    }
    try{
      await db.ref('hb/ktLeaderboard/' + ME.username).set(run);
      kt.best = run;
      kt.msg = 'New personal best: ' + run.sq + '/64 in ' + fmt(run.ms) + '!';
    }catch(e){
      console.error(e);
      kt.msg = "Run: " + run.sq + "/64, but it couldn't be saved (check the Firebase rule).";
    }
    draw();
    loadBoard();
  }

  async function loadBoard(){
    var box = document.getElementById('ktBoard');
    if(!box) return;
    box.innerHTML = '<div class="card"><h2>Top knights</h2><p class="desc">Loading...</p></div>';
    var html;
    try{
      var snap = await db.ref('hb/ktLeaderboard').once('value');
      var users = snap.exists() ? snap.val() : {};
      var rows = Object.keys(users)
        .map(function(u){ return {u:u, sq:users[u].sq, ms:users[u].ms}; })
        .filter(function(x){ return typeof x.sq === 'number' && typeof x.ms === 'number'; });
      var mine = rows.find(function(x){ return x.u === ME.username; });
      if(mine) kt.best = {sq:mine.sq, ms:mine.ms};
      rows.sort(function(a,b){ return (b.sq - a.sq) || (a.ms - b.ms); });
      rows = rows.slice(0, 10);
      html = rows.length
        ? rows.map(function(x, i){
            return '<div class="seat"><span class="who">#' + (i+1) + ' ' + esc(x.u) + (x.u===ME.username ? ' (you)' : '') +
                   '</span><span class="taken">' + x.sq + '/64 &middot; ' + fmt(x.ms) + '</span></div>';
          }).join('')
        : '<p class="desc">No runs yet. Be the first!</p>';
    }catch(e){
      console.error(e);
      html = '<p class="desc">Could not load the leaderboard right now.</p>';
    }
    box = document.getElementById('ktBoard');
    if(box) box.innerHTML = '<div class="card"><h2>Top knights</h2><p class="desc">Most squares covered, then fastest time.</p>' + html + '</div>';
    if(document.getElementById('ktGame')) draw();
  }
})();
