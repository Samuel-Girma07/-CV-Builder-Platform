process.env.JWT_SECRET = 'test-secret';

jest.mock('../config/db', () => ({
  query: jest.fn(),
  connect: jest.fn(),
  on: jest.fn(),
  withTransaction: jest.fn(async (work) => work({ query: jest.fn() })),
}));
jest.mock('../models/reminderQuery', () => ({
  REMINDER_STATUSES: ['pending', 'sent', 'dismissed'],
  MAX_MESSAGE_LENGTH: 500,
  create: jest.fn(),
  listForApplication: jest.fn(),
  dismiss: jest.fn(),
  getWithApplication: jest.fn(),
  markSent: jest.fn(),
  getOverduePending: jest.fn(),
}));
jest.mock('../models/applicationQuery', () => ({ findById: jest.fn(), STATUS_VALUES: ['Applied'] }));
jest.mock('../config/queue', () => ({
  QUEUES: ['email.send', 'reminder.due'],
  sendJob: jest.fn(),
  registerWorker: jest.fn(),
  scheduleJob: jest.fn(),
}));
jest.mock('../utils/email', () => ({
  sendReminderEmail: jest.fn(),
  sendDigestEmail: jest.fn(),
  isEmailConfigured: jest.fn(() => true),
}));
jest.mock('../middlewares/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  requestLogger: jest.fn(),
}));

const reminderController = require('../controllers/reminderController');
const reminderQuery = require('../models/reminderQuery');
const applicationQuery = require('../models/applicationQuery');
const queue = require('../config/queue');
const pool = require('../config/db');
const { sendReminderEmail } = require('../utils/email');
const reminderWorker = require('../workers/reminders');
const digestWorker = require('../workers/digest');

const USER = { id: 3 };
function mkRes() {
  const captured = { code: 200 };
  return {
    status(code) { captured.code = code; return this; },
    json(body) { captured.body = body; return this; },
    _: captured,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('reminder scheduling (C3)', () => {
  test('creates a reminder and schedules its pg-boss job at the requested time', async () => {
    applicationQuery.findById.mockResolvedValue({ id: 9, user_id: 3 });
    const when = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    reminderQuery.create.mockResolvedValue({ id: 44, remind_at: when });

    const res = mkRes();
    await reminderController.create(
      { params: { id: '9' }, user: USER, body: { remindAt: when.toISOString(), message: 'Nudge recruiter' } },
      res,
      jest.fn()
    );

    expect(res._.code).toBe(201);
    expect(reminderQuery.create).toHaveBeenCalledWith(3, 9, when, 'Nudge recruiter');
    // The delayed job carries only an opaque id and fires at remind time.
    expect(queue.sendJob).toHaveBeenCalledWith(
      'reminder.due',
      { reminderId: 44 },
      { sendAfter: when }
    );
  });

  test('invalid dates are rejected before any database write', async () => {
    applicationQuery.findById.mockResolvedValue({ id: 9, user_id: 3 });
    const res = mkRes();

    await reminderController.create(
      { params: { id: '9' }, user: USER, body: { remindAt: 'not-a-date' } },
      res,
      jest.fn()
    );

    expect(res._.code).toBe(400);
    expect(reminderQuery.create).not.toHaveBeenCalled();
    expect(queue.sendJob).not.toHaveBeenCalled();
  });

  test('dismissing someone else\u2019s pending reminder is a clean 404', async () => {
    reminderQuery.dismiss.mockResolvedValue(null);
    const res = mkRes();

    await reminderController.dismiss({ params: { id: '5' }, user: USER }, res, jest.fn());

    expect(res._.code).toBe(404);
  });
});

describe('reminder worker (delivery + idempotency)', () => {
  test('emails the owner and marks pending → sent exactly once', async () => {
    reminderQuery.getWithApplication.mockResolvedValue({
      id: 44,
      status: 'pending',
      user_email: 'a@b.co',
      job_title: 'Dev',
      company: 'Acme',
      message: '',
      remind_at: new Date(),
    });
    sendReminderEmail.mockResolvedValue(true);
    reminderQuery.markSent.mockResolvedValue({ id: 44 });

    await reminderWorker.handleReminderJobs({ data: { reminderId: 44 } });

    expect(sendReminderEmail).toHaveBeenCalledTimes(1);
    expect(reminderQuery.markSent).toHaveBeenCalledWith(44);
  });

  test('skips rows that are no longer pending (duplicate jobs never double-email)', async () => {
    reminderQuery.getWithApplication.mockResolvedValue({
      id: 44, status: 'sent', user_email: 'a@b.co',
    });

    await reminderWorker.handleReminderJobs({ data: { reminderId: 44 } });

    expect(sendReminderEmail).not.toHaveBeenCalled();
    expect(reminderQuery.markSent).not.toHaveBeenCalled();
  });

  test('provider failure rethrows so pg-boss retries with backoff', async () => {
    reminderQuery.getWithApplication.mockResolvedValue({
      id: 44, status: 'pending', user_email: 'a@b.co', job_title: 'x', company: 'y',
    });
    sendReminderEmail.mockRejectedValue(new Error('resend down'));

    await expect(
      reminderWorker.handleReminderJobs({ data: { reminderId: 44 } })
    ).rejects.toThrow(/resend down/i);
    expect(reminderQuery.markSent).not.toHaveBeenCalled();
  });

  test('boot recovery re-enqueues every overdue pending reminder', async () => {
    reminderQuery.getOverduePending.mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);

    await reminderWorker.recoverOverdue();

    expect(queue.sendJob).toHaveBeenCalledTimes(3);
  });
});

describe('weekly digest fan-out (C3)', () => {
  test('sends one personalized email per opted-in user and survives individual failures', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, email: 'one@x.co' }, { id: 2, email: 'two@x.co' }] })
      .mockResolvedValue({ rows: [{ applied: 2, interviewing: 1, offered: 0, rejected: 0, recent: 1 }] })
      .mockResolvedValueOnce({ rows: [{ n: 0 }] });
    sendReminderEmail.mockResolvedValue(true);
    const { sendDigestEmail } = require('../utils/email');
    sendDigestEmail
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new Error('bounce'));

    await expect(digestWorker.handleDigestTick()).resolves.toBeUndefined();

    expect(sendDigestEmail).toHaveBeenCalledTimes(2); // second failing user did not abort the first or crash
  });

  test('registers its cron schedule through pg-boss', async () => {
    await digestWorker.registerSchedule();

    expect(queue.registerWorker).toHaveBeenCalledWith('email.weekly-digest', expect.any(Function));
    expect(queue.scheduleJob).toHaveBeenCalledWith('email.weekly-digest', digestWorker.DIGEST_CRON, null);
  });
});
