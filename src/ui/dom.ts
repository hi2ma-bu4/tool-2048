import { Board, Direction } from "../types";

const SIZE = 4;

// DOM要素をキャッシュ
export const elements = {
	gridContainer: document.getElementById("grid-container")!,
	scoreDisplay: document.getElementById("score")!,
	calculateBtn: document.getElementById("calculate-btn") as HTMLButtonElement,
	resetBtn: document.getElementById("reset-btn") as HTMLButtonElement,
	searchDepthInput: document.getElementById("search-depth-input") as HTMLInputElement,
	realtimeCheckbox: document.getElementById("realtime-checkbox") as HTMLInputElement,
	autoAddTileCheckbox: document.getElementById("auto-add-tile-checkbox") as HTMLInputElement,
	aiAlgorithmSelect: document.getElementById("ai-algorithm-select") as HTMLSelectElement,
	mergeLimitInput: document.getElementById("merge-limit-input") as HTMLInputElement,
	recUp: document.getElementById("rec-up")!,
	recDown: document.getElementById("rec-down")!,
	recLeft: document.getElementById("rec-left")!,
	recRight: document.getElementById("rec-right")!,
	aiMessage: document.getElementById("ai-message")!,
	aiAutoPlayBtn: document.getElementById("ai-auto-play-btn") as HTMLButtonElement,
	aiIntervalInput: document.getElementById("ai-interval-input") as HTMLInputElement,
};

// ボードのセル要素を保持する配列
let cellElements: HTMLElement[][] = [];

/**
 * 初回にボードのセル要素を生成して保持する
 */
export function initializeGrid() {
	elements.gridContainer.innerHTML = "";
	cellElements = Array.from({ length: SIZE }, (_, r) =>
		Array.from({ length: SIZE }, (_, c) => {
			const cell = document.createElement("div");
			cell.className = "grid-cell";
			cell.dataset.row = String(r);
			cell.dataset.col = String(c);
			elements.gridContainer.appendChild(cell);
			return cell;
		})
	);
}

/**
 * 最適化されたボード描画関数
 * @param board 描画する盤面
 */
export function renderBoard(board: Board) {
	for (let r = 0; r < SIZE; r++) {
		for (let c = 0; c < SIZE; c++) {
			const cell = cellElements[r][c];
			const value = board[r][c];
			cell.textContent = value === 0 ? "" : String(value);
			// クラスリストを効率的に更新
			const classList = ["grid-cell"];
			if (value !== 0) {
				if (value > 65536) {
					classList.push("tile-default");
				} else {
					classList.push(`tile-${value}`);
				}
			}
			cell.className = classList.join(" ");
		}
	}
}

export function updateScore(score: number) {
	elements.scoreDisplay.textContent = String(score);
}

export function resetRecommendations() {
	elements.recUp.textContent = "-%";
	elements.recDown.textContent = "-%";
	elements.recLeft.textContent = "-%";
	elements.recRight.textContent = "-%";
	elements.aiMessage.innerHTML = "\u00A0"; // non-breaking space
}

export function displayRecommendations(scores: { [key in Direction]?: number }) {
	const recommendationItems: { [key in Direction]: HTMLElement } = {
		up: elements.recUp.parentElement as HTMLElement,
		down: elements.recDown.parentElement as HTMLElement,
		left: elements.recLeft.parentElement as HTMLElement,
		right: elements.recRight.parentElement as HTMLElement,
	};

	Object.values(recommendationItems).forEach((item) => {
		item.classList.remove("highlight-best", "highlight-worst");
	});

	const validMoves = Object.entries(scores).filter(([, score]) => score !== -Infinity && score !== undefined) as [Direction, number][];

	if (validMoves.length > 0) {
		const minScore = Math.min(...validMoves.map(([, score]) => score));
		const normalizedScores = Object.fromEntries(validMoves.map(([move, score]) => [move, score - minScore + 1])) as { [key in Direction]?: number };

		const totalScore = Object.values(normalizedScores).reduce((sum, s) => sum! + s!, 0)!;

		const percentages: { [key in Direction]?: number } = {};
		for (const [move, score] of Object.entries(normalizedScores)) {
			percentages[move as Direction] = Math.round((score! / totalScore) * 100);
		}

		elements.recUp.textContent = percentages.up !== undefined ? `${percentages.up}%` : "-%";
		elements.recDown.textContent = percentages.down !== undefined ? `${percentages.down}%` : "-%";
		elements.recLeft.textContent = percentages.left !== undefined ? `${percentages.left}%` : "-%";
		elements.recRight.textContent = percentages.right !== undefined ? `${percentages.right}%` : "-%";

		const bestMove = Object.keys(normalizedScores).reduce((a, b) => (normalizedScores[a as Direction]! > normalizedScores[b as Direction]! ? a : b)) as Direction;
		recommendationItems[bestMove].classList.add("highlight-best");

		if (validMoves.length > 1) {
			const worstMove = Object.keys(normalizedScores).reduce((a, b) => (normalizedScores[a as Direction]! < normalizedScores[b as Direction]! ? a : b)) as Direction;
			if (bestMove !== worstMove) {
				recommendationItems[worstMove].classList.add("highlight-worst");
			}
		}
		elements.aiMessage.textContent = "計算が完了しました。";
	} else {
		resetRecommendations();
		elements.aiMessage.textContent = "動かせる手がありません。";
	}
}
