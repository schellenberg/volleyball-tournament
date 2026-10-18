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

// Tiebreakers (Volleyball Canada rulebook)
const mk = (id, a, b) => ({ id, a, b, stage: "pool" });
const rank = (ms, csv, ids) =>
  T.standings(ids, ms, T.parseResults("match,s1a,s1b,s2a,s2b\n" + csv)).map((x) => x.id);
const W = "25,20,25,20", L = "20,25,20,25", S = "25,20,20,25"; // win, loss, split (for first-listed team)
// Two teams tied on wins: head-to-head winner ranks higher (x 2 wins, y 2 wins, z 1, w 1)
const four = [mk("1", "x", "y"), mk("2", "x", "z"), mk("3", "x", "w"), mk("4", "y", "z"), mk("5", "y", "w"), mk("6", "z", "w")];
assert.deepStrictEqual(rank(four, `1,${W}\n2,${W}\n3,${L}\n4,${W}\n5,${W}\n6,${W}`, ["x", "y", "z", "w"]), ["x", "y", "z", "w"]);
// Three-way tie x>y>z>x: (a)-(c) equal; (d) points ratio among the tied teams decides: x, z, y
const ms3 = [mk("1", "x", "y"), mk("2", "y", "z"), mk("3", "z", "x")];
assert.deepStrictEqual(rank(ms3, "1,25,10,25,10\n2,25,20,25,20\n3,25,20,25,20", ["x", "y", "z"]), ["x", "z", "y"]);
// Partial separation does not restart at (a): set ratio (b) ranks z first (3-1 sets), then x,y continue to (c)+
assert.strictEqual(rank(ms3, "1,25,20,25,20\n2,25,20,20,25\n3,25,20,25,20", ["x", "y", "z"])[0], "z");
// A 1-1 split gives no match win to either team
const st = T.standings(["x", "y"], [mk("1", "x", "y")], T.parseResults("match,s1a,s1b,s2a,s2b\n1," + S));
assert.deepStrictEqual(st.map((r) => r.wins), [0, 0]);
console.log("ok tiebreak");
