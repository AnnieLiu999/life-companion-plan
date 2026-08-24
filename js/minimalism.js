/**
 * 入手+断舍离模块
 * 入手记录 → 使用中物品 → 断舍离记录 → 优先使用目标
 */
const MinimalismModule = {

    render() {
        this.renderOverview();
        this.renderPurchases();
        this.renderActiveItems();
        this.renderGoals();
        this.renderAchievements();
    },

    // ===== 概览 =====
    renderOverview() {
        const purchases = Store.minimalism.getPurchases();
        const items = Store.minimalism.getActiveItems();
        const achievements = Store.minimalism.getAchievements();

        const elPurchaseCount = document.getElementById('min-purchase-count');
        const elActiveCount = document.getElementById('min-active-count');
        const elAchievementCount = document.getElementById('min-achievement-count');
        const elMonthCount = document.getElementById('min-month-count');

        if (elPurchaseCount) elPurchaseCount.textContent = purchases.length;
        if (elActiveCount) elActiveCount.textContent = items.length;
        if (elAchievementCount) elAchievementCount.textContent = achievements.length;

        // 本月断舍离数
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthCount = achievements.filter(a => a.completedAt >= monthStart.getTime()).length;
        if (elMonthCount) elMonthCount.textContent = monthCount;

        // 二手市场总收益
        const elResaleProfit = document.getElementById('min-resale-profit');
        if (elResaleProfit) {
            const totalProfit = achievements
                .filter(a => a.discardType === 'resale' && a.profit)
                .reduce((sum, a) => sum + parseFloat(a.profit), 0);
            elResaleProfit.textContent = Utils.formatMoneyRaw(totalProfit);
        }
    },

    // ===== 入手记录 =====
    renderPurchases() {
        const el = document.getElementById('min-purchases-list');
        if (!el) return;

        const purchases = Store.minimalism.getPurchases();

        if (purchases.length === 0) {
            el.innerHTML = '<div class="empty-state">还没有入手记录，点击"+ 记入手"开始记录</div>';
            return;
        }

        let html = '<div class="min-purchases-grid">';
        purchases.forEach(p => {
            const cat = MINIMALISM_CATEGORIES[p.category] || '其他';
            const date = p.purchaseDate || Utils.formatDate(p.createdAt);
            const priceStr = p.price ? Utils.formatMoney(parseFloat(p.price)) : '';
            const usedCount = Store.minimalism.getItems().filter(i => i.purchaseId === p.id).length;
            const discarded = Store.minimalism.getAchievements().some(a => a.purchaseId === p.id);

            let statusBadge = '';
            if (discarded) {
                statusBadge = '<span class="min-purchase-badge done">已断舍离</span>';
            } else if (usedCount > 0) {
                statusBadge = '<span class="min-purchase-badge using">使用中</span>';
            } else {
                statusBadge = '<span class="min-purchase-badge idle">待使用</span>';
            }

            html += '<div class="min-purchase-card">';
            html += '<div class="min-purchase-header">';
            html += '<span class="min-purchase-cat">' + cat + '</span>';
            html += statusBadge;
            html += '</div>';
            html += '<div class="min-purchase-name">' + Utils.escapeHtml(p.name) + '</div>';
            html += '<div class="min-purchase-info">';
            html += '<span>' + date + '</span>';
            if (priceStr) html += '<span class="min-purchase-price">' + priceStr + '</span>';
            if (p.source) html += '<span>' + Utils.escapeHtml(p.source) + '</span>';
            html += '</div>';
            if (p.note) html += '<div class="min-purchase-note">' + Utils.escapeHtml(p.note) + '</div>';
            html += '<div class="min-purchase-actions">';
            if (!discarded) {
                html += '<button class="btn btn-sm btn-secondary" onclick="MinimalismModule.usePurchase(\'' + p.id + '\')">加入使用中</button>';
                html += '<button class="btn btn-sm btn-success" onclick="MinimalismModule.discardFromPurchase(\'' + p.id + '\')">断舍离</button>';
            }
            html += '<button class="btn btn-sm btn-secondary" onclick="MinimalismModule.editPurchase(\'' + p.id + '\')">编辑</button>';
            html += '<button class="btn btn-sm btn-danger" onclick="MinimalismModule.deletePurchase(\'' + p.id + '\')">删除</button>';
            html += '</div>';
            html += '</div>';
        });
        html += '</div>';
        el.innerHTML = html;
    },

    // ===== 使用中的物品 =====
    renderActiveItems() {
        const el = document.getElementById('min-items-list');
        if (!el) return;

        const items = Store.minimalism.getActiveItems();

        if (items.length === 0) {
            el.innerHTML = '<div class="empty-state">还没有使用中的物品，可以从入手记录中加入，或点击"+ 添加使用中"直接添加</div>';
            return;
        }

        let html = '<div class="min-items-grid">';
        items.forEach(item => {
            const cat = MINIMALISM_CATEGORIES[item.category] || '其他';
            const startDate = item.startDate || Utils.formatDate(item.createdAt);
            const targetDate = item.targetDate || '';
            const daysLeft = targetDate ? Utils.daysBetween(Utils.today(), targetDate) : null;
            const totalDays = targetDate ? Utils.daysBetween(startDate, targetDate) : 0;
            const elapsedDays = Utils.daysBetween(startDate, Utils.today());
            const progress = totalDays > 0 ? Math.min(100, (elapsedDays / totalDays) * 100) : 0;

            let countdownHtml = '';
            if (daysLeft !== null) {
                if (daysLeft < 0) {
                    countdownHtml = '<span class="min-countdown overdue">已超期 ' + Math.abs(daysLeft) + ' 天</span>';
                } else if (daysLeft === 0) {
                    countdownHtml = '<span class="min-countdown urgent">今天到期</span>';
                } else if (daysLeft <= 7) {
                    countdownHtml = '<span class="min-countdown urgent">剩 ' + daysLeft + ' 天</span>';
                } else {
                    countdownHtml = '<span class="min-countdown">剩 ' + daysLeft + ' 天</span>';
                }
            }

            html += '<div class="min-item-card">';
            html += '<div class="min-item-header">';
            html += '<span class="min-item-cat">' + cat + '</span>';
            html += countdownHtml;
            html += '</div>';
            html += '<div class="min-item-name">' + Utils.escapeHtml(item.name) + '</div>';
            if (item.note) html += '<div class="min-item-note">' + Utils.escapeHtml(item.note) + '</div>';

            if (targetDate) {
                html += '<div class="min-progress-bar"><div class="min-progress-fill" style="width:' + progress + '%"></div></div>';
                html += '<div class="min-date-info">' + startDate + ' -> ' + targetDate + '</div>';
            }

            html += '<div class="min-item-actions">';
            html += '<button class="btn btn-sm btn-success" onclick="MinimalismModule.showCompleteModal(\'' + item.id + '\')">已用完</button>';
            html += '<button class="btn btn-sm btn-secondary" onclick="MinimalismModule.editItem(\'' + item.id + '\')">编辑</button>';
            html += '<button class="btn btn-sm btn-danger" onclick="MinimalismModule.deleteItem(\'' + item.id + '\')">删除</button>';
            html += '</div>';
            html += '</div>';
        });
        html += '</div>';
        el.innerHTML = html;
    },

    // ===== 目标 =====
    renderGoals() {
        const el = document.getElementById('min-goals-list');
        if (!el) return;

        const goals = Store.minimalism.getGoals().filter(g => g.status === 'active');

        if (goals.length === 0) {
            el.innerHTML = '<div class="empty-state">还没有设定优先使用目标</div>';
            return;
        }

        let html = '';
        goals.forEach(goal => {
            const daysLeft = goal.targetDate ? Utils.daysBetween(Utils.today(), goal.targetDate) : null;
            const items = Store.minimalism.getActiveItems().filter(i => i.goalId === goal.id);

            let statusClass = '';
            let statusText = '';
            if (daysLeft !== null) {
                if (daysLeft < 0) { statusClass = 'overdue'; statusText = '已超期 ' + Math.abs(daysLeft) + ' 天'; }
                else if (daysLeft <= 7) { statusClass = 'urgent'; statusText = '剩 ' + daysLeft + ' 天'; }
                else { statusText = '剩 ' + daysLeft + ' 天'; }
            }

            html += '<div class="min-goal-card ' + statusClass + '">';
            html += '<div class="min-goal-header">';
            html += '<div class="min-goal-title">' + Utils.escapeHtml(goal.title) + '</div>';
            if (statusText) html += '<span class="min-goal-countdown ' + statusClass + '">' + statusText + '</span>';
            html += '</div>';
            if (goal.description) html += '<div class="min-goal-desc">' + Utils.escapeHtml(goal.description) + '</div>';
            html += '<div class="min-goal-items">' + items.length + ' 件物品</div>';
            html += '<div class="min-goal-actions">';
            html += '<button class="btn btn-sm btn-secondary" onclick="MinimalismModule.deleteGoal(\'' + goal.id + '\')">删除</button>';
            html += '</div>';
            html += '</div>';
        });
        el.innerHTML = html;
    },

    // ===== 断舍离记录 =====
    renderAchievements() {
        const el = document.getElementById('min-achievements-list');
        if (!el) return;

        const achievements = Store.minimalism.getAchievements();

        if (achievements.length === 0) {
            el.innerHTML = '<div class="empty-state">还没有断舍离记录，用完或丢弃物品后记录在这里</div>';
            return;
        }

        let html = '<div class="min-achievements-grid">';
        achievements.forEach(a => {
            const cat = MINIMALISM_CATEGORIES[a.category] || '';
            const completedDate = Utils.formatDate(a.completedAt);
            const purchaseDate = a.purchaseDate || '';
            const daysUsed = purchaseDate ? Utils.daysBetween(purchaseDate, completedDate) : null;

            const typeIcons = {
                'used-up': '✨',
                'discard': '🗑',
                'giveaway': '🎁',
                'expired': '⚠️',
                'resale': '💰'
            };
            const typeLabels = {
                'used-up': '用完了',
                'discard': '丢弃/扔掉',
                'giveaway': '送人/捐赠',
                'expired': '过期处理',
                'resale': '转二手市场'
            };

            html += '<div class="min-achievement-card">';
            html += '<div class="min-achievement-icon">' + (typeIcons[a.discardType] || '✨') + '</div>';
            html += '<div class="min-achievement-name">' + Utils.escapeHtml(a.itemName) + '</div>';
            if (cat) html += '<div class="min-achievement-cat">' + cat + '</div>';
            if (a.discardType) html += '<div class="min-achievement-type">' + (typeLabels[a.discardType] || a.discardType) + '</div>';
            if (purchaseDate) {
                html += '<div class="min-achievement-timeline">';
                html += '<span>' + purchaseDate + '</span>';
                html += '<span class="min-achievement-arrow">-></span>';
                html += '<span>' + completedDate + '</span>';
                html += '</div>';
                if (daysUsed !== null && daysUsed >= 0) {
                    html += '<div class="min-achievement-days">使用 ' + daysUsed + ' 天</div>';
                }
            } else {
                html += '<div class="min-achievement-date">' + completedDate + '</div>';
            }
            if (a.discardType === 'resale' && a.profit !== null && a.profit !== undefined) {
                html += '<div class="min-achievement-profit">二手收益 ' + Utils.formatMoneyRaw(a.profit) + '</div>';
            }
            if (a.note) html += '<div class="min-achievement-note">' + Utils.escapeHtml(a.note) + '</div>';
            html += '<div class="min-achievement-del"><button class="btn btn-sm btn-danger" onclick="MinimalismModule.deleteAchievement(\'' + a.id + '\')">删除</button></div>';
            html += '</div>';
        });
        html += '</div>';
        el.innerHTML = html;
    },

    // ===== 入手记录 模态框 =====
    showPurchaseModal(purchaseId) {
        const p = purchaseId ? Store.minimalism.getPurchases().find(p => p.id === purchaseId) : null;
        const today = Utils.today();

        const categoryOptions = Object.entries(MINIMALISM_CATEGORIES).map(([k, v]) =>
            '<option value="' + k + '"' + (p && p.category === k ? ' selected' : '') + '>' + v + '</option>'
        ).join('');

        const content = `
            <div class="modal-header">
                <span class="modal-title">${p ? '编辑入手记录' : '记入手'}</span>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">物品名称</label>
                    <input type="text" class="form-input" id="m-pur-name" value="${p ? Utils.escapeHtml(p.name) : ''}" placeholder="如：某品牌精华液" required>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">分类</label>
                        <select class="form-select" id="m-pur-category">${categoryOptions}</select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">买入日期</label>
                        <input type="date" class="form-input" id="m-pur-date" value="${p ? (p.purchaseDate || today) : today}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">价格（选填）</label>
                        <input type="number" class="form-input" id="m-pur-price" value="${p ? (p.price || '') : ''}" placeholder="0.00" step="0.01">
                    </div>
                    <div class="form-group">
                        <label class="form-label">购买渠道（选填）</label>
                        <input type="text" class="form-input" id="m-pur-source" value="${p ? Utils.escapeHtml(p.source || '') : ''}" placeholder="如：天猫/丝芙兰/代购">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">备注（选填）</label>
                    <textarea class="form-textarea" id="m-pur-note" placeholder="数量、规格等">${p ? Utils.escapeHtml(p.note || '') : ''}</textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="Utils.closeModal()">取消</button>
                <button class="btn btn-primary" onclick="MinimalismModule.savePurchase('${purchaseId || ''}')">保存</button>
            </div>
        `;
        Utils.showModal(content);
    },

    savePurchase(purchaseId) {
        const name = Utils.getFormValue('m-pur-name');
        if (!name) { Utils.toast('请输入物品名称', 'error'); return; }

        const data = {
            name: name,
            category: Utils.getFormValue('m-pur-category'),
            purchaseDate: Utils.getFormValue('m-pur-date'),
            price: Utils.getFormValue('m-pur-price') || null,
            source: Utils.getFormValue('m-pur-source'),
            note: Utils.getFormValue('m-pur-note')
        };

        if (purchaseId) {
            Store.minimalism.updatePurchase(purchaseId, data);
        } else {
            Store.minimalism.addPurchase(data);
        }

        Utils.toast('入手记录已保存');
        Utils.closeModal();
        this.render();
    },

    editPurchase(id) {
        this.showPurchaseModal(id);
    },

    deletePurchase(id) {
        Utils.confirm('确定删除这条入手记录吗？', () => {
            Store.minimalism.deletePurchase(id);
            Utils.toast('已删除');
            this.render();
        });
    },

    // 从入手记录加入"使用中"
    usePurchase(purchaseId) {
        const p = Store.minimalism.getPurchases().find(p => p.id === purchaseId);
        if (!p) return;

        const defaultTarget = new Date();
        defaultTarget.setDate(defaultTarget.getDate() + 30);

        const goals = Store.minimalism.getGoals().filter(g => g.status === 'active');
        const goalOptions = '<option value="">无关联目标</option>' + goals.map(g =>
            '<option value="' + g.id + '">' + Utils.escapeHtml(g.title) + '</option>'
        ).join('');

        const content = `
            <div class="modal-header">
                <span class="modal-title">加入使用中</span>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="min-purchase-preview">
                    <span class="min-item-cat">${MINIMALISM_CATEGORIES[p.category] || '其他'}</span>
                    <strong>${Utils.escapeHtml(p.name)}</strong>
                    <span class="min-date-info">入手日：${p.purchaseDate || Utils.formatDate(p.createdAt)}</span>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">开始使用日期</label>
                        <input type="date" class="form-input" id="m-item-start" value="${Utils.today()}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">目标用完日期（选填）</label>
                        <input type="date" class="form-input" id="m-item-target" value="${Utils.formatDate(defaultTarget)}">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">关联目标</label>
                    <select class="form-select" id="m-item-goal">${goalOptions}</select>
                </div>
                <div class="form-group">
                    <label class="form-label">备注（选填）</label>
                    <input type="text" class="form-input" id="m-item-note" placeholder="使用频率等">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="Utils.closeModal()">取消</button>
                <button class="btn btn-primary" onclick="MinimalismModule.confirmUsePurchase('${purchaseId}')">加入使用中</button>
            </div>
        `;
        Utils.showModal(content);
    },

    confirmUsePurchase(purchaseId) {
        const p = Store.minimalism.getPurchases().find(p => p.id === purchaseId);
        if (!p) return;

        Store.minimalism.addItem({
            name: p.name,
            category: p.category,
            purchaseId: purchaseId,
            startDate: Utils.getFormValue('m-item-start'),
            targetDate: Utils.getFormValue('m-item-target'),
            goalId: Utils.getFormValue('m-item-goal'),
            note: Utils.getFormValue('m-item-note')
        });

        Utils.toast('已加入使用中');
        Utils.closeModal();
        this.render();
    },

    // ===== 使用中物品 模态框 =====
    showItemModal(itemId) {
        const item = itemId ? Store.minimalism.getItems().find(i => i.id === itemId) : null;
        const goals = Store.minimalism.getGoals().filter(g => g.status === 'active');
        const today = Utils.today();
        const defaultTarget = new Date();
        defaultTarget.setDate(defaultTarget.getDate() + 30);

        const categoryOptions = Object.entries(MINIMALISM_CATEGORIES).map(([k, v]) =>
            '<option value="' + k + '"' + (item && item.category === k ? ' selected' : '') + '>' + v + '</option>'
        ).join('');

        const goalOptions = '<option value="">无关联目标</option>' + goals.map(g =>
            '<option value="' + g.id + '"' + (item && item.goalId === g.id ? ' selected' : '') + '>' + Utils.escapeHtml(g.title) + '</option>'
        ).join('');

        const content = `
            <div class="modal-header">
                <span class="modal-title">${item ? '编辑物品' : '添加使用中物品'}</span>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">物品名称</label>
                    <input type="text" class="form-input" id="m-item-name" value="${item ? Utils.escapeHtml(item.name) : ''}" placeholder="如：某品牌精华液" required>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">分类</label>
                        <select class="form-select" id="m-item-category">${categoryOptions}</select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">关联目标</label>
                        <select class="form-select" id="m-item-goal">${goalOptions}</select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">开始使用日期</label>
                        <input type="date" class="form-input" id="m-item-start" value="${item ? (item.startDate || today) : today}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">目标用完日期</label>
                        <input type="date" class="form-input" id="m-item-target" value="${item ? (item.targetDate || '') : Utils.formatDate(defaultTarget)}">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">备注</label>
                    <textarea class="form-textarea" id="m-item-note" placeholder="数量、规格、使用频率等">${item ? Utils.escapeHtml(item.note || '') : ''}</textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="Utils.closeModal()">取消</button>
                <button class="btn btn-primary" onclick="MinimalismModule.saveItem('${itemId || ''}')">保存</button>
            </div>
        `;
        Utils.showModal(content);
    },

    saveItem(itemId) {
        const name = Utils.getFormValue('m-item-name');
        if (!name) { Utils.toast('请输入物品名称', 'error'); return; }

        const data = {
            name: name,
            category: Utils.getFormValue('m-item-category'),
            goalId: Utils.getFormValue('m-item-goal'),
            startDate: Utils.getFormValue('m-item-start'),
            targetDate: Utils.getFormValue('m-item-target'),
            note: Utils.getFormValue('m-item-note')
        };

        if (itemId) {
            Store.minimalism.updateItem(itemId, data);
        } else {
            Store.minimalism.addItem(data);
        }

        Utils.toast('物品已保存');
        Utils.closeModal();
        this.render();
    },

    editItem(id) {
        this.showItemModal(id);
    },

    deleteItem(id) {
        Utils.confirm('确定删除这个物品记录吗？', () => {
            Store.minimalism.deleteItem(id);
            Utils.toast('已删除');
            this.render();
        });
    },

    // 使用中物品 → 完成（断舍离）
    showCompleteModal(itemId) {
        const item = Store.minimalism.getItems().find(i => i.id === itemId);
        if (!item) return;

        // 查找对应的入手记录
        const purchase = item.purchaseId ? Store.minimalism.getPurchases().find(p => p.id === item.purchaseId) : null;
        const startDate = item.startDate || Utils.formatDate(item.createdAt);

        const content = `
            <div class="modal-header">
                <span class="modal-title">用完啦！</span>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="min-complete-celebrate">
                    <p>恭喜你用完了 <strong>${Utils.escapeHtml(item.name)}</strong>！</p>
                    ${purchase ? '<p class="min-complete-hint">入手日：' + (purchase.purchaseDate || startDate) + '</p>' : '<p class="min-complete-hint">开始使用：' + startDate + '</p>'}
                    <p class="min-complete-hint">记录一下你的感受吧：</p>
                </div>
                <div class="form-group">
                    <label class="form-label">完成感想（选填）</label>
                    <textarea class="form-textarea" id="m-complete-note" placeholder="比如：用了3个月终于用完了，很有成就感！或者：下次不会再买这个了。" rows="4"></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="Utils.closeModal()">取消</button>
                <button class="btn btn-success" onclick="MinimalismModule.confirmComplete('${itemId}')">确认完成</button>
            </div>
        `;
        Utils.showModal(content);
    },

    confirmComplete(itemId) {
        const note = Utils.getFormValue('m-complete-note');
        Store.minimalism.completeItem(itemId, note);
        Utils.toast('用完啦！断舍离记录 +1');
        Utils.closeModal();
        this.render();
    },

    // ===== 直接记录断舍离 =====
    showDiscardModal() {
        const purchases = Store.minimalism.getPurchases().filter(p => {
            // 排除已经断舍离的
            return !Store.minimalism.getAchievements().some(a => a.purchaseId === p.id);
        });
        const today = Utils.today();

        const categoryOptions = Object.entries(MINIMALISM_CATEGORIES).map(([k, v]) =>
            '<option value="' + k + '">' + v + '</option>'
        ).join('');

        const purchaseOptions = '<option value="">不关联入手记录</option>' + purchases.map(p =>
            '<option value="' + p.id + '" data-name="' + Utils.escapeHtml(p.name) + '" data-cat="' + p.category + '" data-date="' + (p.purchaseDate || '') + '">' +
            Utils.escapeHtml(p.name) + ' (' + (MINIMALISM_CATEGORIES[p.category] || '其他') + ')' +
            (p.purchaseDate ? ' ' + p.purchaseDate : '') + '</option>'
        ).join('');

        const content = `
            <div class="modal-header">
                <span class="modal-title">记录断舍离</span>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">物品名称</label>
                    <input type="text" class="form-input" id="m-discard-name" placeholder="如：某品牌精华液" required>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">分类</label>
                        <select class="form-select" id="m-discard-category">${categoryOptions}</select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">处理方式</label>
                        <select class="form-select" id="m-discard-type" onchange="MinimalismModule.onDiscardTypeChange(this)">
                            <option value="used-up">用完了</option>
                            <option value="discard">丢弃/扔掉</option>
                            <option value="giveaway">送人/捐赠</option>
                            <option value="expired">过期处理</option>
                            <option value="resale">转二手市场流通</option>
                        </select>
                    </div>
                </div>
                <div class="form-group" id="m-discard-profit-group" style="display:none;">
                    <label class="form-label">出售后净利润</label>
                    <input type="number" class="form-input" id="m-discard-profit" placeholder="0.00" step="0.01">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">入手日期（选填）</label>
                        <input type="date" class="form-input" id="m-discard-pdate" value="">
                    </div>
                    <div class="form-group">
                        <label class="form-label">断舍离日期</label>
                        <input type="date" class="form-input" id="m-discard-date" value="${today}">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">关联入手记录（选填）</label>
                    <select class="form-select" id="m-discard-purchase" onchange="MinimalismModule.onDiscardSelectChange(this)">
                        ${purchaseOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">感想（选填）</label>
                    <textarea class="form-textarea" id="m-discard-note" placeholder="比如：终于用完了！或者：放太久过期了，下次少买点。" rows="3"></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="Utils.closeModal()">取消</button>
                <button class="btn btn-success" onclick="MinimalismModule.saveDiscard()">保存</button>
            </div>
        `;
        Utils.showModal(content);
    },

    // 选择入手记录时自动填充
    onDiscardSelectChange(selectEl) {
        const opt = selectEl.selectedOptions[0];
        if (!opt || !opt.value) return;
        const name = opt.dataset.name || '';
        const cat = opt.dataset.cat || 'other';
        const date = opt.dataset.date || '';
        const nameEl = document.getElementById('m-discard-name');
        const catEl = document.getElementById('m-discard-category');
        const pdateEl = document.getElementById('m-discard-pdate');
        if (nameEl) nameEl.value = name;
        if (catEl) catEl.value = cat;
        if (pdateEl) pdateEl.value = date;
    },

    // 处理方式变化时显示/隐藏净利润输入
    onDiscardTypeChange(selectEl) {
        const profitGroup = document.getElementById('m-discard-profit-group');
        if (!profitGroup) return;
        profitGroup.style.display = selectEl.value === 'resale' ? '' : 'none';
    },

    saveDiscard() {
        const name = Utils.getFormValue('m-discard-name');
        if (!name) { Utils.toast('请输入物品名称', 'error'); return; }

        const purchaseId = Utils.getFormValue('m-discard-purchase') || null;
        const discardDate = Utils.getFormValue('m-discard-date');
        const purchaseDate = Utils.getFormValue('m-discard-pdate') || null;

        // 如果从入手记录中选择，关联 purchaseId
        const discardType = Utils.getFormValue('m-discard-type');
        const profit = discardType === 'resale' ? (parseFloat(Utils.getFormValue('m-discard-profit')) || 0) : null;

        Store.minimalism.addAchievement({
            itemName: name,
            category: Utils.getFormValue('m-discard-category'),
            purchaseId: purchaseId,
            purchaseDate: purchaseDate,
            completedAt: discardDate ? new Date(discardDate).getTime() : Date.now(),
            discardType: discardType,
            profit: profit,
            note: Utils.getFormValue('m-discard-note')
        });

        Utils.toast('断舍离记录已保存');
        Utils.closeModal();
        this.render();
    },

    // 从入手记录直接断舍离
    discardFromPurchase(purchaseId) {
        const p = Store.minimalism.getPurchases().find(p => p.id === purchaseId);
        if (!p) return;

        const today = Utils.today();
        const categoryOptions = Object.entries(MINIMALISM_CATEGORIES).map(([k, v]) =>
            '<option value="' + k + '"' + (k === p.category ? ' selected' : '') + '>' + v + '</option>'
        ).join('');

        const content = `
            <div class="modal-header">
                <span class="modal-title">记录断舍离</span>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="min-purchase-preview">
                    <span class="min-item-cat">${MINIMALISM_CATEGORIES[p.category] || '其他'}</span>
                    <strong>${Utils.escapeHtml(p.name)}</strong>
                    <span class="min-date-info">入手日：${p.purchaseDate || Utils.formatDate(p.createdAt)}</span>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">分类</label>
                        <select class="form-select" id="m-discard-category">${categoryOptions}</select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">断舍离日期</label>
                        <input type="date" class="form-input" id="m-discard-date" value="${today}">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">处理方式</label>
                    <select class="form-select" id="m-discard-type" onchange="MinimalismModule.onDiscardTypeChange(this)">
                        <option value="used-up">用完了</option>
                        <option value="discard">丢弃/扔掉</option>
                        <option value="giveaway">送人/捐赠</option>
                        <option value="expired">过期处理</option>
                        <option value="resale">转二手市场流通</option>
                    </select>
                </div>
                <div class="form-group" id="m-discard-profit-group" style="display:none;">
                    <label class="form-label">出售后净利润</label>
                    <input type="number" class="form-input" id="m-discard-profit" placeholder="0.00" step="0.01">
                </div>
                <div class="form-group">
                    <label class="form-label">感想（选填）</label>
                    <textarea class="form-textarea" id="m-discard-note" placeholder="比如：终于用完了！或者：放太久过期了。" rows="3"></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="Utils.closeModal()">取消</button>
                <button class="btn btn-success" onclick="MinimalismModule.saveDiscardFromPurchase('${purchaseId}')">保存</button>
            </div>
        `;
        Utils.showModal(content);
    },

    saveDiscardFromPurchase(purchaseId) {
        const p = Store.minimalism.getPurchases().find(p => p.id === purchaseId);
        if (!p) return;

        const discardDate = Utils.getFormValue('m-discard-date');
        const discardType = Utils.getFormValue('m-discard-type');
        const profit = discardType === 'resale' ? (parseFloat(Utils.getFormValue('m-discard-profit')) || 0) : null;

        Store.minimalism.addAchievement({
            itemName: p.name,
            category: Utils.getFormValue('m-discard-category') || p.category,
            purchaseId: purchaseId,
            purchaseDate: p.purchaseDate || null,
            completedAt: discardDate ? new Date(discardDate).getTime() : Date.now(),
            discardType: discardType,
            profit: profit,
            note: Utils.getFormValue('m-discard-note')
        });

        Utils.toast('断舍离记录已保存');
        Utils.closeModal();
        this.render();
    },

    deleteAchievement(id) {
        Utils.confirm('确定删除这条断舍离记录吗？', () => {
            Store.minimalism.deleteAchievement(id);
            Utils.toast('已删除');
            this.render();
        });
    },

    // ===== 目标 模态框 =====
    showGoalModal() {
        const today = Utils.today();
        const defaultTarget = new Date();
        defaultTarget.setDate(defaultTarget.getDate() + 60);

        const content = `
            <div class="modal-header">
                <span class="modal-title">设定优先使用目标</span>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">目标标题</label>
                    <input type="text" class="form-input" id="m-goal-title" placeholder="如：2个月内用完所有囤积的护肤品" required>
                </div>
                <div class="form-group">
                    <label class="form-label">目标日期</label>
                    <input type="date" class="form-input" id="m-goal-target" value="${Utils.formatDate(defaultTarget)}">
                </div>
                <div class="form-group">
                    <label class="form-label">描述</label>
                    <textarea class="form-textarea" id="m-goal-desc" placeholder="目标的具体说明..."></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="Utils.closeModal()">取消</button>
                <button class="btn btn-primary" onclick="MinimalismModule.saveGoal()">保存</button>
            </div>
        `;
        Utils.showModal(content);
    },

    saveGoal() {
        const title = Utils.getFormValue('m-goal-title');
        if (!title) { Utils.toast('请输入目标标题', 'error'); return; }

        Store.minimalism.addGoal({
            title: title,
            targetDate: Utils.getFormValue('m-goal-target'),
            description: Utils.getFormValue('m-goal-desc')
        });

        Utils.toast('目标已设定');
        Utils.closeModal();
        this.render();
    },

    deleteGoal(id) {
        Utils.confirm('确定删除这个目标吗？', () => {
            Store.minimalism.deleteGoal(id);
            Utils.toast('已删除');
            this.render();
        });
    }
};
