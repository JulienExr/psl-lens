import { Component, type ReactNode } from 'react';
export class ModuleBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <section className="panel" role="alert">
        <h2>Module indisponible</h2>
        <p>
          Ce module se charge au premier usage. Rétablissez la connexion puis rechargez la page pour
          réessayer. La capture frontale reste accessible.
        </p>
        <button className="button secondary" onClick={() => window.location.reload()}>
          Recharger
        </button>
      </section>
    ) : (
      this.props.children
    );
  }
}
