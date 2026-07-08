const { detectCv, analyzePdfBuffer } = require('../utils/atsXray');

describe('detectCv', () => {
  test('accepts a real résumé (sections + contact details)', () => {
    const text = `John Doe  john.doe@example.com  +1 555 123 4567
      Professional Experience
      Software Engineer, Acme Corp 2020 - 2023
      Education
      BSc Computer Science
      Skills: JavaScript, Node.js, PostgreSQL`;
    const result = detectCv(text);
    expect(result.isCv).toBe(true);
  });

  test('rejects a non-CV essay with only generic words and no contact info', () => {
    const text = `What is parallel processing? Introduction.
      References and further reading. Programming languages overview. Conclusion.`;
    const result = detectCv(text);
    expect(result.isCv).toBe(false);
    expect(result.missing).toContain('contact details (email or phone)');
  });

  test('accepts a CV via the strong-sections + dates fallback even without contact text', () => {
    const text = `Work Experience 2019 - 2021
      Education 2015 - 2019
      Projects and achievements`;
    const result = detectCv(text);
    expect(result.strongSections.length).toBeGreaterThanOrEqual(2);
    expect(result.isCv).toBe(true);
  });

  test('rejects empty input and reports what is missing', () => {
    const result = detectCv('');
    expect(result.isCv).toBe(false);
    expect(result.missing.length).toBeGreaterThan(0);
  });

  test('a phone number alone counts as contact details', () => {
    const text = `Jane Roe  (555) 987-6543
      Experience: Analyst 2018-2022
      Education: BA Economics`;
    const result = detectCv(text);
    expect(result.isCv).toBe(true);
  });
});

describe('analyzePdfBuffer', () => {
  test('degrades gracefully on a buffer that is not a valid PDF', async () => {
    const report = await analyzePdfBuffer(Buffer.from('this is definitely not a pdf'));
    expect(report.isCv).toBe(false);
    expect(report.risks).toContain('Unreadable PDF');
    expect(Array.isArray(report.stream)).toBe(true);
    expect(report.stream).toHaveLength(0);
  });
});
