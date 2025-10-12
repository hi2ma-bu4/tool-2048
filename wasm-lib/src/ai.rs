use crate::board::{self, Board};
use crate::tables;
use std::collections::HashMap;

// --- Move Execution ---

/// Executes a move in the given direction and returns the new board and the score.
/// Directions: 0=up, 1=down, 2=left, 3=right
pub fn execute_move(board: Board, dir: u32) -> (Board, u32) {
    match dir {
        0 => move_up(board),
        1 => move_down(board),
        2 => move_left(board),
        3 => move_right(board),
        _ => (board, 0), // Should not happen
    }
}

fn move_left(board: Board) -> (Board, u32) {
    let mut new_board = 0;
    let mut total_score = 0;
    for i in 0..4 {
        let row = board::get_row(board, i);
        let (new_row, score) = tables::move_left(row);
        board::set_row(&mut new_board, i, new_row);
        total_score += score;
    }
    (new_board, total_score)
}

fn move_right(board: Board) -> (Board, u32) {
    let reversed = board::reverse(board);
    let (new_reversed, score) = move_left(reversed);
    (board::reverse(new_reversed), score)
}

fn move_up(board: Board) -> (Board, u32) {
    let transposed = board::transpose(board);
    let (new_transposed, score) = move_left(transposed);
    (board::transpose(new_transposed), score)
}

fn move_down(board: Board) -> (Board, u32) {
    let transposed = board::transpose(board);
    let (new_transposed, score) = move_right(transposed);
    (board::transpose(new_transposed), score)
}

// --- Heuristic Evaluation ---
// These weights are chosen based on common strategies for 2048.
const MONOTONICITY_WEIGHT: f64 = 4.0;
const SMOOTHNESS_WEIGHT: f64 = 0.1;
const EMPTY_CELLS_WEIGHT: f64 = 2.7;
const MAX_TILE_WEIGHT: f64 = 1.0;

/// Evaluates the board based on a set of heuristics.
fn evaluate_board(board: Board) -> f64 {
    let empty_cells = board::count_empty(board) as f64;
    let (mono, smoothness, max_tile) = calculate_metrics(board);

    mono * MONOTONICITY_WEIGHT
        + smoothness * SMOOTHNESS_WEIGHT
        + empty_cells.ln_1p() * EMPTY_CELLS_WEIGHT
        + max_tile * MAX_TILE_WEIGHT
}

/// Calculates monotonicity, smoothness, and max tile value for the board.
fn calculate_metrics(board: Board) -> (f64, f64, f64) {
    let mut monotonicity = 0.0;
    let mut smoothness = 0.0;
    let mut max_tile: f64 = 0.0;

    let mut totals: [f64; 4] = [0.0; 4]; // up, down, left, right monotonicity

    for i in 0..4 {
        let mut row_tiles = [0; 4];
        let mut col_tiles = [0; 4];
        for j in 0..4 {
            row_tiles[j] = (board >> (i * 16 + j * 4)) & 0xF;
            col_tiles[j] = (board >> (j * 16 + i * 4)) & 0xF;
        }

        for k in 0..3 {
            if row_tiles[k] > row_tiles[k + 1] {
                totals[2] += (row_tiles[k + 1] as f64).powi(2) - (row_tiles[k] as f64).powi(2);
            } else {
                totals[3] += (row_tiles[k] as f64).powi(2) - (row_tiles[k + 1] as f64).powi(2);
            }

            if col_tiles[k] > col_tiles[k + 1] {
                totals[0] += (col_tiles[k + 1] as f64).powi(2) - (col_tiles[k] as f64).powi(2);
            } else {
                totals[1] += (col_tiles[k] as f64).powi(2) - (col_tiles[k + 1] as f64).powi(2);
            }
        }
    }

    monotonicity = totals[0].max(totals[1]) + totals[2].max(totals[3]);

    for r in 0..4 {
        for c in 0..4 {
            let tile_val = (board >> (r * 16 + c * 4)) & 0xF;
            if tile_val == 0 { continue; }

            max_tile = max_tile.max(tile_val as f64);

            if c < 3 {
                let right_val = (board >> (r * 16 + (c + 1) * 4)) & 0xF;
                if right_val != 0 {
                    smoothness -= ((tile_val as f64) - (right_val as f64)).abs();
                }
            }
            if r < 3 {
                let down_val = (board >> ((r + 1) * 16 + c * 4)) & 0xF;
                if down_val != 0 {
                    smoothness -= ((tile_val as f64) - (down_val as f64)).abs();
                }
            }
        }
    }

    (monotonicity, smoothness, max_tile)
}


// --- Expectimax Search ---

type TranspositionTable = HashMap<Board, f64>;

fn expectimax(board: Board, depth: u32, is_player_turn: bool, table: &mut TranspositionTable) -> f64 {
    if let Some(&score) = table.get(&board) {
        return score;
    }

    if depth == 0 {
        return evaluate_board(board);
    }

    let result_score = if is_player_turn {
        // Player's turn: Maximize score
        let mut max_score = -f64::INFINITY;
        let mut moved = false;
        for i in 0..4 {
            let (new_board, _score) = execute_move(board, i);
            if new_board != board {
                moved = true;
                max_score = max_score.max(expectimax(new_board, depth - 1, false, table));
            }
        }
        if !moved { 0.0 } else { max_score }
    } else {
        // Computer's turn: Calculate expectation
        let empty_cells = find_empty_cell_masks(board);
        let num_empty = empty_cells.len();
        if num_empty == 0 {
            return expectimax(board, depth, true, table);
        }

        let mut total_score = 0.0;
        for pos_mask in empty_cells {
            let board_with_2 = board | (1 << pos_mask);
            total_score += 0.9 * expectimax(board_with_2, depth - 1, true, table);

            let board_with_4 = board | (2 << pos_mask);
            total_score += 0.1 * expectimax(board_with_4, depth - 1, true, table);
        }
        total_score / (num_empty as f64)
    };

    table.insert(board, result_score);
    result_score
}

fn find_empty_cell_masks(board: Board) -> Vec<u32> {
    let mut empty_cells = Vec::new();
    for i in 0..16 {
        let shift = i * 4;
        if (board >> shift) & 0xF == 0 {
            empty_cells.push(shift);
        }
    }
    empty_cells
}

// --- Public API ---

pub fn find_best_move(board: Board, search_depth: u32) -> u32 {
    let mut best_move = 0;
    let mut best_score = -f64::INFINITY;
    let mut table = TranspositionTable::with_capacity(100_000); // Pre-allocate for performance

    for i in 0..4 { // 0: up, 1: down, 2: left, 3: right
        let (new_board, _score) = execute_move(board, i);

        if new_board != board {
            let score = expectimax(new_board, search_depth - 1, false, &mut table);
            if score > best_score {
                best_score = score;
                best_move = i;
            }
        }
    }
    best_move
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::board;

    #[test]
    fn test_horizontal_moves() {
        // Board:
        // 2 2 0 0
        // 4 4 0 0
        let board = board::from_js(&[
            2.0, 2.0, 0.0, 0.0,
            4.0, 4.0, 0.0, 0.0,
            0.0, 0.0, 0.0, 0.0,
            0.0, 0.0, 0.0, 0.0,
        ]);

        // Expected after move left:
        // 4 0 0 0
        // 8 0 0 0
        let expected_left_board = board::from_js(&[
            4.0, 0.0, 0.0, 0.0,
            8.0, 0.0, 0.0, 0.0,
            0.0, 0.0, 0.0, 0.0,
            0.0, 0.0, 0.0, 0.0,
        ]);
        let (left_board, left_score) = move_left(board);
        assert_eq!(left_board, expected_left_board);
        assert_eq!(left_score, 4 + 8);

        // Expected after move right:
        // 0 0 0 4
        // 0 0 0 8
        let expected_right_board = board::from_js(&[
            0.0, 0.0, 0.0, 4.0,
            0.0, 0.0, 0.0, 8.0,
            0.0, 0.0, 0.0, 0.0,
            0.0, 0.0, 0.0, 0.0,
        ]);
        let (right_board, right_score) = move_right(board);
        assert_eq!(right_board, expected_right_board);
        assert_eq!(right_score, 4 + 8);
    }

    #[test]
    fn test_vertical_moves() {
        // Board:
        // 2 4 0 0
        // 2 4 0 0
        let board = board::from_js(&[
            2.0, 4.0, 0.0, 0.0,
            2.0, 4.0, 0.0, 0.0,
            0.0, 0.0, 0.0, 0.0,
            0.0, 0.0, 0.0, 0.0,
        ]);

        // Expected after move up:
        // 4 8 0 0
        // 0 0 0 0
        let expected_up_board = board::from_js(&[
            4.0, 8.0, 0.0, 0.0,
            0.0, 0.0, 0.0, 0.0,
            0.0, 0.0, 0.0, 0.0,
            0.0, 0.0, 0.0, 0.0,
        ]);
        let (up_board, up_score) = move_up(board);
        assert_eq!(up_board, expected_up_board);
        assert_eq!(up_score, 4 + 8);
    }



    #[test]
    fn test_find_best_move_simple() {
        // A board where moving right is the only move that does anything.
        let board = board::from_js(&[
            2.0, 2.0, 0.0, 0.0,
            0.0, 0.0, 0.0, 0.0,
            0.0, 0.0, 0.0, 0.0,
            0.0, 0.0, 0.0, 0.0,
        ]);
        // Moving left merges, right slides, up/down do nothing.
        let best_move = find_best_move(board, 3);
        // Expectimax should prefer the merge.
        assert_eq!(best_move, 2); // 2 = left
    }
}