import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import CanvasStage from './components/CanvasStage.jsx';
import Sidebar from './components/Sidebar.jsx';
import SettingsSheet from './components/SettingsSheet.jsx';
import ExportPanel from './components/ExportPanel.jsx';
import MobileActionBar from './components/MobileActionBar.jsx';
import EditToolbar from './components/EditToolbar.jsx';
import { HistoryPanel } from './components/HistoryPanel.jsx';
import Toast, { useToast } from './components/Toast.jsx';
import { BrandMark, Icon } from './components/icons.jsx';
import {
  imageToPattern, renderPattern, renderPurePattern, patternToCsv,
  patternToJson, patternFromJson, patternToExcel,
  replaceColor, replaceCellColor, removeColorFromPattern,
} from './lib/patternEngine.js';
import { loadPalettes, getActivePalette, setActivePalette, BEAD_PALETTE } from './lib/palette.js';
import {
  listHistory, addHistory, newHistoryId, removeHistory,
} from './lib/history.js';

const DEFAULT_SETTINGS = {
  mode: 'smooth',
  quantizeMode: 'kmeans',
  style: 'faithful',
  gridSize: 80,
  colorLimit: 24,
  mergeThreshold: 30,
  fitMode: 'contain',
  imageScale: 100,
  offsetX: 0,
  offsetY: 0,
  removeBackground: false,
  backgroundThreshold: 50,
  edgeCleanup: true,
  outline: false,
  outlineColor: null,
  skinProtect: false,
  flipped: false,
};

function mapBgThreshold(slider) {
  return Math.round(195 + ((slider - 15) / 75) * 55);
}

const VIEW_TABS = [
  { value: 'original', label: '原图', icon: 'image' },
  { value: 'pattern',  label: '图纸', icon: 'grid' },
  { value: 'beads',    label: '珠子', icon: 'beads' },
];

export default function App() {
  const [image, setImage] = useState(null);
  const [pattern, setPattern] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [viewMode, setViewMode] = useState('pattern');
  const [showCodes, setShowCodes] = useState(true);
  const [highlightCode, setHighlightCode] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);
  const [selectedBrushColor, setSelectedBrushColor] = useState(null);
  const [excludedColors, setExcludedColors] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportSheetOpen, setExportSheetOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const { messages: toastMessages, toast, success, error, remove: removeToast } = useToast();

  const historyRef = useRef({ past: [], future: [] });
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const pushHistory = useCallback(() => {
    const prev = patternRef.current;
    if (!prev) return;
    const h = historyRef.current;
    h.past = [...h.past, prev];
    h.future = [];
    setCanUndo(h.past.length > 0);
    setCanRedo(false);
  }, []);

  const undo = useCallback(() => {
    const h = historyRef.current;
    if (h.past.length === 0) return;
    const previous = h.past.pop();
    h.future = [pattern, ...h.future];
    setPattern(previous);
    setCanUndo(h.past.length > 0);
    setCanRedo(h.future.length > 0);
  }, [pattern]);

  const redo = useCallback(() => {
    const h = historyRef.current;
    if (h.future.length === 0) return;
    const next = h.future.shift();
    h.past = [...h.past, pattern];
    setPattern(next);
    setCanUndo(h.past.length > 0);
    setCanRedo(h.future.length > 0);
  }, [pattern]);

  useEffect(() => {
    const onKey = (e) => {
      // 不在 IME 输入状态才响应
      const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && !isInput) {
        if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
        if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const [paletteSuites, setPaletteSuites] = useState([]);
  const [activePaletteValue, setActivePaletteValue] = useState('mard221');
  const fileInputRef = useRef(null);
  const debounceRef = useRef(null);
  const patternRef = useRef(null);

  useEffect(() => {
    patternRef.current = pattern;
  }, [pattern]);

  useEffect(() => {
    loadPalettes().then(suites => {
      setPaletteSuites(suites);
      try {
        const saved = localStorage.getItem('captain-settings');
        if (saved) {
          const parsed = JSON.parse(saved);
          // 2026-07-30: 默认值调整 (mode=smooth, gridSize=80),老用户的旧默认值作废,强制重新读 DEFAULT_SETTINGS
          // 但保留用户主动修改过的字段 (mode/gridSize 之外的非默认字段,以及 paletteValue)
          const STORAGE_VERSION = '2026-07-30-v2';
          if (parsed.storageVersion !== STORAGE_VERSION) {
            console.info('[captain] 默认值升级,清空 settings 缓存,保留 palette');
            // 不 setSettings 任何东西,完全走 DEFAULT_SETTINGS
            if (parsed.paletteValue) {
              const suite = suites.find(s => s.value === parsed.paletteValue);
              if (suite) {
                setActivePalette(suite.colors);
                setActivePaletteValue(suite.value);
                return;
              }
            }
          } else {
            setSettings(prev => ({ ...prev, ...parsed.settings }));
            if (parsed.paletteValue) {
              const suite = suites.find(s => s.value === parsed.paletteValue);
              if (suite) {
                setActivePalette(suite.colors);
                setActivePaletteValue(suite.value);
                return;
              }
            }
          }
        }
      } catch (e) {
        console.warn('[localStorage] 读取失败:', e);
      }
      const initial = suites.find(s => s.value === 'mard221') || suites[0];
      if (initial) {
        setActivePalette(initial.colors);
        setActivePaletteValue(initial.value);
      }
    });
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      // 撤销 image blob URL 会导致: 切到图纸再切回原图, 原图 src 失效不显示
      // 内存泄漏可接受 (blob URL 会在页面 unload 时自动回收)
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('captain-settings', JSON.stringify({
        settings,
        paletteValue: activePaletteValue,
        storageVersion: '2026-07-30-v2',
        timestamp: Date.now(),
      }));
    } catch (e) {
      console.warn('[localStorage] 写入失败:', e);
    }
  }, [settings, activePaletteValue]);

  const activePalette = useMemo(() => getActivePalette(), [paletteSuites, activePaletteValue]);

  const generate = useCallback(() => {
    if (!image) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setIsGenerating(true);
      requestAnimationFrame(() => {
        try {
          const engineSettings = {
            ...settings,
            backgroundThreshold: mapBgThreshold(settings.backgroundThreshold),
            mergeThreshold: settings.mergeThreshold,
          };
          const result = imageToPattern(image, engineSettings);
          pushHistory();
          setPattern(result);
          setHighlightCode(null);
          setSelectedCell(null);
          setExcludedColors([]);
        } catch (err) {
          console.error('[generate] 失败:', err);
          error('生成失败，请重试或换一张图片');
        } finally {
          setIsGenerating(false);
        }
      });
    }, 300);
  }, [image, settings, pushHistory, error]);

  // deps 是 [image, settings] 原始值,不用 [generate] 函数 ref 防止 setPattern → re-render → generate 新 ref → 重跑 的死循环
  useEffect(() => {
    generate();
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [image, settings]);

  // 自动归档: 每次生成稳定 2 秒后自动保存一份到历史(去重:同 image + gridSize 视为同一份覆盖)
  // 排除 setPattern 不来自 generate 的情况 (例如 onRestore 历史)
  const skipNextAutoArchive = useRef(false);
  useEffect(() => {
    if (!pattern || !image) return;
    if (skipNextAutoArchive.current) {
      skipNextAutoArchive.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const json = patternToJson(pattern);
      // 用 image 字节长 + gridSize 做幂等键
      const dedupKey = `${image.src?.length || 0}_${settings.gridSize}_${json.length}`;
      addHistory({
        id: `auto_${dedupKey}`,
        title: `草图 ${settings.gridSize}×${settings.gridSize}`,
        savedAt: new Date().toISOString(),
        patternJson: json,
        gridSize: pattern.gridSize,
        totalBeads: pattern.totalBeads,
        source: 'auto',
      });
    }, 2000);
    return () => clearTimeout(timer);
  }, [pattern, image, settings.gridSize]);


  const handlePaletteChange = useCallback((value) => {
    const suite = paletteSuites.find(s => s.value === value);
    if (!suite) return;
    setActivePalette(suite.colors);
    setActivePaletteValue(value);
    if (image) generate();
  }, [paletteSuites, image, generate]);

  const handleUploadImage = useCallback((img) => {
    setImage(img);
    setPattern(null);
    setViewMode('pattern');
  }, []);

  const handleCreateBlankCanvas = useCallback(() => {
    const gridSize = settings.gridSize;
    const blankPattern = {
      gridSize,
      pixels: Array.from({ length: gridSize * gridSize }, () => null),
      colors: [],
      totalBeads: 0,
      blankCells: gridSize * gridSize,
    };
    setPattern(blankPattern);
    setImage(null);
    setViewMode('pattern');
  }, [settings.gridSize]);

  const handleSelectCell = useCallback((cell) => {
    setSelectedCell(cell);
  }, []);

  const handlePaintStart = useCallback((cell) => {
    if (!pattern || !selectedBrushColor) return;
    pushHistory();
    setPattern(prev => replaceCellColor(prev, cell.row, cell.col, selectedBrushColor));
  }, [pattern, selectedBrushColor, pushHistory]);

  const handlePaintCell = useCallback((cell) => {
    if (!pattern || !selectedBrushColor) return;
    setPattern(prev => replaceCellColor(prev, cell.row, cell.col, selectedBrushColor));
  }, [pattern, selectedBrushColor]);

  const handleReplaceColor = useCallback((color) => {
    if (!pattern || !selectedBrushColor) {
      error('请先在颜色面板选一个目标色');
      return;
    }
    if (selectedBrushColor.code === color.code) return;
    pushHistory();
    setPattern(prev => replaceColor(prev, color.code, selectedBrushColor));
  }, [pattern, selectedBrushColor, pushHistory, error]);

  const handleRemoveColor = useCallback((code) => {
    setExcludedColors(prev => [...prev, code]);
  }, []);
  const handleRestoreColor = useCallback((code) => {
    setExcludedColors(prev => prev.filter(c => c !== code));
  }, []);

  const handleExportPng = useCallback(() => {
    if (!pattern) {
      error('请先生成图纸');
      return;
    }
    try {
      let exportPattern = pattern;
      for (const code of excludedColors) {
        exportPattern = removeColorFromPattern(exportPattern, code);
      }
      const canvas = renderPattern(exportPattern, '队长拼豆 · 图纸生成器', {
        showCodes,
        gridInterval: 5,
        flipped: settings.flipped,
        highlightCode,
        paletteName: paletteSuites.find(s => s.value === activePaletteValue)?.name || '色卡',
      });
      canvas.toBlob((blob) => {
        if (!blob) {
          error('导出失败，图片格式不支持');
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `captain_${pattern.gridSize}x${pattern.gridSize}_${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
        success('PNG 图纸已下载');
      }, 'image/png');
    } catch (err) {
      console.error('[exportPng] 失败:', err);
      error('导出 PNG 失败，请重试');
    }
  }, [pattern, showCodes, settings.flipped, highlightCode, excludedColors, paletteSuites, activePaletteValue, success, error]);

  const handleExportCsv = useCallback(() => {
    if (!pattern) {
      error('请先生成图纸');
      return;
    }
    try {
      const csv = patternToCsv(pattern);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `captain_colors_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      success('CSV 色号表已下载');
    } catch (err) {
      console.error('[exportCsv] 失败:', err);
      error('导出 CSV 失败，请重试');
    }
  }, [pattern, success, error]);

  const handleExportPurePng = useCallback(() => {
    if (!pattern) {
      error('请先生成图纸');
      return;
    }
    try {
      const canvas = renderPurePattern(pattern, { excludedColors });
      canvas.toBlob((blob) => {
        if (!blob) {
          error('导出失败，图片格式不支持');
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `captain_pure_${pattern.gridSize}x${pattern.gridSize}_${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
        success('纯图案已下载');
      }, 'image/png');
    } catch (err) {
      console.error('[exportPurePng] 失败:', err);
      error('导出纯图案失败，请重试');
    }
  }, [pattern, excludedColors, success, error]);

  const handleExportExcel = useCallback(async () => {
    if (!pattern) {
      error('请先生成图纸');
      return;
    }
    try {
      const data = await patternToExcel(pattern);
      const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `captain_colors_${Date.now()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      success('Excel 色号表已下载');
    } catch (err) {
      console.error('[exportExcel] 失败:', err);
      error('导出 Excel 失败，请重试');
    }
  }, [pattern, success, error]);

  const handleExportJson = useCallback(() => {
    if (!pattern) {
      error('请先生成图纸');
      return;
    }
    try {
      const json = patternToJson(pattern);
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `captain_backup_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      success('JSON 备份已下载');
    } catch (err) {
      console.error('[exportJson] 失败:', err);
      error('导出 JSON 备份失败，请重试');
    }
  }, [pattern, success, error]);

  const handleImportJson = useCallback((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const restored = patternFromJson(e.target.result);
        pushHistory();
        setPattern(restored);
        setImage(null);
        setViewMode('pattern');
        success('备份文件已恢复');
      } catch (err) {
        console.error('[importJson] 失败:', err);
        error('备份文件格式错误，无法恢复');
      }
    };
    reader.readAsText(file);
  }, [pushHistory, success, error]);

  // 直接接收文本 (ExportPanel/EditToolbar 等无法用 FileReader 的场景共用)
  const handleImportJsonString = useCallback((jsonText) => {
    try {
      const restored = patternFromJson(jsonText);
      pushHistory();
      setPattern(restored);
      setImage(null);
      setViewMode('pattern');
      success('备份文件已恢复');
    } catch (err) {
      console.error('[importJsonString] 失败:', err);
      error('备份文件格式错误，无法恢复');
    }
  }, [pushHistory, success, error]);

  // Sidebar 通过 CustomEvent 委托导入, App 这里解析为 pattern
  useEffect(() => {
    const onImport = (e) => {
      try {
        const restored = patternFromJson(e.detail);
        pushHistory();
        setPattern(restored);
        setImage(null);
        setViewMode('pattern');
        success('备份文件已恢复');
      } catch (err) {
        console.error('[importJson] 解析失败:', err);
        error('备份文件格式错误，无法恢复');
      }
    };
    window.addEventListener('captain:import-json', onImport);
    return () => window.removeEventListener('captain:import-json', onImport);
  }, [pushHistory, success, error]);

  const canExport = !!pattern && !isGenerating;
  const hasImage = !!image || !!pattern;

  // 当前 pattern 的 json(用于 HistoryPanel 高亮"已保存")—— 如果没有图片只有历史恢复来的 pattern
  const currentPatternJson = useMemo(() => pattern ? patternToJson(pattern) : null, [pattern]);

  // 历史恢复:把选中的记录还原成 pattern
  const handleRestoreFromHistory = useCallback((entry) => {
    try {
      const restored = patternFromJson(entry.patternJson);
      // 跳过下一次的自动归档(否则会立刻把这个"恢复"再保存一份)
      skipNextAutoArchive.current = true;
      pushHistory();
      setPattern(restored);
      setImage(null);
      setViewMode('pattern');
      setHistoryOpen(false);
      success(`已恢复「${entry.title || '历史草图'}」`);
    } catch (err) {
      console.error('[history] restore fail', err);
      error('恢复失败,记录可能已损坏');
    }
  }, [pushHistory, success, error]);

  // 手动把当前 pattern 另存为一份新历史(不走自动归档)
  const handleSaveCurrentAsHistory = useCallback(() => {
    if (!pattern) return;
    const json = patternToJson(pattern);
    addHistory({
      id: newHistoryId(),
      title: `草图 ${pattern.gridSize}×${pattern.gridSize}`,
      savedAt: new Date().toISOString(),
      patternJson: json,
      gridSize: pattern.gridSize,
      totalBeads: pattern.totalBeads,
      source: 'manual',
    });
    success('已保存到历史记录');
  }, [pattern, success]);

  const openExportSheet = () => { setSettingsOpen(false); setExportSheetOpen(true); };
  const openSettingsSheet = () => { setExportSheetOpen(false); setSettingsOpen(true); };

  const onPickImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Sidebar 在桌面端固定展示; 在移动端则作为 SettingsSheet 的内容
  // 注意: 画笔颜色 / 颜色清单 / 调色板切换 / 撤销重做 / 导出 都已迁到 EditToolbar (画布正下方)
  // Sidebar 只保留"生成参数"配置
  const sidebarProps = {
    settings,
    onChange: (patch) => setSettings(prev => ({ ...prev, ...patch })),
    paletteSuites,
    activePaletteValue,
    onPaletteChange: handlePaletteChange,
    activePalette,
    canExport,
    colors: pattern?.colors,
    highlightCode,
    excludedColors,
    onHighlight: setHighlightCode,
    onReplace: handleReplaceColor,
    onRemove: handleRemoveColor,
    onRestore: handleRestoreColor,
  };

  // EditToolbar props —— 仅图纸视图显示, 是画布的"上下文工具"
  const editToolbarProps = {
    selectedBrushColor,
    onSelectBrushColor: setSelectedBrushColor,
    canUndo,
    canRedo,
    onUndo: undo,
    onRedo: redo,
    colors: pattern?.colors,
    highlightCode,
    excludedColors,
    onHighlight: setHighlightCode,
    onReplace: handleReplaceColor,
    onRemove: handleRemoveColor,
    onRestore: handleRestoreColor,
    activePalette,
    activePaletteValue,
    paletteSuites,
    onPaletteChange: handlePaletteChange,
    onExportPng: handleExportPng,
    onExportPurePng: handleExportPurePng,
    onExportCsv: handleExportCsv,
    onExportExcel: handleExportExcel,
    onExportJson: handleExportJson,
    onImportJson: handleImportJson,
    canExport,
    onSaveToHistory: handleSaveCurrentAsHistory,
    onOpenHistory: () => setHistoryOpen(true),
  };

  // 导出面板 (SettingsSheet 底部固定栏 + 移动端 EditToolbar 弹窗共用)
  const exportProps = {
    canExport,
    onExportPng: handleExportPng,
    onExportPurePng: handleExportPurePng,
    onExportCsv: handleExportCsv,
    onExportExcel: handleExportExcel,
    onExportJson: handleExportJson,
    onImportJson: handleImportJson,
    onImportJsonString: handleImportJsonString,
  };

  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      data-testid="app-image-input"
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        const img = new Image();
        img.onload = () => { handleUploadImage(img); };
        reader.onload = () => { img.src = String(reader.result || ''); };
        reader.readAsDataURL(file);
      }}
      {...(typeof window !== 'undefined' && window.__testHooks?.inputAttrs)}
    />
  );

  return (
    <div className="h-screen flex flex-col bg-[var(--bg-page)]">
      {/* ===== Header (桌面为主, 移动端保留紧凑版) ===== */}
      <header className="commercial-header">
        <BrandMark />
        <div className="commercial-header-text">
          <h1>队长拼豆</h1>
          <p className="hidden sm:block">图纸生成器 · 队长版</p>
        </div>

        {/* 桌面端视图 Tabs */}
        <div className="desktop-view-tabs ml-3">
          {VIEW_TABS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                if (opt.value === 'original' && !image) return;
                setViewMode(opt.value);
              }}
              className={viewMode === opt.value ? 'is-active' : ''}
              disabled={!hasImage || (opt.value === 'original' && !image)}
              title={opt.value === 'original' && !image ? '历史记录未保存原图' : undefined}
            >
              <Icon name={opt.icon} className="w-4 h-4" />
              {opt.label}
            </button>
          ))}
          <label className="ml-2 flex items-center gap-1 text-xs text-[var(--text-secondary)] cursor-pointer">
            <input
              type="checkbox"
              checked={showCodes}
              onChange={e => setShowCodes(e.target.checked)}
              className="accent-[var(--brand-primary)]"
            />
            <span>色号</span>
          </label>
        </div>

        {/* 桌面端状态/撤销/导出 */}
        <div className="commercial-header-actions">
          {isGenerating && (
            <span className="status-line is-loading mr-1 hidden lg:inline-flex">
              <span className="dot" />生成中…
            </span>
          )}
          {!isGenerating && hasImage && (
            <span className="status-line is-ready mr-1 hidden lg:inline-flex">
              <span className="dot" />已生成
            </span>
          )}
          <button
            type="button"
            className="btn-base h-9 px-2.5 text-xs hidden md:inline-flex"
            onClick={undo}
            disabled={!canUndo}
            title="撤销 (Ctrl+Z)"
          >
            ↩<span className="hidden lg:inline ml-1">撤销</span>
          </button>
          <button
            type="button"
            className="btn-base h-9 px-2.5 text-xs hidden md:inline-flex"
            onClick={redo}
            disabled={!canRedo}
            title="重做 (Ctrl+Y)"
          >
            ↪<span className="hidden lg:inline ml-1">重做</span>
          </button>
          <div className="hidden md:block w-px h-5 bg-[var(--border-color)] mx-1" />
          <button
            type="button"
            className="btn-base h-9 px-3 text-xs hidden md:inline-flex"
            onClick={() => fileInputRef.current?.click()}
          >
            <Icon name="upload" className="w-4 h-4" />
            <span className="hidden lg:inline">导入</span>
          </button>
          {/* 历史记录入口 — 桌面端放在桌面设置前 */}
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            aria-label="打开历史记录"
            title="历史记录"
            data-open-history
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                 strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8"/>
              <path d="M3 3v5h5"/>
              <path d="M12 7v5l3 2"/>
            </svg>
            <span className="hidden lg:inline ml-1.5 text-xs">历史</span>
          </button>
          <button
            type="button"
            className="btn-active h-9 px-3 text-xs"
            onClick={openExportSheet}
            disabled={!canExport}
            title="导出多种格式"
          >
            <Icon name="download" className="w-4 h-4" />
            <span className="hidden lg:inline ml-1.5">导出</span>
          </button>
          {/* 打开设置 Sheet (桌面 + 移动端统一入口) */}
          <button
            type="button"
            onClick={openSettingsSheet}
            aria-label="打开生成设置"
          >
            <Icon name="settings" className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ===== 移动端视图 Tabs (在 Header 下方, 主区上方) ===== */}
      <div className="mobile-view-tabs">
        {VIEW_TABS.map(opt => (
          <button
            key={opt.value}
            type="button"
            data-view={opt.value}
            onClick={() => {
              if (opt.value === 'original' && !image) return;
              setViewMode(opt.value);
            }}
            className={viewMode === opt.value ? 'is-active' : ''}
            disabled={!hasImage || (opt.value === 'original' && !image)}
            title={opt.value === 'original' && !image ? '历史记录未保存原图' : undefined}
          >
            <Icon name={opt.icon} />
            <span>{opt.label}</span>
          </button>
        ))}
        {/* 移动端历史入口 — 始终可点 */}
        <button
          type="button"
          aria-label="打开历史记录"
          title="历史记录"
          onClick={() => setHistoryOpen(true)}
          className="md:!hidden"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
               strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8"/>
            <path d="M3 3v5h5"/>
            <path d="M12 7v5l3 2"/>
          </svg>
          <span>历史</span>
        </button>
      </div>

      {/* ===== 主体 ===== */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* 桌面端: 永久显示 Sidebar */}
        <aside className="hidden md:block w-[360px] shrink-0 border-r border-[var(--border-color)] bg-white overflow-y-auto p-4 space-y-4">
          <Sidebar {...sidebarProps} />
        </aside>

        {/* 画布 */}
        <CanvasStage
          image={image}
          pattern={pattern}
          settings={settings}
          viewMode={viewMode}
          showCodes={showCodes}
          flipped={settings.flipped}
          highlightCode={highlightCode}
          selectedCell={selectedCell}
          excludedColors={excludedColors}
          selectedBrushColor={selectedBrushColor}
          onUploadImage={handleUploadImage}
          onSelectCell={handleSelectCell}
          onCellDoubleClick={handlePaintCell}
          onPaintStart={handlePaintStart}
          onPaintCell={handlePaintCell}
          onCreateBlankCanvas={handleCreateBlankCanvas}
          onPickImage={onPickImage}
        />
      </main>

      {/* ===== 画布上下文工具栏 —— 只在图纸视图显示 ===== */}
      {viewMode === 'pattern' && pattern && (
        <EditToolbar {...editToolbarProps} />
      )}

      {/* ===== 移动端底部操作栏 ===== */}
      <MobileActionBar
        onOpenSettings={() => { setExportSheetOpen(false); setSettingsOpen(true); }}
        onPickImage={onPickImage}
        onExport={() => { setSettingsOpen(false); setExportSheetOpen(true); }}
        canExport={canExport}
        hasImage={hasImage}
      />

      {/* ===== 设置 Sheet (移动端主入口, 桌面端通过"更多菜单"调用) ===== */}
      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      >
        <Sidebar {...sidebarProps} />
      </SettingsSheet>

      {/* ===== 导出 Sheet (移动端独立抽屉, 与设置互斥) ===== */}
      <SettingsSheet
        open={exportSheetOpen}
        onClose={() => setExportSheetOpen(false)}
        title="导出与备份"
        subtitle="保存图纸、色号表与备份文件"
      >
        <ExportPanel {...exportProps} />
      </SettingsSheet>

      {/* ===== 历史记录抽屉 ===== */}
      <HistoryPanel
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        currentPatternJson={currentPatternJson}
        onRestore={handleRestoreFromHistory}
      />

      {fileInput}
      <Toast messages={toastMessages} onRemove={removeToast} />
    </div>
  );
}
