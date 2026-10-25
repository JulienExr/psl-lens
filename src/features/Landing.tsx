import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  ArrowRight,
  ScanFace,
  Camera,
  ImagePlus,
  ShieldCheck,
  Focus,
  Move3d,
  Fingerprint,
} from 'lucide-react';
import { Mesh } from '../components/Mesh';

export function Landing() {
  return (
    <>
      <section className="hero page-width">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="status-dot" />
            LIVE FACIAL ANALYSIS <span className="version">V2 · EXPERIMENTAL</span>
          </div>
          <h1>
            Votre visage.
            <br />
            Sous un autre
            <br />
            <em>angle.</em>
          </h1>
          <p className="hero-description">
            Explorez les lignes, les proportions et les détails qui vous rendent unique. Une analyse
            en direct, un regard plus éclairé.
          </p>
          <div className="hero-actions">
            <Link className="button primary" to="/live">
              <ScanFace size={19} />
              Start Live Scan
              <ArrowUpRight size={18} />
            </Link>
            <Link className="button secondary" to="/photo">
              <ImagePlus size={18} />
              Analyze a Photo
            </Link>
          </div>
          <div className="profile-tools">
            <Link className="text-link" to="/scan">
              Quick Scan
            </Link>
            <Link className="text-link" to="/advanced">
              Advanced Scan
            </Link>
            <Link className="text-link" to="/profile">
              Analyser un profil
            </Link>
          </div>
          <div className="hero-privacy">
            <ShieldCheck size={15} />
            <span>Sans compte. Sans envoi de photo. Simplement vous.</span>
          </div>
        </div>
        <div className="hero-visual">
          <div className="visual-top mono">
            <span>
              <span className="status-dot" /> FACE MESH EXPLORER
            </span>
            <span>01 / 03</span>
          </div>
          <div className="face-art">
            <div className="art-orbit orbit-one" />
            <div className="art-orbit orbit-two" />
            <div className="art-axis" />
            <Mesh illustration />
            <span className="art-bracket bracket-tl" />
            <span className="art-bracket bracket-tr" />
            <span className="art-bracket bracket-bl" />
            <span className="art-bracket bracket-br" />
            <div className="face-callout callout-eye">
              <span className="callout-line" />
              <span className="mono">EYE REGION</span>
              <small>Repères & proportions</small>
            </div>
            <div className="face-callout callout-jaw">
              <span className="callout-line" />
              <span className="mono">FACIAL CONTOUR</span>
              <small>Géométrie apparente</small>
            </div>
          </div>
          <div className="visual-bottom">
            <span className="mono">MODÈLE CANONIQUE · ILLUSTRATION</span>
            <span className="tiny-cross">+</span>
          </div>
          <div className="visual-caption">
            <Focus size={15} />
            <span>478 repères. Une nouvelle perspective.</span>
            <span className="live-pill">MEDIAPIPE</span>
          </div>
        </div>
      </section>
      <section className="capabilities page-width" aria-label="Caractéristiques">
        <div>
          <span className="metric-number">
            478<span>pts</span>
          </span>
          <span>Repères faciaux suivis</span>
        </div>
        <div>
          <span className="metric-number">
            15<span>mesures</span>
          </span>
          <span>Proportions descriptives</span>
        </div>
        <div>
          <span className="metric-number">
            100<span>% local*</span>
          </span>
          <span>Traitement de vos images</span>
        </div>
        <p>
          *Les fichiers de l’application et le modèle sont téléchargés depuis ce site. Vos captures
          ne sont pas envoyées.
        </p>
      </section>
      <section className="section page-width" id="method">
        <div className="section-heading">
          <div>
            <span className="eyebrow">LE VISAGE, SOUS LA SURFACE</span>
            <h2>De la capture à la compréhension.</h2>
          </div>
          <p>
            De vrais repères. Des calculs transparents.
            <br />
            Des limites clairement expliquées.
          </p>
        </div>
        <div className="feature-grid">
          <Link to="/live" className="feature-card">
            <span className="feature-index mono">01 / OBSERVER</span>
            <Camera />
            <h3>Le mouvement révèle.</h3>
            <p>
              Activez la caméra et observez le maillage suivre votre visage. Explorez chaque région
              à votre rythme.
            </p>
            <span className="text-link">
              Ouvrir le studio Live <ArrowUpRight size={16} />
            </span>
          </Link>
          <Link to="/scan" className="feature-card">
            <span className="feature-index mono">02 / EXPLORER</span>
            <Move3d />
            <h3>Un angle ne dit pas tout.</h3>
            <p>
              Laissez-vous guider à travers trois orientations. Seules les observations stables et
              exploitables sont retenues.
            </p>
            <span className="text-link">
              Commencer le scan guidé <ArrowUpRight size={16} />
            </span>
          </Link>
          <Link to="/photo" className="feature-card">
            <span className="feature-index mono">03 / COMPRENDRE</span>
            <Fingerprint />
            <h3>Des détails, du contexte.</h3>
            <p>
              Découvrez vos proportions apparentes et leurs incertitudes dans un rapport interactif
              et explicable.
            </p>
            <span className="text-link">
              Analyser une photo <ArrowUpRight size={16} />
            </span>
          </Link>
        </div>
      </section>
      <section className="privacy-banner page-width">
        <div className="privacy-symbol">
          <ShieldCheck size={36} />
        </div>
        <div>
          <span className="eyebrow">VOTRE VISAGE VOUS APPARTIENT</span>
          <h2>
            L’analyse reste entre vous
            <br />
            et votre navigateur.
          </h2>
          <p>
            Pas de compte, pas de base de visages, pas de vidéo enregistrée.
            <br />
            Effacez la session à tout moment.
          </p>
        </div>
        <Link to="/about" className="round-link" aria-label="Lire la méthode et la confidentialité">
          <ArrowUpRight />
        </Link>
      </section>
      <section className="section faq-section page-width">
        <div>
          <span className="eyebrow">UN REGARD ÉCLAIRÉ</span>
          <h2>
            La précision commence
            <br />
            par l’honnêteté.
          </h2>
          <p>
            PSL Lens est un outil d’exploration morphologique pour adultes. Une mesure ne définit ni
            votre beauté, ni votre valeur.
          </p>
          <Link to="/about" className="text-link">
            Comprendre la méthode <ArrowRight size={16} />
          </Link>
        </div>
        <div className="faq-list">
          <details>
            <summary>Que mesure réellement PSL Lens ?</summary>
            <p>
              Des distances relatives et des angles apparents, calculés à partir de repères prédits
              dans une image 2D. Pas de dimensions osseuses ou de mesures physiques.
            </p>
          </details>
          <details>
            <summary>Le score PSL est-il scientifique ?</summary>
            <p>
              Non. Le PSL frontal expérimental repose sur des cibles subjectives et peut être
              masqué. Sa note reste indicative; les problèmes de capture sont signalés. Le PSL
              complet reste indisponible tant que le profil n’est pas validé.
            </p>
          </details>
          <details>
            <summary>Mes photos sont-elles conservées ?</summary>
            <p>
              Les photos et repères restent en mémoire pendant la session. Ils disparaissent après
              effacement ou rechargement. Aucun upload d’image n’est réalisé.
            </p>
          </details>
          <details>
            <summary>De quoi ai-je besoin pour commencer ?</summary>
            <p>
              Un navigateur récent, une lumière douce et une photo frontale ou une caméra. L’accès
              caméra nécessite HTTPS ou localhost et votre action explicite.
            </p>
          </details>
        </div>
      </section>
    </>
  );
}
