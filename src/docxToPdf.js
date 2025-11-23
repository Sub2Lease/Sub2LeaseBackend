const fs = require('node:fs');
const docxConverter = require('docx-pdf');

function convertDocxToPdf(docPath, pdfPath) {
  return new Promise((resolve, reject) => {
    docxConverter(docPath, pdfPath, (err) => {
      if (err) return reject(err);

      // Wait until PDF actually exists
      const start = Date.now();
      const check = () => {
        if (fs.existsSync(pdfPath)) return resolve();
        if (Date.now() - start > 8000) return reject(new Error("PDF was not created in time"));
        setTimeout(check, 150);
      };
      check();
    });
  });
}

module.exports = { convertDocxToPdf };