let board = [];
document.addEventListener("DOMContentLoaded", () => {
	// DOM要素の取得
	const gridContainer = document.getElementById("grid-container");
	const scoreDisplay = document.getElementById("score");
	const calculateBtn = document.getElementById("calculate-btn");
	const resetBtn = document.getElementById("reset-btn");
	const searchDepthInput = document.getElementById("search-depth-input");
	const realtimeCheckbox = document.getElementById("realtime-checkbox");
	const recUp = document.getElementById("rec-up");
	const recDown = document.getElementById("rec-down");
	const recLeft = document.getElementById("rec-left");
	const recRight = document.getElementById("rec-right");
	const aiMessage = document.getElementById("ai-message");

	const size = 4;
	let score = 0;

	// =========================================================================
	// AIの設定
	// =========================================================================
	// AIが何手先まで読み込むか。数値を大きくすると賢くなるが計算時間が長くなる。
	let SEARCH_DEPTH = 3; // デフォルト値

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
		resetRecommendations();
		renderBoard();
	}

	function resetRecommendations() {
		recUp.textContent = "-%";
		recDown.textContent = "-%";
		recLeft.textContent = "-%";
		recRight.textContent = "-%";
		aiMessage.textContent = "";
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
					// 2048より大きいタイルも、その値のクラスを直接つける
					cell.classList.add(`tile-${value}`);
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

	// --- タイル操作のイベントリスナー ---
	let pressTimer = null;
	let isLongPress = false;

	gridContainer.addEventListener("mousedown", (event) => {
		const cell = event.target.closest(".grid-cell");
		if (cell) {
			pressTimer = setTimeout(() => {
				isLongPress = true;
				const row = parseInt(cell.dataset.row);
				const col = parseInt(cell.dataset.col);
				board[row][col] = 0; // 長押しでタイルを削除
				renderBoard();
				if (isRealtimeCalculation()) runAI();
			}, 500); // 500msで長押しと判定
		}
	});

	gridContainer.addEventListener("mouseup", (event) => {
		clearTimeout(pressTimer);
		if (!isLongPress) {
			const cell = event.target.closest(".grid-cell");
			if (cell) {
				const row = parseInt(cell.dataset.row);
				const col = parseInt(cell.dataset.col);
				const currentValue = board[row][col];
				if (currentValue === 0) {
					board[row][col] = 2; // 空のセルは2から始める
				} else {
					board[row][col] = currentValue * 2; // クリックで倍にする
				}
				renderBoard();
				if (isRealtimeCalculation()) runAI();
			}
		}
		isLongPress = false; // フラグをリセット
	});

    // マウスがグリッド外に出た場合もタイマーをクリア
	gridContainer.addEventListener("mouseleave", () => {
		clearTimeout(pressTimer);
		isLongPress = false;
	});

	resetBtn.addEventListener("click", initializeBoard);
	calculateBtn.addEventListener("click", runAI);

	// --- 設定のイベントリスナー ---

	searchDepthInput.addEventListener("change", () => {
		let depth = parseInt(searchDepthInput.value);
		if (depth >= 1 && depth <= 6) {
			SEARCH_DEPTH = depth;
			if (isRealtimeCalculation()) runAI();
		} else {
			alert("探索深度は1から6の間で設定してください。");
			searchDepthInput.value = SEARCH_DEPTH;
		}
	});

	realtimeCheckbox.addEventListener("change", () => {
		if (isRealtimeCalculation()) {
			calculateBtn.style.display = "none";
			runAI();
		} else {
			calculateBtn.style.display = "inline-block";
		}
	});

	function isRealtimeCalculation() {
		return realtimeCheckbox.checked;
	}


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
		let tempBoard = currentBoard.map((row) => [...row]);
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
		resetRecommendations();
		aiMessage.textContent = "AIが計算中です...";
		calculateBtn.disabled = true;

		// UIのフリーズを防ぐため、計算を少し遅延させて実行
		setTimeout(() => {
			const moveScores = findBestMoveScores();
			displayRecommendations(moveScores);
			calculateBtn.disabled = false;
		}, 50);
	}

	/**
	 * 計算結果をUIに表示する
	 */
	function displayRecommendations(scores) {
		const recommendationItems = {
			up: recUp.parentElement,
			down: recDown.parentElement,
			left: recLeft.parentElement,
			right: recRight.parentElement,
		};
		// remove existing highlights
		Object.values(recommendationItems).forEach(item => {
			item.classList.remove("highlight-best", "highlight-worst");
		});


		const totalScore = Object.values(scores).reduce((sum, s) => sum + s, 0);

		if (totalScore > 0) {
			const percentages = {
				up: Math.round((scores.up / totalScore) * 100),
				down: Math.round((scores.down / totalScore) * 100),
				left: Math.round((scores.left / totalScore) * 100),
				right: Math.round((scores.right / totalScore) * 100),
			};

			recUp.textContent = `${percentages.up}%`;
			recDown.textContent = `${percentages.down}%`;
			recLeft.textContent = `${percentages.left}%`;
			recRight.textContent = `${percentages.right}%`;

			const validMoves = Object.keys(scores).filter(move => scores[move] > 0);

			if(validMoves.length > 0) {
				const bestMove = validMoves.reduce((a, b) => percentages[a] > percentages[b] ? a : b);
				recommendationItems[bestMove].classList.add("highlight-best");

				if (validMoves.length > 1) {
					const worstMove = validMoves.reduce((a, b) => percentages[a] < percentages[b] ? a : b);
					if(bestMove !== worstMove) {
						recommendationItems[worstMove].classList.add("highlight-worst");
					}
				}
			}

			aiMessage.textContent = "計算が完了しました。";
		} else {
			recUp.textContent = "0%";
			recDown.textContent = "0%";
			recLeft.textContent = "0%";
			recRight.textContent = "0%";
			aiMessage.textContent = "動かせる手がありません。";
		}
	}

	/**
	 * 各手の評価スコアを計算する関数
	 */
	function findBestMoveScores() {
		const memo = new Map(); // メモ化用のキャッシュ
		const moveScores = { up: 0, down: 0, left: 0, right: 0 };
		const moves = ["up", "down", "left", "right"];

		for (const move of moves) {
			const simResult = simulateMove(board, move);
			if (simResult.moved) {
				const score = expectimax(simResult.board, SEARCH_DEPTH, false, memo);
				// スコアはマイナスの場合もあるので、0以上にする
				moveScores[move] = Math.max(0, score);
			}
		}
		return moveScores;
	}

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
			return evaluateBoard(currentBoard); // 深さの限界に達したら盤面を評価
		}

		let resultScore;
		if (isPlayerTurn) {
			// --- プレイヤーのターン (Max Node) ---
			// 可能な全ての手の中から、最も評価値が高くなるものを選ぶ
			let maxScore = -Infinity;
			const moves = ["up", "down", "left", "right"];
			for (const move of moves) {
				const simResult = simulateMove(currentBoard, move);
				if (simResult.moved) {
					maxScore = Math.max(maxScore, expectimax(simResult.board, depth - 1, false, memo));
				}
			}
			resultScore = maxScore === -Infinity ? 0 : maxScore; // 動けない場合は評価0
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
				const newBoard = currentBoard.map((row) => [...row]);
				newBoard[cell.r][cell.c] = 2;
				totalScore += 0.9 * expectimax(newBoard, depth - 1, true, memo);
			}
			// 4が10%の確率で出現
			for (const cell of emptyCells) {
				const newBoard = currentBoard.map((row) => [...row]);
				newBoard[cell.r][cell.c] = 4;
				totalScore += 0.1 * expectimax(newBoard, depth - 1, true, memo);
			}
			// 期待値を返す
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

	// --- キーボード操作 ---
	document.addEventListener("keydown", (event) => {
		let direction = null;
		switch (event.key) {
			case "ArrowUp":
			case "w":
				direction = "up";
				break;
			case "ArrowDown":
			case "s":
				direction = "down";
				break;
			case "ArrowLeft":
			case "a":
				direction = "left";
				break;
			case "ArrowRight":
			case "d":
				direction = "right";
				break;
			default:
				return; // 関係ないキーは無視
		}
		event.preventDefault(); // スクロールなどを防ぐ
		moveBoard(direction);
	});

	function moveBoard(direction) {
		const result = simulateMove(board, direction);
		if (result.moved) {
			board = result.board;
			updateScore(score + result.score);
			addRandomTile();
			renderBoard();
			if (isRealtimeCalculation()) {
				runAI();
			} else {
				resetRecommendations();
			}
		}
	}

	function addRandomTile() {
		const emptyCells = getEmptyCells(board);
		if (emptyCells.length > 0) {
			const { r, c } =
				emptyCells[Math.floor(Math.random() * emptyCells.length)];
			board[r][c] = Math.random() < 0.9 ? 2 : 4;
		}
	}


	// --- スワイプ操作 ---
	let touchStartX = 0;
	let touchStartY = 0;
	let touchEndX = 0;
	let touchEndY = 0;

	gridContainer.addEventListener("touchstart", (event) => {
		touchStartX = event.changedTouches[0].screenX;
		touchStartY = event.changedTouches[0].screenY;
	}, { passive: true });

	gridContainer.addEventListener("touchend", (event) => {
		touchEndX = event.changedTouches[0].screenX;
		touchEndY = event.changedTouches[0].screenY;
		handleSwipe();
	});

	function handleSwipe() {
		const diffX = touchEndX - touchStartX;
		const diffY = touchEndY - touchStartY;
		const threshold = 50; // 50px以上のスワイプを検知

		if (Math.abs(diffX) > Math.abs(diffY)) { // 横方向のスワイプ
			if (Math.abs(diffX) > threshold) {
				moveBoard(diffX > 0 ? "right" : "left");
			}
		} else { // 縦方向のスワイyプ
			if (Math.abs(diffY) > threshold) {
				moveBoard(diffY > 0 ? "down" : "up");
			}
		}
	}

	// --- 初期化実行 ---
	initializeBoard();
});
