export const modelCategories=['language','multimodal','vision','embedding','reranker','image_generation','video_generation','speech_recognition','speech_synthesis','other'] as const
export type ModelCategory=typeof modelCategories[number]

export function inferModelCategory(id:string,name=''):ModelCategory{
  const value=`${id} ${name}`.toLowerCase()
  if(/\b(embed|embedding|bge-m3|e5-|gte-|text2vec|m3e)\b/.test(value))return 'embedding'
  if(/\b(rerank|reranker|re-rank|bge-reranker|cross-encoder)\b/.test(value))return 'reranker'
  if(/\b(whisper|speech[-_ ]?to[-_ ]?text|stt|asr|paraformer|sensevoice)\b/.test(value))return 'speech_recognition'
  if(/\b(text[-_ ]?to[-_ ]?speech|tts|speech synthesis|cosyvoice|fish-speech|chattts)\b/.test(value))return 'speech_synthesis'
  if(/\b(sora|video[-_ ]?(gen|generation)|text[-_ ]?to[-_ ]?video|wan2|cogvideo|hunyuanvideo|veo)\b/.test(value))return 'video_generation'
  if(/\b(dall[-_ ]?e|image[-_ ]?(gen|generation)|text[-_ ]?to[-_ ]?image|stable[-_ ]?diffusion|sdxl|flux|imagen|ideogram|kolors)\b/.test(value))return 'image_generation'
  if(/\b(gpt-4o|gpt-4\.1|gemini|claude-3|claude-4|qwen[-_]?vl|qwen2\.5-vl|llava|internvl|minicpm-v|glm-4v|pixtral|multimodal|omni)\b/.test(value))return 'multimodal'
  if(/\b(vision|visual|clip|siglip|ocr|object[-_ ]?detect|segmentation|sam2?)\b/.test(value))return 'vision'
  return 'language'
}