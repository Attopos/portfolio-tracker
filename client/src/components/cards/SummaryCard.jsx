function SummaryCard({
  label,
  icon: Icon,
  tone = "accent",
  footer,
  footerClassName = "",
  children,
}) {
  const cardClassName = `workspace-card summary-card summary-card-${tone}${Icon ? " summary-card-with-icon" : ""}`;
  const footerClassNames = ["summary-card-footer", footerClassName].filter(Boolean).join(" ");

  return (
    <article className={cardClassName}>
      <div className="summary-card-head">
        {Icon ? (
          <span className="summary-card-icon" aria-hidden="true">
            <Icon />
          </span>
        ) : null}
        <p className="summary-label">{label}</p>
      </div>
      <div className="summary-card-body">{children}</div>
      {footer ? <p className={footerClassNames}>{footer}</p> : null}
    </article>
  );
}

export default SummaryCard;
