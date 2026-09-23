type KMITORACopilotOverviewProps = {
  status?: string;
  message?: string;
};

export default function KMITORACopilotOverview({
  status = "OVERVIEW",
  message = "Workflow guidance & automation status",
}: KMITORACopilotOverviewProps) {
  return (
    <div className="kmitoraCopilotOverview">
      <div className="kmitoraCopilotIcon" aria-hidden="true">
        ✦
      </div>

      <div className="kmitoraCopilotCopy">
        <strong>KMITORA Copilot</strong>
        <span>{message}</span>
      </div>

      <span className="kmitoraOverviewBadge">
        {status}
      </span>
    </div>
  );
}

