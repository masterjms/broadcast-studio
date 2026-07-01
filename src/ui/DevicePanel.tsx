import { DeviceInfo } from '../net/apiClient';

interface Props {
  devices: DeviceInfo[];
  selectedDevices: string[];
  onToggle: (deviceId: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
}

export function DevicePanel({
  devices, selectedDevices, onToggle, onSelectAll, onClear,
}: Props) {
  // 연결된 단말만 노출 (MAC 주소 기준)
  const connected = devices.filter((d) => d.connected);
  const allSelected = connected.length > 0 &&
    connected.every((d) => selectedDevices.includes(d.device_id));

  return (
    <div className="panel rail-device">
      <div className="panel-head">
        <span className="eyebrow">DEVICES</span>
        <h2>단말</h2>
        <div className="spacer" />
        <span className={`pill ${connected.length > 0 ? 'ready' : ''}`}>
          {selectedDevices.length}/{connected.length} 선택
        </span>
      </div>

      {connected.length > 0 && (
        <div className="device-actions">
          <button
            className="mini-btn"
            onClick={allSelected ? onClear : onSelectAll}
          >
            {allSelected ? '전체 해제' : '전체 선택'}
          </button>
          <span className="hint">방송할 단말을 선택하세요</span>
        </div>
      )}

      {connected.length === 0 ? (
        <div className="empty-state">연결된 단말이 없습니다.</div>
      ) : (
        <div className="channel-list">
          {connected.map((d) => {
            const on = selectedDevices.includes(d.device_id);
            return (
              <button
                key={d.device_id}
                className={`channel-strip selectable ${on ? 'selected' : ''}`}
                onClick={() => onToggle(d.device_id)}
              >
                <span className={`checkbox ${on ? 'on' : ''}`}>
                  {on ? '✓' : ''}
                </span>
                <span className="led ready" />
                <span className="mac">{d.device_id}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}