use wasm_bindgen::prelude::*;

const SIZE: usize = 4;

// JavaScriptの `Math.log2` は f64 を受け取るので、Rustでも f64 で計算
fn log2(n: f64) -> f64 {
    if n == 0.0 {
        0.0
    } else {
        n.log2()
    }
}

fn get_empty_cells_count(board: &[f64]) -> i32 {
    board.iter().filter(|&&v| v == 0.0).count() as i32
}

#[wasm_bindgen]
pub fn evaluate_pattern(board_js: &[f64], empty_cells_weight: f64) -> f64 {
    let mut snake_pattern_weights: [[f64; SIZE]; SIZE] = [
        [15.0, 14.0, 13.0, 12.0],
        [8.0, 9.0, 10.0, 11.0],
        [7.0, 6.0, 5.0, 4.0],
        [0.0, 1.0, 2.0, 3.0],
    ];
    for r in 0..SIZE {
        for c in 0..SIZE {
            snake_pattern_weights[r][c] = 4.0f64.powf(snake_pattern_weights[r][c]);
        }
    }

    let mut best_score: f64 = 0.0;
    let mut current_pattern = snake_pattern_weights;

    for _ in 0..4 {
        best_score = best_score.max(get_pattern_score(board_js, &current_pattern));
        current_pattern = rotate_matrix(&current_pattern);
    }

    let empty_cells = get_empty_cells_count(board_js);
    best_score + log2((empty_cells + 1) as f64) * empty_cells_weight
}

fn get_pattern_score(board: &[f64], pattern: &[[f64; SIZE]; SIZE]) -> f64 {
    let mut score = 0.0;
    for r in 0..SIZE {
        for c in 0..SIZE {
            let tile_value = board[r * SIZE + c];
            if tile_value != 0.0 {
                score += log2(tile_value) * pattern[r][c];
            }
        }
    }
    score
}

fn rotate_matrix(matrix: &[[f64; SIZE]; SIZE]) -> [[f64; SIZE]; SIZE] {
    let mut result = [[0.0; SIZE]; SIZE];
    for r in 0..SIZE {
        for c in 0..SIZE {
            result[c][SIZE - 1 - r] = matrix[r][c];
        }
    }
    result
}

#[wasm_bindgen]
pub fn evaluate_board(
    board_js: &[f64],
    smoothness_weight: f64,
    monotonicity_weight: f64,
    empty_cells_weight: f64,
    max_tile_weight: f64,
) -> f64 {
    let board = board_js_to_rust(board_js);

    let empty_cells = get_empty_cells_count(board_js);
    let max_tile_value = board_js.iter().cloned().fold(0.0, f64::max);

    let smoothness = calculate_smoothness(&board);
    let monotonicity = calculate_monotonicity(&board);
    let max_tile_bonus = if is_max_tile_in_corner(&board, max_tile_value) {
        max_tile_value
    } else {
        0.0
    };

    smoothness * smoothness_weight
        + monotonicity * monotonicity_weight
        + log2((empty_cells + 1) as f64) * empty_cells_weight
        + max_tile_bonus * max_tile_weight
}

fn board_js_to_rust(board_js: &[f64]) -> [[f64; SIZE]; SIZE] {
    let mut board = [[0.0; SIZE]; SIZE];
    for r in 0..SIZE {
        for c in 0..SIZE {
            board[r][c] = board_js[r * SIZE + c];
        }
    }
    board
}

fn calculate_smoothness(board: &[[f64; SIZE]; SIZE]) -> f64 {
    let mut smoothness = 0.0;
    for r in 0..SIZE {
        for c in 0..SIZE {
            let tile_value = board[r][c];
            if tile_value != 0.0 {
                // Right neighbor
                if c < SIZE - 1 && board[r][c + 1] != 0.0 {
                    smoothness -= (log2(tile_value) - log2(board[r][c + 1])).abs();
                }
                // Down neighbor
                if r < SIZE - 1 && board[r + 1][c] != 0.0 {
                    smoothness -= (log2(tile_value) - log2(board[r + 1][c])).abs();
                }
            }
        }
    }
    smoothness
}

fn calculate_monotonicity(board: &[[f64; SIZE]; SIZE]) -> f64 {
    let mut totals = [0.0, 0.0, 0.0, 0.0]; // up, down, left, right

    // Left/Right monotonicity
    for r in 0..SIZE {
        let row = &board[r];
        let non_zero_logs: Vec<f64> = row.iter().map(|&v| log2(v)).filter(|&v| v > 0.0).collect();
        if non_zero_logs.len() < 2 {
            continue;
        }
        for i in 0..(non_zero_logs.len() - 1) {
            if non_zero_logs[i] > non_zero_logs[i + 1] {
                totals[2] += non_zero_logs[i + 1] - non_zero_logs[i];
            } else if non_zero_logs[i + 1] > non_zero_logs[i] {
                totals[3] += non_zero_logs[i] - non_zero_logs[i + 1];
            }
        }
    }

    // Up/Down monotonicity
    for c in 0..SIZE {
        let column: Vec<f64> = (0..SIZE).map(|r| board[r][c]).collect();
        let non_zero_logs: Vec<f64> = column
            .iter()
            .map(|&v| log2(v))
            .filter(|&v| v > 0.0)
            .collect();
        if non_zero_logs.len() < 2 {
            continue;
        }
        for i in 0..(non_zero_logs.len() - 1) {
            if non_zero_logs[i] > non_zero_logs[i + 1] {
                totals[0] += non_zero_logs[i + 1] - non_zero_logs[i];
            } else if non_zero_logs[i + 1] > non_zero_logs[i] {
                totals[1] += non_zero_logs[i] - non_zero_logs[i + 1];
            }
        }
    }

    totals[0].max(totals[1]) + totals[2].max(totals[3])
}

fn is_max_tile_in_corner(board: &[[f64; SIZE]; SIZE], max_tile: f64) -> bool {
    let corners = [
        board[0][0],
        board[0][SIZE - 1],
        board[SIZE - 1][0],
        board[SIZE - 1][SIZE - 1],
    ];
    corners.contains(&max_tile)
}

#[wasm_bindgen]
pub fn evaluate_snake_pattern(board_js: &[f64]) -> f64 {
    const SNAKE_PATTERN_WEIGHTS_SINGLE: [[f64; SIZE]; SIZE] = [
        [10.0, 8.0, 7.0, 6.5],
        [-0.5, 0.7, 1.5, 3.0],
        [-1.5, -1.0, 1.0, 2.0],
        [-3.0, -2.0, -1.5, -1.0],
    ];

    let mut score = 0.0;
    for i in 0..SIZE {
        for j in 0..SIZE {
            score += SNAKE_PATTERN_WEIGHTS_SINGLE[i][j] * board_js[i * SIZE + j];
        }
    }
    score
}
