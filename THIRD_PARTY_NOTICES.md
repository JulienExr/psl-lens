# Third-party notices

- **MediaPipe Tasks Vision**, Google LLC / MediaPipe Authors — Apache-2.0.
  [Repository and license](https://github.com/google-ai-edge/mediapipe/blob/master/LICENSE).
  Runtime JavaScript/WASM distributed through `@mediapipe/tasks-vision`; the
  package version and integrity are locked in `package-lock.json`.
- **Face Landmarker float16 model, version 1** — distributed by Google AI Edge.
  [Official model documentation and model cards](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker#models).
  Source: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`.
  SHA-256: `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff`.
- **Canonical face model / mesh connectivity**, MediaPipe Authors — Apache-2.0,
  derived respectively from `mediapipe/modules/face_geometry/data/canonical_face_model.obj`
  and the exported SDK constants. Stored as JSON in `src/vision/`. Copyright
  MediaPipe Authors. The canonical geometry is used only for a labeled illustration.
- **React / React DOM**, Meta Platforms, Inc. and affiliates — MIT.
- **React Router**, Remix Software Inc. — MIT.
- **Lucide**, Lucide Contributors — ISC (and inherited Feather icons MIT).
- **Tailwind CSS**, Tailwind Labs Inc. — MIT.
- Vite, TypeScript, Vitest, Playwright, Testing Library, esbuild, ESLint and their
  dependencies retain their respective package licenses; see installed packages.

## Test photograph

`tests/fixtures/einstein.jpg` is a public historical photograph of **Albert
Einstein, 1947**, by **Orren Jack Turner**, from the Library of Congress,
digital ID **cph.3b46036**, via Wikimedia Commons. Copyright was not renewed;
the source identifies it as public domain in the United States and Canada.
No private person’s submitted photograph or consent-dependent dataset is used.
The photograph is used only for technical detection tests, never as a product
demo result or a rating of the pictured person.

- [Wikimedia source, provenance and jurisdiction details](https://commons.wikimedia.org/wiki/File:Albert_Einstein_Head.jpg)
- [Library of Congress record](https://www.loc.gov/pictures/item/2004671908/)

The unit and guided-scan fixtures are synthetic coordinates explicitly isolated
under `tests/`. No production source imports them. Icons and app design are
created for this project.

## V2 — PDF et photographie latérale

- `pdf-lib` 1.17.1 : licence MIT, https://github.com/Hopding/pdf-lib. Génération locale, polices PDF standard Helvetica/Helvetica Bold, sans téléchargement de police.
- `tests/fixtures/capone-profile.jpg` : Federal Bureau of Prisons, 1934, œuvre du gouvernement fédéral américain, domaine public aux États-Unis (US DOJ). Source vérifiée : https://commons.wikimedia.org/wiki/File:Al-Capone-Alcatraz-mug-shot-side.jpg ; original https://upload.wikimedia.org/wikipedia/commons/4/4b/Al-Capone-Alcatraz-mug-shot-side.jpg . Image historique utilisée uniquement pour les tests, jamais montrée comme résultat de l’utilisateur. Angle exact inconnu. Annotation manuelle illustrative dans `tests/fixtures/annotations/`, sans vérité anatomique expertisée.
