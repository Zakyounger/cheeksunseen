const $ = s => document.querySelector(s);
const api = '/api/v1';

async function request(path, opts = {}) {
  const r = await fetch(api + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) }
  });
  let data = {};
  try { data = await r.json(); } catch {}
  if (!r.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function showApp() {
  $('#loginView').classList.add('hidden');
  $('#appView').classList.remove('hidden');
  $('#logout').classList.remove('hidden');
  loadAll().catch(error => console.error('Could not load resources:', error));
}

async function check() {
  try {
    const me = await request('/auth/me');
    if (me.authenticated) showApp();
  } catch (error) {
    console.error('Could not check session:', error);
  }
}
check();

$('#login').onsubmit = async event => {
  event.preventDefault();
  const error = $('#loginError');
  error.textContent = '';
  try {
    await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: $('#username').value,
        password: $('#password').value
      })
    });
    showApp();
  } catch (e) {
    error.textContent = e.message;
    error.className = 'form-error';
  }
};

$('#logout').onclick = async () => {
  try { await request('/auth/logout', { method: 'POST' }); }
  finally { location.reload(); }
};

for (const form of document.querySelectorAll('form[data-type]')) {
  form.onsubmit = async event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    try {
      await request('/' + form.dataset.type, {
        method: 'POST',
        body: JSON.stringify(data)
      });
      form.reset();
      await load(form.dataset.type);
    } catch (error) {
      alert(error.message);
    }
  };
}

$('#tokenForm').onsubmit = async event => {
  event.preventDefault();
  const form = event.target;
  const data = Object.fromEntries(new FormData(form));
  try {
    const result = await request('/tokens', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    $('#tokenOutput').innerHTML = `<div class="token">${esc(result.token)}</div>`;
    form.reset();
    await load('tokens');
  } catch (error) {
    alert(error.message);
  }
};

async function load(type) {
  const rows = await request('/' + type);
  const element = $('#' + type);
  if (type === 'tokens') {
    element.innerHTML = rows.map(item =>
      `<div class="item"><span>${esc(item.name)}${item.revoked ? ' · revoked' : ''}</span>` +
      `${item.revoked ? '' : `<button class="delete" type="button" onclick="revoke(${Number(item.id)})">Revoke</button>`}</div>`
    ).join('');
    return;
  }
  element.innerHTML = rows.map(item =>
    `<div class="item"><span>${esc(item.name || item.title)}${item.version ? ' · ' + esc(item.version) : ''}</span>` +
    `<button class="delete" type="button" onclick="removeItem('${type}',${Number(item.id)})">Delete</button></div>`
  ).join('');
}

async function loadAll() {
  for (const type of ['mods', 'tutorials', 'links', 'contributors', 'tokens']) {
    await load(type);
  }
}

window.removeItem = async (type, id) => {
  if (!confirm('Delete this item?')) return;
  try {
    await request('/' + type + '/' + id, { method: 'DELETE' });
    await load(type);
  } catch (error) { alert(error.message); }
};

window.revoke = async id => {
  try {
    await request('/tokens/' + id + '/revoke', { method: 'POST' });
    await load('tokens');
  } catch (error) { alert(error.message); }
};

function esc(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}
