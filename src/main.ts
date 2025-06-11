import { Engine, UCI, initializeEngine } from "./uci";
import { Chessground } from "chessground";
import { INITIAL_BOARD_FEN } from "chessops/fen";
import { Game, GameDetails } from "./game";
import { GameOverDialog, LoadingDialog, NewGameDialog } from "./dialogs";

if (window.location.hash == "#layout-debug") {
    Chessground(document.getElementById("board")!, {
        fen: INITIAL_BOARD_FEN,
    });

    await (async () => {
        return new Promise(() => {});
    })();
}

let uci: UCI;

await LoadingDialog(async (done) => {
    let sf = await initializeEngine(Engine.FairyStockfish14);
    uci = new UCI(sf);

    uci.logger = window.location.hash == "#debug" ? console.debug : () => {};

    await uci.init(5000);
    done();
});

let details: GameDetails;

let saves = Game.list_saved_games();
if (saves.length > 0) {
    details = saves[0];
} else {
    details = await NewGameDialog();
}
let moveTable = document.querySelector("#moves table") as HTMLTableElement;
let cgapi = Chessground(document.getElementById("board")!, {});

let game = await Game.from_details(details, uci!, cgapi, moveTable);

let result = await game.play();
// Slight hack, show the board for a short time before creating the game over dialog
await GameOverDialog(result);
