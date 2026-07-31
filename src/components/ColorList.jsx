import { useState, useMemo } from 'react';

/**
 * 颜色清单
 * - 搜索框: 按色号/色名/hex 筛选
 * - 点击: 高亮该色 cells
 * - 替换按钮: 触发 onReplace
 * - 删除按钮: 触发 onRemove (软删除: 该色 cells 变空白格)
 * - 软删除的色卡灰显, 可恢复
 */
export default function ColorList({
  colors,
  highlightCode,
  excludedColors,
  onHighlight,
  onReplace,
  onRemove,
  onRestore,
}) {
  const [search, setSearch] = useState('');

  if (!colors?.length) {
    return (
      <div className="card p-4 text-center">
        <p className="text-sm text-text-muted">尚无颜色数据 · 上传图片后自动生成</p>
      </div>
    );
  }

  const excludedSet = new Set(excludedColors);

  const filteredColors = useMemo(() => {
    if (!search.trim()) return colors;
    const query = search.toLowerCase();
    return colors.filter(c =>
      c.code.toLowerCase().includes(query) ||
      (c.name && c.name.toLowerCase().includes(query)) ||
      c.hex.toLowerCase().includes(query)
    );
  }, [colors, search]);

  return (
    <div className="card p-3">
      <header className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-sm font-semibold text-text-primary">颜色清单</h2>
        <span className="text-xs text-text-muted">{filteredColors.length} 色</span>
      </header>
      <div className="mb-2">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="搜索色号、色名..."
          className="input-base w-full text-xs"
        />
      </div>
      <div className="grid grid-cols-2 gap-2 max-h-[240px] overflow-y-auto pr-1">
        {filteredColors.map(color => {
          const excluded = excludedSet.has(color.code);
          const highlighted = highlightCode === color.code;
          return (
            <div
              key={color.code}
              className={`relative rounded-btn border overflow-hidden transition cursor-pointer ${
                highlighted ? 'border-primary-500 ring-1 ring-primary-400' : 'border-border hover:border-primary-400'
              } ${excluded ? 'opacity-40' : ''}`}
              onClick={() => onHighlight(highlighted ? null : color.code)}
            >
              <div className="flex items-center gap-2 p-2">
                <div
                  className="w-8 h-8 rounded shrink-0 border border-black/10"
                  style={{ backgroundColor: color.hex }}
                  title={color.hex}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-xs font-bold text-text-primary truncate">{color.code}</div>
                  <div className="text-[10px] text-text-secondary">{color.count} 颗</div>
                </div>
              </div>
              {!excluded ? (
                <div className="flex border-t border-border text-[10px]">
                  <button
                    className="flex-1 py-1 hover:bg-primary-50 hover:text-primary-600 transition"
                    onClick={(e) => { e.stopPropagation(); onReplace(color); }}
                  >
                    替换
                  </button>
                  <button
                    className="flex-1 py-1 border-l border-border hover:bg-red-50 hover:text-red-600 transition"
                    onClick={(e) => { e.stopPropagation(); onRemove(color.code); }}
                  >
                    删除
                  </button>
                </div>
              ) : (
                <button
                  className="w-full py-1 border-t border-border text-[10px] hover:bg-primary-50 hover:text-primary-600 transition"
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
