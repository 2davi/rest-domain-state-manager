/* ─────────────────────────────────────────────────────────────────────────
   2davi Lab — Shared JS
───────────────────────────────────────────────────────────────────────── */

/** 코드 블록에 헤더(언어 라벨 + 복사 버튼) 주입 */
function initCodeBlocks() {
  document.querySelectorAll('pre').forEach(pre => {
    const code = pre.querySelector('code');
    if (!code) return;

    // 언어 클래스에서 라벨 추출
    const cls    = code.className.match(/language-(\w+)/);
    const lang   = cls ? cls[1].toUpperCase() : 'CODE';
    const header = document.createElement('div');
    header.className = 'code-header';

    const langSpan = document.createElement('span');
    langSpan.className = 'code-lang';
    langSpan.textContent = lang;

    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(code.textContent.trim()).then(() => {
        copyBtn.textContent = 'Copied!';
        copyBtn.classList.add('copied');
        setTimeout(() => {
          copyBtn.textContent = 'Copy';
          copyBtn.classList.remove('copied');
        }, 2000);
      });
    });

    header.appendChild(langSpan);
    header.appendChild(copyBtn);
    pre.insertBefore(header, code);
  });
}

/** IntersectionObserver로 사이드바 active 처리 */
function initSidebarHighlight() {
  const navLinks = document.querySelectorAll('.sidebar-nav a[href^="#"]');
  if (!navLinks.length) return;

  const ids = Array.from(navLinks).map(a => a.getAttribute('href').slice(1));
  const sections = ids.map(id => document.getElementById(id)).filter(Boolean);

  let current = '';

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) current = entry.target.id;
    });
    navLinks.forEach(a => {
      const id = a.getAttribute('href').slice(1);
      a.classList.toggle('active', id === current);
    });
  }, {
    rootMargin: '-56px 0px -55% 0px',
    threshold:  0,
  });

  sections.forEach(el => observer.observe(el));
}

/** 모바일 사이드바 토글 */
function initMobileNav() {
  const hamburger = document.getElementById('hamburger');
  const sidebar   = document.getElementById('sidebar');
  const overlay   = document.getElementById('sidebar-overlay');
  if (!hamburger || !sidebar) return;

  function close() {
    sidebar.classList.remove('open');
    if (overlay) overlay.style.display = 'none';
  }

  hamburger.addEventListener('click', () => {
    const isOpen = sidebar.classList.toggle('open');
    if (overlay) overlay.style.display = isOpen ? 'block' : 'none';
  });

  if (overlay) overlay.addEventListener('click', close);

  // 사이드바 링크 클릭 시 닫기
  sidebar.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      if (window.innerWidth <= 1024) close();
    });
  });
}

/** highlight.js 초기화 */
function initHighlight() {
  if (typeof hljs !== 'undefined') {
    hljs.highlightAll();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initHighlight();
  initCodeBlocks();
  initSidebarHighlight();
  initMobileNav();
});
