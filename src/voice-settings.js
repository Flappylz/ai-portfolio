const fallbackModels = {
  llmModels: [{ id: 'openai/gpt-6.1-sol', name: 'GPT-6.1 Sol', reasoningEfforts: ['low', 'medium', 'high', 'xhigh', 'max'] }],
  asrModels: [{ id: 'openai/gpt-live-transcribe', name: 'GPT Live Transcribe' }],
  ttsModels: [{
    id: 'eleven_flash_v2_5', name: 'Eleven Flash v2.5', live: true, transport: 'websocket',
    languages: [{ code: 'zh', name: '中文' }], capabilities: { style: false, speed: true, speakerBoost: true }
  }]
};

const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);

const englishModelName = (items, id) => items.find((item) => item.id === id)?.name || id;
const languageName = new Intl.DisplayNames(['zh-CN'], { type: 'language' });
const localeName = (language) => {
  try { return languageName.of(language.code) || language.name; }
  catch { return language.name; }
};

export const newVoiceSettings = {
  interactionType: 'voice_call',
  vad: 'silero_vad',
  bargeIn: 'server_vad',
  noiseReduction: true,
  groundedFastPath: true,
  fastReasoningEffort: 'low',
  slowReasoningEffort: 'low',
  fastMaxOutputTokens: 512,
  slowMaxOutputTokens: 1024,
  fastUseWebSocket: true,
  slowUseWebSocket: true,
  fastParallelToolCalls: true,
  slowParallelToolCalls: true,
  fastServiceTier: 'default',
  slowServiceTier: 'default',
  fastTemperature: 1,
  slowTemperature: 1,
  deepTimeoutMs: 5000,
  speculativeLookup: true,
  asrLanguage: 'auto',
  asrPrompt: '',
  asrKeyterms: '',
  asrNoiseReductionType: 'near_field',
  asrSampleRate: 16000,
  asrChunkMs: 100,
  asrIncludeTimestamps: false,
  ttsLanguage: 'auto',
  enableSsmlParsing: false,
  applyTextNormalization: 'auto',
  applyLanguageTextNormalization: false,
  preferredAlignment: 'original',
  pronunciationDictionaries: [],
  ttsInactivityTimeoutSec: 60,
  useSpeakerBoost: false,
  autoMode: false,
  vadMinSilenceMs: 370,
  vadMinSpeechMs: 100,
  vadThreshold: 0.5,
  vadPrefixPaddingMs: 500,
  endpointMinMs: 100,
  endpointMaxMs: 2000,
  interruptionMinMs: 500,
  interruptionMinWords: 0,
  silenceStrategy: false,
  hangupStrategy: false,
  userAwayTimeoutSec: 18,
  allowInterruption: true,
  maxCallTime: 1800
};

export function createVoiceSettings({ endpoint, read, change, scenario }) {
  let catalog = fallbackModels;
  let loaded = false;
  let catalogStatus = '';
  let dialog;
  let trigger;
  let voices = [];
  let nextCursor = null;
  let query = '';
  let scope = 'available';
  let voiceLanguage = '';
  let voiceAccent = '';
  let voiceRequest = 0;
  let voiceTimer;
  let audio;
  let audioUrl;
  let previewRequest = 0;
  let previewAbort;
  let previewText = '';
  let selectedVoiceName = '';
  let previewStatus = '';
  let voiceStatus = '';

  const labelText = (label, disabled) => String(label) + (disabled ? ' <small class="settings-support-note">当前模型不支持，已保留参数</small>' : '');
  const select = (label, key, value, options, disabled = false) =>
    '<label' + (disabled ? ' class="settings-unsupported"' : '') + '>' + labelText(label, disabled) + '<select data-settings-key="' + key + '"' + (disabled ? ' disabled' : '') + '>' +
    options.map(([id, name, unavailable]) => '<option value="' + escape(id) + '"' + (String(id) === String(value) ? ' selected' : '') + (unavailable ? ' disabled' : '') + '>' + escape(name) + '</option>').join('') +
    '</select></label>';
  const number = (label, key, value, min, max, step = 1, disabled = false) =>
    '<label' + (disabled ? ' class="settings-unsupported"' : '') + '>' + labelText(label, disabled) + '<input type="number" data-settings-key="' + key + '" value="' + escape(value) + '" min="' + min + '" max="' + max + '" step="' + step + '"' + (disabled ? ' disabled' : '') + '></label>';
  const slider = (label, key, value, min, max, step, disabled = false) =>
    '<label' + (disabled ? ' class="settings-unsupported"' : '') + '><span>' + labelText(label, disabled) + ' <output data-settings-output="' + key + '">' + escape(value) + '</output></span><input type="range" data-settings-key="' + key + '" value="' + escape(value) + '" min="' + min + '" max="' + max + '" step="' + step + '"' + (disabled ? ' disabled' : '') + '></label>';
  const toggle = (label, key, value, disabled = false) =>
    '<label class="toggle-field' + (disabled ? ' settings-unsupported' : '') + '"><span>' + labelText(label, disabled) + '</span><input type="checkbox" data-settings-key="' + key + '"' + (value ? ' checked' : '') + (disabled ? ' disabled' : '') + '></label>';
  const input = (label, key, value, limit, disabled = false) =>
    '<label' + (disabled ? ' class="settings-unsupported"' : '') + '>' + labelText(label, disabled) + '<input data-settings-key="' + key + '" value="' + escape(value) + '" maxlength="' + limit + '"' + (disabled ? ' disabled' : '') + '></label>';
  const group = (id, title, hint, body) =>
    '<details class="settings-disclosure" data-settings-group="' + id + '"><summary><span>' + title + '</span><small>' + hint + '</small><b aria-hidden="true">⌄</b></summary><div class="settings-disclosure-body">' + body + '</div></details>';

  function voiceList() {
    const current = read().voiceId;
    return '<p class="voice-catalog-status" role="status">' + escape(voiceStatus) + '</p>' +
      '<ul class="voice-catalog-list" aria-label="音色结果">' + voices.map((voice) => {
        const subtitle = [voice.language, voice.accent, voice.category].filter(Boolean).join(' · ');
        return '<li><div><strong>' + escape(voice.name) + '</strong><small>' + escape(subtitle) + '</small></div>' +
          (voice.selectable ? '<button type="button" data-pick-voice="' + escape(voice.id) + '" aria-pressed="' + (current === voice.id) + '">' + (current === voice.id ? '已选' : '选择') + '</button>' :
          '<small>需加入 ElevenLabs 账号</small>') +
          (voice.previewUrl ? '<button type="button" data-sample-voice="' + escape(voice.id) + '">样音</button>' : '') + '</li>';
      }).join('') + '</ul>' +
      (nextCursor != null ? '<button type="button" data-more-voices>加载更多</button>' : '');
  }

  function draw() {
    if (!dialog?.open) return;
    const previous = dialog.querySelector('.voice-settings-content');
    const scroll = previous?.scrollTop;
    const groups = new Set([...dialog.querySelectorAll('[data-settings-group][open]')].map((node) => node.dataset.settingsGroup));
    const activeKey = dialog.contains(document.activeElement) ? document.activeElement.dataset.settingsKey : null;
    if (!previous) ['basic', 'llm', 'asr', 'tts', 'call'].forEach((id) => groups.add(id));
    const current = read();
    const config = current.voiceConfig;
    const model = catalog.ttsModels.find((item) => item.id === current.ttsModel);
    const optionsForLanguage = (entries) => [...new Map(entries.map((item) => [item.code, localeName(item)]))];
    const languages = optionsForLanguage(model?.languages ?? []);
    const allLanguages = optionsForLanguage(catalog.ttsModels.flatMap((item) => item.languages || []));
    if (!allLanguages.some(([code]) => code === current.language)) allLanguages.unshift([current.language, current.language]);
    const capabilities = model?.capabilities || {};
    const asr = catalog.asrModels.find((item) => item.id === current.asrModel)?.capabilities || {};
    const llmOptions = catalog.llmModels.map((item) => [item.id, item.name]);
    const lane = (name, key, modelId) => {
      const llm = catalog.llmModels.find((item) => item.id === modelId);
      const efforts = (llm?.reasoningEfforts || ['low', 'medium', 'high', 'xhigh', 'max']).map((effort) => [effort, effort]);
      const supportsTemperature = llm?.supportsTemperature === true;
      return group(key, name, modelId, select('模型', key + 'Model', modelId, llmOptions) +
        select('推理强度', 'config.' + key + 'ReasoningEffort', config[key + 'ReasoningEffort'] || 'low', efforts, !efforts.length) +
        number('输出 Token 上限', 'config.' + key + 'MaxOutputTokens', config[key + 'MaxOutputTokens'], 16, 4096) +
        toggle('复用 Responses WebSocket', 'config.' + key + 'UseWebSocket', config[key + 'UseWebSocket']) +
        toggle('并行工具调用', 'config.' + key + 'ParallelToolCalls', config[key + 'ParallelToolCalls']) +
        select('服务层级', 'config.' + key + 'ServiceTier', config[key + 'ServiceTier'],
          [['default', '标准'], ['auto', '账户默认'], ['priority', 'Priority'], ['flex', 'Flex']]) +
        slider('Temperature', 'config.' + key + 'Temperature', config[key + 'Temperature'] ?? 1, 0, 2, .05, !supportsTemperature));
    };
    const ttsOptions = catalog.ttsModels.map((item) => [item.id, item.name + (item.live ? '' : ' · 仅试听'), !item.live]);
    const defaultFormats = ['pcm_22050'];
    const supports = (name) => model ? capabilities[name] === true : false;
    const formatOptions = model?.outputFormats?.length ? model.outputFormats : ['pcm_16000', 'pcm_22050', 'pcm_44100', 'mp3_22050_32', 'mp3_44100_64', 'mp3_44100_128', 'mp3_44100_192'];
    const mediaControls = [
      select('合成语言', 'config.ttsLanguage', config.ttsLanguage, [['auto', '自动识别文本'], ...allLanguages], !languages.length),
      select('通话音频格式', 'config.outputFormat', config.outputFormat, formatOptions.map((id) => [id, id]), !model),
      slider('语速', 'config.speed', config.speed, .7, 1.2, .05, !supports('speed')),
      slider('稳定性', 'config.stability', config.stability, 0, 1, .05, !model),
      slider('音色相似度', 'config.similarity', config.similarity, 0, 1, .05, !supports('similarity')),
      slider('风格强度', 'config.style', config.style, 0, 1, .05, !supports('style')),
      toggle('音色增强', 'config.useSpeakerBoost', config.useSpeakerBoost, !supports('speakerBoost')),
      toggle('自动分块', 'config.autoMode', config.autoMode, !supports('autoMode')),
      input('手动分块（50–500 字符，以逗号分隔）', 'config.chunkSchedule', config.chunkSchedule, 64, !supports('chunkSchedule') || config.autoMode),
      toggle('解析 SSML', 'config.enableSsmlParsing', config.enableSsmlParsing, !supports('ssml')),
      input('发音词典（最多三组 ID/版本，以逗号分隔）', 'config.pronunciationDictionaries',
        (config.pronunciationDictionaries || []).map((item) => item.pronunciation_dictionary_id + '/' + item.version_id).join(', '), 800, !supports('pronunciationDictionaries')),
      select('文本规范化', 'config.applyTextNormalization', config.applyTextNormalization, [['auto', '自动'], ['on', '开启'], ['off', '关闭']], !model),
      toggle('语言专属的文本规范化', 'config.applyLanguageTextNormalization', config.applyLanguageTextNormalization, !supports('ssml')),
      select('字幕来源', 'config.preferredAlignment', config.preferredAlignment, [['original', '回复原文'], ['normalized', '服务商规范化文本']], !model),
      number('TTS 流空闲超时（秒）', 'config.ttsInactivityTimeoutSec', config.ttsInactivityTimeoutSec, 5, 180),
      select('说话语气（提示词）', 'config.tone', config.tone, [['neutral', '自然'], ['warm', '温暖'], ['professional', '专业'], ['energetic', '活跃']]),
      select('表达方式（提示词）', 'config.emotion', config.emotion, [['neutral', '默认'], ['calm', '平静'], ['happy', '积极'], ['empathetic', '共情']])
    ].join('');
    const voiceLanguageFilter = '<label>筛选语种<select data-voice-language><option value="">全部</option>' +
      allLanguages.map(([id, name]) => '<option value="' + escape(id) + '"' + (id === voiceLanguage ? ' selected' : '') + '>' + escape(name) + '</option>').join('') +
      '</select></label>';
    dialog.innerHTML = '<header class="voice-settings-toolbar"><div><h2 id="voice-settings-title">语音设置</h2><p>音量立即生效。模型、音色与高级参数用于下次通话。</p></div>' +
      '<div class="voice-settings-toolbar-actions"><button type="button" data-expand-all-settings>展开全部</button><button type="button" data-collapse-all-settings>收起全部</button><button type="button" data-close-settings aria-label="关闭语音设置">关闭</button></div></header>' +
      '<div class="voice-settings-content settings-stack">' +
      (catalogStatus ? '<p class="voice-catalog-status" role="status">' + escape(catalogStatus) + '</p>' : '') +
      group('basic', '常用设置', '语言 · 音色 · 试听',
        select('通话语言', 'language', current.language, allLanguages) +
        slider('播放音量', 'config.volume', config.volume, 0, 1, .05) +
        '<div class="voice-catalog-controls"><strong>当前音色 <span data-current-voice>' + escape(current.voiceId === 'default' ? '场景默认' : selectedVoiceName || current.voiceId) + '</span></strong>' +
        '<button type="button" data-pick-default>恢复场景默认</button>' +
        '<label>音色库<select data-voice-scope><option value="available"' + (scope === 'available' ? ' selected' : '') + '>可用音色</option><option value="shared"' + (scope === 'shared' ? ' selected' : '') + '>共享音色库</option></select></label>' +
        '<label>搜索音色<input type="search" data-voice-search value="' + escape(query) + '" placeholder="按名称或描述搜索"></label>' + voiceLanguageFilter +
        '<label>筛选口音<input data-voice-accent value="' + escape(voiceAccent) + '" placeholder="例如 american"></label><div data-voice-list>' + voiceList() + '</div></div>' +
        '<div class="voice-preview-block"><label>试听文案<textarea data-preview-text rows="2" maxlength="280" placeholder="留空使用当前语言的默认试听台词">' + escape(previewText) + '</textarea></label>' +
        '<button type="button" class="voice-preview-button" data-play-preview>试听当前音色</button><p data-preview-status role="status">' + escape(previewStatus) + '</p></div>') +
      group('llm', '对话与核验', 'LLM 模型与推理',
        lane('对话模型', 'fast', current.fastModel) + lane('核验模型', 'slow', current.slowModel) +
        toggle('根据实时字幕提前核验', 'config.speculativeLookup', config.speculativeLookup) +
        number('核验超时（毫秒）', 'config.deepTimeoutMs', config.deepTimeoutMs, 500, 12000, 100)) +
      group('asr', '语音识别', 'ASR 模型 · 语言 · 词汇 · 音频',
        select('实时 ASR 模型', 'asrModel', current.asrModel, catalog.asrModels.map((item) => [item.id, item.name])) +
        select('识别语言', 'config.asrLanguage', config.asrLanguage, [['auto', '自动识别'], ...allLanguages]) +
        input('转写提示（场景词汇）', 'config.asrPrompt', config.asrPrompt, 500, !asr.prompt) +
        input('热词（逗号分隔）', 'config.asrKeyterms', config.asrKeyterms, 320, !asr.keyterms) +
        select('识别侧降噪', 'config.asrNoiseReductionType', config.asrNoiseReductionType,
          [['near_field', '近场'], ['far_field', '远场'], ['off', '关闭']], !asr.noiseReduction) +
        select('采样率', 'config.asrSampleRate', config.asrSampleRate,
          [8000, 16000, 22050, 24000, 44100, 48000].map((hz) => [hz, hz + ' Hz']), !asr.sampleRate) +
        number('音频分块（毫秒）', 'config.asrChunkMs', config.asrChunkMs, 50, 1000, 10, !asr.chunkMs) +
        toggle('词级时间戳', 'config.asrIncludeTimestamps', config.asrIncludeTimestamps, !asr.timestamps)) +
      group('tts', '声音合成', 'TTS 模型与参数',
        select('ElevenLabs TTS 模型', 'ttsModel', current.ttsModel, ttsOptions) + mediaControls) +
      group('call', '通话控制', 'Interaction · VAD · 降噪 · 打断 · 静默',
        select('交互类型', 'config.interactionType', config.interactionType || 'voice_call',
          [['voice_call', 'Voice Call'], ['voice_assistant', 'Voice Assistant']]) +
        select('VAD 引擎', 'config.vad', config.vad || 'silero_vad',
          [['silero_vad', 'Silero VAD'], ['server_vad', 'Server VAD'], ['semantic_vad', 'Semantic VAD']]) +
        select('插话策略', 'config.bargeIn', config.bargeIn || 'server_vad',
          [['server_vad', 'Server VAD'], ['semantic_vad', 'Semantic VAD'], ['off', '关闭']]) +
        number('句尾静音（毫秒）', 'config.vadMinSilenceMs', config.vadMinSilenceMs, 100, 3000) +
        number('最短语音（毫秒）', 'config.vadMinSpeechMs', config.vadMinSpeechMs, 20, 1500) +
        slider('Silero VAD 检测阈值', 'config.vadThreshold', config.vadThreshold, .1, .9, .05) +
        number('语音前置缓冲（毫秒）', 'config.vadPrefixPaddingMs', config.vadPrefixPaddingMs, 0, 1500) +
        number('轮次结束最短等待（毫秒）', 'config.endpointMinMs', config.endpointMinMs, 100, 3000) +
        number('轮次结束最长等待（毫秒）', 'config.endpointMaxMs', config.endpointMaxMs, config.endpointMinMs, 10000) +
        toggle('浏览器降噪', 'config.noiseReduction', config.noiseReduction) +
        toggle('允许用户打断播报', 'config.allowInterruption', config.allowInterruption) +
        number('打断所需语音（毫秒）', 'config.interruptionMinMs', config.interruptionMinMs, 50, 3000) +
        number('打断所需最少词数', 'config.interruptionMinWords', config.interruptionMinWords, 0, 10) +
        toggle('静音时询问是否还在', 'config.silenceStrategy', config.silenceStrategy) +
        number('静音提醒等待（秒）', 'config.userAwayTimeoutSec', config.userAwayTimeoutSec, 5, 120) +
        toggle('持续静音后挂断', 'config.hangupStrategy', config.hangupStrategy) +
        number('最长通话（秒）', 'config.maxCallTime', config.maxCallTime, 30, 7200) +
        toggle('规则命中直答（低延迟路径）', 'config.groundedFastPath', config.groundedFastPath) +
        number('慢模型核验超时（毫秒）', 'config.deepTimeoutMs', config.deepTimeoutMs, 500, 12000, 100) +
        toggle('根据实时字幕提前核验', 'config.speculativeLookup', config.speculativeLookup)) + '</div>';
    dialog.querySelectorAll('[data-settings-group]').forEach((element) => { element.open = groups.has(element.dataset.settingsGroup); });
    if (scroll) dialog.querySelector('.voice-settings-content').scrollTop = scroll;
    if (activeKey) dialog.querySelector('[data-settings-key="' + activeKey + '"]')?.focus({ preventScroll: true });
  }

  function replaceVoiceList() {
    const list = dialog?.querySelector('[data-voice-list]');
    if (list) list.innerHTML = voiceList();
    const status = dialog?.querySelector('[data-current-voice]');
    if (status) status.textContent = read().voiceId === 'default' ? '场景默认' : selectedVoiceName || read().voiceId;
  }

  async function loadVoices(append = false) {
    const ticket = ++voiceRequest;
    const cursor = nextCursor;
    if (!append) { voices = []; nextCursor = null; }
    voiceStatus = '正在载入音色…';
    replaceVoiceList();
    try {
      const params = new URLSearchParams({ scope, search: query, language: voiceLanguage, accent: voiceAccent });
      if (append && cursor != null) params.set('cursor', cursor);
      const response = await fetch(endpoint('/api/voice/catalog/voices?' + params), { signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const result = await response.json();
      if (ticket !== voiceRequest) return;
      voices = [...voices, ...result.voices];
      nextCursor = result.nextCursor;
      voiceStatus = voices.length ? '' : '没有符合条件的音色';
    } catch (error) {
      if (ticket !== voiceRequest) return;
      voiceStatus = '音色暂时无法加载 · ' + error.message;
    }
    replaceVoiceList();
  }

  function setPreviewStatus(message) {
    previewStatus = message;
    const feedback = dialog?.querySelector('[data-preview-status]');
    if (feedback) feedback.textContent = message;
  }

  function stopPreview() {
    previewRequest += 1;
    previewAbort?.abort();
    audio?.pause();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = null;
    audio = null;
  }

  async function preview(sample) {
    stopPreview();
    const ticket = previewRequest;
    setPreviewStatus('正在准备试听…');
    try {
      if (sample) audio = new Audio(sample);
      else {
        previewAbort = new AbortController();
        const response = await fetch(endpoint('/api/voice/preview'), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...read(), scenario: scenario(), text: previewText.trim() }),
          signal: AbortSignal.any([previewAbort.signal, AbortSignal.timeout(15000)])
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || 'HTTP ' + response.status);
        }
        const clip = await response.blob();
        if (ticket !== previewRequest) return;
        audioUrl = URL.createObjectURL(clip);
        audio = new Audio(audioUrl);
      }
      audio.volume = Number(read().voiceConfig.volume);
      audio.addEventListener('ended', () => { if (ticket === previewRequest) setPreviewStatus('试听结束'); });
      audio.addEventListener('error', () => { if (ticket === previewRequest) setPreviewStatus('试听音频加载失败'); });
      await audio.play();
      if (ticket === previewRequest) setPreviewStatus('正在播放试听');
    } catch (error) {
      if (ticket === previewRequest) setPreviewStatus('试听失败 · ' + error.message);
    }
  }

  function open(button) {
    trigger = button;
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.className = 'voice-settings-dialog';
      dialog.setAttribute('aria-labelledby', 'voice-settings-title');
      dialog.addEventListener('close', () => {
        stopPreview();
        previewStatus = '';
        trigger?.isConnected ? trigger.focus() : document.querySelector('[data-open-voice-settings]')?.focus();
      });
      dialog.addEventListener('click', (event) => {
        const target = event.target.closest('button');
        if (!target) return;
        if (target.hasAttribute('data-expand-all-settings')) { dialog.querySelectorAll('[data-settings-group]').forEach((group) => { group.open = true; }); return; }
        if (target.hasAttribute('data-collapse-all-settings')) { dialog.querySelectorAll('[data-settings-group]').forEach((group) => { group.open = false; }); return; }
        if (target.hasAttribute('data-close-settings')) dialog.close();
        if (target.hasAttribute('data-play-preview')) void preview();
        if (target.hasAttribute('data-more-voices')) void loadVoices(true);
        if (target.hasAttribute('data-pick-default')) { change('voiceId', 'default'); replaceVoiceList(); }
        if (target.dataset.pickVoice) {
          const voice = voices.find((item) => item.id === target.dataset.pickVoice && item.selectable);
          if (voice) { selectedVoiceName = voice.name; change('voiceId', voice.id); replaceVoiceList(); }
        }
        if (target.dataset.sampleVoice) {
          const sample = voices.find((item) => item.id === target.dataset.sampleVoice)?.previewUrl;
          if (sample?.startsWith('https://')) void preview(sample);
        }
      });
      dialog.addEventListener('input', (event) => {
        const target = event.target;
        if (target.matches('[data-preview-text]')) previewText = target.value;
        if (target.matches('[data-voice-search]')) {
          query = target.value.trim();
          clearTimeout(voiceTimer);
          voiceRequest += 1;
          voiceTimer = setTimeout(() => loadVoices(), 250);
        }
        if (target.type === 'range') {
          change(target.dataset.settingsKey, Number(target.value));
          dialog.querySelector('[data-settings-output="' + target.dataset.settingsKey + '"]').textContent = target.value;
          if (audio && target.dataset.settingsKey === 'config.volume') audio.volume = Number(target.value);
        }
      });
      dialog.addEventListener('change', (event) => {
        const target = event.target;
        if (target.matches('[data-voice-scope]')) { scope = target.value; void loadVoices(); return; }
        if (target.matches('[data-voice-language]')) { voiceLanguage = target.value; void loadVoices(); return; }
        if (target.matches('[data-voice-accent]')) { voiceAccent = target.value.trim(); void loadVoices(); return; }
        const key = target.dataset.settingsKey;
        if (!key || target.type === 'range') return;
        if (target.type === 'number' && !target.checkValidity()) {
          target.reportValidity();
          target.value = read().voiceConfig[key.split('.').at(-1)];
          return;
        }
        let value = target.type === 'checkbox' ? target.checked : target.type === 'number' ? Number(target.value) : target.value;
        if (key === 'config.asrSampleRate') value = Number(value);
        if (key === 'config.pronunciationDictionaries') {
          const ids = value.split(/[,，]/).map((pair) => pair.trim()).filter(Boolean);
          if (ids.length > 3 || ids.some((pair) => !/^[a-zA-Z0-9_-]{1,128}\/[a-zA-Z0-9_-]{1,128}$/.test(pair))) {
            target.setCustomValidity('请输入最多三组词典 ID/版本，使用逗号分隔');
            target.reportValidity();
            target.setCustomValidity('');
            return;
          }
          value = ids.map((pair) => {
            const [pronunciation_dictionary_id, version_id] = pair.split('/');
            return { pronunciation_dictionary_id, version_id };
          });
        }
        change(key, value);
        if (key === 'ttsModel') {
          const chosen = catalog.ttsModels.find((item) => item.id === value);
          if (!chosen?.languages.some((item) => item.code === read().voiceConfig.ttsLanguage)) change('config.ttsLanguage', 'auto');
          if (chosen?.outputFormats?.length && !chosen.outputFormats.includes(read().voiceConfig.outputFormat)) change('config.outputFormat', chosen.outputFormats[0]);
        }
        if (key === 'config.endpointMinMs' && value > read().voiceConfig.endpointMaxMs) change('config.endpointMaxMs', value);
        if (['ttsModel', 'fastModel', 'slowModel', 'asrModel', 'config.autoMode', 'config.allowInterruption', 'config.silenceStrategy', 'config.hangupStrategy', 'config.endpointMinMs'].includes(key)) draw();
      });
      document.body.append(dialog);
    }
    dialog.showModal();
    catalogStatus = loaded ? '' : '正在读取服务端模型目录…';
    draw();
    if (!loaded) {
      fetch(endpoint('/api/voice/catalog'), { signal: AbortSignal.timeout(12000) }).then(async (response) => {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        catalog = await response.json();
        loaded = true;
        catalogStatus = '';
        draw();
      }).catch((error) => { catalogStatus = '模型目录暂时无法加载 · ' + error.message; draw(); });
    }
    void loadVoices();
  }

  return {
    open,
    close: () => { if (dialog?.open) dialog.close(); },
    modelName: (id) => englishModelName(catalog.llmModels, id),
    voiceName: (id) => id === 'default' ? '场景默认' : voices.find((item) => item.id === id)?.name || (id === read().voiceId ? selectedVoiceName : '') || id
  };
}
