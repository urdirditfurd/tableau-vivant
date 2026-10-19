/**
 * Moteur d'effets « tableau vivant ».
 *
 * Coordonnées :
 *   - valeur entre 0 et 1 → fraction du cadre
 *   - valeur supérieure à 1 → pixels (scènes anciennes)
 *
 * Le dessin suppose que la photo a déjà été peinte sur le canvas,
 * pour que les modes de fusion (screen, overlay, soft-light) agissent sur l'image.
 *
 * installLivingEffects est une déclaration de fonction : son code source
 * peut être recopié tel quel dans le HTML exporté.
 */
function installLivingEffects(global) {
  "use strict";

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  /** Bruit lisse 1D, assez organique pour un scintillement de flamme. */
  function smoothNoise(t) {
    const i = Math.floor(t);
    const f = t - i;
    const u = f * f * (3 - 2 * f);
    const n0 = Math.sin(i * 127.1) * 43758.5453;
    const n1 = Math.sin((i + 1) * 127.1) * 43758.5453;
    return lerp(n0 - Math.floor(n0), n1 - Math.floor(n1), u);
  }

  function applyBlend(ctx, mode) {
    const map = {
      normal: "source-over",
      screen: "screen",
      overlay: "overlay",
      lighter: "lighter",
      multiply: "multiply",
      soft_light: "soft-light"
    };
    ctx.globalCompositeOperation = map[mode] || mode || "source-over";
  }

  function parseColor(hex, alpha) {
    const fallback = alpha === undefined ? "rgb(255,255,255)" : `rgba(255,255,255,${alpha})`;
    if (!hex || typeof hex !== "string") return fallback;
    if (hex.startsWith("rgb")) {
      if (alpha === undefined) return hex;
      const m = hex.match(/[\d.]+/g);
      if (!m || m.length < 3) return hex;
      return `rgba(${m[0]},${m[1]},${m[2]},${alpha})`;
    }
    const h = hex.replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const n = parseInt(full, 16);
    if (!Number.isFinite(n)) return fallback;
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    if (alpha === undefined) return `rgb(${r},${g},${b})`;
    return `rgba(${r},${g},${b},${alpha})`;
  }

  /**
   * Convertit une coordonnée de scène en pixels du cadre courant.
   * fallbackFraction est utilisé seulement si la valeur est absente.
   */
  function toPx(value, total, fallbackFraction) {
    const fb = (fallbackFraction == null ? 0 : fallbackFraction) * total;
    if (value == null || value === "" || Number.isNaN(Number(value))) return fb;
    const n = Number(value);
    if (Math.abs(n) <= 1) return n * total;
    return n;
  }

  /** Amplitude en pixels, proportionnelle à la taille du cadre. */
  function scaledAmp(nominal, span) {
    const n = Number(nominal);
    if (!Number.isFinite(n)) return span * 0.01;
    if (Math.abs(n) <= 1) return n * span;
    return n * (span / 520);
  }

  function readEnabled(cfg) {
    return !cfg || cfg.enabled !== false;
  }

  // --- Lumière ambiante ----------------------------------------------------

  class AmbientLight {
    constructor(opts) {
      this.cfg = opts || {};
      this.t = 0;
      this.current = this.cfg.intensity ?? 0.25;
    }

    update(dt) {
      if (!readEnabled(this.cfg)) return;
      const speed = Number(this.cfg.pulse_speed ?? this.cfg.pulseSpeed ?? 0.45);
      this.t += dt * speed * 0.35;
      const pulse = 0.86 + 0.14 * Math.sin(this.t);
      this.current = (Number(this.cfg.intensity) || 0) * pulse;
    }

    draw(ctx, w, h) {
      if (!readEnabled(this.cfg) || this.current <= 0.001) return;
      const width = w || ctx.canvas.width;
      const height = h || ctx.canvas.height;
      ctx.save();
      applyBlend(ctx, "soft-light");
      ctx.fillStyle = parseColor(this.cfg.color || "#FFA500", this.current);
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  }

  // --- Feu -----------------------------------------------------------------

  class FireEffect {
    constructor(opts) {
      this.cfg = opts || {};
      this.kind = "fire";
      this.particles = [];
      this.ready = false;
    }

    layout(w, h) {
      if (!(w > 0) || !(h > 0)) return;
      const pos = this.cfg.position || {};
      const size = this.cfg.size || {};
      this.x = toPx(pos.x, w, 0.3);
      this.y = toPx(pos.y, h, 0.6);
      this.w = Math.max(8, toPx(size.width, w, 0.08));
      this.h = Math.max(8, toPx(size.height, h, 0.16));
      const count = clamp(Math.round(Number(this.cfg.particle_count) || 50), 1, 240);
      if (this.particles.length !== count) {
        this.particles = [];
        for (let i = 0; i < count; i++) this.particles.push(this._spawn(true));
      }
      this.ready = true;
    }

    _spawn(randomV) {
      const intensity = Number(this.cfg.intensity ?? 0.8);
      return {
        u: 0.5 + (Math.random() - 0.5) * 0.5,
        v: randomV ? 0.2 + Math.random() * 0.8 : 0.82 + Math.random() * 0.16,
        vu: (Math.random() - 0.5) * 0.08,
        vv: -(0.28 + Math.random() * 0.45) * (0.55 + intensity * 0.55),
        life: 0.5 + Math.random() * 0.9,
        age: randomV ? Math.random() * 0.7 : 0,
        size: 0.07 + Math.random() * 0.2
      };
    }

    update(dt) {
      if (!this.ready || !readEnabled(this.cfg)) return;
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        p.age += dt;
        p.u += p.vu * dt;
        p.v += p.vv * dt;
        p.vu += (Math.random() - 0.5) * 0.25 * dt;
        p.vv -= 0.08 * dt;
        if (p.age >= p.life || p.v < -0.08) this.particles[i] = this._spawn(false);
      }
    }

    draw(ctx) {
      if (!this.ready || !readEnabled(this.cfg)) return;
      const intensity = clamp(Number(this.cfg.intensity ?? 0.8), 0, 1.5);
      const colors = Array.isArray(this.cfg.colors) && this.cfg.colors.length
        ? this.cfg.colors
        : ["#FF6B00", "#FFA500", "#FFD700"];
      ctx.save();
      applyBlend(ctx, this.cfg.blend_mode || "screen");

      const gx = this.x + this.w * 0.5;
      const gy = this.y + this.h * 0.86;
      const glow = ctx.createRadialGradient(gx, gy, 2, gx, gy, this.w * 0.85);
      glow.addColorStop(0, parseColor(colors[0], 0.55 * intensity));
      glow.addColorStop(0.5, parseColor(colors[1] || colors[0], 0.2 * intensity));
      glow.addColorStop(1, parseColor(colors[2] || colors[0], 0));
      ctx.fillStyle = glow;
      ctx.fillRect(this.x - this.w * 0.3, this.y - this.h * 0.05, this.w * 1.6, this.h * 1.15);

      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        const t = p.age / p.life;
        const alpha = (1 - t) * (0.35 + 0.6 * intensity);
        const r = Math.max(1.5, p.size * this.w * (1 - t * 0.45));
        const px = this.x + p.u * this.w;
        const py = this.y + p.v * this.h;
        const color = colors[i % colors.length];
        const g = ctx.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0, parseColor("#FFF6D8", alpha * 0.85));
        g.addColorStop(0.35, parseColor(color, alpha));
        g.addColorStop(1, parseColor(color, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // --- Bougie --------------------------------------------------------------

  class CandleEffect {
    constructor(opts) {
      this.cfg = opts || {};
      this.kind = "candle";
      this.t = Math.random() * 40;
      this.bright = 1;
      this.ready = false;
    }

    layout(w, h) {
      if (!(w > 0) || !(h > 0)) return;
      const pos = this.cfg.position || {};
      this.x = toPx(pos.x, w, 0.5);
      this.y = toPx(pos.y, h, 0.55);
      const radius = this.cfg.radius == null ? 0.045 : Number(this.cfg.radius);
      this.radius = Math.abs(radius) <= 1 ? radius * Math.min(w, h) : radius;
      this.ready = true;
    }

    update(dt) {
      if (!this.ready || !readEnabled(this.cfg)) return;
      const speed = Number(this.cfg.flicker_speed ?? 2);
      this.t += dt * speed;
      const n1 = smoothNoise(this.t * 1.7);
      const n2 = smoothNoise(this.t * 3.1 + 20);
      this.bright = 0.7 + 0.3 * (0.62 * n1 + 0.38 * n2);
    }

    draw(ctx) {
      if (!this.ready || !readEnabled(this.cfg)) return;
      const color = this.cfg.color || "#FFD700";
      ctx.save();
      applyBlend(ctx, this.cfg.blend_mode || "screen");
      const r = Math.max(4, this.radius * (0.9 + 0.12 * this.bright));
      const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r);
      g.addColorStop(0, parseColor(color, 0.62 * this.bright));
      g.addColorStop(0.32, parseColor(color, 0.26 * this.bright));
      g.addColorStop(1, parseColor(color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
      ctx.fill();

      const coreR = r * 0.22;
      const core = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, coreR);
      core.addColorStop(0, parseColor("#FFF8E4", 0.9 * this.bright));
      core.addColorStop(1, parseColor(color, 0));
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(this.x, this.y - coreR * 0.15, coreR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // --- Fenêtre / lune ------------------------------------------------------

  class WindowLightEffect {
    constructor(opts) {
      this.cfg = opts || {};
      this.kind = "window_light";
      this.t = Math.random() * 10;
      this.ready = false;
    }

    layout(w, h) {
      if (!(w > 0) || !(h > 0)) return;
      const pos = this.cfg.position || {};
      const size = this.cfg.size || {};
      this.x = toPx(pos.x, w, 0.68);
      this.y = toPx(pos.y, h, 0.08);
      this.w = Math.max(8, toPx(size.width, w, 0.2));
      this.h = Math.max(8, toPx(size.height, h, 0.4));
      this.ready = true;
    }

    update(dt) {
      if (!this.ready || !readEnabled(this.cfg)) return;
      this.t += dt * 0.35;
    }

    draw(ctx) {
      if (!this.ready || !readEnabled(this.cfg)) return;
      const color = this.cfg.color || "#87CEEB";
      const shimmer = Number(this.cfg.shimmer_intensity ?? 0.22);
      const n = smoothNoise(this.t);
      const alpha = shimmer * (0.55 + 0.45 * n);
      ctx.save();
      applyBlend(ctx, this.cfg.blend_mode || "overlay");
      const g = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.h);
      g.addColorStop(0, parseColor(color, alpha * 1.15));
      g.addColorStop(0.55, parseColor(color, alpha * 0.4));
      g.addColorStop(1, parseColor(color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(this.x, this.y, this.w, this.h);

      const mx = this.x + this.w * 0.62;
      const my = this.y + this.h * 0.2;
      const moon = ctx.createRadialGradient(mx, my, 2, mx, my, this.w * 0.28);
      moon.addColorStop(0, parseColor("#F4FBFF", alpha * 0.95));
      moon.addColorStop(0.4, parseColor("#D7ECFF", alpha * 0.35));
      moon.addColorStop(1, parseColor("#D7ECFF", 0));
      ctx.fillStyle = moon;
      ctx.fillRect(this.x, this.y, this.w, this.h * 0.7);
      ctx.restore();
    }
  }

  // --- Fumée / brume -------------------------------------------------------

  class SmokeEffect {
    constructor(opts) {
      this.cfg = opts || {};
      this.kind = "smoke";
      this.particles = [];
      this.ready = false;
    }

    layout(w, h) {
      if (!(w > 0) || !(h > 0)) return;
      const pos = this.cfg.position || {};
      const size = this.cfg.size || {};
      this.x = toPx(pos.x, w, 0.3);
      this.y = toPx(pos.y, h, 0.2);
      this.bw = Math.max(12, toPx(size.width, w, 0.14));
      this.bh = Math.max(12, toPx(size.height, h, 0.4));
      const count = clamp(Math.round(Number(this.cfg.count) || 16), 4, 80);
      if (this.particles.length !== count) {
        this.particles = [];
        for (let i = 0; i < count; i++) this.particles.push(this._spawn(true));
      }
      this.ready = true;
    }

    _spawn(random) {
      return {
        u: (Math.random() - 0.5) * 0.35,
        v: random ? -Math.random() * 0.85 : 0.05,
        vu: (Math.random() - 0.5) * 0.05,
        grow: 0.15 + Math.random() * 0.25,
        life: 3.2 + Math.random() * 3.4,
        age: random ? Math.random() * 3 : 0,
        size: 0.12 + Math.random() * 0.2
      };
    }

    update(dt) {
      if (!this.ready || !readEnabled(this.cfg)) return;
      const speed = Number(this.cfg.speed ?? 0.5);
      const dir = this.cfg.direction === "down" ? 1 : -1;
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        p.age += dt;
        p.u += p.vu * dt * speed;
        p.v += dir * (0.12 + Math.random() * 0.05) * speed * dt;
        p.vu += (Math.random() - 0.5) * 0.02 * dt;
        p.size += p.grow * dt * 0.15;
        if (p.age >= p.life) this.particles[i] = this._spawn(false);
      }
    }

    draw(ctx) {
      if (!this.ready || !readEnabled(this.cfg)) return;
      const color = this.cfg.color || "#D9D3C7";
      const opacity = clamp(Number(this.cfg.opacity ?? 0.3), 0, 1);
      const originX = this.x + this.bw * 0.5;
      const originY = this.cfg.direction === "down" ? this.y : this.y + this.bh;
      ctx.save();
      applyBlend(ctx, this.cfg.blend_mode || "normal");
      for (const p of this.particles) {
        const t = p.age / p.life;
        const fadeIn = t < 0.15 ? t / 0.15 : 1;
        const a = opacity * (1 - t) * fadeIn;
        const px = originX + p.u * this.bw;
        const py = originY + p.v * this.bh;
        const r = Math.max(4, p.size * this.bw);
        const g = ctx.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0, parseColor(color, a));
        g.addColorStop(1, parseColor(color, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // --- Étoiles -------------------------------------------------------------

  class StarsEffect {
    constructor(opts) {
      this.cfg = opts || {};
      this.kind = "stars";
      this.stars = [];
      this.t = 0;
      this.ready = false;
    }

    layout(w, h) {
      if (!(w > 0) || !(h > 0)) return;
      const region = this.cfg.region || { x: 0.05, y: 0.04, width: 0.9, height: 0.24 };
      this.rx = toPx(region.x, w, 0);
      this.ry = toPx(region.y, h, 0);
      this.rw = Math.max(8, toPx(region.width, w, 0.9));
      this.rh = Math.max(8, toPx(region.height, h, 0.24));
      const count = clamp(Math.round(Number(this.cfg.count) || 30), 0, 200);
      if (this.stars.length !== count) {
        this.stars = [];
        for (let i = 0; i < count; i++) {
          this.stars.push({
            u: Math.random(),
            v: Math.random(),
            size: 0.7 + Math.random() * 1.7,
            phase: Math.random() * Math.PI * 2,
            speed: 0.35 + Math.random() * 1.1,
            base: 0.28 + Math.random() * 0.55,
            cross: Math.random() > 0.55
          });
        }
      }
      this.ready = true;
    }

    update(dt) {
      if (!this.ready || !readEnabled(this.cfg)) return;
      this.t += dt * Number(this.cfg.twinkle_speed ?? 1.5);
    }

    draw(ctx) {
      if (!this.ready || !readEnabled(this.cfg)) return;
      const color = this.cfg.color || "#FFFFFF";
      ctx.save();
      applyBlend(ctx, "screen");
      for (const s of this.stars) {
        const a = s.base * (0.4 + 0.6 * (0.5 + 0.5 * Math.sin(this.t * s.speed + s.phase)));
        const x = this.rx + s.u * this.rw;
        const y = this.ry + s.v * this.rh;
        ctx.fillStyle = parseColor(color, clamp(a, 0, 1));
        ctx.beginPath();
        ctx.arc(x, y, s.size, 0, Math.PI * 2);
        ctx.fill();
        if (s.cross) {
          ctx.strokeStyle = parseColor(color, a * 0.55);
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(x - s.size * 2.4, y);
          ctx.lineTo(x + s.size * 2.4, y);
          ctx.moveTo(x, y - s.size * 2.4);
          ctx.lineTo(x, y + s.size * 2.4);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  // --- Poussière -----------------------------------------------------------

  class DustParticlesEffect {
    constructor(opts) {
      this.cfg = opts || {};
      this.kind = "dust";
      this.particles = [];
      this.t = 0;
      this.ready = false;
    }

    layout(w, h) {
      if (!(w > 0) || !(h > 0)) return;
      const region = this.cfg.region || { x: 0.15, y: 0.2, width: 0.7, height: 0.5 };
      this.rx = toPx(region.x, w, 0.1);
      this.ry = toPx(region.y, h, 0.2);
      this.rw = Math.max(8, toPx(region.width, w, 0.7));
      this.rh = Math.max(8, toPx(region.height, h, 0.5));
      const count = clamp(Math.round(Number(this.cfg.count) || 18), 0, 160);
      if (this.particles.length !== count) {
        this.particles = [];
        for (let i = 0; i < count; i++) {
          this.particles.push({
            u: Math.random(),
            v: Math.random(),
            vu: (Math.random() - 0.5) * 0.35,
            vv: (Math.random() - 0.5) * 0.22,
            size: 0.8 + Math.random() * 1.8,
            phase: Math.random() * Math.PI * 2
          });
        }
      }
      this.ready = true;
    }

    update(dt) {
      if (!this.ready || !readEnabled(this.cfg)) return;
      const speed = Number(this.cfg.speed ?? 0.15);
      this.t += dt;
      const drift = 0.2 + speed;
      for (const p of this.particles) {
        // Marche aléatoire lente : le grain traverse la zone en une vingtaine de secondes.
        p.vu += (Math.random() - 0.5) * dt;
        p.vv += (Math.random() - 0.5) * dt;
        p.vu *= 0.995;
        p.vv *= 0.995;
        p.u += p.vu * drift * dt + Math.sin(this.t * 0.35 + p.phase) * 0.04 * dt;
        p.v += p.vv * drift * dt + Math.cos(this.t * 0.28 + p.phase) * 0.03 * dt;
        if (p.u < 0) p.u += 1;
        if (p.u > 1) p.u -= 1;
        if (p.v < 0) p.v += 1;
        if (p.v > 1) p.v -= 1;
      }
    }

    draw(ctx) {
      if (!this.ready || !readEnabled(this.cfg)) return;
      const color = this.cfg.color || "#FFD700";
      const opacity = clamp(Number(this.cfg.opacity ?? 0.28), 0, 1);
      ctx.save();
      applyBlend(ctx, "screen");
      for (const p of this.particles) {
        const a = opacity * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(this.t * 0.8 + p.phase)));
        const x = this.rx + p.u * this.rw;
        const y = this.ry + p.v * this.rh;
        ctx.fillStyle = parseColor(color, clamp(a, 0, 1));
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // --- Eau -----------------------------------------------------------------

  class WaterEffect {
    constructor(opts) {
      this.cfg = opts || {};
      this.kind = "water";
      this.bg = null;
      this.t = 0;
      this.ready = false;
    }

    setBackground(img) {
      this.bg = img || null;
    }

    layout(w, h) {
      if (!(w > 0) || !(h > 0)) return;
      const pos = this.cfg.position || {};
      const size = this.cfg.size || {};
      this.x = toPx(pos.x, w, 0);
      this.y = toPx(pos.y, h, 0.78);
      this.bw = Math.max(8, toPx(size.width, w, 1));
      this.bh = Math.max(8, toPx(size.height, h, 0.22));
      this.frameW = w;
      this.frameH = h;
      this.ready = true;
    }

    update(dt) {
      if (!this.ready || !readEnabled(this.cfg)) return;
      this.t += dt;
    }

    draw(ctx) {
      if (!this.ready || !readEnabled(this.cfg)) return;
      const amp = scaledAmp(this.cfg.wave_amplitude ?? 6, this.frameH);
      const freq = Number(this.cfg.wave_frequency ?? 0.02);
      const color = this.cfg.color || "#4682B4";
      ctx.save();
      ctx.beginPath();
      ctx.rect(this.x, this.y, this.bw, this.bh);
      ctx.clip();

      const img = this.bg;
      if (img && img.naturalWidth) {
        ctx.globalCompositeOperation = "source-over";
        const step = 3;
        for (let row = 0; row < this.bh; row += step) {
          const py = this.y + row;
          const shift = Math.sin(py * freq + this.t * 1.15) * amp
            + Math.sin(py * freq * 2.1 - this.t * 0.7) * amp * 0.35;
          const sy = (py / this.frameH) * img.naturalHeight;
          const sh = Math.max(0.75, (step / this.frameH) * img.naturalHeight);
          ctx.drawImage(img, 0, sy, img.naturalWidth, sh, this.x + shift, py, this.bw, step + 0.75);
        }
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = parseColor(color, 0.35);
        ctx.fillRect(this.x, this.y, this.bw, this.bh);
      }

      applyBlend(ctx, this.cfg.blend_mode || "overlay");
      const wash = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.bh);
      wash.addColorStop(0, parseColor(color, 0.05));
      wash.addColorStop(1, parseColor(color, 0.28));
      ctx.fillStyle = wash;
      ctx.fillRect(this.x, this.y, this.bw, this.bh);

      ctx.globalCompositeOperation = "screen";
      const glide = ((this.t * 28) % (this.bw + 120)) - 60;
      const shine = ctx.createLinearGradient(this.x + glide, this.y, this.x + glide + 70, this.y);
      shine.addColorStop(0, "rgba(255,255,255,0)");
      shine.addColorStop(0.5, "rgba(255,255,255,0.16)");
      shine.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = shine;
      ctx.fillRect(this.x, this.y, this.bw, this.bh);
      ctx.restore();
    }
  }

  // --- Arbres / feuillage --------------------------------------------------

  class TreesEffect {
    constructor(opts) {
      this.cfg = opts || {};
      this.kind = "trees";
      this.bg = null;
      this.t = 0;
      this.leaves = [];
      this.ready = false;
    }

    setBackground(img) {
      this.bg = img || null;
    }

    layout(w, h) {
      if (!(w > 0) || !(h > 0)) return;
      const region = this.cfg.region || { x: 0, y: 0.18, width: 1, height: 0.62 };
      this.rx = toPx(region.x, w, 0);
      this.ry = toPx(region.y, h, 0.18);
      this.rw = Math.max(8, toPx(region.width, w, 1));
      this.rh = Math.max(8, toPx(region.height, h, 0.6));
      this.frameW = w;
      this.frameH = h;
      if (this.leaves.length !== 10) {
        this.leaves = [];
        for (let i = 0; i < 10; i++) {
          this.leaves.push({
            u: Math.random(),
            v: Math.random() * 0.7,
            phase: Math.random() * Math.PI * 2,
            size: 1.4 + Math.random() * 2.2,
            tint: Math.random() > 0.5 ? "#C8D6A0" : "#E7D7A1"
          });
        }
      }
      this.ready = true;
    }

    update(dt) {
      if (!this.ready || !readEnabled(this.cfg)) return;
      this.t += dt * Number(this.cfg.sway_speed ?? 0.45);
    }

    draw(ctx) {
      if (!this.ready || !readEnabled(this.cfg)) return;
      const amp = scaledAmp(this.cfg.sway_amount ?? 5, this.frameW);
      ctx.save();
      ctx.beginPath();
      ctx.rect(this.rx, this.ry, this.rw, this.rh);
      ctx.clip();

      const img = this.bg;
      if (img && img.naturalWidth) {
        ctx.globalCompositeOperation = "source-over";
        const step = 3;
        for (let row = 0; row < this.rh; row += step) {
          const py = this.ry + row;
          const depth = row / this.rh;
          const sway = Math.sin(this.t * 1.7 + row * 0.02) * amp * (1 - depth * 0.72);
          const sy = (py / this.frameH) * img.naturalHeight;
          const sh = Math.max(0.75, (step / this.frameH) * img.naturalHeight);
          const sx = (this.rx / this.frameW) * img.naturalWidth;
          const sw = (this.rw / this.frameW) * img.naturalWidth;
          ctx.drawImage(img, sx, sy, sw, sh, this.rx + sway, py, this.rw, step + 0.75);
        }
      }

      ctx.globalCompositeOperation = "screen";
      for (const leaf of this.leaves) {
        const x = this.rx + leaf.u * this.rw + Math.sin(this.t * 1.4 + leaf.phase) * amp * 0.8;
        const y = this.ry + leaf.v * this.rh + ((this.t * 8 + leaf.phase * 10) % (this.rh * 0.5));
        ctx.fillStyle = parseColor(leaf.tint, 0.28);
        ctx.beginPath();
        ctx.ellipse(x, y, leaf.size * 1.6, leaf.size, leaf.phase, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function createEffect(el) {
    if (!el) return null;
    switch (el.type) {
      case "fire":
        return new FireEffect(el);
      case "candle":
        return new CandleEffect(el);
      case "window_light":
        return new WindowLightEffect(el);
      case "smoke":
        return new SmokeEffect(el);
      case "stars":
        return new StarsEffect(el);
      case "dust":
        return new DustParticlesEffect(el);
      case "water":
        return new WaterEffect(el);
      case "trees":
        return new TreesEffect(el);
      default:
        console.warn("Type d'effet inconnu :", el.type);
        return null;
    }
  }

  class ScenePlayer {
    constructor(canvas, scene, backgroundImage) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.scene = scene || {};
      this.bg = backgroundImage || null;
      this.effects = [];
      this.ambient = null;
      this.running = false;
      this.last = 0;
      this.viewWidth = canvas.width;
      this.viewHeight = canvas.height;
      this._build();
    }

    _build() {
      const s = this.scene;
      if (s.coords !== "relative" && s.canvas_size && s.canvas_size.width) {
        this.canvas.width = s.canvas_size.width;
        this.canvas.height = s.canvas_size.height;
      }
      this.viewWidth = this.canvas.width || s.canvas_size?.width || 1280;
      this.viewHeight = this.canvas.height || s.canvas_size?.height || 720;
      if (!this.canvas.width) {
        this.canvas.width = this.viewWidth;
        this.canvas.height = this.viewHeight;
      }

      this.ambient = s.ambient_light ? new AmbientLight(s.ambient_light) : null;
      this.effects = [];
      const list = s.animated_elements || s.elements || [];
      list.forEach((el) => {
        if (el.enabled === false) return;
        const fx = createEffect(el);
        if (!fx) return;
        if (fx.layout) fx.layout(this.viewWidth, this.viewHeight);
        if (fx.setBackground && this.bg) fx.setBackground(this.bg);
        this.effects.push(fx);
      });
    }

    resize(w, h) {
      if (!(w > 0) || !(h > 0)) return;
      this.viewWidth = w;
      this.viewHeight = h;
      if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w;
        this.canvas.height = h;
      }
      this.effects.forEach((fx) => {
        if (fx.layout) fx.layout(w, h);
        if (fx.setBackground && this.bg) fx.setBackground(this.bg);
      });
    }

    start() {
      if (this.running) return;
      this.running = true;
      this.last = performance.now();
      const loop = (now) => {
        if (!this.running) return;
        const dt = Math.min(0.05, (now - this.last) / 1000);
        this.last = now;
        this.update(dt);
        this.draw();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }

    stop() {
      this.running = false;
    }

    update(dt) {
      if (this.ambient) this.ambient.update(dt);
      this.effects.forEach((fx) => fx.update(dt));
    }

    draw() {
      const ctx = this.ctx;
      const w = this.viewWidth;
      const h = this.viewHeight;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.globalCompositeOperation = "source-over";
      if (this.bg && this.bg.naturalWidth) {
        ctx.drawImage(this.bg, 0, 0, w, h);
      }
      this.effects.forEach((fx) => {
        try {
          fx.draw(ctx, w, h);
        } catch (err) {
          console.error(err);
        }
      });
      if (this.ambient) this.ambient.draw(ctx, w, h);
    }
  }

  global.LivingEffects = {
    FireEffect,
    CandleEffect,
    WindowLightEffect,
    SmokeEffect,
    StarsEffect,
    DustParticlesEffect,
    WaterEffect,
    TreesEffect,
    AmbientLight,
    ScenePlayer,
    createEffect,
    parseColor,
    applyBlend
  };
}

installLivingEffects(typeof window !== "undefined" ? window : globalThis);
