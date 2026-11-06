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
const index = await readFile('index.html', 'utf8');
const siteText = main + index;
for (const required of ['projects', 'method', 'apps', 'appLauncher', 'voiceScenarioView', 'runtimeMode', 'voiceCallStatus', 'LiveKit WebRTC', 'sandbox / simulated', 'hashchange', 'github.com/Flappylz', 'speechSynthesis', 'fengliangze-ai-voice-runtime.wellsfung.chatgpt.site']) {
  if (!siteText.includes(required)) {
    console.error(`Missing required site behavior: ${required}`);
    failed = true;
  }
}

for (const forbiddenRuntimeSecret of ['data-voice-api-key', 'xi-api-key', 'api.elevenlabs.io/v1/text-to-speech']) {
  if (main.includes(forbiddenRuntimeSecret)) {
    console.error(`src/main.js: browser-side ElevenLabs secret path found: ${forbiddenRuntimeSecret}`);
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
