import { Api } from "chessground/api";
import { Player } from "./player";
import { Color, Key } from "chessground/types";
import {
    attacks,
    Board,
    Chess,
    isNormal,
    makeSquare,
    Move,
    opposite,
    parseSquare,
    Position,
    SquareSet,
} from "chessops";
import { chessgroundDests } from "chessops/compat";
import { INITIAL_BOARD_FEN, makeFen, parseFen } from "chessops/fen";
import { PromotionDialog, RollbackDialog } from "./dialogs";
import { makeSan } from "chessops/san";
import { SkillLevel, UCI } from "./uci";
import { Chessground } from "chessground";

export class ChessgroundPlayer implements Player {
    api: Api;
    color: Color | "both";

    next_move: Move | undefined;
    move_handler: ((move: Move) => void) | undefined;
    current_move_reject: ((reason?: any) => void) | undefined;

    constructor(api: Api, color: Color | "both") {
        this.color = color;

        if (this.color != "both") {
            api.set({
                orientation: this.color,
            });
        }

        api.set({
            movable: {
                free: false,
                color: color,
                showDests: true,
                events: {
                    after: (orig, dest, _) => {
                        let move: Move = {
                            from: parseSquare(orig)!,
                            to: parseSquare(dest)!,
                        };

                        if (this.move_handler !== undefined) {
                            this.move_handler(move);
                            this.move_handler = undefined;
                        }
                    },
                },
            },
        });

        this.api = api;
        this.next_move = undefined;
    }

    async get_next_move(_moves: Move[], position: Position, _timeout_ms?: number): Promise<Move> {
        this.api.set({
            movable: {
                dests: chessgroundDests(position),
            },
        });

        return new Promise<Move>((resolve, reject) => {
            this.current_move_reject = reject;
            this.move_handler = (move) => {
                this.current_move_reject = undefined; // Clear reject handler
                if (isNormal(move)) {
                    let color = position.board.get(move.from)?.color!;

                    // Check if move should be a promotion
                    let backrank = SquareSet.backrank(opposite(color));
                    if (backrank.has(move.to) && position.board.get(move.from)?.role == "pawn") {
                        PromotionDialog(color).then((promotion) => {
                            move.promotion = promotion.role;
                            resolve(move);
                        });
                    } else {
                        resolve(move);
                    }
                } else {
                    resolve(move);
                }
            };
        });
    }

    cancel_move(): void {
        if (this.current_move_reject) {
            this.current_move_reject(new Error("Move cancelled"));
            this.current_move_reject = undefined;
        }
        this.move_handler = undefined;
    }
}

/**
 * Configuration for visual hints displayed on the chess board during gameplay.
 * Controls which squares are highlighted to help the player understand threats and attacks.
 */
export interface hints {
    black: color_hint;
    white: color_hint;
}

/**
 * Visual hint settings for pieces of a specific color.
 */
export interface color_hint {
    attacked: boolean;
    at_risk: boolean;
}

export const DEFAULT_HINTS: hints = {
    black: { attacked: false, at_risk: false },
    white: { attacked: false, at_risk: false },
};

/**
 * Represents the final result of a completed chess game.
 */
export interface GameResult {
    Stalemate: boolean;
    Checkmate: boolean;
    Winner: Color | undefined;
}

type MoveHandler = (position: Position, move: Move) => any;

/**
 * Defines the different game modes supported by the chess application.
 */
export enum GameMode {
    CPU_WHITE_LOCAL_BLACK,
    LOCAL_WHITE_CPU_BLACK,
    REMOTE_WHITE_LOCAL_BLACK,
    LOCAL_WHITE_REMOTE_BLACK,
    LOCAL_WHITE_LOCAL_BLACK,
}

/**
 * Complete configuration for starting a new chess game.
 * Contains all necessary information to initialize players, board hints, and CPU difficulty.
 */
export interface GameDetails {
    mode: GameMode;
    hints: hints;
    /** CPU difficulty level (only used when mode includes CPU player) */
    cpu_skill?: SkillLevel;
}

function requires_cpu(details: GameDetails): boolean {
    return details.mode == GameMode.CPU_WHITE_LOCAL_BLACK || details.mode == GameMode.LOCAL_WHITE_CPU_BLACK;
}

/**
 * Core chess game controller that manages the game state, players, and UI interactions.
 * 
 * Handles move validation, game progression, move history, and integration with the
 * chessground board display and move list table. Supports rollback functionality
 * and distinguishes between active gameplay and post-game analysis modes.
 */
export class Game {
    cg: Api;
    white_player: Player;
    black_player: Player;
    table: HTMLTableElement;

    moves: Move[];
    fens: string[];

    game: Chess;
    hints: hints = DEFAULT_HINTS;

    handlers: MoveHandler[] = [];

    game_over?: (outcome: GameResult) => any;
    game_failed?: (err: string) => any;

    // For managing move cancellation during rollback
    private state_changed: boolean = false;
    
    // Track if the game is over
    private is_game_over: boolean = false;

    /**
     * Creates a new chess game instance.
     * 
     * @param cg - Chessground API instance for board display
     * @param white - Player instance for white pieces
     * @param black - Player instance for black pieces
     * @param table - HTML table element for move list display
     */
    constructor(cg: Api, white: Player, black: Player, table: HTMLTableElement) {
        this.cg = cg;

        this.white_player = white;
        this.black_player = black;
        this.table = table;

        this.game = Chess.default();
        this.moves = [];
        this.fens = [];

        cg.set({
            fen: INITIAL_BOARD_FEN,
            turnColor: this.game.turn,
        });
    }

    /**
     * Registers a callback function to be called before each move is processed.
     * 
     * @param fn - Function to call with the game position and move details
     */
    on_pre_move(fn: MoveHandler) {
        this.handlers.push(fn);
    }

    private do_move(move: Move): GameResult | undefined {
        if (!this.game.isLegal(move)) {
            throw `${makeSan(this.game, move)} is an illegal move, aborting game`;
        }

        // Generate SAN notation before playing the move
        let san = makeSan(this.game, move);
        let current_turn = this.game.turn;
        let current_fullmoves = this.game.fullmoves;

        this.moves.push(move);
        this.game.play(move);
        let fen = makeFen(this.game.toSetup());
        this.fens.push(fen);

        // Add move to the move list table
        this.append_move_to_table_with_san(current_turn, san, current_fullmoves);

        this.handlers.forEach((fn) => fn(this.game, move));

        this.set_cg_state(fen, this.game, false, true);

        if (this.game.isEnd()) {
            this.is_game_over = true;
            this.set_cg_state(fen, this.game, true, false);
            return {
                Stalemate: this.game.isStalemate(),
                Checkmate: this.game.isCheckmate(),
                Winner: this.game.outcome()?.winner,
            };
        }

        return undefined;
    }

    private compute_hints(brd: Board): Map<Key, string> {
        // compute black attacks
        let b_x_b = SquareSet.empty();
        let b_x_w = SquareSet.empty();
        for (let sq of brd.black) {
            let ax = attacks(brd.get(sq)!, sq, brd.occupied);
            b_x_b = b_x_b.union(ax.intersect(brd.black));
            b_x_w = b_x_w.union(ax.intersect(brd.white));
        }

        // compute white attacks
        let w_x_w = SquareSet.empty();
        let w_x_b = SquareSet.empty();
        for (let sq of brd.white) {
            let ax = attacks(brd.get(sq)!, sq, brd.occupied);
            w_x_w = w_x_w.union(ax.intersect(brd.white));
            w_x_b = w_x_b.union(ax.intersect(brd.black));
        }

        // drop checks
        b_x_w = b_x_w.without(brd.kingOf("white")!);
        w_x_b = w_x_b.without(brd.kingOf("black")!);

        let risks = new Map<Key, string>();

        if (this.hints.white.attacked) {
            for (let sq of b_x_w) {
                risks.set(makeSquare(sq), "attacked");
            }
        }
        if (this.hints.white.at_risk) {
            for (let sq of b_x_w.diff(w_x_w)) {
                risks.set(makeSquare(sq), "atrisk");
            }
        }

        if (this.hints.black.attacked) {
            for (let sq of w_x_b) {
                risks.set(makeSquare(sq), "attacked");
            }
        }
        if (this.hints.black.at_risk) {
            for (let sq of w_x_b.diff(b_x_b)) {
                risks.set(makeSquare(sq), "atrisk");
            }
        }

        return risks;
    }

    private turn_player(): Player {
        switch (this.game.turn) {
            case "white":
                return this.white_player;
            case "black":
                return this.black_player;
        }
    }

    /**
     * Starts the main game loop, alternating between players until the game ends.
     * 
     * Continuously requests moves from the current player, validates and applies them,
     * updates the board display, and checks for game end conditions. Handles move
     * cancellation during rollbacks and other state changes.
     * 
     * @returns Promise that resolves to the final GameResult when the game ends
     * @throws Error if an illegal move is attempted or other game errors occur
     */
    async play() {
        return new Promise<GameResult>(async (resolve, reject) => {
            while (true) {
                if (this.state_changed) continue;
                try {
                    let move = await this.turn_player().get_next_move(this.moves, this.game);

                    if (this.state_changed) {
                        this.state_changed = false;
                        continue;
                    }

                    let result = this.do_move(move);
                    if (result !== undefined) {
                        resolve(result);
                        return;
                    }
                } catch (err) {
                    // Check if this was a cancelled move
                    if (this.state_changed) {
                        this.state_changed = false;
                        continue;
                    }
                    reject(err);
                    return;
                }
            }
        });
    }

    /**
     * Updates the visual hint configuration for the chess board.
     * 
     * @param hints - New hint configuration specifying which squares to highlight
     */
    set_hints(hints: hints) {
        this.hints = hints;
    }

    private set_cg_state(fenstr: string, game: Chess, view_only?: boolean, animation?: boolean) {
        let risks = this.compute_hints(game.board);

        this.cg.set({
            fen: fenstr,
            animation: {
                enabled: animation,
            },
            turnColor: game.turn,
            check: game.isCheck(),
            highlight: {
                custom: risks,
            },
            viewOnly: view_only,
        });
    }

    private create_move_row(idx: number): HTMLTableRowElement {
        let tr = document.createElement("tr");
        let c0 = document.createElement("td");
        let c1 = document.createElement("td");
        let c2 = document.createElement("td");

        tr.classList.add("move_row");

        c0.innerText = idx.toFixed(0);

        tr.append(c0, c1, c2);
        this.table.append(tr);

        return tr;
    }

    private get_or_create_move_row(idx: number): HTMLTableRowElement {
        let rows = this.table.querySelectorAll("table tr.move_row") as NodeListOf<HTMLTableRowElement>;
        if (rows.length >= idx) {
            return rows[idx - 1];
        }

        let row: HTMLTableRowElement;
        for (let i = rows.length; i < idx; i++) {
            row = this.create_move_row(i + 1);
            this.table.append(row);
        }

        return row!;
    }

    private set_move_in_row(row: HTMLTableRowElement, color: Color, san: string, fullmoves: number) {
        let cells = row.getElementsByTagName("td");
        if (cells.length != 3) {
            throw "invalid move list rows";
        }

        let idx = 2 * (fullmoves - 1);

        switch (color) {
            case "black":
                idx += 1;
                cells[2].innerText = san;
                cells[2].classList.add("hasmove");
                cells[2].onclick = async () => {
                    if (this.is_game_over) {
                        // In post-game, just show the position without dialog
                        let setup_r = parseFen(this.fens[idx]);
                        if (setup_r.isOk) {
                            let game_r = Chess.fromSetup(setup_r.unwrap());
                            if (game_r.isOk) {
                                this.set_cg_state(this.fens[idx], game_r.unwrap(), true, false);
                            }
                        }
                        return;
                    }
                    if (idx >= this.moves.length - 1) return;
                    const moveDescription = `move ${Math.floor(idx / 2) + 1} (${san})`;
                    const shouldRollback = await RollbackDialog(this.fens[idx], moveDescription);
                    if (shouldRollback) {
                        this.rollback_to_move(idx);
                    }
                };
                return;
            case "white":
                cells[1].innerText = san;
                cells[1].classList.add("hasmove");
                cells[1].onclick = async () => {
                    if (this.is_game_over) {
                        // In post-game, just show the position without dialog
                        let setup_r = parseFen(this.fens[idx]);
                        if (setup_r.isOk) {
                            let game_r = Chess.fromSetup(setup_r.unwrap());
                            if (game_r.isOk) {
                                this.set_cg_state(this.fens[idx], game_r.unwrap(), true, false);
                            }
                        }
                        return;
                    }
                    if (idx >= this.moves.length - 1) return;
                    const moveDescription = `move ${Math.floor(idx / 2) + 1} (${san})`;
                    const shouldRollback = await RollbackDialog(this.fens[idx], moveDescription);
                    if (shouldRollback) {
                        this.rollback_to_move(idx);
                    }
                };
                return;
        }
    }

    private append_move_to_table_with_san(turn: Color, san: string, fullmoves: number) {
        let row = this.get_or_create_move_row(fullmoves);
        this.set_move_in_row(row, turn, san, fullmoves);
    }

    /**
     * Factory method to create a new Game instance from configuration details.
     * 
     * Sets up the chessground board, initializes the appropriate player types based on
     * the game mode, configures the UCI engine if needed, and returns a ready-to-play Game.
     * 
     * @param details - Game configuration including mode, hints, and CPU skill level
     * @param uci - UCI engine instance for computer player moves
     * @param table - HTML table element for move list display
     * @returns Promise that resolves to a configured Game instance
     * @throws Error if remote player modes are requested (not implemented)
     */
    static async from_details(details: GameDetails, uci: UCI, table: HTMLTableElement): Promise<Game> {
        // If the game mode requires the CPU load
        let white: Player;
        let black: Player;

        let cgapi = Chessground(document.getElementById("board")!, {
            fen: INITIAL_BOARD_FEN,
            coordinatesOnSquares: true,
            coordinates: true,
            highlight: { check: true, lastMove: true },
            premovable: { showDests: true },
            animation: { enabled: true },
            movable: { free: false },
        });

        switch (details.mode) {
            case GameMode.CPU_WHITE_LOCAL_BLACK:
                black = new ChessgroundPlayer(cgapi, "black");
                white = uci;
                break;
            case GameMode.LOCAL_WHITE_CPU_BLACK:
                black = uci;
                white = new ChessgroundPlayer(cgapi, "white");
                break;
            case GameMode.REMOTE_WHITE_LOCAL_BLACK:
                throw "remote player games are not implemented";
            case GameMode.LOCAL_WHITE_REMOTE_BLACK:
                throw "remote player games are not implemented";
            case GameMode.LOCAL_WHITE_LOCAL_BLACK:
                throw "local 2 player games are not implemented";
        }

        if (requires_cpu(details) && details.cpu_skill !== undefined) {
            uci.set_skill_level(details.cpu_skill);
            await uci.start_game(5000);
        }

        let game = new Game(cgapi, white, black, table);
        game.set_hints(details.hints);

        return game;
    }

    /**
     * Rolls back the game state to a specific move index.
     * 
     * Cancels any pending moves, truncates the move history, reconstructs the game
     * state from the target FEN position, updates the board display, and modifies
     * the move table to reflect the new state. After rollback, the game can continue
     * from the new position.
     * 
     * @param moveIndex - The 0-based index in the moves array to rollback to
     * @throws Error if moveIndex is out of bounds or FEN parsing fails
     */
    rollback_to_move(moveIndex: number) {
        if (moveIndex < 0 || moveIndex >= this.moves.length) {
            throw new Error(`Invalid move index: ${moveIndex}. Must be between 0 and ${this.moves.length - 1}`);
        }

        // Cancel any pending moves from both players
        this.white_player.cancel_move();
        this.black_player.cancel_move();

        // Signal any ongoing move calculation to be cancelled
        this.state_changed = true;

        // Truncate moves and fens arrays to the target move
        this.moves = this.moves.slice(0, moveIndex + 1);
        this.fens = this.fens.slice(0, moveIndex + 1);

        // Reset game state by parsing the fen string for the current state
        let setup_r = parseFen(this.fens[moveIndex]);
        if (setup_r.isErr) {
            throw `An error occured while rolling back the game: ${setup_r.error}`;
        }
        let game_r = Chess.fromSetup(setup_r.unwrap());
        if (game_r.isErr) {
            throw `An error occured rebuilding the game state: ${game_r.error}`;
        }
        this.game = game_r.unwrap();

        // Update the board display
        this.set_cg_state(this.fens[moveIndex], this.game, false, true);

        // Truncate the move list table if it exists
        this.truncate_move_table(moveIndex);
    }

    /**
     * Truncates the move list table to only show moves up to the specified index
     */
    private truncate_move_table(rollbackToMove: number) {
        // Clear existing move rows
        const all_moves = this.table.querySelectorAll("tr.move_row td.hasmove");
        all_moves.forEach((move_td, i) => {
            if (i > rollbackToMove) {
                console.debug("removing cell");
                move_td.parentNode?.removeChild(move_td);
            }
        });

        const all_rows = this.table.querySelectorAll("tr.move_row");
        all_rows.forEach((row) => {
            switch (row.children.length) {
                case 2:
                    console.debug("completing row");
                    row.appendChild(document.createElement("td"));
                    break;
                case 3:
                    break;
                default:
                    console.debug("removing row");
                    row.parentNode?.removeChild(row);
                    break;
            }
        });
    }
}
