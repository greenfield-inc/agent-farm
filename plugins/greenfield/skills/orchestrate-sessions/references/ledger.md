# Ledger

Use host durable state when available; otherwise `.agent/ledger.json`. Keep one entry per work item (one feature: one worktree, branch, Pane and PR), with one `workers` entry per worker session in it. Host IDs are opaque and separate from `status_file`; record associations only as the host reports them.

```json
{
  "caps": { "concurrent": 3, "spend_usd": null },
  "session": { "name": "<host Session name>", "id": "<the host's stable Session id>", "canonical_destination": null, "map": null, "stubs": [],
               "artifact": { "path": "sessions/<host Session name> · <first 8 characters of the Session id>", "id": null, "url": null,
                             "local": "<Session folder>/session/index.html", "opened_url": null, "notice_shown": false } },
  "review_policy": { "mode": "on ready or at a plan's end", "set_by": "default", "time": null },
  "items": [
    {
      "id": "ENG-123",
      "repo": "/absolute/repo",
      "depends_on": [],
      "destination": "named destination, or null for a local bundle",
      "trace_capture": "granted by repository workspace | granted by person | not granted",
      "source": "/absolute/bundle/cover-sheet.html",
      "urgency": "normal",
      "worktree": "../worktrees/invoice-pdf",
      "branch": "invoice-pdf",
      "host_workspace_id": null,
      "pane_id": null,
      "owning_session_id": null,
      "stage": "queued | running | blocked | in review | pr open | done | failed | needs planning",
      "phase": "planning | awaiting approval | implementing | in review | complete",
      "validation": "deferred | validating | validated",
      "source_revision": null,
      "implementation_approval": null,
      "host_policy": "injected or explicit document path",
      "bundle": null,
      "front_page": "the brief (index.html of the bundle) for a planned item, or items/<item>.html in the Session artifact (item-hub.md)",
      "next": "the item's next step and who takes it, shown on its card",
      "post_mortem": null,
      "pr_artifact": "the PR's own artifact: its URL, or the local companion folder (from the implementer's status file)",
      "pr": null,
      "pr_head": null,
      "last_reviewed_head": "sha of the head the last full or follow-up review covered, or null",
      "checks": "green | failing | pending | null",
      "qa": "passed | failed | not run",
      "findings": null,
      "archived": null,
      "blocker": null,
      "workers": [
        {
          "role": "planner | implementer | reviewer | bug-reporter | simplify-and-refactor",
          "panel_id": null,
          "host_worker_id": null,
          "profile": "greenfield/implementer:opus",
          "status_file": "../worktrees/invoice-pdf/.agent/status.json",
          "native_session": { "harness": "claude | codex", "launch_id": "PANE_AGENT_SESSION_ID the worker reported", "id": null, "log": null },
          "started": "<ISO 8601 time>",
          "last_change": "<ISO 8601 time>",
          "last_event_id": null,
          "trace": null,
          "cost_usd": null,
          "duration_ms": null
        }
      ]
    }
  ],
  "decisions": [
    {
      "time": "<ISO 8601 time>",
      "item": "ENG-123",
      "q": "Q-3",
      "d": "D-12",
      "question": "Should the filename use the invoice id or number?",
      "answered_by": "brief | advisor | person",
      "answer": "Invoice id. Brief, Success section."
    }
  ]
}
```
