// Each diary is a separate account-owned row. Gemini keys stay in browser storage.
const GeckoCloud = (() => {
  const config = window.GECKO_CLOUD_CONFIG || {};
  const enabled = Boolean(config.url && config.publishableKey);
  const bucket = 'gecko-diary-photos';
  let client, user, ready = false, busy = false, generation = 0;
  let legacy = null;
  const node = id => document.getElementById(id);
  const status = text => { node('cloud-diary-status').textContent = text; };

  function controls() {
    node('diary-form').inert = enabled && (!ready || busy || !user);
    ['btn-cloud-refresh', 'btn-import-local-diaries', 'btn-import-diary-file'].forEach(id => {
      node(id).disabled = !enabled || busy || !user || (id !== 'btn-cloud-refresh' && !ready);
    });
  }

  function describe(error) {
    if (['42P01', 'PGRST205'].includes(error?.code)) return '온라인 저장소가 아직 준비되지 않았습니다. Supabase SQL Editor에서 supabase-setup.sql을 실행한 후 다시 불러오기를 눌러주세요.';
    return `온라인 기록 처리에 실패했습니다. 입력 내용은 유지됩니다. ${String(error?.message || '인터넷 연결과 저장소 권한을 확인해주세요.').slice(0, 250)}`;
  }

  function normalize(entry) {
    if (!entry || !Number.isSafeInteger(entry.id) || entry.id <= 0 ||
        typeof entry.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) {
      throw new Error('일기 날짜 또는 기록 번호가 올바르지 않습니다.');
    }
    const weight = entry.weight === null || entry.weight === '' || entry.weight === undefined ? null : Number(entry.weight);
    if (weight !== null && (!Number.isFinite(weight) || weight < 0 || weight > 100)) throw new Error('체중은 0~100g 범위여야 합니다.');
    const result = { id: entry.id, date: entry.date, weight };
    for (const key of ['feed', 'poop', 'shed', 'notes']) result[key] = String(entry[key] || '').slice(0, key === 'notes' ? 10000 : 200);
    return result;
  }

  function session() {
    if (!user || !client || !ready) throw new Error('로그인하고 온라인 기록을 먼저 불러와주세요.');
    return { client, user, generation };
  }
  const current = context => generation === context.generation && user?.id === context.user.id;

  async function signedPhoto(context, path) {
    if (!path) return '';
    if (!path.startsWith(context.user.id + '/')) throw new Error('사진 접근 권한을 확인해주세요.');
    const { data, error } = await context.client.storage.from(bucket).createSignedUrl(path, 3600);
    if (error) throw error;
    return data.signedUrl;
  }

  async function refresh() {
    if (!client || !user || busy) return;
    const context = { client, user, generation: ++generation };
    busy = true; ready = false; controls(); status('온라인 일기와 체중을 불러오는 중입니다…');
    try {
      const rows = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await context.client.from('gecko_diaries').select('id,entry,photo_path')
          .eq('user_id', context.user.id).order('id', { ascending: true }).range(offset, offset + 499);
        if (error) throw error;
        if (!current(context)) return;
        rows.push(...data);
        if (data.length < 500) break;
      }
      let missingPhotos = 0;
      const records = [];
      for (const row of rows) {
        const entry = normalize({ ...row.entry, id: Number(row.id) });
        entry.photoPath = row.photo_path;
        try { entry.photoUrl = await signedPhoto(context, row.photo_path); }
        catch { entry.photoUrl = ''; missingPhotos++; }
        records.push(entry);
      }
      if (!current(context)) return;
      AppState.diaries = records; renderDiary(); ready = true;
      status(`온라인 기록 ${records.length}개를 불러왔습니다.${missingPhotos ? ` 사진 ${missingPhotos}개는 불러오지 못했습니다.` : ''}`);
    } catch (error) {
      if (current(context)) status(describe(error));
    } finally {
      if (current(context)) { busy = false; controls(); }
    }
  }

  function setSession(nextClient, nextUser) {
    window.GeckoAttendance?.setSession(nextClient, nextUser);
    if (!enabled || (user?.id || null) === (nextUser?.id || null)) return;
    generation++; client = nextClient; user = nextUser; ready = false; busy = false;
    AppState.diaries = []; renderDiary(); controls();
    status(user ? '온라인 기록을 연결하는 중입니다…' : '로그인하면 본인의 온라인 일기와 체중을 불러옵니다.');
    // Auth callbacks must finish before starting further Supabase requests.
    if (user) setTimeout(() => refresh(), 0);
  }

  async function writeRecord(context, record, ignoreDuplicates = false) {
    const entry = normalize(record);
    let photoPath = null;
    if (record.photoUrl) {
      if (!/^data:image\/(jpeg|png|webp|gif);base64,/.test(record.photoUrl)) throw new Error('사진은 JPG·PNG·WebP·GIF 파일만 가져올 수 있습니다.');
      const photo = await (await fetch(record.photoUrl)).blob();
      if (photo.size > 5242880) throw new Error('사진은 5MB 이하로 선택해주세요.');
      photoPath = `${context.user.id}/${entry.id}-${crypto.randomUUID()}`;
      if (!current(context)) throw new Error('계정이 변경되었습니다. 다시 시도해주세요.');
      const uploaded = await context.client.storage.from(bucket).upload(photoPath, photo, { contentType: photo.type });
      if (uploaded.error) throw uploaded.error;
    }
    try {
      if (!current(context)) throw new Error('계정이 변경되었습니다. 다시 시도해주세요.');
      const query = context.client.from('gecko_diaries');
      const row = { user_id: context.user.id, id: entry.id, entry, photo_path: photoPath };
      const result = ignoreDuplicates
        ? await query.upsert(row, { onConflict: 'user_id,id', ignoreDuplicates: true }).select('id')
        : await query.insert(row).select('id');
      if (result.error) throw result.error;
      if (!result.data.length) {
        if (photoPath) await context.client.storage.from(bucket).remove([photoPath]);
        return null;
      }
    } catch (error) {
      if (photoPath && current(context)) await context.client.storage.from(bucket).remove([photoPath]).catch(() => {});
      throw error;
    }
    let photoUrl = '';
    try { photoUrl = await signedPhoto(context, photoPath); } catch { /* Record still saved. Refresh can retry photos. */ }
    return { ...entry, photoPath, photoUrl };
  }

  async function save(record) {
    if (busy) throw new Error('기록 처리 중입니다. 잠시 후 다시 시도해주세요.');
    const context = session(); busy = true; controls(); status('일기를 온라인에 저장하는 중입니다…');
    try {
      const stored = await writeRecord(context, record);
      if (!current(context)) throw new Error('계정이 변경되었습니다. 현재 계정의 기록을 새로 불러와주세요.');
      AppState.diaries.push(stored); renderDiary(); status('일기와 체중을 온라인에 저장했습니다.');
    } catch (error) { if (current(context)) status(describe(error)); throw error; }
    finally { if (current(context)) { busy = false; controls(); } }
  }

  async function remove(id) {
    if (busy) throw new Error('기록 처리 중입니다. 잠시 후 다시 시도해주세요.');
    const context = session(); busy = true; controls();
    const entry = AppState.diaries.find(item => item.id === id);
    try {
      const { error } = await context.client.from('gecko_diaries').delete().eq('user_id', context.user.id).eq('id', id);
      if (error) throw error;
      if (!current(context)) return;
      AppState.diaries = AppState.diaries.filter(item => item.id !== id); renderDiary();
      let photoError;
      if (entry?.photoPath) {
        try { photoError = (await context.client.storage.from(bucket).remove([entry.photoPath])).error; }
        catch (error) { photoError = error; }
      }
      if (current(context)) status(photoError ? '일기는 삭제했습니다. 첨부 사진 파일 정리는 완료하지 못했습니다.' : '온라인 일기를 삭제했습니다.');
    } catch (error) { if (current(context)) status(describe(error)); throw error; }
    finally { if (current(context)) { busy = false; controls(); } }
  }

  async function importRecords(records) {
    if (!Array.isArray(records) || !records.length) throw new Error('가져올 일기 기록이 없습니다.');
    if (records.length > 10000) throw new Error('한 번에 최대 10,000개 기록을 가져올 수 있습니다.');
    records.forEach(normalize);
    if (!confirm(`일기 ${records.length}개를 현재 로그인 계정에 가져올까요? 같은 기록 번호는 중복 저장하지 않습니다.`)) return;
    if (busy) return;
    const context = session(); busy = true; controls();
    let completed = 0;
    try {
      for (const record of records) {
        if (!current(context)) throw new Error('계정이 변경되어 가져오기를 중단했습니다.');
        status(`기록 가져오는 중… ${completed}/${records.length}`);
        await writeRecord(context, record, true); completed++;
      }
    } catch (error) {
      if (current(context)) { status(`${completed}개 처리 후 중단했습니다. ${describe(error)} 다시 가져오면 중복 없이 이어집니다.`); }
      throw error;
    } finally {
      if (current(context)) { busy = false; controls(); }
    }
    if (current(context)) await refresh();
  }

  function exportLocal() {
    const diaries = enabled ? legacy : AppState.diaries;
    const blob = new Blob([JSON.stringify({ format: 'gecko-diaries-v1', diaries }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'gecko-diaries-backup.json'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function init() {
    legacy = JSON.parse(JSON.stringify(AppState.diaries));
    if (enabled) { AppState.diaries = []; renderDiary(); status('로그인하면 온라인 일기와 체중을 불러옵니다.'); }
    else status('일기와 체중을 현재 브라우저에 저장합니다.');
    controls();
    node('btn-cloud-refresh').addEventListener('click', refresh);
    node('btn-export-local-diaries').addEventListener('click', exportLocal);
    node('btn-import-local-diaries').addEventListener('click', () => importRecords(legacy).catch(error => alert(error.message)));
    node('btn-import-diary-file').addEventListener('click', () => node('diary-import-file').click());
    node('diary-import-file').addEventListener('change', async event => {
      const file = event.target.files[0]; if (!file) return;
      try {
        if (file.size > 100 * 1024 * 1024) throw new Error('백업 파일은 100MB 이하로 선택해주세요.');
        const data = JSON.parse(await file.text());
        await importRecords(Array.isArray(data) ? data : data.diaries);
      } catch (error) { alert(error.message); }
      finally { event.target.value = ''; }
    });
  }

  return { enabled, init, setSession, refresh, save, remove,
    accountId: () => user?.id || null,
    localRecords: () => legacy || AppState.diaries };
})();
window.GeckoCloud = GeckoCloud;
document.addEventListener('DOMContentLoaded', GeckoCloud.init);
