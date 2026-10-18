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
