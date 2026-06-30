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
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <span className="mark" />
          <h1>castboard</h1>
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
          <button className="icon-btn" onClick={b.logout}>로그아웃</button>
        </div>
      </div>

      <LivePanel
        ingestState={b.ingestState}
        ingestDetail={b.ingestDetail}
        audioError={b.audioError}
        onStart={b.startLive}
        onStop={b.stopLive}
      />

      <FilePanel
        files={b.files}
        busy={b.busy}
        onUpload={b.upload}
        onBroadcast={b.broadcast}
      />

      <DevicePanel devices={devices} />

      <StatusPanel health={b.health} />
    </div>
  );
}