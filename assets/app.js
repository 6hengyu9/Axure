/* ==========================================================================
   WMS 原型交互逻辑
   —— 这一层等价于 Axure 里的「用例 + 动态面板 + 中继器」
   路由 = Axure 的页面跳转；render 函数 = 一个 Axure 页面
   ========================================================================== */

/* ============================== 通用工具 ============================== */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** 千分位；d 为小数位，null 显示 — */
function fmt(n, d = 0) {
  if (n === null || n === undefined || n === '') return '—';
  if (typeof n !== 'number') return esc(n);
  return n.toLocaleString('zh-CN', { minimumFractionDigits: d, maximumFractionDigits: d });
}

/** 状态 → [标签配色, 前置图标]。状态色永远带图标+文字，不靠颜色单独表意 */
const STATUS = {
  '待收货': ['info', '○'],   '收货中': ['warning', '◐'],  '待上架': ['warning', '⇧'],
  '已完成': ['good', '✓'],   '已作废': ['', '⊘'],
  '待审核': ['info', '○'],   '待拣货': ['info', '○'],     '拣货中': ['warning', '◐'],
  '待发运': ['serious', '➜'],
  '待执行': ['info', '○'],   '执行中': ['warning', '◐'],
  '盘点中': ['warning', '◐'],
  '启用': ['good', '✓'],     '停用': ['', '⊘'],
  '占用': ['info', '▪'],     '空闲': ['', '□'],           '冻结': ['critical', '✕'],
  '合作中': ['good', '✓'],   '暂停': ['warning', '‖'],
  '一致': ['good', '✓'],     '盘亏': ['critical', '▼'],   '盘盈': ['warning', '▲'], '待盘': ['', '○'],
  '合格': ['good', '✓'],     '待检': ['info', '○'],       '部分让步': ['warning', '△'], '不合格': ['critical', '✕'],
  '已拣货': ['good', '✓'],   '部分拣货': ['warning', '◐'],
  '成功': ['good', '✓'],
  '高': ['critical', '▲'],   '中': ['warning', '■'],      '低': ['', '▼']
};

function tag(text, kind) {
  const [cls, ico] = STATUS[text] || [kind || '', ''];
  return `<span class="tag ${cls}">${ico ? `<span aria-hidden="true">${ico}</span>` : ''}${esc(text)}</span>`;
}

function toast(msg, kind = 'ok') {
  let host = $('.toast-host');
  if (!host) { host = document.createElement('div'); host.className = 'toast-host'; document.body.append(host); }
  const t = document.createElement('div');
  t.className = `toast ${kind}`;
  t.textContent = msg;
  host.append(t);
  setTimeout(() => t.remove(), 2200);
}

/** 弹窗；返回关闭函数 */
function modal({ title, body, footer, width = '' }) {
  const mask = document.createElement('div');
  mask.className = 'mask';
  mask.innerHTML = `
    <div class="modal ${width}" role="dialog" aria-modal="true">
      <div class="modal-hd"><h3>${esc(title)}</h3><button class="close" data-close aria-label="关闭">✕</button></div>
      <div class="modal-bd">${body}</div>
      ${footer === null ? '' : `<div class="modal-ft">${footer || `
        <button class="btn" data-close>取消</button>
        <button class="btn primary" data-close data-ok>确定</button>`}</div>`}
    </div>`;
  document.body.append(mask);
  const close = () => mask.remove();
  mask.addEventListener('click', (e) => {
    if (e.target === mask || e.target.closest('[data-close]')) close();
  });
  return { mask, close };
}

/** 右侧抽屉 */
function drawer({ title, sub, body, footer }) {
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="drawer-mask" data-close></div>
    <div class="drawer" role="dialog" aria-modal="true">
      <div class="drawer-hd">
        <h3>${esc(title)}</h3>${sub ? `<span class="muted">${sub}</span>` : ''}
        <button class="close" data-close aria-label="关闭">✕</button>
      </div>
      <div class="drawer-bd">${body}</div>
      ${footer === null ? '' : `<div class="drawer-ft">${footer || '<button class="btn" data-close>关闭</button>'}</div>`}
    </div>`;
  document.body.append(wrap);
  const close = () => wrap.remove();
  wrap.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  return { wrap, close };
}

/* ============================== 片段构造器 ============================== */

function pageHead({ crumb, title, desc, actions = '' }) {
  return `
    <div class="crumb">${crumb.map((c) => `<span>${esc(c)}</span>`).join('')}</div>
    <div class="page-hd">
      <div>
        <h1>${esc(title)}</h1>
        ${desc ? `<p class="desc">${desc}</p>` : ''}
      </div>
      ${actions ? `<div class="actions">${actions}</div>` : ''}
    </div>`;
}

function card({ title, sub, right, body, tight, cls = '' }) {
  const hd = title ? `
    <div class="card-hd">
      <h3>${esc(title)}</h3>
      ${sub ? `<span class="sub">${sub}</span>` : ''}
      ${right ? `<div class="right">${right}</div>` : ''}
    </div>` : '';
  return `<div class="card ${cls}">${hd}<div class="card-bd ${tight ? 'tight' : ''}">${body}</div></div>`;
}

/**
 * 表格 —— 对应 Axure 中继器
 * cols: [{ key, title, w, align:'num'|'center', render(row,i) }]
 */
function tbl({ cols, rows, foot, rowAttr }) {
  if (!rows.length) {
    return `<div class="empty"><div class="big">▤</div><p>没有符合条件的数据</p></div>`;
  }
  // title 由代码提供（可含 <span class="req">*</span> 等标记），故不转义
  const th = cols.map((c) =>
    `<th class="${c.align || ''}"${c.w ? ` style="width:${c.w}"` : ''}>${c.title}</th>`).join('');
  const tr = rows.map((r, i) => `
    <tr ${rowAttr ? rowAttr(r, i) : ''}>
      ${cols.map((c) => `<td class="${c.align || ''}">${c.render ? c.render(r, i) : esc(r[c.key])}</td>`).join('')}
    </tr>`).join('');
  const tf = foot ? `<tfoot><tr>${foot.map((f) =>
    `<td class="${f.align || ''}">${f.html ?? ''}</td>`).join('')}</tr></tfoot>` : '';
  return `<div class="table-wrap"><table class="tbl"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody>${tf}</table></div>`;
}

function pager(total, page = 1, size = 20) {
  const pages = Math.max(1, Math.ceil(total / size));
  let btns = '';
  for (let p = 1; p <= Math.min(pages, 5); p++) {
    btns += `<button class="${p === page ? 'on' : ''}" data-act="page" data-p="${p}">${p}</button>`;
  }
  return `
    <div class="pager">
      <span>共 <b>${fmt(total)}</b> 条 · 每页
        <select class="select" style="width:64px;height:26px;display:inline-block" data-act="pagesize">
          <option>20</option><option>50</option><option>100</option>
        </select> 条
      </span>
      <div class="pages">
        <button data-act="page" data-p="prev">‹</button>${btns}<button data-act="page" data-p="next">›</button>
      </div>
    </div>`;
}

/** 查询条件区 */
function filters(items, extra = '') {
  return `
    <div class="filters">
      ${items.map((it) => `
        <div class="filter ${it.w || 'w150'}">
          <label>${esc(it.label)}</label>
          ${it.type === 'select'
            ? `<select class="select">${['全部', ...it.options].map((o) => `<option>${esc(o)}</option>`).join('')}</select>`
            : it.type === 'date'
              ? `<input class="input" type="date" value="${it.value || ''}">`
              : `<input class="input" placeholder="${esc(it.ph || '')}" value="${esc(it.value || '')}">`}
        </div>`).join('')}
      <div class="filter-actions">
        <button class="btn primary" data-act="search">查询</button>
        <button class="btn" data-act="reset">重置</button>
        ${extra}
      </div>
    </div>`;
}

function stat({ label, value, unit, delta, dir }) {
  return `
    <div class="tile">
      <div class="label">${esc(label)}</div>
      <div class="value">${value}${unit ? `<small>${esc(unit)}</small>` : ''}</div>
      ${delta ? `<div class="delta ${dir}">${dir === 'up' ? '▲' : dir === 'down' ? '▼' : '—'} ${esc(delta)}</div>` : ''}
    </div>`;
}

function meter(pct) {
  const cls = pct >= 85 ? 'crit' : pct >= 70 ? 'warn' : '';
  return `<div class="meter-row"><div class="meter ${cls}"><i style="width:${Math.min(pct, 100)}%"></i></div><span>${pct}%</span></div>`;
}

/* ============================== 图表 ============================== */

const SER = ['var(--series-1)', 'var(--series-2)'];
const SER_HEX = ['#2a78d6', '#eb6834'];

/**
 * Y 轴刻度取整：选「能用 ≤ maxTicks 段覆盖 max 的最小整齐步长」，
 * 顶部刻度贴着数据而不是撑到 count×step —— 否则数据只占半个画布高度。
 */
function niceTicks(max, maxTicks = 5) {
  if (!(max > 0)) return [0, 1];
  let mag = Math.pow(10, Math.floor(Math.log10(max)) - 1);
  for (let k = 0; k < 6; k++, mag *= 10) {
    for (const m of [1, 2, 2.5, 5]) {
      const step = mag * m;
      if (Math.ceil(max / step) <= maxTicks) {
        const out = [];
        for (let v = 0; v <= step * Math.ceil(max / step) + 1e-9; v += step) out.push(+v.toFixed(6));
        return out;
      }
    }
  }
  return [0, max];
}

/**
 * 折线图 —— 十字准星 + tooltip；2 序列必带图例
 * 直接标注在此处会与另一条线的端点重叠，按规范改用「图例 + tooltip + 表格视图」
 */
function lineChart(host, { labels, series, unit }) {
  const W = host.clientWidth || 720, H = 260;
  const m = { t: 14, r: 18, b: 26, l: 46 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const ticks = niceTicks(Math.max(...series.flatMap((s) => s.values)));
  const yMax = ticks[ticks.length - 1];
  const x = (i) => m.l + (labels.length === 1 ? iw / 2 : (iw * i) / (labels.length - 1));
  const y = (v) => m.t + ih - (v / yMax) * ih;

  const grid = ticks.map((t) =>
    `<line class="grid-line" x1="${m.l}" y1="${y(t)}" x2="${m.l + iw}" y2="${y(t)}"/>
     <text class="tick y" x="${m.l - 8}" y="${y(t) + 4}">${fmt(t)}</text>`).join('');

  const xt = labels.map((l, i) => (i % 2 === 0 || i === labels.length - 1)
    ? `<text class="tick" x="${x(i)}" y="${H - 8}" text-anchor="middle">${l.slice(2)}</text>` : '').join('');

  const paths = series.map((s, si) =>
    `<path class="line" stroke="${SER[si]}" d="${s.values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ')}"/>`).join('');

  host.innerHTML = `
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img"
         aria-label="近 12 个月入库与出库金额趋势（万元）">
      ${grid}
      <line class="axis-line" x1="${m.l}" y1="${m.t + ih}" x2="${m.l + iw}" y2="${m.t + ih}"/>
      ${xt}
      ${paths}
      <g class="cross" style="display:none">
        <line class="crosshair" y1="${m.t}" y2="${m.t + ih}"/>
        ${series.map((s, si) =>
          `<circle class="dot-ring" r="4.5" fill="${SER[si]}"/>`).join('')}
      </g>
      <rect class="hit" x="${m.l}" y="${m.t}" width="${iw}" height="${ih}"/>
    </svg>
    <div class="chart-tip"></div>`;

  const svg = $('svg', host), tip = $('.chart-tip', host);
  const cross = $('.cross', svg), cLine = $('.crosshair', cross), dots = $$('circle', cross);

  const move = (ev) => {
    const box = svg.getBoundingClientRect();
    const px = ((ev.clientX - box.left) / box.width) * W;
    let i = Math.round(((px - m.l) / iw) * (labels.length - 1));
    i = Math.max(0, Math.min(labels.length - 1, i));
    cross.style.display = '';
    cLine.setAttribute('x1', x(i)); cLine.setAttribute('x2', x(i));
    dots.forEach((d, si) => { d.setAttribute('cx', x(i)); d.setAttribute('cy', y(series[si].values[i])); });
    tip.innerHTML = `<div class="tt">${labels[i]}</div>` + series.map((s, si) =>
      `<div class="r"><span class="k" style="background:${SER_HEX[si]}"></span>${esc(s.name)}
        <span class="v">${fmt(s.values[i])} ${esc(unit || s.unit || '')}</span></div>`).join('');
    tip.style.opacity = 1;
    const left = (x(i) / W) * box.width;
    tip.style.left = `${Math.min(Math.max(left + 14, 8), box.width - 190)}px`;
    tip.style.top = '18px';
  };
  svg.addEventListener('mousemove', move);
  svg.addEventListener('mouseleave', () => { cross.style.display = 'none'; tip.style.opacity = 0; });
}

/** 柱图 —— 单序列（无需图例），柱顶直接标注 + hover tooltip */
function barChart(host, { rows, xKey, yKey, unit, label }) {
  const W = host.clientWidth || 480, H = 250;
  const m = { t: 22, r: 12, b: 30, l: 46 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const ticks = niceTicks(Math.max(...rows.map((r) => r[yKey])));
  const yMax = ticks[ticks.length - 1];
  const band = iw / rows.length;
  const bw = Math.min(24, band * 0.5);          // 柱宽封顶 24px，余量留白
  const y = (v) => m.t + ih - (v / yMax) * ih;

  const bar = (x0, y0, w, h, r = 4) => {
    r = Math.min(r, h, w / 2);
    return `M${x0},${y0 + h} L${x0},${y0 + r} Q${x0},${y0} ${x0 + r},${y0}
            L${x0 + w - r},${y0} Q${x0 + w},${y0} ${x0 + w},${y0 + r} L${x0 + w},${y0 + h} Z`;
  };

  const grid = ticks.map((t) =>
    `<line class="grid-line" x1="${m.l}" y1="${y(t)}" x2="${m.l + iw}" y2="${y(t)}"/>
     <text class="tick y" x="${m.l - 8}" y="${y(t) + 4}">${fmt(t)}</text>`).join('');

  const bars = rows.map((r, i) => {
    const cx = m.l + band * i + band / 2;
    const h = Math.max(1, ih - (y(r[yKey]) - m.t));
    return `
      <g class="bar-g" data-i="${i}">
        <rect class="hit" x="${m.l + band * i}" y="${m.t}" width="${band}" height="${ih}"/>
        <path d="${bar(cx - bw / 2, y(r[yKey]), bw, h)}" fill="var(--series-1)"/>
        <text class="bar-label" x="${cx}" y="${y(r[yKey]) - 7}">${fmt(r[yKey], 1)}</text>
        <text class="tick" x="${cx}" y="${H - 10}" text-anchor="middle">${esc(r[xKey])}</text>
      </g>`;
  }).join('');

  host.innerHTML = `
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">
      ${grid}
      <line class="axis-line" x1="${m.l}" y1="${m.t + ih}" x2="${m.l + iw}" y2="${m.t + ih}"/>
      ${bars}
    </svg>
    <div class="chart-tip"></div>`;

  const tip = $('.chart-tip', host);
  $$('.bar-g', host).forEach((g) => {
    g.addEventListener('mouseenter', () => {
      const r = rows[+g.dataset.i];
      tip.innerHTML = `<div class="tt">${esc(r[xKey])}</div>
        <div class="r"><span class="k" style="background:${SER_HEX[0]}"></span>金额
        <span class="v">${fmt(r[yKey], 1)} ${esc(unit)}</span></div>
        <div class="r">涉及物料<span class="v">${r.skuCount} 项</span></div>`;
      tip.style.opacity = 1;
      const box = g.getBoundingClientRect(), hostBox = host.getBoundingClientRect();
      tip.style.left = `${Math.min(box.left - hostBox.left + 10, hostBox.width - 160)}px`;
      tip.style.top = '10px';
    });
    g.addEventListener('mouseleave', () => { tip.style.opacity = 0; });
  });
}

function legend(items) {
  return `<div class="legend">${items.map((it, i) =>
    `<span class="item"><span class="key" style="background:${SER_HEX[i]}"></span>${esc(it)}</span>`).join('')}</div>`;
}

/* ============================== 导航（Axure 母版：左侧导航） ============================== */

const NAV = [
  { ico: '▦', name: '工作台', items: [{ t: '仓库总览', r: '#/dashboard' }] },
  { ico: '▤', name: '基础数据', items: [
    { t: '物料管理', r: '#/base/material' },
    { t: '仓库与库位', r: '#/base/location' },
    { t: '往来单位', r: '#/base/partner' }
  ] },
  { ico: '↓', name: '入库管理', items: [
    { t: '入库单管理', r: '#/inbound/receipt' },
    { t: '收货与上架', r: '#/inbound/putaway' }
  ] },
  { ico: '↑', name: '出库管理', items: [
    { t: '出库单管理', r: '#/outbound/list' },
    { t: '拣货作业', r: '#/outbound/pick' }
  ] },
  { ico: '▩', name: '库存管理', items: [
    { t: '库存查询', r: '#/stock/query' },
    { t: '库存流水', r: '#/stock/ledger' }
  ] },
  { ico: '⇄', name: '库内作业', items: [
    { t: '移库与调拨', r: '#/wip/transfer' },
    { t: '库存盘点', r: '#/wip/stocktake' }
  ] },
  { ico: '◫', name: '报表分析', items: [
    { t: '出入库汇总', r: '#/report/summary' },
    { t: '库龄与呆滞料', r: '#/report/age' }
  ] },
  { ico: '⚙', name: '系统管理', items: [
    { t: '用户管理', r: '#/sys/user' },
    { t: '角色与权限', r: '#/sys/role' },
    { t: '操作日志', r: '#/sys/log' }
  ] }
];

function renderNav(active) {
  $('.nav').innerHTML = NAV.map((g) => {
    const open = g.items.some((i) => i.r.split('?')[0] === active);
    return `
      <div class="nav-group ${open ? 'open' : ''}">
        <div class="nav-group-hd" data-act="nav-toggle">
          <span class="ico" aria-hidden="true">${g.ico}</span>
          <span class="txt">${g.name}</span>
          <span class="arrow" aria-hidden="true">▶</span>
        </div>
        <div class="nav-sub">
          ${g.items.map((i) =>
            `<a class="nav-item ${i.r.split('?')[0] === active ? 'active' : ''}" href="${i.r}">${i.t}</a>`).join('')}
        </div>
      </div>`;
  }).join('');
}

/* ============================== 页面：工作台 ============================== */

function viewDashboard() {
  const lowStock = DB.material.filter((m) => m.status === '启用' && m.onHand < m.safeMin);
  return pageHead({
    crumb: ['工作台'], title: '仓库总览',
    desc: '数据截至 2026-09-02 14:00 · 当前仓库：全部（4 个）',
    actions: `<button class="btn" data-act="toast" data-msg="已导出总览数据">导出</button>
              <button class="btn primary" data-act="new-receipt">＋ 新建入库单</button>`
  }) + `
    <div class="tiles">
      ${stat({ label: '库存总金额', value: '853.4', unit: '万元', delta: '2.8% 环比上月', dir: 'up' })}
      ${stat({ label: '今日入库单', value: '4', unit: '张', delta: '1 张待收货', dir: 'flat' })}
      ${stat({ label: '今日出库单', value: '6', unit: '张', delta: '2 张待审核', dir: 'flat' })}
      ${stat({ label: '库存预警物料', value: String(lowStock.length), unit: '项', delta: '较昨日 +1', dir: 'down' })}
    </div>

    <div class="grid-2">
      ${card({
        title: '出入库金额趋势', sub: '近 12 个月 · 单位 万元 · 2026-09 为进行中月份',
        right: `${legend(DB.trend.series.map((s) => s.name))}
                <div class="view-toggle">
                  <button class="on" data-act="chart-view" data-v="chart" data-host="trend">图表</button>
                  <button data-act="chart-view" data-v="table" data-host="trend">表格</button>
                </div>`,
        body: `<div class="chart-box" id="chart-trend" style="min-height:260px"></div>
               <div id="table-trend" style="display:none"></div>`
      })}
      ${card({
        title: '待办事项', sub: '按角色权限过滤', tight: true,
        body: `<div class="todo-list">${DB.todo.map((t) => `
          <a class="todo" href="${t.route}">
            <span class="ico" aria-hidden="true">${t.ico}</span>
            <span class="t"><b>${t.title}</b><span>${t.sub}</span></span>
            <span class="badge-count">${t.count}</span>
          </a>`).join('')}</div>`
      })}
    </div>

    <div class="grid-2">
      ${card({
        title: '库存预警', sub: '低于安全下限的启用物料', tight: true,
        body: tbl({
          cols: [
            { key: 'code', title: '物料编码', render: (r) => `<span class="code">${r.code}</span>` },
            { key: 'name', title: '物料名称', render: (r) => `${esc(r.name)}<span class="sub-text">${esc(r.spec)}</span>` },
            { key: 'onHand', title: '现存量', align: 'num', render: (r) => `${fmt(r.onHand, r.unit === '吨' ? 1 : 0)} ${r.unit}` },
            { key: 'safeMin', title: '安全下限', align: 'num', render: (r) => fmt(r.safeMin) },
            { key: 'gap', title: '缺口', align: 'num', render: (r) => `<span style="color:var(--critical)">${fmt(r.safeMin - r.onHand, 0)}</span>` },
            { key: 'op', title: '操作', render: () => `<button class="link-btn" data-act="toast" data-msg="已生成采购申请（原型不落库）">采购申请</button>` }
          ],
          rows: lowStock
        })
      })}
      ${card({
        title: '异常提醒', sub: '最近 24 小时', tight: true,
        body: `<div class="todo-list">${DB.alerts.map((a) => `
          <div class="todo">
            <span class="ico" style="background:${a.level === 'critical' ? '#fdeeee' : a.level === 'warning' ? '#fff6e0' : '#fdeee6'};color:${a.level === 'critical' ? 'var(--critical)' : a.level === 'warning' ? '#8a5e00' : '#a4522c'}" aria-hidden="true">!</span>
            <span class="t"><b>${esc(a.title)}</b><span>${esc(a.time)}</span></span>
            <button class="link-btn" data-act="toast" data-msg="${esc(a.act)}">${esc(a.act)}</button>
          </div>`).join('')}</div>`
      })}
    </div>

    ${card({
      title: '库位占用率 Top', sub: '占用率 ≥ 60% 的库位', tight: true,
      body: tbl({
        cols: [
          { key: 'code', title: '库位编码', render: (r) => `<span class="code">${r.code}</span>` },
          { key: 'wh', title: '所属仓库', align: 'nowrap', render: (r) => whName(r.wh) },
          { key: 'zone', title: '库区' },
          { key: 'type', title: '库位类型' },
          { key: 'cap', title: '容量', align: 'num' },
          { key: 'used', title: '占用率', w: '160px', render: (r) => meter(r.used) }
        ],
        rows: DB.location.filter((l) => l.used >= 60).sort((a, b) => b.used - a.used)
      })
    })}`;
}

function afterDashboard() {
  const host = $('#chart-trend');
  if (host) lineChart(host, { ...DB.trend, unit: '万元' });
  $('#table-trend').innerHTML = tbl({
    cols: [
      { key: 'm', title: '月份' },
      { key: 'i', title: '入库金额（万元）', align: 'num' },
      { key: 'o', title: '出库金额（万元）', align: 'num' },
      { key: 'd', title: '净值（万元）', align: 'num' }
    ],
    rows: DB.trend.labels.map((m, i) => ({
      m, i: fmt(DB.trend.series[0].values[i]), o: fmt(DB.trend.series[1].values[i]),
      d: fmt(DB.trend.series[0].values[i] - DB.trend.series[1].values[i])
    }))
  });
}

const whName = (code) => {
  const w = DB.dict.whList.find((w) => w.code === code);
  return w ? `${code} ${w.name}` : code;
};

/* ============================== 页面：物料管理 ============================== */

function viewMaterial() {
  return pageHead({
    crumb: ['基础数据', '物料管理'], title: '物料管理',
    desc: '维护物料主数据、计量单位、安全库存与批次管控标识',
    actions: `<button class="btn" data-act="toast" data-msg="已打开导入模板">批量导入</button>
              <button class="btn primary" data-act="material-edit">＋ 新增物料</button>`
  }) + card({
    body: filters([
      { label: '物料编码/名称', w: 'w220', ph: '支持模糊查询' },
      { label: '物料分类', type: 'select', options: DB.dict.matType },
      { label: '状态', type: 'select', options: ['启用', '停用'], w: 'w120' },
      { label: '库存预警', type: 'select', options: ['低于下限', '高于上限', '零库存'] }
    ])
  }) + card({
    title: '物料列表', sub: `共 ${DB.material.length} 项`, tight: true,
    right: `<button class="btn sm" data-act="toast" data-msg="已导出 Excel">导出</button>
            <button class="btn sm" data-act="toast" data-msg="列设置面板（原型示意）">列设置</button>`,
    body: tbl({
      cols: [
        { key: 'chk', title: '<input type="checkbox" aria-label="全选">', w: '36px', align: 'center', render: () => `<input type="checkbox">` },
        { key: 'code', title: '物料编码', render: (r) => `<a href="#/stock/query" class="code">${r.code}</a>` },
        { key: 'name', title: '物料名称', render: (r) => `${esc(r.name)}<span class="sub-text">${esc(r.spec)}</span>` },
        { key: 'type', title: '分类', render: (r) => `${esc(r.type)}<span class="sub-text">${esc(r.cat)}</span>` },
        { key: 'unit', title: '单位', align: 'center' },
        { key: 'batchCtl', title: '批次管控', align: 'center', render: (r) => r.batchCtl === '是' ? tag('是', 'info') : '<span class="muted">否</span>' },
        { key: 'onHand', title: '现存量', align: 'num', render: (r) => fmt(r.onHand, r.unit === '吨' ? 1 : 0) },
        { key: 'safe', title: '安全库存', align: 'num', render: (r) => `${fmt(r.safeMin)} ~ ${fmt(r.safeMax)}` },
        { key: 'price', title: '参考单价', align: 'num', render: (r) => `¥ ${fmt(r.price, 2)}` },
        { key: 'status', title: '状态', align: 'center', render: (r) => tag(r.status) },
        { key: 'op', title: '操作', render: (r) => `
            <span class="ops">
              <button class="link-btn" data-act="material-edit" data-code="${r.code}">编辑</button>
              <button class="link-btn" data-act="toast" data-msg="已${r.status === '启用' ? '停用' : '启用'} ${r.code}">${r.status === '启用' ? '停用' : '启用'}</button>
              <button class="link-btn danger" data-act="confirm-del" data-code="${r.code}">删除</button>
            </span>` }
      ],
      rows: DB.material
    }) + pager(DB.material.length)
  });
}

function materialForm(code) {
  const m = DB.material.find((x) => x.code === code) || {};
  const opt = (list, v) => list.map((o) => `<option ${o === v ? 'selected' : ''}>${o}</option>`).join('');
  return `
    <div class="section-title">基本信息</div>
    <div class="form-grid">
      <div class="form-item"><label>物料编码<span class="req">*</span></label>
        <input class="input" value="${esc(m.code || '')}" placeholder="留空则按规则自动生成">
        <span class="hint">规则：分类前缀 + 4 位流水（M-1001）</span></div>
      <div class="form-item"><label>物料名称<span class="req">*</span></label>
        <input class="input" value="${esc(m.name || '')}"></div>
      <div class="form-item"><label>规格型号</label>
        <input class="input" value="${esc(m.spec || '')}"></div>
      <div class="form-item"><label>物料分类<span class="req">*</span></label>
        <select class="select">${opt(DB.dict.matType, m.type)}</select></div>
      <div class="form-item"><label>细类</label><input class="input" value="${esc(m.cat || '')}"></div>
      <div class="form-item"><label>基本单位<span class="req">*</span></label>
        <select class="select">${opt(DB.dict.unit, m.unit)}</select></div>
    </div>
    <div class="section-title mt14">库存控制</div>
    <div class="form-grid">
      <div class="form-item"><label>安全库存下限</label><input class="input" type="number" value="${m.safeMin ?? ''}"></div>
      <div class="form-item"><label>安全库存上限</label><input class="input" type="number" value="${m.safeMax ?? ''}"></div>
      <div class="form-item"><label>参考单价（元）</label><input class="input" type="number" value="${m.price ?? ''}"></div>
      <div class="form-item"><label>批次管控</label><select class="select">${opt(['是', '否'], m.batchCtl)}</select></div>
      <div class="form-item"><label>默认库区</label><select class="select">${opt(['A区-板材', 'A区-小件', 'B区-成品', 'C区-辅料'], '')}</select></div>
      <div class="form-item"><label>状态</label><select class="select">${opt(['启用', '停用'], m.status)}</select></div>
      <div class="form-item span-3"><label>备注</label><textarea class="textarea" placeholder="选填"></textarea></div>
    </div>`;
}

/* ============================== 页面：仓库与库位 ============================== */

function viewLocation() {
  return pageHead({
    crumb: ['基础数据', '仓库与库位'], title: '仓库与库位',
    desc: '库位编码规则：库区-巷道-货架-层位，如 A-01-01-01',
    actions: `<button class="btn" data-act="toast" data-msg="已进入库位批量生成向导">批量生成库位</button>
              <button class="btn primary" data-act="toast" data-msg="新增库位表单（原型示意）">＋ 新增库位</button>`
  }) + `<div class="grid-3">
      ${DB.dict.whList.map((w) => {
        const locs = DB.location.filter((l) => l.wh === w.code);
        const avg = Math.round(locs.reduce((s, l) => s + l.used, 0) / (locs.length || 1));
        return card({
          title: `${w.code} ${w.name}`, sub: w.addr,
          body: `<div class="row" style="justify-content:space-between">
                   <div><div class="muted" style="font-size:12px">库位数</div><div class="strong" style="font-size:18px">${locs.length}</div></div>
                   <div style="flex:1;margin-left:16px">
                     <div class="muted" style="font-size:12px;margin-bottom:5px">平均占用率</div>${meter(avg)}
                   </div>
                 </div>`
        });
      }).join('')}
    </div>` + card({
    body: filters([
      { label: '所属仓库', type: 'select', options: DB.dict.whList.map((w) => `${w.code} ${w.name}`), w: 'w180' },
      { label: '库区', type: 'select', options: [...new Set(DB.location.map((l) => l.zone))], w: 'w150' },
      { label: '库位编码', w: 'w180', ph: '如 A-01' },
      { label: '库位状态', type: 'select', options: ['空闲', '占用', '冻结'], w: 'w120' },
      { label: 'ABC 分类', type: 'select', options: ['A', 'B', 'C'], w: 'w120' }
    ])
  }) + card({
    title: '库位列表', tight: true,
    body: tbl({
      cols: [
        { key: 'code', title: '库位编码', render: (r) => `<span class="code">${r.code}</span>` },
        { key: 'wh', title: '所属仓库', align: 'nowrap', render: (r) => whName(r.wh) },
        { key: 'zone', title: '库区' },
        { key: 'type', title: '库位类型' },
        { key: 'abc', title: 'ABC', align: 'center' },
        { key: 'cap', title: '设计容量', align: 'num' },
        { key: 'used', title: '占用率', w: '150px', render: (r) => meter(r.used) },
        { key: 'mat', title: '当前物料', render: (r) => r.mat ? `<span class="code">${r.mat}</span>` : '<span class="muted">—</span>' },
        { key: 'status', title: '状态', align: 'center', render: (r) => tag(r.status) },
        { key: 'op', title: '操作', render: (r) => `
            <span class="ops">
              <button class="link-btn" data-act="toast" data-msg="打开 ${r.code} 编辑表单">编辑</button>
              <button class="link-btn" data-act="toast" data-msg="${r.status === '冻结' ? '已解冻' : '已冻结'} ${r.code}">${r.status === '冻结' ? '解冻' : '冻结'}</button>
            </span>` }
      ],
      rows: DB.location
    }) + pager(DB.location.length)
  });
}

/* ============================== 页面：往来单位 ============================== */

function viewPartner() {
  return pageHead({
    crumb: ['基础数据', '往来单位'], title: '往来单位',
    desc: '供应商与客户共用一张主数据表，用「类型」区分',
    actions: `<button class="btn primary" data-act="toast" data-msg="新增往来单位表单（原型示意）">＋ 新增单位</button>`
  }) + card({
    body: filters([
      { label: '编码/名称', w: 'w220' },
      { label: '类型', type: 'select', options: ['供应商', '客户'], w: 'w120' },
      { label: '等级', type: 'select', options: ['A', 'B', 'C'], w: 'w120' },
      { label: '合作状态', type: 'select', options: ['合作中', '暂停'], w: 'w120' }
    ])
  }) + card({
    title: '单位列表', tight: true,
    body: tbl({
      cols: [
        { key: 'code', title: '编码', render: (r) => `<span class="code">${r.code}</span>` },
        { key: 'name', title: '单位名称' },
        { key: 'kind', title: '类型', align: 'center', render: (r) => `<span class="tag ${r.kind === '供应商' ? 'info' : ''}">${r.kind}</span>` },
        { key: 'contact', title: '联系人' },
        { key: 'phone', title: '联系电话' },
        { key: 'addr', title: '地址' },
        { key: 'level', title: '等级', align: 'center' },
        { key: 'status', title: '状态', align: 'center', render: (r) => tag(r.status) },
        { key: 'op', title: '操作', render: (r) => `<button class="link-btn" data-act="toast" data-msg="打开 ${r.code}">编辑</button>` }
      ],
      rows: DB.partner
    }) + pager(DB.partner.length)
  });
}

/* ============================== 页面：入库单管理 ============================== */

function viewReceipt(q) {
  const rows = q.status ? DB.receipt.filter((r) => r.status === q.status) : DB.receipt;
  const counts = DB.dict.rcStatus.map((s) => ({ s, n: DB.receipt.filter((r) => r.status === s).length }));
  return pageHead({
    crumb: ['入库管理', '入库单管理'], title: '入库单管理',
    desc: '单据流程：新建 → 收货登记 → 质检 → 上架 → 完成',
    actions: `<button class="btn" data-act="toast" data-msg="已打印所选单据">打印</button>
              <button class="btn primary" data-act="new-receipt">＋ 新建入库单</button>`
  }) + `<div class="tiles" style="grid-template-columns:repeat(5,1fr)">
      ${counts.map((c) => stat({ label: c.s, value: String(c.n), unit: '张' })).join('')}
    </div>` + card({
    body: filters([
      { label: '入库单号', w: 'w180', ph: 'RC…' },
      { label: '业务类型', type: 'select', options: DB.dict.bizType, w: 'w150' },
      { label: '供应商/来源', w: 'w220' },
      { label: '收货仓库', type: 'select', options: DB.dict.whList.map((w) => `${w.code} ${w.name}`), w: 'w180' },
      { label: '单据状态', type: 'select', options: DB.dict.rcStatus, w: 'w120', value: q.status },
      { label: '制单开始日期', type: 'date', value: '2026-08-26', w: 'w150' },
      { label: '制单结束日期', type: 'date', value: '2026-09-02', w: 'w150' }
    ])
  }) + card({
    title: '入库单列表', sub: q.status ? `已按「${q.status}」过滤` : '', tight: true,
    right: `<button class="btn sm" data-act="toast" data-msg="已导出 Excel">导出</button>`,
    body: tbl({
      cols: [
        { key: 'chk', title: '<input type="checkbox" aria-label="全选">', w: '36px', align: 'center', render: () => `<input type="checkbox">` },
        { key: 'no', title: '入库单号', render: (r) => `<button class="link-btn code" data-act="rc-detail" data-no="${r.no}">${r.no}</button>` },
        { key: 'bizType', title: '业务类型' },
        { key: 'po', title: '来源单号', render: (r) => `<span class="code muted">${esc(r.po)}</span>` },
        { key: 'partner', title: '供应商/来源' },
        { key: 'wh', title: '收货仓库', align: 'nowrap', render: (r) => whName(r.wh) },
        { key: 'lines', title: '行数', align: 'num' },
        { key: 'qtyPlan', title: '应收数量', align: 'num', render: (r) => fmt(r.qtyPlan, r.qtyPlan % 1 ? 1 : 0) },
        { key: 'qtyReal', title: '实收数量', align: 'num', render: (r) => fmt(r.qtyReal, r.qtyReal % 1 ? 1 : 0) },
        { key: 'status', title: '状态', align: 'center', render: (r) => tag(r.status) },
        { key: 'creator', title: '制单人', render: (r) => `${esc(r.creator)}<span class="sub-text">${esc(r.createAt)}</span>` },
        { key: 'op', title: '操作', render: (r) => {
          const ops = [`<button class="link-btn" data-act="rc-detail" data-no="${r.no}">查看</button>`];
          if (r.status === '待收货' || r.status === '收货中') ops.push(`<button class="link-btn" data-act="rc-receive" data-no="${r.no}">收货登记</button>`);
          if (r.status === '待上架') ops.push(`<button class="link-btn" data-act="rc-putaway" data-no="${r.no}">上架</button>`);
          if (r.status !== '已完成' && r.status !== '已作废') ops.push(`<button class="link-btn danger" data-act="rc-void" data-no="${r.no}">作废</button>`);
          return `<span class="ops">${ops.join('')}</span>`;
        } }
      ],
      rows
    }) + pager(rows.length)
  });
}

const RC_STEPS = ['新建', '收货登记', '质检', '上架', '完成'];
function stepsHTML(list, cur) {
  return `<div class="steps">${list.map((s, i) => `
    ${i ? '<div class="step-line"></div>' : ''}
    <div class="step ${i < cur ? 'done' : i === cur ? 'on' : ''}">
      <span class="n">${i < cur ? '✓' : i + 1}</span><span class="lbl">${s}</span>
    </div>`).join('')}</div>`;
}

function rcDetail(no) {
  const r = DB.receipt.find((x) => x.no === no);
  const lines = DB.receiptLine[no] || [{ i: 1, code: '—', name: '（示例单据未维护明细）', spec: '—', unit: '—', qtyPlan: r.qtyPlan, qtyReal: r.qtyReal, qtyBad: 0, batch: '—', prodDate: '—', loc: '—', qc: '合格' }];
  const cur = { '待收货': 1, '收货中': 1, '待上架': 3, '已完成': 4, '已作废': 0 }[r.status];
  const foot = [
    { html: '合计' }, { html: '' }, { html: '' }, { html: '' },
    { html: fmt(lines.reduce((s, l) => s + l.qtyPlan, 0)), align: 'num' },
    { html: fmt(lines.reduce((s, l) => s + l.qtyReal, 0)), align: 'num' },
    { html: fmt(lines.reduce((s, l) => s + l.qtyBad, 0)), align: 'num' },
    { html: '' }, { html: '' }, { html: '' }
  ];
  drawer({
    title: r.no, sub: tag(r.status),
    body: `
      ${card({ body: stepsHTML(RC_STEPS, cur) })}
      ${card({ title: '单据信息', body: `
        <dl class="dl">
          <div><dt>业务类型</dt><dd>${esc(r.bizType)}</dd></div>
          <div><dt>来源单号</dt><dd class="code">${esc(r.po)}</dd></div>
          <div><dt>供应商/来源</dt><dd>${esc(r.partner)}</dd></div>
          <div><dt>收货仓库</dt><dd>${whName(r.wh)}</dd></div>
          <div><dt>制单人</dt><dd>${esc(r.creator)}</dd></div>
          <div><dt>制单时间</dt><dd>${esc(r.createAt)}</dd></div>
          <div><dt>到货时间</dt><dd>${esc(r.arriveAt) || '<span class="muted">—</span>'}</dd></div>
          <div><dt>随货单据</dt><dd><a href="#/inbound/receipt">送货单.pdf</a></dd></div>
        </dl>` })}
      ${card({ title: '入库明细', sub: `${lines.length} 行`, tight: true, body: tbl({
        cols: [
          { key: 'i', title: '#', w: '36px', align: 'center' },
          { key: 'code', title: '物料编码', render: (l) => `<span class="code">${esc(l.code)}</span>` },
          { key: 'name', title: '物料名称', render: (l) => `${esc(l.name)}<span class="sub-text">${esc(l.spec)}</span>` },
          { key: 'unit', title: '单位', align: 'center' },
          { key: 'qtyPlan', title: '应收', align: 'num', render: (l) => fmt(l.qtyPlan) },
          { key: 'qtyReal', title: '实收', align: 'num', render: (l) => fmt(l.qtyReal) },
          { key: 'qtyBad', title: '不良', align: 'num', render: (l) => l.qtyBad ? `<span style="color:var(--critical)">${fmt(l.qtyBad)}</span>` : '0' },
          { key: 'batch', title: '批次号', render: (l) => `<span class="code">${esc(l.batch) || '—'}</span>` },
          { key: 'loc', title: '上架库位', render: (l) => `<span class="code">${esc(l.loc) || '<span class="muted">未上架</span>'}</span>` },
          { key: 'qc', title: '质检', align: 'center', render: (l) => tag(l.qc) }
        ],
        rows: lines, foot
      }) })}
      ${card({ title: '操作记录', tight: true, body: tbl({
        cols: [{ key: 't', title: '时间' }, { key: 'u', title: '操作人' }, { key: 'a', title: '动作' }, { key: 'm', title: '备注' }],
        rows: [
          { t: r.createAt, u: r.creator, a: '新建单据', m: `来源 ${r.po}` },
          ...(r.arriveAt ? [{ t: r.arriveAt, u: r.creator, a: '收货登记', m: `实收 ${fmt(r.qtyReal)}` }] : []),
          ...(r.status === '已完成' ? [{ t: r.arriveAt, u: '孙伟', a: '上架确认', m: '库存已更新' }] : []),
          ...(r.status === '已作废' ? [{ t: r.createAt, u: r.creator, a: '作废', m: '供应商延期交货' }] : [])
        ]
      }) })}`,
    footer: `<button class="btn" data-close>关闭</button>
             <button class="btn" data-act="toast" data-msg="已打印 ${no} 入库单">打印单据</button>
             ${r.status === '待上架' ? `<button class="btn primary" data-act="rc-putaway" data-no="${no}">上架确认</button>`
               : r.status === '待收货' || r.status === '收货中' ? `<button class="btn primary" data-act="rc-receive" data-no="${no}">收货登记</button>` : ''}`
  });
}

function rcReceiveForm(no) {
  const r = DB.receipt.find((x) => x.no === no);
  const lines = DB.receiptLine[no] || [];
  modal({
    title: `收货登记 · ${no}`, width: 'w900',
    body: `
      <div class="note">扫码枪聚焦在 <span class="kbd">物料条码</span> 输入框时，扫码后自动定位到对应明细行并把光标移到「实收数量」。</div>
      <div class="form-grid cols-2">
        <div class="form-item"><label>物料条码 / 托盘码</label><input class="input" placeholder="扫码或手工输入" autofocus></div>
        <div class="form-item"><label>实际到货时间<span class="req">*</span></label><input class="input" type="datetime-local" value="2026-09-02T14:00"></div>
      </div>
      <div class="section-title mt14">收货明细</div>
      ${tbl({
        cols: [
          { key: 'i', title: '#', w: '36px', align: 'center' },
          { key: 'code', title: '物料', render: (l) => `<span class="code">${l.code}</span><span class="sub-text">${esc(l.name)}</span>` },
          { key: 'qtyPlan', title: '应收', align: 'num', render: (l) => `${fmt(l.qtyPlan)} ${l.unit}` },
          { key: 'qtyReal', title: '实收数量', w: '110px', render: (l) => `<input class="input" type="number" value="${l.qtyReal || l.qtyPlan}">` },
          { key: 'qtyBad', title: '不良数量', w: '100px', render: (l) => `<input class="input" type="number" value="${l.qtyBad || 0}">` },
          { key: 'batch', title: '批次号', w: '130px', render: (l) => `<input class="input" value="${esc(l.batch)}">` },
          { key: 'prodDate', title: '生产日期', w: '140px', render: (l) => `<input class="input" type="date" value="${l.prodDate}">` },
          { key: 'qc', title: '质检结论', w: '120px', render: (l) => `<select class="select">${['合格', '待检', '部分让步', '不合格'].map((o) => `<option ${o === l.qc ? 'selected' : ''}>${o}</option>`).join('')}</select>` }
        ],
        rows: lines.length ? lines : [{ i: 1, code: '—', name: '（示例单据未维护明细）', unit: '', qtyPlan: r.qtyPlan, qtyReal: 0, qtyBad: 0, batch: '', prodDate: '', qc: '待检' }]
      })}
      <div class="form-item mt14"><label>收货备注</label><textarea class="textarea" placeholder="如：外包装破损 1 件，已拍照留存"></textarea></div>`,
    footer: `<button class="btn" data-close>取消</button>
             <button class="btn" data-close data-act="toast" data-msg="已暂存，单据状态：收货中">暂存</button>
             <button class="btn primary" data-close data-act="toast" data-msg="收货完成，${no} 已流转到「待上架」">提交收货</button>`
  });
}

function rcPutawayForm(no) {
  const lines = DB.receiptLine[no] || [];
  modal({
    title: `上架确认 · ${no}`, width: 'w720',
    body: `
      <div class="note"><b>推荐库位</b>由系统按「同物料优先 → 同库区就近 → 剩余容量最大」三级规则给出，可手工改写。</div>
      ${tbl({
        cols: [
          { key: 'code', title: '物料', render: (l) => `<span class="code">${l.code}</span><span class="sub-text">${esc(l.name)}</span>` },
          { key: 'qtyReal', title: '待上架', align: 'num', render: (l) => `${fmt(l.qtyReal - l.qtyBad)} ${l.unit}` },
          { key: 'loc', title: '推荐库位', w: '170px', render: (l) => `<select class="select">${DB.location.filter((x) => x.status !== '冻结').map((x) => `<option ${x.code === l.loc ? 'selected' : ''}>${x.code}</option>`).join('')}</select>` },
          { key: 'split', title: '', w: '70px', render: () => `<button class="link-btn" data-act="toast" data-msg="已拆分为 2 个上架行">拆分</button>` }
        ],
        rows: lines.length ? lines : [{ code: '—', name: '（示例单据未维护明细）', qtyReal: 0, qtyBad: 0, unit: '', loc: '' }]
      })}`,
    footer: `<button class="btn" data-close>取消</button>
             <button class="btn primary" data-close data-act="toast" data-msg="上架完成，${no} 已完成入库，库存与流水已更新">确认上架</button>`
  });
}

function newReceiptForm() {
  modal({
    title: '新建入库单', width: 'w900',
    body: `
      <div class="section-title">表头</div>
      <div class="form-grid">
        <div class="form-item"><label>业务类型<span class="req">*</span></label>
          <select class="select">${DB.dict.bizType.map((o) => `<option>${o}</option>`).join('')}</select></div>
        <div class="form-item"><label>来源单号</label>
          <input class="input" placeholder="选择采购订单 / 生产工单">
          <span class="hint">选中后自动带出供应商与明细行</span></div>
        <div class="form-item"><label>供应商 / 来源<span class="req">*</span></label>
          <select class="select">${DB.partner.filter((p) => p.kind === '供应商').map((p) => `<option>${p.name}</option>`).join('')}</select></div>
        <div class="form-item"><label>收货仓库<span class="req">*</span></label>
          <select class="select">${DB.dict.whList.map((w) => `<option>${w.code} ${w.name}</option>`).join('')}</select></div>
        <div class="form-item"><label>预计到货日期</label><input class="input" type="date" value="2026-09-03"></div>
        <div class="form-item"><label>承运/车牌</label><input class="input" placeholder="选填"></div>
      </div>
      <div class="section-title mt14">明细行
        <button class="btn sm" style="float:right" data-act="toast" data-msg="已新增一行明细">＋ 添加物料</button>
      </div>
      ${tbl({
        cols: [
          { key: 'i', title: '#', w: '36px', align: 'center' },
          { key: 'code', title: '物料<span class="req">*</span>', render: () => `<select class="select">${DB.material.map((m) => `<option>${m.code} ${m.name}</option>`).join('')}</select>` },
          { key: 'qty', title: '应收数量', w: '110px', render: () => `<input class="input" type="number" placeholder="0">` },
          { key: 'unit', title: '单位', w: '80px', align: 'center', render: () => `<span class="muted">自动</span>` },
          { key: 'batch', title: '批次号', w: '130px', render: () => `<input class="input" placeholder="留空自动生成">` },
          { key: 'note', title: '备注', render: () => `<input class="input">` },
          { key: 'op', title: '', w: '50px', render: () => `<button class="link-btn danger" data-act="toast" data-msg="已删除该行">删除</button>` }
        ],
        rows: [{ i: 1 }, { i: 2 }]
      })}`,
    footer: `<button class="btn" data-close>取消</button>
             <button class="btn" data-close data-act="toast" data-msg="已保存为草稿">保存草稿</button>
             <button class="btn primary" data-close data-act="toast" data-msg="入库单已创建，单号 RC20260902005">保存并提交</button>`
  });
}

/* ============================== 页面：收货与上架看板 ============================== */

function viewPutaway() {
  const waiting = DB.receipt.filter((r) => r.status === '待上架');
  return pageHead({
    crumb: ['入库管理', '收货与上架'], title: '收货与上架作业台',
    desc: 'PDA/扫码作业视角：左侧扫码入口，右侧待上架队列',
    actions: `<button class="btn" data-act="toast" data-msg="已切换到 PDA 竖屏布局">PDA 视图</button>`
  }) + `<div class="grid-2">
    ${card({
      title: '扫码收货',
      body: `
        <div class="form-item"><label>扫描单号 / 托盘码<span class="req">*</span></label>
          <input class="input" placeholder="将光标停在此处，扫码枪直接扫" autofocus style="height:38px;font-size:15px"></div>
        <div class="note mt14">扫码后按单据状态自动分流：<br>
          · <b>待收货</b> → 打开收货登记<br>
          · <b>待上架</b> → 打开上架确认<br>
          · <b>已完成/已作废</b> → 提示「该单据已结束，不可操作」</div>
        <div class="row mt14">
          <button class="btn primary block" data-act="rc-receive" data-no="RC20260902001">模拟扫到 RC20260902001（待收货）</button>
        </div>
        <div class="row mt8">
          <button class="btn block" data-act="rc-putaway" data-no="RC20260901002">模拟扫到 RC20260901002（待上架）</button>
        </div>
        <div class="row mt8">
          <button class="btn block" data-act="toast" data-msg="该单据已结束，不可操作" data-kind="warn">模拟扫到已完成单据</button>
        </div>`
    })}
    ${card({
      title: '待上架队列', sub: `${waiting.length} 张 · 收货暂存区`, tight: true,
      body: tbl({
        cols: [
          { key: 'no', title: '入库单号', render: (r) => `<button class="link-btn code" data-act="rc-detail" data-no="${r.no}">${r.no}</button>` },
          { key: 'partner', title: '来源' },
          { key: 'qtyReal', title: '实收', align: 'num', render: (r) => fmt(r.qtyReal) },
          { key: 'arriveAt', title: '收货时间' },
          { key: 'op', title: '操作', render: (r) => `<button class="btn sm primary" data-act="rc-putaway" data-no="${r.no}">上架</button>` }
        ],
        rows: waiting
      })
    })}
  </div>` + card({
    title: '今日收货明细', sub: '含质检结论', tight: true,
    body: tbl({
      cols: [
        { key: 'no', title: '入库单号', render: (r) => `<span class="code">${r.no}</span>` },
        { key: 'bizType', title: '业务类型' },
        { key: 'partner', title: '来源' },
        { key: 'qtyPlan', title: '应收', align: 'num', render: (r) => fmt(r.qtyPlan) },
        { key: 'qtyReal', title: '实收', align: 'num', render: (r) => fmt(r.qtyReal) },
        { key: 'diff', title: '差异', align: 'num', render: (r) => {
          const d = r.qtyReal - r.qtyPlan;
          return d === 0 ? '<span class="muted">0</span>' : `<span style="color:var(--critical)">${fmt(d, d % 1 ? 1 : 0)}</span>`;
        } },
        { key: 'status', title: '状态', align: 'center', render: (r) => tag(r.status) }
      ],
      rows: DB.receipt.filter((r) => r.createAt.startsWith('2026-09-02'))
    })
  });
}

/* ============================== 页面：出库单管理 ============================== */

function viewOutbound(q) {
  const rows = q.status ? DB.outbound.filter((r) => r.status === q.status) : DB.outbound;
  return pageHead({
    crumb: ['出库管理', '出库单管理'], title: '出库单管理',
    desc: '单据流程：新建 → 审核 → 拣货 → 复核 → 发运 → 完成',
    actions: `<button class="btn" data-act="toast" data-msg="已批量审核所选 2 张单据">批量审核</button>
              <button class="btn primary" data-act="new-outbound">＋ 新建出库单</button>`
  }) + card({
    body: filters([
      { label: '出库单号', w: 'w180', ph: 'DO…' },
      { label: '出库类型', type: 'select', options: DB.dict.outType, w: 'w150' },
      { label: '客户/领用部门', w: 'w220' },
      { label: '发货仓库', type: 'select', options: DB.dict.whList.map((w) => `${w.code} ${w.name}`), w: 'w180' },
      { label: '单据状态', type: 'select', options: DB.dict.doStatus, w: 'w120', value: q.status },
      { label: '优先级', type: 'select', options: ['高', '中', '低'], w: 'w120' },
      { label: '需求日期', type: 'date', value: '2026-09-02', w: 'w150' }
    ])
  }) + card({
    title: '出库单列表', sub: q.status ? `已按「${q.status}」过滤` : '', tight: true,
    body: tbl({
      cols: [
        { key: 'chk', title: '<input type="checkbox" aria-label="全选">', w: '36px', align: 'center', render: () => `<input type="checkbox">` },
        { key: 'no', title: '出库单号', render: (r) => `<button class="link-btn code" data-act="do-detail" data-no="${r.no}">${r.no}</button>` },
        { key: 'outType', title: '出库类型' },
        { key: 'src', title: '来源单号', render: (r) => `<span class="code muted">${esc(r.src)}</span>` },
        { key: 'partner', title: '客户/领用部门' },
        { key: 'wh', title: '发货仓库', align: 'nowrap', render: (r) => whName(r.wh) },
        { key: 'priority', title: '优先级', align: 'center', render: (r) => tag(r.priority) },
        { key: 'qtyPlan', title: '应发', align: 'num', render: (r) => fmt(r.qtyPlan) },
        { key: 'qtyPick', title: '已拣', align: 'num', render: (r) => fmt(r.qtyPick) },
        { key: 'prog', title: '拣货进度', w: '140px', render: (r) => meter(Math.round((r.qtyPick / r.qtyPlan) * 100)) },
        { key: 'needDate', title: '需求日期' },
        { key: 'status', title: '状态', align: 'center', render: (r) => tag(r.status) },
        { key: 'op', title: '操作', render: (r) => {
          const ops = [`<button class="link-btn" data-act="do-detail" data-no="${r.no}">查看</button>`];
          if (r.status === '待审核') ops.push(`<button class="link-btn" data-act="do-approve" data-no="${r.no}">审核</button>`);
          if (r.status === '待拣货' || r.status === '拣货中') ops.push(`<a class="link-btn" href="#/outbound/pick?no=${r.no}">拣货</a>`);
          if (r.status === '待发运') ops.push(`<button class="link-btn" data-act="do-ship" data-no="${r.no}">复核发运</button>`);
          if (!['已完成', '已作废'].includes(r.status)) ops.push(`<button class="link-btn danger" data-act="do-void" data-no="${r.no}">作废</button>`);
          return `<span class="ops">${ops.join('')}</span>`;
        } }
      ],
      rows
    }) + pager(rows.length)
  });
}

const DO_STEPS = ['新建', '审核', '拣货', '复核', '发运', '完成'];

function doDetail(no) {
  const r = DB.outbound.find((x) => x.no === no);
  const lines = DB.outboundLine[no] || [{ i: 1, code: '—', name: '（示例单据未维护明细）', spec: '—', unit: '—', qtyPlan: r.qtyPlan, qtyPick: r.qtyPick, batch: '—', loc: '—', avail: 0, status: r.status }];
  const cur = { '待审核': 1, '待拣货': 2, '拣货中': 2, '待发运': 3, '已完成': 5, '已作废': 0 }[r.status];
  drawer({
    title: r.no, sub: tag(r.status),
    body: `
      ${card({ body: stepsHTML(DO_STEPS, cur) })}
      ${card({ title: '单据信息', body: `
        <dl class="dl">
          <div><dt>出库类型</dt><dd>${esc(r.outType)}</dd></div>
          <div><dt>来源单号</dt><dd class="code">${esc(r.src)}</dd></div>
          <div><dt>客户/领用部门</dt><dd>${esc(r.partner)}</dd></div>
          <div><dt>发货仓库</dt><dd>${whName(r.wh)}</dd></div>
          <div><dt>优先级</dt><dd>${tag(r.priority)}</dd></div>
          <div><dt>需求日期</dt><dd>${esc(r.needDate)}</dd></div>
          <div><dt>制单人</dt><dd>${esc(r.creator)}</dd></div>
          <div><dt>制单时间</dt><dd>${esc(r.createAt)}</dd></div>
        </dl>` })}
      ${card({ title: '出库明细', tight: true, body: tbl({
        cols: [
          { key: 'i', title: '#', w: '36px', align: 'center' },
          { key: 'code', title: '物料编码', render: (l) => `<span class="code">${esc(l.code)}</span>` },
          { key: 'name', title: '物料名称', render: (l) => `${esc(l.name)}<span class="sub-text">${esc(l.spec)}</span>` },
          { key: 'qtyPlan', title: '应发', align: 'num', render: (l) => `${fmt(l.qtyPlan)} ${esc(l.unit)}` },
          { key: 'qtyPick', title: '已拣', align: 'num', render: (l) => fmt(l.qtyPick) },
          { key: 'batch', title: '批次', render: (l) => `<span class="code">${esc(l.batch)}</span>` },
          { key: 'loc', title: '建议库位', render: (l) => `<span class="code">${esc(l.loc)}</span>` },
          { key: 'avail', title: '库位可用', align: 'num', render: (l) => fmt(l.avail) },
          { key: 'status', title: '行状态', align: 'center', render: (l) => tag(l.status) }
        ],
        rows: lines
      }) })}`,
    footer: `<button class="btn" data-close>关闭</button>
             <button class="btn" data-act="toast" data-msg="已打印 ${no} 拣货单">打印拣货单</button>
             ${r.status === '待审核' ? `<button class="btn primary" data-act="do-approve" data-no="${no}">审核通过</button>`
               : ['待拣货', '拣货中'].includes(r.status) ? `<a class="btn primary" href="#/outbound/pick?no=${no}" data-close>去拣货</a>`
               : r.status === '待发运' ? `<button class="btn primary" data-act="do-ship" data-no="${no}">复核发运</button>` : ''}`
  });
}

function viewPick(q) {
  const no = q.no || 'DO20260902002';
  const r = DB.outbound.find((x) => x.no === no) || DB.outbound[1];
  const lines = DB.outboundLine[r.no] || [];
  const done = lines.filter((l) => l.qtyPick >= l.qtyPlan).length;
  return pageHead({
    crumb: ['出库管理', '拣货作业'], title: `拣货作业 · ${r.no}`,
    desc: `${r.outType} · ${r.partner} · 需求日期 ${r.needDate}`,
    actions: `<button class="btn" data-act="toast" data-msg="已按库位路径重新排序">路径优化</button>
              <button class="btn" data-act="toast" data-msg="已打印拣货单">打印拣货单</button>
              <button class="btn primary" data-act="do-submit-pick" data-no="${r.no}">提交拣货</button>`
  }) + `
    <div class="tiles">
      ${stat({ label: '明细行数', value: String(lines.length), unit: '行' })}
      ${stat({ label: '已完成行', value: String(done), unit: '行', delta: `剩余 ${lines.length - done} 行`, dir: 'flat' })}
      ${stat({ label: '应发总量', value: fmt(r.qtyPlan), unit: '（混单位）' })}
      ${stat({ label: '拣货进度', value: `${Math.round((r.qtyPick / r.qtyPlan) * 100)}`, unit: '%', delta: r.priority === '高' ? '高优先级单据' : '', dir: 'flat' })}
    </div>
    ${card({
      title: '扫码拣货',
      body: `<div class="filters">
        <div class="filter w220"><label>扫描库位码</label><input class="input" placeholder="如 A-02-03-01"></div>
        <div class="filter w220"><label>扫描物料条码</label><input class="input" placeholder="扫码后自动匹配明细行"></div>
        <div class="filter w150"><label>本次拣货数量</label><input class="input" type="number" placeholder="0"></div>
        <div class="filter-actions">
          <button class="btn primary" data-act="toast" data-msg="已记录本次拣货，行进度已更新">确认拣入</button>
          <button class="btn" data-act="toast" data-msg="已标记缺货，将生成欠料记录" data-kind="warn">标记缺货</button>
        </div>
      </div>`
    })}
    ${card({
      title: '拣货清单', sub: '按库位路径排序', tight: true,
      body: tbl({
        cols: [
          { key: 'seq', title: '顺序', w: '50px', align: 'center', render: (l, i) => i + 1 },
          { key: 'loc', title: '库位', render: (l) => `<span class="code strong">${esc(l.loc)}</span>` },
          { key: 'code', title: '物料', render: (l) => `<span class="code">${l.code}</span><span class="sub-text">${esc(l.name)} ${esc(l.spec)}</span>` },
          { key: 'batch', title: '批次', render: (l) => `<span class="code">${esc(l.batch)}</span>` },
          { key: 'qtyPlan', title: '应拣', align: 'num', render: (l) => `${fmt(l.qtyPlan)} ${l.unit}` },
          { key: 'qtyPick', title: '已拣', w: '110px', render: (l) => `<input class="input" type="number" value="${l.qtyPick}">` },
          { key: 'avail', title: '库位可用量', align: 'num', render: (l) => l.avail < l.qtyPlan ? `<span style="color:var(--critical)">${fmt(l.avail)} ▼</span>` : fmt(l.avail) },
          { key: 'prog', title: '进度', w: '130px', render: (l) => meter(Math.round((l.qtyPick / l.qtyPlan) * 100)) },
          { key: 'status', title: '行状态', align: 'center', render: (l) => tag(l.status) },
          { key: 'op', title: '操作', render: (l) => `
              <span class="ops">
                <button class="link-btn" data-act="toast" data-msg="已换批：从 ${l.batch} 换到最近入库批次">换批</button>
                <button class="link-btn" data-act="toast" data-msg="已切换到备选库位">改库位</button>
              </span>` }
        ],
        rows: lines
      })
    })}
    <div class="note">拣货提交时的校验规则（说明书 §7.2）：<br>
      · 已拣数量 > 应拣 → 拦截，提示「超拣不允许」<br>
      · 已拣数量 &lt; 应拣 → 弹二次确认，可选「部分发货」或「等待补货」<br>
      · 某行库位可用量不足 → 该行标红并阻止提交，需先「改库位」或「标记缺货」</div>`;
}

function newOutboundForm() {
  modal({
    title: '新建出库单', width: 'w900',
    body: `
      <div class="section-title">表头</div>
      <div class="form-grid">
        <div class="form-item"><label>出库类型<span class="req">*</span></label>
          <select class="select">${DB.dict.outType.map((o) => `<option>${o}</option>`).join('')}</select></div>
        <div class="form-item"><label>来源单号</label><input class="input" placeholder="销售订单 / 生产工单"></div>
        <div class="form-item"><label>客户 / 领用部门<span class="req">*</span></label>
          <select class="select">${[...DB.partner.filter((p) => p.kind === '客户').map((p) => p.name), '装配一车间', '装配二车间', '品质部'].map((o) => `<option>${o}</option>`).join('')}</select></div>
        <div class="form-item"><label>发货仓库<span class="req">*</span></label>
          <select class="select">${DB.dict.whList.map((w) => `<option>${w.code} ${w.name}</option>`).join('')}</select></div>
        <div class="form-item"><label>需求日期<span class="req">*</span></label><input class="input" type="date" value="2026-09-05"></div>
        <div class="form-item"><label>优先级</label><select class="select"><option>中</option><option>高</option><option>低</option></select></div>
      </div>
      <div class="section-title mt14">明细行
        <button class="btn sm" style="float:right" data-act="toast" data-msg="已新增一行明细">＋ 添加物料</button>
      </div>
      ${tbl({
        cols: [
          { key: 'i', title: '#', w: '36px', align: 'center' },
          { key: 'code', title: '物料<span class="req">*</span>', render: () => `<select class="select">${DB.material.map((m) => `<option>${m.code} ${m.name}</option>`).join('')}</select>` },
          { key: 'qty', title: '应发数量', w: '110px', render: () => `<input class="input" type="number" placeholder="0">` },
          { key: 'avail', title: '当前可用', w: '100px', align: 'num', render: () => `<span class="muted">自动带出</span>` },
          { key: 'batch', title: '指定批次', w: '150px', render: () => `<select class="select"><option>系统分配（先进先出）</option><option>手工指定</option></select>` },
          { key: 'op', title: '', w: '50px', render: () => `<button class="link-btn danger" data-act="toast" data-msg="已删除该行">删除</button>` }
        ],
        rows: [{ i: 1 }, { i: 2 }]
      })}
      <div class="note mt14">保存时校验：可用库存不足的行会标红并提示「可用 X，缺口 Y」，可选择「按可用量下推」或「保留缺口待补货」。</div>`,
    footer: `<button class="btn" data-close>取消</button>
             <button class="btn" data-close data-act="toast" data-msg="已保存为草稿">保存草稿</button>
             <button class="btn primary" data-close data-act="toast" data-msg="出库单已创建，单号 DO20260902007，状态：待审核">保存并提交</button>`
  });
}

/* ============================== 页面：库存查询 ============================== */

function viewStock(q) {
  const rows = q.alert === 'low'
    ? DB.stock.filter((s) => { const m = DB.material.find((m) => m.code === s.code); return m && s.onHand < m.safeMin; })
    : DB.stock;
  const totalAmt = rows.reduce((s, r) => s + r.amount, 0);
  return pageHead({
    crumb: ['库存管理', '库存查询'], title: '库存查询',
    desc: '库存粒度：物料 + 批次 + 库位。可用量 = 现存量 − 锁定量',
    actions: `<button class="btn" data-act="toast" data-msg="已导出库存明细 Excel">导出</button>
              <button class="btn" data-act="stock-freeze">冻结库存</button>
              <button class="btn primary" data-act="toast" data-msg="已跳转到新建移库单">发起移库</button>`
  }) + `<div class="tiles">
      ${stat({ label: '库存记录数', value: fmt(rows.length), unit: '条' })}
      ${stat({ label: '涉及物料', value: String(new Set(rows.map((r) => r.code)).size), unit: '项' })}
      ${stat({ label: '库存总金额', value: fmt(totalAmt / 10000, 1), unit: '万元' })}
      ${stat({ label: '锁定金额占比', value: '18.4', unit: '%', delta: '销售订单占用为主', dir: 'flat' })}
    </div>` + card({
    body: filters([
      { label: '物料编码/名称', w: 'w220' },
      { label: '仓库', type: 'select', options: DB.dict.whList.map((w) => `${w.code} ${w.name}`), w: 'w180' },
      { label: '库位', w: 'w150', ph: '如 A-02' },
      { label: '批次号', w: 'w150' },
      { label: '物料分类', type: 'select', options: DB.dict.matType, w: 'w120' },
      { label: '库龄区间', type: 'select', options: DB.ageDist.map((a) => a.bucket), w: 'w150' }
    ], `<button class="btn" data-act="toast" data-msg="已切换为「按物料汇总」视图">按物料汇总</button>`)
  }) + card({
    title: '库存明细', sub: q.alert === 'low' ? '已按「低于安全库存」过滤' : '点击行查看批次流水', tight: true,
    body: tbl({
      cols: [
        { key: 'code', title: '物料编码', render: (r) => `<span class="code">${r.code}</span>` },
        { key: 'name', title: '物料名称', render: (r) => `${esc(r.name)}<span class="sub-text">${esc(r.spec)}</span>` },
        { key: 'wh', title: '仓库', align: 'nowrap', render: (r) => whName(r.wh) },
        { key: 'loc', title: '库位', render: (r) => `<span class="code">${r.loc}</span>` },
        { key: 'batch', title: '批次', render: (r) => `<span class="code">${esc(r.batch)}</span>` },
        { key: 'inDate', title: '入库日期' },
        { key: 'age', title: '库龄', align: 'num', render: (r) => r.age > 90 ? `<span style="color:var(--critical)">${r.age} 天</span>` : `${r.age} 天` },
        { key: 'onHand', title: '现存量', align: 'num', render: (r) => `${fmt(r.onHand, r.onHand % 1 ? 1 : 0)} ${r.unit}` },
        { key: 'locked', title: '锁定量', align: 'num', render: (r) => fmt(r.locked) },
        { key: 'avail', title: '可用量', align: 'num', render: (r) => `<b>${fmt(r.avail, r.avail % 1 ? 1 : 0)}</b>` },
        { key: 'amount', title: '库存金额', align: 'num', render: (r) => `¥ ${fmt(r.amount)}` },
        { key: 'op', title: '操作', render: (r) => `
            <span class="ops">
              <button class="link-btn" data-act="stock-detail" data-code="${r.code}" data-batch="${esc(r.batch)}">流水</button>
              <button class="link-btn" data-act="toast" data-msg="已冻结 ${r.code} / ${r.loc}">冻结</button>
            </span>` }
      ],
      rows,
      foot: [
        { html: '合计' }, { html: '' }, { html: '' }, { html: '' }, { html: '' }, { html: '' }, { html: '' },
        { html: '', align: 'num' }, { html: '', align: 'num' }, { html: '', align: 'num' },
        { html: `¥ ${fmt(totalAmt)}`, align: 'num' }, { html: '' }
      ]
    }) + pager(rows.length)
  });
}

function stockDetail(code, batch) {
  const rows = DB.ledger.filter((l) => l.code === code);
  const m = DB.material.find((x) => x.code === code) || {};
  drawer({
    title: `${code} ${m.name || ''}`, sub: `批次 ${batch}`,
    body: `
      ${card({ title: '库存概览', body: `
        <dl class="dl">
          <div><dt>规格型号</dt><dd>${esc(m.spec || '—')}</dd></div>
          <div><dt>基本单位</dt><dd>${esc(m.unit || '—')}</dd></div>
          <div><dt>现存量</dt><dd class="strong">${fmt(m.onHand, m.unit === '吨' ? 1 : 0)}</dd></div>
          <div><dt>锁定量</dt><dd>${fmt(m.locked)}</dd></div>
          <div><dt>可用量</dt><dd class="strong">${fmt((m.onHand || 0) - (m.locked || 0), m.unit === '吨' ? 1 : 0)}</dd></div>
          <div><dt>安全库存</dt><dd>${fmt(m.safeMin)} ~ ${fmt(m.safeMax)}</dd></div>
          <div><dt>批次管控</dt><dd>${esc(m.batchCtl || '—')}</dd></div>
          <div><dt>参考单价</dt><dd>¥ ${fmt(m.price, 2)}</dd></div>
        </dl>` })}
      ${card({ title: '分库位分布', tight: true, body: tbl({
        cols: [
          { key: 'wh', title: '仓库', align: 'nowrap', render: (r) => whName(r.wh) },
          { key: 'loc', title: '库位', render: (r) => `<span class="code">${r.loc}</span>` },
          { key: 'batch', title: '批次', render: (r) => `<span class="code">${esc(r.batch)}</span>` },
          { key: 'onHand', title: '现存量', align: 'num', render: (r) => fmt(r.onHand, r.onHand % 1 ? 1 : 0) },
          { key: 'avail', title: '可用量', align: 'num', render: (r) => fmt(r.avail, r.avail % 1 ? 1 : 0) },
          { key: 'age', title: '库龄', align: 'num', render: (r) => `${r.age} 天` }
        ],
        rows: DB.stock.filter((s) => s.code === code)
      }) })}
      ${card({ title: '库存流水', sub: `${rows.length} 条`, tight: true, body: tbl({
        cols: [
          { key: 'time', title: '时间' },
          { key: 'biz', title: '业务类型' },
          { key: 'no', title: '单号', render: (r) => `<span class="code">${r.no}</span>` },
          { key: 'loc', title: '库位', render: (r) => `<span class="code">${r.loc}</span>` },
          { key: 'qty', title: '变动', align: 'num', render: (r) => `<span style="color:${r.qty > 0 ? '#006300' : 'var(--critical)'}">${r.qty > 0 ? '+' : ''}${fmt(r.qty, r.qty % 1 ? 1 : 0)}</span>` },
          { key: 'after', title: '结存', align: 'num', render: (r) => fmt(r.after, r.after % 1 ? 1 : 0) },
          { key: 'op', title: '操作人' }
        ],
        rows
      }) })}`
  });
}

/* ============================== 页面：库存流水 ============================== */

function viewLedger() {
  return pageHead({
    crumb: ['库存管理', '库存流水'], title: '库存流水',
    desc: '所有库存变动的唯一台账，只增不改。用于与财务对账、追溯批次去向',
    actions: `<button class="btn" data-act="toast" data-msg="已导出流水 Excel">导出</button>`
  }) + card({
    body: filters([
      { label: '单号', w: 'w180' },
      { label: '物料编码/名称', w: 'w220' },
      { label: '业务类型', type: 'select', options: ['采购入库', '生产入库', '退货入库', '调拨入库', '销售出库', '生产领料', '报废出库', '库内移库', '盘盈入库', '盘亏出库'], w: 'w150' },
      { label: '出入方向', type: 'select', options: ['入', '出', '转'], w: 'w120' },
      { label: '仓库', type: 'select', options: DB.dict.whList.map((w) => `${w.code} ${w.name}`), w: 'w180' },
      { label: '批次号', w: 'w150' },
      { label: '开始时间', type: 'date', value: '2026-08-26', w: 'w150' },
      { label: '结束时间', type: 'date', value: '2026-09-02', w: 'w150' }
    ])
  }) + card({
    title: '流水明细', sub: `共 ${DB.ledger.length} 条`, tight: true,
    body: tbl({
      cols: [
        { key: 'time', title: '发生时间', w: '150px' },
        { key: 'no', title: '来源单号', render: (r) => `<span class="code">${r.no}</span>` },
        { key: 'biz', title: '业务类型' },
        { key: 'dir', title: '方向', align: 'center', render: (r) => `<span class="tag ${r.dir === '入' ? 'good' : r.dir === '出' ? 'critical' : 'info'}">${r.dir === '入' ? '↓' : r.dir === '出' ? '↑' : '⇄'}${r.dir}</span>` },
        { key: 'code', title: '物料', render: (r) => `<span class="code">${r.code}</span><span class="sub-text">${esc(r.name)}</span>` },
        { key: 'batch', title: '批次', render: (r) => `<span class="code">${esc(r.batch)}</span>` },
        { key: 'wh', title: '仓库/库位', render: (r) => `${r.wh}<span class="sub-text code">${r.loc}</span>` },
        { key: 'before', title: '变动前', align: 'num', render: (r) => fmt(r.before, r.before % 1 ? 1 : 0) },
        { key: 'qty', title: '变动量', align: 'num', render: (r) => `<span style="color:${r.qty > 0 ? '#006300' : 'var(--critical)'}">${r.qty > 0 ? '+' : ''}${fmt(r.qty, r.qty % 1 ? 1 : 0)}</span>` },
        { key: 'after', title: '变动后', align: 'num', render: (r) => `<b>${fmt(r.after, r.after % 1 ? 1 : 0)}</b>` },
        { key: 'op', title: '操作人' }
      ],
      rows: DB.ledger
    }) + pager(DB.ledger.length)
  });
}

/* ============================== 页面：移库与调拨 ============================== */

function viewTransfer() {
  return pageHead({
    crumb: ['库内作业', '移库与调拨'], title: '移库与调拨',
    desc: '库内移库不改变库存总量，只改库位；跨仓调拨生成一出一入两条流水',
    actions: `<button class="btn primary" data-act="new-transfer">＋ 新建移库单</button>`
  }) + card({
    body: filters([
      { label: '单号', w: 'w180', ph: 'TR…' },
      { label: '类型', type: 'select', options: ['库内移库', '跨仓调拨'], w: 'w150' },
      { label: '调出仓库', type: 'select', options: DB.dict.whList.map((w) => `${w.code} ${w.name}`), w: 'w180' },
      { label: '调入仓库', type: 'select', options: DB.dict.whList.map((w) => `${w.code} ${w.name}`), w: 'w180' },
      { label: '状态', type: 'select', options: ['待执行', '执行中', '已完成', '已作废'], w: 'w120' }
    ])
  }) + card({
    title: '移库单列表', tight: true,
    body: tbl({
      cols: [
        { key: 'no', title: '单号', render: (r) => `<span class="code">${r.no}</span>` },
        { key: 'kind', title: '类型', render: (r) => `<span class="tag ${r.kind === '跨仓调拨' ? 'info' : ''}">${r.kind}</span>` },
        { key: 'fromWh', title: '调出仓库', render: (r) => whName(r.fromWh) },
        { key: 'toWh', title: '调入仓库', render: (r) => whName(r.toWh) },
        { key: 'lines', title: '行数', align: 'num' },
        { key: 'qty', title: '数量', align: 'num', render: (r) => fmt(r.qty) },
        { key: 'reason', title: '移库原因' },
        { key: 'status', title: '状态', align: 'center', render: (r) => tag(r.status) },
        { key: 'creator', title: '制单人', render: (r) => `${esc(r.creator)}<span class="sub-text">${esc(r.createAt)}</span>` },
        { key: 'op', title: '操作', render: (r) => `
            <span class="ops">
              <button class="link-btn" data-act="toast" data-msg="打开 ${r.no} 详情">查看</button>
              ${r.status === '待执行' ? `<button class="link-btn" data-act="toast" data-msg="${r.no} 已开始执行">执行</button>` : ''}
              ${r.status === '执行中' ? `<button class="link-btn" data-act="toast" data-msg="${r.no} 已完成，库存已过账">完成</button>` : ''}
              ${['待执行', '执行中'].includes(r.status) ? `<button class="link-btn danger" data-act="toast" data-msg="${r.no} 已作废">作废</button>` : ''}
            </span>` }
      ],
      rows: DB.transfer
    }) + pager(DB.transfer.length)
  });
}

function newTransferForm() {
  modal({
    title: '新建移库单', width: 'w900',
    body: `
      <div class="form-grid">
        <div class="form-item"><label>移库类型<span class="req">*</span></label>
          <select class="select"><option>库内移库</option><option>跨仓调拨</option></select></div>
        <div class="form-item"><label>调出仓库<span class="req">*</span></label>
          <select class="select">${DB.dict.whList.map((w) => `<option>${w.code} ${w.name}</option>`).join('')}</select></div>
        <div class="form-item"><label>调入仓库<span class="req">*</span></label>
          <select class="select">${DB.dict.whList.map((w) => `<option>${w.code} ${w.name}</option>`).join('')}</select></div>
        <div class="form-item"><label>移库原因<span class="req">*</span></label>
          <select class="select"><option>库位整理</option><option>生产急用</option><option>退货隔离</option><option>货位合并</option><option>临期前置</option></select></div>
        <div class="form-item span-2"><label>备注</label><input class="input"></div>
      </div>
      <div class="section-title mt14">移库明细
        <button class="btn sm" style="float:right" data-act="toast" data-msg="已从库存查询选入 1 行">＋ 从库存选择</button>
      </div>
      ${tbl({
        cols: [
          { key: 'code', title: '物料', render: (r) => `<span class="code">${r.code}</span><span class="sub-text">${esc(r.name)}</span>` },
          { key: 'batch', title: '批次', render: (r) => `<span class="code">${esc(r.batch)}</span>` },
          { key: 'from', title: '源库位', render: (r) => `<span class="code">${r.loc}</span>` },
          { key: 'avail', title: '可移数量', align: 'num', render: (r) => fmt(r.avail, r.avail % 1 ? 1 : 0) },
          { key: 'qty', title: '移库数量', w: '110px', render: (r) => `<input class="input" type="number" value="${r.avail}">` },
          { key: 'to', title: '目标库位<span class="req">*</span>', w: '160px', render: () => `<select class="select">${DB.location.filter((l) => l.status !== '冻结').map((l) => `<option>${l.code}</option>`).join('')}</select>` }
        ],
        rows: DB.stock.slice(0, 2)
      })}`,
    footer: `<button class="btn" data-close>取消</button>
             <button class="btn primary" data-close data-act="toast" data-msg="移库单已创建，单号 TR20260902003">保存并提交</button>`
  });
}

/* ============================== 页面：盘点 ============================== */

function viewStocktake() {
  return pageHead({
    crumb: ['库内作业', '库存盘点'], title: '库存盘点',
    desc: '流程：创建盘点单 → 冻结盘点范围 → 录入实盘 → 差异复盘 → 审核过账',
    actions: `<button class="btn primary" data-act="new-stocktake">＋ 新建盘点单</button>`
  }) + card({
    body: filters([
      { label: '盘点单号', w: 'w180', ph: 'PD…' },
      { label: '盘点方式', type: 'select', options: ['全盘', '抽盘', '循环盘点', '动碰盘点'], w: 'w150' },
      { label: '仓库', type: 'select', options: DB.dict.whList.map((w) => `${w.code} ${w.name}`), w: 'w180' },
      { label: '状态', type: 'select', options: ['盘点中', '待审核', '已完成', '已作废'], w: 'w120' },
      { label: '计划日期', type: 'date', value: '2026-09-02', w: 'w150' }
    ])
  }) + card({
    title: '盘点单列表', tight: true,
    body: tbl({
      cols: [
        { key: 'no', title: '盘点单号', render: (r) => `<button class="link-btn code" data-act="pd-detail" data-no="${r.no}">${r.no}</button>` },
        { key: 'kind', title: '盘点方式' },
        { key: 'wh', title: '仓库', align: 'nowrap', render: (r) => whName(r.wh) },
        { key: 'scope', title: '盘点范围' },
        { key: 'planLines', title: '计划行数', align: 'num' },
        { key: 'doneLines', title: '已盘行数', align: 'num' },
        { key: 'prog', title: '盘点进度', w: '140px', render: (r) => meter(Math.round((r.doneLines / r.planLines) * 100)) },
        { key: 'diffLines', title: '差异行数', align: 'num', render: (r) => r.diffLines ? `<span style="color:var(--critical)">${r.diffLines}</span>` : '0' },
        { key: 'status', title: '状态', align: 'center', render: (r) => tag(r.status) },
        { key: 'owner', title: '负责人' },
        { key: 'planDate', title: '计划日期' },
        { key: 'op', title: '操作', render: (r) => `
            <span class="ops">
              <button class="link-btn" data-act="pd-detail" data-no="${r.no}">${r.status === '盘点中' ? '录入' : '查看'}</button>
              ${r.status === '待审核' ? `<button class="link-btn" data-act="pd-approve" data-no="${r.no}">差异审核</button>` : ''}
            </span>` }
      ],
      rows: DB.stocktake
    }) + pager(DB.stocktake.length)
  });
}

function pdDetail(no) {
  const p = DB.stocktake.find((x) => x.no === no);
  const lines = DB.stocktakeLine[no] || [];
  const editable = p.status === '盘点中';
  drawer({
    title: p.no, sub: tag(p.status),
    body: `
      ${card({ title: '盘点信息', body: `
        <dl class="dl">
          <div><dt>盘点方式</dt><dd>${esc(p.kind)}</dd></div>
          <div><dt>仓库</dt><dd>${whName(p.wh)}</dd></div>
          <div><dt>盘点范围</dt><dd>${esc(p.scope)}</dd></div>
          <div><dt>负责人</dt><dd>${esc(p.owner)}</dd></div>
          <div><dt>计划日期</dt><dd>${esc(p.planDate)}</dd></div>
          <div><dt>完成日期</dt><dd>${esc(p.finishDate) || '<span class="muted">—</span>'}</dd></div>
          <div><dt>计划/已盘</dt><dd>${p.planLines} / ${p.doneLines}</dd></div>
          <div><dt>差异行数</dt><dd class="strong" style="color:${p.diffLines ? 'var(--critical)' : 'inherit'}">${p.diffLines}</dd></div>
        </dl>` })}
      ${lines.length ? card({
        title: '盘点明细', sub: editable ? '盲盘模式：录入前不显示账面数' : '', tight: true,
        right: editable ? `<button class="btn sm" data-act="toast" data-msg="已切换为明盘模式（显示账面数）">切换明盘</button>` : '',
        body: tbl({
          cols: [
            { key: 'i', title: '#', w: '36px', align: 'center' },
            { key: 'code', title: '物料', render: (l) => `<span class="code">${l.code}</span><span class="sub-text">${esc(l.name)} ${esc(l.spec)}</span>` },
            { key: 'loc', title: '库位', render: (l) => `<span class="code">${l.loc}</span>` },
            { key: 'batch', title: '批次', render: (l) => `<span class="code">${esc(l.batch)}</span>` },
            { key: 'sysQty', title: '账面数', align: 'num', render: (l) => fmt(l.sysQty) },
            { key: 'realQty', title: '实盘数', w: '110px', align: 'num',
              render: (l) => editable ? `<input class="input" type="number" value="${l.realQty ?? ''}" placeholder="待录入">` : fmt(l.realQty) },
            { key: 'diff', title: '差异', align: 'num', render: (l) => l.diff === null ? '<span class="muted">—</span>'
              : l.diff === 0 ? '0' : `<span style="color:${l.diff > 0 ? '#8a5e00' : 'var(--critical)'}">${l.diff > 0 ? '+' : ''}${fmt(l.diff)}</span>` },
            { key: 'result', title: '结论', align: 'center', render: (l) => tag(l.result) },
            { key: 'op', title: '操作', render: (l) => l.diff ? `<button class="link-btn" data-act="toast" data-msg="已标记复盘：${l.code}">复盘</button>` : '<span class="muted">—</span>' }
          ],
          rows: lines
        })
      }) : `<div class="card"><div class="empty"><div class="big">▤</div><p>该盘点单为示例数据，未维护明细行</p></div></div>`}
      ${p.diffLines ? `<div class="note"><b>差异过账规则</b>：审核通过后，盘盈生成「盘盈入库」流水，盘亏生成「盘亏出库」流水，
        单据号沿用盘点单号；差异金额推送财务做存货损溢处理。</div>` : ''}`,
    footer: `<button class="btn" data-close>关闭</button>
             ${editable ? `<button class="btn" data-close data-act="toast" data-msg="已暂存实盘数据">暂存</button>
               <button class="btn primary" data-close data-act="toast" data-msg="${no} 已提交，状态：待审核">提交盘点</button>`
               : p.status === '待审核' ? `<button class="btn primary" data-act="pd-approve" data-no="${no}">差异审核</button>` : ''}`
  });
}

function newStocktakeForm() {
  modal({
    title: '新建盘点单',
    body: `
      <div class="form-grid cols-2">
        <div class="form-item"><label>盘点方式<span class="req">*</span></label>
          <select class="select"><option>循环盘点</option><option>全盘</option><option>抽盘</option><option>动碰盘点</option></select></div>
        <div class="form-item"><label>仓库<span class="req">*</span></label>
          <select class="select">${DB.dict.whList.map((w) => `<option>${w.code} ${w.name}</option>`).join('')}</select></div>
        <div class="form-item"><label>盘点范围</label>
          <select class="select"><option>全仓</option>${[...new Set(DB.location.map((l) => l.zone))].map((z) => `<option>${z}</option>`).join('')}</select></div>
        <div class="form-item"><label>物料分类</label>
          <select class="select"><option>全部</option>${DB.dict.matType.map((t) => `<option>${t}</option>`).join('')}</select></div>
        <div class="form-item"><label>计划日期<span class="req">*</span></label><input class="input" type="date" value="2026-09-03"></div>
        <div class="form-item"><label>负责人<span class="req">*</span></label>
          <select class="select">${DB.user.filter((u) => u.status === '启用').map((u) => `<option>${u.name}</option>`).join('')}</select></div>
        <div class="form-item span-2"><label>盘点模式</label>
          <select class="select"><option>盲盘（录入前不显示账面数）</option><option>明盘（显示账面数）</option></select>
          <span class="hint">盲盘更能反映真实差异，建议默认。</span></div>
      </div>
      <div class="note mt14">生成盘点单时会<b>冻结范围内库位</b>：期间该库位不可拣货、不可上架，直到盘点单审核完成或作废。</div>`,
    footer: `<button class="btn" data-close>取消</button>
             <button class="btn primary" data-close data-act="toast" data-msg="盘点单已生成，单号 PD20260902002，范围内 18 个库位已冻结">生成盘点单</button>`
  });
}

/* ============================== 页面：出入库汇总 ============================== */

function viewReportSummary() {
  const t = DB.trend;
  const inTotal = t.series[0].values.reduce((a, b) => a + b, 0);
  const outTotal = t.series[1].values.reduce((a, b) => a + b, 0);
  return pageHead({
    crumb: ['报表分析', '出入库汇总'], title: '出入库汇总',
    desc: '统计口径：按过账时间、按物料分类汇总金额，单位 万元',
    actions: `<button class="btn" data-act="toast" data-msg="已导出报表">导出</button>
              <button class="btn" data-act="toast" data-msg="已加入我的常用报表">收藏</button>`
  }) + card({
    body: filters([
      { label: '统计开始月份', type: 'date', value: '2025-10-01', w: 'w150' },
      { label: '统计结束月份', type: 'date', value: '2026-09-01', w: 'w150' },
      { label: '仓库', type: 'select', options: DB.dict.whList.map((w) => `${w.code} ${w.name}`), w: 'w180' },
      { label: '物料分类', type: 'select', options: DB.dict.matType, w: 'w150' },
      { label: '汇总维度', type: 'select', options: ['按月', '按物料分类', '按仓库', '按供应商'], w: 'w150' }
    ])
  }) + `<div class="tiles">
      ${stat({ label: '累计入库金额', value: fmt(inTotal), unit: '万元', delta: '同比 +12.4%', dir: 'up' })}
      ${stat({ label: '累计出库金额', value: fmt(outTotal), unit: '万元', delta: '同比 +14.1%', dir: 'up' })}
      ${stat({ label: '期末库存金额', value: '853.4', unit: '万元', delta: '较期初 +3.6%', dir: 'up' })}
      ${stat({ label: '库存周转次数', value: '2.6', unit: '次/年', delta: '行业均值 3.0', dir: 'down' })}
    </div>` + card({
    title: '出入库金额趋势', sub: '近 12 个月 · 单位 万元 · 2026-09 为进行中月份',
    right: `${legend(t.series.map((s) => s.name))}
            <div class="view-toggle">
              <button class="on" data-act="chart-view" data-v="chart" data-host="rep">图表</button>
              <button data-act="chart-view" data-v="table" data-host="rep">表格</button>
            </div>`,
    body: `<div class="chart-box" id="chart-rep" style="min-height:260px"></div>
           <div id="table-rep" style="display:none"></div>`
  }) + card({
    title: '按物料分类汇总', tight: true,
    body: tbl({
      cols: [
        { key: 'cat', title: '物料分类' },
        { key: 'inAmt', title: '入库金额（万元）', align: 'num', render: (r) => fmt(r.inAmt, 1) },
        { key: 'outAmt', title: '出库金额（万元）', align: 'num', render: (r) => fmt(r.outAmt, 1) },
        { key: 'endAmt', title: '期末库存（万元）', align: 'num', render: (r) => fmt(r.endAmt, 1) },
        { key: 'net', title: '净变动（万元）', align: 'num', render: (r) => {
          const d = r.inAmt - r.outAmt;
          return `<span style="color:${d >= 0 ? '#006300' : 'var(--critical)'}">${d >= 0 ? '+' : ''}${fmt(d, 1)}</span>`;
        } },
        { key: 'turnover', title: '周转次数', align: 'num', render: (r) => fmt(r.turnover, 1) }
      ],
      rows: DB.summaryByCat,
      foot: [
        { html: '合计' },
        { html: fmt(DB.summaryByCat.reduce((s, r) => s + r.inAmt, 0), 1), align: 'num' },
        { html: fmt(DB.summaryByCat.reduce((s, r) => s + r.outAmt, 0), 1), align: 'num' },
        { html: fmt(DB.summaryByCat.reduce((s, r) => s + r.endAmt, 0), 1), align: 'num' },
        { html: '', align: 'num' }, { html: '', align: 'num' }
      ]
    })
  });
}

function afterReportSummary() {
  const host = $('#chart-rep');
  if (host) lineChart(host, { ...DB.trend, unit: '万元' });
  $('#table-rep').innerHTML = tbl({
    cols: [
      { key: 'm', title: '月份' },
      { key: 'i', title: '入库金额（万元）', align: 'num' },
      { key: 'o', title: '出库金额（万元）', align: 'num' },
      { key: 'd', title: '净值（万元）', align: 'num' }
    ],
    rows: DB.trend.labels.map((m, i) => ({
      m, i: fmt(DB.trend.series[0].values[i]), o: fmt(DB.trend.series[1].values[i]),
      d: fmt(DB.trend.series[0].values[i] - DB.trend.series[1].values[i])
    }))
  });
}

/* ============================== 页面：库龄与呆滞料 ============================== */

function viewReportAge() {
  return pageHead({
    crumb: ['报表分析', '库龄与呆滞料'], title: '库龄与呆滞料分析',
    desc: '库龄 = 统计日 − 批次入库日；呆滞判定 = 最后出库日距今 > 60 天',
    actions: `<button class="btn" data-act="toast" data-msg="已导出报表">导出</button>`
  }) + card({
    body: filters([
      { label: '仓库', type: 'select', options: DB.dict.whList.map((w) => `${w.code} ${w.name}`), w: 'w180' },
      { label: '物料分类', type: 'select', options: DB.dict.matType, w: 'w150' },
      { label: '呆滞天数阈值', type: 'select', options: ['30 天', '60 天', '90 天', '180 天'], w: 'w150' },
      { label: '统计基准日', type: 'date', value: '2026-09-02', w: 'w150' }
    ])
  }) + `<div class="grid-2">
    ${card({
      title: '库龄分布', sub: '按库存金额 · 单位 万元',
      right: `<div class="view-toggle">
                <button class="on" data-act="chart-view" data-v="chart" data-host="age">图表</button>
                <button data-act="chart-view" data-v="table" data-host="age">表格</button>
              </div>`,
      body: `<div class="chart-box" id="chart-age" style="min-height:250px"></div>
             <div id="table-age" style="display:none"></div>`
    })}
    ${card({
      title: '库龄结构解读', body: `
        <dl class="dl cols-3">
          <div><dt>90 天以上库存金额</dt><dd class="strong" style="font-size:18px">1.9 <small class="muted">万元</small></dd></div>
          <div><dt>占库存总额</dt><dd class="strong" style="font-size:18px">1.7 <small class="muted">%</small></dd></div>
          <div><dt>平均库龄</dt><dd class="strong" style="font-size:18px">27 <small class="muted">天</small></dd></div>
        </dl>
        <div class="note mt14">
          · <b>0-30 天</b>占比 71%，说明主流物料周转正常；<br>
          · <b>91 天以上</b>集中在辅料与包装物（M-4001、M-4003），单价低但占库位；<br>
          · 建议动作：对 90 天以上物料按「调拨 → 折价 → 报废」三级处理，并复核安全库存下限是否偏高。
        </div>`
    })}
  </div>` + card({
    title: '呆滞料清单', sub: '最后出库日距今 > 60 天', tight: true,
    right: `<button class="btn sm" data-act="toast" data-msg="已推送 4 项呆滞料处理建议给采购与计划">推送处理建议</button>`,
    body: tbl({
      cols: [
        { key: 'code', title: '物料编码', render: (r) => `<span class="code">${r.code}</span>` },
        { key: 'name', title: '物料名称', render: (r) => `${esc(r.name)}<span class="sub-text">${esc(r.spec)}</span>` },
        { key: 'onHand', title: '现存量', align: 'num', render: (r) => `${fmt(r.onHand)} ${r.unit}` },
        { key: 'amount', title: '库存金额', align: 'num', render: (r) => `¥ ${fmt(r.amount)}` },
        { key: 'lastOut', title: '最后出库日' },
        { key: 'days', title: '呆滞天数', align: 'num', render: (r) => `<span style="color:${r.days > 90 ? 'var(--critical)' : '#8a5e00'}">${r.days}</span>` },
        { key: 'suggest', title: '处理建议', render: (r) => tag(r.suggest, 'info') },
        { key: 'op', title: '操作', render: (r) => `
            <span class="ops">
              <button class="link-btn" data-act="stock-detail" data-code="${r.code}" data-batch="—">查看库存</button>
              <button class="link-btn" data-act="toast" data-msg="已创建 ${r.code} 的处理任务">创建处理任务</button>
            </span>` }
      ],
      rows: DB.slowMove,
      foot: [
        { html: '合计' }, { html: '' }, { html: '', align: 'num' },
        { html: `¥ ${fmt(DB.slowMove.reduce((s, r) => s + r.amount, 0))}`, align: 'num' },
        { html: '' }, { html: '', align: 'num' }, { html: '' }, { html: '' }
      ]
    })
  });
}

function afterReportAge() {
  const host = $('#chart-age');
  if (host) barChart(host, { rows: DB.ageDist, xKey: 'bucket', yKey: 'amount', unit: '万元', label: '库龄分布（按库存金额，万元）' });
  $('#table-age').innerHTML = tbl({
    cols: [
      { key: 'bucket', title: '库龄区间' },
      { key: 'amount', title: '库存金额（万元）', align: 'num', render: (r) => fmt(r.amount, 1) },
      { key: 'skuCount', title: '涉及物料（项）', align: 'num' }
    ],
    rows: DB.ageDist
  });
}

/* ============================== 页面：系统管理 ============================== */

function viewUser() {
  return pageHead({
    crumb: ['系统管理', '用户管理'], title: '用户管理',
    desc: '用户的数据权限由「角色」+「可见仓库范围」两层控制',
    actions: `<button class="btn primary" data-act="toast" data-msg="新增用户表单（原型示意）">＋ 新增用户</button>`
  }) + card({
    body: filters([
      { label: '账号/姓名', w: 'w220' },
      { label: '部门', type: 'select', options: ['仓储部', '销售部', '品质部', '财务部'], w: 'w150' },
      { label: '角色', type: 'select', options: DB.role.map((r) => r.name), w: 'w150' },
      { label: '状态', type: 'select', options: ['启用', '停用'], w: 'w120' }
    ])
  }) + card({
    title: '用户列表', tight: true,
    body: tbl({
      cols: [
        { key: 'account', title: '登录账号', render: (r) => `<span class="code">${r.account}</span>` },
        { key: 'name', title: '姓名' },
        { key: 'dept', title: '部门' },
        { key: 'role', title: '角色', render: (r) => tag(r.role, 'info') },
        { key: 'whScope', title: '可见仓库' },
        { key: 'phone', title: '联系电话' },
        { key: 'status', title: '状态', align: 'center', render: (r) => tag(r.status) },
        { key: 'lastLogin', title: '最近登录' },
        { key: 'op', title: '操作', render: (r) => `
            <span class="ops">
              <button class="link-btn" data-act="toast" data-msg="打开 ${r.name} 编辑表单">编辑</button>
              <button class="link-btn" data-act="toast" data-msg="已重置密码，初始密码已短信发送">重置密码</button>
              <button class="link-btn ${r.status === '启用' ? 'danger' : ''}" data-act="toast" data-msg="已${r.status === '启用' ? '停用' : '启用'} ${r.account}">${r.status === '启用' ? '停用' : '启用'}</button>
            </span>` }
      ],
      rows: DB.user
    }) + pager(DB.user.length)
  });
}

function viewRole() {
  return pageHead({
    crumb: ['系统管理', '角色与权限'], title: '角色与权限',
    desc: '权限粒度到「菜单 + 操作按钮」；数据权限单独按仓库范围控制',
    actions: `<button class="btn primary" data-act="toast" data-msg="新增角色表单（原型示意）">＋ 新增角色</button>`
  }) + card({
    title: '角色列表', tight: true,
    body: tbl({
      cols: [
        { key: 'code', title: '角色编码', render: (r) => `<span class="code">${r.code}</span>` },
        { key: 'name', title: '角色名称' },
        { key: 'users', title: '关联用户', align: 'num', render: (r) => `${r.users} 人` },
        { key: 'desc', title: '权限说明' },
        { key: 'op', title: '操作', render: (r) => `
            <span class="ops">
              <button class="link-btn" data-act="perm" data-code="${r.code}">配置权限</button>
              <button class="link-btn" data-act="toast" data-msg="打开 ${r.name} 的成员列表">成员</button>
              <button class="link-btn danger" data-act="toast" data-msg="该角色已关联用户，不可删除" data-kind="warn">删除</button>
            </span>` }
      ],
      rows: DB.role
    })
  }) + card({
    title: '权限矩阵速览', sub: '✓ 有权限 · — 无权限', tight: true,
    body: tbl({
      cols: [
        { key: 'm', title: '菜单模块', w: '140px' },
        ...DB.role.map((r) => ({
          key: r.code, title: r.name, align: 'center',
          render: (row) => {
            const full = ['R01', 'R02'].includes(r.code);
            const read = row.m === '工作台' || (r.code === 'R06' && ['库存管理', '报表分析'].includes(row.m));
            const own = { R03: ['入库管理', '库存管理'], R04: ['出库管理', '库内作业', '库存管理'], R05: ['入库管理', '出库管理'] }[r.code] || [];
            return full || read || own.includes(row.m)
              ? `<span style="color:#0a7c0a" aria-label="有权限">✓</span>`
              : `<span class="muted" aria-label="无权限">—</span>`;
          }
        }))
      ],
      rows: DB.permTree
    })
  });
}

function permForm(code) {
  const r = DB.role.find((x) => x.code === code);
  modal({
    title: `配置权限 · ${r.name}`, width: 'w720',
    body: `
      <div class="note">勾选到<b>操作按钮</b>粒度。父节点半选表示子项部分勾选；保存后对该角色下所有用户即时生效。</div>
      ${DB.permTree.map((g) => `
        <div style="border:1px solid var(--line);border-radius:6px;padding:10px 12px;margin-bottom:10px">
          <label class="row strong"><input type="checkbox" ${['R01', 'R02'].includes(code) ? 'checked' : ''}> ${g.m}</label>
          <div style="display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:8px;padding-left:20px">
            ${g.items.map((i) => `<label class="row"><input type="checkbox" ${['R01', 'R02'].includes(code) || i.includes('查看') || i.includes('查询') ? 'checked' : ''}> ${i}</label>`).join('')}
          </div>
        </div>`).join('')}
      <div class="section-title">数据权限</div>
      <div class="form-grid cols-2">
        <div class="form-item"><label>可见仓库范围</label>
          <select class="select"><option>全部仓库</option>${DB.dict.whList.map((w) => `<option>${w.code} ${w.name}</option>`).join('')}</select></div>
        <div class="form-item"><label>单据可见范围</label>
          <select class="select"><option>本仓全部单据</option><option>仅本人制单</option><option>本部门单据</option></select></div>
      </div>`,
    footer: `<button class="btn" data-close>取消</button>
             <button class="btn primary" data-close data-act="toast" data-msg="${r.name} 的权限已保存">保存权限</button>`
  });
}

function viewLog() {
  return pageHead({
    crumb: ['系统管理', '操作日志'], title: '操作日志',
    desc: '记录所有写操作与登录行为，保留 180 天，不可删除',
    actions: `<button class="btn" data-act="toast" data-msg="已导出日志">导出</button>`
  }) + card({
    body: filters([
      { label: '操作人', w: 'w150' },
      { label: '模块', type: 'select', options: ['系统登录', '基础数据', '入库管理', '出库管理', '库存管理', '库内作业', '系统管理'], w: 'w150' },
      { label: '操作对象', w: 'w180', ph: '单号 / 编码' },
      { label: '结果', type: 'select', options: ['成功', '失败'], w: 'w120' },
      { label: '开始时间', type: 'date', value: '2026-09-01', w: 'w150' },
      { label: '结束时间', type: 'date', value: '2026-09-02', w: 'w150' }
    ])
  }) + card({
    title: '日志明细', tight: true,
    body: tbl({
      cols: [
        { key: 'time', title: '时间', w: '150px' },
        { key: 'user', title: '操作人' },
        { key: 'ip', title: 'IP 地址', render: (r) => `<span class="code">${r.ip}</span>` },
        { key: 'module', title: '模块' },
        { key: 'act', title: '动作' },
        { key: 'target', title: '操作对象', render: (r) => `<span class="code">${esc(r.target)}</span>` },
        { key: 'result', title: '结果', render: (r) => r.result === '成功' ? tag('成功') : `<span class="tag critical">✕ ${esc(r.result)}</span>` }
      ],
      rows: DB.log
    }) + pager(DB.log.length)
  });
}

/* ============================== 路由 ============================== */

const ROUTES = {
  '#/dashboard':        { render: viewDashboard,     after: afterDashboard },
  '#/base/material':    { render: viewMaterial },
  '#/base/location':    { render: viewLocation },
  '#/base/partner':     { render: viewPartner },
  '#/inbound/receipt':  { render: viewReceipt },
  '#/inbound/putaway':  { render: viewPutaway },
  '#/outbound/list':    { render: viewOutbound },
  '#/outbound/pick':    { render: viewPick },
  '#/stock/query':      { render: viewStock },
  '#/stock/ledger':     { render: viewLedger },
  '#/wip/transfer':     { render: viewTransfer },
  '#/wip/stocktake':    { render: viewStocktake },
  '#/report/summary':   { render: viewReportSummary, after: afterReportSummary },
  '#/report/age':       { render: viewReportAge,     after: afterReportAge },
  '#/sys/user':         { render: viewUser },
  '#/sys/role':         { render: viewRole },
  '#/sys/log':          { render: viewLog }
};

function parseHash() {
  const h = location.hash || '#/dashboard';
  const [path, qs] = h.split('?');
  const q = {};
  new URLSearchParams(qs || '').forEach((v, k) => { q[k] = v; });
  return { path, q };
}

function route() {
  const { path, q } = parseHash();
  const r = ROUTES[path] || ROUTES['#/dashboard'];
  renderNav(path);
  const main = $('.main');
  main.innerHTML = r.render(q);
  main.scrollTop = 0;
  if (r.after) r.after();
}

/* ============================== 全局事件（Axure：用例） ============================== */

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');

  // 侧栏分组展开/收起
  if (el && el.dataset.act === 'nav-toggle') {
    el.parentElement.classList.toggle('open');
    return;
  }
  if (!el) return;
  const act = el.dataset.act;
  const d = el.dataset;

  const table = {
    'toast':        () => toast(d.msg, d.kind || 'ok'),
    'search':       () => toast('已按当前条件查询（原型为静态数据）'),
    'reset':        () => toast('已重置查询条件'),
    'page':         () => toast(d.p === 'prev' ? '已翻到上一页' : d.p === 'next' ? '已翻到下一页' : `已跳转到第 ${d.p} 页`),
    'pagesize':     () => {},

    'material-edit':() => {
      const { close } = modal({
        title: d.code ? `编辑物料 · ${d.code}` : '新增物料', width: 'w720',
        body: materialForm(d.code),
        footer: `<button class="btn" data-close>取消</button>
                 <button class="btn primary" data-close data-act="toast" data-msg="${d.code ? `${d.code} 已保存` : '物料已创建'}">保存</button>`
      });
      void close;
    },
    'confirm-del':  () => modal({
      title: '删除确认',
      body: `<p>确定删除物料 <b>${esc(d.code)}</b> 吗？</p>
             <div class="note" style="margin:12px 0 0">该物料存在库存或历史流水时<b>不允许删除</b>，请改用「停用」。停用后不影响历史单据查询。</div>`,
      footer: `<button class="btn" data-close>取消</button>
               <button class="btn danger" data-close data-act="toast" data-msg="该物料存在库存，已阻止删除；建议改为停用" data-kind="warn">仍要删除</button>`
    }),

    'new-receipt':  () => newReceiptForm(),
    'rc-detail':    () => rcDetail(d.no),
    'rc-receive':   () => rcReceiveForm(d.no),
    'rc-putaway':   () => rcPutawayForm(d.no),
    'rc-void':      () => modal({
      title: '作废入库单',
      body: `<p>确定作废 <b>${esc(d.no)}</b>？作废后不可恢复。</p>
             <div class="form-item mt14"><label>作废原因<span class="req">*</span></label>
               <select class="select"><option>供应商延期交货</option><option>重复制单</option><option>采购订单取消</option><option>其他</option></select></div>
             <div class="form-item mt14"><label>备注</label><textarea class="textarea"></textarea></div>`,
      footer: `<button class="btn" data-close>取消</button>
               <button class="btn danger" data-close data-act="toast" data-msg="${d.no} 已作废">确认作废</button>`
    }),

    'new-outbound': () => newOutboundForm(),
    'do-detail':    () => doDetail(d.no),
    'do-approve':   () => modal({
      title: `审核出库单 · ${d.no}`,
      body: `<div class="note">审核通过后即锁定库存（可用量扣减），并生成拣货任务。</div>
             <dl class="dl cols-3" style="margin-top:12px">
               <div><dt>应发总量</dt><dd class="strong">${fmt((DB.outbound.find((x) => x.no === d.no) || {}).qtyPlan)}</dd></div>
               <div><dt>库存校验</dt><dd>${tag('合格')}</dd></div>
               <div><dt>信用校验</dt><dd>${tag('合格')}</dd></div>
             </dl>
             <div class="form-item mt14"><label>审核意见</label><textarea class="textarea" placeholder="选填"></textarea></div>`,
      footer: `<button class="btn" data-close>取消</button>
               <button class="btn danger" data-close data-act="toast" data-msg="${d.no} 已驳回，退回制单人" data-kind="warn">驳回</button>
               <button class="btn primary" data-close data-act="toast" data-msg="${d.no} 审核通过，库存已锁定，状态：待拣货">审核通过</button>`
    }),
    'do-ship':      () => modal({
      title: `复核发运 · ${d.no}`,
      body: `<div class="form-grid cols-2">
               <div class="form-item"><label>复核人<span class="req">*</span></label><select class="select"><option>孙伟</option><option>李娜</option></select></div>
               <div class="form-item"><label>发运方式<span class="req">*</span></label><select class="select"><option>自提</option><option>公司配送</option><option>第三方物流</option></select></div>
               <div class="form-item"><label>承运商 / 车牌</label><input class="input" placeholder="如 顺丰 / 苏E·12345"></div>
               <div class="form-item"><label>包装件数</label><input class="input" type="number" value="6"></div>
               <div class="form-item"><label>实际重量（kg）</label><input class="input" type="number" value="428"></div>
               <div class="form-item"><label>发运时间</label><input class="input" type="datetime-local" value="2026-09-02T15:30"></div>
             </div>
             <div class="note mt14">确认发运后：库存正式扣减、生成出库流水、单据流转到「已完成」，并回写来源销售订单的发货数量。</div>`,
      footer: `<button class="btn" data-close>取消</button>
               <button class="btn" data-close data-act="toast" data-msg="已打印发货单与物流面单">打印面单</button>
               <button class="btn primary" data-close data-act="toast" data-msg="${d.no} 已发运完成，库存与流水已更新">确认发运</button>`
    }),
    'do-void':      () => modal({
      title: '作废出库单',
      body: `<p>确定作废 <b>${esc(d.no)}</b>？已锁定的库存将同步释放。</p>
             <div class="form-item mt14"><label>作废原因<span class="req">*</span></label>
               <select class="select"><option>客户取消订单</option><option>重复制单</option><option>库存不足</option><option>其他</option></select></div>`,
      footer: `<button class="btn" data-close>取消</button>
               <button class="btn danger" data-close data-act="toast" data-msg="${d.no} 已作废，锁定库存已释放">确认作废</button>`
    }),
    'do-submit-pick': () => modal({
      title: '提交拣货',
      body: `<div class="note" style="background:#fff6e0;border-color:#f6e2b0">
               <b>校验结果：2 项提示</b><br>
               · 行 3「M-1004 三相异步电机」应拣 12 台，库位可用 16 台，可正常拣货<br>
               · 行 1、2 当前为部分拣货，提交后单据将保持「拣货中」
             </div>
             <div class="form-item mt14"><label>提交方式</label>
               <select class="select"><option>部分提交（保持拣货中）</option><option>整单完成（未拣数量记缺货）</option></select></div>`,
      footer: `<button class="btn" data-close>取消</button>
               <button class="btn primary" data-close data-act="toast" data-msg="拣货已提交，${d.no} 状态：拣货中">确认提交</button>`
    }),

    'stock-detail': () => stockDetail(d.code, d.batch),
    'stock-freeze': () => modal({
      title: '冻结库存',
      body: `<div class="form-grid cols-2">
               <div class="form-item"><label>冻结维度<span class="req">*</span></label>
                 <select class="select"><option>按库位</option><option>按物料+批次</option><option>按整仓</option></select></div>
               <div class="form-item"><label>目标</label><input class="input" placeholder="如 C-02-01-02"></div>
               <div class="form-item"><label>冻结原因<span class="req">*</span></label>
                 <select class="select"><option>质量待判</option><option>盘点冻结</option><option>客户预留</option><option>停用物料</option></select></div>
               <div class="form-item"><label>预计解冻日期</label><input class="input" type="date"></div>
               <div class="form-item span-2"><label>备注</label><textarea class="textarea"></textarea></div>
             </div>
             <div class="note mt14">冻结后该范围的库存<b>不计入可用量</b>，出库单无法引用；已锁定的出库单需先释放。</div>`,
      footer: `<button class="btn" data-close>取消</button>
               <button class="btn primary" data-close data-act="toast" data-msg="库存已冻结">确认冻结</button>`
    }),

    'new-transfer': () => newTransferForm(),

    'new-stocktake':() => newStocktakeForm(),
    'pd-detail':    () => pdDetail(d.no),
    'pd-approve':   () => modal({
      title: `差异审核 · ${d.no}`, width: 'w720',
      body: `<div class="note">审核通过后自动生成盘盈/盘亏流水并过账，不可撤销。</div>
             ${tbl({
               cols: [
                 { key: 'code', title: '物料', render: (l) => `<span class="code">${l.code}</span><span class="sub-text">${esc(l.name)}</span>` },
                 { key: 'loc', title: '库位', render: (l) => `<span class="code">${l.loc}</span>` },
                 { key: 'sysQty', title: '账面', align: 'num', render: (l) => fmt(l.sysQty) },
                 { key: 'realQty', title: '实盘', align: 'num', render: (l) => fmt(l.realQty) },
                 { key: 'diff', title: '差异', align: 'num', render: (l) => `<span style="color:${l.diff > 0 ? '#8a5e00' : 'var(--critical)'}">${l.diff > 0 ? '+' : ''}${fmt(l.diff)}</span>` },
                 { key: 'reason', title: '差异原因', w: '150px', render: () => `<select class="select"><option>账实不符（漏记）</option><option>破损未报</option><option>错发/错收</option><option>计量误差</option></select>` }
               ],
               rows: (DB.stocktakeLine[d.no] || DB.stocktakeLine['PD20260902001']).filter((l) => l.diff)
             })}`,
      footer: `<button class="btn" data-close>取消</button>
               <button class="btn danger" data-close data-act="toast" data-msg="已退回复盘" data-kind="warn">退回复盘</button>
               <button class="btn primary" data-close data-act="toast" data-msg="${d.no} 差异已审核过账，库存已调整">审核过账</button>`
    }),

    'perm':         () => permForm(d.code),

    // 图表 / 表格 视图切换（图表的无障碍兜底）
    'chart-view':   () => {
      const host = d.host;
      $$(`[data-act="chart-view"][data-host="${host}"]`).forEach((b) => b.classList.toggle('on', b === el));
      $(`#chart-${host}`).style.display = d.v === 'chart' ? '' : 'none';
      $(`#table-${host}`).style.display = d.v === 'table' ? '' : 'none';
    },

    'nav-collapse': () => $('.app').classList.toggle('nav-collapsed'),
    'wh-switch':    () => {
      const { close } = modal({
        title: '切换当前仓库', footer: null,
        body: `<div class="todo-list" style="margin:-18px">
          ${[{ code: '全部', name: '全部仓库（4 个）', addr: '汇总视图' }, ...DB.dict.whList].map((w) => `
            <button class="todo" style="width:100%;text-align:left;border:none;background:none;font-family:var(--font);font-size:13px;cursor:pointer"
                    data-act="wh-pick" data-code="${w.code}" data-name="${w.name}">
              <span class="ico" aria-hidden="true">▩</span>
              <span class="t"><b>${w.code === '全部' ? w.name : `${w.code} ${w.name}`}</b><span>${w.addr}</span></span>
            </button>`).join('')}
        </div>`
      });
      void close;
    },
    'wh-pick':      () => {
      $('.wh-switch .wh-label').textContent = d.code === '全部' ? '全部仓库' : `${d.code} ${d.name}`;
      el.closest('.mask').remove();
      toast(`已切换到 ${d.name}`);
    },
    'notice':       () => drawer({
      title: '消息通知', sub: `${DB.alerts.length} 条未读`,
      body: `<div class="card" style="padding:0"><div class="todo-list">
        ${DB.alerts.map((a) => `
          <div class="todo">
            <span class="ico" style="background:${a.level === 'critical' ? '#fdeeee' : '#fff6e0'};color:${a.level === 'critical' ? 'var(--critical)' : '#8a5e00'}" aria-hidden="true">!</span>
            <span class="t"><b>${esc(a.title)}</b><span>${esc(a.time)}</span></span>
          </div>`).join('')}
      </div></div>`,
      footer: `<button class="btn" data-close>关闭</button>
               <button class="btn primary" data-close data-act="toast" data-msg="已全部标为已读">全部标为已读</button>`
    }),
    'user-menu':    () => {
      const { close } = modal({
        title: '李娜 · 仓库主管', footer: null,
        body: `<dl class="dl cols-3">
                 <div><dt>登录账号</dt><dd class="code">lina</dd></div>
                 <div><dt>所属部门</dt><dd>仓储部</dd></div>
                 <div><dt>角色</dt><dd>${tag('仓库主管', 'info')}</dd></div>
                 <div><dt>可见仓库</dt><dd>WH01 / WH02 / WH03</dd></div>
                 <div><dt>最近登录</dt><dd>2026-09-02 08:02</dd></div>
                 <div><dt>登录 IP</dt><dd class="code">10.12.3.52</dd></div>
               </dl>
               <div class="row mt14" style="gap:8px">
                 <button class="btn" data-act="toast" data-msg="修改密码表单（原型示意）">修改密码</button>
                 <button class="btn" data-act="toast" data-msg="个人设置（原型示意）">个人设置</button>
                 <a class="btn danger" href="login.html">退出登录</a>
               </div>`
      });
      void close;
    },
    'help':         () => drawer({
      title: '原型说明', sub: '给评审者看的',
      body: `<div class="card"><div class="card-bd">
        <div class="section-title">这份原型包含什么</div>
        <p>8 个模块、17 个页面，覆盖通用制造/贸易企业仓库的完整业务闭环：
           基础数据 → 入库（收货/质检/上架）→ 出库（审核/拣货/复核发运）→ 库存（查询/流水）
           → 库内作业（移库/盘点）→ 报表 → 系统管理。</p>
        <div class="section-title mt14">怎么看</div>
        <ul style="padding-left:18px;color:var(--ink-2)">
          <li>左侧导航切换模块；单号是可点的，会打开详情抽屉。</li>
          <li>入库单「收货登记 / 上架」、出库单「审核 / 拣货 / 复核发运」、盘点「录入 / 差异审核」都做了真实弹窗。</li>
          <li>图表右上角可切「表格」视图 —— 这是图表的无障碍兜底，正式系统也要保留。</li>
          <li>提交类按钮只弹提示，不真的改数据（原型为静态数据）。</li>
        </ul>
        <div class="section-title mt14">与 Axure 的对应关系</div>
        <ul style="padding-left:18px;color:var(--ink-2)">
          <li>顶栏 + 左侧导航 = 2 个 <b>母版（Master）</b></li>
          <li>每个列表页的表格 = 1 个 <b>中继器（Repeater）</b></li>
          <li>弹窗、抽屉、选项卡、步骤条 = <b>动态面板（Dynamic Panel）</b></li>
          <li>字段与状态机见随附的《Axure 搭建说明书》第 6、7 章。</li>
        </ul>
      </div></div>`
    })
  };

  if (table[act]) { table[act](); }
});

/* 启动 */
window.addEventListener('hashchange', route);
window.addEventListener('resize', () => {
  // 图表按容器宽度重绘
  const { path } = parseHash();
  const r = ROUTES[path];
  if (r && r.after) r.after();
});
route();
