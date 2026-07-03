<template>
  <div class="stock-recon-wrapper">
    <StockAdjustmentListView 
      v-if="currentView === 'list'"
      @new-adjustment="openNewAdjustment"
      @edit-adjustment="openEditAdjustment"
    />
    
    <StockAdjustmentDetailView 
      v-else-if="currentView === 'detail'"
      :adjustment-id="selectedAdjustmentId"
      @go-back="currentView = 'list'"
      @saved="currentView = 'list'"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import StockAdjustmentListView from './StockAdjustmentListView.vue'
import StockAdjustmentDetailView from './StockAdjustmentDetailView.vue'

const currentView = ref('list')
const selectedAdjustmentId = ref(null)

const openNewAdjustment = () => {
  selectedAdjustmentId.value = null
  currentView.value = 'detail'
}

const openEditAdjustment = (adjId) => {
  selectedAdjustmentId.value = adjId
  currentView.value = 'detail'
}
</script>

<style scoped>
.stock-recon-wrapper {
  flex: 1;
  width: 100%;
  height: 100vh;
  max-height: 100vh;
  min-height: 0;
  box-sizing: border-box;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
