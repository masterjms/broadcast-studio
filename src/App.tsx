import { useBroadcaster } from './state/useBroadcaster';
import { LoginScreen } from './ui/LoginScreen';
import { LivePanel } from './ui/LivePanel';
import { FilePanel } from './ui/FilePanel';
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
  const devices = b.health?.cmd_devices ?? 0;

  return (
    <div className="app">
      <div className="topbar">
        <h1>군포 방송 스튜디오</h1>
        <div className="status-group">
          <span>
            <span className={`dot ${serverOk ? 'ok' : 'off'}`} />
            {serverOk ? '서버 연결됨' : '서버 끊김'}
          </span>
          <span>단말 {devices}대</span>
          <button style={{ height: 30, padding: '0 12px' }} onClick={b.logout}>
            로그아웃
          </button>
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

      <StatusPanel health={b.health} />
    </div>
  );
}
