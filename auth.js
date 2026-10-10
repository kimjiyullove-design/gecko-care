// Login is separate from local care records; online diary storage will be connected next.
const GeckoAuth = (() => {
  let client = null;
  let user = null;
  let busy = false;
  let signup = false;
  let recovery = false;
  const node = id => document.getElementById(id);
  const config = window.GECKO_CLOUD_CONFIG || {};
  const configured = Boolean(config.url && config.publishableKey);
  const gated = configured && config.requireLogin !== false;
  const emailStorageKey = 'gecko_remembered_email';
  const recoveryStorageKey = `gecko_password_recovery_${config.url || 'local'}`;
  const incomingHash = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
  const recoveryLink = incomingHash.get('type') === 'recovery';

  function recoveryUserId() {
    try { return sessionStorage.getItem(recoveryStorageKey); } catch { return null; }
  }

  function clearRecovery() {
    recovery = false;
    try { sessionStorage.removeItem(recoveryStorageKey); } catch { /* Storage can be disabled. */ }
    node('auth-new-password').value = '';
    node('auth-confirm-password').value = '';
    node('auth-reset-form').classList.add('hidden');
    setMode(false);
  }

  function enterRecovery(nextUser) {
    recovery = true;
    try { sessionStorage.setItem(recoveryStorageKey, nextUser.id); } catch { /* Optional refresh support. */ }
    showUser(nextUser);
    message('새 비밀번호를 두 번 입력하고 저장해주세요.');
  }

  function restoreEmail() {
    try {
      const saved = localStorage.getItem(emailStorageKey);
      node('auth-remember-email').checked = Boolean(saved);
      if (saved) node('auth-email').value = saved.slice(0, 254);
    } catch (error) {
      node('auth-remember-email').checked = false;
    }
  }

  function rememberEmail() {
    try {
      const email = node('auth-email').value.trim();
      if (node('auth-remember-email').checked && email) {
        localStorage.setItem(emailStorageKey, email.slice(0, 254));
      } else {
        localStorage.removeItem(emailStorageKey);
      }
    } catch (error) {
      message('이 브라우저에서 이메일을 저장하지 못했습니다. 로그인은 계속할 수 있습니다.');
    }
  }

  function message(text) {
    node('auth-message').textContent = text;
  }

  function setBusy(value) {
    busy = value;
    node('auth-submit').disabled = value || !client;
    node('auth-mode-toggle').disabled = value;
    node('auth-logout').disabled = value;
    node('auth-recover-request').disabled = value || !client;
    node('auth-reset-submit').disabled = value || !client;
    node('auth-reset-cancel').disabled = value;
    node('auth-reset-submit').textContent = value ? '저장 중…' : '새 비밀번호 저장';
    node('auth-submit').textContent = value ? '처리 중…' : signup ? '회원가입' : '로그인';
  }

  function setMode(isSignup) {
    signup = isSignup;
    node('auth-title').textContent = signup ? '집사 회원가입' : '집사 로그인';
    node('auth-mode-toggle').textContent = signup ? '이미 계정이 있어요 · 로그인' : '처음 오셨나요? 회원가입';
    node('auth-password').autocomplete = signup ? 'new-password' : 'current-password';
    node('auth-subtitle').textContent = signup ? '이메일 계정을 새로 만드세요.' : '가입한 이메일과 비밀번호로 로그인하세요.';
    setBusy(busy);
  }

  function open() {
    node('auth-modal').classList.remove('hidden');
    node('auth-close').classList.toggle('hidden', recovery || (gated && !user));
    node(recovery ? 'auth-new-password' : 'auth-email').focus();
  }

  function close() {
    if (recovery || (gated && !user)) return;
    node('auth-modal').classList.add('hidden');
    node('auth-password').value = '';
    node('btn-login').focus();
  }

  function showUser(nextUser) {
    user = nextUser;
    node('auth-account-email').textContent = user ? user.email : '';
    node('auth-account').classList.toggle('hidden', !user || recovery);
    node('auth-form').classList.toggle('hidden', Boolean(user) || recovery);
    node('auth-reset-form').classList.toggle('hidden', !recovery);
    node('btn-login').textContent = user ? '👤 내 계정' : '👤 로그인';
    node('auth-local-note').textContent = '로그인한 계정의 일기·체중은 온라인 저장소와 연결됩니다. Gemini API 키는 이 브라우저에 보관합니다.';
    window.GeckoCloud?.setSession(client, recovery ? null : user);
    document.querySelector('main').inert = recovery || (gated && !user);
    document.querySelector('header').inert = recovery || (gated && !user);
    node('auth-close').classList.toggle('hidden', recovery || (gated && !user));
    if (recovery) {
      node('auth-title').textContent = '새 비밀번호 설정';
      node('auth-subtitle').textContent = '가입한 계정의 비밀번호를 변경합니다.';
    }
    if (recovery || (gated && !user)) open();
    else node('auth-modal').classList.add('hidden');
  }

  function errorText(error) {
    const text = String(error?.message || '');
    const code = String(error?.code || '');
    if (code === 'email_address_not_authorized' || /email address.*not authorized/i.test(text)) {
      return '이 이메일로 인증 메일을 보낼 수 없습니다. Supabase 기본 메일 서비스는 프로젝트 조직의 구성원 이메일만 지원합니다. 프로젝트 관리자는 Authentication → Email → SMTP Settings에서 메일 발송 서비스를 연결해주세요.';
    }
    if (code === 'over_email_send_rate_limit' || /email rate limit/i.test(text)) {
      return '인증 이메일 발송 한도를 초과했습니다. 잠시 후 다시 시도하거나 프로젝트의 SMTP 메일 발송 설정을 확인해주세요.';
    }
    if (code === 'email_address_invalid') return '사용할 수 없는 이메일 주소입니다. 이메일 주소를 확인해주세요.';
    if (code === 'signup_disabled') return '현재 프로젝트에서 회원가입이 비활성화되어 있습니다. 프로젝트의 가입 허용 설정을 확인해주세요.';
    if (code === 'otp_expired' || /expired|invalid.*token/i.test(text)) return '복구 링크가 만료되었거나 사용할 수 없습니다. 새 복구 메일을 요청해주세요.';
    if (code === 'same_password') return '이전과 다른 새 비밀번호를 입력해주세요.';
    if (code === 'unexpected_failure' && /confirmation|email|mail/i.test(text)) {
      return '인증 메일 발송에 실패했습니다. Supabase의 SMTP 설정과 Authentication 로그를 확인해주세요.';
    }
    if (/invalid login credentials/i.test(text)) return '이메일 또는 비밀번호를 확인해주세요.';
    if (/email not confirmed/i.test(text)) return '가입 이메일의 인증 링크를 먼저 눌러주세요.';
    if (/rate limit|too many/i.test(text)) return '요청이 많습니다. 잠시 후 다시 시도해주세요.';
    if (/already registered/i.test(text)) return '이미 가입한 이메일입니다. 로그인해주세요.';
    if (/password/i.test(text)) return '비밀번호가 프로젝트의 보안 조건을 충족하지 않습니다.';
    if (/fetch|network/i.test(text)) return '인증 서버에 연결하지 못했습니다. 인터넷 연결을 확인해주세요.';
    const detail = [code, text].filter(Boolean).join(' · ').slice(0, 500);
    return `인증에 실패했습니다.${detail ? ` 서버 오류: ${detail}` : ' 다시 시도해주세요.'}`;
  }

  async function requestRecovery() {
    if (!client || busy) return;
    const emailInput = node('auth-email');
    if (!emailInput.reportValidity()) return;
    if (!/^https?:$/.test(window.location.protocol)) {
      message('게코 웹페이지 실행.cmd를 실행하고 http://localhost:8000/에서 비밀번호 복구를 요청해주세요.');
      return;
    }
    setBusy(true);
    message('');
    rememberEmail();
    try {
      const { error } = await client.auth.resetPasswordForEmail(emailInput.value.trim(), {
        redirectTo: window.location.origin + window.location.pathname
      });
      if (error) throw error;
      message('복구 메일을 요청했습니다. 메일의 링크를 눌러 새 비밀번호를 설정해주세요.');
    } catch (error) {
      message(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function saveNewPassword(event) {
    event.preventDefault();
    if (!client || busy || !recovery || !user) return;
    const password = node('auth-new-password').value;
    if (password.length < 8) { message('새 비밀번호는 8자 이상 입력해주세요.'); return; }
    if (password !== node('auth-confirm-password').value) {
      message('새 비밀번호와 확인 입력이 일치하지 않습니다.');
      node('auth-confirm-password').focus();
      return;
    }
    setBusy(true);
    message('');
    try {
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      const email = user.email;
      clearRecovery();
      const result = await client.auth.signOut({ scope: 'local' });
      if (result.error) {
        showUser(user);
        open();
        message('비밀번호를 변경했습니다. 자동 로그아웃에 실패했으므로 로그아웃 버튼을 눌러주세요.');
      } else {
        showUser(null);
        node('auth-email').value = email;
        node('auth-password').value = '';
        open();
        message('비밀번호를 변경했습니다. 새 비밀번호로 로그인해주세요.');
      }
    } catch (error) {
      message(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (!client || busy) return;
    setBusy(true);
    message('');
    rememberEmail();
    try {
      const credentials = {
        email: node('auth-email').value.trim(),
        password: node('auth-password').value
      };
      const result = signup
        ? await client.auth.signUp({ ...credentials, options: {
          emailRedirectTo: /^https?:$/.test(window.location.protocol)
            ? window.location.origin + window.location.pathname : undefined
        } })
        : await client.auth.signInWithPassword(credentials);
      if (result.error) throw result.error;
      node('auth-password').value = '';
      if (result.data.session) {
        showUser(result.data.session.user);
        close();
      } else {
        setMode(false);
        message('인증 이메일을 확인하고 링크를 누른 뒤 로그인해주세요.');
      }
    } catch (error) {
      message(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    if (!client || busy) return;
    setBusy(true);
    try {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw error;
      clearRecovery();
      showUser(null);
      message('로그아웃했습니다.');
    } catch (error) {
      message(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function init() {
    restoreEmail();
    node('auth-remember-email').addEventListener('change', rememberEmail);
    node('auth-email').addEventListener('change', rememberEmail);
    node('btn-login').addEventListener('click', open);
    node('auth-close').addEventListener('click', close);
    node('auth-modal').addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.key !== 'Tab') return;
      const fields = [...node('auth-modal').querySelectorAll('button, input')]
        .filter(field => !field.disabled && field.getClientRects().length);
      const first = fields[0], last = fields[fields.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus();
      }
    });
    node('auth-form').addEventListener('submit', submit);
    node('auth-recover-request').addEventListener('click', requestRecovery);
    node('auth-reset-form').addEventListener('submit', saveNewPassword);
    node('auth-reset-cancel').addEventListener('click', logout);
    node('auth-logout').addEventListener('click', logout);
    node('auth-mode-toggle').addEventListener('click', () => {
      setMode(!signup);
      message('');
    });
    showUser(null);
    setBusy(false);
    if (!configured) {
      message('온라인 로그인 연결을 준비 중입니다. 지금은 기존처럼 로컬에서 사용할 수 있습니다.');
      return;
    }
    try {
      const endpoint = new URL(config.url);
      if (endpoint.protocol !== 'https:' || !endpoint.hostname.endsWith('.supabase.co')) {
        throw new Error('잘못된 Supabase URL');
      }
      if (config.publishableKey.startsWith('sb_secret_')) throw new Error('비공개 키 사용 불가');
      if (!config.publishableKey.startsWith('sb_publishable_')) {
        const claims = JSON.parse(atob(config.publishableKey.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (claims.role !== 'anon') throw new Error('공개 키만 사용 가능');
      }
      const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm');
      client = createClient(config.url, config.publishableKey);
      client.auth.onAuthStateChange((event, session) => {
        if (event === 'INITIAL_SESSION') return;
        if (event === 'PASSWORD_RECOVERY' && session?.user) {
          enterRecovery(session.user);
          return;
        }
        if (!session) clearRecovery();
        showUser(session?.user || null);
      });
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      if (data.session) {
        const verified = await client.auth.getUser();
        if (verified.error) throw verified.error;
        if (recoveryLink || recoveryUserId() === verified.data.user.id) enterRecovery(verified.data.user);
        else showUser(verified.data.user);
      }
      if (incomingHash.get('error')) {
        message(errorText({ code: incomingHash.get('error_code'), message: incomingHash.get('error_description') }));
      } else if (!recovery) {
        message(recoveryLink ? '복구 링크를 확인할 수 없습니다. 새 복구 메일을 요청해주세요.' : '이메일과 비밀번호로 로그인해주세요.');
      }
    } catch (error) {
      client = null;
      clearRecovery();
      showUser(null);
      message('로그인 연결을 완료하지 못했습니다. 연결 설정과 인터넷을 확인한 뒤 새로고침해주세요.');
    } finally {
      setBusy(false);
    }
  }

  return { init };
})();
document.addEventListener('DOMContentLoaded', GeckoAuth.init);
