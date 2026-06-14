import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { Document, OCRResult, Annotation } from '../types'

export const useOcrStore = defineStore('ocr', () => {
  const documents = ref<Document[]>([])
  const currentDoc = ref<Document | null>(null)
  const isLoading = ref(false)
  const searchQuery = ref('')
  const searchResults = ref<OCRResult[]>([])
  const viewMode = ref<'annotate' | 'compare'>('annotate')
  const highlightedLineId = ref<string | null>(null)

  // Mock data
  const MOCK_DOC: Document = {
    id: '1',
    name: '论语·学而篇',
    imageUrl: '',
    results: [
      { id: 'r1', text: '子曰', bbox: [490, 40, 45, 36], confidence: 0.95 },
      { id: 'r2', text: '學而', bbox: [490, 90, 45, 36], confidence: 0.88 },
      { id: 'r3', text: '時習之', bbox: [490, 140, 45, 36], confidence: 0.91 },
      { id: 'r4', text: '不亦', bbox: [490, 190, 45, 36], confidence: 0.87 },
      { id: 'r5', text: '説乎', bbox: [490, 240, 45, 36], confidence: 0.90 },
      { id: 'r6', text: '有朋', bbox: [420, 40, 45, 36], confidence: 0.93 },
      { id: 'r7', text: '自遠', bbox: [420, 90, 45, 36], confidence: 0.85 },
      { id: 'r8', text: '方來', bbox: [420, 140, 45, 36], confidence: 0.92 },
      { id: 'r9', text: '不亦', bbox: [420, 190, 45, 36], confidence: 0.89 },
      { id: 'r10', text: '樂乎', bbox: [420, 240, 45, 36], confidence: 0.94 },
      { id: 'r11', text: '人不', bbox: [350, 40, 45, 36], confidence: 0.86 },
      { id: 'r12', text: '知而', bbox: [350, 90, 45, 36], confidence: 0.91 },
      { id: 'r13', text: '不慍', bbox: [350, 140, 45, 36], confidence: 0.88 },
      { id: 'r14', text: '不亦', bbox: [350, 190, 45, 36], confidence: 0.90 },
      { id: 'r15', text: '君子', bbox: [350, 240, 45, 36], confidence: 0.87 },
      { id: 'r16', text: '乎', bbox: [350, 290, 45, 36], confidence: 0.92 },
      { id: 'r17', text: '曾子', bbox: [280, 40, 45, 36], confidence: 0.93 },
      { id: 'r18', text: '曰吾', bbox: [280, 90, 45, 36], confidence: 0.85 },
      { id: 'r19', text: '日三', bbox: [280, 140, 45, 36], confidence: 0.91 },
      { id: 'r20', text: '省吾', bbox: [280, 190, 45, 36], confidence: 0.89 },
      { id: 'r21', text: '身', bbox: [280, 240, 45, 36], confidence: 0.94 },
      { id: 'r22', text: '為人', bbox: [210, 40, 45, 36], confidence: 0.86 },
      { id: 'r23', text: '謀而', bbox: [210, 90, 45, 36], confidence: 0.91 },
      { id: 'r24', text: '不忠', bbox: [210, 140, 45, 36], confidence: 0.88 },
      { id: 'r25', text: '乎', bbox: [210, 190, 45, 36], confidence: 0.90 },
      { id: 'r26', text: '與朋', bbox: [140, 40, 45, 36], confidence: 0.87 },
      { id: 'r27', text: '友交', bbox: [140, 90, 45, 36], confidence: 0.92 },
      { id: 'r28', text: '而不', bbox: [140, 140, 45, 36], confidence: 0.85 },
      { id: 'r29', text: '信乎', bbox: [140, 190, 45, 36], confidence: 0.93 },
      { id: 'r30', text: '傳不', bbox: [70, 40, 45, 36], confidence: 0.89 },
      { id: 'r31', text: '習乎', bbox: [70, 90, 45, 36], confidence: 0.91 },
    ],
    annotations: [],
    createdAt: '2025-01-15'
  }

  const VARIANT_DICT: Record<string, string> = {
    '説': '说', '學': '学', '習': '习', '遠': '远', '樂': '乐', '書': '书',
    '國': '国', '東': '东', '長': '长', '門': '门', '馬': '马', '鳥': '鸟',
    '風': '风', '雲': '云', '龍': '龙', '車': '车', '萬': '万', '見': '见',
  }

  function loadMockDocument() {
    documents.value = [MOCK_DOC]
    currentDoc.value = MOCK_DOC
    highlightedLineId.value = MOCK_DOC.results[0]?.id || null
  }

  async function uploadAndOCR(file: File) {
    isLoading.value = true
    try {
      const formData = new FormData()
      formData.append('file', file)
      const resp = await fetch('/api/ocr', { method: 'POST', body: formData })
      if (resp.ok) {
        const data = await resp.json()
        const doc: Document = {
          id: Date.now().toString(),
          name: file.name,
          imageUrl: URL.createObjectURL(file),
          results: data.results || [],
          annotations: [],
          createdAt: new Date().toISOString()
        }
        documents.value.push(doc)
        currentDoc.value = doc
        highlightedLineId.value = doc.results[0]?.id || null
        viewMode.value = 'compare'
      }
    } catch {
      loadMockDocument()
      viewMode.value = 'compare'
    } finally {
      isLoading.value = false
    }
  }

  function addAnnotation(type: Annotation['type'], bbox: [number, number, number, number], label: string, content: string) {
    if (!currentDoc.value) return
    currentDoc.value.annotations.push({
      id: Date.now().toString(),
      type, bbox, label, content
    })
  }

  function removeAnnotation(id: string) {
    if (!currentDoc.value) return
    currentDoc.value.annotations = currentDoc.value.annotations.filter(a => a.id !== id)
  }

  function convertVariant(text: string): string {
    return text.split('').map(c => VARIANT_DICT[c] || c).join('')
  }

  function searchInDocuments(query: string) {
    const q = query.toLowerCase()
    searchResults.value = documents.value.flatMap(d =>
      d.results.filter(r => r.text.includes(q) || (r.corrected || '').includes(q))
    )
  }

  function exportTEI(): string {
    if (!currentDoc.value) return ''
    let tei = '<?xml version="1.0" encoding="UTF-8"?>\n'
    tei += '<TEI xmlns="http://www.tei-c.org/ns/1.0">\n'
    tei += `  <teiHeader><fileDesc><titleStmt><title>${currentDoc.value.name}</title></titleStmt></fileDesc></teiHeader>\n`
    tei += '  <text><body>\n'
    for (const r of currentDoc.value.results) {
      tei += `    <seg type="line" xml:id="${r.id}" cert="${r.confidence}">${r.corrected || r.text}</seg>\n`
    }
    tei += '  </body></text>\n</TEI>'
    return tei
  }

  function setHighlightedLine(id: string | null) {
    highlightedLineId.value = id
  }

  function toggleViewMode() {
    viewMode.value = viewMode.value === 'annotate' ? 'compare' : 'annotate'
  }

  return {
    documents, currentDoc, isLoading, searchQuery, searchResults, viewMode, highlightedLineId,
    loadMockDocument, uploadAndOCR, addAnnotation, removeAnnotation,
    convertVariant, searchInDocuments, exportTEI, setHighlightedLine, toggleViewMode
  }
})
