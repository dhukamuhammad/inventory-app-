const fs = require('fs');
const path = require('path');
const { createWorker } = require('tesseract.js');

async function main() {
  const filePaths = process.argv.slice(2).filter((p) => fs.existsSync(p));
  if (filePaths.length === 0) {
    console.log(JSON.stringify({ success: false, results: [], text: '' }));
    process.exit(0);
  }

  try {
    const worker = await createWorker('eng');
    const results = [];
    for (const fp of filePaths) {
      try {
        const ret = await worker.recognize(fp);
        results.push({ file: fp, success: true, text: ret.data.text || '' });
      } catch (err) {
        results.push({ file: fp, success: false, text: '' });
      }
    }
    await worker.terminate();

    const primaryText = results[0]?.text || '';
    console.log(JSON.stringify({ success: true, results, text: primaryText }));
  } catch (err) {
    console.error(err);
    console.log(JSON.stringify({ success: false, results: [], text: '' }));
  }
}

main();

