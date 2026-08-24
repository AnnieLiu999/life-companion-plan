/**
 * 仪表盘总览模块
 */
const DashboardModule = {

    render() {
        this.renderFinanceSummary();
        this.renderFitnessSummary();
        this.renderTarotSummary();
        this.renderAdvice();
        this.renderActivity();
    },

    // 财务摘要
    renderFinanceSummary() {
        const s = FinanceModule.getSummary();
        document.getElementById('dash-net-worth').textContent = Utils.formatMoney(s.netWorth);

        const changeEl = document.getElementById('dash-monthly-change');
        if (s.monthlyChange !== 0) {
            changeEl.textContent = (s.monthlyChange >= 0 ? '+' : '') + Utils.formatMoney(s.monthlyChange);
            changeEl.className = 'metric-value ' + (s.monthlyChange >= 0 ? 'up' : 'down');
        } else {
            changeEl.textContent = '--';
            changeEl.className = 'metric-value';
        }

        const progressEl = document.getElementById('dash-target-progress');
        if (PrivacyMode.isEnabled()) {
            progressEl.textContent = '***';
        } else {
            progressEl.textContent = s.progress.toFixed(1) + '%';
        }
        progressEl.className = 'metric-value ' + (s.progress >= 75 ? 'up' : '');
    },

    // 运动摘要
    renderFitnessSummary() {
        const s = FitnessModule.getSummary();
        document.getElementById('dash-weekly-workouts').textContent = s.weeklyCount + ' 次';
        document.getElementById('dash-weekly-duration').textContent = s.weeklyDuration + ' min';
        document.getElementById('dash-current-weight').textContent = s.currentWeight ? s.currentWeight + ' kg' : '--';
    },

    // 塔罗摘要
    renderTarotSummary() {
        const s = TarotModule.getSummary();
        document.getElementById('dash-clients-count').textContent = s.clientsCount + ' 人';
        document.getElementById('dash-readings-count').textContent = s.readingsCount + ' 次';
        const followupEl = document.getElementById('dash-pending-followup');
        followupEl.textContent = s.pendingCount + ' 项';
        followupEl.className = 'metric-value ' + (s.pendingCount > 0 ? 'down' : '');
    },

    // 智能建议（汇总三模块）
    renderAdvice() {
        const allAdvice = [];

        // 财务建议
        const finAdvice = FinanceModule.generateAdvice();
        finAdvice.forEach(a => allAdvice.push({ ...a, module: 'finance' }));

        // 运动建议
        const fitAdvice = FitnessModule.generateTrainingAdvice();
        fitAdvice.forEach(a => allAdvice.push({ ...a, module: 'fitness' }));

        // 塔罗建议
        const tarotAdvice = this.generateTarotAdvice();
        tarotAdvice.forEach(a => allAdvice.push({ ...a, module: 'tarot' }));

        // 按优先级排序：warning > normal > success
        const priority = { 'advice-warning': 0, 'advice-finance': 1, 'advice-fitness': 1, 'advice-tarot': 1, 'advice-success': 2 };
        allAdvice.sort((a, b) => (priority[a.type] || 1) - (priority[b.type] || 1));

        const container = document.getElementById('dash-advice-list');
        if (allAdvice.length === 0) {
            container.innerHTML = '<div class="advice-empty">暂无建议，开始录入数据后将为你生成个性化建议</div>';
            return;
        }

        // 只显示前 8 条
        container.innerHTML = allAdvice.slice(0, 8).map(a => `
            <div class="advice-item ${a.type}">
                <div class="advice-item-icon">${a.icon}</div>
                <div class="advice-item-content">
                    <div class="advice-item-title">${a.title}</div>
                    <div class="advice-item-desc">${a.desc}</div>
                </div>
            </div>`).join('');
    },

    // 塔罗建议
    generateTarotAdvice() {
        const advice = [];
        const readings = Store.tarot.getReadings();
        const clients = Store.tarot.getClients();

        if (clients.length === 0) return advice;

        // 1. 待跟进提醒
        const pendingFollowups = readings.filter(r => r.followUpDate && r.followUpDate <= Utils.today() && !r.followUpCompleted);
        if (pendingFollowups.length > 0) {
            pendingFollowups.slice(0, 3).forEach(r => {
                const client = Store.tarot.getClient(r.clientId);
                advice.push({
                    type: 'advice-warning',
                    icon: '⏰',
                    title: '客户跟进提醒',
                    desc: `${client ? client.name : '未知客户'} 的占卜跟进日期已到（${r.followUpDate}），建议主动联系了解近况。`
                });
            });
        }

        // 2. 近期无记录的老客户
        if (clients.length > 0 && readings.length > 0) {
            const oldClients = clients.filter(c => {
                const clientReadings = Store.tarot.getReadingsByClient(c.id);
                if (clientReadings.length === 0) return false;
                const lastReading = clientReadings[0];
                const daysSince = Utils.daysBetween(lastReading.date, Utils.today());
                return daysSince > 60;
            });
            if (oldClients.length > 0) {
                advice.push({
                    type: 'advice-tarot',
                    icon: '✦',
                    title: '老客户关怀',
                    desc: `${oldClients.length} 位客户超过 60 天未联系，建议主动问候维护客户关系。`
                });
            }
        }

        // 3. 新客户无记录
        const newClientsNoReading = clients.filter(c => {
            const clientReadings = Store.tarot.getReadingsByClient(c.id);
            return clientReadings.length === 0;
        });
        if (newClientsNoReading.length > 0) {
            advice.push({
                type: 'advice-tarot',
                icon: '★',
                title: '新客户待服务',
                desc: `${newClientsNoReading.length} 位客户尚未有占卜记录，可以主动了解他们的需求。`
            });
        }

        return advice;
    },

    // 近期活动
    renderActivity() {
        const activities = [];

        // 财务活动
        const transactions = Store.finance.getTransactions().slice(0, 5);
        transactions.forEach(t => {
            const holding = Store.finance.getHoldings().find(h => h.id === t.holdingId);
            activities.push({
                date: t.date,
                module: 'finance',
                text: `${TRANSACTION_TYPES[t.type] || t.type} ${holding ? holding.name : ''} ${t.quantity || ''} ${t.quantity ? '份' : ''}`.trim()
            });
        });

        // 收入活动
        const incomes = Store.finance.getIncomes().slice(0, 5);
        incomes.forEach(inc => {
            activities.push({
                date: inc.date,
                module: 'finance',
                text: `收入 · ${INCOME_SOURCES[inc.source] || inc.source} ${PrivacyMode.isEnabled() ? '' : '+' + Utils.formatMoneyRaw(inc.amount)}`
            });
        });

        // 对账活动
        const snapshots = Store.finance.getSnapshots().slice(0, 3);
        snapshots.forEach(snap => {
            const total = snap.totalNetWorth !== undefined ? snap.totalNetWorth :
                Object.values(snap.balances).reduce((a, b) => a + (b || 0), 0);
            activities.push({
                date: snap.date,
                module: 'finance',
                text: `月度对账 · 净资产 ${PrivacyMode.isEnabled() ? '¥***' : Utils.formatMoneyRaw(total)}`
            });
        });

        // 运动活动
        const workouts = Store.fitness.getWorkouts().slice(0, 5);
        workouts.forEach(w => {
            activities.push({
                date: w.date,
                module: 'fitness',
                text: `${WORKOUT_TYPES[w.type] || w.type} ${w.duration || 0}分钟 ${INTENSITY_LEVELS[w.intensity] || ''}`.trim()
            });
        });

        // 塔罗活动
        const readings = Store.tarot.getReadings().slice(0, 5);
        readings.forEach(r => {
            const client = Store.tarot.getClient(r.clientId);
            activities.push({
                date: r.date,
                module: 'tarot',
                text: `为 ${client ? client.name : '未知客户'} 占卜 · ${r.topic || '未分类'}`
            });
        });

        // 入手记录活动
        const purchases = Store.minimalism.getPurchases().slice(0, 5);
        purchases.forEach(p => {
            activities.push({
                date: p.purchaseDate || Utils.formatDate(p.createdAt),
                module: 'minimalism',
                text: `入手 · 「${p.name}」${p.price ? ' ' + Utils.formatMoney(parseFloat(p.price)) : ''}`
            });
        });

        // 断舍离活动
        const discardLabels = { 'used-up': '用完', 'discard': '丢弃', 'giveaway': '送出', 'expired': '过期处理' };
        const achievements = Store.minimalism.getAchievements().slice(0, 5);
        achievements.forEach(a => {
            const label = discardLabels[a.discardType] || '用完';
            activities.push({
                date: Utils.formatDate(a.completedAt),
                module: 'minimalism',
                text: `断舍离 · ${label}「${a.itemName}」`
            });
        });

        // 读书活动
        const readSessions = Store.reading.getSessions().slice(0, 5);
        readSessions.forEach(s => {
            const book = Store.reading.getBook(s.bookId);
            activities.push({
                date: s.date,
                module: 'fitness',
                text: `阅读「${book ? book.title : ''}」${s.duration || 0}分钟`
            });
        });

        // 读书完成活动
        const finishedBooks = Store.reading.getBooksByStatus('finished').slice(0, 5);
        finishedBooks.forEach(b => {
            if (b.finishedDate) {
                activities.push({
                    date: b.finishedDate,
                    module: 'fitness',
                    text: `读完「${b.title}」📖`
                });
            }
        });

        // 按日期排序
        activities.sort((a, b) => b.date.localeCompare(a.date));

        const container = document.getElementById('dash-activity-list');
        if (activities.length === 0) {
            container.innerHTML = '<div class="activity-empty">暂无活动记录</div>';
            return;
        }

        container.innerHTML = activities.slice(0, 12).map(a => `
            <div class="activity-item">
                <span class="activity-dot ${a.module}"></span>
                <span class="activity-time">${a.date}</span>
                <span class="activity-text">${Utils.escapeHtml(a.text)}</span>
            </div>`).join('');
    }
};
