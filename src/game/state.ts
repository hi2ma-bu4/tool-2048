import { Board, HeuristicWeights } from "../types";
import { initializeBoard } from "./game";

export const state = {
	board: initializeBoard() as Board,
	score: 0,
	isAIAutoPlaying: false,
	isAICalculating: false,
	autoPlayIntervalId: null as number | null,
	searchDepth: 5,
	heuristicWeights: {
		smoothness: 0.1,
		monotonicity: 1.0,
		emptyCells: 2.7,
		maxTile: 1.0,
	} as HeuristicWeights,
};

export function resetState() {
	state.board = initializeBoard();
	state.score = 0;
	// Don't reset other state properties like isAIAutoPlaying
}

// Make board accessible for testing
if (typeof window !== "undefined") {
	(window as any).getState = () => state;
	(window as any).setBoard = (newBoard: Board) => {
		state.board = newBoard;
	};
}
