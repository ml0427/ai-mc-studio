export const workflowTermLabels: Record<string, string> = {
  API: '介面',
  Bug: '錯誤',
  DB: '資料庫',
  Git: 'Git',
  git: 'Git',
  GitHub: 'GitHub',
  Issue: '問題單',
  PR: '合併請求',
  UI: '畫面',
  acceptance_checks: '驗收條件',
  acceptance_hint: '驗收提示',
  adjacent_features_checked: '已檢查的相鄰功能',
  'adjacent-regression-review': '檢查相鄰功能是否受影響',
  agent: 'AI',
  api_findings: '介面檢查結果',
  assertion: '斷言',
  'bug-scan': '追查錯誤',
  blocking_findings: '阻塞問題',
  blocking: '阻塞',
  caller: '呼叫者',
  candidate_areas: '可能相關區域',
  candidate_symbols: '可能相關的函式或檔案',
  change_impact: '變更影響',
  change_kinds: '變更類型',
  changed_files: '已修改檔案',
  'clarify-feature': '釐清功能需求',
  'classify-change': '判斷變更類型',
  code_hits: '程式搜尋結果',
  confidence: '信心程度',
  config: '設定',
  contract: '契約',
  consumer: '使用者端',
  data_flow: '資料流',
  diagnose: '診斷問題',
  diff: '差異內容',
  docs: '文件',
  entry_points: '進入點',
  error_hits: '錯誤搜尋結果',
  error_message: '錯誤訊息',
  error: '錯誤',
  empty: '空狀態',
  fallback: '備用做法',
  'feature-dev': '做新功能',
  feature_keywords: '功能關鍵字',
  feature_request: '功能需求',
  findings: '發現',
  'findings-first': '先列問題',
  files_requiring_callers: '需要追呼叫者的檔案',
  files_to_change: '要修改的檔案',
  files_to_read: '要閱讀的檔案',
  focus: '處理重點',
  focused_source: '重點來源',
  git_status: 'Git 狀態',
  'github-issue-fix': '修 GitHub 問題單',
  impact_notes: '影響分析筆記',
  'implementation-plan': '規劃實作',
  initial_hypotheses: '初步假設',
  issue_json: '問題單內容',
  issue_keywords: '搜尋關鍵字',
  issue: '問題單',
  keywords: '關鍵字',
  loading: '載入狀態',
  log: '日誌',
  likely_breakpoints: '可能出問題的位置',
  low_model_subtasks: '可交給低成本模型的小任務',
  memory_notes: '記憶筆記',
  memory: '記憶',
  minimal_fix_plan: '最小修正計畫',
  minimal_patch_plan: '最小修改計畫',
  non_goals: '不處理的範圍',
  open_questions: '待釐清問題',
  patch: '修改',
  patch_summary: '修改摘要',
  plain_language_goal: '白話目標',
  plain_language_meaning: '白話說明',
  preferred: '優先做法',
  probe: '探查',
  probe_needed: '需要探查',
  probe_result: '探查結果',
  'pr-review': '審查合併請求',
  raw_diff: '原始差異',
  race: '競態問題',
  risky: '高風險',
  risk_areas: '風險區域',
  risks: '風險',
  root_cause_candidate: '可能根因',
  search_error: '搜尋錯誤線索',
  search_feature_terms: '搜尋功能關鍵字',
  search_issue_terms: '搜尋問題單關鍵字',
  search_symptom_terms: '搜尋症狀關鍵字',
  status: '狀態',
  state: '狀態',
  suggested_followup_checks: '建議後續檢查',
  shared_util: '共用工具',
  'shared-util': '共用工具',
  summarize_issue: '整理問題單',
  'summarize-issue': '整理問題單',
  suspected_area: '疑似問題區域',
  symptom: '症狀',
  tests: '測試',
  test_findings: '測試發現',
  tests_to_run: '要跑的測試',
  'trace-data-flow': '追資料流',
  'trace-data-flow.files_to_read': '追資料流要看的檔案',
  ui_findings: '畫面檢查結果',
  verification_output: '驗證輸出',
}

export function formatCompactValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(formatCompactValue).join('、')
  if (value && typeof value === 'object') return Object.keys(value).map(localizeWorkflowTerm).join('、')
  return localizeWorkflowTerm(String(value))
}

export function localizeWorkflowText(value: string) {
  const phraseLocalized = value
    .replace(/\bLead agent\b/g, '主控 AI')
    .replace(/\bAI note\b/g, 'AI 筆記')
    .replace(/\bnpm run build\b/g, '執行 npm run build')
    .replace(/\broot cause\b/g, '根因')
    .replace(/\bcode\b/g, '程式')
    .replace(/\bcommit\b/g, '提交')
    .replace(/\bpush\b/g, '推送')
    .replace(/\bclose issue\b/g, '關閉問題單')
    .replace(/\bconsumer\b/g, '使用者端')
    .replace(/\bcaller\b/g, '呼叫者')
  return phraseLocalized
    .replace(/\bCommand ref\b/g, '指令')
    .replace(/\bOutput\b/g, '輸出')
    .replace(/\bInput\b/g, '輸入')
    .replace(/\bStrategy\b/g, '策略')
    .replace(/\s*\|\s*/g, '；')
    .replace(/[A-Za-z][A-Za-z0-9_.-]*/g, (term) => localizeWorkflowTerm(term))
}

export function localizeWorkflowTerm(value: string) {
  return workflowTermLabels[value] ?? workflowTermLabels[value.replace(/-/g, '_')] ?? value
}
