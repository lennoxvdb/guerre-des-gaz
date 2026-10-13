// Mises à jour automatiques de l'appli Android.
// À chaque lancement, l'appli regarde sur GitHub Pages s'il y a une nouvelle version du jeu ;
// si oui, elle la télécharge en silence et l'installe (tout de suite sur l'écran titre, sinon au prochain lancement).
export const SITE = 'https://lennoxvdb.github.io/guerre-des-gaz/';

const updater = () => {
  const C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return null;
  return (C.Plugins && C.Plugins.CapacitorUpdater) || null;
};

// À appeler TOUT DE SUITE au démarrage : « cette version démarre bien ».
// Sans ce signal dans les 10 secondes, l'outil de mise à jour croit que la nouvelle version est cassée
// et revient à l'ancienne (c'est ce qui empêchait la mise à jour 1.0.8 → 1.0.9).
export function appReady() {
  const U = updater();
  if (U) U.notifyAppReady().catch(() => { /* rien */ });
}

const newer = (a, b) => {
  const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
};

// say(texte, secondes) : petit message à l'écran ; canApplyNow() : vrai si on peut redémarrer le jeu maintenant
export async function autoUpdate(say, canApplyNow) {
  const U = updater();
  if (!U) return;
  let step = 'vérification';
  try {
    const mine = await fetch('version.json', { cache: 'no-store' }).then((r) => r.json());
    const latest = await fetch(SITE + 'version.json?' + Date.now(), { cache: 'no-store' }).then((r) => r.json());
    if (!newer(latest.version, mine.version)) return;
    step = 'téléchargement';
    say(`Nouvelle version ${latest.version} : téléchargement…`, 30);
    const bundle = await U.download({ url: SITE + 'update.zip', version: latest.version });
    step = 'installation';
    if (canApplyNow && canApplyNow()) {
      say(`Mise à jour ${latest.version} : le jeu redémarre…`, 10);
      await new Promise((r) => setTimeout(r, 1200));
      await U.set({ id: bundle.id });
      return;
    }
    await U.next({ id: bundle.id });
    say(`Nouvelle version ${latest.version} téléchargée ! Elle sera là au prochain lancement du jeu.`, 6);
  } catch (e) {
    console.warn('mise à jour impossible pour le moment', e);
    say(`Mise à jour impossible (${step}) : ${(e && e.message) || e}`, 8);
  }
}
