/**
 * 财务管理模块 v2.0
 * 全资产净值管理 + 月度对账 + 收入追踪 + 持仓明细
 */
const FinanceModule = {
    charts: {},
    currentTab: 'overview',

    // 渲染整个模块
    render() {
        this.renderOverview();
        this.renderReconcile();
        this.renderAccounts();
        this.renderHoldings();
        this.renderIncome();
        this.renderTransactions();
        // 今日财经仅在切到该 Tab 时加载，避免初始化时竞态
        if (this.currentTab === 'news') {
            this.renderNews();
        }
    },

    // Tab 切换
    switchTab(tabName) {
        this.currentTab = tabName;
        document.querySelectorAll('.fin-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tabName);
        });
        document.querySelectorAll('.fin-tab-content').forEach(c => {
            c.classList.toggle('active', c.id === 'fin-tab-' + tabName);
        });
        // 切换到今日财经时触发加载（如果尚未加载）
        if (tabName === 'news' && !this.newsData && !this.newsLoading) {
            this.renderNews();
        }
    },

    // ===== 数据汇总 =====
    getSummary() {
        const accounts = Store.finance.getAccounts();
        const goals = Store.finance.getGoals();
        const snapshots = Store.finance.getSnapshots();

        let totalAssets = 0;
        let totalDebts = 0;

        accounts.forEach(acc => {
            const balance = acc.balance || 0;
            if (balance >= 0) {
                totalAssets += balance;
            } else {
                totalDebts += Math.abs(balance);
            }
        });

        const netWorth = totalAssets - totalDebts;
        const targetNetWorth = goals.targetNetWorth || 2000000;
        const targetGap = targetNetWorth - netWorth;
        const progress = targetNetWorth > 0 ? (netWorth / targetNetWorth) * 100 : 0;

        // 区分流动资产 vs 限制性资产
        const restrictedCategories = ['social'];
        let liquidAssets = 0;
        let restrictedAssets = 0;
        accounts.forEach(acc => {
            const balance = acc.balance || 0;
            if (balance > 0) {
                if (restrictedCategories.includes(acc.category)) {
                    restrictedAssets += balance;
                } else {
                    liquidAssets += balance;
                }
            }
        });

        let monthlyChange = 0;
        let lastReconcileDate = '';
        if (snapshots.length > 0) {
            const latest = snapshots[0];
            lastReconcileDate = latest.date;
            if (snapshots.length > 1) {
                monthlyChange = (latest.totalNetWorth !== undefined ? latest.totalNetWorth : netWorth) - snapshots[1].totalNetWorth;
            }
        }

        return {
            totalAssets, totalDebts, netWorth,
            liquidAssets, restrictedAssets,
            targetNetWorth, targetGap, progress,
            monthlyChange, lastReconcileDate,
            accountsCount: accounts.length,
            holdingsCount: Store.finance.getHoldings().length
        };
    },

    // ===== 总览 Tab =====
    renderOverview() {
        const s = this.getSummary();

        document.getElementById('fin-total-assets').textContent = Utils.formatMoney(s.totalAssets);
        document.getElementById('fin-total-debts').textContent = Utils.formatMoney(s.totalDebts);
        document.getElementById('fin-net-worth').textContent = Utils.formatMoney(s.netWorth);
        document.getElementById('fin-target-gap').textContent = Utils.formatMoney(Math.max(0, s.targetGap));

        // 流动性分类
        const liquidEl = document.getElementById('fin-liquid-assets');
        if (liquidEl) liquidEl.textContent = Utils.formatMoney(s.liquidAssets);
        const restrictedEl = document.getElementById('fin-restricted-assets');
        if (restrictedEl) restrictedEl.textContent = Utils.formatMoney(s.restrictedAssets);

        // 目标进度
        const progressEl = document.getElementById('fin-progress-fill');
        if (progressEl) progressEl.style.width = Math.min(100, s.progress).toFixed(1) + '%';
        const targetText = document.getElementById('fin-target-text');
        if (targetText) targetText.textContent = Utils.formatMoney(s.netWorth) + ' / ' + Utils.formatMoney(s.targetNetWorth);

        const lastRecEl = document.getElementById('fin-last-reconcile');
        if (lastRecEl) lastRecEl.textContent = '上次对账: ' + (s.lastReconcileDate || '尚未对账');

        const changeEl = document.getElementById('fin-monthly-change');
        if (changeEl) {
            if (s.monthlyChange !== 0) {
                changeEl.textContent = '月度变动: ' + (s.monthlyChange >= 0 ? '+' : '') + Utils.formatMoney(s.monthlyChange);
                changeEl.className = 'target-change ' + (s.monthlyChange >= 0 ? 'up' : 'down');
            } else {
                changeEl.textContent = '月度变动: --';
                changeEl.className = 'target-change';
            }
        }

        this.renderCharts();
        this.renderAdvice();
    },

    // ===== 月度对账 Tab =====
    renderReconcile() {
        const snapshots = Store.finance.getSnapshots();
        const goals = Store.finance.getGoals();
        const tbody = document.getElementById('fin-snapshots-body');
        if (!tbody) return;

        if (snapshots.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-tertiary);padding:30px;">暂无对账记录，点击上方按钮开始第一次月度对账</td></tr>';
            return;
        }

        tbody.innerHTML = snapshots.map((snap, i) => {
            const total = snap.totalNetWorth !== undefined ? snap.totalNetWorth :
                Object.values(snap.balances).reduce((a, b) => a + (b || 0), 0);
            const prevTotal = i < snapshots.length - 1 ?
                (snapshots[i + 1].totalNetWorth !== undefined ? snapshots[i + 1].totalNetWorth :
                 Object.values(snapshots[i + 1].balances).reduce((a, b) => a + (b || 0), 0)) : null;
            const change = prevTotal !== null ? total - prevTotal : null;
            const gap = (goals.targetNetWorth || 2000000) - total;
            const progress = ((total / (goals.targetNetWorth || 2000000)) * 100).toFixed(1);

            return `<tr>
                <td>${snap.date}</td>
                <td>${Utils.formatMoney(total)}</td>
                <td>${Utils.formatMoney(total)}</td>
                <td class="${change !== null && change >= 0 ? 'text-up' : 'text-down'}">${change !== null ? (change >= 0 ? '+' : '') + Utils.formatMoney(change) : '--'}</td>
                <td>${Utils.formatMoney(Math.max(0, gap))}</td>
                <td>${PrivacyMode.isEnabled() ? '***' : progress + '%'}</td>
                <td>${Utils.escapeHtml(snap.note || '')}</td>
                <td><button class="btn btn-danger btn-sm" onclick="FinanceModule.deleteSnapshot('${snap.id}')">删除</button></td>
            </tr>`;
        }).join('');
    },

    // ===== 账户管理 Tab =====
    renderAccounts() {
        const accounts = Store.finance.getAccounts();
        const container = document.getElementById('fin-account-list');
        if (!container) return;

        const grouped = {};
        Object.keys(ACCOUNT_CATEGORIES).forEach(cat => {
            grouped[cat] = accounts.filter(a => a.category === cat);
        });

        container.innerHTML = Object.entries(ACCOUNT_CATEGORIES).map(([catKey, catInfo]) => {
            const catAccounts = grouped[catKey] || [];
            if (catAccounts.length === 0) return '';

            let catTotal = 0;
            catAccounts.forEach(a => { catTotal += (a.balance || 0); });

            return `<div class="category-section">
                <div class="category-header">
                    <h3>${catInfo.icon} ${catInfo.label}</h3>
                    <span class="category-total ${catTotal >= 0 ? 'text-up' : 'text-down'}">${Utils.formatMoney(catTotal)}</span>
                </div>
                <div class="account-grid">
                    ${catAccounts.map(acc => {
                        const typeInfo = ACCOUNT_TYPES[acc.type] || { label: acc.type };
                        const balance = acc.balance || 0;
                        const isDebt = balance < 0 || acc.isDebt;
                        return `<div class="account-card">
                            <div class="account-card-header">
                                <span class="account-name">${Utils.escapeHtml(acc.name)}</span>
                                <span class="account-type-badge ${typeInfo.class || ''}">${typeInfo.label}</span>
                            </div>
                            ${acc.institution ? `<div style="font-size:12px;color:var(--text-tertiary);margin-bottom:6px;">${Utils.escapeHtml(acc.institution)}</div>` : ''}
                            <div class="account-balance ${isDebt && balance < 0 ? 'text-down' : ''}">${Utils.formatMoney(balance)}</div>
                            <div style="margin-top:8px;display:flex;gap:6px;">
                                <button class="btn btn-secondary btn-sm" onclick="FinanceModule.editAccount('${acc.id}')">编辑</button>
                                <button class="btn btn-danger btn-sm" onclick="FinanceModule.deleteAccount('${acc.id}')">删除</button>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
        }).join('');
    },

    // ===== 持仓明细 Tab =====
    renderHoldings() {
        const holdings = Store.finance.getHoldings();
        const accounts = Store.finance.getAccounts();
        const accountMap = {};
        accounts.forEach(a => accountMap[a.id] = a);

        const tbody = document.getElementById('fin-holdings-body');
        if (!tbody) return;

        if (holdings.length === 0) {
            tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--text-tertiary);padding:30px;">暂无持仓记录。可在支付宝、雪球、同花顺等投资账户下添加具体持仓（股票/基金/债券/黄金等）</td></tr>';
            return;
        }

        tbody.innerHTML = holdings.map(h => {
            const acc = accountMap[h.accountId];
            const marketValue = (h.currentPrice || 0) * h.quantity;
            const costValue = (h.costPrice || 0) * h.quantity;
            const pnl = marketValue - costValue;
            const returnRate = costValue > 0 ? (pnl / costValue) * 100 : 0;
            const pnlClass = pnl >= 0 ? 'text-up' : 'text-down';
            const catLabel = HOLDING_CATEGORIES[h.category] || h.category || '--';

            return `<tr>
                <td>${acc ? Utils.escapeHtml(acc.name) : '--'}</td>
                <td>${catLabel}</td>
                <td>${Utils.escapeHtml(h.code || '')}</td>
                <td>${Utils.escapeHtml(h.name || '')}</td>
                <td>${PrivacyMode.isEnabled() ? '***' : h.quantity}</td>
                <td>${PrivacyMode.isEnabled() ? '***' : Utils.formatNumber(h.costPrice)}</td>
                <td>${PrivacyMode.isEnabled() ? '' : '<input type="number" value="' + (h.currentPrice || '') + '" step="0.01" style="width:80px;padding:4px 6px;border:1px solid var(--border-color);border-radius:4px;font-size:12px;" onchange="FinanceModule.updatePrice(\'' + h.id + '\', this.value)">'}</td>
                <td>${Utils.formatMoney(marketValue)}</td>
                <td class="${pnlClass}">${pnl >= 0 ? '+' : ''}${Utils.formatMoney(pnl)}</td>
                <td class="${pnlClass}">${PrivacyMode.isEnabled() ? '***' : Utils.formatPercent(returnRate)}</td>
                <td>
                    <div class="table-actions">
                        <button class="btn btn-secondary btn-sm" onclick="FinanceModule.editHolding('${h.id}')">编辑</button>
                        <button class="btn btn-danger btn-sm" onclick="FinanceModule.deleteHolding('${h.id}')">删除</button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    },

    // ===== 收入记录 Tab =====
    renderIncome() {
        const incomes = Store.finance.getIncomes();
        const now = new Date();
        const monthStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
        const yearStr = String(now.getFullYear());

        let monthlyTotal = 0;
        let yearlyTotal = 0;
        incomes.forEach(inc => {
            if (inc.date && inc.date.startsWith(monthStr)) monthlyTotal += inc.amount || 0;
            if (inc.date && inc.date.startsWith(yearStr)) yearlyTotal += inc.amount || 0;
        });

        const monthlyEl = document.getElementById('fin-monthly-income');
        if (monthlyEl) monthlyEl.textContent = Utils.formatMoney(monthlyTotal);
        const yearlyEl = document.getElementById('fin-yearly-income');
        if (yearlyEl) yearlyEl.textContent = Utils.formatMoney(yearlyTotal);

        const tbody = document.getElementById('fin-income-body');
        if (!tbody) return;

        if (incomes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-tertiary);padding:30px;">暂无收入记录</td></tr>';
            return;
        }

        tbody.innerHTML = incomes.slice(0, 50).map(inc => {
            return `<tr>
                <td>${inc.date}</td>
                <td>${INCOME_SOURCES[inc.source] || inc.source || '--'}</td>
                <td class="text-up">+${Utils.formatMoney(inc.amount || 0)}</td>
                <td>${Utils.escapeHtml(inc.note || '')}</td>
                <td><button class="btn btn-danger btn-sm" onclick="FinanceModule.deleteIncome('${inc.id}')">删除</button></td>
            </tr>`;
        }).join('');
    },

    // ===== 交易记录 Tab =====
    renderTransactions() {
        const transactions = Store.finance.getTransactions();
        const holdings = Store.finance.getHoldings();
        const holdingMap = {};
        holdings.forEach(h => holdingMap[h.id] = h);

        const tbody = document.getElementById('fin-transactions-body');
        if (!tbody) return;

        if (transactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text-tertiary);padding:30px;">暂无交易记录</td></tr>';
            return;
        }

        tbody.innerHTML = transactions.slice(0, 50).map(t => {
            const h = holdingMap[t.holdingId];
            const amount = (t.quantity || 0) * (t.price || 0);
            return `<tr>
                <td>${t.date}</td>
                <td>${h ? Utils.escapeHtml(h.code) : '--'}</td>
                <td>${h ? Utils.escapeHtml(h.name) : t.note || '--'}</td>
                <td>${TRANSACTION_TYPES[t.type] || t.type}</td>
                <td>${PrivacyMode.isEnabled() ? '***' : (t.quantity || '--')}</td>
                <td>${t.price ? (PrivacyMode.isEnabled() ? '***' : Utils.formatNumber(t.price)) : '--'}</td>
                <td>${Utils.formatMoney(amount)}</td>
                <td>${t.fee ? Utils.formatMoney(t.fee) : '--'}</td>
                <td>${Utils.escapeHtml(t.note || '')}</td>
            </tr>`;
        }).join('');
    },

    // ===== 图表 =====
    renderCharts() {
        this.renderNetWorthTrend();
        this.renderAllocationChart();
    },

    // 净资产趋势图
    renderNetWorthTrend() {
        const snapshots = Store.finance.getSnapshots().reverse();
        const goals = Store.finance.getGoals();

        if (snapshots.length === 0) {
            Utils.renderChart('chart-networth-trend', {
                type: 'line',
                data: { labels: [], datasets: [] },
                options: { responsive: true, maintainAspectRatio: false }
            });
            return;
        }

        const labels = snapshots.map(s => s.date);
        const data = snapshots.map(s => s.totalNetWorth !== undefined ? s.totalNetWorth :
            Object.values(s.balances).reduce((a, b) => a + (b || 0), 0));

        Utils.renderChart('chart-networth-trend', {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '净资产',
                    data: data,
                    borderColor: '#7b8fb0',
                    backgroundColor: 'rgba(123, 143, 176, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 5,
                    pointBackgroundColor: '#7b8fb0'
                }, {
                    label: '目标',
                    data: labels.map(() => goals.targetNetWorth || 2000000),
                    borderColor: '#d4837a',
                    borderDash: [8, 4],
                    fill: false,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { font: { size: 12 } } },
                    tooltip: {
                        callbacks: {
                            label: function(ctx) {
                                return ctx.dataset.label + ': ' + Utils.formatMoney(ctx.parsed.y);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        ticks: {
                            callback: function(v) { return Utils.formatMoney(v); }
                        }
                    }
                }
            }
        });
    },

    // 资产分类分布图（区分流动资产 vs 限制性资产）
    renderAllocationChart() {
        const accounts = Store.finance.getAccounts();

        // 限制性资产分类（退休后才能支取）
        const restrictedCategories = ['social'];

        const categoryValues = {};
        const categoryLiquidity = {};

        accounts.forEach(acc => {
            const balance = acc.balance || 0;
            if (balance > 0) {
                const cat = acc.category || 'other';
                if (!categoryValues[cat]) categoryValues[cat] = 0;
                categoryValues[cat] += balance;
                categoryLiquidity[cat] = restrictedCategories.includes(cat) ? 'restricted' : 'liquid';
            }
        });

        const catKeys = Object.keys(categoryValues);

        if (catKeys.length === 0) {
            Utils.renderChart('chart-asset-allocation', {
                type: 'doughnut',
                data: { labels: ['暂无数据'], datasets: [{ data: [1], backgroundColor: ['#e5dccc'] }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
            });
            return;
        }

        const labels = catKeys.map(c => ACCOUNT_CATEGORIES[c]?.label || c);
        const data = catKeys.map(c => categoryValues[c]);

        // 流动资产用鲜亮色，限制性资产用灰调色
        const liquidColors = ['#7b8fb0', '#c8966b', '#7faa82', '#6ba8a8', '#d4a55a'];
        const restrictedColors = ['#bbb0a0', '#c4bbab', '#d4ccbe'];
        let liquidIdx = 0, restrictedIdx = 0;
        const colors = catKeys.map(c => {
            if (categoryLiquidity[c] === 'restricted') {
                return restrictedColors[restrictedIdx++ % restrictedColors.length];
            }
            return liquidColors[liquidIdx++ % liquidColors.length];
        });

        Utils.renderChart('chart-asset-allocation', {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            font: { size: 12 },
                            padding: 10,
                            generateLabels: function(chart) {
                                const chartData = chart.data;
                                return chartData.labels.map((label, i) => {
                                    const catKey = catKeys[i];
                                    const isRestricted = categoryLiquidity[catKey] === 'restricted';
                                    return {
                                        text: label + (isRestricted ? ' (限制性)' : ''),
                                        fillStyle: chartData.datasets[0].backgroundColor[i],
                                        strokeStyle: chartData.datasets[0].backgroundColor[i],
                                        lineWidth: 0,
                                        hidden: false,
                                        index: i
                                    };
                                });
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(ctx) {
                                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                                const pct = total > 0 ? (ctx.parsed / total * 100).toFixed(1) : 0;
                                const catKey = catKeys[ctx.dataIndex];
                                const liquidityLabel = categoryLiquidity[catKey] === 'restricted' ? ' [限制性·退休后支取]' : ' [可随时支配]';
                                return ctx.label + liquidityLabel + ': ' + Utils.formatMoney(ctx.parsed) + ' (' + pct + '%)';
                            }
                        }
                    }
                }
            }
        });
    },

    // 更新现价
    updatePrice(holdingId, price) {
        const p = parseFloat(price);
        if (isNaN(p)) return;
        Store.finance.updateHolding(holdingId, { currentPrice: p });
        this.renderHoldings();
        this.renderOverview();
        Utils.toast('现价已更新');
    },

    // ===== 财务建议 =====
    renderAdvice() {
        const advice = this.generateAdvice();
        const container = document.getElementById('fin-advice-list');
        if (!container) return;

        if (advice.length === 0) {
            container.innerHTML = '<div class="advice-empty">开始月度对账后将为你生成个性化财务建议</div>';
            return;
        }

        container.innerHTML = advice.map(a => `
            <div class="advice-item ${a.type}">
                <div class="advice-item-icon">${a.icon}</div>
                <div class="advice-item-content">
                    <div class="advice-item-title">${a.title}</div>
                    <div class="advice-item-desc">${a.desc}</div>
                </div>
            </div>`).join('');
    },

    generateAdvice() {
        const advice = [];
        const s = this.getSummary();
        const accounts = Store.finance.getAccounts();
        const snapshots = Store.finance.getSnapshots();
        const holdings = Store.finance.getHoldings();
        const goals = Store.finance.getGoals();

        if (accounts.length === 0) return advice;

        // 1. 目标进度
        if (s.progress >= 100) {
            advice.push({ type: 'advice-success', icon: '★', title: '财富自由达成！', desc: `净资产 ${Utils.formatMoney(s.netWorth)} 已超过目标 ${Utils.formatMoney(s.targetNetWorth)}，恭喜！` });
        } else if (s.progress >= 75) {
            advice.push({ type: 'advice-success', icon: '↑', title: '目标进度良好', desc: `已完成 ${PrivacyMode.maskPct(s.progress)}，距目标还差 ${Utils.formatMoney(s.targetGap)}。保持当前增长节奏即可。` });
        } else if (s.progress >= 50) {
            advice.push({ type: 'advice-finance', icon: '◆', title: '目标过半', desc: `已完成 ${PrivacyMode.maskPct(s.progress)}，距目标还差 ${Utils.formatMoney(s.targetGap)}。建议关注收入增长和投资收益。` });
        } else {
            advice.push({ type: 'advice-finance', icon: '◆', title: '财富积累中', desc: `当前进度 ${PrivacyMode.maskPct(s.progress)}，距目标 ${Utils.formatMoney(s.targetNetWorth)} 还差 ${Utils.formatMoney(s.targetGap)}。` });
        }

        // 2. 月度增长趋势
        if (snapshots.length >= 2) {
            const changes = [];
            for (let i = 0; i < snapshots.length - 1; i++) {
                const curr = snapshots[i].totalNetWorth !== undefined ? snapshots[i].totalNetWorth :
                    Object.values(snapshots[i].balances).reduce((a, b) => a + (b || 0), 0);
                const prev = snapshots[i + 1].totalNetWorth !== undefined ? snapshots[i + 1].totalNetWorth :
                    Object.values(snapshots[i + 1].balances).reduce((a, b) => a + (b || 0), 0);
                changes.push(curr - prev);
            }
            const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;
            if (avgChange > 0) {
                const monthsToTarget = s.targetGap > 0 ? Math.ceil(s.targetGap / avgChange) : 0;
                advice.push({ type: 'advice-success', icon: '↗', title: '净资产稳步增长', desc: `近 ${changes.length} 个月平均月增 ${Utils.formatMoney(avgChange)}。按此速度${monthsToTarget > 0 ? `，约 ${monthsToTarget} 个月后达成目标` : '，目标即将达成'}。` });
            } else if (avgChange < 0) {
                advice.push({ type: 'advice-warning', icon: '↘', title: '净资产下降', desc: `近 ${changes.length} 个月平均月降 ${Utils.formatMoney(Math.abs(avgChange))}。建议审视支出和投资表现。` });
            }
        }

        // 3. 负债率分析
        if (s.totalDebts > 0) {
            const debtRatio = (s.totalDebts / s.totalAssets) * 100;
            if (debtRatio > 20) {
                advice.push({ type: 'advice-warning', icon: '⚠', title: '负债率偏高', desc: `当前负债率 ${PrivacyMode.maskPct(debtRatio)}（负债 ${Utils.formatMoney(s.totalDebts)} / 总资产 ${Utils.formatMoney(s.totalAssets)}）。建议优先偿还高息负债。` });
            } else {
                advice.push({ type: 'advice-finance', icon: '§', title: '负债可控', desc: `负债率 ${PrivacyMode.maskPct(debtRatio)}，处于合理范围。注意按时还款避免逾期。` });
            }
        }

        // 4. 资产集中度分析
        const positiveAccounts = accounts.filter(a => (a.balance || 0) > 0);
        positiveAccounts.sort((a, b) => (b.balance || 0) - (a.balance || 0));
        if (positiveAccounts.length > 0) {
            const topAcc = positiveAccounts[0];
            const topPct = s.totalAssets > 0 ? (topAcc.balance / s.totalAssets) * 100 : 0;
            if (topPct > 50) {
                advice.push({ type: 'advice-warning', icon: '⚠', title: '资产过度集中', desc: `${topAcc.name} 占总资产 ${PrivacyMode.maskPct(topPct)}，超过 50%。建议适当分散，降低单一账户风险。` });
            }
        }

        // 5. 投资占比分析
        const investmentTotal = accounts
            .filter(a => a.category === 'investment')
            .reduce((sum, a) => sum + Math.max(0, a.balance || 0), 0);
        const investPct = s.totalAssets > 0 ? (investmentTotal / s.totalAssets) * 100 : 0;
        if (investPct < 20 && s.netWorth > 100000) {
            advice.push({ type: 'advice-finance', icon: '◆', title: '投资比例偏低', desc: `投资账户占总资产 ${PrivacyMode.maskPct(investPct)}，建议适当增加投资比例以对抗通胀。` });
        } else if (investPct > 80) {
            advice.push({ type: 'advice-finance', icon: '◆', title: '投资比例较高', desc: `投资账户占总资产 ${PrivacyMode.maskPct(investPct)}，建议保留足够应急资金（3-6 个月生活费）。` });
        }

        // 6. 对账提醒
        if (s.lastReconcileDate) {
            const daysSince = Utils.daysBetween(s.lastReconcileDate, Utils.today());
            if (daysSince > 35) {
                advice.push({ type: 'advice-warning', icon: '⟳', title: '该对账了', desc: `上次对账在 ${s.lastReconcileDate}，已过去 ${daysSince} 天。建议每月定期对账以掌握财务全貌。` });
            }
        }

        // 7. 持仓分析
        if (holdings.length > 0) {
            const totalHoldingsValue = holdings.reduce((sum, h) => sum + (h.currentPrice || 0) * h.quantity, 0);
            const totalCost = holdings.reduce((sum, h) => sum + (h.costPrice || 0) * h.quantity, 0);
            const totalPnl = totalHoldingsValue - totalCost;
            const returnRate = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

            if (returnRate > 20) {
                advice.push({ type: 'advice-finance', icon: '↑', title: '持仓收益良好', desc: `整体收益率 ${PrivacyMode.maskPct(returnRate)}，可考虑部分止盈锁定利润。` });
            } else if (returnRate < -10) {
                advice.push({ type: 'advice-warning', icon: '↓', title: '持仓亏损', desc: `整体收益率 ${PrivacyMode.maskPct(returnRate)}，建议审视持仓基本面，考虑是否调整。` });
            }

            // 集中度
            const top = holdings.map(h => ({
                name: h.name,
                value: (h.currentPrice || 0) * h.quantity,
                pct: totalHoldingsValue > 0 ? ((h.currentPrice || 0) * h.quantity / totalHoldingsValue) * 100 : 0
            })).sort((a, b) => b.pct - a.pct)[0];
            if (top && top.pct > 30) {
                advice.push({ type: 'advice-warning', icon: '⚠', title: '持仓集中度风险', desc: `${top.name} 占持仓 ${PrivacyMode.maskPct(top.pct)}，超过 30% 警戒线。建议适当分散。` });
            }
        }

        // 8. 收入分析
        const incomes = Store.finance.getIncomes();
        if (incomes.length > 0) {
            const now = new Date();
            const monthStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
            const monthlyIncome = incomes
                .filter(i => i.date && i.date.startsWith(monthStr))
                .reduce((sum, i) => sum + (i.amount || 0), 0);
            if (monthlyIncome > 0 && s.monthlyChange > 0) {
                const saveRate = (s.monthlyChange / monthlyIncome) * 100;
                if (saveRate > 50) {
                    advice.push({ type: 'advice-success', icon: '✓', title: '储蓄率良好', desc: `本月收入 ${Utils.formatMoney(monthlyIncome)}，净资产增长 ${Utils.formatMoney(s.monthlyChange)}，储蓄率 ${PrivacyMode.maskPct(saveRate, 0)}。` });
                } else if (saveRate < 20) {
                    advice.push({ type: 'advice-finance', icon: '◆', title: '储蓄率偏低', desc: `本月收入 ${Utils.formatMoney(monthlyIncome)}，但净资产仅增长 ${Utils.formatMoney(s.monthlyChange)}，储蓄率 ${PrivacyMode.maskPct(saveRate, 0)}。建议控制支出。` });
                }
            }
        }

        return advice;
    },

    // ===== 模态框：月度对账 =====
    showReconcileModal() {
        const accounts = Store.finance.getAccounts();

        let formHtml = `<div class="form-group">
            <label class="form-label">对账日期</label>
            <input type="date" class="form-input" id="recon-date" value="${Utils.today()}">
        </div>`;

        Object.entries(ACCOUNT_CATEGORIES).forEach(([catKey, catInfo]) => {
            const catAccounts = accounts.filter(a => a.category === catKey);
            if (catAccounts.length === 0) return;

            formHtml += `<div class="reconcile-category">
                <div class="reconcile-category-title">${catInfo.icon} ${catInfo.label}</div>`;

            catAccounts.forEach(acc => {
                formHtml += `<div class="form-group">
                    <label class="form-label">${Utils.escapeHtml(acc.name)}${acc.isDebt ? ' (负债)' : ''}</label>
                    <input type="number" class="form-input" id="recon-${acc.id}"
                        value="${acc.balance || 0}" step="0.01" placeholder="0.00">
                </div>`;
            });

            formHtml += '</div>';
        });

        formHtml += `<div class="form-group">
            <label class="form-label">备注</label>
            <textarea class="form-textarea" id="recon-note" placeholder="可选"></textarea>
        </div>`;

        const content = `
            <div class="modal-header">
                <span class="modal-title">月度对账</span>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <div class="modal-body">${formHtml}</div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="Utils.closeModal()">取消</button>
                <button class="btn btn-primary" onclick="FinanceModule.saveReconcile()">保存对账</button>
            </div>`;

        Utils.showModal(content, 'large');
    },

    saveReconcile() {
        const date = Utils.getFormValue('recon-date');
        if (!date) { Utils.toast('请选择对账日期', 'error'); return; }

        const accounts = Store.finance.getAccounts();
        const balances = {};
        let hasData = false;

        accounts.forEach(acc => {
            const val = Utils.getFormNumber('recon-' + acc.id);
            if (val !== null) {
                balances[acc.id] = val;
                if (val !== 0) hasData = true;
            } else {
                balances[acc.id] = acc.balance || 0;
            }
        });

        if (!hasData) { Utils.toast('请至少填写一个账户余额', 'error'); return; }

        const note = Utils.getFormValue('recon-note');

        // 保存快照
        Store.finance.addSnapshot({ date, balances, note });
        // 更新账户余额
        Store.finance.batchUpdateBalances(balances);

        Utils.toast('月度对账已保存');
        Utils.closeModal();
        this.render();
        if (typeof DashboardModule !== 'undefined') DashboardModule.render();
    },

    deleteSnapshot(id) {
        Utils.confirm('确定删除这条对账记录吗？', () => {
            Store.finance.deleteSnapshot(id);
            Utils.toast('对账记录已删除');
            this.renderReconcile();
        });
    },

    // ===== 模态框：财务目标 =====
    showGoalModal() {
        const goals = Store.finance.getGoals();

        const formHtml = `<div class="form-group">
            <label class="form-label">财富自由目标 (元)</label>
            <input type="number" class="form-input" id="goal-target" value="${goals.targetNetWorth || 2000000}" step="100000" placeholder="2000000">
        </div>`;

        const content = `
            <div class="modal-header">
                <span class="modal-title">设置财务目标</span>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <div class="modal-body">${formHtml}</div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="Utils.closeModal()">取消</button>
                <button class="btn btn-primary" onclick="FinanceModule.saveGoal()">保存</button>
            </div>`;

        Utils.showModal(content);
    },

    saveGoal() {
        const target = Utils.getFormNumber('goal-target');
        if (target === null || target <= 0) { Utils.toast('请输入有效的目标金额', 'error'); return; }
        Store.finance.updateGoals({ targetNetWorth: target });
        Utils.toast('目标已更新');
        Utils.closeModal();
        this.render();
        if (typeof DashboardModule !== 'undefined') DashboardModule.render();
    },

    // ===== 模态框：账户 =====
    showAccountModal(accountId = null) {
        const isEdit = !!accountId;
        const acc = isEdit ? Store.finance.getAccount(accountId) : {};

        // 按分类分组账户类型
        let typeOptionsHtml = '';
        Object.entries(ACCOUNT_CATEGORIES).forEach(([catKey, catInfo]) => {
            const types = Object.entries(ACCOUNT_TYPES).filter(([_, info]) => info.category === catKey);
            if (types.length === 0) return;
            typeOptionsHtml += `<optgroup label="${catInfo.label}">`;
            types.forEach(([val, info]) => {
                typeOptionsHtml += `<option value="${val}" ${acc.type === val ? 'selected' : ''}>${info.label}</option>`;
            });
            typeOptionsHtml += '</optgroup>';
        });

        const formHtml = `<div class="form-group">
                <label class="form-label">账户名称</label>
                <input type="text" class="form-input" id="acc-name" value="${acc.name || ''}" placeholder="如：支付宝资产" required>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">账户类型</label>
                    <select class="form-select" id="acc-type">${typeOptionsHtml}</select>
                </div>
                <div class="form-group">
                    <label class="form-label">开户机构</label>
                    <input type="text" class="form-input" id="acc-institution" value="${acc.institution || ''}" placeholder="可选">
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">${isEdit ? '当前余额' : '初始余额'}</label>
                <input type="number" class="form-input" id="acc-balance" value="${acc.balance || 0}" step="0.01" placeholder="0.00">
            </div>
            <div class="form-group">
                <label class="form-label">备注</label>
                <textarea class="form-textarea" id="acc-note" placeholder="可选">${acc.note || ''}</textarea>
            </div>`;

        const content = `
            <div class="modal-header">
                <span class="modal-title">${isEdit ? '编辑账户' : '添加账户'}</span>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <div class="modal-body">${formHtml}</div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="Utils.closeModal()">取消</button>
                <button class="btn btn-primary" onclick="FinanceModule.saveAccount('${accountId || ''}')">${isEdit ? '保存' : '添加'}</button>
            </div>`;

        Utils.showModal(content);
    },

    saveAccount(accountId) {
        const name = Utils.getFormValue('acc-name');
        if (!name) { Utils.toast('请输入账户名称', 'error'); return; }

        const type = Utils.getFormValue('acc-type');
        const typeInfo = ACCOUNT_TYPES[type] || {};

        const data = {
            name,
            type,
            category: typeInfo.category || 'other',
            institution: Utils.getFormValue('acc-institution'),
            balance: Utils.getFormNumber('acc-balance') || 0,
            isDebt: !!typeInfo.isDebt,
            canHoldPositions: !!typeInfo.canHoldPositions,
            currency: 'CNY',
            note: Utils.getFormValue('acc-note')
        };

        if (accountId) {
            Store.finance.updateAccount(accountId, data);
            Utils.toast('账户已更新');
        } else {
            Store.finance.addAccount(data);
            Utils.toast('账户已添加');
        }

        Utils.closeModal();
        this.render();
        if (typeof DashboardModule !== 'undefined') DashboardModule.render();
    },

    editAccount(id) { this.showAccountModal(id); },

    deleteAccount(id) {
        const acc = Store.finance.getAccount(id);
        if (!acc) return;
        Utils.confirm(`确定删除账户「${acc.name}」吗？该账户下的所有持仓将一并删除。`, () => {
            Store.finance.deleteAccount(id);
            Utils.toast('账户已删除');
            this.render();
            if (typeof DashboardModule !== 'undefined') DashboardModule.render();
        });
    },

    // ===== 模态框：持仓 =====
    showHoldingModal(holdingId = null) {
        const isEdit = !!holdingId;
        const holding = isEdit ? Store.finance.getHoldings().find(h => h.id === holdingId) : {};
        const accounts = Store.finance.getAccounts().filter(a => a.canHoldPositions);

        if (accounts.length === 0) {
            Utils.toast('请先添加投资类账户（如支付宝、同花顺等）', 'warning');
            return;
        }

        const accountOptions = accounts.map(a => ({
            value: a.id,
            label: `${a.name} (${ACCOUNT_TYPES[a.type]?.label || a.type})`
        }));

        const categoryOptions = Object.entries(HOLDING_CATEGORIES).map(([val, label]) => ({
            value: val, label
        }));

        const formHtml = `<div class="form-row">
                <div class="form-group">
                    <label class="form-label">所属账户</label>
                    <select class="form-select" id="h-account">
                        ${accountOptions.map(o => `<option value="${o.value}" ${holding.accountId === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">持仓类别</label>
                    <select class="form-select" id="h-category">
                        ${categoryOptions.map(o => `<option value="${o.value}" ${holding.category === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">代码</label>
                    <input type="text" class="form-input" id="h-code" value="${holding.code || ''}" placeholder="如：600519 / 000001" required>
                </div>
                <div class="form-group">
                    <label class="form-label">名称</label>
                    <input type="text" class="form-input" id="h-name" value="${holding.name || ''}" placeholder="如：贵州茅台" required>
                </div>
            </div>
            <div class="form-row-3">
                <div class="form-group">
                    <label class="form-label">数量</label>
                    <input type="number" class="form-input" id="h-quantity" value="${holding.quantity || ''}" step="1" placeholder="100" required>
                </div>
                <div class="form-group">
                    <label class="form-label">成本价</label>
                    <input type="number" class="form-input" id="h-costPrice" value="${holding.costPrice || ''}" step="0.01" placeholder="1500.00" required>
                </div>
                <div class="form-group">
                    <label class="form-label">现价</label>
                    <input type="number" class="form-input" id="h-currentPrice" value="${holding.currentPrice || ''}" step="0.01" placeholder="1600.00">
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">备注</label>
                <textarea class="form-textarea" id="h-note" placeholder="可选">${holding.note || ''}</textarea>
            </div>`;

        const content = `
            <div class="modal-header">
                <span class="modal-title">${isEdit ? '编辑持仓' : '添加持仓'}</span>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <div class="modal-body">${formHtml}</div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="Utils.closeModal()">取消</button>
                <button class="btn btn-primary" onclick="FinanceModule.saveHolding('${holdingId || ''}')">${isEdit ? '保存' : '添加'}</button>
            </div>`;

        Utils.showModal(content);
    },

    saveHolding(holdingId) {
        const code = Utils.getFormValue('h-code');
        const name = Utils.getFormValue('h-name');
        const quantity = Utils.getFormNumber('h-quantity');

        if (!code || !name || !quantity) { Utils.toast('请填写必填项', 'error'); return; }

        const data = {
            accountId: Utils.getFormValue('h-account'),
            category: Utils.getFormValue('h-category'),
            code, name, quantity,
            costPrice: Utils.getFormNumber('h-costPrice') || 0,
            currentPrice: Utils.getFormNumber('h-currentPrice') || 0,
            note: Utils.getFormValue('h-note')
        };

        if (holdingId) {
            Store.finance.updateHolding(holdingId, data);
            Utils.toast('持仓已更新');
        } else {
            Store.finance.addHolding(data);
            Utils.toast('持仓已添加');
        }

        Utils.closeModal();
        this.render();
        if (typeof DashboardModule !== 'undefined') DashboardModule.render();
    },

    editHolding(id) { this.showHoldingModal(id); },

    deleteHolding(id) {
        const h = Store.finance.getHoldings().find(h => h.id === id);
        if (!h) return;
        Utils.confirm(`确定删除持仓「${h.name}」吗？`, () => {
            Store.finance.deleteHolding(id);
            Utils.toast('持仓已删除');
            this.render();
            if (typeof DashboardModule !== 'undefined') DashboardModule.render();
        });
    },

    // ===== 模态框：收入 =====
    showIncomeModal() {
        const sourceOptions = Object.entries(INCOME_SOURCES).map(([val, label]) => ({
            value: val, label
        }));

        const formHtml = `<div class="form-row">
                <div class="form-group">
                    <label class="form-label">日期</label>
                    <input type="date" class="form-input" id="inc-date" value="${Utils.today()}">
                </div>
                <div class="form-group">
                    <label class="form-label">收入来源</label>
                    <select class="form-select" id="inc-source">
                        ${sourceOptions.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">金额 (元)</label>
                <input type="number" class="form-input" id="inc-amount" step="0.01" placeholder="0.00" required>
            </div>
            <div class="form-group">
                <label class="form-label">备注</label>
                <textarea class="form-textarea" id="inc-note" placeholder="可选，如：某月工资 / 塔罗占卜-XX客户"></textarea>
            </div>`;

        const content = `
            <div class="modal-header">
                <span class="modal-title">记录收入</span>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <div class="modal-body">${formHtml}</div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="Utils.closeModal()">取消</button>
                <button class="btn btn-primary" onclick="FinanceModule.saveIncome()">保存</button>
            </div>`;

        Utils.showModal(content);
    },

    saveIncome() {
        const date = Utils.getFormValue('inc-date');
        const amount = Utils.getFormNumber('inc-amount');
        if (!date) { Utils.toast('请选择日期', 'error'); return; }
        if (amount === null || amount <= 0) { Utils.toast('请输入有效金额', 'error'); return; }

        Store.finance.addIncome({
            date,
            source: Utils.getFormValue('inc-source'),
            amount,
            note: Utils.getFormValue('inc-note')
        });

        Utils.toast('收入已记录');
        Utils.closeModal();
        this.renderIncome();
        this.renderOverview();
        if (typeof DashboardModule !== 'undefined') DashboardModule.render();
    },

    deleteIncome(id) {
        Store.finance.deleteIncome(id);
        Utils.toast('收入记录已删除');
        this.renderIncome();
        this.renderOverview();
    },

    // ===== 模态框：交易 =====
    showTransactionModal() {
        const holdings = Store.finance.getHoldings();
        if (holdings.length === 0) {
            Utils.toast('请先添加持仓', 'warning');
            return;
        }

        const holdingOptions = holdings.map(h => ({ value: h.id, label: `${h.code || ''} ${h.name || ''}` }));
        const typeOptions = Object.entries(TRANSACTION_TYPES).map(([val, label]) => ({ value: val, label }));

        const formHtml = `<div class="form-row">
                <div class="form-group">
                    <label class="form-label">持仓</label>
                    <select class="form-select" id="t-holding">
                        ${holdingOptions.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">交易类型</label>
                    <select class="form-select" id="t-type">
                        ${typeOptions.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="form-row-3">
                <div class="form-group">
                    <label class="form-label">日期</label>
                    <input type="date" class="form-input" id="t-date" value="${Utils.today()}">
                </div>
                <div class="form-group">
                    <label class="form-label">数量</label>
                    <input type="number" class="form-input" id="t-quantity" step="1" placeholder="100">
                </div>
                <div class="form-group">
                    <label class="form-label">价格</label>
                    <input type="number" class="form-input" id="t-price" step="0.01" placeholder="1500.00">
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">手续费</label>
                <input type="number" class="form-input" id="t-fee" step="0.01" placeholder="0.00">
            </div>
            <div class="form-group">
                <label class="form-label">备注</label>
                <textarea class="form-textarea" id="t-note" placeholder="可选"></textarea>
            </div>`;

        const content = `
            <div class="modal-header">
                <span class="modal-title">记录交易</span>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <div class="modal-body">${formHtml}</div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="Utils.closeModal()">取消</button>
                <button class="btn btn-primary" onclick="FinanceModule.saveTransaction()">保存</button>
            </div>`;

        Utils.showModal(content);
    },

    saveTransaction() {
        const data = {
            holdingId: Utils.getFormValue('t-holding'),
            type: Utils.getFormValue('t-type'),
            date: Utils.getFormValue('t-date'),
            quantity: Utils.getFormNumber('t-quantity'),
            price: Utils.getFormNumber('t-price'),
            fee: Utils.getFormNumber('t-fee'),
            note: Utils.getFormValue('t-note')
        };

        if (!data.date) { Utils.toast('请选择日期', 'error'); return; }

        Store.finance.addTransaction(data);

        if (data.type === 'buy' || data.type === 'sell') {
            const holding = Store.finance.getHoldings().find(h => h.id === data.holdingId);
            if (holding) {
                let newQty = holding.quantity || 0;
                if (data.type === 'buy') newQty += data.quantity || 0;
                if (data.type === 'sell') newQty -= data.quantity || 0;
                Store.finance.updateHolding(data.holdingId, { quantity: newQty });
            }
        }

        Utils.toast('交易已记录');
        Utils.closeModal();
        this.render();
        if (typeof DashboardModule !== 'undefined') DashboardModule.render();
    },

    // ===== 今日财经 Tab =====
    newsData: null,
    newsLoading: false,

    async renderNews() {
        if (!this.newsData) {
            await this.loadNewsData();
        }
        if (!this.newsData) return;

        const data = this.newsData;

        // 日期标题
        const dateTitle = document.getElementById('news-date-title');
        if (dateTitle) dateTitle.textContent = data.date + ' 财经速览';

        const updatedEl = document.getElementById('news-updated-time');
        if (updatedEl) updatedEl.textContent = '更新于 ' + (data.updatedAt || '').replace('T', ' ').slice(0, 16);

        // AI 总结
        this.renderNewsAISummary(data.ai_summary);

        // 波动预警
        this.renderVolatilityAlerts(data.volatility_alerts || []);

        // 关键数据面板
        this.renderNewsDataGrid(data);

        // 重大事件
        this.renderNewsEvents(data.key_events || []);
    },

    async loadNewsData() {
        if (this.newsLoading) return;
        this.newsLoading = true;

        // 显示加载中
        const summaryEl = document.getElementById('news-ai-summary');
        if (summaryEl && !this.newsData) {
            summaryEl.innerHTML = '<div class="news-loading">正在加载今日财经资讯...</div>';
        }

        try {
            this.newsData = await Utils.fetchJSON('data/finance-news.json');
        } catch (e) {
            console.error('Failed to load finance news:', e);
            if (summaryEl) {
                summaryEl.innerHTML = '<div class="news-loading news-error">' +
                    '<div class="news-error-icon">⚠️</div>' +
                    '<div class="news-error-msg">暂时无法加载财经资讯</div>' +
                    '<div class="news-error-detail">' + (e.message || '网络错误') + '</div>' +
                    '<button class="btn btn-primary news-retry-btn" onclick="FinanceModule.refreshNews()">点击重试</button>' +
                    '</div>';
            }
        } finally {
            this.newsLoading = false;
        }
    },

    async refreshNews() {
        this.newsData = null;
        const summaryEl = document.getElementById('news-ai-summary');
        if (summaryEl) summaryEl.innerHTML = '<div class="news-loading">正在刷新今日财经资讯...</div>';
        await this.loadNewsData();
        if (this.newsData) {
            this.renderNews();
            Utils.toast('财经资讯已刷新');
        }
    },

    renderNewsAISummary(summary) {
        const el = document.getElementById('news-ai-summary');
        if (!el || !summary) return;

        let html = '<div class="ai-summary-card">';
        html += '<div class="ai-summary-header"><span class="ai-summary-icon">AI</span><span class="ai-summary-title">' + (summary.headline || '今日总结') + '</span></div>';

        if (summary.key_points && summary.key_points.length > 0) {
            html += '<div class="ai-summary-section"><h4>核心要点</h4><ul class="ai-summary-list">';
            summary.key_points.forEach(pt => {
                html += '<li>' + this.escapeHtml(pt) + '</li>';
            });
            html += '</ul></div>';
        }

        if (summary.actionable && summary.actionable.length > 0) {
            html += '<div class="ai-summary-section ai-actionable"><h4>行动建议</h4><ul class="ai-summary-list">';
            summary.actionable.forEach(act => {
                html += '<li>' + this.escapeHtml(act) + '</li>';
            });
            html += '</ul></div>';
        }

        html += '</div>';
        el.innerHTML = html;
    },

    renderVolatilityAlerts(alerts) {
        const el = document.getElementById('news-alerts-section');
        if (!el) return;

        if (!alerts || alerts.length === 0) {
            el.innerHTML = '';
            return;
        }

        let html = '<div class="news-section-title">波动预警</div>';
        html += '<div class="volatility-alerts">';

        alerts.forEach(alert => {
            const isUp = alert.direction === 'up';
            const levelClass = alert.level === 'extreme' ? 'alert-extreme' : (alert.level === 'high' ? 'alert-high' : 'alert-medium');
            const changeStr = (isUp ? '+' : '') + alert.change + '%';
            const dirIcon = isUp ? '▲' : '▼';
            const dirClass = isUp ? 'up' : 'down';

            html += '<div class="volatility-alert ' + levelClass + '">';
            html += '<div class="alert-market">' + this.escapeHtml(alert.market) + '</div>';
            html += '<div class="alert-change ' + dirClass + '">' + dirIcon + ' ' + changeStr + '</div>';
            html += '<div class="alert-note">' + this.escapeHtml(alert.note || '') + '</div>';
            html += '</div>';
        });

        html += '</div>';
        el.innerHTML = html;
    },

    renderNewsDataGrid(data) {
        const el = document.getElementById('news-data-grid');
        if (!el) return;

        let html = '';

        // 市场指数
        const marketKeys = ['a_share', 'us_stock', 'hk_stock', 'asia_pacific', 'europe'];
        marketKeys.forEach(key => {
            const market = data.markets[key];
            if (!market) return;

            html += '<div class="news-data-card">';
            html += '<div class="data-card-title">' + market.label + '</div>';
            html += '<div class="data-card-body">';

            if (market.indices && market.indices.length > 0) {
                market.indices.forEach(idx => {
                    const change = idx.change;
                    const changeClass = change > 0 ? 'up' : (change < 0 ? 'down' : 'flat');
                    const changeStr = change !== null && change !== undefined ? (change > 0 ? '+' : '') + change + '%' : '--';
                    const valueStr = idx.value !== null && idx.value !== undefined ? idx.value.toLocaleString() : '--';
                    html += '<div class="data-row">';
                    html += '<span class="data-label">' + this.escapeHtml(idx.name) + '</span>';
                    html += '<span class="data-value">' + valueStr + '</span>';
                    html += '<span class="data-change ' + changeClass + '">' + changeStr + '</span>';
                    html += '</div>';
                });
            }

            if (market.highlights && market.highlights.length > 0) {
                html += '<div class="data-card-highlights">';
                market.highlights.forEach(h => {
                    html += '<div class="highlight-item">' + this.escapeHtml(h) + '</div>';
                });
                html += '</div>';
            }

            html += '</div></div>';
        });

        // 大宗商品
        if (data.commodities) {
            html += '<div class="news-data-card">';
            html += '<div class="data-card-title">大宗商品</div>';
            html += '<div class="data-card-body">';

            Object.values(data.commodities).forEach(c => {
                const change = c.change;
                const changeClass = change > 0 ? 'up' : (change < 0 ? 'down' : 'flat');
                const changeStr = change !== null && change !== undefined ? (change > 0 ? '+' : '') + change + '%' : '--';
                const noteStr = c.note ? ' <span class="data-note">(' + this.escapeHtml(c.note) + ')</span>' : '';
                html += '<div class="data-row">';
                html += '<span class="data-label">' + this.escapeHtml(c.label) + noteStr + '</span>';
                html += '<span class="data-value">' + (c.value !== null && c.value !== undefined ? c.value.toLocaleString() : '--') + ' ' + this.escapeHtml(c.unit || '') + '</span>';
                html += '<span class="data-change ' + changeClass + '">' + changeStr + '</span>';
                html += '</div>';
            });

            html += '</div></div>';
        }

        // 汇率
        if (data.currencies) {
            html += '<div class="news-data-card">';
            html += '<div class="data-card-title">汇率</div>';
            html += '<div class="data-card-body">';

            Object.values(data.currencies).forEach(c => {
                const noteStr = c.note ? ' <span class="data-note">(' + this.escapeHtml(c.note) + ')</span>' : '';
                const valueStr = c.value !== null && c.value !== undefined ? c.value.toString() : '--';
                const changeStr = c.change !== null && c.change !== undefined ? (c.change > 0 ? '+' : '') + c.change + '%' : '';
                const changeClass = c.change > 0 ? 'up' : (c.change < 0 ? 'down' : 'flat');
                html += '<div class="data-row">';
                html += '<span class="data-label">' + this.escapeHtml(c.label) + noteStr + '</span>';
                html += '<span class="data-value">' + valueStr + '</span>';
                html += '<span class="data-change ' + changeClass + '">' + changeStr + '</span>';
                html += '</div>';
            });

            html += '</div></div>';
        }

        // 货币政策
        if (data.monetary_policy) {
            html += '<div class="news-data-card news-data-card-wide">';
            html += '<div class="data-card-title">货币政策</div>';
            html += '<div class="data-card-body">';

            Object.values(data.monetary_policy).forEach(p => {
                html += '<div class="policy-row">';
                html += '<div class="policy-header"><span class="policy-label">' + this.escapeHtml(p.label) + '</span>';
                if (p.rate) html += '<span class="policy-rate">' + this.escapeHtml(p.rate) + '</span>';
                html += '<span class="policy-action policy-action-' + this.escapeHtml(p.action) + '">' + this.escapeHtml(p.action) + '</span></div>';
                if (p.details) html += '<div class="policy-details">' + this.escapeHtml(p.details) + '</div>';
                html += '</div>';
            });

            html += '</div></div>';
        }

        el.innerHTML = html;
    },

    renderNewsEvents(events) {
        const el = document.getElementById('news-events-section');
        if (!el) return;

        if (!events || events.length === 0) {
            el.innerHTML = '';
            return;
        }

        let html = '<div class="news-section-title">重大事件</div>';
        html += '<div class="news-events-list">';

        events.forEach(ev => {
            const impactClass = ev.impact === 'high' ? 'event-high' : (ev.impact === 'medium' ? 'event-medium' : 'event-low');
            const impactLabel = ev.impact === 'high' ? '高影响' : (ev.impact === 'medium' ? '中影响' : '低影响');

            html += '<div class="news-event ' + impactClass + '">';
            html += '<div class="event-header">';
            html += '<span class="event-impact-badge">' + impactLabel + '</span>';
            if (ev.market) html += '<span class="event-market">' + this.escapeHtml(ev.market) + '</span>';
            html += '</div>';
            html += '<div class="event-title">' + this.escapeHtml(ev.title) + '</div>';
            html += '<div class="event-summary">' + this.escapeHtml(ev.summary) + '</div>';
            if (ev.impact_on_you) {
                html += '<div class="event-impact-on-you"><span class="impact-label">对你的影响：</span>' + this.escapeHtml(ev.impact_on_you) + '</div>';
            }
            html += '</div>';
        });

        html += '</div>';
        el.innerHTML = html;
    },

    escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
};
