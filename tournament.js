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
    const byName = (x, y) => ((names && names[x]) || x).localeCompare((names && names[y]) || y);
    const ratio = (n, d) => (d === 0 ? (n === 0 ? 0 : Infinity) : n / d);
    // Totals counting only games among the given teams
    const within = (ids) => {
      const s = {};
      ids.forEach((id) => (s[id] = { mw: 0, ml: 0, sw: 0, sl: 0, pf: 0, pa: 0 }));
      final.forEach((m) => {
        if (!s[m.a] || !s[m.b]) return;
        const o = out(m), A = s[m.a], B = s[m.b];
        A.sw += o.setsA; A.sl += o.setsB; B.sw += o.setsB; B.sl += o.setsA;
        A.pf += o.pointsA; A.pa += o.pointsB; B.pf += o.pointsB; B.pa += o.pointsA;
        if (o.setsA > o.setsB) { A.mw++; B.ml++; } else if (o.setsB > o.setsA) { B.mw++; A.ml++; }
      });
      return s;
    };
    const overall = within(teamIds);
    // Volleyball Canada tie-breaking criteria a-e, in order (f = organizing committee)
    const criteria = [
      (id, g) => ratio(g[id].mw, g[id].ml),
      (id, g) => ratio(g[id].sw, g[id].sl),
      (id) => ratio(overall[id].sw, overall[id].sl),
      (id, g) => ratio(g[id].pf, g[id].pa),
      (id) => ratio(overall[id].pf, overall[id].pa)
    ];
    // Ranks `ids` (still tied) starting at criterion `from`. `group` is the full original tied set,
    // whose mutual results are used for the "between the tied teams" criteria. Never restarts at "a".
    function rank(ids, group, from) {
      if (ids.length < 2) return ids;
      for (let i = from; i < criteria.length; i++) {
        const groups = {};
        ids.forEach((id) => { const k = criteria[i](id, group.stats); (groups[k] = groups[k] || []).push(id); });
        const keys = Object.keys(groups).sort((x, y) => y - x);
        if (keys.length > 1) return keys.flatMap((k) => rank(groups[k], group, i + 1));
      }
      return ids.slice().sort(byName); // criterion f: organizing committee (coin toss); alphabetical placeholder
    }
    function breakTie(ids) {
      if (ids.length < 2) return ids;
      const group = { stats: within(ids) };
      if (ids.length === 2) {
        // Two teams: the head-to-head winner is ranked higher (a split falls through to the criteria)
        const [x, y] = ids, g = group.stats;
        if (g[x].mw !== g[y].mw) return g[x].mw > g[y].mw ? [x, y] : [y, x];
      }
      return rank(ids, group, 0);
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
