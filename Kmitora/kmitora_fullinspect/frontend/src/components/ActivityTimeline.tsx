import type { ActivityEvent } from "../types";

export default function ActivityTimeline({items}:{items:ActivityEvent[]}) {
  return <div className="panel">
    <div className="panelHeader">
      <div>
        <h3>Live Activity</h3>
        <p>Backend and agent activity, translated for users.</p>
      </div>
      <span className="livePill">LIVE</span>
    </div>
    <div className="timeline">
      {items.map((a,i)=>(
        <div className="timelineRow" key={i}>
          <span className={`dot ${a.severity||"info"}`}/>
          <span className="time">{a.time}</span>
          <div>
            <strong>{a.title}</strong>
            {a.detail && <p>{a.detail}</p>}
          </div>
        </div>
      ))}
    </div>
  </div>
}

