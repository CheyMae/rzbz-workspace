# RZBZ Design workspace

A private, Notion-style workspace for the RZBZ Design Team: projects → tasks → sprints, then the library.
Frontend on GitHub Pages; data and login in Supabase (project "RZBZ Design").

## What's here

| Path | What it is |
|---|---|
| `supabase/migrations/20261111000000_init.sql` | Tables, access rules (members only), sprint close / next sprint, activity log |
| `scripts/build_seed.py` | Turns `~/Documents/RZBZ Design Team Master.xlsx` into `supabase/seed.sql` |
| `scripts/members.local.json` | Who can sign in (not committed) |
| `scripts/aliases.local.json` | Name spellings that are the same person (not committed) |
| `supabase/seed.sql` | Generated team data (not committed) |

## How sprints work

- Two weeks each. Sprint 21 = Oct 26 → Nov 8, 2026; earlier sprints are counted back from it.
- A sprint stays **open** until someone closes it. Open and past its end date = **extended**.
- `close_sprint(id, 'move')` moves unfinished tasks to the next sprint (creating it if needed);
  `'keep'` leaves them where they are.
- A task in a sprint automatically puts its project in that sprint (`project_sprints`).
  "Add sprint" on the Project page writes to the same table.

## Load the database (one time)

```bash
python3 scripts/build_seed.py
npx supabase login
npx supabase init
npx supabase link --project-ref <your project ref>
npx supabase db push --include-seed
```

Then, in the Supabase dashboard → Authentication:
1. Turn off **Allow new users to sign up**.
2. **Invite** each email listed in `scripts/members.local.json`.

## Import rules

- Tasks missing a project or a sprint are imported as archived
- Sub-tasks whose parent can't be matched are left out
- Some projects have no product or lead; they import as normal projects
- One Notion ID was shared by two different projects; both are kept
