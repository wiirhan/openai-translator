import { v4 as uuidv4 } from 'uuid'

const LOG_DIR = 'diagnostics'
const LOG_FILE = `${LOG_DIR}/translation-diagnostics.log`
const PREVIOUS_LOG_FILE = `${LOG_DIR}/translation-diagnostics.1.log`
const MAX_FILE_BYTES = 1024 * 1024
const MAX_RECORD_BYTES = 2048
const sessionId = uuidv4()
const requestIds = new WeakMap<AbortSignal, string>()
let writeQueue = Promise.resolve()

type DiagnosticValue = string | number | boolean | null | undefined

function sanitizeString(value: string): string {
    return Array.from(value, (character) => {
        const code = character.charCodeAt(0)
        return code < 32 || code === 127 ? ' ' : character
    })
        .join('')
        .slice(0, 160)
}

export function formatDiagnosticRecord(
    event: string,
    requestId: string,
    fields: Record<string, DiagnosticValue> = {}
): string {
    const safeFields = Object.fromEntries(
        Object.entries(fields)
            .filter(([, value]) => value !== undefined)
            .map(([key, value]) => [key, typeof value === 'string' ? sanitizeString(value) : value])
    )
    const record = {
        schemaVersion: 1,
        timestamp: new Date().toISOString(),
        sessionId,
        requestId,
        event: sanitizeString(event),
        ...safeFields,
    }
    let line = JSON.stringify(record)
    if (new TextEncoder().encode(line).length > MAX_RECORD_BYTES) {
        line = JSON.stringify({
            schemaVersion: 1,
            timestamp: record.timestamp,
            sessionId,
            requestId,
            event: record.event,
            truncated: true,
        })
    }
    return `${line}\n`
}

async function append(line: string): Promise<void> {
    if (typeof window === 'undefined' || !('__TAURI__' in window)) {
        return
    }
    const { BaseDirectory, exists, mkdir, remove, rename, stat, writeTextFile } = await import('@tauri-apps/plugin-fs')
    const baseDir = BaseDirectory.AppLog
    await mkdir(LOG_DIR, { baseDir, recursive: true, mode: 0o700 })
    const lineBytes = new TextEncoder().encode(line).length
    if (await exists(LOG_FILE, { baseDir })) {
        const { size } = await stat(LOG_FILE, { baseDir })
        if (size + lineBytes > MAX_FILE_BYTES) {
            if (await exists(PREVIOUS_LOG_FILE, { baseDir })) {
                await remove(PREVIOUS_LOG_FILE, { baseDir })
            }
            await rename(LOG_FILE, PREVIOUS_LOG_FILE, {
                oldPathBaseDir: baseDir,
                newPathBaseDir: baseDir,
            })
        }
    }
    await writeTextFile(LOG_FILE, line, { baseDir, append: true, mode: 0o600 })
}

export function logDiagnostic(event: string, requestId: string, fields: Record<string, DiagnosticValue> = {}): void {
    const line = formatDiagnosticRecord(event, requestId, fields)
    writeQueue = writeQueue.then(() => append(line)).catch(() => undefined)
}

export function registerDiagnosticRequest(signal: AbortSignal, requestId: string): void {
    requestIds.set(signal, requestId)
}

export function getDiagnosticRequestId(signal?: AbortSignal | null): string | undefined {
    return signal ? requestIds.get(signal) : undefined
}

export function unregisterDiagnosticRequest(signal: AbortSignal): void {
    requestIds.delete(signal)
}
