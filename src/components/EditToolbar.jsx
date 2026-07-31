import { useState, useRef, useEffect } from 'react';
import { Icon } from './icons.jsx';

/**
 * 画布上下文工具栏 —— 只在 viewMode === 'pattern' 时显示
 * 设计原则: 与"操作对象"同位 —— 编辑工具贴近画布, 不隐藏在全局设置里
 *
 * 包含:
 *   1. 画笔颜色选择 (主槽 + 调色板弹窗)
 *   2. 撤销 / 重做
 *   3. 颜色清单 (弹窗)
 *   4. 导出 PNG
 */
export default function EditToolbar({
  // 画笔
  selectedBrushColor,
  onSelectBrushColor,
  // 撤销/重做
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  // 颜色清单
  colors,
  highlightCode,
  excludedColors,
  onHighlight,
  onReplace,
  onRemove,
  onRestore,
  // 调色板
  activePalette,
  activePaletteValue,
  paletteSuites,
  onPaletteChange,
  // 导出
  onExportPng,
  onExportPurePng,
  onExportCsv,
  onExportExcel,
  onExportJson,
  onImportJson,
  canExport,
  // 历史
  onSaveToHistory,
  onOpenHistory,
}) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [colorsOpen, setColorsOpen] = useState(false);
  const [brushPopoverOpen, setBrushPopoverOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const brushRef = useRef(null);
  const paletteBtnRef = useRef(null);
  const colorsBtnRef = useRef(null);
  const exportRef = useRef(null);

  // 点击其他区域关闭导出下拉
  useEffect(() => {
    if (!exportOpen) return;
    const onDown = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) {
        setExportOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [exportOpen]);

  // 实时测量移动端 MobileActionBar 的高度, 写到 --action-bar-h 变量;
  // EditToolbar CSS 用此变量定位 = 完全不会被遮挡, 也不依赖任何硬编码.
  useEffect(() => {
    const measure = () => {
      const bar = document.querySelector('.mobile-actionbar');
      if (!bar) {
        document.documentElement.style.setProperty('--action-bar-h', '0px');
        return;
      }
      const r = bar.getBoundingClientRect();
      const h = Math.max(0, Math.round(window.innerHeight - r.top));
      document.documentElement.style.setProperty('--action-bar-h', `${h}px`);
    };
    measure();
    // viewport 变化时再测一次
    window.addEventListener('resize', measure);
    // 也观察 bar 自身尺寸变化 (例如 safe-area 字体大小改变)
    const bar = document.querySelector('.mobile-actionbar');
    let ro = null;
    if (bar && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure);
      ro.observe(bar);
    }
    return () => {
      window.removeEventListener('resize', measure);
      if (ro) ro.disconnect();
    };
  }, []);

  // 点击外部关闭弹窗
  useEffect(() => {
    if (!brushPopoverOpen && !paletteOpen && !colorsOpen) return;
    const onDown = (e) => {
      if (brushPopoverOpen && brushRef.current && !brushRef.current.contains(e.target)) {
        setBrushPopoverOpen(false);
      }
      if (paletteOpen && paletteBtnRef.current && !paletteBtnRef.current.contains(e.target)) {
        setPaletteOpen(false);
      }
      if (colorsOpen && colorsBtnRef.current && !colorsBtnRef.current.contains(e.target)) {
        setColorsOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [brushPopoverOpen, paletteOpen, colorsOpen]);

  return (
    <div className="edit-toolbar border-t border-[var(--border-color)] bg-white/95 backdrop-blur px-3 py-2 safe-area-pb">
      <div className="flex items-center gap-2 max-w-6xl mx-auto">

        {/* ===== 1. 画笔颜色主槽 ===== */}
        <div ref={brushRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setBrushPopoverOpen(v => !v)}
            className={`flex items-center gap-1.5 h-10 px-2.5 rounded-lg border transition ${
              selectedBrushColor
                ? 'border-primary-400 bg-primary-50 shadow-sm'
                : 'border-dashed border-[var(--border-color)] bg-white hover:border-primary-400'
            }`}
            title={selectedBrushColor ? `当前画笔: ${selectedBrushColor.code}` : '点击选择画笔颜色'}
          >
            {selectedBrushColor ? (
              <>
                <div
                  className="w-5 h-5 rounded border border-black/15"
                  style={{ backgroundColor: selectedBrushColor.hex }}
                />
                <span className="font-mono text-xs font-bold text-[var(--text-primary)]">
                  {selectedBrushColor.code}
                </span>
              </>
            ) : (
              <>
                <Icon name="brush" className="w-4 h-4 text-[var(--text-secondary)]" />
                <span className="text-xs text-[var(--text-secondary)]">画笔</span>
              </>
            )}
          </button>

          {/* 画笔颜色弹窗 —— 调色板常驻 */}
          {brushPopoverOpen && (
            <div className="absolute left-0 bottom-full mb-2 w-72 bg-white rounded-xl border border-[var(--border-color)] shadow-[var(--shadow-lg)] p-3 z-40 max-h-[60vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  选择画笔颜色
                </span>
                {selectedBrushColor && (
                  <button
                    type="button"
                    onClick={() => { onSelectBrushColor(null); setBrushPopoverOpen(false); }}
                    className="text-[10px] text-[var(--text-secondary)] hover:text-red-500"
                  >
                    清除画笔
                  </button>
                )}
              </div>
              {selectedBrushColor && (
                <div className="flex items-center gap-2 p-2 mb-2 rounded-lg bg-primary-50 border border-primary-200">
                  <div
                    className="w-6 h-6 rounded border border-black/10"
                    style={{ backgroundColor: selectedBrushColor.hex }}
                  />
                  <div className="text-xs flex-1 min-w-0">
                    <div className="font-mono font-bold">{selectedBrushColor.code}</div>
                    <div className="text-[10px] text-[var(--text-secondary)] truncate">{selectedBrushColor.hex}</div>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-8 gap-1">
                {activePalette.map(c => (
                  <button
                    key={c.code}
                    type="button"
                    title={`${c.code} · ${c.hex}`}
                    onClick={() => {
                      onSelectBrushColor(c);
                      setBrushPopoverOpen(false);
                    }}
                    className={`aspect-square rounded border transition ${
                      selectedBrushColor?.code === c.code
                        ? 'border-primary-500 ring-2 ring-primary-400 scale-110'
                        : 'border-black/10 hover:scale-110'
                    }`}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
              {paletteSuites && paletteSuites.length > 1 && (
                <div className="mt-3 pt-2 border-t border-[var(--border-color)]">
                  <div className="text-[10px] text-[var(--text-secondary)] mb-1">切换色卡</div>
                  <select
                    value={activePaletteValue}
                    onChange={e => onPaletteChange(e.target.value)}
                    className="w-full text-xs px-2 py-1.5 rounded border border-[var(--border-color)] bg-white"
                  >
                    {paletteSuites.map(p => (
                      <option key={p.value} value={p.value}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-[var(--border-color)] shrink-0" />

        {/* ===== 2. 撤销 / 重做 ===== */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className="h-10 px-2.5 rounded-lg border border-[var(--border-color)] bg-white text-sm hover:border-primary-400 disabled:opacity-30 disabled:cursor-not-allowed transition"
            title="撤销 (Ctrl+Z)"
            aria-label="撤销"
          >
            ↩
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            className="h-10 px-2.5 rounded-lg border border-[var(--border-color)] bg-white text-sm hover:border-primary-400 disabled:opacity-30 disabled:cursor-not-allowed transition"
            title="重做 (Ctrl+Y)"
            aria-label="重做"
          >
            ↪
          </button>
        </div>

        <div className="w-px h-6 bg-[var(--border-color)] shrink-0" />

        {/* ===== 3. 颜色清单 ===== */}
        {colors && colors.length > 0 && (
          <div ref={colorsBtnRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setColorsOpen(v => !v)}
              className={`flex items-center gap-1.5 h-10 px-2.5 rounded-lg border transition ${
                colorsOpen
                  ? 'border-primary-400 bg-primary-50'
                  : 'border-[var(--border-color)] bg-white hover:border-primary-400'
              }`}
              title="颜色清单"
            >
              <div className="flex -space-x-1">
                {colors.slice(0, 4).map((c, i) => (
                  <div
                    key={c.code}
                    className="w-4 h-4 rounded-full border-2 border-white"
                    style={{ backgroundColor: c.hex, zIndex: 4 - i }}
                  />
                ))}
              </div>
              <span className="text-xs font-medium text-[var(--text-primary)]">
                {colors.length} 色
              </span>
            </button>

            {colorsOpen && (
              <ColorsPanel
                colors={colors}
                highlightCode={highlightCode}
                excludedColors={excludedColors}
                onHighlight={onHighlight}
                onReplace={onReplace}
                onRemove={onRemove}
                onRestore={onRestore}
                onClose={() => setColorsOpen(false)}
              />
            )}
          </div>
        )}

        {/* spacer flex */}
        <div className="flex-1" />

        {/* ===== 3b. 历史记录 (查看历史列表) ===== */}
        <button
          type="button"
          onClick={onOpenHistory}
          className="h-10 px-2.5 rounded-lg border border-[var(--border-color)] bg-white text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-muted)] text-sm font-medium flex items-center gap-1.5 shrink-0 transition"
          title="查看历史记录"
          aria-label="打开历史记录"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
               strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8"/>
            <path d="M3 3v5h5"/>
            <path d="M12 7v5l3 2"/>
          </svg>
          <span className="hidden sm:inline">历史</span>
        </button>

        {/* ===== 3c. 另存为历史快照 ===== */}
        <button
          type="button"
          onClick={onSaveToHistory}
          className="h-10 px-2.5 rounded-lg border border-[var(--border-color)] bg-white text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-muted)] text-sm font-medium flex items-center gap-1.5 shrink-0 transition"
          title="把当前图纸保存到历史记录"
          aria-label="保存到历史记录"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
               strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
          </svg>
          <span className="hidden sm:inline">保存</span>
        </button>

        {/* ===== 4. 导出 (主按钮 PNG + 下拉全部格式) ===== */}
        <div ref={exportRef} className="relative flex shrink-0">
          <button
            type="button"
            onClick={onExportPng}
            disabled={!canExport}
            className="h-10 pl-3 pr-2.5 rounded-l-lg bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
            title="导出图纸 PNG"
          >
            <Icon name="download" className="w-4 h-4" />
            <span className="hidden sm:inline">下载图纸</span>
            <span className="sm:hidden">下载</span>
          </button>
          <button
            type="button"
            onClick={() => setExportOpen(v => !v)}
            disabled={!canExport}
            aria-label="更多导出格式"
            className="h-10 px-2 rounded-r-lg bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold flex items-center disabled:opacity-40 disabled:cursor-not-allowed border-l border-primary-400/40 transition shadow-sm"
            title="导出其他格式 (PNG 纯图案 / CSV / Excel / JSON 备份)"
          >
            <Icon name="chevron-down" className="w-3.5 h-3.5" />
          </button>
          {exportOpen && (
            <div className="absolute right-0 bottom-full mb-1.5 w-48 rounded-xl border border-[var(--border-color)] bg-white shadow-[var(--shadow-lg)] py-1 text-sm z-30">
              <button
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-[var(--bg-muted)] flex items-center gap-2"
                onClick={() => { onExportPng(); setExportOpen(false); }}
              >
                <Icon name="image" className="w-4 h-4" />
                PNG 图纸
              </button>
              <button
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-[var(--bg-muted)] flex items-center gap-2"
                onClick={() => { onExportPurePng && onExportPurePng(); setExportOpen(false); }}
                disabled={!onExportPurePng}
              >
                <Icon name="grid" className="w-4 h-4" />
                PNG 纯图案
              </button>
              <button
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-[var(--bg-muted)] flex items-center gap-2"
                onClick={() => { onExportCsv && onExportCsv(); setExportOpen(false); }}
                disabled={!onExportCsv}
              >
                <Icon name="file-text" className="w-4 h-4" />
                CSV 色号
              </button>
              <button
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-[var(--bg-muted)] flex items-center gap-2"
                onClick={() => { onExportExcel && onExportExcel(); setExportOpen(false); }}
                disabled={!onExportExcel}
              >
                <Icon name="table" className="w-4 h-4" />
                Excel 色号
              </button>
              <div className="my-1 border-t border-[var(--border-color)]" />
              <button
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-[var(--bg-muted)] flex items-center gap-2"
                onClick={() => { onExportJson && onExportJson(); setExportOpen(false); }}
                disabled={!onExportJson}
              >
                <Icon name="share" className="w-4 h-4" />
                JSON 备份
              </button>
              <button
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-[var(--bg-muted)] flex items-center gap-2"
                onClick={() => { onImportJson && onImportJson(); setExportOpen(false); }}
                disabled={!onImportJson}
              >
                <Icon name="upload" className="w-4 h-4" />
                导入备份
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 选中画笔时, 显示明确的提示横幅 */}
      {selectedBrushColor && (
        <div className="max-w-6xl mx-auto mt-1.5 flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
          <Icon name="info" className="w-3 h-3" />
          <span>
            已选画笔颜色 <strong className="font-mono font-bold text-[var(--text-primary)]">{selectedBrushColor.code}</strong>，点击画布格子即可上色
          </span>
        </div>
      )}
    </div>
  );
}

// 颜色清单面板 —— 独立组件, 弹窗式
function ColorsPanel({ colors, highlightCode, excludedColors, onHighlight, onReplace, onRemove, onRestore, onClose }) {
  const [search, setSearch] = useState('');
  const excludedSet = new Set(excludedColors || []);
  const filtered = !search.trim()
    ? colors
    : colors.filter(c =>
        c.code.toLowerCase().includes(search.toLowerCase()) ||
        (c.name && c.name.toLowerCase().includes(search.toLowerCase())) ||
        c.hex.toLowerCase().includes(search.toLowerCase())
      );

  return (
    <div className="absolute right-0 bottom-full mb-2 w-80 max-h-[70vh] bg-white rounded-xl border border-[var(--border-color)] shadow-[var(--shadow-lg)] z-40 flex flex-col">
      <div className="p-3 border-b border-[var(--border-color)]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-[var(--text-primary)]">
            颜色清单 ({colors.length})
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-[var(--text-secondary)] hover:text-red-500"
          >
            ✕
          </button>
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="搜索色号 / 名称 / HEX"
          className="w-full text-xs px-2 py-1.5 rounded border border-[var(--border-color)] focus:border-primary-400 focus:outline-none"
        />
      </div>
      <div className="flex-1 overflow-y-auto p-2 grid grid-cols-3 gap-1.5">
        {filtered.map(color => {
          const excluded = excludedSet.has(color.code);
          const highlighted = highlightCode === color.code;
          return (
            <div
              key={color.code}
              className={`relative rounded border overflow-hidden cursor-pointer transition ${
                highlighted
                  ? 'border-primary-500 ring-1 ring-primary-400'
                  : 'border-[var(--border-color)] hover:border-primary-400'
              } ${excluded ? 'opacity-40' : ''}`}
              onClick={() => onHighlight(highlighted ? null : color.code)}
            >
              <div className="flex items-center gap-1.5 p-1.5">
                <div
                  className="w-6 h-6 rounded shrink-0 border border-black/10"
                  style={{ backgroundColor: color.hex }}
                  title={color.hex}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[10px] font-bold text-[var(--text-primary)] truncate">
                    {color.code}
                  </div>
                  <div className="text-[9px] text-[var(--text-secondary)]">
                    {color.count} 颗
                  </div>
                </div>
              </div>
              {!excluded ? (
                <div className="flex border-t border-[var(--border-color)] text-[9px]">
                  <button
                    type="button"
                    className="flex-1 py-0.5 hover:bg-primary-50 hover:text-primary-600 transition"
                    onClick={(e) => { e.stopPropagation(); onReplace(color); }}
                  >
                    替换
                  </button>
                  <button
                    type="button"
                    className="flex-1 py-0.5 border-l border-[var(--border-color)] hover:bg-red-50 hover:text-red-600 transition"
                    onClick={(e) => { e.stopPropagation(); onRemove(color.code); }}
                  >
                    删除
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="w-full py-0.5 border-t border-[var(--border-color)] text-[9px] hover:bg-primary-50 hover:text-primary-600 transition"
                  onClick={(e) => { e.stopPropagation(); onRestore(color.code); }}
                >
                  恢复
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
