import { TranslateMode } from './translate'

export const CUSTOM_MODEL_ID = '__custom__'
export const PREFIX = '__yetone-nextai-translator'
export const builtinActionModes: { name: string; mode: Exclude<TranslateMode, 'big-bang'>; icon: string }[] = [
    {
        name: 'Translate',
        mode: 'translate',
        icon: 'MdOutlineGTranslate',
    },
]
export const chatgptArkoseReqParams = 'cgb=vhwi'
