# Code smell lenses

One section per lens. Each lists what to flag and what to skip. The repository's own majority pattern wins over any example here. Skip generated, vendored and third-party code in every lens.

## 1. Misleading names

Flag: a function, variable, type or file whose name says something its body does not do: `getUser` that also writes, `isValid` that throws, `cache` that never caches, a `list` that returns one item.
Skip: names that are merely short or generic but not false.

## 2. Stale names

Flag: names, routes, flags, file paths or log tags that refer to a feature, vendor, product name or model that was renamed or removed (check `git log -S` on the old name).
Skip: names kept on purpose for compatibility, where a comment or alias says so.

## 3. Synonym drift

Flag: one concept under several names across the codebase (`account` / `org` / `workspace` for the same row, `userId` / `uid` / `ownerId` for the same value). Name the majority term as the fix.
Skip: terms that mean different things in different layers by design.

## 4. Homonyms

Flag: one name with two meanings (`session` for both an auth session and a chat thread, `status` for an HTTP code in one place and a job state in another).
Skip: the same name in unrelated modules that never meet.

## 5. Wire keys across backend and clients

Flag: a request or response field, event name, or query parameter spelled or cased differently between the server and a client, or a field one side sends that the other never reads.
Skip: deliberate translation layers that map one name to another in one place. Bucket: `contract` unless both sides live in this repository and ship together.

## 6. Storage names vs code

Flag: DB columns, tables, indexes, collection names, cache keys or file paths whose names disagree with the code model that reads them, or that the code no longer uses.
Skip: names a migration is already renaming. Bucket: `contract`.

## 7. Config and env vars

Flag: misspelled or doubled env var names (`API_URL` and `API_BASE_URL` for one value), variables read but never documented or set, set but never read, and defaults that differ between readers.
Skip: variables owned by a third-party tool. Bucket: `contract` for renames.

## 8. Enums and magic values

Flag: bare strings and numbers repeated across files where an enum or constant exists, enum members nobody uses, and switch statements that miss members.
Skip: one-off literals with an obvious meaning (`0`, `1`, `""`).

## 9. Copy-paste divergence

Flag: near-duplicate blocks where one copy got a fix the other did not, or where the copies disagree in a way that looks accidental.
Skip: duplication that is identical and small; that is a simplification, not a smell.

## 10. Dead and half-dead code

Flag: unexported or unreferenced functions and files, flags that are always on or always off, branches behind a permanent flag, TODOs and FIXMEs whose work is done, and commented-out code.
Skip: public API used outside the repository, and code a test or script still exercises on purpose.

## 11. Comments and docs that contradict the code

Flag: comments, docstrings, READMEs and AGENTS.md lines that state behavior, defaults, arguments or return values the code does not have.
Skip: comments that are vague but not false.

## 12. Units and types

Flag: mixed seconds and milliseconds, cents and dollars, local time and UTC, `null` vs empty string vs missing used for the same state, inverted booleans (`disabled` passed where `enabled` is meant), and `any` or casts that hide a mismatch.
Skip: conversions done once at a boundary with the unit in the name.

## 13. Convention breaks

Flag: code that breaks the majority pattern of its layer: error handling, data access, file layout, naming case, import style, test structure. Cite the majority example.
Skip: layers with no clear majority.

## 14. Error shapes and error text

Flag: endpoints or functions in one layer returning errors in different shapes, swallowed errors, error text shown to users that is wrong, leaks internals, or differs for the same failure.
Skip: internal log messages.

## 15. Misleading tests

Flag: tests whose name promises a behavior the assertions do not check, tautological tests that recompute the expected value the way the code does, tests that pass with the code deleted, and skipped tests left for good.
Skip: tests that are slow or verbose but honest.

## 16. God files and functions

Flag: files or functions that hold several unrelated jobs, where a reader must hold the whole thing to change one part. Name the seams to split along.
Skip: long files that do one job, such as a table of routes or a schema.

## 17. Boolean and positional arguments

Flag: calls like `send(user, true, false, 3)` where a reader cannot tell what the arguments mean, and boolean flags that switch a function between two different jobs.
Skip: one obvious boolean (`setVisible(true)`).

## 18. Layer violations

Flag: code that reaches across the repository's layers: UI calling the database, routes holding business rules the service layer owns, a shared package importing an app.
Skip: repositories with no layering to violate.

## 19. Concurrency smells

Flag: shared mutable maps without locking, goroutines or tasks without a context or cancel path, effects and subscriptions without cleanup, timers never cleared, unawaited promises, and check-then-act races.
Skip: single-threaded scripts. Bucket: `bug` when the race is reachable.

## 20. Duplicate dependencies

Flag: two dependencies doing one job (two date libraries, two HTTP clients, two schema validators), and helpers that reimplement an installed dependency.
Skip: a migration in progress that an open PR or issue tracks.
