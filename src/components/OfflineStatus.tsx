import { useEffect, useRef, useState } from 'react';
import { getOfflineAssetStatus, type OfflineAssetStatus } from '../vision/runtime-assets';

export function OfflineStatus() {
  const [status, setStatus] = useState<OfflineAssetStatus | null>(null);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [controllerChanged, setControllerChanged] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const reloadRequested = useRef(false);
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let active = true;
    let hadController = Boolean(navigator.serviceWorker.controller);
    let registration: ServiceWorkerRegistration | undefined;
    const installing = new Set<ServiceWorker>();
    const read = () => {
      void getOfflineAssetStatus()
        .then((result) => {
          if (active) setStatus(result);
        })
        .catch(() => {
          if (active) setStatus(null);
        });
      void navigator.serviceWorker
        .getRegistration()
        .then((result) => {
          if (!active) return;
          setWaiting(result?.waiting ?? null);
          if (result && result !== registration) {
            registration?.removeEventListener('updatefound', updateFound);
            registration = result;
            registration.addEventListener('updatefound', updateFound);
            updateFound();
          }
        })
        .catch(() => {
          /* Installation status can be retried on the next poll. */
        });
    };
    const updateFound = () => {
      const worker = registration?.installing;
      if (worker && !installing.has(worker)) {
        installing.add(worker);
        worker.addEventListener('statechange', read);
      }
    };
    const controllerChange = () => {
      if (reloadRequested.current) {
        window.location.reload();
        return;
      }
      // Another tab may opt into activation. Keep this tab's in-memory session
      // until its user explicitly agrees to reload as well.
      if (hadController) setControllerChanged(true);
      hadController = true;
      read();
    };
    read();
    const timer = setInterval(read, 3000);
    navigator.serviceWorker.addEventListener('controllerchange', controllerChange);
    return () => {
      active = false;
      clearInterval(timer);
      registration?.removeEventListener('updatefound', updateFound);
      for (const worker of installing) worker.removeEventListener('statechange', read);
      navigator.serviceWorker.removeEventListener('controllerchange', controllerChange);
    };
  }, []);

  async function activateUpdate() {
    reloadRequested.current = true;
    setUpdating(true);
    setUpdateError(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration?.waiting) registration.waiting.postMessage({ type: 'PSL_ACTIVATE_UPDATE' });
      else window.location.reload();
    } catch {
      reloadRequested.current = false;
      setUpdating(false);
      setUpdateError('La mise à jour a échoué. Réessayez ou fermez les autres onglets du site.');
    }
  }

  if (!status && !waiting && !controllerChanged) return null;
  return (
    <div className="offline-status" role="status">
      {status && (
        <p>
          {status.ready
            ? 'Analyse hors connexion prête · fichiers du moteur en cache'
            : 'Interface hors connexion prête · fichiers du moteur incomplets'}
        </p>
      )}
      {(waiting || controllerChanged) && (
        <div>
          <p>
            {waiting
              ? 'Une nouvelle version est prête. Si le moteur ne charge plus, mettez à jour pour réessayer.'
              : 'La version a changé dans un autre onglet. Rechargez avant de relancer une analyse.'}
          </p>
          <p>
            Recharger efface la photo, les résultats et la session de cet onglet, puis arrête la
            caméra. Les autres onglets ouverts peuvent aussi nécessiter un rechargement.
          </p>
          <button type="button" disabled={updating} onClick={() => void activateUpdate()}>
            {updating
              ? 'Mise à jour…'
              : waiting
                ? 'Mettre à jour et effacer la session'
                : 'Recharger et effacer la session'}
          </button>
          {updateError && <p>{updateError}</p>}
        </div>
      )}
    </div>
  );
}
