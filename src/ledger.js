/**
 * The points ledger, a command speaking docs/ledger-protocol.md: the plugin
 * adds a verb and its arguments to the configured program and reads one JSON
 * document from the last line of stdout. The ledger keeps every number;
 * nothing here remembers a balance or a ticket.
 */
import { spawn } from 'node:child_process'

const MAX_OUTPUT = 1024 * 1024

const ledgerError = (message) => Object.assign(new Error(message), { code: 'ledger' })

/** Run `argv`; resolves with the exit code, stdout and the tail of stderr. */
export function runCommand(argv, { env, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const [command, ...args] = argv
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs)
    child.stdout.on('data', (chunk) => {
      stdout += chunk
      if (stdout.length > MAX_OUTPUT) child.kill('SIGTERM')
    })
    child.stderr.on('data', (chunk) => { stderr = (stderr + chunk).slice(-4000) })
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error.code === 'ENOENT' ? ledgerError(`${command} is not installed`) : error)
    })
    child.on('close', (code, signal) => {
      clearTimeout(timer)
      resolve({ code: code ?? signal, stdout, stderr })
    })
  })
}

const lastLine = text => text.trim().split('\n').filter(Boolean).pop() ?? ''

/**
 * @param {{ command: string[], env?: Record<string, string>, timeoutSeconds?: number }} config
 * @param {{ run?: typeof runCommand }} [options]
 */
export function createLedger(config, { run = runCommand } = {}) {
  const enabled = config.command.length > 0
  const timeoutMs = (config.timeoutSeconds ?? 20) * 1000

  /** One verb: `[verb, person, ...args]`. Throws a `ledger` error with the ledger's own message when it fails. */
  async function ask(args) {
    if (!enabled) throw ledgerError('no ledger command is set')
    const { code, stdout, stderr } = await run([...config.command, ...args, '--json'], { env: config.env, timeoutMs })
    if (code !== 0) throw ledgerError(lastLine(stderr) || `the ledger exited with ${code}`)
    try {
      const answer = JSON.parse(lastLine(stdout))
      if (answer !== null && typeof answer === 'object') return answer
    } catch {
      // Reported below.
    }
    throw ledgerError('the ledger did not answer with JSON')
  }

  return { enabled, ask }
}
