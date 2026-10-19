# Tableau vivant

Application web pour animer une image fixe à partir d'une description en français (ou en anglais). Tout se passe dans le navigateur : aucun serveur, aucune bibliothèque. Le résultat est un fichier HTML autonome.

## 1. Description

L'utilisateur dépose une image, écrit ce qu'il veut voir bouger (« un feu de cheminée, des bougies, de la brume »), puis ajuste les zones à la souris. L'export embarque l'image, le style et le moteur d'animation.

| Fichier | Rôle |
| --- | --- |
| `index.html` | Application en trois étapes |
| `styles.css` | Apparence |
| `app.js` | Navigation, sauvegarde, export |
| `text_parser.js` | Lecture de la description |
| `effects.js` | Feu, bougies, fumée, lune, étoiles, eau, arbres, poussière, lumière ambiante |
| `editor.js` | Déplacement et redimensionnement |

Le dossier peut aussi contenir d'anciens outils (`generate_animation.py`, `output/`). L'application à ouvrir est `index.html`.

## 2. Installation

Aucune installation.

1. Téléchargez ou clonez ce dossier.
2. Ouvrez **`index.html`** dans Chrome, Edge ou Firefox (double-clic).

`index.html` est **autonome** (CSS et JS inclus). Les fichiers `styles.css`, `app.js`, etc. servent à modifier le code ; après un changement, régénérez la page :

```powershell
npm run build
```

Ou double-cliquez `ouvrir.bat` pour un serveur local.

## 3. Utilisation

1. **Image et texte** — déposez le fond. Écrivez la scène, ou cliquez un exemple. « Analyser et créer l'animation ».
2. **Éditeur** — la photo est déjà en mouvement. Glissez une zone pour la déplacer, tirez un coin pour la taille. La colonne de droite règle la couleur, l'intensité, la vitesse. Les boutons sous la liste ajoutent un effet à la main. ↑ et ↓ changent l'ordre de dessin.
3. **Export** — la prévisualisation est le fichier final. « Télécharger le HTML animé » enregistre `animation.html`. « Copier le code » met la même page dans le presse-papiers. « Recommencer » efface le projet.

Précédent / Suivant suivent les trois étapes. Le travail est enregistré dans le navigateur (`localStorage`) au fil de l'eau.

## 4. Format des descriptions

Phrases libres. Le programme cherche des mots, pas une syntaxe spéciale.

Exemples :

- `Cabane lofi avec feu de cheminée, bougies, vapeur de tasse` → feu, trois bougies, vapeur
- `Paysage nocturne avec étoiles scintillantes et lune` → ciel étoilé et halo de lune
- `Forêt avec arbres qui bougent et brume` → feuillage au vent et brume
- `Lac à droite et étoiles en haut` → eau calée à droite, étoiles dans le haut de l'image

Pluriel reconnu pour les bougies : « bougies », « trois bougies », « deux chandelles » (jusqu'à six).

Mots de place, à proximité de l'objet : `gauche`, `droite`, `centre`, `haut`, `bas` (et `left`, `right`, `center`, `top`, `bottom`).

## 5. Types d'effets

| Type | Motif | Idée |
| --- | --- | --- |
| Feu | feu, flamme, cheminée, fireplace | particules chaudes, fusion « écran » |
| Bougie | bougie, chandelle, candle | halo qui scintille |
| Fumée | fumée, vapeur, brume, fog | volutes qui se dissipent |
| Fenêtre / lune | fenêtre, lune, moon | rectangle lumineux et reflet |
| Étoiles | étoile, star, ciel étoilé | points qui clignotent |
| Eau | eau, lac, rivière, mer | ondulation de la photo |
| Arbres | arbre, forêt, feuillage | balancement du feuillage |
| Poussière | poussière, particules | grains lents |
| Lumière ambiante | réglage global | voile coloré qui respire |

Les positions sont des fractions de l'image (0 à 1). L'animation boucle sans coupure.

## 6. Déploiement sur GitHub Pages

1. Le dépôt doit contenir `index.html` à la racine (ou dans `/docs` si vous choisissez ce mode).
2. Poussez la branche voulue.
3. Dans le dépôt GitHub : **Settings → Pages → Deploy from a branch**.
4. Choisissez la branche et le dossier racine (`/`) ou `/docs`.
5. Après une minute, le site est servi à `https://<utilisateur>.github.io/<dépôt>/`.

Aucun build. Les fichiers `.js` et `.css` doivent rester à côté de `index.html`.

L'animation téléchargée par un visiteur est un seul fichier HTML : elle n'a pas besoin de ce dépôt pour s'ouvrir.

## 7. Dépannage

- **« Aucun élément reconnu »** — la phrase ne contient pas un mot du tableau ci-dessus. « Feuillage » ne crée pas un feu.
- **L'image disparaît au rechargement** — elle dépassait la mémoire locale du navigateur. Rechargez-la ; le placement des effets, lui, est conservé quand c'est possible. Les très grandes photos sont réduites vers 1600 px.
- **L'export est lourd** — l'image est incluse en base64. C'est normal pour un fichier autonome.
- **La prévisualisation reste noire** — vérifiez que l'image s'est bien chargée à l'étape 1, puis revenez à l'étape 3.
- **Ancienne page `editor.html`** — elle renvoie vers `index.html`. Les scènes déjà générées dans `output/` continuent d'utiliser leur copie locale du moteur.

## 8. Contribution

1. Dupliquez le dossier ou une branche.
2. Modifiez un effet dans `effects.js` (le même fichier est recopié dans l'export).
3. Ajoutez un mot dans `text_parser.js` et le bouton correspondant dans `index.html` si le type est nouveau.
4. Ouvrez `index.html`, jouez les trois exemples, exportez, et ouvrez `animation.html` hors du dossier pour vérifier qu'il est autonome.

Pas de dépendance à ajouter : la page doit rester ouvrable par un double-clic.
