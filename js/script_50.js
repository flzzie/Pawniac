(function(){
  // ============ EDIT THESE 3 THINGS ============
  var CONTACT = 'pawniac.support@gmail.com';      // the email people use for help, reports, deletion requests and legal notices
  var LAW     = 'India';                        // country whose law governs the Terms
  var UPDATED = '22 October 2026';              // change this date whenever you edit the Terms or Privacy text
  // =============================================

  function $(id){ return document.getElementById(id); }
  function esc(s){ return String(s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function mail(){ return '<a href="mailto:' + esc(CONTACT) + '">' + esc(CONTACT) + '</a>'; }
  function loggedIn(){ return typeof ME !== 'undefined' && !!ME; }

  // =====================================================================
  //  HELP: FAQ content
  // =====================================================================
  var HELP = [
    {id:'general', title:'General', sub:'About the website',
     items:[
      ['What is Pawniac?', `<p>Pawniac is a free chess website built around chess variants. You can play classic <b>Standard Chess</b>, <b>Hand &amp; Brain</b> (where one piece type is named before every move) and <b>Piece Auction</b> (where you bid coins to build your own army). There is also a bot to practise against, a game analyzer, minigames, an openings quiz, leaderboards and achievements.</p><p>It is made by Rishit. You can find out more about him at <a href="https://rishit.fun">rishit.fun</a>.</p>`],
      ['Is it free?', `<p>Yes. Everything on Pawniac is free, with no ads. If you want to support the site you can donate, and donors get a shiny gradient on their username that everyone can see. To donate, just email ${mail()} to show your interest and we will let you know about the available payment methods. See the Terms for the details.</p>`],
      ['Do I need an account?', `<p>Yes, to play online games, appear on the leaderboards and save progress. Sign up with an email and password, or continue with Google or Discord. You pick a username (3 to 20 letters, numbers or underscores). <b>You cannot change your username later</b>, so choose one you like.</p>`],
      ['How old do I have to be?', `<p>There is no minimum age and Pawniac is meant to be safe for everyone. There is no public chat. Younger players should ask a parent or guardian before signing up. See the Privacy Policy for what is stored.</p>`],
      ['How do I start a game?', `<p>Open <b>Play</b> in the top bar. Pick a game type (Hand &amp; Brain, Standard Chess or Piece Auction), pick a time control, then either press <b>Find opponent</b> for a quick match or create a room under <b>Play with friends</b>.</p><p>In a room, share the 5-letter code or press <b>Copy invite link</b>. Anyone who opens the link and logs in lands straight in your room.</p>`],
      ['How do I challenge a specific player?', `<p>Open their profile (click their name anywhere) or find them under <b>Leaderboard &rarr; Players</b>, then press <b>Challenge</b>. Choose the game, time control and colour. A challenge lasts 2 minutes. You can only challenge players who are online.</p>`],
      ['What do the green, yellow and blue dots mean?', `<p>Green means online, yellow means idle (no mouse or keyboard for 3 minutes), blue means in a game, and grey means offline.</p>`],
      ['Can I watch other people play?', `<p>Yes. On the Play page, the <b>Watch live games</b> list shows games in progress. You can also press <b>Watch live game</b> on a player's profile. Every watch page has its own link you can share, like <code>#/watch/CODE</code>.</p>`],
      ['What time controls are there?', `<p>No clock, 1+0, 3+2, 5+3, 10+5, 15+10, or a custom one (1 to 180 minutes, 0 to 60 seconds added per move). The first number is minutes, the second is seconds added after each move.</p>`],
      ['What happens if I run out of time?', `<p>You lose on time, unless your opponent cannot possibly checkmate you with the pieces they have left. Then the game is a draw.</p>`],
      ['What if my opponent leaves or never moves?', `<ul><li>If a side has not made its first move in 30 seconds (60 seconds in 2v2), the game is <b>aborted</b> with no rating change.</li><li>If your opponent disconnects mid-game, after a short wait (40 to 120 seconds depending on the time control) you can <b>claim victory</b> or <b>call a draw</b>. If they come back, the game carries on.</li><li>Games with no clock end in a win for the other side if nobody moves for 24 hours.</li></ul>`],
      ['How do draws, resigning and aborting work?', `<p>You can offer a draw, accept or decline an offer, or resign. Until both players have moved, the buttons change to <b>Abort game</b>, which ends the game with no result for anyone. Draws also happen automatically by stalemate, insufficient material, threefold repetition and the 50-move rule.</p>`],
      ['Does my game get saved? Can I find it again?', `<p>Finished games get a number (like <b>#42</b>) and appear under <b>Recent games</b> on both players' profiles. Open <code>#/game/42</code> to replay it, copy the link, or press <b>Analyze this game</b>. Games against the bot are not saved.</p>`],
      ['How do I change sounds, the board and other options?', `<p>Click your name in the top right and choose <b>Settings</b>. You can turn each sound on or off, hide coordinates, legal-move dots or last-move highlighting, always promote to a queen, confirm draw offers, auto-decline draw offers, and turn drag and drop or premoves on or off. Settings are saved on your device. The moon icon switches between light and dark mode.</p>`],
      ['Can I draw arrows and circles on the board?', `<p>Yes. <b>Right-click</b> a square to draw a circle, <b>right-click and drag</b> to draw an arrow. Hold Shift for red, Ctrl or Cmd for blue and Alt for yellow. Esc, a normal click or a new move clears them.</p>`],
      ['What are premoves?', `<p>In Standard Chess and Piece Auction you can queue a move while it is your opponent's turn. It plays automatically as soon as they move, if it is still legal. Right-click or press Esc to cancel it.</p>`],
      ['How do profiles work?', `<p>Click your name and choose <b>My profile</b>. You can add a short bio (160 characters), a profile picture (PNG, JPG, WebP or a small GIF) and your country flag. Profiles also show ratings, win/loss/draw records, recent games, your best scores in the minigames and quiz, and up to 3 pinned achievements.</p>`],
      ['How do I report someone?', `<p>Open their profile and press <b>Report</b>. Pick a reason and add a note (a game number helps). Reports are private and are read by a person. Please do not send false reports: they can get your own account restricted.</p>`],
      ['I found a bug or something is broken.', `<p>Email <b>${esc(CONTACT)}</b> and tell me what you did, which page you were on and what browser you use. Refreshing the page fixes most display problems, and your game carries on where you left it.</p>`],
      ['How do I delete my account or my data?', `<p>Email ${mail()} from the address you signed up with, with your username, and ask for deletion. See the Privacy Policy for what gets removed.</p>`]
     ]},
    {id:'account', title:'Ratings, leaderboards &amp; achievements', sub:'How scores work',
     items:[
      ['How do ratings work?', `<p>Pawniac uses the Elo system. Everyone starts at <b>1200</b>. Beat a stronger player and you gain more points; lose to a weaker one and you lose more. There are three separate ratings: <b>Hand &amp; Brain</b> (this also covers 2v2), <b>Standard</b> and <b>Piece Auction</b>. Each has its own leaderboard tab.</p>`],
      ['Which games are rated?', `<p>1v1 games (quick matches, challenges and 1v1 rooms) and 2v2 quick matches are rated. Aborted games and games with no moves never change a rating. Games against the bot are never rated. 4-player rooms that friends set up by hand are not rated.</p>`],
      ['How is a 2v2 rating worked out?', `<p>Each team's rating is the average of its two players. Both teammates gain or lose the same amount. Quick-match teams are balanced for you: the strongest and weakest players are paired against the two in the middle.</p>`],
      ['Why am I not on the leaderboard?', `<p>You show up after your first rated game. Only the top 50 are listed.</p>`],
      ['What are achievements?', `<p>Badges for things you do on Pawniac: games played, win streaks, ratings, openings you win with, analyzing games, daily streaks, variants, minigames and a few fun ones. Open them from your name menu &rarr; <b>Achievements</b>. Locked ones show a progress bar. You can pin up to 3 badges to your profile.</p>`],
      ['What do titles like GM next to a name mean?', `<p>The red badge is a title given by the site owner. Players cannot add it themselves.</p>`]
     ]},
    {id:'hb', title:'Hand &amp; Brain', sub:'Variant rules',
     items:[
      ['What is Hand &amp; Brain?', `<p>It is chess where, before every move, a <b>piece type</b> is named (Pawn, Knight, Bishop, Rook, Queen or King) and the move must be made with a piece of that type. Only types that currently have a legal move can be named.</p>`],
      ['What are the two ways to play it?', `<ul><li><b>Random-button (2 players):</b> on your turn, press <b>Randomize piece</b>. The game names a piece type for you from the pieces that can actually move. Pieces with many legal moves are more likely to come up than pieces with only one.</li><li><b>Team (4 players):</b> two players per side. The <b>Brain</b> names the piece type, and the <b>Hand</b> picks which piece of that type to move and where. The Brain cannot move pieces and the Hand cannot choose the type.</li></ul>`],
      ['What if I am in check?', `<p>Only types that have a move that gets you out of check can be named or randomized. If the named type has several legal moves, all of them are allowed.</p>`],
      ['What does the Hand do when the type is, say, Knight?', `<p>Click one of your highlighted knights, then click one of the highlighted squares. Pawn promotions let you pick the new piece. En passant and castling work as in normal chess (castling is a King move).</p>`],
      ['How do I play 2v2 quickly?', `<p>On the Play page, under Quick match, choose <b>2v2 teams</b>. When four players are searching with the same time control the game starts. Roles (Brain or Hand) and colours are random. It is rated and uses your Hand &amp; Brain rating.</p>`],
      ['How do I set up a 4-player game with friends?', `<p>Under Play with friends choose <b>Team (4 players)</b> and press Create room. Share the code or link. Each player takes a seat (White Brain, White Hand, Black Brain, Black Hand). The game starts once all four seats are filled.</p>`],
      ['What about the bot?', `<p>On <b>Play bot</b> you can play Hand &amp; Brain against the engine. Either the bot is your Brain and names the piece for you, or you use the random button. The bot is not rated.</p>`]
     ]},
    {id:'std', title:'Standard Chess', sub:'Normal chess',
     items:[
      ['What are the rules?', `<p>Normal chess rules, including castling, en passant, promotion, check, checkmate, stalemate, insufficient material, threefold repetition and the 50-move rule.</p>`],
      ['Is Standard Chess rated?', `<p>Yes, with its own rating and leaderboard tab, separate from Hand &amp; Brain. Quick matches and challenges both count.</p>`],
      ['Can I use drag and drop and premoves?', `<p>Yes to both. Drag a piece or click it and click a square. Premoves are available while it is your opponent's turn. You can turn either off in Settings.</p>`]
     ]},
    {id:'auction', title:'Piece Auction', sub:'Variant rules',
     items:[
      ['What is Piece Auction?', `<p>Before the game, both players bid coins to buy the pieces of their army. Then you place your army on your two home ranks and play a normal game of chess with it.</p>`],
      ['How does the auction work?', `<ol style="margin:4px 0 8px 18px;"><li>Both players get the same number of coins, a random amount from 15 to 50.</li><li>Players take turns <b>nominating</b> a piece type (Pawn, Knight, Bishop, Rook or Queen) to put up for auction.</li><li>Players then bid on it. Each bid must be higher than the last. The player who does not want to go higher passes or drops out, and the highest bidder wins the piece and pays their bid.</li><li>If both players pass with no bids, the piece goes unsold.</li><li>You can press <b>Stop buying</b> when you are done.</li></ol><p>Everyone always has a king for free. The standard values shown (pawn 1, knight 3, bishop 3, rook 5, queen 9) are only a guide: you can pay whatever you like.</p>`],
      ['Are there limits on my army?', `<p>Yes. You can hold at most <b>8 pawns</b> and <b>7 other pieces</b> (knights, bishops, rooks and queens combined). Pawns go on your 2nd rank, and everything else shares your back rank with your king.</p>`],
      ['When does the auction end?', `<p>When nobody can nominate any more (out of coins or out of room), both players have stopped buying, 3 pieces in a row go unsold, or 60 rounds have passed.</p>`],
      ['How do I place my pieces?', `<p>Pick a piece from the tray, then click a square on the right rank. Click a placed piece to take it back. You can press <b>Randomize</b> for a random layout, or <b>Clear</b>. Press <b>Lock in</b> when happy. Once both players are locked in, the game begins.</p>`],
      ['What if I am too slow?', `<p>If you take too long to nominate or bid (about 25 seconds), the game does it for you: it picks a random valid piece or passes. If you do not finish placing in about 90 seconds, a random layout is used.</p>`],
      ['Are there any special rules during the game?', `<ul><li>There is <b>no castling</b> in Piece Auction.</li><li>White normally moves first. If only Black's king starts in check, Black moves first so the position is legal.</li><li>Draws and wins work like Standard Chess.</li></ul>`],
      ['Is it rated?', `<p>Yes, it has its own rating and leaderboard tab. Piece Auction games do not count towards win/loss records. You can also play Piece Auction against the bot (unrated).</p>`]
     ]},
    {id:'more', title:'Analyze, bot, minigames &amp; quiz', sub:'The other pages',
     items:[
      ['How do I analyze a game?', `<p>Open <b>Analyze</b>, paste a PGN or upload a .pgn file, choose whether you played White or Black, and press Analyze. A Stockfish engine runs <b>inside your browser</b>: the game is not uploaded anywhere. You can also press <b>Analyze this game</b> on any finished game.</p>`],
      ['What do Best, Excellent, Good, Inaccuracy, Mistake and Blunder mean?', `<p>They compare your move to the engine's choice by how much of your winning chances it cost: best (the engine's top move), excellent (almost as good), good, inaccuracy (small slip), mistake (clear slip) and blunder (big error). <b>Book</b> moves are known opening theory. <b>Brilliant</b> marks a good sacrifice.</p>`],
      ['What is in the report and the PDF?', `<p>The Report tab shows accuracy, what went well, what to work on, patterns, your opening, time per move and highlights. Press <b>Download PDF report</b> and choose "Save as PDF" in the print window for a printable copy with every move explained.</p>`],
      ['What does Practice do?', `<p>It gives you the positions where you made a mistake or blunder and lets you try to find the better move, with hints if you get stuck.</p>`],
      ['What is "Try a line"?', `<p>On the Board tab it lets you play your own moves from the position you are looking at. The engine rates each move and explains it.</p>`],
      ['Why is time per move missing?', `<p>It needs clock tags ([%clk]) in the PGN. Lichess and Chess.com exports have them. Pawniac games record move times from now on.</p>`],
      ['How does the bot work?', `<p>Open <b>Play bot</b>. Pick the game (Standard, Hand &amp; Brain or Piece Auction), time control, your colour and the bot level: Beginner, Easy, Medium, Hard or Expert. The bot is the Stockfish engine playing on your device. Bot games are timed but never rated and never saved.</p>`],
      ['What are the minigames?', `<p><b>Knight's tour:</b> visit as many squares as you can with a knight, each only once. More squares wins; ties go to the faster time.</p><p><b>Blindfold board:</b> memorise a position for a few seconds, then place the pieces back from memory. Perfect rounds go up a level. 3 lives.</p>`],
      ['How does the quiz work?', `<p>The <b>Quiz</b> page asks you to name an opening from its moves, or to play out an opening from its name. Openings get rarer and the timer shorter as you go. A wrong answer or running out of time costs a life, and you have 3. Your best score goes on the quiz leaderboard.</p>`],
      ['Why does the engine take a moment to start?', `<p>The first time you analyze a game or play the bot, the engine needs a few seconds to get ready. After that it starts much faster.</p>`]
     ]},
    {id:'fair', title:'Fair play', sub:'Keeping games honest',
     items:[
      ['What counts as cheating?', `<ul><li>Using an engine or any outside help during a game.</li><li>Having someone else play for you, or playing from two accounts against each other.</li><li>Losing on purpose, or teaming up, to raise ratings.</li><li>Leaving games to avoid losing.</li></ul><p>In Hand &amp; Brain, players on the same side may talk to coordinate but must follow the role rules (the Brain does not make moves, the Hand does not choose the type).</p>`],
      ['How are cheaters found?', `<p>Through reports from players and through our own checks. Please report anything suspicious from the player's profile.</p>`],
      ['What happens if I am caught?', `<p>Appropriate action is taken. This can include resetting your rating, refunding the rating your opponents lost, or banning your account from the website, either for a period of time or permanently, as we decide. Please see the Terms of Service.</p>`]
     ]}
  ];

  // =====================================================================
  //  HELP: the page
  // =====================================================================
  var H = {tab:'all', q:''};
  var scrHelp = $('screen-help');
  function plain(h){ return String(h).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').toLowerCase(); }

  function helpList(){
    var q = H.q.trim().toLowerCase(), out = '', any = false;
    HELP.forEach(function(c){
      if(H.tab !== 'all' && H.tab !== c.id) return;
      var items = c.items.filter(function(it){ return !q || it[0].toLowerCase().indexOf(q) >= 0 || plain(it[1]).indexOf(q) >= 0; });
      if(!items.length) return;
      any = true;
      out += '<div class="hp-cat"><h3>' + c.title + '</h3><div class="hint">' + c.sub + '</div>' +
        items.map(function(it){ return '<details class="hp-q"' + (q ? ' open' : '') + '><summary>' + it[0] + '</summary><div class="hp-a">' + it[1] + '</div></details>'; }).join('') + '</div>';
    });
    return any ? out : '<div class="hp-none">Nothing matches "' + esc(H.q) + '". Try a different word, or email ' + mail() + '.</div>';
  }

  window.renderHelp = function(){
    showScreen('help');
    var tabs = '<div class="ac-tab' + (H.tab === 'all' ? ' active' : '') + '" data-t="all">All</div>' + HELP.map(function(c){
      return '<div class="ac-tab' + (H.tab === c.id ? ' active' : '') + '" data-t="' + c.id + '">' + c.title.replace(/&amp;/g, '&amp;') + '</div>';
    }).join('');
    scrHelp.innerHTML = '<div class="card"><h2>Help</h2><p class="desc">Answers to common questions. Still stuck? Email ' + mail() + '.</p>' +
      '<input type="text" id="hpSearch" class="hp-search" placeholder="Search the help pages" autocomplete="off" value="' + esc(H.q) + '">' +
      '<div class="ac-tabs" id="hpTabs">' + tabs + '</div><div id="hpList">' + helpList() + '</div></div>';
    $('hpSearch').oninput = function(){ H.q = this.value; $('hpList').innerHTML = helpList(); };
    scrHelp.querySelectorAll('[data-t]').forEach(function(t){
      t.onclick = function(){
        H.tab = t.dataset.t;
        scrHelp.querySelectorAll('[data-t]').forEach(function(x){ x.classList.toggle('active', x === t); });
        $('hpList').innerHTML = helpList();
      };
    });
    if(!loggedIn()) addBack(scrHelp);
  };

  // FIXED: the click handler is attached straight to the element (no shared id),
  // so it always works no matter which page was opened first.
  function addBack(host){
    var old = host.querySelector('.lg-back-wrap');
    if(old) old.remove();
    var d = document.createElement('div');
    d.className = 'lg-back-wrap';
    d.style.cssText = 'margin-top:4px;';
    var b = document.createElement('span');
    b.className = 'backlink';
    b.style.cursor = 'pointer';
    b.innerHTML = '&larr; ' + (loggedIn() ? 'Back to Pawniac' : 'Back to login');
    b.onclick = goBack;
    d.appendChild(b);
    host.appendChild(d);
  }
  function goBack(){
    try{ history.replaceState(null, '', location.pathname + location.search); }catch(e){}
    try{
      if(loggedIn() && typeof afterAuth === 'function') afterAuth();
      else renderAuthScreen();
    }catch(e){
      console.error(e);
      location.href = location.pathname + location.search;
      return;
    }
    // safety net: if we are logged out and a Help/Terms page is still showing, reload to the login screen
    var t = document.getElementById('screen-terms');
    var h = document.getElementById('screen-help');
    if(!loggedIn() && ((t && t.style.display === 'block') || (h && h.style.display === 'block'))){
      location.href = location.pathname + location.search;
    }
  }

  // =====================================================================
  //  TERMS OF SERVICE and PRIVACY POLICY
  // =====================================================================
  var TOS = `
<h3>1. About these terms</h3>
<p>These Terms of Service ("Terms") are the rules for using Pawniac (the "Service"), a free chess website at pawniac.fun. The Service is run by Rishit, an individual, ("we", "us", "I"). It is not run by a registered company. By creating an account or using the Service you agree to these Terms. If you do not agree, please do not use it.</p>

<h3>2. Who can use Pawniac</h3>
<p>Pawniac is open to everyone and there is no minimum age. If you are young, please ask a parent or guardian before you sign up, and read the Privacy Policy together. If you are a parent or guardian and you do not want your child to have an account, tell us at ${mail()} and we will delete it.</p>

<h3>3. Your account</h3>
<ul>
<li>You can sign up with an email and password, or with Google or Discord.</li>
<li>Your username is permanent. Pick a name that others can safely see. It must be 3 to 20 letters, numbers or underscores.</li>
<li>Keep your password safe. You are responsible for what happens on your account.</li>
<li>One person, one account. Please do not create extra accounts to get around a ban, to play against yourself or to change your rating.</li>
<li>You can ask us to delete your account at any time (see section 14).</li>
</ul>

<h3>4. How to behave</h3>
<p>Be kind. You must not:</p>
<ul>
<li>use a username, bio, profile picture or any other content that is hateful, harassing, threatening, sexual, shows violence, impersonates someone, or breaks the law;</li>
<li>post other people's private information;</li>
<li>spam, advertise or promote other sites through names, bios or pictures;</li>
<li>try to break, overload, scrape or get unauthorized access to the Service, other accounts or our servers;</li>
<li>exploit bugs to gain ratings, scores or achievements, and you must report serious bugs to us instead.</li>
</ul>

<h3>5. Fair play</h3>
<p>Games must be played honestly. You must not:</p>
<ul>
<li>use chess engines, opening or endgame databases, other people or any outside help during a rated or unrated game against another player (using the analyzer after a game is fine, and playing the bot is of course fine);</li>
<li>let someone else play on your account or play from two accounts in the same game;</li>
<li>lose on purpose, team up, trade results or otherwise manipulate ratings, leaderboards or achievements ("sandbagging" and "boosting");</li>
<li>repeatedly abandon games, stall, or refuse to finish games you are losing;</li>
<li>in Hand &amp; Brain team games, break the role rules (for example, the Brain making moves or the Hand choosing the piece type).</li>
</ul>
<p>We review reports and games, and appropriate action is taken against rule-breaking (see section 8).</p>

<h3>6. Your content</h3>
<p>You own what you add to your profile (bio, picture, country and so on). By adding it you give us permission to store it and show it to other users of the Service as part of how the Service works. You promise you have the right to use it. Game results, ratings and records are shown to other signed-in players, and finished games can be opened with a public game link.</p>

<h3>7. Ratings, scores and records</h3>
<p>Ratings, leaderboards, achievements and statistics are for fun. We do not guarantee that they are always accurate. Bugs, outages, aborted or disconnected games, or fair-play decisions can affect them. We can correct, adjust or reset any rating, score or achievement, or remove an entry from a leaderboard, at any time, for example to fix an error or because of cheating.</p>

<h3>8. Moderation</h3>
<p>Staff may review reports and games, and may, at our discretion, remove content, change or remove a username, reset ratings, refund the rating opponents lost, restrict features, ban accounts from the website, either for a period of time or permanently, as we decide, and delete data tied to rule-breaking. Where practical we will explain why, but we are not required to. If you think we made a mistake, email ${mail()}.</p>

<h3>9. Donations and donor perks</h3>
<p>Pawniac is free. Donating is entirely voluntary. To donate, email ${mail()} to show your interest and we will let you know about the available payment methods. At the moment donors get a gradient on their username that is visible to other users. This is a thank-you, not a purchase:</p>
<ul>
<li>Donations are non-refundable, except where the law says otherwise.</li>
<li>A donation does not give you ownership of, or any right in, the Service, and does not protect you from the rules or from moderation.</li>
<li>We may change, replace or remove donor perks, and we may remove a perk if the account breaks these Terms.</li>
<li>We do not guarantee the Service will exist forever. Please only donate an amount you are happy to give.</li>
</ul>

<h3>10. The Service is provided "as is"</h3>
<p>Pawniac is a hobby project. It is provided "as is" and "as available", without promises of any kind, express or implied. It can be slow, change, break, lose data or go offline at any time, with or without notice. We do not promise that it will be error-free, secure, or always available, or that your account, games or stats will always be kept.</p>

<h3>11. Third-party services</h3>
<p>The Service uses third-party services to work, such as Google Firebase (accounts and database), Google and Discord sign-in, and content from other providers (see the Privacy Policy). Their own terms apply when you use them. We are not responsible for them.</p>

<h3>12. Ownership and open-source credits</h3>
<p>The Pawniac name, logo, design and website code belong to Rishit. You may not copy the Service as your own or use the name or logo without permission. Pawniac also uses open-source and openly licensed work, including: the chess.js library; the Stockfish chess engine; the "Cburnett" chess piece images; and the open Lichess openings list. These remain under their own licences.</p>

<h3>13. Limits on our responsibility</h3>
<p>To the fullest extent the law allows, we are not responsible for any indirect, incidental or consequential loss, or for loss of data, ratings, achievements, time or profits, arising from your use of the Service. Our total responsibility for any claim relating to the Service is limited to the amount you paid us in the 12 months before the claim (which for most users is nothing). Nothing in these Terms limits any responsibility that cannot legally be limited.</p>

<h3>14. Ending your use</h3>
<p>You can stop using Pawniac at any time. To delete your account and data, email ${mail()} from the address you signed up with. We can suspend or end your access if you break these Terms or if we need to stop the Service. Sections that by their nature should continue (such as 6, 7, 10, 12, 13 and 16) continue after your account ends.</p>

<h3>15. Changes</h3>
<p>We may update these Terms from time to time. The "last updated" date at the top shows when. If you keep using Pawniac after a change, you accept the new Terms. For big changes we will try to post a notice on the site.</p>

<h3>16. Governing law</h3>
<p>These Terms are governed by the laws of ${esc(LAW)}, without regard to its conflict-of-law rules. Any dispute will be handled in the courts of ${esc(LAW)}, unless the law where you live gives you the right to go elsewhere.</p>

<h3>17. Contact</h3>
<p>Questions, reports, legal notices and deletion requests: ${mail()}.</p>`;

  var PRIV = `
<h3>1. The short version</h3>
<p>We collect only what Pawniac needs to run: your account, your games and scores, and some information that helps keep play fair. There are no ads, we do not sell your data and we do not use advertising trackers. Your email is never shown to other players.</p>

<h3>2. Who is responsible</h3>
<p>Rishit (an individual), operating Pawniac at pawniac.fun, is responsible for your data. Contact: ${mail()}.</p>

<h3>3. What we collect</h3>
<p><b>Account.</b> Your email address and sign-in method (email and password, Google or Discord). Passwords are handled by Google Firebase Authentication: we never see or store your password. If you use Discord, we receive your Discord ID and username. We also store your chosen username.</p>
<p><b>Game data.</b> Your games (moves, results, players, time control, move times), ratings, win/loss/draw records, game numbers and history, leaderboard entries, minigame and quiz scores, achievements and counters (such as games played and daily streaks).</p>
<p><b>Profile.</b> The things you add: bio, profile picture, country, and the date you joined.</p>
<p><b>Activity and status.</b> Whether you are online, idle or in a game, which game you are in, whether you are searching for a match, challenges you send or receive, and short-lived presence information while you are connected.</p>
<p><b>Fair-play and safety.</b> Reports you send or that are made about you, and information about how games are played that helps us keep play fair.</p>
<p><b>On your device.</b> Your settings, theme, bot and challenge preferences, saved piece images, the opening list and the chess engine are stored in your browser (local storage and cache). Your last game is remembered so you can come back to it. This stays on your device.</p>

<h3>3a. What we do not collect</h3>
<p>We do not collect your location, contacts, phone number, real name, payment details or advertising IDs. There is no in-game chat. The PGNs you paste into the analyzer and the engine analysis run in your browser and are not uploaded. Games against the bot are not stored.</p>

<h3>4. What other people can see</h3>
<p>Other signed-in players can see: your username, any title, profile picture, bio, country, join date, ratings, records, leaderboard scores, pinned achievements, recent games, online status, and which live game you are in (and can watch it). Finished games can be opened by anyone who has their link. Your email, reports about you and fair-play information are never public. Only staff can see them.</p>

<h3>5. Why we use it</h3>
<ul>
<li>To run the game: accounts, matchmaking, games, ratings, leaderboards, profiles and achievements.</li>
<li>To keep the site safe and fair: reports, moderation and fair-play review.</li>
<li>To fix bugs and keep the site working.</li>
</ul>
<p>We do not use your data for advertising or profiling, and we do not sell or rent it.</p>

<h3>6. Third parties that handle data</h3>
<ul>
<li><b>Google Firebase</b> (Authentication and Realtime Database): stores your account and all game data described above.</li>
<li><b>Google and Discord</b> sign-in, if you choose them. A small login service hosted on Cloudflare exchanges the Discord sign-in code for a login token.</li>
<li><b>Content providers</b> your browser loads files from, which can see your IP address when they do: Google Fonts, cdnjs and jsDelivr / unpkg (code libraries and the chess engine), Wikimedia Commons (chess piece images), flagcdn (country flags) and GitHub (the opening list).</li>
</ul>
<p>These companies have their own privacy policies. Your data may be processed in countries other than yours.</p>

<h3>7. Cookies and local storage</h3>
<p>We do not use advertising or tracking cookies. Firebase and your browser store login information and the settings listed above so the site can work. You can clear this in your browser settings, but you will be logged out and lose local settings.</p>

<h3>8. How long we keep data</h3>
<p>We keep your account and game data until you ask us to delete it or we remove the account. Short-lived data (online status, challenges, matchmaking entries) is removed automatically or soon after you leave. Reports and related records are kept as long as they are useful for moderation.</p>

<h3>9. Your choices and rights</h3>
<p>You can edit or remove your bio, picture and country on your profile at any time, and clear your local data in your browser. You can ask us to show you, correct or delete your data, or to delete your account, by emailing ${mail()} from the address you signed up with. If you live where privacy laws (such as GDPR or similar) give you additional rights, such as access, correction, deletion, objection or complaint to an authority, you can use them by contacting us. Deleting an account removes your profile and personal records, but a game you played against someone else may be kept without your username attached, or with your username as it appears in their history, so that their history stays complete.</p>

<h3>10. Children</h3>
<p>Pawniac is open to everyone and is designed to collect very little. There is no public chat, and we do not ask for real names, locations or phone numbers. Parents and guardians can ask us to see or delete a child's data at any time at ${mail()}.</p>

<h3>11. Security</h3>
<p>We rely on Google Firebase's security and on database rules that limit who can read and write data. No website is perfectly secure, so please use a strong, unique password.</p>

<h3>12. Changes</h3>
<p>We may update this policy. The "last updated" date shows when. For big changes we will try to post a notice on the site.</p>

<h3>13. Contact</h3>
<p>Privacy questions or requests: ${mail()}.</p>`;

  var scrT = document.createElement('div');
  scrT.id = 'screen-terms';
  scrT.style.display = 'none';
  document.querySelector('.wrap').appendChild(scrT);

  var LG = 'tos';
  function renderLegal(kind){
    LG = (kind === 'privacy') ? 'privacy' : 'tos';
    showScreen('terms');
    var isT = LG === 'tos';
    scrT.innerHTML =
      '<div class="card"><h2>' + (isT ? 'Terms of Service' : 'Privacy Policy') + '</h2>' +
      '<p class="hint" style="margin:0 0 12px;">Pawniac &middot; Last updated ' + esc(UPDATED) + '</p>' +
      '<div class="ac-tabs"><div class="ac-tab' + (isT ? ' active' : '') + '" data-lg="tos">Terms of Service</div><div class="ac-tab' + (!isT ? ' active' : '') + '" data-lg="privacy">Privacy Policy</div></div>' +
      '<div class="lg">' + (isT ? TOS : PRIV) + '</div></div>';
    scrT.querySelectorAll('[data-lg]').forEach(function(t){ t.onclick = function(){ renderLegal(t.dataset.lg); }; });
    addBack(scrT);
    try{ history.replaceState(null, '', location.pathname + location.search + '#/' + (isT ? 'terms' : 'privacy')); }catch(e){}
    window.scrollTo(0, 0);
  }
  window.renderTerms = function(){ renderLegal('tos'); };
  window.renderPrivacy = function(){ renderLegal('privacy'); };

  // =====================================================================
  //  wiring: screen, nav, footer, login notice, links
  // =====================================================================
  var nav = $('navbar');
  var prevShow = window.showScreen;
  window.showScreen = function(n){
    prevShow(n);
    scrT.style.display = (n === 'terms') ? 'block' : 'none';
    if(n === 'terms'){
      nav.querySelectorAll('[data-nav]').forEach(function(a){ a.classList.toggle('active', a.dataset.nav === 'help'); });
    }
    if((n === 'terms' || n === 'help') && !loggedIn()) nav.style.display = 'none';
  };

  function inActiveGame(){
    var s = $('screen-game');
    return !!s && s.style.display === 'block' && typeof gameState !== 'undefined' && !!gameState && gameState.status === 'active';
  }
  function openPublic(fn){
    if(loggedIn() && inActiveGame() && !confirm('Your clock keeps running while you are away. Leave the game view?')) return;
    if(typeof stopPoll === 'function') stopPoll();
    fn();
  }

  // footer on every page
  var foot = document.createElement('div');
  foot.id = 'pnFooter';
  foot.innerHTML = '&copy; Pawniac <span class="sep">&middot;</span> <a data-f="help">Help</a><span class="sep">&middot;</span><a data-f="tos">Terms of Service</a><span class="sep">&middot;</span><a data-f="privacy">Privacy Policy</a><br>Made by Rishit &middot; <a href="https://rishit.fun" target="_blank" rel="noopener">rishit.fun</a>';
  document.querySelector('.wrap').appendChild(foot);
  foot.querySelectorAll('[data-f]').forEach(function(a){
    a.onclick = function(){
      var k = a.dataset.f;
      openPublic(function(){ if(k === 'help') window.renderHelp(); else renderLegal(k); });
    };
  });

  // note under the login / sign-up buttons
  var prevAuth = window.renderAuthScreen;
  window.renderAuthScreen = function(err){
    prevAuth.apply(this, arguments);
    try{
      var card = document.querySelector('#screen-auth .card');
      if(!card || card.querySelector('.au-agree')) return;
      var p = document.createElement('div');
      p.className = 'au-agree';
      p.innerHTML = 'By signing up or logging in you agree to the <a data-f2="tos">Terms of Service</a> and <a data-f2="privacy">Privacy Policy</a>.';
      card.appendChild(p);
      p.querySelectorAll('[data-f2]').forEach(function(a){
        a.style.cursor = 'pointer';
        a.onclick = function(){ renderLegal(a.dataset.f2); };
      });
    }catch(e){ console.error('agree note failed', e); }
  };

  // links: #/terms and #/privacy (the existing #/help link already uses renderHelp)
  var RT = /^#\/(terms|privacy)\/?$/i;
  window.addEventListener('hashchange', function(){
    var m = RT.exec(location.hash);
    if(!m || !loggedIn()) return;
    if(scrT.style.display === 'block' && LG === m[1].toLowerCase().replace('terms', 'tos')) return;
    openPublic(function(){ renderLegal(m[1].toLowerCase()); });
  });
  var boot = true, prevAfter = window.afterAuth;
  window.afterAuth = async function(){
    var h = boot ? location.hash : '';
    boot = false;
    var r = await prevAfter.apply(this, arguments);
    try{
      var m = RT.exec(h), gs = $('screen-game');
      if(m && !(gs && gs.style.display === 'block')) renderLegal(m[1].toLowerCase());
    }catch(e){ console.error(e); }
    return r;
  };
})();
