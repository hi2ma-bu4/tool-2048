var board = []; // Use var to make it a true global for testing
document.addEventListener("DOMContentLoaded", () => {
	// DOM要素の取得
	const gridContainer = document.getElementById("grid-container");
	const scoreDisplay = document.getElementById("score");
	const calculateBtn = document.getElementById("calculate-btn");
	const resetBtn = document.getElementById("reset-btn");
	const searchDepthInput = document.getElementById("search-depth-input");
	const realtimeCheckbox = document.getElementById("realtime-checkbox");
	const autoAddTileCheckbox = document.getElementById("auto-add-tile-checkbox");
	const mergeLimitInput = document.getElementById("merge-limit-input");
	const recUp = document.getElementById("rec-up");
	const recDown = document.getElementById("rec-down");
	const recLeft = document.getElementById("rec-left");
	const recRight = document.getElementById("rec-right");
	const aiMessage = document.getElementById("ai-message");
	const aiAutoPlayBtn = document.getElementById("ai-auto-play-btn");
	const aiIntervalInput = document.getElementById("ai-interval-input");

	const size = 4;
	let score = 0;
	let isAIAutoPlaying = false;
	let autoPlayIntervalId = null;

	// =========================================================================
	// AIの設定
	// =========================================================================
	// AIが何手先まで読み込むか。数値を大きくすると賢くなるが計算時間が長くなる。
	let SEARCH_DEPTH = 5; // デフォルト値

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
		aiMessage.innerHTML = "\u00A0";
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
					// 65536からのタイルはデフォルト色を使用
					if (value > 65536) {
						cell.classList.add("tile-default");
					} else {
						cell.classList.add(`tile-${value}`);
					}
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
		if (depth >= 1 && depth <= 10) {
			SEARCH_DEPTH = depth;
			if (isRealtimeCalculation()) runAI();
		} else {
			alert("探索深度は1から10の間で設定してください。");
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
		const originalRowStr = row.join(",");
		let newRow = row.filter((val) => val);
		let newScore = 0;
		const mergeLimit = parseInt(mergeLimitInput.value, 10) || Infinity;

		for (let i = 0; i < newRow.length - 1; i++) {
			if (newRow[i] === newRow[i + 1] && newRow[i] < mergeLimit) {
				newRow[i] *= 2;
				newScore += newRow[i];
				newRow.splice(i + 1, 1);
			}
		}
		while (newRow.length < size) {
			newRow.push(0);
		}

		const changed = originalRowStr !== newRow.join(",");
		return { newRow, score: newScore, changed: changed };
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
	// Web Worker の設定 (マルチワーカー対応)
	// =========================================================================
	const NUM_WORKERS = 4; // ワーカーの数
	let workers = [];
	let isAICalculating = false;
	let moveScores = {};
	let completedWorkers = 0;
	let tasks = [];

	function initializeWorkers() {
		if (window.Worker) {
			for (let i = 0; i < NUM_WORKERS; i++) {
				const worker = new Worker("ai-worker.js");
				worker.onmessage = function (e) {
					const { move, score } = e.data;
					moveScores[move] = score;
					completedWorkers++;

					// 送信したタスクの数と完了したワーカーの数が一致したら、計算を完了
					if (completedWorkers === tasks.length) {
						finishAICalculation();
					}
				};
				workers.push(worker);
			}
		} else {
			console.error("Web Worker is not supported in your browser.");
			alert("お使いのブラウザはWeb Workerをサポートしていません。AI機能が利用できません。");
		}
	}

	function runAI() {
		if (isAICalculating) return;

		moveScores = {}; // ★バグ修正: 計算結果をリセット
		resetRecommendations();
		aiMessage.textContent = "AIが計算中です...";
		calculateBtn.disabled = true;
		isAICalculating = true;

		const mergeLimit = parseInt(mergeLimitInput.value, 10) || Infinity;
		const moves = ["up", "down", "left", "right"];
		tasks = []; // Reset the global tasks array

		// 各方向への移動をシミュレートし、有効な手のみをタスクとして追加
		for (const move of moves) {
			const simResult = simulateMove(board, move);
			if (simResult.moved) {
				tasks.push({ move: move, board: simResult.board });
			} else {
				moveScores[move] = -Infinity; // 動けない手
			}
		}

		// 有効な手がない場合
		if (tasks.length === 0) {
			finishAICalculation();
			return;
		}

		completedWorkers = 0;
		// タスクをワーカーに分散
		tasks.forEach((task, index) => {
			const worker = workers[index % NUM_WORKERS];
			worker.postMessage({
				move: task.move,
				board: task.board,
				searchDepth: SEARCH_DEPTH,
				heuristicWeights: HEURISTIC_WEIGHTS,
				mergeLimit: mergeLimit,
			});
		});
	}

	function finishAICalculation() {
		displayRecommendations(moveScores);
		isAICalculating = false;
		calculateBtn.disabled = false;
		if (isAIAutoPlaying) {
			handleAutoPlay(moveScores);
		}
		// 次の計算のためにリセット
		moveScores = {};
	}

	function displayRecommendations(scores) {
		const recommendationItems = {
			up: recUp.parentElement,
			down: recDown.parentElement,
			left: recLeft.parentElement,
			right: recRight.parentElement,
		};
		Object.values(recommendationItems).forEach((item) => {
			item.classList.remove("highlight-best", "highlight-worst");
		});

		const validMoves = Object.entries(scores).filter(([, score]) => score > -Infinity);

		if (validMoves.length > 0) {
			const minScore = Math.min(...validMoves.map(([, score]) => score));
			const normalizedScores = Object.fromEntries(
				validMoves.map(([move, score]) => [move, score - minScore + 1]) // 最小スコアが1になるように正規化
			);

			const totalScore = Object.values(normalizedScores).reduce((sum, s) => sum + s, 0);

			const percentages = { up: 0, down: 0, left: 0, right: 0 };
			for (const [move, score] of Object.entries(normalizedScores)) {
				percentages[move] = Math.round((score / totalScore) * 100);
			}

			recUp.textContent = scores.up > -Infinity ? `${percentages.up}%` : "-%";
			recDown.textContent = scores.down > -Infinity ? `${percentages.down}%` : "-%";
			recLeft.textContent = scores.left > -Infinity ? `${percentages.left}%` : "-%";
			recRight.textContent = scores.right > -Infinity ? `${percentages.right}%` : "-%";

			const bestMove = Object.keys(normalizedScores).reduce((a, b) => (normalizedScores[a] > normalizedScores[b] ? a : b));
			recommendationItems[bestMove].classList.add("highlight-best");

			if (validMoves.length > 1) {
				const worstMove = Object.keys(normalizedScores).reduce((a, b) => (normalizedScores[a] < normalizedScores[b] ? a : b));
				if (bestMove !== worstMove) {
					recommendationItems[worstMove].classList.add("highlight-worst");
				}
			}
			aiMessage.textContent = "計算が完了しました。";
		} else {
			recUp.textContent = "-%";
			recDown.textContent = "-%";
			recLeft.textContent = "-%";
			recRight.textContent = "-%";
			aiMessage.textContent = "動かせる手がありません。";
		}
	}

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
			if (autoAddTileCheckbox.checked) {
				addRandomTile();
			}
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
			const { r, c } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
			board[r][c] = Math.random() < 0.9 ? 2 : 4;
		}
	}

	// --- スワイプ操作 ---
	let touchStartX = 0;
	let touchStartY = 0;
	let touchEndX = 0;
	let touchEndY = 0;

	gridContainer.addEventListener(
		"touchstart",
		(event) => {
			touchStartX = event.changedTouches[0].screenX;
			touchStartY = event.changedTouches[0].screenY;
		},
		{ passive: true }
	);

	gridContainer.addEventListener("touchend", (event) => {
		touchEndX = event.changedTouches[0].screenX;
		touchEndY = event.changedTouches[0].screenY;
		handleSwipe();
	});

	function handleSwipe() {
		const diffX = touchEndX - touchStartX;
		const diffY = touchEndY - touchStartY;
		const threshold = 50; // 50px以上のスワイプを検知

		if (Math.abs(diffX) > Math.abs(diffY)) {
			// 横方向のスワイプ
			if (Math.abs(diffX) > threshold) {
				moveBoard(diffX > 0 ? "right" : "left");
			}
		} else {
			// 縦方向のスワイyプ
			if (Math.abs(diffY) > threshold) {
				moveBoard(diffY > 0 ? "down" : "up");
			}
		}
	}

	aiAutoPlayBtn.addEventListener("click", toggleAIAutoPlay);

	function toggleAIAutoPlay() {
		isAIAutoPlaying = !isAIAutoPlaying;
		if (isAIAutoPlaying) {
			aiAutoPlayBtn.textContent = "AI自動操作を停止";
			aiAutoPlayBtn.classList.add("playing");
			startAIAutoPlay();
		} else {
			aiAutoPlayBtn.textContent = "AI自動操作を開始";
			aiAutoPlayBtn.classList.remove("playing");
			stopAIAutoPlay();
		}
	}

	function startAIAutoPlay() {
		const interval = parseInt(aiIntervalInput.value, 10) || 500;
		autoPlayIntervalId = setInterval(() => {
			if (!isAICalculating) {
				runAI(); // Workerに計算を依頼
			}
		}, interval);
	}

	function handleAutoPlay(moveScores) {
		const validMoves = Object.entries(moveScores).filter(([, score]) => score > -Infinity);

		if (validMoves.length > 0) {
			const bestMove = validMoves.reduce((a, b) => (a[1] > b[1] ? a : b))[0];
			moveBoard(bestMove);
		} else {
			// ゲームオーバー
			stopAIAutoPlay();
			aiMessage.textContent = "ゲームオーバー！AIは停止しました。";
		}
	}

	function stopAIAutoPlay() {
		clearInterval(autoPlayIntervalId);
		isAIAutoPlaying = false;
		aiAutoPlayBtn.textContent = "AI自動操作を開始";
		aiAutoPlayBtn.classList.remove("playing");
	}

	// --- 初期化実行 ---
	initializeBoard();
	initializeWorkers();
});
