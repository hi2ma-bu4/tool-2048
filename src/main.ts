import { addRandomTile, simulateMove } from "./game/game";
import { resetState, state } from "./game/state";
import { Board, Direction, WorkerMessage, WorkerResponse } from "./types";
import { displayRecommendations, elements, initializeGrid, renderBoard, resetRecommendations, updateScore } from "./ui/dom";

const NUM_WORKERS = 4;
let workers: Worker[] = [];
let moveScores: { [key in Direction]?: number } = {};
let completedWorkers = 0;
let tasks: { move: Direction; board: Board }[] = [];

// --- 初期化 ---
document.addEventListener("DOMContentLoaded", () => {
	initializeGrid();
	initializeWorkers();
	initializeApp();
	setupEventListeners();
});

// --- Test Helpers ---
if (typeof window !== "undefined") {
	(window as any).setBoardAndRender = (board: Board) => {
		state.board = board;
		renderBoard(state.board);
	};
	(window as any).getState = () => state;
}

function initializeApp() {
	resetState();
	updateScore(state.score);
	resetRecommendations();
	renderBoard(state.board);
}

function initializeWorkers() {
	// The path should be relative to the final HTML file location
	const workerUrl = "dist/ai-worker.js";
	for (let i = 0; i < NUM_WORKERS; i++) {
		const worker = new Worker(workerUrl);
		worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
			const { move, score } = e.data;
			moveScores[move] = score;
			completedWorkers++;

			if (completedWorkers === tasks.length) {
				finishAICalculation();
			}
		};
		workers.push(worker);
	}
}

// --- イベントリスナー ---
function setupEventListeners() {
	elements.resetBtn.addEventListener("click", initializeApp);
	elements.calculateBtn.addEventListener("click", runAI);

	// 設定
	elements.aiAlgorithmSelect.addEventListener("change", handleSettingsChange);
	elements.searchDepthInput.addEventListener("change", handleSettingsChange);
	elements.realtimeCheckbox.addEventListener("change", () => {
		elements.calculateBtn.style.display = elements.realtimeCheckbox.checked ? "none" : "inline-block";
		if (elements.realtimeCheckbox.checked) runAI();
	});

	// タイル操作
	let pressTimer: number | null = null;
	let isLongPress = false;
	elements.gridContainer.addEventListener("mousedown", (e) => {
		const target = e.target as HTMLElement;
		const cell = target.closest(".grid-cell");
		if (cell) {
			pressTimer = window.setTimeout(() => {
				isLongPress = true;
				const row = parseInt(cell.getAttribute("data-row")!);
				const col = parseInt(cell.getAttribute("data-col")!);
				state.board[row][col] = 0;
				renderBoard(state.board);
				if (elements.realtimeCheckbox.checked) runAI();
			}, 500);
		}
	});
	elements.gridContainer.addEventListener("mouseup", (e) => {
		if (pressTimer) clearTimeout(pressTimer);
		if (!isLongPress) {
			const target = e.target as HTMLElement;
			const cell = target.closest(".grid-cell");
			if (cell) {
				const row = parseInt(cell.getAttribute("data-row")!);
				const col = parseInt(cell.getAttribute("data-col")!);
				const currentValue = state.board[row][col];
				state.board[row][col] = currentValue === 0 ? 2 : currentValue * 2;
				renderBoard(state.board);
				if (elements.realtimeCheckbox.checked) runAI();
			}
		}
		isLongPress = false;
	});
	elements.gridContainer.addEventListener("mouseleave", () => {
		if (pressTimer) clearTimeout(pressTimer);
		isLongPress = false;
	});

	// キーボード操作
	document.addEventListener("keydown", (e) => {
		if ((e.target as HTMLElement).tagName.toLowerCase() === "input") return;
		let direction: Direction | null = null;
		switch (e.key) {
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
		}
		if (direction) {
			e.preventDefault();
			moveBoard(direction);
		}
	});

	// スワイプ操作
	let touchStartX = 0,
		touchStartY = 0;
	elements.gridContainer.addEventListener(
		"touchstart",
		(e) => {
			touchStartX = e.changedTouches[0].screenX;
			touchStartY = e.changedTouches[0].screenY;
		},
		{ passive: true }
	);
	elements.gridContainer.addEventListener("touchend", (e) => {
		const touchEndX = e.changedTouches[0].screenX;
		const touchEndY = e.changedTouches[0].screenY;
		handleSwipe(touchStartX, touchStartY, touchEndX, touchEndY);
	});

	// AI自動操作
	elements.aiAutoPlayBtn.addEventListener("click", toggleAIAutoPlay);
}

function handleSettingsChange() {
	state.searchDepth = parseInt(elements.searchDepthInput.value);
	if (elements.realtimeCheckbox.checked) runAI();
}

function moveBoard(direction: Direction) {
	const mergeLimit = parseInt(elements.mergeLimitInput.value, 10) || Infinity;
	const result = simulateMove(state.board, direction, mergeLimit);
	if (result.moved) {
		state.board = result.board;
		state.score += result.score;
		updateScore(state.score);
		if (elements.autoAddTileCheckbox.checked) {
			state.board = addRandomTile(state.board);
		}
		renderBoard(state.board);
		if (elements.realtimeCheckbox.checked) {
			runAI();
		} else {
			resetRecommendations();
		}
	}
}

function handleSwipe(startX: number, startY: number, endX: number, endY: number) {
	const diffX = endX - startX;
	const diffY = endY - startY;
	const threshold = 50;
	if (Math.abs(diffX) > Math.abs(diffY)) {
		if (Math.abs(diffX) > threshold) moveBoard(diffX > 0 ? "right" : "left");
	} else {
		if (Math.abs(diffY) > threshold) moveBoard(diffY > 0 ? "down" : "up");
	}
}

// --- AI 計算 ---
function runAI() {
	if (state.isAICalculating) return;

	moveScores = {};
	resetRecommendations();
	elements.aiMessage.textContent = "AIが計算中です...";
	elements.calculateBtn.disabled = true;
	state.isAICalculating = true;

	const mergeLimit = parseInt(elements.mergeLimitInput.value, 10) || Infinity;
	const moves: Direction[] = ["up", "down", "left", "right"];
	tasks = [];

	for (const move of moves) {
		const simResult = simulateMove(state.board, move, mergeLimit);
		if (simResult.moved) {
			tasks.push({ move: move, board: simResult.board });
		} else {
			moveScores[move] = -Infinity;
		}
	}

	if (tasks.length === 0) {
		finishAICalculation();
		return;
	}

	completedWorkers = 0;
	tasks.forEach((task, index) => {
		const worker = workers[index % NUM_WORKERS];
		const message: WorkerMessage = {
			algorithm: elements.aiAlgorithmSelect.value,
			move: task.move,
			board: task.board,
			searchDepth: state.searchDepth,
			heuristicWeights: state.heuristicWeights,
			mergeLimit: mergeLimit,
		};
		worker.postMessage(message);
	});
}

function finishAICalculation() {
	displayRecommendations(moveScores);
	state.isAICalculating = false;
	elements.calculateBtn.disabled = false;
	if (state.isAIAutoPlaying) {
		handleAutoPlay(moveScores);
	}
	moveScores = {};
}

// --- AI 自動操作 ---
function toggleAIAutoPlay() {
	state.isAIAutoPlaying = !state.isAIAutoPlaying;
	if (state.isAIAutoPlaying) {
		elements.aiAutoPlayBtn.textContent = "AI自動操作を停止";
		elements.aiAutoPlayBtn.classList.add("playing");
		startAIAutoPlay();
	} else {
		elements.aiAutoPlayBtn.textContent = "AI自動操作を開始";
		elements.aiAutoPlayBtn.classList.remove("playing");
		stopAIAutoPlay();
	}
}

function startAIAutoPlay() {
	const interval = parseInt(elements.aiIntervalInput.value, 10) || 0;
	state.autoPlayIntervalId = window.setInterval(() => {
		if (!state.isAICalculating) {
			runAI();
		}
	}, interval);
}

function stopAIAutoPlay() {
	if (state.autoPlayIntervalId) clearInterval(state.autoPlayIntervalId);
	state.isAIAutoPlaying = false;
	elements.aiAutoPlayBtn.textContent = "AI自動操作を開始";
	elements.aiAutoPlayBtn.classList.remove("playing");
}

function handleAutoPlay(scores: { [key in Direction]?: number }) {
	const validMoves = Object.entries(scores).filter(([, score]) => score !== -Infinity && score !== undefined) as [Direction, number][];
	if (validMoves.length > 0) {
		const bestMove = validMoves.reduce((a, b) => (a[1] > b[1] ? a : b))[0];
		moveBoard(bestMove);
	} else {
		stopAIAutoPlay();
		elements.aiMessage.textContent = "ゲームオーバー！AIは停止しました。";
	}
}
