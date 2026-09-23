import React, { ReactNode } from "react";
import "../styles/kmitora-premium.css";

const nav = [
  "Control Tower","Connect","Discover","Map","Transform","Validate","Migrate",
  "Reconcile","Evidence","System Explorer","Agents","Approvals","Activity","Settings"
];

export default function PremiumShell({children}:{children:ReactNode}) {
  return (
    <div className="km-shell">
      <aside className="km-sidebar">
        <div className="km-brand"><div className="km-logo">K</div><div><strong>KMITORA</strong><small>Migration Control Plane</small></div></div>
        <nav>
          {nav.map((item, i)=><button key={item} className={i===0 ? "active":""}><span>{["⌂","⌘","⌕","⌯","⚒","◉","▣","♙","⌑","♜","◇","◈","⚡","⚙"][i]}</span>{item}</button>)}
        </nav>
        <div className="km-user"><div className="km-logo small">K</div><div><strong>KMITORA Admin</strong><small>Platform Admin</small></div><span>⌄</span></div>
      </aside>
      <main className="km-main">{children}</main>
      <aside className="km-assistant">
        <div className="km-assistant-head">✦ <strong>KMITORA Assistant</strong></div>
        <div className="km-assistant-card">
          <h3>🚀 Recommendations</h3>
          <p>Review current exceptions and address top high-impact items to improve readiness and keep migration secure and on track.</p>
          <button className="km-secondary">Show current</button>
          <button className="km-primary full">Resolve safe</button>
        </div>
        <div className="km-assistant-card">
          <h3>▣ Try asking</h3>
          {["How is migration health trending?","Which stage needs attention?","Show open exceptions by priority"].map(x=><button className="km-suggestion" key={x}>{x}</button>)}
          <button className="km-link">See more suggestions</button>
        </div>
        <div className="km-assistant-input">Ask KMITORA Assistant...</div>
      </aside>
    </div>
  );
}

