export type Board = number[][];

export type Direction = "up" | "down" | "left" | "right";

export interface HeuristicWeights {
	smoothness: number;
	monotonicity: number;
	emptyCells: number;
	maxTile: number;
}

export interface WorkerMessage {
	algorithm: string;
	move: Direction;
	board: Board;
	searchDepth: number;
	heuristicWeights: HeuristicWeights;
	mergeLimit: number;
}

export interface WorkerResponse {
	move: Direction;
	score: number;
}
