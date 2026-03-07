const fs = require('node:fs');
const path = require('node:path');
const Mocha = require('mocha');

async function run() {
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
    timeout: 20000,
  });

  const suiteDir = __dirname;
  for (const file of fs.readdirSync(suiteDir)) {
    if (file.endsWith('.test.cjs')) {
      mocha.addFile(path.join(suiteDir, file));
    }
  }

  await new Promise((resolve, reject) => {
    mocha.run((failures) => {
      if (failures > 0) {
        reject(new Error(`${failures} test(s) failed.`));
        return;
      }

      resolve();
    });
  });
}

module.exports = { run };
