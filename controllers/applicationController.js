const OpenAI = require('openai');
const applicationQuery = require('../models/applicationQuery');
const profileQuery = require('../models/profileQuery');
const userTablePreferenceQuery = require('../models/userTablePreferenceQuery');
const { streamCoverLetterPdf } = require('../services/coverLetterPdf');
const { streamCvPdf } = require('../services/cvPdf');

const NVIDIA_MODEL = process.env.NVIDIA_MODEL || 'qwen/qwen3-next-80b-a3b-instruct';
const nvidiaClient = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY,
  baseURL: process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
});

const VALID_TONES = ['Formal', 'Confident', 'Concise'];
const ATS_JSON_SCHEMA = `{
  "ats_match_score": 0,
  "missing_skills": ["string"]
}`;

function normalizeTone(tone) {
  return VALID_TONES.includes(tone) ? tone : 'Formal';
}

function validateId(idParam) {
  const num = Number(idParam);
  return Number.isInteger(num) && num > 0 ? num : null;
}

const applicationController = {
  async getStats(req, res, next) {
    try {
      const stats = await applicationQuery.getStats(req.user.id);
      return res.json({ stats });
    } catch (err) {
      return next(err);
    }
  },

  async getList(req, res, next) {
    try {
      const { sort, order, ...filterParams } = req.query;
      const filters = {};
      for (const [key, val] of Object.entries(filterParams)) {
        if (key.startsWith('filter_')) {
          filters[key.replace('filter_', '')] = val;
        }
      }
      const applications = await applicationQuery.findAllSorted(req.user.id, { sort, order, filters });
      return res.json({ applications });
    } catch (err) {
      return next(err);
    }
  },

  async getOne(req, res, next) {
    try {
      const id = validateId(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid application ID.' });

      const application = await applicationQuery.findById(id, req.user.id);
      if (!application) {
        return res.status(404).json({ error: 'Application not found.' });
      }
      return res.json({ application, tones: VALID_TONES });
    } catch (err) {
      return next(err);
    }
  },

  async create(req, res, next) {
    try {
      const { jobTitle, company, jobDescription, channel } = req.body;

      if (!jobTitle || !company || !jobDescription) {
        return res.status(400).json({ error: 'Job title, company, and job description are required.' });
      }

      const { evaluateJobDescription } = require('../utils/redFlagRules');
      const redFlagResult = evaluateJobDescription(jobDescription);

      const application = await applicationQuery.create(
        req.user.id,
        jobTitle.trim(),
        company.trim(),
        jobDescription.trim(),
        channel || 'cold_apply',
        redFlagResult.score,
        redFlagResult.flags
      );

      const profile = await profileQuery.findByUserId(req.user.id);
      const profileData = profile && profile.parsed_json_data ? profile.parsed_json_data : {};

      const response = await nvidiaClient.chat.completions.create({
        model: NVIDIA_MODEL,
        messages: [
          {
            role: 'system',
            content: `You are an ATS matching engine. Compare a candidate CV against a job description and return only valid JSON matching this schema:\n\n${ATS_JSON_SCHEMA}\n\nScore must be an integer from 0 to 100. Missing skills must contain at most 10 concise strings.`,
          },
          {
            role: 'user',
            content: `CANDIDATE CV DATA:\n${JSON.stringify(profileData)}\n\nJOB TITLE: ${jobTitle}\nCOMPANY: ${company}\n\nJOB DESCRIPTION:\n${jobDescription}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 1024,
        response_format: { type: 'json_object' },
      });

      const parsed = JSON.parse(response.choices[0].message.content);
      const rawScore = Number(parsed.ats_match_score);
      const atsScore = Number.isFinite(rawScore)
        ? Math.max(0, Math.min(100, Math.round(rawScore)))
        : 0;
      const missingSkills = Array.isArray(parsed.missing_skills)
        ? parsed.missing_skills.filter((skill) => typeof skill === 'string' && skill.trim()).slice(0, 10)
        : [];

      const updated = await applicationQuery.updateAtsScore(application.id, atsScore, missingSkills);
      return res.status(201).json({ application: updated });
    } catch (err) {
      return next(err);
    }
  },

  async generateCoverLetter(req, res, next) {
    try {
      const id = validateId(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid application ID.' });

      const application = await applicationQuery.findById(id, req.user.id);
      if (!application) {
        return res.status(404).json({ error: 'Application not found.' });
      }

      const tone = normalizeTone(req.body.selectedTone);
      const profile = await profileQuery.findByUserId(req.user.id);
      const profileData = profile && profile.parsed_json_data ? profile.parsed_json_data : {};

      let systemPrompt = `You are an expert career writer. Write a professional cover letter in a ${tone} tone. Return only plain text, no markdown. Open with "Dear Hiring Manager," and close with "Sincerely," followed by the candidate name. Use only facts present in the candidate data.`;
      let userPrompt = `CANDIDATE CV DATA:\n${JSON.stringify(profileData)}\n\nJOB TITLE: ${application.job_title}\nCOMPANY: ${application.company}\n\nJOB DESCRIPTION:\n${application.job_description || ''}`;


      const response = await nvidiaClient.chat.completions.create({
        model: NVIDIA_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 1200,
      });

      const coverLetter = response.choices[0].message.content.trim();
      if (!coverLetter) {
        return res.status(502).json({ error: 'AI did not return a cover letter.' });
      }

      const updated = await applicationQuery.updateCoverLetterForUser(
        application.id,
        req.user.id,
        tone,
        coverLetter
      );

      return res.json({ application: updated });
    } catch (err) {
      return next(err);
    }
  },

  async getCoverLetterPdf(req, res, next) {
    try {
      const id = validateId(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid application ID.' });

      const application = await applicationQuery.findById(id, req.user.id);
      if (!application || !application.generated_cover_letter) {
        return res.status(404).json({ error: 'No cover letter is available yet.' });
      }

      const profile = await profileQuery.findByUserId(req.user.id);
      streamCoverLetterPdf({
        res,
        application,
        profile: (profile && profile.parsed_json_data) || {},
        user: { email: req.user.email, fullName: req.user.full_name },
        download: true,
      });
    } catch (err) {
      return next(err);
    }
  },

  async delete(req, res, next) {
    try {
      const id = validateId(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid application ID.' });

      const deletedId = await applicationQuery.delete(id, req.user.id);
      if (!deletedId) {
        return res.status(404).json({ error: 'Application not found.' });
      }

      return res.json({ message: 'Application deleted.' });
    } catch (err) {
      return next(err);
    }
  },

  async updatePartial(req, res, next) {
    try {
      const id = validateId(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid application ID.' });

      const updated = await applicationQuery.updatePartial(id, req.user.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: 'Application not found or no valid fields to update.' });
      }
      return res.json({ application: updated });
    } catch (err) {
      return next(err);
    }
  },

  async bulkAction(req, res, next) {
    try {
      const { ids, operation, payload } = req.body;
      if (!Array.isArray(ids) || !ids.length || !operation) {
        return res.status(400).json({ error: 'ids (array) and operation are required.' });
      }

      const safeIds = ids.map(Number).filter((n) => Number.isInteger(n) && n > 0);
      if (!safeIds.length) {
        return res.status(400).json({ error: 'No valid IDs provided.' });
      }

      if (operation === 'delete') {
        const deleted = await applicationQuery.bulkDelete(req.user.id, safeIds);
        return res.json({ deleted: deleted.map((r) => r.id) });
      }

      if (operation === 'status' && payload && payload.status) {
        const updated = await applicationQuery.bulkUpdateStatus(req.user.id, safeIds, payload.status);
        return res.json({ updated: updated.length });
      }

      return res.status(400).json({ error: 'Unknown operation.' });
    } catch (err) {
      return next(err);
    }
  },

  async getTablePreferences(req, res, next) {
    try {
      const prefs = await userTablePreferenceQuery.get(req.user.id);
      return res.json({ preferences: prefs || { column_order: [], hidden_columns: [], custom_column_defs: [] } });
    } catch (err) {
      return next(err);
    }
  },

  async updateTablePreferences(req, res, next) {
    try {
      const { columnOrder, hiddenColumns, customColumnDefs } = req.body;
      const prefs = await userTablePreferenceQuery.upsert(req.user.id, { columnOrder, hiddenColumns, customColumnDefs });
      return res.json({ preferences: prefs });
    } catch (err) {
      return next(err);
    }
  },

  async tailorCv(req, res, next) {
    try {
      const id = validateId(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid application ID.' });

      const app = await applicationQuery.findById(id, req.user.id);
      if (!app) return res.status(404).json({ error: 'Application not found.' });
      if (!app.job_description) return res.status(400).json({ error: 'Job description required to tailor CV.' });

      const profile = await profileQuery.findByUserId(req.user.id);
      if (!profile || !profile.parsed_json_data || !profile.parsed_json_data.experience) {
        return res.status(400).json({ error: 'A CV profile with experience is required.' });
      }

      const prompt = `You are an expert resume writer and ATS optimizer.
Your task is to take a candidate's existing CV JSON profile and tailor it specifically for the following Job Description.

JOB DESCRIPTION:
${app.job_title} at ${app.company}
${app.job_description}

CANDIDATE'S CURRENT CV JSON:
${JSON.stringify(profile.parsed_json_data, null, 2)}

INSTRUCTIONS:
1. Do NOT fabricate or invent any experience, degrees, or skills that the candidate does not have.
2. You MAY rewrite, rephrase, or re-order bullet points in the "experience" section to better highlight relevance to the job description and match its keywords.
3. You MAY rewrite the "summary" to specifically position the candidate for this exact role.
4. Return ONLY valid JSON in the exact same schema structure as the input CV JSON. Return no markdown formatting, no backticks, and no explanations. JUST JSON.`;

      const aiRes = await nvidiaClient.chat.completions.create({
        model: NVIDIA_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 3000,
      });

      let tailoredJson = aiRes.choices[0].message.content.trim();
      if (tailoredJson.startsWith('\`\`\`json')) tailoredJson = tailoredJson.replace(/^\`\`\`json/, '').replace(/\`\`\`$/, '').trim();
      
      const tailoredData = JSON.parse(tailoredJson);
      
      const updatedApp = await applicationQuery.updateTailoredCvForUser(id, req.user.id, tailoredData);
      return res.json({ application: updatedApp });
    } catch (err) {
      console.error('Tailor CV error:', err);
      return res.status(500).json({ error: 'Failed to generate tailored CV.' });
    }
  },

  async downloadTailoredCvPdf(req, res, next) {
    try {
      const id = validateId(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid application ID.' });

      const app = await applicationQuery.findById(id, req.user.id);
      if (!app) return res.status(404).json({ error: 'Application not found.' });
      if (!app.tailored_cv_profile) return res.status(404).json({ error: 'No tailored CV found for this application.' });

      const templateType = req.query.template || 'modern';
      const cleanTitle = (app.job_title || 'job').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Tailored_CV_${cleanTitle}.pdf"`);

      streamCvPdf({
        res,
        profile: app.tailored_cv_profile,
        user: { full_name: req.user.full_name || 'Candidate', email: req.user.email || '' },
        template: templateType,
        download: true
      });
    } catch (err) {
      return next(err);
    }
  },

  async generateInterviewPrep(req, res, next) {
    try {
      const id = validateId(req.params.id);
      if (!id) return res.status(400).json({ error: 'Invalid application ID.' });

      const app = await applicationQuery.findById(id, req.user.id);
      if (!app) return res.status(404).json({ error: 'Application not found.' });
      if (!app.job_description) return res.status(400).json({ error: 'Job description required to generate prep.' });

      const profile = await profileQuery.findByUserId(req.user.id);

      const prompt = `You are an expert technical recruiter and interview coach.
Given the job description and the candidate's CV profile below, predict the top 5 most likely interview questions (mix of technical and behavioral).
Crucially, for EACH question, provide a suggested answer strategy using the STAR method (Situation, Task, Action, Result) drawing SPECIFICALLY from the candidate's experience in their CV.

JOB DESCRIPTION:
${app.job_title} at ${app.company}
${app.job_description}

CANDIDATE'S CV JSON:
${JSON.stringify(profile?.parsed_json_data || {}, null, 2)}

Return ONLY a JSON array of 5 objects matching this exact schema:
[
  {
    "question": "string (the predicted interview question)",
    "type": "Behavioral" | "Technical",
    "suggested_answer": "string (how the candidate should answer, pulling from their specific experience)"
  }
]
No markdown, no backticks, JUST JSON.`;

      const aiRes = await nvidiaClient.chat.completions.create({
        model: NVIDIA_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        max_tokens: 2500,
      });

      let guideJson = aiRes.choices[0].message.content.trim();
      if (guideJson.startsWith('\`\`\`json')) guideJson = guideJson.replace(/^\`\`\`json/, '').replace(/\`\`\`$/, '').trim();
      
      const guideData = JSON.parse(guideJson);
      
      const updatedApp = await applicationQuery.updateInterviewPrepForUser(id, req.user.id, guideData);
      return res.json({ application: updatedApp });
    } catch (err) {
      console.error('Interview Prep error:', err);
      return res.status(500).json({ error: 'Failed to generate interview prep guide.' });
    }
  },
};

module.exports = applicationController;
