/**
 * vibrant.js — Cinematic Scroll Experience
 * Three.js + GSAP ScrollTrigger
 *
 * Scene architecture:
 * 1. HERO  — Full-screen 3D laptop with live code on screen
 * 2. TRANSITION — Laptop flies back & shrinks as user scrolls
 * 3. DIGITAL — Floating code symbols fill the scene
 * 4. MANUFACTURING — Gears, molecules, industrial elements rise
 */

gsap.registerPlugin(ScrollTrigger);

/* ==========================================
   LOADER
   ========================================== */
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        gsap.to('#loader', {
            opacity: 0,
            duration: 0.8,
            ease: 'power2.out',
            onComplete: () => {
                document.getElementById('loader').style.display = 'none';
                initScene();
            }
        });
    }, 2000);
});

/* ==========================================
   CUSTOM CURSOR
   ========================================== */
const dot  = document.getElementById('cursor-dot');
const ring = document.getElementById('cursor-ring');

window.addEventListener('mousemove', e => {
    gsap.to(dot,  { x: e.clientX, y: e.clientY, duration: 0.15, ease: 'power2.out' });
    gsap.to(ring, { x: e.clientX, y: e.clientY, duration: 0.45, ease: 'power2.out' });
});

/* ==========================================
   DARK / LIGHT TOGGLE
   ========================================== */
const themeCheckbox = document.getElementById('theme-checkbox');
const bodyEl = document.body;

// Load saved theme or default to device preference
const savedTheme = localStorage.getItem('vibrant-theme');
const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
    bodyEl.classList.add('dark-mode');
    bodyEl.classList.remove('light-mode');
    themeCheckbox.checked = true;
} else {
    bodyEl.classList.add('light-mode');
    bodyEl.classList.remove('dark-mode');
    themeCheckbox.checked = false;
}

themeCheckbox.addEventListener('change', () => {
    const isDark = themeCheckbox.checked;
    bodyEl.classList.toggle('dark-mode', isDark);
    bodyEl.classList.toggle('light-mode', !isDark);
    localStorage.setItem('vibrant-theme', isDark ? 'dark' : 'light');

    /* Light-mode: bright ambient; Dark-mode: dim with accent glow */
    if (laptopScene) {
        gsap.to(laptopScene.ambient, { intensity: isDark ? 0.3 : 1.0, duration: 0.8 });
        gsap.to(laptopScene.accentLight.position, { y: isDark ? 5 : 3, duration: 0.5 });
    }
});

/* ==========================================
   THREE.JS — MAIN SCENE
   ========================================== */
let laptopScene = null;

function initScene() {
    const canvas = document.getElementById('three-canvas');
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.shadowMap.enabled = true;

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 100);
    camera.position.set(0, 1.2, 7);

    /* ---- LIGHTS ---- */
    const ambient = new THREE.AmbientLight(0xffffff, 1.0);
    scene.add(ambient);

    const directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.position.set(4, 6, 4);
    directional.castShadow = true;
    scene.add(directional);

    const accentLight = new THREE.PointLight(0x6c63ff, 3, 20);
    accentLight.position.set(-3, 3, 4);
    scene.add(accentLight);

    const accentLight2 = new THREE.PointLight(0xa78bfa, 2, 20);
    accentLight2.position.set(3, -2, 3);
    scene.add(accentLight2);

    laptopScene = { ambient, accentLight };

    /* ---- PARTICLES (Star Field) ---- */
    const starsGeo = new THREE.BufferGeometry();
    const starCount = 2500;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i++) starPos[i] = (Math.random() - 0.5) * 80;
    starsGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ size: 0.06, color: 0x8888ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending });
    const stars = new THREE.Points(starsGeo, starMat);
    scene.add(stars);

    /* ================================================
       LAPTOP MODEL
       ================================================ */
    const laptop = new THREE.Group();
    scene.add(laptop);

    const chassisMat = new THREE.MeshPhysicalMaterial({
        color: 0xd0d5e8,
        metalness: 0.9,
        roughness: 0.15,
        reflectivity: 1,
    });

    const darkMat = new THREE.MeshPhysicalMaterial({ color: 0x1a1a2e, metalness: 0.7, roughness: 0.3 });

    /* Base */
    const base = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.09, 2.4), chassisMat);
    base.castShadow = true;
    laptop.add(base);

    /* Trackpad */
    const trackpad = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.01, 0.7), darkMat);
    trackpad.position.set(0, 0.055, 0.5);
    laptop.add(trackpad);

    /* Screen Group (hinged) */
    const screenGroup = new THREE.Group();
    screenGroup.position.set(0, 0.04, -1.15);
    laptop.add(screenGroup);

    /* Screen Lid */
    const lid = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.065, 2.2), chassisMat);
    lid.position.set(0, 1.1, 1.1);
    lid.rotation.x = -Math.PI / 2 + 0.25;
    screenGroup.add(lid);

    /* Screen Bezel */
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.04, 2.02), darkMat);
    bezel.position.set(0, 1.1, 1.095);
    bezel.rotation.x = lid.rotation.x;
    screenGroup.add(bezel);

    /* Screen — Canvas Texture (CODE!) */
    const codeCanvas = document.createElement('canvas');
    codeCanvas.width = 1024;
    codeCanvas.height = 640;
    const ctx = codeCanvas.getContext('2d');
    drawCodeScreen(ctx, codeCanvas.width, codeCanvas.height);

    const screenTex = new THREE.CanvasTexture(codeCanvas);
    const screenMat = new THREE.MeshBasicMaterial({ map: screenTex });
    const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.88), screenMat);
    screenMesh.position.set(0, 1.1, 1.1);
    screenMesh.rotation.x = lid.rotation.x;
    screenGroup.add(screenMesh);

    /* Animate code text every 80ms */
    let codeLine = 0;
    setInterval(() => {
        codeLine++;
        drawCodeScreen(ctx, codeCanvas.width, codeCanvas.height, codeLine);
        screenTex.needsUpdate = true;
    }, 80);

    /* ---- Laptop initial position ---- */
    laptop.rotation.x = 0.12;

    /* ================================================
       CODING SYMBOLS — Appear in Digital Section
       ================================================ */
    const symbols = [];
    const symbolChars = ['{ }', '< />', '( )', '=>', '01', 'fn', '&&', '::'];

    for (let i = 0; i < 10; i++) {
        const symCanvas = document.createElement('canvas');
        symCanvas.width = 256; symCanvas.height = 256;
        const sc = symCanvas.getContext('2d');
        sc.fillStyle = 'rgba(108,99,255,0.85)';
        sc.font = 'bold 80px JetBrains Mono, monospace';
        sc.textAlign = 'center';
        sc.textBaseline = 'middle';
        sc.fillText(symbolChars[i % symbolChars.length], 128, 128);
        const symTex = new THREE.CanvasTexture(symCanvas);
        const symMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(1.5, 1.5),
            new THREE.MeshBasicMaterial({ map: symTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
        );
        symMesh.position.set(
            (Math.random() - 0.5) * 14,
            (Math.random() - 0.5) * 8,
            (Math.random() - 0.5) * 5 - 5
        );
        symMesh.userData.baseY = symMesh.position.y;
        scene.add(symMesh);
        symbols.push(symMesh);
    }

    /* ================================================
       MANUFACTURING 3D OBJECTS — Gears & Molecules
       ================================================ */
    const mfgGroup = new THREE.Group();
    scene.add(mfgGroup);

    /* Gear */
    function createGear(r, teeth, depth) {
        const shape = new THREE.Shape();
        const toothH = r * 0.3;
        const toothW = (2 * Math.PI * r) / teeth * 0.3;
        shape.moveTo(r, 0);
        for (let i = 0; i < teeth; i++) {
            const angle = (i / teeth) * Math.PI * 2;
            const nx = Math.cos(angle) * r;
            const ny = Math.sin(angle) * r;
            const ox = Math.cos(angle + 0.05) * (r + toothH);
            const oy = Math.sin(angle + 0.05) * (r + toothH);
            const ox2 = Math.cos(angle + 0.2) * (r + toothH);
            const oy2 = Math.sin(angle + 0.2) * (r + toothH);
            const ex = Math.cos(angle + 0.25) * r;
            const ey = Math.sin(angle + 0.25) * r;
            shape.lineTo(nx, ny);
            shape.lineTo(ox, oy);
            shape.lineTo(ox2, oy2);
            shape.lineTo(ex, ey);
        }
        shape.closePath();
        const hole = new THREE.Path();
        hole.absarc(0, 0, r * 0.25, 0, Math.PI * 2, true);
        shape.holes.push(hole);
        const extrudeSettings = { depth, bevelEnabled: false };
        return new THREE.ExtrudeGeometry(shape, extrudeSettings);
    }

    const gearMat = new THREE.MeshPhysicalMaterial({ color: 0xb8c0d0, metalness: 0.95, roughness: 0.1 });
    const gear1 = new THREE.Mesh(createGear(1, 12, 0.25), gearMat);
    gear1.position.set(-4, -12, -4);
    gear1.rotation.z = 0;
    mfgGroup.add(gear1);

    const gear2 = new THREE.Mesh(createGear(0.65, 8, 0.2), gearMat);
    gear2.position.set(-2.5, -12, -4);
    gear2.rotation.z = 0;
    mfgGroup.add(gear2);

    /* Molecule structure */
    function createMolecule() {
        const molGroup = new THREE.Group();
        const atomMat = new THREE.MeshPhysicalMaterial({ color: 0xa78bfa, metalness: 0.4, roughness: 0.2, transparent: true, opacity: 0.9 });
        const bondMat = new THREE.MeshPhysicalMaterial({ color: 0x6c63ff, metalness: 0.5, roughness: 0.3 });

        const positions = [
            [0, 0, 0], [1.2, 0.8, 0.4], [-1.2, 0.6, -0.4],
            [0.5, -1.0, 0.8], [-0.4, -0.8, -0.9]
        ];

        const atoms = positions.map(pos => {
            const atom = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), atomMat);
            atom.position.set(...pos);
            molGroup.add(atom);
            return atom;
        });

        /* Bonds */
        for (let i = 0; i < atoms.length - 1; i++) {
            const a = atoms[i].position, b = atoms[i + 1].position;
            const dir = new THREE.Vector3().subVectors(b, a);
            const len = dir.length();
            const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
            const bond = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, len, 8), bondMat);
            bond.position.copy(mid);
            bond.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
            molGroup.add(bond);
        }
        return molGroup;
    }

    const molecule = createMolecule();
    molecule.position.set(4, -14, -4);
    molecule.scale.set(1.5, 1.5, 1.5);
    mfgGroup.add(molecule);

    /* ================================================
       SCROLL-DRIVEN ANIMATIONS (GSAP ScrollTrigger)
       ================================================ */
    const totalScroll = document.documentElement.scrollHeight - window.innerHeight;

    /* Phase 1: Laptop zooms back into background on scroll */
    gsap.timeline({
        scrollTrigger: {
            trigger: '#hero',
            start: 'top top',
            end: 'bottom top',
            scrub: 1.5,
        }
    })
    .to(laptop.position, { z: -20, y: -3 }, 0)
    .to(laptop.rotation, { x: -0.4 }, 0)
    .to(laptop.scale,   { x: 0.3, y: 0.3, z: 0.3 }, 0)
    .to(camera.position, { z: 6, y: 2 }, 0);

    /* Phase 2: Code symbols float in during Digital section */
    ScrollTrigger.create({
        trigger: '#digital',
        start: 'top 70%',
        end: 'bottom 20%',
        onEnter: () => {
            symbols.forEach((s, i) => {
                gsap.to(s.material, { opacity: 0.7, delay: i * 0.1, duration: 1 });
            });
        },
        onLeaveBack: () => {
            symbols.forEach(s => gsap.to(s.material, { opacity: 0, duration: 0.5 }));
        }
    });

    /* Phase 3: Manufacturing objects rise from below */
    gsap.timeline({
        scrollTrigger: {
            trigger: '#manufacturing',
            start: 'top 60%',
            end: 'center center',
            scrub: 2,
        }
    })
    .to(gear1.position,   { y: 1, z: -3 }, 0)
    .to(gear2.position,   { y: 0.2, z: -3 }, 0)
    .to(molecule.position, { y: 2, z: -5, x: 5 }, 0);

    /* ================================================
       ANIMATION LOOP
       ================================================ */
    const clock = new THREE.Clock();
    function animate() {
        requestAnimationFrame(animate);
        const t = clock.getElapsedTime();

        /* Subtle laptop bob in hero */
        laptop.position.y += Math.sin(t * 0.8) * 0.0015;

        /* Rotate gears */
        gear1.rotation.z = t * 0.4;
        gear2.rotation.z = -t * 0.6;

        /* Spin molecule */
        molecule.rotation.y = t * 0.5;
        molecule.rotation.x = t * 0.3;

        /* Float symbols */
        symbols.forEach((s, i) => {
            s.position.y = s.userData.baseY + Math.sin(t * 0.5 + i) * 0.4;
            s.rotation.z = Math.sin(t * 0.3 + i * 0.5) * 0.1;
        });

        /* Drift stars */
        stars.rotation.y = t * 0.012;
        stars.rotation.x = t * 0.005;

        /* Accent light orbit */
        accentLight.position.x = Math.sin(t * 0.4) * 4;
        accentLight.position.y = Math.cos(t * 0.4) * 3;

        renderer.render(scene, camera);
    }
    animate();

    /* ================================================
       RESIZE
       ================================================ */
    window.addEventListener('resize', () => {
        const W = canvas.clientWidth, H = canvas.clientHeight;
        renderer.setSize(W, H);
        camera.aspect = W / H;
        camera.updateProjectionMatrix();
    });
}

/* ==========================================
   CODE SCREEN PAINTER
   ========================================== */
const CODE_LINES = [
    "const server = express();",
    "app.use(express.json());",
    "db.run(`CREATE TABLE IF NOT EXISTS",
    "  messages (id INTEGER PRIMARY KEY,",
    "  name TEXT, email TEXT)`);",
    "",
    "app.post('/api/message', (req, res) => {",
    "  const { name, email } = req.body;",
    "  db.run(`INSERT INTO messages`,",
    "    [name, email], function(err) {",
    "      res.json({ success: !err });",
    "  });",
    "});",
    "",
    "app.listen(3002, () => {",
    "  console.log('Server online ✓');",
    "});",
    "",
    "// Analytics middleware...",
    "app.use((req, res, next) => {",
    "  trackVisitor(req.ip, req.path);",
    "  next();",
    "});",
];

const COLORS = {
    keyword: '#c792ea',
    string:  '#c3e88d',
    comment: '#546e7a',
    fn:      '#82aaff',
    num:     '#f78c6c',
    plain:   '#d6deeb',
};

function drawCodeScreen(ctx, W, H, lineOffset = 0) {
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, W, H);

    /* Glow scanline */
    const scanY = ((lineOffset * 3) % H);
    const grd = ctx.createLinearGradient(0, scanY - 20, 0, scanY + 20);
    grd.addColorStop(0, 'transparent');
    grd.addColorStop(0.5, 'rgba(108,99,255,0.06)');
    grd.addColorStop(1, 'transparent');
    ctx.fillStyle = grd;
    ctx.fillRect(0, scanY - 20, W, 40);

    ctx.font = '18px "JetBrains Mono", monospace';
    const lineH = 30;
    const startLine = Math.floor(lineOffset / 3) % CODE_LINES.length;
    const visibleLines = Math.ceil(H / lineH) + 2;

    for (let i = 0; i < visibleLines; i++) {
        const idx = (startLine + i) % CODE_LINES.length;
        const line = CODE_LINES[idx];
        const y = i * lineH + 36;

        /* Line number */
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillText(String(idx + 1).padStart(3, ' '), 12, y);

        /* Syntax highlight (simple) */
        ctx.fillStyle = COLORS.plain;
        let colored = false;
        if (/^\/\//.test(line.trim())) { ctx.fillStyle = COLORS.comment; colored = true; }
        else if (/const|let|var|app\.|function|async|return/.test(line)) { ctx.fillStyle = COLORS.keyword; }
        else if (/'[^']*'|`[^`]*`/.test(line)) { ctx.fillStyle = COLORS.string; }
        ctx.fillText(line, 56, y);

        /* Cursor blink on last visible line */
        if (i === Math.min(visibleLines - 2, CODE_LINES.length - 1)) {
            if (Math.floor(Date.now() / 500) % 2 === 0) {
                ctx.fillStyle = COLORS.plain;
                ctx.fillRect(56 + ctx.measureText(line).width + 2, y - 16, 2, 20);
            }
        }
    }

    /* macOS traffic light dots */
    const dots = [{ x: 20, c: '#ff5f57' }, { x: 40, c: '#febc2e' }, { x: 60, c: '#28c840' }];
    dots.forEach(d => {
        ctx.beginPath();
        ctx.arc(d.x, 14, 6, 0, Math.PI * 2);
        ctx.fillStyle = d.c;
        ctx.fill();
    });

    /* Bottom glow rim */
    const rimGrd = ctx.createLinearGradient(0, H - 60, 0, H);
    rimGrd.addColorStop(0, 'transparent');
    rimGrd.addColorStop(1, 'rgba(108,99,255,0.1)');
    ctx.fillStyle = rimGrd;
    ctx.fillRect(0, H - 60, W, 60);
}

/* ==========================================
   REVEAL ON SCROLL
   ========================================== */
const revealEls = document.querySelectorAll('.reveal-block');
const revealObs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, { threshold: 0.12 });

revealEls.forEach(el => revealObs.observe(el));

/* ==========================================
   MAGNETIC BUTTONS
   ========================================== */
document.querySelectorAll('.magnetic-btn, .btn-admin').forEach(btn => {
    btn.addEventListener('mousemove', (e) => {
        const r = btn.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width  / 2) * 0.25;
        const y = (e.clientY - r.top  - r.height / 2) * 0.25;
        gsap.to(btn, { x, y, duration: 0.3, ease: 'power2.out' });
    });
    btn.addEventListener('mouseleave', () => {
        gsap.to(btn, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    });
});

/* ==========================================
   LOAD PROJECTS FROM BACKEND
   ========================================== */
(async () => {
    try {
        const res  = await fetch('/api/projects');
        const data = await res.json();
        const list = document.getElementById('project-list');

        if (data.success && data.projects.length > 0) {
            list.innerHTML = data.projects.map(p => `
                <div class="project-card reveal-block" onclick="window.open('${p.link}','_blank')">
                    <h3>${p.title}</h3>
                    <p>${p.description}</p>
                    <span class="card-arrow">→</span>
                </div>
            `).join('');
            list.querySelectorAll('.project-card').forEach(el => revealObs.observe(el));
        } else {
            list.innerHTML = '<p style="color:var(--text-muted)">No projects yet.</p>';
        }
    } catch (err) {
        console.warn('Project fetch failed:', err);
    }
})();

/* ==========================================
   CONTACT FORM SUBMISSION
   ========================================== */
document.getElementById('contact-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const btn  = form.querySelector('button');
    btn.textContent = 'Sending...';
    btn.disabled = true;

    try {
        const fd = new FormData(form);
        const body = Object.fromEntries(fd.entries());
        const res  = await fetch('/save-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (data.success) {
            btn.textContent = 'Sent! ✓';
            btn.style.background = 'linear-gradient(135deg,#28c840,#3dd68c)';
            form.reset();
        } else {
            btn.textContent = 'Failed. Try again.';
        }
    } catch {
        btn.textContent = 'Error. Try again.';
    }

    setTimeout(() => { btn.textContent = 'Send Message →'; btn.disabled = false; btn.style.background = ''; }, 3000);
});

