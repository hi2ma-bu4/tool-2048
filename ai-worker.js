// =========================================================================
// AI Worker - for heavy calculations
// =========================================================================

let size = 4;
let HEURISTIC_WEIGHTS = {};
let MERGE_LIMIT = 2048;

// メインスレッドからのメッセージを受信
self.onmessage = function(e) {
    const { move, board, searchDepth, heuristicWeights, mergeLimit } = e.data;
    HEURISTIC_WEIGHTS = heuristicWeights;
    MERGE_LIMIT = mergeLimit;

    // 計算を開始し、結果をメインスレッドに送信
    const memo = new Map();
    const score = expectimax(board, searchDepth - 1, false, memo);
    self.postMessage({ move, score });
};

// --- ゲームロジックのコア部分 (Worker内で完結させるため) ---

function operateRow(row) {
    const originalRowStr = row.join(',');
    let newRow = row.filter((val) => val);
    let newScore = 0;
    let changed = false;

    for (let i = 0; i < newRow.length - 1; i++) {
        if (newRow[i] === newRow[i + 1] && newRow[i] < MERGE_LIMIT) {
            newRow[i] *= 2;
            newScore += newRow[i];
            newRow.splice(i + 1, 1);
        }
    }
    while (newRow.length < size) {
        newRow.push(0);
    }

    if (originalRowStr !== newRow.join(',')) {
        changed = true;
    }

    return { newRow, score: newScore, changed };
}

function transpose(matrix) {
    return matrix[0].map((_, colIndex) => matrix.map((row) => row[colIndex]));
}

function simulateMove(currentBoard, direction) {
    let tempBoard = currentBoard.map((row) => [...row]);
    let moveScore = 0;
    let boardChanged = false;

    if (direction === "up" || direction === "down") tempBoard = transpose(tempBoard);

    for (let i = 0; i < size; i++) {
        let row = tempBoard[i];
        if (direction === "right" || direction === "down") row.reverse();

        const result = operateRow(row);

        if (result.changed) {
            boardChanged = true;
        }

        if (direction === "right" || direction === "down") result.newRow.reverse();

        tempBoard[i] = result.newRow;
        moveScore += result.score;
    }

    if (direction === "up" || direction === "down") tempBoard = transpose(tempBoard);

    return { board: tempBoard, score: moveScore, moved: boardChanged };
}


// =========================================================================
// AIの中核部分
// =========================================================================


/**
 * Expectimaxアルゴリズムの本体 (再帰関数)
 */
function expectimax(currentBoard, depth, isPlayerTurn, memo) {
    const boardKey = currentBoard.toString();
    if (memo.has(boardKey)) {
        return memo.get(boardKey);
    }

    if (depth === 0) {
        return evaluateBoard(currentBoard);
    }

    let resultScore;
    if (isPlayerTurn) {
        // プレイヤーのターン: 最善の手を見つける (Max)
        let maxScore = -Infinity;
        const moves = ["up", "down", "left", "right"];
        let hasMoved = false;
        for (const move of moves) {
            const simResult = simulateMove(currentBoard, move);
            if (simResult.moved) {
                hasMoved = true;
                maxScore = Math.max(maxScore, expectimax(simResult.board, depth - 1, false, memo));
            }
        }
        // 動ける手がない場合 (ゲームオーバー) は最低スコアを返す
        if (!hasMoved) {
            return -Infinity;
        }
        resultScore = maxScore;

    } else {
        // コンピュータのターン: 全ての可能性の平均を計算 (Expectation)
        const emptyCells = getEmptyCells(currentBoard);
        // このターンで空きマスがない場合、それはプレイヤーの次の手でゲームオーバーになることを意味する。
        // 評価はプレイヤーのターンで行うため、ここでは評価を続行する。
        if (emptyCells.length === 0) {
            return evaluateBoard(currentBoard);
        }

        let totalScore = 0;
        for (const cell of emptyCells) {
            const newBoard2 = currentBoard.map((row) => [...row]);
            newBoard2[cell.r][cell.c] = 2;
            totalScore += 0.9 * expectimax(newBoard2, depth - 1, true, memo);

            const newBoard4 = currentBoard.map((row) => [...row]);
            newBoard4[cell.r][cell.c] = 4;
            totalScore += 0.1 * expectimax(newBoard4, depth - 1, true, memo);
        }
        resultScore = totalScore / emptyCells.length;
    }

    memo.set(boardKey, resultScore);
    return resultScore;
}

/**
 * 盤面の空きマスを取得するヘルパー関数
 */
function getEmptyCells(currentBoard) {
    const cells = [];
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (currentBoard[r][c] === 0) {
                cells.push({ r, c });
            }
        }
    }
    return cells;
}


// =========================================================================
// AIの「頭脳」となる評価関数 (Heuristics)
// =========================================================================

function evaluateBoard(currentBoard) {
    const emptyCells = getEmptyCells(currentBoard).length;
    const maxTileValue = Math.max(...currentBoard.flat());

    const smoothness = calculateSmoothness(currentBoard);
    const monotonicity = calculateMonotonicity(currentBoard);
    const maxTileBonus = isMaxTileInCorner(currentBoard, maxTileValue) ? maxTileValue : 0;

    return (
        smoothness * HEURISTIC_WEIGHTS.smoothness +
        monotonicity * HEURISTIC_WEIGHTS.monotonicity +
        Math.log(emptyCells + 1) * HEURISTIC_WEIGHTS.emptyCells +
        maxTileBonus * HEURISTIC_WEIGHTS.maxTile
    );
}

function calculateSmoothness(currentBoard) {
    let smoothness = 0;
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const tileValue = currentBoard[r][c];
            if (tileValue !== 0) {
                if (c < size - 1 && currentBoard[r][c + 1] !== 0) {
                    smoothness -= Math.abs(Math.log2(tileValue) - Math.log2(currentBoard[r][c + 1]));
                }
                if (r < size - 1 && currentBoard[r + 1][c] !== 0) {
                    smoothness -= Math.abs(Math.log2(tileValue) - Math.log2(currentBoard[r + 1][c]));
                }
            }
        }
    }
    return smoothness;
}

// Math.log2の計算結果をキャッシュ
const log2Cache = {};
function getLog2(val) {
    if (val === 0) return 0; // 0の場合は0を返す
    if (!log2Cache[val]) {
        log2Cache[val] = Math.log2(val);
    }
    return log2Cache[val];
}

function calculateMonotonicity(currentBoard) {
    let totals = [0, 0, 0, 0]; // up, down, left, right

    // 左右の単調性
    for (let r = 0; r < size; r++) {
        let currentIdx = 0;
        while (currentIdx < size -1) {
            // 現在地から最初の非ゼロタイルを探す
            while(currentIdx < size - 1 && currentBoard[r][currentIdx] === 0) currentIdx++;

            let nextIdx = currentIdx + 1;
            // 次の非ゼロタイルを探す
            while(nextIdx < size && currentBoard[r][nextIdx] === 0) nextIdx++;

            if (nextIdx >= size) break;

            const currentValue = getLog2(currentBoard[r][currentIdx]);
            const nextValue = getLog2(currentBoard[r][nextIdx]);

            if (currentValue > nextValue) {
                totals[2] += nextValue - currentValue; // 左方向へのペナルティ
            } else if (nextValue > currentValue) {
                totals[3] += currentValue - nextValue; // 右方向へのペナルティ
            }
            currentIdx = nextIdx;
        }
    }

    // 上下の単調性
    for (let c = 0; c < size; c++) {
        let currentIdx = 0;
        while(currentIdx < size - 1) {
            // 現在地から最初の非ゼロタイルを探す
            while(currentIdx < size - 1 && currentBoard[currentIdx][c] === 0) currentIdx++;

            let nextIdx = currentIdx + 1;
            // 次の非ゼロタイルを探す
            while(nextIdx < size && currentBoard[nextIdx][c] === 0) nextIdx++;

            if (nextIdx >= size) break;

            const currentValue = getLog2(currentBoard[currentIdx][c]);
            const nextValue = getLog2(currentBoard[nextIdx][c]);

            if (currentValue > nextValue) {
                totals[0] += nextValue - currentValue; // 上方向へのペナルティ
            } else if (nextValue > currentValue) {
                totals[1] += currentValue - nextValue; // 下方向へのペナルティ
            }
            currentIdx = nextIdx;
        }
    }

    return Math.max(totals[0], totals[1]) + Math.max(totals[2], totals[3]);
}

function isMaxTileInCorner(currentBoard, maxTile) {
    const corners = [currentBoard[0][0], currentBoard[0][size - 1], currentBoard[size - 1][0], currentBoard[size - 1][size - 1]];
    return corners.includes(maxTile);
}