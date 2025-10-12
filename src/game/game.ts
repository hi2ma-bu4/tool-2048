import { Board, Direction } from "../types";

const SIZE = 4;

/**
 * 指定された行（または列）を操作して、タイルを結合しスコアを計算する
 * @param row 操作する行
 * @param mergeLimit 結合上限値
 * @returns 操作後の行とスコア
 */
export function operateRow(row: number[], mergeLimit: number): { newRow: number[]; score: number } {
    const newRow = row.filter((val) => val !== 0);
    let score = 0;

    for (let i = 0; i < newRow.length - 1; i++) {
        if (newRow[i] === newRow[i + 1] && newRow[i] < mergeLimit) {
            newRow[i] *= 2;
            score += newRow[i];
            newRow.splice(i + 1, 1);
        }
    }
    while (newRow.length < SIZE) {
        newRow.push(0);
    }

    return { newRow, score };
}

/**
 * 行列を転置する
 * @param matrix 転置する行列
 * @returns 転置された行列
 */
export function transpose(matrix: Board): Board {
    return matrix[0].map((_, colIndex) => matrix.map((row) => row[colIndex]));
}

/**
 * 指定された方向に盤面を動かすシミュレーションを行う
 * @param currentBoard 現在の盤面
 * @param direction 動かす方向
 * @param mergeLimit 結合上限値
 * @returns シミュレーション後の盤面、スコア、移動があったかどうか
 */
export function simulateMove(currentBoard: Board, direction: Direction, mergeLimit: number): { board: Board; score: number; moved: boolean } {
    let tempBoard = currentBoard.map((row) => [...row]);
    let moveScore = 0;
    const originalBoardStr = JSON.stringify(tempBoard);

    if (direction === "up" || direction === "down") {
        tempBoard = transpose(tempBoard);
    }

    for (let i = 0; i < SIZE; i++) {
        let row = tempBoard[i];
        if (direction === "right" || direction === "down") {
            row.reverse();
        }
        const result = operateRow(row, mergeLimit);
        if (direction === "right" || direction === "down") {
            result.newRow.reverse();
        }
        tempBoard[i] = result.newRow;
        moveScore += result.score;
    }

    if (direction === "up" || direction === "down") {
        tempBoard = transpose(tempBoard);
    }

    const boardChanged = JSON.stringify(tempBoard) !== originalBoardStr;
    return { board: tempBoard, score: moveScore, moved: boardChanged };
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
        const newBoard = board.map(row => [...row]);
        newBoard[r][c] = 2; // 常に2を追加
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