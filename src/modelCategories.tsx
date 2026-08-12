import { Badge } from './components'

export const modelCategoryLabels={language:'大语言模型',multimodal:'多模态模型',vision:'视觉模型',embedding:'Embedding 模型',reranker:'重排序模型',image_generation:'图片生成模型',video_generation:'视频生成模型',speech_recognition:'语音识别模型',speech_synthesis:'语音合成模型',other:'其他模型'} as const
export type ModelCategory=keyof typeof modelCategoryLabels
export const modelCategoryOptions=Object.entries(modelCategoryLabels) as [ModelCategory,string][]

export function ModelCategoryBadge({value}:{value:ModelCategory}){
  const tone=value==='multimodal'?'purple':value==='embedding'||value==='reranker'?'blue':value.includes('generation')?'amber':value.startsWith('speech')?'green':'gray'
  return <Badge tone={tone}>{modelCategoryLabels[value]??modelCategoryLabels.other}</Badge>
}