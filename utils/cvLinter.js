/**
 * Feature 6 — Resume Language Quality Linter
 * Deterministic, non-AI line-by-line linting of CV bullet points.
 */

const PASSIVE_VOICE_RE = /\b(is|are|was|were|been)\b\s+(\w+ed)\b/gi;
const WEAK_VERBS = [
  'helped with', 'responsible for', 'worked on', 'assisted with',
  'managed', 'handled', 'was responsible for', 'in charge of', 'participated in'
];
// Quantification: check for % or $ or numbers followed by x (like 10x) or just any digit depending on strictness
// Let's check for standard quantification: \d+%|\$\d+|\d+x or large numbers \d{3,}
const QUANTIFICATION_RE = /(\d+%|\$\d+|\d+x|\b\d{2,}\b)/i;

/**
 * Lints a given text block (typically the entire experience textarea or a bullet point)
 * and returns an array of issues.
 * @param {string} text - The CV text to lint.
 * @returns {Array} Array of issue objects { startIndex, length, rule, suggestion, textMatch }
 */
function lintCvText(text) {
  if (!text || typeof text !== 'string') return [];
  
  const issues = [];
  
  // 1. Passive voice check
  let match;
  PASSIVE_VOICE_RE.lastIndex = 0; // reset
  while ((match = PASSIVE_VOICE_RE.exec(text)) !== null) {
    issues.push({
      startIndex: match.index,
      length: match[0].length,
      rule: 'passive_voice',
      suggestion: 'Use active voice (e.g., instead of "was managed", use "managed").',
      textMatch: match[0]
    });
  }

  // 2. Weak/filler verbs check
  for (const verb of WEAK_VERBS) {
    const verbRe = new RegExp(`\\b${verb}\\b`, 'gi');
    while ((match = verbRe.exec(text)) !== null) {
      issues.push({
        startIndex: match.index,
        length: match[0].length,
        rule: 'weak_verb',
        suggestion: 'Use a stronger action verb (e.g., orchestrated, engineered, spearheaded).',
        textMatch: match[0]
      });
    }
  }

  // 3. Missing quantification check (per line/bullet)
  const lines = text.split('\n');
  let currentOffset = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Only flag lines that seem like experience bullets (longer than 20 chars and not just pipes for the parser)
    // The textarea format is "title | company | start | end | description" or bullet lines below it.
    // Let's only lint actual descriptive lines, ignoring the header lines with pipes if possible.
    if (line.length > 20 && !line.includes(' | ')) {
      if (!QUANTIFICATION_RE.test(line)) {
        issues.push({
          startIndex: currentOffset,
          length: line.length,
          rule: 'missing_quantification',
          suggestion: 'Add metrics or numbers to quantify your impact (e.g., "increased by 20%", "managed $10k budget").',
          textMatch: line
        });
      }
    }
    
    currentOffset += line.length + 1; // +1 for the newline
  }

  // Sort issues by index
  return issues.sort((a, b) => a.startIndex - b.startIndex);
}

module.exports = {
  lintCvText,
  PASSIVE_VOICE_RE,
  WEAK_VERBS,
  QUANTIFICATION_RE
};
