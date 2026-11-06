import './env.mjs';
import { probeOpenAI } from './openai.mjs';

const generation = process.argv.includes('--generation');
const result = await probeOpenAI({ generation });
console.log(`openai ${generation ? 'generation' : 'auth'} probe: ${JSON.stringify(result)}`);
if (!result.verified) process.exitCode = 1;
