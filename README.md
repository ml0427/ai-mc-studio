# AI-MC Studio MVP

Clean frontend prototype for a drag-and-drop AI workflow editor.

## Scope

- React + TypeScript + Vite
- React Flow canvas
- Add, drag, connect, select, and edit workflow nodes
- Import ai-mc workflow YAML / JSON into the canvas
- Export previews as ai-mc JSON, graph YAML, or persisted canvas JSON
- Autosave canvas state to `localStorage`

No backend, CLI integration, database, login, or multi-agent runtime is included in this MVP.

## Run locally

```bash
npm install
npm run dev
```

## Quality checks

```bash
npm run lint
npm test
npm run build
```

## Workflow formats

AI-MC Studio works with three related formats:

1. ai-mc workflow YAML / JSON
   - Step-oriented workflow input.
   - Import it from the left toolbox with "匯入 ai-mc".
   - Example: [`examples/sample-workflow.yaml`](examples/sample-workflow.yaml)

2. graph YAML
   - Canvas-oriented workflow format with explicit nodes, edges, handles, and labels.
   - Use this when you want to preserve graph structure and branch metadata.
   - Format reference: [`docs/graph-yaml-format.md`](docs/graph-yaml-format.md)
   - Example: [`examples/graph-workflow.yaml`](examples/graph-workflow.yaml)

3. canvas JSON backup
   - Full editor state, including node positions, selected workflow name, preview mode, and theme mode.
   - Use "下載畫布 JSON" to save it and "畫布備份" to restore it.

## Basic usage

1. Start the dev server with `npm run dev`.
2. Add nodes from the left toolbox or import an ai-mc workflow.
3. Edit the selected node from the right settings panel.
4. Connect nodes on the canvas.
5. Use the preview panel to copy or download ai-mc JSON, graph YAML, or canvas JSON.

## Notes

- The app is frontend-only; Vite dev server does not proxy `/api` to a backend.
- Canvas data is persisted in browser `localStorage` under `ai-mc-studio:canvas-state:v1`.
- The build splits large third-party dependencies into vendor chunks to keep Vite output warnings quiet.
