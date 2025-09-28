// firebase/chrome-auth.js
// Alternative authentication service using Chrome Identity API only

class ChromeExtensionAuth {
  constructor() {
    this.currentUser = null;
    this.listeners = [];
  }
  
  async signInWithGoogle() {
    try {
      // Get OAuth token using Chrome Identity API
      const token = await this.getAuthToken();
      
      // Get user info from Google API using the token
      const userInfo = await this.getUserInfo(token);
      
      // Create user object
      this.currentUser = {
        uid: userInfo.id,
        email: userInfo.email,
        displayName: userInfo.name,
        photoURL: userInfo.picture,
        accessToken: token
      };
      
      // Store user info in Chrome storage
      await this.storeUserData(this.currentUser);
      
      // Notify listeners
      this.notifyAuthStateChanged(this.currentUser);
      
      return this.currentUser;
    } catch (error) {
      console.error('Google sign-in error:', error);
      throw error;
    }
  }
  
  getAuthToken() {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (token) {
          resolve(token);
        } else {
          reject(new Error('No token received'));
        }
      });
    });
  }
  
  async getUserInfo(token) {
    const response = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${token}`);
    
    if (!response.ok) {
      throw new Error('Failed to get user info from Google');
    }
    
    return await response.json();
  }
  
  async storeUserData(user) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ 
        currentUser: user,
        isAuthenticated: true 
      }, resolve);
    });
  }
  
  async getCurrentUser() {
    if (this.currentUser) {
      return this.currentUser;
    }
    
    return new Promise((resolve) => {
      chrome.storage.local.get(['currentUser', 'isAuthenticated'], (result) => {
        if (result.isAuthenticated && result.currentUser) {
          this.currentUser = result.currentUser;
          resolve(this.currentUser);
        } else {
          resolve(null);
        }
      });
    });
  }
  
  async signOut() {
    try {
      // Remove cached auth token
      if (this.currentUser && this.currentUser.accessToken) {
        chrome.identity.removeCachedAuthToken({ 
          token: this.currentUser.accessToken 
        }, () => {
          console.log('Chrome auth token cleared');
        });
      }
      
      // Clear stored user data
      chrome.storage.local.remove(['currentUser', 'isAuthenticated']);
      
      // Clear current user
      this.currentUser = null;
      
      // Notify listeners
      this.notifyAuthStateChanged(null);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }
  
  onAuthStateChanged(callback) {
    this.listeners.push(callback);
    
    // Call immediately with current state
    callback(this.currentUser);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }
  
  notifyAuthStateChanged(user) {
    this.listeners.forEach(callback => {
      try {
        callback(user);
      } catch (error) {
        console.error('Error in auth state change listener:', error);
      }
    });
  }
}

// Simple data service using Chrome storage
class ChromeStorageData {
  constructor() {
    this.prefix = 'applix_';
  }
  
  async saveJobApplication(applicationData) {
    try {
      const user = await window.chromeAuth.getCurrentUser();
      if (!user) throw new Error('No authenticated user');
      
      const applicationId = this.generateId();
      const application = {
        id: applicationId,
        userId: user.uid,
        ...applicationData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      const key = `${this.prefix}app_${applicationId}`;
      
      return new Promise((resolve, reject) => {
        chrome.storage.local.set({ [key]: application }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(applicationId);
          }
        });
      });
    } catch (error) {
      console.error('Error saving job application:', error);
      throw error;
    }
  }
  
  async getAllApplications() {
    try {
      const user = await window.chromeAuth.getCurrentUser();
      if (!user) throw new Error('No authenticated user');
      
      return new Promise((resolve, reject) => {
        chrome.storage.local.get(null, (items) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          const applications = [];
          for (const [key, value] of Object.entries(items)) {
            if (key.startsWith(`${this.prefix}app_`) && value.userId === user.uid) {
              applications.push(value);
            }
          }
          
          // Sort by creation date, newest first
          applications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          resolve(applications);
        });
      });
    } catch (error) {
      console.error('Error getting applications:', error);
      throw error;
    }
  }
  
  async saveUserProfile(profileData) {
    try {
      const user = await window.chromeAuth.getCurrentUser();
      if (!user) throw new Error('No authenticated user');
      
      const key = `${this.prefix}profile_${user.uid}`;
      const profile = {
        ...profileData,
        userId: user.uid,
        updatedAt: new Date().toISOString()
      };
      
      return new Promise((resolve, reject) => {
        chrome.storage.local.set({ [key]: profile }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(true);
          }
        });
      });
    } catch (error) {
      console.error('Error saving user profile:', error);
      throw error;
    }
  }
  
  async getUserProfile() {
    try {
      const user = await window.chromeAuth.getCurrentUser();
      if (!user) throw new Error('No authenticated user');
      
      const key = `${this.prefix}profile_${user.uid}`;
      
      return new Promise((resolve, reject) => {
        chrome.storage.local.get([key], (result) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(result[key] || null);
          }
        });
      });
    } catch (error) {
      console.error('Error getting user profile:', error);
      throw error;
    }
  }
  
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

// Initialize services
window.chromeAuth = new ChromeExtensionAuth();
window.chromeData = new ChromeStorageData();

// For backward compatibility, alias to previous names
window.firebaseAuth = window.chromeAuth;
window.firebaseData = window.chromeData;