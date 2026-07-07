const pdfParse = require('pdf-parse');

/*
  ATS X-Ray — deterministic (non-AI) PDF parsability analysis.

  Two independent jobs:
    1. detectCv()      — decide whether the uploaded file even looks like a CV,
                         so we can refuse essays / random documents.
    2. structural risk — model how a real ATS linearises the text and flag the
                         layouts that scramble it (columns, tables, header/footer
                         traps, scanned/image PDFs, unreadable files).
*/

// "Strong" headings are specific to resumes — an essay rarely uses them as
// section titles. Two of these together are a reliable CV signal on their own.
const STRONG_SECTION_WORDS = [
  'work experience', 'professional experience', 'employment history',
  'work history', 'employment', 'education', 'experience',
];

// "Generic" headings also appear on resumes but show up in ordinary documents
// too (a report can have a "summary" or list "references"), so they only count
// as supporting evidence alongside contact info or strong sections.
const GENERIC_SECTION_WORDS = [
  'skills', 'technical skills', 'projects', 'certifications', 'certificates',
  'summary', 'profile', 'objective', 'achievements', 'awards',
  'publications', 'references', 'languages', 'volunteer', 'interests',
];

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
// Phone: at least 7 digits allowing spaces, dashes, parens, dots, leading +.
const PHONE_RE = /(\+?\d[\d\s().-]{6,}\d)/;
const YEAR_RE = /\b(19|20)\d{2}\b/;
const MONTH_RE = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i;

/*
  Score whether the extracted text looks like a CV.
  Returns { isCv, missing } where `missing` lists the human-readable signals
  that were absent, for a helpful refusal message.
*/
function detectCv(fullText) {
  const text = (fullText || '').toLowerCase();

  const strongSections = STRONG_SECTION_WORDS.filter((word) => text.includes(word));
  const genericSections = GENERIC_SECTION_WORDS.filter((word) => text.includes(word));
  const foundSections = [...strongSections, ...genericSections];

  const hasContact = EMAIL_RE.test(fullText) || PHONE_RE.test(fullText);
  const hasDates = YEAR_RE.test(fullText) || MONTH_RE.test(fullText);

  // A file is treated as a CV when it shows one of two convincing patterns:
  //   (a) recognisable resume sections AND real contact details, or
  //   (b) two or more strong resume sections (e.g. Experience + Education)
  //       backed by dates, even if contact text couldn't be extracted.
  const isCv =
    (foundSections.length >= 2 && hasContact) ||
    (strongSections.length >= 2 && hasDates);

  const missing = [];
  if (foundSections.length < 2) {
    missing.push('resume sections (e.g. Experience, Education, Skills)');
  }
  if (!hasContact) missing.push('contact details (email or phone)');
  if (!hasDates) missing.push('dates (employment or education years)');

  return { isCv, missing, strongSections, foundSections };
}

/*
  Cluster the x-start positions of items on multi-item lines into bands.
  Two well-populated bands separated by a real horizontal gap indicate a
  genuine multi-column layout (the classic ATS text-scrambler).
*/
function detectColumns(lines) {
  const starts = [];
  lines.forEach((line) => {
    if (line.length >= 2) {
      line.forEach((item) => starts.push(item.x));
    }
  });
  if (starts.length < 6) return false;

  starts.sort((a, b) => a - b);

  // Find the largest gap between consecutive x-starts; if two dense groups sit
  // on either side of a wide gap, it's a column boundary rather than indentation.
  let bestGap = 0;
  let splitIdx = -1;
  for (let i = 1; i < starts.length; i++) {
    const gap = starts[i] - starts[i - 1];
    if (gap > bestGap) {
      bestGap = gap;
      splitIdx = i;
    }
  }

  if (bestGap < 80) return false; // indentation, not a column

  const leftCount = splitIdx;
  const rightCount = starts.length - splitIdx;
  // Both sides need real content, otherwise it's just one stray right-aligned run.
  const minSide = Math.max(3, Math.floor(starts.length * 0.2));
  return leftCount >= minSide && rightCount >= minSide;
}

/*
  Detect table/grid structure: three or more lines that share the same set of
  aligned x-positions look like rows of a table, which ATS parsers mangle.
*/
function detectTables(lines) {
  const signatures = new Map();
  lines.forEach((line) => {
    if (line.length >= 3) {
      // Bucket x-positions to the nearest 10px so near-aligned rows match.
      const sig = line.map((i) => Math.round(i.x / 10) * 10).join(',');
      signatures.set(sig, (signatures.get(sig) || 0) + 1);
    }
  });
  for (const count of signatures.values()) {
    if (count >= 3) return true;
  }
  return false;
}

async function analyzePdfBuffer(buffer) {
  const rawTextStream = [];
  let pageItems = [];
  const risks = [];
  const potentialHeaders = [];
  const potentialFooters = [];

  const render_page = async (pageData) => {
    const textContent = await pageData.getTextContent();
    const items = textContent.items
      .map((item) => ({
        str: item.str,
        x: Math.round(item.transform[4]),
        y: Math.round(item.transform[5]),
        width: item.width,
        height: item.height,
        fontName: item.fontName,
        page: pageData.pageIndex + 1,
      }))
      .filter((item) => item.str.trim().length > 0);

    if (items.length > 0) {
      const sortedByY = [...items].sort((a, b) => b.y - a.y);
      potentialHeaders.push(sortedByY[0].str);
      potentialFooters.push(sortedByY[sortedByY.length - 1].str);
    }

    pageItems = pageItems.concat(items);
    return '';
  };

  // Guard the parser: corrupt/encrypted/odd PDFs must not crash the request.
  let pdfData;
  try {
    pdfData = await pdfParse(buffer, { pagerender: render_page });
  } catch (err) {
    return {
      isCv: false,
      missing: ['a readable PDF (the file could not be parsed)'],
      risks: ['Unreadable PDF'],
      stream: [],
    };
  }

  const numPages = pdfData.numpages || 1;
  // Build the full text from the extracted runs. We can't use pdfData.text here
  // because the custom pagerender returns '' (it collects coordinates instead).
  const fullText = pageItems.map((i) => i.str).join(' ');

  // --- Is this actually a CV? ---
  const { isCv, missing } = detectCv(fullText);

  // --- Scanned / image-only PDF: almost no extractable text runs. ---
  const totalChars = pageItems.reduce((sum, i) => sum + i.str.trim().length, 0);
  if (pageItems.length < 5 || totalChars < 40) {
    risks.push('Scanned or image-based PDF (little or no selectable text)');
  }

  // --- Header / footer traps repeated across pages. ---
  if (numPages > 1) {
    if (potentialHeaders.length === numPages && new Set(potentialHeaders).size === 1) {
      risks.push('Repeated Header Trap');
    }
    if (potentialFooters.length === numPages && new Set(potentialFooters).size === 1) {
      risks.push('Repeated Footer Trap');
    }
  }

  // Sort items into reading order (Page asc, Y desc, X asc).
  pageItems.sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    if (Math.abs(a.y - b.y) > 4) return b.y - a.y;
    return a.x - b.x;
  });

  // Group items into visual lines.
  const lines = [];
  let currentLineY = null;
  let currentLineItems = [];
  let currentPage = null;

  pageItems.forEach((item) => {
    if (currentLineY === null) {
      currentLineY = item.y;
      currentPage = item.page;
      currentLineItems.push(item);
    } else if (item.page === currentPage && Math.abs(item.y - currentLineY) <= 4) {
      currentLineItems.push(item);
    } else {
      lines.push([...currentLineItems]);
      currentLineY = item.y;
      currentPage = item.page;
      currentLineItems = [item];
    }
  });
  if (currentLineItems.length > 0) {
    lines.push(currentLineItems);
  }

  // --- Column detection (per-line gap flag for the stream view). ---
  const columnLayout = detectColumns(lines);
  lines.forEach((line) => {
    const lineStr = line.map((i) => i.str).join(' ');
    const flags = [];

    for (let i = 1; i < line.length; i++) {
      const prevEnd = line[i - 1].x + line[i - 1].width;
      const gap = line[i].x - prevEnd;
      if (gap > 50 && !flags.includes('Column Scrambling')) {
        flags.push('Column Scrambling');
      }
    }

    rawTextStream.push({ text: lineStr, flags });
  });

  if (columnLayout) {
    risks.push('Complex Multi-Column Layout');
  }

  // --- Table / grid detection. ---
  if (detectTables(lines)) {
    risks.push('Table or Grid Structure');
  }

  return {
    isCv,
    missing,
    risks,
    stream: rawTextStream,
  };
}

module.exports = { analyzePdfBuffer, detectCv };
