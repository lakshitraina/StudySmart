import { auth, provider, signInWithPopup, signOut, onAuthStateChanged, db, ref, set, onValue, get, child } from './firebase-config.js';

const SHOP_ITEMS = {
    themes: [
        { id: 'light', name: 'Classic Light', price: 0, previewClass: 'preview-light' },
        { id: 'dark', name: 'Classic Dark', price: 0, previewClass: 'preview-dark' },
        { id: 'cyberpunk', name: 'Cyberpunk Neon', price: 50, previewClass: 'preview-cyberpunk' },
        { id: 'sunset', name: 'Sunset Vibes', price: 30, previewClass: 'preview-sunset' },
        { id: 'matrix', name: 'Matrix Code', price: 100, previewClass: 'preview-matrix' }
    ],
    borders: [
        { id: 'none', name: 'No Border', price: 0, previewClass: '' },
        { id: 'gold', name: 'Golden Champion', price: 200, previewClass: 'border-gold' },
        { id: 'fire', name: 'Fire Aura', price: 800, previewClass: 'border-fire' },
        { id: 'diamond', name: 'Diamond Glint', price: 1500, previewClass: 'border-diamond' }
    ],
    sounds: [
        { id: 'default', name: 'Standard Pop', price: 0 },
        { id: 'retro', name: '8-Bit Coin', price: 100 },
        { id: 'zen', name: 'Zen Bell', price: 150 },
        { id: 'level-up', name: 'RPG Level Up', price: 300 }
    ]
};

const DATA_STORE = {
    data: {
        subjects: [],
        schedule: [],
        tasks: [],
        userPrefs: {
            theme: 'light'
        },
        inventory: ['light', 'dark', 'none', 'default'],
        equipped: {
            theme: 'light',
            border: 'none',
            sound: 'default'
        },
        points: 0
    },
    useFirebase: false,
    uid: null,

    load(uid = null) {
        if (uid) {
            this.useFirebase = true;
            this.uid = uid;
            const userRef = ref(db, 'users/' + uid);
            onValue(userRef, (snapshot) => {
                const val = snapshot.val();
                if (val) {
                    this.data = val;
                } else {
                    // Try to recover from LocalStorage if new user but has local data
                    const local = localStorage.getItem('studySmartData');
                    if (local) {
                        try { this.data = JSON.parse(local); } catch (e) { this.data = this.getEmptyData(); }
                    } else {
                        this.data = this.getEmptyData();
                    }
                    this.save();
                }

                this.ensureDataStructure();
                APP.render();
            });
        } else {
            this.useFirebase = false;
            this.uid = null;
            const stored = localStorage.getItem('studySmartData');
            if (stored) {
                this.data = JSON.parse(stored);
            }
            this.ensureDataStructure();
            APP.render();
        }
        this.applyTheme();
    },

    ensureDataStructure() {
        if (!this.data.subjects) this.data.subjects = [];
        if (!this.data.schedule) this.data.schedule = [];
        if (!this.data.tasks) this.data.tasks = [];
        if (!this.data.userPrefs) this.data.userPrefs = { theme: 'light' };
        if (!this.data.inventory) this.data.inventory = ['light', 'dark', 'none', 'default'];
        if (!this.data.equipped) this.data.equipped = { theme: 'light', border: 'none', sound: 'default' };

        if (typeof this.data.points !== 'number') {
            const parsed = parseInt(this.data.points, 10);
            this.data.points = isNaN(parsed) ? 0 : parsed;
        }
    },

    save() {
        console.log("Saving Data:", this.data);
        if (this.useFirebase && this.uid) {
            set(ref(db, 'users/' + this.uid), this.data).then(() => {
                console.log("Firebase Save Success");
            }).catch(e => console.error(e));

            // Shadow Backup for compliance
            try { localStorage.setItem('studySmartData', JSON.stringify(this.data)); } catch (e) { }

            if (APP.user) {
                const leaderboardEntry = {
                    name: APP.user.displayName,
                    photoURL: APP.user.photoURL,
                    points: this.data.points,
                    equipped: this.data.equipped || { border: 'none' }
                };
                set(ref(db, 'leaderboard/' + this.uid), leaderboardEntry);
            }
        } else {
            localStorage.setItem('studySmartData', JSON.stringify(this.data));
        }
        APP.updatePointsUI();
    },

    updatePoints(amount) {
        this.data.points = (this.data.points || 0) + amount;
        this.save();
        const msg = amount > 0 ? `+${amount} Points!` : `${amount} Points`;
        APP.showToast(msg, amount > 0 ? 'success' : 'info');
    },

    applyTheme() {
        const theme = this.data.equipped?.theme || this.data.userPrefs.theme || 'light';
        document.body.setAttribute('data-theme', theme);
        const toggle = document.getElementById('theme-toggle');
        if (toggle) toggle.checked = theme !== 'light';
    },

    reset() {
        this.data = {
            subjects: [],
            schedule: [],
            tasks: [],
            userPrefs: { theme: 'light' },
            points: 0
        };
        this.save();
        APP.render();
        APP.showToast('All data has been reset.', 'info');
    },

    exportData() {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.data));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "study_planner_backup.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }
};




const APP = {
    dom: {},
    currentSaveAction: null,
    user: null,

    init() {
        this.cacheDOM();
        this.initToasts();
        this.bindEvents();
        this.initAuth();
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
            authContainer: document.getElementById('auth-container'),
            userInfo: document.getElementById('user-info'),
            userAvatar: document.getElementById('user-avatar'),
            userName: document.getElementById('user-name'),
            btnLogin: document.getElementById('btn-login'),
            btnLogout: document.getElementById('btn-logout'),
        };
    },

    initAuth() {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                this.user = user;
                this.updateAuthUI(true);
                this.showToast(`Welcome back, ${user.displayName.split(' ')[0]}!`, 'success');
                DATA_STORE.load(user.uid);
                this.listenForInvites();
            } else {
                this.user = null;
                this.updateAuthUI(false);
                DATA_STORE.load(null);
            }
        });
    },

    listenForInvites() {
        if (!this.user) return;
        const invitesRef = ref(db, 'invites/' + this.user.uid);
        onValue(invitesRef, (snapshot) => {
            const invite = snapshot.val();
            if (invite) {
                this.showInvitePopup(invite);
            }
        });
    },

    showInvitePopup(invite) {
        const existing = document.getElementById('invite-popup');
        if (existing) existing.remove();

        const popup = document.createElement('div');
        popup.id = 'invite-popup';
        popup.className = 'invite-popup';
        popup.innerHTML = `
            <div class="invite-header">
                <span class="pulse-ring"></span>
                <span>Study Invitation!</span>
            </div>
            <p><strong>${invite.senderName}</strong> invited you to a study room.</p>
            <div class="invite-actions">
                <button class="btn btn-success btn-sm" id="btn-accept-invite">Accept & Join</button>
                <button class="btn btn-secondary btn-sm" id="btn-decline-invite">Decline</button>
            </div>
        `;
        document.body.appendChild(popup);

        document.getElementById('btn-accept-invite').onclick = () => {
            window.open(invite.roomLink, '_blank');
            set(ref(db, 'invites/' + this.user.uid), null);
            popup.remove();
        };

        document.getElementById('btn-decline-invite').onclick = () => {
            set(ref(db, 'invites/' + this.user.uid), null);
            popup.remove();
        };
    },

    updateAuthUI(isSignedIn) {
        if (isSignedIn) {
            this.dom.authContainer.style.display = 'none';
            this.dom.userInfo.style.display = 'flex';
            this.dom.userAvatar.src = this.user.photoURL;
            this.dom.userName.textContent = this.user.displayName;
        } else {
            this.dom.userInfo.style.display = 'none';
            this.dom.authContainer.style.display = 'flex';
        }
    },



    initToasts() {
        if (!document.getElementById('toast-container')) {
            const container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }
        this.dom.toastContainer = document.getElementById('toast-container');
    },


    timer: {
        timeLeft: 25 * 60,
        isRunning: false,
        intervalId: null
    },

    playSound(type = 'success') {
        let soundFile = '';
        const equippedSound = DATA_STORE.data.equipped?.sound || 'default';

        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        let freq = 440;
        let typeWave = 'sine';
        let duration = 0.1;

        if (equippedSound === 'retro') {
            typeWave = 'square';
            freq = 600;
            oscillator.frequency.setValueAtTime(600, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
        } else if (equippedSound === 'zen') {
            typeWave = 'sine';
            freq = 300;
            duration = 1.5;
            gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.5);
        } else if (equippedSound === 'level-up') {
            typeWave = 'triangle';
            const now = audioCtx.currentTime;
            [440, 554, 659, 880].forEach((f, i) => {
                const osc = audioCtx.createOscillator();
                const gn = audioCtx.createGain();
                osc.type = 'triangle';
                osc.frequency.value = f;
                osc.connect(gn);
                gn.connect(audioCtx.destination);
                osc.start(now + i * 0.1);
                osc.stop(now + i * 0.1 + 0.2);
                gn.gain.setValueAtTime(0.1, now + i * 0.1);
                gn.gain.linearRampToValueAtTime(0, now + i * 0.1 + 0.2);
            });
            return;
        } else {
            freq = 800;
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        }

        if (equippedSound !== 'level-up') {
            oscillator.type = typeWave;
            if (equippedSound !== 'retro') oscillator.frequency.value = freq;

            oscillator.start();
            oscillator.stop(audioCtx.currentTime + duration);
        }
    },

    toggleTimer() {
        const btn = document.getElementById('btn-timer-toggle');

        if (this.timer.isRunning) {

            clearInterval(this.timer.intervalId);
            this.timer.isRunning = false;
            btn.textContent = 'Start Focus';
            btn.classList.replace('btn-danger', 'btn-primary');
        } else {

            this.timer.isRunning = true;
            btn.textContent = 'Pause Focus';
            btn.classList.replace('btn-primary', 'btn-danger');

            this.timer.intervalId = setInterval(() => {
                if (this.timer.timeLeft > 0) {
                    this.timer.timeLeft--;
                    this.updateTimerDisplay();
                } else {
                    this.toggleTimer();
                    this.showToast('Pomodoro session completed! Take a break.', 'success');
                    this.playSound();
                    DATA_STORE.updatePoints(50);
                    this.timer.timeLeft = 25 * 60;
                    this.updateTimerDisplay();
                }
            }, 1000);
        }
    },

    resetTimer() {
        if (this.timer.isRunning) this.toggleTimer();
        this.timer.timeLeft = 25 * 60;
        this.updateTimerDisplay();
    },

    updateTimerDisplay() {
        const m = Math.floor(this.timer.timeLeft / 60);
        const s = this.timer.timeLeft % 60;
        const display = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        document.getElementById('timer-display').textContent = display;
    },

    showToast(message, type = 'info') {
        if (!this.dom.toastContainer) this.initToasts();

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '✅',
            error: '❌',
            info: 'ℹ️',
            warning: '⚠️'
        };

        toast.innerHTML = `
            <span class="icon">${icons[type] || icons.info}</span>
            <span>${message}</span>
        `;

        this.dom.toastContainer.appendChild(toast);

        const timeout = setTimeout(() => {
            removeToast();
        }, 3000);

        const removeToast = () => {
            toast.style.animation = 'fadeOut 0.3s ease-out forwards';
            toast.addEventListener('animationend', () => {
                if (toast.parentElement) toast.remove();
            });
        };

        toast.addEventListener('click', () => {
            clearTimeout(timeout);
            removeToast();
        });
    },

    bindEvents() {
        this.dom.btnLogin.addEventListener('click', () => {
            signInWithPopup(auth, provider).catch((error) => {
                this.showToast('Login failed: ' + error.message, 'error');
            });
        });

        this.dom.btnLogout.addEventListener('click', () => {
            signOut(auth).then(() => {
                this.showToast('Logged out successfully.', 'info');
            }).catch((error) => {
                this.showToast('Logout failed: ' + error.message, 'error');
            });
        });

        this.dom.navLinks.forEach(link => {
            link.addEventListener('click', () => {
                this.navTo(link.dataset.section);
            });
        });

        setInterval(() => this.updateDate, 60000);

        this.dom.themeToggle.addEventListener('change', () => {
            const theme = this.dom.themeToggle.checked ? 'dark' : 'light';
            document.body.setAttribute('data-theme', theme);
            DATA_STORE.data.userPrefs.theme = theme;
            DATA_STORE.save();
        });


        document.getElementById('btn-export').addEventListener('click', () => {
            DATA_STORE.exportData();
        });

        document.getElementById('btn-reset').addEventListener('click', () => {
            if (confirm('Are you sure you want to reset all data? This cannot be undone.')) {
                DATA_STORE.reset();
            }
        });

        document.getElementById('btn-timer-toggle').addEventListener('click', () => {
            this.toggleTimer();
        });

        document.getElementById('btn-timer-reset').addEventListener('click', () => {
            this.resetTimer();
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

        document.getElementById('btn-start-room').addEventListener('click', () => {
            this.startStudyRoom();
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
            case 'shop':
                this.renderShop('themes');
                break;
            case 'tasks':
                this.renderTasks();
                break;
            case 'analytics':
                this.renderAnalytics();
                break;
            case 'settings':
                this.updatePointsUI();
                break;
            case 'leaderboard':
                this.renderLeaderboard();
                break;
            case 'study-saathi':
                this.renderStudySaathi();
                break;
        }
    },

    renderStudySaathi() {
        const list = document.getElementById('saathi-list');
        list.innerHTML = '<p>Loading active learners...</p>';

        const usersRef = ref(db, 'leaderboard');
        onValue(usersRef, (snapshot) => {
            const data = snapshot.val();
            list.innerHTML = '';

            if (!data) {
                list.innerHTML = '<p>No users found yet.</p>';
                return;
            }

            const users = Object.keys(data).map(key => ({
                uid: key,
                ...data[key]
            }));

            users.forEach(u => {
                if (this.user && u.uid === this.user.uid) return;

                const card = document.createElement('div');
                card.className = 'saathi-user-card';

                // Find border class
                let borderClass = '';
                if (u.equipped && u.equipped.border) {
                    const borderItem = SHOP_ITEMS.borders.find(b => b.id === u.equipped.border);
                    if (borderItem) borderClass = borderItem.previewClass;
                }

                card.innerHTML = `
                    <div style="position:relative; display:inline-block;">
                        <img src="${u.photoURL || 'https://ui-avatars.com/api/?name=' + u.name}" style="width:50px;height:50px;border-radius:50%;" class="${borderClass}">
                        <div class="pulse-ring" style="position:absolute;bottom:0;right:0;width:12px;height:12px;border:2px solid var(--card-bg);"></div>
                    </div>
                    <h4>${u.name}</h4>
                    <p style="font-size:0.8rem; color:var(--secondary-text); margin-bottom:1rem;">Ready to study!</p>
                    <button class="btn btn-sm btn-primary btn-invite" data-uid="${u.uid}" data-name="${u.name}">Invite 📩</button>
                `;
                list.appendChild(card);
            });

            if (list.children.length === 0) {
                list.innerHTML = '<p>No other learners online right now.</p>';
            }


            document.querySelectorAll('.btn-invite').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    this.inviteUser(e.target.dataset.uid, e.target.dataset.name);
                });
            });
        }, { onlyOnce: true });
    },

    renderShop(tab = 'themes') {
        const grid = document.getElementById('shop-items');
        grid.innerHTML = '';

        document.getElementById('shop-user-points').textContent = `You: ${DATA_STORE.data.points} pts`;

        document.querySelectorAll('[data-shop-tab]').forEach(btn => {
            if (btn.dataset.shopTab === tab) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        const items = SHOP_ITEMS[tab];
        if (!items) return;

        items.forEach(item => {
            const owned = DATA_STORE.data.inventory.includes(item.id);
            const key = tab.slice(0, -1);
            const equipped = DATA_STORE.data.equipped[key] === item.id;

            const card = document.createElement('div');
            card.className = 'shop-item-card';

            let actionBtn = '';
            if (equipped) {
                actionBtn = `<button class="btn btn-success btn-sm" disabled>Equipped</button>`;
            } else if (owned) {
                actionBtn = `<button class="btn btn-secondary btn-sm btn-equip" data-cat="${tab}" data-id="${item.id}">Equip</button>`;
            } else {
                actionBtn = `<button class="btn btn-primary btn-sm btn-buy" data-cat="${tab}" data-id="${item.id}" data-price="${item.price}">Buy</button>`;
            }

            let previewHTML = '';
            if (tab === 'themes') {
                previewHTML = `<div class="shop-item-preview ${item.previewClass}">Aa</div>`;
            } else if (tab === 'borders') {
                previewHTML = `<div class="shop-item-preview"><img src="${this.user ? this.user.photoURL : 'https://ui-avatars.com/api/?name=User'}" class="${item.previewClass}" style="width:48px;height:48px;border-radius:50%;"></div>`;
            } else {
                previewHTML = `<div class="shop-item-preview">🎵</div>`;
            }

            card.innerHTML = `
                ${previewHTML}
                <div style="font-weight:600;">${item.name}</div>
                <div class="shop-item-price">${item.price === 0 ? 'Free' : item.price + ' pts'}</div>
                ${actionBtn}
            `;
            grid.appendChild(card);
        });

        // Attach events
        grid.querySelectorAll('.btn-buy').forEach(btn => {
            btn.addEventListener('click', () => {
                this.buyItem(btn.dataset.id, parseInt(btn.dataset.price), btn.dataset.cat);
            });
        });

        grid.querySelectorAll('.btn-equip').forEach(btn => {
            btn.addEventListener('click', () => {
                this.equipItem(btn.dataset.id, btn.dataset.cat);
            });
        });

        // Tab events
        document.querySelectorAll('[data-shop-tab]').forEach(btn => {
            btn.onclick = () => this.renderShop(btn.dataset.shopTab);
        });
    },

    buyItem(id, price, category) {
        if (DATA_STORE.data.points >= price) {
            DATA_STORE.updatePoints(-price);
            DATA_STORE.data.inventory.push(id);
            DATA_STORE.save();
            this.showToast('Item Purchased!', 'success');
            this.renderShop(category);
        } else {
            this.showToast(`Not enough points! Need ${price - DATA_STORE.data.points} more.`, 'error');
        }
    },

    equipItem(id, category) {
        const key = category.slice(0, -1);
        DATA_STORE.data.equipped[key] = id;

        if (key === 'theme') {
            DATA_STORE.data.userPrefs.theme = id;
            DATA_STORE.applyTheme();
        }

        DATA_STORE.save();
        this.showToast('Equipped!', 'success');
        this.renderShop(category);
    },

    activeRoomLink: null,

    startStudyRoom() {
        if (!this.user) return this.showToast('Please login to start a room', 'error');

        const btn = document.getElementById('btn-start-room');


        if (this.activeRoomLink) {

            this.activeRoomLink = null;
            btn.textContent = '🎥 Start Study Room';
            btn.classList.replace('btn-danger', 'btn-primary');
            DATA_STORE.updatePoints(10);
            this.showToast('Session Ended. +10 Points!', 'success');
            return;
        }


        window.open('https://meet.google.com/new', '_blank');

        const formHTML = `
            <div class="form-group">
                <label>Paste the Google Meet Link you just created:</label>
                <input type="text" id="input-meet-link" class="form-control" placeholder="https://meet.google.com/...">
            </div>
            <p style="font-size: 0.9rem; color: var(--secondary-text);">
                1. A Google Meet tab has been opened.<br>
                2. Copy the meeting link.<br>
                3. Paste it here to invite friends.
            </p>
        `;

        this.openModal('Start Study Room', formHTML);

        this.currentSaveAction = () => {
            const link = document.getElementById('input-meet-link').value;
            if (!link) return this.showToast('Please paste the link', 'error');

            this.activeRoomLink = link;
            btn.textContent = '⏹ End Session';
            btn.classList.replace('btn-primary', 'btn-danger');

            this.showToast('Room Active! Invite friends now.', 'success');
            this.closeModal();
        };
    },

    inviteUser(uid, name) {
        if (!this.activeRoomLink) {
            return this.showToast('Please "Start Study Room" first!', 'warning');
        }

        const inviteData = {
            senderId: this.user.uid,
            senderName: this.user.displayName,
            roomLink: this.activeRoomLink,
            timestamp: Date.now()
        };

        set(ref(db, 'invites/' + uid), inviteData)
            .then(() => this.showToast(`Invited ${name}!`, 'success'))
            .catch(e => this.showToast('Failed to invite: ' + e.message, 'error'));
    },

    updatePointsUI() {
        const points = DATA_STORE.data.points || 0;
        const badge = document.getElementById('current-user-points');
        if (badge) badge.textContent = `You: ${points} pts`;
    },

    renderLeaderboard() {
        this.updatePointsUI();
        const list = document.getElementById('leaderboard-list');
        list.innerHTML = '<tr><td colspan="3" style="text-align:center;">Loading...</td></tr>';


        const leaderboardRef = ref(db, 'leaderboard');


        onValue(leaderboardRef, (snapshot) => {
            const data = snapshot.val();
            list.innerHTML = '';

            if (!data) {
                list.innerHTML = '<tr class="empty-state"><td colspan="3">No champions yet. Be the first!</td></tr>';
                return;
            }


            const users = Object.keys(data).map(key => ({
                uid: key,
                ...data[key]
            }));


            users.sort((a, b) => b.points - a.points);

            users.forEach((user, index) => {
                const isCurrentUser = this.user && this.user.uid === user.uid;
                const tr = document.createElement('tr');
                if (isCurrentUser) tr.className = 'current-user-row';

                // Find border class
                let borderClass = '';
                if (user.equipped && user.equipped.border) {
                    const borderItem = SHOP_ITEMS.borders.find(b => b.id === user.equipped.border);
                    if (borderItem) borderClass = borderItem.previewClass;
                }

                tr.innerHTML = `
                    <td><span class="rank-badge">#${index + 1}</span></td>
                    <td>
                        <div class="student-info">
                            <img src="${user.photoURL || 'https://ui-avatars.com/api/?name=' + user.name}" class="student-avatar ${borderClass}" alt="Avatar">
                            <span>${user.name} ${isCurrentUser ? '(You)' : ''}</span>
                        </div>
                    </td>
                    <td style="text-align: right; font-weight: bold; color: var(--primary-color);">${user.points.toLocaleString()} pts</td>
                `;
                list.appendChild(tr);
            });
        });
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
                <select id="input-subject-priority" class="form-select">
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

            if (!name) return this.showToast('Please enter a subject name', 'error');

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
                <select id="input-subject-priority" class="form-select">
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

            if (!name) return this.showToast('Please enter a subject name', 'error');

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
            return this.showToast('Please add subjects before creating a schedule.', 'info');
        }

        const subjectOptions = DATA_STORE.data.subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

        const formHTML = `
            <div class="form-group">
                <label>Subject</label>
                <select id="input-slot-subject" class="form-select">
                    ${subjectOptions}
                </select>
            </div>
            <div class="form-group">
                <label>Day</label>
                <select id="input-slot-day" class="form-select">
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

            if (!start || !end) return this.showToast('Please select start and end times.', 'error');
            if (start >= end) return this.showToast('Start time must be before end time.', 'error');

            const conflict = DATA_STORE.data.schedule.find(s =>
                s.day === day &&
                ((start >= s.start && start < s.end) ||
                    (end > s.start && end <= s.end) ||
                    (start <= s.start && end >= s.end))
            );

            if (conflict) {
                return this.showToast('Time conflict with an existing class!', 'error');
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
            return this.showToast('Please add subjects first.', 'info');
        }

        const subjectOptions = DATA_STORE.data.subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

        const formHTML = `
            <div class="form-group">
                <label>Title</label>
                <input type="text" id="input-task-title" class="form-control" placeholder="Assignment 1">
            </div>
            <div class="form-group">
                <label>Subject</label>
                <select id="input-task-subject" class="form-select">
                    ${subjectOptions}
                </select>
            </div>
            <div class="form-group">
                <label>Type</label>
                <select id="input-task-type" class="form-select">
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

            if (!title || !dueDate) return this.showToast('Please fill in all fields.', 'error');

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

            // Points Logic
            if (task.isCompleted) {
                // Award points
                const subject = DATA_STORE.data.subjects.find(s => s.id === task.subjectId);
                let points = 10;
                if (subject && subject.priority === 'High') points = 20;
                DATA_STORE.updatePoints(points);
                APP.playSound(); // Play sound
            } else {
                const subject = DATA_STORE.data.subjects.find(s => s.id === task.subjectId);
                let points = 10;
                if (subject && subject.priority === 'High') points = 20;
                DATA_STORE.updatePoints(-points);
            }

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

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => APP.init());
} else {
    APP.init();
}