// Shared copperplate-and-parchment vector icon library for Web and WeChat Miniprogram.
const MacondoIcons = (() => {
  const PALETTE = {
    ink: '#2c1e16',
    inkSoft: '#5c4332',
    sepia: '#8b4513',
    brass: '#c59b27',
    goldLight: '#f3d478',
    amber: '#d97706',
    crimson: '#9e2a2b',
    crimsonBright: '#d9483b',
    parchment: '#f4ebd9',
    parchmentMid: '#e6d6b8',
    waterDark: '#2f5b76',
    waterLight: '#6ca6c1',
    wood: '#8b5128',
    woodDark: '#4f2b13',
    iron: '#3a322d'
  };

  // SVG markup keyed by icon identifier (64x64 viewBox).
  const SVG_BODIES = {
    butterfly: `
      <ellipse cx="32" cy="34" rx="22" ry="20" fill="#f3d478" fill-opacity="0.22"/>
      <path d="M31 29 C23 15, 8 11, 10 25 C11 33, 21 35, 30 33 Z" fill="#e5b53a" stroke="#2c1e16" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M33 29 C41 15, 56 11, 54 25 C53 33, 43 35, 34 33 Z" fill="#e5b53a" stroke="#2c1e16" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M30 34 C20 35, 13 43, 17 50 C21 55, 29 48, 31 39 Z" fill="#c59b27" stroke="#2c1e16" stroke-width="2.3" stroke-linejoin="round"/>
      <path d="M34 34 C44 35, 51 43, 47 50 C43 55, 35 48, 33 39 Z" fill="#c59b27" stroke="#2c1e16" stroke-width="2.3" stroke-linejoin="round"/>
      <circle cx="19" cy="23" r="2.6" fill="#2c1e16"/>
      <circle cx="45" cy="23" r="2.6" fill="#2c1e16"/>
      <path d="M16 29 L26 30 M48 29 L38 30 M22 43 L28 38 M42 43 L36 38" stroke="#5c4332" stroke-width="1.5" stroke-linecap="round"/>
      <rect x="30" y="24" width="4" height="20" rx="2" fill="#2c1e16"/>
      <path d="M31 24 C29 17, 25 14, 22 15 M33 24 C35 17, 39 14, 42 15" fill="none" stroke="#2c1e16" stroke-width="1.9" stroke-linecap="round"/>
    `,
    scroll: `
      <rect x="15" y="13" width="34" height="38" rx="3" fill="#efe2c8" stroke="#2c1e16" stroke-width="2.4"/>
      <rect x="11" y="11" width="42" height="7" rx="3.5" fill="#c59b27" stroke="#2c1e16" stroke-width="2.2"/>
      <rect x="11" y="46" width="42" height="7" rx="3.5" fill="#c59b27" stroke="#2c1e16" stroke-width="2.2"/>
      <path d="M22 24 H42 M22 30 H38 M22 36 H33" stroke="#5c4332" stroke-width="2" stroke-linecap="round"/>
      <circle cx="40" cy="39" r="5.5" fill="#9e2a2b" stroke="#2c1e16" stroke-width="1.8"/>
      <circle cx="40" cy="39" r="2.2" fill="#d9483b"/>
    `,
    lantern: `
      <path d="M25 17 C25 10, 39 10, 39 17" fill="none" stroke="#2c1e16" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M21 21 H43 L39 17 H25 Z" fill="#c59b27" stroke="#2c1e16" stroke-width="2.2" stroke-linejoin="round"/>
      <rect x="20" y="21" width="24" height="24" rx="4" fill="#3a281e" stroke="#2c1e16" stroke-width="2.4"/>
      <rect x="24" y="24" width="16" height="18" rx="2" fill="#f3d478" fill-opacity="0.28"/>
      <path d="M32 26 C36 31, 36 38, 32 40 C28 38, 28 31, 32 26 Z" fill="#f3d478" stroke="#d97706" stroke-width="1.5"/>
      <path d="M27 21 V45 M37 21 V45" stroke="#2c1e16" stroke-width="1.6"/>
      <rect x="18" y="45" width="28" height="6" rx="2" fill="#8b4513" stroke="#2c1e16" stroke-width="2.2"/>
    `,
    barrel: `
      <path d="M20 18 C15 27, 15 39, 20 48 H44 C49 39, 49 27, 44 18 Z" fill="#8b5128" stroke="#2c1e16" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M17 26 H47 M17 40 H47" stroke="#3a322d" stroke-width="4" stroke-linecap="round"/>
      <path d="M27 19 C24 28, 24 38, 27 47 M37 19 C40 28, 40 38, 37 47" fill="none" stroke="#4f2b13" stroke-width="1.6"/>
      <path d="M32 18 C32 12, 37 10, 41 12" fill="none" stroke="#2c1e16" stroke-width="2.2" stroke-linecap="round"/>
      <circle cx="43" cy="11" r="3.4" fill="#d97706" stroke="#9e2a2b" stroke-width="1.5"/>
      <path d="M43 5 V8 M47 9 L49 7 M45 14 L48 15" stroke="#f3d478" stroke-width="1.8" stroke-linecap="round"/>
    `,
    char_jose: `
      <circle cx="32" cy="32" r="24" fill="#efe2c8" stroke="#8b4513" stroke-width="2.6"/>
      <circle cx="32" cy="32" r="20" fill="none" stroke="#c59b27" stroke-width="1.2" stroke-dasharray="3 2"/>
      <path d="M21 20 V33 C21 40, 26 45, 32 45 C38 45, 43 40, 43 33 V20 H37 V33 C37 36, 35 39, 32 39 C29 39, 27 36, 27 33 V20 Z" fill="#9e2a2b" stroke="#2c1e16" stroke-width="2.2" stroke-linejoin="round"/>
      <rect x="21" y="20" width="6" height="6" fill="#d8c39e" stroke="#2c1e16" stroke-width="1.8"/>
      <rect x="37" y="20" width="6" height="6" fill="#d8c39e" stroke="#2c1e16" stroke-width="1.8"/>
      <path d="M16 16 L19 19 M48 16 L45 19 M32 12 V16" stroke="#c59b27" stroke-width="2" stroke-linecap="round"/>
    `,
    char_aureliano: `
      <circle cx="32" cy="32" r="24" fill="#efe2c8" stroke="#b45309" stroke-width="2.6"/>
      <circle cx="32" cy="32" r="20" fill="none" stroke="#c59b27" stroke-width="1.2" stroke-dasharray="3 2"/>
      <path d="M18 33 C24 23, 38 23, 45 33 C38 43, 24 43, 18 33 Z" fill="#e5b53a" stroke="#2c1e16" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M44 33 L51 26 V40 Z" fill="#c59b27" stroke="#2c1e16" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="25" cy="31" r="2" fill="#2c1e16"/>
      <path d="M30 27 C32 31, 32 35, 30 39" fill="none" stroke="#5c4332" stroke-width="1.6"/>
      <path d="M32 14 L33.8 18 L38 18.4 L34.8 21 L35.8 25 L32 22.8 L28.2 25 L29.2 21 L26 18.4 L30.2 18 Z" fill="#c59b27" stroke="#2c1e16" stroke-width="1.3"/>
    `,
    char_rebeca: `
      <circle cx="32" cy="32" r="24" fill="#efe2c8" stroke="#9e2a2b" stroke-width="2.6"/>
      <circle cx="32" cy="32" r="20" fill="none" stroke="#9e2a2b" stroke-width="1.2" stroke-dasharray="3 2"/>
      <circle cx="32" cy="31" r="14" fill="none" stroke="#9e2a2b" stroke-width="1.7"/>
      <path d="M32 14 V21 M32 41 V48 M15 31 H22 M42 31 H49" stroke="#9e2a2b" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M20 29 H42 V34 H31 L27 42 H22 L24 34 H20 Z" fill="#3a322d" stroke="#2c1e16" stroke-width="1.9" stroke-linejoin="round"/>
      <circle cx="32" cy="31" r="2.2" fill="#d9483b"/>
    `,
    char_ursula: `
      <circle cx="32" cy="32" r="24" fill="#efe2c8" stroke="#8b4513" stroke-width="2.6"/>
      <circle cx="26" cy="25" r="7" fill="none" stroke="#c59b27" stroke-width="2.6"/>
      <circle cx="26" cy="25" r="7" fill="none" stroke="#2c1e16" stroke-width="1.2"/>
      <path d="M31 30 L45 44 M40 39 L43 36 M43 42 L46 39" stroke="#2c1e16" stroke-width="2.6" stroke-linecap="round"/>
      <circle cx="26" cy="25" r="2.4" fill="#8b4513"/>
    `,
    char_melquiades: `
      <circle cx="32" cy="32" r="24" fill="#efe2c8" stroke="#5c4332" stroke-width="2.6"/>
      <circle cx="32" cy="32" r="14" fill="none" stroke="#c59b27" stroke-width="2.2"/>
      <path d="M32 15 V49 M15 32 H49" stroke="#5c4332" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="32" cy="32" r="4.5" fill="#9e2a2b" stroke="#2c1e16" stroke-width="1.8"/>
    `,
    char_amaranta: `
      <circle cx="32" cy="32" r="24" fill="#efe2c8" stroke="#2c1e16" stroke-width="2.6"/>
      <path d="M22 20 H42 V44 H22 Z" fill="#3a322d" stroke="#2c1e16" stroke-width="2.2"/>
      <path d="M20 20 H44 M20 44 H44" stroke="#c59b27" stroke-width="3" stroke-linecap="round"/>
      <path d="M24 27 H40 M24 32 H40 M24 37 H40" stroke="#e6d6b8" stroke-width="1.4"/>
    `,
    char_pilar: `
      <circle cx="32" cy="32" r="24" fill="#efe2c8" stroke="#7c2d12" stroke-width="2.6"/>
      <rect x="22" y="17" width="20" height="30" rx="3" fill="#fdf6e7" stroke="#2c1e16" stroke-width="2.2"/>
      <circle cx="32" cy="28" r="5" fill="#c59b27" stroke="#2c1e16" stroke-width="1.6"/>
      <path d="M27 40 C30 37, 34 37, 37 40" fill="none" stroke="#9e2a2b" stroke-width="2" stroke-linecap="round"/>
    `,
    char_remedios: `
      <circle cx="32" cy="32" r="24" fill="#efe2c8" stroke="#6ca6c1" stroke-width="2.6"/>
      <path d="M20 44 C22 29, 28 20, 36 18 C43 22, 43 34, 36 44 Z" fill="#fdf6e7" stroke="#2c1e16" stroke-width="2"/>
      <path d="M20 24 C17 20, 22 17, 25 21 C28 17, 33 20, 30 24 Z" fill="#e5b53a" stroke="#2c1e16" stroke-width="1.5"/>
    `,
    char_babylon: `
      <circle cx="32" cy="32" r="24" fill="#efe2c8" stroke="#8b4513" stroke-width="2.6"/>
      <path d="M20 20 H44 V44 H20 Z" fill="#f3d478" fill-opacity="0.35" stroke="#2c1e16" stroke-width="2"/>
      <path d="M25 27 H39 M25 33 H39 M25 39 H34" stroke="#9e2a2b" stroke-width="2.2" stroke-linecap="round"/>
    `,
    undo: `
      <path d="M22 24 H39 C46 24, 50 29, 50 35 C50 41, 45 46, 38 46 H22" fill="none" stroke="#2c1e16" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M27 16 L17 24 L27 32" fill="none" stroke="#8b4513" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
    `,
    reset: `
      <path d="M46 25 A16 16 0 1 0 47 38" fill="none" stroke="#2c1e16" stroke-width="3" stroke-linecap="round"/>
      <path d="M48 16 L47 26 L37 25" fill="none" stroke="#8b4513" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M27 26 H37 L32 32 L37 38 H27 L32 32 Z" fill="#c59b27" fill-opacity="0.45" stroke="#2c1e16" stroke-width="1.8" stroke-linejoin="round"/>
    `,
    hint: `
      <rect x="16" y="14" width="32" height="36" rx="3" fill="#efe2c8" stroke="#2c1e16" stroke-width="2.4"/>
      <path d="M23 23 H37 M23 29 H33" stroke="#5c4332" stroke-width="2" stroke-linecap="round"/>
      <circle cx="38" cy="37" r="8" fill="#fdf6e7" stroke="#8b4513" stroke-width="2.4"/>
      <path d="M44 43 L51 50" stroke="#2c1e16" stroke-width="3" stroke-linecap="round"/>
    `,
    crest: `
      <path d="M32 12 L48 19 V33 C48 43, 41 49, 32 53 C23 49, 16 43, 16 33 V19 Z" fill="#e6d6b8" stroke="#2c1e16" stroke-width="2.4" stroke-linejoin="round"/>
      <circle cx="28" cy="29" r="5" fill="none" stroke="#8b4513" stroke-width="2.4"/>
      <path d="M32 33 L41 42 M37 38 L40 35" stroke="#8b4513" stroke-width="2.4" stroke-linecap="round"/>
    `,
    quill: `
      <path d="M47 14 C36 16, 25 27, 21 43 L16 48 L22 46 C36 42, 46 31, 47 14 Z" fill="#e6d6b8" stroke="#2c1e16" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M16 48 L43 18" stroke="#8b4513" stroke-width="2" stroke-linecap="round"/>
      <path d="M15 51 H49" stroke="#2c1e16" stroke-width="2.2" stroke-linecap="round"/>
    `,
    compass: `
      <circle cx="32" cy="32" r="20" fill="#efe2c8" stroke="#2c1e16" stroke-width="2.2"/>
      <path d="M32 14 L36 28 L50 32 L36 36 L32 50 L28 36 L14 32 L28 28 Z" fill="#c59b27" stroke="#2c1e16" stroke-width="1.8" stroke-linejoin="round"/>
      <circle cx="32" cy="32" r="3" fill="#9e2a2b"/>
    `,
    sunbeam: `
      <circle cx="32" cy="24" r="11" fill="#f3d478" fill-opacity="0.45" stroke="#9e2a2b" stroke-width="2.4"/>
      <circle cx="32" cy="24" r="5" fill="#d9483b"/>
      <path d="M32 35 V54 M25 38 L22 52 M39 38 L42 52" stroke="#9e2a2b" stroke-width="2.4" stroke-linecap="round"/>
    `,
    river: `
      <rect x="12" y="14" width="40" height="36" rx="6" fill="#2f5b76" stroke="#2c1e16" stroke-width="2.2"/>
      <path d="M18 25 Q25 21 32 25 T46 25 M18 33 Q25 29 32 33 T46 33 M18 41 Q25 37 32 41 T46 41" fill="none" stroke="#d6eef8" stroke-width="2.2" stroke-linecap="round"/>
    `,
    patrol: `
      <path d="M13 8 H51 L48 35 Q45 49 32 56 Q19 49 16 35 Z" fill="#e7d4af" stroke="#5c4332" stroke-width="2.4"/>
      <path d="M20 32 Q19 14 32 13 Q45 14 44 32 Z" fill="#c59852" stroke="#2c1e16" stroke-width="2.5"/>
      <path d="M18 33 H46 M24 33 L27 42 L32 48 L37 42 L40 33" fill="none" stroke="#2c1e16" stroke-width="3" stroke-linejoin="round"/>
      <path d="M29 22 H35 M26 38 H38" stroke="#9e2a2b" stroke-width="2.4" stroke-linecap="round"/>
    `,
    hurricane: `
      <circle cx="32" cy="32" r="24" fill="#d9ced9" stroke="#574360" stroke-width="2.4"/>
      <path d="M11 31 C14 13 47 12 51 25 C55 40 31 49 21 40 C12 32 25 22 36 26 C45 30 38 38 31 35" fill="none" stroke="#65526d" stroke-width="4" stroke-linecap="round"/>
      <path d="M18 51 L28 47 M42 14 L49 10" stroke="#9e2a2b" stroke-width="2.1" stroke-linecap="round"/>
    `,
    shield: `
      <path d="M32 12 L49 18 V33 C49 43, 41 50, 32 54 C23 50, 15 43, 15 33 V18 Z" fill="#e5b53a" stroke="#2c1e16" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M23 33 C27 26, 37 26, 42 33 C37 40, 27 40, 23 33 Z" fill="#fdf6e7" stroke="#2c1e16" stroke-width="1.8"/>
      <path d="M41 33 L46 29 V37 Z" fill="#fdf6e7" stroke="#2c1e16" stroke-width="1.6"/>
    `,
    wither: `
      <path d="M32 49 V29" stroke="#2c1e16" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M32 36 C25 35, 22 31, 24 28 C27 29, 30 32, 32 36 Z" fill="#5c4332" stroke="#2c1e16" stroke-width="1.8"/>
      <path d="M32 29 C32 20, 41 16, 45 22 C47 26, 42 31, 36 30 Z" fill="#9e2a2b" stroke="#2c1e16" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M24 49 H40" stroke="#2c1e16" stroke-width="2.4" stroke-linecap="round"/>
    `
  };

  const dataUriCache = {};

  function getIconSvg(id, className = '') {
    const body = SVG_BODIES[id] || SVG_BODIES.scroll;
    const classAttr = className ? ` class="${className}"` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" aria-hidden="true"${classAttr}>${body}</svg>`;
  }

  function getIconDataUri(id) {
    if (!dataUriCache[id]) {
      const svg = getIconSvg(id).replace(/\s+/g, ' ').trim();
      dataUriCache[id] = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    }
    return dataUriCache[id];
  }

  function roundedRectPath(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function drawStar(ctx, cx, cy, outerR, innerR, points) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (Math.PI * i) / points - Math.PI / 2;
      const px = cx + Math.cos(angle) * r;
      const py = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function drawButterflyCanvas(ctx, cx, cy, size, time) {
    const flap = 0.72 + Math.sin(time * 0.008) * 0.28;
    const s = size * 0.5;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(flap, 1);

    // Upper wings
    ctx.fillStyle = PALETTE.goldLight;
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = Math.max(1.2, size * 0.06);

    ctx.beginPath();
    ctx.moveTo(0, -s * 0.12);
    ctx.bezierCurveTo(-s * 0.45, -s * 0.88, -s * 1.05, -s * 0.72, -s * 0.85, -s * 0.12);
    ctx.quadraticCurveTo(-s * 0.45, s * 0.1, 0, s * 0.04);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, -s * 0.12);
    ctx.bezierCurveTo(s * 0.45, -s * 0.88, s * 1.05, -s * 0.72, s * 0.85, -s * 0.12);
    ctx.quadraticCurveTo(s * 0.45, s * 0.1, 0, s * 0.04);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Lower wings
    ctx.fillStyle = PALETTE.brass;
    ctx.beginPath();
    ctx.moveTo(0, s * 0.05);
    ctx.bezierCurveTo(-s * 0.65, s * 0.14, -s * 0.78, s * 0.72, -s * 0.42, s * 0.82);
    ctx.quadraticCurveTo(-s * 0.12, s * 0.68, 0, s * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, s * 0.05);
    ctx.bezierCurveTo(s * 0.65, s * 0.14, s * 0.78, s * 0.72, s * 0.42, s * 0.82);
    ctx.quadraticCurveTo(s * 0.12, s * 0.68, 0, s * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Wing spots
    ctx.fillStyle = PALETTE.ink;
    ctx.beginPath();
    ctx.arc(-s * 0.5, -s * 0.32, s * 0.1, 0, Math.PI * 2);
    ctx.arc(s * 0.5, -s * 0.32, s * 0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Body and antennae
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = PALETTE.ink;
    ctx.fillStyle = PALETTE.ink;
    ctx.lineWidth = Math.max(1.2, size * 0.055);
    roundedRectPath(ctx, -s * 0.08, -s * 0.34, s * 0.16, s * 0.74, s * 0.08);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-s * 0.04, -s * 0.34);
    ctx.quadraticCurveTo(-s * 0.2, -s * 0.65, -s * 0.36, -s * 0.6);
    ctx.moveTo(s * 0.04, -s * 0.34);
    ctx.quadraticCurveTo(s * 0.2, -s * 0.65, s * 0.36, -s * 0.6);
    ctx.stroke();
    ctx.restore();
  }

  function drawScrollCanvas(ctx, cx, cy, size) {
    const w = size * 0.54;
    const h = size * 0.62;
    ctx.save();
    ctx.translate(cx, cy);

    // Parchment sheet
    ctx.fillStyle = '#efe2c8';
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = Math.max(1.3, size * 0.036);
    roundedRectPath(ctx, -w * 0.5, -h * 0.5, w, h, size * 0.04);
    ctx.fill();
    ctx.stroke();

    // Top & bottom scroll rods
    ctx.fillStyle = PALETTE.brass;
    roundedRectPath(ctx, -w * 0.62, -h * 0.56, w * 1.24, h * 0.18, size * 0.05);
    ctx.fill();
    ctx.stroke();
    roundedRectPath(ctx, -w * 0.62, h * 0.38, w * 1.24, h * 0.18, size * 0.05);
    ctx.fill();
    ctx.stroke();

    // Handwritten lines
    ctx.strokeStyle = PALETTE.inkSoft;
    ctx.lineWidth = Math.max(1, size * 0.025);
    ctx.beginPath();
    ctx.moveTo(-w * 0.3, -h * 0.16);
    ctx.lineTo(w * 0.3, -h * 0.16);
    ctx.moveTo(-w * 0.3, 0);
    ctx.lineTo(w * 0.22, 0);
    ctx.moveTo(-w * 0.3, h * 0.16);
    ctx.lineTo(w * 0.08, h * 0.16);
    ctx.stroke();

    // Crimson wax seal
    ctx.fillStyle = PALETTE.crimson;
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = Math.max(1, size * 0.025);
    ctx.beginPath();
    ctx.arc(w * 0.22, h * 0.18, size * 0.085, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  function drawLanternCanvas(ctx, cx, cy, size, time) {
    const r = size * 0.3;
    const flicker = 0.85 + Math.sin(time * 0.012) * 0.15;
    ctx.save();
    ctx.translate(cx, cy);

    // Handle ring
    ctx.strokeStyle = PALETTE.goldLight;
    ctx.lineWidth = Math.max(1.4, size * 0.04);
    ctx.beginPath();
    ctx.arc(0, -r * 0.72, r * 0.34, Math.PI, 0);
    ctx.stroke();

    // Lantern glass housing
    ctx.fillStyle = 'rgba(243, 212, 120, 0.28)';
    ctx.strokeStyle = PALETTE.goldLight;
    ctx.lineWidth = Math.max(1.2, size * 0.032);
    roundedRectPath(ctx, -r * 0.56, -r * 0.45, r * 1.12, r * 1.1, r * 0.16);
    ctx.fill();
    ctx.stroke();

    // Inner flame glow
    ctx.fillStyle = `rgba(243, 212, 120, ${0.95 * flicker})`;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.28);
    ctx.quadraticCurveTo(r * 0.28, r * 0.1, 0, r * 0.42);
    ctx.quadraticCurveTo(-r * 0.28, r * 0.1, 0, -r * 0.28);
    ctx.closePath();
    ctx.fill();

    // Top cap & base plate
    ctx.fillStyle = PALETTE.brass;
    ctx.beginPath();
    ctx.moveTo(-r * 0.62, -r * 0.45);
    ctx.lineTo(r * 0.62, -r * 0.45);
    ctx.lineTo(r * 0.34, -r * 0.72);
    ctx.lineTo(-r * 0.34, -r * 0.72);
    ctx.closePath();
    ctx.fill();

    roundedRectPath(ctx, -r * 0.68, r * 0.62, r * 1.36, r * 0.24, r * 0.08);
    ctx.fill();

    ctx.restore();
  }

  function drawBarrelCanvas(ctx, cx, cy, size, time) {
    const r = size * 0.36;
    const sparkPulse = 0.7 + Math.sin(time * 0.02) * 0.3;
    ctx.save();
    ctx.translate(cx, cy);

    // Barrel body
    ctx.fillStyle = PALETTE.wood;
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = Math.max(1.5, size * 0.038);
    ctx.beginPath();
    ctx.moveTo(-r * 0.68, -r * 0.78);
    ctx.quadraticCurveTo(-r * 1.04, 0, -r * 0.68, r * 0.78);
    ctx.lineTo(r * 0.68, r * 0.78);
    ctx.quadraticCurveTo(r * 1.04, 0, r * 0.68, -r * 0.78);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Vertical stave lines
    ctx.strokeStyle = PALETTE.woodDark;
    ctx.lineWidth = Math.max(1, size * 0.022);
    ctx.beginPath();
    ctx.moveTo(-r * 0.26, -r * 0.76);
    ctx.quadraticCurveTo(-r * 0.42, 0, -r * 0.26, r * 0.76);
    ctx.moveTo(r * 0.26, -r * 0.76);
    ctx.quadraticCurveTo(r * 0.42, 0, r * 0.26, r * 0.76);
    ctx.stroke();

    // Iron bands
    ctx.strokeStyle = PALETTE.iron;
    ctx.lineWidth = Math.max(2.2, size * 0.065);
    ctx.beginPath();
    ctx.moveTo(-r * 0.82, -r * 0.34);
    ctx.lineTo(r * 0.82, -r * 0.34);
    ctx.moveTo(-r * 0.82, r * 0.34);
    ctx.lineTo(r * 0.82, r * 0.34);
    ctx.stroke();

    // Fuse and spark
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = Math.max(1.4, size * 0.035);
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.78);
    ctx.quadraticCurveTo(r * 0.05, -r * 1.12, r * 0.46, -r * 1.06);
    ctx.stroke();

    ctx.fillStyle = `rgba(243, 212, 120, ${sparkPulse})`;
    ctx.strokeStyle = PALETTE.crimsonBright;
    ctx.lineWidth = Math.max(1, size * 0.025);
    ctx.beginPath();
    ctx.arc(r * 0.52, -r * 1.06, r * 0.16 * (0.85 + sparkPulse * 0.25), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  function drawCharacterEmblemCanvas(ctx, id, cx, cy, size) {
    const r = size * 0.28;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = Math.max(1.3, size * 0.032);

    if (id === 'JOSE') {
      // Horseshoe magnet
      ctx.fillStyle = PALETTE.crimson;
      ctx.beginPath();
      ctx.arc(0, r * 0.1, r * 0.68, 0, Math.PI, false);
      ctx.lineTo(-r * 0.68, -r * 0.6);
      ctx.lineTo(-r * 0.34, -r * 0.6);
      ctx.lineTo(-r * 0.34, r * 0.1);
      ctx.arc(0, r * 0.1, r * 0.34, Math.PI, 0, true);
      ctx.lineTo(r * 0.34, -r * 0.6);
      ctx.lineTo(r * 0.68, -r * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = PALETTE.parchmentMid;
      ctx.fillRect(-r * 0.68, -r * 0.6, r * 0.34, r * 0.34);
      ctx.strokeRect(-r * 0.68, -r * 0.6, r * 0.34, r * 0.34);
      ctx.fillRect(r * 0.34, -r * 0.6, r * 0.34, r * 0.34);
      ctx.strokeRect(r * 0.34, -r * 0.6, r * 0.34, r * 0.34);
    } else if (id === 'AURELIANO') {
      // Little gold fish + colonel star
      ctx.fillStyle = PALETTE.goldLight;
      ctx.beginPath();
      ctx.moveTo(-r * 0.78, r * 0.18);
      ctx.quadraticCurveTo(-r * 0.12, -r * 0.42, r * 0.48, r * 0.18);
      ctx.quadraticCurveTo(-r * 0.12, r * 0.78, -r * 0.78, r * 0.18);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = PALETTE.brass;
      ctx.beginPath();
      ctx.moveTo(r * 0.44, r * 0.18);
      ctx.lineTo(r * 0.85, -r * 0.16);
      ctx.lineTo(r * 0.85, r * 0.52);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = PALETTE.ink;
      ctx.beginPath();
      ctx.arc(-r * 0.38, r * 0.12, r * 0.09, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = PALETTE.brass;
      drawStar(ctx, 0, -r * 0.58, r * 0.28, r * 0.12, 5);
      ctx.fill();
      ctx.stroke();
    } else if (id === 'REBECA') {
      // Crosshair and antique revolver silhouette
      ctx.strokeStyle = PALETTE.crimson;
      ctx.lineWidth = Math.max(1.2, size * 0.028);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
      ctx.moveTo(0, -r * 0.94);
      ctx.lineTo(0, -r * 0.52);
      ctx.moveTo(0, r * 0.52);
      ctx.lineTo(0, r * 0.94);
      ctx.moveTo(-r * 0.94, 0);
      ctx.lineTo(-r * 0.52, 0);
      ctx.moveTo(r * 0.52, 0);
      ctx.lineTo(r * 0.94, 0);
      ctx.stroke();

      ctx.fillStyle = PALETTE.iron;
      ctx.strokeStyle = PALETTE.ink;
      ctx.beginPath();
      ctx.moveTo(-r * 0.65, -r * 0.18);
      ctx.lineTo(r * 0.62, -r * 0.18);
      ctx.lineTo(r * 0.62, r * 0.08);
      ctx.lineTo(-r * 0.05, r * 0.08);
      ctx.lineTo(-r * 0.28, r * 0.58);
      ctx.lineTo(-r * 0.58, r * 0.58);
      ctx.lineTo(-r * 0.42, r * 0.08);
      ctx.lineTo(-r * 0.65, r * 0.08);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      // Fallback engraved family star crest
      ctx.fillStyle = PALETTE.brass;
      drawStar(ctx, 0, 0, r * 0.68, r * 0.3, 6);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawMechanismCanvas(ctx, kind, centerX, centerY, size, { active = false, dx = 1, dy = 0 } = {}) {
    const { ink, inkSoft, brass, goldLight, crimson, parchment, waterDark, waterLight, wood, iron } = PALETTE;
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(size / 40, size / 40);
    ctx.lineWidth = 1.45;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    function path(points, fill, stroke = ink) {
      ctx.beginPath();
      ctx.moveTo(...points[0]);
      for (const point of points.slice(1)) ctx.lineTo(...point);
      if (fill) {
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
      }
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }

    function oval(x, y, rx, ry, fill, stroke = ink) {
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }

    function arrow(color, offset = 0) {
      ctx.save();
      ctx.translate(0, offset);
      ctx.rotate(Math.atan2(dy, dx));
      path([[-12, -3], [2, -3], [2, -8], [13, 0], [2, 8], [2, 3], [-12, 3]], color);
      ctx.restore();
    }

    switch (kind) {
      case 'hot':
        path([[-14, -6], [-5, -13], [12, -9], [15, 5], [6, 13], [-11, 10]], '#733527');
        path([[-11, 5], [-4, 1], [-7, -7], [0, -3], [5, -10]], null, '#e79a55');
        path([[0, -3], [3, 4], [0, 9]], null, '#e79a55');
        path([[3, 4], [11, 2]], null, '#e79a55');
        break;
      case 'mist':
        oval(-7, -1, 7, 5, '#a397b7', '#65526d');
        oval(3, -5, 8, 5, '#bcb1cb', '#65526d');
        oval(8, 3, 8, 5, '#9484a7', '#65526d');
        path([[-12, 7], [-7, 9], [2, 8], [12, 10]], null, '#574360');
        break;
      case 'shallows':
        if (active) {
          path([[-13, 5], [-7, 1], [-3, 4], [0, -8], [8, -2], [14, -1], [11, 7], [-11, 9]], waterLight, parchment);
          path([[-8, 7], [-2, 7], [3, 5], [9, 6]], null, '#e2f0ef');
        } else {
          oval(-8, 5, 5, 3, '#c4b28d', waterDark);
          oval(1, -3, 5, 3, '#dec7a4', waterDark);
          oval(9, 6, 5, 3, '#ad9875', waterDark);
        }
        break;
      case 'rubble':
        path([[-13, 8], [-12, -1], [-6, -5], [-3, 1], [-4, 10]], '#9e7a60');
        path([[-5, -7], [6, -12], [12, -7], [6, -1], [-2, 0]], '#b48f72');
        path([[2, 10], [2, 3], [11, 0], [15, 6], [11, 11]], '#745747');
        path([[-10, 3], [-6, 1]], null, goldLight);
        break;
      case 'plate':
        path([[-14, -9], [14, -9], [14, 9], [-14, 9]], '#8d5b36');
        path([[-10, -6], [10, -6], [10, 6], [-10, 6]], active ? '#8aa57f' : goldLight);
        oval(0, 0, 3, 2, active ? '#4c6746' : brass);
        break;
      case 'gate':
        path([[-13, 13], [-13, -5], [-8, -11], [8, -11], [13, -5], [13, 13]], null, '#594437');
        for (const x of active ? [-10, 10] : [-10, -5, 0, 5, 10]) {
          path([[x, -6], [x, 12]], null, active ? brass : iron);
        }
        if (!active) path([[-10, 5], [10, 5]], null, iron);
        break;
      case 'seal':
        oval(0, 0, 12, 12, active ? '#ebddb9' : '#80729c', brass);
        path([[0, -9], [8, 5], [-8, 5], [0, -9]], null, active ? '#47735b' : goldLight);
        oval(0, 0, 3, 3, active ? '#84a88d' : goldLight, '#574360');
        break;
      case 'lever':
        path([[-13, 7], [-9, 1], [9, 1], [13, 7], [13, 11], [-13, 11]], '#ab7b45');
        path([[0, 5], [active ? 8 : -8, -8]], null, iron);
        oval(active ? 8 : -8, -8, 4, 4, active ? '#6d916c' : crimson);
        break;
      case 'curtain':
        path([[-13, -11], [13, -11], [10, 11], [4, 8], [0, 12], [-5, 8], [-11, 11]], '#665575', brass);
        for (const x of [-7, 0, 7]) path([[x, -8], [x - 1, 8]], null, '#a391af');
        break;
      case 'guard':
        path([[-10, 2], [-9, -7], [-4, -13], [5, -13], [10, -6], [10, 3]], '#a78654');
        path([[-7, -2], [7, -2], [6, 7], [0, 10], [-6, 7]], '#5c4637');
        path([[-7, 1], [7, 1]], null, goldLight);
        ctx.scale(0.65, 0.65);
        arrow('#b74a40', 20);
        break;
      case 'ice':
      case 'crystal':
        path([[-11, -3], [-2, -13], [8, -10], [12, 3], [4, 12], [-8, 9]], kind === 'ice' ? '#9dcad8' : '#729bbf', waterDark);
        path([[-2, -13], [2, 1], [4, 12]], null, '#f0f7ed');
        path([[-11, -3], [2, 1], [12, 3]], null, '#f0f7ed');
        break;
      case 'note':
      case 'translator':
        path([[-9, -13], [5, -13], [11, -7], [11, 12], [-9, 12]], parchment, kind === 'note' ? inkSoft : '#6a4b83');
        path([[5, -13], [5, -7], [11, -7]], '#c8ae79');
        path([[-5, -4], [6, -4]], null, '#8b6949');
        path([[-5, 1], [6, 1]], null, '#8b6949');
        if (kind === 'translator') oval(5, 7, 4, 4, '#8069a0', '#56395f');
        else path([[-5, 6], [1, 6]], null, '#8b6949');
        break;
      case 'gold':
        path([[-12, 6], [-9, -3], [-2, -5], [2, 3], [-2, 10]], brass);
        path([[0, -4], [5, -11], [12, -7], [14, 1], [6, 4]], goldLight);
        oval(5, 8, 3, 2, brass);
        break;
      case 'repair':
        path([[-15, -7], [-4, -7], [-1, -3], [-5, 0], [-1, 6], [-15, 6]], wood);
        path([[3, -7], [15, -7], [15, 6], [5, 6], [1, 2], [6, -2]], '#b98750');
        path([[-14, 0], [-6, 0]], null, goldLight);
        path([[7, 1], [14, 1]], null, goldLight);
        break;
      case 'forge':
        path([[-14, -7], [13, -7], [8, -1], [3, 0], [3, 6], [10, 7], [10, 11], [-10, 11], [-10, 7], [-3, 6], [-3, 0], [-11, -2]], '#4e5354', brass);
        path([[-10, -6], [10, -6]], null, '#d6b98a');
        break;
      case 'fuse':
        path([[-11, 11], [-9, 4], [9, 4], [11, 11]], '#97633b');
        path([[-5, 4], [-8, -2], [-1, -7], [2, -12], [7, -4], [5, 4]], active ? '#e18d3b' : '#978879');
        if (active) path([[-2, 3], [2, -3], [4, 3]], goldLight);
        break;
      case 'oneWay':
        arrow(active ? waterLight : '#bd594b');
        break;
      case 'waterFlow':
        arrow(goldLight);
        break;
    }

    ctx.restore();
  }

  return {
    PALETTE,
    getIconSvg,
    getIconDataUri,
    roundedRectPath,
    drawButterflyCanvas,
    drawScrollCanvas,
    drawLanternCanvas,
    drawBarrelCanvas,
    drawMechanismCanvas,
    drawCharacterEmblemCanvas
  };
})();

if (typeof module === 'object' && module.exports) {
  module.exports = MacondoIcons;
}
