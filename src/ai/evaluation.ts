import { getEmptyCells } from "../game/game";
import { Board, HeuristicWeights } from "../types";

const SIZE = 4;

// Math.log2の計算結果をキャッシュ
const log2Cache: { [key: number]: number } = {};
function getLog2(val: number): number {
	if (val === 0) return 0;
	if (!log2Cache[val]) {
		log2Cache[val] = Math.log2(val);
	}
	return log2Cache[val];
}

/**
 * 盤面の「良さ」を総合的に評価して数値を返す
 */
export function evaluateBoard(currentBoard: Board, weights: HeuristicWeights): number {
	const emptyCells = getEmptyCells(currentBoard).length;
	const maxTileValue = Math.max(...currentBoard.flat());

	const smoothness = calculateSmoothness(currentBoard);
	const monotonicity = calculateMonotonicity(currentBoard);
	const maxTileBonus = isMaxTileInCorner(currentBoard, maxTileValue) ? maxTileValue : 0;

	return smoothness * weights.smoothness + monotonicity * weights.monotonicity + getLog2(emptyCells + 1) * weights.emptyCells + maxTileBonus * weights.maxTile;
}

/**
 * 平滑性 (Smoothness)
 */
function calculateSmoothness(currentBoard: Board): number {
	let smoothness = 0;
	for (let r = 0; r < SIZE; r++) {
		for (let c = 0; c < SIZE; c++) {
			const tileValue = currentBoard[r][c];
			if (tileValue !== 0) {
				// 右隣
				if (c < SIZE - 1 && currentBoard[r][c + 1] !== 0) {
					smoothness -= Math.abs(getLog2(tileValue) - getLog2(currentBoard[r][c + 1]));
				}
				// 下隣
				if (r < SIZE - 1 && currentBoard[r + 1][c] !== 0) {
					smoothness -= Math.abs(getLog2(tileValue) - getLog2(currentBoard[r + 1][c]));
				}
			}
		}
	}
	return smoothness;
}

/**
 * 単調性 (Monotonicity)
 */
function calculateMonotonicity(currentBoard: Board): number {
	let totals = [0, 0, 0, 0]; // up, down, left, right

	// 左右の単調性
	for (let r = 0; r < SIZE; r++) {
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

	// 上下の単調性
	for (let c = 0; c < SIZE; c++) {
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

/**
 * 最大タイルが隅にあるか
 */
function isMaxTileInCorner(currentBoard: Board, maxTile: number): boolean {
	const corners = [currentBoard[0][0], currentBoard[0][SIZE - 1], currentBoard[SIZE - 1][0], currentBoard[SIZE - 1][SIZE - 1]];
	return corners.includes(maxTile);
}

// --- パターン評価 ---

const SNAKE_PATTERN_WEIGHTS = [
	[15, 14, 13, 12],
	[8, 9, 10, 11],
	[7, 6, 5, 4],
	[0, 1, 2, 3],
].map((row) => row.map((w) => Math.pow(4, w)));

function rotateMatrix(matrix: number[][]): number[][] {
	const N = matrix.length;
	const result = Array.from({ length: N }, () => Array(N).fill(0));
	for (let r = 0; r < N; r++) {
		for (let c = 0; c < N; c++) {
			result[c][N - 1 - r] = matrix[r][c];
		}
	}
	return result;
}

function getPatternScore(board: Board, pattern: number[][]): number {
	let score = 0;
	for (let r = 0; r < SIZE; r++) {
		for (let c = 0; c < SIZE; c++) {
			if (board[r][c] !== 0) {
				score += getLog2(board[r][c]) * pattern[r][c];
			}
		}
	}
	return score;
}

export function evaluatePattern(currentBoard: Board, weights: HeuristicWeights): number {
	let bestScore = 0;
	let currentPattern = SNAKE_PATTERN_WEIGHTS;

	for (let i = 0; i < 4; i++) {
		bestScore = Math.max(bestScore, getPatternScore(currentBoard, currentPattern));
		currentPattern = rotateMatrix(currentPattern);
	}

	const emptyCells = getEmptyCells(currentBoard).length;
	return bestScore + getLog2(emptyCells + 1) * weights.emptyCells;
}

const SNAKE_PATTERN_WEIGHTS_SINGLE = [
	[10, 8, 7, 6.5],
	[-0.5, 0.7, 1.5, 3],
	[-1.5, -1, 1, 2],
	[-3, -2, -1.5, -1],
];

export function evaluateSnakePattern(board: Board): number {
	let score = 0;
	// Snake pattern weights
	for (let i = 0; i < 4; i++) {
		for (let j = 0; j < 4; j++) {
			score += SNAKE_PATTERN_WEIGHTS_SINGLE[i][j] * board[i][j];
		}
	}
	return score;
}
