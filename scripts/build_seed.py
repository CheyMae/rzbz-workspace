"""Build supabase/seed.sql from the RZBZ Design Team master Excel file.

Usage:
    python3 scripts/build_seed.py [path/to/master.xlsx]

Reads scripts/members.local.json for sign-in emails (kept out of git), e.g.
    {"<Person name>": {"email": "...", "role": "owner"}}

The output contains real team data, so supabase/seed.sql is git-ignored.
"""
import datetime as dt
import json
import re
import sys
import uuid
from collections import Counter
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
XLSX = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / "Documents/RZBZ Design Team Master.xlsx"
OUT = ROOT / "supabase/seed.sql"
MEMBERS = ROOT / "scripts/members.local.json"
NS = uuid.UUID("6f1c2a52-3d0e-4b7e-9a51-2a4f0c3e9b11")

# Real sprint dates as recorded by the team (2026 cycle). Sprints 1-4 (mid-2025) aren't tracked:
# their tasks go to the archive with the old label. "Sprint 20" was used twice; the October one is 20b.
D = dt.date
SPRINTS = [  # (number, suffix, start, end)
    (5, "", D(2025, 12, 22), D(2026, 1, 2)), (6, "", D(2026, 1, 5), D(2026, 1, 16)),
    (7, "", D(2026, 1, 19), D(2026, 1, 30)), (8, "", D(2026, 2, 2), D(2026, 2, 13)),
    (9, "", D(2026, 2, 16), D(2026, 2, 27)), (10, "", D(2026, 3, 2), D(2026, 3, 13)),
    (11, "", D(2026, 3, 16), D(2026, 3, 27)), (12, "", D(2026, 3, 30), D(2026, 4, 10)),
    (13, "", D(2026, 4, 13), D(2026, 4, 24)), (14, "", D(2026, 4, 27), D(2026, 5, 8)),
    (15, "", D(2026, 5, 11), D(2026, 5, 22)), (16, "", D(2026, 5, 25), D(2026, 6, 5)),
    (17, "", D(2026, 6, 8), D(2026, 6, 19)), (18, "", D(2026, 6, 22), D(2026, 7, 3)),
    (19, "", D(2026, 7, 6), D(2026, 7, 17)), (20, "", D(2026, 7, 20), D(2026, 7, 31)),
    (20, "b", D(2026, 10, 12), D(2026, 10, 25)), (21, "", D(2026, 10, 26), D(2026, 11, 8)),
    (22, "", D(2026, 11, 23), D(2026, 12, 4)),
]
BREAKS = [(D(2026, 8, 1), D(2026, 10, 11))]   # the unnamed gap between Sprint 20 and 20b
SPRINT_YEAR = 2026
CURRENT_SPRINT = 21          # open (extended until closed); 22 is upcoming
FIRST_TRACKED_SPRINT = 5
SPRINT_20B_FROM = D(2026, 9, 1)  # Sprint 20 tasks due on/after this belong to 20b

# Name spellings confirmed to be the same person, e.g. {"First": "First Last"}.
# Kept in a git-ignored file because this repo is public. Only merge confirmed matches.
ALIASES_FILE = ROOT / "scripts/aliases.local.json"
NAME_ALIASES = json.loads(ALIASES_FILE.read_text()) if ALIASES_FILE.exists() else {}
PROJECT_STATUS = {"In Progress": "in_progress", "Paused": "paused", "Done": "done", "Backlog": "not_started",
                  "Not Started": "not_started", "Not started": "not_started", "Planning": "not_started",
                  "Waiting for Feedback": "waiting_for_feedback", "Canceled": "canceled"}
TASK_STATUS = {"Not Started": "not_started", "Next Up": "next_up", "In Progress": "in_progress",
               "Design Ready": "done", "Done": "done", "Archived": "archived"}
PRIORITY = {"High": "high", "Medium": "medium", "Low": "low"}

problems = Counter()


_seen_ids = set()


def uid(*parts):
    """Stable UUID from the given parts. Repeated keys (duplicate rows in the sheet) get a suffix."""
    key, n = "|".join(str(p) for p in parts), 0
    while True:
        u = str(uuid.uuid5(NS, key if n == 0 else f"{key}#{n}"))
        if u not in _seen_ids or parts[0] in ("person", "product", "sprint"):
            break
        problems["duplicate row in sheet"] += 1
        n += 1
    _seen_ids.add(u)
    return u


class Raw(str):
    """Already a SQL literal (e.g. an empty string that must stay '' rather than null)."""


def q(v):
    """SQL literal."""
    if isinstance(v, Raw):
        return str(v)
    if v is None or (isinstance(v, str) and v.strip() in ("", "-", "—")):
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, (dt.date, dt.datetime)):
        return f"'{v.isoformat()}'"
    return "'" + str(v).replace("'", "''") + "'"


def date(v):
    if v in (None, ""):
        return None
    if isinstance(v, dt.datetime):
        return v.date()
    if isinstance(v, dt.date):
        return v
    try:
        return dt.date.fromisoformat(str(v)[:10])
    except ValueError:
        problems["unparseable date"] += 1
        return None


def clean(v):
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def names(v):
    out = []
    for n in str(v or "").split(","):
        n = n.strip()
        if n:
            out.append(NAME_ALIASES.get(n, n))
    return out


def split_emoji(label):
    """'📲 RCBC Pulz' -> ('📲', 'RCBC Pulz')."""
    label = (label or "").strip()
    m = re.match(r"^(\S+)\s+(.*)$", label)
    if m and not re.match(r"[\w(]", m.group(1)):
        return m.group(1), m.group(2).strip()
    return None, label


def sprint_no(v):
    m = re.fullmatch(r"\s*Sprint\s+(\d+)\s*", str(v or ""))
    return int(m.group(1)) if m else None


def rows(ws):
    it = ws.iter_rows(values_only=True)
    head = next(it)
    for r in it:
        yield dict(zip(head, r))


def insert(table, cols, values, out):
    if not values:
        return
    for i in range(0, len(values), 200):
        chunk = values[i:i + 200]
        out.append(f"insert into {table} ({', '.join(cols)}) values\n  " +
                   ",\n  ".join("(" + ", ".join(q(x) for x in row) + ")" for row in chunk) + ";")


def main():
    wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
    members = json.loads(MEMBERS.read_text()) if MEMBERS.exists() else {}
    sql = ["-- Generated by scripts/build_seed.py. Contains team data: do not commit.", "begin;"]

    # Members --------------------------------------------------------------
    insert("members", ["email", "role"],
           [[m["email"].lower(), m.get("role", "editor")] for m in members.values()], sql)
    email_for = {name: m["email"].lower() for name, m in members.items()}

    # People: collected from every name column -------------------------------
    projects_ws = list(rows(wb["Projects"]))
    tasks_ws = [r for r in rows(wb["Tasks"]) if clean(r["Task"])]
    arch_p_ws = [r for r in rows(wb["Archive Projects"]) if clean(r["Project"])]
    arch_t_ws = [r for r in rows(wb["Archive Tasks"]) if clean(r["Task"])]

    people = set()
    for r in projects_ws + arch_p_ws:
        people.update(names(r["Carry Designer"]))
        people.update(names(r.get("Support Designers")))
    for r in tasks_ws:
        people.update(names(r["Assigned"]))
    for r in arch_t_ws:
        people.update(names(r["Assignee"]))
    person_id = {}
    prow = []
    for n in sorted(people):
        person_id[n] = uid("person", n)
        short = n.split()[0]
        prow.append([person_id[n], n, email_for.get(n) or email_for.get(short)])
    insert("people", ["id", "name", "email"], prow, sql)

    # Products -------------------------------------------------------------
    product_id, prod_rows = {}, []
    for i, r in enumerate(rows(wb["Products"])):
        if not clean(r["Product"]):
            continue
        emoji, name = split_emoji(r["Label in Projects"] or r["Product"])
        name = name or r["Product"]
        product_id[name] = uid("product", name)
        prod_rows.append([product_id[name], name, emoji, clean(r["Description"]), clean(r["Platforms"]),
                          clean(r["Design System (Figma)"]), clean(r["Page Notes"]), i])

    def product_refs(label):
        """'🎨 Internal Design, 📲 RCBC Pulz' -> [id, id]; the first is the main product."""
        ids = []
        for part in str(label or "").split(","):
            if not clean(part):
                continue
            emoji, name = split_emoji(part)
            if name not in product_id:
                product_id[name] = uid("product", name)
                prod_rows.append([product_id[name], name, emoji, None, None, None, None, 100 + len(prod_rows)])
            ids.append(product_id[name])
        return ids

    def product_ref(label):
        ids = product_refs(label)
        return ids[0] if ids else None

    for r in projects_ws + arch_p_ws:
        product_ref(r["Product"])

    # Sprints --------------------------------------------------------------
    sprint_id, sprint_rows = {}, []
    for n, suffix, start, end in SPRINTS:
        key = f"{n}{suffix}"
        status = "open" if n == CURRENT_SPRINT else "upcoming" if n > CURRENT_SPRINT else "closed"
        sprint_id[key] = uid("sprint", key)
        sprint_rows.append([sprint_id[key], SPRINT_YEAR, n, Raw(q(suffix) if suffix else "''"), "sprint", start, end, status,
                            f"{end} 18:00+08" if status == "closed" else None])
    for start, end in BREAKS:
        sprint_rows.append([uid("sprint", "break", start), SPRINT_YEAR, None, Raw("''"), "break", start, end, "closed", None])

    def sprint_key(sn, r):
        if sn == 20 and (date(r["Due End"]) or date(r["Due Start"]) or D(2000, 1, 1)) >= SPRINT_20B_FROM:
            return "20b"
        return str(sn)

    # Projects -------------------------------------------------------------
    proj_rows, pp_rows, ppr_rows = [], [], []
    by_notion, current_by_name, archive_by_name = {}, {}, {}

    def add_project(r, archived):
        status_raw = clean(r["Status"])
        status = PROJECT_STATUS.get(status_raw)
        if status is None:
            problems[f"project status '{status_raw}' -> not_started"] += 1
            status = "not_started"
        nid = clean(r.get("Notion ID"))
        if nid and nid in by_notion:   # export bug: two different projects share one Notion ID
            problems[f"shared Notion ID kept on first row only ({r['Project'].strip()})"] += 1
            nid = None
        pid = uid("project", nid) if nid else uid("archive-project", r.get("ID"), r["Project"], r["Start"])
        year = clean(r.get("Year"))
        proj_rows.append([pid, r["Project"].strip(), product_ref(r["Product"]), status,
                          PRIORITY.get(clean(r["Priority"])), clean(r.get("Type")), clean(r["Owner / Requester"]),
                          date(r["Start"]), date(r["End"]), clean(r.get("About this project")),
                          clean(r.get("ID")), int(year) if year and year.isdigit() else None, nid, archived])
        for prod in product_refs(r["Product"]):
            ppr_rows.append([pid, prod])
        for role, col in (("lead", "Carry Designer"), ("support", "Support Designers")):
            for n in names(r.get(col)):
                pp_rows.append([pid, person_id[n], role])
        if nid:
            by_notion[nid] = pid
        (archive_by_name if archived else current_by_name).setdefault(r["Project"].strip(), pid)
        if not r["Product"]:
            problems["project without product"] += 1
        if not archived and not names(r["Carry Designer"]) and status != "done":
            problems["active project without lead"] += 1

    for r in projects_ws:
        if clean(r["Project"]):
            add_project(r, False)
    for r in arch_p_ws:
        add_project(r, True)
    pp_rows = [list(x) for x in {tuple(x) for x in pp_rows}]

    # Tasks ----------------------------------------------------------------
    task_rows, ta_rows, parents = [], [], []
    for r in tasks_ws:
        nid = clean(r["Notion ID"])
        tid = uid("task", nid) if nid else uid("task-row", r["Task"], r["Project"], r["Due End"])
        pid = by_notion.get(clean(r["Project ID"])) or current_by_name.get(clean(r["Project"]) or "")
        sn = sprint_no(r["Sprint"])
        status = TASK_STATUS.get(clean(r["Status"]))
        if status is None:
            problems[f"task status '{r['Status']}' -> not_started"] += 1
            status = "not_started"
        # Tasks missing a project or a sprint go to the archive; so do tasks from Sprints 1-4.
        legacy = f"Sprint {sn}" if sn and sn < FIRST_TRACKED_SPRINT else None
        if legacy:
            problems["archived: task from untracked Sprints 1-4"] += 1
            sn = None
        orphan = not pid or not sn or bool(legacy)
        if orphan and not legacy:
            problems["archived: task missing project or sprint"] += 1
            if not pid and not sn:
                problems["  (of which missing both)"] += 1
            if sn == CURRENT_SPRINT and status not in ("done", "archived"):
                problems["  (of which open in the current sprint)"] += 1
        task_rows.append([tid, r["Task"].strip(), pid, sprint_id.get(sprint_key(sn, r)) if sn else None, legacy, status,
                          PRIORITY.get(clean(r["Priority"])), clean(r["Phase"]), clean(r["Type"]), None,
                          clean(r["Day"]), clean(r["Effort"]), date(r["Due Start"]), date(r["Due End"]),
                          clean(r["Summary"]), clean(r["Notes (page content)"]), clean(r["Deliverables"]),
                          clean(r["Blocked By"]), clean(r["Related Files / Links"]), clean(r["Attachments"]),
                          nid, orphan])
        for n in names(r["Assigned"]):
            ta_rows.append([tid, person_id[n]])
        if clean(r["Parent Task"]):
            parents.append((tid, pid, clean(r["Parent Task"])))
        if status not in ("done", "archived") and not names(r["Assigned"]):
            problems["open task without assignee"] += 1

    for i, r in enumerate(arch_t_ws):
        tid = uid("archive-task", i, r["Task"])
        pname = clean(r["Project"]) or ""
        pid = archive_by_name.get(pname) or current_by_name.get(pname)
        status = TASK_STATUS.get(clean(r["Status"]), "done")
        task_rows.append([tid, r["Task"].strip(), pid, None, clean(r["Sprint"]), status,
                          PRIORITY.get(clean(r["Priority"])), None, None, clean(r["Tags"]),
                          None, None, date(r["Due Start"]), date(r["Due End"]),
                          clean(r["Summary"]), None, None, None, clean(r["Link"]), None, None, True])
        for n in names(r["Assignee"]):
            ta_rows.append([tid, person_id[n]])
    ta_rows = [list(x) for x in {tuple(x) for x in ta_rows}]

    # Parent tasks: matched by title (or Notion ID) within the same project.
    title_index = {}
    for t in task_rows:
        title_index.setdefault((t[2], t[1]), t[0])
    by_task_notion = {t[20]: t[0] for t in task_rows if t[20]}
    parent_updates, dropped = [], set()
    for tid, pid, ref in parents:
        first = ref.split(",")[0].strip()
        target = by_task_notion.get(first) or title_index.get((pid, first))
        if target and target != tid:
            parent_updates.append((tid, target))
        else:
            dropped.add(tid)   # sub-tasks whose parent can't be found are deleted
    if dropped:
        problems["deleted: sub-task with no matching parent"] = len(dropped)
        task_rows = [t for t in task_rows if t[0] not in dropped]
        ta_rows = [a for a in ta_rows if a[0] not in dropped]
        parent_updates = [(c, p) for c, p in parent_updates if c not in dropped and p not in dropped]

    # Library + launch plan ------------------------------------------------
    lib_rows = [[uid("library", i, r["Name"]), r["Section"], r["Name"], clean(r["Product / Group"]), clean(r["Type"]),
                 clean(r["Status"]), clean(r["Link"]), clean(r["Second Link"]), i]
                for i, r in enumerate(rows(wb["Library"])) if clean(r["Name"]) and clean(r["Section"])]
    launch_rows = []
    for r in rows(wb["Products to Launch"]):
        if clean(r["Project / Feature"]):
            y = clean(r["Year to Launch"])
            launch_rows.append([r["Project / Feature"].strip(), clean(r["Product"]), clean(r["Status"]),
                                int(y) if y and y.isdigit() else None])

    # Write ----------------------------------------------------------------
    insert("products", ["id", "name", "emoji", "description", "platforms", "design_system_url", "notes", "sort_order"],
           prod_rows, sql)
    insert("sprints", ["id", "year", "number", "suffix", "kind", "starts_on", "ends_on", "status", "closed_at"],
           sprint_rows, sql)
    insert("projects", ["id", "name", "product_id", "status", "priority", "type", "owner_requester", "starts_on",
                        "ends_on", "about", "legacy_code", "legacy_year", "notion_id", "is_archived"], proj_rows, sql)
    insert("project_people", ["project_id", "person_id", "role"], pp_rows, sql)
    ppr_rows = [list(x) for x in dict.fromkeys(tuple(x) for x in ppr_rows)]
    insert("project_products", ["project_id", "product_id"], ppr_rows, sql)
    insert("tasks", ["id", "title", "project_id", "sprint_id", "legacy_sprint", "status", "priority", "phase", "type",
                     "tags", "day", "effort", "due_start", "due_end", "summary", "notes", "deliverables",
                     "blocked_by", "links", "attachments", "notion_id", "is_archived"], task_rows, sql)
    insert("task_assignees", ["task_id", "person_id"], ta_rows, sql)
    for tid, parent in parent_updates:
        sql.append(f"update tasks set parent_task_id = {q(parent)} where id = {q(tid)};")
    insert("library_items", ["id", "section", "name", "product_group", "type", "status", "url", "second_url",
                             "sort_order"], lib_rows, sql)
    insert("launch_plan", ["name", "product", "status", "launch_year"], launch_rows, sql)
    insert("pages", ["slug", "title", "emoji", "sort_order"],
           [["hr-stuff", "HR Stuff", "🧾", 0], ["hiring-people", "Hiring People", "🤝", 1]], sql)
    sql.append("commit;")
    OUT.write_text("\n\n".join(sql) + "\n")

    current = sum(1 for p in proj_rows if not p[13])
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1e6:.1f} MB)")
    print(f"members {len(members)} | people {len(prow)} | products {len(prod_rows)} | sprints {len(sprint_rows)}")
    print(f"projects {current} current + {len(proj_rows) - current} archived | leads/support links {len(pp_rows)}")
    print(f"tasks {len(tasks_ws)} current + {len(arch_t_ws)} archived | assignee links {len(ta_rows)} | "
          f"parent links {len(parent_updates)}")
    print(f"library {len(lib_rows)} | launch plan {len(launch_rows)} | pages 2")
    print("sprints:", ", ".join(f"{r[2]}{r[3].strip(chr(39))} {r[5]:%b %d}" if r[4] == "sprint" else f"break {r[5]:%b %d}"
                                for r in sprint_rows))
    print("data to sort out later:")
    for k, v in problems.most_common():
        print(f"  {v:5d}  {k}")


if __name__ == "__main__":
    main()
