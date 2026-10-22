(function(){
  var MAX_GIF_BYTES = 140 * 1024;     // GIFs are stored as-is, so they have to be small
  var MAX_CHARS     = 190000;         // must stay under the 200000 limit in the Firebase rule
  var DATA_RE = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+\/=]+$/;

  function validUrl(u){ return typeof u === 'string' && u.length < 200000 && DATA_RE.test(u); }

  function setImg(av, url){
    av.innerHTML = '';
    var im = new Image();
    im.alt = '';
    im.draggable = false;
    im.src = url;
    av.appendChild(im);
  }
  function setLetter(av, name){
    av.textContent = name.charAt(0).toUpperCase();
  }

  // static images: crop to a centered square, shrink to 256x256, save as webp (or jpeg as fallback)
  function toSquareDataUrl(file){
    return new Promise(function(resolve, reject){
      var objUrl = URL.createObjectURL(file);
      var im = new Image();
      im.onload = function(){
        URL.revokeObjectURL(objUrl);
        var S = 256, c = document.createElement('canvas');
        c.width = c.height = S;
        var ctx = c.getContext('2d');
        var side = Math.min(im.width, im.height);
        ctx.drawImage(im, (im.width - side) / 2, (im.height - side) / 2, side, side, 0, 0, S, S);
        var out = c.toDataURL('image/webp', 0.85);
        if(out.indexOf('data:image/webp') !== 0){
          ctx.globalCompositeOperation = 'destination-over';
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, S, S);
          out = c.toDataURL('image/jpeg', 0.85);
        }
        resolve(out);
      };
      im.onerror = function(){ URL.revokeObjectURL(objUrl); reject(new Error("Couldn't read that image.")); };
      im.src = objUrl;
    });
  }
  function readAsDataUrl(file){
    return new Promise(function(resolve, reject){
      var r = new FileReader();
      r.onload = function(){ resolve(r.result); };
      r.onerror = function(){ reject(new Error("Couldn't read that file.")); };
      r.readAsDataURL(file);
    });
  }

  async function prepare(file){
    if(!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) throw new Error('Use a PNG, JPG, WebP or GIF.');
    var url;
    if(file.type === 'image/gif'){
      if(file.size > MAX_GIF_BYTES) throw new Error('That GIF is too big (max ' + Math.round(MAX_GIF_BYTES / 1024) + ' KB).');
      url = await readAsDataUrl(file);
    } else {
      url = await toSquareDataUrl(file);
    }
    if(!validUrl(url) || url.length > MAX_CHARS) throw new Error('That picture is too big. Try a smaller one.');
    return url;
  }

  function stillOnProfile(name){
    var scr = document.getElementById('screen-profile');
    var n = scr && scr.querySelector('.pf-name');
    return !!(scr && scr.style.display === 'block' && n && n.textContent.indexOf(name) === 0);
  }

  async function decorate(name){
    var scr = document.getElementById('screen-profile');
    var av = scr && scr.querySelector('.pf-avatar');
    if(!av || !stillOnProfile(name)) return;

    var url = null;
    try{
      var snap = await db.ref('hb/avatar/' + name).once('value');
      url = snap.exists() ? snap.val() : null;
    }catch(e){ console.error('avatar load failed', e); }
    if(!stillOnProfile(name)) return;
    if(validUrl(url)) setImg(av, url);

    if(name !== ME.username) return;

    // ---- own profile: picture controls ----
    av.classList.add('editable');
    var info = av.parentNode.querySelector('div:last-child');
    var ctl = document.createElement('div');
    ctl.className = 'pf-ctl';
    ctl.innerHTML =
      '<button class="secondary" id="avPick">Change picture</button>' +
      '<button class="secondary danger" id="avDel" style="display:' + (validUrl(url) ? 'inline-block' : 'none') + ';">Remove</button>' +
      '<span class="hint" id="avMsg">PNG, JPG, WebP or GIF (GIFs up to ' + Math.round(MAX_GIF_BYTES / 1024) + ' KB)</span>' +
      '<input type="file" id="avFile" accept="image/png,image/jpeg,image/webp,image/gif" style="display:none;">';
    info.appendChild(ctl);

    var msg = document.getElementById('avMsg');
    var file = document.getElementById('avFile');
    var del = document.getElementById('avDel');
    var pickNow = function(){ file.click(); };
    document.getElementById('avPick').onclick = pickNow;
    av.onclick = pickNow;

    file.onchange = async function(){
      var f = file.files && file.files[0];
      file.value = '';
      if(!f) return;
      msg.textContent = 'Saving...';
      try{
        var data = await prepare(f);
        await db.ref('hb/avatar/' + ME.username).set(data);
        setImg(av, data);
        del.style.display = 'inline-block';
        msg.textContent = 'Saved';
      }catch(e){
        console.error(e);
        msg.textContent = (e && e.code === 'PERMISSION_DENIED')
          ? "Couldn't save (publish the new Firebase rules)."
          : (e && e.message) || "Couldn't save.";
      }
    };
    del.onclick = async function(){
      msg.textContent = 'Removing...';
      try{
        await db.ref('hb/avatar/' + ME.username).remove();
        setLetter(av, ME.username);
        del.style.display = 'none';
        msg.textContent = 'Removed';
      }catch(e){
        console.error(e);
        msg.textContent = "Couldn't remove.";
      }
    };
  }

  var prevOpen = window.openProfile;
  window.openProfile = async function(name){
    await prevOpen(name);
    try{ await decorate(name); }catch(e){ console.error(e); }
  };
})();
