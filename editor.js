/**
 * Éditeur visuel : zones, déplacement, redimensionnement.
 * L'animation tourne sur le même canvas, par-dessus la photo.
 */
(function (root) {
  "use strict";

  const TYPE_META = {
    fire: { icon: "🔥", label: "Feu" },
    candle: { icon: "🕯️", label: "Bougie" },
    smoke: { icon: "💨", label: "Fumée" },
    window_light: { icon: "🌙", label: "Fenêtre / lune" },
    stars: { icon: "✨", label: "Étoiles" },
    water: { icon: "🌊", label: "Eau" },
    trees: { icon: "🌲", label: "Arbres" },
    dust: { icon: "✴️", label: "Poussière" }
  };

  function toPx(value, total) {
    if (value == null || Number.isNaN(Number(value))) return 0;
    const n = Number(value);
    return Math.abs(n) <= 1 ? n * total : n;
  }

  class VisualElement {
    constructor(config, canvas) {
      this.config = config;
      this.canvas = canvas;
      this.editor = null;
    }

    space() {
      if (this.editor && this.editor.viewWidth) {
        return { w: this.editor.viewWidth, h: this.editor.viewHeight };
      }
      return { w: this.canvas.width || 1, h: this.canvas.height || 1 };
    }

    /** Rectangle en pixels d'affichage (pas les pixels retina du bitmap). */
    getBounds() {
      const { w, h } = this.space();
      const c = this.config;

      if (c.type === "candle") {
        const radius = c.radius == null ? 0.045 : Number(c.radius);
        const r = Math.abs(radius) <= 1 ? radius * Math.min(w, h) : radius;
        const cx = toPx(c.position?.x ?? 0.5, w);
        const cy = toPx(c.position?.y ?? 0.5, h);
        return { x: cx - r, y: cy - r, width: r * 2, height: r * 2 };
      }

      if (c.region) {
        return {
          x: toPx(c.region.x, w),
          y: toPx(c.region.y, h),
          width: Math.max(12, toPx(c.region.width, w)),
          height: Math.max(12, toPx(c.region.height, h))
        };
      }

      return {
        x: toPx(c.position?.x ?? 0, w),
        y: toPx(c.position?.y ?? 0, h),
        width: Math.max(12, toPx(c.size?.width ?? 0.1, w)),
        height: Math.max(12, toPx(c.size?.height ?? 0.1, h))
      };
    }

    getPosition() {
      const b = this.getBounds();
      return { x: b.x, y: b.y };
    }

    getSize() {
      const b = this.getBounds();
      return { width: b.width, height: b.height };
    }

    setPosition(x, y) {
      const b = this.getBounds();
      this.setBounds(x, y, b.width, b.height);
    }

    setBounds(x, y, width, height) {
      const { w, h } = this.space();
      const bw = Math.max(16, width);
      const bh = Math.max(16, height);
      const c = this.config;

      if (c.type === "candle") {
        const r = Math.min(bw, bh) / 2;
        c.radius = r / Math.min(w, h);
        if (!c.position) c.position = { x: 0.5, y: 0.5 };
        c.position.x = (x + bw / 2) / w;
        c.position.y = (y + bh / 2) / h;
        return;
      }

      if (c.region) {
        c.region.x = x / w;
        c.region.y = y / h;
        c.region.width = bw / w;
        c.region.height = bh / h;
        return;
      }

      if (!c.position) c.position = { x: 0, y: 0 };
      if (!c.size) c.size = { width: 0.1, height: 0.1 };
      c.position.x = x / w;
      c.position.y = y / h;
      c.size.width = bw / w;
      c.size.height = bh / h;
    }

    containsPoint(x, y) {
      const b = this.getBounds();
      const pad = 6;
      return x >= b.x - pad && x <= b.x + b.width + pad
        && y >= b.y - pad && y <= b.y + b.height + pad;
    }

    handles() {
      const b = this.getBounds();
      return [
        { name: "nw", x: b.x, y: b.y },
        { name: "ne", x: b.x + b.width, y: b.y },
        { name: "sw", x: b.x, y: b.y + b.height },
        { name: "se", x: b.x + b.width, y: b.y + b.height }
      ];
    }

    hitHandle(x, y) {
      const slop = 10;
      const found = this.handles().find((handle) => Math.abs(handle.x - x) <= slop && Math.abs(handle.y - y) <= slop);
      return found ? found.name : null;
    }

    drawGuide(ctx, selected) {
      const b = this.getBounds();
      const meta = TYPE_META[this.config.type] || { icon: "•", label: this.config.type };
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      if (this.config.enabled === false) ctx.globalAlpha = 0.45;
      ctx.strokeStyle = selected ? "#f0a05a" : "rgba(255,244,230,0.55)";
      ctx.lineWidth = selected ? 1.5 : 1;
      ctx.setLineDash(selected ? [] : [5, 4]);
      ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.width, b.height);
      ctx.setLineDash([]);

      const text = `${meta.icon} ${meta.label}`;
      ctx.font = "12px Segoe UI, sans-serif";
      const tw = ctx.measureText(text).width;
      const lx = b.x;
      const ly = Math.max(0, b.y - 20);
      ctx.fillStyle = selected ? "rgba(240,160,90,0.92)" : "rgba(20,16,12,0.72)";
      ctx.fillRect(lx, ly, tw + 12, 18);
      ctx.fillStyle = selected ? "#1a120c" : "#fff8ef";
      ctx.fillText(text, lx + 6, ly + 13);
      ctx.restore();
    }

    drawSelectionHandles(ctx) {
      const size = 8;
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#fff8ef";
      ctx.strokeStyle = "#e39a45";
      ctx.lineWidth = 1.5;
      this.handles().forEach((handle) => {
        ctx.fillRect(handle.x - size / 2, handle.y - size / 2, size, size);
        ctx.strokeRect(handle.x - size / 2, handle.y - size / 2, size, size);
      });
      ctx.restore();
    }

    draw(ctx) {
      this.drawGuide(ctx, false);
    }

    getConfig() {
      return this.config;
    }
  }

  class VisualEditor {
    constructor(canvas, imageElement) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.image = imageElement;
      this.elements = [];
      this.effects = new Map();
      this.selectedElement = null;
      this.isDragging = false;
      this.dragMode = null;
      this.activeHandle = null;
      this.dragOffset = { x: 0, y: 0 };
      this.dragOrigin = null;
      this.showZones = true;
      this.running = false;
      this.last = 0;
      this.viewWidth = canvas.width || 1;
      this.viewHeight = canvas.height || 1;
      this.dpr = 1;
      this.onSelect = null;
      this.onChange = null;
      this._broken = new Set();
      this.ambient = null;
      this._ambientFx = null;
    }

    addElement(elementConfig) {
      const config = JSON.parse(JSON.stringify(elementConfig));
      if (!config.id) {
        config.id = `el_${Date.now().toString(36)}_${Math.floor(Math.random() * 9999)}`;
      }
      const element = new VisualElement(config, this.canvas);
      element.editor = this;
      this.elements.push(element);
      this._mountEffect(element);
      return element;
    }

    _mountEffect(element) {
      if (!root.LivingEffects) return null;
      const fx = root.LivingEffects.createEffect(element.config);
      if (!fx) return null;
      this.effects.set(element.config.id, fx);
      return fx;
    }

    clearElements() {
      this.elements = [];
      this.effects.clear();
      this.selectedElement = null;
      this._broken.clear();
    }

    removeElement(elementId) {
      this.elements = this.elements.filter((el) => el.config.id !== elementId);
      this.effects.delete(elementId);
      if (this.selectedElement && this.selectedElement.config.id === elementId) {
        this.selectedElement = null;
      }
      if (typeof this.onChange === "function") this.onChange();
    }

    selectElement(elementId) {
      this.selectedElement = this.elements.find((el) => el.config.id === elementId) || null;
      if (typeof this.onSelect === "function") this.onSelect(this.selectedElement);
      return this.selectedElement;
    }

    moveElement(elementId, direction) {
      const index = this.elements.findIndex((el) => el.config.id === elementId);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= this.elements.length) return;
      const [item] = this.elements.splice(index, 1);
      this.elements.splice(next, 0, item);
      if (typeof this.onChange === "function") this.onChange();
    }

    updateElement(elementId, properties) {
      const element = this.elements.find((el) => el.config.id === elementId);
      if (!element) return;
      Object.assign(element.config, properties);
      if (typeof this.onChange === "function") this.onChange();
    }

    handleMouseDown(x, y) {
      if (this.selectedElement) {
        const handle = this.selectedElement.hitHandle(x, y);
        if (handle) {
          this.isDragging = true;
          this.dragMode = "resize";
          this.activeHandle = handle;
          this.dragOrigin = { x: x, y: y, bounds: this.selectedElement.getBounds() };
          return true;
        }
      }

      for (let i = this.elements.length - 1; i >= 0; i--) {
        const element = this.elements[i];
        if (element.containsPoint(x, y)) {
          this.selectedElement = element;
          this.isDragging = true;
          this.dragMode = "move";
          const pos = element.getBounds();
          this.dragOffset = { x: x - pos.x, y: y - pos.y };
          if (typeof this.onSelect === "function") this.onSelect(element);
          return true;
        }
      }

      this.selectedElement = null;
      if (typeof this.onSelect === "function") this.onSelect(null);
      return false;
    }

    handleMouseMove(x, y) {
      if (!this.isDragging || !this.selectedElement) return;

      if (this.dragMode === "resize" && this.dragOrigin) {
        const b = this.dragOrigin.bounds;
        const dx = x - this.dragOrigin.x;
        const dy = y - this.dragOrigin.y;
        let nx = b.x;
        let ny = b.y;
        let nw = b.width;
        let nh = b.height;
        if (this.activeHandle.indexOf("e") !== -1) nw = b.width + dx;
        if (this.activeHandle.indexOf("s") !== -1) nh = b.height + dy;
        if (this.activeHandle.indexOf("w") !== -1) {
          nw = b.width - dx;
          nx = b.x + dx;
        }
        if (this.activeHandle.indexOf("n") !== -1) {
          nh = b.height - dy;
          ny = b.y + dy;
        }
        this.selectedElement.setBounds(nx, ny, nw, nh);
        return;
      }

      const bounds = this.selectedElement.getBounds();
      this.selectedElement.setBounds(
        x - this.dragOffset.x,
        y - this.dragOffset.y,
        bounds.width,
        bounds.height
      );
    }

    handleMouseUp() {
      const was = this.isDragging;
      this.isDragging = false;
      this.dragMode = null;
      this.activeHandle = null;
      this.dragOrigin = null;
      if (was && typeof this.onChange === "function") this.onChange();
    }

    updateCursor(x, y) {
      if (!this.canvas) return;
      if (this.selectedElement && this.selectedElement.hitHandle(x, y)) {
        const name = this.selectedElement.hitHandle(x, y);
        this.canvas.style.cursor = (name === "nw" || name === "se") ? "nwse-resize" : "nesw-resize";
        return;
      }
      const over = this.elements.some((el) => el.containsPoint(x, y));
      this.canvas.style.cursor = over ? "grab" : "default";
    }

    exportToJSON() {
      return {
        coords: "relative",
        elements: this.elements.map((el) => JSON.parse(JSON.stringify(el.getConfig())))
      };
    }

    importFromJSON(json) {
      this.clearElements();
      const list = (json && (json.elements || json.animated_elements)) || [];
      list.forEach((config) => this.addElement(config));
    }

    start() {
      if (this.running) return;
      this.running = true;
      this.last = performance.now();
      const loop = (now) => {
        if (!this.running) return;
        const dt = Math.min(0.05, (now - this.last) / 1000);
        this.last = now;
        this._paint(dt);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }

    stop() {
      this.running = false;
    }

    render() {
      this._paint(0);
    }

    _paint(dt) {
      const ctx = this.ctx;
      if (!ctx) return;
      const w = this.viewWidth || this.canvas.width;
      const h = this.viewHeight || this.canvas.height;
      const dpr = this.dpr || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";

      if (this.image && this.image.naturalWidth) {
        ctx.drawImage(this.image, 0, 0, w, h);
      }

      this.elements.forEach((element) => {
        const fx = this.effects.get(element.config.id);
        if (element.config.enabled !== false && fx && !this._broken.has(element.config.id)) {
          try {
            fx.cfg = element.config;
            if (fx.layout) fx.layout(w, h);
            if (fx.setBackground) fx.setBackground(this.image);
            if (dt) fx.update(dt);
            fx.draw(ctx, w, h);
          } catch (err) {
            console.error(err);
            this._broken.add(element.config.id);
          }
        }
      });

      if (this.ambient && this.ambient.enabled !== false && root.LivingEffects) {
        if (!this._ambientFx) this._ambientFx = new root.LivingEffects.AmbientLight(this.ambient);
        this._ambientFx.cfg = this.ambient;
        if (dt) this._ambientFx.update(dt);
        this._ambientFx.draw(ctx, w, h);
      }

      if (this.showZones) {
        this.elements.forEach((element) => {
          element.drawGuide(ctx, element === this.selectedElement);
        });
      } else if (this.selectedElement) {
        this.selectedElement.drawGuide(ctx, true);
      }

      if (this.selectedElement) this.selectedElement.drawSelectionHandles(ctx);
    }
  }

  root.TYPE_META = TYPE_META;
  root.VisualElement = VisualElement;
  root.VisualEditor = VisualEditor;
})(typeof window !== "undefined" ? window : globalThis);
