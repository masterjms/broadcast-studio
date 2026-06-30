import { useBroadcaster } from './state/useBroadcaster';
import { LoginScreen } from './ui/LoginScreen';
import { LivePanel } from './ui/LivePanel';
import { FilePanel } from './ui/FilePanel';
import { DevicePanel } from './ui/DevicePanel';
import { StatusPanel } from './ui/StatusPanel';

export default function App() {
  const b = useBroadcaster();

  if (!b.loggedIn) {
    return (
      <div className="app">
        <LoginScreen onLogin={b.login} />
      </div>
    );
  }

  const serverOk = b.health?.ok ?? false;
  const devices = b.health?.devices ?? [];
  const isLive = b.ingestState === 'live';

  return (
    <div className="app app-wide">
      <div className="topbar">
        <div className="brand">
          <img src="/brand/logo.png" alt="" className="brand-logo" />
          <div className="brand-text">
            <h1>castboard</h1>
            <p className="tagline">방송 콘솔 · 실시간 IoT 라디오 송출</p>
          </div>
        </div>

        <div className="topbar-meta">
          <div className="meta-lines">
            <div className="meta-row">
              <span className="meta-k">DOMAIN</span>
              <span className="meta-v">{location.host}</span>
            </div>
            <div className="meta-row">
              <span className="meta-k">SESSION</span>
              <span className="meta-v">#{b.health?.session.session_id ?? '—'}</span>
            </div>
          </div>
          <div className="status-group">
            <span className="status-item">
              <span className={`led ${serverOk ? 'ready' : ''}`} />
              서버
            </span>
            <span className="status-item">
              <span className={`led ${isLive ? 'on-air' : devices.length > 0 ? 'ready' : ''}`} />
              단말 {devices.length}
            </span>
            <span className={`build-pill ${isLive ? 'on-air' : ''}`}>
              {isLive ? 'ON AIR' : serverOk ? 'ONLINE' : 'OFFLINE'}
            </span>
            <button className="icon-btn" onClick={b.logout}>로그아웃</button>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <DevicePanel devices={devices} />

        <FilePanel
          files={b.files}
          busy={b.busy}
          onUpload={b.upload}
          onBroadcast={b.broadcast}
        />

        <LivePanel
          ingestState={b.ingestState}
          ingestDetail={b.ingestDetail}
          audioError={b.audioError}
          onStart={b.startLive}
          onStop={b.stopLive}
        />
      </div>

      <StatusPanel health={b.health} />
    </div>
  );
}