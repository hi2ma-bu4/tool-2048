import init, { evaluate_board, evaluate_pattern, evaluate_snake_pattern } from "../../pkg/wasm_lib.js";
import { getEmptyCells, simulateMove } from "../game/game";
import type { Board, Direction, HeuristicWeights, WorkerMessage, WorkerResponse } from "../types";

// --- WASMの初期化 ---
// wasmモジュールは非同期で初期化する必要がある
const wasmReady = init();

type EvaluationFunction = (board: Board, weights: HeuristicWeights) => number;
type Memo = Map<string, number>;

// WASM関数を呼び出す評価関数
const evaluationFunctions: { [key: string]: EvaluationFunction } = {
	heuristic: (board, weights) => {
		const flatBoard = new Float64Array(board.flat());
		return evaluate_board(flatBoard, weights.smoothness, weights.monotonicity, weights.emptyCells, weights.maxTile);
	},
	pattern: (board, weights) => {
		const flatBoard = new Float64Array(board.flat());
		return evaluate_pattern(flatBoard, weights.emptyCells);
	},
	snake: (board) => {
		const flatBoard = new Float64Array(board.flat());
		return evaluate_snake_pattern(flatBoard);
	},
};

/**
 * メインスレッドからのメッセージを受信
 */
self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
	// WASMモジュールの準備ができるまで待つ
	await wasmReady;

	const { algorithm, move, board, searchDepth, heuristicWeights, mergeLimit } = e.data;
	const memo: Memo = new Map();
	const evaluationFunction = evaluationFunctions[algorithm];

	if (!evaluationFunction) {
		throw new Error(`Unknown algorithm: ${algorithm}`);
	}

	const score = expectimax(board, searchDepth - 1, false, memo, evaluationFunction, heuristicWeights, mergeLimit);

	self.postMessage({ move, score } as WorkerResponse);
};

/**
 * Expectimaxアルゴリズムの本体
 */
function expectimax(currentBoard: Board, depth: number, isPlayerTurn: boolean, memo: Memo, evaluationFunction: EvaluationFunction, weights: HeuristicWeights, mergeLimit: number): number {
	const boardKey = JSON.stringify(currentBoard);
	if (memo.has(boardKey)) {
		return memo.get(boardKey)!;
	}

	if (depth === 0) {
		return evaluationFunction(currentBoard, weights);
	}

	let resultScore: number;
	if (isPlayerTurn) {
		// Player's turn: Maximize score
		let maxScore = -Infinity;
		const moves: Direction[] = ["up", "down", "left", "right"];
		for (const move of moves) {
			const simResult = simulateMove(currentBoard, move, mergeLimit);
			if (simResult.moved) {
				maxScore = Math.max(maxScore, expectimax(simResult.board, depth - 1, false, memo, evaluationFunction, weights, mergeLimit));
			}
		}
		resultScore = maxScore === -Infinity ? 0 : maxScore;
	} else {
		// Computer's turn: Calculate expectation
		const emptyCells = getEmptyCells(currentBoard);
		if (emptyCells.length === 0) {
			return expectimax(currentBoard, depth - 1, true, memo, evaluationFunction, weights, mergeLimit);
		}

		let totalScore = 0;
		for (const cell of emptyCells) {
			// Case 1: Add a 2 (90% probability)
			const boardWith2 = currentBoard.map((row) => [...row]);
			boardWith2[cell.r][cell.c] = 2;
			totalScore += 0.9 * expectimax(boardWith2, depth - 1, true, memo, evaluationFunction, weights, mergeLimit);

			// Case 2: Add a 4 (10% probability)
			const boardWith4 = currentBoard.map((row) => [...row]);
			boardWith4[cell.r][cell.c] = 4;
			totalScore += 0.1 * expectimax(boardWith4, depth - 1, true, memo, evaluationFunction, weights, mergeLimit);
		}
		resultScore = totalScore / emptyCells.length;
	}

	memo.set(boardKey, resultScore);
	return resultScore;
}
