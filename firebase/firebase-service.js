// firebase/firebase-service.js
// A complete service to handle Firebase Authentication and Firestore data operations.

// --- 1. Firebase Configuration ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID,
  measurementId: import.meta.env.VITE_MEASUREMENT_ID
};

// --- 2. Initialize Firebase ---
if (typeof firebase === 'undefined') {
  console.error('Firebase SDK not loaded. Make sure Firebase scripts are included before this file.');
} else if (!firebase.apps || !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
  console.log("Firebase initialized successfully");
}

// --- 3. Unified Authentication Service ---
class FirebaseAuthService {
  constructor() {
    if (typeof firebase === 'undefined' || !firebase.auth) {
      console.error('Firebase Auth SDK not available');
      return;
    }
    this.auth = firebase.auth();
    this.db = firebase.firestore();
    
    // Set up auth state listener to keep user data in sync
    this.auth.onAuthStateChanged(user => {
      if (user) {
        console.log("User is signed in:", user.email);
        this.saveUserToFirestore(user).catch(err => 
          console.error("Error saving user to Firestore:", err));
      } else {
        console.log("User is signed out");
      }
    });
  }

  // Signs the user into Firebase using their Google account via Chrome Identity API
  async signInWithGoogle() {
    try {
      const token = await new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: true }, (token) => {
          if (chrome.runtime.lastError) {
            return reject(new Error(chrome.runtime.lastError.message));
          }
          resolve(token);
        });
      });

      console.log("✅ Got Chrome identity token");
      const credential = firebase.auth.GoogleAuthProvider.credential(null, token);
      const result = await this.auth.signInWithCredential(credential);
      console.log("✅ Successfully authenticated with Firebase:", result.user.displayName);
      
      // Save user to Firestore
      await this.saveUserToFirestore(result.user);
      return result.user;
    } catch (error) {
      console.error("🔥 Firebase sign-in error:", error);
      throw error;
    }
  }
  
  // Saves the user's basic info to the 'users' collection in Firestore.
  async saveUserToFirestore(user) {
    if (!user) return;
    const userRef = this.db.collection("users").doc(user.uid);
    const userData = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
    };
    await userRef.set(userData, { merge: true });
    console.log("✅ User data saved to Firestore");
    return userData;
  }

  // Signs the user out of Firebase and clears Chrome identity token
  async signOut() {
    try {
      // First, get the current user to check for tokens
      const currentUser = this.auth.currentUser;
      
      // Sign out from Firebase
      await this.auth.signOut();
      console.log("User signed out of Firebase");
      
      // If we have a user with a credential, also revoke the Chrome identity token
      if (currentUser && currentUser.providerData && 
          currentUser.providerData.some(p => p.providerId === 'google.com')) {
        chrome.identity.getAuthToken({ interactive: false }, function(token) {
          if (token) {
            chrome.identity.removeCachedAuthToken({ token: token }, function() {
              console.log("Chrome identity token cleared");
            });
          }
        });
      }
    } catch (error) {
      console.error("Error during sign out:", error);
      throw error;
    }
  }

  // Gets the current signed-in user object.
  getCurrentUser() {
    return this.auth.currentUser;
  }
}

// --- 4. Firestore Data Service ---
class FirestoreDataService {
    constructor() {
        if (typeof firebase === 'undefined' || !firebase.firestore) {
          console.error('Firebase Firestore SDK not available');
          return;
        }
        this.db = firebase.firestore();
        this.auth = firebase.auth();
    }

    // Helper to securely get the current user's ID.
    _getCurrentUserId() {
        const user = this.auth.currentUser;
        if (!user) throw new Error("Authentication required. Please log in first.");
        return user.uid;
    }

    /**
     * Saves the user's profile information (name, phone, etc.).
     * @param {object} profileData - The profile data from your form.
     */
    async saveUserProfile(profileData) {
        try {
            const userId = this._getCurrentUserId();
            const userRef = this.db.collection("users").doc(userId);
            await userRef.set({ profile: profileData }, { merge: true });
            console.log("✅ User profile saved to Firestore");
            return true;
        } catch (error) {
            console.error("Error saving user profile:", error);
            throw error;
        }
    }
    
    /**
     * Retrieves the user's saved profile information.
     * @returns {Promise<object|null>} The user's profile data or null if not found.
     */
    async getUserProfile() {
        try {
            const userId = this._getCurrentUserId();
            const doc = await this.db.collection("users").doc(userId).get();
            console.log("✅ User profile retrieved from Firestore");
            return doc.exists && doc.data().profile ? doc.data().profile : null;
        } catch (error) {
            console.error("Error getting user profile:", error);
            throw error;
        }
    }

    // Other methods remain the same...
}

// --- 5. Make services globally available ---
// Wait until document is ready to ensure Firebase SDK has loaded
document.addEventListener('DOMContentLoaded', function() {
  if (typeof firebase === 'undefined') {
    console.error('Firebase SDK not loaded. Services will not be available.');
    return;
  }
  
  // Create service instances
  window.firebaseAuth = new FirebaseAuthService();
  window.firebaseData = new FirestoreDataService();
  
  console.log("Firebase services initialized and ready");
});

// For background scripts or immediate use, also make available now
if (typeof firebase !== 'undefined') {
  window.authService = new FirebaseAuthService();
  window.dataService = new FirestoreDataService();
  
  // For backward compatibility with your existing code
  window.firebaseAuth = window.authService;
  window.firebaseData = window.dataService;
}