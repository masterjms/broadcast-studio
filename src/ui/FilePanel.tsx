import { useRef, useState } from 'react';
import { FileEntry } from '../net/apiClient';

interface Props {
  files: FileEntry[];
  busy: boolean;
  onUpload: (file: File) => Promise<void>;
  onBroadcast: (fileName: string) => Promise<void>;
}

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

export function FilePanel({ files, busy, onUpload, onBroadcast }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sendingFile, setSendingFile] = useState<string | null>(null);

  const doUpload = async () => {
    if (!picked) return;
    setError(null);
    try {
      await onUpload(picked);
      setPicked(null);
      if (inputRef.current) inputRef.current.value = '';
    } catch (e) {
      setError(e instanceof Error ? e.message : '업로드에 실패했습니다.');
    }
  };

  const doBroadcast = async (name: string) => {
    setError(null);
    setSendingFile(name);
    try {
      await onBroadcast(name);
    } catch (e) {
      setError(e instanceof Error ? e.message : '전송에 실패했습니다.');
    } finally {
      setSendingFile(null);
    }
  };

  return (
    <div className="panel rail-file">
      <div className="panel-head">
        <span className="eyebrow">FILES</span>
        <h2>파일 방송</h2>
        <div className="spacer" />
        {files.length > 0 && <span className="pill">{files.length}개</span>}
      </div>

      {error && <div className="banner error">{error}</div>}

      <div className="field-row">
        <div className="dropzone" onClick={() => inputRef.current?.click()}>
          {picked ? `${picked.name} · ${formatSize(picked.size)}` : 'MP3 파일 선택…'}
        </div>
        <input
          ref={inputRef} type="file" accept=".mp3,audio/mpeg" hidden
          onChange={(e) => setPicked(e.target.files?.[0] ?? null)}
        />
        <button disabled={!picked || busy} onClick={doUpload}>
          {busy && !sendingFile ? '업로드 중…' : '업로드'}
        </button>
      </div>

      {files.length > 0 ? (
        <div className="filelist">
          {files.map((f) => (
            <div className="fileitem" key={f.file_name}>
              <span className="name">{f.file_name}</span>
              <span className="meta">
                {formatSize(f.size)}
                <button
                  disabled={busy}
                  onClick={() => doBroadcast(f.file_name)}
                >
                  {sendingFile === f.file_name ? '전송 중…' : '전송'}
                </button>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">아직 업로드된 파일이 없습니다.</div>
      )}
    </div>
  );
}