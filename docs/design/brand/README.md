# What the Flick — WTF

Nom adopté par Matt le 20 septembre 2026. Signature : **On regarde quoi ?**

Monogramme WTF dessiné en SVG, lettres géométriques épaisses et signe lecture dans
l’espace sous le F. Le dessin reste identique entre les cinq thèmes ; l’accent
prend la couleur de l’ambiance. La signature complète accompagne le monogramme
dans l’en-tête, y compris sur téléphone.

- [Planche d’identité](identity.png) et [version HTML](identity.html).
- [Application, ordinateur](app-1440.png) et [téléphone](app-390.png).
- Sources : `prototypes/emoji-card/brand/wtf-mark.svg`, `favicon.svg`, `apple-touch-icon.png`.

Nom appliqué à l’en-tête, aux métadonnées de page, aux textes visibles concernés,
au nom du fichier exporté et aux métadonnées npm. Les clés `frame.*`,
`FRAME_CONFIG` et le marqueur de format JSON `application: FRAME` restent inchangés
pour conserver les données et la compatibilité des imports existants.

Validation : 239 tests réussis, build Netlify réussi ; Chrome à 320, 390, 768,
1024 et 1440 px sans débordement horizontal ni collision logo/profil. Trois assets
de marque servis correctement. Aucun pageerror pendant ce parcours.
