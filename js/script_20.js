(function(){
  // jump back to the top of the explanation whenever you step to another move
  var scr = document.getElementById('screen-analyze');
  if(!scr) return;
  new MutationObserver(function(){
    var p = document.getElementById('anPanel');
    if(p) p.scrollTop = 0;
  }).observe(scr, {childList:true, subtree:true});
})();
