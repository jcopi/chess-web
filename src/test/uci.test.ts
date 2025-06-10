import { describe, expect, test, vi } from "vitest";

// Create a minimal mock for StockfishWeb
// class MockStockfishWeb {
//     uci = vi.fn();
//     listen: ((line: string) => void) | null = null;
//     onError: ((error: string) => void) | null = null;
//     getRecommendedNnue = vi.fn().mockReturnValue("test.nnue");
//     setNnueBuffer = vi.fn();
// }

// Import UCI after setting up mocks
import {
    UCI,
    uci_option,
    uci_option_string,
    uci_option_spin,
    uci_option_check,
    uci_option_button,
    uci_option_combo,
} from "../uci";
import StockfishWeb from "@lichess-org/stockfish-web";

describe("UCI option parsing", () => {
    const cases: {
        name: string;
        line: string;
        expected: uci_option_spin | uci_option_string | uci_option_check | uci_option_button | uci_option_combo;
    }[] = [
        {
            name: "debug_log_file",
            line: "option name Debug Log File type string default ",
            expected: new uci_option_string("Debug Log File", ""),
        },
        {
            name: "threads",
            line: "option name Threads type spin default 1 min 1 max 512",
            expected: new uci_option_spin("Threads", 1, 1, 512),
        },
        {
            name: "hash",
            line: "option name Hash type spin default 16 min 1 max 2048",
            expected: new uci_option_spin("Hash", 16, 1, 2048),
        },
        {
            name: "skill",
            line: "option name Skill Level type spin default 20 min -20 max 20",
            expected: new uci_option_spin("Skill Level", 20, -20, 20),
        },
        {
            name: "clear_hash",
            line: "option name Clear Hash type button",
            expected: new uci_option_button("Clear Hash"),
        },
        {
            name: "use_nnue",
            line: "option name Use NNUE type check default false",
            expected: new uci_option_check("Use NNUE", false),
        },
        {
            name: "uci_variant",
            line: "option name UCI_Variant type combo default chess var 3check var 5check var ai-wok var almost var amazon var antichess var armageddon var asean var ataxx var atomar var atomic var berolina var breakthrough var bughouse var cambodian var chaturanga var chess var chessgi var chigorin var clobber var codrus var coregal var crazyhouse var dobutsu var dragon var euroshogi var extinction var fairy var fischerandom var flipello var flipersi var fox-and-hounds var gardner var giveaway var gorogoro var grasshopper var hoppelpoppel var horde var isolation var isolation7x7 var joust var judkins var karouk var kinglet var kingofthehill var knightmate var koedem var kyotoshogi var legan var loop var losalamos var losers var makpong var makruk var micro var mini var minishogi var minixiangqi var newzealand var nightrider var nocastle var nocheckatomic var normal var paradigm var pawnback var pawnsideways var perfect var petrified var placement var pocketknight var raazuvaa var racingkings var seirawan var shatar var shatranj var shouse var sittuyin var snailtrail var sortofalmost var spartan var suicide var threekings var torishogi var torpedo",
            expected: new uci_option_combo("UCI_Variant", "chess", [
                "3check",
                "5check",
                "ai-wok",
                "almost",
                "amazon",
                "antichess",
                "armageddon",
                "asean",
                "ataxx",
                "atomar",
                "atomic",
                "berolina",
                "breakthrough",
                "bughouse",
                "cambodian",
                "chaturanga",
                "chess",
                "chessgi",
                "chigorin",
                "clobber",
                "codrus",
                "coregal",
                "crazyhouse",
                "dobutsu",
                "dragon",
                "euroshogi",
                "extinction",
                "fairy",
                "fischerandom",
                "flipello",
                "flipersi",
                "fox-and-hounds",
                "gardner",
                "giveaway",
                "gorogoro",
                "grasshopper",
                "hoppelpoppel",
                "horde",
                "isolation",
                "isolation7x7",
                "joust",
                "judkins",
                "karouk",
                "kinglet",
                "kingofthehill",
                "knightmate",
                "koedem",
                "kyotoshogi",
                "legan",
                "loop",
                "losalamos",
                "losers",
                "makpong",
                "makruk",
                "micro",
                "mini",
                "minishogi",
                "minixiangqi",
                "newzealand",
                "nightrider",
                "nocastle",
                "nocheckatomic",
                "normal",
                "paradigm",
                "pawnback",
                "pawnsideways",
                "perfect",
                "petrified",
                "placement",
                "pocketknight",
                "raazuvaa",
                "racingkings",
                "seirawan",
                "shatar",
                "shatranj",
                "shouse",
                "sittuyin",
                "snailtrail",
                "sortofalmost",
                "spartan",
                "suicide",
                "threekings",
                "torishogi",
                "torpedo",
            ]),
        },
    ];

    test.each(cases)("$name", ({ line, expected }) => {
        const result = uci_option.parse(line);
        expect(result).toStrictEqual(expected);
    });
});

describe("UCI initialization", () => {
    const cases: {
        name: string;
        hardwareThreads: number;
        inputs: string[];
        outputs: string[][];
    }[] = [
        {
            name: "happy path",
            hardwareThreads: 16,
            inputs: [
                "uci",
                "setoption name Threads value 12",
                "setoption name Hash value 192",
                "setoption name Use NNUE value true",
                "setoption name Skill Level value 0",
            ],
            outputs: [
                [
                    "id name Fairy-Stockfish 260425",
                    "id author Fabian Fichter",
                    "",
                    "option name Debug Log File type string default",
                    "option name Threads type spin default 1 min 1 max 512",
                    "option name Hash type spin default 16 min 1 max 2048",
                    "option name Clear Hash type button",
                    "option name Ponder type check default false",
                    "option name MultiPV type spin default 1 min 1 max 500",
                    "option name Skill Level type spin default 20 min -20 max 20",
                    "option name Move Overhead type spin default 10 min 0 max 5000",
                    "option name Slow Mover type spin default 100 min 10 max 1000",
                    "option name nodestime type spin default 0 min 0 max 10000",
                    "option name UCI_Chess960 type check default false",
                    "option name UCI_Variant type combo default chess var 3check var 5check var ai-wok var almost var amazon var antichess var armageddon var asean var ataxx var atomar var atomic var berolina var breakthrough var bughouse var cambodian var chaturanga var chess var chessgi var chigorin var clobber var codrus var coregal var crazyhouse var dobutsu var dragon var euroshogi var extinction var fairy var fischerandom var flipello var flipersi var fox-and-hounds var gardner var giveaway var gorogoro var grasshopper var hoppelpoppel var horde var isolation var isolation7x7 var joust var judkins var karouk var kinglet var kingofthehill var knightmate var koedem var kyotoshogi var legan var loop var losalamos var losers var makpong var makruk var micro var mini var minishogi var minixiangqi var newzealand var nightrider var nocastle var nocheckatomic var normal var paradigm var pawnback var pawnsideways var perfect var petrified var placement var pocketknight var raazuvaa var racingkings var seirawan var shatar var shatranj var shouse var sittuyin var snailtrail var sortofalmost var spartan var suicide var threekings var torishogi var torpedo",
                    "option name UCI_AnalyseMode type check default false",
                    "option name UCI_LimitStrength type check default false",
                    "option name UCI_Elo type spin default 1350 min 500 max 2850",
                    "option name UCI_ShowWDL type check default false",
                    "option name SyzygyPath type string default <empty>",
                    "option name SyzygyProbeDepth type spin default 1 min 1 max 100",
                    "option name Syzygy50MoveRule type check default true",
                    "option name SyzygyProbeLimit type spin default 7 min 0 max 7",
                    "option name Use NNUE type check default false",
                    "option name EvalFile type string default <empty>",
                    "option name TsumeMode type check default false",
                    "option name VariantPath type string default <empty>",
                    "option name usemillisec type check default true",
                    "uciok",
                ],
                [],
                [],
                [],
                [],
            ],
        },
    ];

    test.each(cases)("$name", async ({ inputs, outputs, hardwareThreads }) => {
        let mockSF: StockfishWeb = {
            uci: vi.fn(() => {
                let out = outputs.shift();
                expect(out).toBeDefined();

                out!.forEach((line) => {
                    mockSF.listen(line);
                });
            }),
            listen: () => {},
            onError: () => {},
            setNnueBuffer: vi.fn(),
            getRecommendedNnue: vi.fn(),
        };

        vi.spyOn(navigator, "hardwareConcurrency", "get").mockReturnValue(hardwareThreads);

        let ut = new UCI(mockSF);
        await ut.init();

        inputs.forEach((line, i) => {
            expect(mockSF.uci).toHaveBeenNthCalledWith(i + 1, line);
        });
    });
});
