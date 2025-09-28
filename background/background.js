// background/background.js
// Handles background processes for the extension
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyAy9Pt5ZFPSt3JZa1BJgJnb_m2xFwd6v7A",
  authDomain: "applix-491f9.firebaseapp.com",
  projectId: "applix-491f9",
  storageBucket: "applix-491f9.appspot.com",
  messagingSenderId: "554364657413",
  appId: "1:554364657413:web:bdccf9d500d8187c0ca16c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Initialize message listeners
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background script received message:', message);
  
  if (message.action === 'saveJobToFirebase') {
    saveJobToFirebase(message.payload)
      .then(() => {
        console.log('Job saved successfully in background');
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error('Error saving job in background:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }
  
  if (message.action === 'getProfileData') {
    getProfileDataFromFirebase()
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (message.action === 'logActivity') {
    logActivityToFirebase(message.activity)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// Save job data to Firebase
async function saveJobToFirebase(jobData) {
  console.log('Attempting to save job:', jobData);
  
  try {
    // Get current user
    const user = auth.currentUser;
    
    if (!user) {
      // Try to get auth state
      return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          unsubscribe(); // Stop listening after first check
          
          if (user) {
            try {
              await saveJobForUser(user.uid, jobData);
              resolve();
            } catch (error) {
              reject(error);
            }
          } else {
            reject(new Error('No authenticated user. Please log in first.'));
          }
        });
      });
    } else {
      await saveJobForUser(user.uid, jobData);
    }
  } catch (error) {
    console.error('Error in saveJobToFirebase:', error);
    throw error;
  }
}

// Helper function to save job for a specific user
async function saveJobForUser(userId, jobData) {
  const jobsCollectionRef = collection(db, 'users', userId, 'savedJobs');
  
  const jobToSave = {
    title: jobData.title,
    company: jobData.company,
    url: jobData.url,
    status: jobData.status || 'saved',
    dateSaved: serverTimestamp(),
    createdAt: serverTimestamp()
  };
  
  const docRef = await addDoc(jobsCollectionRef, jobToSave);
  console.log('Job saved to Firestore with ID:', docRef.id);
  
  // Also save to Chrome storage for offline access
  chrome.storage.local.get(['savedJobs'], (result) => {
    const jobs = result.savedJobs || [];
    jobs.unshift({ ...jobToSave, id: docRef.id, dateSaved: new Date() });
    chrome.storage.local.set({ savedJobs: jobs });
  });
}

// Get user profile data from Firebase
async function getProfileDataFromFirebase() {
  const user = auth.currentUser;
  if (!user) throw new Error('No authenticated user');
  
  const userDocRef = doc(db, 'users', user.uid);
  const userDoc = await getDoc(userDocRef);
  
  if (userDoc.exists()) {
    const userData = userDoc.data();
    return userData.profile || {};
  }
  
  return {};
}

// Log activity to Firebase
async function logActivityToFirebase(activity) {
  const user = auth.currentUser;
  if (!user) throw new Error('No authenticated user');
  
  const activitiesRef = collection(db, 'users', user.uid, 'activities');
  await addDoc(activitiesRef, {
    ...activity,
    timestamp: serverTimestamp()
  });
}