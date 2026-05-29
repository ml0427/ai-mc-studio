import { execFile } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import express from 'express'
import YAML from 'yaml'

const PORT = Number(process.env.AI_MC_STUDIO_PORT ?? 4317)
const PROJECTS_ROOT = path.resolve(process.env.AI_MC_PROJECTS_ROOT ?? path.join(process.cwd(), '..'))
const AI_MC_CLI = path.resolve(process.env.AI_MC_CLI ?? path.join(PROJECTS_ROOT, 'ai-mc', 'bin', 'ai-mc.js'))
const SCAN_DEPTH = Number(process.env.AI_MC_SCAN_DEPTH ?? 2)
const AI_MC_TIMEOUT_MS = Number(process.env.AI_MC_TIMEOUT_MS ?? 30000)
const IGNORED_DIRS = new Set([
  '.git',
  '.workflow-runs',
  'dist',
  'dist-ssr',
  'node_modules',
  'target',
])

type WorkflowSpec = {
  schema_version?: string
  name?: string
  description?: string
  workflows?: Record<string, WorkflowDefinition>
}

type WorkflowDefinition = {
  description?: string
  inputs?: WorkflowInputs
  steps?: WorkflowStep[]
  gates?: unknown
  evidence?: unknown
}

type WorkflowInputs = {
  required?: WorkflowInput[]
  optional?: WorkflowInput[]
}

type WorkflowInput = {
  name: string
  example?: unknown
}

type WorkflowStep = {
  id: string
  type: string
  when?: string
  output?: string
  output_schema?: unknown
  command_ref?: string
  commands?: string[]
}

type ProjectRecord = {
  id: string
  name: string
  rootPath: string
  workflowPath: string
  workflowCount: number
  stepCount: number
  runCount: number
  latestRun?: WizardRunSummary
  workflows: WorkflowSummary[]
  scannedAt: string
}

type ProjectDetail = ProjectRecord & {
  spec: WorkflowSpec
  rawYaml: string
  rawHash: string
}

type WorkflowSummary = {
  name: string
  description: string
  stepCount: number
  requiredInputs: string[]
  optionalInputs: string[]
  gateCount: number
}

type WizardRunSummary = {
  runId: string
  workflow: string
  status: string
  currentStep: string | null
  completedCount: number
  skippedCount: number
  totalSteps: number
  updatedAt: string
  statePath: string
}

const app = express()
app.use(express.json({ limit: '2mb' }))

app.get('/api/health', (_request, response) => {
  response.json({
    ok: true,
    projectsRoot: PROJECTS_ROOT,
    scanDepth: SCAN_DEPTH,
    aiMcCli: AI_MC_CLI,
    aiMcAvailable: existsSync(AI_MC_CLI),
  })
})

app.get('/api/projects', async (_request, response, next) => {
  try {
    response.json({
      projectsRoot: PROJECTS_ROOT,
      scanDepth: SCAN_DEPTH,
      projects: await scanProjects(),
    })
  } catch (error) {
    next(error)
  }
})

app.get('/api/projects/:projectId', async (request, response, next) => {
  try {
    const project = await resolveProject(request.params.projectId)
    const detail = await readProjectDetail(project)
    response.json(detail)
  } catch (error) {
    next(error)
  }
})

app.get('/api/projects/:projectId/workflows/:workflowName/graph', async (request, response, next) => {
  try {
    const project = await resolveProject(request.params.projectId)
    const graph = await runAiMc(['graph', request.params.workflowName, '--format', 'mermaid'], project.rootPath)
    response.type('text/plain').send(graph)
  } catch (error) {
    next(error)
  }
})

app.get('/api/projects/:projectId/adapters', async (request, response, next) => {
  try {
    const project = await resolveProject(request.params.projectId)
    const output = await runAiMc(['adapters'], project.rootPath)
    response.json({ output: JSON.parse(output) })
  } catch (error) {
    next(error)
  }
})

app.get('/api/projects/:projectId/runners', async (request, response, next) => {
  try {
    const project = await resolveProject(request.params.projectId)
    const output = await runAiMc(['runners'], project.rootPath)
    response.type('text/plain').send(output)
  } catch (error) {
    next(error)
  }
})

app.get('/api/projects/:projectId/runs', async (request, response, next) => {
  try {
    const project = await resolveProject(request.params.projectId)
    response.json({ runs: await readRuns(project.rootPath) })
  } catch (error) {
    next(error)
  }
})

app.get('/api/projects/:projectId/runs/:runId', async (request, response, next) => {
  try {
    const project = await resolveProject(request.params.projectId)
    response.json(await readRunState(project.rootPath, request.params.runId))
  } catch (error) {
    next(error)
  }
})

app.get('/api/projects/:projectId/runs/:runId/graph', async (request, response, next) => {
  try {
    const project = await resolveProject(request.params.projectId)
    const graph = await runAiMc(['wizard', 'status', '--run', request.params.runId, '--format', 'mermaid'], project.rootPath)
    response.type('text/plain').send(graph)
  } catch (error) {
    next(error)
  }
})

app.post('/api/projects/:projectId/runs', async (request, response) => {
  try {
    const project = await resolveProject(request.params.projectId)
    const workflow = String(request.body?.workflow ?? '')
    const inputs = request.body?.inputs ?? {}
    if (!workflow) {
      response.status(400).json({ ok: false, message: 'workflow is required' })
      return
    }

    const args = ['wizard', 'start', workflow]
    for (const [key, value] of Object.entries(inputs)) {
      args.push('-i', `${key}=${String(value)}`)
    }
    const output = await runAiMc(args, project.rootPath)
    const runId = output.match(/run id:\s*(.+)$/m)?.[1]?.trim()
    response.json({
      ok: true,
      output,
      runId,
      runs: await readRuns(project.rootPath),
    })
  } catch (error) {
    response.status(400).json({ ok: false, message: errorMessage(error) })
  }
})

app.post('/api/projects/:projectId/validate', async (request, response) => {
  try {
    const project = await resolveProject(request.params.projectId)
    const output = await runAiMc(['validate'], project.rootPath)
    response.json({ ok: true, output })
  } catch (error) {
    response.status(400).json({ ok: false, message: errorMessage(error) })
  }
})

app.post('/api/projects/:projectId/workflow/validate', async (request, response) => {
  try {
    const project = await resolveProject(request.params.projectId)
    const content = String(request.body?.content ?? '')
    if (!content.trim()) {
      response.status(400).json({ ok: false, message: 'workflow content is empty' })
      return
    }
    const output = await validateWorkflowContent(project, content)
    response.json({ ok: true, output })
  } catch (error) {
    response.status(400).json({ ok: false, message: errorMessage(error) })
  }
})

app.put('/api/projects/:projectId/workflow', async (request, response) => {
  try {
    const project = await resolveProject(request.params.projectId)
    const content = String(request.body?.content ?? '')
    const expectedHash = String(request.body?.expectedHash ?? '')
    if (!content.trim()) {
      response.status(400).json({ ok: false, message: 'workflow content is empty' })
      return
    }

    await validateWorkflowContent(project, content)

    const workflowDir = path.dirname(project.workflowPath)
    const backupPath = path.join(workflowDir, `workflow.${new Date().toISOString().replace(/[:.]/g, '-')}.bak.yaml`)
    const tempPath = path.join(workflowDir, `workflow.${randomUUID()}.tmp.yaml`)
    const previous = await readFile(project.workflowPath, 'utf8')
    if (expectedHash && hashText(previous) !== expectedHash) {
      response.status(409).json({
        ok: false,
        message: 'workflow.yaml 已在 Studio 外被修改，請重新掃描後再儲存。',
      })
      return
    }
    await writeFile(backupPath, previous, 'utf8')
    await writeFile(tempPath, content, 'utf8')
    await rename(tempPath, project.workflowPath)

    response.json({
      ok: true,
      backupPath,
      project: await readProjectDetail(project),
    })
  } catch (error) {
    response.status(400).json({ ok: false, message: errorMessage(error) })
  }
})

async function scanProjects(): Promise<ProjectRecord[]> {
  const projects: ProjectRecord[] = []
  const scannedAt = new Date().toISOString()
  const projectRoots = await findWorkflowProjectRoots(PROJECTS_ROOT, SCAN_DEPTH)

  for (const rootPath of projectRoots) {
    const workflowPath = path.join(rootPath, '.workflow', 'workflow.yaml')
    const name = path.basename(rootPath)

    try {
      const rawYaml = await readFile(workflowPath, 'utf8')
      const spec = YAML.parse(rawYaml) as WorkflowSpec
      const workflows = workflowSummaries(spec)
      const runs = await readRuns(rootPath)
      projects.push({
        id: encodeProjectId(rootPath),
        name,
        rootPath,
        workflowPath,
        workflowCount: workflows.length,
        stepCount: workflows.reduce((total, workflow) => total + workflow.stepCount, 0),
        runCount: runs.length,
        latestRun: runs[0],
        workflows,
        scannedAt,
      })
    } catch {
      projects.push({
        id: encodeProjectId(rootPath),
        name,
        rootPath,
        workflowPath,
        workflowCount: 0,
        stepCount: 0,
        runCount: 0,
        workflows: [],
        scannedAt,
      })
    }
  }

  return projects.sort((left, right) => left.name.localeCompare(right.name))
}

async function validateWorkflowContent(project: ProjectRecord, content: string): Promise<string> {
  YAML.parse(content)
  const workflowDir = path.dirname(project.workflowPath)
  const checkPath = path.join(workflowDir, `workflow.studio-check.${randomUUID()}.yaml`)
  await writeFile(checkPath, content, 'utf8')
  try {
    return await runAiMc(['validate', '--spec', checkPath], project.rootPath)
  } finally {
    await rm(checkPath, { force: true })
  }
}

async function findWorkflowProjectRoots(root: string, maxDepth: number): Promise<string[]> {
  const found = new Set<string>()

  async function visit(dir: string, depth: number) {
    const workflowPath = path.join(dir, '.workflow', 'workflow.yaml')
    if (existsSync(workflowPath)) {
      found.add(dir)
      return
    }
    if (depth >= maxDepth) return

    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (entry.name.startsWith('.') || IGNORED_DIRS.has(entry.name)) continue
      await visit(path.join(dir, entry.name), depth + 1)
    }
  }

  await visit(root, 0)
  return [...found].sort((left, right) => left.localeCompare(right))
}

async function resolveProject(projectId: string): Promise<ProjectRecord> {
  const projects = await scanProjects()
  const project = projects.find((candidate) => candidate.id === projectId)
  if (!project) throw new Error(`Unknown project: ${projectId}`)
  return project
}

async function readProjectDetail(project: ProjectRecord): Promise<ProjectDetail> {
  const rawYaml = await readFile(project.workflowPath, 'utf8')
  const spec = YAML.parse(rawYaml) as WorkflowSpec
  return {
    ...project,
    spec,
    rawYaml,
    rawHash: hashText(rawYaml),
    workflows: workflowSummaries(spec),
  }
}

function workflowSummaries(spec: WorkflowSpec): WorkflowSummary[] {
  return Object.entries(spec.workflows ?? {}).map(([name, workflow]) => ({
    name,
    description: workflow.description ?? '',
    stepCount: workflow.steps?.length ?? 0,
    requiredInputs: workflow.inputs?.required?.map((input) => input.name) ?? [],
    optionalInputs: workflow.inputs?.optional?.map((input) => input.name) ?? [],
    gateCount: [
      ...normalizeList((workflow.gates as { fail_if?: unknown })?.fail_if),
      ...normalizeList((workflow.gates as { warn_if?: unknown })?.warn_if),
    ].length,
  }))
}

async function readRuns(projectRoot: string): Promise<WizardRunSummary[]> {
  const runsDir = path.join(projectRoot, '.workflow', '.workflow-runs')
  if (!existsSync(runsDir)) return []

  const entries = await readdir(runsDir, { withFileTypes: true })
  const runs: WizardRunSummary[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    try {
      const state = await readRunState(projectRoot, entry.name)
      runs.push(summarizeRunState(state, path.join(runsDir, entry.name, 'wizard-state.json')))
    } catch {
      // Ignore incomplete run directories.
    }
  }

  return runs.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

async function readRunState(projectRoot: string, runId: string): Promise<Record<string, unknown>> {
  if (runId.includes('/') || runId.includes('\\') || runId.includes('..')) {
    throw new Error(`Invalid run id: ${runId}`)
  }
  const statePath = path.join(projectRoot, '.workflow', '.workflow-runs', runId, 'wizard-state.json')
  const raw = await readFile(statePath, 'utf8')
  return JSON.parse(raw) as Record<string, unknown>
}

function summarizeRunState(state: Record<string, unknown>, statePath: string): WizardRunSummary {
  const completed = Array.isArray(state.completed_steps) ? state.completed_steps : []
  const skipped = Array.isArray(state.skipped_steps) ? state.skipped_steps : []
  const steps = Array.isArray(state.steps) ? state.steps : []
  return {
    runId: String(state.run_id ?? ''),
    workflow: String(state.workflow ?? ''),
    status: String(state.status ?? ''),
    currentStep: state.current_step ? String(state.current_step) : null,
    completedCount: completed.length,
    skippedCount: skipped.length,
    totalSteps: steps.length,
    updatedAt: String(state.updated_at ?? state.created_at ?? ''),
    statePath,
  }
}

function normalizeList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function encodeProjectId(rootPath: string): string {
  return Buffer.from(rootPath).toString('base64url')
}

function hashText(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function runAiMc(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('node', [AI_MC_CLI, ...args], {
      cwd,
      maxBuffer: 20 * 1024 * 1024,
      timeout: AI_MC_TIMEOUT_MS,
    }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error([stderr, stdout, error.message].filter(Boolean).join('\n')))
        return
      }
      resolve(stdout)
    })
  })
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

app.use((error: unknown, _request: express.Request, response: express.Response, next: express.NextFunction) => {
  void next
  response.status(500).json({ ok: false, message: errorMessage(error) })
})

await mkdir(PROJECTS_ROOT, { recursive: true })
app.listen(PORT, '127.0.0.1', () => {
  console.log(`AI-MC Studio API listening on http://127.0.0.1:${PORT}`)
  console.log(`Scanning projects under ${PROJECTS_ROOT}`)
})
