const fs = require('fs');

let c = fs.readFileSync('src/views/PosView.vue','utf8');
c = c.replace(/<PcTransactionCart[\s\S]*?@refresh-items="fetchFrappeItems"\s+\/>/, '$&\n    </main>\n');
c = c.replace(/<PinUnlockModal variant="desktop" @unlock="onBranchPinUnlock" \/>\s+<\/div>\s+<\/template>/, '<PinUnlockModal variant="desktop" @unlock="onBranchPinUnlock" />\n  </div>\n  </div>\n</template>');
fs.writeFileSync('src/views/PosView.vue', c);
console.log('Fixed tags');
