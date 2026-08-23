describe('config/upload', () => {
  const { createCvUpload, isPdfBuffer } = require('../config/upload');

  test('isPdfBuffer accepts real PDF signatures only', () => {
    expect(isPdfBuffer(Buffer.from('%PDF-1.7\n...'))).toBe(true);
    expect(isPdfBuffer(Buffer.from('<html>not a pdf</html>'))).toBe(false);
    expect(isPdfBuffer(Buffer.from(''))).toBe(false);
    expect(isPdfBuffer(null)).toBe(false);
  });

  test('factory enforces a hard file-size cap on every instance', () => {
    const upload = createCvUpload();
    expect(upload.limits.fileSize).toBe(5 * 1024 * 1024);
    expect(upload.limits.files).toBe(1);
    expect(upload.storage).toBeTruthy();
  });

  test('fileFilter rejects non-PDF mimetypes with a 400-stamped error', () => {
    const upload = createCvUpload();
    const fileFilter = upload.fileFilter;
    const cb = jest.fn();

    fileFilter({}, { mimetype: 'application/pdf' }, cb);
    expect(cb).toHaveBeenCalledWith(null, true);

    fileFilter({}, { mimetype: 'application/zip' }, cb);
    const [err] = cb.mock.calls[1];
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(400);
    expect(err.message).toMatch(/PDF/i);
  });
});
