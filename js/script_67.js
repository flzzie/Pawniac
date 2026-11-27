// "Analyze this game": skip the input page. While the engine works, show the page background with a spinning bishop.
(function(){
  'use strict';
  var box = null, timer = null, startedAt = 0;

  function css(){
    if(document.getElementById('anLoadCss')) return;
    var st = document.createElement('style'); st.id = 'anLoadCss';
    st.textContent =
      'html.an-loading #screen-analyze{visibility:hidden;}' +
      '#anLoadBox{position:fixed;left:0;right:0;top:120px;bottom:0;z-index:40;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:0 20px;text-align:center;pointer-events:none;}' +
      '#anLoadBox .al-b{position:relative;width:96px;height:96px;perspective:600px;}' +
      '#anLoadBox .al-b i{position:absolute;inset:0;display:block;transform-style:preserve-3d;animation:anLoadSpin 2.8s linear infinite;}' +
      '#anLoadBox .al-b img{position:absolute;inset:0;width:100%;height:100%;filter:drop-shadow(0 4px 6px rgba(0,0,0,.25));}' +
      '#anLoadBox .al-b .al-bk{animation:anLoadFade 5.6s ease-in-out infinite;}' +
      '#anLoadBox .al-t{font-size:22px;font-weight:700;}' +
      '#anLoadBox .al-s{font-size:14px;opacity:.75;min-height:20px;max-width:420px;}' +
      '#anLoadBox .al-bar{width:min(320px,80vw);height:8px;border-radius:4px;background:rgba(128,128,128,.3);overflow:hidden;}' +
      '#anLoadBox .al-bar div{height:100%;width:0;background:#1f6f5c;transition:width .2s;}' +
      '#anLoadBox button{pointer-events:auto;}' +
      '@keyframes anLoadSpin{from{transform:rotateY(0deg);}to{transform:rotateY(360deg);}}' +
      '@keyframes anLoadFade{0%,100%{opacity:0;}50%{opacity:1;}}';
    document.head.appendChild(st);
  }

  function hide(){
    document.documentElement.classList.remove('an-loading');
    if(box && box.parentNode) box.parentNode.removeChild(box);
    box = null;
    if(timer){ clearInterval(timer); timer = null; }
  }

  function tick(){
    var scr = document.getElementById('screen-analyze'), go = document.getElementById('anGo');
    var running = !!go && go.textContent === 'Cancel';
    var done = !!document.querySelector('#screen-analyze .an-compact');
    var failed = !!document.querySelector('#anProg .an-err');
    var left = !scr || scr.style.display === 'none';
    var age = Date.now() - startedAt;
    // not started after a moment (for example you still have to pick a side): show the normal page instead
    if((done && age > 400) || failed || left || age > 600000 || (!running && age > 2500)){ hide(); return; }
    if(!box) return;
    var hint = document.querySelector('#anProg .hint'), bar = document.querySelector('#anProg .an-bar div');
    var t = box.querySelector('.al-s'), b = box.querySelector('.al-bar div');
    if(t) t.textContent = hint ? hint.textContent : 'Starting the engine...';
    if(b && bar) b.style.width = bar.style.width || '0%';
  }

  function show(){
    css();
    if(box) return;
    startedAt = Date.now();
    var wImg = (typeof pieceImgUrl === 'function') ? pieceImgUrl('w', 'b') : '/images/wB.svg';
    var bImg = (typeof pieceImgUrl === 'function') ? pieceImgUrl('b', 'b') : '/images/bB.svg';
    box = document.createElement('div'); box.id = 'anLoadBox';
    box.innerHTML = '<div class="al-b"><i><img src="' + wImg + '" alt=""><img class="al-bk" src="' + bImg + '" alt=""></i></div><div class="al-t">Analyzing your game</div><div class="al-s">Starting the engine...</div><div class="al-bar"><div></div></div>' +
      '<button class="secondary" id="alCancel" style="margin-top:6px;">Cancel</button>';
    document.body.appendChild(box);
    document.documentElement.classList.add('an-loading');
    box.querySelector('#alCancel').onclick = function(){
      var go = document.getElementById('anGo');
      if(go && go.textContent === 'Cancel') go.click();
      hide();
    };
    if(timer) clearInterval(timer);
    timer = setInterval(tick, 150);
  }

  // the "Analyze this game" buttons (finished game, game page) and the bot / shared-link entry point
  document.addEventListener('click', function(e){
    var t = e.target && e.target.closest ? e.target.closest('#btnAnalyzeGame, #ghAn') : null;
    if(t) show();
  }, true);
  var prev = window.PawniacAnalyzePgn;
  if(typeof prev === 'function') window.PawniacAnalyzePgn = function(){
    show();
    try{ return prev.apply(this, arguments); }
    catch(e){ hide(); throw e; }
  };
  window.PawniacAnalyzeLoader = {show:show, hide:hide};
})();
