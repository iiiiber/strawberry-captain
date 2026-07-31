// 通用浏览器侧下载工具
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 留 1s 让浏览器落实下载再回收
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadFile(text, filename, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  downloadBlob(blob, filename);
}

export function formatTime(input) {
  if (!input) return '未保存';
  const d = new Date(input);
  if (isNaN(d.getTime())) return '未保存';
  const now = Date.now();
  const diff = (now - d.getTime()) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)} 天前`;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
