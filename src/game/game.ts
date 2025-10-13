import type { Board, Direction } from "../types";
import { wasm } from "../main";

const SIZE = 4;

/**
 * 指定された方向に盤面を動かすシミュレーションを行う
 * @param currentBoard 現在の盤面
 * @param direction 動かす方向
 * @param mergeLimit 結合上限値
 * @returns シミュレーション後の盤面、スコア、移動があったかどうか
 */
export function simulateMove(
	currentBoard: Board,
	direction: Direction,
	mergeLimit: number,
): { board: Board; score: number; moved: boolean } {
	const boardIn = new Float64Array(currentBoard.flat());
	const boardOut = new Float64Array(SIZE * SIZE); // 結果を格納する配列

	const directionMap: { [key in Direction]: number } = {
		up: 0,
		right: 1,
		down: 2,
		left: 3,
	};
	const dir = directionMap[direction];

	// mergeLimitがInfinityの場合、Rustが扱える最大数に近い値を渡す
	const safeMergeLimit = !isFinite(mergeLimit) ? Number.MAX_SAFE_INTEGER : mergeLimit;

	try {
		const encodedResult = wasm.simulate_move(boardIn, boardOut, dir, safeMergeLimit);

		const score = Math.floor(encodedResult / 10);
		const moved = encodedResult % 10 === 1;

		const newBoard: Board = [];
		for (let i = 0; i < SIZE; i++) {
			newBoard.push(Array.from(boardOut.slice(i * SIZE, (i + 1) * SIZE)));
		}

		return { board: newBoard, score, moved };
	} catch (e) {
		console.error("WASM 'simulate_move' failed:", e);
		return { board: currentBoard, score: 0, moved: false };
	}
}

/**
 * 空きマスを取得する
 * @param board 盤面
 * @returns 空きマスの座標の配列
 */
export function getEmptyCells(board: Board): { r: number; c: number }[] {
	const cells: { r: number; c: number }[] = [];
	for (let r = 0; r < SIZE; r++) {
		for (let c = 0; c < SIZE; c++) {
			if (board[r][c] === 0) {
				cells.push({ r, c });
			}
		}
	}
	return cells;
}

/**
 * 新しいタイルをランダムに追加する
 * @param board 盤面
 * @returns タイルが追加された新しい盤面
 */
export function addRandomTile(board: Board): Board {
	const emptyCells = getEmptyCells(board);
	if (emptyCells.length > 0) {
		const { r, c } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
		const newBoard = board.map((row) => [...row]);
		// 90%の確率で2を、10%の確率で4を追加
		newBoard[r][c] = Math.random() < 0.9 ? 2 : 4;
		return newBoard;
	}
	return board;
}

/**
 * 新しい空の盤面を生成する
 * @returns 4x4のゼロで埋められた盤面
 */
export function initializeBoard(): Board {
	return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}
