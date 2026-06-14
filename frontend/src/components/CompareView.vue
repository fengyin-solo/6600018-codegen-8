<template>
  <div class="flex h-full w-full">
    <div class="w-1/2 h-full bg-gray-950 overflow-hidden flex flex-col border-r border-gray-800">
      <div class="px-4 py-2 bg-gray-900 border-b border-gray-800 flex items-center justify-between">
        <span class="text-amber-400 font-medium text-sm">原图</span>
        <div class="flex gap-1">
          <button @click="zoomOut" class="px-2 py-1 bg-gray-800 rounded text-xs hover:bg-gray-700">-</button>
          <span class="px-2 py-1 text-xs text-gray-400">{{ Math.round(scale * 100) }}%</span>
          <button @click="zoomIn" class="px-2 py-1 bg-gray-800 rounded text-xs hover:bg-gray-700">+</button>
        </div>
      </div>
      <div ref="imageScrollRef" class="flex-1 overflow-auto" @scroll="onImageScroll">
        <div ref="imageContainerRef" class="relative" :style="{ transform: `scale(${scale})`, transformOrigin: 'top left' }">
          <img v-if="store.currentDoc?.imageUrl" :src="store.currentDoc.imageUrl"
            class="block" ref="imgRef" @load="onImageLoad" />
          <canvas v-else ref="mockCanvas" class="block" />
          <svg class="absolute inset-0 pointer-events-none" :style="{ width: imageWidth + 'px', height: imageHeight + 'px' }">
            <g v-for="r in sortedResults" :key="r.id"
               @click.stop="onLineClick(r.id)"
               class="cursor-pointer pointer-events-auto">
              <rect :x="r.bbox[0]" :y="r.bbox[1]" :width="r.bbox[2]" :height="r.bbox[3]"
                :fill="store.highlightedLineId === r.id ? 'rgba(251,191,36,0.4)' : 'rgba(251,191,36,0.1)'"
                :stroke="store.highlightedLineId === r.id ? '#fbbf24' : 'rgba(251,191,36,0.5)'"
                :stroke-width="store.highlightedLineId === r.id ? 3 : 1.5"
                class="transition-all duration-200" />
            </g>
          </svg>
        </div>
      </div>
    </div>

    <div class="w-1/2 h-full flex flex-col bg-gray-900">
      <div class="px-4 py-2 bg-gray-900 border-b border-gray-800 flex items-center justify-between">
        <span class="text-amber-400 font-medium text-sm">整理文本</span>
        <button @click="scrollToTop" class="text-xs text-gray-400 hover:text-white">回到顶部</button>
      </div>
      <div ref="textScrollRef" class="flex-1 overflow-auto p-4" @scroll="onTextScroll">
        <div class="space-y-1">
          <div v-for="(r, index) in sortedResults" :key="r.id"
               :ref="el => setLineRef(r.id, el)"
               @click="onTextLineClick(r.id)"
               class="px-3 py-2 rounded cursor-pointer transition-all duration-200 border-l-2"
               :class="store.highlightedLineId === r.id 
                 ? 'bg-amber-900/30 border-amber-500 text-amber-200' 
                 : 'border-transparent hover:bg-gray-800 text-gray-200'">
            <div class="flex items-start justify-between gap-2">
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <span class="text-xs text-gray-500 w-6">{{ index + 1 }}</span>
                  <span class="font-medium">{{ r.corrected || r.text }}</span>
                </div>
                <div v-if="r.corrected && r.corrected !== r.text" class="text-xs text-gray-500 mt-1 ml-8">
                  原识别: {{ r.text }}
                </div>
              </div>
              <span class="text-xs px-2 py-0.5 rounded shrink-0"
                :class="r.confidence > 0.9 ? 'bg-green-900/50 text-green-400' : 'bg-yellow-900/50 text-yellow-400'">
                {{ (r.confidence * 100).toFixed(0) }}%
              </span>
            </div>
            <div class="text-xs text-gray-500 mt-1 ml-8">
              简体: {{ store.convertVariant(r.corrected || r.text) }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useOcrStore } from '../store/ocr'

const store = useOcrStore()
const imageScrollRef = ref<HTMLElement | null>(null)
const textScrollRef = ref<HTMLElement | null>(null)
const imageContainerRef = ref<HTMLElement | null>(null)
const mockCanvas = ref<HTMLCanvasElement | null>(null)
const imgRef = ref<HTMLImageElement | null>(null)
const scale = ref(1)
const imageWidth = ref(800)
const imageHeight = ref(600)
const isSyncing = ref(false)
const lineRefs = ref<Record<string, HTMLElement>>({})

const sortedResults = computed(() => {
  if (!store.currentDoc) return []
  return [...store.currentDoc.results].sort((a, b) => {
    if (Math.abs(a.bbox[0] - b.bbox[0]) > 50) {
      return b.bbox[0] - a.bbox[0]
    }
    return a.bbox[1] - b.bbox[1]
  })
})

function setLineRef(id: string, el: any) {
  if (el) {
    lineRefs.value[id] = el
  }
}

function zoomIn() {
  scale.value = Math.min(scale.value * 1.2, 3)
}

function zoomOut() {
  scale.value = Math.max(scale.value / 1.2, 0.5)
}

function onImageLoad() {
  if (imgRef.value) {
    imageWidth.value = imgRef.value.naturalWidth
    imageHeight.value = imgRef.value.naturalHeight
  }
}

function scrollToTop() {
  if (textScrollRef.value) {
    textScrollRef.value.scrollTop = 0
  }
  if (imageScrollRef.value) {
    imageScrollRef.value.scrollTop = 0
  }
}

function onTextLineClick(lineId: string) {
  store.setHighlightedLine(lineId)
  scrollImageToLine(lineId)
}

function onLineClick(lineId: string) {
  store.setHighlightedLine(lineId)
  scrollTextToLine(lineId)
}

function scrollImageToLine(lineId: string) {
  if (!imageScrollRef.value || !store.currentDoc) return
  const result = store.currentDoc.results.find(r => r.id === lineId)
  if (!result) return

  const lineY = result.bbox[1] * scale.value
  const lineHeight = result.bbox[3] * scale.value
  const viewportHeight = imageScrollRef.value.clientHeight

  isSyncing.value = true
  imageScrollRef.value.scrollTo({
    top: lineY - viewportHeight / 2 + lineHeight / 2,
    behavior: 'smooth'
  })
  setTimeout(() => { isSyncing.value = false }, 300)
}

function scrollTextToLine(lineId: string) {
  const lineEl = lineRefs.value[lineId]
  if (!lineEl || !textScrollRef.value) return

  const viewportHeight = textScrollRef.value.clientHeight
  const lineTop = lineEl.offsetTop
  const lineHeight = lineEl.offsetHeight

  isSyncing.value = true
  textScrollRef.value.scrollTo({
    top: lineTop - viewportHeight / 2 + lineHeight / 2,
    behavior: 'smooth'
  })
  setTimeout(() => { isSyncing.value = false }, 300)
}

function onTextScroll() {
  if (isSyncing.value || !textScrollRef.value || sortedResults.value.length === 0) return

  const viewportTop = textScrollRef.value.scrollTop
  const viewportHeight = textScrollRef.value.clientHeight
  const viewportCenter = viewportTop + viewportHeight / 2

  let closestLine: string | null = null
  let closestDist = Infinity

  for (const r of sortedResults.value) {
    const el = lineRefs.value[r.id]
    if (!el) continue
    const lineCenter = el.offsetTop + el.offsetHeight / 2
    const dist = Math.abs(lineCenter - viewportCenter)
    if (dist < closestDist) {
      closestDist = dist
      closestLine = r.id
    }
  }

  if (closestLine && closestLine !== store.highlightedLineId) {
    store.setHighlightedLine(closestLine)
    syncImageScroll(closestLine)
  }
}

function syncImageScroll(lineId: string) {
  if (!imageScrollRef.value || !store.currentDoc) return
  const result = store.currentDoc.results.find(r => r.id === lineId)
  if (!result) return

  isSyncing.value = true
  const lineY = result.bbox[1] * scale.value
  const lineHeight = result.bbox[3] * scale.value
  const viewportHeight = imageScrollRef.value.clientHeight

  imageScrollRef.value.scrollTop = lineY - viewportHeight / 2 + lineHeight / 2
  setTimeout(() => { isSyncing.value = false }, 50)
}

function onImageScroll() {
  if (isSyncing.value || !imageScrollRef.value || sortedResults.value.length === 0) return

  const viewportTop = imageScrollRef.value.scrollTop / scale.value
  const viewportHeight = imageScrollRef.value.clientHeight / scale.value
  const viewportCenter = viewportTop + viewportHeight / 2

  let closestLine: string | null = null
  let closestDist = Infinity

  for (const r of sortedResults.value) {
    const lineCenter = r.bbox[1] + r.bbox[3] / 2
    const dist = Math.abs(lineCenter - viewportCenter)
    if (dist < closestDist) {
      closestDist = dist
      closestLine = r.id
    }
  }

  if (closestLine && closestLine !== store.highlightedLineId) {
    store.setHighlightedLine(closestLine)
    syncTextScroll(closestLine)
  }
}

function syncTextScroll(lineId: string) {
  const lineEl = lineRefs.value[lineId]
  if (!lineEl || !textScrollRef.value) return

  isSyncing.value = true
  const viewportHeight = textScrollRef.value.clientHeight
  const lineTop = lineEl.offsetTop
  const lineHeight = lineEl.offsetHeight

  textScrollRef.value.scrollTop = lineTop - viewportHeight / 2 + lineHeight / 2
  setTimeout(() => { isSyncing.value = false }, 50)
}

onMounted(() => {
  if (mockCanvas.value) {
    const ctx = mockCanvas.value.getContext('2d')!
    const w = 600
    const h = 800
    mockCanvas.value.width = w
    mockCanvas.value.height = h
    imageWidth.value = w
    imageHeight.value = h

    ctx.fillStyle = '#f5e6c8'
    ctx.fillRect(0, 0, w, h)

    for (let i = 0; i < 3000; i++) {
      ctx.fillStyle = `rgba(139,90,43,${Math.random() * 0.1})`
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2)
    }

    ctx.fillStyle = '#2d1810'
    ctx.font = 'bold 36px serif'
    const columns = [
      ['子', '曰', '學', '而', '時', '習', '之', '不', '亦', '説', '乎'],
      ['有', '朋', '自', '遠', '方', '來', '不', '亦', '樂', '乎'],
      ['人', '不', '知', '而', '不', '慍', '不', '亦', '君', '子', '乎'],
      ['曾', '子', '曰', '吾', '日', '三', '省', '吾', '身'],
      ['為', '人', '謀', '而', '不', '忠', '乎'],
      ['與', '朋', '友', '交', '而', '不', '信', '乎'],
      ['傳', '不', '習', '乎'],
    ]
    columns.forEach((col, ci) => {
      const x = w - 60 - ci * 70
      col.forEach((ch, ri) => {
        ctx.fillText(ch, x, 60 + ri * 50)
      })
    })
  }

  nextTick(() => {
    if (sortedResults.value.length > 0) {
      store.setHighlightedLine(sortedResults.value[0].id)
    }
  })
})

watch(() => store.currentDoc?.id, () => {
  nextTick(() => {
    if (sortedResults.value.length > 0) {
      store.setHighlightedLine(sortedResults.value[0].id)
    }
    scale.value = 1
  })
})
</script>
