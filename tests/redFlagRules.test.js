const { evaluateJobDescription } = require('./redFlagRules');

describe('Job Posting Red-Flag Scorer', () => {
  it('should return 0 score and empty flags for a completely clean, legitimate job post', () => {
    const text = `
      We are looking for a Senior Software Engineer to join our platform team.
      You will be responsible for building scalable microservices and maintaining existing APIs.
      Required qualifications:
      - 5+ years of experience with Node.js and PostgreSQL
      - Experience with React is a plus
      - Strong communication skills
      
      Salary range: $120,000 - $150,000 per year + equity.
      Benefits include health insurance, 401k matching, and flexible PTO.
    `;
    const result = evaluateJobDescription(text);
    expect(result.score).toBe(0);
    expect(result.flags).toHaveLength(0);
  });

  it('should flag missing salary', () => {
    const text = `
      We are looking for a Senior Software Engineer to join our platform team.
      You will be responsible for building scalable microservices and maintaining existing APIs.
      Required qualifications:
      - 5+ years of experience with Node.js and PostgreSQL
      - Experience with React is a plus
      - Strong communication skills
      Great benefits!
    `;
    const result = evaluateJobDescription(text);
    expect(result.score).toBe(15);
    expect(result.flags.some(f => f.rule === 'missing_salary')).toBe(true);
  });

  it('should flag highly suspicious financial requests', () => {
    const text = `
      URGENT HIRE! We need a data entry clerk to start immediately.
      You will be working from home. 
      Please provide your bank details so we can send money for you to purchase equipment from us.
      This is a great opportunity! Salary is $30/hr.
    `;
    const result = evaluateJobDescription(text);
    
    expect(result.flags.some(f => f.rule === 'financial_info_requests')).toBe(true);
    expect(result.flags.some(f => f.rule === 'urgency_language')).toBe(true);
    // financial (50) + urgency (20) = 70
    expect(result.score).toBeGreaterThanOrEqual(70); 
  });

  it('should flag vague descriptions under 40 words', () => {
    const text = `Looking for a web developer to build our site. Fast-paced environment. Pay is $50/hr.`;
    const result = evaluateJobDescription(text);
    
    expect(result.flags.some(f => f.rule === 'vague_description')).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(25);
  });

  it('should flag startup tropes if multiple are present', () => {
    const text = `
      Are you a coding ninja? Want to be a rockstar at our company?
      We have a fast-paced environment and expect you to wear multiple hats.
      Join our team and help us build the future!
      Compensation is highly competitive.
    `;
    const result = evaluateJobDescription(text);
    
    expect(result.flags.some(f => f.rule === 'rockstar_ninja_tropes')).toBe(true);
  });

  it('should cap the score at 100 even if many rules are broken', () => {
    const text = `
      URGENT HIRE! Start immediately! 
      We need a rockstar ninja to wear many hats in our fast-paced environment.
      Please send your bank details and wire transfer an upfront fee for a background check.
      Do it now!
    `;
    const result = evaluateJobDescription(text);
    expect(result.score).toBe(100); // Should cap at 100
  });

  it('should handle empty or null input gracefully', () => {
    expect(evaluateJobDescription(null)).toEqual({ score: 0, flags: [] });
    expect(evaluateJobDescription('')).toEqual({ score: 0, flags: [] });
  });
});
