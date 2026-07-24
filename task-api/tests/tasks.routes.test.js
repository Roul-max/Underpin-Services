const request = require('supertest');
const app = require('../src/app');
const taskService = require('../src/services/taskService');

beforeEach(() => {
  taskService._reset();
});

describe('POST /tasks', () => {
  it('creates a task and returns 201', async () => {
    const res = await request(app).post('/tasks').send({ title: 'Write tests' });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Write tests');
    expect(res.body.status).toBe('todo');
  });

  it('rejects a missing title with 400', async () => {
    const res = await request(app).post('/tasks').send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/title/i);
  });

  it('rejects an invalid priority with 400', async () => {
    const res = await request(app).post('/tasks').send({ title: 'A', priority: 'urgent' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/priority/i);
  });

  it('rejects an invalid dueDate with 400', async () => {
    const res = await request(app).post('/tasks').send({ title: 'A', dueDate: 'not-a-date' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/dueDate/i);
  });
});

describe('GET /tasks', () => {
  it('returns an empty array when there are no tasks', async () => {
    const res = await request(app).get('/tasks');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns all tasks', async () => {
    await request(app).post('/tasks').send({ title: 'A' });
    await request(app).post('/tasks').send({ title: 'B' });

    const res = await request(app).get('/tasks');
    expect(res.body).toHaveLength(2);
  });

  it('filters by status', async () => {
    await request(app).post('/tasks').send({ title: 'A', status: 'todo' });
    await request(app).post('/tasks').send({ title: 'B', status: 'done' });

    const res = await request(app).get('/tasks?status=done');
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('B');
  });

  it('an unknown status filter returns an empty array, not an error', async () => {
    await request(app).post('/tasks').send({ title: 'A' });

    const res = await request(app).get('/tasks?status=archived');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  // KNOWN BUG (see BUGS.md #2): page=1 currently skips the first `limit`
  // results because of the offset off-by-one in getPaginated. This test
  // encodes the *correct* expected behavior and will fail until fixed.
  it('paginates results, with page 1 returning the first `limit` tasks', async () => {
    for (let i = 1; i <= 3; i++) {
      await request(app).post('/tasks').send({ title: `Task ${i}` });
    }

    const res = await request(app).get('/tasks?page=1&limit=2');
    expect(res.body.map((t) => t.title)).toEqual(['Task 1', 'Task 2']);
  });
});

describe('GET /tasks/stats', () => {
  it('returns counts by status and an overdue count', async () => {
    await request(app).post('/tasks').send({ title: 'A', status: 'todo' });
    await request(app).post('/tasks').send({ title: 'B', status: 'done' });

    const res = await request(app).get('/tasks/stats');

    expect(res.status).toBe(200);
    expect(res.body.todo).toBe(1);
    expect(res.body.done).toBe(1);
    expect(res.body.overdue).toBe(0);
  });
});

describe('PUT /tasks/:id', () => {
  it('updates an existing task', async () => {
    const created = await request(app).post('/tasks').send({ title: 'Original' });

    const res = await request(app).put(`/tasks/${created.body.id}`).send({ title: 'Updated' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated');
  });

  it('returns 404 for a task that does not exist', async () => {
    const res = await request(app).put('/tasks/does-not-exist').send({ title: 'Updated' });
    expect(res.status).toBe(404);
  });

  it('rejects an empty title with 400', async () => {
    const created = await request(app).post('/tasks').send({ title: 'Original' });

    const res = await request(app).put(`/tasks/${created.body.id}`).send({ title: '   ' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /tasks/:id', () => {
  it('deletes an existing task and returns 204', async () => {
    const created = await request(app).post('/tasks').send({ title: 'A' });

    const res = await request(app).delete(`/tasks/${created.body.id}`);
    expect(res.status).toBe(204);

    const getAll = await request(app).get('/tasks');
    expect(getAll.body).toHaveLength(0);
  });

  it('returns 404 for a task that does not exist', async () => {
    const res = await request(app).delete('/tasks/does-not-exist');
    expect(res.status).toBe(404);
  });
});

describe('PATCH /tasks/:id/complete', () => {
  it('marks a task complete', async () => {
    const created = await request(app).post('/tasks').send({ title: 'A' });

    const res = await request(app).patch(`/tasks/${created.body.id}/complete`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('done');
    expect(res.body.completedAt).not.toBeNull();
  });

  it('returns 404 for a task that does not exist', async () => {
    const res = await request(app).patch('/tasks/does-not-exist/complete');
    expect(res.status).toBe(404);
  });

  it('does not reset priority when completing (regression test for fixed bug)', async () => {
    const created = await request(app).post('/tasks').send({ title: 'A', priority: 'high' });

    const res = await request(app).patch(`/tasks/${created.body.id}/complete`);
    expect(res.body.priority).toBe('high');
  });
});

describe('PATCH /tasks/:id/assign', () => {
  it('assigns a task to a user and returns the updated task', async () => {
    const created = await request(app).post('/tasks').send({ title: 'A' });

    const res = await request(app)
      .patch(`/tasks/${created.body.id}/assign`)
      .send({ assignee: 'Alice' });

    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe('Alice');
  });

  it('returns 404 for a task that does not exist', async () => {
    const res = await request(app).patch('/tasks/does-not-exist/assign').send({ assignee: 'Alice' });
    expect(res.status).toBe(404);
  });

  it('rejects a missing assignee with 400', async () => {
    const created = await request(app).post('/tasks').send({ title: 'A' });

    const res = await request(app).patch(`/tasks/${created.body.id}/assign`).send({});
    expect(res.status).toBe(400);
  });

  it('rejects an empty string assignee with 400', async () => {
    const created = await request(app).post('/tasks').send({ title: 'A' });

    const res = await request(app)
      .patch(`/tasks/${created.body.id}/assign`)
      .send({ assignee: '   ' });
    expect(res.status).toBe(400);
  });

  it('allows re-assigning a task that already has an assignee', async () => {
    const created = await request(app).post('/tasks').send({ title: 'A' });
    await request(app).patch(`/tasks/${created.body.id}/assign`).send({ assignee: 'Alice' });

    const res = await request(app)
      .patch(`/tasks/${created.body.id}/assign`)
      .send({ assignee: 'Bob' });

    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe('Bob');
  });
});
