process.env.JWT_SECRET = 'x'.repeat(64);

jest.mock('../middlewares/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  requestLogger: jest.fn(),
}));

globalThis.__bossInstances = [];

jest.mock('pg-boss', () => {
  return class FakeBoss {
    constructor(opts) {
      this.opts = opts;
      this.started = false;
      this.stopCount = 0;
      this.createdQueues = [];
      this.sent = [];
      this.scheduled = [];
      this.workers = [];
      this.errorHandler = null;
      globalThis.__bossInstances.push(this);
    }
    on(event, fn) {
      if (event === 'error') this.errorHandler = fn;
    }
    async start() {
      if (this.failStart) throw new Error('connection refused');
      this.started = true;
      return 'ok';
    }
    async createQueue(name) {
      if (this.createdQueues.includes(name)) {
        throw new Error(`Queue ${name} already exists`);
      }
      this.createdQueues.push(name);
    }
    async send(queue, data, options) {
      this.sent.push([queue, data, options]);
      return `job-${this.sent.length}`;
    }
    async schedule(queue, cron, data) {
      this.scheduled.push([queue, cron, data]);
      return `sched-${this.scheduled.length}`;
    }
    async work(queue, options, handler) {
      this.workers.push([queue, handler]);
      return { stop: () => {} };
    }
    async stop() {
      this.stopCount += 1;
    }
  };
});

const ORIGINAL_DB = process.env.DATABASE_URL;
const ORIGINAL_STRICT = process.env.PGSSLSTRICT;

const queue = require('../config/queue');

afterEach(async () => {
  await queue.stopQueue();
  globalThis.__bossInstances.length = 0;
  if (ORIGINAL_DB === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = ORIGINAL_DB;
  if (ORIGINAL_STRICT === undefined) delete process.env.PGSSLSTRICT; else process.env.PGSSLSTRICT = ORIGINAL_STRICT;
});

describe('pg-boss queue lifecycle', () => {
  test('starts against localhost with SSL disabled and creates every owned queue', async () => {
    process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/app';

    await queue.startQueue();

    expect(globalThis.__bossInstances).toHaveLength(1);
    const boss = globalThis.__bossInstances[0];
    expect(boss.started).toBe(true);
    expect(boss.opts.ssl).toBe(false);
    expect(boss.createdQueues.sort()).toEqual([...queue.QUEUES].sort());
  });

  test('remote hosts default to encrypted-unvalidated TLS; PGSSLSTRICT=true forces verification', async () => {
    process.env.DATABASE_URL = 'postgresql://u:p@db.example.com:5432/app';

    await queue.startQueue();
    expect(globalThis.__bossInstances[0].opts.ssl).toEqual({ rejectUnauthorized: false });
    await queue.stopQueue();

    process.env.PGSSLSTRICT = 'true';
    await queue.startQueue();
    expect(globalThis.__bossInstances[1].opts.ssl).toEqual({ rejectUnauthorized: true });
    await queue.stopQueue();

    process.env.PGSSLSTRICT = 'false';
    await queue.startQueue();
    expect(globalThis.__bossInstances[2].opts.ssl).toEqual({ rejectUnauthorized: false });
  });

  test('start is idempotent — a second call reuses the running instance', async () => {
    process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/app';

    const first = await queue.startQueue();
    const second = await queue.startQueue();

    expect(second).toBe(first);
    expect(globalThis.__bossInstances).toHaveLength(1);
  });

  test('sendJob/scheduleJob/registerWorker delegate once started, and stop cleanly', async () => {
    process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/app';
    await queue.startQueue();

    const jobId = await queue.sendJob('email.send', { to: 'a@b.co' }, { priority: 1 });
    expect(jobId).toBe('job-1');

    await queue.scheduleJob('reminder.due', '0 9 * * 1', { digest: true });
    await queue.registerWorker('email.send', async () => {});

    const boss = globalThis.__bossInstances[0];
    expect(boss.sent[0]).toEqual(['email.send', { to: 'a@b.co' }, { priority: 1 }]);
    expect(boss.scheduled[0][1]).toBe('0 9 * * 1');
    expect(boss.workers).toHaveLength(1);

    await queue.stopQueue();
    expect(boss.stopCount).toBe(1);
  });

  test('jobs are dropped loudly when the queue never started', async () => {
    const result = await queue.sendJob('email.send', { to: 'a@b.co' });
    expect(result).toBeNull();

    await expect(queue.registerWorker('email.send', async () => {})).rejects.toThrow(/not running/i);
    expect(await queue.scheduleJob('reminder.due', '0 9 * * 1')).toBeNull();
  });

  test('stopQueue without start is a harmless no-op', async () => {
    await expect(queue.stopQueue()).resolves.toBeUndefined();
  });
});
