/**
 * 读书进度模块
 * 书籍管理、每日进度记录、读后感强制输出、微信读书API对接
 * 
 * 微信读书 API 对接说明：
 * - 官方 API 网关: POST https://i.weread.qq.com/api/agent/gateway
 * - 鉴权: Header Authorization: Bearer {WEREAD_API_KEY}
 * - API Key 获取: https://weread.qq.com/r/weread-skills （微信读书APP内"我的→设置→微信读书Skill"）
 * - 请求体: JSON，api_name 指定接口，skill_version 必须带
 * - 可用接口: /shelf/sync(书架同步), /store/search(搜书), /book/info(书籍详情),
 *   /readdata/detail(阅读统计), /notes/overview(笔记概览), /notes/bookmarks(划线内容),
 *   /book/recommend(推荐), /book/similar(相似书)
 */
const ReadingModule = {

    render() {
        this.renderOverview();
        this.renderBookshelf();
        this.renderReadingLog();
        this.loadWereadStats();
    },

    // ===== 概览 =====
    renderOverview() {
        const books = Store.reading.getBooks();
        const reading = books.filter(b => b.status === 'reading');
        const finished = books.filter(b => b.status === 'finished');
        const sessions = Store.reading.getSessions();

        // 本周阅读时长
        const weekStart = Utils.getWeekStart();
        const weekSessions = sessions.filter(s => s.date >= weekStart);
        const weekMinutes = weekSessions.reduce((sum, s) => sum + (s.duration || 0), 0);

        // 本年读完
        const yearStart = new Date().getFullYear() + '-01-01';
        const yearFinished = finished.filter(b => b.finishedDate && b.finishedDate >= yearStart);

        const elReading = document.getElementById('rd-reading-count');
        const elFinished = document.getElementById('rd-finished-count');
        const elWeekMin = document.getElementById('rd-week-minutes');
        const elYearCount = document.getElementById('rd-year-count');

        if (elReading) elReading.textContent = reading.length;
        if (elFinished) elFinished.textContent = finished.length;
        if (elWeekMin) elWeekMin.textContent = weekMinutes + ' min';
        if (elYearCount) elYearCount.textContent = yearFinished.length + ' 本';
    },

    // ===== 书架 =====
    renderBookshelf() {
        const el = document.getElementById('rd-bookshelf');
        if (!el) return;

        const books = Store.reading.getBooks();

        if (books.length === 0) {
            el.innerHTML = '<div class="empty-state">书架空空如也，点击"添加书籍"开始记录</div>';
            return;
        }

        // 按状态分组
        const groups = {
            'reading': books.filter(b => b.status === 'reading'),
            'want_read': books.filter(b => b.status === 'want_read'),
            'finished': books.filter(b => b.status === 'finished'),
            'paused': books.filter(b => b.status === 'paused')
        };

        let html = '';

        Object.entries(groups).forEach(([status, list]) => {
            if (list.length === 0) return;
            const label = BOOK_STATUS[status];
            html += '<div class="rd-shelf-section">';
            html += '<h4 class="rd-shelf-title">' + label + ' (' + list.length + ')</h4>';
            html += '<div class="rd-books-grid">';

            list.forEach(book => {
                const cat = BOOK_CATEGORIES[book.category] || '';
                const progress = book.progress || 0;
                const hasReview = Store.reading.getReviewByBook(book.id);

                html += '<div class="rd-book-card rd-status-' + status + '">';
                html += '<div class="rd-book-header">';
                if (cat) html += '<span class="rd-book-cat">' + cat + '</span>';
                if (status === 'reading') html += '<span class="rd-book-progress-text">' + progress + '%</span>';
                if (status === 'finished' && !hasReview) html += '<span class="rd-book-alert">待写读后感</span>';
                html += '</div>';
                html += '<div class="rd-book-title">' + Utils.escapeHtml(book.title) + '</div>';
                if (book.author) html += '<div class="rd-book-author">' + Utils.escapeHtml(book.author) + '</div>';

                if (status === 'reading') {
                    html += '<div class="rd-progress-bar"><div class="rd-progress-fill" style="width:' + progress + '%"></div></div>';
                }

                if (book.totalPages && book.currentPage) {
                    html += '<div class="rd-page-info">' + book.currentPage + ' / ' + book.totalPages + ' 页</div>';
                }

                html += '<div class="rd-book-actions">';
                if (status === 'reading') {
                    html += '<button class="btn btn-sm btn-primary" onclick="ReadingModule.showSessionModal(\'' + book.id + '\')">记录阅读</button>';
                }
                if (status === 'finished' && !hasReview) {
                    html += '<button class="btn btn-sm btn-success" onclick="ReadingModule.showReviewModal(\'' + book.id + '\')">写读后感</button>';
                }
                if (hasReview) {
                    html += '<button class="btn btn-sm btn-secondary" onclick="ReadingModule.viewReview(\'' + book.id + '\')">查看读后感</button>';
                }
                html += '<button class="btn btn-sm btn-secondary" onclick="ReadingModule.showBookModal(\'' + book.id + '\')">编辑</button>';
                html += '<button class="btn btn-sm btn-danger" onclick="ReadingModule.deleteBook(\'' + book.id + '\')">删除</button>';
                html += '</div>';
                html += '</div>';
            });

            html += '</div></div>';
        });

        el.innerHTML = html;
    },

    // ===== 阅读记录 =====
    renderReadingLog() {
        const el = document.getElementById('rd-reading-log');
        if (!el) return;

        const sessions = Store.reading.getSessions().slice(0, 20);

        if (sessions.length === 0) {
            el.innerHTML = '<div class="empty-state">还没有阅读记录</div>';
            return;
        }

        let html = '<div class="table-wrapper"><table class="data-table">';
        html += '<thead><tr><th>日期</th><th>书名</th><th>时长</th><th>页数</th><th>备注</th><th>操作</th></tr></thead><tbody>';

        sessions.forEach(s => {
            const book = Store.reading.getBook(s.bookId);
            const bookName = book ? book.title : '(已删除)';
            html += '<tr>';
            html += '<td>' + (s.date || '') + '</td>';
            html += '<td>' + Utils.escapeHtml(bookName) + '</td>';
            html += '<td>' + (s.duration || 0) + ' min</td>';
            html += '<td>' + (s.pages || 0) + ' 页</td>';
            html += '<td>' + Utils.escapeHtml(s.note || '') + '</td>';
            html += '<td><button class="btn btn-sm btn-danger" onclick="ReadingModule.deleteSession(\'' + s.id + '\')">删除</button></td>';
            html += '</tr>';
        });

        html += '</tbody></table></div>';
        el.innerHTML = html;
    },

    // ===== 模态框 =====
    showBookModal(bookId) {
        const book = bookId ? Store.reading.getBook(bookId) : null;

        const statusOptions = Object.entries(BOOK_STATUS).map(([k, v]) =>
            '<option value="' + k + '"' + (book && book.status === k ? ' selected' : '') + '>' + v + '</option>'
        ).join('');

        const categoryOptions = Object.entries(BOOK_CATEGORIES).map(([k, v]) =>
            '<option value="' + k + '"' + (book && book.category === k ? ' selected' : '') + '>' + v + '</option>'
        ).join('');

        const content = `
            <div class="modal-header">
                <span class="modal-title">${book ? '编辑书籍' : '添加书籍'}</span>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">书名</label>
                    <input type="text" class="form-input" id="r-book-title" value="${book ? Utils.escapeHtml(book.title) : ''}" placeholder="书名" required>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">作者</label>
                        <input type="text" class="form-input" id="r-book-author" value="${book ? Utils.escapeHtml(book.author || '') : ''}" placeholder="作者">
                    </div>
                    <div class="form-group">
                        <label class="form-label">分类</label>
                        <select class="form-select" id="r-book-category">${categoryOptions}</select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">状态</label>
                        <select class="form-select" id="r-book-status">${statusOptions}</select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">总页数</label>
                        <input type="number" class="form-input" id="r-book-total" value="${book ? (book.totalPages || '') : ''}" placeholder="总页数" step="1">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">当前页</label>
                        <input type="number" class="form-input" id="r-book-current" value="${book ? (book.currentPage || '') : ''}" placeholder="当前读到第几页" step="1">
                    </div>
                    <div class="form-group">
                        <label class="form-label">进度 (%)</label>
                        <input type="number" class="form-input" id="r-book-progress" value="${book ? (book.progress || 0) : 0}" min="0" max="100" step="1">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">微信读书ID（选填，未来对接用）</label>
                    <input type="text" class="form-input" id="r-book-weread-id" value="${book ? Utils.escapeHtml(book.wereadId || '') : ''}" placeholder="微信读书书籍ID">
                </div>
                <div class="form-group">
                    <label class="form-label">备注</label>
                    <textarea class="form-textarea" id="r-book-note" placeholder="笔记或感想...">${book ? Utils.escapeHtml(book.note || '') : ''}</textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="Utils.closeModal()">取消</button>
                <button class="btn btn-primary" onclick="ReadingModule.saveBook('${bookId || ''}')">保存</button>
            </div>
        `;
        Utils.showModal(content);
    },

    saveBook(bookId) {
        const title = Utils.getFormValue('r-book-title');
        if (!title) { Utils.toast('请输入书名', 'error'); return; }

        const totalPages = Utils.getFormNumber('r-book-total');
        const currentPage = Utils.getFormNumber('r-book-current');
        let progress = Utils.getFormNumber('r-book-progress') || 0;

        // 自动计算进度
        if (totalPages && currentPage) {
            progress = Math.min(100, Math.round(currentPage / totalPages * 100));
        }

        const status = Utils.getFormValue('r-book-status');
        const data = {
            title: title,
            author: Utils.getFormValue('r-book-author'),
            category: Utils.getFormValue('r-book-category'),
            status: status,
            totalPages: totalPages,
            currentPage: currentPage,
            progress: progress,
            wereadId: Utils.getFormValue('r-book-weread-id'),
            note: Utils.getFormValue('r-book-note')
        };

        // 如果状态为已读但未设完成日期
        if (status === 'finished') {
            if (bookId) {
                const existing = Store.reading.getBook(bookId);
                if (existing && !existing.finishedDate) {
                    data.finishedDate = Utils.today();
                }
            } else {
                data.finishedDate = Utils.today();
            }
        }

        if (bookId) {
            Store.reading.updateBook(bookId, data);
        } else {
            Store.reading.addBook(data);
        }

        Utils.toast('书籍已保存');
        Utils.closeModal();
        this.render();

        // 如果标记为已读，提示写读后感
        if (status === 'finished') {
            const savedBook = bookId ? Store.reading.getBook(bookId) : Store.reading.getBooks()[0];
            if (savedBook && !Store.reading.getReviewByBook(savedBook.id)) {
                setTimeout(() => {
                    Utils.confirm('恭喜读完这本书！要现在写读后感吗？', () => {
                        this.showReviewModal(savedBook.id);
                    });
                }, 500);
            }
        }
    },

    deleteBook(id) {
        Utils.confirm('确定删除这本书及所有相关记录吗？', () => {
            Store.reading.deleteBook(id);
            Utils.toast('已删除');
            this.render();
        });
    },

    // ===== 阅读记录 =====
    showSessionModal(bookId) {
        const book = Store.reading.getBook(bookId);
        if (!book) return;

        const content = `
            <div class="modal-header">
                <span class="modal-title">记录阅读 - ${Utils.escapeHtml(book.title)}</span>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">日期</label>
                        <input type="date" class="form-input" id="r-session-date" value="${Utils.today()}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">阅读时长（分钟）</label>
                        <input type="number" class="form-input" id="r-session-duration" value="30" step="5" min="1">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">阅读页数</label>
                        <input type="number" class="form-input" id="r-session-pages" value="" placeholder="本次读了多少页" step="1">
                    </div>
                    <div class="form-group">
                        <label class="form-label">读到第几页</label>
                        <input type="number" class="form-input" id="r-session-current-page" value="${book.currentPage || ''}" placeholder="当前总页数" step="1">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">笔记/感想</label>
                    <textarea class="form-textarea" id="r-session-note" placeholder="本次阅读的笔记、摘录或感想..." rows="3"></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="Utils.closeModal()">取消</button>
                <button class="btn btn-primary" onclick="ReadingModule.saveSession('${bookId}')">保存</button>
            </div>
        `;
        Utils.showModal(content);
    },

    saveSession(bookId) {
        const duration = Utils.getFormNumber('r-session-duration') || 0;
        const pages = Utils.getFormNumber('r-session-pages') || 0;
        const currentPage = Utils.getFormNumber('r-session-current-page');
        const date = Utils.getFormValue('r-session-date');
        const note = Utils.getFormValue('r-session-note');

        if (!date) { Utils.toast('请选择日期', 'error'); return; }

        Store.reading.addSession({
            bookId: bookId,
            date: date,
            duration: duration,
            pages: pages,
            note: note
        });

        // 更新书籍进度
        const book = Store.reading.getBook(bookId);
        if (book) {
            const updates = {};
            if (currentPage) {
                updates.currentPage = currentPage;
                if (book.totalPages) {
                    updates.progress = Math.min(100, Math.round(currentPage / book.totalPages * 100));
                }
            }
            Store.reading.updateBook(bookId, updates);
        }

        Utils.toast('阅读记录已保存');
        Utils.closeModal();
        this.render();
    },

    deleteSession(id) {
        Store.reading.deleteSession(id);
        Utils.toast('已删除');
        this.render();
    },

    // ===== 读后感 =====
    showReviewModal(bookId) {
        const book = Store.reading.getBook(bookId);
        if (!book) return;
        const existing = Store.reading.getReviewByBook(bookId);

        const content = `
            <div class="modal-header">
                <span class="modal-title">读后感 - ${Utils.escapeHtml(book.title)}</span>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="rd-review-prompt">
                    <p>你刚刚读完了 <strong>${Utils.escapeHtml(book.title)}</strong></p>
                    <p class="rd-review-hint">现在，请写下你的感受和思考。不写完不能关闭哦 :)</p>
                </div>
                <div class="form-group">
                    <label class="form-label">总体评价</label>
                    <select class="form-select" id="r-review-rating">
                        <option value="5">⭐⭐⭐⭐⭐ 非常推荐</option>
                        <option value="4">⭐⭐⭐⭐ 值得一读</option>
                        <option value="3">⭐⭐⭐ 一般</option>
                        <option value="2">⭐⭐ 不太推荐</option>
                        <option value="1">⭐ 不推荐</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">核心收获（至少写出3点）</label>
                    <textarea class="form-textarea" id="r-review-takeaways" placeholder="这本书给你最大的3个收获是什么？" rows="4" required>${existing ? Utils.escapeHtml(existing.takeaways || '') : ''}</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">感受与思考</label>
                    <textarea class="form-textarea" id="r-review-content" placeholder="你对这本书的整体感受、思考、与自身经历的关联..." rows="6" required>${existing ? Utils.escapeHtml(existing.content || '') : ''}</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">推荐给谁？</label>
                    <input type="text" class="form-input" id="r-review-recommend" placeholder="如：对投资感兴趣的人、想了解心理学的人..." value="${existing ? Utils.escapeHtml(existing.recommendTo || '') : ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">经典摘录</label>
                    <textarea class="form-textarea" id="r-review-quotes" placeholder="印象深刻的句子或段落..." rows="3">${existing ? Utils.escapeHtml(existing.quotes || '') : ''}</textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="Utils.closeModal()">取消</button>
                <button class="btn btn-success" onclick="ReadingModule.saveReview('${bookId}', '${existing ? existing.id : ''}')">保存读后感</button>
            </div>
        `;
        Utils.showModal(content);
    },

    saveReview(bookId, reviewId) {
        const takeaways = Utils.getFormValue('r-review-takeaways');
        const content = Utils.getFormValue('r-review-content');

        if (!takeaways || takeaways.length < 10) {
            Utils.toast('请认真写出你的核心收获（至少10个字）', 'error');
            return;
        }
        if (!content || content.length < 20) {
            Utils.toast('请写下更多感受（至少20个字）', 'error');
            return;
        }

        Store.reading.addReview({
            bookId: bookId,
            rating: Utils.getFormValue('r-review-rating'),
            takeaways: takeaways,
            content: content,
            recommendTo: Utils.getFormValue('r-review-recommend'),
            quotes: Utils.getFormValue('r-review-quotes')
        });

        Utils.toast('读后感已保存，干得漂亮！');
        Utils.closeModal();
        this.render();
    },

    viewReview(bookId) {
        const review = Store.reading.getReviewByBook(bookId);
        const book = Store.reading.getBook(bookId);
        if (!review || !book) return;

        const stars = '⭐'.repeat(parseInt(review.rating) || 3);

        const content = `
            <div class="modal-header">
                <span class="modal-title">读后感 - ${Utils.escapeHtml(book.title)}</span>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="rd-review-view">
                    <div class="rd-review-rating">${stars}</div>
                    <div class="rd-review-section">
                        <h4>核心收获</h4>
                        <p>${Utils.escapeHtml(review.takeaways || '')}</p>
                    </div>
                    <div class="rd-review-section">
                        <h4>感受与思考</h4>
                        <p>${Utils.escapeHtml(review.content || '')}</p>
                    </div>
                    ${review.recommendTo ? '<div class="rd-review-section"><h4>推荐给谁</h4><p>' + Utils.escapeHtml(review.recommendTo) + '</p></div>' : ''}
                    ${review.quotes ? '<div class="rd-review-section"><h4>经典摘录</h4><p>' + Utils.escapeHtml(review.quotes) + '</p></div>' : ''}
                    <div class="rd-review-date">写于 ${Utils.formatDate(review.createdAt)}</div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="Utils.closeModal()">关闭</button>
                <button class="btn btn-primary" onclick="ReadingModule.showReviewModal('${bookId}')">编辑</button>
            </div>
        `;
        Utils.showModal(content);
    },

    // ===== 微信读书 API 对接 =====
    wereadApi: {
        GATEWAY: 'https://i.weread.qq.com/api/agent/gateway',
        SKILL_VERSION: '1.0.3',
        apiKey: '', // 由用户在「读书」模块设置中自行填入（localStorage 持久化），不在仓库中存储任何密钥

        setApiKey(key) {
            this.apiKey = key;
            localStorage.setItem('weread_api_key', key);
        },

        getApiKey() {
            if (!this.apiKey) {
                this.apiKey = localStorage.getItem('weread_api_key') || '';
            }
            return this.apiKey;
        },

        isConfigured() {
            return !!this.getApiKey();
        },

        async call(apiName, params = {}) {
            const key = this.getApiKey();
            if (!key) {
                throw new Error('微信读书 API Key 未配置');
            }
            const body = {
                api_name: apiName,
                skill_version: this.SKILL_VERSION,
                ...params
            };
            const resp = await fetch(this.GATEWAY, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + key,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });
            if (!resp.ok) throw new Error('API 请求失败: HTTP ' + resp.status);
            return resp.json();
        },

        // 同步书架（直接调用 API，可能受 CORS 限制）
        async syncShelf() {
            return this.call('/shelf/sync');
        },

        // 搜索书籍
        async searchBooks(keyword, count = 10) {
            return this.call('/store/search', { keyword, count, scope: 10 });
        },

        // 获取阅读统计
        async getReadingStats(mode = 'overall') {
            return this.call('/readdata/detail', { mode });
        },

        // 获取书籍详情
        async getBookInfo(bookId) {
            return this.call('/book/info', { bookId });
        },

        // 获取笔记概览
        async getNotesOverview(bookId) {
            return this.call('/notes/overview', { bookId });
        },

        // 获取划线内容
        async getBookmarks(bookId) {
            return this.call('/notes/bookmarks', { bookId });
        }
    },

    // ===== 从本地同步文件加载微信读书数据 =====
    async syncFromLocal() {
        Utils.toast('正在同步微信读书书架...');
        try {
            const data = await Utils.fetchJSON('data/weread-sync.json');

            let added = 0;
            let skipped = 0;

            if (data.books && data.books.length > 0) {
                // 性能优化：只读取一次现有书架，避免在循环中反复读写 localStorage
                const existingBooks = Store.reading.getBooks();
                const existingMap = new Map();
                existingBooks.forEach(b => {
                    if (b.wereadId) existingMap.set(b.wereadId, b);
                    if (b.title) existingMap.set('title:' + b.title + '|' + (b.author || ''), b);
                });

                // 批量收集新书，一次性写入
                const newBooks = [];
                data.books.forEach(wereadBook => {
                    const existing = (wereadBook.bookId && existingMap.get(wereadBook.bookId)) ||
                        existingMap.get('title:' + wereadBook.title + '|' + (wereadBook.author || ''));
                    if (!existing) {
                        newBooks.push({
                            id: Store.generateId(),
                            createdAt: Date.now(),
                            title: wereadBook.title,
                            author: wereadBook.author || '',
                            category: wereadBook.category || 'other',
                            status: wereadBook.status,
                            progress: 0,
                            totalPages: null,
                            wereadId: wereadBook.bookId,
                            finishedDate: wereadBook.finishedDate || null,
                            note: wereadBook.wereadCategory ? '微信读书分类: ' + wereadBook.wereadCategory : ''
                        });
                        added++;
                    } else {
                        skipped++;
                    }
                });

                // 一次性批量写入
                if (newBooks.length > 0) {
                    const allData = Store.getAll();
                    allData.reading.books = allData.reading.books.concat(newBooks);
                    Store.save(allData);
                }
            }

            Utils.toast('同步完成: 新增 ' + added + ' 本, 跳过 ' + skipped + ' 本已存在');
            this.render();
        } catch (e) {
            Utils.toast('同步失败: ' + e.message, 'error');
            console.error('WeRead sync error:', e);
        }
    },

    // ===== 加载微信读书统计面板 =====
    async loadWereadStats() {
        try {
            const data = await Utils.fetchJSON('data/weread-sync.json');

            const panel = document.getElementById('rd-weread-stats');
            if (!panel) return;

            const s = data.stats.summary;
            const syncTime = data.syncTime ? new Date(data.syncTime).toLocaleString('zh-CN') : '';

            panel.style.display = 'block';

            // 同步时间
            const timeEl = document.getElementById('rd-weread-sync-time');
            if (timeEl) timeEl.textContent = '同步于: ' + syncTime;

            // 统计卡片网格
            const gridEl = document.getElementById('rd-weread-stats-grid');
            if (gridEl) {
                const cards = [
                    { label: '阅读天数', value: s.totalReadDays + ' 天', icon: '📅' },
                    { label: '总阅读时长', value: s.totalReadTimeHours + ' 小时', icon: '⏱️' },
                    { label: '读过', value: s.totalReadBooks + ' 本', icon: '📚' },
                    { label: '读完', value: s.finishedBooks + ' 本', icon: '✅' },
                    { label: '笔记', value: s.totalNotes + ' 条', icon: '✏️' },
                    { label: '勋章', value: s.medalCount + ' 枚', icon: '🏅' },
                    { label: '偏好', value: s.preferCategoryWord, icon: '📖' },
                    { label: '习惯', value: s.preferTimeWord, icon: '🌙' }
                ];

                gridEl.innerHTML = cards.map(c =>
                    '<div class="rd-weread-stat-card">' +
                    '<span class="rd-weread-stat-icon">' + c.icon + '</span>' +
                    '<span class="rd-weread-stat-label">' + c.label + '</span>' +
                    '<span class="rd-weread-stat-value">' + c.value + '</span>' +
                    '</div>'
                ).join('');
            }

            // 年度阅读时长趋势 + 偏好作者
            const extraEl = document.getElementById('rd-weread-stats-extra');
            if (extraEl) {
                const yearStats = data.stats.yearStats || {};
                const years = Object.keys(yearStats).sort();
                const maxHours = Math.max(...Object.values(yearStats), 1);

                let yearBars = years.map(y => {
                    const h = yearStats[y];
                    const pct = Math.round(h / maxHours * 100);
                    return '<div class="rd-weread-year-bar">' +
                        '<span class="rd-weread-year-label">' + y + '</span>' +
                        '<div class="rd-weread-year-track"><div class="rd-weread-year-fill" style="width:' + pct + '%"></div></div>' +
                        '<span class="rd-weread-year-hours">' + h + 'h</span>' +
                        '</div>';
                }).join('');

                // 偏好作者
                const authors = (data.stats.preferredAuthors || []).slice(0, 5);
                let authorHtml = authors.map(a =>
                    '<div class="rd-weread-author">' +
                    '<span class="rd-weread-author-name">' + Utils.escapeHtml(a.name) + '</span>' +
                    '<span class="rd-weread-author-count">' + a.count + ' 本</span>' +
                    '<span class="rd-weread-author-time">' + Utils.escapeHtml(a.readTime || '') + '</span>' +
                    '</div>'
                ).join('');

                // 阅读时间最长的书
                const topBooks = (data.stats.topBooks || []).slice(0, 5);
                let topBooksHtml = topBooks.map((b, i) =>
                    '<div class="rd-weread-top-book">' +
                    '<span class="rd-weread-top-rank">' + (i + 1) + '</span>' +
                    '<span class="rd-weread-top-title">' + Utils.escapeHtml(b.title) + '</span>' +
                    '<span class="rd-weread-top-time">' + b.readTimeHours + 'h</span>' +
                    '</div>'
                ).join('');

                extraEl.innerHTML =
                    '<div class="rd-weread-extra-section">' +
                    '<h4>📈 年度阅读时长</h4>' +
                    '<div class="rd-weread-year-chart">' + yearBars + '</div>' +
                    '</div>' +
                    '<div class="rd-weread-extra-section">' +
                    '<h4>👤 最常读作者 TOP 5</h4>' +
                    '<div class="rd-weread-author-list">' + authorHtml + '</div>' +
                    '</div>' +
                    '<div class="rd-weread-extra-section">' +
                    '<h4>🏆 阅读时长 TOP 5</h4>' +
                    '<div class="rd-weread-top-list">' + topBooksHtml + '</div>' +
                    '</div>';
            }
        } catch (e) {
            console.error('Failed to load WeRead stats:', e);
        }
    },

    // 配置微信读书 API Key
    showWereadConfigModal() {
        const currentKey = this.wereadApi.getApiKey();
        const content = `
            <div class="modal-header">
                <span class="modal-title">微信读书 API 配置</span>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="rd-weread-info">
                    <p><strong>微信读书 API Key 获取方式：</strong></p>
                    <ol>
                        <li>打开微信读书 APP</li>
                        <li>进入「我的 → 右上角设置 → 微信读书 Skill」</li>
                        <li>复制你的 API Key（格式：wrk-xxxxxxxx）</li>
                        <li>粘贴到下方输入框</li>
                    </ol>
                    <p class="rd-weread-note">配置后可一键同步微信读书书架到本地，包括书名、作者、阅读进度等。</p>
                </div>
                <div class="form-group">
                    <label class="form-label">API Key</label>
                    <input type="text" class="form-input" id="r-weread-key" value="${currentKey}" placeholder="wrk-xxxxxxxx">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="Utils.closeModal()">取消</button>
                <button class="btn btn-primary" onclick="ReadingModule.saveWereadKey()">保存</button>
            </div>
        `;
        Utils.showModal(content);
    },

    saveWereadKey() {
        const key = Utils.getFormValue('r-weread-key');
        this.wereadApi.setApiKey(key);
        Utils.toast('微信读书 API Key 已保存');
        Utils.closeModal();
    }
};
