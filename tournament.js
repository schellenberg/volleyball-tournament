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

  // A match is final once one side has won 2 sets.
  function matchOutcome(sets) {
    if (!sets) return null;
    let wa = 0, wb = 0, pa = 0, pb = 0;
    sets.forEach(([a, b]) => { if (a > b) wa++; else if (b > a) wb++; pa += a; pb += b; });
    return { setsA: wa, setsB: wb, pointsA: pa, pointsB: pb, final: wa >= 2 || wb >= 2 };
  }

  // rows: [{id, played, wins, losses, setsWon, setsLost, pointsFor, pointsAgainst}], sorted
  function standings(teamIds, matches, results, names) {
    const t = {};
    teamIds.forEach((id) => {
      t[id] = { id, played: 0, wins: 0, losses: 0, setsWon: 0, setsLost: 0, pointsFor: 0, pointsAgainst: 0 };
    });
    matches.forEach((m) => {
      const o = matchOutcome(results[m.id]);
      if (!o || !o.final || !t[m.a] || !t[m.b]) return;
      const A = t[m.a], B = t[m.b];
      A.played++; B.played++;
      A.setsWon += o.setsA; A.setsLost += o.setsB; B.setsWon += o.setsB; B.setsLost += o.setsA;
      A.pointsFor += o.pointsA; A.pointsAgainst += o.pointsB;
      B.pointsFor += o.pointsB; B.pointsAgainst += o.pointsA;
      if (o.setsA > o.setsB) { A.wins++; B.losses++; } else { B.wins++; A.losses++; }
    });
    const rows = Object.values(t);
    const h2h = (x, y) => {
      const m = matches.find((q) => (q.a === x.id && q.b === y.id) || (q.a === y.id && q.b === x.id));
      const o = m && matchOutcome(results[m.id]);
      if (!o || !o.final) return 0;
      const xWon = (m.a === x.id) === (o.setsA > o.setsB);
      return xWon ? -1 : 1;
    };
    // Tiebreakers: wins, set differential, point differential, head-to-head, name
    rows.sort((x, y) =>
      y.wins - x.wins ||
      (y.setsWon - y.setsLost) - (x.setsWon - x.setsLost) ||
      (y.pointsFor - y.pointsAgainst) - (x.pointsFor - x.pointsAgainst) ||
      h2h(x, y) ||
      ((names && names[x.id]) || x.id).localeCompare((names && names[y.id]) || y.id));
    return rows;
  }

  // Resolves seed codes (A1 = 1st in pool A, CX2 = 2nd in championship group X) to team ids.
  // A code resolves only once every match feeding it has been completed.
  function resolveAll(data, results) {
    const complete = (ms) => ms.length > 0 && ms.every((m) => (matchOutcome(results[m.id]) || {}).final);
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
