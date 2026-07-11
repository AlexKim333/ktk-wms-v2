const fs = require('fs');

const files = ['new_submit.txt', 'old_submit.txt', 'old_pos.txt', 'old_outbound.txt'];

files.forEach(file => {
  if (fs.existsSync(file)) {
    const buf = fs.readFileSync(file);
    const str = buf.toString('utf16le');
    fs.writeFileSync(file.replace('.txt', '_utf8.txt'), str, 'utf8');
    console.log(`Converted ${file} to ${file.replace('.txt', '_utf8.txt')}`);
  }
});
