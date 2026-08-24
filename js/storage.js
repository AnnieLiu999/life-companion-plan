/**
 * 数据存储层 - 基于 localStorage 的本地数据管理
 * 提供三大模块的 CRUD 操作
 */
const Store = {
    STORAGE_KEY: 'life_workbench_data',

    // 大畅的预置账户（基于月度对账 Excel）
    getDefaultAccounts() {
        return [
            // 电子钱包
            { name: '支付宝资产', type: 'alipay', category: 'ewallet', balance: 0, currency: 'CNY', canHoldPositions: true },
            { name: '花呗', type: 'huabei', category: 'ewallet', balance: 0, currency: 'CNY', isDebt: true },
            { name: '微信余额', type: 'wechat_balance', category: 'ewallet', balance: 0, currency: 'CNY' },
            { name: '微信理财', type: 'wechat_finance', category: 'ewallet', balance: 0, currency: 'CNY' },
            // 银行卡
            { name: '招商信用卡', type: 'credit_card', category: 'bank', balance: 0, currency: 'CNY', isDebt: true, institution: '招商银行' },
            { name: '招商借记卡', type: 'debit_card', category: 'bank', balance: 0, currency: 'CNY', institution: '招商银行' },
            { name: '工商银行', type: 'debit_card', category: 'bank', balance: 0, currency: 'CNY', institution: '工商银行' },
            { name: '建设银行', type: 'debit_card', category: 'bank', balance: 0, currency: 'CNY', institution: '建设银行' },
            { name: '中国银行', type: 'debit_card', category: 'bank', balance: 0, currency: 'CNY', institution: '中国银行' },
            { name: '北京银行', type: 'debit_card', category: 'bank', balance: 0, currency: 'CNY', institution: '北京银行' },
            // 社保/公积金
            { name: '住房公积金', type: 'provident_fund', category: 'social', balance: 0, currency: 'CNY' },
            { name: '医保账户', type: 'medical_insurance', category: 'social', balance: 0, currency: 'CNY' },
            { name: '个人养老金', type: 'pension', category: 'social', balance: 0, currency: 'CNY' },
            // 投资账户
            { name: '同花顺', type: 'stock_a', category: 'investment', balance: 0, currency: 'CNY', canHoldPositions: true, institution: '同花顺' },
            { name: '雪球账户', type: 'fund_platform', category: 'investment', balance: 0, currency: 'CNY', canHoldPositions: true, institution: '雪球' },
            { name: '盈立证券', type: 'stock_hk', category: 'investment', balance: 0, currency: 'CNY', canHoldPositions: true, institution: '盈立' },
            { name: '老虎证券', type: 'stock_us', category: 'investment', balance: 0, currency: 'CNY', canHoldPositions: true, institution: '老虎' },
            { name: 'Velo', type: 'stock_us', category: 'investment', balance: 0, currency: 'CNY', canHoldPositions: true, institution: 'Velo' },
        ].map((a, i) => ({
            ...a,
            id: 'pre_' + i,
            createdAt: Date.now() + i,
            order: i
        }));
    },

    // 历史快照数据（基于大畅的 Excel 对账表）
    getHistoricalSnapshots() {
        return [
            {
                id: 'snap_20250721',
                date: '2025-07-21',
                balances: {
                    'pre_0': 402865.37, 'pre_1': -226.73, 'pre_2': 2933.41, 'pre_3': 7024.50,
                    'pre_4': -15373.68, 'pre_5': 1967.17, 'pre_6': 6929.02, 'pre_7': 14.98,
                    'pre_8': 0, 'pre_9': 1683.17,
                    'pre_10': 485600.79, 'pre_11': 16338.49, 'pre_12': 24384.90,
                    'pre_13': 111033.40, 'pre_14': 251844.95, 'pre_15': 59698.78, 'pre_16': 17209.33, 'pre_17': 0
                },
                note: '首次记录'
            },
            {
                id: 'snap_20250925',
                date: '2025-09-25',
                balances: {
                    'pre_0': 458629.47, 'pre_1': -1591.69, 'pre_2': 5093.40, 'pre_3': 7038.73,
                    'pre_4': -4583.45, 'pre_5': 849.67, 'pre_6': 4916.25, 'pre_7': 14.98,
                    'pre_8': 1, 'pre_9': 683.35,
                    'pre_10': 501388.79, 'pre_11': 17549.36, 'pre_12': 36613.03,
                    'pre_13': 113473.88, 'pre_14': 250577.64, 'pre_15': 61180.92, 'pre_16': 17234.12, 'pre_17': 18158.09
                },
                note: '总资产 1,487,284.24'
            },
            {
                id: 'snap_20251106',
                date: '2025-11-06',
                balances: {
                    'pre_0': 468633.06, 'pre_1': 0, 'pre_2': 5955.38, 'pre_3': 7047.52,
                    'pre_4': -5368.63, 'pre_5': 849.67, 'pre_6': 13319.46, 'pre_7': 14.98,
                    'pre_8': 1, 'pre_9': 683.35,
                    'pre_10': 517176.79, 'pre_11': 18865.08, 'pre_12': 34540.09,
                    'pre_13': 115341.13, 'pre_14': 256901.38, 'pre_15': 56353.04, 'pre_16': 17508.15, 'pre_17': 18158.09
                },
                note: '总资产 1,526,036.24'
            },
            {
                id: 'snap_20251202',
                date: '2025-12-02',
                balances: {
                    'pre_0': 473827.81, 'pre_1': 0, 'pre_2': 4829.18, 'pre_3': 7052.76,
                    'pre_4': -2580.37, 'pre_5': 849.67, 'pre_6': 9333.18, 'pre_7': 14.98,
                    'pre_8': 1, 'pre_9': 683.35,
                    'pre_10': 517176.79, 'pre_11': 19522.94, 'pre_12': 34395.61,
                    'pre_13': 112313.57, 'pre_14': 259117.41, 'pre_15': 64695.81, 'pre_16': 17232.46, 'pre_17': 18041.41
                },
                note: '总资产 1,536,564.26，比上月 +10,528'
            },
            {
                id: 'snap_20251231',
                date: '2025-12-31',
                balances: {
                    'pre_0': 489111.90, 'pre_1': 0, 'pre_2': 1420.54, 'pre_3': 7059.04,
                    'pre_4': -2365.65, 'pre_5': 849.78, 'pre_6': 2176.34, 'pre_7': 14.98,
                    'pre_8': 1, 'pre_9': 683.44,
                    'pre_10': 525070.79, 'pre_11': 19493.22, 'pre_12': 36700.46,
                    'pre_13': 118056.63, 'pre_14': 252451.31, 'pre_15': 58943.47, 'pre_16': 16801.85, 'pre_17': 17833.44
                },
                note: '总资产 1,544,359.24，比上月 +7,795'
            },
            {
                id: 'snap_20260109',
                date: '2026-01-09',
                balances: {
                    'pre_0': 504784.74, 'pre_1': -205.95, 'pre_2': 1252.54, 'pre_3': 7060.69,
                    'pre_4': -3977.53, 'pre_5': 849.78, 'pre_6': 5681.41, 'pre_7': 14.98,
                    'pre_8': 1, 'pre_9': 683.44,
                    'pre_10': 532964.79, 'pre_11': 19493.22, 'pre_12': 37000.81,
                    'pre_13': 123517.28, 'pre_14': 250132.25, 'pre_15': 58943.47, 'pre_16': 16801.85, 'pre_17': 17833.44
                },
                note: '最新对账'
            }
        ];
    },

    // 默认数据结构
    getDefaultData() {
        const accounts = this.getDefaultAccounts();
        const snapshots = this.getHistoricalSnapshots();

        // 用最新快照填充账户余额
        const latestSnap = snapshots[snapshots.length - 1];
        if (latestSnap) {
            accounts.forEach(acc => {
                if (latestSnap.balances[acc.id] !== undefined) {
                    acc.balance = latestSnap.balances[acc.id];
                    acc.updatedAt = Date.now();
                }
            });
        }

        return {
            finance: {
                accounts: accounts,
                holdings: [],
                transactions: [],
                snapshots: snapshots,
                incomes: [],
                goals: {
                    targetNetWorth: 2000000
                }
            },
            fitness: {
                bodyMetrics: [],
                workouts: [],
                goals: []
            },
            tarot: {
                clients: [],
                readings: []
            },
            minimalism: {
                items: [],
                goals: [],
                achievements: [],
                purchases: []
            },
            reading: {
                books: [],
                sessions: [],
                reviews: []
            },
            meta: {
                createdAt: Date.now(),
                version: '3.1'
            }
        };
    },

    // 数据迁移（v1 -> v2）
    migrate(data) {
        if (!data.finance) data.finance = {};
        if (!data.finance.accounts) data.finance.accounts = [];
        if (!data.finance.holdings) data.finance.holdings = [];
        if (!data.finance.transactions) data.finance.transactions = [];
        if (!data.finance.snapshots) data.finance.snapshots = [];
        if (!data.finance.incomes) data.finance.incomes = [];
        if (!data.finance.goals) data.finance.goals = { targetNetWorth: 2000000 };

        if (!data.fitness) data.fitness = { bodyMetrics: [], workouts: [], goals: [] };
        if (!data.tarot) data.tarot = { clients: [], readings: [] };
        if (!data.minimalism) data.minimalism = { items: [], goals: [], achievements: [], purchases: [] };
        if (!data.minimalism.purchases) data.minimalism.purchases = [];
        if (!data.reading) data.reading = { books: [], sessions: [], reviews: [] };
        if (!data.meta) data.meta = { createdAt: Date.now(), version: '3.0' };

        // 旧账户补全 category 和 balance 字段
        const typeCategoryMap = {
            'stock_a': 'investment', 'stock_hk': 'investment', 'stock_us': 'investment',
            'fund': 'investment', 'bond': 'investment', 'fund_platform': 'investment',
            'alipay': 'ewallet', 'huabei': 'ewallet', 'wechat_balance': 'ewallet', 'wechat_finance': 'ewallet',
            'credit_card': 'bank', 'debit_card': 'bank',
            'provident_fund': 'social', 'medical_insurance': 'social', 'pension': 'social',
            'other': 'other'
        };
        data.finance.accounts.forEach(acc => {
            if (!acc.category && acc.type) {
                acc.category = typeCategoryMap[acc.type] || 'other';
            }
            if (acc.balance === undefined) acc.balance = 0;
            if (!acc.currency) acc.currency = 'CNY';
        });

        // 如果账户为空且无快照数据，初始化默认账户
        if (data.finance.accounts.length === 0 && data.finance.snapshots.length === 0) {
            const defaults = this.getDefaultData();
            data.finance.accounts = defaults.finance.accounts;
            data.finance.snapshots = defaults.finance.snapshots;
            data.finance.goals = defaults.finance.goals;
        }

        // v3.1: 清空断舍离模块测试数据
        if (!data.meta.version || data.meta.version < '3.1') {
            data.minimalism.items = [];
            data.minimalism.goals = [];
            data.minimalism.achievements = [];
            data.minimalism.purchases = [];
        }

        data.meta.version = '3.1';
        return data;
    },

    // 读取全部数据
    getAll() {
        const raw = localStorage.getItem(this.STORAGE_KEY);
        if (!raw) {
            const defaults = this.getDefaultData();
            this.save(defaults);
            return defaults;
        }
        try {
            const data = JSON.parse(raw);
            return this.migrate(data);
        } catch (e) {
            console.error('数据解析失败，重置为默认值', e);
            const defaults = this.getDefaultData();
            this.save(defaults);
            return defaults;
        }
    },

    // 保存全部数据
    save(data) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    },

    // 生成唯一 ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    },

    // ===== 财务模块 =====
    finance: {
        // 账户
        getAccounts() {
            return Store.getAll().finance.accounts.sort((a, b) => (a.order || 0) - (b.order || 0));
        },

        getAccountsByCategory(category) {
            return this.getAccounts().filter(a => a.category === category);
        },

        getAccount(id) {
            return Store.getAll().finance.accounts.find(a => a.id === id);
        },

        addAccount(account) {
            const data = Store.getAll();
            account.id = Store.generateId();
            account.createdAt = Date.now();
            account.updatedAt = Date.now();
            account.order = data.finance.accounts.length;
            data.finance.accounts.push(account);
            Store.save(data);
            return account;
        },

        updateAccount(id, updates) {
            const data = Store.getAll();
            const acc = data.finance.accounts.find(a => a.id === id);
            if (acc) {
                Object.assign(acc, updates);
                acc.updatedAt = Date.now();
                Store.save(data);
            }
            return acc;
        },

        deleteAccount(id) {
            const data = Store.getAll();
            data.finance.accounts = data.finance.accounts.filter(a => a.id !== id);
            data.finance.holdings = data.finance.holdings.filter(h => h.accountId !== id);
            Store.save(data);
        },

        // 批量更新账户余额（月度对账）
        batchUpdateBalances(balances) {
            const data = Store.getAll();
            Object.entries(balances).forEach(([accountId, balance]) => {
                const acc = data.finance.accounts.find(a => a.id === accountId);
                if (acc) {
                    acc.balance = balance;
                    acc.updatedAt = Date.now();
                }
            });
            Store.save(data);
        },

        // 持仓
        getHoldings() {
            return Store.getAll().finance.holdings;
        },

        getHoldingsByAccount(accountId) {
            return Store.getAll().finance.holdings.filter(h => h.accountId === accountId);
        },

        addHolding(holding) {
            const data = Store.getAll();
            holding.id = Store.generateId();
            holding.createdAt = Date.now();
            holding.updatedAt = Date.now();
            data.finance.holdings.push(holding);
            Store.save(data);
            return holding;
        },

        updateHolding(id, updates) {
            const data = Store.getAll();
            const h = data.finance.holdings.find(h => h.id === id);
            if (h) {
                Object.assign(h, updates);
                h.updatedAt = Date.now();
                Store.save(data);
            }
            return h;
        },

        deleteHolding(id) {
            const data = Store.getAll();
            data.finance.holdings = data.finance.holdings.filter(h => h.id !== id);
            Store.save(data);
        },

        // 交易记录
        getTransactions() {
            return Store.getAll().finance.transactions.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        },

        addTransaction(txn) {
            const data = Store.getAll();
            txn.id = Store.generateId();
            txn.createdAt = Date.now();
            data.finance.transactions.push(txn);
            Store.save(data);
            return txn;
        },

        deleteTransaction(id) {
            const data = Store.getAll();
            data.finance.transactions = data.finance.transactions.filter(t => t.id !== id);
            Store.save(data);
        },

        // 月度快照
        getSnapshots() {
            return Store.getAll().finance.snapshots.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        },

        getLatestSnapshot() {
            const snaps = this.getSnapshots();
            return snaps.length > 0 ? snaps[0] : null;
        },

        addSnapshot(snapshot) {
            const data = Store.getAll();
            snapshot.id = Store.generateId();
            snapshot.createdAt = Date.now();

            // 计算总净资产
            let total = 0;
            Object.entries(snapshot.balances).forEach(([accountId, balance]) => {
                total += balance || 0;
            });
            snapshot.totalNetWorth = total;

            // 计算月度变动
            const prev = data.finance.snapshots
                .sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
            if (prev && prev.totalNetWorth !== undefined) {
                snapshot.monthlyChange = total - prev.totalNetWorth;
            }

            data.finance.snapshots.push(snapshot);
            Store.save(data);
            return snapshot;
        },

        deleteSnapshot(id) {
            const data = Store.getAll();
            data.finance.snapshots = data.finance.snapshots.filter(s => s.id !== id);
            Store.save(data);
        },

        // 收入记录
        getIncomes() {
            return Store.getAll().finance.incomes.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        },

        addIncome(income) {
            const data = Store.getAll();
            income.id = Store.generateId();
            income.createdAt = Date.now();
            data.finance.incomes.push(income);
            Store.save(data);
            return income;
        },

        deleteIncome(id) {
            const data = Store.getAll();
            data.finance.incomes = data.finance.incomes.filter(i => i.id !== id);
            Store.save(data);
        },

        // 财务目标
        getGoals() {
            return Store.getAll().finance.goals || { targetNetWorth: 2000000 };
        },

        updateGoals(updates) {
            const data = Store.getAll();
            data.finance.goals = Object.assign(data.finance.goals || {}, updates);
            Store.save(data);
            return data.finance.goals;
        }
    },

    // ===== 运动健康模块 =====
    fitness: {
        getBodyMetrics() {
            return Store.getAll().fitness.bodyMetrics.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        },

        addBodyMetric(metric) {
            const data = Store.getAll();
            metric.id = Store.generateId();
            metric.createdAt = Date.now();
            data.fitness.bodyMetrics.push(metric);
            Store.save(data);
            return metric;
        },

        deleteBodyMetric(id) {
            const data = Store.getAll();
            data.fitness.bodyMetrics = data.fitness.bodyMetrics.filter(m => m.id !== id);
            Store.save(data);
        },

        getWorkouts() {
            return Store.getAll().fitness.workouts.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        },

        addWorkout(workout) {
            const data = Store.getAll();
            workout.id = Store.generateId();
            workout.createdAt = Date.now();
            data.fitness.workouts.push(workout);
            Store.save(data);
            return workout;
        },

        deleteWorkout(id) {
            const data = Store.getAll();
            data.fitness.workouts = data.fitness.workouts.filter(w => w.id !== id);
            Store.save(data);
        },

        getGoals() {
            return Store.getAll().fitness.goals;
        },

        addGoal(goal) {
            const data = Store.getAll();
            goal.id = Store.generateId();
            goal.createdAt = Date.now();
            data.fitness.goals.push(goal);
            Store.save(data);
            return goal;
        },

        updateGoal(id, updates) {
            const data = Store.getAll();
            const g = data.fitness.goals.find(g => g.id === id);
            if (g) {
                Object.assign(g, updates);
                Store.save(data);
            }
            return g;
        },

        deleteGoal(id) {
            const data = Store.getAll();
            data.fitness.goals = data.fitness.goals.filter(g => g.id !== id);
            Store.save(data);
        }
    },

    // ===== 塔罗模块 =====
    tarot: {
        getClients() {
            return Store.getAll().tarot.clients;
        },

        getClient(id) {
            return Store.getAll().tarot.clients.find(c => c.id === id);
        },

        addClient(client) {
            const data = Store.getAll();
            client.id = Store.generateId();
            client.createdAt = Date.now();
            data.tarot.clients.push(client);
            Store.save(data);
            return client;
        },

        updateClient(id, updates) {
            const data = Store.getAll();
            const c = data.tarot.clients.find(c => c.id === id);
            if (c) {
                Object.assign(c, updates);
                Store.save(data);
            }
            return c;
        },

        deleteClient(id) {
            const data = Store.getAll();
            data.tarot.clients = data.tarot.clients.filter(c => c.id !== id);
            data.tarot.readings = data.tarot.readings.filter(r => r.clientId !== id);
            Store.save(data);
        },

        getReadings() {
            return Store.getAll().tarot.readings.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        },

        getReadingsByClient(clientId) {
            return Store.getAll().tarot.readings
                .filter(r => r.clientId === clientId)
                .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        },

        addReading(reading) {
            const data = Store.getAll();
            reading.id = Store.generateId();
            reading.createdAt = Date.now();
            data.tarot.readings.push(reading);
            Store.save(data);
            return reading;
        },

        updateReading(id, updates) {
            const data = Store.getAll();
            const r = data.tarot.readings.find(r => r.id === id);
            if (r) {
                Object.assign(r, updates);
                Store.save(data);
            }
            return r;
        },

        deleteReading(id) {
            const data = Store.getAll();
            data.tarot.readings = data.tarot.readings.filter(r => r.id !== id);
            Store.save(data);
        }
    },

    // ===== 断舍离模块 =====
    minimalism: {
        getItems() {
            return Store.getAll().minimalism.items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        },

        getActiveItems() {
            return this.getItems().filter(i => i.status === 'active');
        },

        getCompletedItems() {
            return this.getItems().filter(i => i.status === 'completed');
        },

        // ===== 入手记录 =====
        getPurchases() {
            return Store.getAll().minimalism.purchases.sort((a, b) => (b.purchaseDate || b.createdAt || 0) > (a.purchaseDate || a.createdAt || 0) ? 1 : -1);
        },

        addPurchase(purchase) {
            const data = Store.getAll();
            purchase.id = Store.generateId();
            purchase.createdAt = Date.now();
            data.minimalism.purchases.push(purchase);
            Store.save(data);
            return purchase;
        },

        updatePurchase(id, updates) {
            const data = Store.getAll();
            const p = data.minimalism.purchases.find(p => p.id === id);
            if (p) {
                Object.assign(p, updates);
                Store.save(data);
            }
            return p;
        },

        deletePurchase(id) {
            const data = Store.getAll();
            data.minimalism.purchases = data.minimalism.purchases.filter(p => p.id !== id);
            Store.save(data);
        },

        // ===== 断舍离记录（成就墙） =====
        addAchievement(achievement) {
            const data = Store.getAll();
            achievement.id = Store.generateId();
            achievement.completedAt = achievement.completedAt || Date.now();
            data.minimalism.achievements.push(achievement);
            Store.save(data);
            return achievement;
        },

        deleteAchievement(id) {
            const data = Store.getAll();
            data.minimalism.achievements = data.minimalism.achievements.filter(a => a.id !== id);
            Store.save(data);
        },

        addItem(item) {
            const data = Store.getAll();
            item.id = Store.generateId();
            item.createdAt = Date.now();
            item.status = item.status || 'active';
            data.minimalism.items.push(item);
            Store.save(data);
            return item;
        },

        updateItem(id, updates) {
            const data = Store.getAll();
            const item = data.minimalism.items.find(i => i.id === id);
            if (item) {
                Object.assign(item, updates);
                Store.save(data);
            }
            return item;
        },

        deleteItem(id) {
            const data = Store.getAll();
            data.minimalism.items = data.minimalism.items.filter(i => i.id !== id);
            Store.save(data);
        },

        completeItem(id, note) {
            const data = Store.getAll();
            const item = data.minimalism.items.find(i => i.id === id);
            if (item) {
                item.status = 'completed';
                item.completedAt = Date.now();
                item.completionNote = note || '';
                // 查找对应的入手记录
                const purchase = item.purchaseId ? data.minimalism.purchases.find(p => p.id === item.purchaseId) : null;
                data.minimalism.achievements.push({
                    id: Store.generateId(),
                    itemId: id,
                    itemName: item.name,
                    category: item.category,
                    purchaseId: item.purchaseId || null,
                    purchaseDate: purchase ? (purchase.purchaseDate || null) : (item.startDate || null),
                    completedAt: Date.now(),
                    discardType: 'used-up',
                    note: note || ''
                });
                Store.save(data);
            }
            return item;
        },

        getAchievements() {
            return Store.getAll().minimalism.achievements.sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
        },

        getGoals() {
            return Store.getAll().minimalism.goals.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        },

        addGoal(goal) {
            const data = Store.getAll();
            goal.id = Store.generateId();
            goal.createdAt = Date.now();
            goal.status = goal.status || 'active';
            data.minimalism.goals.push(goal);
            Store.save(data);
            return goal;
        },

        updateGoal(id, updates) {
            const data = Store.getAll();
            const g = data.minimalism.goals.find(g => g.id === id);
            if (g) {
                Object.assign(g, updates);
                Store.save(data);
            }
            return g;
        },

        deleteGoal(id) {
            const data = Store.getAll();
            data.minimalism.goals = data.minimalism.goals.filter(g => g.id !== id);
            Store.save(data);
        }
    },

    // ===== 读书模块 =====
    reading: {
        getBooks() {
            return Store.getAll().reading.books.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        },

        getBook(id) {
            return Store.getAll().reading.books.find(b => b.id === id);
        },

        getBooksByStatus(status) {
            return this.getBooks().filter(b => b.status === status);
        },

        addBook(book) {
            const data = Store.getAll();
            book.id = Store.generateId();
            book.createdAt = Date.now();
            book.status = book.status || 'reading';
            book.progress = book.progress || 0;
            data.reading.books.push(book);
            Store.save(data);
            return book;
        },

        updateBook(id, updates) {
            const data = Store.getAll();
            const b = data.reading.books.find(b => b.id === id);
            if (b) {
                Object.assign(b, updates);
                b.updatedAt = Date.now();
                Store.save(data);
            }
            return b;
        },

        deleteBook(id) {
            const data = Store.getAll();
            data.reading.books = data.reading.books.filter(b => b.id !== id);
            data.reading.sessions = data.reading.sessions.filter(s => s.bookId !== id);
            data.reading.reviews = data.reading.reviews.filter(r => r.bookId !== id);
            Store.save(data);
        },

        getSessions() {
            return Store.getAll().reading.sessions.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        },

        getSessionsByBook(bookId) {
            return this.getSessions().filter(s => s.bookId === bookId);
        },

        addSession(session) {
            const data = Store.getAll();
            session.id = Store.generateId();
            session.createdAt = Date.now();
            data.reading.sessions.push(session);
            Store.save(data);
            return session;
        },

        deleteSession(id) {
            const data = Store.getAll();
            data.reading.sessions = data.reading.sessions.filter(s => s.id !== id);
            Store.save(data);
        },

        getReviews() {
            return Store.getAll().reading.reviews.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        },

        getReviewByBook(bookId) {
            return Store.getAll().reading.reviews.find(r => r.bookId === bookId);
        },

        addReview(review) {
            const data = Store.getAll();
            review.id = Store.generateId();
            review.createdAt = Date.now();
            // 如果已有书评则更新
            const existing = data.reading.reviews.find(r => r.bookId === review.bookId);
            if (existing) {
                Object.assign(existing, review);
                existing.updatedAt = Date.now();
            } else {
                data.reading.reviews.push(review);
            }
            Store.save(data);
            return review;
        },

        updateReview(id, updates) {
            const data = Store.getAll();
            const r = data.reading.reviews.find(r => r.id === id);
            if (r) {
                Object.assign(r, updates);
                r.updatedAt = Date.now();
                Store.save(data);
            }
            return r;
        },

        deleteReview(id) {
            const data = Store.getAll();
            data.reading.reviews = data.reading.reviews.filter(r => r.id !== id);
            Store.save(data);
        }
    },

    // ===== 数据导出/导入 =====
    exportData() {
        const data = this.getAll();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `生活工作台_数据备份_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },

    importData(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            if (!data.finance || !data.fitness || !data.tarot) {
                throw new Error('数据格式不正确');
            }
            this.save(this.migrate(data));
            return true;
        } catch (e) {
            console.error('导入失败', e);
            return false;
        }
    },

    // ===== API 接口预留（未来用于对接行情 API 等） =====
    api: {
        // 预留接口：未来通过 API 更新持仓现价
        // updatePriceViaApi(holdingId) { ... }
        // 预留接口：未来通过 API 同步账户余额
        // syncAccountViaApi(accountId) { ... }
    }
};
