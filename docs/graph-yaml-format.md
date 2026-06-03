# graph YAML 格式

這份格式給流程圖編輯器讀寫，重點是「人看得懂、畫布畫得出來、之後也能轉回 ai-mc steps」。

```yaml
schema_version: 0.2-graph
name: example-workflow
language: zh-TW
workflows:
  main:
    title: 主要流程
    description: 這條流程的用途
    graph:
      direction: TB
      nodes:
        - id: summarize-issue
          kind: ai_task
          title: 整理問題單
          description: 把問題單整理成可實作的任務摘要
          purpose: 讓後續搜尋、規劃和修改都有共同目標
          instructions:
            - 用白話整理真正要解決的問題
            - 列出完成後要檢查的驗收條件
          decision_rules:
            - 如果資訊不足，列入待釐清問題
          input:
            - issue_json
            - focus
          output: issue_summary
      edges:
        - from: summarize-issue
          to: search-related-code
          label: 下一步
```

## 節點欄位

- `id`: 穩定識別碼，給程式讀。
- `kind`: 節點類型，支援 `start`、`ai_task`、`condition`、`human_check`、`output`、`shell`、`tool`、`file`、`code_edit`、`terminal`。
- `title`: 畫布上的標題。
- `description`: 右側設定面板的白話說明。
- `purpose`: 這一步存在的原因。
- `instructions`: AI 或執行者要照做的指示。
- `decision_rules`: 條件節點或 AI 判斷時的規則。
- `input`: 需要讀取的資料。
- `output`: 產出的資料名稱。
- `handles`: 條件節點可選，用來定義多分支出口。

## 線欄位

- `from`: 起點節點 id。
- `to`: 終點節點 id。
- `label`: 線上的文字，例如 `是`、`否`、`通過`、`回圈`。
- `sourceHandle`: 可選，指定從哪個出口連出。
- `targetHandle`: 可選，指定接到哪個入口。
