import { Engine, UCI, initializeEngine } from "./uci";
import { Chessground } from "chessground";
import { INITIAL_BOARD_FEN } from "chessops/fen";
import { Game } from "./game";
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

let details = await NewGameDialog();
let moveTable = document.querySelector("#moves table") as HTMLTableElement;
let game = await Game.from_details(details, uci!, moveTable);

let result = await game.play();
await GameOverDialog(result);
