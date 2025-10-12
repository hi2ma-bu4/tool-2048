// Represents the 4x4 board as a single u64 integer.
// Each of the 16 cells is represented by 4 bits (a nibble).
// A cell's value is the exponent of 2 (e.g., 1 for 2, 2 for 4, 3 for 8, ... 15 for 32768).
// 0 represents an empty cell.
pub type Board = u64;

// Type for a single row, represented as a 16-bit integer.
// Each of the 4 cells in a row is a 4-bit nibble.
pub type Row = u16;

/// Extracts a single row from the board.
#[inline]
pub fn get_row(board: Board, row_index: usize) -> Row {
    (board >> (row_index * 16)) as Row
}

/// Sets a single row on the board.
#[inline]
pub fn set_row(board: &mut Board, row_index: usize, row_val: Row) {
    // Clear the 16 bits for the target row
    *board &= !(0xFFFF_u64 << (row_index * 16));
    // Set the new row value
    *board |= (row_val as u64) << (row_index * 16);
}

/// Transposes the board. This is used to reuse the left-move logic for up-moves.
#[inline]
pub fn transpose(board: Board) -> Board {
    let mut new_board: Board = 0;
    for r in 0..4 {
        for c in 0..4 {
            let shift = (r * 16) + (c * 4);
            let tile = (board >> shift) & 0xF;
            let new_shift = (c * 16) + (r * 4);
            new_board |= tile << new_shift;
        }
    }
    new_board
}

/// Converts a board from the JavaScript representation (flat array of f64 tile values)
/// to the bitboard representation.
pub fn from_js(board_js: &[f64]) -> Board {
    let mut board: Board = 0;
    for r in 0..4 {
        for c in 0..4 {
            let tile_value = board_js[r * 4 + c];
            if tile_value != 0.0 {
                // The value stored is the log2 of the tile value.
                let exponent = tile_value.log2() as u64;
                let shift = (r * 16) + (c * 4);
                board |= exponent << shift;
            }
        }
    }
    board
}

/// Counts the number of empty cells (cells with value 0).
#[inline]
pub fn count_empty(board: Board) -> u32 {
    let mut count = 0;
    for i in 0..16 {
        if (board >> (i * 4)) & 0xF == 0 {
            count += 1;
        }
    }
    count
}

fn reverse_row(row: Row) -> Row {
    ((row & 0xF000) >> 12) | ((row & 0x0F00) >> 4) | ((row & 0x00F0) << 4) | ((row & 0x000F) << 12)
}

pub fn reverse(board: Board) -> Board {
    let mut new_board = 0;
    for i in 0..4 {
        set_row(&mut new_board, 3 - i, reverse_row(get_row(board, i)));
    }
    new_board
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_reverse() {
        let js_board = [
            1.0, 2.0, 3.0, 4.0,
            5.0, 6.0, 7.0, 8.0,
            9.0, 10.0, 11.0, 12.0,
            13.0, 14.0, 15.0, 16.0,
        ];
        let board = from_js(&js_board);
        let reversed = reverse(board);

        let expected_js = [
            16.0, 15.0, 14.0, 13.0,
            12.0, 11.0, 10.0, 9.0,
            8.0, 7.0, 6.0, 5.0,
            4.0, 3.0, 2.0, 1.0,
        ];
        let expected_board = from_js(&expected_js);

        assert_eq!(reversed, expected_board);
    }

    #[test]
    fn test_from_js_and_get_row() {
        let js_board = [
            2.0, 4.0, 8.0, 16.0, //
            32.0, 64.0, 128.0, 256.0, //
            512.0, 1024.0, 2048.0, 4096.0, //
            8192.0, 16384.0, 0.0, 0.0,
        ];
        let board = from_js(&js_board);

        // log2(2)=1, log2(4)=2, log2(8)=3, log2(16)=4
        assert_eq!(get_row(board, 0), 0x4321);
        // log2(32)=5, log2(64)=6, log2(128)=7, log2(256)=8
        assert_eq!(get_row(board, 1), 0x8765);
        // log2(512)=9, log2(1024)=10(A), log2(2048)=11(B), log2(4096)=12(C)
        assert_eq!(get_row(board, 2), 0xCBA9);
         // log2(8192)=13(D), log2(16384)=14(E), 0, 0
        assert_eq!(get_row(board, 3), 0x00ED);
    }

    #[test]
    fn test_transpose() {
        // Create a board:
        // 1 2 3 4
        // 5 6 7 8
        // 9 A B C
        // D E F 0
        let mut board: Board = 0;
        board |= 0x4321 << 0;
        board |= 0x8765 << 16;
        board |= 0xCBA9 << 32;
        board |= 0x0FED << 48;

        // After transpose:
        // 1 5 9 D
        // 2 6 A E
        // 3 7 B F
        // 4 8 C 0
        let transposed = transpose(board);

        assert_eq!(get_row(transposed, 0), 0xD951);
        assert_eq!(get_row(transposed, 1), 0xEA62);
        assert_eq!(get_row(transposed, 2), 0xFB73);
        assert_eq!(get_row(transposed, 3), 0x0C84);
    }

    #[test]
    fn test_count_empty() {
        let js_board = [
            2.0, 0.0, 8.0, 0.0, // 2 empty
            0.0, 64.0, 128.0, 256.0, // 1 empty
            512.0, 1024.0, 2048.0, 4096.0, // 0 empty
            0.0, 0.0, 0.0, 0.0, // 4 empty
        ];
        let board = from_js(&js_board);
        assert_eq!(count_empty(board), 7);
    }
}