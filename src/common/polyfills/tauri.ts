/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { writeTextFile, BaseDirectory } from '@tauri-apps/plugin-fs'
import { Proxy, ProxyConfig, fetch } from '@tauri-apps/plugin-http'
import * as utils from '../utils'
import { ISettings } from '../types'
import { commands } from '@/tauri/bindings'

async function getSettings(): Promise<Record<string, any>> {
    const settings = await commands.getConfigContent()
    return JSON.parse(settings)
}

export const getFetchProxy = (proxy?: ISettings['proxy'], ignoreEnabled?: boolean): Proxy | undefined => {
    const proxyConfig = getFetchProxyConfig(proxy, ignoreEnabled)
    if (!proxyConfig) {
        return undefined
    }
    return {
        all: proxyConfig,
        http: proxyConfig,
        https: proxyConfig,
    }
}

export const getFetchProxyConfig = (proxy?: ISettings['proxy'], ignoreEnabled?: boolean): ProxyConfig | undefined => {
    if (!proxy) {
        return undefined
    }
    if (!ignoreEnabled && !proxy.enabled) {
        return undefined
    }
    if (!proxy.protocol || !proxy.server || !proxy.port) {
        return undefined
    }
    const proxyURL = `${proxy.protocol?.toLowerCase()}://${proxy.server}:${proxy.port}`
    const proxyConfig: ProxyConfig = {
        url: proxyURL,
        noProxy: proxy.noProxy,
    }
    if (proxy.basicAuth?.username) {
        proxyConfig.basicAuth = {
            username: proxy.basicAuth?.username || '',
            password: proxy.basicAuth?.password || '',
        }
    }
    return proxyConfig
}

export const tauriFetch = async (input: RequestInfo, init?: RequestInit) => {
    const settings = await utils.getSettings()
    const fetchProxy = getFetchProxy(settings.proxy, false)
    const proxyInit = {
        ...init,
        proxy: fetchProxy,
    }
    return await fetch(input, proxyInit)
}
