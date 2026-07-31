import { useEffect, useState, useCallback } from 'react';
import { listHistory, removeHistory, renameHistory, clearHistory } from '../lib/history';
import { getActivePalette, BEAD_PALETTE } from '../lib/palette';
import { downloadFile, formatTime } from '../lib/downloadFile';
import { patternFromJson } from '../lib/patternEngine';

function HistoryThumbnail({ patternJson, title }) {
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    try {
      const pattern = patternFromJson(patternJson);
      const size = pattern?.gridSize || 0;
      const pixels = pattern?.pixels;
      if (!size || !Array.isArray(pixels)) throw new Error('invalid pattern');
      setPreview({
        size,
        cells: pixels.slice(0, size * size).map((cell) => {
          const hex = typeof cell === 'string' ? cell : cell?.hex;
          return /^#[0-9a-f]{6}$/i.test(hex || '') ? hex : null;
        }),
      });
    } catch {
      setPreview(null);
    }
  }, [patternJson]);

  if (!preview) {
    return <div className="history-thumbnail history-thumbnail-empty" aria-label={`${title}预览不可用`}>×</div>;
  }
  return (
    <div className="history-thumbnail" role="img" aria-label={`${title}缩略图`}
         style={{ gridTemplateColumns: `repeat(${preview.size}, 1fr)` }}>
      {preview.cells.map((hex, index) => (
        <span key={index} style={{ backgroundColor: hex || 'transparent' }} />
      ))}
    </div>
  );
}

const ICON_HISTORY = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8"/>
    <path d="M3 3v5h5"/>
    <path d="M12 7v5l3 2"/>
  </svg>
);
const ICON_TRASH = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
  </svg>
);
const ICON_PENCIL = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9"/>
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
  </svg>
);
const ICON_RESTORE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10"/>
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
  </svg>
);
const ICON_X = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

/**
 * HistoryPanel — 历史记录侧滑抽屉
 * props:
 *   open: bool
 *   onClose: () => void
 *   currentPatternJson: string | null (用于高亮"已保存到记录"的 pattern)
 *   onRestore: (entry) => void
 */
export function HistoryPanel({ open, onClose, currentPatternJson, onRestore }) {
  const [items, setItems] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');

  const refresh = useCallback(() => {
    setItems(listHistory());
  }, []);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  // 关闭后清掉编辑态
  useEffect(() => {
    if (!open) {
      setEditingId(null);
      setEditingTitle('');
    }
  }, [open]);

  // Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleDelete = (id) => {
    if (!confirm('确认删除这条历史记录？')) return;
    removeHistory(id);
    refresh();
  };

  const handleClearAll = () => {
    if (!confirm('确认清空全部历史记录？(将不可恢复)')) return;
    clearHistory();
    refresh();
  };

  const handleRename = (id, currentTitle) => {
    setEditingId(id);
    setEditingTitle(currentTitle || '');
  };

  const handleRenameCommit = (id) => {
    const t = editingTitle.trim();
    if (t) renameHistory(id, t);
    setEditingId(null);
    setEditingTitle('');
    refresh();
  };

  // 调色板把 "code -> {hex,name}" 转换为查表方便预览
  const colorMap = (() => {
    const m = {};
    try {
      const pal = getActivePalette ? getActivePalette() : null;
      if (Array.isArray(pal)) {
        for (const c of pal) m[c.code] = c;
      } else if (Array.isArray(BEAD_PALETTE)) {
        for (const c of BEAD_PALETTE) m[c.code] = c;
      }
    } catch {}
    return m;
  })();

  return (
    <>
      <div
        onClick={onClose}
        className={`history-overlay ${open ? 'open' : ''}`}
        aria-hidden={!open}
      />
      <aside
        className={`history-panel ${open ? 'open' : ''}`}
        role="dialog"
        aria-label="历史记录"
      >
        <header className="history-panel-header">
          <div className="flex items-center gap-2">
            {ICON_HISTORY}
            <h3 className="text-base font-semibold">历史记录</h3>
            <span className="text-xs text-muted">{items.length} 条</span>
          </div>
          <button
            className="history-close-btn"
            onClick={onClose}
            aria-label="关闭"
            type="button"
          >
            {ICON_X}
          </button>
        </header>

        <div className="history-panel-body">
          {items.length === 0 ? (
            <div className="history-empty">
              <div className="history-empty-icon">{ICON_HISTORY}</div>
              <p className="text-sm font-medium mb-1">还没有记录</p>
              <p className="text-xs text-muted leading-relaxed">
                上传图片生成图纸后，点击右上「保存」按钮即可加入历史记录
              </p>
            </div>
          ) : (
            <>
              <div className="flex justify-end mb-3">
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="btn-base text-xs"
                  title="清空全部"
                >
                  {ICON_TRASH}清空全部
                </button>
              </div>
              <ul className="space-y-2">
                {items.map((it) => {
                  const isCurrent =
                    currentPatternJson && it.patternJson === currentPatternJson;
                  const isEditing = editingId === it.id;
                  let parsedColors = [];
                  try {
                    const p = JSON.parse(it.patternJson);
                    if (Array.isArray(p.colors)) parsedColors = p.colors.slice(0, 12);
                  } catch {}
                  return (
                    <li
                      key={it.id}
                      className={`history-item ${isCurrent ? 'is-current' : ''}`}
                    >
                      <HistoryThumbnail patternJson={it.patternJson} title={it.title || '历史草图'} />
                      <div className="history-item-main">
                        {isEditing ? (
                          <input
                            className="input-base w-full"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onBlur={() => handleRenameCommit(it.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRenameCommit(it.id);
                              if (e.key === 'Escape') {
                                setEditingId(null);
                                setEditingTitle('');
                              }
                            }}
                            autoFocus
                          />
                        ) : (
                          <div className="history-item-title">
                            {it.title || `草图 ${formatTime(it.savedAt)}`}
                          </div>
                        )}
                        <div className="history-item-meta">
                          <span>{formatTime(it.savedAt)}</span>
                          {it.gridSize ? <span>· {it.gridSize}×{it.gridSize}</span> : null}
                          {typeof it.totalBeads === 'number' ? (
                            <span>· {it.totalBeads} 颗</span>
                          ) : null}
                          {isCurrent ? <span className="history-current-tag">当前</span> : null}
                        </div>
                        {parsedColors.length > 0 ? (
                          <div className="history-item-colors">
                            {parsedColors.map((c, i) => (
                              <span
                                key={i}
                                className="history-color-dot"
                                title={c.code}
                                style={{
                                  background:
                                    (colorMap[c.code] && colorMap[c.code].hex) ||
                                    c.hex ||
                                    '#ccc',
                                }}
                              />
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="history-item-actions">
                        <button
                          type="button"
                          onClick={() => onRestore(it)}
                          className="history-action history-action-primary"
                          title="恢复"
                        >
                          {ICON_RESTORE}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleRename(it.id, it.title || `草图 ${formatTime(it.savedAt)}`)
                          }
                          className="history-action"
                          title="重命名"
                        >
                          {ICON_PENCIL}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(it.id)}
                          className="history-action history-action-danger"
                          title="删除"
                        >
                          {ICON_TRASH}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
