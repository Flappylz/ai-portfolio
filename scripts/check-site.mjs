import { readFile } from 'node:fs/promises';

const files = ['index.html', 'src/main.js', 'src/styles.css', 'src/data/projects.js'];
const forbidden = [/API_KEY\s*=/i, /SECRET\s*=/i, /TOKEN\s*=/i, /sk-[A-Za-z0-9]{16,}/, /BEGIN (RSA|OPENSSH|EC|PRIVATE) KEY/];
let failed = false;

for (const file of files) {
  const text = await readFile(file, 'utf8');
  for (const pattern of forbidden) {
    if (pattern.test(text)) {
      console.error(`${file}: forbidden pattern ${pattern}`);
      failed = true;
    }
  }
}

const main = await readFile('src/main.js', 'utf8');
for (const required of ['projects', 'method', 'apps', 'appLauncher', 'hashchange', 'github.com/Flappylz', 'Agent Launch Lab', 'speechSynthesis', 'BUILD MODE']) {
  if (!main.includes(required)) {
    console.error(`Missing required site behavior: ${required}`);
    failed = true;
  }
}

for (const file of files) {
  const text = await readFile(file, 'utf8');
  if (text.includes('screenshots/')) {
    console.error(`${file}: legacy screenshot reference found`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log('Portfolio static checks passed.');
