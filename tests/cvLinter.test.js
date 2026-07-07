const { lintCvText } = require('./cvLinter');

describe('Resume Language Quality Linter', () => {
  it('flags passive voice', () => {
    const text = 'The project was managed by me.';
    const issues = lintCvText(text);
    const passiveIssues = issues.filter(i => i.rule === 'passive_voice');
    expect(passiveIssues.length).toBeGreaterThan(0);
    expect(passiveIssues[0].textMatch.toLowerCase()).toBe('was managed');
  });

  it('flags weak/filler verbs', () => {
    const text = 'I was responsible for the database.';
    const issues = lintCvText(text);
    const weakIssues = issues.filter(i => i.rule === 'weak_verb');
    expect(weakIssues.length).toBeGreaterThan(0);
    expect(weakIssues[0].textMatch.toLowerCase()).toBe('was responsible for');
  });

  it('flags missing quantification on long experience bullets', () => {
    const text = 'Developed a new feature that made things faster and better.';
    const issues = lintCvText(text);
    const quantIssues = issues.filter(i => i.rule === 'missing_quantification');
    expect(quantIssues.length).toBeGreaterThan(0);
    expect(quantIssues[0].textMatch).toBe(text);
  });

  it('does not flag missing quantification if it contains numbers/percentages', () => {
    const text = 'Developed a new feature that increased speed by 20%.';
    const issues = lintCvText(text);
    const quantIssues = issues.filter(i => i.rule === 'missing_quantification');
    expect(quantIssues.length).toBe(0);
  });

  it('ignores short lines or lines with pipes', () => {
    const text = 'Software Engineer | Acme | 2020 | 2023 | Description\nShort line';
    const issues = lintCvText(text);
    const quantIssues = issues.filter(i => i.rule === 'missing_quantification');
    expect(quantIssues.length).toBe(0);
  });

  it('returns no false positives on a well-written bullet', () => {
    const text = 'Orchestrated the migration of legacy APIs, reducing latency by 40% and saving $10k annually.';
    const issues = lintCvText(text);
    expect(issues.length).toBe(0);
  });
});
