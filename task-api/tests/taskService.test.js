const taskService = require('../src/services/taskService');

beforeEach(() => {
  taskService._reset();
});

describe('create', () => {
  it('creates a task with defaults applied', () => {
    const task = taskService.create({ title: 'Write tests' });

    expect(task.title).toBe('Write tests');
    expect(task.description).toBe('');
    expect(task.status).toBe('todo');
    expect(task.priority).toBe('medium');
    expect(task.dueDate).toBeNull();
    expect(task.completedAt).toBeNull();
    expect(task.id).toBeDefined();
    expect(task.createdAt).toBeDefined();
  });

  it('respects fields explicitly passed in', () => {
    const task = taskService.create({
      title: 'Ship feature',
      description: 'do the thing',
      status: 'in_progress',
      priority: 'high',
      dueDate: '2026-08-01T00:00:00.000Z',
    });

    expect(task.status).toBe('in_progress');
    expect(task.priority).toBe('high');
    expect(task.dueDate).toBe('2026-08-01T00:00:00.000Z');
  });
});

describe('findById / getAll', () => {
  it('returns undefined for an id that does not exist', () => {
    expect(taskService.findById('nope')).toBeUndefined();
  });

  it('getAll returns a copy, not the live internal array', () => {
    taskService.create({ title: 'A' });
    const list = taskService.getAll();
    list.push({ id: 'fake' });

    expect(taskService.getAll()).toHaveLength(1); // mutating the returned array shouldn't affect the store
  });
});

describe('getByStatus', () => {
  it('returns only tasks with an exact status match', () => {
    taskService.create({ title: 'A', status: 'todo' });
    taskService.create({ title: 'B', status: 'done' });

    const result = taskService.getByStatus('todo');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('A');
  });

  // KNOWN BUG (see BUGS.md #1): getByStatus uses String.includes() instead of
  // an exact match, so a status query that is a substring of a real status
  // incorrectly matches it. This test documents the bug and will fail until
  // taskService.js is fixed to use `t.status === status`.
  it('does not match a status value that is only a substring of a real status', () => {
    taskService.create({ title: 'A', status: 'todo' });
    taskService.create({ title: 'B', status: 'done' });

    const result = taskService.getByStatus('do'); // substring of both 'todo' and 'done'
    expect(result).toHaveLength(0);
  });
});

describe('getPaginated', () => {
  beforeEach(() => {
    for (let i = 1; i <= 5; i++) {
      taskService.create({ title: `Task ${i}` });
    }
  });

  // KNOWN BUG (see BUGS.md #2): getPaginated computes `offset = page * limit`
  // instead of `(page - 1) * limit`, so page=1 skips the first `limit` items.
  // This test documents the expected (correct) behavior and will fail until fixed.
  it('page 1 returns the first `limit` items', () => {
    const result = taskService.getPaginated(1, 2);
    expect(result.map((t) => t.title)).toEqual(['Task 1', 'Task 2']);
  });

  it('page 2 returns the next `limit` items', () => {
    const result = taskService.getPaginated(2, 2);
    expect(result.map((t) => t.title)).toEqual(['Task 3', 'Task 4']);
  });

  it('a page past the end returns an empty array', () => {
    const result = taskService.getPaginated(10, 2);
    expect(result).toEqual([]);
  });
});

describe('getStats', () => {
  it('counts tasks by status and overdue tasks', () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    const future = new Date(Date.now() + 86400000).toISOString();

    taskService.create({ title: 'A', status: 'todo', dueDate: past });
    taskService.create({ title: 'B', status: 'in_progress', dueDate: past });
    taskService.create({ title: 'C', status: 'done', dueDate: past }); // done + overdue shouldn't count as overdue
    taskService.create({ title: 'D', status: 'todo', dueDate: future });

    const stats = taskService.getStats();

    expect(stats.todo).toBe(2);
    expect(stats.in_progress).toBe(1);
    expect(stats.done).toBe(1);
    expect(stats.overdue).toBe(2); // A and B, not C (done) or D (future)
  });

  it('a task with no dueDate is never overdue', () => {
    taskService.create({ title: 'A', status: 'todo', dueDate: null });
    expect(taskService.getStats().overdue).toBe(0);
  });
});

describe('update', () => {
  it('returns null when the task does not exist', () => {
    expect(taskService.update('nope', { title: 'x' })).toBeNull();
  });

  it('merges the given fields into the existing task', () => {
    const task = taskService.create({ title: 'Original' });
    const updated = taskService.update(task.id, { title: 'Updated', priority: 'high' });

    expect(updated.title).toBe('Updated');
    expect(updated.priority).toBe('high');
    expect(updated.id).toBe(task.id); // unrelated fields untouched
  });
});

describe('remove', () => {
  it('returns false when the task does not exist', () => {
    expect(taskService.remove('nope')).toBe(false);
  });

  it('removes an existing task and returns true', () => {
    const task = taskService.create({ title: 'A' });
    expect(taskService.remove(task.id)).toBe(true);
    expect(taskService.findById(task.id)).toBeUndefined();
  });
});

describe('completeTask', () => {
  it('returns null when the task does not exist', () => {
    expect(taskService.completeTask('nope')).toBeNull();
  });

  it('sets status to done and stamps completedAt', () => {
    const task = taskService.create({ title: 'A' });
    const completed = taskService.completeTask(task.id);

    expect(completed.status).toBe('done');
    expect(completed.completedAt).not.toBeNull();
  });

  // This is the bug we fixed (see BUGS.md #3): completing a task used to
  // silently reset priority to 'medium'. Now it should be left untouched.
  it('does not change the task priority', () => {
    const task = taskService.create({ title: 'A', priority: 'high' });
    const completed = taskService.completeTask(task.id);

    expect(completed.priority).toBe('high');
  });
});

describe('assignTask', () => {
  it('returns null when the task does not exist', () => {
    expect(taskService.assignTask('nope', 'Alice')).toBeNull();
  });

  it('sets the assignee on the task and returns it', () => {
    const task = taskService.create({ title: 'A' });
    const assigned = taskService.assignTask(task.id, 'Alice');

    expect(assigned.assignee).toBe('Alice');
  });

  it('allows re-assigning a task that already has an assignee', () => {
    const task = taskService.create({ title: 'A' });
    taskService.assignTask(task.id, 'Alice');
    const reassigned = taskService.assignTask(task.id, 'Bob');

    expect(reassigned.assignee).toBe('Bob');
  });
});
