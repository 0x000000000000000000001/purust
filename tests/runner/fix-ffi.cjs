const fs = require('fs');
const path = require('path');
const execSync = require('child_process').execSync;

const files = execSync('find /Users/0x1/Documents/htdocs/purust -name "*.rs" -type f -exec grep -l "UnknownType::new(0)" {} +')
  .toString()
  .split('\n')
  .filter(f => f.trim().length > 0 && !f.includes('/output/') && !f.includes('/output-test/'));

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/crate::UnknownType::new\(0\)/g, 'crate::Value::Thunk(perceus_ptr::PerceusPtr::new(crate::Thunk { ..Default::default() }))');
  fs.writeFileSync(file, content);
  console.log('Fixed ' + file);
}
