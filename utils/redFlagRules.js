/**
 * redFlagRules.js
 * Independent rule-based evaluation for job postings.
 */

const rules = [
  {
    name: 'missing_salary',
    evaluate: (text) => {
      const lower = text.toLowerCase();
      const hasSalaryInfo = lower.includes('$') || 
                            lower.includes('£') || 
                            lower.includes('€') || 
                            lower.includes('salary') || 
                            lower.includes('compensation') || 
                            lower.includes('pay ') ||
                            lower.includes('hourly');
      
      return {
        triggered: !hasSalaryInfo,
        weight: 15,
        reason: 'Missing clear salary or compensation information.'
      };
    }
  },
  {
    name: 'urgency_language',
    evaluate: (text) => {
      const lower = text.toLowerCase();
      const urgencyPhrases = [
        'act now', 'urgent hire', 'start immediately', 'urgently hiring',
        'apply today before it', 'immediate start required'
      ];
      
      const triggered = urgencyPhrases.some(phrase => lower.includes(phrase));
      return {
        triggered,
        weight: 20,
        reason: 'Uses highly urgent or pushy language ("Urgent hire", "Start immediately").'
      };
    }
  },
  {
    name: 'financial_info_requests',
    evaluate: (text) => {
      const lower = text.toLowerCase();
      const sketchyPhrases = [
        'bank details', 'wire transfer', 'upfront fee', 'deposit required',
        'send money', 'purchase equipment from us', 'pay for background check'
      ];
      
      const triggered = sketchyPhrases.some(phrase => lower.includes(phrase));
      return {
        triggered,
        weight: 50,
        reason: 'Requests highly suspicious financial info or upfront fees.'
      };
    }
  },
  {
    name: 'vague_description',
    evaluate: (text) => {
      const wordCount = text.split(/\s+/).filter(Boolean).length;
      return {
        triggered: wordCount < 40,
        weight: 25,
        reason: 'Job description is suspiciously vague or short (under 40 words).'
      };
    }
  },
  {
    name: 'rockstar_ninja_tropes',
    evaluate: (text) => {
      const lower = text.toLowerCase();
      const tropes = [
        'ninja', 'rockstar', 'work hard play hard', 'wear many hats',
        'wear multiple hats', 'fast-paced environment', '10x engineer',
        'superhero', 'hustle'
      ];
      
      let matches = 0;
      tropes.forEach(trope => {
        if (lower.includes(trope)) matches++;
      });
      
      // If it contains a lot of these tropes, it's a bit of a red flag
      return {
        triggered: matches >= 2,
        weight: Math.min(30, matches * 10), // Max 30 points
        reason: 'Heavy use of startup tropes ("ninja", "rockstar", "wear many hats").'
      };
    }
  }
];

function evaluateJobDescription(text) {
  if (!text || typeof text !== 'string') {
    return { score: 0, flags: [] };
  }

  let totalScore = 0;
  const triggeredFlags = [];

  for (const rule of rules) {
    const result = rule.evaluate(text);
    if (result.triggered) {
      totalScore += result.weight;
      triggeredFlags.push({
        rule: rule.name,
        reason: result.reason,
        weight: result.weight
      });
    }
  }

  // Cap score at 100
  const score = Math.min(100, totalScore);

  return {
    score,
    flags: triggeredFlags
  };
}

module.exports = {
  evaluateJobDescription,
  rules
};
