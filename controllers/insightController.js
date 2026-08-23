const insightQuery = require('../models/insightQuery');

const MIN_SAMPLE = 3;

exports.getSkillGaps = async (req, res, next) => {
  try {
    // Below a tiny sample the radar is noise, so the client renders its
    // "score more applications" hint instead of misleading rankings.
    const gaps = await insightQuery.getSkillGaps(req.user.id);
    return res.json({ gaps, sampleOk: gaps.reduce((n, g) => n + g.total, 0) >= MIN_SAMPLE });
  } catch (err) {
    return next(err);
  }
};

/*
  Correlating outcomes with feature usage only means something once BOTH
  groups have a handful of rows; below that we say so instead of publishing
  impressive-looking nonsense like "100% uplift (1 of 1)".
*/
function buildFeatureInsight(name, usedTotal, usedHit, unusedTotal, unusedHit) {
  if (usedTotal < MIN_SAMPLE || unusedTotal < MIN_SAMPLE) {
    return { feature: name, sampleOk: false };
  }
  const withRate = Math.round((usedHit / usedTotal) * 100);
  const withoutRate = Math.round((unusedHit / unusedTotal) * 100);
  let uplift;
  if (withoutRate === 0 && withRate === 0) uplift = 0;
  else if (withoutRate === 0) uplift = null; // no baseline to divide by — "new" effect
  else uplift = Math.round(((usedHit / usedTotal) / (unusedHit / unusedTotal)) * 10) / 10;
  return { feature: name, sampleOk: true, withRate, withoutRate, uplift, usedTotal, unusedTotal };
}

exports.buildFeatureInsight = buildFeatureInsight;

exports.getOutcomes = async (req, res, next) => {
  try {
    const split = await insightQuery.getOutcomeSplit(req.user.id);
    const insights = [
      buildFeatureInsight(
        'Tailored CV',
        split.tailoredTotal, split.tailoredInterviewed,
        split.plainTotal, split.plainInterviewed
      ),
      buildFeatureInsight(
        'Cover letter',
        split.letterTotal, split.letterInterviewed,
        split.noLetterTotal, split.noLetterInterviewed
      ),
    ];
    return res.json({ total: split.total, insights });
  } catch (err) {
    return next(err);
  }
};
