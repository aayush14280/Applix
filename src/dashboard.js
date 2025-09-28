// dashboard.js - FULLY CORRECTED AND MERGED

import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  addDoc,
  deleteDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyAy9Pt5ZFPSt3JZa1BJgJnb_m2xFwd6v7A",
  authDomain: "applix-491f9.firebaseapp.com",
  projectId: "applix-491f9",
  storageBucket: "applix-491f9.appspot.com",
  messagingSenderId: "554364657413",
  appId: "1:554364657413:web:bdccf9d500d8187c0ca16c",
};

// --- Initialize Firebase and Services ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

class ApplixDashboard {
  constructor() {
    this.currentSection = "overview";
    this.calendarDate = new Date(); // State for the calendar
    this.data = {
      profile: {
        experience: [], // Initialize as arrays
        education: [],  // Initialize as arrays
      },
      jobs: [],
      applications: [],
      reminders: [],
      settings: {
        autoScan: true,
        floatingButton: true,
        browserNotifications: true,
        reminderTime: 60,
      },
    };
    this.firebaseUser = null;
    this.init();
  }

  async init() {
    this.bindEvents();
    this.checkAuthState(); // Auth state will trigger initial data load
  }

  // Authentication handling
  checkAuthState() {
    onAuthStateChanged(auth, (user) => {
      this.firebaseUser = user;
      if (user) {
        console.log("User is logged in on dashboard:", user.email);
        document.getElementById("user-name").textContent =
          user.displayName || user.email;
        if (user.photoURL) {
          document.getElementById("user-avatar").src = user.photoURL;
        }
        this.loadUserData(user.uid);
      } else {
        console.log("User is not logged in on dashboard.");
        this.loadDemoData();
        document.getElementById("user-name").textContent = "User Name";
        document.getElementById("user-avatar").src =
          "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiNFNUU3RUIiLz4KPHBhdGggZD0iTTE2IDhDMTguMjEgOCAyMCA5Ljc5IDIwIDEyQzIwIDE0LjIxIDE4LjIxIDE2IDE2IDE2QzEzLjc5IDE2IDEyIDE0LjIxIDEyIDEyQzEyIDkuNzkgMTMuNzkgOCAxNiA4Wk0xNiAyNkMxMi42NyAyNiAxMCAyNC4zMSAxMCAyMi4yNUMxMCAyMC4xOSAxMi42NyAxOCAxNiAxOEMxOS4zMyAxOCAyMiAyMC4xOSAyMiAyMi4yNUMyMiAyNC4zMSAxOS4zMyAyNiAxNiAyNloiIGZpbGw9IiM5Q0EzQUYiLz4KPC9zdmc+";
      }
    });
  }

  async loadUserData(userId) {
    try {
      const userDocRef = doc(db, "users", userId);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        const userData = userDoc.data();
        this.data.profile = { ...this.data.profile, ...(userData.profile || {}) };
        this.data.settings = { ...this.data.settings, ...(userData.settings || {}) };

        if (this.data.profile) {
          chrome.storage.local.set({ userProfile: this.data.profile }, () => {
            console.log("Profile synced to local storage for content script.");
          });
        }
        
        this.loadProfileDataToForm();
      }

      const jobsQuery = query(collection(db, 'users', userId, 'savedJobs'), orderBy('dateSaved', 'desc'));
      const jobsSnapshot = await getDocs(jobsQuery);
      this.data.jobs = jobsSnapshot.docs.map(d => ({ id: d.id, ...d.data(), dateSaved: d.data().dateSaved?.toDate() || new Date() }));

      const appsQuery = query(collection(db, 'users', userId, 'applications'), orderBy('dateApplied', 'desc'));
      const appsSnapshot = await getDocs(appsQuery);
      this.data.applications = appsSnapshot.docs.map(d => ({ id: d.id, ...d.data(), dateApplied: d.data().dateApplied?.toDate() || new Date() }));

      const remindersQuery = query(collection(db, 'users', userId, 'reminders'), orderBy('date', 'asc'));
      const remindersSnapshot = await getDocs(remindersQuery);
      this.data.reminders = remindersSnapshot.docs.map(d => ({ id: d.id, ...d.data(), date: d.data().date?.toDate() || new Date() }));

      this.loadSettings();
      this.showSection('overview');
      this.showNotification('Data loaded successfully!', 'success');
    } catch (error) {
      console.error('Error loading user data:', error);
      this.showNotification('Error loading data. Using demo data instead.', 'error');
      this.loadDemoData();
    }
  }

  loadSettings() {
    document.getElementById("auto-scan-toggle").checked =
      this.data.settings.autoScan;
    document.getElementById("floating-btn-toggle").checked =
      this.data.settings.floatingButton;
    document.getElementById("browser-notif-toggle").checked =
      this.data.settings.browserNotifications;
    document.getElementById("reminder-time-select").value =
      this.data.settings.reminderTime;
    console.log("Settings loaded into UI.");
  }

  generateDemoApplications() {
    return [
      { id: 'demo1', company: 'Innovate Inc.', position: 'Frontend Developer', dateApplied: new Date(), status: 'pending', url: '#', notes: 'First round call scheduled.' },
      { id: 'demo2', company: 'Creative Solutions', position: 'UX Designer', dateApplied: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), status: 'interview', url: '#', notes: 'Portfolio review next week.' }
    ];
  }
  
  generateDemoJobs() {
    return [
      { id: 'job1', company: 'Data Systems', title: 'Backend Engineer', dateSaved: new Date() },
    ];
  }

  generateDemoReminders() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    return [
      { id: 'rem1', title: 'Follow up with Innovate Inc.', date: tomorrow, type: 'followup', notes: 'Send a follow-up email regarding the application status.' }
    ];
  }
  
  loadProfileDataToForm() {
    if(!this.data.profile || !document.getElementById('profile-form')) return;
    
    // Load simple key-value fields
    for (const [key, value] of Object.entries(this.data.profile)) {
        // Skip array fields, they are handled below
        if (Array.isArray(value)) continue; 
        const input = document.querySelector(`[name="${key}"]`);
        if (input) {
            input.value = value;
        }
    }
    
    // Load dynamic experience entries
    const expContainer = document.getElementById('experience-container');
    expContainer.innerHTML = ''; // Clear existing
    if(this.data.profile.experience && Array.isArray(this.data.profile.experience)) {
      this.data.profile.experience.forEach(exp => this.addExperienceEntry(exp));
    }
    
    // Load dynamic education entries
    const eduContainer = document.getElementById('education-container');
    eduContainer.innerHTML = ''; // Clear existing
    if(this.data.profile.education && Array.isArray(this.data.profile.education)) {
      this.data.profile.education.forEach(edu => this.addEducationEntry(edu));
    }
  }

  loadDemoData() {
    this.data.applications = this.generateDemoApplications();
    this.data.jobs = this.generateDemoJobs();
    this.data.reminders = this.generateDemoReminders();
    this.showSection("overview");
  }

  bindEvents() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => this.showSection(e.currentTarget.dataset.target));
    });
    document.querySelectorAll('.view-all').forEach(link => {
      link.addEventListener('click', (e) => { e.preventDefault(); this.showSection(e.currentTarget.dataset.target); });
    });
    document.getElementById('prev-month')?.addEventListener('click', () => this.changeMonth(-1));
    document.getElementById('next-month')?.addEventListener('click', () => this.changeMonth(1));
    document.querySelector('.search-input')?.addEventListener('input', (e) => this.handleSearch(e.target.value));
    document.querySelectorAll('.switch input').forEach(toggle => {
      toggle.addEventListener('change', (e) => this.updateSetting(e.target.id, e.target.checked));
    });
    document.getElementById('reminder-time-select')?.addEventListener('change', (e) => this.updateSetting('reminderTime', parseInt(e.target.value)));
    document.getElementById('logout-btn')?.addEventListener('click', () => this.handleLogout());

    // Application Modal Events
    document.getElementById("application-form")?.addEventListener("submit", (e) => { e.preventDefault(); this.saveApplication(); });
    document.getElementById("add-application-btn")?.addEventListener("click", () => this.openApplicationModal());
    document.getElementById('cancel-application-btn')?.addEventListener('click', () => this.closeApplicationModal());
    document.getElementById('modal-close-btn')?.addEventListener('click', () => this.closeApplicationModal());
    document.getElementById('delete-in-modal-btn')?.addEventListener('click', (e) => {
        const appId = document.getElementById('app-id').value;
        if (appId) {
            this.closeApplicationModal();
            this.deleteApplication(appId);
        }
    });

    // Reminder Modal Events
    document.getElementById('add-reminder-btn')?.addEventListener('click', () => this.openReminderModal());
    document.getElementById('reminder-form')?.addEventListener('submit', (e) => { e.preventDefault(); this.saveReminder(); });
    document.getElementById('cancel-reminder-btn')?.addEventListener('click', () => this.closeReminderModal());
    document.getElementById('reminder-modal-close-btn')?.addEventListener('click', () => this.closeReminderModal());
    
    // Profile, Data, etc.
    document.getElementById('profile-form')?.addEventListener('submit', (e) => { e.preventDefault(); this.saveProfile(); });
    document.getElementById('add-experience-btn')?.addEventListener('click', () => this.addExperienceEntry());
    document.getElementById('add-education-btn')?.addEventListener('click', () => this.addEducationEntry());
    document.getElementById('import-data-btn')?.addEventListener('click', () => this.importData());
    document.getElementById('export-data-btn')?.addEventListener('click', () => this.exportData());
    document.getElementById('refresh-btn')?.addEventListener('click', () => this.refreshData());
    document.getElementById('clear-data-btn')?.addEventListener('click', () => this.clearAllData());
    
    // Event Delegation for dynamic content
    document.getElementById('reminders-list')?.addEventListener('click', (e) => {
      const editBtn = e.target.closest('.edit-reminder-btn');
      const deleteBtn = e.target.closest('.delete-reminder-btn');
      if (editBtn) this.openReminderModal(editBtn.dataset.id);
      if (deleteBtn) this.deleteReminder(deleteBtn.dataset.id);
    });

    // Event delegation for removing profile entries
    document.getElementById('experience-container')?.addEventListener('click', (e) => {
        if(e.target.closest('.remove-entry-btn')) {
            e.target.closest('.profile-entry').remove();
        }
    });

    document.getElementById('education-container')?.addEventListener('click', (e) => {
        if(e.target.closest('.remove-entry-btn')) {
            e.target.closest('.profile-entry').remove();
        }
    });


    const jobsContainer = document.getElementById('jobs-container');
    if (jobsContainer) {
      jobsContainer.addEventListener('click', (e) => {
        if (e.target.matches('.remove-job-btn')) {
          this.removeJob(e.target.dataset.id);
        }
      });
    }

    document.getElementById('applications-container')?.addEventListener('click', (e) => {
        const updateButton = e.target.closest('.update-app-btn');
        if (updateButton) {
            this.openApplicationModal(updateButton.dataset.id);
        }
    });

    // Filters
    document.getElementById('application-filter')?.addEventListener('change', () => this.renderApplications());
    document.getElementById('job-filter')?.addEventListener('change', () => this.renderJobs());
    document.getElementById('job-sort')?.addEventListener('change', () => this.renderJobs());
  }

  showSection(sectionId) {
    document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
    document.getElementById(sectionId)?.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
      if (item.dataset.target === sectionId) item.classList.add('active');
    });
    this.currentSection = sectionId;

    switch (sectionId) {
        case 'overview':
            this.updateStats();
            this.renderRecentActivities();
            this.renderUpcomingEvents();
            break;
        case 'jobs':
            this.renderJobs();
            break;
        case 'applications':
            this.renderApplications();
            break;
        case 'calendar':
            this.renderCalendar();
            this.renderUpcomingReminders();
            break;
    }
  }
  
  updateStats() {
    document.getElementById('total-applications').textContent = this.data.applications.length;
    document.getElementById('saved-jobs-count').textContent = this.data.jobs.length;
    const now = new Date();
    const upcomingInterviews = this.data.reminders.filter(
      r => r.type === 'interview' && new Date(r.date) > now
    ).length;
    document.getElementById('upcoming-interviews').textContent = upcomingInterviews;
    const responsesReceived = this.data.applications.filter(
      app => ['interview', 'offer', 'rejected'].includes(app.status)
    ).length;
    const responseRate = this.data.applications.length > 0
      ? Math.round((responsesReceived / this.data.applications.length) * 100)
      : 0;
    document.getElementById('response-rate').textContent = `${responseRate}%`;
  }

  renderRecentActivities() {
    const container = document.getElementById('activities-list');
    if (!container) return;
    const activities = [
        ...this.data.applications.map(app => ({ type: 'application', message: `Applied to ${app.company} for ${app.position}`, date: new Date(app.dateApplied) })),
        ...this.data.jobs.map(job => ({ type: 'job', message: `Saved job: ${job.title} at ${job.company}`, date: new Date(job.dateSaved) }))
    ].sort((a, b) => b.date - a.date).slice(0, 5);

    container.innerHTML = '';
    if (activities.length === 0) {
      container.innerHTML = '<li class="empty-state">No recent activities yet</li>';
      return;
    }
    activities.forEach(activity => {
      const li = document.createElement('li');
      li.innerHTML = `<p>${activity.message}</p><span class="date">${activity.date.toLocaleDateString()}</span>`;
      container.appendChild(li);
    });
  }

  renderUpcomingEvents() {
    const container = document.getElementById('events-list');
    if (!container) return;
    const now = new Date();
    const upcoming = this.data.reminders.filter(r => new Date(r.date) > now).sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 5);
    
    container.innerHTML = '';
    if (upcoming.length === 0) {
      container.innerHTML = '<li class="empty-state">No upcoming events</li>';
      return;
    }
    upcoming.forEach(event => {
      const li = document.createElement('li');
      const eventDate = new Date(event.date);
      li.innerHTML = `<p>${event.title}</p><span class="date">${eventDate.toLocaleDateString()} at ${eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>`;
      container.appendChild(li);
    });
  }

  openApplicationModal(appId = null) {
    const modal = document.getElementById('application-modal');
    const form = document.getElementById('application-form');
    const modalTitle = document.getElementById('modal-title');
    const deleteBtn = document.getElementById('delete-in-modal-btn');
    form.reset();
    document.getElementById('app-id').value = '';

    if (appId) {
        modalTitle.textContent = 'Update Application';
        deleteBtn.style.display = 'inline-block';
        const appData = this.data.applications.find(app => app.id === appId);
        if (appData) {
            document.getElementById('app-id').value = appData.id;
            document.getElementById('app-position').value = appData.position || '';
            document.getElementById('app-company').value = appData.company || '';
            document.getElementById('app-date').value = new Date(appData.dateApplied).toISOString().split('T')[0];
            document.getElementById('app-status').value = appData.status || 'pending';
            document.getElementById('app-url').value = appData.url || '';
            document.getElementById('app-notes').value = appData.notes || '';
        }
    } else {
        modalTitle.textContent = 'Add Application';
        deleteBtn.style.display = 'none';
        document.getElementById('app-date').value = new Date().toISOString().split('T')[0];
    }
    modal.style.display = 'flex';
  }

  closeApplicationModal() {
    const modal = document.getElementById('application-modal');
    modal.style.display = 'none';
    document.getElementById('application-form').reset();
    document.getElementById('app-id').value = '';
  }

  async saveApplication() {
    if (!this.firebaseUser) {
        this.showNotification("Please log in to save an application.", "error");
        return;
    }
    const form = document.getElementById("application-form");
    const formData = new FormData(form);
    const appId = formData.get("appId");

    const applicationData = {
      company: formData.get("company"),
      position: formData.get("position"),
      status: formData.get("status"),
      dateApplied: Timestamp.fromDate(new Date(formData.get("dateApplied"))),
      url: formData.get("url") || "",
      notes: formData.get("notes") || "",
    };

    try {
        if (appId) {
            const appDocRef = doc(db, 'users', this.firebaseUser.uid, 'applications', appId);
            await updateDoc(appDocRef, applicationData);
            const index = this.data.applications.findIndex(app => app.id === appId);
            if (index > -1) {
                this.data.applications[index] = { ...this.data.applications[index], ...applicationData, dateApplied: applicationData.dateApplied.toDate() };
            }
            this.showNotification("Application updated!", "success");
        } else {
            applicationData.createdAt = serverTimestamp();
            const appsCollectionRef = collection(db, 'users', this.firebaseUser.uid, 'applications');
            const docRef = await addDoc(appsCollectionRef, applicationData);
            this.data.applications.unshift({ ...applicationData, id: docRef.id, dateApplied: applicationData.dateApplied.toDate() });
            this.showNotification("Application added!", "success");
        }
        
        this.closeApplicationModal();
        this.renderApplications();
        this.updateStats();
    } catch (error) {
        console.error("Error saving application:", error);
        this.showNotification("Error saving application.", "error");
    }
  }

  async deleteApplication(appId) {
      if (!this.firebaseUser || !appId) return;

      if (!confirm("Are you sure you want to delete this application? This action cannot be undone.")) {
          return;
      }

      try {
          const appDocRef = doc(db, 'users', this.firebaseUser.uid, 'applications', appId);
          await deleteDoc(appDocRef);

          this.data.applications = this.data.applications.filter(app => app.id !== appId);
          this.renderApplications();
          this.updateStats();
          this.showNotification("Application deleted.", "success");
      } catch (error) {
          console.error("Error deleting application:", error);
          this.showNotification("Failed to delete application.", "error");
      }
  }

  openReminderModal(reminderId = null) {
      const modal = document.getElementById('reminder-modal');
      const form = document.getElementById('reminder-form');
      const modalTitle = document.getElementById('reminder-modal-title');
      const saveBtn = document.getElementById('save-reminder-btn');
      form.reset();
      document.getElementById('reminder-id').value = '';

      if (reminderId) {
          const reminder = this.data.reminders.find(r => r.id === reminderId);
          if (!reminder) return;

          modalTitle.textContent = 'Edit Reminder';
          saveBtn.textContent = 'Save Changes';
          document.getElementById('reminder-id').value = reminder.id;
          document.getElementById('reminder-title').value = reminder.title;
          document.getElementById('reminder-type').value = reminder.type;
          
          const reminderDate = new Date(reminder.date);
          document.getElementById('reminder-date').value = reminderDate.toISOString().split('T')[0];
          document.getElementById('reminder-time').value = reminderDate.toTimeString().split(' ')[0].substring(0, 5);
          document.getElementById('reminder-notes').value = reminder.notes || '';
      } else {
          modalTitle.textContent = 'Add New Reminder';
          saveBtn.textContent = 'Save Reminder';
      }
      modal.style.display = 'flex';
  }

  closeReminderModal() {
      const modal = document.getElementById('reminder-modal');
      modal.style.display = 'none';
      document.getElementById('reminder-form').reset();
      document.getElementById('reminder-id').value = '';
  }

  async saveReminder() {
    if (!this.firebaseUser) {
        this.showNotification("Please log in to manage reminders.", "error");
        return;
    }
    const form = document.getElementById('reminder-form');
    const formData = new FormData(form);
    const reminderId = formData.get('reminderId');
    const dateTimeStr = `${formData.get('date')}T${formData.get('time')}`;
    
    const reminderData = {
      title: formData.get('title'),
      date: Timestamp.fromDate(new Date(dateTimeStr)),
      type: formData.get('type'),
      notes: formData.get('notes') || '',
    };

    try {
      if (reminderId) { // Update existing reminder
        const reminderDocRef = doc(db, 'users', this.firebaseUser.uid, 'reminders', reminderId);
        await updateDoc(reminderDocRef, reminderData);
        const index = this.data.reminders.findIndex(r => r.id === reminderId);
        if (index > -1) {
            this.data.reminders[index] = { ...this.data.reminders[index], ...reminderData, date: new Date(dateTimeStr) };
        }
        this.showNotification("Reminder updated!", "success");
      } else { // Add new reminder
        reminderData.createdAt = serverTimestamp();
        const remindersCollectionRef = collection(db, 'users', this.firebaseUser.uid, 'reminders');
        const docRef = await addDoc(remindersCollectionRef, reminderData);
        this.data.reminders.push({ ...reminderData, id: docRef.id, date: new Date(dateTimeStr) });
        this.showNotification("Reminder added!", "success");
      }
      this.closeReminderModal();
      this.renderUpcomingReminders();
      this.renderCalendar();
    } catch (error) {
        console.error("Error saving reminder:", error);
        this.showNotification("Error saving reminder.", "error");
    }
  }

  async deleteReminder(reminderId) {
    if (!this.firebaseUser || !reminderId) return;
    if (!confirm("Are you sure you want to delete this reminder?")) return;

    try {
        const reminderDocRef = doc(db, 'users', this.firebaseUser.uid, 'reminders', reminderId);
        await deleteDoc(reminderDocRef);
        this.data.reminders = this.data.reminders.filter(r => r.id !== reminderId);
        
        if (document.getElementById('reminder-id').value === reminderId) {
          this.closeReminderModal();
        }

        this.renderUpcomingReminders();
        this.renderCalendar();
        this.showNotification("Reminder deleted.", "success");
    } catch (error) {
        console.error("Error deleting reminder:", error);
        this.showNotification("Failed to delete reminder.", "error");
    }
  }

  addExperienceEntry(data = {}) {
    const container = document.getElementById('experience-container');
    const newEntry = document.createElement('div');
    newEntry.className = 'profile-entry';
    newEntry.innerHTML = `
        <button type="button" class="remove-entry-btn" title="Remove Experience">&times;</button>
        <div class="form-row">
            <div class="form-group">
                <label>Job title</label>
                <input type="text" name="jobTitle" value="${data.jobTitle || ''}">
            </div>
            <div class="form-group">
                <label>Company</label>
                <input type="text" name="company" value="${data.company || ''}">
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>From</label>
                <input type="month" name="from" value="${data.from || ''}">
            </div>
            <div class="form-group">
                <label>To</label>
                <input type="month" name="to" value="${data.to || ''}">
            </div>
        </div>
    `;
    container.appendChild(newEntry);
  }

  addEducationEntry(data = {}) {
    const container = document.getElementById('education-container');
    const newEntry = document.createElement('div');
    newEntry.className = 'profile-entry';
    newEntry.innerHTML = `
        <button type="button" class="remove-entry-btn" title="Remove Education">&times;</button>
        <div class="form-row">
            <div class="form-group full-width">
                <label>School or University</label>
                <input type="text" name="school" value="${data.school || ''}">
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Degree</label>
                <input type="text" name="degree" value="${data.degree || ''}">
            </div>
            <div class="form-group">
                <label>Field of study</label>
                <input type="text" name="fieldOfStudy" value="${data.fieldOfStudy || ''}">
            </div>
        </div>
    `;
    container.appendChild(newEntry);
  }

  async saveProfile() {
    if (!this.firebaseUser) {
        this.showNotification("Please log in to save your profile.", "error");
        return;
    }
    const form = document.getElementById("profile-form");
    const formData = new FormData(form);
    const profileData = {};
    
    // Get standard inputs
    for (let [key, value] of formData.entries()) {
      if (value) profileData[key] = value;
    }

    // Get dynamic experience entries
    const experiences = [];
    document.querySelectorAll('#experience-container .profile-entry').forEach(entry => {
        experiences.push({
            jobTitle: entry.querySelector('[name="jobTitle"]').value,
            company: entry.querySelector('[name="company"]').value,
            from: entry.querySelector('[name="from"]').value,
            to: entry.querySelector('[name="to"]').value,
        });
    });
    profileData.experience = experiences;
    
    // Get dynamic education entries
    const educations = [];
    document.querySelectorAll('#education-container .profile-entry').forEach(entry => {
        educations.push({
            school: entry.querySelector('[name="school"]').value,
            degree: entry.querySelector('[name="degree"]').value,
            fieldOfStudy: entry.querySelector('[name="fieldOfStudy"]').value,
        });
    });
    profileData.education = educations;

    // Get skills
    profileData.skills = document.getElementById('skills').value;
    
    this.data.profile = profileData;
    
    chrome.storage.local.set({ userProfile: this.data.profile }, () => {
      console.log('Profile saved to local storage for content script.');
      this.showNotification("Profile synced for auto-fill!", "info");
    });
    
    this.showNotification("Saving profile...", "info");
    try {
        const userDocRef = doc(db, "users", this.firebaseUser.uid);
        await setDoc(userDocRef, { profile: this.data.profile, updatedAt: serverTimestamp() }, { merge: true });
        this.showNotification("Profile saved successfully!", "success");
    } catch (error) {
        console.error("Error saving profile:", error);
        this.showNotification("Error saving profile to the cloud", "error");
    }
  }
  
  async handleLogout() {
      try {
          await signOut(auth);
          this.showNotification("Logged out successfully", "success");
          window.location.href = "popup.html";
      } catch (error) {
          console.error("Logout error:", error);
          this.showNotification("Logout failed: " + error.message, "error");
      }
  }
  
  showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container');
    if (!container) return;
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    container.appendChild(notification);
    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => notification.remove(), 500);
    }, 4000);
  }

  renderJobs() {
    const container = document.getElementById('jobs-container');
    if (!container) return;
    const filterValue = document.getElementById('job-filter').value;
    const sortValue = document.getElementById('job-sort').value;
    let jobsToRender = [...this.data.jobs];

    if (filterValue === 'recent') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        jobsToRender = jobsToRender.filter(job => new Date(job.dateSaved) >= sevenDaysAgo);
    }

    jobsToRender.sort((a, b) => {
        switch (sortValue) {
            case 'date-asc': return new Date(a.dateSaved) - new Date(b.dateSaved);
            case 'company-asc': return (a.company || '').localeCompare(b.company || '');
            case 'date-desc': default: return new Date(b.dateSaved) - new Date(a.dateSaved);
        }
    });

    if (jobsToRender.length === 0) {
      container.innerHTML = '<div class="empty-state">No saved jobs match your criteria.</div>';
      return;
    }
  
    container.innerHTML = jobsToRender.map(job => {
      const savedDate = job.dateSaved ? new Date(job.dateSaved).toLocaleDateString() : 'N/A';
      return `
        <div class="job-card">
          <div class="job-card-main">
            <h4 class="job-title">${job.title || 'No Title'}</h4>
            <p class="job-company">${job.company || 'No Company'}</p>
            <span class="job-saved-date">Saved on: ${savedDate}</span>
          </div>
          <div class="job-card-actions" style="display: flex; justify-content: flex-end; gap: 0.5rem;">
            <a href="${job.url}" target="_blank" rel="noopener noreferrer" class="btn small">View</a>
            <button class="btn small danger remove-job-btn" data-id="${job.id}">Remove</button>
          </div>
        </div>`;
    }).join('');
  }
  
  async removeJob(jobId) {
    if (!this.firebaseUser || !jobId) {
      this.showNotification("Cannot remove job. Please log in.", "error");
      return;
    }
    if (!confirm("Are you sure you want to remove this saved job?")) return;
  
    try {
      const jobDocRef = doc(db, 'users', this.firebaseUser.uid, 'savedJobs', jobId);
      await deleteDoc(jobDocRef);
      this.data.jobs = this.data.jobs.filter(job => job.id !== jobId);
      this.renderJobs();
      this.updateStats();
      this.showNotification("Job removed successfully.", "success");
    } catch (error) {
      console.error("Error removing job:", error);
      this.showNotification("Failed to remove job.", "error");
    }
  }

  renderApplications() {
    const container = document.getElementById('applications-container');
    if (!container) return;

    const filterValue = document.getElementById('application-filter').value;
    let filteredApps = this.data.applications;
    if (filterValue !== 'all') {
        filteredApps = this.data.applications.filter(app => app.status === filterValue);
    }
    
    const sortedApps = filteredApps.sort((a, b) => new Date(b.dateApplied) - new Date(a.dateApplied));
    
    if (sortedApps.length === 0) {
        container.innerHTML = '<div class="empty-state">No applications match your criteria.</div>';
        return;
    }

    container.innerHTML = sortedApps.map(app => {
        const appliedDate = new Date(app.dateApplied).toLocaleDateString();
        const notesDisplay = app.notes ? `<p class="app-notes"><strong>Notes:</strong> ${app.notes.replace(/\n/g, '<br>')}</p>` : '';
        const urlDisplay = app.url ? `<a href="${app.url}" target="_blank" rel="noopener noreferrer" class="btn small">View Job</a>` : '';

        return `
            <div class="application-card">
  <span class="status ${app.status}">${app.status}</span>
  <h4 class="app-position">${app.position}</h4>
  <p class="app-company">${app.company}</p>
  <p class="app-date">Applied on: ${appliedDate}</p>
  ${notesDisplay}
  <div class="app-card-actions">
    ${urlDisplay}
    <button class="btn small secondary update-app-btn" data-id="${app.id}">Update</button>
  </div>
</div>
        `;
    }).join('');
  }

  changeMonth(delta) {
    this.calendarDate.setMonth(this.calendarDate.getMonth() + delta);
    this.renderCalendar();
  }

  renderCalendar() {
    const container = document.getElementById('calendar-container');
    if (!container) return;
    container.innerHTML = '';

    const year = this.calendarDate.getFullYear();
    const month = this.calendarDate.getMonth();

    document.getElementById('month-year-display').textContent = 
        this.calendarDate.toLocaleString('default', { month: 'long', year: 'numeric' });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayHeaders.forEach(day => {
        const headerCell = document.createElement('div');
        headerCell.className = 'calendar-header';
        headerCell.textContent = day;
        container.appendChild(headerCell);
    });

    for (let i = 0; i < firstDay; i++) {
        container.insertAdjacentHTML('beforeend', '<div class="calendar-day not-current-month"></div>');
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        dayCell.innerHTML = `<span class="day-number">${day}</span><div class="day-reminders"></div>`;
        if (day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
            dayCell.classList.add('today');
        }

        const currentDayDate = new Date(year, month, day);
        const remindersForDay = this.data.reminders.filter(r => {
            const reminderDate = new Date(r.date);
            return reminderDate.getFullYear() === currentDayDate.getFullYear() &&
                   reminderDate.getMonth() === currentDayDate.getMonth() &&
                   reminderDate.getDate() === currentDayDate.getDate();
        });

        if (remindersForDay.length > 0) {
            const remindersContainer = dayCell.querySelector('.day-reminders');
            remindersForDay.forEach(r => {
                remindersContainer.innerHTML += `<span class="reminder-dot" title="${r.title}">${r.title}</span>`;
            });
        }
        container.appendChild(dayCell);
    }
  }

  renderUpcomingReminders() {
      const container = document.getElementById('reminders-list');
      if (!container) return;
      
      const now = new Date();
      const upcoming = this.data.reminders
        .filter(r => new Date(r.date) >= now)
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      if (upcoming.length === 0) {
        container.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1;">No upcoming reminders</div>';
        return;
      }
      
      container.innerHTML = upcoming.map(r => {
        const eventDate = new Date(r.date);
        const notesDisplay = r.notes ? `<p class="reminder-notes">${r.notes.replace(/\n/g, '<br>')}</p>` : '';
        const editIcon = `<svg xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    stroke-width="2" 
    stroke-linecap="round" 
    stroke-linejoin="round" 
    width="18" 
    height="18"> <!-- 👈 smaller size -->
  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
</svg>`;

const deleteIcon = `<svg xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    stroke-width="2" 
    stroke-linecap="round" 
    stroke-linejoin="round" 
    width="18" 
    height="18"> <!-- 👈 smaller size -->
  <polyline points="3 6 5 6 21 6"></polyline>
  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  <line x1="10" y1="11" x2="10" y2="17"></line>
  <line x1="14" y1="11" x2="14" y2="17"></line>
</svg>`;


        return `
          <div class="reminder-card" data-id="${r.id}">
            <div class="reminder-card-header">
              <h4 class="reminder-title">${r.title}</h4>
              <span class="reminder-type ${r.type}">${r.type}</span>
            </div>
            <div class="reminder-card-body">
                <p class="reminder-date">${eventDate.toLocaleString()}</p>
                ${notesDisplay}
            </div>
            <div class="reminder-card-actions">
                <button class="btn-icon edit-reminder-btn" data-id="${r.id}" title="Edit">${editIcon}</button>
                <button class="btn-icon delete-reminder-btn" data-id="${r.id}" title="Delete">${deleteIcon}</button>
            </div>
          </div>
        `;
      }).join('');
  }
}

document.addEventListener("DOMContentLoaded", function () {
  window.dashboard = new ApplixDashboard();
});