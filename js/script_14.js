(function(){
  var QUOTES = [
    ['When you see a good move, look for a better one.', 'Emanuel Lasker'],
    ['Chess is life in miniature.', 'Garry Kasparov'],
    ['The pawns are the soul of chess.', 'Philidor'],
    ['Every chess master was once a beginner.', 'Irving Chernev'],
    ['Help your pieces so they can help you.', 'Paul Morphy'],
    ['The blunders are all there on the board, waiting to be made.', 'Savielly Tartakower'],
    ['Chess is the struggle against the error.', 'Johannes Zukertort'],
    ['Play the opening like a book, the middle game like a magician, and the endgame like a machine.', 'Rudolf Spielmann'],
    ['The beauty of a move lies not in its appearance but in the thought behind it.', 'Aaron Nimzowitsch']
  ];
  var last = -1, timer = null;

  function show(box){
    var i;
    do{ i = Math.floor(Math.random() * QUOTES.length); }while(i === last && QUOTES.length > 1);
    last = i;
    box.querySelector('.q-text').textContent = '\u201C' + QUOTES[i][0] + '\u201D';
    box.querySelector('.q-by').textContent = '\u2014 ' + QUOTES[i][1];
  }

  var prevLobby = window.renderLobby;
  window.renderLobby = function(){
    prevLobby();
    try{
      var side = document.querySelector('#screen-lobby .lobby-right');
      if(!side || side.querySelector('.quote-card')) return;
      var box = document.createElement('div');
      box.className = 'card quote-card';
      box.innerHTML = '<span class="q-text"></span><span class="q-by"></span>';
      side.appendChild(box);
      show(box);
      clearInterval(timer);
      timer = setInterval(function(){
        if(!document.body.contains(box)){ clearInterval(timer); return; }
        show(box);
      }, 30000);
    }catch(e){ console.error('quote box failed', e); }
  };
})();
