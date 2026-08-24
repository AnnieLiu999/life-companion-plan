/**
 * 运动健康模块
 */
const FitnessModule = {

    // 渲染整个模块
    render() {
        this.renderOverview();
        this.renderWorkouts();
        this.renderBodyMetrics();
        this.renderGoals();
        this.renderCharts();
        this.renderAdvice();
    },

    // 概览数据
    getSummary() {
        const workouts = Store.fitness.getWorkouts();
        const bodyMetrics = Store.fitness.getBodyMetrics();
        const weekStart = Utils.getWeekStart();
        const monthStart = Utils.getMonthStart();

        const weeklyWorkouts = workouts.filter(w => w.date >= weekStart);
        const monthlyWorkouts = workouts.filter(w => w.date >= monthStart);
        const weeklyDuration = weeklyWorkouts.reduce((sum, w) => sum + (w.duration || 0), 0);
        const latestMetric = bodyMetrics[0];

        return {
            weeklyCount: weeklyWorkouts.length,
            weeklyDuration,
            monthlyCount: monthlyWorkouts.length,
            currentWeight: latestMetric ? latestMetric.weight : null
        };
    },

    renderOverview() {
        const s = this.getSummary();
        document.getElementById('fit-weekly-count').textContent = s.weeklyCount;
        document.getElementById('fit-weekly-duration').textContent = s.weeklyDuration + ' min';
        document.getElementById('fit-monthly-count').textContent = s.monthlyCount;
        document.getElementById('fit-current-weight').textContent = s.currentWeight ? s.currentWeight + ' kg' : '-- kg';
    },

    // 渲染训练记录
    renderWorkouts() {
        const workouts = Store.fitness.getWorkouts();
        const tbody = document.getElementById('fit-workouts-body');

        if (workouts.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-tertiary);padding:30px;">暂无训练记录</td></tr>`;
            return;
        }

        tbody.innerHTML = workouts.slice(0, 50).map(w => {
            const exercises = w.exercises || [];
            const exerciseText = exercises.length > 0
                ? exercises.map(e => `${e.name}${e.sets ? ` ${e.sets}×${e.reps}` : ''}${e.weight ? `@${e.weight}kg` : ''}`).join(', ')
                : (w.note || '--');

            return `
                <tr>
                    <td>${w.date}</td>
                    <td>${WORKOUT_TYPES[w.type] || w.type}</td>
                    <td>${w.duration || 0} min</td>
                    <td>${INTENSITY_LEVELS[w.intensity] || '--'}</td>
                    <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;">${Utils.escapeHtml(exerciseText)}</td>
                    <td>${w.calories || '--'} kcal</td>
                    <td>
                        <button class="btn btn-danger btn-sm" onclick="FitnessModule.deleteWorkout('${w.id}')">删除</button>
                    </td>
                </tr>`;
        }).join('');
    },

    // 渲染身体指标
    renderBodyMetrics() {
        const metrics = Store.fitness.getBodyMetrics();
        const tbody = document.getElementById('fit-bodymetrics-body');

        if (metrics.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-tertiary);padding:30px;">暂无身体指标记录</td></tr>`;
            return;
        }

        tbody.innerHTML = metrics.slice(0, 30).map(m => `
            <tr>
                <td>${m.date}</td>
                <td>${m.weight || '--'}</td>
                <td>${m.bodyFat || '--'}</td>
                <td>${m.muscleMass || '--'}</td>
                <td>${m.restingHR || '--'}</td>
                <td>${Utils.escapeHtml(m.note || '')}</td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="FitnessModule.deleteBodyMetric('${m.id}')">删除</button>
                </td>
            </tr>`).join('');
    },

    // 渲染目标
    renderGoals() {
        const goals = Store.fitness.getGoals();
        const container = document.getElementById('fit-goals-list');

        if (goals.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🎯</div>
                    <div class="empty-state-text">暂无目标，设定一个目标来追踪进度</div>
                </div>`;
            return;
        }

        container.innerHTML = goals.map(g => {
            const progress = this.calculateGoalProgress(g);
            const progressClass = progress >= 75 ? 'progress-high' : progress >= 40 ? 'progress-mid' : 'progress-low';

            return `
                <div class="goal-card">
                    <div class="goal-header">
                        <span class="goal-title">${this.getGoalTitle(g)}</span>
                        <span class="goal-deadline">截止：${g.deadline || '无'}</span>
                    </div>
                    <div class="goal-progress-bar">
                        <div class="goal-progress-fill ${progressClass}" style="width:${Math.min(progress, 100)}%"></div>
                    </div>
                    <div class="goal-detail">
                        <span>当前：${g.current || '--'} ${g.unit || ''}</span>
                        <span>目标：${g.target} ${g.unit || ''}</span>
                        <span>进度：${progress.toFixed(0)}%</span>
                    </div>
                    <div style="margin-top:8px;display:flex;gap:6px;">
                        <button class="btn btn-secondary btn-sm" onclick="FitnessModule.editGoal('${g.id}')">编辑</button>
                        <button class="btn btn-danger btn-sm" onclick="FitnessModule.deleteGoal('${g.id}')">删除</button>
                    </div>
                </div>`;
        }).join('');
    },

    getGoalTitle(g) {
        const titles = {
            weight: '体重目标',
            bodyFat: '体脂率目标',
            trainingFreq: '训练频率目标',
            duration: '训练时长目标',
            custom: g.customTitle || '自定义目标'
        };
        return titles[g.type] || '目标';
    },

    calculateGoalProgress(g) {
        if (!g.current || !g.target) return 0;
        if (g.type === 'weight' || g.type === 'bodyFat') {
            // 递减目标
            if (!g.initial) return 0;
            const total = g.initial - g.target;
            const done = g.initial - g.current;
            return total > 0 ? Math.max(0, Math.min(100, (done / total) * 100)) : 0;
        }
        // 递增目标
        return Math.min(100, (g.current / g.target) * 100);
    },

    // 渲染图表
    renderCharts() {
        this.renderWeightChart();
        this.renderWorkoutDistChart();
    },

    renderWeightChart() {
        const metrics = Store.fitness.getBodyMetrics().reverse();
        const ctx = document.getElementById('chart-weight-trend');

        if (metrics.length === 0) {
            Utils.renderChart('chart-weight-trend', {
                type: 'line',
                data: { labels: [], datasets: [{ label: '体重', data: [], borderColor: '#c8966b' }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
            });
            return;
        }

        const labels = metrics.map(m => m.date);
        const weightData = metrics.map(m => m.weight);
        const bodyFatData = metrics.map(m => m.bodyFat);

        const datasets = [{
            label: '体重 (kg)',
            data: weightData,
            borderColor: '#c8966b',
            backgroundColor: 'rgba(200, 150, 107, 0.1)',
            fill: true,
            tension: 0.3,
            yAxisID: 'y'
        }];

        if (bodyFatData.some(v => v !== null && v !== undefined)) {
            datasets.push({
                label: '体脂率 (%)',
                data: bodyFatData,
                borderColor: '#a08bb5',
                backgroundColor: 'rgba(160, 139, 181, 0.1)',
                fill: false,
                tension: 0.3,
                yAxisID: 'y1'
            });
        }

        Utils.renderChart('chart-weight-trend', {
            type: 'line',
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    y: { position: 'left', title: { display: true, text: 'kg' } },
                    y1: { position: 'right', title: { display: true, text: '%' }, grid: { drawOnChartArea: false } }
                },
                plugins: { legend: { labels: { font: { size: 12 } } } }
            }
        });
    },

    renderWorkoutDistChart() {
        const workouts = Store.fitness.getWorkouts();
        const typeDuration = { strength: 0, cardio: 0, yoga: 0 };

        workouts.forEach(w => {
            if (typeDuration[w.type] !== undefined) {
                typeDuration[w.type] += w.duration || 0;
            }
        });

        // 固定颜色映射，确保每种运动类型颜色一致
        const typeColors = {
            strength: '#c8966b',  // 赤陶橙 - 力量训练
            cardio: '#7b8fb0',    // 雾蓝 - 有氧运动
            yoga: '#a08bb5'       // 薰衣草紫 - 瑜伽/柔韧
        };

        // 只展示有时长的运动类型，避免0值导致颜色不区分
        const activeTypes = Object.keys(typeDuration).filter(t => typeDuration[t] > 0);

        if (activeTypes.length === 0) {
            Utils.renderChart('chart-workout-distribution', {
                type: 'doughnut',
                data: { labels: ['暂无数据'], datasets: [{ data: [1], backgroundColor: ['#e5dccc'] }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
            });
            return;
        }

        const labels = activeTypes.map(t => WORKOUT_TYPES[t]);
        const data = activeTypes.map(t => typeDuration[t]);
        const colors = activeTypes.map(t => typeColors[t]);

        Utils.renderChart('chart-workout-distribution', {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            font: { size: 12 },
                            padding: 12,
                            generateLabels: function(chart) {
                                const chartData = chart.data;
                                return chartData.labels.map((label, i) => ({
                                    text: label + ' (' + chartData.datasets[0].data[i] + ' min)',
                                    fillStyle: chartData.datasets[0].backgroundColor[i],
                                    strokeStyle: chartData.datasets[0].backgroundColor[i],
                                    lineWidth: 0,
                                    hidden: false,
                                    index: i
                                }));
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(ctx) {
                                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                                const pct = total > 0 ? (ctx.parsed / total * 100).toFixed(1) : 0;
                                return ctx.label + ': ' + ctx.parsed + ' 分钟 (' + pct + '%)';
                            }
                        }
                    }
                }
            }
        });
    },

    // ===== 建议 =====
    renderAdvice() {
        this.renderTrainingAdvice();
        this.renderDietAdvice();
        this.renderMentalAdvice();
    },

    renderTrainingAdvice() {
        const advice = this.generateTrainingAdvice();
        const container = document.getElementById('fit-training-advice');
        if (advice.length === 0) {
            container.innerHTML = '<div class="advice-empty">录入训练数据后将为你生成训练建议</div>';
            return;
        }
        container.innerHTML = advice.map(a => `
            <div class="advice-item advice-fitness">
                <div class="advice-item-icon">${a.icon}</div>
                <div class="advice-item-content">
                    <div class="advice-item-title">${a.title}</div>
                    <div class="advice-item-desc">${a.desc}</div>
                </div>
            </div>`).join('');
    },

    generateTrainingAdvice() {
        const advice = [];
        const workouts = Store.fitness.getWorkouts();
        const goals = Store.fitness.getGoals();
        const bodyMetrics = Store.fitness.getBodyMetrics();

        if (workouts.length === 0) return advice;

        const weekStart = Utils.getWeekStart();
        const weeklyWorkouts = workouts.filter(w => w.date >= weekStart);
        const weeklyDuration = weeklyWorkouts.reduce((sum, w) => sum + (w.duration || 0), 0);

        // 1. 训练频率分析
        if (weeklyWorkouts.length === 0) {
            advice.push({
                icon: '!',
                title: '本周尚未训练',
                desc: '建议每周至少训练 3-4 次，保持运动习惯对身体健康至关重要。从轻度运动开始，逐步增加强度。'
            });
        } else if (weeklyWorkouts.length < 3) {
            advice.push({
                icon: '↑',
                title: '训练频率偏低',
                desc: `本周已训练 ${weeklyWorkouts.length} 次，建议增加至 3-4 次以达到最佳训练效果。`
            });
        } else if (weeklyWorkouts.length >= 5) {
            // 检查过度训练
            const highIntensityCount = weeklyWorkouts.filter(w => w.intensity === 'high').length;
            if (highIntensityCount >= 4) {
                advice.push({
                    icon: '⚠',
                    title: '注意过度训练风险',
                    desc: `本周 ${weeklyWorkouts.length} 次训练中 ${highIntensityCount} 次为高强度，建议安排 1-2 天休息日，避免过度训练导致受伤。`
                });
            } else {
                advice.push({
                    icon: '✓',
                    title: '训练频率良好',
                    desc: `本周已训练 ${weeklyWorkouts.length} 次，总计 ${weeklyDuration} 分钟，保持下去！`
                });
            }
        } else {
            advice.push({
                icon: '✓',
                title: '训练频率适宜',
                desc: `本周已训练 ${weeklyWorkouts.length} 次，总计 ${weeklyDuration} 分钟，节奏不错。`
            });
        }

        // 2. 训练类型平衡
        const typeCount = { strength: 0, cardio: 0, yoga: 0 };
        const recentWorkouts = workouts.slice(0, 20);
        recentWorkouts.forEach(w => {
            if (typeCount[w.type] !== undefined) typeCount[w.type]++;
        });

        const totalRecent = Object.values(typeCount).reduce((a, b) => a + b, 0);
        if (totalRecent > 0) {
            const strengthPct = (typeCount.strength / totalRecent) * 100;
            const cardioPct = (typeCount.cardio / totalRecent) * 100;
            const yogaPct = (typeCount.yoga / totalRecent) * 100;

            if (strengthPct > 70) {
                advice.push({
                    icon: '≡',
                    title: '建议增加有氧训练',
                    desc: '近期训练以力量训练为主，建议加入有氧运动提升心肺功能，推荐比例：力量 40%-50%，有氧 30%-40%，柔韧 10%-20%。'
                });
            } else if (cardioPct > 70) {
                advice.push({
                    icon: '≡',
                    title: '建议增加力量训练',
                    desc: '近期训练以有氧为主，建议加入力量训练提升肌肉量和基础代谢率，推荐比例：力量 40%-50%，有氧 30%-40%，柔韧 10%-20%。'
                });
            } else if (yogaPct < 10 && totalRecent > 5) {
                advice.push({
                    icon: '◊',
                    title: '建议加入柔韧性训练',
                    desc: '近期训练中瑜伽/柔韧性训练较少，建议每周安排 1-2 次瑜伽或拉伸训练，提升关节灵活性和恢复能力。'
                });
            }
        }

        // 3. 渐进超负荷建议
        if (typeCount.strength >= 3) {
            const strengthWorkouts = workouts.filter(w => w.type === 'strength').slice(0, 6).reverse();
            if (strengthWorkouts.length >= 2) {
                const recent = strengthWorkouts[strengthWorkouts.length - 1];
                const prev = strengthWorkouts[strengthWorkouts.length - 2];
                if (recent.exercises && prev.exercises) {
                    advice.push({
                        icon: '↑',
                        title: '渐进超负荷提醒',
                        desc: '保持每周递增训练量：增加重量 2.5%-5%，或增加 1-2 次重复，或增加 1 组。确保持续给肌肉新的刺激。'
                    });
                }
            }
        }

        // 4. 目标相关建议
        goals.forEach(g => {
            const progress = this.calculateGoalProgress(g);
            if (g.type === 'weight' && progress < 50) {
                advice.push({
                    icon: '⚖',
                    title: '体重目标进度',
                    desc: `当前体重 ${g.current}kg，目标 ${g.target}kg。建议结合饮食控制与有氧训练，保持每周 0.5-1kg 的健康减重速度。`
                });
            }
        });

        return advice;
    },

    renderDietAdvice() {
        const advice = this.generateDietAdvice();
        const container = document.getElementById('fit-diet-advice');
        if (advice.length === 0) {
            container.innerHTML = '<div class="advice-empty">录入身体指标和训练数据后将为你生成饮食建议</div>';
            return;
        }
        container.innerHTML = advice.map(a => `
            <div class="advice-item advice-fitness">
                <div class="advice-item-icon">${a.icon}</div>
                <div class="advice-item-content">
                    <div class="advice-item-title">${a.title}</div>
                    <div class="advice-item-desc">${a.desc}</div>
                </div>
            </div>`).join('');
    },

    generateDietAdvice() {
        const advice = [];
        const metrics = Store.fitness.getBodyMetrics();
        const workouts = Store.fitness.getWorkouts();
        const goals = Store.fitness.getGoals();

        if (metrics.length === 0 && workouts.length === 0) return advice;

        const latestMetric = metrics[0];
        const weekStart = Utils.getWeekStart();
        const weeklyWorkouts = workouts.filter(w => w.date >= weekStart);
        const weeklyDuration = weeklyWorkouts.reduce((sum, w) => sum + (w.duration || 0), 0);

        // 1. 基础代谢与热量建议
        if (latestMetric && latestMetric.weight) {
            const weight = latestMetric.weight;
            // 简化的基础代谢率计算 (Mifflin-St Jeor 公式，假设男性)
            // BMR = 10 * weight + 6.25 * height - 5 * age + 5
            // 这里用简化版
            const bmr = weight * 22; // 粗略估算
            const activityFactor = weeklyWorkouts.length >= 4 ? 1.55 : weeklyWorkouts.length >= 2 ? 1.375 : 1.2;
            const tdee = Math.round(bmr * activityFactor);

            advice.push({
                icon: '🔥',
                title: '每日热量需求',
                desc: `根据体重 ${weight}kg 和近期活动量，估算每日总能量消耗(TDEE)约 ${tdee} kcal。${
                    goals.some(g => g.type === 'weight' && g.target < g.current)
                        ? '减脂目标建议每日摄入 TDEE - 300~500 kcal。'
                        : goals.some(g => g.type === 'weight' && g.target > g.current)
                        ? '增肌目标建议每日摄入 TDEE + 200~300 kcal。'
                        : '维持体重建议每日摄入约 TDEE kcal。'
                }`
            });
        }

        // 2. 蛋白质摄入建议
        if (latestMetric && latestMetric.weight) {
            const weight = latestMetric.weight;
            const hasStrength = weeklyWorkouts.some(w => w.type === 'strength');
            if (hasStrength) {
                advice.push({
                    icon: '🥩',
                    title: '蛋白质摄入',
                    desc: `力量训练期间，建议每日蛋白质摄入 ${Math.round(weight * 1.6)}-${Math.round(weight * 2.0)}g（1.6-2.0g/kg体重）。优质蛋白来源：鸡胸肉、鸡蛋、牛肉、鱼类、乳清蛋白。`
                });
            } else {
                advice.push({
                    icon: '🥩',
                    title: '蛋白质摄入',
                    desc: `建议每日蛋白质摄入 ${Math.round(weight * 1.2)}-${Math.round(weight * 1.5)}g（1.2-1.5g/kg体重），分散在每餐中摄入效果更佳。`
                });
            }
        }

        // 3. 碳水化合物建议
        if (weeklyDuration > 150) {
            advice.push({
                icon: '🍚',
                title: '碳水化合物补充',
                desc: '本周训练量较大，建议训练前 1-2 小时摄入复合碳水（燕麦、全麦面包、糙米），训练后 30 分钟内补充快吸收碳水促进恢复。'
            });
        }

        // 4. 水分摄入
        advice.push({
            icon: '💧',
            title: '水分摄入',
            desc: '建议每日饮水 2-2.5L，训练日额外补充 500-1000ml。训练中每 15-20 分钟补充 150-200ml 水。'
        });

        // 5. 训练后营养
        if (weeklyWorkouts.length > 0) {
            advice.push({
                icon: '⏱',
                title: '训练后营养窗口',
                desc: '训练后 30-60 分钟内补充蛋白质 + 碳水化合物（比例约 1:3），如：蛋白粉 + 香蕉，或鸡胸肉 + 米饭，促进肌肉恢复和糖原补充。'
            });
        }

        // 6. 体脂相关建议
        if (latestMetric && latestMetric.bodyFat) {
            const bf = latestMetric.bodyFat;
            if (bf > 25) {
                advice.push({
                    icon: '📊',
                    title: '体脂管理',
                    desc: `当前体脂率 ${bf}%，偏高。建议控制精制碳水和油脂摄入，增加蛋白质比例，配合有氧运动逐步降低体脂。`
                });
            } else if (bf < 12) {
                advice.push({
                    icon: '📊',
                    title: '体脂管理',
                    desc: `当前体脂率 ${bf}%，较低。确保摄入充足的能量和优质脂肪，避免过度节食影响激素水平和恢复能力。`
                });
            }
        }

        return advice;
    },

    renderMentalAdvice() {
        const advice = this.generateMentalAdvice();
        const container = document.getElementById('fit-mental-advice');
        if (advice.length === 0) {
            container.innerHTML = '<div class="advice-empty">录入训练数据后将为你生成心理调整建议</div>';
            return;
        }
        container.innerHTML = advice.map(a => `
            <div class="advice-item advice-fitness">
                <div class="advice-item-icon">${a.icon}</div>
                <div class="advice-item-content">
                    <div class="advice-item-title">${a.title}</div>
                    <div class="advice-item-desc">${a.desc}</div>
                </div>
            </div>`).join('');
    },

    generateMentalAdvice() {
        const advice = [];
        const workouts = Store.fitness.getWorkouts();
        const goals = Store.fitness.getGoals();

        if (workouts.length === 0) {
            advice.push({
                icon: '🌟',
                title: '从小目标开始',
                desc: '不必追求完美，从每天 15 分钟的运动开始。建立习惯比单次训练量更重要。允许自己有不完美的训练日。'
            });
            return advice;
        }

        const weekStart = Utils.getWeekStart();
        const weeklyWorkouts = workouts.filter(w => w.date >= weekStart);

        // 1. 训练一致性
        if (weeklyWorkouts.length >= 3) {
            advice.push({
                icon: '💪',
                title: '保持一致性',
                desc: '你已经建立了良好的训练节奏。一致性是最大的力量——不在于单次训练多么拼命，而在于能否持续。给自己一些肯定。'
            });
        }

        // 2. 过度训练心理
        const highIntensityCount = weeklyWorkouts.filter(w => w.intensity === 'high').length;
        if (highIntensityCount >= 4) {
            advice.push({
                icon: '🧘',
                title: '允许休息',
                desc: '休息不是偷懒，是训练的一部分。肌肉在休息时生长，神经系统在放松时恢复。主动恢复日可以做轻度散步、冥想或拉伸。'
            });
        }

        // 3. 目标心态
        const weightGoal = goals.find(g => g.type === 'weight');
        if (weightGoal) {
            advice.push({
                icon: '⚖',
                title: '关注过程而非结果',
                desc: '体重数字会有波动，这是正常的。不要被短期数字困扰，关注每周的训练完成度和饮食质量。体重不是衡量健康的唯一标准。'
            });
        }

        // 4. 训练动机
        advice.push({
            icon: '🎯',
            title: '训练动机维护',
            desc: '当训练变成负担时，尝试：①更换训练环境或方式 ②找一个训练伙伴 ③记录训练日志看到自己的进步 ④给自己设定小奖励。感受运动后的愉悦感，让大脑建立正向反馈。'
        });

        // 5. 压力管理
        advice.push({
            icon: '🌬',
            title: '呼吸与压力管理',
            desc: '每日 5 分钟深呼吸练习（4-7-8 呼吸法：吸气4秒、屏息7秒、呼气8秒）可以帮助降低压力激素皮质醇水平，改善睡眠质量，促进训练恢复。'
        });

        // 6. 睡眠
        advice.push({
            icon: '😴',
            title: '睡眠与恢复',
            desc: '保证每晚 7-9 小时高质量睡眠。睡眠不足会影响训练表现、增加受伤风险、影响食欲激素。训练日尤其需要充足睡眠来支持肌肉恢复。'
        });

        return advice;
    },

    // ===== 模态框 =====
    showBodyMetricModal() {
        const formHtml = Utils.buildForm([
            { id: 'bm-date', label: '日期', type: 'date', value: Utils.today(), required: true },
            {
                type: 'row-3',
                fields: [
                    { id: 'bm-weight', label: '体重 (kg)', type: 'number', placeholder: '70.0', step: '0.1' },
                    { id: 'bm-bodyFat', label: '体脂率 (%)', type: 'number', placeholder: '15.0', step: '0.1' },
                    { id: 'bm-muscleMass', label: '肌肉量 (kg)', type: 'number', placeholder: '55.0', step: '0.1' }
                ]
            },
            {
                type: 'row',
                fields: [
                    { id: 'bm-restingHR', label: '静息心率 (bpm)', type: 'number', placeholder: '60', step: '1' },
                    { id: 'bm-note', label: '备注', type: 'text', placeholder: '可选' }
                ]
            }
        ]);

        const content = `
            <div class="modal-header">
                <span class="modal-title">记录身体指标</span>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <div class="modal-body">${formHtml}</div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="Utils.closeModal()">取消</button>
                <button class="btn btn-primary" onclick="FitnessModule.saveBodyMetric()">保存</button>
            </div>`;

        Utils.showModal(content);
    },

    saveBodyMetric() {
        const date = Utils.getFormValue('bm-date');
        if (!date) { Utils.toast('请选择日期', 'error'); return; }

        const data = {
            date,
            weight: Utils.getFormNumber('bm-weight'),
            bodyFat: Utils.getFormNumber('bm-bodyFat'),
            muscleMass: Utils.getFormNumber('bm-muscleMass'),
            restingHR: Utils.getFormNumber('bm-restingHR'),
            note: Utils.getFormValue('bm-note')
        };

        Store.fitness.addBodyMetric(data);

        // 更新目标的当前值
        const goals = Store.fitness.getGoals();
        goals.forEach(g => {
            if (g.type === 'weight' && data.weight) {
                Store.fitness.updateGoal(g.id, { current: data.weight });
            } else if (g.type === 'bodyFat' && data.bodyFat) {
                Store.fitness.updateGoal(g.id, { current: data.bodyFat });
            }
        });

        Utils.toast('身体指标已记录');
        Utils.closeModal();
        this.render();
        if (typeof DashboardModule !== 'undefined') DashboardModule.render();
    },

    deleteBodyMetric(id) {
        Utils.confirm('确定删除这条身体指标记录吗？', () => {
            Store.fitness.deleteBodyMetric(id);
            Utils.toast('记录已删除');
            this.render();
            if (typeof DashboardModule !== 'undefined') DashboardModule.render();
        });
    },

    showWorkoutModal() {
        const typeOptions = Object.entries(WORKOUT_TYPES).map(([val, label]) => ({ value: val, label }));
        const intensityOptions = Object.entries(INTENSITY_LEVELS).map(([val, label]) => ({ value: val, label }));

        let exerciseIndex = 0;
        const formHtml = Utils.buildForm([
            {
                type: 'row-3',
                fields: [
                    { id: 'w-date', label: '日期', type: 'date', value: Utils.today(), required: true },
                    { id: 'w-type', label: '训练类型', type: 'select', value: 'strength', options: typeOptions },
                    { id: 'w-intensity', label: '强度', type: 'select', value: 'medium', options: intensityOptions }
                ]
            },
            {
                type: 'row-3',
                fields: [
                    { id: 'w-duration', label: '时长 (分钟)', type: 'number', placeholder: '60', step: '1' },
                    { id: 'w-calories', label: '消耗 (kcal)', type: 'number', placeholder: '300', step: '1' },
                    { id: 'w-note', label: '备注', type: 'text', placeholder: '可选' }
                ]
            }
        ]) + `
            <div class="form-group">
                <label class="form-label">训练内容 <button class="btn btn-secondary btn-sm" onclick="FitnessModule.addExerciseRow()" style="margin-left:8px;">+ 添加动作</button></label>
                <div id="exercise-list"></div>
            </div>`;

        const content = `
            <div class="modal-header">
                <span class="modal-title">记录训练</span>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <div class="modal-body">${formHtml}</div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="Utils.closeModal()">取消</button>
                <button class="btn btn-primary" onclick="FitnessModule.saveWorkout()">保存</button>
            </div>`;

        Utils.showModal(content, 'lg');
        // 默认添加一个训练动作行
        this.addExerciseRow();
    },

    exerciseRowIndex: 0,

    addExerciseRow(data = {}) {
        const container = document.getElementById('exercise-list');
        if (!container) return;
        const idx = this.exerciseRowIndex++;
        const row = document.createElement('div');
        row.className = 'card-input-group';
        row.innerHTML = `
            <div class="card-input-header">
                <label>动作 ${idx + 1}</label>
                <button class="card-remove-btn" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
            <div class="form-row-3">
                <input type="text" class="form-input ex-name" placeholder="动作名称（如：深蹲）" value="${data.name || ''}">
                <input type="number" class="form-input ex-sets" placeholder="组数" value="${data.sets || ''}" step="1">
                <input type="number" class="form-input ex-reps" placeholder="次数" value="${data.reps || ''}" step="1">
            </div>
            <div class="form-row" style="margin-top:8px;">
                <input type="number" class="form-input ex-weight" placeholder="重量(kg)" value="${data.weight || ''}" step="0.5">
                <input type="text" class="form-input ex-note" placeholder="备注" value="${data.note || ''}">
            </div>`;
        container.appendChild(row);
    },

    saveWorkout() {
        const date = Utils.getFormValue('w-date');
        if (!date) { Utils.toast('请选择日期', 'error'); return; }

        // 收集训练动作
        const exercises = [];
        document.querySelectorAll('#exercise-list .card-input-group').forEach(group => {
            const name = group.querySelector('.ex-name').value.trim();
            if (name) {
                exercises.push({
                    name,
                    sets: parseInt(group.querySelector('.ex-sets').value) || null,
                    reps: parseInt(group.querySelector('.ex-reps').value) || null,
                    weight: parseFloat(group.querySelector('.ex-weight').value) || null,
                    note: group.querySelector('.ex-note').value.trim()
                });
            }
        });

        const data = {
            date,
            type: Utils.getFormValue('w-type'),
            intensity: Utils.getFormValue('w-intensity'),
            duration: Utils.getFormNumber('w-duration'),
            calories: Utils.getFormNumber('w-calories'),
            exercises,
            note: Utils.getFormValue('w-note')
        };

        Store.fitness.addWorkout(data);

        // 更新训练频率目标的当前值
        const goals = Store.fitness.getGoals();
        const weekStart = Utils.getWeekStart();
        const weeklyCount = Store.fitness.getWorkouts().filter(w => w.date >= weekStart).length;
        goals.forEach(g => {
            if (g.type === 'trainingFreq') {
                Store.fitness.updateGoal(g.id, { current: weeklyCount });
            }
        });

        Utils.toast('训练已记录');
        Utils.closeModal();
        this.render();
        if (typeof DashboardModule !== 'undefined') DashboardModule.render();
    },

    deleteWorkout(id) {
        Utils.confirm('确定删除这条训练记录吗？', () => {
            Store.fitness.deleteWorkout(id);
            Utils.toast('记录已删除');
            this.render();
            if (typeof DashboardModule !== 'undefined') DashboardModule.render();
        });
    },

    showGoalModal(goalId = null) {
        const isEdit = !!goalId;
        const goal = isEdit ? Store.fitness.getGoals().find(g => g.id === goalId) : {};

        const typeOptions = [
            { value: 'weight', label: '体重' },
            { value: 'bodyFat', label: '体脂率' },
            { value: 'trainingFreq', label: '训练频率（次/周）' },
            { value: 'duration', label: '训练时长（分钟/周）' },
            { value: 'custom', label: '自定义' }
        ];

        const formHtml = Utils.buildForm([
            {
                type: 'row',
                fields: [
                    { id: 'g-type', label: '目标类型', type: 'select', value: goal.type || 'weight', options: typeOptions },
                    { id: 'g-deadline', label: '截止日期', type: 'date', value: goal.deadline || '' }
                ]
            },
            {
                type: 'row-3',
                fields: [
                    { id: 'g-current', label: '当前值', type: 'number', value: goal.current || '', placeholder: '70', step: '0.1' },
                    { id: 'g-target', label: '目标值', type: 'number', value: goal.target || '', placeholder: '65', step: '0.1', required: true },
                    { id: 'g-initial', label: '初始值', type: 'number', value: goal.initial || '', placeholder: '75', step: '0.1', hint: '减脂/减重目标需填写' }
                ]
            },
            { id: 'g-customTitle', label: '自定义标题', type: 'text', value: goal.customTitle || '', placeholder: '自定义目标名称', hint: '仅自定义类型需要' }
        ]);

        const content = `
            <div class="modal-header">
                <span class="modal-title">${isEdit ? '编辑目标' : '设定目标'}</span>
                <button class="modal-close" onclick="Utils.closeModal()">&times;</button>
            </div>
            <div class="modal-body">${formHtml}</div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="Utils.closeModal()">取消</button>
                <button class="btn btn-primary" onclick="FitnessModule.saveGoal('${goalId || ''}')">${isEdit ? '保存' : '添加'}</button>
            </div>`;

        Utils.showModal(content);
    },

    saveGoal(goalId) {
        const target = Utils.getFormNumber('g-target');
        if (!target) { Utils.toast('请填写目标值', 'error'); return; }

        const type = Utils.getFormValue('g-type');
        const data = {
            type,
            deadline: Utils.getFormValue('g-deadline'),
            current: Utils.getFormNumber('g-current'),
            target,
            initial: Utils.getFormNumber('g-initial'),
            customTitle: Utils.getFormValue('g-customTitle'),
            unit: type === 'weight' ? 'kg' : type === 'bodyFat' ? '%' : type === 'trainingFreq' ? '次/周' : type === 'duration' ? 'min/周' : ''
        };

        if (goalId) {
            Store.fitness.updateGoal(goalId, data);
            Utils.toast('目标已更新');
        } else {
            Store.fitness.addGoal(data);
            Utils.toast('目标已设定');
        }

        Utils.closeModal();
        this.render();
        if (typeof DashboardModule !== 'undefined') DashboardModule.render();
    },

    editGoal(id) {
        this.showGoalModal(id);
    },

    deleteGoal(id) {
        Utils.confirm('确定删除这个目标吗？', () => {
            Store.fitness.deleteGoal(id);
            Utils.toast('目标已删除');
            this.render();
            if (typeof DashboardModule !== 'undefined') DashboardModule.render();
        });
    }
};
