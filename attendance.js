// Account-owned daily rows prevent duplicate check-ins across devices.
const GeckoAttendance = (() => {
  const enabled = Boolean(window.GECKO_CLOUD_CONFIG?.url && window.GECKO_CLOUD_CONFIG?.publishableKey);
  let client, user, revision = 0, running = null;
  let legacy = null;
  const valid = dates => [...new Set(dates.filter(d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort();
  const key = id => `gecko_attendance_${id}`;
  function cached(id) {
    try { return valid(JSON.parse(localStorage.getItem(key(id)) || '[]')); } catch { return []; }
  }
  function display(dates) {
    const history = valid(dates);
    AppState.attendance = { history, streak: history.length, lastChecked: history.at(-1) || null };
    AppState.previewDay = null;
    renderCharacterAndStreak(); renderStampBoard();
  }
  function message(text) { document.getElementById('attendance-sync-status').textContent = text; }
  async function sync() {
    if (!enabled || !user || !client) return;
    if (running) return running;
    const id = user.id, version = revision, api = client;
    const current = () => revision === version && user?.id === id;
    const work = (async () => {
      try {
        const pending = cached(id);
        if (pending.length) {
          const { error } = await api.from('gecko_attendance').upsert(pending.map(day => ({ user_id: id, day })), { onConflict: 'user_id,day', ignoreDuplicates: true });
          if (error) throw error;
        }
        const dates = [];
        for (let offset = 0; ; offset += 500) {
          const { data, error } = await api.from('gecko_attendance').select('day').eq('user_id', id).order('day').range(offset, offset + 499);
          if (error) throw error;
          dates.push(...data.map(row => row.day));
          if (data.length < 500) break;
        }
        if (!current()) return;
        const merged = valid([...cached(id), ...dates]);
        localStorage.setItem(key(id), JSON.stringify(merged));
        if (JSON.stringify(AppState.attendance.history) !== JSON.stringify(merged)) display(merged);
        message('☁️ 출석 기록 동기화 완료');
      } catch (error) {
        if (current()) message(['42P01', 'PGRST205'].includes(error?.code)
          ? '출석 저장소 설정이 필요합니다. supabase-attendance.sql을 실행해주세요.'
          : '출석 기록은 이 기기에 보관 중입니다. 연결되면 다시 동기화합니다.');
        throw error;
      }
    })();
    running = work;
    try { await work; } finally { if (running === work) running = null; }
  }
  function refresh() { return sync().catch(() => {}); }
  function setSession(api, account) {
    if (legacy === null) legacy = [...new Set(AppState.attendance.history || [])];
    if (!enabled || (user?.id || null) === (account?.id || null)) return;
    revision++; client = api; user = account; running = null;
    if (!user) { display([]); message('로그인하면 출석 기록을 동기화합니다.'); return; }
    const ownerKey = 'gecko_attendance_legacy_owner';
    if (!localStorage.getItem(ownerKey)) {
      localStorage.setItem(ownerKey, user.id);
      localStorage.setItem(key(user.id), JSON.stringify(valid([...cached(user.id), ...legacy])));
    }
    display(cached(user.id)); message('☁️ 출석 기록을 동기화하는 중…');
    setTimeout(refresh, 0);
  }
  async function checkIn(day) {
    if (!user) throw new Error('로그인 후 출석해주세요.');
    const id = user.id;
    localStorage.setItem(key(id), JSON.stringify(valid([...cached(id), day])));
    display(cached(id));
    // Offline attendance remains in the account's local queue until reconnect.
    try { if (running) await running; await sync(); } catch { /* status explains retry */ }
    if (user?.id !== id) throw new Error('계정이 변경되었습니다. 현재 계정의 출석 기록을 확인해주세요.');
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  window.addEventListener('focus', refresh);
  window.addEventListener('online', refresh);
  setInterval(() => { if (!document.hidden) refresh(); }, 30000);
  return { enabled, setSession, checkIn, refresh };
})();
window.GeckoAttendance = GeckoAttendance;
