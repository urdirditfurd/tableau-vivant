/**
 * Analyse une description en langage naturel et propose des éléments animés.
 * Les positions sont des fractions de l'image (0 = bord gauche/haut, 1 = bord opposé).
 */
(function (root) {
  "use strict";

  class TextParser {
    constructor() {
      this._seq = 0;

      this.keywords = {
        fire: ["feu", "feux", "flamme", "flammes", "cheminée", "cheminées", "foyer", "fire", "flame", "fireplace"],
        candle: ["lanterne", "lanternes", "lantern", "lanterns", "bougie", "bougies", "chandelle", "chandelles", "candle", "candles", "lumière douce"],
        smoke: ["fumée", "fumées", "vapeur", "brume", "brouillard", "smoke", "steam", "mist", "fog"],
        window_light: ["fenêtre", "fenêtres", "window", "lune", "moon", "lumière extérieure", "clair de lune"],
        stars: ["étoile", "étoiles", "star", "stars", "ciel étoilé", "starry sky", "starry"],
        water: ["eau", "water", "rivière", "river", "lac", "lake", "mer", "sea", "océan", "ocean", "ruisseau"],
        trees: ["arbre", "arbres", "tree", "trees", "forêt", "forêts", "forest", "feuillage", "leaves"],
        dust: ["poussière", "dust", "particule", "particules", "particles"]
      };

      this.defaultPositions = {
        fire: { x: "center", y: "bottom", width: 0.06, height: 0.14 },
        candle: { x: "center", y: "center", radius: 0.04 },
        smoke: { x: "center", y: "top", direction: "up" },
        window_light: { x: "right", y: "top", width: 0.1, height: 0.23 },
        stars: { region: { x: 0, y: 0, width: 1, height: 0.2 } },
        water: { x: "center", y: "bottom", width: 1, height: 0.2 },
        trees: { region: { x: 0, y: 0.2, width: 1, height: 0.6 } },
        dust: { region: { x: 0.2, y: 0.3, width: 0.6, height: 0.4 } }
      };
    }

    /**
     * Retourne la liste des éléments à créer.
     * Un type n'apparaît qu'une fois, sauf les bougies (plusieurs si le texte est au pluriel).
     */
    parseDescription(text) {
      const elements = [];
      const source = String(text || "");
      const lowerText = source.toLowerCase();
      const hints = this._hintsByType(lowerText);

      Object.keys(this.keywords).forEach((type) => {
        const hasKeyword = this.keywords[type].some((keyword) => this._matches(lowerText, keyword));
        if (!hasKeyword) return;

        if (type === "candle") {
          this._pushCandles(source, elements, hints.candle || {});
          return;
        }

        const element = this.createElement(type, source, hints[type] || {});
        if (element) elements.push(element);
      });

      return elements;
    }

    createElement(type, description, hint) {
      const baseElement = {
        id: `${type}_${Date.now().toString(36)}_${++this._seq}`,
        type: type,
        enabled: true
      };

      let element = null;

      switch (type) {
        case "fire":
          element = {
            ...baseElement,
            position: { x: 0.25, y: 0.6 },
            size: { width: 0.08, height: 0.18 },
            intensity: 0.8,
            colors: ["#FF6B00", "#FFA500", "#FFD700"],
            particle_count: 50,
            blend_mode: "screen"
          };
          break;
        case "candle":
          element = {
            ...baseElement,
            position: { x: 0.48, y: 0.62 },
            radius: 0.06,
            color: "#FFD700",
            flicker_speed: 2.0,
            blend_mode: "screen"
          };
          break;
        case "smoke":
          element = {
            ...baseElement,
            position: { x: 0.28, y: 0.22 },
            size: { width: 0.16, height: 0.42 },
            direction: "up",
            speed: 0.5,
            count: 16,
            color: "#D9D3C7",
            opacity: 0.32,
            blend_mode: "normal"
          };
          break;
        case "window_light":
          element = {
            ...baseElement,
            position: { x: 0.68, y: 0.08 },
            size: { width: 0.22, height: 0.42 },
            color: "#87CEEB",
            shimmer_intensity: 0.28,
            blend_mode: "overlay"
          };
          break;
        case "stars":
          element = {
            ...baseElement,
            region: { x: 0.04, y: 0.03, width: 0.92, height: 0.28 },
            count: 32,
            twinkle_speed: 1.5,
            color: "#FFFFFF"
          };
          break;
        case "water":
          element = {
            ...baseElement,
            position: { x: 0, y: 0.78 },
            size: { width: 1, height: 0.22 },
            wave_amplitude: 6,
            wave_frequency: 0.02,
            color: "#4682B4",
            blend_mode: "overlay"
          };
          break;
        case "trees":
          element = {
            ...baseElement,
            region: { x: 0, y: 0.18, width: 1, height: 0.62 },
            sway_amount: 5,
            sway_speed: 0.45,
            blend_mode: "normal"
          };
          break;
        case "dust":
          element = {
            ...baseElement,
            region: { x: 0.12, y: 0.18, width: 0.76, height: 0.55 },
            count: 18,
            speed: 0.15,
            color: "#FFD700",
            opacity: 0.28
          };
          break;
        default:
          return null;
      }

      const applied = hint || (description ? (this._hintsByType(description)[type] || {}) : {});
      return this._applyHint(element, applied);
    }

    /**
     * Repère les mots de placement dans un extrait de phrase.
     * Les deux axes peuvent être présents (« en haut à gauche »).
     */
    analyzePosition(description) {
      const lowerDesc = String(description || "").toLowerCase();
      const pos = {};

      if (/(^|[^a-zà-ÿ])gauche([^a-zà-ÿ]|$)|left/.test(lowerDesc)) pos.x = 0.22;
      else if (/(^|[^a-zà-ÿ])droite([^a-zà-ÿ]|$)|right/.test(lowerDesc)) pos.x = 0.78;
      else if (/centre|center|milieu/.test(lowerDesc)) pos.x = 0.5;

      if (/(^|[^a-zà-ÿ])haut([^a-zà-ÿ]|$)|top|dessus/.test(lowerDesc)) pos.y = 0.12;
      else if (/(^|[^a-zà-ÿ])bas([^a-zà-ÿ]|$)|bottom|dessous/.test(lowerDesc)) pos.y = 0.72;

      return pos;
    }

    _pushCandles(text, elements, hint) {
      const count = this._candleCount(text);
      const place = hint || {};
      const cx = place.x != null ? place.x : 0.5;
      const cy = place.y != null ? place.y : 0.62;
      const span = Math.min(0.34, 0.07 * Math.max(1, count));

      for (let i = 0; i < count; i++) {
        const el = this.createElement("candle", "", {});
        const t = count === 1 ? 0.5 : i / (count - 1);
        el.position.x = clamp01(cx + (t - 0.5) * span);
        el.position.y = clamp01(cy + (i % 2) * 0.045);
        el.radius = 0.03 + (i % 3) * 0.008;
        el.flicker_speed = 1.35 + (i % 4) * 0.38;
        el.color = ["#FFD700", "#FFB347", "#FFE7A3", "#FFCC66"][i % 4];
        elements.push(el);
      }
    }

    _candleCount(text) {
      const lower = text.toLowerCase();
      if (!/bougies|chandelles|candles|lanternes|lanterns/.test(lower)) return 1;
      const m = lower.match(/(\d+|deux|trois|quatre|cinq|quelques)\s+(bougies|chandelles|candles|lanternes|lanterns)/);
      if (!m) return 3;
      const words = { deux: 2, trois: 3, quatre: 4, cinq: 5, quelques: 3 };
      const n = words[m[1]] || parseInt(m[1], 10);
      if (!Number.isFinite(n)) return 3;
      return Math.max(1, Math.min(6, n));
    }

    _windowAround(text, type) {
      const lower = String(text || "").toLowerCase();
      const words = this.keywords[type] || [];
      let idx = -1;
      let found = "";
      words.forEach((keyword) => {
        const i = lower.indexOf(keyword);
        if (i !== -1 && (idx === -1 || i < idx)) {
          idx = i;
          found = keyword;
        }
      });
      if (idx === -1) return lower;
      const start = Math.max(0, idx - 80);
      const end = Math.min(lower.length, idx + found.length + 80);
      return lower.slice(start, end);
    }

    /**
     * Chaque mot de place est rattaché à l'objet le plus proche
     * (« lac à droite » ne déplace pas les étoiles).
     */
    _hintsByType(text) {
      const lower = String(text || "").toLowerCase();
      const anchors = [];
      Object.keys(this.keywords).forEach((type) => {
        this.keywords[type].forEach((keyword) => {
          let from = 0;
          while (from < lower.length) {
            const index = lower.indexOf(keyword, from);
            if (index === -1) break;
            if (this._matchAt(lower, keyword, index)) {
              anchors.push({ type, index });
            }
            from = index + Math.max(1, keyword.length);
          }
        });
      });

      const words = [
        { re: /(^|[^a-zà-ÿ])(gauche|left)(?![a-zà-ÿ])/gi, axis: "x", value: 0.22 },
        { re: /(^|[^a-zà-ÿ])(droite|right)(?![a-zà-ÿ])/gi, axis: "x", value: 0.78 },
        { re: /(^|[^a-zà-ÿ])(centre|center|milieu)(?![a-zà-ÿ])/gi, axis: "x", value: 0.5 },
        { re: /(^|[^a-zà-ÿ])(haut|top|dessus)(?![a-zà-ÿ])/gi, axis: "y", value: 0.12 },
        { re: /(^|[^a-zà-ÿ])(bas|bottom|dessous)(?![a-zà-ÿ])/gi, axis: "y", value: 0.72 }
      ];
      const hints = {};
      words.forEach((word) => {
        let match = word.re.exec(lower);
        while (match) {
          const at = match.index + match[1].length;
          let best = null;
          let bestDist = 42;
          anchors.forEach((anchor) => {
            const dist = Math.abs(anchor.index - at);
            if (dist < bestDist) {
              bestDist = dist;
              best = anchor;
            }
          });
          if (best) {
            if (!hints[best.type]) hints[best.type] = {};
            hints[best.type][word.axis] = word.value;
          }
          match = word.re.exec(lower);
        }
      });
      return hints;
    }

    _matchAt(text, keyword, index) {
      if (text.substr(index, keyword.length) !== keyword) return false;
      if (keyword === "feu") {
        const rest = text.substr(index + 3, 6);
        if (rest.startsWith("illage") || rest.startsWith("ille")) return false;
      }
      const isolated = keyword.length <= 3 || keyword === "star" || keyword === "tree" || keyword === "lake" || keyword === "fire";
      if (isolated) {
        const before = index > 0 ? text.charAt(index - 1) : "";
        const after = text.charAt(index + keyword.length);
        if (/[a-zà-ÿ]/i.test(before) || /[a-zà-ÿ]/i.test(after)) return false;
      }
      return true;
    }

    _applyHint(element, hint) {
      if (!element || !hint) return element;
      if (element.position && hint.x != null && element.size && Number(element.size.width) >= 0.9) {
        element.size.width = 0.5;
        element.position.x = hint.x >= 0.6 ? 0.5 : hint.x <= 0.35 ? 0 : 0.25;
      } else if (element.position && hint.x != null) {
        const half = element.size ? (Number(element.size.width) || 0) / 2 : 0;
        element.position.x = clamp01(hint.x - half);
      }
      if (element.position && hint.y != null) element.position.y = hint.y;

      if (element.region && hint.x != null && element.region.width > 0.8) {
        element.region.width = 0.48;
        element.region.x = hint.x >= 0.6 ? 0.5 : hint.x <= 0.35 ? 0.02 : 0.26;
      } else if (element.region && hint.x != null) {
        element.region.x = clamp01(hint.x - element.region.width / 2);
      }
      if (element.region && hint.y != null) element.region.y = clamp01(hint.y);
      return element;
    }

    /**
     * « feu » ne doit pas déclencher un foyer quand le mot est « feuillage ».
     * Les mots très courts sont isolés pour éviter les faux positifs (mer/commerce…).
     */
    _matches(text, keyword) {
      const k = keyword.toLowerCase();
      if (k === "feu") return /feu(?!illage|illes?)/i.test(text);
      if (k.length <= 3 || k === "star" || k === "tree" || k === "lake" || k === "fire") {
        const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(`(^|[^a-zà-ÿ])${escaped}([^a-zà-ÿ]|$)`, "i").test(text);
      }
      return text.includes(k);
    }
  }

  function clamp01(v) {
    return Math.max(0.02, Math.min(0.92, v));
  }

  root.TextParser = TextParser;
})(typeof window !== "undefined" ? window : globalThis);
