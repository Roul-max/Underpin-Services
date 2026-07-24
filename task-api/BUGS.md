# Bug Report

## 1. `getByStatus` matches on substring, not exact status (`src/services/taskService.js`)

```js
const getByStatus = (status) => tasks.filter((t) => t.status.includes(status));
```

**Expected:** `GET /tasks?status=X` should return only tasks whose status is *exactly* `X`.

**Actual:** `String.prototype.includes` checks for a substring match, not equality.
Any query value that happens to be a substring of a real status will match tasks
it shouldn't. For example `?status=o` matches both `todo` and `done`. It doesn't
currently cause visible problems with the three real status values because none
of them is a substring of another, but it's the wrong operator for the job and
will break the moment a new status is added (e.g. `todo` vs a hypothetical
`redo`), or if a client passes an unexpected value.

**How I found it:** Wrote a test (`taskService.test.js`, `getByStatus` block)
asserting that a substring like `'do'` should return zero tasks. It fails
against the current code.

**Fix:** use exact equality: `tasks.filter((t) => t.status === status)`.

---

## 2. `getPaginated` off-by-one in offset calculation (`src/services/taskService.js`)

```js
const offset = page * limit;
```

**Expected:** page numbers are 1-indexed for the caller, so `page=1` should
return the first `limit` items (offset 0), `page=2` the next batch, etc.

**Actual:** the offset is computed as `page * limit` instead of
`(page - 1) * limit`. So `page=1, limit=10` returns items 10-19 (skipping the
actual first page), and `page=0` (not a valid page number) accidentally
returns what should be page 1.

**How I found it:** Wrote both a unit test and an integration test asserting
`page=1` returns the first N tasks by creation order. Both fail against the
current code — the first two tasks are silently dropped.

**Fix:** `const offset = (page - 1) * limit;`, and probably also clamp `page`
to a minimum of 1 so `page=0` or negative values don't produce a negative
offset.

---

## 3. `completeTask` silently resets priority to `'medium'` (`src/services/taskService.js`) — FIXED

```js
const updated = {
  ...task,
  priority: 'medium',   // <- unrelated to completing a task
  status: 'done',
  completedAt: new Date().toISOString(),
};
```

**Expected:** marking a task complete should only change `status` and
`completedAt`. Priority is unrelated to completion state.

**Actual:** every task's priority was being overwritten to `'medium'` the
moment it was completed, even if it had been `high`.

**How I found it:** Wrote a test completing a `high`-priority task and
asserting its priority afterward. It failed against the original code.

**Fix applied:** removed the `priority: 'medium'` line so `completeTask` only
updates `status` and `completedAt`. Test now passes (see `completeTask` /
regression test in both test files).

---

## 4. `PUT /tasks/:id` doesn't protect immutable fields (`src/routes/tasks.js`, `src/services/taskService.js`)

**Expected:** `id` and `createdAt` shouldn't be changeable by a client.

**Actual:** `update()` does `{ ...tasks[index], ...fields }` with no
filtering, and `validateUpdateTask` doesn't reject `id`/`createdAt` in the
body. A `PUT` request that includes those fields will overwrite them.

**How I found it:** reading the code — didn't write a test for this one since
it wasn't asked to be fixed, but it's worth flagging before shipping.

**Suggested fix:** strip `id`, `createdAt` (and arguably `completedAt`, which
should only change via `/complete`) from the incoming body before merging in
`update()`.

---

## Not fixed

Per the assignment, I fixed #3 and left #1, #2, and #4 as documented bugs with
failing/would-fail tests and a described fix, so it's clear what's wrong and
how I'd resolve it with more time.
