/**
 * 产品数据配置（官网唯一需要维护的产品清单）
 *
 * 新增软件时只需在此追加一个对象：
 * - name/en/tag/accent/tags/desc/features/platforms/meta/icon/site/repo
 * 官网的轮播、统计数字、页脚产品链接、“查看全部”弹层都会自动更新，无需再改页面代码。
 */
(function (global) {
    'use strict';
    global.PRODUCTS_DATA = [
        {
            name: '天枢便签',
            en: 'PolarisNote',
            tag: '桌面效率',
            accent: 'polaris',
            tags: ['Qt 6', '跨平台', 'AI 驱动'],
            desc: '融合 AI 智能助手、看板管理与富文本编辑的桌面笔记工具，本地存储，Windows / Linux 全平台原生支持。',
            features: ['21+ 核心功能', '看板 + AI 客服', '文件智能分析'],
            platforms: ['Windows', 'Linux'],
            meta: [
                { k: '平台', v: 'Windows / Linux' },
                { k: '技术栈', v: 'Qt 6 · C++ · SQLite' },
                { k: '开源', v: 'GitHub · MIT' }
            ],
            iconSvg: '<svg width="30" height="30" viewBox="0 0 28 28" fill="none"><rect x="2" y="4" width="18" height="22" rx="3" fill="#7e57c2" opacity="0.9"/><rect x="6" y="0" width="18" height="22" rx="3" fill="#9575cd"/><line x1="10" y1="6" x2="20" y2="6" stroke="white" stroke-width="1.5" stroke-linecap="round"/><line x1="10" y1="10" x2="18" y2="10" stroke="white" stroke-width="1.5" stroke-linecap="round"/><line x1="10" y1="14" x2="16" y2="14" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg>',
            iconImg: '',
            site: 'https://yan-stone-computer.github.io/polarisnote-web/',
            repo: 'https://github.com/yan-stone-computer/PolarisNote'
        },
        {
            name: '枢游记',
            en: 'ShuYouJi',
            tag: '鸿蒙原生',
            accent: 'shuyouji',
            tags: ['HarmonyOS', 'ArkTS', '图像修复'],
            desc: '基于 HarmonyOS NEXT 原生开发的 AI 智能旅行助手。图像修复、文化知识、行程规划、花费管理，让每一次旅行都更值得铭记。',
            features: ['AI 图像修复', '手机/平板双端', 'AI 文化知识'],
            platforms: ['HarmonyOS'],
            meta: [
                { k: '平台', v: 'HarmonyOS NEXT' },
                { k: '设备', v: '手机 / 平板' },
                { k: '技术栈', v: 'ArkTS · ArkUI' }
            ],
            iconSvg: '',
            iconImg: 'assets/shuyouji-icon.png',
            site: 'https://yan-stone-computer.github.io/ShuYouJi-Web/',
            repo: ''
        },
        {
            name: '陈汉升',
            en: 'ChenHanshen',
            tag: '角色对话',
            accent: 'chenhansheng',
            tags: ['Android', 'Kotlin', 'AI 对话'],
            desc: '把《我真没想重生啊》里的陈汉升装进手机——原生安卓 AI 角色扮演 App。人格对话、发图识图、AI 生图、剧情知识库开箱即用。',
            features: ['陈汉升人格对话', '发图识图', 'AI 生图', '1000+ 章剧情知识库', '会话记忆'],
            platforms: ['Android'],
            meta: [
                { k: '平台', v: 'Android 8.0+' },
                { k: '版本', v: 'v4.1.0 · 9 MB' },
                { k: '技术栈', v: 'Kotlin · Material 3' },
                { k: '开源', v: 'GitHub' }
            ],
            iconSvg: '',
            iconImg: 'assets/chenhansheng-cover.jpg',
            site: 'https://yan-stone-computer.github.io/awesome-chenhansheng-app/',
            repo: 'https://github.com/yan-stone-computer/awesome-chenhansheng-app'
        }
    ];
})(window);
