import { useState, FormEvent } from 'react';

interface Props {
  onLogin: (username: string, password: string) => Promise<void>;
}

export function LoginScreen({ onLogin }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onLogin(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="panel login-card" onSubmit={submit}>
        <img src="/brand/logo.png" alt="" className="brand-logo-lg" />
        <h1>마을 방송국</h1>
        <p>방송을 시작하려면 로그인하세요.</p>
        {error && <div className="banner error">{error}</div>}
        <div className="field-row">
          <label htmlFor="u">아이디</label>
          <input
            id="u" type="text" value={username} autoComplete="username"
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className="field-row">
          <label htmlFor="p">비밀번호</label>
          <input
            id="p" type="password" value={password} autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button type="submit" disabled={busy}>
          {busy ? '로그인 중…' : '로그인'}
        </button>
      </form>
    </div>
  );
}