import { Color, Piece, Role } from "chessops";
import { skill_display, SkillLevel } from "./uci";
import { GameMode, GameDetails, GameResult, DEFAULT_HINTS } from "./game";
import { Chessground } from "chessground";

/**
 * Shows a modal dialog for configuring a new chess game.
 *
 * Allows the user to select their color (white, black, or random) and the CPU difficulty level.
 * The dialog cannot be cancelled - the user must make selections and click "Start" to proceed.
 *
 * @returns Promise that resolves to GameDetails containing the user's game configuration
 *
 * @example
 * ```typescript
 * const gameConfig = await NewGameDialog();
 * console.log(gameConfig.mode); // GameMode.LOCAL_WHITE_CPU_BLACK
 * console.log(gameConfig.cpu_skill); // SkillLevel.Skill_5
 * ```
 */
export async function NewGameDialog(): Promise<GameDetails> {
    return new Promise((resolve, _) => {
        let details: GameDetails = {
            mode: Math.random() < 0.5 ? GameMode.LOCAL_WHITE_CPU_BLACK : GameMode.CPU_WHITE_LOCAL_BLACK,
            cpu_skill: SkillLevel.Skill_Default,
            hints: DEFAULT_HINTS,
        };

        let dialog = document.createElement("dialog");
        dialog.classList.add("cover");

        let header = document.createElement("h1");
        header.innerText = "New Game";

        let btns = [
            button("White", [], (ev) => {
                btns.forEach((btn) => btn.classList.remove("selected"));
                (ev.target as HTMLButtonElement).classList.add("selected");
                details.mode = GameMode.LOCAL_WHITE_CPU_BLACK;
            }),
            button("Random", ["selected"], (ev) => {
                btns.forEach((btn) => btn.classList.remove("selected"));
                (ev.target as HTMLButtonElement).classList.add("selected");
                details.mode = Math.random() < 0.5 ? GameMode.LOCAL_WHITE_CPU_BLACK : GameMode.CPU_WHITE_LOCAL_BLACK;
            }),
            button("Black", [], (ev) => {
                btns.forEach((btn) => btn.classList.remove("selected"));
                (ev.target as HTMLButtonElement).classList.add("selected");
                details.mode = GameMode.CPU_WHITE_LOCAL_BLACK;
            }),
        ];

        let start = button("Start", ["rainbow"], () => {
            if (details.mode == GameMode.CPU_WHITE_LOCAL_BLACK) {
                details.hints = {
                    white: { attacked: false, at_risk: false },
                    black: { attacked: true, at_risk: true },
                };
            } else if (details.mode == GameMode.LOCAL_WHITE_CPU_BLACK) {
                details.hints = {
                    white: { attacked: true, at_risk: true },
                    black: { attacked: false, at_risk: false },
                };
            }

            dialog.close();
        });

        let footer = document.createElement("footer");
        footer.append(start);

        let display = label(skill_display(SkillLevel.Skill_Default), ["inverted", "textcenter"]);
        // Some element specific styling
        display.style.width = "14px";

        let strength: HTMLInputElement;
        strength = range(
            SkillLevel.Skill_Min,
            SkillLevel.Skill_Max,
            SkillLevel.Skill_1 - SkillLevel.Skill_0,
            SkillLevel.Skill_Default,
            [],
            () => {
                details.cpu_skill = Number(strength.value) as SkillLevel;
                display.innerText = skill_display(details.cpu_skill);
            },
        );
        let inline = inlinefield([label("low", []), strength, label("high", []), display]);

        dialog.append(header, fieldset("Player Color", [], btns), fieldset("Computer Strength", [], [inline]), footer);

        // The user must make explicit choices, there's nothing to do if the dialog
        // is cancelled with out explicitly starting the game
        dialog.addEventListener("cancel", (ev) => {
            ev.preventDefault();
        });

        dialog.addEventListener("close", () => {
            resolve(details);
            document.body.removeChild(dialog);
        });

        document.body.appendChild(dialog);
        dialog.showModal();
        dialog.focus();
    });
}

/**
 * Shows a modal dialog for pawn promotion piece selection.
 *
 * When a pawn reaches the opposite end of the board, this dialog allows the user
 * to choose which piece to promote to (Queen, Rook, Bishop, or Knight).
 * The dialog cannot be cancelled - the user must select a piece to continue the game.
 *
 * @param color - The color of the pawn being promoted ("white" or "black")
 * @returns Promise that resolves to the selected Piece with the chosen role
 *
 * @example
 * ```typescript
 * const promotedPiece = await PromotionDialog("white");
 * console.log(promotedPiece.role); // "queen" (default selection)
 * console.log(promotedPiece.color); // "white"
 * console.log(promotedPiece.promoted); // true
 * ```
 */
export async function PromotionDialog(color: Color): Promise<Piece> {
    return new Promise((resolve, _) => {
        let dialog = document.createElement("dialog");
        let piece: Piece = {
            role: "queen",
            color: color,
            promoted: true,
        };

        let h1 = document.createElement("h1");
        h1.innerText = "Pawn Promotion";

        let btns: HTMLButtonElement[];

        let btn_handler = (role: Role) => {
            return (ev: MouseEvent) => {
                piece.role = role;
                btns.forEach((btn) => btn.classList.remove("selected"));
                (ev.target as HTMLButtonElement).classList.add("selected");
            };
        };

        btns = [
            button("Queen", ["selected"], btn_handler("queen")),
            button("Rook", [], btn_handler("rook")),
            button("Bishop", [], btn_handler("bishop")),
            button("Knight", [], btn_handler("knight")),
        ];

        let fs = fieldset("Promote To", [], btns);

        let promote = button("Promote", ["green"], () => {
            dialog.close();
        });

        let footer = document.createElement("footer");
        footer.append(promote);

        dialog.append(h1, fs, footer);

        dialog.addEventListener("close", () => {
            resolve(piece);
            document.body.removeChild(dialog);
        });

        // The user must select a choice or the game cannot proceed
        dialog.addEventListener("cancel", (ev) => {
            ev.preventDefault();
        });

        document.body.append(dialog);
        dialog.showModal();
        dialog.focus();
    });
}

/**
 * Shows a modal dialog asking the user to confirm rolling back the game to a previous move.
 *
 * Displays a preview of the board position at the target move and asks for confirmation.
 * The user can either confirm the rollback or cancel to continue the current game.
 *
 * @param fen - The FEN string representing the board position to roll back to
 * @param moveDescription - Human-readable description of the move (e.g., "move 5 (Nf3)")
 * @returns Promise that resolves to true if user confirms rollback, false if cancelled
 *
 * @example
 * ```typescript
 * const shouldRollback = await RollbackDialog("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1", "move 1 (e4)");
 * if (shouldRollback) {
 *     // User confirmed - perform the rollback
 *     game.rollback_to_move(0);
 * }
 * ```
 */
export async function RollbackDialog(fen: string, moveDescription: string): Promise<boolean> {
    return new Promise((resolve, _) => {
        let do_rollback = false;

        let dialog = document.createElement("dialog");
        dialog.classList.add("cover", "rollback-dialog");

        let header = document.createElement("h1");
        header.innerText = "Rollback Game";

        let description = document.createElement("p");
        description.classList.add("description");
        description.innerText = `Roll back to ${moveDescription}?`;

        // Create board container with square aspect ratio
        let boardContainer = document.createElement("div");
        boardContainer.classList.add("board-container");

        let boardElement = document.createElement("div");
        boardContainer.appendChild(boardElement);

        // Initialize chessground with the preview position
        Chessground(boardElement, {
            fen: fen,
            viewOnly: true,
            coordinates: true,
            coordinatesOnSquares: false,
            animation: { enabled: false },
            highlight: { check: false, lastMove: false },
            movable: { free: false },
            draggable: { enabled: false },
            selectable: { enabled: false },
        });

        let rollbackBtn = button("Rollback", ["green"], () => {
            do_rollback = true;
            dialog.close();
        });

        let cancelBtn = button("Cancel", [], () => {
            do_rollback = false;
            dialog.close();
        });

        let footer = document.createElement("footer");
        footer.append(cancelBtn, rollbackBtn);

        dialog.append(header, description, boardContainer, footer);

        document.body.appendChild(dialog);
        dialog.showModal();
        dialog.focus();

        // Handle escape key and backdrop clicks
        dialog.addEventListener("close", () => {
            resolve(do_rollback);
            document.body.removeChild(dialog);
        });
    });
}

/**
 * Shows a modal dialog displaying the final result of a completed chess game.
 *
 * Analyzes the game result and displays an appropriate message (checkmate, stalemate, or draw).
 * Provides options to analyze the final board position or end the game and start a new one.
 *
 * @param result - The GameResult object containing information about how the game ended
 * @returns Promise that resolves when the user dismisses the dialog
 *
 * @example
 * ```typescript
 * const gameResult = {
 *     Checkmate: true,
 *     Stalemate: false,
 *     Winner: "white"
 * };
 * await GameOverDialog(gameResult); // Shows "Checkmate! White wins!"
 * ```
 */
export async function GameOverDialog(result: GameResult): Promise<void> {
    return new Promise((resolve, _) => {
        let dialog = document.createElement("dialog");

        let header = document.createElement("h1");
        header.innerText = "Game Over";

        let desc = document.createElement("p");
        desc.classList.add("description");

        if (result.Checkmate && result.Winner) {
            desc.innerText = `Checkmate! ${result.Winner === "white" ? "White" : "Black"} wins!`;
        } else if (result.Stalemate) {
            desc.innerText = "Stalemate! The game is a draw.";
        } else {
            desc.innerText = "Game Over - Draw";
        }

        let analyze = button("Analyze Board", [], () => {
            dialog.close();
        });

        let continueBtn = button("End Game", ["green"], () => {
            dialog.close();
            window.location.reload();
        });

        let footer = document.createElement("footer");
        footer.append(analyze, continueBtn);

        dialog.append(header, desc, footer);

        dialog.addEventListener("close", () => {
            resolve();
            document.body.removeChild(dialog);
        });

        document.body.appendChild(dialog);
        dialog.showModal();
        dialog.focus();
    });
}

/**
 * Shows a modal loading dialog while executing an asynchronous operation.
 *
 * Displays a loading message and prevents user interaction until the operation completes.
 * The dialog cannot be cancelled and will only close when the load function calls done().
 *
 * @param load - Function that performs the async operation, receives a done() callback to close the dialog
 * @param msg - Optional loading message to display (defaults to "Loading...")
 * @returns Promise that resolves when the loading operation completes
 *
 * @example
 * ```typescript
 * await LoadingDialog(async (done) => {
 *     // Initialize chess engine
 *     const engine = await initializeEngine();
 *     await engine.init(5000);
 *     done(); // This closes the dialog
 * }, "Initializing chess engine...");
 * ```
 */
export async function LoadingDialog(load: (done: () => any) => any, msg: string = "Loading..."): Promise<void> {
    return new Promise((resolve, _) => {
        let dialog = document.createElement("dialog");
        dialog.classList.add("cover");
        let message = document.createElement("h3");
        message.classList.add("textcenter");
        message.innerText = msg;

        dialog.append(message);
        dialog.addEventListener("cancel", (ev) => ev.preventDefault());
        document.body.appendChild(dialog);
        dialog.showModal();

        load(() => {
            dialog.close();
            document.body.removeChild(dialog);
            resolve();
        });
    });
}

/**
 * Creates a styled HTML button element for use in dialogs.
 *
 * @param text - The text to display on the button
 * @param classes - Array of CSS class names to apply to the button
 * @param onclick - Click event handler function
 * @returns Configured HTMLButtonElement
 */
function button(text: string, classes: string[], onclick: (this: GlobalEventHandlers, ev: MouseEvent) => any): HTMLButtonElement {
    let btn = document.createElement("button");
    btn.classList.add(...classes);
    btn.innerText = text;
    btn.onclick = onclick;
    return btn;
}

/**
 * Creates a styled HTML fieldset element with legend for grouping form controls.
 *
 * @param title - The legend/title text for the fieldset
 * @param classes - Array of CSS class names to apply to the fieldset
 * @param elements - Array of HTML elements to include in the fieldset
 * @returns Configured HTMLFieldSetElement
 */
function fieldset(title: string, classes: string[], elements: HTMLElement[]): HTMLFieldSetElement {
    let fs = document.createElement("fieldset");
    fs.classList.add(...classes);
    let legend = document.createElement("legend");
    legend.innerText = title;
    fs.append(legend, ...elements);
    return fs;
}

/**
 * Creates a styled HTML range input element (slider).
 *
 * @param min - Minimum value for the range
 * @param max - Maximum value for the range
 * @param step - Step increment for the range
 * @param value - Initial/default value
 * @param classes - Array of CSS class names to apply to the input
 * @param onchange - Change event handler function
 * @returns Configured HTMLInputElement of type "range"
 */
function range(
    min: number,
    max: number,
    step: number,
    value: number,
    classes: string[],
    onchange: (this: GlobalEventHandlers, ev: Event) => any,
): HTMLInputElement {
    let rng = document.createElement("input");
    rng.type = "range";
    rng.classList.add(...classes);
    rng.min = min.toString();
    rng.max = max.toString();
    rng.step = step.toString();
    rng.value = value.toString();
    rng.onchange = onchange;
    return rng;
}

/**
 * Creates a horizontal container div for inline form elements.
 *
 * @param elements - Array of HTML elements to arrange horizontally
 * @returns HTMLDivElement with inlinefield styling
 */
function inlinefield(elements: HTMLElement[]): HTMLDivElement {
    let div = document.createElement("div");
    div.classList.add("inlinefield");
    div.append(...elements);
    return div;
}

/**
 * Creates a styled HTML label element.
 *
 * @param text - The text content for the label
 * @returns Configured HTMLLabelElement
 */
function label(text: string, classes: string[]) {
    let lbl = document.createElement("label");
    lbl.innerText = text;
    lbl.classList.add(...classes);
    return lbl;
}
