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
	if (algorithm === "heuristic") {
		// 従来のヒューリスティック評価
		const memo = new Map();
		score = expectimax(board, searchDepth - 1, false, memo);
	} else if (algorithm === "mcts") {
		// モンテカルロ木探索
		const simulations = searchDepth; // MCTSでは探索深度をシミュレーション回数として扱う
		score = runMCTS(board, simulations);
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
		for (const move of moves) {
			const simResult = simulateMove(currentBoard, move);
			if (simResult.moved) {
				maxScore = Math.max(maxScore, expectimax(simResult.board, depth - 1, false, memo));
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
			return expectimax(currentBoard, depth - 1, true, memo);
		}

		let totalScore = 0;
		for (const cell of emptyCells) {
			// 2が90%の確率で出現
			const newBoard2 = currentBoard.map((row) => [...row]);
			newBoard2[cell.r][cell.c] = 2;
			totalScore += 0.9 * expectimax(newBoard2, depth - 1, true, memo);

			// 4が10%の確率で出現
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

	return smoothness * HEURISTIC_WEIGHTS.smoothness + monotonicity * HEURISTIC_WEIGHTS.monotonicity + Math.log(emptyCells + 1) * HEURISTIC_WEIGHTS.emptyCells + maxTileBonus * HEURISTIC_WEIGHTS.maxTile;
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

	// 左右の単調性
	for (let r = 0; r < size; r++) {
		let currentIdx = 0;
		const currentRow = currentBoard[r];
		while (currentIdx < size - 1) {
			// 現在地から最初の非ゼロタイルを探す
			while (currentIdx < size - 1 && currentRow[currentIdx] === 0) currentIdx++;

			let nextIdx = currentIdx + 1;
			// 次の非ゼロタイルを探す
			while (nextIdx < size && currentRow[nextIdx] === 0) nextIdx++;

			if (nextIdx >= size) break;

			const currentValue = getLog2(currentRow[currentIdx]);
			const nextValue = getLog2(currentRow[nextIdx]);

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
		while (currentIdx < size - 1) {
			// 現在地から最初の非ゼロタイルを探す
			while (currentIdx < size - 1 && currentBoard[currentIdx][c] === 0) currentIdx++;

			let nextIdx = currentIdx + 1;
			// 次の非ゼロタイルを探す
			while (nextIdx < size && currentBoard[nextIdx][c] === 0) nextIdx++;

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

// =========================================================================
// モンテカルロ木探索 (MCTS) - 改良版
// 深いランダムプレイアウトの代わりに、限定的なプレイアウトとヒューリスティック評価を組み合わせる
// =========================================================================

const PLAYOUT_DEPTH = 5; // ランダムプレイアウトを行う手数

function runMCTS(initialBoard, simulations) {
	let totalScore = 0;
	for (let i = 0; i < simulations; i++) {
		// 初期盤面をコピーしてプレイアウトに使用
		const boardCopy = initialBoard.map((row) => [...row]);
		totalScore += runRandomPlayout(boardCopy);
	}
	return totalScore / simulations;
}

function runRandomPlayout(board) {
	let currentBoard = board; // メインループでコピーされた盤面を直接変更する
	let playoutScore = 0;
	let isGameOver = false;

	// 固定された手数 (PLAYOUT_DEPTH) だけ、ランダムにゲームを進める
	const moves = ["up", "down", "left", "right"];
	for (let i = 0; i < PLAYOUT_DEPTH && !isGameOver; i++) {
		const validMoves = [];

		// 有効な手をすべて見つける
		for (const move of moves) {
			const simResult = simulateMove(currentBoard, move);
			if (simResult.moved) {
				validMoves.push(simResult); // board, score, moved を含むオブジェクト
			}
		}

		if (validMoves.length > 0) {
			// 有効な手の中からランダムに一つ選ぶ
			const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
			currentBoard = randomMove.board;
			playoutScore += randomMove.score; // マージによるスコアを加算

			// 新しいタイルをランダムに追加
			const emptyCells = getEmptyCells(currentBoard);
			if (emptyCells.length > 0) {
				const { r, c } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
				currentBoard[r][c] = Math.random() < 0.9 ? 2 : 4;
			} else {
				// 空きマスがなければ、このプレイアウトはここで終了
				isGameOver = true;
			}
		} else {
			// 有効な手がなければゲームオーバー
			isGameOver = true;
		}
	}

	// プレイアウト後の盤面をヒューリスティック関数で評価し、
	// プレイアウト中に得たスコアと合算する。
	return playoutScore + evaluateBoard(currentBoard);
}
