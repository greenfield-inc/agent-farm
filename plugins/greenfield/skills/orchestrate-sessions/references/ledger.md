# Ledger

Use host durable state when available; otherwise `.agent/ledger.json`. Keep one entry per worker session, grouped by work item. Host IDs are opaque and separate from `status_file`; record associations only as the host reports them.

```json
{
  "caps": { "concurrent": 3, "spend_usd": null },
  "session": { "name": "<host Session name>", "id": null, "canonical_destination": null, "map": null, "stubs": [] },
  "review_policy": { "mode": "end of workstream", "set_by": "default", "time": null },
  "items": [
    {
      "id": "ENG-123",
      "repo": "/absolute/repo",
      "role": "planner | implementer | reviewer | bug-reporter",
      "depends_on": [],
      "destination": "named destination, or null for a local bundle",
      "source": "/absolute/bundle/cover-sheet.html",
      "urgency": "normal",
      "worktree": "../worktrees/invoice-pdf",
      "branch": "invoice-pdf",
      "profile": "greenfield/implementer",
      "status_file": "../worktrees/invoice-pdf/.agent/status.json",
      "stage": "queued | running | blocked | in review | pr open | done | failed | needs planning",
      "started": "<ISO 8601 time>",
      "last_change": "<ISO 8601 time>",
      "host_workspace_id": null,
      "pane_id": null,
      "native_session": { "harness": "claude | codex", "id": null, "log": null },
      "host_worker_id": null,
      "owning_session_id": null,
      "last_event_id": null,
      "phase": "planning | awaiting approval | implementing | in review | complete",
      "source_revision": null,
      "implementation_approval": null,
      "host_policy": "injected or explicit document path",
      "bundle": null,
      "post_mortem": null,
      "trace": null,
      "cost_usd": null,
      "duration_ms": null,
      "pr": null,
      "findings": null,
      "archived": null,
      "blocker": null
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
