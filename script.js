const DATA_STORE = {
    key: 'studyPlannerData',
    data: {
        subjects: [],
        schedule: [],
        tasks: [],
        preferences: {
            theme: 'light'
        }
    },

    load() {
        const stored = localStorage.getItem(this.key);
        if (stored) {
            this.data = JSON.parse(stored);
        }
        APP.applyTheme();
    },

    save() {
        localStorage.setItem(this.key, JSON.stringify(this.data));
    },

    reset() {
        localStorage.removeItem(this.key);
        location.reload();
    }
};

const APP = {
    init() {
        DATA_STORE.load();
        this.cacheDOM();
        this.bindEvents();
        this.render();
        this.updateDate();
    },

    cacheDOM() {
        this.dom = {
            navLinks: document.querySelectorAll('.nav-links li'),
            sections: document.querySelectorAll('section'),
            pageTitle: document.getElementById('page-title'),
            currentDate: document.getElementById('current-date'),
            themeToggle: document.getElementById('theme-toggle'),
            modalOverlay: document.getElementById('modal-overlay'),
            closeModalButtons: document.querySelectorAll('.close-modal'),
            dashboardSubjects: document.getElementById('dash-total-subjects'),
            dashboardPending: document.getElementById('dash-pending-tasks'),
            dashboardExams: document.getElementById('dash-upcoming-exams'),
            dashboardSchedule: document.getElementById('dash-today-schedule'),
        };
    },

    bindEvents() {
        this.dom.navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                const section = e.currentTarget.dataset.section;
                this.navTo(section);
            });
        });

        this.dom.themeToggle.checked = DATA_STORE.data.preferences.theme === 'dark';
        this.dom.themeToggle.addEventListener('change', (e) => {
            const newTheme = e.target.checked ? 'dark' : 'light';
            DATA_STORE.data.preferences.theme = newTheme;
            DATA_STORE.save();
            this.applyTheme();
        });

        this.dom.closeModalButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeModal();
            });
        });

        this.dom.modalOverlay.addEventListener('click', (e) => {
            if (e.target === this.dom.modalOverlay) {
                this.closeModal();
            }
        });

        document.getElementById('modal-save-btn').addEventListener('click', () => {
            if (this.currentSaveAction) {
                this.currentSaveAction();
            }
        });

        document.getElementById('btn-add-subject').addEventListener('click', () => {
            this.openAddSubjectModal();
        });

        document.getElementById('subjects-list').addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-delete-subject')) {
                const id = e.target.dataset.id;
                this.deleteSubject(id);
            }
            if (e.target.classList.contains('btn-edit-subject')) {
                const id = e.target.dataset.id;
                this.openEditSubjectModal(id);
            }
        });

        document.getElementById('btn-add-slot').addEventListener('click', () => {
            this.openAddSlotsModal();
        });

        document.getElementById('schedule-day-filter').addEventListener('change', () => {
            this.renderSchedule();
        });

        document.getElementById('btn-add-task').addEventListener('click', () => {
            this.openAddTaskModal();
        });

        document.getElementById('btn-export').addEventListener('click', () => {
            this.exportData();
        });

        document.getElementById('btn-reset').addEventListener('click', () => {
            if (confirm('Are you sure you want to reset all data? This cannot be undone.')) {
                DATA_STORE.reset();
            }
        });
    },

    navTo(sectionId) {
        this.dom.navLinks.forEach(link => {
            if (link.dataset.section === sectionId) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        this.dom.sections.forEach(sec => {
            if (sec.id === sectionId) {
                sec.classList.add('active-section');
                sec.classList.remove('hidden-section');
            } else {
                sec.classList.remove('active-section');
                sec.classList.add('hidden-section');
            }
        });

        this.dom.pageTitle.textContent = sectionId.charAt(0).toUpperCase() + sectionId.slice(1);

        this.renderSection(sectionId);
    },

    applyTheme() {
        document.documentElement.setAttribute('data-theme', DATA_STORE.data.preferences.theme);
    },

    updateDate() {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        this.dom.currentDate.textContent = new Date().toLocaleDateString('en-US', options);
    },

    render() {
        this.navTo('dashboard');
    },

    renderSection(section) {
        switch (section) {
            case 'dashboard':
                this.renderDashboard();
                break;
            case 'subjects':
                this.renderSubjects();
                break;
            case 'schedule':
                this.renderSchedule();
                break;
            case 'tasks':
                this.renderTasks();
                break;
            case 'analytics':
                this.renderAnalytics();
                break;
        }
    },

    renderDashboard() {
        this.dom.dashboardSubjects.textContent = DATA_STORE.data.subjects.length;
        this.dom.dashboardPending.textContent = DATA_STORE.data.tasks.filter(t => !t.isCompleted).length;

        this.dom.dashboardExams.textContent = DATA_STORE.data.tasks.filter(t => t.type === 'Exam' && !t.isCompleted).length;

        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const todayName = days[new Date().getDay()];

        const todaySlots = DATA_STORE.data.schedule
            .filter(s => s.day === todayName)
            .sort((a, b) => a.start.localeCompare(b.start));

        const scheduleContainer = document.getElementById('dash-today-schedule');
        scheduleContainer.innerHTML = '';

        if (todaySlots.length === 0) {
            scheduleContainer.innerHTML = `<li class="empty-state">No classes scheduled for today (${todayName}).</li>`;
        } else {
            todaySlots.forEach(slot => {
                const subject = DATA_STORE.data.subjects.find(s => s.id === slot.subjectId) || { name: 'Unknown', color: '#ccc' };
                const li = document.createElement('li');
                li.innerHTML = `
                    <div style="display: flex; align-items: center;">
                        <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: ${subject.color}; margin-right: 0.75rem;"></span>
                        <div>
                            <strong>${subject.name}</strong>
                            <div style="font-size: 0.85rem; color: var(--secondary-text);">${this.formatTime(slot.start)} - ${this.formatTime(slot.end)}</div>
                        </div>
                    </div>
                `;
                scheduleContainer.appendChild(li);
            });
        }
    },

    renderSubjects() {
        const list = document.getElementById('subjects-list');
        list.innerHTML = '';

        if (DATA_STORE.data.subjects.length === 0) {
            list.innerHTML = '<p class="empty-state">No subjects added yet. Click "+ Add Subject" to get started.</p>';
            return;
        }

        DATA_STORE.data.subjects.forEach(sub => {
            const card = document.createElement('div');
            card.className = 'card subject-card';
            card.style.borderLeft = `5px solid ${sub.color || '#ccc'}`;
            card.innerHTML = `
                <h3>${sub.name}</h3>
                <p>Priority: <strong>${sub.priority}</strong></p>
                <div style="margin-top: 1rem; display: flex; justify-content: flex-end; gap: 0.5rem;">
                    <button class="btn btn-secondary btn-sm btn-edit-subject" data-id="${sub.id}">Edit</button>
                    <button class="btn btn-danger btn-sm btn-delete-subject" data-id="${sub.id}">Delete</button>
                </div>
            `;
            list.appendChild(card);
        });
    },

    openAddSubjectModal() {
        const formHTML = `
            <div class="form-group">
                <label>Subject Name</label>
                <input type="text" id="input-subject-name" class="form-control" placeholder="e.g. Mathematics">
            </div>
            <div class="form-group">
                <label>Priority</label>
                <select id="input-subject-priority" class="form-control">
                    <option value="High">High</option>
                    <option value="Medium" selected>Medium</option>
                    <option value="Low">Low</option>
                </select>
            </div>
            <div class="form-group">
                <label>Color Code</label>
                <input type="color" id="input-subject-color" class="form-control" value="#6366f1">
            </div>
        `;

        this.openModal('Add New Subject', formHTML);

        this.currentSaveAction = () => {
            const name = document.getElementById('input-subject-name').value;
            const priority = document.getElementById('input-subject-priority').value;
            const color = document.getElementById('input-subject-color').value;

            if (!name) return alert('Please enter a subject name');

            const newSubject = {
                id: Date.now().toString(),
                name,
                priority,
                color
            };

            DATA_STORE.data.subjects.push(newSubject);
            DATA_STORE.save();
            this.closeModal();
            this.renderSubjects();
        };
    },

    openEditSubjectModal(id) {
        const subject = DATA_STORE.data.subjects.find(s => s.id === id);
        if (!subject) return;

        const formHTML = `
            <div class="form-group">
                <label>Subject Name</label>
                <input type="text" id="input-subject-name" class="form-control" value="${subject.name}">
            </div>
            <div class="form-group">
                <label>Priority</label>
                <select id="input-subject-priority" class="form-control">
                    <option value="High" ${subject.priority === 'High' ? 'selected' : ''}>High</option>
                    <option value="Medium" ${subject.priority === 'Medium' ? 'selected' : ''}>Medium</option>
                    <option value="Low" ${subject.priority === 'Low' ? 'selected' : ''}>Low</option>
                </select>
            </div>
            <div class="form-group">
                <label>Color Code</label>
                <input type="color" id="input-subject-color" class="form-control" value="${subject.color}">
            </div>
        `;

        this.openModal('Edit Subject', formHTML);

        this.currentSaveAction = () => {
            const name = document.getElementById('input-subject-name').value;
            const priority = document.getElementById('input-subject-priority').value;
            const color = document.getElementById('input-subject-color').value;

            if (!name) return alert('Please enter a subject name');

            subject.name = name;
            subject.priority = priority;
            subject.color = color;

            DATA_STORE.save();
            this.closeModal();
            this.renderSubjects();
        };
    },

    deleteSubject(id) {
        if (confirm('Delete this subject? This might affect related tasks.')) {
            DATA_STORE.data.subjects = DATA_STORE.data.subjects.filter(s => s.id !== id);
            DATA_STORE.save();
            this.renderSubjects();
        }
    },

    renderSchedule() {
        const grid = document.getElementById('schedule-grid');
        grid.innerHTML = '';

        const filterDay = document.getElementById('schedule-day-filter').value;
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

        const daysToShow = filterDay === 'all' ? days : [filterDay];

        if (DATA_STORE.data.schedule.length === 0) {
            grid.innerHTML = '<p class="empty-state">No schedule added yet.</p>';
            return;
        }

        daysToShow.forEach(day => {
            const dailySlots = DATA_STORE.data.schedule
                .filter(s => s.day === day)
                .sort((a, b) => a.start.localeCompare(b.start));

            if (dailySlots.length === 0 && filterDay !== 'all') {
                grid.innerHTML = '<p class="empty-state">No classes for this day.</p>';
                return;
            }

            if (dailySlots.length > 0 || filterDay === 'all') {
                const dayGroup = document.createElement('div');
                dayGroup.className = 'day-group';
                dayGroup.style.marginBottom = '2rem';

                dayGroup.innerHTML = `<h3 style="border-bottom: 2px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 1rem;">${day}</h3>`;

                const ul = document.createElement('ul');
                ul.className = 'list-group';

                dailySlots.forEach(slot => {
                    const subject = DATA_STORE.data.subjects.find(s => s.id === slot.subjectId) || { name: 'Unknown Subject', color: '#ccc' };
                    const li = document.createElement('li');
                    li.innerHTML = `
                        <div style="display: flex; align-items: center;">
                            <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background-color: ${subject.color}; margin-right: 1rem;"></span>
                            <div>
                                <strong>${subject.name}</strong>
                                <div style="font-size: 0.85rem; color: var(--secondary-text);">${this.formatTime(slot.start)} - ${this.formatTime(slot.end)}</div>
                            </div>
                        </div>
                        <button class="btn btn-danger btn-sm btn-delete-slot" data-id="${slot.id}">&times;</button>
                    `;
                    ul.appendChild(li);
                });

                dayGroup.appendChild(ul);
                grid.appendChild(dayGroup);
            }
        });

        document.querySelectorAll('.btn-delete-slot').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.deleteSlot(e.currentTarget.dataset.id);
            });
        });
    },

    formatTime(timeStr) {
        const [hour, min] = timeStr.split(':');
        const h = parseInt(hour, 10);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${h12}:${min} ${ampm}`;
    },

    openAddSlotsModal() {
        if (DATA_STORE.data.subjects.length === 0) {
            return alert('Please add subjects before creating a schedule.');
        }

        const subjectOptions = DATA_STORE.data.subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

        const formHTML = `
            <div class="form-group">
                <label>Subject</label>
                <select id="input-slot-subject" class="form-control">
                    ${subjectOptions}
                </select>
            </div>
            <div class="form-group">
                <label>Day</label>
                <select id="input-slot-day" class="form-control">
                    <option value="Monday">Monday</option>
                    <option value="Tuesday">Tuesday</option>
                    <option value="Wednesday">Wednesday</option>
                    <option value="Thursday">Thursday</option>
                    <option value="Friday">Friday</option>
                    <option value="Saturday">Saturday</option>
                    <option value="Sunday">Sunday</option>
                </select>
            </div>
            <div style="display: flex; gap: 1rem;">
                <div class="form-group" style="flex: 1;">
                    <label>Start Time</label>
                    <input type="time" id="input-slot-start" class="form-control">
                </div>
                <div class="form-group" style="flex: 1;">
                    <label>End Time</label>
                    <input type="time" id="input-slot-end" class="form-control">
                </div>
            </div>
        `;

        this.openModal('Add Schedule Slot', formHTML);

        this.currentSaveAction = () => {
            const subjectId = document.getElementById('input-slot-subject').value;
            const day = document.getElementById('input-slot-day').value;
            const start = document.getElementById('input-slot-start').value;
            const end = document.getElementById('input-slot-end').value;

            if (!start || !end) return alert('Please select start and end times.');
            if (start >= end) return alert('Start time must be before end time.');

            const conflict = DATA_STORE.data.schedule.find(s =>
                s.day === day &&
                ((start >= s.start && start < s.end) ||
                    (end > s.start && end <= s.end) ||
                    (start <= s.start && end >= s.end))
            );

            if (conflict) {
                return alert('Time conflict with an existing class!');
            }

            const newSlot = {
                id: Date.now().toString(),
                subjectId,
                day,
                start,
                end
            };

            DATA_STORE.data.schedule.push(newSlot);
            DATA_STORE.save();
            this.closeModal();
            this.renderSchedule();
        };
    },

    deleteSlot(id) {
        if (confirm('Remove this class slot?')) {
            DATA_STORE.data.schedule = DATA_STORE.data.schedule.filter(s => s.id !== id);
            DATA_STORE.save();
            this.renderSchedule();
        }
    },

    renderTasks() {
        const filterBtns = document.querySelectorAll('.filter-btn');
        filterBtns.forEach(btn => {
            btn.onclick = (e) => {
                document.querySelector('.filter-btn.active').classList.remove('active');
                e.target.classList.add('active');
                this.renderTasksList(e.target.dataset.filter);
            };
        });

        const activeFilter = document.querySelector('.filter-btn.active').dataset.filter || 'all';
        this.renderTasksList(activeFilter);
    },

    renderTasksList(filter = 'all') {
        const list = document.getElementById('tasks-list');
        list.innerHTML = '';

        let tasks = DATA_STORE.data.tasks;
        if (filter === 'pending') tasks = tasks.filter(t => !t.isCompleted);
        if (filter === 'completed') tasks = tasks.filter(t => t.isCompleted);

        tasks.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

        if (tasks.length === 0) {
            list.innerHTML = '<p class="empty-state">No tasks found.</p>';
            return;
        }

        tasks.forEach(task => {
            const subject = DATA_STORE.data.subjects.find(s => s.id === task.subjectId) || { name: 'General', color: '#ccc' };
            const isLate = !task.isCompleted && new Date(task.dueDate) < new Date();
            const li = document.createElement('li');
            li.style.opacity = task.isCompleted ? '0.6' : '1';

            li.innerHTML = `
                <div style="flex: 1; display: flex; gap: 1rem; align-items: center;">
                    <input type="checkbox" class="task-check" data-id="${task.id}" ${task.isCompleted ? 'checked' : ''}>
                    <div>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <strong>${task.title}</strong>
                            <span style="font-size: 0.75rem; padding: 2px 6px; border-radius: 4px; background-color: ${subject.color}; color: white;">${subject.name}</span>
                            ${isLate ? '<span style="color: var(--danger-color); font-weight: bold; font-size: 0.75rem;">(Overdue)</span>' : ''}
                        </div>
                        <div style="font-size: 0.85rem; color: var(--secondary-text);">Due: ${new Date(task.dueDate).toDateString()} • ${task.type}</div>
                    </div>
                </div>
                <button class="btn btn-danger btn-sm btn-delete-task" data-id="${task.id}">&times;</button>
            `;
            list.appendChild(li);
        });

        document.querySelectorAll('.task-check').forEach(chk => {
            chk.addEventListener('change', (e) => {
                this.toggleTask(e.target.dataset.id);
            });
        });

        document.querySelectorAll('.btn-delete-task').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.deleteTask(e.target.dataset.id);
            });
        });
    },

    openAddTaskModal() {
        if (DATA_STORE.data.subjects.length === 0) {
            return alert('Please add subjects first.');
        }

        const subjectOptions = DATA_STORE.data.subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

        const formHTML = `
            <div class="form-group">
                <label>Title</label>
                <input type="text" id="input-task-title" class="form-control" placeholder="Assignment 1">
            </div>
            <div class="form-group">
                <label>Subject</label>
                <select id="input-task-subject" class="form-control">
                    ${subjectOptions}
                </select>
            </div>
            <div class="form-group">
                <label>Type</label>
                <select id="input-task-type" class="form-control">
                    <option value="Assignment">Assignment</option>
                    <option value="Exam">Exam</option>
                    <option value="Project">Project</option>
                    <option value="Review">Review</option>
                </select>
            </div>
            <div class="form-group">
                <label>Due Date</label>
                <input type="date" id="input-task-date" class="form-control">
            </div>
        `;

        this.openModal('Add New Task', formHTML);

        this.currentSaveAction = () => {
            const title = document.getElementById('input-task-title').value;
            const subjectId = document.getElementById('input-task-subject').value;
            const type = document.getElementById('input-task-type').value;
            const dueDate = document.getElementById('input-task-date').value;

            if (!title || !dueDate) return alert('Please fill in all fields.');

            const newTask = {
                id: Date.now().toString(),
                title,
                subjectId,
                type,
                dueDate,
                isCompleted: false
            };

            DATA_STORE.data.tasks.push(newTask);
            DATA_STORE.save();
            this.closeModal();
            this.renderTasks();
        };
    },

    toggleTask(id) {
        const task = DATA_STORE.data.tasks.find(t => t.id === id);
        if (task) {
            task.isCompleted = !task.isCompleted;
            DATA_STORE.save();
            const activeFilter = document.querySelector('.filter-btn.active').dataset.filter || 'all';
            this.renderTasksList(activeFilter);
        }
    },

    deleteTask(id) {
        if (confirm('Delete this task?')) {
            DATA_STORE.data.tasks = DATA_STORE.data.tasks.filter(t => t.id !== id);
            DATA_STORE.save();
            const activeFilter = document.querySelector('.filter-btn.active').dataset.filter || 'all';
            this.renderTasksList(activeFilter);
        }
    },

    renderAnalytics() {
        const totalTasks = DATA_STORE.data.tasks.length;
        const completedTasks = DATA_STORE.data.tasks.filter(t => t.isCompleted).length;
        const progress = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

        document.getElementById('analytics-progress').style.width = `${progress}%`;
        document.getElementById('analytics-text').textContent = `${progress}% Completed (${completedTasks}/${totalTasks})`;

        const subjectCounts = {};
        DATA_STORE.data.tasks.forEach(task => {
            const subId = task.subjectId;
            subjectCounts[subId] = (subjectCounts[subId] || 0) + 1;
        });

        const chartContainer = document.getElementById('subject-distribution-chart');
        chartContainer.innerHTML = '';
        chartContainer.style.display = 'flex';
        chartContainer.style.alignItems = 'flex-end';
        chartContainer.style.height = '200px';
        chartContainer.style.gap = '1rem';
        chartContainer.style.paddingTop = '1rem';

        if (Object.keys(subjectCounts).length === 0) {
            chartContainer.innerHTML = '<p class="empty-state" style="width:100%">No data to display.</p>';
            return;
        }

        const maxCount = Math.max(...Object.values(subjectCounts));

        Object.keys(subjectCounts).forEach(subId => {
            const subject = DATA_STORE.data.subjects.find(s => s.id === subId) || { name: 'Unknown', color: '#ccc' };
            const count = subjectCounts[subId];
            const height = (count / maxCount) * 100;

            const barWrapper = document.createElement('div');
            barWrapper.style.display = 'flex';
            barWrapper.style.flexDirection = 'column';
            barWrapper.style.alignItems = 'center';
            barWrapper.style.flex = '1';

            barWrapper.innerHTML = `
                <div style="
                    width: 100%;
                    background-color: ${subject.color};
                    height: ${height}%;
                    min-height: 4px;
                    border-radius: 4px 4px 0 0;
                    position: relative;
                    transition: height 0.5s ease;
                " title="${subject.name}: ${count} tasks"></div>
                <span style="font-size: 0.75rem; margin-top: 0.5rem; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 50px;">
                    ${subject.name.substring(0, 3)}
                </span>
            `;
            chartContainer.appendChild(barWrapper);
        });
    },

    exportData() {
        const dataStr = JSON.stringify(DATA_STORE.data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `study_planner_backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    },

    openModal(title, contentHTML) {
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-body').innerHTML = contentHTML;
        this.dom.modalOverlay.classList.remove('hidden');
    },

    closeModal() {
        this.dom.modalOverlay.classList.add('hidden');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    APP.init();
});
