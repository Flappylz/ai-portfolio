import QRCode from 'qrcode';
import { mkdir, writeFile } from 'node:fs/promises';

const url = 'https://flappylz.github.io/ai-portfolio/';
const svg = await QRCode.toString(url, {
  type: 'svg',
  margin: 2,
  color: { dark: '#0b1020', light: '#ffffff' },
  width: 420
});

await mkdir('public/assets', { recursive: true });
await writeFile('public/assets/portfolio-qr.svg', svg, 'utf8');
console.log(`Generated QR for ${url}`);
