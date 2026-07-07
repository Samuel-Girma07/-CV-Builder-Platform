const PDFDocument = require('pdfkit');

// Shared palette (mirrors the app's accent + ink tokens).
const INK = '#20201d';
const INK_SOFT = '#4b4a44';
const MUTED = '#76746c';
const ACCENT = '#6b7a52';

function safeFilename(s) {
  return String(s || 'document').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'document';
}

/**
 * Stream a letterhead-styled cover letter PDF to the response.
 * @param {object} opts { res, application, profile, user, download }
 */
function streamCoverLetterPdf({ res, application, profile, user, download }) {
  const pi = (profile && profile.personalInfo) || {};
  const name = pi.fullName || (user && user.fullName) || (user && user.email) || 'Candidate';
  const contactBits = [pi.email || (user && user.email), pi.phone, pi.location].filter(Boolean);
  const dateStr = new Date(application.created_at || Date.now()).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const doc = new PDFDocument({ size: 'A4', margins: { top: 64, bottom: 64, left: 64, right: 64 } });

  const filename = `Cover-Letter-${safeFilename(application.company)}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename="${filename}"`);
  doc.pipe(res);

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const width = right - left;

  // ── Letterhead ──
  doc.font('Times-Bold').fontSize(22).fillColor(INK).text(name, left, doc.y);
  if (contactBits.length) {
    doc.moveDown(0.25);
    doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(contactBits.join('   ·   '), { width });
  }
  doc.moveDown(0.5);
  const ruleY = doc.y;
  doc.moveTo(left, ruleY).lineTo(right, ruleY).lineWidth(2).strokeColor(ACCENT).stroke();
  doc.moveDown(1.2);

  // ── Date + addressee ──
  doc.font('Helvetica').fontSize(10).fillColor(MUTED).text(dateStr, left, doc.y);
  doc.moveDown(0.3);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(INK_SOFT)
    .text(`${application.company} — ${application.job_title}`, { width });
  doc.moveDown(1.1);

  // ── Body ──
  doc.font('Times-Roman').fontSize(11.5).fillColor(INK_SOFT);
  const paragraphs = String(application.generated_cover_letter || '')
    .split('\n')
    .map((p) => p.trim())
    .filter(Boolean);

  paragraphs.forEach((para, i) => {
    doc.text(para, { width, align: 'left', lineGap: 3 });
    if (i < paragraphs.length - 1) doc.moveDown(0.8);
  });

  doc.end();
}

module.exports = { streamCoverLetterPdf, safeFilename, palette: { INK, INK_SOFT, MUTED, ACCENT } };
