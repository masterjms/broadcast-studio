import { HealthSnapshot } from '../net/apiClient';

interface Props {
  health: HealthSnapshot | null;
}

export function StatusPanel({ health }: Props) {
  const state = health?.session.state ?? '—';
  const sent = health?.live_stats?.sent ?? 0;
  const dropped =
    (health?.live_stats?.dropped_old ?? 0) + (health?.live_stats?.dropped_backlog ?? 0);

  return (
    <div className="panel rail-status">
      <div className="panel-head">
        <span className="eyebrow">STATUS</span>
        <h2>송출 상태</h2>
      </div>
      <div className="telemetry">
        <div className={`cell ${state === 'LIVE' ? 'state-live' : ''}`}>
          <div className="k">상태</div>
          <div className="v">{state}</div>
        </div>
        <div className="cell">
          <div className="k">송출 프레임</div>
          <div className="v">{sent.toLocaleString()}</div>
        </div>
        <div className="cell">
          <div className="k">드롭</div>
          <div className="v">{dropped.toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
}