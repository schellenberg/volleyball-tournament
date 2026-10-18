# CVVC Aces 15U Volleyball Tournament — Dec 13, 2026

Mobile-friendly static site (host on GitHub Pages or open via any static server, e.g. `python3 -m http.server`).

## Format
- 3 pools of 4 teams; each pool is a full round robin on its own court (A→Court 1, B→2, C→3). Pool matches are 2 sets (no third set); playoff matches are best of 3 (25, 25, 15).
- Top 2 per pool → Championship bracket; 3rd/4th → Consolation bracket. Each bracket's 6 teams split into two 3-team round-robin groups (A1/B2/C2 vs B1/C1/A2 style cross-pool groups), followed by placement matches (1st v 1st = final, 2nd v 2nd, 3rd v 3rd). Every team plays 6 matches.
- Schedule: 60-minute slots, no lunch break. Pool play 8:00 AM–2:00 PM, playoff round robins 2:00–6:00 PM, placement matches 6:00–8:00 PM (edit `data/tournament.json` to change).

## Entering results
Tie-breaking (shown on the Pools tab) is documented in `app.js` (`TIEBREAK`) and implemented in `tournament.js`.

Results are a CSV with columns `match,s1a,s1b,s2a,s2b,s3a,s3b` (match ids like `A1`, `CX2`, `FC1` are in `data/tournament.json`; scores are for the first-listed / second-listed team).
- Simple: edit `data/results.csv`.
- Google Sheet: create a sheet with those columns, *File → Share → Publish to web → CSV*, and paste the URL into `RESULTS_CSV_URL` in `config.js`. The page refreshes every 60 seconds; standings and playoff matchups fill in automatically.

## Rosters & photos
Add players to each team's `roster` (`{"number":7,"name":"…","position":"OH"}`) in `data/tournament.json`, and put the team photo at `images/teams/<team-id>.jpg`.

## Tests
`node tests/tournament.test.js`
