use wasm_bindgen::prelude::*;

const SIZE: usize = 4;

// ... (省略: log2, get_empty_cells_count, evaluate_pattern, get_pattern_score, rotate_matrix, evaluate_board, board_js_to_rust, calculate_smoothness, calculate_monotonicity, is_max_tile_in_corner, evaluate_snake_pattern)

// Serdeを使ってJSのオブジェクトに変換できるようにする
// 不要になるので削除
// #[derive(Serialize)]
// pub struct MoveResult {
//     board: Vec<f64>,
//     score: i32,
//     moved: bool,
// }

fn operate_row(row: &[f64], merge_limit: f64) -> (Vec<f64>, i32) {
    let tiles: Vec<f64> = row.iter().cloned().filter(|&v| v != 0.0).collect();
    let mut result_row: Vec<f64> = Vec::with_capacity(SIZE);
    let mut score = 0;

    let mut i = 0;
    while i < tiles.len() {
        if i + 1 < tiles.len() && tiles[i] == tiles[i + 1] && tiles[i] < merge_limit {
            let merged_val = tiles[i] * 2.0;
            result_row.push(merged_val);
            score += merged_val as i32;
            i += 2; // 2つのタイルを消費したので2つ進める
        } else {
            result_row.push(tiles[i]);
            i += 1; // 1つのタイルを消費
        }
    }

    while result_row.len() < SIZE {
        result_row.push(0.0);
    }
    (result_row, score)
}

fn transpose_board(board: &[[f64; SIZE]; SIZE]) -> [[f64; SIZE]; SIZE] {
    let mut new_board = [[0.0; SIZE]; SIZE];
    for r in 0..SIZE {
        for c in 0..SIZE {
            new_board[c][r] = board[r][c];
        }
    }
    new_board
}

#[wasm_bindgen]
pub fn simulate_move(board_in: &[f64], board_out: &mut [f64], direction: u8, merge_limit: f64) -> i32 {
    let initial_board_state = board_in.to_vec();
    let mut temp_board = board_js_to_rust(board_in);
    let mut score = 0;

    if direction == 0 || direction == 2 { // up, down
        temp_board = transpose_board(&temp_board);
    }

    for i in 0..SIZE {
        let mut row = temp_board[i];
        if direction == 1 || direction == 2 { // right, down
            row.reverse();
        }

        let (new_row_vec, row_score) = operate_row(&row, merge_limit);
        score += row_score;

        let mut new_row_array = [0.0; SIZE];
        new_row_array.copy_from_slice(&new_row_vec);

        if direction == 1 || direction == 2 { // right, down
            new_row_array.reverse();
        }
        temp_board[i] = new_row_array;
    }

    if direction == 0 || direction == 2 { // up, down
        temp_board = transpose_board(&temp_board);
    }

    let final_board_vec: Vec<f64> = temp_board.iter().flatten().cloned().collect();
    let moved = initial_board_state != final_board_vec;

    board_out.copy_from_slice(&final_board_vec);

    // スコアとmovedフラグをエンコードして返す
    let moved_flag = if moved { 1 } else { 0 };
    score * 10 + moved_flag
}

// ... (ここに元の評価関数群を再挿入)
// evaluate_pattern, get_pattern_score, rotate_matrix, evaluate_board, calculate_smoothness, calculate_monotonicity, is_max_tile_in_corner, evaluate_snake_pattern
// `board_js_to_rust`は `simulate_move` の前に移動済み

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
fn board_js_to_rust(board_js: &[f64]) -> [[f64; SIZE]; SIZE] {
    let mut board = [[0.0; SIZE]; SIZE];
    for r in 0..SIZE {
        for c in 0..SIZE {
            board[r][c] = board_js[r * SIZE + c];
        }
    }
    board
}