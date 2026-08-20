/**
 * 天枢序列官网 — 交互与动画
 */

(function () {
    'use strict';

    // ─── 新品推荐 · 轮播数据配置 ───
    // 新增产品时，只需在数组里追加一项即可自动出现在推荐页
    const carouselSlides = [
        {
            name: '天枢便签',
            en: 'PolarisNote',
            badges: [{ text: '推荐', cls: 'carousel-badge-new' }, { text: '桌面效率', cls: 'carousel-badge-polaris' }],
            desc: '融合 AI 智能助手、看板式管理与富文本编辑的下一代效率神器，Windows / Linux 全平台原生支持。',
            cover: 'assets/polaris-main.png',
            link: 'https://yan-stone-computer.github.io/polarisnote-web/',
            linkText: '了解更多'
        },
        {
            name: '枢游记',
            en: 'ShuYouJi',
            badges: [{ text: '新品', cls: 'carousel-badge-new' }, { text: '鸿蒙原生', cls: 'carousel-badge-shuyouji' }],
            desc: '基于 HarmonyOS NEXT 原生开发的 AI 智能旅行助手：图像修复、文化知识、行程规划，双端适配。',
            cover: 'assets/shuyouji-poster.png',
            link: 'https://yan-stone-computer.github.io/ShuYouJi-Web/',
            linkText: '了解更多'
        },
        {
            name: '陈汉升',
            en: 'ChenHanshen',
            badges: [{ text: '新品', cls: 'carousel-badge-new' }, { text: '角色对话', cls: 'carousel-badge-chenhansheng' }],
            desc: '原生安卓 AI 角色扮演 App：把《我真没想重生啊》男主装进手机，人格对话、发图识图、AI 生图零配置。',
            cover: 'assets/chenhansheng-cover.jpg',
            link: 'https://yan-stone-computer.github.io/awesome-chenhansheng-app/',
            linkText: '前往产品官网'
        }
        // ── 未来新品示例 ──
        // {
        //     name: '新产品名',
        //     en: 'NewProduct',
        //     badges: [{ text: 'NEW', cls: 'carousel-badge-new' }, { text: '分类', cls: 'carousel-badge-polaris' }],
        //     desc: '一句话简介……',
        //     cover: 'assets/xxx.png',
        //     link: 'https://example.com',
        //     linkText: '了解更多'
        // }
    ];

    // ─── 新品推荐 · 轮播渲染与交互 ───
    const carouselTrack = document.getElementById('carouselTrack');
    if (carouselTrack) {
        const viewport = document.getElementById('carouselViewport');
        const prevBtn = document.getElementById('carouselPrev');
        const nextBtn = document.getElementById('carouselNext');
        const dotsWrap = document.getElementById('carouselDots');

        let current = 0;
        let autoTimer = null;
        let cardGap = 24;

        // 渲染卡片（含"即将上线"占位卡）
        function renderCards() {
            carouselSlides.forEach(slide => {
                const card = document.createElement('div');
                card.className = 'carousel-card';
                card.innerHTML = `
                    <div class="carousel-card-cover">
                        <div class="carousel-badges">
                            ${slide.badges.map(b => `<span class="carousel-badge ${b.cls}">${b.text}</span>`).join('')}
                        </div>
                        <img src="${slide.cover}" alt="${slide.name}" loading="lazy">
                    </div>
                    <div class="carousel-card-body">
                        <h3 class="carousel-card-name">${slide.name}<span>${slide.en}</span></h3>
                        <p class="carousel-card-desc">${slide.desc}</p>
                        <a href="${slide.link}" target="_blank" class="carousel-card-link">
                            ${slide.linkText}
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                        </a>
                    </div>
                `;
                carouselTrack.appendChild(card);
            });

            // 占位卡
            const soonCard = document.createElement('div');
            soonCard.className = 'carousel-card carousel-card-soon';
            soonCard.innerHTML = `
                <div class="carousel-soon-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </div>
                <h4>更多产品，即将上线</h4>
                <p>天枢序列持续探索 AI 原生应用的边界，敬请期待</p>
            `;
            carouselTrack.appendChild(soonCard);
        }

        // 计算每屏可见卡片数与最大索引
        function getMetrics() {
            const card = carouselTrack.querySelector('.carousel-card');
            if (!card) return { perView: 1, maxIndex: 0, step: 1 };
            const cardWidth = card.getBoundingClientRect().width;
            const viewportWidth = viewport ? viewport.getBoundingClientRect().width : cardWidth;
            const perView = Math.max(1, Math.floor((viewportWidth + cardGap) / (cardWidth + cardGap)));
            const total = carouselTrack.children.length;
            const maxIndex = Math.max(0, total - perView);
            return { perView, maxIndex };
        }

        function update() {
            const { maxIndex } = getMetrics();
            current = Math.min(current, maxIndex);
            const card = carouselTrack.querySelector('.carousel-card');
            const cardWidth = card ? card.getBoundingClientRect().width : 0;
            const offset = current * (cardWidth + cardGap);
            carouselTrack.style.transform = `translateX(-${offset}px)`;

            // Dots
            if (dotsWrap) {
                dotsWrap.innerHTML = '';
                for (let i = 0; i <= maxIndex; i++) {
                    const dot = document.createElement('button');
                    dot.className = 'carousel-dot' + (i === current ? ' active' : '');
                    dot.setAttribute('aria-label', `第 ${i + 1} 页`);
                    dot.addEventListener('click', () => {
                        current = i;
                        update();
                        restartAuto();
                    });
                    dotsWrap.appendChild(dot);
                }
            }

            if (prevBtn) prevBtn.disabled = current === 0;
            if (nextBtn) nextBtn.disabled = current >= maxIndex;
        }

        function next() {
            const { maxIndex } = getMetrics();
            if (current < maxIndex) {
                current++;
                update();
            }
        }

        function prev() {
            if (current > 0) {
                current--;
                update();
            }
        }

        function startAuto() {
            stopAuto();
            autoTimer = setInterval(() => {
                const { maxIndex } = getMetrics();
                if (current >= maxIndex) {
                    current = 0;
                    update();
                } else {
                    next();
                }
            }, 5000);
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

        // 拖拽滑动
        let isDragging = false;
        let startX = 0;
        let startScrollOffset = 0;

        function dragStart(e) {
            isDragging = true;
            startX = (e.touches ? e.touches[0].clientX : e.clientX);
            startScrollOffset = current;
            carouselTrack.classList.add('dragging');
            stopAuto();
        }

        function dragMove(e) {
            if (!isDragging) return;
            const clientX = (e.touches ? e.touches[0].clientX : e.clientX);
            const dx = clientX - startX;
            if (Math.abs(dx) > 8) e.preventDefault();
            // 半透明跟随效果
            const card = carouselTrack.querySelector('.carousel-card');
            if (card) {
                const cardWidth = card.getBoundingClientRect().width + cardGap;
                carouselTrack.style.transform = `translateX(${(startScrollOffset * -cardWidth) + dx}px)`;
            }
        }

        function dragEnd(e) {
            if (!isDragging) return;
            isDragging = false;
            carouselTrack.classList.remove('dragging');
            const clientX = (e.changedTouches ? e.changedTouches[0].clientX : e.clientX);
            const dx = clientX - startX;
            const card = carouselTrack.querySelector('.carousel-card');
            const threshold = card ? card.getBoundingClientRect().width / 4 : 40;

            if (Math.abs(dx) > threshold) {
                if (dx < 0) next();
                else prev();
            } else {
                update();
            }
            restartAuto();
        }

        carouselTrack.addEventListener('mousedown', dragStart);
        window.addEventListener('mousemove', dragMove);
        window.addEventListener('mouseup', dragEnd);
        carouselTrack.addEventListener('touchstart', dragStart, { passive: true });
        carouselTrack.addEventListener('touchmove', dragMove, { passive: false });
        carouselTrack.addEventListener('touchend', dragEnd);

        if (prevBtn) prevBtn.addEventListener('click', () => { prev(); restartAuto(); });
        if (nextBtn) nextBtn.addEventListener('click', () => { next(); restartAuto(); });

        // 悬停暂停
        const carouselWrap = document.querySelector('.carousel');
        if (carouselWrap) {
            carouselWrap.addEventListener('mouseenter', stopAuto);
            carouselWrap.addEventListener('mouseleave', startAuto);
        }

        renderCards();
        update();
        startAuto();

        window.addEventListener('resize', () => update());
    }

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

    // ─── Product Card Scroll to Detail ───
    const polarisCard = document.getElementById('polarisCard');
    const shuyoujiCard = document.getElementById('shuyoujiCard');

    if (polarisCard) {
        polarisCard.addEventListener('click', (e) => {
            if (e.target.closest('a')) return;
            const target = document.getElementById('polaris');
            if (target) {
                const offset = navbar ? navbar.offsetHeight + 20 : 80;
                const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
                window.scrollTo({ top, behavior: 'smooth' });
            }
        });
    }

    if (shuyoujiCard) {
        shuyoujiCard.addEventListener('click', (e) => {
            if (e.target.closest('a')) return;
            const target = document.getElementById('shuyouji');
            if (target) {
                const offset = navbar ? navbar.offsetHeight + 20 : 80;
                const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
                window.scrollTo({ top, behavior: 'smooth' });
            }
        });
    }

    // ─── Lightbox ───
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightboxImg');

    window.openLightbox = function(src) {
        if (!lightbox || !lightboxImg) return;
        lightboxImg.src = src;
        lightbox.classList.add('open');
        document.body.style.overflow = 'hidden';
    };

    window.closeLightbox = function() {
        if (!lightbox) return;
        lightbox.classList.remove('open');
        document.body.style.overflow = '';
    };

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeLightbox();
    });

    // Add click handlers to showcase images
    document.querySelectorAll('.showcase-img-frame img').forEach(img => {
        img.style.cursor = 'pointer';
        img.addEventListener('click', () => openLightbox(img.src));
    });

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
