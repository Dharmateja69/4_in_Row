// game/bot.js – Gravity-based Competitive Bot using Minimax with timeout
import { checkWinner, legalMoves } from './rules.js';

const ROWS = 6;
const COLS = 7;
const EMPTY = null;

// Scores
const SCORE_WIN = 1000000;
const SCORE_THREE = 50;
const SCORE_TWO = 10;
const SCORE_CENTER = 3;

/**
 * Finds the best move for the bot using Minimax (gravity-based Connect 4)
 * @param {Array<Array<string>>} board - The current board state.
 * @param {string} botSeat - 'X' or 'O'
 * @param {number} maxDepth - Search depth (default = 5, max recommended = 7)
 * @returns {number} - Best column to play
 */
export function findBestMove(board, botSeat, maxDepth = 5) {
    console.log(`[BOT] findBestMove called with seat=${botSeat}, maxDepth=${maxDepth}`);

    try {
        // Clamp depth to reasonable values
        const safeDepth = Math.min(Math.max(maxDepth, 3), 7);
        if (safeDepth !== maxDepth) {
            console.log(`[BOT] Depth clamped from ${maxDepth} to ${safeDepth}`);
        }

        const playerSeat = botSeat === 'X' ? 'O' : 'X';
        const validMoves = legalMoves(board);

        console.log(`[BOT] Valid moves: [${validMoves.join(', ')}]`);

        if (validMoves.length === 0) {
            console.log(`[BOT] No valid moves available!`);
            return 3; // fallback to center
        }

        let bestScore = -Infinity;
        let bestCol = validMoves[Math.floor(Math.random() * validMoves.length)];

        // Prefer center column if available
        const centerCol = Math.floor(COLS / 2);
        if (validMoves.includes(centerCol)) {
            bestCol = centerCol;
            console.log(`[BOT] Default to center column ${centerCol}`);
        }

        // Check for immediate win
        for (const col of validMoves) {
            const pos = dropPiece(board, col, botSeat);
            if (pos && checkWinner(board) === botSeat) {
                undoDrop(board, pos.r, col);
                console.log(`[BOT] IMMEDIATE WIN at column ${col}`);
                return col;
            }
            if (pos) undoDrop(board, pos.r, col);
        }

        // Check for immediate block
        for (const col of validMoves) {
            const pos = dropPiece(board, col, playerSeat);
            if (pos && checkWinner(board) === playerSeat) {
                undoDrop(board, pos.r, col);
                console.log(`[BOT] BLOCKING at column ${col}`);
                return col;
            }
            if (pos) undoDrop(board, pos.r, col);
        }

        // Minimax search
        for (const col of validMoves) {
            const pos = dropPiece(board, col, botSeat);
            if (!pos) continue;

            const score = minimax(board, safeDepth - 1, -Infinity, Infinity, false, botSeat, playerSeat);
            undoDrop(board, pos.r, col);

            console.log(`[BOT] Column ${col} score: ${score}`);

            if (score > bestScore) {
                bestScore = score;
                bestCol = col;
            }
        }

        console.log(`[BOT] Best move: column ${bestCol} with score ${bestScore}`);
        return bestCol;

    } catch (error) {
        console.error(`[BOT] Error in findBestMove:`, error);
        // Fallback: return center column or first valid move
        const validMoves = legalMoves(board);
        return validMoves.includes(3) ? 3 : validMoves[0] || 3;
    }
}

function minimax(board, depth, alpha, beta, isMaximizing, botSeat, playerSeat) {
    const validMoves = legalMoves(board);
    const winner = checkWinner(board);

    if (winner === botSeat) return SCORE_WIN - depth;
    if (winner === playerSeat) return -SCORE_WIN + depth;
    if (depth === 0 || validMoves.length === 0) return scorePosition(board, botSeat);

    if (isMaximizing) {
        let value = -Infinity;
        for (const col of validMoves) {
            const pos = dropPiece(board, col, botSeat);
            if (!pos) continue;
            value = Math.max(value, minimax(board, depth - 1, alpha, beta, false, botSeat, playerSeat));
            undoDrop(board, pos.r, col);
            alpha = Math.max(alpha, value);
            if (alpha >= beta) break;
        }
        return value;
    } else {
        let value = Infinity;
        for (const col of validMoves) {
            const pos = dropPiece(board, col, playerSeat);
            if (!pos) continue;
            value = Math.min(value, minimax(board, depth - 1, alpha, beta, true, botSeat, playerSeat));
            undoDrop(board, pos.r, col);
            beta = Math.min(beta, value);
            if (alpha >= beta) break;
        }
        return value;
    }
}

/** Score a line of 4 cells */
function evaluateWindow(window, piece) {
    let score = 0;
    const oppPiece = piece === 'X' ? 'O' : 'X';

    const pieceCount = window.filter(v => v === piece).length;
    const oppCount = window.filter(v => v === oppPiece).length;
    const emptyCount = window.filter(v => v === EMPTY).length;

    if (pieceCount === 4) score += SCORE_WIN;
    else if (pieceCount === 3 && emptyCount === 1) score += SCORE_THREE;
    else if (pieceCount === 2 && emptyCount === 2) score += SCORE_TWO;

    if (oppCount === 3 && emptyCount === 1) score -= SCORE_THREE * 0.9;

    return score;
}

/** Score entire board from a player's perspective */
function scorePosition(board, piece) {
    let score = 0;

    // Center column bonus
    const centerCol = Math.floor(COLS / 2);
    const centerCount = board.map(r => r[centerCol]).filter(v => v === piece).length;
    score += centerCount * SCORE_CENTER;

    // Score all directions
    for (let r = 0; r < ROWS; r++)
        for (let c = 0; c <= COLS - 4; c++)
            score += evaluateWindow([board[r][c], board[r][c + 1], board[r][c + 2], board[r][c + 3]], piece);

    for (let c = 0; c < COLS; c++)
        for (let r = 0; r <= ROWS - 4; r++)
            score += evaluateWindow([board[r][c], board[r + 1][c], board[r + 2][c], board[r + 3][c]], piece);

    for (let r = 3; r < ROWS; r++)
        for (let c = 0; c <= COLS - 4; c++)
            score += evaluateWindow([board[r][c], board[r - 1][c + 1], board[r - 2][c + 2], board[r - 3][c + 3]], piece);

    for (let r = 0; r <= ROWS - 4; r++)
        for (let c = 0; c <= COLS - 4; c++)
            score += evaluateWindow([board[r][c], board[r + 1][c + 1], board[r + 2][c + 2], board[r + 3][c + 3]], piece);

    return score;
}

// Drop/Undo (gravity logic)
function dropPiece(board, col, piece) {
    for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r][col] === EMPTY) {
            board[r][col] = piece;
            return { r, c: col };
        }
    }
    return null; // Column is full
}

function undoDrop(board, r, col) {
    board[r][col] = EMPTY;
}
