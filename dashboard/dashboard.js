class ApplixDashboard {
  constructor() {
    // Initialize dashboard data structure
    this.data = {
      profile: {},
      jobs: [],
      applications: [],
      reminders: [],
      settings: {
        autoScan: false,
        floatingButton: true,
        emailNotifications: false,
        browserNotifications: true,
        reminderTime: 60
      }
    };
    this.firebaseUser = null;
    this.firebaseListeners = [];
    
    // Bind event handlers
    this.initEventListeners();
    
    // Check authentication and load data
    this.checkAuth();
  }

  // Check if user is authenticated
  async checkAuth() {
    // Listen for authentication state changes
    if (window.firebase) {
      window.firebase.auth().onAuthStateChanged(user => {
        this.firebaseUser = user;
        if (user) {
          console.log('User authenticated:', user.displayName || user.email);
          this.loadUserData(); // Load real data from Firebase
          this.setupRealtimeListeners(); // Setup realtime data syncing
        } else {
          console.log('User not authenticated, showing login prompt');
          // Show login prompt or redirect to login page
          document.getElementById('auth-required-overlay').classList.remove('hidden');
        }
      });
    } else {
      console.error('Firebase not initialized');
      this.showNotification('Firebase not initialized. Some features may not work.', 'error');
    }
  }

  // Set up realtime listeners for Firestore collections
  setupRealtimeListeners() {
    if (!this.firebaseUser || !window.firebase) return;
    
    const db = window.firebase.firestore();
    const userId = this.firebaseUser.uid;
    
    // Clear any existing listeners
    this.clearFirebaseListeners();
    
    // Listen for applications changes
    const applicationsListener = db.collection('users').doc(userId)
      .collection('applications')
      .onSnapshot(snapshot => {
        this.data.applications = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          dateApplied: doc.data().dateApplied?.toDate() || new Date(),
          created: doc.data().created?.toDate() || new Date()
        }));
        this.renderApplications();
        this.updateStats();
      }, error => {
        console.error('Error listening to applications:', error);
      });
    
    // Listen for saved jobs changes
    const jobsListener = db.collection('users').doc(userId)
      .collection('savedJobs')
      .onSnapshot(snapshot => {
        this.data.jobs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          dateAdded: doc.data().dateAdded?.toDate() || new Date()
        }));
        this.renderJobs();
        this.updateStats();
      }, error => {
        console.error('Error listening to jobs:', error);
      });
    
    // Listen for reminders changes
    const remindersListener = db.collection('users').doc(userId)
      .collection('reminders')
      .onSnapshot(snapshot => {
        this.data.reminders = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date?.toDate() || new Date(),
          created: doc.data().created?.toDate() || new Date()
        }));
        this.renderUpcomingReminders();
        this.renderCalendar();
        this.updateStats();
      }, error => {
        console.error('Error listening to reminders:', error);
      });
    
    // Listen for profile changes
    const profileListener = db.collection('users').doc(userId)
      .onSnapshot(doc => {
        if (doc.exists) {
          this.data.profile = doc.data().profile || {};
          this.fillProfileForm();
        }
      }, error => {
        console.error('Error listening to profile:', error);
      });
    
    // Listen for settings changes
    const settingsListener = db.collection('users').doc(userId)
      .onSnapshot(doc => {
        if (doc.exists && doc.data().settings) {
          this.data.settings = doc.data().settings;
          this.updateSettingsUI();
        }
      }, error => {
        console.error('Error listening to settings:', error);
      });
    
    // Store listeners for cleanup
    this.firebaseListeners = [
      applicationsListener,
      jobsListener,
      remindersListener,
      profileListener,
      settingsListener
    ];
  }
  
  // Clear any active Firebase listeners
  clearFirebaseListeners() {
    this.firebaseListeners.forEach(unsubscribe => unsubscribe());
    this.firebaseListeners = [];
  }

  // Load user data from Firebase
  async loadUserData() {
    if (!this.firebaseUser || !window.firebase) {
      this.showNotification('User not authenticated. Please log in first.', 'warning');
      return;
    }
    
    try {
      const db = window.firebase.firestore();
      const userId = this.firebaseUser.uid;
      
      // Show loading state
      this.showLoadingOverlay(true);
      
      // Get user document (contains profile and settings)
      const userDoc = await db.collection('users').doc(userId).get();
      
      if (userDoc.exists) {
        const userData = userDoc.data();
        this.data.profile = userData.profile || {};
        this.data.settings = userData.settings || this.data.settings;
        
        // Fill profile form with data
        this.fillProfileForm();
        
        // Update settings UI
        this.updateSettingsUI();
      } else {
        // Create initial user document if it doesn't exist
        await db.collection('users').doc(userId).set({
          email: this.firebaseUser.email,
          displayName: this.firebaseUser.displayName,
          photoURL: this.firebaseUser.photoURL,
          createdAt: window.firebase.firestore.FieldValue.serverTimestamp(),
          profile: {},
          settings: this.data.settings
        });
      }
      
      // Get applications
      const applicationsSnapshot = await db.collection('users').doc(userId)
        .collection('applications')
        .orderBy('created', 'desc')
        .get();
      
      this.data.applications = applicationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        dateApplied: doc.data().dateApplied?.toDate() || new Date(),
        created: doc.data().created?.toDate() || new Date()
      }));
      
      // Get saved jobs
      const jobsSnapshot = await db.collection('users').doc(userId)
        .collection('savedJobs')
        .orderBy('dateAdded', 'desc')
        .get();
      
      this.data.jobs = jobsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        dateAdded: doc.data().dateAdded?.toDate() || new Date()
      }));
      
      // Get reminders
      const remindersSnapshot = await db.collection('users').doc(userId)
        .collection('reminders')
        .orderBy('date')
        .get();
      
      this.data.reminders = remindersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate() || new Date(),
        created: doc.data().created?.toDate() || new Date()
      }));
      
      // Hide loading overlay
      this.showLoadingOverlay(false);
      
      // Update UI with loaded data
      this.updateStats();
      this.renderRecentActivities();
      this.renderUpcomingEvents();
      this.renderJobs();
      this.renderApplications();
      this.renderCalendar();
      this.renderUpcomingReminders();
      
      this.showNotification('Data loaded successfully!', 'success');
    } catch (error) {
      console.error('Error loading user data:', error);
      this.showNotification('Error loading data from Firebase.', 'error');
      this.showLoadingOverlay(false);
    }
  }

  // Save profile data to Firebase
  async saveProfile() {
    const form = document.getElementById('profile-form');
    const formData = new FormData(form);
    
    // Create profile object from form data
    const profile = {
      fullName: formData.get('fullName'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      location: formData.get('location'),
      website: formData.get('website'),
      linkedin: formData.get('linkedin'),
      github: formData.get('github'),
      education: formData.get('education'),
      degree: formData.get('degree'),
      graduationYear: formData.get('graduationYear'),
      skills: formData.get('skills').split(',').map(skill => skill.trim()),
      experience: formData.get('experience'),
      currentRole: formData.get('currentRole'),
      currentCompany: formData.get('currentCompany'),
      bio: formData.get('bio')
    };
    
    // Save to local data
    this.data.profile = profile;
    
    // Save to Firebase if user is logged in
    if (this.firebaseUser && window.firebase) {
      try {
        const db = window.firebase.firestore();
        await db.collection('users').doc(this.firebaseUser.uid)
          .set({ profile }, { merge: true });
          
        this.showNotification('Profile saved successfully!', 'success');
      } catch (error) {
        console.error('Error saving profile to Firebase:', error);
        this.showNotification('Error saving profile to cloud', 'error');
      }
    } else {
      this.showNotification('Profile saved locally', 'info');
    }
  }

  // Content script communication for form auto-fill
  async performAutoFill(tabId) {
    try {
      // First check if user is logged in
      if (!this.firebaseUser) {
        this.showNotification('Please log in to use auto-fill feature', 'warning');
        return;
      }
      
      // Get user profile data from Firestore (latest data)
      const db = window.firebase.firestore();
      const userDoc = await db.collection('users').doc(this.firebaseUser.uid).get();
      
      if (!userDoc.exists || !userDoc.data().profile) {
        this.showNotification('Please complete your profile first', 'warning');
        this.showSection('profile');
        return;
      }
      
      const profileData = userDoc.data().profile;
      
      // Get form field mappings from Firestore or use defaults
      let formMappings;
      const mappingsDoc = await db.collection('system').doc('formMappings').get();
      
      if (mappingsDoc.exists) {
        formMappings = mappingsDoc.data();
      } else {
        // Default mappings if not found in Firestore
        formMappings = {
          name: ['name', 'fullName', 'full-name', 'full_name'],
          email: ['email', 'e-mail', 'email-address'],
          phone: ['phone', 'telephone', 'phone-number', 'phoneNumber', 'mobile'],
          address: ['address', 'location', 'city', 'state', 'zip'],
          website: ['website', 'web', 'url', 'homepage'],
          linkedin: ['linkedin', 'linkedinUrl', 'linkedin-url'],
          github: ['github', 'githubUrl', 'github-url', 'git'],
          education: ['education', 'school', 'university', 'college'],
          degree: ['degree', 'major', 'concentration', 'field-of-study'],
          graduationYear: ['graduationYear', 'graduation-year', 'graduation_year', 'grad-year'],
          skills: ['skills', 'expertise', 'technologies', 'programming-languages'],
          experience: ['experience', 'work-experience', 'years-of-experience'],
          currentRole: ['currentRole', 'current-role', 'job-title', 'title'],
          currentCompany: ['currentCompany', 'current-company', 'employer', 'company']
        };
      }
      
      // Send message to content script to perform the auto-fill
      chrome.tabs.sendMessage(tabId, {
        action: 'autofill',
        profile: profileData,
        mappings: formMappings
      }, response => {
        if (response && response.success) {
          this.showNotification(`Auto-filled ${response.fieldsCount} fields`, 'success');
        } else {
          this.showNotification('Auto-fill failed or no compatible form found', 'error');
        }
      });
    } catch (error) {
      console.error('Error during auto-fill:', error);
      this.showNotification('Error during auto-fill', 'error');
    }
  }

  // Add a new job application
  async addApplication(event) {
    event.preventDefault();
    
    const form = document.getElementById('application-form');
    const formData = new FormData(form);
    
    const application = {
      company: formData.get('company'),
      position: formData.get('position'),
      status: formData.get('status'),
      dateApplied: new Date(),
      notes: formData.get('notes')
    };
    
    // Generate ID for local storage
    if (!this.firebaseUser) {
      application.id = Date.now().toString();
    }
    
    // Add to local data
    this.data.applications.push(application);
    
    // Save to Firebase if logged in
    if (this.firebaseUser && window.firebase) {
      try {
        const db = window.firebase.firestore();
        await db.collection('users').doc(this.firebaseUser.uid)
          .collection('applications')
          .add({
            company: application.company,
            position: application.position,
            status: application.status,
            dateApplied: window.firebase.firestore.Timestamp.fromDate(application.dateApplied),
            notes: application.notes,
            created: window.firebase.firestore.FieldValue.serverTimestamp()
          });
          
        // Realtime listeners will update the UI
      } catch (error) {
        console.error('Error saving application to Firebase:', error);
        this.showNotification('Error saving application to cloud', 'error');
        this.renderApplications(); // Fall back to manual render
      }
    } else {
      this.renderApplications();
    }
    
    form.reset();
    this.showNotification('Application added successfully!', 'success');
  }

  // Add a new reminder
  async addReminder(event) {
    event.preventDefault();
    
    const form = document.getElementById('reminder-form');
    const formData = new FormData(form);
    
    const reminder = {
      title: formData.get('title'),
      date: new Date(formData.get('date')),
      type: formData.get('type'),
      notes: formData.get('notes'),
      created: new Date()
    };
    
    // Generate ID for local storage
    if (!this.firebaseUser) {
      reminder.id = Date.now().toString();
    }
    
    // Add to local data
    this.data.reminders.push(reminder);
    
    // Save to Firebase if logged in
    if (this.firebaseUser && window.firebase) {
      try {
        const db = window.firebase.firestore();
        await db.collection('users').doc(this.firebaseUser.uid)
          .collection('reminders')
          .add({
            title: reminder.title,
            date: window.firebase.firestore.Timestamp.fromDate(reminder.date),
            type: reminder.type,
            notes: reminder.notes,
            created: window.firebase.firestore.FieldValue.serverTimestamp()
          });
          
        // Realtime listeners will update the UI
      } catch (error) {
        console.error('Error saving reminder to Firebase:', error);
        this.showNotification('Error saving reminder to cloud', 'error');
        this.renderUpcomingReminders(); // Fall back to manual render
        this.renderCalendar();
      }
    } else {
      this.renderUpcomingReminders();
      this.renderCalendar();
    }
    
    form.reset();
    this.showNotification('Reminder added successfully!', 'success');
  }

  // Update a setting
  async updateSetting(settingKey, value) {
    // Map HTML IDs to settings keys
    const settingMap = {
      'auto-scan-toggle': 'autoScan',
      'floating-btn-toggle': 'floatingButton',
      'email-notif-toggle': 'emailNotifications',
      'browser-notif-toggle': 'browserNotifications'
    };
    
    const dataKey = settingMap[settingKey] || settingKey;
    
    // Update local data
    this.data.settings[dataKey] = value;
    
    // Save to Firebase if logged in
    if (this.firebaseUser && window.firebase) {
      try {
        const db = window.firebase.firestore();
        await db.collection('users').doc(this.firebaseUser.uid)
          .set({
            settings: {
              [dataKey]: value
            }
          }, { merge: true });
          
        this.showNotification('Setting updated', 'success');
      } catch (error) {
        console.error('Error updating setting in Firebase:', error);
        this.showNotification('Error saving setting to cloud', 'error');
      }
    }
  }

  // Remove a job application
  async removeApplication(applicationId) {
    // Remove from local data
    this.data.applications = this.data.applications.filter(app => app.id !== applicationId);
    
    // Remove from Firebase if logged in
    if (this.firebaseUser && window.firebase) {
      try {
        const db = window.firebase.firestore();
        await db.collection('users').doc(this.firebaseUser.uid)
          .collection('applications')
          .doc(applicationId)
          .delete();
          
        // Realtime listeners will update the UI
      } catch (error) {
        console.error('Error removing application from Firebase:', error);
        this.showNotification('Error removing application from cloud', 'error');
        this.renderApplications(); // Fall back to manual render
      }
    } else {
      this.renderApplications();
    }
    
    this.showNotification('Application removed', 'success');
  }

  // Remove a reminder
  async removeReminder(reminderId) {
    // Remove from local data
    this.data.reminders = this.data.reminders.filter(rem => rem.id !== reminderId);
    
    // Remove from Firebase if logged in
    if (this.firebaseUser && window.firebase) {
      try {
        const db = window.firebase.firestore();
        await db.collection('users').doc(this.firebaseUser.uid)
          .collection('reminders')
          .doc(reminderId)
          .delete();
          
        // Realtime listeners will update the UI
      } catch (error) {
        console.error('Error removing reminder from Firebase:', error);
        this.showNotification('Error removing reminder from cloud', 'error');
        this.renderUpcomingReminders(); // Fall back to manual render
        this.renderCalendar();
      }
    } else {
      this.renderUpcomingReminders();
      this.renderCalendar();
    }
    
    this.showNotification('Reminder removed', 'success');
  }

  // Clear all user data (with confirmation)
  // Clear all user data (with confirmation)
  async clearAllData() {
    if (confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
      // Reset local data
      this.data = {
        profile: {},
        jobs: [],
        applications: [],
        reminders: [],
        settings: {
          autoScan: false,
          floatingButton: true,
          emailNotifications: false,
          browserNotifications: true,
          reminderTime: 60
        }
      };
      
      // Clear data from Firebase if user is logged in
      if (this.firebaseUser && window.firebase) {
        try {
          const db = window.firebase.firestore();
          const userId = this.firebaseUser.uid;
          
          // Use a batch to delete collections
          const batch = db.batch();
          
          // Clear profile data
          batch.set(db.collection('users').doc(userId), {
            profile: {},
            settings: this.data.settings,
            updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
          
          await batch.commit();
          
          // Delete subcollection items separately (can't be done in a batch)
          await this.deleteCollection(db, `users/${userId}/applications`);
          await this.deleteCollection(db, `users/${userId}/savedJobs`);
          await this.deleteCollection(db, `users/${userId}/reminders`);
          
        } catch (error) {
          console.error('Error clearing data from Firebase:', error);
          this.showNotification('Error clearing cloud data', 'error');
        }
      }
      
      this.updateStats();
      this.renderRecentActivities();
      this.renderUpcomingEvents();
      this.renderJobs();
      this.renderApplications();
      this.renderCalendar();
      this.renderUpcomingReminders();
      this.loadSettings();
      this.fillProfileForm();
      this.showSection(this.currentSection);
      this.showNotification('All data cleared', 'success');
    }
  }
  
  // Helper method to delete Firestore collections in batches
  async deleteCollection(db, collectionPath, batchSize = 20) {
    const collectionRef = db.collection(collectionPath);
    const query = collectionRef.orderBy('__name__').limit(batchSize);
    
    return new Promise((resolve, reject) => {
      this.deleteQueryBatch(db, query, resolve).catch(reject);
    });
  }
  
  // Helper method for batch deletion
  async deleteQueryBatch(db, query, resolve) {
    const snapshot = await query.get();
    
    // When there are no documents left, we are done
    const batchSize = snapshot.size;
    if (batchSize === 0) {
      resolve();
      return;
    }
    
    // Delete documents in a batch
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    
    // Recurse on the next process tick, to avoid
    // exploding the stack.
    process.nextTick(() => {
      this.deleteQueryBatch(db, query, resolve);
    });
  }
  
  // Fill profile form with data from Firebase
  fillProfileForm() {
    // Skip if no profile data
    if (!this.data.profile) return;
    
    const profile = this.data.profile;
    
    // Set values in the profile form
    document.getElementById('fullName')?.value = profile.fullName || '';
    document.getElementById('email')?.value = profile.email || this.firebaseUser?.email || '';
    document.getElementById('phone')?.value = profile.phone || '';
    document.getElementById('location')?.value = profile.location || '';
    document.getElementById('website')?.value = profile.website || '';
    document.getElementById('linkedin')?.value = profile.linkedin || '';
    document.getElementById('github')?.value = profile.github || '';
    document.getElementById('education')?.value = profile.education || '';
    document.getElementById('degree')?.value = profile.degree || '';
    document.getElementById('graduationYear')?.value = profile.graduationYear || '';
    document.getElementById('skills')?.value = Array.isArray(profile.skills) ? profile.skills.join(', ') : profile.skills || '';
    document.getElementById('experience')?.value = profile.experience || '';
    document.getElementById('currentRole')?.value = profile.currentRole || '';
    document.getElementById('currentCompany')?.value = profile.currentCompany || '';
    document.getElementById('bio')?.value = profile.bio || '';
  }
  
  // Update settings UI with data from Firebase
  updateSettingsUI() {
    const settings = this.data.settings;
    
    // Update toggle switches
    document.getElementById('auto-scan-toggle').checked = settings.autoScan;
    document.getElementById('floating-btn-toggle').checked = settings.floatingButton;
    document.getElementById('email-notif-toggle').checked = settings.emailNotifications;
    document.getElementById('browser-notif-toggle').checked = settings.browserNotifications;
    
    // Update select fields
    document.getElementById('reminder-time-select').value = settings.reminderTime;
  }
  
  // Handle login with Firebase
  async handleLogin() {
    if (!window.firebase) {
      this.showNotification('Firebase not initialized', 'error');
      return;
    }
    
    try {
      const provider = new window.firebase.auth.GoogleAuthProvider();
      const result = await window.firebase.auth().signInWithPopup(provider);
      
      this.firebaseUser = result.user;
      this.showNotification('Logged in successfully', 'success');
      
      // Load user data
      await this.loadUserData();
      
      // Update UI
      document.getElementById('login-section')?.classList.add('hidden');
      document.getElementById('user-section')?.classList.remove('hidden');
      document.getElementById('user-name').textContent = this.firebaseUser.displayName;
      
      // Hide auth overlay
      document.getElementById('auth-required-overlay')?.classList.add('hidden');
    } catch (error) {
      console.error('Login error:', error);
      this.showNotification('Login failed: ' + error.message, 'error');
    }
  }
  
  // Handle logout
  async handleLogout() {
    try {
      if (!window.firebase) {
        this.showNotification('Firebase not initialized', 'error');
        return;
      }
      
      await window.firebase.auth().signOut();
      this.firebaseUser = null;
      this.showNotification('Logged out successfully', 'success');
      
      // Clear realtime listeners
      this.clearFirebaseListeners();
      
      // Update UI
      document.getElementById('login-section')?.classList.remove('hidden');
      document.getElementById('user-section')?.classList.add('hidden');
      document.getElementById('auth-required-overlay')?.classList.remove('hidden');
    } catch (error) {
      console.error('Logout error:', error);
      this.showNotification('Logout failed: ' + error.message, 'error');
    }
  }
  
  // Show loading overlay
  showLoadingOverlay(show) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      if (show) {
        overlay.classList.remove('hidden');
      } else {
        overlay.classList.add('hidden');
      }
    }
  }
  
  // Initialize event listeners
  initEventListeners() {
    // Login and logout buttons
    document.getElementById('login-btn')?.addEventListener('click', () => this.handleLogin());
    document.getElementById('logout-btn')?.addEventListener('click', () => this.handleLogout());
    
    // Profile form
    document.getElementById('profile-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveProfile();
    });
    
    // Application form
    document.getElementById('application-form')?.addEventListener('submit', (e) => {
      this.addApplication(e);
    });
    
    // Reminder form
    document.getElementById('reminder-form')?.addEventListener('submit', (e) => {
      this.addReminder(e);
    });
    
    // Settings toggles
    document.getElementById('auto-scan-toggle')?.addEventListener('change', (e) => {
      this.updateSetting('autoScan', e.target.checked);
    });
    
    document.getElementById('floating-btn-toggle')?.addEventListener('change', (e) => {
      this.updateSetting('floatingButton', e.target.checked);
    });
    
    document.getElementById('email-notif-toggle')?.addEventListener('change', (e) => {
      this.updateSetting('emailNotifications', e.target.checked);
    });
    
    document.getElementById('browser-notif-toggle')?.addEventListener('change', (e) => {
      this.updateSetting('browserNotifications', e.target.checked);
    });
    
    // Settings selects
    document.getElementById('reminder-time-select')?.addEventListener('change', (e) => {
      this.updateSetting('reminderTime', parseInt(e.target.value));
    });
    
    // Clear data button
    document.getElementById('clear-data-btn')?.addEventListener('click', () => {
      this.clearAllData();
    });
    
    // Refresh data button
    document.getElementById('refresh-data-btn')?.addEventListener('click', () => {
      this.refreshData();
    });
    
    // Navigation buttons
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const section = item.dataset.section;
        if (section) {
          this.showSection(section);
        }
      });
    });
    
    // Auto-fill buttons
    document.getElementById('auto-fill-btn')?.addEventListener('click', () => {
      // Get current tab and send autofill command
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs.length > 0) {
          this.performAutoFill(tabs[0].id);
        }
      });
    });
  }
  
  // Show a section of the dashboard
  showSection(sectionId) {
    this.currentSection = sectionId;
    
    // Hide all sections
    document.querySelectorAll('.dashboard-section').forEach(section => {
      section.classList.add('hidden');
    });
    
    // Show the selected section
    document.getElementById(sectionId + '-section')?.classList.remove('hidden');
    
    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => {
      if (item.dataset.section === sectionId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
    
    // Refresh section-specific data
    if (sectionId === 'calendar') {
      this.renderCalendar();
    } else if (sectionId === 'applications') {
      this.renderApplications();
    } else if (sectionId === 'jobs') {
      this.renderJobs();
    } else if (sectionId === 'profile') {
      this.fillProfileForm();
    } else if (sectionId === 'settings') {
      this.updateSettingsUI();
    }
  }
  
  // Show a notification
  showNotification(message, type = 'info') {
    const notificationContainer = document.getElementById('notification-container');
    if (!notificationContainer) return;
    
    const notification = document.createElement('div');
    notification.classList.add('notification', type);
    notification.textContent = message;
    
    notificationContainer.appendChild(notification);
    
    // Remove after 5 seconds
    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => {
        notification.remove();
      }, 500);
    }, 5000);
  }
  
  // Refresh all data from Firebase
  refreshData() {
    if (this.firebaseUser) {
      this.loadUserData();
    } else {
      // Load demo data if not logged in
      this.showNotification('Please log in to refresh data from cloud', 'warning');
    }
  }
  
  // The following methods are placeholders for rendering different sections
  // You would need to implement these with your specific UI elements
  
  updateStats() {
    // Update stat cards with counts
    document.getElementById('total-applications').textContent = this.data.applications.length;
    document.getElementById('saved-jobs-count').textContent = this.data.jobs.length;
    document.getElementById('upcoming-reminders-count').textContent = 
      this.data.reminders.filter(r => new Date(r.date) > new Date()).length;
  }
  
  renderRecentActivities() {
    // Implement to show recent activities
    const container = document.getElementById('recent-activities');
    if (!container) return;
    
    container.innerHTML = '';
    
    const recentItems = [
      ...this.data.applications.map(app => ({ 
        type: 'application', 
        date: app.dateApplied,
        text: `Applied to ${app.position} at ${app.company}`
      })),
      ...this.data.reminders.map(rem => ({
        type: 'reminder',
        date: rem.created,
        text: `Created reminder: ${rem.title}`
      }))
    ];
    
    // Sort by date, newest first
    recentItems.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Take only 5 most recent
    const recentActivity = recentItems.slice(0, 5);
    
    if (recentActivity.length === 0) {
      container.innerHTML = '<div class="empty-state">No recent activity</div>';
      return;
    }
    
    recentActivity.forEach(item => {
      const element = document.createElement('div');
      element.classList.add('activity-item', item.type);
      
      const date = new Date(item.date);
      element.innerHTML = `
        <div class="activity-date">${date.toLocaleDateString()}</div>
        <div class="activity-text">${item.text}</div>
      `;
      
      container.appendChild(element);
    });
  }
  
  renderUpcomingEvents() {
    // Implement to show upcoming reminders/events
    const container = document.getElementById('upcoming-events');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Filter for upcoming reminders
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const upcomingReminders = this.data.reminders
      .filter(rem => new Date(rem.date) >= today)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 5);
    
    if (upcomingReminders.length === 0) {
      container.innerHTML = '<div class="empty-state">No upcoming events</div>';
      return;
    }
    
    upcomingReminders.forEach(reminder => {
      const element = document.createElement('div');
      element.classList.add('event-item', reminder.type);
      
      const date = new Date(reminder.date);
      element.innerHTML = `
        <div class="event-date">${date.toLocaleDateString()}</div>
        <div class="event-title">${reminder.title}</div>
        <div class="event-notes">${reminder.notes}</div>
      `;
      
      container.appendChild(element);
    });
  }
  
  renderJobs() {
    // Implement to display saved jobs
    const container = document.getElementById('jobs-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (this.data.jobs.length === 0) {
      container.innerHTML = '<div class="empty-state">No saved jobs</div>';
      return;
    }
    
    this.data.jobs.forEach(job => {
      const element = document.createElement('div');
      element.classList.add('job-card');
      
      element.innerHTML = `
        <div class="job-header">
          <h3 class="job-title">${job.title}</h3>
          <span class="job-company">${job.company}</span>
        </div>
        <div class="job-body">
          <p class="job-description">${job.description.substring(0, 100)}...</p>
          <div class="job-location">${job.location}</div>
        </div>
        <div class="job-footer">
          <span class="job-date">Saved on ${new Date(job.dateAdded).toLocaleDateString()}</span>
          <div class="job-actions">
            <button class="btn btn-primary apply-btn" data-id="${job.id}">Apply</button>
            <button class="btn btn-secondary remove-btn" data-id="${job.id}">Remove</button>
          </div>
        </div>
      `;
      
      // Add event listeners
      const removeBtn = element.querySelector('.remove-btn');
      removeBtn?.addEventListener('click', () => {
        this.removeJob(job.id);
      });
      
      container.appendChild(element);
    });
  }
  
  renderApplications() {
    // Implement to display job applications
    const container = document.getElementById('applications-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (this.data.applications.length === 0) {
      container.innerHTML = '<div class="empty-state">No applications yet</div>';
      return;
    }
    
    this.data.applications.forEach(app => {
      const element = document.createElement('div');
      element.classList.add('application-card', app.status.toLowerCase());
      
      element.innerHTML = `
        <div class="app-header">
          <h3 class="app-position">${app.position}</h3>
          <span class="app-company">${app.company}</span>
        </div>
        <div class="app-body">
          <div class="app-date">Applied on ${new Date(app.dateApplied).toLocaleDateString()}</div>
          <div class="app-status">Status: ${app.status}</div>
          <p class="app-notes">${app.notes}</p>
        </div>
        <div class="app-footer">
          <div class="app-actions">
            <button class="btn btn-primary add-reminder" data-id="${app.id}">Add Reminder</button>
            <button class="btn btn-danger remove-btn" data-id="${app.id}">Remove</button>
          </div>
        </div>
      `;
      
      // Add event listeners
      const removeBtn = element.querySelector('.remove-btn');
      removeBtn?.addEventListener('click', () => {
        this.removeApplication(app.id);
      });
      
      const addReminderBtn = element.querySelector('.add-reminder');
      addReminderBtn?.addEventListener('click', () => {
        this.showSection('calendar');
        document.getElementById('reminder-title').value = `Follow up with ${app.company}`;
        document.getElementById('reminder-type').value = 'follow-up';
        const today = new Date();
        today.setDate(today.getDate() + 7); // Default to 1 week from now
        document.getElementById('reminder-date').valueAsDate = today;
      });
      
      container.appendChild(element);
    });
  }
  
  renderCalendar() {
    // Implement calendar view with reminders
    // This would be complex and might use a library like FullCalendar
    console.log("Calendar rendering would go here");
  }
  
  renderUpcomingReminders() {
    // Implement to display upcoming reminders
    const container = document.getElementById('reminders-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (this.data.reminders.length === 0) {
      container.innerHTML = '<div class="empty-state">No reminders</div>';
      return;
    }
    
    // Sort reminders by date, upcoming first
    const sortedReminders = [...this.data.reminders]
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    
    sortedReminders.forEach(reminder => {
      const element = document.createElement('div');
      element.classList.add('reminder-card', reminder.type);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const reminderDate = new Date(reminder.date);
      reminderDate.setHours(0, 0, 0, 0);
      
      let dateStatus = '';
      if (reminderDate < today) {
        dateStatus = 'past';
      } else if (reminderDate.getTime() === today.getTime()) {
        dateStatus = 'today';
      } else {
        dateStatus = 'upcoming';
      }
      
      element.classList.add(dateStatus);
      
      element.innerHTML = `
        <div class="reminder-header">
          <h3 class="reminder-title">${reminder.title}</h3>
          <span class="reminder-date ${dateStatus}">${new Date(reminder.date).toLocaleDateString()}</span>
        </div>
        <div class="reminder-body">
          <div class="reminder-type">${reminder.type}</div>
          <p class="reminder-notes">${reminder.notes}</p>
        </div>
        <div class="reminder-footer">
          <button class="btn btn-danger remove-btn" data-id="${reminder.id}">Remove</button>
        </div>
      `;
      
      // Add event listeners
      const removeBtn = element.querySelector('.remove-btn');
      removeBtn?.addEventListener('click', () => {
        this.removeReminder(reminder.id);
      });
      
      container.appendChild(element);
    });
  }
  
  // Helper function to remove a job
  async removeJob(jobId) {
    // Remove from local data
    this.data.jobs = this.data.jobs.filter(job => job.id !== jobId);
    
    // Remove from Firebase if logged in
    if (this.firebaseUser && window.firebase) {
      try {
        const db = window.firebase.firestore();
        await db.collection('users').doc(this.firebaseUser.uid)
          .collection('savedJobs')
          .doc(jobId)
          .delete();
          
        // Realtime listeners will update the UI
      } catch (error) {
        console.error('Error removing job from Firebase:', error);
        this.showNotification('Error removing job from cloud', 'error');
        this.renderJobs(); // Fall back to manual render
      }
    } else {
      this.renderJobs();
    }
    
    this.updateStats();
    this.showNotification('Job removed', 'success');
  }
}

// Initialize the dashboard when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.dashboard = new ApplixDashboard();
});