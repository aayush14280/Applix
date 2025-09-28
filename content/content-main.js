(function() {
  // Global variables
  let profileData = null;
  let floatingButton = null;
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  
  // Initialize the content script
  function initContentScripts() {
    console.log('Applix content script initialized');
    
    // Load user profile from storage
    chrome.storage.local.get(['userProfile', 'settings'], function(data) {
      if (chrome.runtime.lastError) {
          console.warn("Applix: Context invalidated on initial load.");
          return;
      }
      if (data.userProfile) {
        profileData = data.userProfile;
        console.log('Profile data loaded for auto-fill:', profileData);
      } else {
        console.warn('Applix: No user profile found. Auto-fill will not work until profile is saved in the dashboard.');
      }
      
      // Create floating button if enabled in settings
      if (!data.settings || data.settings.floatingButton !== false) {
        createFloatingButton();
      }
    });
    
    // Listen for messages from popup or background
    setupMessageListeners();
  }
  
  // Create floating button
  function createFloatingButton() {
    if (document.getElementById('applix-floating-btn')) return;
    
    floatingButton = document.createElement('div');
    floatingButton.id = 'applix-floating-btn';
    floatingButton.title = 'Double-click to Auto-fill';
    floatingButton.style.cssText = `
      position: fixed; bottom: 20px; right: 20px; width: 48px; height: 48px; border-radius: 50%;
      background-color: #4285f4; color: white; display: flex; justify-content: center; align-items: center;
      font-size: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.2); cursor: move; z-index: 9999;
      background-image: url(${chrome.runtime.getURL('assets/icons/icon48.png')}); background-size: 60%;
      background-repeat: no-repeat; background-position: center; user-select: none; transition: transform 0.1s;
    `;
    
    floatingButton.addEventListener('mousedown', handleButtonDragStart);
    floatingButton.addEventListener('dblclick', handleButtonAction);
    document.body.appendChild(floatingButton);

    chrome.storage.local.get('buttonPosition', function(data) {
      if (chrome.runtime.lastError) { return; }
      if (data.buttonPosition) {
        floatingButton.style.left = data.buttonPosition.left;
        floatingButton.style.right = 'auto';
        floatingButton.style.top = data.buttonPosition.top;
        floatingButton.style.bottom = 'auto';
      }
    });
  }
  
  // --- Dragging Handlers ---
  function handleButtonDragStart(e) {
    if (e.detail > 1) return;
    isDragging = true;
    dragOffsetX = e.clientX - floatingButton.getBoundingClientRect().left;
    dragOffsetY = e.clientY - floatingButton.getBoundingClientRect().top;
    document.addEventListener('mousemove', handleButtonDragMove);
    document.addEventListener('mouseup', handleButtonDragEnd);
    floatingButton.style.transform = 'scale(0.95)';
    floatingButton.style.transition = 'none';
    e.preventDefault();
  }
  
  function handleButtonDragMove(e) {
    if (!isDragging) return;
    const left = e.clientX - dragOffsetX;
    const top = e.clientY - dragOffsetY;
    floatingButton.style.left = `${left}px`;
    floatingButton.style.top = `${top}px`;
    floatingButton.style.right = 'auto';
    floatingButton.style.bottom = 'auto';
    e.preventDefault();
  }
  
  function handleButtonDragEnd() {
    if (!isDragging) return;
    isDragging = false;
    document.removeEventListener('mousemove', handleButtonDragMove);
    document.removeEventListener('mouseup', handleButtonDragEnd);
    floatingButton.style.transform = 'scale(1)';
    floatingButton.style.transition = 'transform 0.1s';
    const position = { left: floatingButton.style.left, top: floatingButton.style.top };
    chrome.storage.local.set({ buttonPosition: position }, () => {
        if (chrome.runtime.lastError) { /* Silently fail on context invalidation */ }
    });
  }

  // --- Main Action Handlers ---
  function handleButtonAction() {
    autoFillFromProfile();
  }
  
  function autoFillFromProfile() {
    chrome.storage.local.get('userProfile', function(data) {
        if (chrome.runtime.lastError) {
            console.warn("Applix: Context invalidated. This is expected after an extension reload.");
            return;
        }
        if (data.userProfile && Object.keys(data.userProfile).length > 0) {
            profileData = data.userProfile;
            detectAndFillFormFields(profileData);
            showNotification('Form fields auto-filled!', 'success');
        } else {
            showNotification('Auto-fill error: Your profile is empty. Please save it in the dashboard first.', 'error');
        }
    });
  }

  function detectAndFillFormFields(profile) {
    // Enhanced field mappings with more comprehensive data and common aliases
    const fieldMappings = {
      // Basic Info
      name: profile.firstName ? `${profile.firstName} ${profile.lastName}` : (profile.fullName || ''),
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      phone: profile.phone,
      headline: profile.headline,
      
      // Location Info
      address: profile.address,
      city: profile.city,
      state: profile.state,
      zipCode: profile.zipCode,
      postalCode: profile.zipCode, // Alias for zipCode
      zip: profile.zipCode,       // Another common alias
      country: profile.country,
      
      // Professional Links
      linkedin: profile.linkedin,
      github: profile.github,
      portfolio: profile.portfolio,
      website: profile.portfolio, // Alias for portfolio
      
      // Additional common fields
      experience: profile.experience,
    };

    Object.entries(fieldMappings).forEach(([type, value]) => {
      // Only try to fill if a value for this type exists in the profile
      if (value) {
        fillField(type, value);
      }
    });
  }
  
  function fillField(type, value) {
    // More robust selectors to catch variations like 'first_name', 'firstName', 'aria-label' etc.
    const selectors = [
        `input[name*="${type}" i]`, `input[id*="${type}" i]`,
        `input[placeholder*="${type}" i]`, `input[aria-label*="${type}" i]`,
        `textarea[name*="${type}" i]`, `textarea[id*="${type}" i]`,
        `textarea[aria-label*="${type}" i]`,
    ];
  
    // Use querySelectorAll to find ALL matching fields, not just the first one
    const elements = document.querySelectorAll(selectors.join(', '));
    
    if (elements.length > 0) {
      console.log(`Applix: Found ${elements.length} element(s) for type "${type}"`);
    }
  
    elements.forEach(element => {
      // Only fill if the field is empty to avoid overwriting user input or default values
      if (element && !element.value) {
          element.value = value;
          // Dispatch events to let modern frameworks (like React) know the input has changed
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  }
  
  function scanAndSaveJob() {
      console.log("Content Script: Scanning page for job info...");
      
      // Enhanced selectors for different job sites
      const jobTitle = extractText([
        // LinkedIn selectors
        '.job-details-jobs-unified-top-card__job-title',
        '.jobs-unified-top-card h1',
        '.top-card-layout__title',
        'h1.jobs-unified-top-card__job-title',
        'h1.t-24',
        // Indeed selectors
        '.jobsearch-JobInfoHeader-title',
        'h1[data-testid="job-title"]',
        '.jobsearch-JobInfoHeader-title-container h1',
        // Generic selectors
        'h1',
        '.job-title',
        '[class*="job-title"]',
        '[class*="position"]'
      ]);
      
      const companyName = extractText([
        // LinkedIn selectors
        '.job-details-jobs-unified-top-card__company-name a',
        '.jobs-unified-top-card__company-name',
        '.topcard__org-name-link',
        'a[data-control-name="company_link"]',
        '.jobs-unified-top-card__subtitle-primary-grouping span',
        // Indeed selectors
        '.jobsearch-CompanyReview--name',
        '[data-testid="company-name"]',
        '.jobsearch-InlineCompanyRating-companyHeader a',
        // Generic selectors
        'a[data-company]',
        '[class*="company-name"]',
        '[class*="employer"]'
      ]);
      
      // If we couldn't find both, try to parse from the page title
      let finalJobTitle = jobTitle;
      let finalCompanyName = companyName;
      
      if (!finalJobTitle || !finalCompanyName) {
          const pageTitle = document.title;
          console.log("Trying to extract from page title:", pageTitle);
          
          if (pageTitle.includes(' - ')) {
              const parts = pageTitle.split(' - ');
              if (!finalJobTitle && parts.length >= 1) {
                  finalJobTitle = parts[0].trim();
              }
              if (!finalCompanyName && parts.length >= 2) {
                  finalCompanyName = parts[1].replace(/\s*\|\s*LinkedIn.*$/, '')
                                              .replace(/\s*Indeed.*$/, '')
                                              .trim();
              }
          }
      }
      
      if (!finalJobTitle || !finalCompanyName) {
          console.error("Scraping failed. Found Title:", finalJobTitle, "Found Company:", finalCompanyName);
          showNotification("Could not find job details on this page. Please ensure you're on a job listing page.", "error");
          return;
      }
      
      const jobData = {
          title: finalJobTitle,
          company: finalCompanyName,
          url: window.location.href,
          status: 'saved',
      };
      
      console.log("Content Script: Found job data, sending to background script:", jobData);
      
      // Send message to background script
      chrome.runtime.sendMessage({ 
          action: 'saveJobToFirebase', 
          payload: jobData 
      }, (response) => {
          if (chrome.runtime.lastError) {
              console.error("Error sending message:", chrome.runtime.lastError.message);
              showNotification("Could not save job. Extension connection error.", "error");
              return;
          }
          if (response && response.success) {
              showNotification(`Job saved: ${jobData.title} at ${jobData.company}`, "success");
          } else {
              const errorMsg = response?.error || 'Please log in first.';
              showNotification(`Error: ${errorMsg}`, "error");
          }
      });
  }

  function extractText(selectors) {
      for (const selector of selectors) {
          try {
              const element = document.querySelector(selector);
              if (element) {
                  const text = element.innerText || element.textContent;
                  if (text) {
                      return text.trim().replace(/\s+/g, ' ');
                  }
              }
          } catch (e) {
              continue;
          }
      }
      return null;
  }
  
  function showNotification(message, type = 'info') {
    const existing = document.querySelector('.applix-notification');
    if(existing) existing.remove();
    const notification = document.createElement('div');
    notification.className = 'applix-notification';
    notification.style.cssText = `
      position: fixed; bottom: 20px; right: 20px;
      background-color: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#F44336' : '#2196F3'};
      color: white; padding: 12px 16px; border-radius: 4px; box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      z-index: 10000; opacity: 0; transition: opacity 0.3s, transform 0.3s;
      transform: translateY(20px); font-family: sans-serif; max-width: 300px;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateY(0)';
    }, 10);
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateY(20px)';
      setTimeout(() => notification.remove(), 300);
    }, 4000);
  }
  
  function setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log("Message received in content script:", message);
      if (message.action === 'autoFill') {
        autoFillFromProfile();
        sendResponse({ success: true });
      } 
      else if (message.action === 'scanJobs') {
        scanAndSaveJob();
        sendResponse({ success: true });
      }
      return true; // Keep message channel open for async response
    });
  }
  
  initContentScripts();
})();