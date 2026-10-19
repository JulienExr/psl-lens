import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Ruler, FlaskConical } from 'lucide-react';
import { DISCLAIMER } from '../scoring';
export function About() {
  return (
    <article className="page-width workspace about-page">
      <span className="eyebrow">MÉTHODE & CONFIDENTIALITÉ</span>
      <h1>Comprendre ce que l’on voit.</h1>
      <p className="lead">
        Un outil d’exploration, construit autour de mesures transparentes et de limites explicites.
        Destiné aux adultes.
      </p>
      <section>
        <Ruler />
        <h2>Une géométrie apparente</h2>
        <p>
          MediaPipe Face Landmarker prédit jusqu’à 478 repères. PSL Lens les convertit en
          coordonnées de l’image, corrige l’inclinaison dans le plan et calcule 15 ratios et angles.
          La rotation hors du plan n’est pas corrigée en 3D : seules les vues suffisamment frontales
          alimentent les mesures.
        </p>
        <p>
          Les indicateurs de qualité vérifient le cadrage, la taille du visage, la pose, le
          mouvement, la lumière, la netteté et certains signes d’expression. Les occlusions ne sont
          pas toutes détectables. Un maillage visible ne garantit pas une mesure exacte.
        </p>
        <p>
          Le scan collecte 16 observations frontales et 8 pour chaque rotation légère. Une pose
          incorrecte interrompt la série en cours. L’agrégation utilise une médiane et rejette les
          valeurs aberrantes avec un seuil fondé sur la MAD. Les rotations servent au contrôle de
          pose, pas à une reconstruction 3D.
        </p>
      </section>
      <section>
        <FlaskConical />
        <h2>Une heuristique assumée</h2>
        <p>
          Le PSL est une grille esthétique subjective. Les cibles numériques du moteur sont des
          choix de produit, pas des normes humaines ni des coefficients validés. Chaque contribution
          est une fonction déterministe de mesures réelles. Aucun percentile ou classement de
          population n’est produit.
        </p>
        <p>
          La V1 ne valide pas la projection du profil. Avec les poids 25/20/20/20/15 %, cette
          composante manquante empêche le calcul d’un total global. Les sous-scores restent
          inspectables et masquables.
        </p>
        <p className="score-disclaimer">{DISCLAIMER}</p>
      </section>
      <section>
        <ShieldCheck />
        <h2>Local par conception</h2>
        <p>
          Le modèle, les fichiers WASM et l’application sont téléchargés depuis ce site. Les images,
          vidéos et repères sont traités dans votre navigateur. Aucun service d’analytics, aucune
          base de données et aucun service de reconnaissance d’identité ne sont intégrés.
        </p>
        <p>
          Les données faciales restent en mémoire. « Effacer la session » libère les résultats et le
          moteur; un rechargement les supprime également. Une exportation JSON, déclenchée par vous,
          contient uniquement les mesures, sans photo ni landmarks. La caméra s’arrête lorsque vous
          quittez le studio, masquez la page ou fermez l’onglet. Le microphone n’est jamais demandé.
        </p>
        <p>
          La PWA met en cache uniquement des fichiers statiques, le modèle et le WASM. Le
          fonctionnement hors connexion dépend de la fin du cache et du navigateur; il n’est pas
          garanti à la première visite.
        </p>
      </section>
      <section>
        <h2>Sources techniques</h2>
        <ul className="source-links">
          <li>
            <a
              href="https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js"
              target="_blank"
              rel="noreferrer"
            >
              Google AI Edge — Face Landmarker pour le Web
            </a>
          </li>
          <li>
            <a
              href="https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/modules/face_geometry/data/canonical_face_model.obj"
              target="_blank"
              rel="noreferrer"
            >
              MediaPipe — modèle canonique et convention des indices
            </a>
          </li>
          <li>
            <a
              href="https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/python/solutions/face_mesh_connections.py"
              target="_blank"
              rel="noreferrer"
            >
              MediaPipe — connexions des régions faciales
            </a>
          </li>
        </ul>
        <p>
          Les formules, seuils, licences et procédures de test sont détaillés dans la documentation
          du dépôt.
        </p>
      </section>
      <Link className="button primary" to="/scan">
        Explorer mon visage
        <ArrowRight size={17} />
      </Link>
    </article>
  );
}
