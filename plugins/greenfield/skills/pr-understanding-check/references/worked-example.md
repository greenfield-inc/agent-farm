# Worked example: @mentions in staff conversations

The filled sections of a PR understanding check for a chat app's @mentions PR. The sample data in [iceberg-template.html](iceberg-template.html) is this example; open it to see the interactive page. File references are left out here and illustrative there; a real report cites the PR's own files.

**One sentence from the foundation:** The chat app already has per-user and per-chat notification settings; mentions adds a few nullable columns to them and a second push path for mention alerts.

## The iceberg

Above water (new):

- The @ picker in the composer
- Mention alerts, a second push path
- Two global toggles: mute team mentions, mute all mentions
- A per-chat level: all, mentions, or nothing
- Who was mentioned, stored with each message
- An inbox "@N" badge for unread mentions

Below water (already in production):

- Per-user notification settings: global mute-until and other user-wide choices
- Per-chat notification metadata: each person's settings and read state for each chat, sent with every chat update
- Chat participants and team rosters: already loaded in the client
- Message text and push delivery: every message's readable text and its push
- Message index by chat and send time: `(chat_id, sent_at DESC)`

## Above water: what is new

| New piece | Builds on | Evidence |
| --- | --- | --- |
| @ picker | Participants and team rosters already in the client; no new query | (omitted) |
| Global toggles | `users.mute_team_mentions`, `users.mute_all_mentions` on the existing user settings | (omitted) |
| Per-chat level | `chat_member_settings.mention_level` on the existing per-chat metadata | (omitted) |
| Who was mentioned | `messages.mentions` JSON, stored beside the readable `@Name` text | (omitted) |
| Mention alerts | Own pattern: a second push path beside ordinary message pushes | (omitted) |
| Inbox @N badge | Counted on read from messages after the user's existing seen time, through the existing message index, capped at the latest 100 per chat. Who counts follows the mention-alert recipient rules. | (omitted) |

## Decisions and trade-offs

| Decision | Alternative | Trade-off | Real-world impact |
| --- | --- | --- | --- |
| Mention alerts cross chat mutes | Chat mutes block mentions too | A muted chat can still notify you | Admins who muted busy chats now hear when someone needs them. Size it: count admins with a muted chat today. |
| Keep `@Name` text and store the picks in a separate field | Store user IDs in the text | One more column | Old clients show plain text instead of IDs |
| Compute the @N badge on read | Store an `unread_mentions` column | A bounded indexed read per inbox load and chat update, versus a column and a write per mention | No schema change, and sending writes nothing extra. Inbox load adds one query over the page's unread chats; each chat update adds one query per chat for the users connected to that server. If load runs high, the fallback is a badge with no number. |

## Hotspots

| Hotspot | What the PR does |
| --- | --- |
| Data source | The picker reads participants and team rosters the client already has. Review found the per-user chat view sent every member everyone's mention level; now only your own entry carries it. |
| Hierarchy | The per-chat level controls ordinary messages only. Mention alerts stop only for global mute-until and the two toggles. |
| Deploy and old clients | Old builds show `@Name` as plain text and ignore the `mentions` field |
| Schema and data | Four nullable columns on three tables, all additive; no backfill |
| Infra | Not touched |
| Added after the plan | The inbox @N badge, which a reviewer asked for in the pair review. It counts from the existing seen time and message index with the mention-alert recipient rules, so it adds no schema. (In another PR, this row caught a sweeper cron for stalled uploads that no plan named; review removed it.) |

## Simplify

| Opportunity | Simpler shape | Status |
| --- | --- | --- |
| Team-level mention settings | Global toggles plus the per-chat level | Done: cut during simplification |

## Quiz

1. **Is the mention level per user or per chat?** Why it matters: it decides where people find the setting and which rows the migration touches.
   Answer: "Per user." Wrong. Correct map: per chat, in `chat_member_settings.mention_level`. The per-user controls are the two global toggles.
2. **Does setting a chat to "Nothing" stop mention alerts?** Why it matters: people who think they muted a chat will still get mention alerts, and support will hear about it.
   Answer: "Yes." Wrong. Correct map: "Nothing" stops ordinary messages only. Mention alerts cross chat mutes; only global mute-until and the two toggles stop them.
3. **What do old app builds show for a mention?** Why it matters: people on older builds must see readable text, not raw IDs.
   Answer: "Plain `@Name` text." Right.

## Colors after the check

| Item | Color | Why |
| --- | --- | --- |
| Mention alerts | Red | Answered that muting a chat stops them, and after the correction was still unsure which setting wins |
| Hierarchy hotspot, "Mention alerts cross chat mutes" decision | Red | Same gap |
| Per-chat level, per-chat metadata | Yellow | Answered "per user", then explained it back correctly |
| Who was mentioned, Deploy and old clients, Keep `@Name` text | Green | Answered right without help |
| @ picker, Data source hotspot, rosters | Green | Described the data source correctly while answering another question |
| Schema and data hotspot | Yellow | Not asked directly; takes the worst color of what it touches, the per-chat level |
| Global toggles, @N badge, the other existing systems | Grey | Not asked |
| Infra | Untouched | The PR does not touch it |

## One deep dive: mention alerts (red)

**In plain words.** Normally, when someone sends a message, everyone in the chat gets a buzz. If you mute a chat, the buzzing stops. Mention alerts are a second, separate doorbell: when someone tags you by name, it rings even in a muted chat, because the sender is asking for you specifically. Only your phone-wide quiet setting or the two mention switches silence it.

**How it connects.** 1. The message is saved with its `mentions` list. 2. The ordinary push goes to members who have not muted the chat. 3. The mention alert goes to each mentioned person unless global mute-until or a mention toggle is on. Each step cites its file:line.

**Where it lives.** The mention-alert recipient check, and the ordinary push path it sits beside, each as a file:line link to the head commit.

**In this codebase.** A new path beside ordinary message pushes, with no existing pattern below it. It checks global mute-until and the two global toggles, and ignores the per-chat level on purpose.

**Trade-offs.** Chose: mention alerts cross chat mutes. Over: chat mutes block mentions too. Gain: people who muted busy chats still hear when someone needs them. Cost: a muted chat can still notify you. Who feels it: admins with muted chats; count them before release.

**What to watch.** One alert per person when they are mentioned twice in one message. Support hearing "I muted this chat and it still buzzed"; the release notes should say why.

## Before you merge

- [ ] Count admins with at least one muted chat, and decide whether the release notes need to explain mention alerts.
- [ ] Review the push path where mention alerts check global mute-until and the two toggles.
