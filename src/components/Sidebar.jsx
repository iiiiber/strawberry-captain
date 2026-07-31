import { useState, useRef } from 'react';

// 折叠面板
function Panel({ id, title, count, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="card">
      <header
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
        onClick={() => setOpen(o => !o)}
      >
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
        <div className="flex items-center gap-2">
          {typeof count === 'number' && (
            <span className="text-[10px] text-text-muted bg-gray-100 rounded-pill px-2 py-0.5">{count}</span>
          )}
          <span className="text-xs text-text-secondary">{open ? '▾' : '▸'}</span>
        </div>
      </header>
      {open && <div className="px-4 pb-4 pt-1 space-y-3">{children}</div>}
    </section>
  );
}

// 通用 field 行: 左 label 右 控件
function Field({ label, children, hint }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="label-title">{label}</label>
        {hint && <span className="text-[10px] text-text-muted font-mono">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

// 开关
function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-xs text-text-primary">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-pill transition ${checked ? 'bg-primary-500' : 'bg-gray-300'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
            checked ? 'translate-x-4' : ''
          }`}
        />
      </button>
    </label>
  );
}

// 单选按钮组
function Segmented({ value, options, onChange }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-2 py-1 text-[11px] rounded-btn border transition ${
            value === opt.value
              ? 'bg-primary-500 text-white border-primary-500'
              : 'bg-white text-text-primary border-border hover:border-primary-400'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// 数字滑块
function Slider({ value, min, max, step = 1, onChange }) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      className="w-full accent-primary-500"
    />
  );
}

// 下拉
function Select({ value, options, onChange }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="input-base w-full"
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

const MODES = [
  { value: 'cartoon-real-merge', label: '卡通真实合并' },
  { value: 'average', label: '真实 (平均)' },
  { value: 'dominant', label: '卡通 (主色)' },
  { value: 'smooth', label: '平滑 (强化合并)' },
  { value: 'palette', label: '调色板映射 (纯映射)' },
];

const STYLES = [
  { value: 'faithful', label: '原色' },
  { value: 'bright', label: '鲜艳' },
  { value: 'pastel', label: '马卡龙' },
  { value: 'comic', label: '漫画' },
  { value: 'retro', label: '复古' },
  { value: 'mono', label: '黑白' },
];

export default function Sidebar({
  settings,
  onChange,
  paletteSuites,
  activePaletteValue,
  onPaletteChange,
  activePalette,
  canExport,
  // 颜色清单 (颜色清单面板已迁到 EditToolbar, 这里仅保留只读预览用 actions)
  colors,
  highlightCode,
  excludedColors,
  onHighlight,
  onReplace,
  onRemove,
  onRestore,
}) {
  const importFileRef = useRef(null);
  return (
    <aside className="w-[360px] shrink-0 border-r border-border bg-canvas overflow-y-auto p-4 space-y-4">
      {/* ===== 1. 工作模式 ===== */}
      <Panel id="mode" title="工作模式" count={MODES.length}>
        <Field label="采样模式" hint={settings.mode}>
          <Segmented
            value={settings.mode}
            options={MODES}
            onChange={v => onChange({ mode: v })}
          />
        </Field>
        <Field label="量化算法" hint={settings.quantizeMode}>
          <Segmented
            value={settings.quantizeMode}
            options={[
              { value: 'kmeans', label: 'K-means' },
              { value: 'freq-lab', label: '频次+Lab' },
            ]}
            onChange={v => onChange({ quantizeMode: v })}
          />
        </Field>
        <Field label="风格滤镜" hint={settings.style}>
          <Segmented
            value={settings.style}
            options={STYLES}
            onChange={v => onChange({ style: v })}
          />
        </Field>
      </Panel>

      {/* ===== 2. 参数设置 ===== */}
      <Panel id="params" title="参数设置" count={7}>
        <Field label="横向方格尺寸数量" hint={`(10-150) ${settings.gridSize}`}>
          <Slider value={settings.gridSize} min={10} max={150} step={2}
            onChange={v => onChange({ gridSize: v })} />
        </Field>
        <Field label="颜色合并阈值" hint={`(0-60) ${settings.mergeThreshold ?? 30}`}>
          <Slider value={settings.mergeThreshold ?? 30} min={0} max={60} step={1}
            onChange={v => onChange({ mergeThreshold: v })} />
        </Field>
        <Field label="颜色上限" hint={`(1-100) ${settings.colorLimit}`}>
          <Slider value={settings.colorLimit} min={1} max={100} step={1}
            onChange={v => onChange({ colorLimit: v })} />
        </Field>
        <Field label="适配模式" hint={settings.fitMode}>
          <Segmented
            value={settings.fitMode}
            options={[
              { value: 'contain', label: '完整容纳' },
              { value: 'cover', label: '铺满裁切' },
            ]}
            onChange={v => onChange({ fitMode: v })}
          />
        </Field>
        <Field label="图片缩放" hint={`${settings.imageScale}%`}>
          <Slider value={settings.imageScale} min={30} max={100} step={5}
            onChange={v => onChange({ imageScale: v })} />
        </Field>
        <Field label="水平偏移" hint={`${settings.offsetX}%`}>
          <Slider value={settings.offsetX} min={-50} max={50} step={1}
            onChange={v => onChange({ offsetX: v })} />
        </Field>
        <Field label="垂直偏移" hint={`${settings.offsetY}%`}>
          <Slider value={settings.offsetY} min={-50} max={50} step={1}
            onChange={v => onChange({ offsetY: v })} />
        </Field>
      </Panel>

      {/* ===== 3. 工具 ===== */}
      <Panel id="tools" title="工具">
        <Toggle label="去除背景" checked={settings.removeBackground}
          onChange={v => onChange({ removeBackground: v })} />
        {settings.removeBackground && (
          <Field label="白度阈值" hint={settings.backgroundThreshold}>
            <Slider value={settings.backgroundThreshold} min={15} max={90} step={1}
              onChange={v => onChange({ backgroundThreshold: v })} />
          </Field>
        )}
        <Toggle label="边缘清理" checked={settings.edgeCleanup}
          onChange={v => onChange({ edgeCleanup: v })} />
        <Toggle label="外缘描边" checked={settings.outline}
          onChange={v => onChange({ outline: v })} />
        {settings.outline && (
          <Field label="描边色">
            <Select
              value={settings.outlineColor || 'auto'}
              options={[
                { value: 'auto', label: '自动 (最深色)' },
                ...activePalette.slice(0, 40).map(c => ({
                  value: c.code,
                  label: `${c.code} (${c.hex})`,
                })),
              ]}
              onChange={v => onChange({ outlineColor: v === 'auto' ? null : v })}
            />
          </Field>
        )}
        <Toggle label="肤色保护" checked={settings.skinProtect}
          onChange={v => onChange({ skinProtect: v })} />
        <Toggle label="水平镜像" checked={settings.flipped}
          onChange={v => onChange({ flipped: v })} />
      </Panel>

      {/* ===== 4. 色板与导出 (画笔已迁到 EditToolbar, 这里仅保留品牌切换与高级导出) ===== */}
      <Panel id="export" title="色板与导出">
        <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] mb-2">
          <span>可用色 <strong className="text-[var(--text-primary)]">{activePalette.length}</strong></span>
          <span className="text-[10px] text-[var(--text-secondary)]">
            💡 画笔 / 主导出已移到画布下方工具栏
          </span>
        </div>
        <Field label="品牌">
          <Segmented
            value={(() => {
              // 从 paletteSuites 推断品牌
              const suite = paletteSuites.find(s => s.value === activePaletteValue);
              if (!suite) return '';
              const name = suite.name.toLowerCase();
              if (name.includes('mard')) return 'mard';
              if (name.includes('coco')) return 'coco';
              if (name.includes('漫漫拼豆')) return 'manmanpin';
              if (name.includes('漫漫')) return 'manman';
              if (name.includes('盼盼')) return 'panpan';
              if (name.includes('小舞')) return 'xiaowu';
              if (name.includes('黄豆豆')) return 'huangdoudou';
              if (name.includes('动木木')) return 'dongmumu';
              return suite.value;
            })()}
            options={[
              { value: 'mard', label: 'MARD' },
              { value: 'coco', label: 'COCO' },
              { value: 'manman', label: 'ManMan' },
              { value: 'panpan', label: 'PanPan' },
              { value: 'xiaowu', label: 'XiaoWo' },
            ]}
            onChange={brand => {
              const brandMap = {
                mard: 'mard221',
                coco: 'coco',
                manman: 'manman',
                panpan: 'panpan',
                xiaowu: 'xiaowu',
              };
              onPaletteChange(brandMap[brand] || brand);
            }}
          />
        </Field>
        <Field label="色号">
          <Select
            value={activePaletteValue}
            options={paletteSuites.map(p => ({ value: p.value, label: `${p.name}色` }))}
            onChange={v => onPaletteChange(v)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            className="btn-base h-8 px-3 text-xs"
            onClick={() => importFileRef.current?.click()}
          >导入备份</button>
          <input
            ref={importFileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                  // 通过 CustomEvent 把解析后的对象传给 App (复用现有 patternFromJson)
                  window.dispatchEvent(new CustomEvent('captain:import-json', { detail: ev.target.result }));
                };
                reader.readAsText(file);
              }
              e.target.value = '';
            }}
          />
        </div>
      </Panel>
    </aside>
  );
}
