<template>
  <div class="receipt-print-wrapper">
    <!-- Clipboard Version (Hidden from Print, unpaginated long format) -->
    <div id="clipboard-receipt-zone" class="clipboard-zone" style="position: absolute; left: -9999px; top: -9999px;">
      <div ref="clipboardContent" style="width: 400px; background: white; padding: 20px;">
        <ReceiptContent :data="receiptData" :items="items" :page="1" :total="1" />
      </div>
    </div>

    <!-- Print Version (Hidden from screen, visible only when printing) -->
    <div id="print-receipt-zone" class="print-zone">
      <div v-for="(pageItems, index) in paginatedPages" :key="index" class="print-page-wrapper">
        <div class="receipt-half">
          <ReceiptContent :data="receiptData" :items="pageItems" :page="index + 1" :total="paginatedPages.length" />
        </div>
        <div class="receipt-half">
          <ReceiptContent :data="receiptData" :items="pageItems" :page="index + 1" :total="paginatedPages.length" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import ReceiptContent from './ReceiptContent.vue'
import html2canvas from 'html2canvas'

const props = defineProps({
  receiptData: {
    type: Object,
    required: true
  },
  items: {
    type: Array,
    required: true
  }
})

const clipboardContent = ref(null)
const itemsPerPage = 20 // Adjust based on paper size limit

const paginatedPages = computed(() => {
  const pages = []
  for (let i = 0; i < props.items.length; i += itemsPerPage) {
    pages.push(props.items.slice(i, i + itemsPerPage))
  }
  if (pages.length === 0) pages.push([])
  return pages
})

// Function to copy to clipboard
const copyToClipboard = async () => {
  if (!clipboardContent.value) return false
  
  try {
    const canvas = await html2canvas(clipboardContent.value, {
      scale: 2, // Better resolution
      useCORS: true,
      backgroundColor: '#ffffff'
    })
    
    return new Promise((resolve, reject) => {
      canvas.toBlob(async (blob) => {
        try {
          const item = new ClipboardItem({ 'image/png': blob })
          await navigator.clipboard.write([item])
          resolve(true)
        } catch (e) {
          reject(e)
        }
      }, 'image/png')
    })
  } catch (error) {
    console.error("Clipboard copy failed:", error)
    return false
  }
}

defineExpose({
  copyToClipboard
})
</script>

<style>
.print-zone {
  display: none; /* Hidden on screen */
}

@media print {
  body * {
    visibility: hidden;
  }
  .print-zone, .print-zone * {
    visibility: visible;
  }
  .print-zone {
    display: block !important;
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    margin: 0;
    padding: 0;
  }
  .print-page-wrapper {
    display: flex;
    width: 100%;
    page-break-after: always;
  }
  .receipt-half {
    width: 50%;
    box-sizing: border-box;
    padding: 10px;
  }
}
</style>
