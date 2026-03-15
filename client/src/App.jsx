function App() {
  return (
    <div className="app-shell">
      <header className="hero">
        <p className="eyebrow">React migration starter</p>
        <h1>Portfolio Tracker client</h1>
        <p className="hero-copy">
          This React app is the new frontend shell. We can now migrate shared layout,
          holdings, transactions, and dashboard views page by page.
        </p>
      </header>

      <main className="grid">
        <section className="card">
          <h2>Why this exists</h2>
          <p>
            The current site is growing past a single-script setup. This client gives us
            a clean place for components, routing, state, and API modules.
          </p>
        </section>

        <section className="card">
          <h2>Next migration targets</h2>
          <ul>
            <li>Extract shared top navigation and auth state.</li>
            <li>Move the holdings page into reusable React components.</li>
            <li>Wrap existing backend APIs in a small frontend data layer.</li>
          </ul>
        </section>

        <section className="card card-accent">
          <h2>API wiring</h2>
          <p>
            Vite is configured to proxy <code>/api</code> and <code>/auth</code> requests
            to the existing Express server on port <code>3000</code>.
          </p>
        </section>
      </main>
    </div>
  );
}

export default App;
