type StateMessageProps = {
  title: string;
  detail?: string;
  tone?: "neutral" | "error" | "warning";
};

export function StateMessage({ title, detail, tone = "neutral" }: StateMessageProps) {
  return (
    <div className={`state-message state-message--${tone}`} role={tone === "error" ? "alert" : "status"}>
      <strong>{title}</strong>
      {detail ? <span>{detail}</span> : null}
    </div>
  );
}
