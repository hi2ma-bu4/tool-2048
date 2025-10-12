use wasm_bindgen::prelude::*;

mod ai;
mod board;
mod tables;

// This function is called by the JavaScript worker.
// It takes the current board state and search depth,
// and returns the best move direction (0=up, 1=down, 2=left, 3=right).
#[wasm_bindgen]
pub fn find_best_move(board_js: &[f64], search_depth: u32) -> u32 {
    // 1. Convert the JS board to our internal bitboard representation.
    let board = board::from_js(board_js);

    // 2. Run the Expectimax search to find the best move.
    // The `ai::find_best_move` function encapsulates all the core logic.
    ai::find_best_move(board, search_depth)
}

// The old evaluation functions are no longer needed, as the entire
// search is now performed within WebAssembly.