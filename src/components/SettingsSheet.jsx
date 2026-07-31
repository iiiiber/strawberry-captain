import { useEffect } from 'react';
import { Icon } from './icons.jsx';

export default function SettingsSheet({ open, onClose, children, footer, title = '生成设置', subtitle = '调整图纸、色板与导出' }) {
  // 切换 body 锁滚
  useEffect(() => {
    if (open) {
      document.body.classList.add('settings-open');
    } else {
      document.body.classList.remove('settings-open');
    }
    return () => {
      document.body.classList.remove('settings-open');
    };
  }, [open]);

  // Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="settings-scrim"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="mobile-sheet pointer-events-auto"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mobile-sheet-heading">
          <div className="grabber" aria-hidden="true" />
          <div className="title">
            <strong>{title}</strong>
            <small>{subtitle}</small>
          </div>
          <button
            type="button"
            className="close pointer-events-auto"
            onClick={onClose}
            aria-label="关闭"
          >
            <Icon name="close" />
          </button>
        </div>
        {/* 外层 pointer-events: auto, 防止 fixed 容器默认拦截 form 控件的点击 */}
        <div className="mobile-sheet-body pointer-events-auto">{children}</div>
        {footer && (
          <div className="mobile-sheet-footer pointer-events-auto" style={{
            borderTop: '1px solid var(--border-color)',
            padding: '12px 16px',
            paddingBottom: 'calc(12px + var(--action-bar-h, 0px) + env(safe-area-inset-bottom, 0px))',
            background: 'var(--bg-elevated)',
            flexShrink: 0,
          }}>{footer}</div>
        )}
      </div>
    </>
  );
}
