const fs = require('fs');

let c = fs.readFileSync('src/views/PosView.vue','utf8');

// We need to add the missing functions to PosView.vue and have them trigger PcTransactionCart via ref.
// First, add ref="pcCartRef" to <PcTransactionCart>
c = c.replace('<PcTransactionCart ', '<PcTransactionCart ref="pcCartRef" ');

// Then, add the wrapper functions to the script
const scriptStart = c.indexOf('const { t, locale } = useI18n();');

const wrapperFunctions = `
const pcCartRef = ref(null);

const executeCartAction = async (nav, actionName, payload) => {
  activeNav.value = nav;
  await nextTick();
  if (pcCartRef.value && pcCartRef.value[actionName]) {
    pcCartRef.value[actionName](payload);
  }
};

const loadReservationToCart = (res) => executeCartAction(res.material_request_type === 'Material Transfer' ? 'transfer' : 'outbound', 'loadReservationToCart', res);
const loadDraftToCart = (docName) => executeCartAction('transfer', 'loadDraftToCart', docName); // or outbound depending on MR, but it's handled inside
const loadOutboundToCart = (entry) => executeCartAction('outbound', 'loadOutboundToCart', entry);
const loadTransferToCart = (entry) => executeCartAction('transfer', 'loadTransferToCart', entry);
const loadInboundToCart = (entry) => executeCartAction('inbound', 'loadInboundToCart', entry);
`;

c = c.substring(0, scriptStart + 32) + '\n' + wrapperFunctions + '\n' + c.substring(scriptStart + 32);

fs.writeFileSync('src/views/PosView.vue', c);
console.log('Added wrappers to PosView');
