'use strict';
/**
 * База знаний системы «экскурсовод по коду» (лабораторная версия).
 * Модель знаний: продукционная (ЕСЛИ условие, ТО вывод).
 * Правила R1, R2, R4, R5. Правило R3 (цель пользователя) планируется для ВКР.
 *
 * Вход:  граф проекта (files, links) и уровень пользователя.
 * Выход: { results, steps, problems, log } — то, что записывается в таблицы
 *        analysis_result (проблемы и шаги маршрута) и applied_rule (журнал).
 */

// ---------- 1. Параметры (пороги и политики) ----------
const CONFIG = {
  HUB_MIN_IN: 8,         // R1: порог входящих связей для центрального файла
  HUB_TOP_PERCENT: 10,   // R1: либо верхние N% файлов по входящим связям...
  HUB_TOP_MIN_IN: 3,     // ...но не меньше стольких входящих связей
  // R4: порядок групп файлов в маршруте для каждого уровня
  ORDER: {
    beginner: [
        'entry',
        'candidate',
        'hub',
        'cycle',
        'other',
        'leaf',
    ],
    experienced: [
        'cycle',
        'entry',
        'candidate',
        'hub',
        'other',
        'leaf',
    ],
    },
  LEVEL_NAME: { beginner: 'новичок', experienced: 'опытный' },
};

// ---------- 2. Факты: вычисляются по графу ----------
// Алгоритм Тарьяна: компоненты сильной связности (циклы).
// Компоненты выдаются в порядке «сначала то, что импортируется».
function tarjan(names, adj) {
  let index = 0; const idx = {}, low = {}, onStack = {}, stack = [], comps = [];
  function visit(v) {
    idx[v] = low[v] = index++; stack.push(v); onStack[v] = true;
    for (const w of adj[v]) {
      if (idx[w] === undefined) { visit(w); low[v] = Math.min(low[v], low[w]); }
      else if (onStack[w]) low[v] = Math.min(low[v], idx[w]);
    }
    if (low[v] === idx[v]) {
      const comp = []; let w;
      do { w = stack.pop(); onStack[w] = false; comp.push(w); } while (w !== v);
      comps.push(comp.reverse());
    }
  }
  for (const v of names) if (idx[v] === undefined) visit(v);
  return comps;
}


function computeFacts(files, links, entryPoints = []) {
  const adj = {};
  const facts = {};

  const confirmedEntryPaths = new Set(
  entryPoints.map(entry => entry.path));

  for (const f of files) {
    adj[f] = [];
    facts[f] = {
      name: f,
      in: 0,
      out: 0,
      cycleId: null,
      isEntryPoint: false,
      isLeaf: false,
      isConfirmedEntryPoint: confirmedEntryPaths.has(f),
    };
  }

  for (const [a, b] of links) {
    adj[a].push(b);
    facts[a].out++;
    facts[b].in++;
  }

  const comps = tarjan(files, adj);

  comps.forEach((c, i) => {
    if (c.length > 1) {
      c.forEach(f => {
        facts[f].cycleId = i;
      });
    }
  });

  // A -> B означает, что A импортирует B.
  // Точка входа: на файл никто не ссылается,
  // но сам он использует другие файлы.
  // Лист: файл сам ничего не импортирует.
  for (const f of files) {
    facts[f].isEntryPoint = facts[f].in === 0 && facts[f].out > 0;
    facts[f].isLeaf = facts[f].out === 0;
  }

  return { facts, comps };
}


// ---------- 3. Правила (продукции) ----------
// Каждое правило: код, название, условие when(ctx) и вывод, который оно даёт.
// when возвращает список «совпадений»; для каждого создаётся запись в журнале.
const RULES = [
  {
    code: 'R1_HUB',
    name: 'Центральный файл',
    when: ({ facts, files }) => {
      const sorted = [...files].sort((a, b) => facts[b].in - facts[a].in);
      const topN = Math.max(1, Math.ceil(files.length * CONFIG.HUB_TOP_PERCENT / 100));
      const top = new Set(sorted.slice(0, topN).filter(f => facts[f].in >= CONFIG.HUB_TOP_MIN_IN));
      return files.filter(f => facts[f].in >= CONFIG.HUB_MIN_IN || top.has(f))
        .map(f => ({ files: [f], text: `Центральный файл: ${f} (входящих связей: ${facts[f].in})` }));
    },
  },
  {
    code: 'R2_CYCLE',
    name: 'Цикл зависимостей',
    when: ({ comps }) => comps.filter(c => c.length > 1).map(c => ({
      files: c,
      text: `Найден цикл: ${c.join(' <-> ')}`,
      problem: { type: 'cycle', description: `Циклическая зависимость между ${c.join(' и ')}` },
    })),
  },

  {
    code: 'R7_PACKAGE_ENTRY',
    name: 'Подтверждённая точка входа',
    when: ({ facts, entryPoints }) => entryPoints
        .filter(entry => facts[entry.path])
        .map(entry => ({
        files: [entry.path],
        text: `Подтверждённая точка входа: ${entry.path} (package.json: ${entry.reason})`,
        })),
        },
    {

    code: 'R6_ENTRY',
    name: 'Кандидат точки входа',
    when: ({ facts, files }) => files
        .filter(f =>
        facts[f].isEntryPoint &&
        !facts[f].isConfirmedEntryPoint
        )
        .map(f => ({
        files: [f],
        text: `Возможная точка входа: ${f} (на неё нет входящих связей, она использует другие файлы)`,
        })),
    },

  {
    code: 'R5_LEAF',
    name: 'Лист графа',
    when: ({ facts, files, marks }) => files.filter(f =>
        facts[f].isLeaf &&
        facts[f].cycleId === null &&
        !marks[f]).map(f => ({files: [f],text: `Файл ${f} не импортирует другие файлы: поставлен в конец маршрута`,})),
  },
];

// R4 — правило управления: выбирает порядок групп по уровню пользователя
const R4 = {
  code: 'R4_LEVEL',
  apply: (level) => ({
    order: CONFIG.ORDER[level],
    text: `Уровень «${CONFIG.LEVEL_NAME[level]}»: порядок ${CONFIG.ORDER[level].map(g => GROUP_NAME[g]).join(' -> ')}`,
  }),
};

const GROUP_NAME = {
  entry: 'подтверждённые точки входа',
  candidate: 'возможные точки входа',
  hub: 'центральные',
  cycle: 'циклы',
  other: 'остальные',
  leaf: 'листья',
};

// ---------- 4. Механизм вывода (прямой вывод) ----------
function buildRoute({
    files,
    links,
    level = 'beginner',
    entryPoints = [],
    }) {
    const { facts, comps } = computeFacts(files, links, entryPoints);

    const log = [], problems = [], marks = {};

    const ctx = {
        files,
        facts,
        comps,
        marks,
        entryPoints,
    }; // marks[файл] = группа

  // 4.1. Прямой вывод: проверяем правила, срабатывания пишем в журнал
  for (const rule of RULES) {
    for (const m of rule.when(ctx)) {
      log.push({ rule_code: rule.code, result_description: m.text });
      if (m.problem) problems.push(m.problem);
      if (rule.code === 'R1_HUB') {
        m.files.forEach(f => {
        marks[f] = marks[f] || 'hub';
    });
    }

    if (rule.code === 'R7_PACKAGE_ENTRY') {
    m.files.forEach(f => {
        marks[f] = 'entry';
    });
    }

    if (rule.code === 'R6_ENTRY') {
    m.files.forEach(f => {
        marks[f] = marks[f] || 'candidate';
    });
    }
    }
  }
  // 4.2. Разрешение конфликтов: цикл важнее центральности (цикл читают целиком)
  for (const f of files) {
    if (facts[f].cycleId !== null) marks[f] = 'cycle';
    else if (!marks[f]) marks[f] = facts[f].isLeaf ? 'leaf' : 'other';
  }
  // 4.3. R4: порядок групп по уровню
  const r4 = R4.apply(level);
  log.push({ rule_code: R4.code, result_description: r4.text });

  // 4.4. Сборка шагов: внутри группы файлы идут в порядке Тарьяна (сначала то, что импортируется)
  const rank = {}; comps.forEach((c, i) => c.forEach(f => { rank[f] = i; }));
  const steps = [];
  for (const g of r4.order) {
    let inGroup = files.filter(f => marks[f] === g);
    if (g === 'hub') inGroup.sort((a, b) => facts[b].in - facts[a].in);
    else inGroup.sort((a, b) => rank[a] - rank[b]);
    if (!inGroup.length) continue;
    if (g === 'entry') {
        inGroup.forEach(f => steps.push(`Начните с подтверждённой точки входа ${f}: package.json указывает на этот файл`));
    } else if (g === 'candidate') {
    inGroup.forEach(f => steps.push(
        `Возможная точка входа ${f}: на него не ссылаются другие файлы`
    ));
    } else if (g === 'cycle') {
    if (g === 'cycle') {   // каждый цикл — один шаг
      const seen = new Set();
      for (const f of inGroup) {
        const c = comps[rank[f]];
        if (seen.has(rank[f])) continue; seen.add(rank[f]);
        steps.push(`Прочитайте вместе ${c.join(' и ')}: они импортируют друг друга`);
      }
    } 
    } else if (g === 'hub') {
        inGroup.forEach(f => steps.push(`Изучите центральный файл ${f}: входящих связей ${facts[f].in}`));
    } else if (g === 'leaf') {
      steps.push(`Завершите чтение: ${inGroup.join(', ')} (не импортируют другие файлы)`);
    } else {
      steps.push(`Далее изучите ${inGroup.join(', ')}`);
    }
  }
  const stepList = steps.map((text, i) => ({ priority: i + 1, text }));
  // Единый список для таблицы analysis_result: result_type = 'problem' | 'recommendation'
  const results = [
    ...problems.map(p => ({ result_type: 'problem', description: p.description, priority: null })),
    ...stepList.map(s => ({ result_type: 'recommendation', description: s.text, priority: s.priority })),
  ];
  return { results, steps: stepList, problems, log };
}

// ---------- 5. Запись результата в БД (SQL для таблиц выводов) ----------
const q = s => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "''") + "'";
function toSql(analysisId, r) {
  const out = [];
  r.results.forEach(x => out.push(
    `INSERT INTO analysis_result (analysis_id, result_type, description, priority) VALUES (${analysisId}, ${q(x.result_type)}, ${q(x.description)}, ${x.priority === null ? 'NULL' : x.priority});`));
  r.log.forEach(l => out.push(
    `INSERT INTO applied_rule (analysis_id, rule_code, result_description) VALUES (${analysisId}, ${q(l.rule_code)}, ${q(l.result_description)});`));
  return out.join('\n');
}

module.exports = { CONFIG, RULES, buildRoute, toSql, computeFacts };

// ---------- Демонстрация: запуск 2 проекта MyApp из тестовых данных БД ----------
if (require.main === module) {
  const files = ['index.js', 'config.js', 'authService.js', 'userStore.js', 'client.js',
                 'LoginPage.jsx', 'App.jsx', 'helpers.js', 'models.js', 'Header.jsx'];
  const links = [
    ['index.js', 'App.jsx'], ['index.js', 'config.js'],
    ['App.jsx', 'LoginPage.jsx'], ['App.jsx', 'Header.jsx'], ['App.jsx', 'config.js'],
    ['LoginPage.jsx', 'authService.js'], ['LoginPage.jsx', 'helpers.js'],
    ['authService.js', 'userStore.js'], ['userStore.js', 'authService.js'],
    ['authService.js', 'client.js'], ['authService.js', 'config.js'],
    ['client.js', 'config.js'], ['client.js', 'helpers.js'],
    ['userStore.js', 'models.js'], ['models.js', 'config.js'],
    ['Header.jsx', 'helpers.js'],
  ];
  for (const level of ['beginner', 'experienced']) {
    const r = buildRoute({ files, links, level });
    console.log(`\n=== Уровень: ${level} ===`);
    console.log('Маршрут:');  r.steps.forEach(s => console.log(`  ${s.priority}. ${s.text}`));
    console.log('Проблемы:'); r.problems.forEach(p => console.log(`  - ${p.description}`));
    console.log('Журнал правил:'); r.log.forEach(l => console.log(`  [${l.rule_code}] ${l.result_description}`));
  }
  console.log('\nSQL для записи в БД (уровень новичок):');
  console.log(toSql(2, buildRoute({ files, links, level: 'beginner' })));
}