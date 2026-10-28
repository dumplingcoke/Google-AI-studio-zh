// Google AI Studio 页面翻译 —— 弹出面板逻辑
(function () {
    'use strict';

    const STORAGE_KEY = 'aistudioTranslateSettings';
    const DEFAULTS = {
        theme: 'system',        // 'light' | 'dark' | 'system'
        language: 'zh-CN',      // 'original' | 'zh-CN' | 'zh-TW'
        targetLang: 'zh-CN',    // 当 language !== 'original' 时使用的目标语言
        floatingWindow: true,   // 是否在页面显示悬浮窗
        floatingAction: 'toggleLanguage' // 'toggleLanguage' | 'openSettings'
    };

    const LANG_LABELS = {
        'zh-CN': '简体中文',
        'zh-TW': '繁體中文'
    };

    // 系统主题媒体查询
    const darkMedia = window.matchMedia('(prefers-color-scheme: dark)');

    // 把主题设置解析为实际的 light / dark
    function resolveTheme(theme) {
        if (theme === 'light' || theme === 'dark') return theme;
        return darkMedia.matches ? 'dark' : 'light';
    }

    // 将解析后的主题应用到弹窗自身（在 <html> 上切换 .dark）
    function applyPopupTheme(theme) {
        const resolved = resolveTheme(theme);
        document.documentElement.classList.toggle('dark', resolved === 'dark');
    }

    // 读取设置
    function loadSettings() {
        return new Promise((resolve) => {
            try {
                chrome.storage.sync.get([STORAGE_KEY], (result) => {
                    const saved = (result && result[STORAGE_KEY]) || {};
                    resolve({ ...DEFAULTS, ...saved });
                });
            } catch (e) {
                // 非扩展环境（如浏览器直接打开预览）时使用默认值
                resolve({ ...DEFAULTS });
            }
        });
    }

    // 保存设置
    function saveSettings(settings) {
        try {
            chrome.storage.sync.set({ [STORAGE_KEY]: settings });
        } catch (e) {}
    }

    // 初始化主题分段控件
    function initThemeSegmented(settings) {
        const container = document.getElementById('theme-segmented');
        const segments = container.querySelectorAll('.segment');

        function setActive(value) {
            segments.forEach((seg) => {
                seg.classList.toggle('active', seg.dataset.value === value);
            });
        }

        setActive(settings.theme);
        applyPopupTheme(settings.theme);

        segments.forEach((seg) => {
            seg.addEventListener('click', () => {
                const value = seg.dataset.value;
                setActive(value);
                settings.theme = value;
                applyPopupTheme(value);
                saveSettings(settings);
            });
        });

        // 「跟随系统」时，系统主题发生变化则实时更新弹窗
        const onSystemChange = () => {
            if (settings.theme === 'system') {
                applyPopupTheme('system');
            }
        };
        if (darkMedia.addEventListener) {
            darkMedia.addEventListener('change', onSystemChange);
        } else if (darkMedia.addListener) {
            darkMedia.addListener(onSystemChange);
        }
    }

    // 初始化语言分段控件 + 下拉
    function initLanguageSegmented(settings) {
        const originalSeg = document.querySelector('#language-segmented .segment[data-value="original"]');
        const langSeg = document.getElementById('lang-segment');
        const langLabel = document.getElementById('lang-label');
        const langDropdown = document.getElementById('lang-dropdown');
        const dropdownItems = langDropdown.querySelectorAll('.dropdown-item');

        function closeDropdown() {
            langSeg.classList.remove('open');
            langDropdown.classList.remove('open');
        }

        function openDropdown() {
            langSeg.classList.add('open');
            langDropdown.classList.add('open');
        }

        function setLanguageActive() {
            const isOriginal = settings.language === 'original';
            originalSeg.classList.toggle('active', isOriginal);
            langSeg.classList.toggle('active', !isOriginal);
        }

        function updateLabel() {
            langLabel.textContent = LANG_LABELS[settings.targetLang] || settings.targetLang;
            dropdownItems.forEach((item) => {
                item.classList.toggle('selected', item.dataset.lang === settings.targetLang);
            });
        }

        function setTargetLang(lang) {
            settings.targetLang = lang;
            // 选择某个目标语言时，自动把语言模式切换为该语言
            settings.language = lang;
            updateLabel();
            setLanguageActive();
            saveSettings(settings);
        }

        updateLabel();
        setLanguageActive();

        // 点击「显示原文」
        originalSeg.addEventListener('click', () => {
            settings.language = 'original';
            setLanguageActive();
            saveSettings(settings);
            closeDropdown();
        });

        // 点击语言分段：
        // - 当前为「显示原文」时：第一次点击仅选中该分段（切换为目标语言），不弹出列表；
        // - 已处于目标语言时：再次点击才展开/收起语言列表。
        langSeg.addEventListener('click', () => {
            if (settings.language === 'original') {
                settings.language = settings.targetLang;
                setLanguageActive();
                saveSettings(settings);
                return;
            }
            if (langDropdown.classList.contains('open')) {
                closeDropdown();
            } else {
                closeDropdown();
                openDropdown();
            }
        });

        // 下拉项选择
        dropdownItems.forEach((item) => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const lang = item.dataset.lang;
                setTargetLang(lang);
                closeDropdown();
            });
        });

        // 点击外部关闭下拉
        document.addEventListener('click', (e) => {
            if (!langSeg.contains(e.target) && !langDropdown.contains(e.target)) {
                closeDropdown();
            }
        });

        // Esc 关闭下拉
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeDropdown();
        });
    }

    // 初始化悬浮窗开关
    function initFloatSwitch(settings) {
        const floatSwitch = document.getElementById('float-switch');
        const actionSection = document.getElementById('float-action-section');

        function syncUI() {
            const enabled = !!settings.floatingWindow;
            floatSwitch.setAttribute('aria-checked', enabled ? 'true' : 'false');
            actionSection.classList.toggle('disabled', !enabled);
        }

        syncUI();

        floatSwitch.addEventListener('click', () => {
            settings.floatingWindow = !settings.floatingWindow;
            syncUI();
            saveSettings(settings);
        });
    }

    // 初始化「左键点击悬浮窗」分段控件
    function initFloatActionSegmented(settings) {
        const container = document.getElementById('float-action-segmented');
        const segments = container.querySelectorAll('.segment');

        function setActive(value) {
            segments.forEach((seg) => {
                seg.classList.toggle('active', seg.dataset.value === value);
            });
        }

        setActive(settings.floatingAction);

        segments.forEach((seg) => {
            seg.addEventListener('click', () => {
                const value = seg.dataset.value;
                settings.floatingAction = value;
                setActive(value);
                saveSettings(settings);
            });
        });
    }

    // 启动
    loadSettings().then((settings) => {
        initThemeSegmented(settings);
        initLanguageSegmented(settings);
        initFloatSwitch(settings);
        initFloatActionSegmented(settings);
    });
})();
