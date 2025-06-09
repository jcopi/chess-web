import StockfishWeb from "@lichess-org/stockfish-web";
import { makeUci, Move, parseUci, Position } from "chessops";
import { Player } from "./player";

enum EngineState {
    uci_setup = 0,
    initialized,
    starting_game,
    game_ready,
    computing_move,
    awaiting_move,
}

// Brute force allocate wasm shared memory starting from the max requested to the min required
const sharedWasmMemory = (required: number, maximum = 32767): WebAssembly.Memory => {
    let factor = 0.75;

    while (true) {
        try {
            return new WebAssembly.Memory({
                shared: true,
                initial: required,
                maximum: maximum,
            });
        } catch (err) {
            if (maximum <= required || !(err instanceof RangeError)) throw err;

            maximum = Math.max(required, Math.ceil(maximum * factor));
            console.debug(`adjusting maximum memory to ${maximum} pages`);
        }
    }
};

export enum Engine {
    //Stockfish171_79 = "@lichess-org/stockfish-web/sf171-79.js",
    FairyStockfish14 = "@lichess-org/stockfish-web/fsf14.js",
    //Stockfish16_7 = "@lichess-org/stockfish-web/sf16-7.js",
}

async function importEngine(e: Engine): Promise<any> {
    switch (e) {
        // case Engine.Stockfish171_79:
        //     return import("@lichess-org/stockfish-web/sf171-79.js");
        case Engine.FairyStockfish14:
            return import("@lichess-org/stockfish-web/fsf14.js");
        // case Engine.Stockfish16_7:
        //     return import("@lichess-org/stockfish-web/sf16-7.js");
    }
}

export async function initializeEngine(e: Engine = Engine.FairyStockfish14): Promise<StockfishWeb> {
    return new Promise<StockfishWeb>((resolve, reject) => {
        importEngine(e)
            .then((makeModule: any) => {
                makeModule
                    .default({
                        wasmMemory: sharedWasmMemory(2560),
                        onError: (msg: string) => reject(new Error(msg)),
                        locateFile: (name: string) => `assets/stockfish/${name}`,
                    })
                    .then(async (sfweb: StockfishWeb) => {
                        sfweb;

                        let prev = "";
                        for (let i = 0; i < 2; i++) {
                            let nnue = sfweb.getRecommendedNnue(i);
                            if (nnue == prev) {
                                break;
                            }
                            let resp = await fetch(`assets/stockfish/${nnue}`);
                            let buf = await resp.arrayBuffer();
                            sfweb.setNnueBuffer(new Uint8Array(buf));
                        }

                        resolve(sfweb);
                    });
            })
            .catch((e) => reject(e));
    });
}

export enum SkillLevel {
    Skill_0 = 0.0,
    Skill_1 = 0.1,
    Skill_2 = 0.2,
    Skill_3 = 0.3,
    Skill_4 = 0.4,
    Skill_5 = 0.5,
    Skill_6 = 0.6,
    Skill_7 = 0.7,
    Skill_8 = 0.8,
    Skill_9 = 0.9,
    Skill_10 = 1.0,

    Skill_Min = Skill_0,
    Skill_Max = Skill_10,
    Skill_Default = Skill_5,
}

export class UCI implements Player {
    sfio: StockfishWeb;
    state: EngineState = EngineState.uci_setup;

    options: { [key: string]: uci_option } = {};
    ids: uci_info[] = [];

    transitions: Map<EngineState, ((prev: EngineState) => void)[]>;

    // game related properties
    best_move: Move | undefined;
    move_depth?: number = 22;
    move_time?: number = 1500;

    log_handler: (message: any) => void = (msg) => {
        console.debug(msg);
    };

    constructor(sfweb: StockfishWeb) {
        this.sfio = sfweb;
        this.sfio.onError = this.error_handler.bind(this);
        this.sfio.listen = this.handler.bind(this);

        this.transitions = new Map<EngineState, ((prev: EngineState) => void)[]>();
        return;
    }

    async init(timeout_ms: number = 5000): Promise<void> {
        return Promise.race([
            new Promise<void>((resolve) => {
                this.send_uci("uci");

                if (this.state >= EngineState.initialized) {
                    resolve();
                    return;
                }

                this.add_transition_handler(EngineState.initialized, () => {
                    resolve();
                });
            }),
            new Promise<void>((_, reject) => {
                setTimeout(() => {
                    reject("initialization timed out");
                }, timeout_ms);
            }),
        ]);
    }

    private with_opt<T extends uci_option>(name: string, fn: (opt: T) => void) {
        let opt = this.options[name];
        if (opt !== undefined) {
            fn(opt as T);
        }
    }

    set_skill_level(level: SkillLevel) {
        this.with_opt<uci_option_spin>("Skill Level", (opt) => {
            let range = opt.max - opt.min;
            let lvl = opt.min + Math.round(range * level);

            this.send_uci(opt.set_command(lvl));
        });
    }

    stop() {
        this.send_uci("quit");
    }

    async start_game(timeout_ms: number = 5000): Promise<void> {
        return Promise.race([
            new Promise<void>((resolve, reject) => {
                if (this.state > EngineState.initialized) {
                    reject("conflict, game already in progress, cannot start new game");
                    return;
                }

                this.transition_state(EngineState.starting_game);

                this.send_uci("ucinewgame");
                this.send_uci("isready");

                this.add_transition_handler(EngineState.game_ready, () => {
                    resolve();
                });
            }),
            new Promise<void>((_, reject) => {
                setTimeout(() => {
                    reject("timeout waiting for engine to be ready");
                }, timeout_ms);
            }),
        ]);
    }

    end_game() {
        this.best_move = undefined;
        this.transition_state(EngineState.initialized);
    }

    async get_next_move(moves: Move[], _: Position, timeout_ms: number = 30000): Promise<Move> {
        return Promise.race([
            new Promise<Move>((resolve, reject) => {
                this.best_move = undefined;

                let pos_command = `position startpos`;
                if (moves.length > 0) {
                    let uci_moves = UCI.uci_move_string(moves);
                    pos_command += ` moves ${uci_moves}`;
                }
                let go_command = `go`;
                if (this.move_depth !== undefined) {
                    let depth = Math.round(this.move_depth);
                    go_command += ` depth ${depth}`;
                }
                if (this.move_time !== undefined) {
                    let movetime_ms = Math.round(this.move_time);
                    go_command += ` movetime ${movetime_ms}`;
                }

                switch (this.state) {
                    case EngineState.game_ready:
                        this.transition_state(EngineState.computing_move);
                        this.send_uci(pos_command);
                        this.send_uci(go_command);
                        break;
                    case EngineState.computing_move:
                        break;
                    default:
                        reject("invalid state to compute a move");
                }

                this.add_transition_handler(EngineState.game_ready, () => {
                    if (this.best_move !== undefined) {
                        resolve(this.best_move);
                    } else {
                        reject("failed to find best move");
                    }
                });
            }),
            new Promise<Move>((_, reject) => {
                setTimeout(() => {
                    reject("timeout waiting for engine to calculate best move");
                }, timeout_ms);
            }),
        ]);
    }

    cancel_move(): void {
        // No-op for UCI - we can just ignore the move when it comes back
    }

    private handler(line: string) {
        this.log_handler("> " + line);
        switch (this.state) {
            case EngineState.uci_setup:
                let opt = uci_option.parse(line);
                if (opt !== null) {
                    this.options[opt.name] = opt;
                    return;
                }

                let id = parse_id(line);
                if (id != null) {
                    this.ids.push(id);
                    return;
                }

                if (line == "uciok") {
                    // engine is done reporting uci information
                    // Set the desired parameters. Initially the only option
                    // that will be set is the number of threads (if that option was reported by)

                    let opt = this.options["Threads"]! as uci_option_spin;
                    let hash_opt = this.options["Hash"]! as uci_option_spin;

                    let threads = Math.max(opt.min, Math.min(opt.max, navigator.hardwareConcurrency - 1, 12));
                    if (threads != opt.default) {
                        this.send_uci(opt.set_command(threads));
                        this.send_uci(hash_opt.set_command(hash_opt.default * threads));
                    }

                    this.with_opt<uci_option_check>("Use NNUE", (opt) => {
                        this.send_uci(opt.set_command(true));
                    });

                    this.set_skill_level(SkillLevel.Skill_Default);

                    this.transition_state(EngineState.initialized);
                    return;
                }

                return;
            case EngineState.initialized:
                return;
            case EngineState.starting_game:
                if (line == "readyok") {
                    this.transition_state(EngineState.game_ready);
                }
                return;
            case EngineState.game_ready:
                return;
            case EngineState.computing_move:
                let move = parse_bestmove(line);
                if (move !== undefined) {
                    this.best_move = move;

                    this.transition_state(EngineState.game_ready);
                }
                return;
        }
    }

    private send_uci(command: string) {
        this.log_handler("< " + command);
        this.sfio.uci(command);
    }

    private error_handler(err: string) {
        console.error(err);
    }

    private add_transition_handler(transition: EngineState, handler: (prev: EngineState) => void) {
        let stack = this.transitions.get(transition);
        if (stack === undefined) {
            stack = [];
        }
        stack.push(handler);
        this.transitions.set(transition, stack);
    }

    set logger(handler: (msg: any) => void) {
        this.log_handler = handler;
    }

    private transition_state(next: EngineState) {
        if (this.state == next) {
            return;
        }

        let prev = this.state;
        this.state = next;

        let stack = this.transitions.get(this.state);
        if (stack !== undefined) {
            stack.forEach((fn) => {
                fn(prev);
            });
            this.transitions.delete(this.state);
        }
    }

    static uci_move_string(moves: Move[]): string {
        return moves.map((mv) => makeUci(mv)).join(" ");
    }
}

export class uci_option {
    readonly name: string = "";

    constructor(name: string) {
        this.name = name;
    }

    static parse(line: string): uci_option | null {
        const opt_re = /^option name (?<name>.+?) type (?<type>string|check|spin|button|combo) ?(?<remainder>.*)$/;
        const string_re = /^default (?<default>.*)$/;
        const spin_re = /^default (?<default>\d+) min (?<min>[-+.\d]+) max (?<max>[-+.\d]+)$/;
        const check_re = /^default (?<default>true|false)$/;
        const combo_re = /^default (?<remainder>.+)$/;
        try {
            let match = opt_re.exec(line);
            if (match == null) return null;

            let oname = match.groups!["name"];
            let otype = match.groups!["type"];
            let remainder = match.groups!["remainder"];

            switch (otype) {
                case "string":
                    match = string_re.exec(remainder);
                    if (match == null) return null;

                    return new uci_option_string(oname, match.groups!["default"]);
                case "check":
                    match = check_re.exec(remainder);
                    if (match == null) return null;

                    return new uci_option_check(oname, match.groups!["default"] == "true");
                case "spin":
                    match = spin_re.exec(remainder);
                    if (match == null) return null;

                    return new uci_option_spin(
                        oname,
                        parseInt(match.groups!["default"], 10),
                        parseInt(match.groups!["min"], 10),
                        parseInt(match.groups!["max"], 10),
                    );
                case "button":
                    return new uci_option_button(oname);
                case "combo":
                    match = combo_re.exec(remainder);
                    if (match == null) return null;

                    let options = match.groups!["remainder"].split(" var ");
                    if (options.length < 2) return null;
                    let default_option = options.shift();

                    return new uci_option_combo(oname, default_option!, options);
                default:
                    return null;
            }
        } catch {
            return null;
        }
    }
}
export class uci_option_string extends uci_option {
    readonly default: string = "";

    constructor(name: string, def: string) {
        super(name);
        this.default = def;
    }

    set_command(value: string): string {
        return `setoption name ${this.name} value ${value}`;
    }
}
export class uci_option_combo extends uci_option {
    readonly default: string = "";
    readonly options: string[] = [];

    constructor(name: string, def: string, options: string[]) {
        super(name);
        this.default = def;
        this.options = options;
    }

    set_command(value: string): string {
        if (this.options.indexOf(value) < 0) {
            throw "invalid value";
        }

        return `setoption name ${this.name} value ${value}`;
    }
}

export class uci_option_spin extends uci_option {
    readonly default: number = 1;
    readonly min: number = 1;
    readonly max: number = 1;

    constructor(name: string, def: number, min: number, max: number) {
        super(name);
        this.default = def;
        this.min = min;
        this.max = max;
    }

    set_command(value: number): string {
        return `setoption name ${this.name} value ${value}`;
    }
}
export class uci_option_check extends uci_option {
    readonly default: boolean = false;

    constructor(name: string, def: boolean) {
        super(name);
        this.default = def;
    }

    set_command(value: boolean): string {
        return `setoption name ${this.name} value ${value ? "true" : "false"}`;
    }
}
export class uci_option_button extends uci_option {
    set_command(): string {
        return `setoption name ${this.name}`;
    }
}

interface uci_info {
    name: string;
    value: string;
}

function parse_id(line: string): uci_info | null {
    try {
        let match = line.match(/^id (?<name>\S+) (?<value>.+)$/);
        if (match == null) return null;

        return <uci_info>{
            name: match.groups!["name"],
            value: match.groups!["value"],
        };
    } catch {
        return null;
    }
}

function parse_bestmove(line: string): Move | undefined {
    const bestmove_re = /^bestmove (?<move>\S+).*$/;
    try {
        let match = bestmove_re.exec(line);
        if (match == null) return undefined;

        let uci_move = match.groups!["move"];
        return parseUci(uci_move);
    } catch {
        return undefined;
    }
}
