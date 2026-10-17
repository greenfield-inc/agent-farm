# Ledger

Use host durable state when available; otherwise `.agent/ledger.json`. Keep one entry per work item (one feature: one worktree, branch, host workspace and PR), with one `workers` entry per worker session in it. Host IDs are opaque and separate from `status_file`; record associations only as the host reports them.

```json
{
  "caps": { "concurrent": 3, "spend_usd": null },
  "session": { "name": "<host Session name>", "id": null, "watch": "the host event wait to re-arm after each event", "canonical_destination": null, "map": null, "stubs": [] },
  "review_policy": { "mode": "per control flow", "set_by": "plan", "time": null },
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
      "control_flow": { "file": "/abs/bundle/control-flow.json", "revision": 2, "approved_by": "D-6" },
      "control_flow_step": "qa",
      "archived": null,
      "blocker": null,
      "workers": [
        {
          "role": "planner | designer | implementer | reviewer | investigator | teacher",
          "worktree": "/abs/worktrees/invoice-pdf",
          "brief": "/abs/session/briefs/invoice-pdf-implementer.md",
          "host_worker_id": null,
          "profile": "bigbrain/implementer:opus",
          "status_file": "/abs/worktrees/invoice-pdf/.agent/status/implementer.json",
          "open_questions": ["Q-7"],
          "native_session": { "harness": "claude | codex", "launch_id": "the launch ID the worker reported", "id": null, "log": null },
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
      "answered_by": "approved source | person",
      "q": "Q-7",
      "d": "D-12",
      "answer": "Invoice id. Brief, Success section."
    }
  ]
}
```

Record what the host returns at each launch: the workspace in the item's `host_workspace_id` (and its `worktree`), and the worker, worktree, status file and brief in the worker's `host_worker_id`, `worktree`, `status_file` and `brief`. Keep the host Session and its event wait once in `session` (`id`, and `watch` for the wait to re-arm after each event).

Bigbrain adds `control_flow` and `control_flow_step` (the step the implementer last reported) per item, `open_questions` (unanswered Q-n) per worker, and the Q-n and D-n of every relayed decision. Update `control_flow_step` and `open_questions` on every report.
