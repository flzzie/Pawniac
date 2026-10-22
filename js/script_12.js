(function(){
  var KEY = 'pawniac-pieces-v1';
  var store = {}, uri = {}, keep = [];
  try{ store = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; }catch(e){ store = {}; }

  var origUrl = window.pieceImgUrl;
  function dataUri(k){
    if(!uri[k]) uri[k] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(store[k]);
    return uri[k];
  }
  // Pieces we have saved on this device come from memory (instant, no network).
  // Anything not saved yet still uses the normal Wikimedia link.
  window.pieceImgUrl = function(color, type){
    var k = color + type;
    return store[k] ? dataUri(k) : origUrl(color, type);
  };

  ['w','b'].forEach(function(c){
    ['p','n','b','r','q','k'].forEach(function(t){
      var k = c + t;
      var im = new Image();                       // warm the browser cache + keep the picture decoded
      im.src = window.pieceImgUrl(c, t);
      keep.push(im);
      if(store[k]) return;
      // try to save a copy on this device for next time (silently skipped if the browser blocks it)
      fetch(origUrl(c, t)).then(function(r){
        if(!r.ok) throw new Error('bad status');
        return r.text();
      }).then(function(txt){
        if(!/^\s*(<\?xml|<svg)/i.test(txt) || txt.length > 30000 || /<script|javascript:|\son\w+\s*=/i.test(txt)) throw new Error('unexpected file');
        store[k] = txt;
        try{ localStorage.setItem(KEY, JSON.stringify(store)); }catch(e){}
      }).catch(function(){});
    });
  });
})();
