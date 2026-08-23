const pdfParse = require('pdf-parse');
const profileQuery = require('../models/profileQuery');
const { streamCvPdf, TEMPLATES } = require('../services/cvPdf');
const { callAi } = require('../services/aiClient');
const { createCvUpload, isPdfBuffer } = require('../config/upload');

const SKILL_LEVELS = ['Familiar', 'Proficient', 'Advanced'];

const upload = createCvUpload();

const CV_JSON_SCHEMA = `{
  "personalInfo": {
    "fullName": "string",
    "email": "string",
    "phone": "string",
    "location": "string",
    "summary": "string"
  },
  "careerPreferences": {
    "targetRole": "string",
    "experienceLevel": "string",
    "industries": ["string"],
    "cvTone": "string"
  },
  "experience": [
    {
      "title": "string",
      "company": "string",
      "startDate": "string",
      "endDate": "string",
      "description": "string"
    }
  ],
  "education": [
    {
      "degree": "string",
      "institution": "string",
      "startYear": "string",
      "endYear": "string"
    }
  ],
  "projects": [
    {
      "title": "string",
      "type": "string",
      "tools": "string",
      "outcome": "string",
      "link": "string"
    }
  ],
  "certifications": [
    {
      "name": "string",
      "issuer": "string",
      "year": "string"
    }
  ],
  "skills": ["string"]
}`;

function normalizeProfile(input = {}) {
  return {
    personalInfo: input.personalInfo || {},
    careerPreferences: input.careerPreferences || {},
    skills: Array.isArray(input.skills) ? input.skills.filter(Boolean) : [],
    projects: Array.isArray(input.projects) ? input.projects : [],
    experience: Array.isArray(input.experience) ? input.experience : [],
    education: Array.isArray(input.education) ? input.education : [],
    certifications: Array.isArray(input.certifications) ? input.certifications : [],
    skillLevels: input.skillLevels || {},
    preferences: input.preferences || { defaultTemplate: 'modern' },
  };
}

function normalizeTemplate(template) {
  return TEMPLATES[template] ? template : 'modern';
}

const profileController = {
  upload,

  async getProfile(req, res, next) {
    try {
      const profile = await profileQuery.findByUserId(req.user.id);
      return res.json({
        profile: normalizeProfile(profile && profile.parsed_json_data),
        templates: Object.values(TEMPLATES),
        skillLevels: SKILL_LEVELS,
      });
    } catch (err) {
      return next(err);
    }
  },

  async saveProfile(req, res, next) {
    try {
      const profileData = normalizeProfile(req.body);
      const saved = await profileQuery.upsert(req.user.id, profileData);
      return res.json({ profile: saved.parsed_json_data });
    } catch (err) {
      return next(err);
    }
  },

  async uploadProfile(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Please upload a PDF file.' });
      }

      if (!isPdfBuffer(req.file.buffer)) {
        return res.status(400).json({ error: 'This file is not a valid PDF.' });
      }

      const pdfData = await pdfParse(req.file.buffer);
      const rawText = pdfData.text;

      if (!rawText || rawText.trim().length < 20) {
        return res.status(422).json({ error: 'Could not extract meaningful text from the PDF.' });
      }

      const response = await callAi({
        messages: [
          {
            role: 'system',
            content: `You are a CV/resume parsing assistant. Return only valid JSON matching this exact schema:\n\n${CV_JSON_SCHEMA}\n\nUse empty strings and empty arrays for missing fields. Do not include markdown, comments, or explanations.`,
          },
          {
            role: 'user',
            content: `Parse this CV text into structured JSON:\n\n${rawText}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 4096,
        response_format: { type: 'json_object' },
      });

      let parsedData;
      try {
        parsedData = JSON.parse(response.choices[0].message.content);
      } catch (parseErr) {
        return res.status(502).json({ error: 'AI failed to extract structured data from the PDF. Please ensure the PDF is a valid text-based CV.' });
      }
      const saved = await profileQuery.upsert(req.user.id, normalizeProfile(parsedData));

      return res.json({ profile: saved.parsed_json_data });
    } catch (err) {
      return next(err);
    }
  },

  async generateSummary(req, res, next) {
    try {
      const profile = await profileQuery.findByUserId(req.user.id);
      const profileData = normalizeProfile((profile && profile.parsed_json_data) || req.body);

      const response = await callAi({
        messages: [
          {
            role: 'system',
            content: 'Write a concise professional CV summary. Return only the summary text, no headings or markdown. Keep it 2-3 sentences and do not invent facts.',
          },
          {
            role: 'user',
            content: `Candidate data:\n${JSON.stringify(profileData)}`,
          },
        ],
        temperature: 0.6,
        max_tokens: 320,
      });

      const summary = response.choices[0].message.content.trim();
      const updated = {
        ...profileData,
        personalInfo: {
          ...profileData.personalInfo,
          summary,
        },
      };
      const saved = await profileQuery.upsert(req.user.id, updated);

      return res.json({ summary, profile: saved.parsed_json_data });
    } catch (err) {
      return next(err);
    }
  },

  async saveSkillLevels(req, res, next) {
    try {
      const profile = await profileQuery.findByUserId(req.user.id);
      const data = normalizeProfile(profile && profile.parsed_json_data);
      const submitted = req.body.levels || {};
      const skillLevels = {};

      data.skills.forEach((skill) => {
        if (SKILL_LEVELS.includes(submitted[skill])) {
          skillLevels[skill] = submitted[skill];
        }
      });

      const saved = await profileQuery.upsert(req.user.id, { ...data, skillLevels });
      return res.json({ profile: saved.parsed_json_data });
    } catch (err) {
      return next(err);
    }
  },

  async getCvPdf(req, res, next) {
    try {
      const profile = await profileQuery.findByUserId(req.user.id);
      const data = normalizeProfile(profile && profile.parsed_json_data);
      const template = normalizeTemplate(req.query.template);

      streamCvPdf({
        res,
        profile: data,
        user: { email: req.user.email, fullName: req.user.full_name },
        template,
        download: req.query.download === '1',
      });
    } catch (err) {
      return next(err);
    }
  },

  async lintProfile(req, res, next) {
    try {
      const { text } = req.body;
      const { lintCvText } = require('../utils/cvLinter');
      const issues = lintCvText(text || '');
      return res.json({ issues });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = profileController;
