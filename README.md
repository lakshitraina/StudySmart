# 📚 Smart Study Planner

> **Your intelligent companion for academic success.** 🚀  
> Organize your subjects, schedule, tasks, and study sessions in one powerful, gamified dashboard.

[![Live Demo](https://img.shields.io/badge/Live-Demo-brightgreen?style=for-the-badge&logo=netlify)](https://study-smartt.netlify.app)
[![GitHub Repo](https://img.shields.io/badge/GitHub-Repository-blue?style=for-the-badge&logo=github)](https://github.com/lakshitraina/StudySmart)
![Firebase](https://img.shields.io/badge/Firebase-039BE5?style=for-the-badge&logo=Firebase&logoColor=orange)

## ✨ Key Features

### 🎓 Dashboard & Analytics
-   **Smart Summary**: Get a quick overview of total subjects, pending tasks, and upcoming exams.
-   **Today's Schedule**: Automatically filters your weekly timetable to show classes for the current day.
-   **Progress Tracking**: Visualize your task completion rates and study consistency.

### 📅 Schedule Planner
-   **Visual Timetable**: Create a color-coded weekly schedule for all your classes.
-   **Conflict Detection**: Smart system warns you if you try to book two classes at the same time.
-   **Day Filtering**: View your entire week or focus on a specific day.

### ✅ Task & Exam Manager
-   **Priority Organizing**: Tag tasks as High, Medium, or Low priority.
-   **Deadline Alerts**: Never miss an assignment or exam date.
-   **Exam Specifics**: Distinguish between regular homework and critical exams.

### 🍅 Focus & Gamification
-   **Pomodoro Timer**: Built-in 25-minute focus timer to boost productivity.
-   **Points System**: Earn points for completing tasks, finishing focus sessions, and hosting study rooms.
-   **Leaderboard**: 🏆 Compete with other students to see who is the most dedicated learner.

### 🤝 Study Saathi (Collaborative Study)
-   **Find Partners**: See a real-time list of other active students looking to study.
-   **Instant Study Rooms**: Launch a Google Meet room directly from the app.
-   **Live Invites**: Send instant pop-up invitations to friends to join your session.
-   **Earn Rewards**: Get bonus points for hosting group study sessions!

### ⚙️ Customization & Tech
-   **Cloud Sync**: Powered by **Firebase** (Realtime Database & Auth) so your data is safe and syncs across devices.
-   **Theme Toggle**: Switch between **Light Mode** ☀️ and **Dark Mode** 🌙.
-   **Responsive Design**: Works perfectly on Desktop, Tablet, and Mobile.
-   **Offline Capable**: Critical data is cached locally for instant loading.

---

## 🛠️ Tech Stack

-   **Frontend**: HTML5, CSS3, JavaScript (ES6+)
-   **Backend / Database**: Google Firebase (Authentication & Realtime Database)
-   **Hosting**: Netlify
-   **Design**: Modern UI with Glassmorphism elements and smooth transitions.

---

## 🚀 How to Run Locally

If you want to run this project on your own machine:

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/lakshitraina/StudySmart.git
    cd StudySmart
    ```

2.  **Serve the files**:
    Since this project uses ES6 Modules and Firebase, you must run it on a local server (opening `index.html` directly won't work).
    
    *   **Using Python (Recommended)**:
        ```bash
        python -m http.server
        ```
    *   **Using Node.js**:
        ```bash
        npx serve
        ```
    *   **Using VS Code**:
        Install the "Live Server" extension and click "Go Live".

3.  **Open in Browser**:
    Visit `http://localhost:8000` (or the port shown in your terminal).

---

## 🔒 Privacy & Data

-   **Secure Login**: Uses Google Sign-In for secure and password-less authentication.
-   **Personal Data**: Your tasks, schedule, and subjects are private to you.
-   **Public Data**: Only your Name, Photo, and Rank Points are visible on the Leaderboard and Study Saathi list.

---

Made with ❤️ by [Lakshit Raina](https://github.com/lakshitraina)
