# Team rosters & photos

For each team add `teams/<team>.md` and optionally `teams/<team>.jpg` (or .jpeg/.png/.webp),
where `<team>` is the team id (`aces`) or the lowercase-hyphenated name (`cvvc-aces`).

```
Coach: Jane Doe, John Smith

- 7, Alex Smith, OH
- 12, Sam Lee, S
```

Then run `python3 scripts/build_teams.py` (the GitHub Action does this automatically on push).
