import { DeviceInfo } from '../net/apiClient';

interface Props {
  devices: DeviceInfo[];
}

function formatSince(epochSec: number | null): string {
  if (!epochSec) return '';
  const sec = Math.max(0, Math.floor(Date.now() / 1000 - epochSec));
  if (sec < 60) return '방금 연결';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전 연결`;
  const hr = Math.floor(min / 60);
  return `${hr}시간 전 연결`;
}

export function DevicePanel({ devices }: Props) {
  const connectedCount = devices.filter((d) => d.connected).length;

  return (
    <div className="panel rail-device">
      <div className="panel-head">
        <span className="eyebrow">DEVICES</span>
        <h2>단말</h2>
        <div className="spacer" />
        <span className={`pill ${connectedCount > 0 ? 'ready' : ''}`}>
          {connectedCount}대 연결
        </span>
      </div>

      {devices.length === 0 ? (
        <div className="empty-state">연결된 단말이 없습니다.</div>
      ) : (
        <div className="channel-list">
          {devices.map((d) => (
            <div className="channel-strip" key={d.device_id}>
              <span className={`led ${d.connected ? 'ready' : ''}`} />
              <span className="mac">{d.device_id}</span>
              <span className="badges">
                <span className={`chip ${d.connected ? 'on' : ''}`}>CMD</span>
                <span className={`chip ${d.audio_connected ? 'on' : ''}`}>AUDIO</span>
              </span>
              <span className="since">{formatSince(d.since)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}