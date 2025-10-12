// 4x4の盤面を表現するための定数
const SIZE: usize = 4;
// 各行（4セル）を表現するためのマスク (4ビット/セル * 4セル = 16ビット)
const ROW_MASK: u64 = 0xFFFF;

// 盤面の各行または列を抽出するためのマスク
static COL_MASKS: [u64; SIZE] = [
    0x000F000F000F000F,
    0x00F000F000F000F0,
    0x0F000F000F000F00,
    0xF000F000F000F000,
];

// ルックアップテーブル
// move_left_table[row] は、行 `row` を左にスライドさせた後の状態を返す
// move_right_table[row] は、行 `row` を右にスライドさせた後の状態を返す
// score_table[row] は、行 `row` のマージによって得られるスコアを返す
static mut MOVE_LEFT_TABLE: [u16; 65536] = [0; 65536];
static mut MOVE_RIGHT_TABLE: [u16; 65536] = [0; 65536];
static mut SCORE_TABLE: [u32; 65536] = [0; 65536];

// テーブルが初期化されたかどうかを示すフラグ
static mut TABLES_INITIALIZED: bool = false;

/// ルックアップテーブルを初期化する
pub fn init_tables() {
    unsafe {
        if TABLES_INITIALIZED {
            return;
        }

        for i in 0..65536 {
            let row_array = unpack_row(i as u16);
            let (result_array, score) = slide_left(row_array);
            let packed_row = pack_row(result_array);
            MOVE_LEFT_TABLE[i] = packed_row;
            SCORE_TABLE[i] = score;

            // 右スライドは、一度逆順にしてから左スライドし、再度逆順にすることで実現
            let reversed_row = reverse_row(row_array);
            let (result_reversed, _) = slide_left(reversed_row);
            let packed_reversed = pack_row(result_reversed);
            MOVE_RIGHT_TABLE[i] = reverse_row_packed(packed_reversed);
        }
        TABLES_INITIALIZED = true;
    }
}

/// 16ビットの行データを4つの4ビットタイル値に展開する
fn unpack_row(row: u16) -> [u8; SIZE] {
    let mut result = [0; SIZE];
    for i in 0..SIZE {
        result[i] = ((row >> (i * 4)) & 0xF) as u8;
    }
    result
}

/// 4つのタイル値の配列を16ビットの行データにパックする
fn pack_row(row_array: [u8; SIZE]) -> u16 {
    let mut result: u16 = 0;
    for i in 0..SIZE {
        result |= (row_array[i] as u16) << (i * 4);
    }
    result
}

/// 行を左にスライドさせ、マージする
fn slide_left(row_array: [u8; SIZE]) -> ([u8; SIZE], u32) {
    let mut new_row = [0; SIZE];
    let mut score = 0;
    let mut current_pos = 0;
    let mut last_val = 0;

    for i in 0..SIZE {
        let val = row_array[i];
        if val == 0 {
            continue;
        }

        if last_val == 0 {
            last_val = val;
        } else if last_val == val {
            new_row[current_pos] = val + 1;
            score += 1 << (val + 1);
            last_val = 0;
            current_pos += 1;
        } else {
            new_row[current_pos] = last_val;
            last_val = val;
            current_pos += 1;
        }
    }

    if last_val != 0 {
        new_row[current_pos] = last_val;
    }

    (new_row, score)
}

/// 行の順序を逆にする
fn reverse_row(row_array: [u8; SIZE]) -> [u8; SIZE] {
    let mut result = [0; SIZE];
    for i in 0..SIZE {
        result[i] = row_array[SIZE - 1 - i];
    }
    result
}

/// パックされた行データの順序を逆にする
fn reverse_row_packed(row: u16) -> u16 {
    let mut result = 0;
    result |= (row & 0xF) << 12;
    result |= (row & 0xF0) << 4;
    result |= (row & 0xF00) >> 4;
    result |= (row & 0xF000) >> 12;
    result
}

/// ビットボードを転置（行と列を入れ替え）する
fn transpose(board: u64) -> u64 {
    let mut new_board = 0;
    for r in 0..SIZE {
        for c in 0..SIZE {
            let shift = (r * 16) + (c * 4);
            let tile = (board >> shift) & 0xF;
            let new_shift = (c * 16) + (r * 4);
            new_board |= tile << new_shift;
        }
    }
    new_board
}

/// 指定された方向（0:上, 1:下, 2:左, 3:右）に盤面を動かす
/// 新しい盤面と得られたスコアを返す
pub fn move_board(board: u64, direction: u8) -> (u64, u32) {
    match direction {
        0 => { // 上
            let transposed = transpose(board);
            let (moved, score) = move_left_internal(transposed);
            (transpose(moved), score)
        },
        1 => { // 下
            let transposed = transpose(board);
            let (moved, score) = move_right_internal(transposed);
            (transpose(moved), score)
        },
        2 => move_left_internal(board), // 左
        3 => move_right_internal(board), // 右
        _ => (board, 0), // 無効な方向
    }
}

// ルックアップテーブルを使って左に移動する内部関数
fn move_left_internal(board: u64) -> (u64, u32) {
    let mut new_board = 0;
    let mut score = 0;
    unsafe {
        if !TABLES_INITIALIZED { init_tables(); }
        for i in 0..SIZE {
            let row_idx = ((board >> (i * 16)) & ROW_MASK) as usize;
            new_board |= (MOVE_LEFT_TABLE[row_idx] as u64) << (i * 16);
            score += SCORE_TABLE[row_idx];
        }
    }
    (new_board, score)
}

// ルックアップテーブルを使って右に移動する内部関数
fn move_right_internal(board: u64) -> (u64, u32) {
    let mut new_board = 0;
    let mut score = 0;
    unsafe {
        if !TABLES_INITIALIZED { init_tables(); }
        for i in 0..SIZE {
            let row_idx = ((board >> (i * 16)) & ROW_MASK) as usize;
            new_board |= (MOVE_RIGHT_TABLE[row_idx] as u64) << (i * 16);
            score += SCORE_TABLE[row_idx];
        }
    }
    (new_board, score)
}

/// 盤面上の空きマスの数を数える
pub fn count_empty(board: u64) -> u32 {
    let mut count = 0;
    for i in 0..16 {
        if (board >> (i * 4)) & 0xF == 0 {
            count += 1;
        }
    }
    count
}

/// ビットボード用のヒューリスティック評価関数
pub fn evaluate_bitboard(board: u64) -> f32 {
    let smoothness_weight = 0.1;
    let monotonicity_weight = 1.0;
    let empty_cells_weight = 2.7;
    let max_tile_weight = 1.0;

    let smoothness = calculate_smoothness_bitboard(board);
    let monotonicity = calculate_monotonicity_bitboard(board);
    let empty_cells = count_empty(board);
    let max_tile = get_max_tile_bitboard(board);

    // 空きマスが0の場合、log(0)で-infになるのを防ぐ
    let empty_bonus = if empty_cells > 0 {
        (empty_cells as f32).ln()
    } else {
        0.0
    };

    smoothness * smoothness_weight
        + monotonicity * monotonicity_weight
        + empty_bonus * empty_cells_weight
        + max_tile as f32 * max_tile_weight
}

fn get_tile(board: u64, r: usize, c: usize) -> u64 {
    (board >> ((r * SIZE + c) * 4)) & 0xF
}

fn calculate_smoothness_bitboard(board: u64) -> f32 {
    let mut smoothness = 0.0;
    for r in 0..SIZE {
        for c in 0..SIZE {
            let tile_power = get_tile(board, r, c);
            if tile_power != 0 {
                // 右の隣
                if c < SIZE - 1 {
                    let right_power = get_tile(board, r, c + 1);
                    if right_power != 0 {
                        smoothness -= (tile_power as f32 - right_power as f32).abs();
                    }
                }
                // 下の隣
                if r < SIZE - 1 {
                    let down_power = get_tile(board, r + 1, c);
                    if down_power != 0 {
                        smoothness -= (tile_power as f32 - down_power as f32).abs();
                    }
                }
            }
        }
    }
    smoothness
}

fn calculate_monotonicity_bitboard(board: u64) -> f32 {
    let mut totals = [0.0, 0.0, 0.0, 0.0]; // 上, 下, 左, 右

    // 左/右の単調性
    for r in 0..SIZE {
        let mut current_idx = 0;
        while current_idx < SIZE -1 {
            let mut next_idx = current_idx + 1;
            while next_idx < SIZE && get_tile(board, r, next_idx) == 0 { next_idx += 1; }
            if next_idx >= SIZE { break; }

            let current_power = get_tile(board, r, current_idx);
            if current_power > 0 {
                let next_power = get_tile(board, r, next_idx);
                if current_power > next_power {
                    totals[2] += (next_power as f32) - (current_power as f32);
                } else if next_power > current_power {
                    totals[3] += (current_power as f32) - (next_power as f32);
                }
            }
            current_idx = next_idx;
        }
    }

    // 上/下の単調性
    for c in 0..SIZE {
        let mut current_idx = 0;
        while current_idx < SIZE -1 {
            let mut next_idx = current_idx + 1;
            while next_idx < SIZE && get_tile(board, next_idx, c) == 0 { next_idx += 1; }
            if next_idx >= SIZE { break; }

            let current_power = get_tile(board, current_idx, c);
            if current_power > 0 {
                let next_power = get_tile(board, next_idx, c);
                if current_power > next_power {
                    totals[0] += (next_power as f32) - (current_power as f32);
                } else if next_power > current_power {
                    totals[1] += (current_power as f32) - (next_power as f32);
                }
            }
            current_idx = next_idx;
        }
    }

    totals[0].max(totals[1]) + totals[2].max(totals[3])
}

use std::collections::HashMap;

fn get_max_tile_bitboard(board: u64) -> u64 {
    let mut max_power = 0;
    for i in 0..16 {
        let power = (board >> (i * 4)) & 0xF;
        if power > max_power {
            max_power = power;
        }
    }
    max_power
}

// 評価済みの盤面をキャッシュするためのトランスポジションテーブル
type TranspositionTable = HashMap<u64, f32>;

/// Expectimax探索を実行する
pub fn expectimax_search(board: u64, depth: u32) -> (u8, f32) {
    let mut best_score = -1.0;
    let mut best_move = 0; // 0:上, 1:下, 2:左, 3:右

    for m in 0..4 {
        let (new_board, _) = move_board(board, m);
        if new_board != board {
            let mut table = TranspositionTable::new();
            let score = expectimax(new_board, depth - 1, false, &mut table);
            if score > best_score {
                best_score = score;
                best_move = m;
            }
        }
    }

    (best_move, best_score)
}

fn expectimax(board: u64, depth: u32, is_player_turn: bool, table: &mut TranspositionTable) -> f32 {
    if let Some(&score) = table.get(&board) {
        return score;
    }

    if depth == 0 {
        let score = evaluate_bitboard(board);
        table.insert(board, score);
        return score;
    }

    let result_score = if is_player_turn {
        // プレイヤーのターン：スコアを最大化する
        let mut max_score: f32 = -1.0;
        for m in 0..4 {
            let (new_board, _) = move_board(board, m);
            if new_board != board {
                max_score = max_score.max(expectimax(new_board, depth - 1, false, table));
            }
        }
        // 動ける手がない場合は、現在の盤面を評価（ゲームオーバーに近い状態）
        if max_score == -1.0 { evaluate_bitboard(board) } else { max_score }
    } else {
        // コンピュータのターン：期待値を計算する
        let empty_cells = find_empty_cells(board);
        let num_empty = empty_cells.len();
        if num_empty == 0 {
            // 空きマスがない場合はプレイヤーのターンに移行して探索を続ける
            return expectimax(board, depth, true, table);
        }

        let mut total_score = 0.0;
        for cell_idx in empty_cells {
            // 2が追加される場合 (確率90%)
            let board_with_2 = board | (1 << (cell_idx * 4));
            total_score += 0.9 * expectimax(board_with_2, depth - 1, true, table);

            // 4が追加される場合 (確率10%)
            let board_with_4 = board | (2 << (cell_idx * 4));
            total_score += 0.1 * expectimax(board_with_4, depth - 1, true, table);
        }
        total_score / num_empty as f32
    };

    table.insert(board, result_score);
    result_score
}

// 空きマスのインデックス（0-15）のリストを返す
fn find_empty_cells(board: u64) -> Vec<u8> {
    let mut empty_cells = Vec::new();
    for i in 0..16 {
        if (board >> (i * 4)) & 0xF == 0 {
            empty_cells.push(i as u8);
        }
    }
    empty_cells
}