# AI-MC Studio

AI-MC Studio 是 `ai-mc` 的本地互動式介面。`ai-mc` 繼續扮演 CLI / runner / workflow engine，Studio 則負責掃描已接入的專案、顯示 workflow 圖、查看 step 細節，並可直接編輯 `.workflow/workflow.yaml`。

## 開發啟動

```powershell
npm install
npm run dev
```

預設服務：

- Web: `http://localhost:5173`
- API: `http://localhost:4317`

API 預設掃描 `C:\Users\ml042\Projects`，並呼叫：

```text
C:\Users\ml042\Projects\ai-mc\bin\ai-mc.js
```

可以用環境變數覆蓋：

```powershell
$env:AI_MC_PROJECTS_ROOT="C:\Users\ml042\Projects"
$env:AI_MC_CLI="C:\Users\ml042\Projects\ai-mc\bin\ai-mc.js"
$env:AI_MC_SCAN_DEPTH="2"
npm run dev
```

## MVP 功能

- 掃描有 `.workflow/workflow.yaml` 的專案
- 預設掃描 2 層資料夾，可用 `AI_MC_SCAN_DEPTH` 調整
- 顯示 workflow 清單與 step 數量
- 用 `ai-mc graph <workflow> --format mermaid` 顯示流程圖
- 點選 step 查看 YAML 細節
- 用表單快速調整 step 的 `type`、`when`、`output`
- 建立 wizard run，並監看 run 狀態圖
- 編輯並儲存 workflow YAML
- 儲存前會先用 `ai-mc validate --spec <temp-file>` 驗證
- 有未儲存變更時，「驗證」會改成驗證草稿內容，不會只驗證磁碟檔案
- 儲存時會建立 `.bak.yaml` 備份
- 未修改時不能儲存，修改後可一鍵還原目前檔案內容
- Mermaid 會在需要畫圖時才載入，降低首屏 bundle 壓力

## 分工

- `server/index.ts`：薄後端，負責掃描專案、讀寫 YAML、包裝 `ai-mc` CLI。
- `src/App.tsx`：Studio UI，負責專案列表、workflow graph、step inspector、YAML editor。

## API 草圖

- `GET /api/projects`
- `GET /api/projects/:projectId`
- `POST /api/projects/:projectId/validate`
- `PUT /api/projects/:projectId/workflow`
- `GET /api/projects/:projectId/workflows/:workflowName/graph`
- `GET /api/projects/:projectId/runs`
- `POST /api/projects/:projectId/runs`
- `GET /api/projects/:projectId/runs/:runId`
- `GET /api/projects/:projectId/runs/:runId/graph`
