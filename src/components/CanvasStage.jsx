import { useEffect, useRef, useState, useCallback } from 'react';
import { drawPatternToCanvas } from '../lib/patternEngine.js';
import { Icon } from './icons.jsx';

/**
 * 画布主区
 * - 无图状态: 商用上传卡 + 空白画布卡 + 信任行
 * - 有图状态: 显示对应视图 (原图/图纸/珠子)
 * - 视图内交互: 鼠标拖拽/滚轮缩放/双指缩放/选涂
 */
export default function CanvasStage({
  image,
  pattern,
  settings,
  viewMode,
  showCodes,
  flipped,
  highlightCode,
  selectedCell,
  excludedColors,
  selectedBrushColor,
  onUploadImage,
  onSelectCell,
  onCellDoubleClick,
  onPaintStart,
  onPaintCell,
  onCreateBlankCanvas,
  onPickImage,
}) {
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const fileInputRef = useRef(null);
  const debounceRef = useRef(null);
  const fitTimerRef = useRef(null);
  const [hover, setHover] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [cellSize, setCellSize] = useState(16);

  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // 内部 fit 函数 (供多个事件复用) —— 不依赖 state, 用 ref 闭包
  const fitRef = useRef(() => {});
  fitRef.current = () => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas || !canvas.width || !canvas.height) return;
    const isMobile = window.innerWidth < 768;
    const fitScale = Math.min(
      (wrapper.clientWidth - 32) / canvas.width,
      (wrapper.clientHeight - 32) / canvas.height,
      isMobile ? 1 : 1.5
    );
    const visualW = canvas.width * fitScale;
    const visualH = canvas.height * fitScale;
    setScale(fitScale);
    setPan({
      x: (wrapper.clientWidth - visualW) / 2,
      y: (wrapper.clientHeight - visualH) / 2,
    });
  };

  // 防抖 fit (150ms) —— resize / 容器尺寸变化都走这条
  const fitDebounced = useCallback(() => {
    if (fitTimerRef.current) clearTimeout(fitTimerRef.current);
    fitTimerRef.current = setTimeout(() => {
      fitTimerRef.current = null;
      fitRef.current();
    }, 150);
  }, []);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOrigin = useRef({ x: 0, y: 0 });

  const [isPainting, setIsPainting] = useState(false);
  const lastPainted = useRef(null);
  const justPainted = useRef(false);

  const [isTouchPanning, setIsTouchPanning] = useState(false);
  const [isTouchPainting, setIsTouchPainting] = useState(false);
  const touchStartDist = useRef(0);
  const touchStartScale = useRef(1);
  const touchStartPan = useRef({ x: 0, y: 0 });
  const touchStartCenter = useRef({ x: 0, y: 0 });
  const activeTouchId = useRef(null);

  // 渲染 pattern 到 canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (viewMode === 'original' || !pattern) {
      canvas.style.display = 'none';
      return;
    }
    canvas.style.display = 'block';
    const { cellSize: cs } = drawPatternToCanvas(canvas, pattern, {
      mode: viewMode === 'beads' ? 'beads' : 'pattern',
      showCodes,
      gridInterval: 5,
      highlightCode,
      selectedCell,
      flipped,
      excludedColors,
    });
    // 守卫: cs 未变则不触发 setState,避免 re-render → useEffect 重跑 死循环
    setCellSize(prev => prev === cs ? prev : cs);
  }, [pattern, viewMode, showCodes, highlightCode, selectedCell, flipped, excludedColors]);

  // 图片/pattern 变化: 重置缩放与平移 + 下次浏览器绘制时 fit
  useEffect(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
    const id = requestAnimationFrame(() => {
      if (fitTimerRef.current) clearTimeout(fitTimerRef.current);
      fitRef.current();
    });
    return () => cancelAnimationFrame(id);
  }, [image, pattern]);

  // ResizeObserver: wrapper 尺寸变 → 防抖 fit (避免 iOS 软键盘/地址栏导致频繁抖动)
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const ro = new ResizeObserver(() => fitDebounced());
    ro.observe(wrapper);
    window.addEventListener('orientationchange', fitDebounced);
    return () => {
      ro.disconnect();
      window.removeEventListener('orientationchange', fitDebounced);
    };
  }, [fitDebounced]);

  // 屏幕坐标 → canvas 逻辑坐标 (考虑缩放和平移)
  const toCanvasCoord = useCallback((clientX, clientY) => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas || !pattern) return null;
    const rect = wrapper.getBoundingClientRect();
    const x = (clientX - rect.left - pan.x) / scale;
    const y = (clientY - rect.top - pan.y) / scale;
    return { x, y };
  }, [pattern, scale, pan]);

  // 命中检测 → row/col
  const pickCell = useCallback((evt) => {
    const canvas = canvasRef.current;
    if (!canvas || !pattern) return null;
    const pos = toCanvasCoord(evt.clientX, evt.clientY);
    if (!pos) return null;
    let x = pos.x;
    let y = pos.y;
    if (flipped) x = canvas.width - x;
    const col = Math.floor(x / cellSize);
    const row = Math.floor(y / cellSize);
    if (row < 0 || row >= pattern.gridSize || col < 0 || col >= pattern.gridSize) return null;
    return { row, col };
  }, [pattern, cellSize, flipped, toCanvasCoord]);

  // 滚轮缩放
  const onWheel = useCallback((evt) => {
    evt.preventDefault();
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const mouseX = evt.clientX - rect.left;
    const mouseY = evt.clientY - rect.top;
    const delta = evt.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(scale * delta, 0.2), 5);
    const scaleRatio = newScale / scale;
    const newPanX = mouseX - (mouseX - pan.x) * scaleRatio;
    const newPanY = mouseY - (mouseY - pan.y) * scaleRatio;
    setScale(newScale);
    setPan({ x: newPanX, y: newPanY });
  }, [scale, pan]);

  const onMouseDown = useCallback((evt) => {
    if (evt.button === 1 || (evt.button === 0 && evt.shiftKey)) {
      evt.preventDefault();
      setIsPanning(true);
      panStart.current = { x: evt.clientX, y: evt.clientY };
      panOrigin.current = { ...pan };
    } else if (evt.button === 0 && selectedBrushColor) {
      setIsPainting(true);
      const cell = pickCell(evt);
      if (cell) {
        lastPainted.current = `${cell.row},${cell.col}`;
        // 桌面端单击改色由 onCanvasClick 负责 — 防止 mouseup 后 click + onPaintCell 双调
      }
    }
  }, [pan, selectedBrushColor, pickCell]);

  const onMouseMove = useCallback((evt) => {
    if (isPanning) {
      const dx = evt.clientX - panStart.current.x;
      const dy = evt.clientY - panStart.current.y;
      setPan({ x: panOrigin.current.x + dx, y: panOrigin.current.y + dy });
    } else if (isPainting) {
      const cell = pickCell(evt);
      if (cell) {
        const key = `${cell.row},${cell.col}`;
        if (key !== lastPainted.current) {
          lastPainted.current = key;
          onPaintCell?.(cell);
        }
      }
    } else {
      setHover(pickCell(evt));
    }
  }, [isPanning, isPainting, pickCell, onPaintCell]);

  const onMouseUp = useCallback(() => {
    setIsPanning(false);
    setIsPainting(false);
    lastPainted.current = null;
    setTimeout(() => { justPainted.current = false; }, 100);
  }, []);

  useEffect(() => {
    if (!isPanning && !isPainting) return;
    const handleUp = () => {
      setIsPanning(false);
      setIsPainting(false);
      lastPainted.current = null;
      setTimeout(() => { justPainted.current = false; }, 100);
    };
    window.addEventListener('mouseup', handleUp);
    return () => window.removeEventListener('mouseup', handleUp);
  }, [isPanning, isPainting]);

  // ===== 触摸事件 =====
  const getTouchDist = (touches) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };
  const getTouchCenter = (touches, wrapper) => {
    const rect = wrapper.getBoundingClientRect();
    const cx = (touches[0].clientX + touches[1].clientX) / 2 - rect.left;
    const cy = (touches[0].clientY + touches[1].clientY) / 2 - rect.top;
    return { x: cx, y: cy };
  };

  const onTouchStart = useCallback((evt) => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const touches = evt.touches;
    if (touches.length === 2) {
      evt.preventDefault();
      touchStartDist.current = getTouchDist(touches);
      touchStartScale.current = scale;
      touchStartCenter.current = getTouchCenter(touches, wrapper);
      touchStartPan.current = { ...pan };
      activeTouchId.current = null;
    } else if (touches.length === 1) {
      const touch = touches[0];
      if (selectedBrushColor) {
        evt.preventDefault();
        setIsTouchPainting(true);
        activeTouchId.current = touch.identifier;
        // 注意: 不在这里调 onPaintStart — click 事件会触发 onCanvasClick 改色
        // (避免 touchstart -> click 双调, history 推两条)
        const cell = pickCell({ clientX: touch.clientX, clientY: touch.clientY });
        if (cell) {
          lastPainted.current = `${cell.row},${cell.col}`;
          justPainted.current = true;
        }
      } else {
        evt.preventDefault();
        setIsTouchPanning(true);
        activeTouchId.current = touch.identifier;
        panStart.current = { x: touch.clientX, y: touch.clientY };
        panOrigin.current = { ...pan };
      }
    }
  }, [scale, pan, selectedBrushColor, pickCell]);

  const onTouchMove = useCallback((evt) => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const touches = evt.touches;
    if (touches.length === 2 && touchStartDist.current > 0) {
      evt.preventDefault();
      const newDist = getTouchDist(touches);
      const newScale = Math.min(Math.max(touchStartScale.current * (newDist / touchStartDist.current), 0.2), 5);
      const center = touchStartCenter.current;
      const scaleRatio = newScale / touchStartScale.current;
      const newPanX = center.x - (center.x - touchStartPan.current.x) * scaleRatio;
      const newPanY = center.y - (center.y - touchStartPan.current.y) * scaleRatio;
      setScale(newScale);
      setPan({ x: newPanX, y: newPanY });
    } else if (touches.length === 1 && activeTouchId.current !== null) {
      const touch = touches[0];
      if (touch.identifier !== activeTouchId.current) return;
      if (isTouchPanning) {
        evt.preventDefault();
        const dx = touch.clientX - panStart.current.x;
        const dy = touch.clientY - panStart.current.y;
        setPan({ x: panOrigin.current.x + dx, y: panOrigin.current.y + dy });
      } else if (isTouchPainting) {
        evt.preventDefault();
        const cell = pickCell({ clientX: touch.clientX, clientY: touch.clientY });
        if (cell) {
          const key = `${cell.row},${cell.col}`;
          if (key !== lastPainted.current) {
            lastPainted.current = key;
            onPaintCell?.(cell);
          }
        }
      }
    }
  }, [isTouchPanning, isTouchPainting, pickCell, onPaintCell]);

  const onTouchEnd = useCallback((evt) => {
    if (evt.touches.length === 0) {
      setIsTouchPanning(false);
      setIsTouchPainting(false);
      lastPainted.current = null;
      activeTouchId.current = null;
      touchStartDist.current = 0;
      setTimeout(() => { justPainted.current = false; }, 100);
    }
  }, []);

  const handleFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    const img = new Image();
    img.onload = () => onUploadImage(img);
    reader.onload = () => { img.src = String(reader.result || ''); };
    reader.readAsDataURL(file);
  }, [onUploadImage]);


  useEffect(() => {
    // 撤销 image blob URL 是危险的: 上传原图后切换图纸再切回原图, image 元素 src 失效, 原图消失
    // 内存泄漏可接受 — 用户上传新图时旧图 blob URL 会被自动 GC
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const onDrop = (evt) => {
    evt.preventDefault();
    setDragOver(false);
    handleFile(evt.dataTransfer.files?.[0]);
  };
  const onDragOver = (evt) => { evt.preventDefault(); setDragOver(true); };
  const onDragLeave = () => setDragOver(false);

  // 单击 / 双击 canvas: 选 cell + 若有选中画笔色则改色
  // 移动端 touchstart 的 preventDefault 在 iOS Safari 受 passive listener 限制,
  // 这里用 click 兼容: 单击同时改色 + 选中
  const onCanvasClick = (evt) => {
    if (isPanning || isTouchPanning) return;
    const cell = pickCell(evt);
    if (!cell) return;
    onSelectCell(cell);
    if (selectedBrushColor) {
      onPaintCell?.(cell);
    }
  };
  const onCanvasDoubleClick = (evt) => {
    const cell = pickCell(evt);
    if (cell) onCellDoubleClick?.(cell);
  };
  const onCanvasLeave = () => setHover(null);

  // 缩放控制
  const zoomIn = () => setScale(s => Math.min(s * 1.2, 5));
  const zoomOut = () => setScale(s => Math.max(s / 1.2, 0.2));
  const zoomReset = () => { setScale(1); setPan({ x: 0, y: 0 }); };
  const zoomFit = () => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) return;
    const s = Math.min(
      (wrapper.clientWidth - 48) / canvas.width,
      (wrapper.clientHeight - 48) / canvas.height,
      1
    );
    setScale(s);
    setPan({ x: 0, y: 0 });
  };

  const isEmpty = !image && !pattern;
  const transformStyle = {
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
    transformOrigin: '0 0',
  };

  return (
    <section
      className="flex-1 relative overflow-hidden bg-[var(--bg-page)]"
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        data-testid="canvas-image-input"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {isEmpty ? (
        <div className="commercial-empty-state">
          <div className="commercial-empty-card">
            {/* 上传主卡 */}
            <button
              type="button"
              className={`commercial-upload-card card-button ${dragOver ? 'is-drag' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              aria-label="上传图片，生成拼豆图纸"
            >
              <div className="icon">
                <Icon name="upload" />
              </div>
              <h2 className="text-center md:text-left">上传图片，生成拼豆图纸</h2>
              <p className="help text-center md:text-left">支持照片、插画与像素图，自动转换为带色号的拼豆底稿</p>
              <span className="meta">选择图片</span>
              <small className="block mt-2 text-center md:text-left text-[11px] text-[var(--text-muted)] font-normal">
                JPG / PNG · 图片仅在本机处理
              </small>
            </button>

            {/* 或 - 分隔线 */}
            <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
              <div className="flex-1 h-px bg-[var(--border-color)]" />
              <span>或</span>
              <div className="flex-1 h-px bg-[var(--border-color)]" />
            </div>

            {/* 空白画布卡 */}
            <button
              type="button"
              className="commercial-blank-card card-button"
              onClick={(e) => {
                e.stopPropagation();
                onCreateBlankCanvas?.();
              }}
              aria-label="创建空白画布"
            >
              <div className="icon"><Icon name="blank" /></div>
              <div className="text">
                <strong>创建空白画布</strong>
                <small>适合手动绘制与设计 · {settings.gridSize}×{settings.gridSize}</small>
              </div>
              <span className="chev">›</span>
            </button>

            {/* 信任行 */}
            <div className="commercial-trust-row">
              <span>自动匹配品牌色号</span>
              <span>多种量化模式</span>
              <span>PNG / Excel / CSV 导出</span>
            </div>
          </div>
        </div>
      ) : viewMode === 'original' ? (
        <div className="w-full h-full flex items-center justify-center p-4 md:p-6">
          <div className="card p-3 md:p-4 max-w-full max-h-full overflow-auto">
            <img
              src={image?.src || ''}
              alt="原图"
              className="max-w-full max-h-[calc(100vh-160px)] md:max-h-[calc(100vh-200px)] object-contain"
            />
          </div>
        </div>
      ) : (
        <>
          <div
            ref={wrapperRef}
            className="absolute inset-0 overflow-hidden touch-none"
            onWheel={onWheel}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            style={{ cursor: isPanning ? 'grabbing' : 'crosshair' }}
          >
            <canvas
              ref={canvasRef}
              onClick={onCanvasClick}
              onDoubleClick={onCanvasDoubleClick}
              onMouseLeave={onCanvasLeave}
              className="shadow-md"
              style={transformStyle}
            />
          </div>

          {/* 缩放控件 */}
          <div className="zoom-controls">
            <button onClick={zoomOut} title="缩小">−</button>
            <span className="value">{Math.round(scale * 100)}%</span>
            <button onClick={zoomIn} title="放大">+</button>
            <div className="divider" />
            <button onClick={zoomFit} title="适应窗口" className="inline-flex text-xs px-2">适应</button>
            <button onClick={zoomReset} title="重置" className="hidden md:inline-flex text-xs px-2">1:1</button>
          </div>

          {/* 信息胶囊 */}
          <div className="info-pill">
            <span>{pattern?.gridSize}×{pattern?.gridSize}</span>
            <span className="sep" />
            <span>{pattern?.colors.length} 色</span>
            <span className="sep" />
            <span>{pattern?.totalBeads} 颗</span>
            {hover && (
              <>
                <span className="sep" />
                <span className="font-mono">[{hover.row}, {hover.col}]</span>
              </>
            )}
          </div>

          {/* 提示 — 电脑端 */}
          <div className="canvas-hint hidden md:block">
            滚轮缩放 · 左键涂抹{selectedBrushColor ? ' ✓' : ' (先选画笔色)'} · 中键/Shift+拖拽平移
          </div>
          {/* 提示 — 手机端 */}
          <div className="canvas-hint md:hidden">
            双指缩放 · 单指{selectedBrushColor ? '涂抹 ✓' : '平移'} · 选色后涂抹
          </div>
        </>
      )}
    </section>
  );
}
