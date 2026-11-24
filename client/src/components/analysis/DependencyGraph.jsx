import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import './DependencyGraph.css'

const GROUPS = [
  'entry',
  'candidate',
  'hub',
  'cycle',
  'other',
  'leaf',
]

const GROUP_LABELS = {
  entry: 'Точки входа',
  candidate: 'Возможные точки входа',
  hub: 'Центральные файлы',
  cycle: 'Циклы',
  other: 'Остальные файлы',
  leaf: 'Завершающие файлы',
}

function getRouteGroup(text) {
  if (text.includes('Начните с подтверждённой точки входа')) return 'entry'
  if (text.includes('Возможная точка входа')) return 'candidate'
  if (text.includes('Изучите центральный файл')) return 'hub'
  if (text.includes('Прочитайте вместе')) return 'cycle'
  if (text.includes('Завершите чтение')) return 'leaf'

  return 'other'
}

function getRouteFiles(step) {
  const text = step.text
  const group = getRouteGroup(text)

  if (group === 'entry') {
    return [
      text
        .replace('Начните с подтверждённой точки входа ', '')
        .split(': package.json')[0],
    ]
  }

  if (group === 'candidate') {
    return [text.replace('Возможная точка входа ', '').split(':')[0]]
  }

  if (group === 'hub') {
    return [text.replace('Изучите центральный файл ', '').split(':')[0]]
  }

  if (group === 'cycle') {
    return text
      .replace('Прочитайте вместе ', '')
      .split(':')[0]
      .split(' и ')
  }

  if (group === 'leaf') {
    return text
      .replace('Завершите чтение: ', '')
      .split(' (')[0]
      .split(', ')
  }

  if (group === 'other') {
    return text.replace('Далее изучите ', '').split(', ')
  }

  return []
}

function createPositions(files, links, groupOf) {
  const byGroup = Object.fromEntries(
    GROUPS.map((group) => [group, []])
  )

  files.forEach((file) => {
    const group = groupOf[file.path] || 'other'
    byGroup[group].push(file)
  })

  const NODE_WIDTH = 150
  const NODE_HEIGHT = 44
  const GAP_X = 30
  const LAYER_HEIGHT = 110
  const PADDING_X = 30

  const layers = GROUPS.filter((group) => byGroup[group].length)

  const maxInLayer = Math.max(
    ...layers.map((group) => byGroup[group].length),
    1
  )

  const width = Math.max(
    700,
    PADDING_X * 2 + maxInLayer * (NODE_WIDTH + GAP_X) - GAP_X
  )

  const height = Math.max(360, layers.length * LAYER_HEIGHT + 40)

  const positions = {}

  layers.forEach((group, layerIndex) => {
    const layerFiles = byGroup[group]

    const rowWidth =
      layerFiles.length * (NODE_WIDTH + GAP_X) - GAP_X

    const startX = (width - rowWidth) / 2

    layerFiles.forEach((file, index) => {
      const x = startX + index * (NODE_WIDTH + GAP_X)
      const y = 20 + layerIndex * LAYER_HEIGHT

      positions[file.path] = {
        x,
        y,
        cx: x + NODE_WIDTH / 2,
        cy: y + NODE_HEIGHT / 2,
        group,
      }
    })
  })

  const byId = Object.fromEntries(
    files.map((file) => [file.id, file])
  )

  const edges = links
    .map((link) => {
      const source = byId[link.source_file_id]
      const target = byId[link.target_file_id]

      if (!source || !target) return null

      const from = positions[source.path]
      const to = positions[target.path]

      if (!from || !to) return null

      return {
        id: `${source.id}-${target.id}`,
        source: source.path,
        target: target.path,
        x1: from.cx,
        y1: from.cy,
        x2: to.cx,
        y2: to.cy,
        isCycle: from.group === 'cycle' && to.group === 'cycle',
      }
    })
    .filter(Boolean)

  return {
    positions,
    edges,
    width,
    height,
    nodeWidth: NODE_WIDTH,
    nodeHeight: NODE_HEIGHT,
  }
}

export default function DependencyGraph({
  files,
  links,
  route,
  analysisId,
}) {
  const [mode, setMode] = useState('all')
  const navigate = useNavigate()

  const groupOf = useMemo(() => {
    const result = {}

    route.steps.forEach((step) => {
      const group = getRouteGroup(step.text)

      getRouteFiles(step).forEach((path) => {
        result[path] = group
      })
    })

    return result
  }, [route])

  const graph = useMemo(
    () => createPositions(files, links, groupOf),
    [files, links, groupOf]
  )

  function isNodeVisible(group) {
    if (mode === 'all') return true
    return group === mode
  }

  function isEdgeVisible(edge) {
    if (mode === 'all') return true
    if (mode === 'cycle') return edge.isCycle
    return (
      mode === 'hub' &&
      (groupOf[edge.source] === 'hub' ||
        groupOf[edge.target] === 'hub')
    )
  }

  function openFile(path) {
    const fileName = path.split('/').pop()

    const index = route.steps.findIndex((step) =>
      step.text.includes(fileName)
    )

    navigate(`/analysis/${analysisId}/step/${index >= 0 ? index : 0}`)
  }

  if (files.length === 0) {
    return <p className="graph-empty">В анализе нет файлов для отображения.</p>
  }

  return (
    <div className="dependency-graph">
      <div className="graph-toolbar">
        <div className="graph-filters">
          <button
            type="button"
            className={mode === 'all' ? 'active' : ''}
            onClick={() => setMode('all')}
          >
            Все связи
          </button>

          <button
            type="button"
            className={mode === 'cycle' ? 'active' : ''}
            onClick={() => setMode('cycle')}
          >
            Циклы
          </button>

          <button
            type="button"
            className={mode === 'hub' ? 'active' : ''}
            onClick={() => setMode('hub')}
          >
            Центральные
          </button>
        </div>

        <span className="graph-meta">
          {files.length} файлов · {links.length} связей
        </span>
      </div>

      <div className="graph-canvas">
        <svg
          className="dependency-svg"
          viewBox={`0 0 ${graph.width} ${graph.height}`}
          role="img"
          aria-label="Граф зависимостей между файлами"
        >
          <defs>
            <marker
              id={`graph-arrow-${analysisId}`}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M0,0 L10,5 L0,10 z" fill="#b8b0a1" />
            </marker>
          </defs>

          {graph.edges.map((edge) => (
            <line
              key={edge.id}
              className={[
                'graph-edge',
                edge.isCycle ? 'cycle' : '',
                isEdgeVisible(edge) ? '' : 'dimmed',
              ].join(' ')}
              x1={edge.x1}
              y1={edge.y1}
              x2={edge.x2}
              y2={edge.y2}
              markerEnd={`url(#graph-arrow-${analysisId})`}
            />
          ))}

          {files.map((file) => {
            const position = graph.positions[file.path]

            if (!position) return null

            return (
              <g
                key={file.id}
                className={[
                  'graph-node',
                  position.group,
                  isNodeVisible(position.group) ? '' : 'dimmed',
                ].join(' ')}
                transform={`translate(${position.x}, ${position.y})`}
                role="button"
                tabIndex={0}
                aria-label={`Открыть файл ${file.path}`}
                onClick={() => openFile(file.path)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    openFile(file.path)
                  }
                }}
              >
                <rect
                  width={graph.nodeWidth}
                  height={graph.nodeHeight}
                  rx="2"
                />

                <text x="10" y="26">
                  {file.name.length > 19
                    ? `${file.name.slice(0, 17)}…`
                    : file.name}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      <div className="graph-legend">
  <span className="graph-legend-item">
    <i className="legend-dot entry-dot" />
    Точка входа
  </span>
  <span className="graph-legend-item">
    <i className="legend-dot candidate-dot" />
    Возможная точка входа
  </span>
  <span className="graph-legend-item">
    <i className="legend-dot hub-dot" />
    Центральный файл
  </span>
  <span className="graph-legend-item">
    <i className="legend-dot cycle-dot" />
    Цикл зависимостей
  </span>
  <span className="graph-legend-item">
    <i className="legend-dot other-dot" />
    Остальные файлы
  </span>
  <span className="graph-legend-item">
    <i className="legend-line" />
    Направление импорта
  </span>
</div>

<div className="graph-groups">
  {GROUPS.map((group) => {
    const count = files.filter(
      (file) => (groupOf[file.path] || 'other') === group
    ).length

    if (!count) return null

    return (
      <span key={group}>
        {GROUP_LABELS[group]} <b>{count}</b>
      </span>
    )
  })}
</div>
    </div>
  )
}