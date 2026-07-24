# Submission Notes

## `PATCH /tasks/:id/assign` — design decisions

- **Empty/missing `assignee` → 400.** An empty string isn't a meaningful
  assignment, so it's rejected the same way `title` is rejected on create —
  consistent with the existing validation style in `validators.js`.
- **Assignee is trimmed** before being stored, so `"  Alice  "` is stored as
  `"Alice"`.
- **Re-assigning an already-assigned task is allowed.** The brief asked "what
  if the task is already assigned?" — I decided to allow overwriting rather
  than block it, since re-assigning tasks is normal workflow (someone goes on
  leave, a task gets handed off) and there's no unassign endpoint, so blocking
  reassignment would make a wrong initial assignment permanent. If this needed
  an audit trail of who a task was previously assigned to, that'd be a
  separate feature (e.g. an `assignmentHistory` array) rather than blocking
  the update.
- **Validation happens before the 404 check**, matching the existing pattern
  in `PUT /tasks/:id` (`validateCreateTask`/`validateUpdateTask` both run
  before the not-found check). Kept it consistent rather than introducing a
  new order.
- **No check that the assignee is a "real" user.** There's no user model in
  this codebase, so `assignee` is just stored as a free-text string, same
  spirit as the rest of the API.

## What I'd test next with more time

- Concurrent updates — the store isn't thread-safe in any meaningful way, but
  it'd be worth a test for what happens when two requests modify the same
  task in quick succession.
- `GET /tasks` combining `status` with `page`/`limit` — right now the route
  handler returns early on `status` and never applies pagination in that
  case. I didn't treat this as a bug since it's plausible scope-cutting, but
  I'd want to confirm the intended behavior.
- Boundary values for `limit` (e.g. `limit=0`, a very large limit, non-numeric
  `page`/`limit` values beyond what `parseInt` silently coerces).

## What surprised me

- The pagination offset bug (`page * limit`) is the kind of thing that's easy
  to write and easy to not notice, because `page=0` "accidentally" works —
  if a client always started counting from 0, they'd never notice.
- `completeTask` resetting priority looked like a copy-paste leftover from
  somewhere rather than intentional behavior — nothing else in the codebase
  couples those two fields.

## Questions I'd ask before shipping to production

- Is the in-memory store intentional for this stage, or is persistence
  (Postgres/Mongo/etc.) coming next? Affects how much I'd invest in things
  like the `PUT` immutable-field issue.
- Should `id`/`createdAt` (and `completedAt` outside of `/complete`) be
  explicitly protected from client overwrites on `PUT`, or is that out of
  scope for now?
- Is there an intended max page size / rate limiting, given `GET /tasks`
  with no params returns the entire in-memory dataset unpaginated?
