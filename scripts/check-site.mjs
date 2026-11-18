import { readFile } from 'node:fs/promises';

const files = ['index.html', 'src/main.js', 'src/styles.css', 'src/data/projects.js', 'src/voice-settings.js'];
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
const voiceSettings = await readFile('src/voice-settings.js', 'utf8');
const siteText = main + index;
for (const required of ['apps', 'appLauncher', 'aboutView', 'projectsView', 'methodView', 'contactView', 'resume-download', 'assets/portfolio-qr.svg', 'voiceScenarioView', 'voice-details', 'runtimeMode', 'voiceCallStatus', 'LiveKit WebRTC', 'sandbox / simulated', 'hashchange', 'github.com/Flappylz', 'speechSynthesis', 'partial_transcript', 'tts_first_byte', 'data-voice-captions', 'data-voice-model', 'data-voice-agent-model', 'data-voice-asr-model', 'data-voice-tone', 'data-voice-pitch', 'data-voice-volume', 'data-voice-preview', 'data-voice-style', 'data-voice-output-format', 'data-voice-chunk-schedule', 'data-voice-barge-in', 'voiceInsights', 'eleven_turbo_v2_5', 'fengliangze-ai-voice-runtime.wellsfung.chatgpt.site']) {
  if (!siteText.includes(required)) {
    console.error(`Missing required site behavior: ${required}`);
    failed = true;
  }
}

for (const forbiddenRuntimeSecret of ['data-voice-api-key', 'xi-api-key', 'api.elevenlabs.io/v1/text-to-speech']) {
  if (main.includes(forbiddenRuntimeSecret) || voiceSettings.includes(forbiddenRuntimeSecret)) {
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

const resume = await readFile('public/resume/fengliangze-ai-product-manager.pdf');
if (resume.subarray(0, 5).toString() !== '%PDF-') {
  console.error('The public resume download is not a PDF.');
  failed = true;
}

if (failed) process.exit(1);
console.log('Portfolio static checks passed.');
