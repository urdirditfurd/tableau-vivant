# Tableau vivant

Animez une image à partir d'une description textuelle. 100 % navigateur.

## Utilisation immédiate

### Sur votre PC

Double-cliquez `index.html` (fichier autonome : CSS + JS inclus).

### Depuis GitHub

Le dépôt : https://github.com/urdirditfurd/tableau-vivant

1. Ouvrez le fichier **index.html**
2. Cliquez **Download raw file** (icône télécharger)
3. Double-cliquez le fichier téléchargé

> Ouvrir le HTML dans l’onglet Code de GitHub n’exécute **pas** l’app : GitHub montre seulement le code source. Il faut télécharger le fichier ou activer Pages.

### GitHub Pages (site en ligne)

1. https://github.com/urdirditfurd/tableau-vivant/settings/pages
2. Source : **Deploy from a branch**
3. Branch : **main** / dossier **/ (root)** → Save
4. Après 1 minute : https://urdirditfurd.github.io/tableau-vivant/

## Workflow

1. Déposez une image
2. Décrivez la scène (`lanternes, bougie, lac, arbre`…)
3. **Analyser et créer l'animation**
4. Ajustez les zones, exportez le HTML animé

## Développement

Sources séparées : `index.source.html`, `styles.css`, `app.js`, `editor.js`, `effects.js`, `text_parser.js`.

```powershell
npm run build
```

régénère `index.html` autonome.
