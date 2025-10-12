import init, { find_best_move } from "../../pkg/wasm_lib.js";
import type { Board, Direction, WorkerMessage, WorkerResponse } from "../types";

// --- WASM Initialization ---
// The wasm module must be initialized asynchronously.
const wasmReady = init();

// Mapping from the integer direction returned by wasm to the string representation.
const directionMap: Direction[] = ["up", "down", "left", "right"];

/**
 * Receives messages from the main thread to find the best move.
 */
self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
	// Wait until the wasm module is ready.
	await wasmReady;

	const { move, board, searchDepth } = e.data;

	// The board is passed to wasm as a flat array of numbers.
	const flatBoard = new Float64Array(board.flat());

	// Call the new, all-in-one wasm function to get the best move.
	const bestMoveIndex = find_best_move(flatBoard, searchDepth);
	const bestMoveDirection = directionMap[bestMoveIndex];

	// Simulate a "score" for the chosen move. Since the score is now calculated
	// deep inside the Rust search, we can't easily return it.
	// We'll assign a high score to the chosen move and a low score to others
	// to maintain the UI's behavior of highlighting the best option.
	const score = move.direction === bestMoveDirection ? 1 : 0;

	self.postMessage({ move, score } as WorkerResponse);
};