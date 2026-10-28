/* Sign in and registration (FR-01, FR-02). */
(() => {
  if (AquaAPI.getToken()) location.href = '/';

  const notice = document.getElementById('notice');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');

  const show = (message, kind = 'error') => {
    notice.textContent = message;
    notice.className = `notice show ${kind}`;
  };

  const switchTo = (mode) => {
    const isLogin = mode === 'login';
    loginForm.hidden = !isLogin;
    registerForm.hidden = isLogin;
    tabLogin.classList.toggle('active', isLogin);
    tabRegister.classList.toggle('active', !isLogin);
    notice.className = 'notice';
  };

  tabLogin.addEventListener('click', () => switchTo('login'));
  tabRegister.addEventListener('click', () => switchTo('register'));

  const land = (user) => (location.href = user.role === 'admin' ? '/admin.html' : '/');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const data = await AquaAPI.request('/auth/login', {
        method: 'POST',
        body: {
          email: document.getElementById('login-email').value.trim(),
          password: document.getElementById('login-password').value
        }
      });
      AquaAPI.setSession(data.token, data.user);
      land(data.user);
    } catch (err) {
      show(err.message);
    }
  });

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const data = await AquaAPI.request('/auth/register', {
        method: 'POST',
        body: {
          name: document.getElementById('reg-name').value.trim(),
          email: document.getElementById('reg-email').value.trim(),
          mobile: document.getElementById('reg-mobile').value.trim(),
          password: document.getElementById('reg-password').value
        }
      });
      AquaAPI.setSession(data.token, data.user);
      land(data.user);
    } catch (err) {
      show(err.message);
    }
  });
})();
