(function(){
  // dropdown order: My profile, Achievements, Settings
  function add(){
    var menu = document.getElementById('userMenu');
    if(!menu || menu.querySelector('[data-go="achievements"]')) return;
    var it = document.createElement('div');
    it.className = 'um-item';
    it.dataset.go = 'achievements';
    it.textContent = 'Achievements';
    it.onclick = function(e){
      e.stopPropagation();
      menu.style.display = 'none';
      var a = document.querySelector('#navbar [data-nav="achievements"]');
      if(a) a.click();                 // same code path the nav tab used (asks before leaving a live game)
    };
    var prof = menu.querySelector('[data-go="profile"]');
    if(prof) prof.after(it); else menu.insertBefore(it, menu.firstChild);
  }
  var prev = window.renderUserbox;
  window.renderUserbox = function(){
    var r = prev.apply(this, arguments);
    try{ add(); }catch(e){ console.error('achievements menu item failed', e); }
    return r;
  };
  try{ add(); }catch(e){}
})();
