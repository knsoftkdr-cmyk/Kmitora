import { Brain } from "lucide-react";
import { a000KnowledgePacks } from "../config/knowledgePackRegistry";

export default function KnowledgePackSummary() {
  const totalTopics = a000KnowledgePacks.reduce(
    (sum, pack) => sum + pack.topicCount,
    0
  );

  return (
    <section className="km-knowledge-summary">
      <div className="km-knowledge-head">
        <div>
          <span className="eyebrow">KMITORA KNOWLEDGE PACKS</span>
          <h3>Reusable Migration Knowledge</h3>
          <p>
            Governed specialist knowledge for mapping, cleansing,
            transformation, validation and defect resolution.
          </p>
        </div>

        <div className="km-knowledge-kpis">
          <div>
            <span>Active Packs</span>
            <strong>{a000KnowledgePacks.length}</strong>
          </div>
          <div>
            <span>Total Topics</span>
            <strong>{totalTopics.toLocaleString()}</strong>
          </div>
        </div>
      </div>

      <div className="km-knowledge-table-wrap">
        <table className="km-knowledge-table">
          <thead>
            <tr>
              <th>Knowledge Pack</th>
              <th>Topics</th>
              <th>Purpose</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {a000KnowledgePacks.map((pack) => (
              <tr key={pack.id}>
                <td>
                  <span className="km-knowledge-name">
                    <Brain size={14} />
                    {pack.name}
                  </span>
                  <small>{pack.source}</small>
                </td>
                <td>{pack.topicCount.toLocaleString()}</td>
                <td>{pack.purpose}</td>
                <td>
                  <span className="statusPill success">{pack.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

