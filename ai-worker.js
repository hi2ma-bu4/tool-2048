// =========================================================================
// AI Worker - for heavy calculations
// =========================================================================

let size = 4;
let HEURISTIC_WEIGHTS = {};
let MERGE_LIMIT = 2048;

// メインスレッドからのメッセージを受信
self.onmessage = function (e) {
	const { algorithm, move, board, searchDepth, heuristicWeights, mergeLimit } = e.data;
	HEURISTIC_WEIGHTS = heuristicWeights;
	MERGE_LIMIT = mergeLimit;

	let score;
	const memo = new Map();
	if (algorithm === "heuristic") {
		// 従来のヒューリスティック評価
		score = expectimax(board, searchDepth - 1, false, memo, evaluateBoard);
	} else if (algorithm === "pattern") {
		// パターンベース評価
		score = expectimax(board, searchDepth - 1, false, memo, evaluatePattern);
	} else if (algorithm === "snake") {
		// Snake Pattern評価
		score = expectimax(board, searchDepth - 1, false, memo, evaluateSnakePattern);
	}

	self.postMessage({ move, score });
};

// --- ゲームロジックのコア部分 (Worker内で完結させるため) ---

function operateRow(row) {
	let newRow = row.filter((val) => val);
	let newScore = 0;

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

	return { newRow, score: newScore };
}

function transpose(matrix) {
	return matrix[0].map((_, colIndex) => matrix.map((row) => row[colIndex]));
}

function simulateMove(currentBoard, direction) {
	let tempBoard = currentBoard.map((row) => [...row]);
	let moveScore = 0;
	const originalBoardStr = tempBoard.toString();

	if (direction === "up" || direction === "down") {
		tempBoard = transpose(tempBoard);
	}

	for (let i = 0; i < size; i++) {
		let row = tempBoard[i];
		if (direction === "right" || direction === "down") {
			row.reverse();
		}
		const result = operateRow(row);
		if (direction === "right" || direction === "down") {
			result.newRow.reverse();
		}
		tempBoard[i] = result.newRow;
		moveScore += result.score;
	}

	if (direction === "up" || direction === "down") {
		tempBoard = transpose(tempBoard);
	}

	const boardChanged = tempBoard.toString() !== originalBoardStr;
	return { board: tempBoard, score: moveScore, moved: boardChanged };
}

// =========================================================================
// AIの中核部分
// =========================================================================

/**
 * Expectimaxアルゴリズムの本体 (再帰関数)
 * @param {Array} currentBoard - 評価対象の盤面
 * @param {number} depth - 残りの探索の深さ
 * @param {boolean} isPlayerTurn - true:プレイヤーの番(Max), false:コンピュータの番(Chance)
 * @returns {number} この盤面の評価値
 */
function expectimax(currentBoard, depth, isPlayerTurn, memo, evaluationFunction) {
	const boardKey = currentBoard.toString();
	if (memo.has(boardKey)) {
		return memo.get(boardKey);
	}

	if (depth === 0) {
		return evaluationFunction(currentBoard);
	}

	let resultScore;
	if (isPlayerTurn) {
		// プレイヤーのターン: 最善の手を見つける (Max)
		let maxScore = -Infinity;
		const moves = ["up", "down", "left", "right"];
		for (const move of moves) {
			const simResult = simulateMove(currentBoard, move);
			if (simResult.moved) {
				maxScore = Math.max(maxScore, expectimax(simResult.board, depth - 1, false, memo, evaluationFunction));
			}
		}
		resultScore = maxScore === -Infinity ? 0 : maxScore;
	} else {
		// コンピュータのターン: 全ての可能性の平均を計算 (Expectation)
		const emptyCells = getEmptyCells(currentBoard);
		// このターンで空きマスがない場合、それはプレイヤーの次の手でゲームオーバーになることを意味する。
		// ただし、盤面が埋まっていてもマージできる可能性はあるため、プレイヤーのターンに切り替えて評価を続行させる。
		if (emptyCells.length === 0) {
			// プレイヤーのターンに切り替えることで、実際に移動可能かどうかの判定を行わせる。
			// ゲームオーバーの判定はプレイヤーのターンロジックが担当する。
			// ここで depth - 1 しないと無限再帰に陥る可能性があるので注意。
			return expectimax(currentBoard, depth - 1, true, memo, evaluationFunction);
		}

		let totalScore = 0;
		// 盤面のコピーをループの外で行う最適化は、再帰呼び出しでボードが変更される可能性があるため、
		// 各ケースで独立したコピーを維持する方が安全で、バグのリスクが低い。
		// 可読性と安全性を優先し、現状のロジックを維持する。
		// ただし、コードの意図を明確にするため、コメントを追加する。
		for (const cell of emptyCells) {
			// 2が追加されるケース (確率90%)
			const boardWith2 = currentBoard.map((row) => [...row]);
			boardWith2[cell.r][cell.c] = 2;
			totalScore += 0.9 * expectimax(boardWith2, depth - 1, true, memo, evaluationFunction);

			// 4が追加されるケース (確率10%)
			const boardWith4 = currentBoard.map((row) => [...row]);
			boardWith4[cell.r][cell.c] = 4;
			totalScore += 0.1 * expectimax(boardWith4, depth - 1, true, memo, evaluationFunction);
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

// Math.log2の計算結果をキャッシュ
const log2Cache = {};
function getLog2(val) {
	if (val === 0) return 0; // 0の場合は0を返す
	if (!log2Cache[val]) {
		log2Cache[val] = Math.log2(val);
	}
	return log2Cache[val];
}

// =========================================================================
// AIの「頭脳」となる評価関数 (Heuristics)
// =========================================================================

/**
 * 盤面の「良さ」を総合的に評価して数値を返す
 * @param {Array} currentBoard - 評価対象の盤面
 * @returns {number} 評価スコア
 */
function evaluateBoard(currentBoard) {
	const emptyCells = getEmptyCells(currentBoard).length;
	const maxTileValue = Math.max(...currentBoard.flat());

	const smoothness = calculateSmoothness(currentBoard);
	const monotonicity = calculateMonotonicity(currentBoard);
	const maxTileBonus = isMaxTileInCorner(currentBoard, maxTileValue) ? maxTileValue : 0;

	return smoothness * HEURISTIC_WEIGHTS.smoothness + monotonicity * HEURISTIC_WEIGHTS.monotonicity + getLog2(emptyCells + 1) * HEURISTIC_WEIGHTS.emptyCells + maxTileBonus * HEURISTIC_WEIGHTS.maxTile;
}

/**
 * 平滑性 (Smoothness): 隣り合うタイルの値がどれだけ近いかを評価。
 * 値が近いほどマージしやすいため高評価 (ペナルティが少ない)。
 */
function calculateSmoothness(currentBoard) {
	let smoothness = 0;
	for (let r = 0; r < size; r++) {
		const currentRow = currentBoard[r];
		for (let c = 0; c < size; c++) {
			const tileValue = currentRow[c];
			if (tileValue !== 0) {
				// 右隣
				if (c < size - 1 && currentBoard[r][c + 1] !== 0) {
					smoothness -= Math.abs(getLog2(tileValue) - getLog2(currentRow[c + 1]));
				}
				// 下隣
				if (r < size - 1 && currentBoard[r + 1][c] !== 0) {
					smoothness -= Math.abs(getLog2(tileValue) - getLog2(currentBoard[r + 1][c]));
				}
			}
		}
	}
	return smoothness;
}

/**
 * 単調性 (Monotonicity): タイルが各行・各列で単調に増加または減少しているかを評価。
 * 綺麗に並んでいるほど高評価。
 */
function calculateMonotonicity(currentBoard) {
	let totals = [0, 0, 0, 0]; // up, down, left, right

	// 左右の単調性 (最適化版)
	for (let r = 0; r < size; r++) {
		const nonZeroLogs = currentBoard[r].map(getLog2).filter((v) => v > 0);
		if (nonZeroLogs.length < 2) continue;

		for (let i = 0; i < nonZeroLogs.length - 1; i++) {
			const currentLog = nonZeroLogs[i];
			const nextLog = nonZeroLogs[i + 1];
			if (currentLog > nextLog) {
				totals[2] += nextLog - currentLog; // 左方向へのペナルティ (値が減少)
			} else if (nextLog > currentLog) {
				totals[3] += currentLog - nextLog; // 右方向へのペナルティ (値が増加)
			}
		}
	}

	// 上下の単調性 (最適化版)
	for (let c = 0; c < size; c++) {
		const column = [];
		for (let r = 0; r < size; r++) {
			column.push(currentBoard[r][c]);
		}
		const nonZeroLogs = column.map(getLog2).filter((v) => v > 0);
		if (nonZeroLogs.length < 2) continue;

		for (let i = 0; i < nonZeroLogs.length - 1; i++) {
			const currentLog = nonZeroLogs[i];
			const nextLog = nonZeroLogs[i + 1];
			if (currentLog > nextLog) {
				totals[0] += nextLog - currentLog; // 上方向へのペナルティ (値が減少)
			} else if (nextLog > currentLog) {
				totals[1] += currentLog - nextLog; // 下方向へのペナルティ (値が増加)
			}
		}
	}

	return Math.max(totals[0], totals[1]) + Math.max(totals[2], totals[3]);
}

function isMaxTileInCorner(currentBoard, maxTile) {
	const corners = [currentBoard[0][0], currentBoard[0][size - 1], currentBoard[size - 1][0], currentBoard[size - 1][size - 1]];
	return corners.includes(maxTile);
}

// =========================================================================
// パターンベースの評価関数 (新アルゴリズム)
// =========================================================================

// 蛇行パターンの重み。指数的に重みを付けることで、大きなタイルが正しい位置にあることを強く推奨する。
const SNAKE_PATTERN_WEIGHTS = [
	[15, 14, 13, 12],
	[8, 9, 10, 11],
	[7, 6, 5, 4],
	[0, 1, 2, 3],
].map((row) => row.map((w) => Math.pow(4, w)));

const SNAKE_PATTERN_WEIGHTS_SINGLE = [
    [10, 8, 7, 6.5],
    [-.5, .7, 1.5, 3],
    [-1.5, -1, 1, 2],
    [-3, -2, -1.5, -1]
];

function evaluateSnakePattern(board) {
    let score = 0;
    // Snake pattern weights
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            score += SNAKE_PATTERN_WEIGHTS_SINGLE[i][j] * board[i][j];
        }
    }
    return score;
}

/**
 * 行列を90度回転させる
 */
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

/**
 * 特定のパターンに対する盤面のスコアを計算する
 */
function getPatternScore(board, pattern) {
	let score = 0;
	for (let r = 0; r < size; r++) {
		for (let c = 0; c < size; c++) {
			if (board[r][c] !== 0) {
				// タイルの値の対数とパターンの重みを乗算する
				score += getLog2(board[r][c]) * pattern[r][c];
			}
		}
	}
	return score;
}

/**
 * パターン評価: 蛇行パターンにどれだけ近いかを評価する
 * 4つの回転をすべて試し、最もスコアが高いものをその盤面の評価値とする。
 */
function evaluatePattern(currentBoard) {
	let bestScore = 0;
	let currentPattern = SNAKE_PATTERN_WEIGHTS;

	// 4つの回転方向をすべて試す
	for (let i = 0; i < 4; i++) {
		bestScore = Math.max(bestScore, getPatternScore(currentBoard, currentPattern));
		currentPattern = rotateMatrix(currentPattern);
	}

	// パターンスコアに加えて、空きマスボーナスも加算する (重要)
	const emptyCells = getEmptyCells(currentBoard).length;
	// 既存のヒューリスティックの重みを流用
	return bestScore + Math.log2(emptyCells + 1) * HEURISTIC_WEIGHTS.emptyCells;
}
