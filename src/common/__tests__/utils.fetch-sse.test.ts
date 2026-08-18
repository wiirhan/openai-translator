import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchSSE } from '../utils'

const { fetchStream, listen } = vi.hoisted(() => ({
    fetchStream: vi.fn(),
    listen: vi.fn(),
}))

vi.mock('@/tauri/bindings', () => ({
    commands: {
        fetchStream,
    },
}))

vi.mock('@tauri-apps/api/event', () => ({
    emit: vi.fn(),
    listen,
}))

vi.mock('../diagnostics', () => ({
    getDiagnosticRequestId: vi.fn(() => 'request-id'),
    logDiagnostic: vi.fn(),
}))

vi.mock('../universal-fetch', () => ({
    getUniversalFetch: vi.fn(),
}))

describe('fetchSSE on Tauri', () => {
    beforeEach(() => {
        Object.defineProperty(window, '__TAURI__', { configurable: true, value: {} })
        vi.clearAllMocks()
    })

    afterEach(() => {
        delete (window as unknown as Record<string, unknown>).__TAURI__
    })

    it('waits for stream listeners and rejects a wrapped Rust error result', async () => {
        let resolveStatusListener: ((unlisten: () => void) => void) | undefined
        let resolveChunkListener: ((unlisten: () => void) => void) | undefined
        listen.mockImplementation((event: string) => {
            return new Promise<() => void>((resolve) => {
                if (event === 'fetch-stream-status-code') {
                    resolveStatusListener = resolve
                } else {
                    resolveChunkListener = resolve
                }
            })
        })
        fetchStream.mockResolvedValue({ status: 'error', error: 'network down' })

        const result = fetchSSE('https://example.com/stream', {
            method: 'POST',
            signal: new AbortController().signal,
            onMessage: vi.fn(),
            onError: vi.fn(),
        })

        await Promise.resolve()
        expect(fetchStream).not.toHaveBeenCalled()

        resolveStatusListener?.(vi.fn())
        resolveChunkListener?.(vi.fn())

        await expect(result).rejects.toThrow('network down')
        expect(fetchStream).toHaveBeenCalledOnce()
    })
})
