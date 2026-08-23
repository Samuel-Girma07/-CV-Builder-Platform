const multer = require('multer');

const MAX_CV_SIZE_BYTES = 5 * 1024 * 1024;

/*
  Single factory for every CV intake point (profile parse, ATS X-Ray).
  `limits.fileSize` is mandatory here: with memoryStorage an uncapped
  multipart body is buffered into RAM unbounded and can OOM the process.
*/
function createCvUpload() {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_CV_SIZE_BYTES, files: 1 },
    fileFilter: (req, file, cb) => {
      if (file.mimetype === 'application/pdf') {
        cb(null, true);
        return;
      }
      const err = new Error('Only PDF files are allowed.');
      err.status = 400;
      cb(err);
    },
  });
}

/*
  Mimetype strings are client-controlled, so verify the buffer itself.
  Every valid PDF starts with the "%PDF-" signature.
*/
function isPdfBuffer(buffer) {
  if (!buffer || buffer.length < 5) return false;
  return buffer.slice(0, 5).toString('latin1') === '%PDF-';
}

module.exports = { createCvUpload, isPdfBuffer, MAX_CV_SIZE_BYTES };
