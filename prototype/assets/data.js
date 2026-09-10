/* ==========================================================================
   假数据集 —— 一一对应《Axure 搭建说明书》第 6 章「中继器数据集」
   Axure 里每个 DB.xxx 就是一个中继器（Repeater）的数据集，列名保持一致
   ========================================================================== */

const DB = {};

/* ------------------------------ 字典 ------------------------------ */

DB.dict = {
  matType:   ['原材料', '半成品', '成品', '辅料', '包装物'],
  unit:      ['个', '台', '吨', '米', '桶', '箱', 'kg'],
  whList:    [
    { code: 'WH01', name: '原材料仓', addr: '一号厂区 A 栋' },
    { code: 'WH02', name: '成品仓',   addr: '一号厂区 B 栋' },
    { code: 'WH03', name: '辅料仓',   addr: '二号厂区 C 栋' },
    { code: 'WH04', name: '不良品仓', addr: '二号厂区 C 栋隔间' }
  ],
  // 单据状态机（说明书 §7.1）
  rcStatus: ['待收货', '收货中', '待上架', '已完成', '已作废'],
  doStatus: ['待审核', '待拣货', '拣货中', '待发运', '已完成', '已作废'],
  bizType:  ['采购入库', '生产入库', '退货入库', '调拨入库', '盘盈入库'],
  outType:  ['销售出库', '生产领料', '退货出库', '调拨出库', '盘亏出库', '报废出库']
};

/* ------------------------------ 物料 ------------------------------ */

DB.material = [
  { code:'M-1001', name:'冷轧钢板 SPCC', spec:'1.2×1250×C', type:'原材料', unit:'吨', cat:'金属板材', safeMin:20,  safeMax:120, onHand:86.5,  locked:12,   price:4280, status:'启用', batchCtl:'是' },
  { code:'M-1002', name:'外六角螺栓',     spec:'M8×30 SUS304', type:'原材料', unit:'个', cat:'紧固件',   safeMin:5000,safeMax:40000,onHand:3200,  locked:600,  price:0.42, status:'启用', batchCtl:'否' },
  { code:'M-1003', name:'深沟球轴承',     spec:'6204-2RS',   type:'原材料', unit:'个', cat:'传动件',   safeMin:400, safeMax:2000, onHand:1260,  locked:180,  price:12.6, status:'启用', batchCtl:'是' },
  { code:'M-1004', name:'三相异步电机',   spec:'Y2-90L-4 1.5kW', type:'原材料', unit:'台', cat:'电气件', safeMin:30,  safeMax:200,  onHand:24,    locked:8,    price:486,  status:'启用', batchCtl:'是' },
  { code:'M-1005', name:'RVV 软电缆',     spec:'3×2.5mm²',   type:'原材料', unit:'米', cat:'电气件',   safeMin:2000,safeMax:12000,onHand:7400,  locked:0,    price:8.9,  status:'启用', batchCtl:'否' },
  { code:'M-2001', name:'齿轮箱总成',     spec:'GB-200',     type:'半成品', unit:'台', cat:'装配件',   safeMin:20,  safeMax:150,  onHand:52,    locked:14,   price:1260, status:'启用', batchCtl:'是' },
  { code:'M-3001', name:'WPA 蜗轮减速机', spec:'WPA-70 i=30', type:'成品',  unit:'台', cat:'减速机',   safeMin:15,  safeMax:120,  onHand:118,   locked:36,   price:2180, status:'启用', batchCtl:'是' },
  { code:'M-3002', name:'WPA 蜗轮减速机', spec:'WPA-100 i=40',type:'成品',  unit:'台', cat:'减速机',   safeMin:10,  safeMax:80,   onHand:9,     locked:4,    price:3450, status:'启用', batchCtl:'是' },
  { code:'M-4001', name:'抗磨液压油',     spec:'L-HM46 18L', type:'辅料',  unit:'桶', cat:'油品',     safeMin:20,  safeMax:100,  onHand:41,    locked:0,    price:328,  status:'启用', batchCtl:'是' },
  { code:'M-4002', name:'五层瓦楞纸箱',   spec:'400×300×250',type:'包装物',unit:'个', cat:'包材',     safeMin:1000,safeMax:8000, onHand:5600,  locked:400,  price:3.8,  status:'启用', batchCtl:'否' },
  { code:'M-4003', name:'缠绕膜',         spec:'50cm×2.5kg', type:'包装物',unit:'箱', cat:'包材',     safeMin:30,  safeMax:200,  onHand:28,    locked:0,    price:96,   status:'启用', batchCtl:'否' },
  { code:'M-1006', name:'不锈钢圆管',     spec:'Φ25×2.0 304',type:'原材料',unit:'米', cat:'金属管材', safeMin:800, safeMax:5000, onHand:0,     locked:0,    price:34,   status:'停用', batchCtl:'否' }
];

/* ------------------------------ 库位 ------------------------------ */

DB.location = [
  { code:'A-01-01-01', wh:'WH01', zone:'A区-板材', type:'存储位', cap:'20 吨',  used:86,  mat:'M-1001', status:'占用', abc:'A' },
  { code:'A-01-01-02', wh:'WH01', zone:'A区-板材', type:'存储位', cap:'20 吨',  used:42,  mat:'M-1001', status:'占用', abc:'A' },
  { code:'A-02-03-01', wh:'WH01', zone:'A区-小件', type:'货架位', cap:'8000 个',used:40,  mat:'M-1002', status:'占用', abc:'B' },
  { code:'A-02-03-02', wh:'WH01', zone:'A区-小件', type:'货架位', cap:'2000 个',used:63,  mat:'M-1003', status:'占用', abc:'B' },
  { code:'A-03-01-01', wh:'WH01', zone:'A区-重件', type:'地堆位', cap:'50 台',  used:48,  mat:'M-1004', status:'占用', abc:'A' },
  { code:'A-05-01-01', wh:'WH01', zone:'A区-暂存', type:'收货暂存',cap:'—',     used:0,   mat:'',       status:'空闲', abc:'—' },
  { code:'B-01-01-01', wh:'WH02', zone:'B区-成品', type:'货架位', cap:'60 台',  used:92,  mat:'M-3001', status:'占用', abc:'A' },
  { code:'B-01-01-02', wh:'WH02', zone:'B区-成品', type:'货架位', cap:'60 台',  used:15,  mat:'M-3002', status:'占用', abc:'A' },
  { code:'B-02-01-01', wh:'WH02', zone:'B区-发货', type:'发货暂存',cap:'—',     used:35,  mat:'',       status:'占用', abc:'—' },
  { code:'C-01-01-01', wh:'WH03', zone:'C区-油品', type:'托盘位', cap:'60 桶',  used:68,  mat:'M-4001', status:'占用', abc:'C' },
  { code:'C-02-01-01', wh:'WH03', zone:'C区-包材', type:'地堆位', cap:'8000 个',used:70,  mat:'M-4002', status:'占用', abc:'C' },
  { code:'D-01-01-01', wh:'WH04', zone:'D区-隔离', type:'不良品位',cap:'—',     used:12,  mat:'M-1003', status:'占用', abc:'—' },
  { code:'C-02-01-02', wh:'WH03', zone:'C区-包材', type:'地堆位', cap:'200 箱', used:0,   mat:'',       status:'冻结', abc:'C' }
];

/* ------------------------------ 供应商 / 客户 ------------------------------ */

DB.partner = [
  { code:'SUP001', name:'宁波宏远金属材料有限公司', kind:'供应商', contact:'王建国', phone:'138 0574 6621', addr:'浙江宁波北仑区滨海路 88 号',  level:'A', status:'合作中' },
  { code:'SUP002', name:'苏州精工紧固件有限公司',   kind:'供应商', contact:'李慧',   phone:'139 0512 3374', addr:'江苏苏州吴中区东吴北路 12 号',level:'A', status:'合作中' },
  { code:'SUP003', name:'上海恒信电气设备有限公司', kind:'供应商', contact:'张鹏',   phone:'136 0213 9902', addr:'上海市松江区新桥镇工业区',    level:'B', status:'合作中' },
  { code:'SUP004', name:'广东南方润滑油品有限公司', kind:'供应商', contact:'陈晓东', phone:'135 0755 1183', addr:'广东东莞市寮步镇',            level:'C', status:'暂停' },
  { code:'CUS001', name:'广州华腾机械设备有限公司', kind:'客户',   contact:'刘敏',   phone:'137 0201 4456', addr:'广东广州番禺区大石街',        level:'A', status:'合作中' },
  { code:'CUS002', name:'济南重工装备股份有限公司', kind:'客户',   contact:'赵国强', phone:'138 0531 7728', addr:'山东济南章丘区经济开发区',    level:'A', status:'合作中' },
  { code:'CUS003', name:'成都锦江自动化工程公司',   kind:'客户',   contact:'周雪',   phone:'139 0288 2201', addr:'四川成都武侯区科华路',        level:'B', status:'合作中' }
];

/* ------------------------------ 入库单 ------------------------------ */

DB.receipt = [
  { no:'RC20260901001', bizType:'采购入库', po:'PO20260828007', partner:'宁波宏远金属材料有限公司', wh:'WH01', lines:3, qtyPlan:48,   qtyReal:48,   status:'已完成', creator:'王强', createAt:'2026-09-01 08:42', arriveAt:'2026-09-01 09:10' },
  { no:'RC20260901002', bizType:'采购入库', po:'PO20260829013', partner:'苏州精工紧固件有限公司',   wh:'WH01', lines:2, qtyPlan:20000,qtyReal:20000,status:'待上架', creator:'王强', createAt:'2026-09-01 10:05', arriveAt:'2026-09-01 10:30' },
  { no:'RC20260902001', bizType:'采购入库', po:'PO20260830002', partner:'上海恒信电气设备有限公司', wh:'WH01', lines:2, qtyPlan:60,   qtyReal:0,    status:'待收货', creator:'王强', createAt:'2026-09-02 08:15', arriveAt:'' },
  { no:'RC20260902002', bizType:'生产入库', po:'MO20260901005', partner:'装配一车间',               wh:'WH02', lines:1, qtyPlan:30,   qtyReal:18,   status:'收货中', creator:'李娜', createAt:'2026-09-02 09:02', arriveAt:'2026-09-02 09:20' },
  { no:'RC20260902003', bizType:'退货入库', po:'SO20260812004', partner:'广州华腾机械设备有限公司', wh:'WH04', lines:1, qtyPlan:4,    qtyReal:4,    status:'待上架', creator:'李娜', createAt:'2026-09-02 11:18', arriveAt:'2026-09-02 11:40' },
  { no:'RC20260902004', bizType:'采购入库', po:'PO20260831009', partner:'广东南方润滑油品有限公司', wh:'WH03', lines:1, qtyPlan:30,   qtyReal:0,    status:'已作废', creator:'王强', createAt:'2026-09-02 13:26', arriveAt:'' },
  { no:'RC20260831001', bizType:'采购入库', po:'PO20260826011', partner:'宁波宏远金属材料有限公司', wh:'WH01', lines:2, qtyPlan:36,   qtyReal:35.2, status:'已完成', creator:'王强', createAt:'2026-08-31 08:30', arriveAt:'2026-08-31 09:05' },
  { no:'RC20260830001', bizType:'调拨入库', po:'TR20260829001', partner:'二号厂区中转仓',           wh:'WH03', lines:2, qtyPlan:120,  qtyReal:120,  status:'已完成', creator:'李娜', createAt:'2026-08-30 14:10', arriveAt:'2026-08-30 14:35' }
];

// 入库单行（明细）——按单号索引
DB.receiptLine = {
  'RC20260901002': [
    { i:1, code:'M-1002', name:'外六角螺栓',   spec:'M8×30 SUS304', unit:'个', qtyPlan:18000, qtyReal:18000, qtyBad:0,  batch:'B2609011', prodDate:'2026-08-20', loc:'A-02-03-01', qc:'合格' },
    { i:2, code:'M-1003', name:'深沟球轴承',   spec:'6204-2RS',     unit:'个', qtyPlan:2000,  qtyReal:1988,  qtyBad:12, batch:'B2609012', prodDate:'2026-08-18', loc:'A-02-03-02', qc:'部分让步' }
  ],
  'RC20260902001': [
    { i:1, code:'M-1004', name:'三相异步电机', spec:'Y2-90L-4 1.5kW', unit:'台', qtyPlan:40, qtyReal:0, qtyBad:0, batch:'', prodDate:'', loc:'', qc:'待检' },
    { i:2, code:'M-1005', name:'RVV 软电缆',   spec:'3×2.5mm²',       unit:'米', qtyPlan:20, qtyReal:0, qtyBad:0, batch:'', prodDate:'', loc:'', qc:'待检' }
  ],
  'RC20260902002': [
    { i:1, code:'M-2001', name:'齿轮箱总成', spec:'GB-200', unit:'台', qtyPlan:30, qtyReal:18, qtyBad:0, batch:'B2609021', prodDate:'2026-09-02', loc:'B-01-01-01', qc:'合格' }
  ]
};

/* ------------------------------ 出库单 ------------------------------ */

DB.outbound = [
  { no:'DO20260902001', outType:'销售出库', src:'SO20260901012', partner:'广州华腾机械设备有限公司', wh:'WH02', lines:2, qtyPlan:24, qtyPick:24, status:'待发运', priority:'高', creator:'刘敏', createAt:'2026-09-02 08:20', needDate:'2026-09-03' },
  { no:'DO20260902002', outType:'生产领料', src:'MO20260902003', partner:'装配一车间',               wh:'WH01', lines:4, qtyPlan:4212,qtyPick:3100,status:'拣货中', priority:'高', creator:'李娜', createAt:'2026-09-02 08:55', needDate:'2026-09-02' },
  { no:'DO20260902003', outType:'销售出库', src:'SO20260901018', partner:'济南重工装备股份有限公司', wh:'WH02', lines:1, qtyPlan:12, qtyPick:0,  status:'待拣货', priority:'中', creator:'刘敏', createAt:'2026-09-02 09:40', needDate:'2026-09-04' },
  { no:'DO20260902004', outType:'销售出库', src:'SO20260902001', partner:'成都锦江自动化工程公司',   wh:'WH02', lines:2, qtyPlan:8,  qtyPick:0,  status:'待审核', priority:'中', creator:'刘敏', createAt:'2026-09-02 10:12', needDate:'2026-09-06' },
  { no:'DO20260902005', outType:'生产领料', src:'MO20260902007', partner:'装配二车间',               wh:'WH01', lines:3, qtyPlan:860, qtyPick:0,  status:'待审核', priority:'低', creator:'李娜', createAt:'2026-09-02 11:03', needDate:'2026-09-05' },
  { no:'DO20260902006', outType:'报废出库', src:'—',             partner:'品质部',                   wh:'WH04', lines:1, qtyPlan:12, qtyPick:12, status:'已完成', priority:'低', creator:'张鹏', createAt:'2026-09-02 13:50', needDate:'2026-09-02' },
  { no:'DO20260901004', outType:'销售出库', src:'SO20260830006', partner:'广州华腾机械设备有限公司', wh:'WH02', lines:3, qtyPlan:36, qtyPick:36, status:'已完成', priority:'中', creator:'刘敏', createAt:'2026-09-01 08:10', needDate:'2026-09-02' },
  { no:'DO20260901005', outType:'调拨出库', src:'TR20260901002', partner:'二号厂区中转仓',           wh:'WH03', lines:1, qtyPlan:600, qtyPick:0,  status:'已作废', priority:'低', creator:'张鹏', createAt:'2026-09-01 15:22', needDate:'2026-09-03' }
];

DB.outboundLine = {
  'DO20260902002': [
    { i:1, code:'M-1002', name:'外六角螺栓', spec:'M8×30 SUS304', unit:'个', qtyPlan:3000, qtyPick:2600, batch:'B2609011', loc:'A-02-03-01', avail:3200, status:'部分拣货' },
    { i:2, code:'M-1003', name:'深沟球轴承', spec:'6204-2RS',     unit:'个', qtyPlan:800,  qtyPick:500,  batch:'B2608022', loc:'A-02-03-02', avail:1080,  status:'部分拣货' },
    { i:3, code:'M-1004', name:'三相异步电机',spec:'Y2-90L-4 1.5kW',unit:'台',qtyPlan:12,   qtyPick:0,    batch:'B2608015', loc:'A-03-01-01', avail:16,    status:'待拣货' },
    { i:4, code:'M-1005', name:'RVV 软电缆', spec:'3×2.5mm²',     unit:'米', qtyPlan:400,  qtyPick:0,    batch:'—',        loc:'A-02-03-01', avail:7400,  status:'待拣货' }
  ],
  'DO20260902001': [
    { i:1, code:'M-3001', name:'WPA 蜗轮减速机', spec:'WPA-70 i=30',  unit:'台', qtyPlan:20, qtyPick:20, batch:'B2608301', loc:'B-01-01-01', avail:82, status:'已拣货' },
    { i:2, code:'M-3002', name:'WPA 蜗轮减速机', spec:'WPA-100 i=40', unit:'台', qtyPlan:4,  qtyPick:4,  batch:'B2608302', loc:'B-01-01-02', avail:5,  status:'已拣货' }
  ]
};

/* ------------------------------ 库存（按 物料+批次+库位） ------------------------------ */

DB.stock = [
  { code:'M-1001', name:'冷轧钢板 SPCC', spec:'1.2×1250×C', unit:'吨', wh:'WH01', loc:'A-01-01-01', batch:'B2608101', inDate:'2026-08-10', onHand:56.5, locked:8,  avail:48.5, age:23,  amount:241820 },
  { code:'M-1001', name:'冷轧钢板 SPCC', spec:'1.2×1250×C', unit:'吨', wh:'WH01', loc:'A-01-01-02', batch:'B2609011', inDate:'2026-09-01', onHand:30,   locked:4,  avail:26,   age:1,   amount:128400 },
  { code:'M-1002', name:'外六角螺栓',     spec:'M8×30 SUS304', unit:'个', wh:'WH01', loc:'A-02-03-01', batch:'B2609011', inDate:'2026-09-01', onHand:3200, locked:600,avail:2600, age:1,   amount:1344 },
  { code:'M-1003', name:'深沟球轴承',     spec:'6204-2RS', unit:'个', wh:'WH01', loc:'A-02-03-02', batch:'B2608022', inDate:'2026-08-02', onHand:1260, locked:180,avail:1080, age:31,  amount:15876 },
  { code:'M-1004', name:'三相异步电机',   spec:'Y2-90L-4 1.5kW', unit:'台', wh:'WH01', loc:'A-03-01-01', batch:'B2608015', inDate:'2026-08-15', onHand:24, locked:8, avail:16, age:18, amount:11664 },
  { code:'M-1005', name:'RVV 软电缆',     spec:'3×2.5mm²', unit:'米', wh:'WH01', loc:'A-02-03-01', batch:'—', inDate:'2026-07-06', onHand:7400, locked:0, avail:7400, age:58, amount:65860 },
  { code:'M-2001', name:'齿轮箱总成',     spec:'GB-200', unit:'台', wh:'WH02', loc:'B-01-01-01', batch:'B2609021', inDate:'2026-09-02', onHand:52, locked:14, avail:38, age:0, amount:65520 },
  { code:'M-3001', name:'WPA 蜗轮减速机', spec:'WPA-70 i=30', unit:'台', wh:'WH02', loc:'B-01-01-01', batch:'B2608301', inDate:'2026-08-30', onHand:118, locked:36, avail:82, age:3, amount:257240 },
  { code:'M-3002', name:'WPA 蜗轮减速机', spec:'WPA-100 i=40', unit:'台', wh:'WH02', loc:'B-01-01-02', batch:'B2608302', inDate:'2026-08-30', onHand:9, locked:4, avail:5, age:3, amount:31050 },
  { code:'M-4001', name:'抗磨液压油',     spec:'L-HM46 18L', unit:'桶', wh:'WH03', loc:'C-01-01-01', batch:'B2605204', inDate:'2026-05-20', onHand:41, locked:0, avail:41, age:105, amount:13448 },
  { code:'M-4002', name:'五层瓦楞纸箱',   spec:'400×300×250', unit:'个', wh:'WH03', loc:'C-02-01-01', batch:'—', inDate:'2026-08-12', onHand:5600, locked:400, avail:5200, age:21, amount:21280 },
  { code:'M-4003', name:'缠绕膜',         spec:'50cm×2.5kg', unit:'箱', wh:'WH03', loc:'C-02-01-01', batch:'—', inDate:'2026-04-18', onHand:28, locked:0, avail:28, age:137, amount:2688 },
  { code:'M-1003', name:'深沟球轴承',     spec:'6204-2RS', unit:'个', wh:'WH04', loc:'D-01-01-01', batch:'B2608022', inDate:'2026-09-01', onHand:12, locked:0, avail:0, age:1, amount:151 }
];

/* ------------------------------ 库存流水（台账） ------------------------------ */

DB.ledger = [
  { time:'2026-09-02 13:52', no:'DO20260902006', biz:'报废出库', dir:'出', code:'M-1003', name:'深沟球轴承', batch:'B2608022', wh:'WH04', loc:'D-01-01-01', qty:-12,  before:12,   after:0,    op:'张鹏' },
  { time:'2026-09-02 11:42', no:'RC20260902003', biz:'退货入库', dir:'入', code:'M-3001', name:'WPA 蜗轮减速机', batch:'B2608301', wh:'WH04', loc:'D-01-01-01', qty:4, before:0, after:4, op:'李娜' },
  { time:'2026-09-02 10:36', no:'DO20260902002', biz:'生产领料', dir:'出', code:'M-1003', name:'深沟球轴承', batch:'B2608022', wh:'WH01', loc:'A-02-03-02', qty:-500, before:1760, after:1260, op:'孙伟' },
  { time:'2026-09-02 10:12', no:'DO20260902002', biz:'生产领料', dir:'出', code:'M-1002', name:'外六角螺栓', batch:'B2609011', wh:'WH01', loc:'A-02-03-01', qty:-2600,before:5800, after:3200, op:'孙伟' },
  { time:'2026-09-02 09:24', no:'RC20260902002', biz:'生产入库', dir:'入', code:'M-2001', name:'齿轮箱总成', batch:'B2609021', wh:'WH02', loc:'B-01-01-01', qty:18,   before:34,   after:52,   op:'李娜' },
  { time:'2026-09-01 16:08', no:'TR20260901003', biz:'库内移库', dir:'转', code:'M-1001', name:'冷轧钢板 SPCC', batch:'B2609011', wh:'WH01', loc:'A-01-01-02', qty:30, before:0, after:30, op:'孙伟' },
  { time:'2026-09-01 10:48', no:'RC20260901002', biz:'采购入库', dir:'入', code:'M-1002', name:'外六角螺栓', batch:'B2609011', wh:'WH01', loc:'A-02-03-01', qty:18000,before:5800, after:23800,op:'王强' },
  { time:'2026-09-01 09:30', no:'RC20260901001', biz:'采购入库', dir:'入', code:'M-1001', name:'冷轧钢板 SPCC', batch:'B2609011', wh:'WH01', loc:'A-05-01-01', qty:30, before:0, after:30, op:'王强' },
  { time:'2026-09-01 08:40', no:'DO20260901004', biz:'销售出库', dir:'出', code:'M-3001', name:'WPA 蜗轮减速机', batch:'B2608301', wh:'WH02', loc:'B-01-01-01', qty:-36, before:154, after:118, op:'孙伟' },
  { time:'2026-08-31 09:12', no:'RC20260831001', biz:'采购入库', dir:'入', code:'M-1001', name:'冷轧钢板 SPCC', batch:'B2608101', wh:'WH01', loc:'A-01-01-01', qty:35.2,before:21.3, after:56.5, op:'王强' },
  { time:'2026-08-30 14:40', no:'RC20260830001', biz:'调拨入库', dir:'入', code:'M-4002', name:'五层瓦楞纸箱', batch:'—', wh:'WH03', loc:'C-02-01-01', qty:120, before:5480, after:5600, op:'李娜' },
  { time:'2026-08-30 10:05', no:'PD20260829001', biz:'盘亏出库', dir:'出', code:'M-4003', name:'缠绕膜', batch:'—', wh:'WH03', loc:'C-02-01-01', qty:-2, before:30, after:28, op:'张鹏' }
];

/* ------------------------------ 移库 / 调拨 ------------------------------ */

DB.transfer = [
  { no:'TR20260902001', kind:'库内移库', fromWh:'WH01', toWh:'WH01', lines:2, qty:30,  status:'待执行', reason:'库位整理', creator:'孙伟', createAt:'2026-09-02 09:15' },
  { no:'TR20260902002', kind:'跨仓调拨', fromWh:'WH03', toWh:'WH01', lines:1, qty:600, status:'执行中', reason:'生产急用',  creator:'李娜', createAt:'2026-09-02 10:40' },
  { no:'TR20260901003', kind:'库内移库', fromWh:'WH01', toWh:'WH01', lines:1, qty:30,  status:'已完成', reason:'上架',      creator:'孙伟', createAt:'2026-09-01 15:50' },
  { no:'TR20260901002', kind:'跨仓调拨', fromWh:'WH02', toWh:'WH04', lines:1, qty:4,   status:'已完成', reason:'退货隔离',  creator:'张鹏', createAt:'2026-09-01 14:02' },
  { no:'TR20260829001', kind:'跨仓调拨', fromWh:'WH03', toWh:'WH03', lines:2, qty:120, status:'已完成', reason:'货位合并',  creator:'李娜', createAt:'2026-08-29 11:20' }
];

/* ------------------------------ 盘点 ------------------------------ */

DB.stocktake = [
  { no:'PD20260902001', kind:'动碰盘点', wh:'WH01', scope:'A区-小件', planLines:36, doneLines:22, diffLines:3, status:'盘点中', owner:'孙伟', planDate:'2026-09-02', finishDate:'' },
  { no:'PD20260901001', kind:'循环盘点', wh:'WH02', scope:'B区-成品', planLines:24, doneLines:24, diffLines:1, status:'待审核', owner:'刘敏', planDate:'2026-09-01', finishDate:'2026-09-01' },
  { no:'PD20260829001', kind:'全盘',     wh:'WH03', scope:'全仓',     planLines:58, doneLines:58, diffLines:2, status:'已完成', owner:'张鹏', planDate:'2026-08-29', finishDate:'2026-08-30' },
  { no:'PD20260820001', kind:'抽盘',     wh:'WH01', scope:'A区-板材', planLines:12, doneLines:12, diffLines:0, status:'已完成', owner:'孙伟', planDate:'2026-08-20', finishDate:'2026-08-20' }
];

DB.stocktakeLine = {
  'PD20260902001': [
    { i:1, code:'M-1002', name:'外六角螺栓', spec:'M8×30 SUS304', unit:'个', loc:'A-02-03-01', batch:'B2609011', sysQty:3200, realQty:3200, diff:0,   result:'一致' },
    { i:2, code:'M-1003', name:'深沟球轴承', spec:'6204-2RS',     unit:'个', loc:'A-02-03-02', batch:'B2608022', sysQty:1260, realQty:1254, diff:-6,  result:'盘亏' },
    { i:3, code:'M-1005', name:'RVV 软电缆', spec:'3×2.5mm²',     unit:'米', loc:'A-02-03-01', batch:'—',        sysQty:7400, realQty:7436, diff:36,  result:'盘盈' },
    { i:4, code:'M-1004', name:'三相异步电机',spec:'Y2-90L-4 1.5kW',unit:'台',loc:'A-03-01-01', batch:'B2608015', sysQty:24,   realQty:null, diff:null,result:'待盘' },
    { i:5, code:'M-1006', name:'不锈钢圆管', spec:'Φ25×2.0 304',  unit:'米', loc:'A-02-03-02', batch:'—',        sysQty:0,    realQty:18,   diff:18,  result:'盘盈' }
  ]
};

/* ------------------------------ 报表数据 ------------------------------ */

// 近 12 个月出入库数量（单位：万元金额，避免不同物料单位混算）
DB.trend = {
  labels: ['2025-10','2025-11','2025-12','2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07','2026-08','2026-09'],
  series: [
    { name: '入库金额', unit: '万元', values: [268, 302, 341, 196, 158, 312, 356, 331, 378, 402, 385, 142] },
    { name: '出库金额', unit: '万元', values: [241, 289, 368, 174, 143, 298, 322, 349, 341, 366, 402, 128] }
  ]
};

// 库龄分布（按金额，单一序列）
DB.ageDist = [
  { bucket: '0-30 天',    amount: 82.4, skuCount: 6 },
  { bucket: '31-60 天',   amount: 24.1, skuCount: 3 },
  { bucket: '61-90 天',   amount: 6.6,  skuCount: 1 },
  { bucket: '91-180 天',  amount: 1.6,  skuCount: 2 },
  { bucket: '180 天以上', amount: 0.3,  skuCount: 1 }
];

// 呆滞料
DB.slowMove = [
  { code:'M-4003', name:'缠绕膜',         spec:'50cm×2.5kg',  unit:'箱', onHand:28,   amount:2688,  lastOut:'2026-05-06', days:119, suggest:'折价处理' },
  { code:'M-4001', name:'抗磨液压油',     spec:'L-HM46 18L',  unit:'桶', onHand:41,   amount:13448, lastOut:'2026-06-11', days:83,  suggest:'调拨他仓' },
  { code:'M-1005', name:'RVV 软电缆',     spec:'3×2.5mm²',    unit:'米', onHand:7400, amount:65860, lastOut:'2026-07-18', days:46,  suggest:'继续观察' },
  { code:'M-1006', name:'不锈钢圆管',     spec:'Φ25×2.0 304', unit:'米', onHand:0,    amount:0,     lastOut:'2026-03-02', days:184, suggest:'物料停用' }
];

// 出入库汇总（按物料分类）
DB.summaryByCat = [
  { cat:'原材料',  inQty:'—', inAmt:1082.4, outAmt:964.2, endAmt:462.1, turnover:2.6 },
  { cat:'半成品',  inQty:'—', inAmt:216.8,  outAmt:198.4, endAmt:65.5,  turnover:3.4 },
  { cat:'成品',    inQty:'—', inAmt:642.3,  outAmt:688.1, endAmt:288.3, turnover:2.4 },
  { cat:'辅料',    inQty:'—', inAmt:48.2,   outAmt:39.6,  endAmt:13.4,  turnover:3.1 },
  { cat:'包装物',  inQty:'—', inAmt:31.6,   outAmt:28.9,  endAmt:24.0,  turnover:1.3 }
];

/* ------------------------------ 系统管理 ------------------------------ */

DB.user = [
  { account:'wangqiang', name:'王强',  dept:'仓储部', role:'收货员',   whScope:'WH01',           phone:'138 0000 1122', status:'启用', lastLogin:'2026-09-02 08:12' },
  { account:'lina',      name:'李娜',  dept:'仓储部', role:'仓库主管', whScope:'WH01/WH02/WH03',phone:'139 0000 3344', status:'启用', lastLogin:'2026-09-02 08:02' },
  { account:'sunwei',    name:'孙伟',  dept:'仓储部', role:'拣货员',   whScope:'WH01/WH02',     phone:'136 0000 5566', status:'启用', lastLogin:'2026-09-02 07:55' },
  { account:'liumin',    name:'刘敏',  dept:'销售部', role:'制单员',   whScope:'WH02',          phone:'137 0000 7788', status:'启用', lastLogin:'2026-09-01 17:30' },
  { account:'zhangpeng', name:'张鹏',  dept:'品质部', role:'质检员',   whScope:'WH04',          phone:'135 0000 9900', status:'启用', lastLogin:'2026-09-02 09:40' },
  { account:'chenlei',   name:'陈磊',  dept:'财务部', role:'查询员',   whScope:'全部',          phone:'133 0000 2211', status:'停用', lastLogin:'2026-07-14 10:20' }
];

DB.role = [
  { code:'R01', name:'系统管理员', users:1, desc:'全部菜单与数据权限，含用户与参数配置' },
  { code:'R02', name:'仓库主管',   users:2, desc:'本仓全部单据的审核、盘点审核、报表查看' },
  { code:'R03', name:'收货员',     users:3, desc:'入库单收货、质检登记、上架' },
  { code:'R04', name:'拣货员',     users:4, desc:'出库单拣货、复核、移库执行' },
  { code:'R05', name:'制单员',     users:2, desc:'新建出库单/入库单，不含审核' },
  { code:'R06', name:'查询员',     users:5, desc:'只读：库存查询、流水、报表' }
];

// 角色-菜单权限矩阵（用于权限配置弹窗）
DB.permTree = [
  { m:'工作台',     items:['查看'] },
  { m:'基础数据',   items:['物料查看','物料维护','库位查看','库位维护','往来单位维护'] },
  { m:'入库管理',   items:['入库单查看','新建入库单','收货登记','质检登记','上架确认','作废'] },
  { m:'出库管理',   items:['出库单查看','新建出库单','审核','拣货','复核发运','作废'] },
  { m:'库存管理',   items:['库存查询','批次明细','库存流水','库存冻结/解冻'] },
  { m:'库内作业',   items:['移库调拨','盘点单创建','盘点录入','差异审核'] },
  { m:'报表分析',   items:['出入库汇总','库龄分析','呆滞料分析','导出'] },
  { m:'系统管理',   items:['用户管理','角色权限','仓库参数','操作日志'] }
];

DB.todo = [
  { ico:'↓', title:'待收货入库单',   sub:'最早到货 2026-09-02，含 1 张超期', count:1,  route:'#/inbound/receipt?status=待收货' },
  { ico:'⇧', title:'待上架',         sub:'收货暂存区已积压 2 张单据',       count:2,  route:'#/inbound/receipt?status=待上架' },
  { ico:'✓', title:'出库单待审核',   sub:'其中 1 张标记为高优先级',         count:2,  route:'#/outbound/list?status=待审核' },
  { ico:'↑', title:'待拣货',         sub:'今日需发运 3 张',                 count:3,  route:'#/outbound/list?status=待拣货' },
  { ico:'≡', title:'盘点差异待审核', sub:'PD20260901001 有 1 行差异',       count:1,  route:'#/wip/stocktake' },
  { ico:'!', title:'低于安全库存',   sub:'M-1002、M-1004、M-3002、M-4003',  count:4,  route:'#/stock/query?alert=low' }
];

DB.alerts = [
  { level:'critical', title:'M-3002 可用库存 5 台，低于安全下限 10 台', time:'10 分钟前', act:'发起采购申请' },
  { level:'critical', title:'M-1002 可用库存 2,600 个，低于安全下限 5,000 个', time:'32 分钟前', act:'发起采购申请' },
  { level:'warning',  title:'RC20260902001 预计到货已超期 1 天',  time:'1 小时前',  act:'联系供应商' },
  { level:'warning',  title:'库位 C-01-01-01 占用率 68%，接近饱和', time:'2 小时前',  act:'安排移库' },
  { level:'serious',  title:'M-4003 库龄 137 天，进入呆滞料清单', time:'今天 08:00', act:'查看呆滞料报表' }
];

DB.log = [
  { time:'2026-09-02 13:52', user:'张鹏', ip:'10.12.3.88',  module:'出库管理', act:'完成出库', target:'DO20260902006', result:'成功' },
  { time:'2026-09-02 13:26', user:'王强', ip:'10.12.3.41',  module:'入库管理', act:'作废单据', target:'RC20260902004', result:'成功' },
  { time:'2026-09-02 11:42', user:'李娜', ip:'10.12.3.52',  module:'入库管理', act:'收货登记', target:'RC20260902003', result:'成功' },
  { time:'2026-09-02 10:36', user:'孙伟', ip:'10.12.9.117', module:'出库管理', act:'拣货提交', target:'DO20260902002', result:'成功' },
  { time:'2026-09-02 09:15', user:'孙伟', ip:'10.12.9.117', module:'库内作业', act:'新建移库单', target:'TR20260902001', result:'成功' },
  { time:'2026-09-02 08:31', user:'chenlei', ip:'10.12.5.7', module:'系统登录', act:'登录', target:'—', result:'失败：账号已停用' }
];
