// Google AI Studio 页面翻译 —— 内容脚本
// 中文词库位于 zh.js（需先于本文件加载）。
(function () {
    'use strict';

    // 防止重复处理的缓存
    const processedNodes = new WeakSet();

    console.log('[GoogleAIStudioTranslate] content.js v3.8.0 loaded');

    // 翻译结果缓存 (优化性能)
    const translationCache = new Map();

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
        setNodeText(highlight || el, translated);
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
                node.value = translatedValue;
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
        if (node.nodeType === Node.ELEMENT_NODE) {
            if (processedNodes.has(node)) return;
            processedNodes.add(node);
            if (shouldSkipNode(node)) return;
            applySpecialElementTranslations(node);
            const attributes = ['aria-label', 'aria-description', 'placeholder', 'mattooltip', 'title', 'data-tooltip', 'data-after-input', 'dialoglabel'];
            for (const attr of attributes) {
                const value = node.getAttribute(attr);
                if (value) {
                    const trimmedValue = value.trim();
                    if (translationCache.has(trimmedValue)) {
                        node.setAttribute(attr, translationCache.get(trimmedValue));
                    } else if (translations[trimmedValue]) {
                        const translated = translations[trimmedValue];
                        node.setAttribute(attr, translated);
                        translationCache.set(trimmedValue, translated);
                    } else {
                        for (const rule of regexReplacements) {
                            if (rule.regex.test(trimmedValue)) {
                                const translated = trimmedValue.replace(rule.regex, rule.replacement);
                                node.setAttribute(attr, translated);
                                translationCache.set(trimmedValue, translated);
                                break;
                            }
                        }
                    }
                }
            }
        }

        if (node.nodeType === Node.TEXT_NODE) {
            if (shouldSkipNode(node.parentElement)) return;

            const originalText = node.nodeValue;
            const text = originalText.trim();
            const normalizedText = text.replace(/\s+/g, ' ');

            if (!text) return;

            if (translationCache.has(text)) {
                const cachedValue = originalText.replace(text, translationCache.get(text));
                if (cachedValue !== node.nodeValue) node.nodeValue = cachedValue;
                return;
            }

            if (translations[text]) {
                const translated = translations[text];
                const newValue = originalText.replace(text, translated);
                translationCache.set(text, translated);
                if (newValue !== node.nodeValue) node.nodeValue = newValue;
                return;
            }

            if (translations[normalizedText]) {
                const translated = translations[normalizedText];
                translationCache.set(normalizedText, translated);
                if (translated !== node.nodeValue) node.nodeValue = translated;
                return;
            }

            if (text.startsWith("Google AI Studio uses cookies")) {
                const translated = "Google AI Studio 使用 Google 的 Cookie 来提供和增强其服务质量，并分析流量。";
                node.nodeValue = translated;
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
                    if (newValue !== node.nodeValue) node.nodeValue = newValue;
                    return;
                }
            }

            for (const rule of regexReplacements) {
                if (rule.regex.test(text)) {
                    const translated = text.replace(rule.regex, rule.replacement);
                    const newValue = originalText.replace(text, translated);
                    translationCache.set(text, translated);
                    if (newValue !== node.nodeValue) node.nodeValue = newValue;
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
        pendingMutations.push(...mutations);
        if (!mutationTimeout) {
            mutationTimeout = setTimeout(flushMutations, 50);
        }
    });

    function init() {
        walkAndTranslate(document.body);
        observer.observe(document.body, observerConfig);

        // 标题按钮绑定与观察
        bindTitleButtons();
        titleObserver.observe(document.body, {
            childList: true,
            subtree: true
        });

        revealPage();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 1000);
    }

    // ================================
    // Models / Agents 标题中文修复
    // ================================



    function changeCarouselTitle(type) {

        const title = document.querySelector(
            "h2.carousel-title"
        );

        if (!title) return;

        title.textContent = titles[type];
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