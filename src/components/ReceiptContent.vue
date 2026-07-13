<template>
  <div class="receipt-content">
    <h2 class="receipt-title">{{ data.title }}</h2>
    <div class="receipt-header">
      <p>No: {{ data.no }}</p>
      <p>fecha: {{ data.date }}</p>
      <p class="bold-blue">UBICACION: {{ data.ubicacion }}</p>
      <template v-if="data.mode === 'transfer' || data.mode === 'outbound'">
        <p>SOLICITANTE: <span class="bold" :style="data.mode === 'outbound' ? 'color: green;' : ''">{{ data.solicitante }}</span></p>
        <p>CREADOR: <span class="bold">{{ data.creador }}</span></p>
      </template>
      <template v-else>
        <p>VENDEDOR: <span class="bold">{{ data.vendedor }}</span></p>
      </template>
    </div>

    <!-- Summary Box (Only on first page) -->
    <table v-if="page === 1" class="summary-table">
      <thead>
        <tr>
          <th>cant item</th>
          <th>cant bulto</th>
          <th>cant pzs</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>{{ data.summary.items }}</td>
          <td>{{ data.summary.bulto }}</td>
          <td>{{ data.summary.pzs }}</td>
        </tr>
      </tbody>
    </table>

    <table class="main-table">
      <thead>
        <tr>
          <th>PRODUCTO</th>
          <th>COLOR</th>
          <th>BULTO</th>
          <th>PZS</th>
          <th>PZS/B</th>
          <th>TOTAL</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(item, idx) in items" :key="idx">
          <td>{{ item.name }}</td>
          <td>{{ item.custom_color || '' }}</td>
          <td>{{ item.input_box || 0 }}</td>
          <td>{{ item.input_each || 0 }}</td>
          <td>{{ item.custom_pack_qty || 0 }}</td>
          <td>{{ (Number(item.input_box) * (Number(item.custom_pack_qty) || 1)) + Number(item.input_each) }}</td>
        </tr>
      </tbody>
    </table>

    <!-- Shipping Address (Only on last page) -->
    <div v-if="page === total && data.shippingInfo" class="shipping-address-zone" style="margin-top: 15px; border-top: 1px dashed #333; padding-top: 10px; font-size: 13px;">
      <p class="bold-blue" style="margin-bottom: 5px;">DIRECCIÓN DE ENTREGA</p>
      <p v-if="data.shippingInfo.address" style="margin: 0; line-height: 1.3;">
        {{ data.shippingInfo.address.city }}<br/>
        {{ data.shippingInfo.address.address_line1 }}
      </p>
      <p v-if="data.shippingInfo.phone" style="margin: 5px 0 0 0; line-height: 1.3;">
        Tel: {{ data.shippingInfo.phone }}
      </p>
    </div>

    <div class="receipt-footer">
      <span class="footer-note">ANIMO!!!</span>
      <span class="page-number" v-if="total > 1">{{ page }}-{{ total }}</span>
      <span class="page-number" v-else>1-1</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  data: {
    type: Object,
    required: true
  },
  items: {
    type: Array,
    required: true
  },
  page: {
    type: Number,
    required: true
  },
  total: {
    type: Number,
    required: true
  }
})
</script>

<style scoped>
.receipt-content {
  width: 100%;
  font-family: Arial, sans-serif;
  font-size: 12px;
  color: #000;
  box-sizing: border-box;
  padding: 10px;
  background: white;
}
.receipt-title {
  text-align: center;
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 15px;
  text-transform: uppercase;
}
.receipt-header p {
  margin: 3px 0;
  font-size: 12px;
}
.bold-blue {
  font-weight: bold;
  color: blue;
  text-transform: uppercase;
}
.bold {
  font-weight: bold;
  text-transform: uppercase;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 10px;
}
th, td {
  border: 1px solid #000;
  text-align: center;
  padding: 4px;
}
th {
  font-weight: bold;
  background-color: #fff;
  font-size: 11px;
}
.summary-table {
  width: 60%;
  margin: 10px auto 15px;
}
.receipt-footer {
  display: flex;
  justify-content: space-between;
  margin-top: 20px;
  font-weight: bold;
}
</style>
