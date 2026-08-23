const fs = require('fs');
const path = require('path');

/*
  Unicode font support for generated PDFs.

  PDFKit's built-in fonts (Helvetica/Times) are limited to WinAnsi/Latin-1 —
  any CJK, Cyrillic, Arabic, or extended-Latin character renders as garbage.
  When Noto Sans is available (vendored in services/fonts, OFL-licensed) the
  PDF services switch to it whenever content needs full Unicode; otherwise
  they fall back to the classic core fonts with zero behavioral change.

  Registration is per-document (PDFKit requirement), so call
  registerUnicodeFonts(doc) once per generated file before rendering.
*/

const FONT_DIR = path.join(__dirname, '..', 'services', 'fonts');
const FONT_FILES = {
  regular: path.join(FONT_DIR, 'NotoSans-Regular.ttf'),
  bold: path.join(FONT_DIR, 'NotoSans-Bold.ttf'),
};

let availability = null;

function filesPresent() {
  if (availability === null) {
    try {
      fs.accessSync(FONT_FILES.regular);
      fs.accessSync(FONT_FILES.bold);
      availability = true;
    } catch (err) {
      availability = false;
    }
  }
  return availability;
}

/**
 * Register Noto Sans under stable names on this document.
 * @returns {boolean} true when the Unicode set is usable on this doc.
 */
function registerUnicodeFonts(doc) {
  if (!filesPresent()) return false;
  try {
    doc.registerFont('NotoSans', FONT_FILES.regular);
    doc.registerFont('NotoSans-Bold', FONT_FILES.bold);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * True when text contains characters outside Latin-1, which is exactly the
 * range PDFKit's core fonts cover reliably.
 */
function hasNonLatin(value) {
  return /[\u0100-\uFFFF]/.test(String(value || ''));
}

module.exports = { registerUnicodeFonts, hasNonLatin, FONT_FILES };
