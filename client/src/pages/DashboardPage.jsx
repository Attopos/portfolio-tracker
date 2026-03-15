function DashboardPage() {
  return (
    <section className="page-panel">
      <header className="page-hero">
        <p className="page-eyebrow">Dashboard</p>
        <h1>React shell is in place.</h1>
        <p className="page-copy">
          The top navigation now lives inside React, so shared layout and active-page
          state can grow from one place.
        </p>
      </header>

      <div className="content-grid">
        <article className="workspace-card">
          <h2>Foundation</h2>
          <p>
            We now have routing, a layout component, and reusable navigation ready for
            page-by-page migration.
          </p>
        </article>

        <article className="workspace-card">
          <h2>Next up</h2>
          <p>
            The holdings view is the best first migration target because it already has
            strong component boundaries.
          </p>
        </article>
      </div>
    </section>
  );
}

export default DashboardPage;
