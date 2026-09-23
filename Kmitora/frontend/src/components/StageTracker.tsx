import type { LifecycleStage } from "../types";

export default function StageTracker({stages,onOpen}:{stages:LifecycleStage[];onOpen:(key:string)=>void}) {
  return <div className="stageTracker">
    {stages.map((s,i)=>(
      <button className={`stage ${s.status}`} key={s.key} onClick={()=>onOpen(s.key)}>
        <div className="stageTop">
          <span className="stageIndex">{String(i+1).padStart(2,"0")}</span>
          <span className="stageLabel">{s.label}</span>
          <span className="stagePercent">{s.progress}%</span>
        </div>
        <div className="miniBar"><span style={{width:`${s.progress}%`}}/></div>
        <div className="stageSummary">{s.summary}</div>
      </button>
    ))}
  </div>
}

