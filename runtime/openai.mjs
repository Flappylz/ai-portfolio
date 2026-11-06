const defaultBaseUrl = 'https://api.openai.com/v1';
const defaultTimeoutMs = 10000;

function config() {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  const baseUrl = String(process.env.OPENAI_BASE_URL || defaultBaseUrl).replace(/\/+$/, '');
  const model = String(process.env.OPENAI_MODEL || '').trim();
  return { apiKey, baseUrl, model };
}

export function openAIConfigStatus() {
  const { apiKey, baseUrl, model } = config();
  return {
    configured: Boolean(apiKey),
    modelConfigured: Boolean(model),
    baseUrlConfigured: Boolean(baseUrl)
  };
}

function safeErrorCode(payload, fallback) {
  const code = payload?.error?.code || payload?.error?.type || fallback;
  return String(code).replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 120);
}

function outputText(payload) {
  const parts = Array.isArray(payload?.output)
    ? payload.output.flatMap((item) => Array.isArray(item?.content) ? item.content : [])
    : [];
  return parts.filter((item) => item?.type === 'output_text').map((item) => item.text || '').join('').trim();
}

export async function probeOpenAI({ generation = false, timeoutMs = defaultTimeoutMs } = {}) {
  const { apiKey, baseUrl, model } = config();
  if (!apiKey) return { configured: false, verified: false, status: null, code: 'MISSING_SECRET' };
  if (generation && !model) return { configured: true, verified: false, status: null, code: 'MODEL_NOT_CONFIGURED' };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const endpoint = generation ? `${baseUrl}/responses` : `${baseUrl}/models`;
  const request = {
    method: generation ? 'POST' : 'GET',
    headers: { authorization: `Bearer ${apiKey}`, accept: 'application/json' },
    signal: controller.signal
  };
  if (generation) {
    request.headers['content-type'] = 'application/json';
    // The current Responses API enforces a minimum of 16 output tokens.
    // Keep the probe intentionally tiny while remaining valid for current models.
    request.body = JSON.stringify({ model, input: 'Reply with exactly: OK', max_output_tokens: 16 });
  }

  try {
    const response = await fetch(endpoint, request);
    const requestId = response.headers.get('x-request-id') || null;
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return { configured: true, verified: false, status: response.status, code: safeErrorCode(payload, `HTTP_${response.status}`), requestId };
    }
    return {
      configured: true,
      verified: true,
      status: response.status,
      code: null,
      requestId,
      endpoint: generation ? 'responses' : 'models',
      model: generation ? model : null,
      responseId: generation && typeof payload?.id === 'string' ? payload.id : null
    };
  } catch (error) {
    return {
      configured: true,
      verified: false,
      status: null,
      code: error?.name === 'AbortError' ? 'TIMEOUT' : 'UPSTREAM_UNREACHABLE'
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateOpenAI({ input, model: requestedModel, timeoutMs = 20000 } = {}) {
  const { apiKey, baseUrl, model: configuredModel } = config();
  if (!apiKey) return { configured: false, verified: false, status: null, code: 'MISSING_SECRET' };
  const model = String(requestedModel || configuredModel || '').trim();
  if (!model) return { configured: true, verified: false, status: null, code: 'MODEL_NOT_CONFIGURED' };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}/responses`, {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ model, input: String(input || '').slice(0, 6000), max_output_tokens: 64 }),
      signal: controller.signal
    });
    const payload = await response.json().catch(() => null);
    const requestId = response.headers.get('x-request-id') || null;
    if (!response.ok) return { configured: true, verified: false, status: response.status, code: safeErrorCode(payload, `HTTP_${response.status}`), requestId };
    return { configured: true, verified: true, status: response.status, code: null, requestId, responseId: payload?.id || null, model, text: outputText(payload).slice(0, 4000) };
  } catch (error) {
    return { configured: true, verified: false, status: null, code: error?.name === 'AbortError' ? 'TIMEOUT' : 'UPSTREAM_UNREACHABLE' };
  } finally {
    clearTimeout(timeout);
  }
}
