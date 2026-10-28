// Google AI Studio 页面翻译 —— 内容脚本
// 中文词库位于 zh.js（需先于本文件加载）。
(function () {
    'use strict';

    // 防止重复处理的缓存
    let processedNodes = new WeakSet();

    console.log('[GoogleAIStudioTranslate] content.js v3.12.0 loaded');

    // 翻译结果缓存 (优化性能)
    const translationCache = new Map();

    // ============ 语言设置 ============
    // 注意：主题分段控件（浅色/深色/跟随系统）只决定扩展弹窗自身的主题，
    // 不应影响 Google AI Studio 网站页面，因此内容脚本不再注入任何主题样式。
    const STORAGE_KEY = 'aistudioTranslateSettings';
    const DEFAULT_SETTINGS = {
        theme: 'system',       // 'light' | 'dark' | 'system'，与扩展弹窗共用
        language: 'zh-CN',
        targetLang: 'zh-CN',
        floatingWindow: true,
        floatingAction: 'toggleLanguage',
        floatPosition: null   // { left: number, top: number }，悬浮窗最后所在位置
    };

    // 悬浮窗与页面内设置弹窗仅在顶层框架出现
    const isTopFrame = window.top === window.self;

    const LANG_LABELS = {
        'zh-CN': '简体中文',
        'zh-TW': '繁體中文'
    };

    // 系统主题媒体查询，用于把「跟随系统」解析为实际的浅色/深色
    const darkMedia = window.matchMedia('(prefers-color-scheme: dark)');
    function resolveTheme(theme) {
        if (theme === 'light' || theme === 'dark') return theme;
        return darkMedia.matches ? 'dark' : 'light';
    }

    // 把解析后的主题应用到悬浮窗（切换 .theme-light / .theme-dark）
    function applyFloatTheme(btn) {
        const target = btn || document.getElementById(FLOAT_BTN_ID);
        if (!target) return;
        const isDark = resolveTheme(settings.theme) === 'dark';
        target.classList.toggle('theme-dark', isDark);
        target.classList.toggle('theme-light', !isDark);
    }

    let settings = { ...DEFAULT_SETTINGS };
    let translationEnabled = true;   // language !== 'original'
    let isApplyingSettings = false;  // 防止应用设置时触发观察者循环

    // 保存节点的原始文本，用于「显示原文」时还原
    const originalTexts = new WeakMap();

    // 翻译时按目标语言做后处理（目前支持 zh-CN / zh-TW）
    function localizeTranslated(text) {
        if (!text) return text;
        if (settings.targetLang === 'zh-TW' && typeof simplifiedToTraditional === 'function') {
            return simplifiedToTraditional(text);
        }
        return text;
    }

    // 移除旧版本可能遗留的网站主题注入样式（v3.9.x 之前会强制网站浅/深色）
    const LEGACY_THEME_STYLE_ID = 'aistudio-zh-theme';
    function removeLegacyThemeStyle(root) {
        if (!root || !root.querySelectorAll) return;
        root.querySelectorAll('#' + LEGACY_THEME_STYLE_ID).forEach((el) => el.remove());
    }
    removeLegacyThemeStyle(document.head || document.documentElement);

    // ============ 悬浮窗与页面内设置弹窗 ============
    const FLOAT_BTN_ID = 'aistudio-float-btn';
    const SETTINGS_OVERLAY_ID = 'aistudio-settings-overlay';

    // 注入悬浮窗与弹窗样式
    function injectFloatingStyles() {
        if (!isTopFrame) return;
        const STYLE_ID = 'aistudio-float-styles';
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
#aistudio-float-btn {
  position: fixed;
  right: 24px;
  bottom: 24px;
  min-width: 48px;
  height: 36px;
  padding: 0 14px;
  border: 1px solid #dadce0;
  border-radius: 18px;
  background: #ffffff;
  color: #1a73e8;
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
  z-index: 2147483646;
  transition: transform 0.15s ease, background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
  touch-action: none;
  user-select: none;
}
/* 浅色主题（默认，跟随扩展程序主题） */
#aistudio-float-btn.theme-light:hover {
  background: #f1f3f4;
  transform: scale(1.06);
}
#aistudio-float-btn:active {
  transform: scale(0.97);
}
/* 深色主题（跟随扩展程序主题） */
#aistudio-float-btn.theme-dark {
  background: #292a2d;
  color: #8ab4f8;
  border-color: #5f6368;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4);
}
#aistudio-float-btn.theme-dark:hover {
  background: #3c4043;
  transform: scale(1.06);
}
/* 拖拽中：禁用悬停放大与过渡，避免抖动 */
#aistudio-float-btn.dragging {
  cursor: grabbing;
  transition: none;
}
#aistudio-float-btn.dragging:hover {
  transform: none;
}
#aistudio-settings-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2147483647;
  animation: aistudioOverlayIn 0.18s ease;
}
@keyframes aistudioOverlayIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.aistudio-settings-box {
  position: relative;
  width: 320px;
  max-width: calc(100vw - 32px);
  max-height: 92vh;
  animation: aistudioBoxIn 0.2s ease;
}
@keyframes aistudioBoxIn {
  from { opacity: 0; transform: translateY(10px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.aistudio-settings-frame {
  width: 100%;
  height: 540px;
  max-height: 92vh;
  border: none;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.35);
  display: block;
}
.aistudio-settings-close {
  position: absolute;
  top: -14px;
  right: -14px;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 50%;
  background: #3c4043;
  color: #ffffff;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  padding: 0;
}
.aistudio-settings-close:hover {
  background: #5f6368;
}
`;
        (document.head || document.documentElement).appendChild(style);
    }

    // 保存设置（悬浮窗切换语言时使用）
    function saveSettingsToStorage(next) {
        try {
            chrome.storage.sync.set({ [STORAGE_KEY]: next });
        } catch (e) {}
    }

    // 数值裁剪到 [min, max]
    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    const FLOAT_DEFAULT_WIDTH = 48;
    const FLOAT_HEIGHT = 36;

    // 把指定位置裁剪到当前视口内（文字按钮宽度随内容变化，按实际尺寸裁剪）
    function clampFloatPosition(left, top, width, height) {
        const w = width || FLOAT_DEFAULT_WIDTH;
        const h = height || FLOAT_HEIGHT;
        return {
            left: clamp(left, 0, Math.max(0, window.innerWidth - w)),
            top: clamp(top, 0, Math.max(0, window.innerHeight - h))
        };
    }

    // 应用记忆的位置（自动裁剪到视口内）
    function applyFloatPosition(btn) {
        if (!settings.floatPosition) return;
        const rect = btn.getBoundingClientRect();
        const pos = clampFloatPosition(
            settings.floatPosition.left,
            settings.floatPosition.top,
            rect.width,
            rect.height
        );
        btn.style.right = 'auto';
        btn.style.bottom = 'auto';
        btn.style.left = pos.left + 'px';
        btn.style.top = pos.top + 'px';
        settings.floatPosition = pos;
    }

    // 创建悬浮按钮
    function createFloatingButton() {
        if (!isTopFrame || !document.body) return null;
        let btn = document.getElementById(FLOAT_BTN_ID);
        if (btn) return btn;
        injectFloatingStyles();
        btn = document.createElement('button');
        btn.id = FLOAT_BTN_ID;
        btn.type = 'button';
        makeFloatingButtonDraggable(btn);
        btn.addEventListener('click', onFloatingButtonClick);
        // 右键执行与左键相反的操作
        btn.addEventListener('contextmenu', onFloatingButtonContextMenu);
        document.body.appendChild(btn);
        applyFloatPosition(btn);
        return btn;
    }

    // 拖拽：pointer 事件实现；移动超过阈值判定为拖拽，并抑制随后的 click
    function makeFloatingButtonDraggable(btn) {
        if (btn.dataset.dragBound) return;
        btn.dataset.dragBound = 'true';

        let drag = null;
        let suppressNextClick = false;

        btn.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            const rect = btn.getBoundingClientRect();
            drag = {
                pointerId: e.pointerId,
                startX: e.clientX,
                startY: e.clientY,
                originLeft: rect.left,
                originTop: rect.top,
                originWidth: rect.width,
                originHeight: rect.height,
                moved: false
            };
            try { btn.setPointerCapture(e.pointerId); } catch (_) {}
        });

        btn.addEventListener('pointermove', (e) => {
            if (!drag || e.pointerId !== drag.pointerId) return;
            const dx = e.clientX - drag.startX;
            const dy = e.clientY - drag.startY;
            if (!drag.moved && Math.hypot(dx, dy) > 4) {
                drag.moved = true;
                btn.classList.add('dragging');
            }
            if (!drag.moved) return;
            const pos = clampFloatPosition(
                drag.originLeft + dx,
                drag.originTop + dy,
                drag.originWidth,
                drag.originHeight
            );
            btn.style.right = 'auto';
            btn.style.bottom = 'auto';
            btn.style.left = pos.left + 'px';
            btn.style.top = pos.top + 'px';
        });

        const endDrag = (e) => {
            if (!drag || e.pointerId !== drag.pointerId) return;
            const wasDrag = drag.moved;
            if (wasDrag) {
                const rect = btn.getBoundingClientRect();
                const pos = clampFloatPosition(rect.left, rect.top, rect.width, rect.height);
                settings.floatPosition = pos;
                // 记忆最后所在位置
                saveSettingsToStorage({ ...settings });
                suppressNextClick = true;
            }
            drag = null;
            btn.classList.remove('dragging');
            try { btn.releasePointerCapture(e.pointerId); } catch (_) {}
        };
        btn.addEventListener('pointerup', endDrag);
        btn.addEventListener('pointercancel', endDrag);

        // 捕获阶段先拦截拖拽后产生的 click，避免误触发切换/弹窗
        btn.addEventListener('click', (e) => {
            if (suppressNextClick) {
                e.stopPropagation();
                e.preventDefault();
                suppressNextClick = false;
            }
        }, true);
    }

    // 悬浮窗文字：左键动作决定显示内容
    function getFloatingLabel() {
        if (settings.floatingAction === 'openSettings') {
            return '打开设置';
        }
        // 左键为切换语言：显示当前状态对应的下一步动作
        if (settings.language === 'original') {
            return settings.targetLang === 'zh-TW' ? '显示繁中' : '显示简中';
        }
        return '显示原文';
    }

    // 根据设置更新悬浮窗显隐、文字、主题与提示
    function updateFloatingWindow() {
        if (!isTopFrame) return;
        if (!document.body) return;
        const btn = createFloatingButton();
        if (!btn) return;
        if (settings.floatingWindow) {
            btn.style.display = 'flex';
            btn.textContent = getFloatingLabel();
            applyFloatPosition(btn);
            applyFloatTheme(btn);
            const leftTitle = settings.floatingAction === 'openSettings'
                ? '左键打开设置'
                : (settings.language === 'original'
                    ? '左键切换为' + (LANG_LABELS[settings.targetLang] || settings.targetLang)
                    : '左键显示原文');
            const rightTitle = settings.floatingAction === 'openSettings'
                ? '右键切换语言'
                : '右键打开设置';
            btn.title = leftTitle + '（' + rightTitle + '）';
        } else {
            btn.style.display = 'none';
        }
    }

    // 切换语言：在原文与已选择的语言之间快速切换。
    // 注意：只构造新设置保存，不直接修改本地 settings ——
    // 否则 storage.onChanged 触发 applySettings 时将检测不到语言变化。
    function toggleLanguageFromFloat() {
        const next = { ...settings };
        next.language = settings.language === 'original'
            ? (settings.targetLang || 'zh-CN')
            : 'original';
        saveSettingsToStorage(next);
    }

    // 悬浮按钮左键：按设置执行 切换语言 或 打开设置
    function onFloatingButtonClick(e) {
        e.preventDefault();
        e.stopPropagation();
        if (settings.floatingAction === 'openSettings') {
            openSettingsModal();
        } else {
            toggleLanguageFromFloat();
        }
    }

    // 悬浮按钮右键：执行与左键相反的操作
    function onFloatingButtonContextMenu(e) {
        e.preventDefault();
        e.stopPropagation();
        if (settings.floatingAction === 'openSettings') {
            // 左键打开设置 → 右键切换语言
            toggleLanguageFromFloat();
        } else {
            // 左键切换语言 → 右键打开设置
            openSettingsModal();
        }
    }

    // 页面内打开设置弹窗（与点击扩展程序相同的页面）
    function openSettingsModal() {
        if (!isTopFrame || !document.body) return;
        if (document.getElementById(SETTINGS_OVERLAY_ID)) return;
        injectFloatingStyles();

        const overlay = document.createElement('div');
        overlay.id = SETTINGS_OVERLAY_ID;

        const box = document.createElement('div');
        box.className = 'aistudio-settings-box';

        const iframe = document.createElement('iframe');
        iframe.className = 'aistudio-settings-frame';
        iframe.src = chrome.runtime.getURL('popup.html');

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'aistudio-settings-close';
        closeBtn.textContent = '✕';
        closeBtn.addEventListener('click', closeSettingsModal);

        box.appendChild(iframe);
        box.appendChild(closeBtn);
        overlay.appendChild(box);

        // 点击遮罩空白处关闭
        overlay.addEventListener('click', (ev) => {
            if (ev.target === overlay) closeSettingsModal();
        });

        document.body.appendChild(overlay);
    }

    function closeSettingsModal() {
        const overlay = document.getElementById(SETTINGS_OVERLAY_ID);
        if (overlay) overlay.remove();
    }

    // Esc 关闭页面内设置弹窗
    if (isTopFrame) {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeSettingsModal();
        });

        // 视口变化时把悬浮窗重新裁剪回可视区域，并记忆裁剪后的位置
        window.addEventListener('resize', () => {
            const btn = document.getElementById(FLOAT_BTN_ID);
            if (btn && settings.floatPosition && settings.floatingWindow) {
                applyFloatPosition(btn);
                saveSettingsToStorage({ ...settings });
            }
        });

        // 主题为「跟随系统」时，系统深浅色变化则实时更新悬浮窗
        const onSystemThemeChange = () => {
            if ((!settings.theme || settings.theme === 'system') && settings.floatingWindow) {
                applyFloatTheme();
            }
        };
        if (darkMedia.addEventListener) {
            darkMedia.addEventListener('change', onSystemThemeChange);
        } else if (darkMedia.addListener) {
            darkMedia.addListener(onSystemThemeChange);
        }
    }
    // =========================================

    // 还原已翻译节点为原文
    function revertTranslations(root) {
        if (!root) return;
        isApplyingSettings = true;
        const walker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
            null,
            false
        );
        let node;
        while ((node = walker.nextNode())) {
            if (node.nodeType === Node.TEXT_NODE) {
                const original = originalTexts.get(node);
                if (original !== undefined) {
                    node.nodeValue = original;
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const attrs = node.getAttribute && node.getAttribute('data-zh-original-attrs');
                if (attrs) {
                    try {
                        const obj = JSON.parse(attrs);
                        for (const key in obj) {
                            if (obj[key] === null) node.removeAttribute(key);
                            else node.setAttribute(key, obj[key]);
                        }
                    } catch (e) {}
                    node.removeAttribute('data-zh-original-attrs');
                }
                // input/textarea value 还原
                if ((node.tagName === 'TEXTAREA' || node.tagName === 'INPUT') && originalTexts.has(node)) {
                    node.value = originalTexts.get(node);
                }
            }
        }
        // 清空处理缓存，允许重新翻译
        processedNodes = new WeakSet();
        isApplyingSettings = false;
    }

    // 应用设置（仅语言）
    function applySettings(newSettings) {
        const prevLang = settings.language;
        const prevTargetLang = settings.targetLang;
        settings = { ...settings, ...newSettings };
        translationEnabled = settings.language !== 'original';

        if (!document.body) return;

        if (translationEnabled) {
            // 以下两种情况需要整页重新翻译：
            // 1. 从此前的「显示原文」恢复翻译；
            // 2. 切换了目标语言（简体 ↔ 繁体），已翻译文本需按新语言重译。
            if (prevLang === 'original' || prevTargetLang !== settings.targetLang) {
                // 已处于翻译状态时，先还原英文原文再重译
                if (prevLang !== 'original') {
                    revertTranslations(document.body);
                }
                processedNodes = new WeakSet();
                walkAndTranslate(document.body);
            }
        } else {
            // 切换为显示原文
            if (prevLang !== 'original') {
                revertTranslations(document.body);
            }
        }

        // 同步悬浮窗显隐与提示
        updateFloatingWindow();
    }

    // 从 chrome.storage 读取设置
    function loadSettings() {
        return new Promise((resolve) => {
            try {
                chrome.storage.sync.get([STORAGE_KEY], (result) => {
                    const saved = result[STORAGE_KEY] || {};
                    resolve({ ...DEFAULT_SETTINGS, ...saved });
                });
            } catch (e) {
                resolve({ ...DEFAULT_SETTINGS });
            }
        });
    }

    // 监听设置变化
    try {
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'sync' && changes[STORAGE_KEY]) {
                applySettings(changes[STORAGE_KEY].newValue || {});
            }
        });
    } catch (e) {}
    // ========================================

    // 在 documentElement/head 可用时插入节点，避免 document_start 时 target 为 null
    function insertNodeWhenReady(node, onInserted) {
        const target = document.head || document.documentElement;
        if (target) {
            target.appendChild(node);
            if (onInserted) onInserted();
            return;
        }
        const mo = new MutationObserver(() => {
            const t = document.head || document.documentElement;
            if (t) {
                t.appendChild(node);
                mo.disconnect();
                if (onInserted) onInserted();
            }
        });
        mo.observe(document, { childList: true, subtree: true });
    }

    // 防止翻译前闪现英文原文：先隐藏页面，首轮翻译完成后再显示
    const antiFlashStyle = document.createElement('style');
    antiFlashStyle.id = 'aistudio-zh-antiflash';
    antiFlashStyle.textContent = 'html { visibility: hidden !important; }';
    insertNodeWhenReady(antiFlashStyle);

    let pageRevealed = false;
    function revealPage() {
        if (pageRevealed) return;
        pageRevealed = true;
        antiFlashStyle.remove();
    }
    // 兜底：即使出现异常也最多隐藏 3 秒，避免页面一直空白
    setTimeout(revealPage, 3000);

    // 修复 Models / Agents 中文按钮宽度函数
    function fixToggleWidth() {

        const style = document.createElement("style");

        style.textContent = `
        ms-button-toggle .toggle-button {
            min-width: 72px !important;
            width: auto !important;
            padding-left: 14px !important;
            padding-right: 14px !important;
        }

        ms-button-toggle .toggle-label {
            white-space: nowrap !important;
            word-break: keep-all !important;
        }
    `;

        insertNodeWhenReady(style);
    }

    // 执行修复 Models / Agents 中文按钮宽度函数
    fixToggleWidth();

    function monthNameToNumber(month) {
        const monthMap = {
            jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
            may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
            september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12
        };
        return monthMap[(month || '').toLowerCase()] || month;
    }

    function translateEnglishDateFragments(text) {
        return text
            .replace(
                /(Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|Sept|September|Oct|October|Nov|November|Dec|December)\s+(\d{1,2})\s*-\s*(Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|Sept|September|Oct|October|Nov|November|Dec|December)\s+(\d{1,2}),\s*(\d{4})/gi,
                (_, month1, day1, month2, day2, year) => `${year}年${monthNameToNumber(month1)}月${parseInt(day1, 10)}日 - ${monthNameToNumber(month2)}月${parseInt(day2, 10)}日`
            )
            .replace(
                /(Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|Sept|September|Oct|October|Nov|November|Dec|December)\s+(\d{4})/gi,
                (_, month, year) => `${year}年${monthNameToNumber(month)}月`
            )
            .replace(
                /(Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|Sept|September|Oct|October|Nov|November|Dec|December)\s+(\d{1,2}),\s*(\d{4})/gi,
                (_, month, day, year) => `${year}年${monthNameToNumber(month)}月${parseInt(day, 10)}日`
            );
    }

    const regexReplacements = [
        // --- 修复价格显示汉化 (动态价格匹配) ---
        // 放在最前面以优先匹配整句话
        {
            // 截止日期动态匹配并汉化，避免硬编码具体日期导致整条规则随时间失配
            regex: /^All context lengths ?(?:•|\*)? ?Input: (\$[0-9.]+) \/ Output: (\$[0-9.]+) through (.+)$/i,
            replacement: (_, input, output, dateText) => `所有上下文长度 • 输入: ${input} / 输出: ${output}（截至 ${translateEnglishDateFragments(dateText)}）`
        },
        { regex: /^All context lengths ?• ?Input: (\$[0-9.]+) \/ Output: (\$[0-9.]+)$/i, replacement: "所有上下文长度 • 输入: $1 / 输出: $2" },
        { regex: /^Image \(\*Output per image\) ?• ?Input: (\$[0-9.]+) \/ Output: (\$[0-9.]+)$/i, replacement: "图像 (*每张图像输出) • 输入: $1 / 输出: $2" },
        { regex: /^Text ?• ?Input: (\$[0-9.]+) \/ Output: (\$[0-9.]+)$/i, replacement: "文本 • 输入: $1 / 输出: $2" },
        { regex: /^Text, image and video ?• ?Input: (\$[0-9.]+) \/ Output: (\$[0-9.]+)$/i, replacement: "文本、图像和视频 • 输入: $1 / 输出: $2" },
        { regex: /^Audio ?• ?Input: (\$[0-9.]+) \/ Output: (\$[0-9.]+)$/i, replacement: "音频 • 输入: $1 / 输出: $2" },
        { regex: /^Audio\/Video ?• ?Input: (\$[0-9.]+) \/ Output: (\$[0-9.]+)$/i, replacement: "音频/视频 • 输入: $1 / 输出: $2" },
        { regex: /^Image\/video ?• ?Input: (\$[0-9.]+) \/ Output: (\$[0-9.]+)$/i, replacement: "图像/视频 • 输入: $1 / 输出: $2" },
        { regex: /^Image\/video ?• ?Input: (\$[0-9.]+) \/ Output: \$$/i, replacement: "图像/视频 • 输入: $1 / 输出: $" },
        {
            regex: /^API pricing per 1M tokens\.\s*Usage in AI Studio UI is free of charge when no API key is selected\.?$/i,
            replacement: "每 100 万 Token 的 API 定价。未选择 API 密钥时，AI Studio UI 中的使用免费。"
        },
        {
            regex: /^(.*?)\s*To change this setting, disconnect the stream first\.?$/i,
            replacement: (_, prefix) => {
                const normalizedPrefix = (prefix || '').trim();
                const translatedPrefix = translations[normalizedPrefix] || normalizedPrefix;
                return normalizedPrefix ? `${translatedPrefix}。如需更改此设置，请先断开当前实时流。` : "如需更改此设置，请先断开当前实时流。";
            }
        },
        {
            regex: /^Image output is priced at (\$[0-9.]+) per 1,000,000 tokens\.\s*Output images at 0\.5K \(512x512px\) consume (\d+) tokens and are equivalent to (\$[0-9.]+) per image\.\s*Output images at 1K \(1024x1024px\) consume (\d+) tokens and are equivalent to (\$[0-9.]+) per image\.\s*Output images at 2K \(2048x2048px\) consume (\d+) tokens and are equivalent to (\$[0-9.]+) per image\.\s*Output images at 4K \(4096x4096px\) consume (\d+) tokens and are equivalent to (\$[0-9.]+) per image\.?$/i,
            replacement: (_, totalPrice, t05, p05, t1, p1, t2, p2, t4, p4) =>
                `图像输出定价为每 1,000,000 Token ${totalPrice}。0.5K（512x512）图像消耗 ${t05} Token，约 ${p05}/张；1K（1024x1024）图像消耗 ${t1} Token，约 ${p1}/张；2K（2048x2048）图像消耗 ${t2} Token，约 ${p2}/张；4K（4096x4096）图像消耗 ${t4} Token，约 ${p4}/张。`
        },
        {
            regex: /^Image output is priced at (\$[0-9.]+) per 1,000,000 tokens\.\s*Output images up to 1024x1024px consume (\d+) tokens and are equivalent to (\$[0-9.]+) per image\.(?:\s*Usage in AI Studio UI is free of charge when no API key is selected\.?)?$/i,
            replacement: (_, totalPrice, tokens, pricePerImage) =>
                `图像输出定价为每 1,000,000 Token ${totalPrice}。最高 1024x1024 的输出图像消耗 ${tokens} Token，约 ${pricePerImage}/张。未选择 API 密钥时，AI Studio UI 中的使用免费。`
        },
        { regex: /^Create music with Lyria$/i, replacement: "使用 Lyria 创作音乐" },
        { regex: /^Text to Speech(?: and| &) Music$/i, replacement: "文字转语音与音乐" },
        { regex: /^Explore our text to speech and music generation models\.?$/i, replacement: "探索我们的文字转语音与音乐生成模型。" },
        { regex: /^Generate high[- ]quality music and audio tracks from text descriptions using our newest audio model\.?$/i, replacement: "使用我们最新的音频模型，根据文本描述生成高质量音乐与音轨。" },
        { regex: /^Gemini 3\.1 Flash[- ]Lite Preview$/i, replacement: "Gemini 3.1 Flash Lite 预览版" },

        { regex: /^Thinking budget: (\d+)%$/, replacement: "思考预算: $1%" },
        { regex: /^Thinking budget: Auto$/, replacement: "思考预算: 自动" },
        { regex: /^([\d,]+) tokens$/i, replacement: "$1 令牌" },
        { regex: /^Model: (.+)$/, replacement: "模型: $1" },
        { regex: /^'Item: Apple, Price: \$1'. Extract name, price to JSON.$/, replacement: "'商品: 苹果, 价格: $1'. 提取名称, 价格为 JSON." },
        { regex: /^Points to (.+)$/, replacement: "指向 $1" },
        {
            regex: /^Knowledge cut off: (.+)$/,
            replacement: (_, cutoffText) => `知识截止日期: ${translateEnglishDateFragments(cutoffText)}`
        },
        { regex: /^Open (.+)$/, replacement: "打开 $1" },
        { regex: /^Open app debug panel to view (\d+) logs$/, replacement: "打开应用调试面板（查看 $1 条日志）" },
        { regex: /^Thought for (\d+) seconds$/, replacement: "思考了 $1 秒" },
        { regex: /^Edited (\d+) file$/, replacement: "已编辑 $1 个文件" },
        { regex: /^Edited (\d+) files$/, replacement: "已编辑 $1 个文件" },
        { regex: /^(.*) Ran for (\d+)s$/, replacement: "$1 运行了 $2 秒" },
        { regex: /^\*: This is an estimated cost if you make the same request via API\.$/, replacement: "*：如果通过 API 发起相同请求，这是预估费用。" },
        { regex: /^Set Gemini API spend cap for (.+)$/, replacement: "为 $1 设置 Gemini API 费用上限" },
        { regex: /^Your usage will pause when the cap is reached\. May be subject to overages during 10 minute processing latency\.$/, replacement: "达到上限后，你的使用将暂停。在 10 分钟处理延迟期间，可能仍会出现超额使用。" },
        {
            regex: /^Your total cost \((.+)\)$/,
            replacement: (_, rangeText) => `总费用（${translateEnglishDateFragments(rangeText)}）`
        },
        { regex: /^Google Account: (.+)$/, replacement: "Google 账户：$1" },
        { regex: /Input: (\$[0-9.]+) \/ Output: (\$[0-9.]+)/, replacement: "输入: $1 / 输出: $2" },
        { regex: /^<=(\d+)K tokens$/i, replacement: "<=$1K 令牌" },
        { regex: /^> ?(\d+)K tokens$/i, replacement: "> $1K 令牌" },
        { regex: /^All context lengths$/, replacement: "所有上下文长度" },
        { regex: /^(\d+) tokens \/ image$/, replacement: "$1 Token / 图像" },
        { regex: /^(\d+) key$/, replacement: "$1 个密钥" },
        { regex: /^(\d+) keys$/, replacement: "$1 个密钥" },
        { regex: /^Tier (\d+)$/, replacement: "层级 $1" },
        { regex: /^Paid tier (\d+)$/, replacement: "付费层级 $1" },
        { regex: /^(\d+)\s+minute(?:s)? ago$/i, replacement: "$1 分钟前" },
        { regex: /^(\d+)\s+hour(?:s)? ago$/i, replacement: "$1 小时前" },
        { regex: /^(\d+)\s+day(?:s)? ago$/i, replacement: "$1 天前" },
        { regex: /^(\d+)\s+week(?:s)? ago$/i, replacement: "$1 周前" },
        { regex: /^(\d+)\s+month(?:s)? ago$/i, replacement: "$1 个月前" },
        { regex: /^(\d+)\s+year(?:s)? ago$/i, replacement: "$1 年前" },
        {
            regex: /^(Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|Sept|September|Oct|October|Nov|November|Dec|December)\s+(\d{1,2}),\s+(\d{4})$/i,
            replacement: (_, month, day, year) => `${year}年${monthNameToNumber(month)}月${parseInt(day, 10)}日`
        },
        // --- v2.5 新增动态正则 ---
        { regex: /^Speaker (\d+)$/, replacement: "发言者 $1" },
        { regex: /^Speaker (\d+) settings$/, replacement: "发言者 $1 设置" },
        { regex: /^Speaker (\d+) dialog$/, replacement: "发言者 $1 对话" },
        // --- 分享对话框正则 ---
        { regex: /^Share "(.*)"$/, replacement: "分享 \"$1\"" },
        { regex: /^Deep Research Preview \((.+)\)$/i, replacement: "深度研究预览版（$1）" },
        { regex: /^Deep Research Max Preview \((.+)\)$/i, replacement: "深度研究 Max 预览版（$1）" },
        { regex: /^(.+) Preview \((Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|Sept|September|Oct|October|Nov|November|Dec|December)-(\d{1,2})-(\d{4})\)$/i, replacement: (_, name, month, day, year) => `${name} 预览版（${year}年${monthNameToNumber(month)}月${parseInt(day, 10)}日）` },
        { regex: /^Google Account: (.+)$/i, replacement: "Google 账户：$1" },
        { regex: /^Manage (.+)$/i, replacement: "管理 $1" },
        { regex: /^Link an (.+)$/i, replacement: "关联 $1" },
        { regex: /^Release date: (.+)$/i, replacement: (_, dateText) => `发布日期: ${translateEnglishDateFragments(dateText)}` },
        { regex: /^Image \(\*Output per image\) • Output: (\$[0-9.]+)$/i, replacement: "图像 (*每张图像输出) • 输出: $1" },
        { regex: /^Video \(\*Output per video\) • Output: (\$[0-9.]+)$/i, replacement: "视频 (*每个视频输出) • 输出: $1" },
        { regex: /^Video \(\*Output per video (720p|1080p)\) • Output: (\$[0-9.]+)$/i, replacement: "视频 (*每个 $1 视频输出) • 输出: $2" },
        { regex: /^Song generation \(\*Output per song\) • Output: (\$[0-9.]+\/req)$/i, replacement: "歌曲生成 (*每首歌输出) • 输出: $1" },
        { regex: /^Image\/video • Input: (\$[0-9.]+)$/i, replacement: "图像/视频 • 输入: $1" },
        { regex: /^Selected (.+)$/i, replacement: "已选择 $1" }
    ];

    // 升级弹窗（ms-upgrade-options）的特性条目在 DOM 中被拆分为
    // <strong class="feature-highlight"> 与 <span class="feature-description"> 两个文本节点，
    // 而词库以整句（如 "Premium models like Nano Banana and Omni"）为键，
    // 逐节点精确匹配无法命中。这里合并整句后重新查词库，命中则整句替换。
    function tryTranslateFeatureText(el) {
        if (!el || el.nodeType !== Node.ELEMENT_NODE) return;
        const combined = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (!combined) return;

        let translated = null;
        if (translationCache.has(combined)) {
            translated = translationCache.get(combined);
        } else if (translations[combined]) {
            translated = translations[combined];
        }
        if (!translated) return;

        // 优先改写既有文本节点的 nodeValue，避免增删节点干扰 TreeWalker 遍历
        const setNodeText = (target, value) => {
            if (!target) return;
            if (target.firstChild && target.firstChild.nodeType === Node.TEXT_NODE) {
                target.firstChild.nodeValue = value;
            } else {
                target.textContent = value;
            }
        };

        const highlight = el.querySelector('.feature-highlight');
        const description = el.querySelector('.feature-description');
        setNodeText(highlight || el, localizeTranslated(translated));
        if (highlight) setNodeText(description, '');
        translationCache.set(combined, translated);
    }

    function applySpecialElementTranslations(node) {
        if (!(node instanceof Element)) return;

        // 升级弹窗特性条目：合并 strong + description 整句翻译
        if (node.matches('.feature-text')) {
            tryTranslateFeatureText(node);
        }

        if ((node.matches('textarea, input') && typeof node.value === 'string')) {
            const currentValue = node.value.trim();
            const translatedValue = defaultValueTranslations.get(currentValue);
            if (translatedValue && node.value !== translatedValue) {
                // 保存原始 value 以便还原
                if (!originalTexts.has(node)) {
                    originalTexts.set(node, node.value);
                }
                node.value = localizeTranslated(translatedValue);
                node.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }

        if (node.matches('.v3-token-count-value')) {
            const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
            const match = text.match(/^([\d,]+)\s*tokens$/i);
            if (match) {
                node.textContent = `${match[1]} 令牌`;
                translationCache.set(text, `${match[1]} 令牌`);
            }
        }

        // App Builder 首页标题被拆成多个动画单词，普通精确匹配无法命中。
        if (node.matches('h2.hero-text')) {
            const words = Array.from(node.querySelectorAll('.hero-word'));
            const joinedText = words
                .map(word => (word.textContent || '').replace(/\s+/g, ' ').trim())
                .join(' ');

            if (words.length === 5 && (joinedText === 'Build your ideas with Gemini' || joinedText === '构建APP your ideas with Gemini')) {
                const replacements = ['用 ', 'Gemini ', '将创意 ', '变成 ', '应用程序'];
                words.forEach((word, index) => {
                    word.textContent = replacements[index];
                    processedNodes.add(word);
                    if (word.firstChild) processedNodes.add(word.firstChild);
                });
                translationCache.set('Build your ideas with Gemini', '用 Gemini 将创意变成 应用程序');
                translationCache.set('构建APP your ideas with Gemini', '用 Gemini 将创意变成 应用程序');
            }
        }
    }

    /**
     * 判断节点是否应该被跳过 (代码块保护)
     */
    function shouldSkipNode(node) {
        if (!node) return false;
        const tagName = node.tagName;
        if (tagName === 'SCRIPT' || tagName === 'STYLE' || tagName === 'PRE' || tagName === 'CODE') {
            return true;
        }
        if (node.classList && (
            node.classList.contains('monaco-editor') ||
            node.classList.contains('code-block') ||
            node.classList.contains('hljs') ||
            node.classList.contains('cm-editor') ||
            node.classList.contains('prism')
        )) {
            return true;
        }
        let parent = node.parentElement;
        let depth = 0;
        while (parent && depth < 5) {
            const pTag = parent.tagName;
            if (pTag === 'PRE' || pTag === 'CODE' || (parent.classList && (
                parent.classList.contains('monaco-editor') ||
                parent.classList.contains('code-block')
            ))) {
                return true;
            }
            parent = parent.parentElement;
            depth++;
        }
        return false;
    }

    /**
     * 翻译单个节点
     */
    function translateNode(node) {
        if (!translationEnabled) return;

        if (node.nodeType === Node.ELEMENT_NODE) {
            if (processedNodes.has(node)) return;
            processedNodes.add(node);
            if (shouldSkipNode(node)) return;
            applySpecialElementTranslations(node);
            const attributes = ['aria-label', 'aria-description', 'placeholder', 'mattooltip', 'title', 'data-tooltip', 'data-after-input', 'dialoglabel'];
            // 记录需要还原的属性原始值
            const originalAttrs = {};
            let hasOriginalAttr = false;
            for (const attr of attributes) {
                const value = node.getAttribute(attr);
                if (value) {
                    originalAttrs[attr] = value;
                    hasOriginalAttr = true;
                    const trimmedValue = value.trim();
                    let translated = null;
                    if (translationCache.has(trimmedValue)) {
                        translated = translationCache.get(trimmedValue);
                    } else if (translations[trimmedValue]) {
                        translated = translations[trimmedValue];
                        translationCache.set(trimmedValue, translated);
                    } else {
                        for (const rule of regexReplacements) {
                            if (rule.regex.test(trimmedValue)) {
                                translated = trimmedValue.replace(rule.regex, rule.replacement);
                                translationCache.set(trimmedValue, translated);
                                break;
                            }
                        }
                    }
                    if (translated) {
                        node.setAttribute(attr, localizeTranslated(translated));
                    }
                }
            }
            if (hasOriginalAttr) {
                node.setAttribute('data-zh-original-attrs', JSON.stringify(originalAttrs));
            }
        }

        if (node.nodeType === Node.TEXT_NODE) {
            if (shouldSkipNode(node.parentElement)) return;

            const originalText = node.nodeValue;
            // 保存原文以便「显示原文」时还原（只保存一次）
            if (!originalTexts.has(node)) {
                originalTexts.set(node, originalText);
            }

            const text = originalText.trim();
            const normalizedText = text.replace(/\s+/g, ' ');

            if (!text) return;

            if (translationCache.has(text)) {
                const cachedValue = originalText.replace(text, translationCache.get(text));
                const finalValue = localizeTranslated(cachedValue);
                if (finalValue !== node.nodeValue) node.nodeValue = finalValue;
                return;
            }

            if (translations[text]) {
                const translated = translations[text];
                const newValue = originalText.replace(text, translated);
                translationCache.set(text, translated);
                const finalValue = localizeTranslated(newValue);
                if (finalValue !== node.nodeValue) node.nodeValue = finalValue;
                return;
            }

            if (translations[normalizedText]) {
                const translated = translations[normalizedText];
                translationCache.set(normalizedText, translated);
                const finalValue = localizeTranslated(translated);
                if (finalValue !== node.nodeValue) node.nodeValue = finalValue;
                return;
            }

            if (text.startsWith("Google AI Studio uses cookies")) {
                const translated = "Google AI Studio 使用 Google 的 Cookie 来提供和增强其服务质量，并分析流量。";
                const finalValue = localizeTranslated(translated);
                node.nodeValue = finalValue;
                translationCache.set(text, translated);
                return;
            }

            // Material tooltip 会把多句文案合并进同一个文本节点（以换行分隔），
            // 整体无法命中词库；按行拆分逐行翻译后按原样重组，保留换行与缩进。
            // 放在整段正则之前，避免未锚定规则只命中片段（如 Input/Output 价格）。
            if (/\n/.test(originalText)) {
                const lines = originalText.split('\n');
                let changed = false;
                const translatedLines = lines.map(line => {
                    const trimmedLine = line.trim();
                    if (!trimmedLine) return line;
                    const translatedLine =
                        translationCache.get(trimmedLine) ||
                        translations[trimmedLine] ||
                        translations[trimmedLine.replace(/\s+/g, ' ')];
                    if (translatedLine) {
                        changed = true;
                        return line.replace(trimmedLine, () => translatedLine);
                    }
                    for (const rule of regexReplacements) {
                        if (rule.regex.test(trimmedLine)) {
                            changed = true;
                            const ruleTranslated = trimmedLine.replace(rule.regex, rule.replacement);
                            return line.replace(trimmedLine, () => ruleTranslated);
                        }
                    }
                    return line;
                });
                if (changed) {
                    const newValue = translatedLines.join('\n');
                    translationCache.set(text, newValue);
                    const finalValue = localizeTranslated(newValue);
                    if (finalValue !== node.nodeValue) node.nodeValue = finalValue;
                    return;
                }
            }

            for (const rule of regexReplacements) {
                if (rule.regex.test(text)) {
                    const translated = text.replace(rule.regex, rule.replacement);
                    const newValue = originalText.replace(text, translated);
                    translationCache.set(text, translated);
                    const finalValue = localizeTranslated(newValue);
                    if (finalValue !== node.nodeValue) node.nodeValue = finalValue;
                    return;
                }
            }

            // 升级弹窗特性条目：整句被拆分为多个节点，单节点未命中时合并整句重试
            if (node.parentElement) {
                const featureTextEl = node.parentElement.closest('.feature-text');
                if (featureTextEl) tryTranslateFeatureText(featureTextEl);
            }
        }
    }

    /**
     * 遍历并翻译
     */
    function walkAndTranslate(rootNode) {
        if (!rootNode) return;
        if (rootNode.nodeType === Node.ELEMENT_NODE && shouldSkipNode(rootNode)) {
            processedNodes.add(rootNode);
            return;
        }

        const walker = document.createTreeWalker(
            rootNode,
            NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
            {
                acceptNode: function (node) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (shouldSkipNode(node)) {
                            processedNodes.add(node);
                            return NodeFilter.FILTER_REJECT;
                        }
                        if (processedNodes.has(node)) {
                            return NodeFilter.FILTER_SKIP;
                        }
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            },
            false
        );

        translateNode(rootNode);
        let node;
        while (node = walker.nextNode()) {
            translateNode(node);
        }
    }

    const observerConfig = {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['aria-label', 'aria-description', 'placeholder', 'mattooltip', 'title', 'data-tooltip', 'data-after-input', 'dialoglabel']
    };

    let mutationTimeout = null;
    let pendingMutations = [];

    function flushMutations() {
        mutationTimeout = null;
        const batchMutations = pendingMutations;
        pendingMutations = [];
        if (isApplyingSettings || !translationEnabled) return;
        for (const mutation of batchMutations) {
            try {
                if (mutation.type === 'childList') {
                    for (const node of mutation.addedNodes) {
                        walkAndTranslate(node);
                    }
                } else if (mutation.type === 'characterData') {
                    translateNode(mutation.target);
                } else if (mutation.type === 'attributes') {
                    const node = mutation.target;
                    processedNodes.delete(node);
                    translateNode(node);
                }
            } catch (e) {
            }
        }
    }

    const observer = new MutationObserver((mutations) => {
        if (isApplyingSettings || !translationEnabled) return;
        pendingMutations.push(...mutations);
        if (!mutationTimeout) {
            mutationTimeout = setTimeout(flushMutations, 50);
        }
    });

    function init() {
        if (translationEnabled) {
            walkAndTranslate(document.body);
        }
        observer.observe(document.body, observerConfig);

        // 标题按钮绑定与观察
        bindTitleButtons();
        titleObserver.observe(document.body, {
            childList: true,
            subtree: true
        });

        // 悬浮窗
        updateFloatingWindow();

        revealPage();
    }

    // 先加载设置再执行初始化，确保首屏就按用户偏好的语言渲染
    loadSettings().then((loaded) => {
        settings = { ...settings, ...loaded };
        translationEnabled = settings.language !== 'original';

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            setTimeout(init, 1000);
        }
    });

    // ================================
    // Models / Agents 标题中文修复
    // ================================



    function changeCarouselTitle(type) {

        const title = document.querySelector(
            "h2.carousel-title"
        );

        if (!title) return;

        title.textContent = localizeTranslated(titles[type]);
    }


    function bindTitleButtons() {

        const buttons = document.querySelectorAll(
            'button[data-value]'
        );


        buttons.forEach(btn => {

            if (btn.dataset.cnTitleBind) return;

            btn.dataset.cnTitleBind = "true";


            btn.addEventListener(
                "click",
                () => {

                    const value = btn.dataset.value;


                    if (value === "models") {
                        changeCarouselTitle("models");
                    }


                    if (value === "agents") {
                        changeCarouselTitle("agents");
                    }

                },
                true
            );

        });

    }


    bindTitleButtons();


    const titleObserver = new MutationObserver(() => {
        bindTitleButtons();
    });
})();