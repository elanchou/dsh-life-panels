/** Small CSV reader and the column mapping for order exports (Amazon, Shopify, TikTok, Shopee and plain spreadsheets). */

export function parseCsv(text) {
  const src = String(text || '').replace(/^\uFEFF/, '');
  const first = src.split('\n', 1)[0] || '';
  const delim = (first.match(/\t/g) || []).length > (first.match(/,/g) || []).length ? '\t' : ',';
  const rows = [];
  let row = []; let cell = ''; let q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '');
/** Header aliases per field, compared after removing punctuation and case. */
const ALIASES = {
  ref: ['ref', 'orderid', 'orderno', 'ordernumber', 'amazonorderid', 'name', 'order', '订单号', '订单编号'],
  date: ['date', 'orderdate', 'purchasedate', 'createdat', 'paidat', 'createtime', 'ordercreationtime', '日期', '下单时间', '付款时间'],
  sku: ['sku', 'lineitemsku', 'sellersku', 'merchantsku', 'skuid', 'itemsku', '商家sku', '商品sku'],
  qty: ['qty', 'quantity', 'lineitemquantity', 'quantitypurchased', 'units', '数量'],
  price: ['price', 'itemprice', 'lineitemprice', 'unitprice', 'saleprice', 'productprice', 'subtotal', '单价', '售价', '商品金额'],
  currency: ['currency', 'currencycode', '币种'],
  fee: ['fee', 'fees', 'platformfee', 'commission', 'referralfee', 'transactionfee', '佣金', '平台费'],
  status: ['status', 'orderstatus', 'financialstatus', 'fulfillmentstatus', '状态', '订单状态'],
  market: ['market', 'shipcountry', 'shippingcountry', 'shippingaddresscountrycode', 'country', 'shipcountrycode', '国家', '站点'],
};

/** Map header cells to field names. `override` is { field: 'exact header text' } and wins over the aliases. */
export function mapColumns(header, override = {}) {
  const heads = header.map(norm);
  const map = {};
  for (const [field, aliases] of Object.entries(ALIASES)) {
    const forced = override[field] !== undefined ? heads.indexOf(norm(override[field])) : -1;
    if (forced >= 0) { map[field] = forced; continue; }
    for (const a of aliases) { const i = heads.indexOf(norm(a)); if (i >= 0) { map[field] = i; break; } }
  }
  return map;
}

/** First number in a cell, tolerating currency symbols and thousands separators ("$1,299.00", "1.299,00 €" is not supported). */
export function cellNumber(v) {
  const m = String(v ?? '').replace(/[,\s]/g, '').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : NaN;
}

/** Date cell to YYYY-MM-DD: ISO, "2026/11/05", "11/05/2026" is read as month first. */
export function cellDate(v) {
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return m[3] + '-' + m[1].padStart(2, '0') + '-' + m[2].padStart(2, '0');
  return '';
}

/** Order status words in exports mapped to ours; anything unknown counts as an ordinary paid order. */
export function cellStatus(v) {
  const s = String(v ?? '').toLowerCase();
  if (/cancel|void|已取消/.test(s)) return 'cancelled';
  if (/refund|return|退款|退货/.test(s)) return 'returned';
  return 'paid';
}
