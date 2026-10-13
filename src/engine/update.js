// Mises à jour automatiques de l'appli Android.
// À chaque lancement, l'appli regarde sur GitHub Pages s'il y a une nouvelle version du jeu ;
// si oui, elle la télécharge en silence et l'installe au prochain lancement (pas besoin de réinstaller l'APK).
export const SITE = 'https://lennoxvdb.github.io/guerre-des-gaz/';

const newer = (a, b) => {
  const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
};

export async function autoUpdate(onReady, canApplyNow) {
  const C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  const U = C.Plugins && C.Plugins.CapacitorUpdater;
  if (!U) return;
  // dit au système que cette version démarre bien (sinon il revient à l'ancienne)
  try { await U.notifyAppReady(); } catch (e) { /* rien */ }
  try {
    const mine = await fetch('version.json', { cache: 'no-store' }).then((r) => r.json());
    const latest = await fetch(SITE + 'version.json?' + Date.now(), { cache: 'no-store' }).then((r) => r.json());
    if (!newer(latest.version, mine.version)) return;
    const bundle = await U.download({ url: SITE + 'update.zip', version: latest.version });
    // sur l'écran titre : on installe tout de suite (l'appli redémarre) ; en pleine partie : au prochain lancement
    if (canApplyNow && canApplyNow()) { if (onReady) onReady(latest.version, true); await U.set({ id: bundle.id }); return; }
    await U.next({ id: bundle.id });
    if (onReady) onReady(latest.version, false);
  } catch (e) {
    console.warn('mise à jour impossible pour le moment', e);
  }
}
