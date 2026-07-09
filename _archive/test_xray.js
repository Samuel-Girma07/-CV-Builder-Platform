const fs = require('fs');
const PDFDocument = require('pdfkit');
const { analyzePdfBuffer } = require('./utils/atsXray');

async function createDummyPdf() {
  return new Promise((resolve) => {
    const doc = new PDFDocument();
    let buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    
    // Column 1
    doc.text('Experience', 50, 50);
    doc.text('Software Engineer', 50, 70);
    doc.text('Built things', 50, 90);
    
    // Column 2
    doc.text('Education', 300, 50);
    doc.text('BSc Computer Science', 300, 70);
    doc.text('University of XYZ', 300, 90);
    
    doc.end();
  });
}

async function runTest() {
  console.log('Generating dummy PDF...');
  const buffer = await createDummyPdf();
  console.log('Running ATS X-Ray...');
  const result = await analyzePdfBuffer(buffer);
  console.log('Result:', JSON.stringify(result, null, 2));
}

runTest().catch(console.error);
