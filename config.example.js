// Copie ce fichier en config.local.js et colle ton identifiant TMDB.
// config.local.js est ignoré par git : il ne part jamais dans un commit.
// Un seul des deux champs suffit.
//   tmdbToken : jeton d'accès en lecture v4, une longue chaîne qui commence par "eyJ"
//   tmdbKey   : clé d'API v3, 32 caractères hexadécimaux
window.FRAME_CONFIG = { tmdbToken: "", tmdbKey: "" };
