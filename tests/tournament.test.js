const assert = require("assert");
const fs = require("fs");
const path = require("path");
const T = require("../tournament.js");
const data = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/tournament.json"), "utf8"));

// Draw structure
assert.strictEqual(data.teams.length, 12);
const pool = data.matches.filter((m) => m.stage === "pool");
assert.strictEqual(pool.length, 18);
["A", "B", "C"].forEach((p, i) => {
  const ms = pool.filter((m) => m.group === p);
  assert.strictEqual(ms.length, 6);
  assert(ms.every((m) => m.court === i + 1), "one court per pool");
  const pairs = new Set(ms.map((m) => [m.a, m.b].sort().join("|")));
  assert.strictEqual(pairs.size, 6, "full round robin");
});
// Every team plays 6 matches; no court/time double booking
const count = {};
const codes = {};
data.teams.forEach((t) => (codes[t.pool + t.seed] = t.id));
data.matches.forEach((m) => [m.a, m.b].forEach((x) => (count[x] = (count[x] || 0) + 1)));
const seedCount = {};
data.matches.filter((m) => m.stage !== "pool").forEach((m) =>
  [m.a, m.b].forEach((c) => (seedCount[c] = (seedCount[c] || 0) + 1)));
Object.values(data.groups).flat().forEach((c) => assert.strictEqual(seedCount[c], 2));
const slots = new Set(data.matches.map((m) => m.time + "/" + m.court));
assert.strictEqual(slots.size, data.matches.length);

// Results + resolution
const lines = ["match,s1a,s1b,s2a,s2b,s3a,s3b"];
pool.forEach((m) => lines.push(`${m.id},25,10,25,10,,`)); // team listed first always wins
const res = T.resolveAll(data, T.parseResults(lines.join("\n")));
assert.strictEqual(res.resolved.A1, "aces");
assert.strictEqual(res.resolved.B1, "langenburg-lightning");
assert.strictEqual(res.resolved.A4, "humboldt-chaos");
assert.strictEqual(res.resolved.CX1, undefined, "playoffs unresolved until played");
assert.deepStrictEqual(T.parseResults("match,s1a,s1b\nA1,25,20,,\n").A1, [[25, 20]]);
assert.strictEqual(T.matchOutcome([[25, 20]]).final, false);
console.log("ok");

// Pool play: 2 sets, no third set; 1-1 split is no win for either team
const split = T.matchOutcome([[25, 20], [20, 25], [15, 5]], "pool");
assert.deepStrictEqual([split.setsA, split.setsB, split.final], [1, 1, true]);
assert.strictEqual(T.matchOutcome([[25, 20]], "pool").final, false);
assert.strictEqual(T.matchOutcome([[25, 20], [20, 25]], "playoff").final, false, "playoffs go to a 3rd set");
assert.strictEqual(T.matchOutcome([[25, 20], [20, 25], [15, 5]], "playoff").final, true);

// Tiebreakers: wins, sets won, head-to-head, total points
const mk = (id, a, b) => ({ id, a, b, stage: "pool" });
const rank = (ms, csv, ids) =>
  T.standings(ids, ms, T.parseResults("match,s1a,s1b,s2a,s2b\n" + csv)).map((x) => x.id);
// x,y tied on wins (1) and sets (3); y beat x head-to-head
assert.deepStrictEqual(
  rank([mk("1", "x", "y"), mk("2", "x", "z"), mk("3", "y", "z")],
    "1,20,25,20,25\n2,25,20,20,25\n3,25,20,25,20", ["x", "y", "z"]),
  ["y", "x", "z"]);
// Equal wins, sets won decides before head-to-head: x split with w, y beat w; x beat y? (x 2-0 y)
assert.deepStrictEqual(
  rank([mk("1", "x", "y"), mk("2", "x", "w"), mk("3", "y", "w")],
    "1,25,20,25,20\n2,25,20,20,25\n3,25,20,25,20", ["x", "y", "w"]),
  ["x", "y", "w"]);
// Total points as final tiebreak: equal wins, sets, no head-to-head winner
assert.deepStrictEqual(
  rank([mk("1", "x", "y")], "1,25,20,20,25", ["x", "y"]), ["x", "y"]);
assert.deepStrictEqual(
  rank([mk("1", "x", "y")], "1,25,20,20,26", ["x", "y"]), ["y", "x"]);
console.log("ok tiebreak");
