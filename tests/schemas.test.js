const {
  normalizeTailoredProfile,
  normalizePrepGuide,
  sanitizeText,
} = require('../utils/schemas');

describe('sanitizeText', () => {
  test('strips PostgreSQL-hostile control characters', () => {
    expect(sanitizeText('a\u0000b\u0007c')).toBe('abc');
    expect(sanitizeText('normal text\nwith newline')).toBe('normal text\nwith newline');
    expect(sanitizeText(42)).toBe('');
    expect(sanitizeText(null)).toBe('');
  });
});

describe('normalizeTailoredProfile', () => {
  const validBase = {
    personalInfo: { fullName: 'Jane Doe', email: 'j@x.co', summary: 'Eng' },
    careerPreferences: { targetRole: 'Backend Dev' },
    skills: ['Node', 'SQL'],
    experience: [
      { title: 'Dev', company: 'Acme', startDate: '2020', endDate: '2022', description: 'Built things' },
    ],
    education: [{ degree: 'BSc', institution: 'MIT', startYear: '2016', endYear: '2020' }],
    projects: [],
    certifications: [],
  };

  test('accepts a conformant payload and preserves structure', () => {
    const out = normalizeTailoredProfile(validBase);
    expect(out).not.toBeNull();
    expect(out.personalInfo.fullName).toBe('Jane Doe');
    expect(out.experience[0].company).toBe('Acme');
    expect(out.skills).toEqual(['Node', 'SQL']);
  });

  test('rejects non-object payloads and missing experience outright', () => {
    expect(normalizeTailoredProfile(null)).toBeNull();
    expect(normalizeTailoredProfile('cv')).toBeNull();
    expect(normalizeTailoredProfile([1, 2])).toBeNull();
    expect(normalizeTailoredProfile({ ...validBase, experience: 'oops' })).toBeNull();
    expect(normalizeTailoredProfile({ skills: [] })).toBeNull();
  });

  test('coerces hostile leaf values into safe strings instead of storing them raw', () => {
    const hostile = {
      ...validBase,
      personalInfo: { fullName: { $ne: '' }, email: null },
      experience: [
        {
          title: 42,
          company: true,
          description: ['not', 'a', 'string'],
          extraField: Buffer ? undefined : undefined,
        },
      ],
      skills: ['ok', '', { evil: true }, null, 7],
    };
    const out = normalizeTailoredProfile(hostile);
    expect(out.personalInfo.fullName).toBe('');
    expect(out.personalInfo.email).toBe('');
    expect(out.experience[0].title).toBe('42');
    expect(out.experience[0].company).toBe('true');
    expect(out.experience[0].description).toBe('');
    expect(out.experience[0].extraField).toBeUndefined();
    expect(out.skills).toEqual(['ok', '7']);
  });

  test('caps runaway arrays produced by a rambling model', () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ title: `Job ${i}`, company: 'X' }));
    const out = normalizeTailoredProfile({ ...validBase, experience: many });
    expect(out.experience.length).toBe(25);
  });
});

describe('normalizePrepGuide', () => {
  const card = { question: 'Why us?', type: 'Behavioral', suggested_answer: 'STAR story' };

  test('accepts a plain conformant array', () => {
    const out = normalizePrepGuide([card]);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual(card);
  });

  test('unwraps common wrapper objects returned by chatty models', () => {
    expect(normalizePrepGuide({ questions: [card] })).toHaveLength(1);
    expect(normalizePrepGuide({ interview_questions: [card] })).toHaveLength(1);
    expect(normalizePrepGuide({ items: [card] })).toHaveLength(1);
  });

  test('returns null for unusable shapes or zero valid cards', () => {
    expect(normalizePrepGuide(null)).toBeNull();
    expect(normalizePrepGuide({ nope: true })).toBeNull();
    expect(normalizePrepGuide([{ answerOnly: true }])).toBeNull();
    expect(normalizePrepGuide([])).toBeNull();
  });

  test('fills defaults, sanitizes strings, caps at 10 entries', () => {
    const list = Array.from({ length: 14 }, (_, i) => ({
      question: `Q${i}\u0000`,
      type: '',
      suggested_answer: undefined,
    }));
    const out = normalizePrepGuide(list);
    expect(out.length).toBe(10);
    expect(out[0].question).toBe('Q0');
    expect(out[0].type).toBe('General');
    expect(out[0].suggested_answer).toBe('');
  });
});
