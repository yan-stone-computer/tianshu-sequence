/**
 * 技术文章上传校验码配置
 *
 * 说明：
 * - 明文校验码不落盘，仅保存 PBKDF2-HMAC-SHA256 慢哈希（迭代 + 随机盐）。
 * - 本文件在前端用于校验输入；正式部署多用户投稿时，请将此校验逻辑迁移到
 *   服务端执行（客户端校验仅能防误操作，不能防篡改）。
 */
(function (global) {
    'use strict';
    global.ARTICLE_CONFIG = {
        iterations: 310000,                 // PBKDF2 迭代次数（OWASP 推荐量级）
        algorithm: 'SHA-256',
        salt: '99X+LTScpASEo6dQVhxz1w==',   // 16 字节随机盐（Base64）
        hash: 'tEPoNhuIkdMAGEKHtQO8oV6fK/rNc6BthTCgY1QzDUk=' // 派生密钥（Base64，32 字节）
    };

    // 技术文章可选分类（投稿表单与筛选共用）
    global.ARTICLE_CATEGORIES = [
        '前端',
        '后端',
        '算法',
        '安全',
        '运维',
        '数据库',
        '云计算',
        '大数据',
        'AI',
        '鸿蒙',
        '安卓',
        '桌面开发',
        '测试',
        '网络',
        '架构',
        '性能优化',
        '工具',
        '其他'
    ];
})(window);
