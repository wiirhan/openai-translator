import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Kimi } from './kimi'

const { fetcher, fetchSSE, logDiagnostic } = vi.hoisted(() => ({
    fetcher: vi.fn(),
    fetchSSE: vi.fn(),
    logDiagnostic: vi.fn(),
}))

vi.mock('@/common/universal-fetch', () => ({
    getUniversalFetch: () => fetcher,
}))

vi.mock('@/common/utils', () => ({
    fetchSSE,
    getSettings: vi.fn().mockResolvedValue({ kimiAccessToken: 'configured' }),
    isDesktopApp: vi.fn(() => true),
    setSettings: vi.fn(),
}))

vi.mock('@/common/diagnostics', () => ({
    getDiagnosticRequestId: vi.fn(() => 'request-id'),
    logDiagnostic,
}))

describe('Kimi', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        fetcher.mockResolvedValue({
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue({ id: 'chat-id' }),
        })
    })

    it('surfaces and logs a sanitized provider stream error', async () => {
        fetchSSE.mockImplementation(
            async (_input: string, options: { onMessage: (message: string) => Promise<void> }) => {
                await options.onMessage(
                    JSON.stringify({ event: 'error', error: { code: 'MODEL_BUSY', message: 'Model is busy' } })
                )
            }
        )
        const onError = vi.fn()
        const onFinished = vi.fn()

        await new Kimi().sendMessage({
            signal: new AbortController().signal,
            rolePrompt: '',
            commandPrompt: 'translate',
            onMessage: vi.fn(),
            onError,
            onFinished,
        })

        expect(onError).toHaveBeenCalledWith('Kimi: Model is busy')
        expect(onFinished).not.toHaveBeenCalled()
        expect(logDiagnostic).toHaveBeenCalledWith(
            'kimiProviderError',
            'request-id',
            expect.objectContaining({ errorCode: 'MODEL_BUSY', errorMessage: 'Model is busy' })
        )
    })
})
