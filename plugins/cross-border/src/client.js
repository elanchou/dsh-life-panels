window.__ModuleLoader__.load({
  id: '@local/cross-border',
  factory(require) {
    /* @kit */

    const PANEL_ID = 'cross-border';
    const NS = 'cross-border';
    const call = makeCall('/plugin-api/cross-border');

    const zh = {
      dateLocale: 'zh-CN', panel: '跨境', title: '跨境电商',
      tabProducts: '商品', tabCalc: '利润计算', tabShip: '物流',
      products: '商品', listings: '在售', lowStock: '低库存', losing: '亏损在售', openShip: '在途', rates: '汇率 {date}（对 1 元人民币）', ratesStale: '汇率可能已过期',
      search: '搜索 SKU、标题、标签', newProduct: '新建商品', emptyList: '还没有商品', emptyFilter: '没有匹配的商品', pick: '选一个商品，或新建一个',
      sku: 'SKU', titleF: '标题', cost: '采购成本 ¥', freight: '头程运费 ¥', duty: '关税 %', stock: '库存', reorder: '补货线', tags: '标签（逗号分隔）', notes: '备注',
      landed: '落地成本', save: '保存', saved: '已保存', saving: '保存中…', del: '删除', cancel: '取消', confirmDelP: '删除这个商品和它的在售信息？',
      addListing: '添加在售', editListing: '编辑', platform: '平台', market: '站点', price: '售价（含税）', currency: '币种', vat: 'VAT %', fee: '平台佣金 %', fulfil: '固定费用', ads: '广告 %', returns: '退货 %', rate: '汇率（可选）', url: '链接',
      profit: '利润', margin: '毛利率', roi: '回报率', breakEven: '保本价', netPrice: '不含税价', noListings: '还没有在售信息，添加一个看看利润', unsavedNote: '有未保存的修改。在售信息按已保存的成本计算。', unit: '每件',
      calcTitle: '单品利润计算', calcHint: '不保存，随手算一笔。填 0 的项按 0 处理。', calcGo: '计算', targetMargin: '目标毛利 %', priceFor: '按目标毛利倒推售价', result: '结果', needPrice: '先填售价',
      shipNew: '新增物流', trackNo: '运单号', carrier: '承运商', label: '备注名', qty: '数量', status: '状态', eta: '预计到达', product: '商品', none: '—', track: '查询', late: '已超预计',
      st_preparing: '备货中', st_in_transit: '运输中', st_customs: '清关中', st_delivered: '已签收', st_exception: '异常', openOnly: '只看未签收', emptyShip: '没有物流记录', stockAdded: '已入库 {n} 件',
      loadFailed: '加载失败：{error}', retry: '重试', hint: '在对话里说“帮我算一下这款 ¥35 的东西在德国卖 €29.9 利润多少”，我会直接算',
      justNow: '刚刚', minutesAgo: '{n} 分钟前', hoursAgo: '{n} 小时前', daysAgo: '{n} 天前', back: '返回列表', other: '其他',
    };
    const en = {
      dateLocale: 'en-US', panel: 'Cross-border', title: 'Cross-border',
      tabProducts: 'Products', tabCalc: 'Calculator', tabShip: 'Shipments',
      products: 'Products', listings: 'Listings', lowStock: 'Low stock', losing: 'Losing money', openShip: 'In transit', rates: 'Rates {date} (per 1 CNY)', ratesStale: 'Rates may be out of date',
      search: 'Search SKU, title, tag', newProduct: 'New product', emptyList: 'No products yet', emptyFilter: 'No matching products', pick: 'Pick a product, or add one',
      sku: 'SKU', titleF: 'Title', cost: 'Cost ¥', freight: 'Freight ¥', duty: 'Duty %', stock: 'Stock', reorder: 'Reorder at', tags: 'Tags (comma separated)', notes: 'Notes',
      landed: 'Landed cost', save: 'Save', saved: 'Saved', saving: 'Saving…', del: 'Delete', cancel: 'Cancel', confirmDelP: 'Delete this product and its listings?',
      addListing: 'Add listing', editListing: 'Edit', platform: 'Platform', market: 'Market', price: 'Price (incl. tax)', currency: 'Currency', vat: 'VAT %', fee: 'Commission %', fulfil: 'Fixed fees', ads: 'Ads %', returns: 'Returns %', rate: 'Rate (optional)', url: 'Link',
      profit: 'Profit', margin: 'Margin', roi: 'ROI', breakEven: 'Break-even', netPrice: 'Net price', noListings: 'No listings yet. Add one to see the profit', unsavedNote: 'You have unsaved changes. Listings are calculated from the saved costs.', unit: 'per unit',
      calcTitle: 'Unit profit calculator', calcHint: 'Nothing is saved. Blank fields count as 0.', calcGo: 'Calculate', targetMargin: 'Target margin %', priceFor: 'Price for target margin', result: 'Result', needPrice: 'Enter a price first',
      shipNew: 'Add shipment', trackNo: 'Tracking no.', carrier: 'Carrier', label: 'Label', qty: 'Qty', status: 'Status', eta: 'ETA', product: 'Product', none: '—', track: 'Track', late: 'past ETA',
      st_preparing: 'Preparing', st_in_transit: 'In transit', st_customs: 'Customs', st_delivered: 'Delivered', st_exception: 'Exception', openOnly: 'Open only', emptyShip: 'No shipments', stockAdded: '{n} units added to stock',
      loadFailed: 'Failed to load: {error}', retry: 'Retry', hint: 'Ask in chat: "A ¥35 item sells for €29.9 in Germany. What is my profit?"',
      justNow: 'just now', minutesAgo: '{n}m ago', hoursAgo: '{n}h ago', daysAgo: '{n}d ago', back: 'Back to list', other: 'Other',
    };
    const PLATFORMS = ['amazon', 'shopify', 'tiktok', 'temu', 'aliexpress', 'ebay', 'shopee', 'lazada', 'other'];
    const PLATFORM_NAME = { amazon: 'Amazon', shopify: 'Shopify', tiktok: 'TikTok Shop', temu: 'Temu', aliexpress: 'AliExpress', ebay: 'eBay', shopee: 'Shopee', lazada: 'Lazada', other: '' };
    const MARKETS = { US: ['USD', 0], UK: ['GBP', 20], DE: ['EUR', 19], FR: ['EUR', 20], JP: ['JPY', 10], AU: ['AUD', 10], CA: ['CAD', 5], SG: ['SGD', 9] };
    const FEE = { amazon: 15, ebay: 13, shopify: 3, tiktok: 6, temu: 0, aliexpress: 8, shopee: 8, lazada: 6, other: 10 };
    const SHIP = ['preparing', 'in_transit', 'customs', 'delivered', 'exception'];

    Object.assign(ICONS, {
      globe: ['M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0', 'M3 12h18', 'M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z'],
      box: ['M4 8l8-4 8 4v8l-8 4-8-4z', 'M4 8l8 4 8-4', 'M12 12v8'],
      calc: ['M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', 'M8 7h8', 'M8 12h.01', 'M12 12h.01', 'M16 12h.01', 'M8 16h.01', 'M12 16h.01', 'M16 16h.01'],
      truck: ['M3 6h11v10H3z', 'M14 10h4l3 3v3h-7', 'M7 18a1.5 1.5 0 1 0 0.01 0', 'M17 18a1.5 1.5 0 1 0 0.01 0'],
    });
    const CbGlyph = PanelGlyph('globe');
    const fmt = (n, cur, locale) => {
      if (n === null || n === undefined || Number.isNaN(n)) return '—';
      try { return new Intl.NumberFormat(locale, { style: 'currency', currency: cur || 'CNY', maximumFractionDigits: cur === 'JPY' || cur === 'KRW' ? 0 : 2 }).format(n); } catch { return String(n); }
    };
    const numOrU = (s) => (s === '' || s === undefined || s === null ? undefined : Number(s));
    /* @include products.js */
    /* @include calc.js */
    /* @include shipments.js */
