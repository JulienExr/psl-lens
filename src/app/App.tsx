import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Scan, Trash2, Menu, X } from 'lucide-react';
import type { AggregatedAnalysis } from '../types';
import { Landing } from '../features/Landing';
import { Live } from '../features/Live';
import { Photo } from '../features/Photo';
import { Report } from '../features/Report';
import { About } from '../features/About';
import { visionClient } from '../vision/client';
import { DISCLAIMER } from '../scoring';
import type { ProfileAnalysis, ViewAssociation } from '../types/v2';
import { confirmViewAssociation } from '../vision/view-association';
import type { ProfilePhoto } from '../features/Profile';
import { ModuleBoundary } from '../components/ModuleBoundary';
const Profile = lazy(() => import('../features/Profile'));
import { OfflineStatus } from '../components/OfflineStatus';

export function App() {
  const [analysis, setAnalysis] = useState<AggregatedAnalysis | null>(null);
  const [profiles, setProfiles] = useState<ProfileAnalysis[]>([]);
  const [association, setAssociation] = useState<ViewAssociation | null>(null);
  const [pendingProfile, setPendingProfile] = useState<ProfilePhoto>();
  const [session, setSession] = useState(0);
  const [notice, setNotice] = useState('');
  const [menu, setMenu] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const receiveReport = useCallback(
    (report: AggregatedAnalysis) => {
      setAssociation(null);
      setAnalysis(report);
      navigate('/report');
      window.scrollTo?.(0, 0);
    },
    [navigate],
  );
  const openProfile = (photo: ProfilePhoto | undefined, frontal?: AggregatedAnalysis) => {
    setAssociation(null);
    setAnalysis(frontal ?? null);
    setProfiles([]);
    setPendingProfile(photo);
    navigate('/profile');
  };
  const receiveProfile = (profile: ProfileAnalysis) => {
    setAssociation(null);
    setProfiles((previous) => [...previous.filter((p) => p.side !== profile.side), profile]);
    setPendingProfile(undefined);
    navigate('/report');
    window.scrollTo?.(0, 0);
  };
  const removeView = (id: string) => {
    setAssociation(null);
    if (analysis?.id === id) setAnalysis(null);
    else setProfiles((previous) => previous.filter((profile) => profile.id !== id));
  };
  const clear = () => {
    visionClient.dispose();
    setAssociation(null);
    setAnalysis(null);
    setProfiles([]);
    setPendingProfile(undefined);
    setSession((v) => v + 1);
    setNotice('Session effacée.');
  };
  useEffect(() => {
    const close = () => visionClient.dispose();
    window.addEventListener('pagehide', close);
    return () => {
      close();
      window.removeEventListener('pagehide', close);
    };
  }, []);
  useEffect(() => {
    document.title = `PSL Lens — ${location.pathname === '/' ? 'See your face differently.' : location.pathname === '/live' ? 'Studio Live' : location.pathname === '/photo' ? 'Analyse photo' : location.pathname === '/scan' ? 'Scan guidé' : location.pathname === '/report' ? 'Votre rapport' : location.pathname === '/profile' ? 'Profil assisté' : location.pathname === '/advanced' ? 'Advanced Scan' : 'La méthode'}`;
  }, [location.pathname]);
  return (
    <>
      <a href="#main" className="skip-link">
        Aller au contenu
      </a>
      <header className="site-header">
        <div className="header-inner page-width">
          <Link to="/" className="brand" aria-label="PSL Lens — accueil">
            <span className="brand-icon">
              <Scan size={26} strokeWidth={1.5} />
              <span />
            </span>
            <span>
              psl<span className="brand-light">lens</span>
              <span className="brand-period">.</span>
            </span>
          </Link>
          <nav className={menu ? 'main-nav open' : 'main-nav'} aria-label="Navigation principale">
            <NavLink to="/live" onClick={() => setMenu(false)}>
              Studio Live
              <span className="nav-dot" />
            </NavLink>
            <NavLink to="/photo" onClick={() => setMenu(false)}>
              Analyse photo
            </NavLink>
            <NavLink
              to="/profile"
              onClick={() => {
                setMenu(false);
                setPendingProfile(undefined);
              }}
            >
              Profil
            </NavLink>
            <NavLink to="/report" onClick={() => setMenu(false)}>
              Mon rapport
            </NavLink>
            <NavLink to="/about" onClick={() => setMenu(false)}>
              La méthode
            </NavLink>
          </nav>
          <div className="header-actions">
            <button
              className="icon-button clear-button"
              aria-label="Effacer la session"
              onClick={clear}
              title="Effacer la session"
            >
              <Trash2 size={17} />
            </button>
            <Link className="button secondary compact header-cta" to="/scan">
              Commencer
              <ArrowUpRight size={16} />
            </Link>
            <button
              className="icon-button menu-toggle"
              aria-label={menu ? 'Fermer le menu' : 'Ouvrir le menu'}
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
      {notice && (
        <div className="session-notice" role="status">
          {notice}
          <button aria-label="Fermer la notification" onClick={() => setNotice('')}>
            <X size={14} />
          </button>
        </div>
      )}
      <OfflineStatus />
      <main id="main" key={session}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/live" element={<Live key="live" onReport={receiveReport} />} />
          <Route path="/scan" element={<Live key="guided" guided onReport={receiveReport} />} />
          <Route
            path="/advanced"
            element={
              <Live
                key="advanced"
                guided
                advanced
                onReport={receiveReport}
                onProfile={openProfile}
              />
            }
          />
          <Route
            path="/profile"
            element={
              <ModuleBoundary>
                <Suspense fallback={<p role="status">Chargement de l’éditeur de profil…</p>}>
                  <Profile initial={pendingProfile} onComplete={receiveProfile} />
                </Suspense>
              </ModuleBoundary>
            }
          />
          <Route
            path="/photo"
            element={<Photo onReport={receiveReport} onProfile={openProfile} />}
          />
          <Route
            path="/report"
            element={
              <Report
                analysis={analysis}
                profiles={profiles}
                association={association}
                onAssociationChange={(confirmed) =>
                  setAssociation(confirmed ? confirmViewAssociation(analysis, profiles) : null)
                }
                onRemoveView={removeView}
              />
            }
          />
          <Route path="/about" element={<About />} />
          <Route
            path="*"
            element={
              <div className="empty-report">
                <h1>Ce chemin reste à explorer.</h1>
                <Link to="/" className="button primary">
                  Retour à l’accueil
                </Link>
              </div>
            }
          />
        </Routes>
      </main>
      <footer className="site-footer page-width">
        <div>
          <Link to="/" className="footer-brand">
            psllens<span>.</span>
          </Link>
          <p>See your face differently.</p>
        </div>
        <div className="footer-right">
          <span className="mono">BUILT FOR CURIOSITY. DESIGNED FOR PRIVACY.</span>
          <p>{DISCLAIMER}</p>
          <span className="small muted">
            Pour adultes · V2 · Mesures apparentes, sans diagnostic.
          </span>
        </div>
      </footer>
    </>
  );
}
