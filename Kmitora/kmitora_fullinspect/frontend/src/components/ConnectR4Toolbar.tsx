import { FolderOpen, Plus, Save, Search } from "lucide-react";

type Props = { projectName: string; savedLabel: string; query: string; setQuery: (value: string) => void; onSave: () => void; onAddSource: () => void; onAddTarget: () => void; onProjects: () => void; };

export default function ConnectR4Toolbar(props: Props) {
  return <div className="km-r4-toolbar">
    <div className="km-r4-project"><strong>{props.projectName || "Migration Project"}</strong><small>{props.savedLabel || "Not saved yet"}</small></div>
    <label className="km-r4-search"><Search size={15}/><input value={props.query} onChange={e=>props.setQuery(e.target.value)} placeholder="Search sources / targets..." /></label>
    <div className="km-r4-actions">
      <button type="button" onClick={props.onProjects}><FolderOpen size={15}/> Projects</button>
      <button type="button" onClick={props.onSave}><Save size={15}/> Save</button>
      <button type="button" className="primary" onClick={props.onAddSource}><Plus size={15}/> Source</button>
      <button type="button" className="primary" onClick={props.onAddTarget}><Plus size={15}/> Target</button>
    </div>
  </div>;
}

