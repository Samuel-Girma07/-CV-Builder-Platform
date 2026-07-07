const PDFDocument = require('pdfkit');
const SVGtoPDF = require('svg-to-pdfkit');

// ── Palette ───────────────────────────────────────────────────
const INK = '#20201d';
const INK_SOFT = '#403e38';
const MUTED = '#6f6d65';
const LINE = '#e0dbcf';
const PAPER = '#ffffff';

const TEMPLATES = {
  modern: { key: 'modern', label: 'Modern', sidebar: '#55633f', accent: '#55633f', onDark: '#f3f1e8' },
  classic: { key: 'classic', label: 'Classic', sidebar: null, accent: '#33414d', onDark: '#ffffff' },
  bold: { key: 'bold', label: 'Bold', sidebar: null, accent: '#4b4f86', onDark: '#f2f2f9' },
};

// ── Icons (stroke SVG, color injected) ───────────────────────
const ICON_PATHS = {
  summary: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  experience: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  projects: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  education: '<path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/>',
  skills: '<path d="M12 3l2.3 5.7L20 9l-4.5 3.9L17 19l-5-3.2L7 19l1.5-6.1L4 9l5.7-.3z"/>',
  certifications: '<circle cx="12" cy="9" r="5"/><path d="M9 13l-1 8 4-2 4 2-1-8"/>',
  contact: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M4 7l8 6 8-6"/>',
};

function iconSvg(name, color, sw) {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="' + color +
    '" stroke-width="' + (sw || 1.9) + '" stroke-linecap="round" stroke-linejoin="round">' +
    (ICON_PATHS[name] || '') + '</svg>';
}

function drawIcon(doc, name, color, x, y, size) {
  try { SVGtoPDF(doc, iconSvg(name, color), x, y, { width: size, height: size, assumePt: true }); }
  catch (e) { /* non-fatal: skip icon */ }
}

// ── Small helpers ─────────────────────────────────────────────
function initials(name) {
  const p = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!p.length) return 'CV';
  return ((p[0][0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}

function levelFraction(level) {
  if (level === 'Advanced') return 1;
  if (level === 'Familiar') return 0.42;
  return 0.72; // Proficient (default)
}

function safeFilename(s) {
  return String(s || 'CV').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'CV';
}

function bar(doc, x, y, w, frac, track, fill, trackA, fillA) {
  const h = 5, r = 2.5;
  doc.save().fillOpacity(trackA == null ? 1 : trackA).roundedRect(x, y, w, h, r).fill(track).restore();
  doc.save().fillOpacity(fillA == null ? 1 : fillA).roundedRect(x, y, Math.max(4, w * frac), h, r).fill(fill).restore();
}

function getData(profile) {
  const d = profile || {};
  return {
    pi: d.personalInfo || {},
    prefs: d.careerPreferences || {},
    skills: Array.isArray(d.skills) ? d.skills : [],
    skillLevels: d.skillLevels || {},
    projects: Array.isArray(d.projects) ? d.projects : [],
    experience: Array.isArray(d.experience) ? d.experience : [],
    education: Array.isArray(d.education) ? d.education : [],
    certifications: Array.isArray(d.certifications) ? d.certifications : [],
  };
}

function checkPageBreak(doc, y, reqH, resetY) {
  if (y + reqH > doc.page.height - 60) {
    doc.addPage();
    return resetY;
  }
  return y;
}

// ── Template: MODERN (two-column sidebar) ─────────────────────
function renderModern(doc, data, name, role, t) {
  const SB = 200;            // sidebar width
  const pageH = doc.page.height;
  
  doc.on('pageAdded', () => {
    doc.save().rect(0, 0, SB, pageH).fill(t.sidebar).restore();
  });

  doc.rect(0, 0, SB, pageH).fill(t.sidebar);

  const sx = 24, sw = SB - 48;
  let sy = 40;

  // Monogram
  const cx = sx + sw / 2;
  doc.save().fillOpacity(0.16).circle(cx, sy + 26, 26).fill('#ffffff').restore();
  doc.font('Helvetica-Bold').fontSize(18).fillColor('#ffffff')
    .text(initials(name), sx, sy + 17, { width: sw, align: 'center' });
  sy += 64;

  doc.font('Helvetica-Bold').fontSize(15).fillColor('#ffffff').text(name, sx, sy, { width: sw, align: 'center' });
  sy = doc.y + 2;
  if (role) {
    doc.font('Helvetica').fontSize(9).fillColor(t.onDark).text(role, sx, sy, { width: sw, align: 'center' });
    sy = doc.y;
  }
  sy += 14;

  const sideHeading = (label) => {
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#ffffff').text(label.toUpperCase(), sx, sy, { width: sw, characterSpacing: 1 });
    sy = doc.y + 4;
    doc.save().fillOpacity(0.35).rect(sx, sy, sw, 0.8).fill('#ffffff').restore();
    sy += 9;
  };

  // Contact
  const contact = [data.pi.email, data.pi.phone, data.pi.location].filter(Boolean);
  if (contact.length) {
    sideHeading('Contact');
    doc.font('Helvetica').fontSize(8.5).fillColor(t.onDark);
    contact.forEach((c) => { doc.text(c, sx, sy, { width: sw }); sy = doc.y + 3; });
    sy += 10;
  }

  // Skills with bars
  if (data.skills.length) {
    sideHeading('Skills');
    data.skills.slice(0, 12).forEach((s) => {
      doc.font('Helvetica').fontSize(8.5).fillColor('#ffffff').text(s, sx, sy, { width: sw });
      sy = doc.y + 3;
      bar(doc, sx, sy, sw, levelFraction(data.skillLevels[s]), '#ffffff', '#ffffff', 0.28, 0.95);
      sy += 11;
    });
    sy += 6;
  }

  // Certifications
  if (data.certifications.length) {
    sideHeading('Certifications');
    doc.font('Helvetica').fontSize(8.5).fillColor(t.onDark);
    data.certifications.slice(0, 6).forEach((c) => {
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#ffffff').text(c.name, sx, sy, { width: sw });
      sy = doc.y;
      const sub = [c.issuer, c.year].filter(Boolean).join(' · ');
      if (sub) { doc.font('Helvetica').fontSize(8).fillColor(t.onDark).text(sub, sx, sy, { width: sw }); sy = doc.y; }
      sy += 7;
    });
  }

  // ── Main column ──
  const mx = SB + 26;
  const mw = doc.page.width - mx - 40;
  let my = 44;

  const mainHeading = (label, icon) => {
    my = checkPageBreak(doc, my, 40, 44);
    drawIcon(doc, icon, t.accent, mx, my - 1, 13);
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(INK).text(label.toUpperCase(), mx + 19, my, { characterSpacing: 0.8 });
    my = doc.y + 5;
    doc.moveTo(mx, my).lineTo(mx + mw, my).lineWidth(0.8).strokeColor(LINE).stroke();
    my += 11;
  };

  if (data.pi.summary) {
    mainHeading('Profile', 'summary');
    doc.font('Times-Roman').fontSize(10.5).fillColor(INK_SOFT).text(data.pi.summary, mx, my, { width: mw, lineGap: 2.5 });
    my = doc.y + 18;
  }

  if (data.experience.length) {
    mainHeading('Experience', 'experience');
    data.experience.slice(0, 4).forEach((e) => {
      let reqH = 0;
      doc.font('Helvetica-Bold').fontSize(10.5);
      reqH += doc.heightOfString(e.title || '', { width: mw });
      const sub = [e.company, [e.startDate, e.endDate].filter(Boolean).join(' – ')].filter(Boolean).join('  ·  ');
      if (sub) { doc.font('Helvetica').fontSize(9); reqH += doc.heightOfString(sub, { width: mw }); }
      if (e.description) { doc.font('Times-Roman').fontSize(10); reqH += doc.heightOfString(e.description, { width: mw, lineGap: 2 }); }
      reqH += 12;
      
      my = checkPageBreak(doc, my, reqH, 44);
      
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor(INK).text(e.title || '', mx, my, { width: mw });
      my = doc.y;
      if (sub) { doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(sub, mx, my, { width: mw }); my = doc.y; }
      if (e.description) { doc.font('Times-Roman').fontSize(10).fillColor(INK_SOFT).text(e.description, mx, my + 2, { width: mw, lineGap: 2 }); my = doc.y; }
      my += 12;
    });
    my += 4;
  }

  if (data.projects.length) {
    mainHeading('Projects', 'projects');
    data.projects.slice(0, 4).forEach((p) => {
      let reqH = 0;
      doc.font('Helvetica-Bold').fontSize(10.5);
      reqH += doc.heightOfString(p.title || '', { width: mw });
      const sub = [p.type, p.tools].filter(Boolean).join('  ·  ');
      if (sub) { doc.font('Helvetica').fontSize(9); reqH += doc.heightOfString(sub, { width: mw }); }
      if (p.outcome) { doc.font('Times-Roman').fontSize(10); reqH += doc.heightOfString(p.outcome, { width: mw, lineGap: 2 }); }
      reqH += 12;
      
      my = checkPageBreak(doc, my, reqH, 44);
      
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor(INK).text(p.title || '', mx, my, { width: mw });
      my = doc.y;
      if (sub) { doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(sub, mx, my, { width: mw }); my = doc.y; }
      if (p.outcome) { doc.font('Times-Roman').fontSize(10).fillColor(INK_SOFT).text(p.outcome, mx, my + 2, { width: mw, lineGap: 2 }); my = doc.y; }
      my += 12;
    });
    my += 4;
  }

  if (data.education.length) {
    mainHeading('Education', 'education');
    data.education.slice(0, 4).forEach((e) => {
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor(INK).text(e.degree || '', mx, my, { width: mw });
      my = doc.y;
      const sub = [e.institution, [e.startYear, e.endYear].filter(Boolean).join(' – ')].filter(Boolean).join('  ·  ');
      if (sub) { doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(sub, mx, my, { width: mw }); my = doc.y; }
      my += 11;
    });
  }
}

// ── Template: CLASSIC (single column) ─────────────────────────
function renderClassic(doc, data, name, role, t) {
  const m = 56;
  const w = doc.page.width - m * 2;
  let y = 54;

  doc.font('Times-Bold').fontSize(26).fillColor(INK).text(name, m, y, { width: w, align: 'center' });
  y = doc.y + 3;
  const head = [role, data.pi.location].filter(Boolean).join('   ·   ');
  if (head) { doc.font('Helvetica').fontSize(10).fillColor(t.accent).text(head, m, y, { width: w, align: 'center' }); y = doc.y + 2; }
  const contact = [data.pi.email, data.pi.phone].filter(Boolean).join('   ·   ');
  if (contact) { doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(contact, m, y, { width: w, align: 'center' }); y = doc.y; }
  y += 12;
  doc.moveTo(m, y).lineTo(m + w, y).lineWidth(1.4).strokeColor(t.accent).stroke();
  y += 18;

  const pageH = doc.page.height;
  const heading = (label, icon) => {
    y = checkPageBreak(doc, y, 40, 54);
    drawIcon(doc, icon, t.accent, m, y - 1, 12);
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(t.accent).text(label.toUpperCase(), m + 18, y, { characterSpacing: 1.5 });
    y = doc.y + 5;
    doc.moveTo(m, y).lineTo(m + w, y).lineWidth(0.7).strokeColor(LINE).stroke();
    y += 11;
  };

  if (data.pi.summary) {
    heading('Summary', 'summary');
    doc.font('Times-Roman').fontSize(11).fillColor(INK_SOFT).text(data.pi.summary, m, y, { width: w, lineGap: 2.5, align: 'justify' });
    y = doc.y + 18;
  }

  if (data.experience.length) {
    heading('Experience', 'experience');
    data.experience.slice(0, 4).forEach((e) => {
      let reqH = 0;
      doc.font('Helvetica-Bold').fontSize(11);
      reqH += doc.heightOfString(e.title || '', { width: w });
      const sub = [e.company, [e.startDate, e.endDate].filter(Boolean).join(' – ')].filter(Boolean).join('   ·   ');
      if (sub) { doc.font('Helvetica-Oblique').fontSize(9.5); reqH += doc.heightOfString(sub, { width: w }); }
      if (e.description) { doc.font('Times-Roman').fontSize(10.5); reqH += doc.heightOfString(e.description, { width: w, lineGap: 2 }); }
      reqH += 12;

      y = checkPageBreak(doc, y, reqH, 54);

      doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text(e.title || '', m, y, { width: w, continued: false });
      y = doc.y;
      if (sub) { doc.font('Helvetica-Oblique').fontSize(9.5).fillColor(MUTED).text(sub, m, y, { width: w }); y = doc.y; }
      if (e.description) { doc.font('Times-Roman').fontSize(10.5).fillColor(INK_SOFT).text(e.description, m, y + 2, { width: w, lineGap: 2 }); y = doc.y; }
      y += 12;
    });
    y += 4;
  }

  if (data.projects.length) {
    heading('Projects', 'projects');
    data.projects.slice(0, 4).forEach((p) => {
      let reqH = 0;
      doc.font('Helvetica-Bold').fontSize(11);
      reqH += doc.heightOfString(p.title || '', { width: w });
      const sub = [p.type, p.tools].filter(Boolean).join('   ·   ');
      if (sub) { doc.font('Helvetica-Oblique').fontSize(9.5); reqH += doc.heightOfString(sub, { width: w }); }
      if (p.outcome) { doc.font('Times-Roman').fontSize(10.5); reqH += doc.heightOfString(p.outcome, { width: w, lineGap: 2 }); }
      reqH += 12;

      y = checkPageBreak(doc, y, reqH, 54);

      doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text(p.title || '', m, y, { width: w });
      y = doc.y;
      if (sub) { doc.font('Helvetica-Oblique').fontSize(9.5).fillColor(MUTED).text(sub, m, y, { width: w }); y = doc.y; }
      if (p.outcome) { doc.font('Times-Roman').fontSize(10.5).fillColor(INK_SOFT).text(p.outcome, m, y + 2, { width: w, lineGap: 2 }); y = doc.y; }
      y += 12;
    });
    y += 4;
  }

  if (data.education.length) {
    heading('Education', 'education');
    data.education.slice(0, 4).forEach((e) => {
      doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text(e.degree || '', m, y, { width: w });
      y = doc.y;
      const sub = [e.institution, [e.startYear, e.endYear].filter(Boolean).join(' – ')].filter(Boolean).join('   ·   ');
      if (sub) { doc.font('Helvetica-Oblique').fontSize(9.5).fillColor(MUTED).text(sub, m, y, { width: w }); y = doc.y; }
      y += 11;
    });
    y += 4;
  }

  if (data.skills.length) {
    heading('Skills', 'skills');
    const colW = (w - 24) / 2;
    const half = Math.ceil(data.skills.length / 2);
    const cols = [data.skills.slice(0, half), data.skills.slice(half)];
    const startY = y;
    let maxY = y;
    cols.forEach((col, ci) => {
      let cy = startY;
      const colX = m + ci * (colW + 24);
      col.forEach((s) => {
        doc.font('Helvetica').fontSize(9.5).fillColor(INK).text(s, colX, cy, { width: colW });
        cy = doc.y + 2;
        bar(doc, colX, cy, colW, levelFraction(data.skillLevels[s]), '#eceadf', t.accent);
        cy += 11;
      });
      maxY = Math.max(maxY, cy);
    });
    y = maxY;
  }

  if (data.certifications.length) {
    heading('Certifications', 'certifications');
    data.certifications.slice(0, 6).forEach((c) => {
      doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(c.name || '', m, y, { width: w });
      y = doc.y;
      const sub = [c.issuer, c.year].filter(Boolean).join(' · ');
      if (sub) { doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(sub, m, y, { width: w }); y = doc.y; }
      y += 7;
    });
  }
}

// ── Template: BOLD (accent header band) ───────────────────────
function renderBold(doc, data, name, role, t) {
  const bandH = 128;
  doc.rect(0, 0, doc.page.width, bandH).fill(t.accent);
  const m = 56;
  const w = doc.page.width - m * 2;

  doc.font('Times-Bold').fontSize(28).fillColor('#ffffff').text(name, m, 34, { width: w });
  let hy = doc.y + 2;
  if (role) { doc.font('Helvetica-Bold').fontSize(12).fillColor(t.onDark).text(role, m, hy, { width: w }); hy = doc.y; }
  const contact = [data.pi.email, data.pi.phone, data.pi.location].filter(Boolean).join('   ·   ');
  if (contact) { doc.font('Helvetica').fontSize(9).fillColor(t.onDark).text(contact, m, bandH - 26, { width: w }); }

  let y = bandH + 26;
  const pageH = doc.page.height;

  const heading = (label, icon) => {
    y = checkPageBreak(doc, y, 40, 44);
    doc.roundedRect(m, y, 22, 22, 6).fill(t.accent);
    drawIcon(doc, icon, '#ffffff', m + 4.5, y + 4.5, 13);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(INK).text(label.toUpperCase(), m + 32, y + 4, { characterSpacing: 0.8 });
    y += 32;
  };

  if (data.pi.summary) {
    heading('Profile', 'summary');
    doc.font('Times-Roman').fontSize(11).fillColor(INK_SOFT).text(data.pi.summary, m, y, { width: w, lineGap: 2.5 });
    y = doc.y + 18;
  }

  if (data.experience.length) {
    heading('Experience', 'experience');
    data.experience.slice(0, 4).forEach((e) => {
      let reqH = 0;
      doc.font('Helvetica-Bold').fontSize(11);
      reqH += doc.heightOfString(e.title || '', { width: w });
      const sub = [e.company, [e.startDate, e.endDate].filter(Boolean).join(' – ')].filter(Boolean).join('   ·   ');
      if (sub) { doc.font('Helvetica').fontSize(9.5); reqH += doc.heightOfString(sub, { width: w }); }
      if (e.description) { doc.font('Times-Roman').fontSize(10.5); reqH += doc.heightOfString(e.description, { width: w, lineGap: 2 }); }
      reqH += 12;

      y = checkPageBreak(doc, y, reqH, 44);

      doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text(e.title || '', m, y, { width: w });
      y = doc.y;
      if (sub) { doc.font('Helvetica').fontSize(9.5).fillColor(MUTED).text(sub, m, y, { width: w }); y = doc.y; }
      if (e.description) { doc.font('Times-Roman').fontSize(10.5).fillColor(INK_SOFT).text(e.description, m, y + 2, { width: w, lineGap: 2 }); y = doc.y; }
      y += 12;
    });
    y += 4;
  }

  if (data.projects.length) {
    heading('Projects', 'projects');
    data.projects.slice(0, 4).forEach((p) => {
      let reqH = 0;
      doc.font('Helvetica-Bold').fontSize(11);
      reqH += doc.heightOfString(p.title || '', { width: w });
      const sub = [p.type, p.tools].filter(Boolean).join('   ·   ');
      if (sub) { doc.font('Helvetica').fontSize(9.5); reqH += doc.heightOfString(sub, { width: w }); }
      if (p.outcome) { doc.font('Times-Roman').fontSize(10.5); reqH += doc.heightOfString(p.outcome, { width: w, lineGap: 2 }); }
      reqH += 12;

      y = checkPageBreak(doc, y, reqH, 44);

      doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text(p.title || '', m, y, { width: w });
      y = doc.y;
      if (sub) { doc.font('Helvetica').fontSize(9.5).fillColor(MUTED).text(sub, m, y, { width: w }); y = doc.y; }
      if (p.outcome) { doc.font('Times-Roman').fontSize(10.5).fillColor(INK_SOFT).text(p.outcome, m, y + 2, { width: w, lineGap: 2 }); y = doc.y; }
      y += 12;
    });
    y += 4;
  }

  // Skills + education side by side-ish (stacked for simplicity)
  if (data.skills.length) {
    heading('Skills', 'skills');
    const colW = (w - 24) / 2;
    const half = Math.ceil(data.skills.length / 2);
    const cols = [data.skills.slice(0, half), data.skills.slice(half)];
    const startY = y; let maxY = y;
    cols.forEach((col, ci) => {
      let cy = startY; const colX = m + ci * (colW + 24);
      col.forEach((s) => {
        doc.font('Helvetica').fontSize(9.5).fillColor(INK).text(s, colX, cy, { width: colW });
        cy = doc.y + 2;
        bar(doc, colX, cy, colW, levelFraction(data.skillLevels[s]), '#eceaf0', t.accent);
        cy += 11;
      });
      maxY = Math.max(maxY, cy);
    });
    y = maxY + 6;
  }

  if (data.education.length) {
    heading('Education', 'education');
    data.education.slice(0, 4).forEach((e) => {
      doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text(e.degree || '', m, y, { width: w });
      y = doc.y;
      const sub = [e.institution, [e.startYear, e.endYear].filter(Boolean).join(' – ')].filter(Boolean).join('   ·   ');
      if (sub) { doc.font('Helvetica').fontSize(9.5).fillColor(MUTED).text(sub, m, y, { width: w }); y = doc.y; }
      y += 11;
    });
    y += 4;
  }

  if (data.certifications.length) {
    heading('Certifications', 'certifications');
    data.certifications.slice(0, 6).forEach((c) => {
      doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(c.name || '', m, y, { width: w });
      y = doc.y;
      const sub = [c.issuer, c.year].filter(Boolean).join(' · ');
      if (sub) { doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(sub, m, y, { width: w }); y = doc.y; }
      y += 7;
    });
  }
}

const RENDERERS = { modern: renderModern, classic: renderClassic, bold: renderBold };

/**
 * Stream a CV PDF to the response.
 * @param {object} opts { res, profile, user, template, download }
 */
function streamCvPdf({ res, profile, user, template, download }) {
  const t = TEMPLATES[template] || TEMPLATES.modern;
  const data = getData(profile);
  const name = data.pi.fullName || (user && user.fullName) || (user && user.email) || 'Your Name';
  const role = data.prefs.targetRole
    ? (data.prefs.experienceLevel ? `${data.prefs.targetRole} · ${data.prefs.experienceLevel}` : data.prefs.targetRole)
    : '';

  const doc = new PDFDocument({ size: 'A4', margin: 0 });
  const filename = `${safeFilename(name)}-CV-${t.label}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename="${filename}"`);
  doc.pipe(res);

  (RENDERERS[t.key] || renderModern)(doc, data, name, role, t);

  doc.end();
}

module.exports = { streamCvPdf, TEMPLATES, safeFilename };
