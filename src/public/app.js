let csrfToken = null;
async function ensureCsrf() {
  if (csrfToken) return csrfToken;
  const r = await fetch('/api/csrf', { credentials: 'include' });
  csrfToken = (await r.json()).token;
  return csrfToken;
}

async function api(url, opts = {}) {
  const method = (opts.method || 'GET').toUpperCase();
  const headers = opts.body instanceof FormData ? {} : { 'Content-Type': 'application/json' };
  if (method !== 'GET' && method !== 'HEAD') {
    headers['X-CSRF-Token'] = await ensureCsrf();
  }
  const res = await fetch('/api' + url, {
    credentials: 'include',
    headers,
    ...opts,
    body: opts.body instanceof FormData ? opts.body : opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) throw await res.json().catch(() => ({ error: res.statusText }));
  return res.json();
}

const $app = document.getElementById('app');
const state = { me: null, projects: [] };

function runWithProgress(container, executor) {
  return new Promise((resolve, reject) => {
    const token = Math.random().toString(36).slice(2) + Date.now();
    const es = new EventSource('/api/analysis/progress/' + token);
    es.onmessage = ev => {
      try {
        const d = JSON.parse(ev.data);
        updateProgressUI(container, d.pct >= 0 ? d.pct : 100, d.stage, d);
      } catch {}
    };
    es.onerror = () => es.close();
    executor(token)
      .then(r => { es.close(); updateProgressUI(container, 100, 'Готово'); resolve(r); })
      .catch(e => { es.close(); updateProgressUI(container, 0, 'Ошибка'); reject(e); });
  });
}

function updateProgressUI(container, pct, label, extra = {}) {
  container.innerHTML = `
    <div style="background:#fff;border:1px solid var(--line);padding:18px 20px;border-radius:2px;margin-top:20px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-size:13px;color:var(--ink)">${esc(label || '')}</div>
        <div style="font-size:13px;font-family:'SF Mono',Menlo,monospace;color:var(--accent);font-weight:bold">${pct}%</div>
      </div>
      <div style="height:6px;background:#e7e2d6;border-radius:3px;overflow:hidden">
        <div style="height:100%;background:var(--accent);width:${pct}%;transition:width .25s ease"></div>
      </div>
      ${extra.done && extra.total ? `<div style="font-size:11px;color:var(--muted);margin-top:8px">${extra.done} из ${extra.total} файлов</div>` : ''}
    </div>`;
}

const go = p => { history.pushState({}, '', p); render(); };
window.addEventListener('popstate', render);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmtDate = d => d ? new Date(d).toLocaleString('ru-RU', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
const fmtShort = d => d ? new Date(d).toLocaleDateString('ru-RU', { day:'2-digit', month:'short', year:'numeric' }) : '—';

function header(active) {
  const m = state.me;
  return `<header class="topbar"><div class="inner">
    <div class="logo-wrap">
      <a href="/" data-link class="logo">code trace</a>
      <span class="logo-sub">экскурсовод по коду</span>
    </div>
    <nav class="nav-links">
      <a href="/projects" data-link class="${active==='projects'?'active':''}">Проекты</a>
      <a href="/history" data-link class="${active==='history'?'active':''}">История анализов</a>
      ${m?.role === 'admin' ? `<a href="/admin" data-link class="${active==='admin'?'active':''}">Админ-панель</a>` : ''}
    </nav>
    <div class="userbox">
      ${m ? `<span><b>${esc(m.login)}</b> · ${m.level === 'beginner' ? 'новичок' : 'опытный'}</span>
      <a href="#" data-logout>Выйти</a>` : `<a href="/login" data-link>Войти</a>`}
    </div>
  </div></header>`;
}

function crumbs(parts = []) {
  if (!parts.length) return '';
  return `<div class="crumbs">
    <a href="/" data-link>← На главную</a>
    ${parts.map(p => `<span class="sep">/</span>` + (p.href
        ? `<a href="${p.href}" data-link>${esc(p.label)}</a>`
        : `<span>${esc(p.label)}</span>`)).join('')}
  </div>`;
}

function footer() {
  return `<footer class="site-footer"><div class="inner">
    <div>
      <div class="brand">code trace</div>
      <div style="font-size:12px;margin-top:4px">экскурсовод по коду · анализ структуры проектов</div>
    </div>
    <nav>
      <a href="/" data-link>Главная</a>
      <a href="/projects" data-link>Проекты</a>
      <a href="/history" data-link>История анализов</a>
    </nav>
    <div class="copyright">© ${new Date().getFullYear()} code trace</div>
  </div></footer>`;
}

document.addEventListener('click', e => {
  const a = e.target.closest('a[data-link]');
  if (a) { e.preventDefault(); go(a.getAttribute('href')); return; }
  if (e.target.closest('[data-logout]')) {
    e.preventDefault();
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
      .finally(() => { state.me = null; csrfToken = null; location.href = '/'; });
  }
});

function pageHome() {
  return header('') + `
  <div class="hero">
    <h1>Добро пожаловать<br>в чужой код</h1>
    <p>Загрузите проект: система построит граф зависимостей, найдёт циклы и составит маршрут изучения с объяснением каждого шага.</p>
    <div class="hero-actions">
      <a href="/new" data-link class="btn btn-primary">Загрузить проект</a>
      <a href="#how" class="btn" data-scroll="how">Как это работает</a>
    </div>
  </div>
  <div class="how-block" id="how"><div class="steps">
    <div><div class="num">01</div><div class="title">Загрузка проекта</div><div class="desc">архив или ссылка</div></div>
    <div><div class="num">02</div><div class="title">Граф зависимостей</div><div class="desc">связи и циклы</div></div>
    <div><div class="num">03</div><div class="title">Маршрут изучения</div><div class="desc">порядок чтения</div></div>
  </div></div>
  <div class="sample-block"><h2>С чего начинается чтение: проект MyApp, запуск 2</h2>
    <div class="sample-cards">
      <div class="sample-card"><div class="lab">01 · центральный файл</div><div class="fname">config.js</div><div class="sub">Его импортируют 5 файлов, поэтому чтение начинается с него.</div></div>
      <div class="sample-card"><div class="lab">02 · цикл зависимостей</div><div class="fname">authService.js ≠ userStore.js</div><div class="sub">Файлы импортируют друг друга и читаются вместе, одним шагом.</div></div>
      <div class="sample-card"><div class="lab">03 · точка входа</div><div class="fname">index.js</div><div class="sub">Его никто не импортирует, поэтому он идёт последним.</div></div>
    </div>
  </div>${footer()}`;
}

document.addEventListener('click', e => {
  const sc = e.target.closest('[data-scroll]');
  if (sc) { e.preventDefault(); const el = document.getElementById(sc.dataset.scroll); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
});

function pageLogin(mode = 'login') {
  return header('') + `<div class="auth-page"><div class="auth-wrap"><div class="card">
    <h1>${mode === 'login' ? 'Вход' : 'Регистрация'}</h1>
    <div id="err"></div>
    <label>Логин</label><input id="login" type="text" autocomplete="username">
    <label>Пароль</label><input id="pwd" type="password">
    ${mode === 'register' ? '<label>Имя</label><input id="name" type="text">' : ''}
    <div class="form-foot">
      <a href="/${mode === 'login' ? 'register' : 'login'}" data-link style="font-size:13px">${mode === 'login' ? 'Создать аккаунт' : 'У меня есть аккаунт'}</a>
      <button class="btn btn-primary" id="submitAuth">${mode === 'login' ? 'Войти' : 'Зарегистрироваться'}</button>
    </div>
    <p style="color:var(--muted);margin-top:20px;font-size:12px">Демо: demo_user / demo</p>
  </div></div></div>${footer()}`;
}
document.addEventListener('click', e => {
  if (e.target.id !== 'submitAuth') return;
  const mode = location.pathname === '/register' ? 'register' : 'login';
  const body = {
    login: document.getElementById('login').value.trim(),
    password: document.getElementById('pwd').value,
    name: document.getElementById('name')?.value.trim(),
  };
  api('/auth/' + mode, { method: 'POST', body })
    .then(() => { csrfToken = null; go('/projects'); })
    .catch(err => { document.getElementById('err').innerHTML = `<div class="error-banner">${esc(err.error)}</div>`; });
});

async function pageNew(mode = 'new', projectId = '') {
  if (!state.projects || !state.projects.length) {
    try { state.projects = await api('/projects'); } catch { state.projects = []; }
  }
  const projects = state.projects || [];
  const current = projects.find(p => String(p.id) === String(projectId));
  const repoValue = current?.repository_url || '';
  const tabs = `<div class="tabs">
    <button class="${mode==='repeat'?'active':''}" data-newmode="repeat">Повторный анализ</button>
    <button class="${mode==='new'?'active':''}" data-newmode="new">Новый проект</button>
  </div>`;
  const repeatBlock = `
    <label>Проект</label>
    <select id="projSel"><option value="">— выберите —</option>
      ${projects.map(p => `<option value="${p.id}" ${String(projectId)===String(p.id)?'selected':''}>${esc(p.name)} (${p.runs} запусков)</option>`).join('')}
    </select>
    <label>Ссылка на репозиторий (необязательно)</label>
    <input id="projRepo" type="url" placeholder="https://github.com/example/my-app" value="${esc(repoValue)}">
    <div class="hint">Если указана ссылка — скачаем заново. Иначе выберите архив ниже.</div>`;
  const newBlock = `
    <label>Проект</label><input id="projName" type="text" placeholder="MyApp">
    <label>Ссылка на репозиторий (необязательно)</label>
    <input id="projRepo" type="url" placeholder="https://github.com/example/my-app">
    <div class="hint">Если ссылка указана, архив не нужен — скачаем сами.</div>`;
  return header('projects') + crumbs([{ label: 'Проекты', href: '/projects' }, { label: 'Новый анализ' }]) + `
  <div class="page">
    <h1 style="font-family:var(--font-serif);font-size:44px;font-weight:normal;margin:8px 0 20px">Что анализируем?</h1>
    <p style="color:var(--muted);max-width:680px;margin:0 0 30px">Выберите проект из списка или укажите новое название. Каждый запуск сохраняется отдельно, поэтому результаты можно сравнивать. Исходный код не сохраняется: после разбора он удаляется, остаются только пути, имена файлов и связи.</p>
    <div class="card">
      ${tabs}
      <div id="err"></div>
      ${mode === 'repeat' ? repeatBlock : newBlock}
      <div data-file-block>
        <label>${mode === 'new' ? 'Или архив проекта' : 'Или архив проекта (.zip)'}</label>
        <div class="dropzone" id="dropzone"><span id="dz-text">Перетащите архив сюда или выберите файл</span>
          <input type="file" id="archiveFile" accept=".zip,application/zip" style="display:none"></div>
      </div>
      <div class="form-foot">
        <div style="font-size:13px">Уровень: <b>${state.me?.level === 'experienced' ? 'ОПЫТНЫЙ' : 'НОВИЧОК'}</b> из профиля</div>
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <button class="btn" id="runDemo">Демо-анализ MyApp</button>
          <button class="btn btn-primary" id="runAnalysis">Запустить анализ</button>
        </div>
      </div>
    </div>
  </div>${footer()}`;
}

document.addEventListener('input', e => {
  if (e.target.id === 'projRepo') {
    const block = document.querySelector('[data-file-block]');
    if (block) block.style.display = e.target.value.trim() ? 'none' : '';
  }
});

document.addEventListener('click', e => {
  const nm = e.target.closest('[data-newmode]');
  if (nm) { go('/new' + (nm.dataset.newmode === 'repeat' ? '?mode=repeat' : '')); return; }
  if (e.target.closest('#dropzone')) { document.getElementById('archiveFile')?.click(); return; }
  if (e.target.id === 'runDemo') {
    e.target.disabled = true; e.target.textContent = 'Идёт анализ…';
    api('/analysis/run-demo', { method: 'POST' }).then(r => go('/analysis/' + r.analysisId))
      .catch(err => { e.target.disabled = false; e.target.textContent = 'Демо-анализ MyApp';
        document.getElementById('err').innerHTML = `<div class="error-banner">${esc(err.error)}</div>`; });
    return;
  }
  if (e.target.id === 'runAnalysis') {
    const mode = location.search.includes('mode=repeat') ? 'repeat' : 'new';
    const repo = document.getElementById('projRepo')?.value.trim() || '';
    const file = document.getElementById('archiveFile').files[0];
    let projectId = null;
    if (mode === 'repeat') {
      projectId = document.getElementById('projSel').value;
      if (!projectId) return alert('Выберите проект');
    }
    let projectName = null;
    if (mode === 'new') {
      projectName = document.getElementById('projName').value.trim();
      if (!projectName) return alert('Укажите название проекта');
    }
    const container = document.getElementById('err');
    container.innerHTML = '';
    if (repo && !file) {
      const body = { repositoryUrl: repo };
      if (projectId) body.projectId = projectId;
      if (projectName) body.projectName = projectName;
      e.target.disabled = true; e.target.textContent = 'Скачиваем…';
      runWithProgress(container, token => { body.token = token; return api('/analysis/run-url', { method: 'POST', body }); })
        .then(r => go('/analysis/' + r.analysisId))
        .catch(err => { e.target.disabled = false; e.target.textContent = 'Запустить анализ';
          container.innerHTML = `<div class="error-banner">${esc(err.error)}</div>`; });
      return;
    }
    if (file) {
      const form = new FormData();
      if (projectId) form.append('projectId', projectId);
      if (projectName) form.append('projectName', projectName);
      if (repo) form.append('repositoryUrl', repo);
      form.append('archive', file);
      e.target.disabled = true; e.target.textContent = 'Идёт анализ…';
      runWithProgress(container, token => { form.append('token', token); return api('/analysis/run', { method: 'POST', body: form }); })
        .then(r => go('/analysis/' + r.analysisId))
        .catch(err => { e.target.disabled = false; e.target.textContent = 'Запустить анализ';
          container.innerHTML = `<div class="error-banner">${esc(err.error)}</div>`; });
      return;
    }
    return alert('Укажите GitHub-ссылку или выберите архив');
  }
});

document.addEventListener('change', e => {
  if (e.target.id === 'archiveFile') {
    const f = e.target.files[0];
    document.getElementById('dz-text').textContent = f ? `Выбран: ${f.name} (${(f.size/1024).toFixed(0)} КБ)` : 'Перетащите архив сюда или выберите файл';
  }
});

async function pageProjects() {
  const projects = await api('/projects');
  state.projects = projects;
  const totalRuns = projects.reduce((s,p) => s + p.runs, 0);
  return header('projects') + crumbs([]) + `<div class="page">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:30px;flex-wrap:wrap;gap:12px">
      <h1 style="font-family:var(--font-serif);font-size:40px;font-weight:normal;margin:0">Мои проекты</h1>
      <a href="/new" data-link class="btn btn-primary">Новый анализ</a>
    </div>
    <div class="stats-row">
      <div class="stat-card"><div class="big">${projects.length}</div><div class="lbl">проектов</div></div>
      <div class="stat-card"><div class="big">${totalRuns}</div><div class="lbl">запусков</div></div>
      <div class="stat-card"><div class="big">${projects.filter(p => p.last_status === 'completed').length}</div><div class="lbl">завершено</div></div>
      <div class="stat-card"><div class="lbl">Уровень подготовки</div>
        <div class="level-switch">
          <button data-level="beginner" class="${state.me.level==='beginner'?'active':''}">НОВИЧОК</button>
          <button data-level="experienced" class="${state.me.level==='experienced'?'active':''}">ОПЫТНЫЙ</button>
        </div>
        <div class="hint">Влияет на порядок маршрута</div>
      </div>
    </div>
    ${projects.length ? `<table>
      <thead><tr><th>Название</th><th>Репозиторий</th><th>Добавлен</th><th>Запусков</th><th>Последний запуск</th></tr></thead>
      <tbody>${projects.map(p => `<tr>
        <td><a href="/project/${p.id}" data-link style="font-weight:bold;text-decoration:underline">${esc(p.name)}</a></td>
        <td>${esc((p.repository_url || '—').replace(/^https?:\/\//,''))}</td>
        <td>${fmtShort(p.created_at)}</td>
        <td>${p.runs}</td>
        <td><span class="status-${p.last_status || 'completed'}">● ${p.last_status || '—'}</span> ${p.last_run ? fmtDate(p.last_run) : ''}</td>
      </tr>`).join('')}</tbody>
    </table>` : `<div class="empty-hint"><h3>Пока нет проектов</h3><p>Загрузите первый архив или укажите GitHub-ссылку, чтобы построить граф и маршрут.</p><a href="/new" data-link class="btn btn-primary" style="margin-top:12px">Новый анализ</a></div>`}
    <p style="color:var(--muted);font-size:12px;margin-top:16px">Новый проект создаётся при новом анализе: укажите его название.</p>
  </div>${footer()}`;
}
document.addEventListener('click', e => {
  const lv = e.target.closest('[data-level]');
  if (lv) api('/auth/level', { method: 'PATCH', body: { level: lv.dataset.level } })
    .then(() => { state.me.level = lv.dataset.level; render(); })
    .catch(err => alert(err.error));
});

async function pageProject(id) {
  const data = await api('/projects/' + id);
  const { project, runs } = data;
  const last = runs[0];
  const prev = runs[1];
  return header('projects') + crumbs([{ label: 'Проекты', href: '/projects' }, { label: project.name }]) + `<div class="page">
    <h1 style="font-family:var(--font-serif);font-size:40px;font-weight:normal;margin:0 0 8px">${esc(project.name)}</h1>
    <p style="color:var(--muted);margin:0 0 24px">${esc(project.repository_url || '—')}</p>
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:32px">
      <a href="/new?mode=repeat&project=${project.id}" data-link class="btn btn-primary">Повторный анализ</a>
      ${last ? `<a href="/analysis/${last.id}" data-link class="btn">Открыть результаты →</a>` : ''}
      ${(last && prev) ? `<a href="/analysis/${last.id}/diff/${prev.id}" data-link class="btn">Сравнить запуски →</a>` : ''}
      <button class="btn btn-danger" data-del-project="${project.id}">Удалить проект</button>
    </div>
    <h2 class="section-title">Запуски анализа</h2>
    ${runs.length ? `<table><thead><tr><th>#</th><th>Дата</th><th>Статус</th><th></th></tr></thead>
      <tbody>${runs.map(r => `<tr><td>${r.id}</td><td>${fmtDate(r.analyzed_at)}</td>
        <td><span class="status-${r.status}">● ${r.status}</span></td>
        <td><a href="/analysis/${r.id}" data-link class="btn btn-sm">Открыть</a></td></tr>`).join('')}</tbody></table>` : '<p style="color:var(--muted)">Нет запусков</p>'}
  </div>${footer()}`;
}
document.addEventListener('click', async e => {
  if (e.target.dataset.delProject) {
    if (!confirm('Удалить проект со всеми запусками?')) return;
    await api('/projects/' + e.target.dataset.delProject, { method: 'DELETE' });
    go('/projects');
  }
});

async function pageHistory() {
  const projects = await api('/projects');
  const allRuns = [];
  for (const p of projects) {
    const d = await api('/projects/' + p.id);
    d.runs.forEach(r => allRuns.push({ ...r, projectId: p.id, projectName: p.name }));
  }
  allRuns.sort((a,b) => b.id - a.id);
  return header('history') + crumbs([{ label: 'История анализов' }]) + `<div class="page">
    <h1 style="font-family:var(--font-serif);font-size:40px;font-weight:normal;margin:0 0 20px">История анализов</h1>
    ${allRuns.length ? `<table><thead><tr><th>#</th><th>Проект</th><th>Дата</th><th>Статус</th><th></th></tr></thead>
      <tbody>${allRuns.map(r => `<tr><td>${r.id}</td>
        <td><a href="/project/${r.projectId}" data-link style="text-decoration:underline">${esc(r.projectName)}</a></td>
        <td>${fmtDate(r.analyzed_at)}</td>
        <td><span class="status-${r.status}">● ${r.status}</span></td>
        <td><a href="/analysis/${r.id}" data-link class="btn btn-sm">Открыть</a></td></tr>`).join('')}</tbody></table>` : `<div class="empty-hint"><h3>Пока нет запусков</h3><a href="/new" data-link class="btn btn-primary" style="margin-top:12px">Новый анализ</a></div>`}
  </div>${footer()}`;
}

function getRouteGroup(text) {
  if (text.includes('Начните с подтверждённой точки входа')) {
    return 'entry';
  }

  if (text.includes('Возможная точка входа')) {
    return 'candidate';
  }

  if (text.includes('Изучите центральный файл')) {
    return 'hub';
  }

  if (text.includes('Прочитайте вместе')) {
    return 'cycle';
  }

  if (text.includes('Завершите чтение')) {
    return 'leaf';
  }

  return 'other';
}

function getRouteFiles(step) {
  const text = step.text;
  const group = getRouteGroup(text);

  if (group === 'entry') {
    return [text.replace('Начните с подтверждённой точки входа ', '').split(': package.json')[0]];
  }

  if (group === 'candidate') {
    return [text.replace('Возможная точка входа ', '').split(':')[0]];
  }

  if (group === 'hub') {
    return [text.replace('Изучите центральный файл ', '').split(':')[0]];
  }

  if (group === 'cycle') {
    return text.replace('Прочитайте вместе ', '').split(':')[0].split(' и ');
  }

  if (group === 'leaf') {
    return text.replace('Завершите чтение: ', '').split(' (')[0].split(', ');
  }

  if (group === 'other') {
    return text.replace('Далее изучите ', '').split(', ');
  }

  return [];
}

function getRouteGroupLabel(group) {
  const labels = {
    entry: 'подтверждённые точки входа',
    candidate: 'возможные точки входа',
    hub: 'центральные',
    cycle: 'циклы',
    other: 'остальные файлы',
    leaf: 'листья',
  };

  return labels[group] || 'остальные файлы';
}

async function pageAnalysis(id, tab = 'graph') {
  const data = await api('/analysis/' + id);
  const { files, links, route, project, results, rules, analysis } = data;
  const problems = results.filter(r => r.result_type === 'problem');
  const groupOf = {};
    for (const step of route.steps) {
    const group = getRouteGroup(step.text);
    const paths = getRouteFiles(step);

    paths.forEach(path => {
        groupOf[path] = group;
    });
    }
  const tabsHtml = `<div class="tabs-line">
    <button data-tab="graph" class="${tab==='graph'?'active':''}">Граф зависимостей</button>
    <button data-tab="problems" class="${tab==='problems'?'active':''}">Архитектурные проблемы ${problems.length}</button>
    <button data-tab="route" class="${tab==='route'?'active':''}">Маршрут изучения ${route.steps.length}</button>
    <button data-tab="rules" class="${tab==='rules'?'active':''}">Применённые правила ${rules.length}</button>
  </div>`;
  const headHtml = `<div class="analysis-head"><div class="inner">
    <div><a href="/projects" data-link>Проекты</a> / <a href="/project/${analysis.project_id}" data-link>${esc(project.name)}</a> / Запуск ${id}</div>
    <div class="right"><span class="status-${analysis.status}">● ${analysis.status}</span><span>${fmtDate(analysis.analyzed_at)}</span></div>
  </div></div>`;
  let leftContent = '';
  if (tab === 'graph') leftContent = renderGraph(files, links, groupOf, id);
  else if (tab === 'problems') leftContent = renderProblems(problems);
  else if (tab === 'route') leftContent = renderRouteList(route, id);
  else if (tab === 'rules') leftContent = renderRules(rules);
  return header('projects') + headHtml + tabsHtml + `
    <div class="analysis-grid">
      <div class="left">${leftContent}</div>
      <div class="right route-pane">
        <h2>Маршрут изучения <span class="level-tag">${state.me.level === 'beginner' ? 'новичок' : 'опытный'}</span></h2>
        <p style="font-size:11px;color:var(--muted);margin:0 0 16px;letter-spacing:.04em">правила работают по графу — независимо от языка файлов</p>
        <div class="route-list">${route.steps.map((s, i) => `
          <div class="route-item ${i===0?'active':''}">
            <div class="n">${i+1}</div>
            <div class="body">
              <div class="text">${esc(s.text)}</div>
              <div class="sub">${getRouteGroup(s.text)}</div>
            </div>
          </div>`).join('')}
        </div>
        <a href="/analysis/${id}/step/0" data-link class="route-open">Открыть первый шаг →</a>
      </div>
    </div>${footer()}`;
}

function renderGraph(files, links, groupOf, analysisId) {
  const groups = [
    'entry',
    'candidate',
    'hub',
    'cycle',
    'other',
    'leaf',
    ];

    const byGroup = {
    entry: [],
    candidate: [],
    hub: [],
    cycle: [],
    other: [],
    leaf: [],
    };

  files.forEach(f => byGroup[groupOf[f.path] || 'other'].push(f));
  const LAYER_H = 110, NODE_W = 150, NODE_H = 40, GAP_X = 30, PAD_X = 30;
  const layers = groups.filter(g => byGroup[g].length);
  const maxInLayer = Math.max(...layers.map(g => byGroup[g].length), 1);
  const totalW = Math.max(700, PAD_X*2 + maxInLayer * (NODE_W + GAP_X) - GAP_X);
  const totalH = Math.max(360, layers.length * LAYER_H + 40);
  const pos = {};
  layers.forEach((g, li) => {
    const list = byGroup[g];
    const rowW = list.length * (NODE_W + GAP_X) - GAP_X;
    const startX = (totalW - rowW) / 2;
    list.forEach((f, i) => {
      const x = startX + i * (NODE_W + GAP_X);
      const y = 20 + li * LAYER_H;
      pos[f.path] = { x, y, group: g, cx: x + NODE_W/2, cy: y + NODE_H/2 };
    });
  });
  const byId = {}; files.forEach(f => byId[f.id] = f);
  const edges = links.map(l => {
    const a = byId[l.source_file_id], b = byId[l.target_file_id];
    if (!a || !b || !pos[a.path] || !pos[b.path]) return '';
    const A = pos[a.path], B = pos[b.path];
    const isCycle = A.group === 'cycle' && B.group === 'cycle';
    return `<line data-edge-from="${a.path}" data-edge-to="${b.path}" data-cycle="${isCycle}" class="edge ${isCycle?'cycle':''}" x1="${A.cx}" y1="${A.cy}" x2="${B.cx}" y2="${B.cy}"/>`;
  }).join('');
  const nodes = files.map(f => {
    const p = pos[f.path]; if (!p) return '';
    return `<g class="node" data-node="${f.path}" data-group="${p.group}" transform="translate(${p.x},${p.y})">
      <rect class="graph-node ${p.group}" width="${NODE_W}" height="${NODE_H}" rx="2"/>
      <text x="10" y="${NODE_H/2 + 4}">${esc(f.name)}</text>
    </g>`;
  }).join('');
  return `<div class="toolbar">
    <button data-mode="all" class="active">Все связи</button>
    <button data-mode="cycle">Циклы</button>
    <button data-mode="hub">Центральные</button>
    <span class="meta">${files.length} файлов · ${links.length} связей</span>
  </div>
  <div class="graph-wrap"><svg class="graph" viewBox="0 0 ${totalW} ${totalH}" preserveAspectRatio="xMidYMin meet">
    <defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#b8b0a1"/></marker></defs>
    ${edges}${nodes}
  </svg></div>
  <div class="legend"><span>→ файл импортирует файл</span><span style="color:var(--accent)">- - → цикл</span><span>■ центральный файл</span></div>`;
}

function renderProblems(problems) {
  if (!problems.length) return '<p style="color:var(--muted)">Проблем не найдено 🎉</p>';
  return problems.map(p => `<div class="rule-card fired">
    <div class="rule-head"><span class="rule-code">R2_CYCLE</span><span class="rule-status fired">проблема</span></div>
    <div class="rule-text">${esc(p.description)}</div></div>`).join('');
}

function renderRouteList(route, analysisId) {
  return `<div>${route.steps.map((s, i) => `
    <div class="route-item">
      <div class="n">${i + 1}</div>
      <div class="body" style="flex:1">
        <div class="text">${esc(s.text)}</div>
        <div class="sub">${getRouteGroupLabel(getRouteGroup(s.text))}</div>
      </div>
      <a href="/analysis/${analysisId}/step/${i}" data-link class="btn btn-sm">Открыть</a>
    </div>`).join('')}</div>`;
}

function renderRules(rules) {
  if (!rules.length) return '<p style="color:var(--muted)">Журнал пуст</p>';
  return rules.map(r => `<div class="rule-card fired">
    <div class="rule-head"><span class="rule-code">${esc(r.rule_code)}</span><span class="rule-status fired">сработало</span></div>
    <div class="rule-text">${esc(r.result_description)}</div></div>`).join('');
}

document.addEventListener('click', e => {
  const tb = e.target.closest('[data-tab]');
  if (tb) { const id = location.pathname.match(/\d+/)[0]; go(`/analysis/${id}?tab=${tb.dataset.tab}`); return; }
  const mode = e.target.closest('[data-mode]');
  if (mode) {
    document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('active', b === mode));
    const m = mode.dataset.mode;
    document.querySelectorAll('[data-node]').forEach(n => {
      const match = m === 'all' || (m === 'hub' && n.dataset.group === 'hub') || (m === 'cycle' && n.dataset.group === 'cycle');
      n.classList.toggle('dimmed', !match);
    });
    document.querySelectorAll('[data-edge-from]').forEach(ed => {
      const match = m === 'all' || (m === 'cycle' && ed.dataset.cycle === 'true');
      ed.classList.toggle('dimmed', !match);
    });
    return;
  }
  const node = e.target.closest('[data-node]');
  if (node) {
    const path = node.dataset.node;
    const id = location.pathname.match(/\d+/)[0];
    api('/analysis/' + id).then(d => {
      const idx = d.route.steps.findIndex(s => s.text.includes(path.split('/').pop()));
      go(`/analysis/${id}/step/${idx >= 0 ? idx : 0}`);
    });
  }
});

async function pageStep(id, idx) {
  const data = await api('/analysis/' + id);
  const step = data.route.steps[idx];
  if (!step) return header('projects') + '<div class="page"><p>Шаг не найден</p></div>' + footer();
    const filePaths = getRouteFiles(step);
  const fileObjs = data.files.filter(f => filePaths.includes(f.path));
  const primary = fileObjs[0] || data.files[0];
  const byId = {}; data.files.forEach(f => byId[f.id] = f);
  const inLinks = data.links.filter(l => l.target_file_id === primary.id);
  const outLinks = data.links.filter(l => l.source_file_id === primary.id);
  const inList = inLinks.map(l => byId[l.source_file_id].name);
  const outList = outLinks.map(l => byId[l.target_file_id].name);
  const group = getRouteGroup(step.text);
  const isCycle = group === 'cycle';
  const isHub = group === 'hub';
  const isLeaf = group === 'leaf';
  const isEntry = group === 'entry';
  const isCandidate = group === 'candidate';
  const r4Rule = data.rules.find(r => r.rule_code === 'R4_LEVEL');
  
  const ruleCards = [
    {
        code: 'R7_PACKAGE_ENTRY',
        fired: isEntry,
        text: isEntry
        ? `Подтверждённая точка входа: ${filePaths.join(', ')}. Путь указан в package.json.`
        : 'Шаг не относится к подтверждённым точкам входа.',
    },
    {
        code: 'R6_ENTRY',
        fired: isCandidate,
        text: isCandidate
        ? `Возможная точка входа: ${filePaths.join(', ')}. На файл нет входящих связей, но он использует другие файлы.`
        : 'Шаг не относится к предполагаемым точкам входа.',
    },
    {
        code: 'R1_HUB',
        fired: isHub,
        text: isHub
        ? `Центральный файл: входящих связей ${inLinks.length}.`
        : 'Файл не классифицирован как центральный.',
    },
    {
        code: 'R2_CYCLE',
        fired: isCycle,
        text: isCycle
        ? `Найден цикл: ${filePaths.join(' <-> ')}. Файлы цикла объединены в один шаг.`
        : 'Файл не входит в цикл.',
    },
    {
        code: 'R5_LEAF',
        fired: isLeaf,
        text: isLeaf
        ? `Файл не импортирует другие файлы: исходящих связей ${outLinks.length}. Поставлен в конец маршрута.`
        : 'Файл не классифицирован как лист графа.',
    },
    {
        code: 'R4_LEVEL',
        fired: true,
        text: r4Rule?.result_description || 'Порядок групп выбран по уровню пользователя.',
    },
    ];

  const desc = (isCycle && fileObjs.length > 1)
    ? `Файл входит в цикл с ${fileObjs.slice(1).map(f=>esc(f.name)).join(' и ')}: они импортируют друг друга, поэтому читать их нужно вместе.`
    : esc(step.text);
  return header('projects') + crumbs([
    { label: 'Проекты', href: '/projects' },
    { label: data.project.name, href: `/project/${data.analysis.project_id}` },
    { label: `Запуск ${id}`, href: `/analysis/${id}` },
    { label: `Шаг ${idx+1}` },
  ]) + `
  <div class="step-hero">
    <div class="lab">Шаг ${idx+1} из ${data.route.steps.length} · ${getRouteGroupLabel(group)}</div>
    <h1>${fileObjs.map(f => esc(f.name)).join(' · ')}</h1>
    <div class="path">${fileObjs.map(f => esc(f.path)).join(', ')}</div>
    <p class="desc">${desc}</p>
  </div>
  <div class="step-body">
    <div class="step-col">
      <h3>Импортирует · ${outLinks.length}</h3>
      <ul class="step-list">${outList.map(n => `<li>${esc(n)}</li>`).join('') || '<li style="color:var(--muted)">—</li>'}</ul>
      <h3 style="margin-top:28px">Импортируется · ${inLinks.length}</h3>
      <ul class="step-list">${inList.map(n => `<li>${esc(n)}</li>`).join('') || '<li style="color:var(--muted)">—</li>'}</ul>
    </div>
    <div class="step-col">
      <h3>Факты</h3>
      <div class="facts-grid">
        <div class="fact"><div class="k">входящих</div><div class="v">${inLinks.length}</div></div>
        <div class="fact"><div class="k">исходящих</div><div class="v">${outLinks.length}</div></div>
        <div class="fact"><div class="k">группа</div><div class="v" style="font-size:16px">${getRouteGroupLabel(group)}</div></div>
      </div>
    </div>
  </div>
  <div class="rules-block"><h3>Почему он в маршруте</h3>
    ${ruleCards.map(r => `<div class="rule-card ${r.fired?'fired':''}">
      <div class="rule-head"><span class="rule-code">${r.code}</span><span class="rule-status ${r.fired?'fired':''}">${r.fired ? 'сработало' : 'не сработало'}</span></div>
      <div class="rule-text">${esc(r.text)}</div>
    </div>`).join('')}
  </div>
  <div class="pager">
    <a href="${idx>0?`/analysis/${id}/step/${idx-1}`:`/analysis/${id}`}" data-link>← ${idx>0?`Шаг ${idx}`:'К обзору'}</a>
    <a href="${idx<data.route.steps.length-1?`/analysis/${id}/step/${idx+1}`:`/analysis/${id}`}" data-link>${idx<data.route.steps.length-1?`Шаг ${idx+2} →`:'К обзору →'}</a>
  </div>${footer()}`;
}

async function pageDiff(id, compareId) {
  const data = await api('/analysis/' + id);
  const projectRuns = await api('/projects/' + data.analysis.project_id);
  const runs = projectRuns.runs;
  let left = compareId ? Number(compareId) : null;
  if (!left) { const i = runs.findIndex(r => r.id === Number(id)); if (i >= 0 && i + 1 < runs.length) left = runs[i + 1].id; }
  if (!left) return header('projects') + `<div class="page"><div class="empty-hint"><h3>Нет предыдущего запуска</h3><p>Сравнивать пока не с чем.</p><a href="/analysis/${id}" data-link class="btn btn-primary" style="margin-top:12px">К анализу</a></div></div>${footer()}`;
  const d = await api(`/analysis/compare/${left}/${id}`);
  const big = (cur, prev) => `<div class="big">${prev}<span class="arrow">→</span><span class="to">${cur}</span></div>`;
  const list = (arr, cls) => arr.length ? arr.map(x => `<li class="${cls}">${esc(x)}</li>`).join('') : '<li style="color:var(--muted)">—</li>';
  return header('projects') + crumbs([
    { label: 'Проекты', href: '/projects' },
    { label: data.project.name, href: `/project/${data.analysis.project_id}` },
    { label: `Запуски ${left} → ${id}` },
  ]) + `<div class="page">
    <h1 style="font-family:var(--font-serif);font-size:40px;font-weight:normal;margin:0 0 8px">Что изменилось</h1>
    <p style="color:var(--muted);margin:0 0 24px">Проект ${esc(data.project.name)} · запуск ${left} → запуск ${id}</p>
    <div class="diff-grid">
      <div class="diff-card"><div class="lbl">файлов</div>${big(d.right.files.length, d.left.files.length)}</div>
      <div class="diff-card"><div class="lbl">связей</div>${big(d.right.links.length, d.left.links.length)}</div>
      <div class="diff-card"><div class="lbl">циклов</div>${big(d.right.problems.length, d.left.problems.length)}</div>
    </div>
    <div class="diff-section"><h3>Проблемы</h3><ul class="diff-list">${list(d.problems.removed,'added')}${list(d.problems.added,'removed')}</ul></div>
    <div class="diff-section"><h3>Новые файлы</h3><ul class="diff-list">${list(d.files.added,'added')}</ul></div>
    <div class="diff-section"><h3>Связи</h3><ul class="diff-list">${list(d.links.added,'added')}${list(d.links.removed,'removed')}</ul></div>
    <div class="diff-section"><h3>Центральные файлы</h3><ul class="diff-list">${list(d.hubs.added,'added')}${list(d.hubs.removed,'removed')}</ul></div>
    <div class="diff-section"><h3>Применённые правила</h3><ul class="diff-list">${list(d.rules.added,'added')}${list(d.rules.removed,'removed')}</ul></div>
    <div class="diff-actions">
      <a href="/analysis/${id}" data-link class="btn">Открыть запуск ${id} →</a>
      <a href="/project/${data.analysis.project_id}" data-link class="btn">Сравнить другие запуски</a>
    </div>
  </div>${footer()}`;
}

async function pageAdmin() {
  const s = await api('/admin/stats');
  const maxRule = Math.max(...s.ruleStats.map(r => r.n), 1);
  const chart = s.ruleStats.map(r => {
    const pct = (r.n / maxRule) * 100;
    return `<div class="chart-row"><div class="lab">${esc(r.rule_code)}</div>
      <div class="bar"><span class="${r.n===maxRule?'highlight':''}" style="width:${pct}%"></span></div>
      <div class="val">${r.n}</div></div>`;
  }).join('');
  return header('admin') + crumbs([{ label: 'Админ-панель' }]) + `<div class="page">
    <h1 style="font-family:var(--font-serif);font-size:40px;font-weight:normal;margin:0 0 20px">Панель администратора</h1>
    <div class="stats-row">
      <div class="stat-card"><div class="big">${s.counts.users}</div><div class="lbl">пользователя</div></div>
      <div class="stat-card"><div class="big">${s.counts.projects}</div><div class="lbl">проекта</div></div>
      <div class="stat-card"><div class="big">${s.counts.analyses}</div><div class="lbl">запуска</div></div>
      <div class="stat-card"><div class="big">${s.runs.filter(r=>r.status==='failed').length}</div><div class="lbl">с ошибкой</div></div>
    </div>
    <h2 class="section-title">Срабатывания правил</h2>
    <div class="chart">${chart || '<p style="color:var(--muted)">Нет данных</p>'}</div>
    <p style="color:var(--muted);font-size:12px;margin-top:12px">Правила заданы в программном модуле и здесь только отображаются.</p>
    <h2 class="section-title">Пользователи</h2>
    <table><thead><tr><th>Логин</th><th>Имя</th><th>Уровень</th><th>Роль</th><th></th></tr></thead>
    <tbody>${s.users.map(u => `<tr>
      <td>${esc(u.login)}</td><td>${esc(u.name)}</td>
      <td><select data-usr-level="${u.id}"><option value="beginner" ${u.level==='beginner'?'selected':''}>beginner</option><option value="experienced" ${u.level==='experienced'?'selected':''}>experienced</option></select></td>
      <td><select data-usr-role="${u.id}" ${u.id===state.me.id?'disabled':''}><option value="user" ${u.role==='user'?'selected':''}>user</option><option value="admin" ${u.role==='admin'?'selected':''}>admin</option></select></td>
      <td>${u.id!==state.me.id ? `<button class="btn btn-sm btn-danger" data-usr-del="${u.id}">Удалить</button>` : '<span style="color:var(--muted)">вы</span>'}</td>
    </tr>`).join('')}</tbody></table>
    <h2 class="section-title">Запуски анализа</h2>
    <table><thead><tr><th>#</th><th>Проект</th><th>Дата</th><th>Статус</th><th></th></tr></thead>
    <tbody>${s.runs.map(r => `<tr><td>${r.id}</td><td>${esc(r.project)}</td><td>${fmtDate(r.analyzed_at)}</td>
      <td><span class="status-${r.status}">● ${r.status}</span></td>
      <td><button class="btn btn-sm btn-danger" data-an-del="${r.id}">Удалить</button></td></tr>`).join('')}</tbody></table>
  </div>${footer()}`;
}
document.addEventListener('change', async e => {
  const lv = e.target.dataset.usrLevel, rl = e.target.dataset.usrRole;
  if (lv) await api('/admin/users/' + lv, { method: 'PATCH', body: { level: e.target.value } });
  if (rl) await api('/admin/users/' + rl, { method: 'PATCH', body: { role: e.target.value } });
});
document.addEventListener('click', async e => {
  if (e.target.dataset.usrDel) { if (!confirm('Удалить пользователя?')) return; await api('/admin/users/' + e.target.dataset.usrDel, { method: 'DELETE' }); go('/admin'); }
  if (e.target.dataset.anDel) { if (!confirm('Удалить запуск анализа?')) return; await api('/admin/analysis/' + e.target.dataset.anDel, { method: 'DELETE' }); go('/admin'); }
});

async function render() {
  const path = location.pathname;
  const qs = new URLSearchParams(location.search);
  try { state.me = await api('/auth/me'); } catch { state.me = null; }
  let html;
  try {
    if (path === '/' || path === '/index.html') html = pageHome();
    else if (path === '/login') html = pageLogin('login');
    else if (path === '/register') html = pageLogin('register');
    else if (path === '/new') html = state.me ? await pageNew(qs.get('mode') === 'repeat' ? 'repeat' : 'new', qs.get('project')) : pageLogin();
    else if (path === '/projects') html = state.me ? await pageProjects() : pageLogin();
    else if (path === '/history') html = state.me ? await pageHistory() : pageLogin();
    else if (path === '/admin') html = state.me?.role === 'admin'
      ? await pageAdmin()
      : header('') + '<div class="page"><div class="empty-hint"><h3>404 – страница не найдена</h3><a href="/" data-link class="btn btn-primary" style="margin-top:12px">На главную</a></div></div>' + footer();
    else if (path.match(/^\/project\/(\d+)$/)) html = state.me ? await pageProject(path.match(/\d+/)[0]) : pageLogin();
    else if (path.match(/^\/analysis\/(\d+)$/)) html = state.me ? await pageAnalysis(path.match(/\d+/)[0], qs.get('tab') || 'graph') : pageLogin();
    else if (path.match(/^\/analysis\/(\d+)\/step\/(\d+)$/)) { const m = path.match(/^\/analysis\/(\d+)\/step\/(\d+)$/); html = state.me ? await pageStep(m[1], +m[2]) : pageLogin(); }
    else if (path.match(/^\/analysis\/(\d+)\/diff(?:\/(\d+))?$/)) { const m = path.match(/^\/analysis\/(\d+)\/diff(?:\/(\d+))?$/); html = state.me ? await pageDiff(m[1], m[2]) : pageLogin(); }
    else html = header('') + '<div class="page"><div class="empty-hint"><h3>404 — страница не найдена</h3><a href="/" data-link class="btn btn-primary" style="margin-top:12px">На главную</a></div></div>' + footer();
  } catch (e) {
    html = header('') + `<div class="page"><div class="error-banner">${esc(e.error || e.message)}</div><a href="/projects" data-link>← К проектам</a></div>` + footer();
  }
  $app.innerHTML = html;
}
render();
