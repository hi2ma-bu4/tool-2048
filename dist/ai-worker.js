"use strict";
(() => {
  // src/game/game.ts
  var SIZE = 4;
  function operateRow(row, mergeLimit) {
    const newRow = row.filter((val) => val !== 0);
    let score = 0;
    for (let i = 0; i < newRow.length - 1; i++) {
      if (newRow[i] === newRow[i + 1] && newRow[i] < mergeLimit) {
        newRow[i] *= 2;
        score += newRow[i];
        newRow.splice(i + 1, 1);
      }
    }
    while (newRow.length < SIZE) {
      newRow.push(0);
    }
    return { newRow, score };
  }
  function transpose(matrix) {
    return matrix[0].map((_, colIndex) => matrix.map((row) => row[colIndex]));
  }
  function simulateMove(currentBoard, direction, mergeLimit) {
    let tempBoard = currentBoard.map((row) => [...row]);
    let moveScore = 0;
    const originalBoardStr = JSON.stringify(tempBoard);
    if (direction === "up" || direction === "down") {
      tempBoard = transpose(tempBoard);
    }
    for (let i = 0; i < SIZE; i++) {
      let row = tempBoard[i];
      if (direction === "right" || direction === "down") {
        row.reverse();
      }
      const result = operateRow(row, mergeLimit);
      if (direction === "right" || direction === "down") {
        result.newRow.reverse();
      }
      tempBoard[i] = result.newRow;
      moveScore += result.score;
    }
    if (direction === "up" || direction === "down") {
      tempBoard = transpose(tempBoard);
    }
    const boardChanged = JSON.stringify(tempBoard) !== originalBoardStr;
    return { board: tempBoard, score: moveScore, moved: boardChanged };
  }
  function getEmptyCells(board) {
    const cells = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (board[r][c] === 0) {
          cells.push({ r, c });
        }
      }
    }
    return cells;
  }

  // src/ai/evaluation.ts
  var SIZE2 = 4;
  var log2Cache = {};
  function getLog2(val) {
    if (val === 0) return 0;
    if (!log2Cache[val]) {
      log2Cache[val] = Math.log2(val);
    }
    return log2Cache[val];
  }
  function evaluateBoard(currentBoard, weights) {
    const emptyCells = getEmptyCells(currentBoard).length;
    const maxTileValue = Math.max(...currentBoard.flat());
    const smoothness = calculateSmoothness(currentBoard);
    const monotonicity = calculateMonotonicity(currentBoard);
    const maxTileBonus = isMaxTileInCorner(currentBoard, maxTileValue) ? maxTileValue : 0;
    return smoothness * weights.smoothness + monotonicity * weights.monotonicity + getLog2(emptyCells + 1) * weights.emptyCells + maxTileBonus * weights.maxTile;
  }
  function calculateSmoothness(currentBoard) {
    let smoothness = 0;
    for (let r = 0; r < SIZE2; r++) {
      for (let c = 0; c < SIZE2; c++) {
        const tileValue = currentBoard[r][c];
        if (tileValue !== 0) {
          if (c < SIZE2 - 1 && currentBoard[r][c + 1] !== 0) {
            smoothness -= Math.abs(getLog2(tileValue) - getLog2(currentBoard[r][c + 1]));
          }
          if (r < SIZE2 - 1 && currentBoard[r + 1][c] !== 0) {
            smoothness -= Math.abs(getLog2(tileValue) - getLog2(currentBoard[r + 1][c]));
          }
        }
      }
    }
    return smoothness;
  }
  function calculateMonotonicity(currentBoard) {
    let totals = [0, 0, 0, 0];
    for (let r = 0; r < SIZE2; r++) {
      const nonZeroLogs = currentBoard[r].map(getLog2).filter((v) => v > 0);
      if (nonZeroLogs.length < 2) continue;
      for (let i = 0; i < nonZeroLogs.length - 1; i++) {
        if (nonZeroLogs[i] > nonZeroLogs[i + 1]) {
          totals[2] += nonZeroLogs[i + 1] - nonZeroLogs[i];
        } else if (nonZeroLogs[i + 1] > nonZeroLogs[i]) {
          totals[3] += nonZeroLogs[i] - nonZeroLogs[i + 1];
        }
      }
    }
    for (let c = 0; c < SIZE2; c++) {
      const column = currentBoard.map((row) => row[c]);
      const nonZeroLogs = column.map(getLog2).filter((v) => v > 0);
      if (nonZeroLogs.length < 2) continue;
      for (let i = 0; i < nonZeroLogs.length - 1; i++) {
        if (nonZeroLogs[i] > nonZeroLogs[i + 1]) {
          totals[0] += nonZeroLogs[i + 1] - nonZeroLogs[i];
        } else if (nonZeroLogs[i + 1] > nonZeroLogs[i]) {
          totals[1] += nonZeroLogs[i] - nonZeroLogs[i + 1];
        }
      }
    }
    return Math.max(totals[0], totals[1]) + Math.max(totals[2], totals[3]);
  }
  function isMaxTileInCorner(currentBoard, maxTile) {
    const corners = [currentBoard[0][0], currentBoard[0][SIZE2 - 1], currentBoard[SIZE2 - 1][0], currentBoard[SIZE2 - 1][SIZE2 - 1]];
    return corners.includes(maxTile);
  }
  var SNAKE_PATTERN_WEIGHTS = [
    [15, 14, 13, 12],
    [8, 9, 10, 11],
    [7, 6, 5, 4],
    [0, 1, 2, 3]
  ].map((row) => row.map((w) => Math.pow(4, w)));
  function rotateMatrix(matrix) {
    const N = matrix.length;
    const result = Array.from({ length: N }, () => Array(N).fill(0));
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        result[c][N - 1 - r] = matrix[r][c];
      }
    }
    return result;
  }
  function getPatternScore(board, pattern) {
    let score = 0;
    for (let r = 0; r < SIZE2; r++) {
      for (let c = 0; c < SIZE2; c++) {
        if (board[r][c] !== 0) {
          score += getLog2(board[r][c]) * pattern[r][c];
        }
      }
    }
    return score;
  }
  function evaluatePattern(currentBoard, weights) {
    let bestScore = 0;
    let currentPattern = SNAKE_PATTERN_WEIGHTS;
    for (let i = 0; i < 4; i++) {
      bestScore = Math.max(bestScore, getPatternScore(currentBoard, currentPattern));
      currentPattern = rotateMatrix(currentPattern);
    }
    const emptyCells = getEmptyCells(currentBoard).length;
    return bestScore + getLog2(emptyCells + 1) * weights.emptyCells;
  }
  var SNAKE_PATTERN_WEIGHTS_SINGLE = [
    [10, 8, 7, 6.5],
    [-0.5, 0.7, 1.5, 3],
    [-1.5, -1, 1, 2],
    [-3, -2, -1.5, -1]
  ];
  function evaluateSnakePattern(board) {
    let score = 0;
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        score += SNAKE_PATTERN_WEIGHTS_SINGLE[i][j] * board[i][j];
      }
    }
    return score;
  }

  // src/ai/ai-worker.ts
  var evaluationFunctions = {
    heuristic: evaluateBoard,
    pattern: evaluatePattern,
    snake: (board) => evaluateSnakePattern(board)
    // snake doesn't use weights
  };
  self.onmessage = (e) => {
    const { algorithm, move, board, searchDepth, heuristicWeights, mergeLimit } = e.data;
    const memo = /* @__PURE__ */ new Map();
    const evaluationFunction = evaluationFunctions[algorithm];
    if (!evaluationFunction) {
      throw new Error(`Unknown algorithm: ${algorithm}`);
    }
    const score = expectimax(board, searchDepth - 1, false, memo, evaluationFunction, heuristicWeights, mergeLimit);
    self.postMessage({ move, score });
  };
  function expectimax(currentBoard, depth, isPlayerTurn, memo, evaluationFunction, weights, mergeLimit) {
    const boardKey = JSON.stringify(currentBoard);
    if (memo.has(boardKey)) {
      return memo.get(boardKey);
    }
    if (depth === 0) {
      return evaluationFunction(currentBoard, weights);
    }
    let resultScore;
    if (isPlayerTurn) {
      let maxScore = -Infinity;
      const moves = ["up", "down", "left", "right"];
      for (const move of moves) {
        const simResult = simulateMove(currentBoard, move, mergeLimit);
        if (simResult.moved) {
          maxScore = Math.max(maxScore, expectimax(simResult.board, depth - 1, false, memo, evaluationFunction, weights, mergeLimit));
        }
      }
      resultScore = maxScore === -Infinity ? 0 : maxScore;
    } else {
      const emptyCells = getEmptyCells(currentBoard);
      if (emptyCells.length === 0) {
        return expectimax(currentBoard, depth - 1, true, memo, evaluationFunction, weights, mergeLimit);
      }
      let totalScore = 0;
      for (const cell of emptyCells) {
        const boardWith2 = currentBoard.map((row) => [...row]);
        boardWith2[cell.r][cell.c] = 2;
        totalScore += 0.9 * expectimax(boardWith2, depth - 1, true, memo, evaluationFunction, weights, mergeLimit);
        const boardWith4 = currentBoard.map((row) => [...row]);
        boardWith4[cell.r][cell.c] = 4;
        totalScore += 0.1 * expectimax(boardWith4, depth - 1, true, memo, evaluationFunction, weights, mergeLimit);
      }
      resultScore = totalScore / emptyCells.length;
    }
    memo.set(boardKey, resultScore);
    return resultScore;
  }
})();
