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

const changeTurn = () => {
  currentColor = 3 - currentColor;

  if (currentColor === 1) {
    currentTurnText.textContent = "黒";
    updateTurnColor('黒');
  } else {
    currentTurnText.textContent = "白";
    updateTurnColor('白');
    // AIのターン(白)に移るときにAIの動作を実行
    setTimeout(() => {
      const legalMoves = getLegalMoves(stoneStateList, currentColor);
      console.log("AIの合法手:", legalMoves);  // AIが打てる手をデバッグ用に表示する
      if (legalMoves.length > 0) {
        const bestMove = findBestMove(stoneStateList, currentColor);
        if (bestMove) {
          onClickSquare(bestMove.row * 8 + bestMove.col);
        }
      } else {
        if (getLegalMoves(stoneStateList, 3 - currentColor).length === 0) {
          alert("ゲーム終了");
          declareWinner();
        } else {
          // AIがパスする場合
          alert("AIはパスします");
          changeTurn();
        }
      }
    }, 500); // 0.5秒待ってからAIの手を打つ
  }
};

const getLegalMoves = (board, player) => {
  let legalMoves = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i] === 0 && getReversibleStones(i, player).length > 0) {
      legalMoves.push({ row: Math.floor(i / 8), col: i % 8 });
    }
  }
  return legalMoves;
};

const minimax = (board, depth, maximizingPlayer, player) => {
  if (depth === 0 || isGameOver(board)) {
    return evaluateBoard(board, player);
  }

  const opponent = 3 - player;
  let bestEval = maximizingPlayer ? -Infinity : Infinity;
  const legalMoves = getLegalMoves(board, player);

  for (let move of legalMoves) {
    const newBoard = makeMove([...board], player, move.row, move.col);
    const eval = minimax(newBoard, depth - 1, !maximizingPlayer, opponent);
    bestEval = maximizingPlayer ? Math.max(bestEval, eval) : Math.min(bestEval, eval);
  }
  return bestEval;
};

const findBestMove = (board, player) => {
  let bestMove = null;
  let bestValue = -Infinity;
  const legalMoves = getLegalMoves(board, player);
  const corners = [0, 7, 56, 63]; // 各角のインデックス

  // 盤面の空き数に応じて探索深度を調整
  const remainingEmpty = stoneStateList.filter(stone => stone === 0).length;
  let depth = remainingEmpty > 15 ? 6 : 8;

  for (let move of legalMoves) {
    const newBoard = makeMove([...board], player, move.row, move.col);
    let moveValue = minimax(newBoard, depth - 1, false, 3 - player);

    const moveIndex = move.row * 8 + move.col;

    // 角に直接置ける場合にボーナスを追加
    if (corners.includes(moveIndex)) {
      return move; // 角が置けるなら即座にその手を選択
    }

    if (scoreMatrix[moveIndex] < -1000) {
      moveValue -= 1000000; // C-squareに配置しないために大きなペナルティを課す
    }

    // 相手が角を取れる可能性がある手を防ぐためにボーナスを追加
    if (wouldOpponentTakeCorner(newBoard, move, player)) {
      moveValue += 80000; // 相手の角取りを阻止する手に高評価を追加
    }

    if (moveValue > bestValue) {
      bestValue = moveValue;
      bestMove = move;
    }
  }

  return bestMove;
};

const wouldOpponentTakeCorner = (board, move, player) => {
  const opponent = 3 - player;
  const newBoard = makeMove([...board], player, move.row, move.col);
  const opponentMoves = getLegalMoves(newBoard, opponent);
  const corners = [0, 7, 56, 63];
  const cSquares = [1, 6, 8, 9, 14, 15, 48, 49, 55, 57, 62];

  for (let oppMove of opponentMoves) {
    const moveIndex = oppMove.row * 8 + oppMove.col;
    if (corners.includes(moveIndex)) {
      return true;
    }
    if (cSquares.includes(moveIndex)) {
      return true;
    }
  }
  return false;
};

const evaluateBoard = (board, player) => {
  let score = 0;
  const opponent = 3 - player;
  const corners = [0, 7, 56, 63];
  const cSquares = [1, 6, 8, 9, 14, 15, 48, 49, 55, 57, 62];

  for (let i = 0; i < board.length; i++) {
    if (board[i] === player) {
      score += scoreMatrix[i];
    } else if (board[i] === opponent) {
      score -= scoreMatrix[i];
    }
  }

  for (let corner of corners) {
    if (board[corner] === 0) {
      const lines = getLinesToCorner(corner);
      for (let line of lines) {
        if (isPotentialCornerTakeover(board, line, opponent)) {
          const movesToBlock = getBlockingMoves(board, line, player);
          for (let move of movesToBlock) {
            score += 100000;
          }
        }
      }
    }
  }

  for (let cSquare of cSquares) {
    if (board[cSquare] === player) {
      score -= 1000;
    } else if (board[cSquare] === opponent) {
      score += 1000;
    }
  }

  for (let i = 0; i < board.length; i++) {
    if (board[i] === player && isFrontier(board, i)) {
      score -= 100;
    }
  }

  // 周囲の石の数をカウントして評価に加える
  for (let i = 0; i < board.length; i++) {
    if (board[i] === player) {
      score += countSurroundingStones(board, i) * 50; // 周囲の石の数に応じたボーナスを追加
    }
  }

  return score;
};

// 周囲の石の数を数える関数
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
  const directions = [-1, 1, -8, 8, -9, 9, -7, 7]; // 8方向への移動
  for (let direction of directions) {
    const neighbor = index + direction;
    if (neighbor >= 0 && neighbor < 64 && board[neighbor] === 0) {
      return true; // 周囲に空のマスがある場合はフロンティア
    }
  }
  return false; // 周囲に空のマスがない場合はフロンティアでない
};

const isPotentialCornerTakeover = (board, line, opponent) => {
  let hasOpponentStones = false;
  for (let i = 0; i < line.length; i++) {
    if (board[line[i]] === opponent) {
      hasOpponentStones = true;
    } else if (board[line[i]] === 0) {
      return false;
    }
  }
  return hasOpponentStones;
};

const getBlockingMoves = (board, line, player) => {
  let blockingMoves = [];
  for (let i = 0; i < line.length; i++) {
    if (board[line[i]] === 0) {
      const newBoard = makeMove([...board], player, Math.floor(line[i] / 8), line[i] % 8);
      if (!isPotentialCornerTakeover(newBoard, line, 3 - player)) {
        blockingMoves.push({ row: Math.floor(line[i] / 8), col: line[i] % 8 });
      }
    }
  }
  if(blockingMoves.length > 0){
    console.log("Blocking moves identified:", blockingMoves); // デバッグ用出力
  }
  return blockingMoves;
};

const makeMove = (board, player, row, col) => {
  const index = row * 8 + col;
  const reversibleStones = getReversibleStones(index, player);
  board[index] = player;
  reversibleStones.forEach((stoneIndex) => {
    board[stoneIndex] = player;
  });
  return board;
};

const getReversibleStones = (idx, player = currentColor) => {
  //クリックしたマスから見て、各方向にマスがいくつあるかをあらかじめ計算する
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
  //for文ループの規則を定めるためのパラメータ定義
  const parameters = [1, 9, 8, 7, -1, -9, -8, -7];

  //ひっくり返せることが確定した石の情報を入れる配列
  let results = [];

  //8方向への走査のためのfor文
  for (let i = 0; i < 8; i++) {
    //ひっくり返せる可能性のある石の情報を入れる配列
    const box = [];
    //現在調べている方向にいくつマスがあるか
    const squareNum = squareNums[i];
    const param = parameters[i];
    let currentIdx = idx + param;

    //隣に石があるか 及び 隣の石が相手の色か -> どちらでもない場合は次のループへ
    if (currentIdx < 0 || currentIdx >= 64 || stoneStateList[currentIdx] === 0 || stoneStateList[currentIdx] === player) continue;
    //隣の石の番号を仮ボックスに格納
    box.push(currentIdx);

    //さらに隣に石があるかを調査
    for (let j = 0; j < squareNum - 1; j++) {
      currentIdx += param;
      if (currentIdx < 0 || currentIdx >= 64) break;
      const targetColor = stoneStateList[currentIdx];
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

const onClickSquare = (index) => {
  const reversibleStones = getReversibleStones(index);
  console.log("onClickSquare: reversibleStones", reversibleStones); // デバッグ用

  if (stoneStateList[index] !== 0 || !reversibleStones.length) {
    alert("ここには置けないよ！");
    return;
  }

  stoneStateList[index] = currentColor;
  document
    .querySelector(`[data-index='${index}']`)
    .setAttribute("data-state", currentColor);

  reversibleStones.forEach((key) => {
    stoneStateList[key] = currentColor;
    document.querySelector(`[data-index='${key}']`).setAttribute("data-state", currentColor);
  });

  console.log("石を置いた後の盤面:", stoneStateList);  // デバッグ用に盤面の状態を表示

  if (stoneStateList.every((state) => state !== 0)) {
    declareWinner();
    return;
  }

  changeTurn();
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
};

const resetBoard = () => {
  initializeBoard();
  document.querySelectorAll('.stone').forEach((stone, index) => {
    stone.setAttribute("data-state", stoneStateList[index]);
  });
  currentColor = 1;
  currentTurnText.textContent = '黒';
  updateTurnColor('黒');
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
