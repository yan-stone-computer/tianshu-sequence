/**
 * 天枢序列官网 — 交互与动画
 */

(function () {
    'use strict';

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
