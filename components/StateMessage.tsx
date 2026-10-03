type StateMessageProps = {
  title: string;
  detail?: string;
  tone?: "neutral" | "error" | "warning";
};

export function StateMessage({ title, detail, tone = "neutral" }: StateMessageProps) {
  return (
    <div
      className={`state-message state-message--${tone}`}
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
    >
      <span className="state-message__marker" aria-hidden="true" />
      <div className="state-message__copy">
        <strong>{title}</strong>
        {detail ? <span>{detail}</span> : null}
      </div>
    </div>
  );
}
