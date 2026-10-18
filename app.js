(function () {
  "use strict";
  const cfg = window.TOURNAMENT_CONFIG || {};
  let data, results = {};
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function fmtTime(t) {
    const [h, m] = t.split(":").map(Number);
    return ((h + 11) % 12 + 1) + ":" + String(m).padStart(2, "0") + (h >= 12 ? " PM" : " AM");
  }

  function label(code, res) {
    if (res.resolved[code]) return { text: res.names[res.resolved[code]], real: true };
    const m = /^([ABC])(\d)$/.exec(code);
    if (m) return { text: ordinal(m[2]) + " in Pool " + m[1], real: false };
    const g = /^([CK])([XY])(\d)$/.exec(code);
    const br = g[1] === "C" ? "Championship" : "Consolation";
    return { text: ordinal(g[3]) + " in " + br + " Group " + g[2], real: false };
  }
  const ordinal = (n) => ({ 1: "1st", 2: "2nd", 3: "3rd", 4: "4th" }[n]);

  function matchCard(m, res) {
    const a = res.names[m.a] ? { text: res.names[m.a], real: true } : label(m.a, res);
    const b = res.names[m.b] ? { text: res.names[m.b], real: true } : label(m.b, res);
    const sets = results[m.id], o = T.matchOutcome(sets);
    const done = o && o.final;
    const win = (side) => done && (side === "a" ? o.setsA > o.setsB : o.setsB > o.setsA);
    const tag = m.stage === "pool" ? "Pool " + m.group : m.stage === "final" ? m.label : groupName(m.group);
    const score = (i) => (sets ? sets.map((s) => s[i]).join(" · ") : "");
    return `<div class="match ${done ? "done" : ""}">
      <div class="meta"><span>${fmtTime(m.time)} · Court ${m.court}</span><span class="tag">${esc(tag)}</span></div>
      <div class="team ${win("a") ? "win" : ""} ${a.real ? "" : "tbd"}"><span>${esc(a.text)}</span><b>${o ? o.setsA : ""}</b><i>${score(0)}</i></div>
      <div class="team ${win("b") ? "win" : ""} ${b.real ? "" : "tbd"}"><span>${esc(b.text)}</span><b>${o ? o.setsB : ""}</b><i>${score(1)}</i></div>
    </div>`;
  }
  const groupName = (g) => (g[0] === "C" ? "Championship" : "Consolation") + " Group " + g[1];

  function renderSchedule(res) {
    const times = [...new Set(data.matches.map((m) => m.time))].sort();
    let html = "";
    times.forEach((t) => {
      const ms = data.matches.filter((m) => m.time === t).sort((x, y) => x.court - y.court);
      if (t === "12:30") html += `<h3 class="break">Lunch break</h3>`;
      html += `<h3>${fmtTime(t)}</h3><div class="grid">${ms.map((m) => matchCard(m, res)).join("")}</div>`;
    });
    $("schedule").innerHTML = html;
  }

  function table(rows, res, extra) {
    return `<div class="scroll"><table><thead><tr><th>#</th><th>Team</th><th>W</th><th>L</th><th>Sets</th><th>Pts +/-</th></tr></thead><tbody>${rows
      .map((r, i) => `<tr class="${extra && extra(i) || ""}"><td>${i + 1}</td><td>${esc(res.names[r.id])}</td><td>${r.wins}</td><td>${r.losses}</td><td>${r.setsWon}-${r.setsLost}</td><td>${r.pointsFor - r.pointsAgainst > 0 ? "+" : ""}${r.pointsFor - r.pointsAgainst}</td></tr>`)
      .join("")}</tbody></table></div>`;
  }

  const TIEBREAK = `<details class="rules" open><summary>How teams are ranked</summary><p>Teams are ranked by <b>matches won</b>. A match is won by taking 2 sets. If teams are tied, these steps are applied in order until the tie is broken:</p><ol>
<li><b>Head-to-head:</b> matches won in games among only the tied teams.</li>
<li><b>Set ratio</b> (sets won ÷ sets lost) in games among only the tied teams.</li>
<li><b>Set ratio</b> in all pool matches.</li>
<li><b>Point ratio</b> (points scored ÷ points allowed) in games among only the tied teams.</li>
<li><b>Point ratio</b> in all pool matches.</li>
<li><b>Coin toss</b> or tournament organizer decision.</li></ol>
<p>When three or more teams are tied and a step separates only some of them, the teams still tied start again from step 1. The same rules rank the playoff groups.</p></details>`;

  function renderStandings(res) {
    $("standings").innerHTML = TIEBREAK + '<p class="note">Top 2 in each pool advance to the Championship bracket; 3rd and 4th go to the Consolation bracket.</p>' +
      ["A", "B", "C"].map((p) => `<h2>Pool ${p} <small>Court ${p.charCodeAt(0) - 64}</small></h2>` +
        table(res.poolTables[p], res, (i) => (i < 2 ? "adv" : "")) +
        `<div class="grid">${data.matches.filter((m) => m.stage === "pool" && m.group === p).map((m) => matchCard(m, res)).join("")}</div>`).join("");
  }

  function renderPlayoffs(res) {
    let html = '<p class="note">Everyone plays 3 playoff matches: a 3-team round robin, then a placement match against the same-placed team from the other group.</p>';
    ["C", "K"].forEach((br) => {
      html += `<h2>${br === "C" ? "Championship Bracket" : "Consolation Bracket"}</h2>`;
      ["X", "Y"].forEach((x) => {
        const g = br + x;
        html += `<h3>Group ${x}</h3>`;
        html += res.groupTables[g]
          ? table(res.groupTables[g], res)
          : `<ul class="seeds">${data.groups[g].map((c) => `<li>${esc(label(c, res).text)}</li>`).join("")}</ul>`;
        html += `<div class="grid">${data.matches.filter((m) => m.stage === "playoff" && m.group === g).map((m) => matchCard(m, res)).join("")}</div>`;
      });
      html += `<h3>Placement matches</h3><div class="grid">${data.matches.filter((m) => m.stage === "final" && m.group === br).map((m) => matchCard(m, res)).join("")}</div>`;
    });
    $("playoffs").innerHTML = html;
  }

  function initials(n) { return n.split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase(); }

  function renderTeams() {
    $("teams").innerHTML = '<div class="grid teams">' + data.teams.map((t) => {
      const roster = t.roster && t.roster.length
        ? `<table><thead><tr><th>#</th><th>Player</th><th>Pos</th></tr></thead><tbody>${t.roster.map((p) => `<tr><td>${esc(p.number ?? "")}</td><td>${esc(p.name)}</td><td>${esc(p.position || "")}</td></tr>`).join("")}</tbody></table>`
        : '<p class="note">Roster coming soon.</p>';
      return `<article class="team-card" id="team-${esc(t.id)}">
        <div class="photo"><span>${esc(initials(t.name))}</span><img src="${esc(t.photo)}" alt="${esc(t.name)} team photo" loading="lazy" onerror="this.remove()"></div>
        <h3>${esc(t.name)}</h3><p class="note">Pool ${esc(t.pool)}${t.coach ? " · Coach " + esc(t.coach) : ""}</p>${roster}</article>`;
    }).join("") + "</div>";
  }

  function render() {
    const res = T.resolveAll(data, results);
    renderSchedule(res); renderStandings(res); renderPlayoffs(res);
  }

  async function loadResults() {
    try {
      const url = cfg.RESULTS_CSV_URL || "data/results.csv";
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) throw new Error(r.status);
      results = T.parseResults(await r.text());
      $("status").textContent = "Updated " + new Date().toLocaleTimeString();
    } catch (e) {
      $("status").textContent = "Could not load latest results; showing last known.";
    }
    render();
  }

  async function init() {
    window.T = window.Tournament;
    data = await (await fetch("data/tournament.json")).json();
    $("title").textContent = data.name;
    $("subtitle").textContent = data.dateLabel + " · " + data.format;
    renderTeams();
    document.querySelectorAll("#tabs button").forEach((b) => b.addEventListener("click", () => {
      document.querySelectorAll("#tabs button").forEach((x) => x.classList.toggle("active", x === b));
      document.querySelectorAll("main section").forEach((s) => (s.hidden = s.id !== b.dataset.tab));
    }));
    await loadResults();
    setInterval(loadResults, (cfg.REFRESH_SECONDS || 60) * 1000);
  }
  init().catch(() => ($("status").textContent = "Failed to load tournament data."));
})();
