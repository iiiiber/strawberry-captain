import { Icon } from './icons.jsx';

/**
 * 移动端底部操作栏 (固定三按钮 + 设置/上传/导出)
 */
export default function MobileActionBar({
  onOpenSettings,
  onPickImage,
  onExport,
  canExport,
  activeView,
  onChangeView,
  hasImage,
}) {
  return (
    <nav className="mobile-actionbar" aria-label="主要操作">
      <button
        type="button"
        onClick={onOpenSettings}
        aria-label="打开生成设置"
      >
        <Icon name="settings" />
        <span>设置</span>
      </button>
      <button
        type="button"
        onClick={onPickImage}
        aria-label="选择图片"
        data-upload
      >
        <Icon name="upload" />
        <span>{hasImage ? '换张图片' : '选择图片'}</span>
      </button>
      <button
        type="button"
        onClick={onExport}
        aria-label="导出图纸"
        disabled={!canExport}
        className={!canExport ? 'btn-disabled' : ''}
      >
        <Icon name="download" />
        <span>导出</span>
      </button>
    </nav>
  );
}
