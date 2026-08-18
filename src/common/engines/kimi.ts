/* eslint-disable camelcase */
import { getUniversalFetch } from '@/common/universal-fetch'
import { fetchSSE, getSettings, isDesktopApp, setSettings } from '@/common/utils'
import { AbstractEngine } from '@/common/engines/abstract-engine'
import { IModel, IMessageRequest } from '@/common/engines/interfaces'
import { getDiagnosticRequestId, logDiagnostic } from '@/common/diagnostics'

export const keyKimiAccessToken = 'kimi-access-token'
export const keyKimiRefreshToken = 'kimi-refresh-token'

export class Kimi extends AbstractEngine {
    async checkLogin(): Promise<boolean> {
        const fetcher = getUniversalFetch()

        const headers = await this.getHeaders()

        const resp = await fetcher('https://kimi.moonshot.cn/api/user', {
            method: 'GET',
            headers,
        })

        return resp.status === 200
    }

    async getModel(): Promise<string> {
        return ''
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async listModels(_apiKey: string | undefined): Promise<IModel[]> {
        return []
    }

    async getHeaders() {
        const settings = await getSettings()
        const accessToken = settings.kimiAccessToken

        // generate traffic id like clg4susodhsh25d6vdhv
        const trafficID = Array.from({ length: 20 }, () => Math.floor(Math.random() * 36).toString(36)).join('')

        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Safari/537.36 Edg/91.0.864.41',
            'Origin': 'https://kimi.moonshot.cn',
            'Referer': 'https://kimi.moonshot.cn/',
            'X-Traffic-Id': trafficID,
        }
    }

    async sendMessage(req: IMessageRequest): Promise<void> {
        const settings = await getSettings()
        const fetcher = getUniversalFetch()

        const requestId = getDiagnosticRequestId(req.signal)
        const headers = await this.getHeaders()

        let createChatResp = await fetcher('https://kimi.moonshot.cn/api/chat', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                name: 'Kimi',
                is_example: false,
            }),
        })

        req.onStatusCode?.(createChatResp.status)
        if (requestId) {
            logDiagnostic('kimiChatCreated', requestId, { statusCode: createChatResp.status })
        }

        if (createChatResp.status === 401) {
            if (isDesktopApp() && settings.kimiRefreshToken) {
                headers['Authorization'] = `Bearer ${settings.kimiRefreshToken}`
                const refreshResp = await fetcher('https://kimi.moonshot.cn/api/auth/token/refresh', {
                    method: 'GET',
                    headers,
                })
                req.onStatusCode?.(refreshResp.status)
                if (refreshResp.status === 200) {
                    const data = await refreshResp.json()
                    headers['Authorization'] = `Bearer ${data.access_token}`
                    await setSettings({
                        ...settings,
                        kimiRefreshToken: data.refresh_token,
                        kimiAccessToken: data.access_token,
                    })
                    createChatResp = await fetcher('https://kimi.moonshot.cn/api/chat', {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({
                            name: 'Kimi',
                            is_example: false,
                        }),
                    })
                    req.onStatusCode?.(createChatResp.status)
                } else {
                    req.onError(`Kimi token refresh failed with HTTP ${refreshResp.status}`)
                    return
                }
            } else {
                req.onStatusCode?.(createChatResp.status)
                const jsn = (await createChatResp.json()) as {
                    message: string
                }
                req.onError('Kimi: ' + jsn.message)
                return
            }
        }

        if (!createChatResp.ok) {
            req.onError(`Kimi chat creation failed with HTTP ${createChatResp.status}`)
            return
        }

        const chatJsn = (await createChatResp.json()) as {
            id?: string
        }

        const chatID = chatJsn.id
        if (!chatID) {
            req.onError('Kimi chat creation response did not include a chat id')
            return
        }

        const messages = [
            {
                role: 'user',
                content: req.rolePrompt ? req.rolePrompt + '\n\n' + req.commandPrompt : req.commandPrompt,
            },
        ]

        let hasError = false
        let finished = false
        let receivedChars = 0
        const eventCounts = new Map<string, number>()
        const logSummary = (outcome: string) => {
            if (!requestId) return
            logDiagnostic('kimiStreamSummary', requestId, {
                outcome,
                receivedChars,
                eventCounts: Array.from(eventCounts.entries())
                    .map(([event, count]) => `${event}:${count}`)
                    .join(','),
            })
        }
        await fetchSSE(`https://kimi.moonshot.cn/api/chat/${chatID}/completion/stream`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                messages,
                refs: [],
                user_search: true,
            }),
            signal: req.signal,
            onMessage: async (msg) => {
                if (finished) return
                let resp
                try {
                    resp = JSON.parse(msg)
                } catch (e) {
                    hasError = true
                    finished = true
                    req.onError(JSON.stringify(e))
                    return
                }
                const eventName = typeof resp.event === 'string' ? resp.event : 'missing'
                eventCounts.set(eventName, (eventCounts.get(eventName) ?? 0) + 1)
                if (eventName === 'error') {
                    hasError = true
                    finished = true
                    const providerError = resp.error
                    const errorCode = providerError?.code ?? resp.code ?? resp.error_type
                    const errorMessage =
                        (typeof providerError?.message === 'string' && providerError.message) ||
                        (typeof providerError === 'string' && providerError) ||
                        (typeof resp.message === 'string' && resp.message) ||
                        (typeof resp.msg === 'string' && resp.msg) ||
                        'Kimi stream error'
                    logSummary('providerError')
                    if (requestId) {
                        logDiagnostic('kimiProviderError', requestId, {
                            errorCode: errorCode === undefined ? undefined : String(errorCode),
                            errorMessage,
                            eventFields: Object.keys(resp).join(','),
                        })
                    }
                    req.onError(`Kimi: ${errorMessage}`)
                    return
                }
                if (eventName !== 'cmpl') {
                    if (eventName === 'all_done') {
                        finished = true
                        logSummary(receivedChars > 0 ? 'allDone' : 'emptyAllDone')
                        if (receivedChars > 0) {
                            req.onFinished('stop')
                        } else {
                            hasError = true
                            req.onError('Kimi returned an empty response')
                        }
                        return
                    }
                    return
                }
                const text = typeof resp.text === 'string' ? resp.text : ''
                receivedChars += text.length
                await req.onMessage({ content: text, role: '' })
            },
            onError: (err) => {
                hasError = true
                if (err instanceof Error) {
                    req.onError(err.message)
                    return
                }
                if (typeof err === 'string') {
                    req.onError(err)
                    return
                }
                if (typeof err === 'object') {
                    const item = err[0]
                    if (item && item.error && item.error.message) {
                        req.onError(item.error.message)
                        return
                    }
                }
                const { error } = err
                if (error instanceof Error) {
                    req.onError(error.message)
                    return
                }
                if (typeof error === 'object') {
                    const { message } = error
                    if (message) {
                        if (typeof message === 'string') {
                            req.onError(message)
                        } else {
                            req.onError(JSON.stringify(message))
                        }
                        return
                    }
                }
                req.onError('Unknown error')
            },
        })

        if (!finished && !hasError) {
            logSummary(receivedChars > 0 ? 'streamEnded' : 'emptyStreamEnded')
            if (receivedChars > 0) {
                req.onFinished('stop')
            } else {
                req.onError('Kimi stream ended without translation output')
            }
        }
    }
}
