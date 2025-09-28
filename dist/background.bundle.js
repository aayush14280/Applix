import { i as initializeApp, g as getAuth, a as getFirestore, o as onAuthStateChanged, c as collection, j as serverTimestamp, k as addDoc } from "./assets/index.esm2017-5f242de0.js";
const firebaseConfig = {
  apiKey: "AIzaSyAy9Pt5ZFPSt3JZa1BJgJnb_m2xFwd6v7A",
  authDomain: "applix-491f9.firebaseapp.com",
  projectId: "applix-491f9",
  storageBucket: "applix-491f9.appspot.com",
  messagingSenderId: "554364657413",
  appId: "1:554364657413:web:bdccf9d500d8187c0ca16c"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background script received message:", message);
  if (message.action === "saveJobToFirebase") {
    saveJobToFirebase(message.payload).then(() => {
      console.log("Job saved successfully in background");
      sendResponse({ success: true });
    }).catch((error) => {
      console.error("Error saving job in background:", error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
  if (message.action === "getProfileData") {
    getProfileDataFromFirebase().then((data) => sendResponse({ success: true, data })).catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }
  if (message.action === "logActivity") {
    logActivityToFirebase(message.activity).then(() => sendResponse({ success: true })).catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }
});
async function saveJobToFirebase(jobData) {
  console.log("Attempting to save job:", jobData);
  try {
    const user = auth.currentUser;
    if (!user) {
      return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, async (user2) => {
          unsubscribe();
          if (user2) {
            try {
              await saveJobForUser(user2.uid, jobData);
              resolve();
            } catch (error) {
              reject(error);
            }
          } else {
            reject(new Error("No authenticated user. Please log in first."));
          }
        });
      });
    } else {
      await saveJobForUser(user.uid, jobData);
    }
  } catch (error) {
    console.error("Error in saveJobToFirebase:", error);
    throw error;
  }
}
async function saveJobForUser(userId, jobData) {
  const jobsCollectionRef = collection(db, "users", userId, "savedJobs");
  const jobToSave = {
    title: jobData.title,
    company: jobData.company,
    url: jobData.url,
    status: jobData.status || "saved",
    dateSaved: serverTimestamp(),
    createdAt: serverTimestamp()
  };
  const docRef = await addDoc(jobsCollectionRef, jobToSave);
  console.log("Job saved to Firestore with ID:", docRef.id);
  chrome.storage.local.get(["savedJobs"], (result) => {
    const jobs = result.savedJobs || [];
    jobs.unshift({ ...jobToSave, id: docRef.id, dateSaved: /* @__PURE__ */ new Date() });
    chrome.storage.local.set({ savedJobs: jobs });
  });
}
async function getProfileDataFromFirebase() {
  const user = auth.currentUser;
  if (!user)
    throw new Error("No authenticated user");
  const userDocRef = doc(db, "users", user.uid);
  const userDoc = await getDoc(userDocRef);
  if (userDoc.exists()) {
    const userData = userDoc.data();
    return userData.profile || {};
  }
  return {};
}
async function logActivityToFirebase(activity) {
  const user = auth.currentUser;
  if (!user)
    throw new Error("No authenticated user");
  const activitiesRef = collection(db, "users", user.uid, "activities");
  await addDoc(activitiesRef, {
    ...activity,
    timestamp: serverTimestamp()
  });
}
