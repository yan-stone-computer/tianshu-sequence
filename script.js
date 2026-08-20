/**
 * 天枢序列官网 — 交互与动画
 */

(function () {
    'use strict';

    // ─── 产品矩阵 · 数据来自 products-data.js ───
    const productSlides = window.PRODUCTS_DATA || [];

    // ─── 产品矩阵 · 循环轮播渲染与交互 ───
    const pcTrack = document.getElementById('pcTrack');
    if (pcTrack) {
        const pcPrev = document.getElementById('pcPrev');
        const pcNext = document.getElementById('pcNext');
        const pcDots = document.getElementById('pcDots');
        const wrap = document.getElementById('productCarousel');
        const slides = [];
        let current = 0;
        let autoTimer = null;
        const INTERVAL = 4000;

        function renderSlides() {
            productSlides.forEach((p, i) => {
                const slide = document.createElement('div');
                slide.className = 'pc-slide' + (i === 0 ? ' active' : '');
                slide.innerHTML = `
                    <div class="pc-card pc-card-${p.accent}">
                        <div class="pc-card-top">
                            <div class="pc-icon pc-icon-${p.accent}">
                                ${p.iconSvg || `<img src="${p.iconImg}" alt="${p.name}">`}
                            </div>
                            <span class="pc-tag pc-tag-${p.accent}">${p.tag}</span>
                        </div>
                        <h3 class="pc-name">${p.name}<span>${p.en}</span></h3>
                        <p class="pc-desc">${p.desc}</p>
                        <div class="pc-tags">
                            ${p.tags.map(t => `<span>${t}</span>`).join('')}
                        </div>
                        <div class="pc-features">
                            ${p.features.map(f => `<span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>${f}</span>`).join('')}
                        </div>
                        <div class="pc-meta">
                            ${p.meta.map(m => `<span><b>${m.k}</b>${m.v}</span>`).join('')}
                        </div>
                        <div class="pc-actions">
                            <a href="${p.site}" target="_blank" rel="noopener" class="btn pc-site pc-site-${p.accent}">
                                前往产品官网
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                            </a>
                        </div>
                    </div>
                `;
                pcTrack.appendChild(slide);
                slides.push(slide);
            });
        }

        function update() {
            slides.forEach((s, i) => s.classList.toggle('active', i === current));
            if (pcDots) {
                [...pcDots.children].forEach((d, i) => d.classList.toggle('active', i === current));
            }
        }

        function go(i) {
            current = (i + slides.length) % slides.length;
            update();
        }

        function next() { go(current + 1); }
        function prev() { go(current - 1); }

        function startAuto() {
            stopAuto();
            autoTimer = setInterval(next, INTERVAL);
        }

        function stopAuto() {
            if (autoTimer) {
                clearInterval(autoTimer);
                autoTimer = null;
            }
        }

        function restartAuto() {
            stopAuto();
            startAuto();
        }

        if (pcPrev) pcPrev.addEventListener('click', () => { prev(); restartAuto(); });
        if (pcNext) pcNext.addEventListener('click', () => { next(); restartAuto(); });

        if (pcDots) {
            productSlides.forEach((_, i) => {
                const dot = document.createElement('button');
                dot.className = 'pc-dot' + (i === 0 ? ' active' : '');
                dot.setAttribute('aria-label', `第 ${i + 1} 个产品`);
                dot.addEventListener('click', () => { go(i); restartAuto(); });
                pcDots.appendChild(dot);
            });
        }

        if (wrap) {
            wrap.addEventListener('mouseenter', stopAuto);
            wrap.addEventListener('mouseleave', startAuto);
        }

        // 触摸滑动切换
        let touchX = null;
        pcTrack.addEventListener('touchstart', e => {
            touchX = e.touches[0].clientX;
            stopAuto();
        }, { passive: true });
        pcTrack.addEventListener('touchend', e => {
            if (touchX === null) return;
            const dx = e.changedTouches[0].clientX - touchX;
            if (Math.abs(dx) > 48) {
                if (dx < 0) next();
                else prev();
            }
            touchX = null;
            startAuto();
        }, { passive: true });

        renderSlides();
        update();
        startAuto();
    }

    // ─── 产品数据驱动的通用内容 ───
    const products = productSlides;

    // 关于我们：产品数量
    const aboutCount = document.getElementById('aboutProductCount');
    if (aboutCount) aboutCount.textContent = String(products.length);

    // Hero 统计：款产品 / 个平台 / 项功能亮点 / 个开源仓库
    const platformSet = new Set();
    let featureCount = 0;
    let repoCount = 0;
    products.forEach(p => {
        (p.platforms || []).forEach(x => platformSet.add(x));
        featureCount += (p.features || []).length;
        if (p.repo) repoCount++;
    });
    const heroStats = {
        statProducts: products.length,
        statPlatforms: platformSet.size,
        statFeatures: featureCount,
        statRepos: repoCount
    };
    Object.keys(heroStats).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.querySelector('.stat-num').dataset.target = String(heroStats[id]);
    });

    // 技术实现区指标
    const techMetricProducts = document.getElementById('techMetricProducts');
    if (techMetricProducts) techMetricProducts.textContent = String(products.length);
    const techMetricPlatforms = document.getElementById('techMetricPlatforms');
    if (techMetricPlatforms) techMetricPlatforms.textContent = String(platformSet.size);
    const techMetricTags = document.getElementById('techMetricTags');
    if (techMetricTags) techMetricTags.textContent = String(document.querySelectorAll('.tech-tag').length);

    // 页脚产品链接
    const footerProducts = document.getElementById('footerProducts');
    if (footerProducts) {
        footerProducts.innerHTML = products.map(p => `
            <a href="${p.site}" target="_blank" rel="noopener">${p.name} ${p.en}</a>
        `).join('');
    }

    // 查看全部产品弹层
    const pcViewAll = document.getElementById('pcViewAll');
    const pcModal = document.getElementById('pcModal');
    const pcModalGrid = document.getElementById('pcModalGrid');

    function renderAllProducts() {
        if (!pcModalGrid) return;
        pcModalGrid.innerHTML = products.map(p => `
            <div class="pc-modal-card">
                <div class="pmc-head">
                    <div class="pmc-icon pc-icon-${p.accent}">
                        ${p.iconSvg || `<img src="${p.iconImg}" alt="${p.name}">`}
                    </div>
                    <div>
                        <h4>${p.name}<span>${p.en}</span></h4>
                        <span class="pc-tag pc-tag-${p.accent}">${p.tag}</span>
                    </div>
                </div>
                <p class="pmc-desc">${p.desc}</p>
                <div class="pmc-meta">
                    ${p.meta.map(m => `<span><b>${m.k}</b>${m.v}</span>`).join('')}
                </div>
                <a href="${p.site}" target="_blank" rel="noopener" class="btn btn-sm pc-site pc-site-${p.accent}">
                    前往产品官网
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </a>
            </div>
        `).join('');
    }

    function openAllProducts() {
        if (!pcModal) return;
        renderAllProducts();
        pcModal.hidden = false;
        document.body.style.overflow = 'hidden';
    }

    function closeAllProducts() {
        if (!pcModal) return;
        pcModal.hidden = true;
        document.body.style.overflow = '';
    }

    if (pcViewAll) pcViewAll.addEventListener('click', openAllProducts);
    if (pcModal) {
        pcModal.addEventListener('click', (e) => {
            if (e.target.closest('[data-close]')) closeAllProducts();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeAllProducts();
        });
    }

    // ─── 技术文章 · 分享与投稿 ───
    const ARTICLE_STORAGE_KEY = 'tianshu_articles_v1';

    function loadArticles() {
        try {
            const raw = localStorage.getItem(ARTICLE_STORAGE_KEY);
            const list = raw ? JSON.parse(raw) : [];
            return Array.isArray(list) ? list : [];
        } catch (e) {
            return [];
        }
    }

    function saveArticles(list) {
        try {
            localStorage.setItem(ARTICLE_STORAGE_KEY, JSON.stringify(list));
        } catch (e) { /* 存储不可用时静默忽略 */ }
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatDate(iso) {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        const p = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
    }

    const articleList = document.getElementById('articleList');

    function renderArticles() {
        if (!articleList) return;
        const list = loadArticles();
        if (!list.length) {
            articleList.innerHTML = `
                <div class="articles-empty">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                    <h4>还没有文章</h4>
                    <p>来发布第一篇技术分享吧。</p>
                </div>
            `;
            return;
        }
        articleList.innerHTML = list.map(a => `
            <article class="article-card" data-id="${a.id}">
                <div class="ac-head">
                    <span class="ac-cat">${escapeHtml(a.category || '其他')}</span>
                    <span class="ac-date">${escapeHtml(formatDate(a.date))}</span>
                </div>
                <h3 class="ac-title">${escapeHtml(a.title)}</h3>
                <p class="ac-author">作者：${escapeHtml(a.author)}</p>
                <div class="ac-body">${escapeHtml(a.content)}</div>
                <button type="button" class="ac-toggle">展开全文</button>
            </article>
        `).join('');
    }

    // 展开 / 收起全文
    if (articleList) {
        articleList.addEventListener('click', (e) => {
            const btn = e.target.closest('.ac-toggle');
            if (!btn) return;
            const card = btn.closest('.article-card');
            if (!card) return;
            const expanded = card.classList.toggle('expanded');
            btn.textContent = expanded ? '收起' : '展开全文';
        });
    }

    // 校验码验证：PBKDF2 迭代慢哈希（加盐）
    async function verifyUploadCode(input) {
        const cfg = window.ARTICLE_CONFIG;
        if (!cfg || !window.crypto || !window.crypto.subtle) return false;
        try {
            const enc = new TextEncoder();
            const salt = Uint8Array.from(atob(cfg.salt), c => c.charCodeAt(0));
            const material = await crypto.subtle.importKey('raw', enc.encode(input), 'PBKDF2', false, ['deriveBits']);
            const bits = await crypto.subtle.deriveBits({
                name: 'PBKDF2',
                salt,
                iterations: cfg.iterations,
                hash: cfg.algorithm
            }, material, 256);
            const derived = btoa(String.fromCharCode(...new Uint8Array(bits)));
            return derived === cfg.hash;
        } catch (err) {
            return false;
        }
    }

    const articleForm = document.getElementById('articleForm');
    const artMsg = document.getElementById('artMsg');
    const artSubmit = document.getElementById('artSubmit');

    // 分类选项来自 article-config.js
    const artCategory = document.getElementById('artCategory');
    if (artCategory && window.ARTICLE_CATEGORIES) {
        artCategory.innerHTML = window.ARTICLE_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');
    }

    function showMsg(text, ok) {
        if (!artMsg) return;
        artMsg.textContent = text;
        artMsg.className = 'au-msg' + (ok ? ' ok' : ' err');
    }

    if (articleForm) {
        articleForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = document.getElementById('artTitle').value.trim();
            const author = document.getElementById('artAuthor').value.trim();
            const category = document.getElementById('artCategory').value;
            const content = document.getElementById('artContent').value.trim();
            const code = document.getElementById('artCode').value;

            if (!title || !author || !content) {
                showMsg('请填写标题、作者和内容。', false);
                return;
            }
            if (!code) {
                showMsg('请输入上传校验码。', false);
                return;
            }
            if (!window.crypto || !window.crypto.subtle) {
                showMsg('当前环境不支持安全校验，请在 HTTPS 或本地服务器环境下使用。', false);
                return;
            }

            artSubmit.disabled = true;
            artSubmit.textContent = '校验中…';
            try {
                const ok = await verifyUploadCode(code);
                if (!ok) {
                    showMsg('校验码错误，无法发布。', false);
                    return;
                }
                const list = loadArticles();
                list.unshift({
                    id: 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                    title,
                    author,
                    category,
                    content,
                    date: new Date().toISOString()
                });
                saveArticles(list);
                renderArticles();
                articleForm.reset();
                showMsg('发布成功，文章已展示在列表中。', true);
            } finally {
                artSubmit.disabled = false;
                artSubmit.textContent = '发布文章';
            }
        });
    }

    renderArticles();

    // ─── Scroll Progress ───
    const scrollProgress = document.getElementById('scrollProgress');
    if (scrollProgress) {
        window.addEventListener('scroll', () => {
            const scrollTop = window.scrollY;
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
            scrollProgress.style.width = `${progress}%`;
        });
    }

    // ─── Navigation ───
    const navbar = document.getElementById('navbar');
    const navMobileBtn = document.getElementById('navMobileBtn');
    const navLinks = document.getElementById('navLinks');

    let ticking = false;
    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(() => {
                navbar.classList.toggle('scrolled', window.scrollY > 40);
                ticking = false;
            });
            ticking = true;
        }
    });

    if (navMobileBtn && navLinks) {
        navMobileBtn.addEventListener('click', () => {
            navMobileBtn.classList.toggle('active');
            navLinks.classList.toggle('active');
        });

        navLinks.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                navMobileBtn.classList.remove('active');
                navLinks.classList.remove('active');
            });
        });
    }

    // ─── Smooth Scroll ───
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href === '#') return;
            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                const offset = navbar ? navbar.offsetHeight + 20 : 80;
                const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
                window.scrollTo({ top, behavior: 'smooth' });
            }
        });
    });

    // ─── Reveal Animations ───
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, {
        root: null,
        rootMargin: '0px 0px -80px 0px',
        threshold: 0.1
    });

    document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale').forEach(el => {
        revealObserver.observe(el);
    });

    // ─── Number Counter Animation ───
    const statNums = document.querySelectorAll('.stat-num[data-target]');
    const statObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateNumber(entry.target);
                statObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    statNums.forEach(el => statObserver.observe(el));

    function animateNumber(el) {
        const target = parseInt(el.dataset.target, 10);
        const duration = 1800;
        const start = performance.now();

        function update(now) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 4);
            el.textContent = Math.round(target * ease);
            if (progress < 1) {
                requestAnimationFrame(update);
            }
        }
        requestAnimationFrame(update);
    }

    // ─── Hero Canvas Network Animation ───
    const heroCanvas = document.getElementById('heroCanvas');
    if (heroCanvas) {
        const ctx = heroCanvas.getContext('2d');
        let width, height;
        let particles = [];
        let animationId;
        let isActive = true;

        function resize() {
            width = heroCanvas.width = heroCanvas.offsetWidth * window.devicePixelRatio;
            height = heroCanvas.height = heroCanvas.offsetHeight * window.devicePixelRatio;
            ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
            width /= window.devicePixelRatio;
            height /= window.devicePixelRatio;
        }

        function createParticles() {
            particles = [];
            const count = window.innerWidth < 768 ? 25 : 45;
            for (let i = 0; i < count; i++) {
                particles.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    vx: (Math.random() - 0.5) * 0.4,
                    vy: (Math.random() - 0.5) * 0.4,
                    radius: Math.random() * 2 + 1
                });
            }
        }

        function draw() {
            if (!isActive) return;
            ctx.clearRect(0, 0, width, height);

            // Update and draw particles
            particles.forEach((p, i) => {
                p.x += p.vx;
                p.y += p.vy;

                if (p.x < 0 || p.x > width) p.vx *= -1;
                if (p.y < 0 || p.y > height) p.vy *= -1;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(249, 115, 22, 0.5)';
                ctx.fill();

                // Draw connections
                for (let j = i + 1; j < particles.length; j++) {
                    const p2 = particles[j];
                    const dx = p.x - p2.x;
                    const dy = p.y - p2.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < 140) {
                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.strokeStyle = `rgba(249, 115, 22, ${0.15 * (1 - dist / 140)})`;
                        ctx.lineWidth = 0.8;
                        ctx.stroke();
                    }
                }
            });

            animationId = requestAnimationFrame(draw);
        }

        resize();
        createParticles();
        draw();

        window.addEventListener('resize', () => {
            resize();
            createParticles();
        });

        // Pause when not visible
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                isActive = false;
                cancelAnimationFrame(animationId);
            } else {
                isActive = true;
                draw();
            }
        });
    }

    // ─── Navigation Active State ───
    const sections = document.querySelectorAll('section[id], header[id]');
    const navLinkEls = document.querySelectorAll('.nav-link');

    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.id;
                navLinkEls.forEach(link => {
                    const href = link.getAttribute('href');
                    link.classList.toggle('active', href === `#${id}`);
                });
            }
        });
    }, {
        rootMargin: '-40% 0px -55% 0px',
        threshold: 0
    });

    sections.forEach(section => {
        if (section.id) sectionObserver.observe(section);
    });

    // ─── Page Load Animation ───
    document.addEventListener('DOMContentLoaded', () => {
        document.body.style.opacity = '0';
        document.body.style.transition = 'opacity 0.5s ease';

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                document.body.style.opacity = '1';
            });
        });
    });

})();
