#!/usr/bin/env node
// ghostty-aura: Color math utilities — HSL conversion, luminance-preserving blending, animation
// No external dependencies — Node.js built-ins only.

'use strict';

// --- Conversion ---

function hexToRgb(hex) {
  hex = hex.replace(/^#/, '');
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [r, g, b].map((c) => clamp(c).toString(16).padStart(2, '0')).join('');
}

function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h, s, l };
}

function hslToRgb({ h, s, l }) {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hue2rgb(p, q, h + 1/3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1/3) * 255),
  };
}

function hexToHsl(hex) { return rgbToHsl(hexToRgb(hex)); }
function hslToHex(hsl) { return rgbToHex(hslToRgb(hsl)); }

// --- Blending ---

/**
 * Blend a base color toward a tint color at given intensity.
 * Preserves the base's luminance (lightness) while shifting hue and saturation
 * toward the tint. A small luminance nudge is applied proportional to intensity.
 *
 * @param {string} baseHex - Base color hex (#RRGGBB)
 * @param {string} tintHex - Tint color hex (#RRGGBB)
 * @param {number} intensity - 0..1 blend factor
 * @returns {string} Blended color hex
 */
function blendWithTint(baseHex, tintHex, intensity) {
  const base = hexToHsl(baseHex);
  const tint = hexToHsl(tintHex);

  // Blend hue — shortest arc
  let hDiff = tint.h - base.h;
  if (hDiff > 0.5) hDiff -= 1;
  if (hDiff < -0.5) hDiff += 1;
  let h = base.h + hDiff * intensity;
  if (h < 0) h += 1;
  if (h > 1) h -= 1;

  // Blend saturation toward tint
  const s = base.s + (tint.s - base.s) * intensity;

  // Small luminance nudge — keeps base lightness mostly intact
  const l = base.l + (tint.l - base.l) * intensity * 0.15;

  return hslToHex({ h, s, l });
}

/**
 * Linearly interpolate between two hex colors.
 */
function lerpHex(hex1, hex2, t) {
  const c1 = hexToRgb(hex1);
  const c2 = hexToRgb(hex2);
  return rgbToHex({
    r: c1.r + (c2.r - c1.r) * t,
    g: c1.g + (c2.g - c1.g) * t,
    b: c1.b + (c2.b - c1.b) * t,
  });
}

// --- Animation ---

const fs = require('fs');

/**
 * Write animated OSC frames to a TTY, ping-ponging between base and tinted color.
 */
function animateToTty(baseHex, tintHex, steps, stepMs, ttyPath) {
  const blended = blendWithTint(baseHex, tintHex, 1.0);
  let step = 0;
  let direction = 1;

  const write = () => {
    const t = step / steps;
    const color = lerpHex(baseHex, blended, t);
    try {
      fs.writeFileSync(ttyPath, `\x1b]11;${color}\x1b\\`);
    } catch {
      process.exit(0); // TTY gone
    }
    step += direction;
    if (step >= steps) { direction = -1; step = steps; }
    else if (step <= 0) { direction = 1; step = 0; }
  };

  // Trap SIGTERM for clean shutdown
  process.on('SIGTERM', () => process.exit(0));
  process.on('SIGINT', () => process.exit(0));

  setInterval(write, stepMs);
  write(); // first frame immediately
}

// --- CLI ---

function main() {
  const [,, cmd, ...args] = process.argv;

  if (cmd === 'blend') {
    // node color.js blend <base> <tint> <intensity>
    const [base, tint, intensityStr] = args;
    if (!base || !tint || !intensityStr) {
      console.error('Usage: color.js blend <base_hex> <tint_hex> <intensity>');
      process.exit(1);
    }
    console.log(blendWithTint(base, tint, parseFloat(intensityStr)));
  } else if (cmd === 'animate') {
    // node color.js animate <base> <tint> <steps> <step_ms> <tty>
    const [base, tint, stepsStr, stepMsStr, tty] = args;
    if (!base || !tint || !stepsStr || !stepMsStr || !tty) {
      console.error('Usage: color.js animate <base_hex> <tint_hex> <steps> <step_ms> <tty>');
      process.exit(1);
    }
    animateToTty(base, tint, parseInt(stepsStr), parseInt(stepMsStr), tty);
  } else if (cmd === 'lerp') {
    // node color.js lerp <hex1> <hex2> <t>
    const [hex1, hex2, tStr] = args;
    console.log(lerpHex(hex1, hex2, parseFloat(tStr)));
  } else {
    console.error('Commands: blend, animate, lerp');
    process.exit(1);
  }
}

main();
