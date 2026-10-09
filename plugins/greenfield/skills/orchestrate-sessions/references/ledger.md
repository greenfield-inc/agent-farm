# Ledger

Use host durable state when available; otherwise `.agent/ledger.json`. Keep one entry per work item (one feature: one worktree, branch, Pane and PR), with one `workers` entry per worker session in it. Host IDs are opaque and separate from `status_file`; record associations only as the host reports them.

```json
{
  "caps": { "concurrent": 3, "spend_usd": null },
  "session": { "name": "<host Session name>", "id": null, "canonical_destination": null, "map": null, "stubs": [] },
  "review_policy": { "mode": "end of workstream", "set_by": "default", "time": null },
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
      "source_revision": null,
      "implementation_approval": null,
      "host_policy": "injected or explicit document path",
      "bundle": null,
      "post_mortem": null,
      "pr": null,
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
      "question": "Should the filename use the invoice id or number?",
      "answered_by": "brief | advisor | person",
      "answer": "Invoice id. Brief, Success section."
    }
  ]
}
```
