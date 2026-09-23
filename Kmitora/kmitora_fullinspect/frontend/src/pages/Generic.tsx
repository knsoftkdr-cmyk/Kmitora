export default function Generic({title}:{title:string}) {
  return <div className="page">
    <div className="pageTitle"><div><span className="eyebrow">KMITORA</span><h1>{title}</h1><p>This workspace is reserved for the advanced control-plane experience and can be wired to live APIs next.</p></div></div>
    <div className="panel emptyState"><strong>{title}</strong><p>Frontend shell ready for implementation.</p></div>
  </div>
}

