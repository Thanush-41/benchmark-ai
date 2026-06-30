const fs = require('fs');
const path = require('path');
const { parseKaiStream } = require('./src/services/kai.service');
const file = path.join(__dirname, 'src/services/kai.service.test.js');
const content = fs.readFileSync(file, 'utf8');
const rawMatch = content.match(/const rawStream = \[([\s\S]*?)\]\.join\('\\n'\);/m);
console.log('rawMatch', !!rawMatch);
if (!rawMatch) process.exit(1);
const arrText = rawMatch[1].trim();
const lines = arrText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
console.log('line count', lines.length);
lines.forEach((line, idx) => {
  console.log(`line ${idx + 1}: ${JSON.stringify(line)}`);
});
const rawStream = lines.map((l) => eval(l)).join('\n');
console.log('rawStream length', rawStream.length);
console.log('rawStream first 400 chars:' , rawStream.slice(0, 400));
console.log('parse result:', JSON.stringify(parseKaiStream(rawStream)));
