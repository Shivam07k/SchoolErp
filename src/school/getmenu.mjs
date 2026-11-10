const fs = require('fs');
const m = fs.readFileSync('menu.js','utf8');
const idx = m.indexOf('"key": "students"');
if(idx>=0) {
  const end = m.indexOf('  },', idx);
  console.log(m.slice(idx-40, end+5));
}
