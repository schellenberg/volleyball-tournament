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
    const ratio = (n, d) => (d === 0 ? (n === 0 ? 0 : Infinity) : n / d);
    const final = matches.filter((m) => t[m.a] && t[m.b] && (matchOutcome(results[m.id]) || {}).final);
    // Wins / set and point totals counting only the given team ids' matches against each other
    const within = (ids) => {
      const s = {};
      ids.forEach((id) => (s[id] = { w: 0, sw: 0, sl: 0, pf: 0, pa: 0 }));
      final.forEach((m) => {
        if (!s[m.a] || !s[m.b]) return;
        const o = matchOutcome(results[m.id]);
        s[m.a].sw += o.setsA; s[m.a].sl += o.setsB; s[m.a].pf += o.pointsA; s[m.a].pa += o.pointsB;
        s[m.b].sw += o.setsB; s[m.b].sl += o.setsA; s[m.b].pf += o.pointsB; s[m.b].pa += o.pointsA;
        s[o.setsA > o.setsB ? m.a : m.b].w++;
      });
      return s;
    };
    const all = within(teamIds);
    const criteria = [
      (id, tied) => tied[id].w,
      (id, tied) => ratio(tied[id].sw, tied[id].sl),
      (id) => ratio(all[id].sw, all[id].sl),
      (id, tied) => ratio(tied[id].pf, tied[id].pa),
      (id) => ratio(all[id].pf, all[id].pa)
    ];
    const byName = (x, y) => ((names && names[x]) || x).localeCompare((names && names[y]) || y);
    // Splits a tied group using each criterion in order; any still-tied subgroup restarts at criterion 1
    function breakTie(ids) {
      if (ids.length < 2) return ids;
      const tied = within(ids);
      for (const f of criteria) {
        const groups = {};
        ids.forEach((id) => (groups[f(id, tied)] = groups[f(id, tied)] || []).push(id));
        const keys = Object.keys(groups).sort((x, y) => y - x);
        if (keys.length > 1) return keys.flatMap((k) => breakTie(groups[k]));
      }
      return ids.slice().sort(byName); // unresolved: organizer decides (coin toss); alphabetical placeholder
    }
    const byWins = {};
    Object.values(t).forEach((r) => (byWins[r.wins] = byWins[r.wins] || []).push(r.id));
    const order = Object.keys(byWins).sort((x, y) => y - x).flatMap((k) => breakTie(byWins[k]));
    const rows = order.map((id) => t[id]);
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
