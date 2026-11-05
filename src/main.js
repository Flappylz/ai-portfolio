import './styles.css';
import { capabilities, projects } from './data/projects.js';

const app = document.querySelector('#app');
const githubUrl = 'https://github.com/Flappylz';
const email = '760871196@qq.com';
const portfolioUrl = 'https://flappylz.github.io/ai-portfolio/';
const assetUrl = (path) => `${import.meta.env.BASE_URL}${path}`;

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const link = (href, label, className = '') => {
  const safe = href.startsWith('#') ? href : escapeHtml(href);
  const attrs = href.startsWith('#') ? '' : ' target="_blank" rel="noreferrer"';
  return `<a class="${className}" href="${safe}"${attrs}>${label}</a>`;
};

function header() {
  return `
    <header class="site-header">
      <a class="brand" href="#/" aria-label="返回首页">
        <span class="brand-mark">FL</span>
        <span><strong>冯良泽AI</strong><small>AI PRODUCT PORTFOLIO</small></span>
      </a>
      <nav class="site-nav" aria-label="主导航">
        <a href="#/">首页</a>
        <a href="#/projects">作品</a>
        <a href="#/method">方法</a>
        ${link(githubUrl, 'GitHub', 'nav-external')}
        <a class="nav-cta" href="mailto:${email}">联系我</a>
      </nav>
    </header>
  `;
}

function footer() {
  return `
    <footer class="site-footer">
      <div>
        <span class="footer-kicker">冯良泽AI</span>
        <p>把模型能力做成可体验、可配置、可评测、可交付的产品。</p>
      </div>
      <div class="footer-links">
        ${link(githubUrl, 'GitHub')}
        <a href="mailto:${email}">${email}</a>
        <span>© 2026</span>
      </div>
    </footer>
  `;
}

function pageShell(content) {
  return `${header()}<main>${content}</main>${footer()}`;
}

function capabilityCards() {
  return capabilities.map((item) => `
    <article class="capability-card">
      <span class="card-number">${item.icon}</span>
      <h3>${item.label}</h3>
      <p>${item.text}</p>
    </article>
  `).join('');
}

function projectCard(project) {
  return `
    <article class="project-card">
      <div class="project-image-wrap">
        <img src="${assetUrl(project.image)}" alt="${escapeHtml(project.title)}界面截图" loading="lazy" />
        <span class="project-index">${project.number}</span>
      </div>
      <div class="project-card-body">
        <p class="eyebrow">${project.eyebrow}</p>
        <h3>${project.title}</h3>
        <p>${project.summary}</p>
        <div class="tag-row">${project.tags.map((tag) => `<span>${tag}</span>`).join('')}</div>
        <div class="card-actions">
          <a class="text-link" href="#/projects/${project.slug}">查看拆解 <span>↗</span></a>
          ${link(project.demoUrl, project.demoLabel, 'ghost-link')}
        </div>
      </div>
    </article>
  `;
}

function homeView() {
  return pageShell(`
    <section class="hero section-pad">
      <div class="hero-copy">
        <p class="eyebrow accent">AI PRODUCT MANAGER / AGENT / VOICE / AIoT</p>
        <h1>把模型能力做成<br /><em>能被体验的产品</em><span class="headline-dot">。</span></h1>
        <p class="hero-lede">我做 AI 产品、Agent、实时语音、解决方案和智能硬件。关注从场景拆解到原型、评测、交付的完整链路。</p>
        <div class="hero-actions">
          <a class="button primary" href="#/projects">查看作品 <span>↗</span></a>
          ${link(githubUrl, '查看 GitHub', 'button secondary')}
          <a class="button text-button" href="mailto:${email}">联系我 <span>↗</span></a>
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

    <section class="section-pad capability-grid">${capabilityCards()}</section>

    <section class="section-pad projects-section" id="projects">
      <div class="section-heading">
        <div><p class="section-label">02 / SELECTED WORK</p><h2>作品，先看判断。</h2></div>
        <a class="text-link" href="#/projects">查看全部拆解 <span>↗</span></a>
      </div>
      <div class="project-grid">${projects.slice(0, 3).map(projectCard).join('')}</div>
    </section>

    <section class="section-pad method-preview">
      <div class="method-panel">
        <div>
          <p class="section-label">03 / HOW I WORK</p>
          <h2>研究 → 定义 → 原型<br /><span>→ 评测 → 交付</span></h2>
        </div>
        <div class="method-steps">
          ${['研究与场景', '产品定义', 'Agent / 语音原型', '测试与验收', '交付与复盘'].map((step, index) => `<div class="method-step"><b>0${index + 1}</b><span>${step}</span></div>`).join('')}
        </div>
        <a class="button secondary" href="#/method">查看方法与边界 <span>↗</span></a>
      </div>
    </section>

    <section class="section-pad contact-strip">
      <div class="contact-grid">
        <div>
          <p class="section-label">04 / OPEN TO CONVERSATION</p>
          <h2>如果你正在做下一代 AI 产品，<br /><span>欢迎聊聊。</span></h2>
          <a class="button primary" href="mailto:${email}">发送邮件 <span>↗</span></a>
        </div>
        <div class="qr-card">
          <img src="${assetUrl('assets/portfolio-qr.svg')}" alt="作品集二维码" />
          <span>扫码查看作品集</span>
        </div>
      </div>
    </section>
  `);
}

function projectsView() {
  return pageShell(`
    <section class="page-intro section-pad">
      <p class="eyebrow accent">SELECTED WORK / 2024—2026</p>
      <h1>四个作品，<br /><em>四种落地视角。</em></h1>
      <p>从实时语音和 Agent，到智能硬件、海外平台与 B2B 交付。每个案例都保留产品问题、我的决策、可验证产物和明确边界。</p>
    </section>
    <section class="section-pad project-list">${projects.map(projectCard).join('')}</section>
    <section class="section-pad proof-band">
      <div><p class="section-label">AI FAMILIARITY</p><h2>熟悉 AI，体现在边界和验证里。</h2></div>
      <div class="proof-list"><span>模型能力边界</span><span>Agent 状态管理</span><span>实时语音链路</span><span>工具调用</span><span>评测与 Badcase</span><span>安全与交付</span></div>
    </section>
  `);
}

function detailView(project) {
  return pageShell(`
    <section class="detail-hero section-pad">
      <a class="back-link" href="#/projects">← 返回作品</a>
      <p class="eyebrow accent">${project.number} / ${project.eyebrow}</p>
      <h1>${project.title}</h1>
      <p class="detail-lede">${project.summary}</p>
      <div class="detail-meta"><span>我的角色：${project.role}</span>${project.tags.map((tag) => `<span>${tag}</span>`).join('')}</div>
    </section>
    <section class="section-pad detail-layout">
      <div class="detail-main">
        <img class="detail-image" src="${assetUrl(project.image)}" alt="${escapeHtml(project.title)}截图" />
        <div class="detail-block"><p class="section-label">PRODUCT DECISIONS</p><h2>我具体做了什么</h2><ul>${project.facts.map((fact) => `<li>${fact}</li>`).join('')}</ul></div>
        <div class="detail-block"><p class="section-label">SYSTEM MAP</p><h2>产品链路</h2><div class="architecture-flow">${project.architecture.map((item, index) => `<div><b>0${index + 1}</b><span>${item}</span></div>`).join('<i>→</i>')}</div></div>
        <div class="detail-block"><p class="section-label">EVALUATION</p><h2>怎么判断做对了</h2><ul>${project.evaluation.map((item) => `<li>${item}</li>`).join('')}</ul></div>
      </div>
      <aside class="detail-aside"><div class="aside-card"><span class="aside-label">TRY IT</span><h3>先体验，再看拆解。</h3>${link(project.demoUrl, project.demoLabel, 'button primary full')}${link(project.repoUrl, '查看 GitHub', 'button secondary full')}</div><div class="aside-card boundary"><span class="aside-label">BOUNDARY</span><p>${project.limitations}</p><span class="status-chip">事实与边界已标注</span></div></aside>
    </section>
  `);
}

function methodView() {
  return pageShell(`
    <section class="page-intro section-pad">
      <p class="eyebrow accent">HOW I WORK / AI PRODUCT DELIVERY</p>
      <h1>熟悉 AI，<br /><em>不靠堆关键词。</em></h1>
      <p>我把 AI 产品工作拆成可以被观察、被测试、被验收的步骤。作品集里的每个案例都沿着这条链路展开。</p>
    </section>
    <section class="section-pad workflow-grid">
      ${[
        ['01', '研究与场景', '先找真实用户、业务目标和失败成本，再决定 AI 是否适合进入流程。'],
        ['02', '产品定义', '把模型能力翻译成用户旅程、状态、配置项、权限和可解释反馈。'],
        ['03', '原型与 Agent', '用可交互原型验证话术、状态机、工具调用、语音链路和关键边界。'],
        ['04', '评测与验收', '提前写测试用例、Badcase、指标和准出条件，不把演示效果当成上线结果。'],
        ['05', '交付与复盘', '保留版本、来源、风险、负责人和交付资产，让方案能被团队继续使用。']
      ].map(([number, title, text]) => `<article class="workflow-card"><span>${number}</span><h3>${title}</h3><p>${text}</p></article>`).join('')}
    </section>
    <section class="section-pad safety-panel"><div><p class="section-label">PUBLIC BOUNDARY</p><h2>公开 Demo 也要讲清楚边界。</h2></div><ul><li>不把计划、内部测试或客户转述写成已上线结果。</li><li>不把 API Key、Token、内部域名和客户数据放进浏览器。</li><li>区分演示原型、可运行 Demo 和生产系统。</li><li>用公开链接、截图、PRD 和测试脚本支持结论。</li></ul></section>
    <section class="section-pad contact-strip compact"><p class="section-label">CONTACT</p><h2>想聊 AI 产品、语音交互或智能硬件？</h2><a class="button primary" href="mailto:${email}">${email} <span>↗</span></a></section>
  `);
}

function notFoundView() {
  return pageShell(`<section class="page-intro section-pad"><p class="eyebrow accent">404 / PAGE NOT FOUND</p><h1>这条路径还没有作品。</h1><a class="button primary" href="#/">回到首页</a></section>`);
}

function render() {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const segments = hash.split('/').filter(Boolean);
  if (!segments.length) app.innerHTML = homeView();
  else if (segments[0] === 'projects' && segments[1]) {
    const project = projects.find((item) => item.slug === segments[1]);
    app.innerHTML = project ? detailView(project) : notFoundView();
  } else if (segments[0] === 'projects') app.innerHTML = projectsView();
  else if (segments[0] === 'method') app.innerHTML = methodView();
  else app.innerHTML = notFoundView();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

window.addEventListener('hashchange', render);
render();
