// popup/popup.js

document.addEventListener('DOMContentLoaded', function() {
  // UI Elements
  const loginSection = document.getElementById('login-section');
  const mainSection = document.getElementById('main-section');
  const userPhoto = document.getElementById('user-photo');
  const userName = document.getElementById('user-name');
  const activityList = document.getElementById('activity-list');
  
  // Buttons
  const googleLoginBtn = document.getElementById('google-login-btn');
  const dashboardBtn = document.getElementById('dashboard-btn');
  const logoutBtn = document.getElementById('logout-btn');
  // **MODIFICATION**: Get references to the action buttons
  const autoFillBtn = document.getElementById('auto-fill-btn');
  const saveJobBtn = document.getElementById('save-job-btn');

  /**
   * This is the central function that updates the UI based on auth state.
   * It's called automatically whenever the user logs in or out.
   */
  const handleAuthStateChange = (user) => {
    if (user) {
      // --- User is signed IN ---
      loginSection.classList.add('hidden');
      mainSection.classList.remove('hidden');

      userPhoto.src = user.photoURL || 'assets/default-avatar.png'; // Provide a default avatar
      userName.textContent = user.displayName || user.email;

      // Load recent activity for the logged-in user
      loadRecentActivity();
    } else {
      // --- User is signed OUT ---
      loginSection.classList.remove('hidden');
      mainSection.classList.add('hidden');
      activityList.innerHTML = ''; // Clear the activity list
    }
  };
  
  // --- Event Listeners ---
  googleLoginBtn.addEventListener('click', () => {
    // Just call the sign-in method. The listener above will handle the UI changes.
    window.authService.signInWithGoogle().catch(error => {
      console.error('Login failed:', error);
    });
  });
  
  logoutBtn.addEventListener('click', () => {
    // Just call the sign-out method. The listener will handle UI changes.
    window.authService.signOut();
  });
  
  dashboardBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') });
  });

  // **MODIFICATION**: Add event listeners for the action buttons
  autoFillBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'autoFill' }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error sending message:', chrome.runtime.lastError.message);
          } else if (response && !response.success) {
            console.error('Auto-fill failed:', response.error);
          } else {
            console.log('Auto-fill initiated.');
            window.close(); // Close popup after action
          }
        });
      }
    });
  });

  saveJobBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'scanJobs' }, (response) => {
          if (chrome.runtime.lastError) {
             console.error('Could not communicate with the page to save the job.');
          } else {
             console.log('Scan for jobs initiated.');
             // The content script will handle showing the UI and saving.
             window.close(); // Close the popup after action
          }
        });
      }
    });
  });

  // Load recent activity from Firestore
  async function loadRecentActivity() {
    activityList.innerHTML = '<li>Loading...</li>';
    try {
      // Use the new dataService to get data from Firestore
      const applications = await window.dataService.getAllApplications();
      
      activityList.innerHTML = ''; // Clear loading message
      if (applications.length === 0) {
        activityList.innerHTML = '<li>No recent activity</li>';
        return;
      }
      
      // Display up to 5 recent applications
      applications.slice(0, 5).forEach(app => {
        const li = document.createElement('li');
        // Firestore timestamps need to be converted to JS Dates
        const date = app.createdAt?.toDate().toLocaleString() || 'some date';
        li.textContent = `Applied to ${app.position} at ${app.company}`;
        activityList.appendChild(li);
      });
    } catch (error) {
      console.error('Error loading activities:', error);
      activityList.innerHTML = '<li>Could not load activity.</li>';
    }
  }

  // **IMPORTANT**: Set up the listener for auth state changes.
  // This is the most critical part of the script.
  window.authService.onAuthStateChanged(handleAuthStateChange);
});