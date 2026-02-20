import { getSpec } from "../lib/api";

export default async function Home() {
  const spec = await getSpec();

  return (
    <div className="container">
      <div className="nav">
        <div className="brand">
          <div className="logo">✨</div>
          <div>DogMarket</div>
        </div>
        <a className="btn" href={`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5050"}/api/spec`} target="_blank">
          View Spec
        </a>
      </div>

      <div className="panel">
        <div className="panelHeader">Dashboard</div>
        <div className="panelBody">
          <div style={{display:"grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))"}}>
            <a className="card" href="/entity/dogs">
  <div style={{fontWeight: 900}}>Dogs</div>
  <div className="small">Manage dogs (CRUD)</div>
</a>
<a className="card" href="/entity/orders">
  <div style={{fontWeight: 900}}>Orders</div>
  <div className="small">Manage orders (CRUD)</div>
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
