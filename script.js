(async function () {
  const root = document.querySelector('.re-puzzle');
  if (!root) return;
  const files = 'abcdefgh';
  const symbols = { w:{k:'♔',q:'♕',r:'♖',b:'♗',n:'♘',p:'♙'}, b:{k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'} };
  const boardEl = root.querySelector('.re-board');
  const status = root.querySelector('.re-status');
  const evalBox = root.querySelector('.re-eval');
  const evalBar = root.querySelector('.re-eval-white');
  const evalLabel = root.querySelector('.re-eval-label strong');
  const explanation = root.querySelector('.re-explanation');
  const retry = root.querySelector('.re-retry');
  const solutionToggle = root.querySelector('.re-solution-toggle');
  const answer = root.querySelector('.re-answer');
  const fen = root.dataset.fen;
  const solution = root.dataset.solution;
  let Chess;
  try { ({ Chess } = await import('https://cdn.jsdelivr.net/npm/chess.js@1.4.0/dist/esm/chess.js')); }
  catch (err) { status.textContent = 'Impossible de charger les règles d’échecs. Rechargez la page et vérifiez votre connexion.'; return; }
  let game = new Chess(fen), selected = null, lastMove = null, attempted = false, engine = null, engineStarted = false;
  function piecesFromFen(position) {
    const out = [];
    position.split(' ')[0].split('/').forEach((rank, row) => {
      let col = 0;
      for (const ch of rank) {
        if (/\d/.test(ch)) col += Number(ch);
        else { out.push({ square: files[col] + (8-row), color: ch === ch.toUpperCase() ? 'w' : 'b', type: ch.toLowerCase() }); col++; }
      }
    });
    return out;
  }
  function render() {
    boardEl.innerHTML = '';
    const pieces = piecesFromFen(game.fen());
    for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
      const square = files[col] + (8-row);
      const piece = pieces.find(p => p.square === square);
      const cell = document.createElement('button');
      cell.type = 'button'; cell.className = 're-square ' + ((row+col)%2 ? 'dark' : 'light');
      cell.setAttribute('aria-label', square + (piece ? ', ' + piece.type : ''));
      if (selected === square) cell.classList.add('selected');
      if (lastMove && (lastMove.from === square || lastMove.to === square)) cell.classList.add('last');
      if (piece) { const span = document.createElement('span'); span.className = 're-piece ' + (piece.color === 'w' ? 'white' : 'black'); span.textContent = symbols[piece.color][piece.type]; cell.appendChild(span); }
      cell.addEventListener('click', () => onSquare(square));
      boardEl.appendChild(cell);
    }
  }
  function onSquare(square) {
    if (attempted) return;
    const piece = game.get(square);
    if (!selected) { if (piece && piece.color === 'w') selected = square; render(); return; }
    if (piece && piece.color === 'w') { selected = square; render(); return; }
    const from = selected; selected = null;
    let move = null;
    try { move = game.move({ from, to:square, promotion:'q' }); } catch (_) {}
    if (!move) { render(); return; }
    attempted = true; lastMove = { from, to:square }; retry.disabled = false; solutionToggle.hidden = false; render();
    if (move.from + move.to === solution) {
      status.textContent = 'Excellent ! Vous avez trouvé le meilleur coup.'; status.className = 're-status correct';
      explanation.hidden = false; explanation.textContent = 'La tour élimine le pion passé noir avant sa promotion. Vous avez trouvé le coup décisif.';
      evaluatePosition();
    } else {
      status.textContent = 'Ce n’est pas le meilleur coup. Observez les conséquences, puis recommencez pour chercher une autre possibilité.'; status.className = 're-status wrong';
      explanation.hidden = false; explanation.textContent = 'Votre coup ne neutralise pas suffisamment la menace du pion noir avancé. Il faut calculer son potentiel de promotion.';
      evaluatePosition();
    }
  }
  function evaluatePosition() {
    evalBox.hidden = false; evalLabel.textContent = 'analyse en cours…';
    if (!engineStarted) {
      engineStarted = true;
      try {
        engine = new Worker('https://cdn.jsdelivr.net/npm/stockfish@19.0.1/stockfish-19-lite-single.js');
        engine.onmessage = e => {
          const line = String(e.data || '');
          if (line === 'uciok') { engine.postMessage('isready'); return; }
          if (line === 'readyok') { engine.postMessage('position fen ' + game.fen()); engine.postMessage('go depth 12'); return; }
          const cp = line.match(/score cp (-?\d+)/), mate = line.match(/score mate (-?\d+)/);
          if (cp || mate) {
            let score = cp ? -Number(cp[1])/100 : (Number(mate[1]) > 0 ? 10 : -10);
            evalLabel.textContent = mate ? (score > 0 ? 'mat forcé pour les Blancs' : 'mat forcé pour les Noirs') : (score > 0 ? '+' : '') + score.toFixed(2);
            evalBar.style.width = Math.max(3, Math.min(97, 50 + score*7)) + '%';
          }
        };
        engine.onerror = () => { evalLabel.textContent = 'analyse indisponible'; };
        engine.postMessage('uci');
      } catch (_) { evalLabel.textContent = 'analyse indisponible'; }
    } else if (engine) { engine.postMessage('stop'); engine.postMessage('position fen ' + game.fen()); engine.postMessage('go depth 12'); }
  }
  retry.addEventListener('click', () => {
    game = new Chess(fen); selected = null; lastMove = null; attempted = false;
    status.className = 're-status'; status.textContent = 'À vous de jouer. Sélectionnez une pièce blanche puis sa case de destination.';
    evalBox.hidden = true; explanation.hidden = true; retry.disabled = true; solutionToggle.hidden = true; answer.hidden = true; solutionToggle.textContent = 'Afficher la solution'; render();
  });
  solutionToggle.addEventListener('click', () => { answer.hidden = !answer.hidden; solutionToggle.textContent = answer.hidden ? 'Afficher la solution' : 'Masquer la solution'; });
  render();
})();