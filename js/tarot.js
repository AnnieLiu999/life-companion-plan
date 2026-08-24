/**
 * 塔罗客户管理模块
 */
const TarotModule = {
    currentClientId: null,

    // 渲染整个模块
    render() {
        this.renderOverview();
        this.renderClients();
        this.renderRecentReadings();
    },

    // 概览数据
    getSummary() {
        const clients = Store.tarot.getClients();
        const readings = Store.tarot.getReadings();
        const monthStart = Utils.getMonthStart();
        const monthlyReadings = readings.filter(r => r.date >= monthStart);
        const pendingFollowup = readings.filter(r => r.followUpDate && r.followUpDate <= Utils.today() && !r.followUpCompleted);

        return {
            clientsCount: clients.length,
            readingsCount: readings.length,
            monthlyCount: monthlyReadings.length,
            pendingCount: pendingFollowup.length
        };
    },

    renderOverview() {
        const s = this.getSummary();
        document.getElementById('tarot-clients-count').textContent = s.clientsCount;
        document.getElementById('tarot-readings-count').textContent = s.readingsCount;
        document.getElementById('tarot-monthly-readings').textContent = s.monthlyCount;
        const pendingEl = document.getElementById('tarot-pending-followup');
        pendingEl.textContent = s.pendingCount;
        if (s.pendingCount > 0) {
            pendingEl.className = 'overview-value down';
        } else {
            pendingEl.className = 'overview-value';
        }
    },

    // 渲染客户列表
    renderClients() {
        const clients = Store.tarot.getClients();
        const searchTerm = (document.getElementById('tarot-search')?.value || '').toLowerCase();
        const container = document.getElementById('tarot-client-list');

        let filtered = clients;
        if (searchTerm) {
            filtered = clients.filter(c => {
                if (c.name.toLowerCase().includes(searchTerm)) return true;
                if (c.note && c.note.toLowerCase().includes(searchTerm)) return true;
                if (c.tags && c.tags.some(t => t.toLowerCase().includes(searchTerm))) return true;
                // 搜索占卜记录
                const readings = Store.tarot.getReadingsByClient(c.id);
                return readings.some(r =>
                    (r.question && r.question.toLowerCase().includes(searchTerm)) ||
                    (r.topic && r.topic.toLowerCase().includes(searchTerm))
                );
            });
        }

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column:1/-1;">
                    <div class="empty-state-icon">✦</div>
                    <div class="empty-state-text">${searchTerm ? '未找到匹配的客户' : '暂无客户，点击上方按钮添加'}</div>
                </div>`;
            return;
        }

        container.innerHTML = filtered.map(c => {
            const readings = Store.tarot.getReadingsByClient(c.id);
            const lastReading = readings[0];
            const tagsHtml = (c.tags || []).map(t => `<span class="client-tag">${Utils.escapeHtml(t)}</span>`).join('');

            return `
                <div class="client-card" onclick="TarotModule.showClientDetail('${c.id}')">
                    <div class="client-card-header">
                        <span class="client-name">${Utils.escapeHtml(c.name)}</span>
                        <div class="client-tags">${tagsHtml}</div>
                    </div>
                    ${c.contact ? `<div class="client-info">📞 ${Utils.escapeHtml(c.contact)}</div>` : ''}
                    ${c.birthday ? `<div class="client-info">🎂 ${c.birthday}</div>` : ''}
                    <div class="client-stats">
                        <span>占卜 ${readings.length} 次</span>
                        ${lastReading ? `<span>最近：${lastReading.date}</span>` : '<span>暂无记录</span>'}
                    </div>
                </div>`;
        }).join('');
    },

    // 渲染近期占卜记录
    renderRecentReadings() {
        const readings = Store.tarot.getReadings().slice(0, 10);
        const clients = Store.tarot.getClients();
        const clientMap = {};
        clients.forEach(c => clientMap[c.id] = c);

        const container = document.getElementById('tarot-recent-readings');

        if (readings.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🔮</div>
                    <div class="empty-state-text">暂无占卜记录</div>
                </div>`;
            return;
        }

        container.innerHTML = readings.map(r => {
            const client = clientMap[r.clientId];
            const cardsHtml = (r.cards || []).map(c => {
                const reversed = c.reversed ? ' reversed' : '';
                const name = c.name + (c.reversed ? '（逆位）' : '');
                return `<span class="reading-card-item${reversed}">${Utils.escapeHtml(c.position || '')}：${Utils.escapeHtml(name)}</span>`;
            }).join('');

            return `
                <div class="reading-card" onclick="TarotModule.showReadingDetail('${r.id}')">
                    <div class="reading-header">
                        <span class="reading-client">${client ? Utils.escapeHtml(client.name) : '未知客户'}</span>
                        <span class="reading-date">${r.date}</span>
                    </div>
                    <span class="reading-topic">${Utils.escapeHtml(r.topic || '未分类')}</span>
                    <div class="reading-question">${Utils.escapeHtml(r.question || '')}</div>
                    <div class="reading-spread">牌阵：${SPREAD_TYPES[r.spread] || r.spread || '未指定'}</div>
                    ${cardsHtml ? `<div class="reading-cards">${cardsHtml}</div>` : ''}
                    ${r.followUpDate && !r.followUpCompleted ? `<div style="margin-top:6px;font-size:12px;color:var(--warning);">⏰ 待跟进：${r.followUpDate}</div>` : ''}
                </div>`;
        }).join('');
    },

    // 客户详情
    showClientDetail(clientId) {
        const client = Store.tarot.getClient(clientId);
        if (!client) return;

        const readings = Store.tarot.getReadingsByClient(clientId);
        const tagsHtml = (client.tags || []).map(t => `<span class="client-tag">${Utils.escapeHtml(t)}</span>`).join('');

        const timelineHtml = readings.length > 0 ? readings.map(r => `
            <div class="timeline-item">
                <div class="timeline-date">${r.date}</div>
                <div class="timeline-content">
                    <div class="timeline-question">${Utils.escapeHtml(r.question || '未记录问题')}</div>
                    <div class="timeline-spread">牌阵：${SPREAD_TYPES[r.spread] || r.spread || '未指定'} · 主题：${Utils.escapeHtml(r.topic || '未分类')}</div>
                    ${r.advice ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">建议：${Utils.escapeHtml(r.advice)}</div>` : ''}
                    ${r.followUpDate ? `<div style="font-size:12px;margin-top:4px;color:${r.followUpCompleted ? 'var(--success)' : 'var(--warning)'};">
                        ${r.followUpCompleted ? '✓ 已跟进' : '⏰ 待跟进：' + r.followUpDate}
                    </div>` : ''}
                </div>
            </div>`).join('') : '<div class="empty-state-text" style="padding:20px;">暂无占卜记录</div>';

        const content = `
            <div class="modal-header">
                <span class="modal-title">客户档案</span>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="client-detail-header">
                    <div class="client-detail-info">
                        <h2>${Utils.escapeHtml(client.name)}</h2>
                        <div class="client-detail-meta">
                            ${client.contact ? '📞 ' + Utils.escapeHtml(client.contact) + '　' : ''}
                            ${client.birthday ? '🎂 ' + client.birthday + '　' : ''}
                            ${client.createdAt ? '首次记录：' + Utils.formatDate(client.createdAt) : ''}
                        </div>
                        <div style="margin-top:6px;">${tagsHtml}</div>
                        ${client.note ? `<div style="margin-top:8px;font-size:13px;color:var(--text-secondary);">${Utils.escapeHtml(client.note)}</div>` : ''}
                    </div>
                    <div style="display:flex;flex-direction:column;gap:6px;">
                        <button class="btn btn-primary btn-sm" onclick="Utils.closeModal();TarotModule.showReadingModal('${clientId}')">+ 记录占卜</button>
                        <button class="btn btn-secondary btn-sm" onclick="TarotModule.editClient('${clientId}')">编辑客户</button>
                        <button class="btn btn-danger btn-sm" onclick="TarotModule.deleteClient('${clientId}')">删除客户</button>
                    </div>
                </div>
                <h3 style="font-size:14px;font-weight:600;margin:20px 0 12px;">占卜历史 (${readings.length})</h3>
                <div class="client-reading-timeline">${timelineHtml}</div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="Utils.closeModal()">关闭</button>
            </div>`;

        Utils.showModal(content, 'lg');
    },

    // 占卜详情
    showReadingDetail(readingId) {
        const reading = Store.tarot.getReadings().find(r => r.id === readingId);
        if (!reading) return;
        const client = Store.tarot.getClient(reading.clientId);

        const cardsHtml = (reading.cards || []).map(c => {
            const name = c.name + (c.reversed ? '（逆位）' : '');
            return `<div class="card-input-group">
                <div class="card-input-header">
                    <label>${Utils.escapeHtml(c.position || '未指定位置')}</label>
                </div>
                <div style="font-size:14px;font-weight:600;color:${c.reversed ? 'var(--tarot-color)' : 'var(--text-primary)'};">
                    ${Utils.escapeHtml(name)}
                </div>
                ${c.meaning ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">${Utils.escapeHtml(c.meaning)}</div>` : ''}
            </div>`;
        }).join('');

        const content = `
            <div class="modal-header">
                <span class="modal-title">占卜详情</span>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                    <div>
                        <h2 style="font-size:18px;font-weight:700;">${client ? Utils.escapeHtml(client.name) : '未知客户'}</h2>
                        <div style="font-size:13px;color:var(--text-secondary);">${reading.date} · ${SPREAD_TYPES[reading.spread] || reading.spread || '未指定牌阵'}</div>
                    </div>
                    <span class="reading-topic">${Utils.escapeHtml(reading.topic || '未分类')}</span>
                </div>

                ${reading.question ? `
                    <div class="form-group">
                        <label class="form-label">咨询问题</label>
                        <div style="padding:10px 14px;background:var(--bg-tertiary);border-radius:var(--radius-sm);font-size:14px;">${Utils.escapeHtml(reading.question)}</div>
                    </div>` : ''}

                ${cardsHtml ? `
                    <div class="form-group">
                        <label class="form-label">牌面</label>
                        ${cardsHtml}
                    </div>` : ''}

                ${reading.interpretation ? `
                    <div class="form-group">
                        <label class="form-label">解读</label>
                        <div style="padding:10px 14px;background:var(--bg-tertiary);border-radius:var(--radius-sm);font-size:13px;line-height:1.8;white-space:pre-wrap;">${Utils.escapeHtml(reading.interpretation)}</div>
                    </div>` : ''}

                ${reading.advice ? `
                    <div class="form-group">
                        <label class="form-label">给出的建议</label>
                        <div style="padding:10px 14px;background:var(--tarot-bg);border-radius:var(--radius-sm);font-size:13px;line-height:1.8;white-space:pre-wrap;color:var(--tarot-color);">${Utils.escapeHtml(reading.advice)}</div>
                    </div>` : ''}

                ${reading.followUp ? `
                    <div class="form-group">
                        <label class="form-label">后续反馈</label>
                        <div style="padding:10px 14px;background:var(--bg-tertiary);border-radius:var(--radius-sm);font-size:13px;line-height:1.8;white-space:pre-wrap;">${Utils.escapeHtml(reading.followUp)}</div>
                    </div>` : ''}

                ${reading.followUpDate ? `
                    <div style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:var(--radius-sm);background:${reading.followUpCompleted ? 'var(--stock-down-bg)' : 'var(--warning-bg)'};font-size:13px;">
                        <span>${reading.followUpCompleted ? '✓ 已完成跟进' : '⏰ 待跟进'}</span>
                        <span style="color:var(--text-secondary);">计划日期：${reading.followUpDate}</span>
                        ${!reading.followUpCompleted ? `<button class="btn btn-secondary btn-sm" style="margin-left:auto;" onclick="TarotModule.markFollowUpComplete('${readingId}')">标记已跟进</button>` : ''}
                    </div>` : ''}

                ${reading.note ? `
                    <div class="form-group" style="margin-top:14px;">
                        <label class="form-label">备注</label>
                        <div style="font-size:13px;color:var(--text-secondary);">${Utils.escapeHtml(reading.note)}</div>
                    </div>` : ''}
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="Utils.closeModal()">关闭</button>
                <button class="btn btn-primary" onclick="Utils.closeModal();TarotModule.showReadingModal(null,'${readingId}')">编辑</button>
                <button class="btn btn-danger" onclick="TarotModule.deleteReading('${readingId}')">删除</button>
            </div>`;

        Utils.showModal(content, 'lg');
    },

    markFollowUpComplete(readingId) {
        Store.tarot.updateReading(readingId, { followUpCompleted: true });
        Utils.toast('已标记为已跟进');
        Utils.closeModal();
        this.render();
        if (typeof DashboardModule !== 'undefined') DashboardModule.render();
    },

    // ===== 模态框 =====
    showClientModal(clientId = null) {
        const isEdit = !!clientId;
        const client = isEdit ? Store.tarot.getClient(clientId) : {};

        const formHtml = Utils.buildForm([
            {
                type: 'row',
                fields: [
                    { id: 'c-name', label: '客户姓名', type: 'text', value: client.name || '', placeholder: '姓名或昵称', required: true },
                    { id: 'c-contact', label: '联系方式', type: 'text', value: client.contact || '', placeholder: '微信/电话' }
                ]
            },
            {
                type: 'row',
                fields: [
                    { id: 'c-birthday', label: '生日', type: 'date', value: client.birthday || '' },
                    { id: 'c-tags', label: '标签（逗号分隔）', type: 'text', value: (client.tags || []).join(', '), placeholder: '如：感情,事业,老客户' }
                ]
            },
            { id: 'c-note', label: '备注', type: 'textarea', value: client.note || '', placeholder: '客户偏好、重要信息等' }
        ]);

        const content = `
            <div class="modal-header">
                <span class="modal-title">${isEdit ? '编辑客户' : '添加客户'}</span>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <div class="modal-body">${formHtml}</div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="Utils.closeModal()">取消</button>
                <button class="btn btn-primary" onclick="TarotModule.saveClient('${clientId || ''}')">${isEdit ? '保存' : '添加'}</button>
            </div>`;

        Utils.showModal(content);
    },

    saveClient(clientId) {
        const name = Utils.getFormValue('c-name');
        if (!name) { Utils.toast('请输入客户姓名', 'error'); return; }

        const tagsStr = Utils.getFormValue('c-tags');
        const tags = tagsStr ? tagsStr.split(/[,，]/).map(t => t.trim()).filter(t => t) : [];

        const data = {
            name,
            contact: Utils.getFormValue('c-contact'),
            birthday: Utils.getFormValue('c-birthday'),
            tags,
            note: Utils.getFormValue('c-note')
        };

        if (clientId) {
            Store.tarot.updateClient(clientId, data);
            Utils.toast('客户已更新');
        } else {
            Store.tarot.addClient(data);
            Utils.toast('客户已添加');
        }

        Utils.closeModal();
        this.render();
        if (typeof DashboardModule !== 'undefined') DashboardModule.render();
    },

    editClient(id) {
        Utils.closeModal();
        setTimeout(() => this.showClientModal(id), 100);
    },

    deleteClient(id) {
        const client = Store.tarot.getClient(id);
        if (!client) return;
        Utils.confirm(`确定删除客户「${client.name}」吗？所有相关占卜记录将一并删除。`, () => {
            Store.tarot.deleteClient(id);
            Utils.toast('客户已删除');
            Utils.closeModal();
            this.render();
            if (typeof DashboardModule !== 'undefined') DashboardModule.render();
        });
    },

    // 占卜记录模态框
    showReadingModal(presetClientId = null, readingId = null) {
        const isEdit = !!readingId;
        const reading = isEdit ? Store.tarot.getReadings().find(r => r.id === readingId) : {};
        const clients = Store.tarot.getClients();

        if (clients.length === 0) {
            Utils.toast('请先添加客户', 'warning');
            return;
        }

        const clientOptions = clients.map(c => ({
            value: c.id,
            label: c.name + ((c.tags || []).length > 0 ? ` (${c.tags.join('/')})` : '')
        }));

        const spreadOptions = Object.entries(SPREAD_TYPES).map(([val, label]) => ({ value: val, label }));
        const topicOptions = [
            { value: '感情', label: '感情' },
            { value: '事业', label: '事业' },
            { value: '财运', label: '财运' },
            { value: '健康', label: '健康' },
            { value: '学业', label: '学业' },
            { value: '人际关系', label: '人际关系' },
            { value: '个人成长', label: '个人成长' },
            { value: '其他', label: '其他' }
        ];

        const cardSelectOptions = ALL_TAROT_CARDS.map(c => `<option value="${c}">${c}</option>`).join('');

        const formHtml = Utils.buildForm([
            {
                type: 'row-3',
                fields: [
                    { id: 'r-client', label: '客户', type: 'select', value: presetClientId || reading.clientId || clients[0].id, options: clientOptions },
                    { id: 'r-date', label: '日期', type: 'date', value: reading.date || Utils.today(), required: true },
                    { id: 'r-topic', label: '主题', type: 'select', value: reading.topic || '感情', options: topicOptions }
                ]
            },
            { id: 'r-question', label: '咨询问题', type: 'textarea', value: reading.question || '', placeholder: '客户具体询问的内容' },
            {
                type: 'row',
                fields: [
                    { id: 'r-spread', label: '牌阵', type: 'select', value: reading.spread || 'three_card', options: spreadOptions },
                    { id: 'r-followUpDate', label: '跟进日期', type: 'date', value: reading.followUpDate || '' }
                ]
            }
        ]) + `
            <div class="form-group">
                <label class="form-label">牌面记录 <button class="btn btn-secondary btn-sm" style="margin-left:8px;" onclick="TarotModule.addCardRow()">+ 添加牌</button></label>
                <div id="card-list"></div>
            </div>` + Utils.buildForm([
            { id: 'r-interpretation', label: '解读', type: 'textarea', value: reading.interpretation || '', placeholder: '对牌面的整体解读' },
            { id: 'r-advice', label: '给出的建议', type: 'textarea', value: reading.advice || '', placeholder: '给客户的建议' },
            { id: 'r-followUp', label: '后续反馈', type: 'textarea', value: reading.followUp || '', placeholder: '客户后续反馈（如有）' },
            { id: 'r-note', label: '备注', type: 'textarea', value: reading.note || '', placeholder: '其他需要记录的信息' }
        ]);

        const content = `
            <div class="modal-header">
                <span class="modal-title">${isEdit ? '编辑占卜记录' : '记录占卜'}</span>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <div class="modal-body">${formHtml}</div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="Utils.closeModal()">取消</button>
                <button class="btn btn-primary" onclick="TarotModule.saveReading('${readingId || ''}')">${isEdit ? '保存' : '记录'}</button>
            </div>`;

        Utils.showModal(content, 'xl');

        // 重置牌面索引
        this.cardRowIndex = 0;

        // 如果是编辑，加载已有牌面
        if (isEdit && reading.cards && reading.cards.length > 0) {
            reading.cards.forEach(c => this.addCardRow(c));
        } else {
            // 默认添加3张牌（三牌阵）
            this.addCardRow({ position: '过去' });
            this.addCardRow({ position: '现在' });
            this.addCardRow({ position: '未来' });
        }
    },

    cardRowIndex: 0,

    addCardRow(data = {}) {
        const container = document.getElementById('card-list');
        if (!container) return;
        const idx = this.cardRowIndex++;
        const cardSelectOptions = ALL_TAROT_CARDS.map(c =>
            `<option value="${c}" ${c === data.name ? 'selected' : ''}>${c}</option>`
        ).join('');

        const row = document.createElement('div');
        row.className = 'card-input-group';
        row.innerHTML = `
            <div class="card-input-header">
                <label>第 ${idx + 1} 张</label>
                <button class="card-remove-btn" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
            <div class="form-row-3">
                <input type="text" class="form-input card-position" placeholder="位置（如：过去）" value="${data.position || ''}">
                <select class="form-select card-name">
                    <option value="">选择牌面</option>
                    ${cardSelectOptions}
                </select>
                <select class="form-select card-reversed">
                    <option value="false" ${!data.reversed ? 'selected' : ''}>正位</option>
                    <option value="true" ${data.reversed ? 'selected' : ''}>逆位</option>
                </select>
            </div>
            <input type="text" class="form-input card-meaning" style="margin-top:8px;" placeholder="牌义解读（可选）" value="${data.meaning || ''}">`;
        container.appendChild(row);
    },

    saveReading(readingId) {
        const date = Utils.getFormValue('r-date');
        const clientId = Utils.getFormValue('r-client');
        if (!date || !clientId) { Utils.toast('请填写日期和客户', 'error'); return; }

        // 收集牌面
        const cards = [];
        document.querySelectorAll('#card-list .card-input-group').forEach(group => {
            const position = group.querySelector('.card-position').value.trim();
            const name = group.querySelector('.card-name').value;
            const reversed = group.querySelector('.card-reversed').value === 'true';
            const meaning = group.querySelector('.card-meaning').value.trim();
            if (name) {
                cards.push({ position, name, reversed, meaning });
            }
        });

        const data = {
            clientId,
            date,
            topic: Utils.getFormValue('r-topic'),
            question: Utils.getFormValue('r-question'),
            spread: Utils.getFormValue('r-spread'),
            cards,
            interpretation: Utils.getFormValue('r-interpretation'),
            advice: Utils.getFormValue('r-advice'),
            followUp: Utils.getFormValue('r-followUp'),
            followUpDate: Utils.getFormValue('r-followUpDate'),
            followUpCompleted: false,
            note: Utils.getFormValue('r-note')
        };

        if (readingId) {
            const existing = Store.tarot.getReadings().find(r => r.id === readingId);
            data.followUpCompleted = existing ? existing.followUpCompleted : false;
            Store.tarot.updateReading(readingId, data);
            Utils.toast('占卜记录已更新');
        } else {
            Store.tarot.addReading(data);
            Utils.toast('占卜记录已保存');
        }

        Utils.closeModal();
        this.render();
        if (typeof DashboardModule !== 'undefined') DashboardModule.render();
    },

    deleteReading(id) {
        Utils.confirm('确定删除这条占卜记录吗？', () => {
            Store.tarot.deleteReading(id);
            Utils.toast('记录已删除');
            Utils.closeModal();
            this.render();
            if (typeof DashboardModule !== 'undefined') DashboardModule.render();
        });
    }
};
