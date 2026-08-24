/**
 * 主应用控制器
 */
const App = {

    currentView: 'dashboard',

    init() {
        PrivacyMode.init();
        Utils.initChartDefaults();
        this.setupNavigation();
        this.updateDate();
        this.renderAll();

        // 每分钟更新日期
        setInterval(() => this.updateDate(), 60000);
    },

    // 设置导航
    setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const view = item.dataset.view;
                this.switchView(view);
            });
        });

        // 仪表盘快捷链接
        document.querySelectorAll('.dash-card-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const view = link.dataset.view;
                this.switchView(view);
            });
        });
    },

    // 切换视图
    switchView(view) {
        this.currentView = view;

        // 更新导航高亮
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.view === view);
        });

        // 切换视图显示
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const targetView = document.getElementById(`view-${view}`);
        if (targetView) targetView.classList.add('active');

        // 更新标题
        const titles = {
            dashboard: '仪表盘',
            finance: '财务管理',
            fitness: '运动健康',
            tarot: '塔罗客户',
            minimalism: '入手+断舍离',
            reading: '读书进度'
        };
        document.getElementById('page-title').textContent = titles[view] || '';

        // 渲染对应模块
        switch (view) {
            case 'dashboard':
                DashboardModule.render();
                break;
            case 'finance':
                FinanceModule.render();
                break;
            case 'fitness':
                FitnessModule.render();
                break;
            case 'tarot':
                TarotModule.render();
                break;
            case 'minimalism':
                MinimalismModule.render();
                break;
            case 'reading':
                ReadingModule.render();
                break;
        }

        // 滚动到顶部
        document.querySelector('.view-container').scrollTop = 0;
    },

    // 更新日期显示
    updateDate() {
        const now = new Date();
        const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
        const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 周${weekdays[now.getDay()]}`;
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        document.getElementById('current-date').textContent = `${dateStr} ${timeStr}`;
    },

    // 渲染所有模块
    renderAll() {
        DashboardModule.render();
        FinanceModule.render();
        FitnessModule.render();
        TarotModule.render();
        MinimalismModule.render();
        ReadingModule.render();
    }
};

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
