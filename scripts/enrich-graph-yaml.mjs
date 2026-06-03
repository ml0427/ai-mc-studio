import fs from 'node:fs'
import YAML from 'yaml'

const inputPath = process.argv[2]
const outputPath = process.argv[3] ?? inputPath?.replace(/\.ya?ml$/i, '.enriched.yaml')

function main() {
  if (!inputPath || !outputPath) {
    console.error('Usage: node scripts/enrich-graph-yaml.mjs <input.yaml> [output.yaml]')
    process.exit(1)
  }

  const doc = YAML.parse(fs.readFileSync(inputPath, 'utf8'))

  doc.enrichment = {
    generated_without_ai: true,
    note: '以規則補上 purpose、instructions、decision_rules；保留原始 id 與連線。',
  }

  for (const [workflowName, workflow] of Object.entries(doc.workflows ?? {})) {
    const graph = workflow.graph
    if (!graph?.nodes?.length) continue

    const edges = graph.edges ?? []
    const edgesBySource = groupBy(edges, (edge) => edge.from ?? edge.source)
    const edgesByTarget = groupBy(edges, (edge) => edge.to ?? edge.target)
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
    const stepById = new Map((workflow.steps ?? []).map((step) => [step.id, step]))

    for (const node of graph.nodes) {
      const outgoing = edgesBySource.get(node.id) ?? []
      const incoming = edgesByTarget.get(node.id) ?? []
      const context = { workflowName, workflow, node, step: stepById.get(node.id), nodeById, incoming, outgoing }

      node.description = cleanDescription(node.description) || describeNode(context)
      node.purpose = node.purpose || purposeForNode(context)
      node.instructions = normalizeList(node.instructions)
      if (node.instructions.length === 0) node.instructions = instructionsForNode(context)

      const rules = normalizeList(node.decision_rules)
      const generatedRules = decisionRulesForNode(context)
      if (rules.length || generatedRules.length) {
        node.decision_rules = rules.length ? rules : generatedRules
      } else {
        delete node.decision_rules
      }
    }
  }

  fs.writeFileSync(outputPath, YAML.stringify(doc), 'utf8')
  console.log(outputPath)
}

function groupBy(items, keyFn) {
  const groups = new Map()
  for (const item of items) {
    const key = keyFn(item)
    if (!key) continue
    groups.set(key, [...(groups.get(key) ?? []), item])
  }
  return groups
}

function cleanDescription(value) {
  if (!value) return ''
  const text = String(value).trim()
  if (!text || /^AI\s*\?\?$/.test(text) || text.includes('[object Object]')) return ''
  return localizeText(text)
}

function describeNode(context) {
  const { node } = context
  const title = localizeText(node.label || node.title || node.id)
  if (node.type === 'condition' || node.kind === 'condition') return `判斷「${title}」是否成立，決定下一步要走哪條路。`
  if (node.type === 'terminal' || node.kind === 'terminal') return `流程在「${title}」結束或回報目前狀態。`
  if (node.type === 'shell' || node.kind === 'shell') return `執行固定指令並收集「${outputLabel(context)}」。`
  if (String(node.type ?? node.kind).includes('tool')) return `使用工具或備用指令收集「${outputLabel(context)}」。`
  if (String(node.type ?? node.kind).includes('code')) return `依照前面證據做最小範圍修改，產出「${outputLabel(context)}」。`
  return `根據輸入資料完成「${title}」，並產出「${outputLabel(context)}」。`
}

function purposeForNode(context) {
  const { node, workflowName } = context
  const title = node.label || node.title || node.id

  const explicit = purposeById[workflowName]?.[node.id] ?? purposeById.common[node.id]
  if (explicit) return explicit

  if (node.type === 'condition' || node.kind === 'condition') return '把 AI 的判斷結果轉成清楚路線，避免後續步驟猜流程。'
  if (node.type === 'terminal' || node.kind === 'terminal') return '讓流程有明確收尾，知道是完成、阻擋，還是需要補證據。'
  if (node.type === 'shell' || node.kind === 'shell') return '用可重現的命令取得客觀證據，供後續 AI 判斷。'
  if (String(node.type ?? node.kind).includes('tool')) return '用工具補足程式脈絡，降低只靠猜測做判斷的風險。'
  if (String(node.type ?? node.kind).includes('code')) return '把已確認的計畫落成實際修改，並保持修改範圍最小。'
  return `讓後續流程可以使用「${title}」的結論繼續推進。`
}

function instructionsForNode(context) {
  const { node } = context
  const title = node.label || node.title || node.id
  const outputs = outputItems(context)
  const inputs = inputItems(context)

  if (node.type === 'condition' || node.kind === 'condition') {
    return [
      '只根據前面節點的輸出判斷，不要自行補不存在的資料。',
      '判斷結果要能對應到線上的分支標籤。',
      '如果資料不足，優先走較保守或需要補證據的路線。',
    ]
  }

  if (node.type === 'terminal' || node.kind === 'terminal') {
    return [
      '用白話回報目前流程狀態。',
      '說明已完成、仍有風險，或下一步需要補什麼證據。',
    ]
  }

  if (node.type === 'shell' || node.kind === 'shell') {
    return [
      `執行指定指令：${localizeTerm(node.command_ref || node.output || node.id)}。`,
      '保留 stdout、stderr 與 exit code。',
      outputs.length ? `把結果整理成：${outputs.map(localizeTerm).join('、')}。` : '只整理必要結果，不要過度解讀。',
    ].filter(Boolean)
  }

  if (String(node.type ?? node.kind).includes('tool')) {
    return [
      '先使用 preferred 工具取得上下文。',
      '如果工具不可用，再使用 fallback 做同等蒐證。',
      outputs.length ? `輸出重點整理成：${outputs.map(localizeTerm).join('、')}。` : '把工具結果整理成後續能使用的摘要。',
    ]
  }

  if (String(node.type ?? node.kind).includes('code')) {
    return [
      '只修改和目標直接相關的檔案。',
      '保留使用者既有變更，不要回復無關內容。',
      outputs.length ? `完成後輸出：${outputs.map(localizeTerm).join('、')}。` : '完成後說明修改重點。',
    ]
  }

  return [
    inputs.length ? `閱讀輸入：${inputs.map(localizeTerm).join('、')}。` : `針對「${title}」整理必要判斷。`,
    ...aiInstructionHints(context),
    outputs.length ? `輸出：${outputs.map(localizeTerm).join('、')}。` : '用結構化結果回報。',
    '標記不確定或缺資料的地方，不要假裝已經知道。',
  ]
}

function decisionRulesForNode({ node, nodeById, outgoing }) {
  if (node.type !== 'condition' && node.kind !== 'condition') return []
  return outgoing.map((edge) => {
    const label = edge.branch_label || edge.label || localizedBranch(edge.branch)
    const target = edge.to ?? edge.target
    const targetNode = target ? nodeById.get(target) : null
    const targetLabel = targetNode ? localizeText(targetNode.label || targetNode.title || target) : '下一步'
    if (label === '是') return `是：條件成立，前往「${targetLabel}」。`
    if (label === '否') return `否：條件不成立或資料不足，前往「${targetLabel}」。`
    if (label === '通過') return `通過：驗收或檢查結果可接受，前往「${targetLabel}」。`
    if (label === '回圈') return `回圈：證據不足或信心不夠，回到「${targetLabel}」補判斷。`
    return `${label || '下一步'}：符合此路線條件時，前往「${targetLabel}」。`
  })
}

function aiInstructionHints(context) {
  const required = context.step?.output_schema?.required ?? context.node.output_schema?.required ?? []
  if (required.length) {
    return required.map((item) => `產出「${localizeTerm(item)}」。`)
  }
  return ['用白話整理判斷依據。']
}

function inputItems({ node, step }) {
  const value = node.input ?? step?.input
  return Array.isArray(value) ? value : value ? [value] : []
}

function outputItems({ node, step }) {
  if (node.output) return [node.output]
  if (step?.output) return [step.output]
  return step?.output_schema?.required ?? node.output_schema?.required ?? []
}

function outputLabel(context) {
  const items = outputItems(context)
  return items.length ? items.map(localizeTerm).join('、') : '下一步需要的結果'
}

function normalizeList(value) {
  if (!value) return []
  if (Array.isArray(value)) return value.map((item) => localizeText(String(item))).filter(Boolean)
  return String(value)
    .split(/\r?\n/)
    .map((line) => localizeText(line.trim()))
    .filter(Boolean)
}

function localizedBranch(branch) {
  if (branch === 'yes') return '是'
  if (branch === 'no') return '否'
  if (branch === 'pass') return '通過'
  if (branch === 'loop') return '回圈'
  return branch
}

function localizeText(value) {
  return String(value)
    .replace(/\bCommand ref\b/g, '指令')
    .replace(/\bOutput\b/g, '輸出')
    .replace(/\bInput\b/g, '輸入')
    .replace(/\bStrategy\b/g, '策略')
    .replace(/\bLead agent\b/g, '主控 AI')
    .replace(/\bAI note\b/g, 'AI 筆記')
    .replace(/\broot cause\b/g, '根因')
    .replace(/\bcode\b/g, '程式')
    .replace(/\bcommit\b/g, '提交')
    .replace(/\bpush\b/g, '推送')
    .replace(/\s*\|\s*/g, '；')
    .replace(/[A-Za-z][A-Za-z0-9_.-]*/g, (term) => localizeTerm(term))
}

function localizeTerm(value) {
  return labels[value] ?? labels[String(value).replace(/-/g, '_')] ?? value
}

const labels = {
  API: '介面',
  DB: '資料庫',
  PR: '合併請求',
  UI: '畫面',
  acceptance_checks: '驗收條件',
  adjacent_features_checked: '已檢查的相鄰功能',
  api_findings: '介面檢查結果',
  blocking_findings: '阻塞問題',
  candidate_areas: '可能相關區域',
  candidate_symbols: '可能相關的函式或檔案',
  caller: '呼叫者',
  change_impact: '變更影響',
  change_kinds: '變更類型',
  changed_files: '已修改檔案',
  code_hits: '程式搜尋結果',
  confidence: '信心程度',
  config: '設定',
  contract: '契約',
  consumer: '使用者端',
  data_flow: '資料流',
  diff: '差異內容',
  docs: '文件',
  entry_points: '進入點',
  error_hits: '錯誤搜尋結果',
  error_message: '錯誤訊息',
  error: '錯誤',
  issue: '問題單',
  fallback: '備用做法',
  feature_keywords: '功能關鍵字',
  feature_request: '功能需求',
  files_requiring_callers: '需要追呼叫者的檔案',
  files_to_change: '要修改的檔案',
  files_to_read: '要閱讀的檔案',
  focus: '處理重點',
  focused_source: '重點來源',
  git_status: 'Git 狀態',
  impact_notes: '影響分析筆記',
  issue_json: '問題單內容',
  issue_keywords: '搜尋關鍵字',
  keywords: '關鍵字',
  memory_notes: '記憶筆記',
  minimal_fix_plan: '最小修正計畫',
  minimal_patch_plan: '最小修改計畫',
  non_goals: '不處理的範圍',
  open_questions: '待釐清問題',
  patch_summary: '修改摘要',
  plain_language_goal: '白話目標',
  plain_language_meaning: '白話說明',
  preferred: '優先做法',
  probe: '探查',
  probe_needed: '需要探查',
  probe_result: '探查結果',
  raw_diff: '原始差異',
  risk_areas: '風險區域',
  risks: '風險',
  root_cause_candidate: '可能根因',
  search_error: '搜尋錯誤線索',
  search_feature_terms: '搜尋功能關鍵字',
  search_issue_terms: '搜尋問題單關鍵字',
  search_symptom_terms: '搜尋症狀關鍵字',
  status: '狀態',
  state: '狀態',
  shared_util: '共用工具',
  'shared-util': '共用工具',
  suggested_followup_checks: '建議後續檢查',
  test_findings: '測試發現',
  tests: '測試',
  tests_to_run: '要跑的測試',
  'trace-data-flow': '追資料流',
  ui_findings: '畫面檢查結果',
  verification_output: '驗證輸出',
}

const purposeById = {
  common: {
    'collect-status': '先確認工作區狀態，避免後續修改覆蓋使用者既有變更。',
    'memory-search': '查找既有架構記憶或本地文件，避免重踩已知陷阱。',
    'impact-before-edit': '在修改前理解可能受影響的流程、模組或 API。',
    'implementation-plan': '把前面證據收斂成最小修改計畫與驗證方式。',
    verify: '用建置或測試確認目前修改沒有明顯破壞專案。',
    'detect-changes': '檢查實際 diff 影響，確認修改範圍是否符合計畫。',
    'adjacent-regression-review': '確認相鄰功能沒有因本次修改被波及。',
    'closeout-checklist': '整理交付前的版本、記憶、提交與回報項目。',
  },
  'feature-dev': {
    'clarify-feature': '把模糊需求轉成可實作、可驗收的新功能目標。',
    'has-feature-keywords': '判斷是否已有足夠關鍵字可以搜尋現有程式。',
    'search-existing-code': '找出和新功能相關的既有程式，避免重做或接錯位置。',
    implement: '依照計畫完成新功能的最小可行修改。',
  },
  'github-issue-fix': {
    'collect-issue': '把問題單上下文讀進流程，讓後續判斷有完整來源。',
    'summarize-issue': '把問題單整理成可搜尋、可規劃、可驗收的修正任務。',
    'search-related-code': '用問題單關鍵字定位可能需要修改的程式。',
    fix: '針對問題單做最小範圍修正。',
  },
  'pr-review': {
    'collect-diff': '收集分支差異，作為審查的客觀輸入。',
    'collect-changed-files': '列出改動檔案，判斷審查範圍與風險區域。',
    'classify-change': '把改動分類，決定要不要追呼叫者、API 契約、畫面狀態或測試。',
    'collect-impact': '查呼叫者與使用者端，確認改動可能影響誰。',
    'check-api-contracts': '檢查 API 輸出與使用者端期待是否一致。',
    'check-ui-regressions': '檢查畫面變更常見風險：載入、空狀態、錯誤、競態。',
    'check-tests': '確認測試是否覆蓋主要風險，或是否被削弱。',
    'final-review': '用 findings-first 形式產出可執行的審查結論。',
  },
  'bug-scan': {
    'explain-symptom': '把錯誤症狀轉成可搜尋、可驗證的診斷假設。',
    'search-error': '用精確錯誤文字找出最直接的線索。',
    'search-related-code': '用症狀關鍵字找出可能相關的程式位置。',
    'trace-data-flow': '推導資料流、入口點與可能斷點，縮小診斷範圍。',
    'read-focused-files': '閱讀重點檔案，取得足夠上下文再判斷根因。',
    diagnose: '根據證據提出根因候選、信心程度與最小修法。',
    'probe-before-third-fix': '用探查、日誌或斷言補證據，避免反覆盲修。',
    fix: '在信心足夠後做最小範圍修正。',
    'final-bug-report': '整理根因、修改、驗證結果與殘餘風險。',
  },
}

main()
