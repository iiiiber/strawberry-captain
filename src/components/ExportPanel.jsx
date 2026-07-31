import { useState, useRef } from 'react';
import { Icon } from './icons.jsx';

/**
 * 导出与备份面板 —— 与 Sidebar "色板与导出" 一致, 但展开为 2x2 网格
 * 同时也是用户在 SettingsSheet 里的"主导出入口"
 *
 * 包含:
 *   - PNG 图纸 (带网格/标题/色号)  - 默认推荐, 应用最广
 *   - PNG 纯图案 (无网格)
 *   - CSV 色号表 (色号→颗数, Excel/电子表格通用)
 *   - Excel 色号表 (多 sheet, 汇总+色卡)
 *   - JSON 备份 (完整恢复: 图纸+色板+设置)
 *   - 导入备份 (从 JSON 还原)
 */
export default function ExportPanel({
  canExport,
  onExportPng,
  onExportPurePng,
  onExportCsv,
  onExportExcel,
  onExportJson,
  onImportJson,
  onImportJsonString,
}) {
  const importFileRef = useRef(null);

  const onPickFile = () => importFileRef.current?.click();

  return (
    <section className="card pointer-events-auto">
      <header className="flex items-center justify-between px-4 py-3 select-none">
        <h2 className="text-sm font-semibold text-text-primary">
          导出与备份
        </h2>
        <span className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-muted)] rounded-pill px-2 py-0.5">
          {canExport ? '可导出' : '先生成图纸'}
        </span>
      </header>

      <div className="px-4 pb-4 pt-1 space-y-3">
        {/* 主导出 5 种格式 (2 列 grid) */}
        <div className="grid grid-cols-2 gap-2">
          <ExportButton
            icon="download"
            title="PNG 图纸"
            subtitle="带网格/色号"
            primary
            disabled={!canExport}
            onClick={onExportPng}
          />
          <ExportButton
            icon="image"
            title="PNG 纯图案"
            subtitle="无网格"
            disabled={!canExport}
            onClick={onExportPurePng}
          />
          <ExportButton
            icon="share"
            title="Excel 色号"
            subtitle=".xlsx 多 sheet"
            disabled={!canExport}
            onClick={onExportExcel}
          />
          <ExportButton
            icon="beads"
            title="CSV 色号"
            subtitle="通用表格"
            disabled={!canExport}
            onClick={onExportCsv}
          />
        </div>

        {/* 备份与还原 (整行) */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            disabled={!canExport}
            onClick={onExportJson}
            className="btn-base h-9 px-3 text-xs inline-flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Icon name="share" className="w-4 h-4" />
            <span>JSON 备份</span>
          </button>
          <button
            type="button"
            onClick={onPickFile}
            className="btn-base h-9 px-3 text-xs inline-flex items-center justify-center gap-1.5"
          >
            <Icon name="upload" className="w-4 h-4" />
            <span>导入备份</span>
          </button>
          <input
            ref={importFileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                if (onImportJsonString) {
                  const reader = new FileReader();
                  reader.onload = (ev) => onImportJsonString(ev.target.result);
                  reader.readAsText(file);
                } else if (onImportJson) {
                  onImportJson(file);
                }
              }
              e.target.value = '';
            }}
          />
        </div>

        <p className="text-[10px] text-[var(--text-muted)] leading-relaxed pt-1">
          PNG 图纸推荐: 可直接发工厂/朋友圈。Excel 适合汇总采购清单。JSON 备份可完整还原图纸+色板+设置。
        </p>
      </div>
    </section>
  );
}

function ExportButton({ icon, title, subtitle, primary, disabled, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={
        primary
          ? 'btn-active h-12 px-3 text-xs flex flex-col items-center justify-center gap-0.5 disabled:opacity-40 disabled:cursor-not-allowed'
          : 'btn-base h-12 px-3 text-xs flex flex-col items-center justify-center gap-0.5 disabled:opacity-40 disabled:cursor-not-allowed'
      }
    >
      <Icon name={icon} className="w-4 h-4" />
      <span className="font-semibold">{title}</span>
      <span className="text-[9px] opacity-75">{subtitle}</span>
    </button>
  );
}
