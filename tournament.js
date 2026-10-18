(function (root) {
  "use strict";

  function parseCSV(text) {
    const rows = [];
    let row = [], cell = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') q = false;
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); cell = "";
        if (row.some((x) => x.trim() !== "")) rows.push(row);
        row = [];
      } else cell += c;
    }
    row.push(cell);
    if (row.some((x) => x.trim() !== "")) rows.push(row);
    return rows;
  }

  // CSV -> { matchId: [[a,b],...] } (only sets with both scores entered)
  function parseResults(text) {
    const rows = parseCSV(text || "");
    const out = {};
    for (let r = 1; r < rows.length; r++) {
      const id = (rows[r][0] || "").trim().toUpperCase();
      if (!id) continue;
      const sets = [];
      for (let s = 0; s < 3; s++) {
        const a = (rows[r][1 + s * 2] || "").trim();
        const b = (rows[r][2 + s * 2] || "").trim();
        if (a !== "" && b !== "" && !isNaN(a) && !isNaN(b)) sets.push([+a, +b]);
      }
      if (sets.length) out[id] = sets;
    }
    return out;
  }

  // Pool matches are exactly 2 sets (a 1-1 split is final: no match winner).
  // Playoff matches are best of 3: final once one side has won 2 sets.
  function matchOutcome(sets, stage) {
    if (!sets) return null;
    const pool = stage === "pool";
    const played = pool ? sets.slice(0, 2) : sets;
    let wa = 0, wb = 0, pa = 0, pb = 0;
    played.forEach(([a, b]) => { if (a > b) wa++; else if (b > a) wb++; pa += a; pb += b; });
    return { setsA: wa, setsB: wb, pointsA: pa, pointsB: pb, final: pool ? played.length >= 2 : wa >= 2 || wb >= 2 };
  }

  // rows: [{id, played, wins, losses, setsWon, setsLost, pointsFor, pointsAgainst}], sorted
  function standings(teamIds, matches, results, names) {
    const t = {};
    teamIds.forEach((id) => {
      t[id] = { id, played: 0, wins: 0, losses: 0, setsWon: 0, setsLost: 0, pointsFor: 0, pointsAgainst: 0 };
    });
    const out = (m) => matchOutcome(results[m.id], m.stage);
    const final = matches.filter((m) => t[m.a] && t[m.b] && (out(m) || {}).final);
    final.forEach((m) => {
      const o = out(m), A = t[m.a], B = t[m.b];
      A.played++; B.played++;
      A.setsWon += o.setsA; A.setsLost += o.setsB; B.setsWon += o.setsB; B.setsLost += o.setsA;
      A.pointsFor += o.pointsA; A.pointsAgainst += o.pointsB;
      B.pointsFor += o.pointsB; B.pointsAgainst += o.pointsA;
      if (o.setsA > o.setsB) { A.wins++; B.losses++; } else if (o.setsB > o.setsA) { B.wins++; A.losses++; }
    });
    // Match wins counting only games among the given teams (head-to-head)
    const h2hWins = (ids) => {
      const w = {};
      ids.forEach((id) => (w[id] = 0));
      final.forEach((m) => {
        if (!(m.a in w) || !(m.b in w)) return;
        const o = out(m);
        if (o.setsA > o.setsB) w[m.a]++; else if (o.setsB > o.setsA) w[m.b]++;
      });
      return w;
    };
    const byName = (x, y) => ((names && names[x]) || x).localeCompare((names && names[y]) || y);
    // Ties on match wins: 1) sets won, 2) head-to-head among tied teams, 3) total points, 4) coin toss.
    // When a step separates only some teams, the rest are re-ranked from step 1 among themselves.
    function breakTie(ids) {
      if (ids.length < 2) return ids;
      const h = h2hWins(ids);
      const steps = [(id) => t[id].setsWon, (id) => h[id], (id) => t[id].pointsFor];
      for (const f of steps) {
        const groups = {};
        ids.forEach((id) => (groups[f(id)] = groups[f(id)] || []).push(id));
        const keys = Object.keys(groups).sort((x, y) => y - x);
        if (keys.length > 1) return keys.flatMap((k) => breakTie(groups[k]));
      }
      return ids.slice().sort(byName); // coin toss needed; alphabetical placeholder
    }
    const byWins = {};
    Object.values(t).forEach((r) => (byWins[r.wins] = byWins[r.wins] || []).push(r.id));
    return Object.keys(byWins).sort((x, y) => y - x).flatMap((k) => breakTie(byWins[k])).map((id) => t[id]);
  }

  // Resolves seed codes (A1 = 1st in pool A, CX2 = 2nd in championship group X) to team ids.
  // A code resolves only once every match feeding it has been completed.
  function resolveAll(data, results) {
    const complete = (ms) => ms.length > 0 && ms.every((m) => (matchOutcome(results[m.id], m.stage) || {}).final);
    const names = {};
    data.teams.forEach((t) => (names[t.id] = t.name));
    const table = {}, resolved = {}, groupTables = {};

    ["A", "B", "C"].forEach((p) => {
      const ms = data.matches.filter((m) => m.stage === "pool" && m.group === p);
      const ids = data.teams.filter((t) => t.pool === p).map((t) => t.id);
      table[p] = standings(ids, ms, results, names);
      if (complete(ms)) table[p].forEach((r, i) => (resolved[p + (i + 1)] = r.id));
    });

    Object.keys(data.groups).forEach((g) => {
      const ms = data.matches.filter((m) => m.stage === "playoff" && m.group === g);
      const ids = data.groups[g].map((c) => resolved[c]).filter(Boolean);
      const resolvedMs = ms.map((m) => ({ id: m.id, a: resolved[m.a], b: resolved[m.b] }));
      groupTables[g] = ids.length === data.groups[g].length ? standings(ids, resolvedMs, results, names) : null;
      if (groupTables[g] && complete(ms)) groupTables[g].forEach((r, i) => (resolved[g + (i + 1)] = r.id));
    });
    return { names, poolTables: table, groupTables, resolved };
  }

  const api = { parseCSV, parseResults, matchOutcome, standings, resolveAll };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Tournament = api;
})(typeof window !== "undefined" ? window : globalThis);
