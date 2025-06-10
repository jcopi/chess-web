import { Move, Position } from "chessops";

/**
 * Interface for chess players that can make moves in a game.
 * 
 * Players can be human (via UI interaction), computer (via UCI engine),
 * or remote (via network). Each player type implements the move generation
 * and cancellation methods according to its specific requirements.
 */
export interface Player {
    /**
     * Requests the next move from this player for the current game position.
     * 
     * This method should return a Promise that resolves when the player has
     * chosen their move. For human players, this typically involves waiting
     * for UI interaction. For computer players, this involves calculating
     * the best move using an engine.
     * 
     * @param moves - Array of all moves played so far in the game
     * @param position - Current chess position/board state
     * @param timeout_ms - Optional timeout in milliseconds (implementation dependent)
     * @returns Promise that resolves to the chosen Move
     * @throws Error if move generation fails or times out
     * 
     * @example
     * ```typescript
     * const move = await player.get_next_move(gameHistory, currentPosition, 30000);
     * console.log(`Player chose: ${makeUci(move)}`);
     * ```
     */
    get_next_move(moves: Move[], position: Position, timeout_ms?: number): Promise<Move>;

    /**
     * Cancels any pending move request from this player.
     * 
     * This method should immediately abort any ongoing move calculation or
     * user input waiting. For human players, this typically rejects the
     * Promise returned by get_next_move(). For computer players, this may
     * be a no-op since the move calculation can continue in the background.
     * 
     * Safe to call multiple times or when no move is pending.
     * 
     * @example
     * ```typescript
     * // Start getting a move
     * const movePromise = player.get_next_move(moves, position);
     * 
     * // Cancel it due to game rollback
     * player.cancel_move();
     * 
     * // The movePromise should reject with a cancellation error
     * ```
     */
    cancel_move(): void;
}