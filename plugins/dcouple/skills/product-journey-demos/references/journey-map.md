# The journey map

`<project>/journeys.html` is the source of truth for what each demo shows:
plain HTML that people read and the tools parse, so keep the markers exact.
`assets/harness/selftest/journeys.html` is a two-journey example.

```html
<title>Acme</title>                      <!-- titles the gallery and report -->
<section id="j6" class="journey"><h2>6. Reply to a customer</h2>
<span class="chip role role-all">Everyone</span> <span class="chip">seen in code</span>
<!-- SLOT-J6 -->
<p><b>Goal:</b> ...</p>
<ol><li>Start on the Inbox.</li> ... </ol>
<p><b>Success:</b> ...</p> <p><b>Where it goes wrong:</b> ...</p> <p><b>Branches:</b> ...</p>
<ul><li><b>Gap:</b> no saved replies in one-to-one chats.</li></ul>
<p><small>Evidence: src/screens/Inbox/Reply.tsx</small></p>
<!-- /SLOT-J6 -->
</section>
```

- `report.py` inserts the `<!-- DEMO-JN -->` figure right after the `<h2>`.
- Agents edit only inside their own `SLOT` markers, so many can work at once.
- File names come from `N`: `jNN.mjs`, `jNN-slug.webp`, `audit/jNN.json`
  (two digits up to 99, then three).

## Audience chips

The first chip says who can do the journey; the gallery and report show it.

| Class | Typical label | Meaning |
| --- | --- | --- |
| `role-all` | Everyone | Any signed-in user |
| `role-admin` | Admin only | Org settings, billing, members |
| `role-mixed` | Admin + users | Anyone does part; an admin does the rest |
| `role-ext` | Customer, Visitor | Someone outside the org, or signed out |

Add "(assumed)" when the gating is unconfirmed in code. Other chips:
`seen in code`, `assumed`, and descriptive ones such as `Frequency: daily`.

## Mapping the journeys

1. List the surfaces from the code: routes, navigation, settings, dialogs,
   emails and notifications, public pages, customer-facing views.
2. Draft the common journeys in users' words, ranked by how often they
   happen (a judgement call; say so).
3. Sweep for gaps, once for everyday users and once for admins: what would a
   user of a comparable product expect? Record each as a Gap bullet on the
   journey where it hurts.
4. Tag each journey's audience from the code's permission checks, and mark it
   `seen in code` or `assumed`.
5. Group into tiers: core, less frequent, everyday flows, admin flows, and
   end-to-end journeys that chain several tasks (8-14 steps).

After recording, the doc-sync round rewrites each Steps list to match what
the recording proved.
