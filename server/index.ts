import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import express from 'express'
import YAML from 'yaml'

const PORT = Number(process.env.AI_MC_STUDIO_PORT ?? 4317)
const PROJECTS_ROOT = path.resolve(process.env.AI_MC_PROJECTS_ROOT ?? path.join(process.cwd(), '..'))
const AI_MC_CLI = path.resolve(process.env.AI_MC_CLI ?? path.join(PROJECTS_ROOT, 'ai-mc', 'bin', 'ai-mc.js'))

type WorkflowSpec = {
  schema_version?: string
  name?: string
  description?: string
  workflows?: Record<string, WorkflowDefinition>
}

type WorkflowDefinition = {
  description?: string
  steps?: WorkflowStep[]
  gates?: unknown
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
  workflows: WorkflowSummary[]
  scannedAt: string
}

type WorkflowSummary = {
  name: string
  description: string
  stepCount: number
}

const app = express()
app.use(express.json({ limit: '2mb' }))

app.get('/api/health', (_request, response) => {
  response.json({
    ok: true,
    projectsRoot: PROJECTS_ROOT,
    aiMcCli: AI_MC_CLI,
    aiMcAvailable: existsSync(AI_MC_CLI),
  })
})

app.get('/api/projects', async (_request, response, next) => {
  try {
    response.json({
      projectsRoot: PROJECTS_ROOT,
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

app.post('/api/projects/:projectId/validate', async (request, response) => {
  try {
    const project = await resolveProject(request.params.projectId)
    const output = await runAiMc(['validate'], project.rootPath)
    response.json({ ok: true, output })
  } catch (error) {
    response.status(400).json({ ok: false, message: errorMessage(error) })
  }
})

app.put('/api/projects/:projectId/workflow', async (request, response) => {
  try {
    const project = await resolveProject(request.params.projectId)
    const content = String(request.body?.content ?? '')
    if (!content.trim()) {
      response.status(400).json({ ok: false, message: 'workflow content is empty' })
      return
    }

    YAML.parse(content)
    const workflowDir = path.dirname(project.workflowPath)
    const checkPath = path.join(workflowDir, 'workflow.studio-check.yaml')
    await writeFile(checkPath, content, 'utf8')
    try {
      await runAiMc(['validate', '--spec', checkPath], project.rootPath)
    } finally {
      await rm(checkPath, { force: true })
    }

    const backupPath = path.join(workflowDir, `workflow.${new Date().toISOString().replace(/[:.]/g, '-')}.bak.yaml`)
    const previous = await readFile(project.workflowPath, 'utf8')
    await writeFile(backupPath, previous, 'utf8')
    await writeFile(project.workflowPath, content, 'utf8')

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
  const entries = await readdir(PROJECTS_ROOT, { withFileTypes: true })
  const projects: ProjectRecord[] = []
  const scannedAt = new Date().toISOString()

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const rootPath = path.join(PROJECTS_ROOT, entry.name)
    const workflowPath = path.join(rootPath, '.workflow', 'workflow.yaml')
    if (!existsSync(workflowPath)) continue

    try {
      const rawYaml = await readFile(workflowPath, 'utf8')
      const spec = YAML.parse(rawYaml) as WorkflowSpec
      const workflows = workflowSummaries(spec)
      projects.push({
        id: encodeProjectId(rootPath),
        name: entry.name,
        rootPath,
        workflowPath,
        workflowCount: workflows.length,
        stepCount: workflows.reduce((total, workflow) => total + workflow.stepCount, 0),
        workflows,
        scannedAt,
      })
    } catch {
      projects.push({
        id: encodeProjectId(rootPath),
        name: entry.name,
        rootPath,
        workflowPath,
        workflowCount: 0,
        stepCount: 0,
        workflows: [],
        scannedAt,
      })
    }
  }

  return projects.sort((left, right) => left.name.localeCompare(right.name))
}

async function resolveProject(projectId: string): Promise<ProjectRecord> {
  const projects = await scanProjects()
  const project = projects.find((candidate) => candidate.id === projectId)
  if (!project) throw new Error(`Unknown project: ${projectId}`)
  return project
}

async function readProjectDetail(project: ProjectRecord) {
  const rawYaml = await readFile(project.workflowPath, 'utf8')
  const spec = YAML.parse(rawYaml) as WorkflowSpec
  return {
    ...project,
    spec,
    rawYaml,
    workflows: workflowSummaries(spec),
  }
}

function workflowSummaries(spec: WorkflowSpec): WorkflowSummary[] {
  return Object.entries(spec.workflows ?? {}).map(([name, workflow]) => ({
    name,
    description: workflow.description ?? '',
    stepCount: workflow.steps?.length ?? 0,
  }))
}

function encodeProjectId(rootPath: string): string {
  return Buffer.from(rootPath).toString('base64url')
}

function runAiMc(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('node', [AI_MC_CLI, ...args], { cwd, maxBuffer: 20 * 1024 * 1024 }, (error, stdout, stderr) => {
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
app.listen(PORT, () => {
  console.log(`AI-MC Studio API listening on http://localhost:${PORT}`)
  console.log(`Scanning projects under ${PROJECTS_ROOT}`)
})
