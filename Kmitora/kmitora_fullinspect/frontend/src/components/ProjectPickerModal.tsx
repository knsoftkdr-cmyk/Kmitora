import { X } from "lucide-react";
type ProjectItem = { projectId:string; projectName:string; updatedAt?:string; sourceCount?:number; targetCount?:number; currentStage?:string; };
type Props = { open:boolean; loading?:boolean; projects:ProjectItem[]; onClose:()=>void; onOpenProject:(projectId:string)=>void; };
export default function ProjectPickerModal(props:Props){ if(!props.open) return null; return <div className="km-r4-backdrop"><div className="km-r4-modal" role="dialog" aria-modal="true">
  <div className="km-r4-modal-head"><div><span className="eyebrow">PROJECT REPOSITORY</span><h2>Continue Migration Project</h2><p>Open a saved project and continue from the last persisted configuration.</p></div><button type="button" onClick={props.onClose}><X size={17}/> Close</button></div>
  {props.loading ? <p>Loading projects...</p> : <div className="km-r4-project-list">{props.projects.length===0&&<p>No saved projects found.</p>}{props.projects.map(p=><button type="button" className="km-r4-project-card" key={p.projectId} onClick={()=>props.onOpenProject(p.projectId)}><strong>{p.projectName}</strong><span>{p.sourceCount??0} sources · {p.targetCount??0} targets</span><span>Stage: {p.currentStage??"Connect"}</span><small>{p.updatedAt?new Date(p.updatedAt).toLocaleString():""}</small></button>)}</div>}
</div></div>; }

