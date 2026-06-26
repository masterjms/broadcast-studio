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
    <div className="metrics">
      <div className="metric">
        <div className="k">상태</div>
        <div className="v">{state}</div>
      </div>
      <div className="metric">
        <div className="k">송출 프레임</div>
        <div className="v">{sent.toLocaleString()}</div>
      </div>
      <div className="metric">
        <div className="k">드롭</div>
        <div className="v">{dropped.toLocaleString()}</div>
      </div>
      <div className="metric">
        <div className="k">단말</div>
        <div className="v">{health?.audio_devices ?? 0}</div>
      </div>
    </div>
  );
}
