import { Board, Direction, HeuristicWeights, WorkerMessage, WorkerResponse } from "../types";
import { simulateMove, getEmptyCells } from "../game/game";
import { evaluateBoard, evaluatePattern, evaluateSnakePattern } from "./evaluation";

type EvaluationFunction = (board: Board, weights: HeuristicWeights) => number;
type Memo = Map<string, number>;

const evaluationFunctions: { [key: string]: EvaluationFunction } = {
    heuristic: evaluateBoard,
    pattern: evaluatePattern,
    snake: (board: Board) => evaluateSnakePattern(board) // snake doesn't use weights
};

/**
 * メインスレッドからのメッセージを受信
 */
self.onmessage = (e: MessageEvent<WorkerMessage>) => {
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
function expectimax(
    currentBoard: Board,
    depth: number,
    isPlayerTurn: boolean,
    memo: Memo,
    evaluationFunction: EvaluationFunction,
    weights: HeuristicWeights,
    mergeLimit: number
): number {
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
            const boardWith2 = currentBoard.map(row => [...row]);
            boardWith2[cell.r][cell.c] = 2;
            totalScore += 0.9 * expectimax(boardWith2, depth - 1, true, memo, evaluationFunction, weights, mergeLimit);

            // Case 2: Add a 4 (10% probability)
            const boardWith4 = currentBoard.map(row => [...row]);
            boardWith4[cell.r][cell.c] = 4;
            totalScore += 0.1 * expectimax(boardWith4, depth - 1, true, memo, evaluationFunction, weights, mergeLimit);
        }
        resultScore = totalScore / emptyCells.length;
    }

    memo.set(boardKey, resultScore);
    return resultScore;
}