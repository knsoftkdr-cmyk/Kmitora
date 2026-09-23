export default function ProgressRing({value,label}:{value:number;label:string}) {
  const deg = Math.max(0, Math.min(100, value)) * 3.6;
  return <div className="ringWrap">
    <div className="ring" style={{background:`conic-gradient(var(--accent) ${deg}deg, var(--line) ${deg}deg)`}}>
      <div className="ringInner">
        <strong>{value}%</strong>
        <span>{label}</span>
      </div>
    </div>
  </div>
}

