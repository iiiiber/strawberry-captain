// src/lib/history.js
// 历史记录的持久化层 —— 草图板完成时序列化到 localStorage
// 单条记录是 patternToJson 的输出,但增加了 id/title/savedAt

const KEY = 'captain-history';
const MAX = 50;

function safeRead() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn('[history] read fail', e);
    return [];
  }
}

function safeWrite(list) {
  try {
    const trimmed = list.slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(trimmed));
    return true;
  } catch (e) {
    console.warn('[history] write fail', e);
    return false;
  }
}

/** 给新条目一个稳定的 id */
export function newHistoryId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
}

/** 取整条历史列表（最新在前） */
export function listHistory() {
  return safeRead();
}

/**
 * 添加一条历史。
 * entry 形如: { id, title, savedAt, patternJson }
 */
export function addHistory(entry) {
  const list = safeRead();
  // 去重:同 id 视为更新
  const idx = list.findIndex((it) => it.id === entry.id);
  if (idx >= 0) list.splice(idx, 1);
  list.unshift(entry); // 最新置顶
  return safeWrite(list);
}

export function removeHistory(id) {
  const list = safeRead().filter((it) => it.id !== id);
  return safeWrite(list);
}

export function renameHistory(id, title) {
  const list = safeRead();
  const item = list.find((it) => it.id === id);
  if (!item) return false;
  item.title = title;
  return safeWrite(list);
}

export function clearHistory() {
  try {
    localStorage.removeItem(KEY);
    return true;
  } catch {
    return false;
  }
}

/** 从列表中对比当前 pattern, 返回 lastSavedId（用于 UI 高亮) */
export function findLatestMatchId(patternJson) {
  try {
    const list = safeRead();
    for (const it of list) {
      if (it.patternJson === patternJson) return it.id;
    }
  } catch {}
  return null;
}
