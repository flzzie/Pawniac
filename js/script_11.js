(function(){
  var NAME_RE = /^[A-Za-z0-9_]{3,20}$/;
  var CODES = ('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ ' +
    'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR ' +
    'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP ' +
    'KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ ' +
    'NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW ' +
    'SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ ' +
    'UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW').split(' ');

  var dn = null;
  try{ dn = new Intl.DisplayNames(['en'], {type:'region'}); }catch(e){}
  function cname(code){
    if(code === 'XK') return 'Kosovo';
    try{ return (dn && dn.of(code)) || code; }catch(e){ return code; }
  }
  function esc(s){
    return String(s).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  function flagHtml(code){
    if(!/^[A-Z]{2}$/.test(code || '')) return '';
    return '<img class="flag" src="https://flagcdn.com/w20/' + code.toLowerCase() + '.png" alt="' + code +
           '" title="' + esc(cname(code)) + '" onerror="this.style.display=\'none\'">';
  }

  // ---------- country cache ----------
  var COUNTRY = {}, pending = {};
  function nameHtml(n){
    if(!n) return '';
    var nm = NAME_RE.test(n) ? '<span class="user-link" data-user="' + n + '">' + n + '</span>' : esc(n);
    return flagHtml(COUNTRY[n]) + nm;
  }
  function fetchCountries(names, done){
    names.forEach(function(n){
      if(!n || COUNTRY[n] !== undefined || pending[n] || !NAME_RE.test(n)) return;
      pending[n] = true;
      db.ref('hb/country/' + n).once('value').then(function(s){
        COUNTRY[n] = s.exists() ? s.val() : '';
      }).catch(function(){
        COUNTRY[n] = '';
      }).then(function(){
        delete pending[n];
        done();
      });
    });
  }

  // ---------- player info on the board ----------
  function infoHtml(g, color){
    var s = g.seats || {};
    var dot = '<span class="pi-dot ' + color + '"></span>';
    if(g.mode === 'team'){
      var pair = color === 'w' ? [[s.whiteBrain, 'Brain'], [s.whiteHand, 'Hand']] : [[s.blackBrain, 'Brain'], [s.blackHand, 'Hand']];
      return dot + pair.filter(function(p){ return p[0]; }).map(function(p){
        return nameHtml(p[0]) + '<span class="pi-role">' + p[1] + '</span>';
      }).join('<span class="pi-sep">&middot;</span>');
    }
    var n = color === 'w' ? s.white : s.black;
    var r = g.ratingSnapshot ? (color === 'w' ? g.ratingSnapshot.white : g.ratingSnapshot.black) : null;
    return dot + nameHtml(n) + (typeof r === 'number' ? ' <span class="pi-rating">(' + r + ')</span>' : '');
  }

  function seatNames(g){
    return Object.keys(g.seats || {}).map(function(k){ return g.seats[k]; }).filter(Boolean);
  }

  function decorateBars(){
    var g = gameState; if(!g) return;
    var scr = document.getElementById('screen-game');
    var boardEl = scr && scr.querySelector('.board');
    if(!boardEl) return;
    scr.querySelectorAll('.pbar').forEach(function(b){ b.remove(); });

    var top = flipped ? 'w' : 'b', bot = flipped ? 'b' : 'w';
    var clocks = scr.querySelectorAll('.clock');
    [[top, 0], [bot, 1]].forEach(function(t){
      var html = infoHtml(g, t[0]);
      if(clocks.length === 2){
        var lab = clocks[t[1]].querySelector('.label');
        if(lab){ lab.className = 'label pi'; lab.innerHTML = html; }
      } else {
        var bar = document.createElement('div');
        bar.className = 'pbar';
        bar.innerHTML = html;
        boardEl.parentNode.insertBefore(bar, t[1] === 0 ? boardEl : boardEl.nextSibling);
      }
    });
    fetchCountries(seatNames(g), function(){
      if(gameState === g || gameState) decorateBars();
    });
  }

  var prevDraw = window.drawGame;
  window.drawGame = function(){
    try{ prevDraw(); }
    finally{   // even if an earlier block throws, the player bars still get drawn
      try{ decorateBars(); }catch(e){ console.error('player bars failed', e); }
    }
  };
  // safety net: if the board was redrawn by something else and the bars are missing, put them back
  setInterval(function(){
    try{
      var scr = document.getElementById('screen-game');
      if(gameState && scr && scr.style.display === 'block' && scr.querySelector('.board') &&
         !scr.querySelector('.label.pi') && !scr.querySelector('.pbar')) decorateBars();
    }catch(e){ console.error('player bars failed', e); }
  }, 1000);

  // ---------- country on profiles ----------
  function stillOnProfile(name){
    var scr = document.getElementById('screen-profile');
    var n = scr && scr.querySelector('.pf-name');
    return !!(scr && scr.style.display === 'block' && n && n.textContent.indexOf(name) === 0);
  }

  async function decorateProfile(name){
    if(!stillOnProfile(name)) return;
    var scr = document.getElementById('screen-profile');
    var nameEl = scr.querySelector('.pf-name');
    var code = '';
    try{
      var snap = await db.ref('hb/country/' + name).once('value');
      code = snap.exists() ? snap.val() : '';
    }catch(e){ console.error('country load failed', e); }
    if(!stillOnProfile(name)) return;
    COUNTRY[name] = code;

    var row = document.createElement('div');
    row.className = 'pf-country';
    if(name !== ME.username){
      if(!/^[A-Z]{2}$/.test(code)) return;
      row.innerHTML = flagHtml(code) + '<span>' + esc(cname(code)) + '</span>';
      nameEl.after(row);
      return;
    }
    var opts = CODES.map(function(c){ return {c:c, n:cname(c)}; })
      .sort(function(a, b){ return a.n.localeCompare(b.n); })
      .map(function(o){ return '<option value="' + o.c + '"' + (o.c === code ? ' selected' : '') + '>' + esc(o.n) + '</option>'; })
      .join('');
    row.innerHTML = '<span id="pfFlag">' + flagHtml(code) + '</span>' +
      '<select id="pfCountry" aria-label="Country"><option value=""' + (code ? '' : ' selected') + '>Country: not set</option>' + opts + '</select>' +
      '<span class="hint" id="pfCountryMsg"></span>';
    nameEl.after(row);

    document.getElementById('pfCountry').onchange = async function(){
      var v = this.value, msg = document.getElementById('pfCountryMsg');
      msg.textContent = 'Saving...';
      try{
        if(v) await db.ref('hb/country/' + ME.username).set(v);
        else await db.ref('hb/country/' + ME.username).remove();
        COUNTRY[ME.username] = v;
        document.getElementById('pfFlag').innerHTML = flagHtml(v);
        msg.textContent = 'Saved';
      }catch(e){
        console.error(e);
        msg.textContent = (e && e.code === 'PERMISSION_DENIED') ? "Couldn't save (publish the new Firebase rules)." : "Couldn't save.";
      }
    };
  }

  var prevOpen = window.openProfile;
  window.openProfile = async function(name){
    await prevOpen(name);
    try{ await decorateProfile(name); }catch(e){ console.error(e); }
  };
})();
