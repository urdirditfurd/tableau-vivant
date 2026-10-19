/**
 * Application « Tableau vivant ».
 * Trois étapes : description, édition, export HTML autonome.
 */
(function () {
  "use strict";

  const STORAGE_KEY = "animationApp";

  const FIELD_RANGES = {
    "position.x": { min: 0, max: 1, step: 0.01 },
    "position.y": { min: 0, max: 1, step: 0.01 },
    "size.width": { min: 0.02, max: 1, step: 0.01 },
    "size.height": { min: 0.02, max: 1, step: 0.01 },
    "region.x": { min: 0, max: 1, step: 0.01 },
    "region.y": { min: 0, max: 1, step: 0.01 },
    "region.width": { min: 0.05, max: 1, step: 0.01 },
    "region.height": { min: 0.05, max: 1, step: 0.01 },
    intensity: { min: 0, max: 1.2, step: 0.02 },
    opacity: { min: 0, max: 1, step: 0.02 },
    radius: { min: 0.015, max: 0.28, step: 0.005 },
    particle_count: { min: 10, max: 180, step: 1 },
    flicker_speed: { min: 0.2, max: 5, step: 0.1 },
    speed: { min: 0.05, max: 1.6, step: 0.05 },
    shimmer_intensity: { min: 0, max: 0.8, step: 0.02 },
    count: { min: 0, max: 120, step: 1 },
    twinkle_speed: { min: 0.2, max: 4, step: 0.1 },
    wave_amplitude: { min: 0, max: 24, step: 0.5 },
    wave_frequency: { min: 0.005, max: 0.08, step: 0.001 },
    sway_amount: { min: 0, max: 24, step: 0.5 },
    sway_speed: { min: 0.05, max: 2, step: 0.05 }
  };

  const FIELD_LABELS = {
    "position.x": "Position horizontale",
    "position.y": "Position verticale",
    "size.width": "Largeur",
    "size.height": "Hauteur",
    "region.x": "Zone — gauche",
    "region.y": "Zone — haut",
    "region.width": "Zone — largeur",
    "region.height": "Zone — hauteur",
    intensity: "Intensité",
    opacity: "Opacité",
    radius: "Rayon du halo",
    particle_count: "Particules",
    flicker_speed: "Vitesse du scintillement",
    speed: "Vitesse",
    shimmer_intensity: "Scintillement",
    count: "Nombre",
    twinkle_speed: "Vitesse des étoiles",
    wave_amplitude: "Amplitude des vagues",
    wave_frequency: "Fréquence des vagues",
    sway_amount: "Amplitude du vent",
    sway_speed: "Vitesse du vent",
    color: "Couleur",
    "colors.0": "Teinte",
    direction: "Direction",
    blend_mode: "Fusion"
  };

  class AnimationApp {
    constructor() {
      this.currentStep = 1;
      this.image = null;
      this.imageDataUrl = null;
      this.persistImage = null;
      this.parser = new TextParser();
      this.editor = null;
      this._dragging = false;
      this._analyzedOnce = false;
      this._toastTimer = 0;
      this._saveTimer = 0;
      this.ambient = {
        enabled: true,
        color: "#FFA500",
        intensity: 0.18,
        pulse_speed: 0.4
      };
      this.description = "";
      this.init();
    }

    init() {
      try {
        this.setupEventListeners();
        const restored = this.loadFromLocalStorage();
        if (!restored) this.showStep(1);
      } catch (err) {
        console.error(err);
        this.showBootError(err);
        this.showStep(1);
      }
    }

    showBootError(err) {
      const box = document.getElementById("bootError");
      if (!box) return;
      box.className = "show";
      box.textContent = "Erreur au démarrage : " + (err && err.message ? err.message : String(err));
    }

    setupEventListeners() {
      const upload = document.getElementById("imageUpload");
      if (!upload) throw new Error("Zone d'image introuvable dans la page.");
      upload.addEventListener("change", (event) => this.handleImageUpload(event));

      const dropZone = document.getElementById("dropZone");
      ["dragenter", "dragover"].forEach((name) => {
        dropZone.addEventListener(name, (event) => {
          event.preventDefault();
          dropZone.classList.add("is-over");
        });
      });
      ["dragleave", "drop"].forEach((name) => {
        dropZone.addEventListener(name, (event) => {
          event.preventDefault();
          dropZone.classList.remove("is-over");
        });
      });
      dropZone.addEventListener("drop", (event) => {
        const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
        if (file) this.handleImageFile(file);
      });

      document.getElementById("analyzeButton").addEventListener("click", () => {
        this.analyzeDescription();
      });

      document.querySelectorAll(".example-btn").forEach((btn) => {
        btn.addEventListener("click", (event) => {
          const example = event.currentTarget.dataset.example || "";
          document.getElementById("description").value = example;
          this.description = example;
          this.scheduleSave();
        });
      });

      document.getElementById("description").addEventListener("input", (event) => {
        this.description = event.target.value;
        this.scheduleSave();
      });

      const canvas = document.getElementById("editorCanvas");
      canvas.addEventListener("pointerdown", (event) => this.handleCanvasMouseDown(event));
      window.addEventListener("pointermove", (event) => this.handleCanvasMouseMove(event));
      window.addEventListener("pointerup", () => this.handleCanvasMouseUp());

      document.getElementById("propertyPanel").addEventListener("input", (event) => {
        this.handlePropertyChange(event);
      });

      document.getElementById("addGrid").addEventListener("click", (event) => {
        const btn = event.target.closest("[data-add]");
        if (!btn) return;
        this.addEffect(btn.dataset.add);
      });

      document.getElementById("elementList").addEventListener("click", (event) => {
        this.handleListClick(event);
      });

      document.getElementById("toggleZones").addEventListener("change", (event) => {
        if (!this.editor) return;
        this.editor.showZones = event.target.checked;
      });

      document.getElementById("ambientPanel").addEventListener("input", () => {
        this.readAmbientFromForm();
        this.scheduleSave();
      });

      document.getElementById("exportButton").addEventListener("click", () => {
        this.exportAnimation();
      });
      document.getElementById("copyButton").addEventListener("click", () => {
        this.copyAnimation();
      });
      document.getElementById("restartButton").addEventListener("click", () => {
        this.restart();
      });

      document.getElementById("prevButton").addEventListener("click", () => this.prevStep());
      document.getElementById("nextButton").addEventListener("click", () => this.nextStep());

      document.querySelectorAll(".progress-step").forEach((btn) => {
        btn.addEventListener("click", () => {
          this.gotoStep(Number(btn.dataset.step));
        });
      });

      document.addEventListener("keydown", (event) => this.handleKeyDown(event));

      const wrap = document.getElementById("stageWrap");
      if (typeof ResizeObserver !== "undefined") {
        this._resizeObserver = new ResizeObserver(() => {
          if (this.currentStep === 2) this.fitStage();
        });
        this._resizeObserver.observe(wrap);
      } else {
        window.addEventListener("resize", () => {
          if (this.currentStep === 2) this.fitStage();
        });
      }

      document.addEventListener("visibilitychange", () => {
        if (!this.editor) return;
        if (document.hidden) this.editor.stop();
        else if (this.currentStep === 2) this.editor.start();
      });
    }

    handleImageUpload(event) {
      const file = event.target.files && event.target.files[0];
      if (file) this.handleImageFile(file);
      event.target.value = "";
    }

    async handleImageFile(file) {
      if (!file || !file.type || file.type.indexOf("image/") !== 0) {
        this.toast("Choisissez un fichier image (JPG, PNG, WebP…).", "error");
        return;
      }
      try {
        const dataUrl = await readFileAsDataURL(file);
        let working = dataUrl;
        if (file.size > 1800000) {
          working = await compressDataUrl(dataUrl, 1600, 0.85);
          this.toast("Image allégée pour rester fluide dans le navigateur.");
        }
        await this.setImage(working);
        this.persistImage = working;
        this.imageDataUrl = working;
        const nameLine = document.getElementById("imageFileName");
        if (nameLine) {
          nameLine.hidden = false;
          nameLine.textContent = "Image prête : " + (file.name || "fichier local");
        }
        this.saveToLocalStorage();
        this.toast("Image chargée.");
      } catch (err) {
        console.error(err);
        this.toast("Impossible de lire cette image.", "error");
      }
    }

    setImage(src) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          this.image = img;
          this.imageDataUrl = src;
          const preview = document.getElementById("uploadPreview");
          const bg = document.getElementById("backgroundImage");
          preview.src = src;
          preview.hidden = false;
          bg.src = src;
          bg.hidden = false;
          bg.style.display = "block";
          document.getElementById("dropZone").classList.add("has-image");

          const canvas = document.getElementById("editorCanvas");
          if (!this.editor) {
            this.editor = new VisualEditor(canvas, img);
            this.editor.showZones = document.getElementById("toggleZones").checked;
            this.editor.onSelect = (element) => {
              if (element) this.showPropertyPanel(element);
              else this.hidePropertyPanel();
              this.refreshElementList();
            };
            this.editor.onChange = () => this.scheduleSave();
          } else {
            this.editor.image = img;
          }
          this.fitStage();
          resolve(img);
        };
        img.onerror = () => reject(new Error("image"));
        img.src = src;
      });
    }

    analyzeDescription() {
      const description = document.getElementById("description").value;
      this.description = description;

      if (!description.trim()) {
        this.toast("Écrivez une description de la scène.", "error");
        return;
      }
      if (!this.image || !this.editor) {
        this.toast("Ajoutez d'abord une image de fond.", "error");
        return;
      }

      if (this._analyzedOnce && this.editor.elements.length) {
        const redo = window.confirm("Relancer l'analyse remplace les éléments déjà placés. Continuer ?");
        if (!redo) {
          this.currentStep = 2;
          this.showStep(2);
          return;
        }
      }

      let elements = [];
      try {
        elements = this.parser.parseDescription(description);
      } catch (err) {
        console.error(err);
        this.toast("L'analyse du texte a échoué.", "error");
        return;
      }

      if (!elements.length) {
        this.toast("Aucun élément reconnu. Essayez « feu », « bougie », « étoiles », « brume »…", "error");
        return;
      }

      this.editor.clearElements();
      elements.forEach((config) => this.editor.addElement(config));
      this._analyzedOnce = true;
      this.applyAmbientFor(elements);

      this.currentStep = 2;
      this.showStep(2);
      this.refreshElementList();
      this.hidePropertyPanel();
      this.saveToLocalStorage();
      this.setStatus(`${elements.length} élément${elements.length > 1 ? "s" : ""} placé${elements.length > 1 ? "s" : ""}.`);
      this.toast("Animation composée. Ajustez les zones si besoin.");
    }

    applyAmbientFor(elements) {
      const types = elements.map((el) => el.type);
      const warm = types.includes("fire") || types.includes("candle");
      const night = types.includes("stars") || types.includes("window_light");
      if (warm) {
        this.ambient = { enabled: true, color: "#FFA500", intensity: 0.2, pulse_speed: 0.38 };
      } else if (night) {
        this.ambient = { enabled: true, color: "#6FA8DC", intensity: 0.12, pulse_speed: 0.28 };
      }
      this.writeAmbientToForm();
      if (this.editor) this.editor.ambient = this.ambient;
    }

    addEffect(type) {
      if (!this.editor || !this.image) {
        this.toast("Ajoutez une image avant de poser un effet.", "error");
        return;
      }
      const config = this.parser.createElement(type, "");
      if (!config) return;
      const same = this.editor.elements.filter((el) => el.config.type === type).length;
      if (config.position) {
        config.position.x = Math.min(0.9, (config.position.x || 0.4) + same * 0.07);
        config.position.y = Math.min(0.88, (config.position.y || 0.4) + (same % 2) * 0.06);
      }
      if (config.region) {
        config.region.x = Math.min(0.4, (config.region.x || 0) + same * 0.04);
      }
      const element = this.editor.addElement(config);
      this.editor.selectElement(element.config.id);
      this.showPropertyPanel(element);
      this.refreshElementList();
      this.saveToLocalStorage();
    }

    handleListClick(event) {
      if (!this.editor) return;
      const row = event.target.closest("[data-id]");
      if (!row) return;
      const id = row.dataset.id;
      const action = event.target.closest("[data-action]");
      if (!action) {
        this.editor.selectElement(id);
        return;
      }
      const name = action.dataset.action;
      if (name === "delete") {
        this.editor.removeElement(id);
        this.hidePropertyPanel();
      } else if (name === "up") {
        this.editor.moveElement(id, -1);
      } else if (name === "down") {
        this.editor.moveElement(id, 1);
      } else if (name === "toggle") {
        const element = this.editor.elements.find((el) => el.config.id === id);
        if (element) element.config.enabled = !element.config.enabled;
      }
      this.refreshElementList();
      this.scheduleSave();
    }

    handleCanvasMouseDown(event) {
      if (!this.editor || this.currentStep !== 2) return;
      if (event.button != null && event.button !== 0) return;
      const point = this.canvasPoint(event);
      const found = this.editor.handleMouseDown(point.x, point.y);
      this._dragging = true;
      if (found && this.editor.selectedElement) this.showPropertyPanel(this.editor.selectedElement);
      else this.hidePropertyPanel();
      this.refreshElementList();
      try {
        event.target.setPointerCapture(event.pointerId);
      } catch (err) {
        /* pointeur déjà relâché */
      }
    }

    handleCanvasMouseMove(event) {
      if (!this.editor || this.currentStep !== 2) return;
      const point = this.canvasPoint(event);
      if (this._dragging) {
        this.editor.handleMouseMove(point.x, point.y);
        if (this.editor.selectedElement) this.syncPropertyValues(this.editor.selectedElement);
        return;
      }
      if (event.target && event.target.id === "editorCanvas") {
        this.editor.updateCursor(point.x, point.y);
      }
    }

    handleCanvasMouseUp() {
      if (!this._dragging || !this.editor) return;
      this._dragging = false;
      this.editor.handleMouseUp();
      this.saveToLocalStorage();
    }

    canvasPoint(event) {
      const canvas = document.getElementById("editorCanvas");
      const rect = canvas.getBoundingClientRect();
      const vw = this.editor && this.editor.viewWidth ? this.editor.viewWidth : rect.width;
      const vh = this.editor && this.editor.viewHeight ? this.editor.viewHeight : rect.height;
      const sx = rect.width ? vw / rect.width : 1;
      const sy = rect.height ? vh / rect.height : 1;
      return {
        x: (event.clientX - rect.left) * sx,
        y: (event.clientY - rect.top) * sy
      };
    }

    showPropertyPanel(element) {
      const panel = document.getElementById("propertyPanel");
      const empty = document.getElementById("propertyEmpty");
      panel.style.display = "block";
      empty.style.display = "none";
      if (panel.dataset.eid !== element.config.id) {
        panel.dataset.eid = element.config.id;
        this.buildPropertyPanel(element);
      } else {
        this.syncPropertyValues(element);
      }
    }

    buildPropertyPanel(element) {
      const panel = document.getElementById("propertyPanel");
      panel.innerHTML = "";
      const config = element.config;
      const meta = (window.TYPE_META && window.TYPE_META[config.type]) || { label: config.type, icon: "" };

      const title = document.createElement("p");
      title.className = "property-title";
      title.textContent = `${meta.icon} ${meta.label}`;
      panel.appendChild(title);

      this._appendField(panel, {
        key: "enabled",
        label: "Visible",
        type: "checkbox",
        value: config.enabled !== false
      });

      fieldsFor(config).forEach((field) => {
        this._appendField(panel, field);
      });

      const del = document.createElement("button");
      del.type = "button";
      del.className = "btn btn-danger";
      del.textContent = "Supprimer l'élément";
      del.addEventListener("click", () => {
        this.editor.removeElement(config.id);
        this.hidePropertyPanel();
        this.refreshElementList();
        this.saveToLocalStorage();
      });
      panel.appendChild(del);
    }

    _appendField(panel, field) {
      const row = document.createElement("div");
      row.className = "property-row";

      const label = document.createElement("label");
      label.textContent = field.label;

      const input = document.createElement(field.type === "select" ? "select" : "input");
      input.dataset.key = field.key;

      if (field.type === "select") {
        field.options.forEach((opt) => {
          const option = document.createElement("option");
          option.value = opt.value;
          option.textContent = opt.label;
          if (String(opt.value) === String(field.value)) option.selected = true;
          input.appendChild(option);
        });
      } else if (field.type === "checkbox") {
        input.type = "checkbox";
        input.checked = Boolean(field.value);
      } else {
        input.type = field.type;
        if (field.min != null) input.min = String(field.min);
        if (field.max != null) input.max = String(field.max);
        if (field.step != null) input.step = String(field.step);
        input.value = field.value == null ? "" : String(field.value);
      }

      if (field.type === "range") {
        const out = document.createElement("output");
        out.textContent = formatField(field.key, field.value);
        label.appendChild(out);
        input.addEventListener("input", () => {
          out.textContent = formatField(field.key, input.value);
        });
      }

      row.appendChild(label);
      row.appendChild(input);
      panel.appendChild(row);
    }

    syncPropertyValues(element) {
      const panel = document.getElementById("propertyPanel");
      if (!panel || panel.dataset.eid !== element.config.id) return;
      panel.querySelectorAll("[data-key]").forEach((input) => {
        if (document.activeElement === input && input.type !== "range") return;
        const value = this.getNestedValue(element.config, input.dataset.key);
        if (input.type === "checkbox") {
          input.checked = value !== false;
          return;
        }
        if (value == null) return;
        if (String(input.value) !== String(value)) input.value = value;
        if (input.type === "range") {
          const out = input.parentElement && input.parentElement.querySelector("output");
          if (out) out.textContent = formatField(input.dataset.key, value);
        }
      });
    }

    hidePropertyPanel() {
      const panel = document.getElementById("propertyPanel");
      panel.style.display = "none";
      panel.dataset.eid = "";
      document.getElementById("propertyEmpty").style.display = "block";
    }

    handlePropertyChange(event) {
      if (!this.editor || !this.editor.selectedElement) return;
      const input = event.target;
      const key = input.dataset.key;
      if (!key) return;

      let value;
      if (input.type === "checkbox") value = input.checked;
      else if (input.type === "range" || input.type === "number") value = parseFloat(input.value);
      else value = input.value;

      const config = this.editor.selectedElement.config;
      if (key === "colors.0" && typeof value === "string") {
        config.colors = [value, mixWithWhite(value, 0.4), mixWithWhite(value, 0.72)];
      } else {
        this.setNestedValue(config, key, value);
      }

      const out = input.parentElement && input.parentElement.querySelector("output");
      if (out) out.textContent = formatField(key, value);
      this.scheduleSave();
    }

    getNestedValue(obj, path) {
      return path.split(".").reduce((acc, part) => (acc == null ? acc : acc[part]), obj);
    }

    setNestedValue(obj, path, value) {
      const parts = path.split(".");
      const last = parts.pop();
      let target = obj;
      parts.forEach((part) => {
        if (target[part] == null || typeof target[part] !== "object") target[part] = {};
        target = target[part];
      });
      if (target) target[last] = value;
    }

    refreshElementList() {
      const list = document.getElementById("elementList");
      if (!list) return;
      list.innerHTML = "";
      if (!this.editor || !this.editor.elements.length) {
        const empty = document.createElement("p");
        empty.className = "muted";
        empty.textContent = "Aucun élément pour l'instant.";
        list.appendChild(empty);
        return;
      }
      const selectedId = this.editor.selectedElement && this.editor.selectedElement.config.id;
      this.editor.elements.forEach((element) => {
        const meta = (window.TYPE_META && window.TYPE_META[element.config.type]) || { icon: "•", label: element.config.type };
        const row = document.createElement("div");
        row.className = "element-item" + (element.config.id === selectedId ? " is-selected" : "") + (element.config.enabled === false ? " is-off" : "");
        row.dataset.id = element.config.id;

        const name = document.createElement("button");
        name.type = "button";
        name.className = "element-name";
        name.textContent = `${meta.icon} ${meta.label}`;

        const actions = document.createElement("div");
        actions.className = "element-actions";
        actions.appendChild(iconButton("toggle", element.config.enabled === false ? "Afficher" : "Masquer", element.config.enabled === false ? "○" : "●"));
        actions.appendChild(iconButton("up", "Monter", "↑"));
        actions.appendChild(iconButton("down", "Descendre", "↓"));
        actions.appendChild(iconButton("delete", "Supprimer", "×"));

        row.appendChild(name);
        row.appendChild(actions);
        list.appendChild(row);
      });
    }

    readAmbientFromForm() {
      this.ambient = {
        enabled: document.getElementById("ambientEnabled").checked,
        color: document.getElementById("ambientColor").value,
        intensity: parseFloat(document.getElementById("ambientIntensity").value),
        pulse_speed: parseFloat(document.getElementById("ambientPulse").value)
      };
      const out = document.getElementById("ambientIntensityOut");
      if (out) out.textContent = `${Math.round((this.ambient.intensity || 0) * 100)} %`;
      if (this.editor) this.editor.ambient = this.ambient;
    }

    writeAmbientToForm() {
      const a = this.ambient || {};
      document.getElementById("ambientEnabled").checked = a.enabled !== false;
      document.getElementById("ambientColor").value = toColorInput(a.color || "#FFA500");
      document.getElementById("ambientIntensity").value = String(a.intensity ?? 0.18);
      document.getElementById("ambientPulse").value = String(a.pulse_speed ?? 0.4);
      const out = document.getElementById("ambientIntensityOut");
      if (out) out.textContent = `${Math.round((a.intensity ?? 0.18) * 100)} %`;
    }

    async exportAnimation() {
      try {
        const html = await this.generateStandaloneHTML();
        const blob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "animation.html";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        this.toast("Fichier animation.html téléchargé.");
      } catch (err) {
        console.error(err);
        this.toast(err.message || "Export impossible.", "error");
      }
    }

    async copyAnimation() {
      try {
        const html = await this.generateStandaloneHTML();
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(html);
        } else {
          const area = document.createElement("textarea");
          area.value = html;
          document.body.appendChild(area);
          area.select();
          document.execCommand("copy");
          area.remove();
        }
        this.toast("Code copié dans le presse-papiers.");
      } catch (err) {
        console.error(err);
        this.toast("Impossible de copier le code.", "error");
      }
    }

    async generateStandaloneHTML() {
      if (!this.imageDataUrl) throw new Error("Aucune image à exporter.");
      const effectsCode = this.getAllEffectsCode();
      const scene = {
        coords: "relative",
        description: this.description || "",
        ambient_light: this.ambient,
        elements: this.editor ? this.editor.exportToJSON().elements : []
      };
      const json = JSON.stringify(scene).replace(/</g, "\\u003c");
      const safeEffects = effectsCode.replace(/<\/script/gi, "<\\/script");

      return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tableau vivant</title>
  <style>
    html, body { margin: 0; height: 100%; background: #000; }
    #container {
      min-height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #stage { position: relative; line-height: 0; }
    #background { display: block; width: 100%; height: 100%; }
    #overlay { position: absolute; inset: 0; width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="container">
    <div id="stage">
      <img id="background" alt="" src="${this.imageDataUrl}">
      <canvas id="overlay"></canvas>
    </div>
  </div>
  <${"script"}>
${safeEffects}
    const scene = ${json};
    const img = document.getElementById("background");
    const canvas = document.getElementById("overlay");
    let player = null;

    function fit() {
      const nw = img.naturalWidth || 1280;
      const nh = img.naturalHeight || 720;
      const scale = Math.min(window.innerWidth / nw, window.innerHeight / nh);
      const w = Math.max(2, Math.round(nw * scale));
      const h = Math.max(2, Math.round(nh * scale));
      const stage = document.getElementById("stage");
      stage.style.width = w + "px";
      stage.style.height = h + "px";
      if (!player) {
        canvas.width = w;
        canvas.height = h;
        player = new LivingEffects.ScenePlayer(canvas, scene, img);
        player.start();
      } else {
        player.resize(w, h);
      }
    }

    function boot() {
      fit();
      window.addEventListener("resize", fit);
      document.addEventListener("visibilitychange", function () {
        if (!player) return;
        if (document.hidden) player.stop();
        else player.start();
      });
    }

    if (img.complete && img.naturalWidth) boot();
    else img.onload = boot;
  </${"script"}>
</body>
</html>`;
    }

    getAllEffectsCode() {
      if (typeof installLivingEffects !== "function") {
        throw new Error("Le moteur d'effets n'est pas chargé.");
      }
      const source = installLivingEffects.toString();
      if (!source || source.indexOf("FireEffect") === -1) {
        throw new Error("Impossible d'inclure le moteur d'effets dans l'export.");
      }
      return `(${source})(window);`;
    }

    async refreshPreview() {
      const frame = document.getElementById("previewFrame");
      if (!this.imageDataUrl) {
        frame.removeAttribute("srcdoc");
        this.toast("Aucune image à prévisualiser.", "error");
        return;
      }
      try {
        const html = await this.generateStandaloneHTML();
        frame.srcdoc = html;
      } catch (err) {
        console.error(err);
        this.toast(err.message || "Prévisualisation impossible.", "error");
      }
    }

    showStep(step) {
      this.currentStep = Number(step) || 1;
      document.querySelectorAll(".step").forEach((el) => {
        el.classList.remove("is-on");
      });
      const section = document.getElementById(`step${this.currentStep}`);
      if (section) section.classList.add("is-on");

      const n = this.currentStep;
      document.querySelectorAll(".progress-step").forEach((el, i) => {
        el.classList.toggle("active", i < n);
        el.classList.toggle("current", i === n - 1);
        if (i === n - 1) el.setAttribute("aria-current", "step");
        else el.removeAttribute("aria-current");
      });

      const prev = document.getElementById("prevButton");
      const next = document.getElementById("nextButton");
      if (prev) prev.style.display = n > 1 ? "inline-flex" : "none";
      if (next) {
        next.style.display = n === 3 ? "none" : "inline-flex";
        next.textContent = n === 1 ? "Analyser →" : "Exporter →";
      }

      if (n === 2) {
        this.refreshElementList();
        this.writeAmbientToForm();
        if (this.editor) this.editor.ambient = this.ambient;
        requestAnimationFrame(() => {
          this.fitStage();
          if (this.editor && !document.hidden) this.editor.start();
        });
      } else if (this.editor) {
        this.editor.stop();
      }

      if (n === 3) this.refreshPreview();
    }

    fitStage() {
      const wrap = document.getElementById("stageWrap");
      const stage = document.getElementById("stage");
      const img = document.getElementById("backgroundImage");
      const canvas = document.getElementById("editorCanvas");
      if (!this.image || !this.image.naturalWidth || !wrap) return;
      const maxW = wrap.clientWidth;
      const maxH = Math.max(240, window.innerHeight - 230);
      if (maxW < 40) return;
      const scale = Math.min(maxW / this.image.naturalWidth, maxH / this.image.naturalHeight);
      const w = Math.max(2, Math.round(this.image.naturalWidth * scale));
      const h = Math.max(2, Math.round(this.image.naturalHeight * scale));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      stage.style.width = `${w}px`;
      stage.style.height = `${h}px`;
      img.style.width = `${w}px`;
      img.style.height = `${h}px`;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const bw = Math.round(w * dpr);
      const bh = Math.round(h * dpr);
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }
      if (this.editor) {
        this.editor.viewWidth = w;
        this.editor.viewHeight = h;
        this.editor.dpr = dpr;
        this.editor.image = this.image;
      }
    }

    nextStep() {
      if (this.currentStep === 1) {
        this.analyzeDescription();
        return;
      }
      if (this.currentStep === 2) {
        if (!this.image) {
          this.toast("Ajoutez une image avant d'exporter.", "error");
          return;
        }
        this.showStep(3);
        this.saveToLocalStorage();
      }
    }

    prevStep() {
      if (this.currentStep > 1) this.showStep(this.currentStep - 1);
      this.saveToLocalStorage();
    }

    gotoStep(step) {
      if (step === this.currentStep) return;
      if (step < this.currentStep) {
        this.showStep(step);
        this.saveToLocalStorage();
        return;
      }
      if (step === 2) {
        if (!this.image) {
          this.toast("Ajoutez une image pour ouvrir l'éditeur.", "error");
          return;
        }
        this.showStep(2);
        return;
      }
      if (step === 3) this.nextStep();
    }

    restart() {
      const ok = window.confirm("Effacer le projet en cours et recommencer ?");
      if (!ok) return;
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (err) {
        console.error(err);
      }
      window.location.reload();
    }

    handleKeyDown(event) {
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((event.key === "Delete" || event.key === "Backspace") && this.currentStep === 2 && this.editor && this.editor.selectedElement) {
        event.preventDefault();
        this.editor.removeElement(this.editor.selectedElement.config.id);
        this.hidePropertyPanel();
        this.refreshElementList();
        this.saveToLocalStorage();
      }
    }

    scheduleSave() {
      window.clearTimeout(this._saveTimer);
      this._saveTimer = window.setTimeout(() => this.saveToLocalStorage(), 600);
    }

    saveToLocalStorage() {
      const data = {
        currentStep: this.currentStep,
        description: document.getElementById("description").value,
        image: this.persistImage || this.imageDataUrl,
        scene: this.editor ? this.editor.exportToJSON() : null,
        ambient: this.ambient
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (err) {
        try {
          const slim = { ...data, image: null };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
          this.toast("Projet mémorisé sans l'image : elle est trop lourde pour le navigateur.", "error");
        } catch (err2) {
          console.error(err2);
        }
      }
    }

    loadFromLocalStorage() {
      let raw = null;
      try {
        raw = localStorage.getItem(STORAGE_KEY);
      } catch (err) {
        return false;
      }
      if (!raw) return false;

      try {
        const parsed = JSON.parse(raw);
        this.currentStep = parsed.currentStep || 1;
        this.description = parsed.description || "";
        document.getElementById("description").value = this.description;
        if (parsed.ambient) this.ambient = parsed.ambient;
        this.writeAmbientToForm();

        if (!parsed.image) {
          this.showStep(Math.min(this.currentStep, 1));
          return true;
        }

        this.persistImage = parsed.image;
        this.setImage(parsed.image).then(() => {
          if (parsed.scene && this.editor) {
            this.editor.importFromJSON(parsed.scene);
            this._analyzedOnce = this.editor.elements.length > 0;
          }
          const step = this.image ? (parsed.currentStep || 1) : 1;
          this.showStep(step);
          this.refreshElementList();
        }).catch(() => {
          this.toast("L'image sauvegardée n'a pas pu être rechargée.", "error");
          this.showStep(1);
        });
        return true;
      } catch (err) {
        console.error("Erreur de chargement :", err);
        return false;
      }
    }

    setStatus(text) {
      const line = document.getElementById("statusLine");
      if (line) line.textContent = text || "";
    }

    toast(message, kind) {
      const el = document.getElementById("toast");
      el.textContent = message;
      el.className = "toast show" + (kind ? ` ${kind}` : "");
      window.clearTimeout(this._toastTimer);
      this._toastTimer = window.setTimeout(() => {
        el.className = "toast";
      }, 3400);
    }
  }

  function fieldsFor(config) {
    const fields = [];
    const push = (key, type, extra) => {
      const range = FIELD_RANGES[key] || {};
      fields.push({
        key,
        label: FIELD_LABELS[key] || key,
        type,
        value: valueAt(config, key),
        min: range.min,
        max: range.max,
        step: range.step,
        ...extra
      });
    };

    if (config.region) {
      ["region.x", "region.y", "region.width", "region.height"].forEach((key) => push(key, "range"));
    } else if (config.position) {
      push("position.x", "range");
      push("position.y", "range");
    }
    if (config.size) {
      push("size.width", "range");
      push("size.height", "range");
    }
    ["intensity", "opacity", "radius", "particle_count", "flicker_speed", "speed", "shimmer_intensity", "count", "twinkle_speed", "wave_amplitude", "wave_frequency", "sway_amount", "sway_speed"].forEach((key) => {
      if (config[key] != null) push(key, "range");
    });
    if (typeof config.color === "string") push("color", "color");
    if (Array.isArray(config.colors) && config.colors.length) push("colors.0", "color");
    if (config.direction) {
      push("direction", "select", {
        options: [
          { value: "up", label: "Vers le haut" },
          { value: "down", label: "Vers le bas" }
        ]
      });
    }
    if (config.blend_mode) {
      push("blend_mode", "select", {
        options: [
          { value: "normal", label: "Normale" },
          { value: "screen", label: "Écran" },
          { value: "overlay", label: "Superposition" },
          { value: "lighter", label: "Éclaircir" },
          { value: "multiply", label: "Produit" },
          { value: "soft_light", label: "Lumière douce" }
        ]
      });
    }
    return fields;
  }

  function valueAt(obj, path) {
    return path.split(".").reduce((acc, part) => (acc == null ? acc : acc[part]), obj);
  }

  function formatField(key, value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value ?? "");
    if (key.indexOf("position") === 0 || key.indexOf("size") === 0 || key.indexOf("region") === 0 || key === "radius" || key === "opacity" || key === "intensity" || key === "shimmer_intensity") {
      return `${Math.round(n * 100)} %`;
    }
    if (key === "particle_count" || key === "count") return String(Math.round(n));
    return String(Math.round(n * 100) / 100);
  }

  function iconButton(action, label, text) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.action = action;
    btn.title = label;
    btn.setAttribute("aria-label", label);
    btn.textContent = text;
    return btn;
  }

  function mixWithWhite(hex, t) {
    const raw = String(hex || "#FFA500").replace("#", "");
    const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
    const n = parseInt(full, 16);
    if (!Number.isFinite(n)) return "#FFD700";
    const mix = (c) => Math.round(c + (255 - c) * t);
    const h = (c) => c.toString(16).padStart(2, "0");
    return `#${h(mix((n >> 16) & 255))}${h(mix((n >> 8) & 255))}${h(mix(n & 255))}`;
  }

  function toColorInput(hex) {
    const raw = String(hex || "#FFA500").replace("#", "");
    const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw.slice(0, 6);
    return `#${full.padEnd(6, "0").slice(0, 6)}`;
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error("lecture"));
      reader.readAsDataURL(file);
    });
  }

  function compressDataUrl(dataUrl, maxEdge, quality) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(2, Math.round(img.width * scale));
        canvas.height = Math.max(2, Math.round(img.height * scale));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  function boot() {
    try {
      if (typeof TextParser !== "function") throw new Error("TextParser manquant");
      if (!window.LivingEffects) throw new Error("Moteur d'effets manquant");
      if (typeof VisualEditor !== "function") throw new Error("Éditeur manquant");
      window.animationApp = new AnimationApp();
    } catch (err) {
      console.error(err);
      const box = document.getElementById("bootError");
      if (box) {
        box.className = "show";
        box.textContent = "Impossible de démarrer l'application : " + (err && err.message ? err.message : err);
      }
    }
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
