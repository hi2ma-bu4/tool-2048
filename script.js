let board = [];
document.addEventListener("DOMContentLoaded", () => {
	// DOM要素の取得
	const gridContainer = document.getElementById("grid-container");
	const scoreDisplay = document.getElementById("score");
	const bestMoveDisplay = document.getElementById("best-move");
	const calculateBtn = document.getElementById("calculate-btn");
	const resetBtn = document.getElementById("reset-btn");

	const size = 4;
	let score = 0;

	// =========================================================================
	// AIの設定
	// =========================================================================
	// AIが何手先まで読み込むか。数値を大きくすると賢くなるが計算時間が長くなる。
	// (3-4程度が妥当。5以上にすると環境によってはフリーズする可能性があります)
	const SEARCH_DEPTH = 5;

	// 評価関数で使う各要素の「重み」。これらのバランスでAIの戦略が変わる。
	const HEURISTIC_WEIGHTS = {
		smoothness: 0.1, // 平滑性: 隣接タイルの差が少ないほど良い
		monotonicity: 1.0, // 単調性: タイルが一方向に並んでいるほど良い
		emptyCells: 2.7, // 空きマス: 空きマスが多いほど良い
		maxTile: 1.0, // 最大タイル: 最大値のタイルが隅にあると良い
	};
	// =========================================================================

	// --- ゲームの基本機能 (前回と同様) ---

	function initializeBoard() {
		board = Array.from({ length: size }, () => Array(size).fill(0));
		score = 0;
		updateScore(0);
		bestMoveDisplay.textContent = "---";
		renderBoard();
	}

	function renderBoard() {
		gridContainer.innerHTML = "";
		for (let r = 0; r < size; r++) {
			for (let c = 0; c < size; c++) {
				const cell = document.createElement("div");
				cell.className = "grid-cell";
				const value = board[r][c];
				if (value !== 0) {
					cell.textContent = value;
					cell.classList.add(`tile-${value > 2048 ? "default" : value}`);
				}
				cell.dataset.row = r;
				cell.dataset.col = c;
				gridContainer.appendChild(cell);
			}
		}
	}

	function updateScore(newScore) {
		score = newScore;
		scoreDisplay.textContent = score;
	}

	gridContainer.addEventListener("click", (event) => {
		const cell = event.target.closest(".grid-cell");
		if (cell) {
			const row = parseInt(cell.dataset.row);
			const col = parseInt(cell.dataset.col);
			if (board[row][col] === 0) {
				board[row][col] = 2;
				renderBoard();
			}
		}
	});

	resetBtn.addEventListener("click", initializeBoard);
	calculateBtn.addEventListener("click", runAI);

	// --- ゲームのコアロジック ---

	function operateRow(row) {
		let newRow = row.filter((val) => val);
		let newScore = 0;
		for (let i = 0; i < newRow.length - 1; i++) {
			if (newRow[i] === newRow[i + 1]) {
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
		let tempBoard = JSON.parse(JSON.stringify(currentBoard));
		let moveScore = 0;
		let boardChanged = false;

		const originalBoardStr = JSON.stringify(tempBoard);

		if (direction === "up" || direction === "down") tempBoard = transpose(tempBoard);

		for (let i = 0; i < size; i++) {
			let row = tempBoard[i];
			if (direction === "right" || direction === "down") row.reverse();
			const result = operateRow(row);
			if (direction === "right" || direction === "down") result.newRow.reverse();
			tempBoard[i] = result.newRow;
			moveScore += result.score;
		}

		if (direction === "up" || direction === "down") tempBoard = transpose(tempBoard);

		if (JSON.stringify(tempBoard) !== originalBoardStr) {
			boardChanged = true;
		}

		return { board: tempBoard, score: moveScore, moved: boardChanged };
	}

	// =========================================================================
	// AIの中核部分
	// =========================================================================

	/**
	 * AIの実行を開始する関数
	 */
	function runAI() {
		bestMoveDisplay.textContent = "計算中...";
		const moveMap = {
			up: "上",
			down: "下",
			left: "左",
			right: "右",
			none: "動かせません",
		};

		// UIのフリーズを防ぐため、計算を少し遅延させて実行
		setTimeout(() => {
			const best = findBestMove();
			bestMoveDisplay.textContent = moveMap[best.move];

			if (best.move === "none") return;
			const result = simulateMove(board, best.move);
			board = result.board;
			updateScore((score += result.score));
			renderBoard();
		}, 50);
	}

	/**
	 * 最善手を見つけるための起点となる関数
	 */
	function findBestMove() {
		let bestScore = -Infinity;
		let bestMove = "none";
		const moves = ["up", "down", "left", "right"];

		for (const move of moves) {
			const simResult = simulateMove(board, move);
			if (simResult.moved) {
				// その動きが可能なら、Expectimax探索を開始する
				const score = expectimax(simResult.board, SEARCH_DEPTH, false); // 次はコンピュータの番
				if (score > bestScore) {
					bestScore = score;
					bestMove = move;
				}
			}
		}
		return { move: bestMove, score: bestScore };
	}

	/**
	 * Expectimaxアルゴリズムの本体 (再帰関数)
	 * @param {Array} currentBoard - 評価対象の盤面
	 * @param {number} depth - 残りの探索の深さ
	 * @param {boolean} isPlayerTurn - true:プレイヤーの番(Max), false:コンピュータの番(Chance)
	 * @returns {number} この盤面の評価値
	 */
	function expectimax(currentBoard, depth, isPlayerTurn) {
		if (depth === 0) {
			return evaluateBoard(currentBoard); // 深さの限界に達したら盤面を評価
		}

		if (isPlayerTurn) {
			// --- プレイヤーのターン (Max Node) ---
			// 可能な全ての手の中から、最も評価値が高くなるものを選ぶ
			let maxScore = -Infinity;
			const moves = ["up", "down", "left", "right"];
			for (const move of moves) {
				const simResult = simulateMove(currentBoard, move);
				if (simResult.moved) {
					maxScore = Math.max(maxScore, expectimax(simResult.board, depth - 1, false));
				}
			}
			return maxScore === -Infinity ? 0 : maxScore; // 動けない場合は評価0
		} else {
			// --- コンピュータのターン (Chance Node) ---
			// 全ての空きマスに2か4が出現する場合の「期待値」を計算する
			const emptyCells = getEmptyCells(currentBoard);
			if (emptyCells.length === 0) {
				return 0; // 空きマスがない=ゲームオーバー
			}

			let totalScore = 0;
			// 2が90%の確率で出現
			for (const cell of emptyCells) {
				const newBoard = JSON.parse(JSON.stringify(currentBoard));
				newBoard[cell.r][cell.c] = 2;
				totalScore += 0.9 * expectimax(newBoard, depth - 1, true);
			}
			// 4が10%の確率で出現
			for (const cell of emptyCells) {
				const newBoard = JSON.parse(JSON.stringify(currentBoard));
				newBoard[cell.r][cell.c] = 4;
				totalScore += 0.1 * expectimax(newBoard, depth - 1, true);
			}
			// 期待値を返す
			return totalScore / emptyCells.length;
		}
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

		// 各評価値を重み付けして合計する
		return (
			smoothness * HEURISTIC_WEIGHTS.smoothness +
			monotonicity * HEURISTIC_WEIGHTS.monotonicity +
			Math.log(emptyCells + 1) * HEURISTIC_WEIGHTS.emptyCells + // 0にならないように+1
			maxTileBonus * HEURISTIC_WEIGHTS.maxTile
		);
	}

	/**
	 * 平滑性 (Smoothness): 隣り合うタイルの値がどれだけ近いかを評価。
	 * 値が近いほどマージしやすいため高評価 (ペナルティが少ない)。
	 */
	function calculateSmoothness(currentBoard) {
		let smoothness = 0;
		for (let r = 0; r < size; r++) {
			for (let c = 0; c < size; c++) {
				const tileValue = currentBoard[r][c];
				if (tileValue !== 0) {
					// 右隣
					if (c < size - 1 && currentBoard[r][c + 1] !== 0) {
						smoothness -= Math.abs(Math.log2(tileValue) - Math.log2(currentBoard[r][c + 1]));
					}
					// 下隣
					if (r < size - 1 && currentBoard[r + 1][c] !== 0) {
						smoothness -= Math.abs(Math.log2(tileValue) - Math.log2(currentBoard[r + 1][c]));
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
			let current = 0;
			let next = current + 1;
			while (next < size) {
				while (next < size && currentBoard[r][next] === 0) next++;
				if (next >= size) break;
				const currentValue = Math.log2(currentBoard[r][current]);
				const nextValue = Math.log2(currentBoard[r][next]);
				if (currentValue > nextValue) {
					totals[2] += nextValue - currentValue; // 左方向へのペナルティ
				} else if (nextValue > currentValue) {
					totals[3] += currentValue - nextValue; // 右方向へのペナルティ
				}
				current = next;
				next++;
			}
		}

		// 上下の単調性
		for (let c = 0; c < size; c++) {
			let current = 0;
			let next = current + 1;
			while (next < size) {
				while (next < size && currentBoard[next][c] === 0) next++;
				if (next >= size) break;
				const currentValue = Math.log2(currentBoard[current][c]);
				const nextValue = Math.log2(currentBoard[next][c]);
				if (currentValue > nextValue) {
					totals[0] += nextValue - currentValue; // 上方向へのペナルティ
				} else if (nextValue > currentValue) {
					totals[1] += currentValue - nextValue; // 下方向へのペナルティ
				}
				current = next;
				next++;
			}
		}

		return Math.max(totals[0], totals[1]) + Math.max(totals[2], totals[3]);
	}

	/**
	 * 最大値のタイルが四隅にあるかを判定
	 */
	function isMaxTileInCorner(currentBoard, maxTile) {
		const corners = [currentBoard[0][0], currentBoard[0][size - 1], currentBoard[size - 1][0], currentBoard[size - 1][size - 1]];
		return corners.includes(maxTile);
	}

	// --- 初期化実行 ---
	initializeBoard();
});
