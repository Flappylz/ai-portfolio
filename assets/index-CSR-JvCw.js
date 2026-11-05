(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))l(a);new MutationObserver(a=>{for(const t of a)if(t.type==="childList")for(const p of t.addedNodes)p.tagName==="LINK"&&p.rel==="modulepreload"&&l(p)}).observe(document,{childList:!0,subtree:!0});function i(a){const t={};return a.integrity&&(t.integrity=a.integrity),a.referrerPolicy&&(t.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?t.credentials="include":a.crossOrigin==="anonymous"?t.credentials="omit":t.credentials="same-origin",t}function l(a){if(a.ep)return;a.ep=!0;const t=i(a);fetch(a.href,t)}})();const d=[{slug:"realtime-agent",number:"01",title:"实时语音 Agent / Codex 陪伴",eyebrow:"Realtime voice · state machine · evaluation",summary:"把实时音频、VAD、字幕、插话和任务状态组织成可理解、可体验的交互产品。",role:"产品设计 / 交互定义 / 前端验证",tags:["Voice Agent","VAD","WebRTC","状态机"],image:"assets/screenshots/voice-story.png",demoUrl:"https://flappylz.github.io/ai-realtime-interaction/#/realtimeExperienceDemo",demoLabel:"打开实时交互演示",repoUrl:"https://github.com/Flappylz",facts:["定义 idle、listening、thinking、speaking、completed 五类状态","设计实时字幕、用户插话、回复取消和状态反馈","把本地密钥、浏览器端和网关边界写进产品约束"],architecture:["麦克风 / 文本输入","VAD 与会话状态","实时音频与字幕","Agent 回复与打断"],evaluation:["打断是否立即停止旧回复","字幕是否保持顺序与完整","断线和权限失败是否有可解释反馈"],limitations:"公开演示使用脱敏或模拟数据；真实 API 凭据不进入浏览器。"},{slug:"hardware-platform",number:"02",title:"智能硬件内容平台",eyebrow:"AIoT · content package · product binding",summary:"围绕“玩法包 → Agent 配置 → 硬件绑定 → 评测 → 发布出货”设计平台与终端闭环。",role:"产品规划 / PRD / 原型 / 交付资产",tags:["AIoT","玩法包","Agent","小程序"],image:"assets/screenshots/hardware-platform.png",demoUrl:"https://baigong-hardware-content-demo.vercel.app/",demoLabel:"打开硬件平台演示",repoUrl:"https://github.com/Flappylz",facts:["覆盖平台端、设备端、英语陪练与情绪陪伴流程","完成一期 16 项需求、20 个必需路由和两条端到端原型","把角色、人设、话题、安全、测试脚本和推荐音色沉淀成玩法包"],architecture:["探索广场 / 玩法包","Agent 配置 / 资源库","硬件与产品绑定","评测 / 发布 / 观测"],evaluation:["流程是否能从内容走到设备绑定","安全边界是否可执行","版本和发布状态是否可追踪"],limitations:"公开版本是产品演示与评审原型，不代表真实生产设备已接入。"},{slug:"overseas-voice",number:"03",title:"海外实时语音平台",eyebrow:"Realtime platform · API/SDK · smart hardware",summary:"把 Voice Agent、Copilot、ASR/TTS/VAD 和设备控制面组织成海外平台产品。",role:"平台规划 / PRD / 交互原型 / 发布验证",tags:["SaaS","API/SDK","Voice","海外产品"],image:"assets/screenshots/platform-explore.png",demoUrl:"https://flappylz.github.io/dyna-voice-device-h5/",demoLabel:"打开海外平台演示",repoUrl:"https://github.com/Flappylz/dyna-voice-device-h5",facts:["覆盖 Voice Agent、Copilot、ASR/TTS/VAD 单项服务和多终端接入","输出中文 PRD、移动端 H5、平台信息架构和安全边界","用 GitHub Pages 保留长期可访问的公开评审版本"],architecture:["海外平台入口","语音能力与 Agent","API / SDK 接入","设备控制与本地边界"],evaluation:["公开版本是否无登录可访问","移动端流程是否可完成","生产能力与演示能力是否清楚区分"],limitations:"当前公开版本使用浏览器本地存储，正式生产需要接入身份、设备、WebSocket 和 OTA 服务。"},{slug:"delivery-method",number:"04",title:"AI 项目交付与解决方案",eyebrow:"B2B delivery · PoC · acceptance",summary:"把客户需求、PoC、测试、风险、验收和回款节点组织成可核验的交付链路。",role:"需求澄清 / 方案推进 / 质量与验收治理",image:"assets/screenshots/hardware-platform.png",demoUrl:"#/method",demoLabel:"查看交付方法",repoUrl:"https://github.com/Flappylz",tags:["B2B","PoC","验收","风险闭环"],facts:["面向金融、电信、航空和智能硬件等行业场景组织方案与测试","区分内部测试、客户验收、项目状态和客户转述","把来源、版本、负责人、截止时间和覆盖缺口保留在交付资产中"],architecture:["客户问题 / 需求澄清","方案 / 配置 / PoC","测试 / 风险 / 验收","复盘 / 资产沉淀"],evaluation:["验收标准是否提前定义","状态是否有来源和截止时间","问题是否能归因并形成下一步"],limitations:"公开案例使用行业化描述，不展示内部客户资料、会议原文或未公开商业指标。"}],f=[{label:"AI 产品设计",text:"场景拆解、产品规划、PRD、原型、交互体验与版本迭代。",icon:"01"},{label:"Agent 与实时语音",text:"ASR、VAD、LLM、TTS、状态机、字幕、打断、Prompt 与评测。",icon:"02"},{label:"产品落地",text:"客户 PoC、硬件绑定、测试验收、交付资产与上线准备。",icon:"03"}],c=document.querySelector("#app"),m="https://github.com/Flappylz",n="760871196@qq.com",h=s=>`./${s}`,u=s=>String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"),o=(s,e,i="")=>{const l=s.startsWith("#")?s:u(s),a=s.startsWith("#")?"":' target="_blank" rel="noreferrer"';return`<a class="${i}" href="${l}"${a}>${e}</a>`};function A(){return`
    <header class="site-header">
      <a class="brand" href="#/" aria-label="返回首页">
        <span class="brand-mark">FL</span>
        <span><strong>冯良泽AI</strong><small>AI PRODUCT PORTFOLIO</small></span>
      </a>
      <nav class="site-nav" aria-label="主导航">
        <a href="#/">首页</a>
        <a href="#/projects">作品</a>
        <a href="#/method">方法</a>
        ${o(m,"GitHub","nav-external")}
        <a class="nav-cta" href="mailto:${n}">联系我</a>
      </nav>
    </header>
  `}function $(){return`
    <footer class="site-footer">
      <div>
        <span class="footer-kicker">冯良泽AI</span>
        <p>把模型能力做成可体验、可配置、可评测、可交付的产品。</p>
      </div>
      <div class="footer-links">
        ${o(m,"GitHub")}
        <a href="mailto:${n}">${n}</a>
        <span>© 2026</span>
      </div>
    </footer>
  `}function r(s){return`${A()}<main>${s}</main>${$()}`}function y(){return f.map(s=>`
    <article class="capability-card">
      <span class="card-number">${s.icon}</span>
      <h3>${s.label}</h3>
      <p>${s.text}</p>
    </article>
  `).join("")}function v(s){return`
    <article class="project-card">
      <div class="project-image-wrap">
        <img src="${h(s.image)}" alt="${u(s.title)}界面截图" loading="lazy" />
        <span class="project-index">${s.number}</span>
      </div>
      <div class="project-card-body">
        <p class="eyebrow">${s.eyebrow}</p>
        <h3>${s.title}</h3>
        <p>${s.summary}</p>
        <div class="tag-row">${s.tags.map(e=>`<span>${e}</span>`).join("")}</div>
        <div class="card-actions">
          <a class="text-link" href="#/projects/${s.slug}">查看拆解 <span>↗</span></a>
          ${o(s.demoUrl,s.demoLabel,"ghost-link")}
        </div>
      </div>
    </article>
  `}function I(){return r(`
    <section class="hero section-pad">
      <div class="hero-copy">
        <p class="eyebrow accent">AI PRODUCT MANAGER / AGENT / VOICE / AIoT</p>
        <h1>把模型能力做成<br /><em>能被体验的产品</em><span class="headline-dot">。</span></h1>
        <p class="hero-lede">我做 AI 产品、Agent、实时语音、解决方案和智能硬件。关注从场景拆解到原型、评测、交付的完整链路。</p>
        <div class="hero-actions">
          <a class="button primary" href="#/projects">查看作品 <span>↗</span></a>
          ${o(m,"查看 GitHub","button secondary")}
          <a class="button text-button" href="mailto:${n}">联系我 <span>↗</span></a>
        </div>
        <div class="hero-meta">
          <span><i></i> AI 产品经理</span>
          <span>Agent · 实时语音 · 智能硬件</span>
        </div>
      </div>
      <div class="hero-visual" aria-label="AI产品能力链路示意图">
        <div class="orbit orbit-one"></div><div class="orbit orbit-two"></div>
        <div class="visual-core"><span>AI</span><small>PRODUCT<br />SYSTEM</small></div>
        <div class="signal signal-a"><b>01</b><span>场景</span></div>
        <div class="signal signal-b"><b>02</b><span>Agent</span></div>
        <div class="signal signal-c"><b>03</b><span>交付</span></div>
        <div class="visual-note">可体验<br />可配置<br />可评测</div>
      </div>
    </section>

    <section class="section-pad intro-grid">
      <div>
        <p class="section-label">01 / CAPABILITY</p>
        <h2>从模型能力，<br /><span>走到产品现场。</span></h2>
      </div>
      <div class="intro-copy">
        <p>我不只关注模型能回答什么，也关注用户如何进入场景、Agent 如何保持状态、失败如何解释，以及产品如何通过测试和交付真正被使用。</p>
        <p class="muted">这套作品集用公开 Demo、流程图和证据化拆解，展示我在 AI 产品和复杂项目中的判断方式。</p>
      </div>
    </section>

    <section class="section-pad capability-grid">${y()}</section>

    <section class="section-pad projects-section" id="projects">
      <div class="section-heading">
        <div><p class="section-label">02 / SELECTED WORK</p><h2>作品，先看判断。</h2></div>
        <a class="text-link" href="#/projects">查看全部拆解 <span>↗</span></a>
      </div>
      <div class="project-grid">${d.slice(0,3).map(v).join("")}</div>
    </section>

    <section class="section-pad method-preview">
      <div class="method-panel">
        <div>
          <p class="section-label">03 / HOW I WORK</p>
          <h2>研究 → 定义 → 原型<br /><span>→ 评测 → 交付</span></h2>
        </div>
        <div class="method-steps">
          ${["研究与场景","产品定义","Agent / 语音原型","测试与验收","交付与复盘"].map((s,e)=>`<div class="method-step"><b>0${e+1}</b><span>${s}</span></div>`).join("")}
        </div>
        <a class="button secondary" href="#/method">查看方法与边界 <span>↗</span></a>
      </div>
    </section>

    <section class="section-pad contact-strip">
      <div class="contact-grid">
        <div>
          <p class="section-label">04 / OPEN TO CONVERSATION</p>
          <h2>如果你正在做下一代 AI 产品，<br /><span>欢迎聊聊。</span></h2>
          <a class="button primary" href="mailto:${n}">发送邮件 <span>↗</span></a>
        </div>
        <div class="qr-card">
          <img src="${h("assets/portfolio-qr.svg")}" alt="作品集二维码" />
          <span>扫码查看作品集</span>
        </div>
      </div>
    </section>
  `)}function T(){return r(`
    <section class="page-intro section-pad">
      <p class="eyebrow accent">SELECTED WORK / 2024—2026</p>
      <h1>四个作品，<br /><em>四种落地视角。</em></h1>
      <p>从实时语音和 Agent，到智能硬件、海外平台与 B2B 交付。每个案例都保留产品问题、我的决策、可验证产物和明确边界。</p>
    </section>
    <section class="section-pad project-list">${d.map(v).join("")}</section>
    <section class="section-pad proof-band">
      <div><p class="section-label">AI FAMILIARITY</p><h2>熟悉 AI，体现在边界和验证里。</h2></div>
      <div class="proof-list"><span>模型能力边界</span><span>Agent 状态管理</span><span>实时语音链路</span><span>工具调用</span><span>评测与 Badcase</span><span>安全与交付</span></div>
    </section>
  `)}function w(s){return r(`
    <section class="detail-hero section-pad">
      <a class="back-link" href="#/projects">← 返回作品</a>
      <p class="eyebrow accent">${s.number} / ${s.eyebrow}</p>
      <h1>${s.title}</h1>
      <p class="detail-lede">${s.summary}</p>
      <div class="detail-meta"><span>我的角色：${s.role}</span>${s.tags.map(e=>`<span>${e}</span>`).join("")}</div>
    </section>
    <section class="section-pad detail-layout">
      <div class="detail-main">
        <img class="detail-image" src="${h(s.image)}" alt="${u(s.title)}截图" />
        <div class="detail-block"><p class="section-label">PRODUCT DECISIONS</p><h2>我具体做了什么</h2><ul>${s.facts.map(e=>`<li>${e}</li>`).join("")}</ul></div>
        <div class="detail-block"><p class="section-label">SYSTEM MAP</p><h2>产品链路</h2><div class="architecture-flow">${s.architecture.map((e,i)=>`<div><b>0${i+1}</b><span>${e}</span></div>`).join("<i>→</i>")}</div></div>
        <div class="detail-block"><p class="section-label">EVALUATION</p><h2>怎么判断做对了</h2><ul>${s.evaluation.map(e=>`<li>${e}</li>`).join("")}</ul></div>
      </div>
      <aside class="detail-aside"><div class="aside-card"><span class="aside-label">TRY IT</span><h3>先体验，再看拆解。</h3>${o(s.demoUrl,s.demoLabel,"button primary full")}${o(s.repoUrl,"查看 GitHub","button secondary full")}</div><div class="aside-card boundary"><span class="aside-label">BOUNDARY</span><p>${s.limitations}</p><span class="status-chip">事实与边界已标注</span></div></aside>
    </section>
  `)}function O(){return r(`
    <section class="page-intro section-pad">
      <p class="eyebrow accent">HOW I WORK / AI PRODUCT DELIVERY</p>
      <h1>熟悉 AI，<br /><em>不靠堆关键词。</em></h1>
      <p>我把 AI 产品工作拆成可以被观察、被测试、被验收的步骤。作品集里的每个案例都沿着这条链路展开。</p>
    </section>
    <section class="section-pad workflow-grid">
      ${[["01","研究与场景","先找真实用户、业务目标和失败成本，再决定 AI 是否适合进入流程。"],["02","产品定义","把模型能力翻译成用户旅程、状态、配置项、权限和可解释反馈。"],["03","原型与 Agent","用可交互原型验证话术、状态机、工具调用、语音链路和关键边界。"],["04","评测与验收","提前写测试用例、Badcase、指标和准出条件，不把演示效果当成上线结果。"],["05","交付与复盘","保留版本、来源、风险、负责人和交付资产，让方案能被团队继续使用。"]].map(([s,e,i])=>`<article class="workflow-card"><span>${s}</span><h3>${e}</h3><p>${i}</p></article>`).join("")}
    </section>
    <section class="section-pad safety-panel"><div><p class="section-label">PUBLIC BOUNDARY</p><h2>公开 Demo 也要讲清楚边界。</h2></div><ul><li>不把计划、内部测试或客户转述写成已上线结果。</li><li>不把 API Key、Token、内部域名和客户数据放进浏览器。</li><li>区分演示原型、可运行 Demo 和生产系统。</li><li>用公开链接、截图、PRD 和测试脚本支持结论。</li></ul></section>
    <section class="section-pad contact-strip compact"><p class="section-label">CONTACT</p><h2>想聊 AI 产品、语音交互或智能硬件？</h2><a class="button primary" href="mailto:${n}">${n} <span>↗</span></a></section>
  `)}function b(){return r('<section class="page-intro section-pad"><p class="eyebrow accent">404 / PAGE NOT FOUND</p><h1>这条路径还没有作品。</h1><a class="button primary" href="#/">回到首页</a></section>')}function g(){const e=window.location.hash.replace(/^#\/?/,"").split("/").filter(Boolean);if(!e.length)c.innerHTML=I();else if(e[0]==="projects"&&e[1]){const i=d.find(l=>l.slug===e[1]);c.innerHTML=i?w(i):b()}else e[0]==="projects"?c.innerHTML=T():e[0]==="method"?c.innerHTML=O():c.innerHTML=b();window.scrollTo({top:0,behavior:"instant"})}window.addEventListener("hashchange",g);g();
