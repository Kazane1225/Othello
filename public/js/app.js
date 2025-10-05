// === Othello / Reversi 強化AI（フル置き換え版） ===================================

const stage = document.getElementById("stage");
const squareTemplate = document.getElementById("square-template");
const stoneStateList = [];
let currentColor = 1;
const currentTurnText = document.getElementById("current-turn");
const passButton = document.getElementById("pass");
const surrenderButton = document.getElementById("surrender");
let blackStonesNum = 0;
let whiteStonesNum = 0;
let winnerText;
let isPlayerTurn = true;

// 位置評価行列（元コードを尊重してそのまま使用）
const scoreMatrix = [
  1000000000, -500000000000, -500, 5000, 5000, -500, -500000000000, 1000000000,
  -500000000000, -500000000000, -200, -200, -200, -200, -5000000000, -500000000000,
  -500, -200, 10, 10, 10, 10, -200, -500,
  5000, -200, 10, 5, 5, 10, -200, 5000,
  5000, -200, 10, 5, 5, 10, -200, 5000,
  -500, -200, 10, 10, 10, 10, -200, -500,
  -500000000000, -500000000000, -200, -200, -200, -200, -50000000000, -500000000000,
  1000000000, -500000000000, -500, 5000, 5000, -500, -500000000000, 1000000000
];

const corners = [0, 7, 56, 63];
const cSquares = [1, 6, 8, 9, 14, 15, 48, 49, 55, 57, 62];

// ------------------------------------------------------------
// ターン制御
// ------------------------------------------------------------
const changeTurn = () => {
  currentColor = 3 - currentColor;
  isPlayerTurn = false;
  if (currentColor === 1) {
    currentTurnText.textContent = "黒";
    updateTurnColor('黒');
    isPlayerTurn = true;
  } else {
    currentTurnText.textContent = "白";
    updateTurnColor('白');
    isPlayerTurn = false;
    aiMove();
  }
};

// ------------------------------------------------------------
/** その盤面で player が置ける合法手を返す */
const getLegalMoves = (board, player) => {
  const legalMoves = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i] === 0 && getReversibleStones(board, i, player).length > 0) {
      legalMoves.push({ row: Math.floor(i / 8), col: i % 8 });
    }
  }
  return legalMoves;
};

// ------------------------------------------------------------
// α–β枝刈り付き minimax
// ------------------------------------------------------------
const minimax = (board, depth, alpha, beta, maximizingPlayer, player) => {
  if (depth === 0 || isGameOver(board)) {
    return evaluateBoard(board, player);
  }

  const legalMoves = getLegalMoves(board, player);

  // パス処理：合法手がない場合は相手ターンに移動
  if (legalMoves.length === 0) {
    // 相手も打てなければ終了
    if (getLegalMoves(board, 3 - player).length === 0) {
      return evaluateBoard(board, player);
    }
    return minimax(board, depth - 1, alpha, beta, !maximizingPlayer, 3 - player);
  }

  if (maximizingPlayer) {
    let bestEval = -Infinity;
    for (const move of legalMoves) {
      const newBoard = makeMove([...board], player, move.row, move.col);
      const val = minimax(newBoard, depth - 1, alpha, beta, false, 3 - player);
      bestEval = Math.max(bestEval, val);
      alpha = Math.max(alpha, val);
      if (beta <= alpha) break; // 枝刈り
    }
    return bestEval;
  } else {
    let bestEval = Infinity;
    for (const move of legalMoves) {
      const newBoard = makeMove([...board], player, move.row, move.col);
      const val = minimax(newBoard, depth - 1, alpha, beta, true, 3 - player);
      bestEval = Math.min(bestEval, val);
      beta = Math.min(beta, val);
      if (beta <= alpha) break; // 枝刈り
    }
    return bestEval;
  }
};

// ------------------------------------------------------------
// ベストムーブ探索（角優先・危険回避＋αβ使用・動的深度）
// ------------------------------------------------------------
const findBestMove = (board, player) => {
  let bestMove = null;
  let bestValue = -Infinity;

  const legalMoves = getLegalMoves(board, player);
  if (legalMoves.length === 0) return null;

  // 空き数で深さを動的調整（終盤ほど深く読む）
  const remainingEmpty = board.filter(v => v === 0).length;
  let depth;
  if (remainingEmpty > 20) depth = 5;
  else if (remainingEmpty > 10) depth = 7;
  else depth = 9;

  // 角が打てるなら即採用
  for (const m of legalMoves) {
    const idx = m.row * 8 + m.col;
    if (corners.includes(idx)) {
      return m;
    }
  }

  // 相手に角を渡す危険手を排除（セーフムーブ抽出）
  const safeMoves = [];
  for (const move of legalMoves) {
    if (!wouldOpponentTakeCorner(board, move, player)) {
      safeMoves.push(move);
    }
  }
  const movesToConsider = safeMoves.length > 0 ? safeMoves : legalMoves;

  for (const move of movesToConsider) {
    const newBoard = makeMove([...board], player, move.row, move.col);

    // Cマス（角の隣の危険マス）への強ペナルティ
    const moveIndex = move.row * 8 + move.col;
    let immediatePenalty = 0;
    if (cSquares.includes(moveIndex)) {
      immediatePenalty -= 1_000_000;
    }

    const moveValue = minimax(newBoard, depth - 1, -Infinity, Infinity, false, 3 - player) + immediatePenalty;

    if (moveValue > bestValue || bestMove === null) {
      bestValue = moveValue;
      bestMove = move;
    }
  }

  return bestMove;
};

// 相手が次手で角やCに到達できるかの簡易チェック
const wouldOpponentTakeCorner = (board, move, player) => {
  const opponent = 3 - player;
  const newBoard = makeMove([...board], player, move.row, move.col);
  const opponentMoves = getLegalMoves(newBoard, opponent);
  for (const oppMove of opponentMoves) {
    const idx = oppMove.row * 8 + oppMove.col;
    if (corners.includes(idx)) return true;
    if (cSquares.includes(idx)) return true;
  }
  return false;
};

// ------------------------------------------------------------
// 評価関数（位置＋モビリティ＋安定石＋終盤駒差）
// ------------------------------------------------------------
const evaluateBoard = (board, player) => {
  const opponent = 3 - player;
  let score = 0;

  // 位置スコア
  for (let i = 0; i < 64; i++) {
    if (board[i] === player) score += scoreMatrix[i];
    else if (board[i] === opponent) score -= scoreMatrix[i];
  }

  // モビリティ（合法手の多さ）
  const myMoves = getLegalMoves(board, player).length;
  const oppMoves = getLegalMoves(board, opponent).length;
  if (myMoves + oppMoves !== 0) {
    score += 100 * (myMoves - oppMoves);
  }

  // 安定石（ここでは角のみ確定とみなす簡易版）
  const myStable = countStableStones(board, player);
  const oppStable = countStableStones(board, opponent);
  score += (myStable - oppStable) * 300;

  // Cマス（角の隣）ペナルティ / ボーナス
  for (const c of cSquares) {
    if (board[c] === player) score -= 1000;
    else if (board[c] === opponent) score += 1000;
  }

  // フロンティア石（空きに接する自石はやや減点）
  for (let i = 0; i < 64; i++) {
    if (board[i] === player && isFrontier(board, i)) {
      score -= 100;
    }
  }

  // 終盤は駒差を重視
  const empty = board.filter(v => v === 0).length;
  if (empty < 10) {
    const myPieces = countPieces(board, player);
    const oppPieces = countPieces(board, opponent);
    score += (myPieces - oppPieces) * 200;
  }

  return score;
};

const countStableStones = (board, player) => {
  // 簡易版：角を取っている分だけ
  let stable = 0;
  for (const c of corners) {
    if (board[c] === player) stable++;
  }
  return stable;
};

const countPieces = (board, player) => board.filter(v => v === player).length;

// ------------------------------------------------------------
// 角関連の補助（元コードを活かしたまま使用）
// ------------------------------------------------------------

// 周囲の石の数を数える関数（評価内で使用）
const countSurroundingStones = (board, index) => {
  const directions = [-1, 1, -8, 8, -9, 9, -7, 7]; // 8方向
  let count = 0;
  for (let direction of directions) {
    const neighbor = index + direction;
    if (neighbor >= 0 && neighbor < 64 && board[neighbor] !== 0) {
      count++;
    }
  }
  return count;
};

// 角の位置から各ラインのインデックスを返す関数
const getLinesToCorner = (corner) => {
  switch (corner) {
    case 0: return [[1, 2, 3, 4, 5, 6], [8, 16, 24, 32, 40, 48], [9, 18, 27, 36, 45, 54]];
    case 7: return [[6, 5, 4, 3, 2, 1], [15, 23, 31, 39, 47, 55], [14, 21, 28, 35, 42, 49]];
    case 56: return [[48, 40, 32, 24, 16, 8], [57, 58, 59, 60, 61, 62], [49, 42, 35, 28, 21, 14]];
    case 63: return [[55, 47, 39, 31, 23, 15], [62, 61, 60, 59, 58, 57], [54, 45, 36, 27, 18, 9]];
    default: return [];
  }
};

const isFrontier = (board, index) => {
  const directions = [-1, 1, -8, 8, -9, 9, -7, 7];
  for (let direction of directions) {
    const neighbor = index + direction;
    if (neighbor >= 0 && neighbor < 64 && board[neighbor] === 0) {
      return true;
    }
  }
  return false;
};

const isPotentialCornerTakeover = (board, line, opponent) => {
  let hasOpponentStones = false;
  let canTakeCorner = false;

  for (let i = 0; i < line.length; i++) {
    if (board[line[i]] === opponent) {
      hasOpponentStones = true;
    } else if (board[line[i]] === 0) {
      if (hasOpponentStones) {
        const potentialBoard = [...board];
        potentialBoard[line[i]] = opponent; // 仮に相手が次に置く
        if (canTakeWithMove(potentialBoard, line[i], opponent)) {
          canTakeCorner = true;
        }
      }
      break;
    } else {
      if (hasOpponentStones) {
        return true;
      } else {
        return false;
      }
    }
  }
  return canTakeCorner;
};

// 指定の位置に石を置いた場合に角を取れるかどうかをチェックする補助関数
const canTakeWithMove = (board, index, player) => {
  const directions = [-1, 1, -8, 8, -9, 9, -7, 7];
  for (let direction of directions) {
    let currentIdx = index + direction;
    let hasOpponentStone = false;
    while (currentIdx >= 0 && currentIdx < 64) {
      if (board[currentIdx] === 3 - player) {
        hasOpponentStone = true;
      } else if (board[currentIdx] === player) {
        if (hasOpponentStone) return true;
        else break;
      } else {
        break;
      }
      currentIdx += direction;
    }
  }
  return false;
};

const getBlockingMoves = (board, line, player) => {
  const blockingMoves = [];
  for (let i = 0; i < line.length; i++) {
    if (board[line[i]] === 0) {
      const newBoard = makeMove([...board], player, Math.floor(line[i] / 8), line[i] % 8);
      if (!isPotentialCornerTakeover(newBoard, line, 3 - player)) {
        blockingMoves.push({ row: Math.floor(line[i] / 8), col: line[i] % 8 });
      }
    }
  }
  if (blockingMoves.length > 0) {
    console.log("Blocking moves identified:", blockingMoves);
  }
  return blockingMoves;
};

// ------------------------------------------------------------
// 盤面操作
// ------------------------------------------------------------
const makeMove = (board, player, row, col) => {
  const index = row * 8 + col;
  const reversibleStones = getReversibleStones(board, index, player);
  board[index] = player;
  reversibleStones.forEach((stoneIndex) => {
    board[stoneIndex] = player;
  });
  return board;
};

// ★重要：board依存の実装に修正（後方互換も確保）
/**
 * getReversibleStones(boardOrIndex, idxOrPlayer, playerOpt)
 * - 通常は (board, idx, player) で使用
 * - 旧UI互換： (idx) / (idx, player) もOK（内部で stoneStateList を使う）
 */
const getReversibleStones = (boardOrIdx, idxOrPlayer, playerOpt) => {
  let board, idx, player;

  if (Array.isArray(boardOrIdx)) {
    board = boardOrIdx;
    idx = idxOrPlayer;
    player = playerOpt ?? currentColor;
  } else {
    // 後方互換：UIからの呼び出し（board省略）時はグローバル盤面を参照
    board = stoneStateList;
    idx = boardOrIdx;
    player = idxOrPlayer ?? currentColor;
  }

  // クリックしたマスから見て、各方向にマスがいくつあるかをあらかじめ計算する
  const squareNums = [
    7 - (idx % 8),
    Math.min(7 - (idx % 8), (56 + (idx % 8) - idx) / 8),
    (56 + (idx % 8) - idx) / 8,
    Math.min(idx % 8, (56 + (idx % 8) - idx) / 8),
    idx % 8,
    Math.min(idx % 8, (idx - (idx % 8)) / 8),
    (idx - (idx % 8)) / 8,
    Math.min(7 - (idx % 8), (idx - (idx % 8)) / 8),
  ];
  const parameters = [1, 9, 8, 7, -1, -9, -8, -7];

  let results = [];

  for (let i = 0; i < 8; i++) {
    const box = [];
    const squareNum = squareNums[i];
    const param = parameters[i];
    let currentIdx = idx + param;

    if (currentIdx < 0 || currentIdx >= 64 || board[currentIdx] === 0 || board[currentIdx] === player) continue;
    box.push(currentIdx);

    for (let j = 0; j < squareNum - 1; j++) {
      currentIdx += param;
      if (currentIdx < 0 || currentIdx >= 64) break;
      const targetColor = board[currentIdx];
      if (targetColor === 0) break;
      if (targetColor === player) {
        results = results.concat(box);
        break;
      } else {
        box.push(currentIdx);
      }
    }
  }
  return results;
};

// ------------------------------------------------------------
// AI手番
// ------------------------------------------------------------
const aiMove = () => {
  setTimeout(() => {
    const legalMoves = getLegalMoves(stoneStateList, currentColor);
    console.log("AIの合法手:", legalMoves);

    if (legalMoves.length > 0) {
      const bestMove = findBestMove(stoneStateList, currentColor);
      if (bestMove) {
        console.log("AI moves to:", bestMove);
        makeMoveAndUpdateDisplay(bestMove.row * 8 + bestMove.col);
      } else {
        console.log("No valid move found by findBestMove");
      }
    } else {
      if (getLegalMoves(stoneStateList, 3 - currentColor).length === 0) {
        alert("ゲーム終了");
        declareWinner();
        isPlayerTurn = true;
      } else {
        alert("AIはパスします");
        changeTurn();
      }
    }
  }, 500);
};

// ------------------------------------------------------------
// 表示更新
// ------------------------------------------------------------
const makeMoveAndUpdateDisplay = (index) => {
  const reversibleStones = getReversibleStones(index);
  console.log("makeMoveAndUpdateDisplay: reversibleStones", reversibleStones);

  stoneStateList[index] = currentColor;
  document.querySelector(`[data-index='${index}']`).setAttribute("data-state", currentColor);

  reversibleStones.forEach((key) => {
    stoneStateList[key] = currentColor;
    document.querySelector(`[data-index='${key}']`).setAttribute("data-state", currentColor);
  });
  console.log("石を置いた後の盤面:", stoneStateList);

  if (stoneStateList.every((state) => state !== 0)) {
    declareWinner();
  } else {
    changeTurn();
  }
};

const onClickSquare = (index) => {
  console.log("onClickSquare called with index:", index);
  if (!isPlayerTurn) {
    alert("AIのターン中は操作できません！");
    return;
  }
  const reversibleStones = getReversibleStones(index);
  if (stoneStateList[index] !== 0 || !reversibleStones.length) {
    alert("ここには置けないよ！");
    return;
  }
  makeMoveAndUpdateDisplay(index);
};

const createSquares = () => {
  stage.innerHTML = "";
  initializeBoard();
  for (let i = 0; i < 64; i++) {
    const square = squareTemplate.cloneNode(true);
    square.removeAttribute("id");
    stage.appendChild(square);

    const stone = square.querySelector('.stone');
    stone.setAttribute("data-state", stoneStateList[i]);
    stone.setAttribute("data-index", i);

    square.addEventListener('click', () => {
      onClickSquare(i);
    });
  }
};

const isGameOver = (board) => {
  return getLegalMoves(board, 1).length === 0 && getLegalMoves(board, 2).length === 0;
};

const initializeBoard = () => {
  stoneStateList.length = 0;
  for (let i = 0; i < 64; i++) {
    if (i === 27 || i === 36) {
      stoneStateList.push(1);
    } else if (i === 28 || i === 35) {
      stoneStateList.push(2);
    } else {
      stoneStateList.push(0);
    }
  }
  currentColor = 1;
  currentTurnText.textContent = "黒";
  updateTurnColor("黒");
  isPlayerTurn = true;
};

const resetBoard = () => {
  initializeBoard();
  document.querySelectorAll('.stone').forEach((stone, index) => {
    stone.setAttribute("data-state", stoneStateList[index]);
  });
  currentColor = 1;
  currentTurnText.textContent = '黒';
  updateTurnColor('黒');
  isPlayerTurn = true;
};

const surrender = () => {
  if (currentColor === 1) {
    winnerText = "白の勝ちです！";
  } else {
    winnerText = "黒の勝ちです！";
  }
  alert(`${currentTurnText.textContent}が降参しました。${winnerText}`);
  resetBoard();
};

const declareWinner = () => {
  blackStonesNum = stoneStateList.filter(state => state === 1).length;
  whiteStonesNum = stoneStateList.filter(state => state === 2).length;

  if (blackStonesNum > whiteStonesNum) {
    winnerText = "黒の勝ちです！";
  } else if (blackStonesNum < whiteStonesNum) {
    winnerText = "白の勝ちです！";
  } else {
    winnerText = "引き分けです";
  }
  alert(`ゲーム終了です。白${whiteStonesNum}、黒${blackStonesNum}で、${winnerText}`);
  resetBoard();
};

window.onload = () => {
  createSquares();
  passButton.addEventListener("click", () => {
    if (getLegalMoves(stoneStateList, currentColor).length === 0) {
      changeTurn();
    } else {
      alert("合法手がまだあります！");
    }
  });
  surrenderButton.addEventListener("click", surrender);
};

