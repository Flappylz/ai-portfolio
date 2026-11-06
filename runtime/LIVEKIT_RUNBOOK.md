# LiveKit 配置与上线清单

公开 Voice Runtime 已经具备短期 Token、TTS 代理和 Agent dispatch 的接口。要进入真正的 LIVE，还需要一个可被公网访问的 LiveKit Server，以及一个已经注册的 LiveKit Agent Worker。

## 1. 本机开发验证

macOS 可以直接安装开源 LiveKit Server 和 CLI：

\`\`\`bash
brew install livekit livekit-cli
livekit-server --dev
\`\`\`

开发模式固定使用 \`devkey / secret\`，只用于本机验证，不能填入公开站点。另开终端生成测试 Token：

\`\`\`bash
lk token create --dev --join --room local-test --identity local-visitor
\`\`\`

## 2. 生产 Server：自托管路径

LiveKit Server 是开源的，但公网 WebRTC 仍需要一台带公网 IP 的 Linux VM、域名、可信 TLS 证书和 UDP 端口。最省事的官方路径是：

\`\`\`bash
docker pull livekit/generate
docker run --rm -it -v "$PWD:/output" livekit/generate
\`\`\`

生成器会输出 \`docker-compose.yaml\`、\`livekit.yaml\`、Caddy 配置和初始化脚本。把主域名和 TURN 域名解析到 VM 后，在 VM 上执行生成的初始化脚本。

防火墙至少放行：

\`\`\`text
80/tcp
443/tcp
7881/tcp
3478/udp
50000-60000/udp
\`\`\`

最终得到：

\`\`\`text
LIVEKIT_URL=wss://livekit.example.com
LIVEKIT_API_KEY=<livekit.yaml 中生成的 key>
LIVEKIT_API_SECRET=<livekit.yaml 中生成的 secret>
\`\`\`

\`livekit.yaml\`、API secret、证书和 \`.env\` 不要提交到 GitHub。

## 3. 生产 Server：LiveKit Cloud 路径

如果不想维护 VM，可以在 LiveKit Cloud 创建一个 Project。Project Settings 中会提供：

\`\`\`text
WSS URL
API Key
API Secret
\`\`\`

Cloud 方案不需要自己维护 SFU、TLS、TURN 和扩容；自托管方案则完全由自己控制。

## 4. Agent Worker

Agent Worker 必须连接同一个 LiveKit Project，并注册一个固定的 Agent Name。用官方 CLI 初始化 Node Agent：

\`\`\`bash
lk agent init fengliangze-voice --lang node --install
\`\`\`

Worker 的运行时 Secret 至少包括：

\`\`\`text
LIVEKIT_URL
LIVEKIT_API_KEY
LIVEKIT_API_SECRET
ELEVEN_API_KEY
\`\`\`

\`ELEVEN_API_KEY\` 是 LiveKit ElevenLabs 插件约定的变量名；如果代码统一使用 \`ELEVENLABS_API_KEY\`，就在 Worker 启动时映射成 \`ELEVEN_API_KEY\`。TTS 需要 Text to Speech 权限；如果 Agent 自己使用 ElevenLabs STT，还要额外开启 Speech to Text 权限。

Node Agent 使用 ElevenLabs TTS 插件时，依赖 \`@livekit/agents-plugin-elevenlabs\`，模型建议 \`eleven_flash_v2_5\`，并显式配置 voice ID、language、stability、similarity、style、speed 和 chunk schedule。

部署到 LiveKit Cloud：

\`\`\`bash
lk cloud auth
lk project list
lk project set-default "<project-name>"
lk agent create
lk agent status
lk agent logs
\`\`\`

自托管时，把同一个 Agent 容器部署到 VM、Kubernetes 或其他容器平台，并让它通过 WebSocket 注册到自托管 LiveKit Server。

## 5. 填到哪个地方

### Voice Runtime Site

写入 Codex Site「冯良泽AI Voice Runtime」的生产环境变量：

\`\`\`text
LIVEKIT_URL
LIVEKIT_API_KEY
LIVEKIT_API_SECRET
LIVEKIT_AGENT_ID
\`\`\`

我已经把新的 ElevenLabs TTS secret 写入这个 Site 的 \`ELEVENLABS_API_KEY\` Secret Store，并完成真实流式 TTS 验证。

### Agent Worker

把上面三项 LiveKit 凭据、Agent 自己需要的模型/工具凭据和 ElevenLabs 凭据写入 Agent 的 Secret Store。不要把它们写进 GitHub、前端构建产物、URL 或浏览器 LocalStorage。

## 6. 验收顺序

\`\`\`bash
curl -sS 'https://fengliangze-ai-voice-runtime.wellsfung.chatgpt.site/api/health?probe=1'
\`\`\`

ElevenLabs 探针应该返回 \`verified:true\`。LiveKit 配好后：

\`\`\`bash
curl -sS -X POST \\+  'https://fengliangze-ai-voice-runtime.wellsfung.chatgpt.site/api/voice/session' \\+  -H 'content-type: application/json' \\+  --data '{"scenario":"airline","direction":"inbound","language":"zh","runtimeMode":"live"}'
\`\`\`

返回体必须同时有：

\`\`\`text
runtimeMode: live
serverUrl: wss://...
room: ...
token: ...
agentId: ...
\`\`\`

浏览器端还必须收到 \`agent_joined\`、\`audio_track_ready\`、\`listening\`，并能看到 LiveKit RTT、jitter、packet loss 和 Agent/TTS 事件。只有拿到这些证据，页面才会把会话当作真实 Live。
