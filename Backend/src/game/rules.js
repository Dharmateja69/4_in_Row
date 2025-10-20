// // rules.js - board model and core rules for no-gravity Connect-Four

// export function createEmptyBoard(rows = 6, cols = 7) {
//     return Array.from({ length: rows }, () => Array(cols).fill(null));
// }

// // In no-gravity, a legal move is any empty cell (r,c)
// export function legalCells(board) {
//     const R = board.length, C = board[0].length;
//     const out = [];
//     for (let r = 0; r < R; r++) {
//         for (let c = 0; c < C; c++) {
//             if (board[r][c] == null) out.push([r, c]);
//         }
//     }
//     return out;
// }

// // Apply a move at an exact cell (no gravity)
// export function applyCell(board, row, col, seat) {
//     if (row < 0 || row >= board.length) return false;
//     if (col < 0 || col >= board[0].length) return false;
//     if (board[row][col] != null) return false;
//     board[row][col] = seat;
//     return true;
// }

// // In-place variants for search
// export function applyCellInPlace(board, row, col, seat) { return applyCell(board, row, col, seat); }
// export function undoCellInPlace(board, row, col) { board[row][col] = null; }

// export function checkWinner(board) {
//     const R = board.length, C = board[0].length;
//     const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
//     for (let r = 0; r < R; r++) {
//         for (let c = 0; c < C; c++) {
//             const cell = board[r][c];
//             if (!cell) continue;
//             for (const [dr, dc] of dirs) {
//                 let count = 1, rr = r + dr, cc = c + dc;
//                 while (rr >= 0 && rr < R && cc >= 0 && cc < C && board[rr][cc] === cell) {
//                     count++;
//                     if (count === 4) return cell;
//                     rr += dr; cc += dc;
//                 }
//             }
//         }
//     }
//     return null;
// }

// export function isDraw(board) {
//     // draw if board full and no winner
//     for (let r = 0; r < board.length; r++) {
//         for (let c = 0; c < board[0].length; c++) {
//             if (board[r][c] == null) return false;
//         }
//     }
//     return !checkWinner(board);
// }

// export function opponentOf(seat) { return seat === 'X' ? 'O' : 'X'; }

// // Utility for heuristics
// export function collectWindows(board) {
//     const R = board.length, C = board[0].length, out = [];
//     // horizontal
//     for (let r = 0; r < R; r++)
//         for (let c = 0; c <= C - 4; c++)
//             out.push([board[r][c], board[r][c + 1], board[r][c + 2], board[r][c + 3]]);
//     // vertical
//     for (let c = 0; c < C; c++)
//         for (let r = 0; r <= R - 4; r++)
//             out.push([board[r][c], board[r + 1][c], board[r + 2][c], board[r + 3][c]]);
//     // diag down-right
//     for (let r = 0; r <= R - 4; r++)
//         for (let c = 0; c <= C - 4; c++)
//             out.push([board[r][c], board[r + 1][c + 1], board[r + 2][c + 2], board[r + 3][c + 3]]);
//     // diag up-right
//     for (let r = 3; r < R; r++)
//         for (let c = 0; c <= C - 4; c++)
//             out.push([board[r][c], board[r - 1][c + 1], board[r - 2][c + 2], board[r - 3][c + 3]]);
//     return out;
// }
// game/rules.js - Gravity-based Connect Four logic

const ROWS = 6;
const COLS = 7;

/** Create an empty 6x7 board filled with null values */
export function createEmptyBoard(rows = ROWS, cols = COLS) {
    return Array.from({ length: rows }, () => Array(cols).fill(null));
}

/**
 * Apply a move by dropping into a column (gravity rules).
 * @returns {{r: number, c: number} | null}
 */
export function applyMove(board, col, seat) {
    if (col < 0 || col >= COLS || board[0][col] !== null) {
        return null; // Column full or out of bounds
    }
    for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r][col] === null) {
            board[r][col] = seat;
            return { r, c: col };
        }
    }
    return null;
}

/** Undo a move (useful for AI/minimax) */
export function undoMove(board, col) {
    for (let r = 0; r < ROWS; r++) {
        if (board[r][col] !== null) {
            board[r][col] = null;
            return true;
        }
    }
    return false;
}

/** Return all valid columns where a piece can be dropped */
export function legalMoves(board) {
    const moves = [];
    for (let c = 0; c < COLS; c++) {
        if (board[0][c] === null) {
            moves.push(c);
        }
    }
    return moves;
}

/** Opponent player utility ('X' → 'O', 'O' → 'X') */
export function opponentOf(seat) {
    return seat === 'X' ? 'O' : 'X';
}

/** Check for a 4-in-a-row winner (horizontal, vertical, diagonal) */
export function checkWinner(board) {
    const dirs = [
        [0, 1],   // → Right
        [1, 0],   // ↓ Down
        [1, 1],   // ↘ Diagonal down-right
        [1, -1],  // ↙ Diagonal down-left
    ];

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const value = board[r][c];
            if (!value) continue;
            for (const [dr, dc] of dirs) {
                let count = 1, rr = r + dr, cc = c + dc;
                while (
                    rr >= 0 && rr < ROWS &&
                    cc >= 0 && cc < COLS &&
                    board[rr][cc] === value
                ) {
                    count++;
                    if (count === 4) return value;
                    rr += dr; cc += dc;
                }
            }
        }
    }
    return null;
}

/** Check if the game is a draw (board full and no winner) */
export function isDraw(board) {
    return legalMoves(board).length === 0 && !checkWinner(board);
}

/** Utility: Collect all possible 4-cell windows (used for AI heuristics) */
export function collectWindows(board) {
    const out = [];
    // Horizontal 4-cell windows
    for (let r = 0; r < ROWS; r++)
        for (let c = 0; c <= COLS - 4; c++)
            out.push([board[r][c], board[r][c + 1], board[r][c + 2], board[r][c + 3]]);

    // Vertical 4-cell windows
    for (let c = 0; c < COLS; c++)
        for (let r = 0; r <= ROWS - 4; r++)
            out.push([board[r][c], board[r + 1][c], board[r + 2][c], board[r + 3][c]]);

    // Diagonal down-right
    for (let r = 0; r <= ROWS - 4; r++)
        for (let c = 0; c <= COLS - 4; c++)
            out.push([board[r][c], board[r + 1][c + 1], board[r + 2][c + 2], board[r + 3][c + 3]]);

    // Diagonal up-right
    for (let r = 3; r < ROWS; r++)
        for (let c = 0; c <= COLS - 4; c++)
            out.push([board[r][c], board[r - 1][c + 1], board[r - 2][c + 2], board[r - 3][c + 3]]);

    return out;
}
