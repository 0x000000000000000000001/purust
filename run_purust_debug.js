import { execSync } from 'child_process';
try {
  execSync('spago build', { stdio: 'inherit' });
  execSync('../../bin/rust/run -c > /tmp/purust_debug.log 2>&1');
} catch (e) {
  console.log("Failed", e.message);
}
