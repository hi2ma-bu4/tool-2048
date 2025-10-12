use crate::board::Row;
use once_cell::sync::Lazy;

// MoveTables will hold the pre-calculated results for all possible rows.
// The tables are boxed to allocate them on the heap, preventing stack overflow.
pub struct MoveTables {
    // move_left_table[row] -> the resulting row after a left move
    pub move_left_table: Box<[Row; 65536]>,
    // score_table[row] -> the score obtained from a left move
    pub score_table: Box<[u32; 65536]>,
}

impl MoveTables {
    fn new() -> Self {
        let mut move_left_table = Box::new([0; 65536]);
        let mut score_table = Box::new([0; 65536]);

        for i in 0..=0xFFFF {
            let row = i as Row;
            let mut tiles = [
                (row >> 0) & 0xF,
                (row >> 4) & 0xF,
                (row >> 8) & 0xF,
                (row >> 12) & 0xF,
            ];

            let (mut new_tiles, score) = Self::slide_and_merge(&tiles);

            let mut result_row: Row = 0;
            for (i, &tile) in new_tiles.iter().enumerate() {
                result_row |= tile << (i * 4);
            }

            move_left_table[i] = result_row;
            score_table[i] = score;
        }

        MoveTables {
            move_left_table,
            score_table,
        }
    }

    // Simulates a left slide on a single row's tiles.
    fn slide_and_merge(tiles: &[Row; 4]) -> ([Row; 4], u32) {
        let mut new_tiles = [0; 4];
        let mut score = 0;
        let mut current_pos = 0;

        // 1. Slide non-zero tiles to the left
        let mut slided_tiles = [0; 4];
        let mut slided_idx = 0;
        for &tile in tiles.iter() {
            if tile != 0 {
                slided_tiles[slided_idx] = tile;
                slided_idx += 1;
            }
        }

        // 2. Merge adjacent equal tiles
        let mut i = 0;
        while i < 4 {
            if slided_tiles[i] != 0 && i + 1 < 4 && slided_tiles[i] == slided_tiles[i+1] {
                let new_tile_val = slided_tiles[i] + 1;
                new_tiles[current_pos] = new_tile_val;
                score += 1 << new_tile_val; // Score is 2^new_tile_val
                current_pos += 1;
                i += 2; // Skip the next tile as it has been merged
            } else {
                new_tiles[current_pos] = slided_tiles[i];
                if slided_tiles[i] != 0 {
                    current_pos +=1;
                }
                i += 1;
            }
        }

        (new_tiles, score)
    }
}

// Global static instance of the move tables, initialized lazily.
static TABLES: Lazy<MoveTables> = Lazy::new(MoveTables::new);

/// Performs a left move on a row using the pre-calculated lookup table.
#[inline]
pub fn move_left(row: Row) -> (Row, u32) {
    let res = TABLES.move_left_table[row as usize];
    let score = TABLES.score_table[row as usize];
    (res, score)
}

// To perform other moves, we can rotate the board and apply the left move.
// move_right(row) is equivalent to reverse(move_left(reverse(row)))
// We can also generate tables for them, but this is more memory efficient.
fn reverse_row(row: Row) -> Row {
    ((row & 0xF000) >> 12) | ((row & 0x0F00) >> 4) | ((row & 0x00F0) << 4) | ((row & 0x000F) << 12)
}

#[inline]
pub fn move_right(row: Row) -> (Row, u32) {
    let (new_row, score) = move_left(reverse_row(row));
    (reverse_row(new_row), score)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Helper to create a row from 4 tile values (0-15)
    fn row(a: u16, b: u16, c: u16, d: u16) -> Row {
        (d << 12) | (c << 8) | (b << 4) | a
    }

    #[test]
    fn test_move_left() {
        // No move: [2, 4, 8, 16] -> [2, 4, 8, 16], score 0
        // log2 values: 1, 2, 3, 4
        let r1 = row(1, 2, 3, 4);
        let (res1, score1) = move_left(r1);
        assert_eq!(res1, row(1, 2, 3, 4));
        assert_eq!(score1, 0);

        // Simple slide: [2, 0, 0, 4] -> [2, 4, 0, 0], score 0
        let r2 = row(1, 0, 0, 2);
        let (res2, score2) = move_left(r2);
        assert_eq!(res2, row(1, 2, 0, 0));
        assert_eq!(score2, 0);

        // Merge: [2, 2, 0, 0] -> [4, 0, 0, 0], score 4
        let r3 = row(1, 1, 0, 0);
        let (res3, score3) = move_left(r3);
        assert_eq!(res3, row(2, 0, 0, 0));
        assert_eq!(score3, 4);

        // Merge complex: [4, 4, 4, 4] -> [8, 8, 0, 0], score 16
        let r4 = row(2, 2, 2, 2);
        let (res4, score4) = move_left(r4);
        assert_eq!(res4, row(3, 3, 0, 0));
        assert_eq!(score4, 8 + 8);

        // Merge with slide: [0, 2, 2, 4] -> [4, 4, 0, 0], score 4
        let r5 = row(0, 1, 1, 2);
        let (res5, score5) = move_left(r5);
        assert_eq!(res5, row(2, 2, 0, 0));
        assert_eq!(score5, 4);

        // Full row merge: [2, 2, 4, 4] -> [4, 8, 0, 0], score 4+8=12
        let r6 = row(1, 1, 2, 2);
        let (res6, score6) = move_left(r6);
        assert_eq!(res6, row(2, 3, 0, 0));
        assert_eq!(score6, 4 + 8);
    }

    #[test]
    fn test_move_right() {
        // [2, 4, 8, 16] -> [2, 4, 8, 16]
        let r1 = row(1, 2, 3, 4);
        let (res1, score1) = move_right(r1);
        assert_eq!(res1, row(1, 2, 3, 4));
        assert_eq!(score1, 0);

        // Simple slide: [2, 0, 0, 4] -> [0, 0, 2, 4]
        let r2 = row(1, 0, 0, 2);
        let (res2, score2) = move_right(r2);
        assert_eq!(res2, row(0, 0, 1, 2));
        assert_eq!(score2, 0);

        // Merge: [0, 0, 2, 2] -> [0, 0, 0, 4], score 4
        let r3 = row(0, 0, 1, 1);
        let (res3, score3) = move_right(r3);
        assert_eq!(res3, row(0, 0, 0, 2));
        assert_eq!(score3, 4);

        // Merge complex: [2, 2, 4, 4] -> [0, 0, 4, 8], score 12
        let r4 = row(1, 1, 2, 2);
        let (res4, score4) = move_right(r4);
        assert_eq!(res4, row(0, 0, 2, 3));
        assert_eq!(score4, 4 + 8);
    }
}