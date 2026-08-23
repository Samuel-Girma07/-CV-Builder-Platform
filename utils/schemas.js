/*
  Validators for free-form LLM output before it is persisted or rendered.
  The AI is treated as hostile input: anything it returns must either fit the
  exact shape the rest of the system expects (PDF renderer, preview UI) or be
  rejected with a 502 — never stored raw as a poison pill.
*/

// PostgreSQL JSONB rejects \u0000 and most raw control characters; strip them
// from every string we persist on behalf of the model.
function sanitizeText(value) {
  if (typeof value !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return value.replace(/\u0000/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

function toSafeString(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return sanitizeText(value);
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return String(value);
  return '';
}

function pickStrings(source, fields) {
  const out = {};
  fields.forEach((field) => {
    out[field] = toSafeString(source ? source[field] : '');
  });
  return out;
}

function normalizeStringArray(value, cap) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? sanitizeText(item) : toSafeString(item)))
    .filter(Boolean)
    .slice(0, cap);
}

/**
 * Shape produced by the tailor-CV prompt. Must mirror what services/cvPdf.js
 * renders and what the detail view previews.
 * @returns {object|null} null when the payload cannot be trusted at all
 */
function normalizeTailoredProfile(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (!Array.isArray(raw.experience)) return null;

  const capItems = (value, cap) => (Array.isArray(value) ? value.slice(0, cap) : []);

  return {
    personalInfo: pickStrings(raw.personalInfo, ['fullName', 'email', 'phone', 'location', 'summary']),
    careerPreferences: {
      targetRole: toSafeString(raw.careerPreferences ? raw.careerPreferences.targetRole : ''),
      experienceLevel: toSafeString(raw.careerPreferences ? raw.careerPreferences.experienceLevel : ''),
      industries: normalizeStringArray(raw.careerPreferences ? raw.careerPreferences.industries : [], 15),
      cvTone: toSafeString(raw.careerPreferences ? raw.careerPreferences.cvTone : ''),
    },
    skills: normalizeStringArray(raw.skills, 60),
    skillLevels:
      raw.skillLevels && typeof raw.skillLevels === 'object' && !Array.isArray(raw.skillLevels)
        ? Object.fromEntries(
            Object.entries(raw.skillLevels)
              .filter(([k, v]) => typeof k === 'string' && typeof v === 'string')
              .slice(0, 60)
          )
        : {},
    preferences:
      raw.preferences && typeof raw.preferences === 'object' && !Array.isArray(raw.preferences)
        ? { defaultTemplate: toSafeString(raw.preferences.defaultTemplate) || 'modern' }
        : { defaultTemplate: 'modern' },
    experience: capItems(raw.experience, 25).map((e) =>
      pickStrings(e, ['title', 'company', 'startDate', 'endDate', 'description'])
    ),
    education: capItems(raw.education, 25).map((e) =>
      pickStrings(e, ['degree', 'institution', 'startYear', 'endYear'])
    ),
    projects: capItems(raw.projects, 25).map((p) =>
      pickStrings(p, ['title', 'type', 'tools', 'outcome', 'link'])
    ),
    certifications: capItems(raw.certifications, 15).map((c) =>
      pickStrings(c, ['name', 'issuer', 'year'])
    ),
  };
}

/**
 * Shape produced by the interview-prep prompt: an array of flashcards.
 * Accepts common wrapper variants ({questions:[…]}, {items:[…]}) and coerces
 * each entry to plain strings. @returns {Array|null} null when unusable.
 */
function normalizePrepGuide(raw) {
  let list = raw;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    list = raw.questions || raw.interview_questions || raw.interviewQuestions || raw.items;
  }
  if (!Array.isArray(list)) return null;

  const cards = list
    .slice(0, 10)
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const question = toSafeString(item.question);
      if (!question) return null;
      return {
        question,
        type: toSafeString(item.type) || 'General',
        suggested_answer: toSafeString(item.suggested_answer || item.answer),
      };
    })
    .filter(Boolean);

  return cards.length > 0 ? cards : null;
}

module.exports = { normalizeTailoredProfile, normalizePrepGuide, sanitizeText, toSafeString };
