/**
 * 财务隐私模式
 * 开启后所有金额显示为 ¥***，保护敏感财务信息
 */
const PrivacyMode = {
    _enabled: false,

    init() {
        this._enabled = localStorage.getItem('finance_privacy') === '1';
        this._applyBodyClass();
    },

    isEnabled() {
        return this._enabled;
    },

    toggle() {
        this._enabled = !this._enabled;
        localStorage.setItem('finance_privacy', this._enabled ? '1' : '0');
        this._applyBodyClass();
        // 重新渲染受影响的模块
        if (typeof DashboardModule !== 'undefined') DashboardModule.render();
        if (typeof FinanceModule !== 'undefined') FinanceModule.render();
    },

    _applyBodyClass() {
        document.body.classList.toggle('privacy-mode', this._enabled);
    },

    // 屏蔽金额字符串
    maskMoney(str) {
        if (!this._enabled) return str;
        return '¥***';
    },

    // 屏蔽百分比等数值
    maskValue(str) {
        if (!this._enabled) return str;
        return '***';
    },

    // 屏蔽百分比值
    maskPct(val, decimals = 1) {
        if (this._enabled) return '***';
        return val.toFixed(decimals) + '%';
    }
};

/**
 * 工具函数库
 */
const Utils = {
    // 格式化货币（受隐私模式影响）
    formatMoney(num, decimals = 2) {
        if (PrivacyMode.isEnabled()) return '¥***';
        if (num === null || num === undefined || isNaN(num)) return '¥0.00';
        const abs = Math.abs(num);
        if (abs >= 100000000) {
            return '¥' + (num / 100000000).toFixed(2) + '亿';
        } else if (abs >= 10000) {
            return '¥' + (num / 10000).toFixed(2) + '万';
        }
        return '¥' + num.toFixed(decimals);
    },

    // 格式化货币（不受隐私模式影响，用于内部计算展示如编辑表单）
    formatMoneyRaw(num, decimals = 2) {
        if (num === null || num === undefined || isNaN(num)) return '¥0.00';
        const abs = Math.abs(num);
        if (abs >= 100000000) {
            return '¥' + (num / 100000000).toFixed(2) + '亿';
        } else if (abs >= 10000) {
            return '¥' + (num / 10000).toFixed(2) + '万';
        }
        return '¥' + num.toFixed(decimals);
    },

    // 增强的 JSON fetch 工具
    // 自动处理 file:// 协议检测、路径修正、错误诊断
    async fetchJSON(path, options = {}) {
        const protocol = window.location.protocol;
        
        // file:// 协议下 fetch 会被浏览器 CORS 策略拦截
        if (protocol === 'file:') {
            throw new Error('请通过 http://localhost:8090 访问页面，直接打开 HTML 文件(file://)无法加载数据文件');
        }

        // 统一使用绝对路径（确保以 / 开头）
        const url = path.startsWith('/') ? path : '/' + path;

        const resp = await fetch(url + '?t=' + Date.now(), options);
        if (!resp.ok) {
            throw new Error('HTTP ' + resp.status + ' ' + resp.statusText);
        }
        return resp.json();
    },

    // 格式化百分比
    formatPercent(num, decimals = 2) {
        if (num === null || num === undefined || isNaN(num)) return '0.00%';
        const sign = num > 0 ? '+' : '';
        return sign + num.toFixed(decimals) + '%';
    },

    // 格式化数字
    formatNumber(num, decimals = 2) {
        if (num === null || num === undefined || isNaN(num)) return '--';
        return num.toFixed(decimals);
    },

    // 格式化日期
    formatDate(date, withTime = false) {
        if (!date) return '';
        const d = new Date(date);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        if (withTime) {
            const h = String(d.getHours()).padStart(2, '0');
            const min = String(d.getMinutes()).padStart(2, '0');
            return `${y}-${m}-${day} ${h}:${min}`;
        }
        return `${y}-${m}-${day}`;
    },

    // 获取今天的日期字符串
    today() {
        return this.formatDate(new Date());
    },

    // 获取本周一
    getWeekStart() {
        const d = new Date();
        const day = d.getDay() || 7;
        d.setDate(d.getDate() - day + 1);
        return this.formatDate(d);
    },

    // 获取本月开始
    getMonthStart() {
        const d = new Date();
        d.setDate(1);
        return this.formatDate(d);
    },

    // 计算两个日期之间的天数
    daysBetween(date1, date2) {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
    },

    // 相对时间
    relativeTime(date) {
        if (!date) return '';
        const now = new Date();
        const d = new Date(date);
        const diff = now - d;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return '刚刚';
        if (minutes < 60) return `${minutes}分钟前`;
        if (hours < 24) return `${hours}小时前`;
        if (days < 7) return `${days}天前`;
        return this.formatDate(date);
    },

    // 获取星期几
    getWeekday(date) {
        const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
        const d = new Date(date);
        return '周' + weekdays[d.getDay()];
    },

    // HTML 转义
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // 显示 Toast 通知
    toast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(20px)';
            toast.style.transition = 'all 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, 2800);
    },

    // 显示模态框
    showModal(content, size = '') {
        const container = document.getElementById('modal-container');
        container.innerHTML = `
            <div class="modal-overlay" onclick="Utils.closeModal()"></div>
            <div class="modal ${size ? 'modal-' + size : ''}">${content}</div>
        `;
        container.classList.add('active');
    },

    // 关闭模态框
    closeModal() {
        const container = document.getElementById('modal-container');
        container.classList.remove('active');
        container.innerHTML = '';
    },

    // 确认对话框
    confirm(message, onConfirm) {
        const content = `
            <div class="modal-header">
                <span class="modal-title">确认操作</span>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                <p style="font-size: 14px; line-height: 1.8;">${message}</p>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="Utils.closeModal()">取消</button>
                <button class="btn btn-danger" id="confirm-btn">确认</button>
            </div>
        `;
        this.showModal(content);
        document.getElementById('confirm-btn').onclick = () => {
            Utils.closeModal();
            if (onConfirm) onConfirm();
        };
    },

    // 生成表单 HTML
    buildForm(fields) {
        return fields.map(field => {
            if (field.type === 'row') {
                const cols = field.fields.map(f => this.buildField(f)).join('');
                return `<div class="form-row">${cols}</div>`;
            }
            if (field.type === 'row-3') {
                const cols = field.fields.map(f => this.buildField(f)).join('');
                return `<div class="form-row-3">${cols}</div>`;
            }
            return this.buildField(field);
        }).join('');
    },

    buildField(field) {
        const label = field.label ? `<label class="form-label">${field.label}</label>` : '';
        const hint = field.hint ? `<div class="form-hint">${field.hint}</div>` : '';
        let input = '';

        switch (field.type) {
            case 'select':
                const options = (field.options || []).map(o =>
                    `<option value="${o.value}" ${o.value === field.value ? 'selected' : ''}>${o.label}</option>`
                ).join('');
                input = `<select class="form-select" id="${field.id}" ${field.required ? 'required' : ''}>${options}</select>`;
                break;
            case 'textarea':
                input = `<textarea class="form-textarea" id="${field.id}" placeholder="${field.placeholder || ''}" ${field.required ? 'required' : ''}>${field.value || ''}</textarea>`;
                break;
            case 'number':
                input = `<input type="number" class="form-input" id="${field.id}" value="${field.value || ''}" step="${field.step || '0.01'}" placeholder="${field.placeholder || ''}" ${field.required ? 'required' : ''}>`;
                break;
            case 'date':
                input = `<input type="date" class="form-input" id="${field.id}" value="${field.value || Utils.today()}" ${field.required ? 'required' : ''}>`;
                break;
            default:
                input = `<input type="${field.type || 'text'}" class="form-input" id="${field.id}" value="${field.value || ''}" placeholder="${field.placeholder || ''}" ${field.required ? 'required' : ''}>`;
        }

        return `<div class="form-group">${label}${input}${hint}</div>`;
    },

    // 获取表单值
    getFormValue(id) {
        const el = document.getElementById(id);
        return el ? el.value.trim() : '';
    },

    getFormNumber(id) {
        const val = this.getFormValue(id);
        return val === '' ? null : parseFloat(val);
    },

    // 颜色生成器（用于图表）
    chartColors: [
        '#7b8fb0', '#d4837a', '#7faa82', '#c8966b',
        '#a08bb5', '#6ba8a8', '#d4a55a', '#c97a8e',
        '#8b9a7a', '#a8b870', '#9b8ab5', '#7faaab'
    ],

    // 获取图表颜色
    getChartColor(index) {
        return this.chartColors[index % this.chartColors.length];
    },

    // 图表实例管理
    chartInstances: {},

    // 销毁图表
    destroyChart(id) {
        if (this.chartInstances[id]) {
            this.chartInstances[id].destroy();
            delete this.chartInstances[id];
        }
    },

    // 初始化 Chart.js 全局配色（手帐风暖色调）
    initChartDefaults() {
        if (typeof Chart === 'undefined') return;
        Chart.defaults.color = '#948a7c';
        Chart.defaults.borderColor = '#ede6d8';
        Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
        Chart.defaults.font.size = 12;
    },

    // 创建或更新图表
    renderChart(id, config) {
        this.destroyChart(id);
        const ctx = document.getElementById(id);
        if (!ctx) return null;
        this.chartInstances[id] = new Chart(ctx, config);
        return this.chartInstances[id];
    }
};

// 账户分类映射
const ACCOUNT_CATEGORIES = {
    'ewallet': { label: '电子钱包', icon: '📱', class: 'cat-ewallet' },
    'bank': { label: '银行卡', icon: '🏦', class: 'cat-bank' },
    'social': { label: '社保/公积金', icon: '📋', class: 'cat-social' },
    'investment': { label: '投资账户', icon: '📈', class: 'cat-investment' },
    'other': { label: '其他', icon: '📦', class: 'cat-other' }
};

// 账户类型映射
const ACCOUNT_TYPES = {
    'alipay': { label: '支付宝', category: 'ewallet', canHoldPositions: true },
    'huabei': { label: '花呗', category: 'ewallet', isDebt: true },
    'wechat_balance': { label: '微信余额', category: 'ewallet' },
    'wechat_finance': { label: '微信理财', category: 'ewallet' },
    'credit_card': { label: '信用卡', category: 'bank', isDebt: true },
    'debit_card': { label: '借记卡', category: 'bank' },
    'provident_fund': { label: '住房公积金', category: 'social' },
    'medical_insurance': { label: '医保账户', category: 'social' },
    'pension': { label: '个人养老金', category: 'social' },
    'stock_a': { label: 'A股', category: 'investment', canHoldPositions: true },
    'stock_hk': { label: '港股', category: 'investment', canHoldPositions: true },
    'stock_us': { label: '美股', category: 'investment', canHoldPositions: true },
    'fund_platform': { label: '基金平台', category: 'investment', canHoldPositions: true },
    'other': { label: '其他', category: 'other' }
};

// 持仓类别映射
const HOLDING_CATEGORIES = {
    'stock_a': 'A股',
    'stock_hk': '港股',
    'stock_us': '美股',
    'fund_domestic': '国内基金',
    'fund_qdii': 'QDII基金',
    'fund_bond': '债券基金',
    'gold': '实物黄金',
    'commodity': '实物商品基金',
    'bond': '债券',
    'other': '其他'
};

// 收入来源映射
const INCOME_SOURCES = {
    'salary': '工资收入',
    'part_time': '兼职收入',
    'tarot': '塔罗占卜',
    'red_packet': '红包',
    'investment': '投资收益',
    'other': '其他'
};

// 市场类型映射（兼容旧版持仓）
const MARKET_TYPES = {
    'A': 'A股',
    'HK': '港股',
    'US': '美股',
    'fund': '基金',
    'bond': '债券'
};

// 交易类型映射
const TRANSACTION_TYPES = {
    'buy': '买入',
    'sell': '卖出',
    'dividend': '分红',
    'interest': '利息',
    'fee': '手续费',
    'deposit': '入金',
    'withdraw': '出金'
};

// 运动类型映射
const WORKOUT_TYPES = {
    'strength': '力量训练',
    'cardio': '有氧运动',
    'yoga': '瑜伽/柔韧'
};

// 运动强度映射
const INTENSITY_LEVELS = {
    'low': '低强度',
    'medium': '中等强度',
    'high': '高强度'
};

// 牌阵类型映射
const SPREAD_TYPES = {
    'three_card': '三牌阵',
    'celtic_cross': '凯尔特十字',
    'relationship': '关系阵',
    'hexagram': '六芒星',
    'time_flow': '时间流',
    'horse_shoe': '马蹄阵',
    'custom': '自定义'
};

// 塔罗牌大阿尔卡纳
const MAJOR_ARCANA = [
    '愚者', '魔术师', '女祭司', '皇后', '皇帝', '教皇', '恋人', '战车',
    '力量', '隐士', '命运之轮', '正义', '倒吊人', '死神', '节制', '恶魔',
    '高塔', '星星', '月亮', '太阳', '审判', '世界'
];

// 塔罗牌小阿尔卡纳
const MINOR_ARCANA = [
    '权杖Ace', '权杖二', '权杖三', '权杖四', '权杖五', '权杖六', '权杖七', '权杖八', '权杖九', '权杖十', '权杖侍从', '权杖骑士', '权杖王后', '权杖国王',
    '圣杯Ace', '圣杯二', '圣杯三', '圣杯四', '圣杯五', '圣杯六', '圣杯七', '圣杯八', '圣杯九', '圣杯十', '圣杯侍从', '圣杯骑士', '圣杯王后', '圣杯国王',
    '宝剑Ace', '宝剑二', '宝剑三', '宝剑四', '宝剑五', '宝剑六', '宝剑七', '宝剑八', '宝剑九', '宝剑十', '宝剑侍从', '宝剑骑士', '宝剑王后', '宝剑国王',
    '星币Ace', '星币二', '星币三', '星币四', '星币五', '星币六', '星币七', '星币八', '星币九', '星币十', '星币侍从', '星币骑士', '星币王后', '星币国王'
];

const ALL_TAROT_CARDS = [...MAJOR_ARCANA, ...MINOR_ARCANA];

// 断舍离物品分类
const MINIMALISM_CATEGORIES = {
    'skincare': '护肤/化妆品',
    'food': '食品/饮品',
    'supplement': '保健品',
    'clothing': '服饰/配件',
    'kitchen': '厨房/餐具',
    'stationery': '文具/书籍',
    'electronics': '电子产品',
    'household': '家居用品',
    'other': '其他'
};

// 断舍离物品状态
const MINIMALISM_STATUS = {
    'active': '使用中',
    'completed': '已用完',
    'discarded': '已处理'
};

// 读书状态
const BOOK_STATUS = {
    'want_read': '想读',
    'reading': '在读',
    'finished': '已读',
    'paused': '搁置'
};

// 读书分类
const BOOK_CATEGORIES = {
    'finance': '金融投资',
    'philosophy': '哲学心理',
    'novel': '小说文学',
    'history': '历史人文',
    'science': '科学技术',
    'self_help': '自我提升',
    'spirituality': '灵性塔罗',
    'business': '商业管理',
    'other': '其他'
};
