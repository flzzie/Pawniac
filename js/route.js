/* Pawniac routing: real URLs (/handandbrain/, /game/12/, /profile/rishit/)
 * instead of #/ links.
 *
 * The rest of the site still thinks in "#/something" strings, so this file
 * converts between those strings and real paths. It must be the FIRST script
 * on the page (it is, in index.html).
 *
 *   PW.hash()        the current page as "#/game/12" ("" on the home page)
 *   PW.push(h)       go to a page, new history entry, fires "hashchange"
 *                    (same as the old  location.hash = h)
 *   PW.pushQuiet(h)  new history entry, no event (same as history.pushState)
 *   PW.replace(h)    change the address without a new entry or event
 *   PW.url(h)        full link, e.g. https://pawniac.fun/game/12/
 */
(function(){
  if(window.PW) return;

  // first parts of the address that really are pages of the site
  var KNOWN = ['analyze','auction','bot','game','handandbrain','help','leaderboard','minigames',
               'privacy','profile','quiz','settings','standard','supporters','terms','watch',
               'play','reports','achievements'];

  function isHome(p){ return p === '' || p === '/' || /^\/index\.html$/i.test(p); }
  function firstPart(h){ return String(h || '').replace(/^#?\/*/, '').split(/[\/?#]/)[0].toLowerCase(); }

  // "#/game/12" -> "/game/12/"     ""  or "#" -> "/"
  function toPath(h){
    h = String(h == null ? '' : h);
    if(h.charAt(0) === '#') h = h.slice(1);
    h = h.replace(/^\/+|\/+$/g, '');
    return h ? '/' + h + '/' : '/';
  }

  // "/game/12/" -> "#/game/12"     home page -> ""
  function curHash(){
    var p = pending !== null ? pending.path : location.pathname;
    if(isHome(p)) return '';
    return '#' + p.replace(/\/+$/, '');
  }

  // ---- arriving ----
  // Some visits arrive at "/" but really mean another page (an old #/game/12 link, or the 404 page
  // sending us here). We remember where they want to go, and only change the address bar AFTER the
  // page has finished loading: changing it earlier would make the browser look for the rest of the
  // site's files (js/..., css/...) inside that other folder.
  var pending = null;                       // {path:'/game/12/', url:'/game/12/?x=1'}
  function commit(){
    if(pending === null) return;
    var url = pending.url; pending = null;
    try{ history.replaceState(null, '', url); }catch(e){}
  }
  try{
    var m = /[?&]__p=([^&]*)/.exec(location.search);
    if(m){
      // 404.html sent us here:  /?__p=%2Fgame%2F12%2F  ->  show /game/12/
      var target = decodeURIComponent(m[1]);
      if(target.charAt(0) === '/' && target.charAt(1) !== '/') pending = { path: target.split(/[?#]/)[0], url: target };
    }else if(location.hash.indexOf('#/') === 0 && isHome(location.pathname)){
      // an old link such as  pawniac.fun/#/game/12  ->  pawniac.fun/game/12/
      if(firstPart(location.hash) === '') pending = { path: '/', url: '/' + location.search };
      else if(KNOWN.indexOf(firstPart(location.hash)) === -1) location.replace('/404.html?from=' + encodeURIComponent(location.hash));
      else pending = { path: toPath(location.hash), url: toPath(location.hash) + location.search };
    }
    if(pending !== null){
      if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', commit);
      else commit();
    }
  }catch(e){}

  // ---- changing the address ----
  // Some scripts read e.oldURL from the "hashchange" event (script_31 uses it to put the address back
  // when you say "no" to "leave the game?"), and they expect the old style:  https://site/#/page
  var lastHash = curHash();
  function oldStyle(h){ return location.origin + '/' + h; }
  function fire(from, to){
    setTimeout(function(){
      var ev, init = { oldURL: oldStyle(from), newURL: oldStyle(to) };
      try{ ev = new HashChangeEvent('hashchange', init); }
      catch(e){ ev = document.createEvent('Event'); ev.initEvent('hashchange', false, false); ev.oldURL = init.oldURL; ev.newURL = init.newURL; }
      window.dispatchEvent(ev);
    }, 0);
  }
  function setUrl(h, replace, quiet){
    commit();
    var url = toPath(h) + location.search;
    if(url === location.pathname + location.search) return;       // already there: nothing to do
    var from = lastHash;
    try{ history[replace ? 'replaceState' : 'pushState'](null, '', url); }catch(e){ return; }
    lastHash = curHash();
    if(!replace && !quiet) fire(from, lastHash);
  }

  // back / forward buttons
  window.addEventListener('popstate', function(){
    var from = lastHash; lastHash = curHash();
    fire(from, lastHash);
  });

  // links written as <a href="#/something"> keep working
  document.addEventListener('click', function(e){
    if(e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target && e.target.closest ? e.target.closest('a[href^="#/"]') : null;
    if(!a) return;
    e.preventDefault();
    setUrl(a.getAttribute('href'), false, false);
  }, true);

  window.PW = {
    hash: curHash,
    push: function(h){ setUrl(h, false, false); },
    pushQuiet: function(h){ setUrl(h, false, true); },
    replace: function(h){ setUrl(h, true, true); },
    url: function(h){ return location.origin + toPath(h); },
    known: KNOWN
  };
})();
