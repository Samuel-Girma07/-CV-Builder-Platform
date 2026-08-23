process.env.JWT_SECRET = 'test-secret';

jest.mock('../middlewares/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  requestLogger: jest.fn(),
}));

const { streamCvPdf } = require('../services/cvPdf');

function collectPdf() {
  const chunks = [];
  return {
    setHeader() {},
    headersSent: false,
    on() {},
    once() {},
    emit() {},
    write(chunk) { chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); return true; },
    end() { this.finished = true; },
    finished: false,
    buffer: () => Buffer.concat(chunks),
  };
}

const BASE_PROFILE = {
  personalInfo: {
    fullName: 'Jane Carter',
    email: 'jane@x.co',
    summary: 'Engineer with a track record of shipping.',
    location: 'Berlin',
  },
  skills: ['JavaScript'],
  experience: [{ title: 'Dev', company: 'Acme', startDate: '2020', endDate: '2024', description: 'Built things.' }],
};

describe('unicode PDF rendering (deferred item)', () => {
  test('pure-Latin CVs keep core Helvetica (no embedded Noto subset)', async () => {
    const res = collectPdf();
    streamCvPdf({ res, profile: BASE_PROFILE, user: {}, template: 'modern', download: true });
    await new Promise((r) => setImmediate(r));

    const pdf = res.buffer();
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.toString('latin1')).toMatch(/Helvetica/);
    expect(pdf.toString('latin1')).not.toMatch(/NotoSans/);
  });

  test('CJK characters switch the document to the embedded NotoSans subset', async () => {
    const profile = JSON.parse(JSON.stringify(BASE_PROFILE));
    profile.personalInfo.fullName = '李小龍';
    profile.experience[0].description = 'Built systems · 成功しました';

    const res = collectPdf();
    streamCvPdf({ res, profile, user: {}, template: 'classic', download: true });
    await new Promise((r) => setImmediate(r));

    const pdf = res.buffer();
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const latin1 = pdf.toString('latin1');
    expect(latin1).toMatch(/NotoSans-Bold|NotoSans\+?[A-Za-z-]*/);
    // The core fonts must be gone when we swapped stacks.
    expect(latin1).not.toMatch(/\/BaseFont \/[A-Z]{6}\+Helvetica/);
  });

  test('Arabic + emoji-laden text renders without throwing', async () => {
    const profile = JSON.parse(JSON.stringify(BASE_PROFILE));
    profile.personalInfo.fullName = 'أحمد';
    profile.personalInfo.summary = 'Passionate engineer 🚀 who ships.';

    const res = collectPdf();
    expect(() =>
      streamCvPdf({ res, profile, user: {}, template: 'bold', download: true })
    ).not.toThrow();
    await new Promise((r) => setImmediate(r));
    expect(res.buffer().subarray(0, 5).toString()).toBe('%PDF-');
  });
});
