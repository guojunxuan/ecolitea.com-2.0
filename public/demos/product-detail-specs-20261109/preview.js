// UI draft only: static sample data, no Payload reads.
;(() => {
  const VISIBLE_ROWS = 6

  const groups = [
    {
      group: 'General',
      items: [
        ['Size', '1×4 ft, 2×2 ft, 2×4 ft'],
        ['Wattage', '36 W / 40 W / 90 W'],
        ['CCT', '3000 / 4000 / 5000 K (selectable)'],
        ['Dimming', '0–10 V'],
      ],
    },
    {
      group: 'Optical',
      items: [
        ['CRI', '> 90'],
        ['Luminous efficacy', '110 lm/W'],
        ['Beam angle', '120°'],
      ],
    },
    {
      group: 'Electrical',
      items: [
        ['Input voltage', '120–277 V AC'],
        ['Power factor', '> 0.9'],
        ['THD', '< 20%'],
      ],
    },
    {
      group: 'Environment & compliance',
      items: [
        ['Operating temperature', '−25 °C to 50 °C'],
        ['IP rating', 'IP40'],
        ['Rated life', '50,000 h (L70)'],
        ['Certifications', 'UL, DLC 5.1 Premium'],
      ],
    },
  ]
  const fewRows = [
    ['Size', '1×4 ft, 2×2 ft, 2×4 ft'],
    ['Wattage', '36 W / 40 W / 90 W'],
    ['CCT', '3000 / 4000 / 5000 K'],
    ['Dimming', '0–10 V'],
    ['CRI', '> 90'],
    ['Input voltage', '120–277 V AC'],
  ]
  const summaries = {
    short:
      'Edge-lit troffer replacement with selectable wattage and colour temperature, flicker-free 0–10 V dimming and a 50,000-hour rated life.',
    long: 'The LED Flat Panel is an edge-lit troffer replacement for offices, schools, retail and healthcare corridors. Three wattages and three colour temperatures are selectable on one fixture, so a single SKU covers most layouts and reduces inventory. A high-CRI, low-glare output with flicker-free 0–10 V dimming keeps workspaces comfortable, while the slim aluminium frame installs in standard T-bar grids, drywall ceilings or surface-mount kits. Rated for 50,000 hours (L70) and backed by UL and DLC 5.1 Premium listings for utility rebate eligibility.',
  }
  const files = [
    ['LED Flat Panel — Specification sheet', 'PDF', '2.4 MB'],
    ['Installation guide', 'PDF', '1.1 MB'],
    ['IES photometric files', 'ZIP', '486 KB'],
  ]

  const body = document.body
  const list = document.querySelector('[data-spec-list]')
  const toggle = document.querySelector('[data-spec-toggle]')
  const single = document.querySelector('[data-download-single]')
  const multi = document.querySelector('[data-download-multi]')
  const actions = document.querySelector('.actions')
  const summary = document.querySelector('[data-summary]')
  const summaryToggle = document.querySelector('[data-summary-toggle]')
  const tabs = [...document.querySelectorAll('[role="tab"]')]
  let expanded = false
  let summaryExpanded = false

  const el = (tag, attrs = {}, text) => {
    const node = document.createElement(tag)
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value)
    if (text !== undefined) node.textContent = text
    return node
  }

  function data() {
    const grouped = body.dataset.groups === 'on'
    if (body.dataset.rows === 'few')
      return grouped
        ? [
            { group: 'General', items: fewRows.slice(0, 4) },
            { group: 'Electrical', items: fewRows.slice(4) },
          ]
        : [{ group: null, items: fewRows }]
    return grouped ? groups : [{ group: null, items: groups.flatMap((g) => g.items) }]
  }

  function renderSpecs() {
    const source = data()
    const total = source.reduce((sum, g) => sum + g.items.length, 0)
    let shown = 0
    list.replaceChildren(
      ...source.map((g) => {
        const section = el('div', { class: 'spec-group' })
        if (g.group) section.append(el('h3', {}, g.group))
        const dl = el('dl')
        for (const [label, value] of g.items) {
          const row = el('div')
          if (!expanded && shown >= VISIBLE_ROWS) row.setAttribute('data-hidden', '')
          row.append(el('dt', {}, label), el('dd', {}, value))
          dl.append(row)
          shown++
        }
        if (![...dl.children].some((row) => !row.hasAttribute('data-hidden')))
          section.setAttribute('data-hidden', '')
        section.append(dl)
        return section
      }),
    )
    const collapsible = total > VISIBLE_ROWS
    toggle.toggleAttribute('data-hidden', !collapsible)
    toggle.setAttribute('aria-expanded', String(expanded))
    toggle.querySelector('[data-label]').textContent = expanded
      ? 'Show fewer specifications'
      : `View all specifications (${total})`
  }

  function renderSummary() {
    summary.textContent = summaries[body.dataset.summary] ?? summaries.long
    summary.toggleAttribute('data-clamped', !summaryExpanded)
    // Only offer Read more when the clamp actually hides text.
    const overflowing = summaryExpanded || summary.scrollHeight > summary.clientHeight + 1
    summaryToggle.toggleAttribute('data-hidden', !overflowing)
    summaryToggle.setAttribute('aria-expanded', String(summaryExpanded))
    summaryToggle.querySelector('[data-label]').textContent = summaryExpanded ? 'Read less' : 'Read more'
  }

  function selectTab(tab, focus = false) {
    for (const item of tabs) {
      const selected = item === tab
      item.setAttribute('aria-selected', String(selected))
      item.tabIndex = selected ? 0 : -1
      document.getElementById(item.getAttribute('aria-controls')).toggleAttribute('data-inactive', !selected)
    }
    if (focus) tab.focus()
    renderSummary()
  }

  function renderFiles() {
    const mode = body.dataset.files
    single.toggleAttribute('data-hidden', mode !== 'single')
    multi.toggleAttribute('data-hidden', mode !== 'multi')
    actions.toggleAttribute('data-single', mode === 'none')
    multi.open = false
    multi.querySelector('[data-file-count]').textContent = `${files.length} files`
    multi.querySelector('[data-file-list]').replaceChildren(
      ...files.map(([title, type, size]) => {
        const li = el('li')
        const a = el('a', { href: '#', target: '_blank', rel: 'noopener' })
        a.append(el('span', { class: 'title' }, title), el('span', { class: 'meta' }, `${type} · ${size}`))
        li.append(a)
        return li
      }),
    )
  }

  function syncTools() {
    for (const button of document.querySelectorAll('[data-set]'))
      button.setAttribute('aria-pressed', String(body.dataset[button.dataset.set] === button.dataset.value))
  }

  function render() {
    renderSpecs()
    renderSummary()
    renderFiles()
    syncTools()
    const url = new URL(location.href)
    for (const key of ['summary', 'groups', 'rows', 'files']) url.searchParams.set(key, body.dataset[key])
    history.replaceState(null, '', url)
  }

  const params = new URLSearchParams(location.search)
  for (const key of ['summary', 'groups', 'rows', 'files'])
    if (params.get(key)) body.dataset[key] = params.get(key)

  document.addEventListener('click', (event) => {
    const set = event.target.closest('[data-set]')
    if (set) {
      body.dataset[set.dataset.set] = set.dataset.value
      expanded = false
      summaryExpanded = false
      render()
    }
    if (event.target.closest('[data-spec-toggle]')) {
      expanded = !expanded
      renderSpecs()
    }
    const tab = event.target.closest('[role="tab"]')
    if (tab) selectTab(tab)
    if (event.target.closest('[data-summary-toggle]')) {
      summaryExpanded = !summaryExpanded
      renderSummary()
    }
    if (event.target.closest('[data-tools-toggle]')) {
      const tools = document.querySelector('.tools')
      const collapsed = tools.toggleAttribute('data-collapsed')
      event.target.textContent = collapsed ? '工具' : '收起'
      event.target.setAttribute('aria-expanded', String(!collapsed))
    }
    if (event.target.closest('[data-placeholder="quote"]')) event.preventDefault()
    if (multi.open && !event.target.closest('[data-download-multi]')) multi.open = false
    if (event.target.closest('a[href="#"]')) event.preventDefault()
  })
  document.addEventListener('keydown', (event) => {
    const tab = event.target.closest?.('[role="tab"]')
    if (tab && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault()
      const index = tabs.indexOf(tab)
      const next =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? tabs.length - 1
            : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
      selectTab(tabs[next], true)
    }
    if (event.key === 'Escape' && multi.open) {
      multi.open = false
      multi.querySelector('summary').focus()
    }
  })

  render()
})()
