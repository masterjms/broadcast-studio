import { useState } from 'react';
import { useBroadcaster } from './state/useBroadcaster';
import { LoginScreen } from './ui/LoginScreen';
import { LivePanel } from './ui/LivePanel';
import { FilePanel } from './ui/FilePanel';
import { DevicePanel } from './ui/DevicePanel';

export default function App() {
  const b = useBroadcaster();
  const [restarting, setRestarting] = useState(false);

  if (!b.loggedIn) {
    return (
      <div className="app">
        <LoginScreen onLogin={b.login} />
      </div>
    );
  }

  const serverOk = b.health?.ok ?? false;
  const devices = b.health?.devices ?? [];
  const connectedCount = devices.filter((d) => d.connected).length;
  const isLive = b.ingestState === 'live';

  const onRestart = async () => {
    const ok = window.confirm(
      '서버를 재시작하시겠습니까?\n방송 중이라면 잠시 끊깁니다. 몇 초 후 자동으로 복구됩니다.',
    );
    if (!ok) return;
    setRestarting(true);
    try {
      await b.restartServer();
      // 재시작 동안 잠깐 대기 후 자동 복구를 기다린다
      setTimeout(() => setRestarting(false), 8000);
    } catch {
      setRestarting(false);
      window.alert('재시작 요청에 실패했습니다.');
    }
  };

  return (
    <div className="app app-wide">
      <div className="topbar">
        <div className="brand">
          <span className="brand-logo-box">
            <img src="/brand/logo.png" alt="한나전자" className="brand-logo" />
          </span>
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
              <span className={`led ${isLive ? 'on-air' : connectedCount > 0 ? 'ready' : ''}`} />
              단말 {connectedCount}
            </span>
            <span className={`build-pill ${isLive ? 'on-air' : ''}`}>
              {isLive ? 'ON AIR' : serverOk ? 'ONLINE' : 'OFFLINE'}
            </span>
            <button
              className="icon-btn danger"
              onClick={onRestart}
              disabled={restarting}
              title="서버 프로세스를 재시작합니다"
            >
              {restarting ? '재시작 중…' : '서버 재시작'}
            </button>
            <button className="icon-btn" onClick={b.logout}>로그아웃</button>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <DevicePanel
          devices={devices}
          selectedDevices={b.selectedDevices}
          onToggle={b.toggleDevice}
          onSelectAll={b.selectAllDevices}
          onClear={b.clearDevices}
        />

        <FilePanel
          files={b.files}
          busy={b.busy}
          selectedCount={b.selectedDevices.length}
          recordFlash={b.fileRecordFlash}
          onRecordFlashChange={b.setFileRecordFlash}
          notice={b.notice}
          onClearNotice={b.clearNotice}
          onUpload={b.upload}
          onBroadcast={b.broadcast}
          onDelete={b.removeFile}
        />

        <LivePanel
          ingestState={b.ingestState}
          ingestDetail={b.ingestDetail}
          audioError={b.audioError}
          recordFlash={b.recordFlash}
          onRecordFlashChange={b.setRecordFlash}
          micGain={b.micGain}
          onMicGainChange={b.setMicGain}
          selectedCount={b.selectedDevices.length}
          onStart={b.startLive}
          onStop={b.stopLive}
        />
      </div>
    </div>
  );
}