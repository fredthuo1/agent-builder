import { getSpec } from "../lib/api";

export default async function Home() {
  const spec = await getSpec();

  return (
    <div className="container">
      <div className="nav">
        <div className="brand">
          <div className="logo">✨</div>
          <div>Habit Tracker</div>
        </div>
        <a className="btn" href={`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5050"}/api/spec`} target="_blank">
          View Spec
        </a>
      </div>

      <div className="panel">
        <div className="panelHeader">Dashboard</div>
        <div className="panelBody">
          <div style={{display:"grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))"}}>
            <a className="card" href="/entity/habits">
  <div style={{fontWeight: 900}}>Habits</div>
  <div className="small">Manage habits (CRUD)</div>
</a>
          </div>
          <div style={{marginTop: 14}} className="small">
            Entities: <strong>{spec.entities.length}</strong> • Backend: <strong>5050</strong> • Frontend: <strong>3001</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
