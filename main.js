/* =========================================================
   SOLVEX SpA — main.js
   Capa de interacción y motion. Organizado por módulos:
     1. Utilidades / feature detection
     2. Navbar inteligente (hide-on-scroll + blur + móvil)
     3. Reveal por scroll con GSAP (stagger)
     4. Contadores (count-up)
     5. Spotlight del hero (sigue el mouse)
     6. Tilt 3D + glow de tarjetas
     7. Ripple en botones
     8. Validación visual del formulario (solo estético)
========================================================= */
(function () {
    "use strict";

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hasGSAP = false;
    const isTouch = window.matchMedia("(hover: none)").matches;

    document.documentElement.classList.add("no-gsap");

    /* ---------------------------------------------------------
       2. NAVBAR INTELIGENTE
    --------------------------------------------------------- */
    const navbar = document.getElementById("navbar");
    const navToggle = document.getElementById("navToggle");
    const navLinks = document.getElementById("navLinks");
    const progress = document.getElementById("scrollProgress");
    let lastScroll = 0;

    function onScroll() {
        const y = window.scrollY;
        navbar.classList.toggle("scrolled", y > 30);
        // El navbar permanece siempre visible
        navbar.classList.remove("hidden");
        lastScroll = y;
        // Barra de progreso de scroll
        if (progress) {
            const max = document.documentElement.scrollHeight - window.innerHeight;
            progress.style.width = max > 0 ? `${(y / max) * 100}%` : "0%";
        }
    }
    window.addEventListener("scroll", onScroll, { passive: true });

    // Menú móvil con focus trap y cierre con Escape
    if (navToggle) {
        const focusables = () => navLinks.querySelectorAll("a");
        let lastFocused = null;

        const openMenu = () => {
            navLinks.classList.add("open");
            navToggle.setAttribute("aria-expanded", "true");
            navToggle.setAttribute("aria-label", "Cerrar menú");
            lastFocused = document.activeElement;
            focusables()[0]?.focus();
            document.addEventListener("keydown", onKeydown);
        };
        const closeMenu = (returnFocus = true) => {
            navLinks.classList.remove("open");
            navToggle.setAttribute("aria-expanded", "false");
            navToggle.setAttribute("aria-label", "Abrir menú");
            document.removeEventListener("keydown", onKeydown);
            if (returnFocus) (lastFocused || navToggle).focus();
        };
        const onKeydown = (e) => {
            if (e.key === "Escape") { closeMenu(); return; }
            if (e.key === "Tab") {
                const items = Array.from(focusables());
                if (!items.length) return;
                const first = items[0], last = items[items.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        };

        navToggle.addEventListener("click", () => {
            navLinks.classList.contains("open") ? closeMenu() : openMenu();
        });
        focusables().forEach((a) =>
            a.addEventListener("click", () => closeMenu(false))
        );
    }

    /* ---------------------------------------------------------
       2b. SCROLL-SPY (resalta la sección activa en el navbar)
    --------------------------------------------------------- */
    function initScrollSpy() {
        const sections = document.querySelectorAll("main section[id]");
        const linkFor = (id) => navLinks?.querySelector(`a[href="#${id}"]`);
        if (!sections.length || !navLinks) return;

        const io = new IntersectionObserver((entries) => {
            entries.forEach((e) => {
                const link = linkFor(e.target.id);
                if (!link) return;
                if (e.isIntersecting) {
                    navLinks.querySelectorAll('a[aria-current="true"]')
                        .forEach((a) => a.removeAttribute("aria-current"));
                    link.setAttribute("aria-current", "true");
                }
            });
        }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });
        sections.forEach((s) => io.observe(s));
    }

    /* ---------------------------------------------------------
       3. REVEAL POR SCROLL (GSAP + ScrollTrigger)
    --------------------------------------------------------- */
    function initReveal() {
        // Todos los contenidos permanecen visibles.
        // Se desactiva el reveal por scroll para evitar espacios vacíos
        // o contenidos que aparezcan demasiado tarde.
        return;
    }

    /* ---------------------------------------------------------
       4. CONTADORES (count-up al entrar en viewport)
    --------------------------------------------------------- */
    function initCounters() {
        const counters = document.querySelectorAll(".counter");
        if (!counters.length) return;

        const run = (el) => {
            const target = parseFloat(el.dataset.target) || 0;
            const prefix = el.dataset.prefix || "";
            const suffix = el.dataset.suffix || "";
            if (prefix) { el.textContent = prefix + suffix; return; } // valor textual (ej. INAE)
            if (prefersReduced) { el.textContent = target + suffix; return; }

            const dur = 1600;
            const t0 = performance.now();
            const step = (now) => {
                const p = Math.min((now - t0) / dur, 1);
                const eased = 1 - Math.pow(1 - p, 3);
                el.textContent = Math.round(target * eased) + suffix;
                if (p < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
        };

        const io = new IntersectionObserver((entries) => {
            entries.forEach((e) => {
                if (e.isIntersecting) { run(e.target); io.unobserve(e.target); }
            });
        }, { threshold: 0.5 });
        counters.forEach((c) => io.observe(c));
    }

    /* ---------------------------------------------------------
       4b. RED DE PARTÍCULAS DEL HERO (canvas 2D)
       Nodos conectados que evocan el átomo del logo. Optimizado:
       DPR limitado, densidad según ancho, pausa fuera de viewport,
       reactivo al puntero. Se desactiva con reduced-motion.
    --------------------------------------------------------- */
    function initParticles() {
        const canvas = document.getElementById("heroCanvas");
        if (!canvas || prefersReduced) return;
        const ctx = canvas.getContext("2d", { alpha: true });
        const hero = canvas.parentElement;

        let w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
        let nodes = [];
        let running = true;
        let raf = null;
        const pointer = { x: -9999, y: -9999 };
        const LINK_DIST = 150;

        function resize() {
            const r = hero.getBoundingClientRect();
            w = r.width; h = r.height;
            canvas.width = w * dpr; canvas.height = h * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            // densidad proporcional al área, con techo para performance
            const count = Math.min(Math.round((w * h) / 16000), 90);
            nodes = Array.from({ length: count }, () => ({
                x: Math.random() * w, y: Math.random() * h,
                vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
                r: Math.random() * 2.4 + 1.4,
            }));
        }

        function draw() {
            if (!running) return;
            ctx.clearRect(0, 0, w, h);
            for (let i = 0; i < nodes.length; i++) {
                const n = nodes[i];
                n.x += n.vx; n.y += n.vy;
                if (n.x < 0 || n.x > w) n.vx *= -1;
                if (n.y < 0 || n.y > h) n.vy *= -1;

                // leve atracción al puntero
                const dxp = pointer.x - n.x, dyp = pointer.y - n.y;
                const dp = Math.hypot(dxp, dyp);
                if (dp < 160) { n.x += dxp * 0.0016; n.y += dyp * 0.0016; }

                ctx.beginPath();
                ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
                ctx.fillStyle = "rgba(160, 232, 210, 0.95)";
                ctx.shadowColor = "rgba(93, 202, 165, 0.7)";
                ctx.shadowBlur = 6;
                ctx.fill();
                ctx.shadowBlur = 0;

                for (let j = i + 1; j < nodes.length; j++) {
                    const m = nodes[j];
                    const dx = n.x - m.x, dy = n.y - m.y;
                    const d = Math.hypot(dx, dy);
                    if (d < LINK_DIST) {
                        ctx.beginPath();
                        ctx.moveTo(n.x, n.y); ctx.lineTo(m.x, m.y);
                        ctx.strokeStyle = `rgba(190, 222, 255, ${0.32 * (1 - d / LINK_DIST)})`;
                        ctx.lineWidth = 1.2;
                        ctx.stroke();
                    }
                }
            }
            raf = requestAnimationFrame(draw);
        }

        hero.addEventListener("pointermove", (e) => {
            const r = hero.getBoundingClientRect();
            pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top;
        });
        hero.addEventListener("pointerleave", () => { pointer.x = pointer.y = -9999; });

        window.addEventListener("resize", () => { resize(); });

        // Pausar cuando el hero no está visible (ahorro de CPU)
        const io = new IntersectionObserver((entries) => {
            entries.forEach((e) => {
                running = e.isIntersecting;
                if (running && !prefersReduced) { cancelAnimationFrame(raf); draw(); }
                else cancelAnimationFrame(raf);
            });
        }, { threshold: 0 });
        io.observe(hero);

        resize();
        draw();
    }

    /* ---------------------------------------------------------
       5. SPOTLIGHT DEL HERO
    --------------------------------------------------------- */
    function initSpotlight() {
        const hero = document.querySelector(".hero");
        const spot = document.querySelector(".hero__spotlight");
        if (!hero || !spot || isTouch || prefersReduced) return;
        hero.addEventListener("pointermove", (e) => {
            const r = hero.getBoundingClientRect();
            spot.style.setProperty("--mx", `${e.clientX - r.left}px`);
            spot.style.setProperty("--my", `${e.clientY - r.top}px`);
        });
    }

    /* ---------------------------------------------------------
       6. TILT 3D + GLOW
    --------------------------------------------------------- */
    function initTilt() {
        if (isTouch || prefersReduced) return;
        document.querySelectorAll("[data-tilt]").forEach((el) => {
            const glow = el.querySelector(".card__glow");
            const MAX = 8;
            el.addEventListener("pointermove", (e) => {
                const r = el.getBoundingClientRect();
                const px = (e.clientX - r.left) / r.width;
                const py = (e.clientY - r.top) / r.height;
                el.style.transform = `perspective(900px) rotateY(${(px - 0.5) * MAX * 2}deg) rotateX(${(0.5 - py) * MAX * 2}deg) translateY(-6px)`;
                if (glow) { glow.style.setProperty("--gx", `${px * 100}%`); glow.style.setProperty("--gy", `${py * 100}%`); }
            });
            el.addEventListener("pointerleave", () => { el.style.transform = ""; });
        });
    }

    /* ---------------------------------------------------------
       6b. RED DE NODOS POR TARJETA (servicios)
       Al pasar el mouse: se mantiene el glow celeste y se anima una
       mini red de partículas dentro de la tarjeta (rAF solo mientras
       está en hover, para no gastar CPU). Reemplaza al tilt 3D.
    --------------------------------------------------------- */
    function initCards() {
        document.querySelectorAll("[data-nodes]").forEach((card) => {
            const glow = card.querySelector(".card__glow");
            const canvas = card.querySelector(".card__nodes");
            if (!canvas) return;
            const ctx = canvas.getContext("2d", { alpha: true });
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const onDark = card.dataset.nodes === "dark";
            const isNosotros = card.classList.contains("nosotros");

            // El panel "Nosotros" es mucho más grande que las demás tarjetas.
            // Por eso necesita mayor densidad, alcance y brillo para que la red
            // se vea tan nítida como en los CTA azules.
            const nodeColor = isNosotros
                ? "rgba(170, 242, 220, 1)"
                : (onDark ? "rgba(160, 232, 210, 0.95)" : "rgba(93, 202, 165, 0.9)");

            const lineColor = onDark ? "190, 222, 255" : "47, 126, 203";
            const LINK = isNosotros ? 165 : (onDark ? 130 : 92);
            const lineStrength = isNosotros ? 0.48 : 0.30;
            const pointer = { x: -9999, y: -9999 };
            let nodes = [], raf = null, w = 0, h = 0;

            function setup() {
                const r = card.getBoundingClientRect();
                w = r.width; h = r.height;
                canvas.width = w * dpr; canvas.height = h * dpr;
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                const count = isNosotros
                    ? Math.min(Math.max(Math.round((w * h) / 11500), 48), 78)
                    : Math.min(Math.round((w * h) / 9000), 28);

                nodes = Array.from({ length: count }, () => ({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    vx: (Math.random() - 0.5) * (isNosotros ? 0.38 : 0.3),
                    vy: (Math.random() - 0.5) * (isNosotros ? 0.38 : 0.3),
                    r: isNosotros
                        ? Math.random() * 1.7 + 1.25
                        : Math.random() * 1.5 + 1,
                }));
            }
            function draw() {
                ctx.clearRect(0, 0, w, h);
                for (let i = 0; i < nodes.length; i++) {
                    const n = nodes[i];
                    n.x += n.vx; n.y += n.vy;
                    if (n.x < 0 || n.x > w) n.vx *= -1;
                    if (n.y < 0 || n.y > h) n.vy *= -1;
                    const dxp = pointer.x - n.x, dyp = pointer.y - n.y;
                    if (Math.hypot(dxp, dyp) < 120) { n.x += dxp * 0.002; n.y += dyp * 0.002; }
                    ctx.beginPath();
                    ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
                    ctx.fillStyle = nodeColor;
                    ctx.fill();
                    for (let j = i + 1; j < nodes.length; j++) {
                        const m = nodes[j];
                        const d = Math.hypot(n.x - m.x, n.y - m.y);
                        if (d < LINK) {
                            ctx.beginPath();
                            ctx.moveTo(n.x, n.y); ctx.lineTo(m.x, m.y);
                            ctx.strokeStyle = `rgba(${lineColor}, ${lineStrength * (1 - d / LINK)})`;
                            ctx.lineWidth = isNosotros ? 1.25 : 1;
                            ctx.stroke();
                        }
                    }
                }
                raf = requestAnimationFrame(draw);
            }
            function start() { if (prefersReduced) return; setup(); cancelAnimationFrame(raf); draw(); }
            function stop() { cancelAnimationFrame(raf); raf = null; ctx.clearRect(0, 0, w, h); pointer.x = pointer.y = -9999; }

            card.addEventListener("pointerenter", start);
            card.addEventListener("pointerleave", stop);
            card.addEventListener("pointermove", (e) => {
                const r = card.getBoundingClientRect();
                const px = e.clientX - r.left, py = e.clientY - r.top;
                pointer.x = px; pointer.y = py;
                if (glow) {
                    glow.style.setProperty("--gx", `${(px / r.width) * 100}%`);
                    glow.style.setProperty("--gy", `${(py / r.height) * 100}%`);
                }
            });
        });
    }

    /* ---------------------------------------------------------
       7. RIPPLE EN BOTONES
    --------------------------------------------------------- */
    function initRipple() {
        document.querySelectorAll("[data-ripple]").forEach((btn) => {
            btn.addEventListener("pointerdown", (e) => {
                const r = btn.getBoundingClientRect();
                const size = Math.max(r.width, r.height);
                const span = document.createElement("span");
                span.className = "ripple-el";
                span.style.width = span.style.height = `${size}px`;
                span.style.left = `${e.clientX - r.left - size / 2}px`;
                span.style.top = `${e.clientY - r.top - size / 2}px`;
                btn.appendChild(span);
                span.addEventListener("animationend", () => span.remove());
            });
        });
    }

    /* ---------------------------------------------------------
       8. VALIDACIÓN VISUAL DEL FORMULARIO (solo estético)
    --------------------------------------------------------- */
    function initForm() {
        const form = document.getElementById("cotizarForm");
        if (!form) return;
        const note = document.getElementById("formNote");

        const validate = (input) => {
            const group = input.closest(".input-group");
            const ok = input.checkValidity() && input.value.trim() !== "";
            const shouldShowError = !ok && input.value.trim() !== "";
            group.classList.toggle("valid", ok);
            group.classList.toggle("invalid", shouldShowError);
            input.setAttribute("aria-invalid", shouldShowError ? "true" : "false");
            return ok;
        };

        form.querySelectorAll("input, textarea").forEach((input) => {
            input.addEventListener("blur", () => validate(input));
            input.addEventListener("input", () => {
                if (input.closest(".input-group").classList.contains("invalid")) validate(input);
            });
        });

        form.addEventListener("submit", (e) => {
            e.preventDefault(); // sin backend: solo feedback visual
            let allOk = true;
            form.querySelectorAll("input, textarea").forEach((i) => { if (!validate(i)) allOk = false; });
            if (allOk) {
                note.textContent = "✓ ¡Gracias! Nos pondremos en contacto pronto.";
                note.style.color = "var(--verde-hover)";
                form.reset();
                form.querySelectorAll(".input-group").forEach((g) => g.classList.remove("valid"));
            } else {
                note.textContent = "Por favor completa los campos requeridos.";
                note.style.color = "#e5484d";
            }
        });
    }

    /* ---------------------------------------------------------
       9. MODAL DE INFORMACIÓN LEGAL
    --------------------------------------------------------- */
    function initLegalModal() {
        const modal = document.getElementById("legalModal");
        const content = document.getElementById("legalContent");
        const title = document.getElementById("legalTitle");
        const close = document.getElementById("legalClose");
        if (!modal || !content || !title || !close) return;

        const legalTexts = {
            privacidad: {
                title: "Política de privacidad",
                html: `<h3>Información general</h3><p>Solvex SpA respeta la privacidad de quienes visitan este sitio. Este prototipo no almacena ni comparte datos personales con terceros.</p><h3>Formulario de contacto</h3><p>Los datos ingresados se utilizan únicamente para demostrar la experiencia de contacto. Actualmente el formulario no realiza un envío ni almacena información.</p><h3>Uso futuro de datos</h3><p>En una versión productiva, cualquier tratamiento de datos será informado previamente y contará con medidas de seguridad adecuadas.</p>`
            },
            terminos: {
                title: "Términos y condiciones",
                html: `<h3>Uso del sitio</h3><p>Este sitio presenta una propuesta académica y demostrativa de los servicios tecnológicos de Solvex SpA.</p><h3>Contenido</h3><p>La información publicada tiene carácter referencial y puede actualizarse sin aviso previo.</p><h3>Contratación de servicios</h3><p>Las condiciones, plazos, costos y alcances de un proyecto se definirán mediante una propuesta comercial formal.</p>`
            },
            aviso: {
                title: "Aviso legal",
                html: `<h3>Prototipo académico</h3><p>Solvex SpA corresponde a una empresa desarrollada en el contexto de un proyecto académico.</p><h3>Propiedad del contenido</h3><p>Los textos, diseños, logotipos y componentes se presentan exclusivamente para fines educativos y de evaluación.</p><h3>Responsabilidad</h3><p>La información presentada tiene fines académicos y fue elaborada a partir de fuentes públicas y oficiales consultadas en línea. No reemplaza la asesoría profesional especializada.</p>`
            }
        };

        document.querySelectorAll("[data-legal-open]").forEach((button) => {
            button.addEventListener("click", () => {
                const item = legalTexts[button.dataset.legalOpen];
                if (!item) return;
                title.textContent = item.title;
                content.innerHTML = item.html;
                modal.dataset.returnFocus = button.id || "";
                modal.showModal();
                document.body.classList.add("modal-open");
                requestAnimationFrame(() => close.focus());
            });
        });

        const closeModal = () => {
            modal.close();
            document.body.classList.remove("modal-open");
        };

        close.addEventListener("click", closeModal);
        modal.addEventListener("click", (event) => {
            if (event.target === modal) closeModal();
        });
        modal.addEventListener("close", () => {
            document.body.classList.remove("modal-open");
        });
    }


    /* ---------------------------------------------------------
       10. PAUSA DE ANIMACIONES CUANDO LA PESTAÑA NO ESTÁ VISIBLE
    --------------------------------------------------------- */
    document.addEventListener("visibilitychange", () => {
        document.documentElement.classList.toggle("page-hidden", document.hidden);
    });

    /* --------------------------------------------------------- */
    function init() {
        onScroll();
        initScrollSpy();
        // Reveal retirado: todo el contenido permanece visible.
        // Contadores retirados: se usan señales verificables.
        initParticles();
        initSpotlight();
        initTilt();
        initCards();
        initRipple();
        initForm();
        initLegalModal();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
