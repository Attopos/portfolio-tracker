function TransactionsPage() {
  return (
    <section className="page-panel">
      <header className="page-hero">
        <p className="page-eyebrow">Transactions</p>
        <h1>Transactions page placeholder.</h1>
        <p className="page-copy">
          Routing is now ready for individual pages to be migrated without touching the
          shared frame again.
        </p>
      </header>

      <article className="workspace-card workspace-card-wide">
        <h2>Shared migration benefit</h2>
        <p>
          Once auth, API helpers, and layout live in React, the transaction form becomes
          much easier to port in small pieces.
        </p>
      </article>
    </section>
  );
}

export default TransactionsPage;
