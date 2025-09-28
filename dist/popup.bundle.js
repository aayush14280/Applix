import { i as initializeApp, g as getAuth, a as getFirestore, G as GoogleAuthProvider, s as signInWithCredential, b as signOut, o as onAuthStateChanged, c as collection, q as query, d as orderBy, e as getDocs } from "./assets/index.esm2017-5f242de0.js";
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
const authService = {
  signInWithGoogle: async () => {
    const token = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token2) => {
        if (chrome.runtime.lastError)
          return reject(new Error(chrome.runtime.lastError.message));
        resolve(token2);
      });
    });
    const credential = GoogleAuthProvider.credential(null, token);
    return signInWithCredential(auth, credential);
  },
  signOut: () => signOut(auth),
  onAuthStateChanged: (callback) => onAuthStateChanged(auth, callback)
};
const dataService = {
  getRecentApplications: async () => {
    if (!auth.currentUser)
      throw new Error("Authentication required.");
    const userId = auth.currentUser.uid;
    const appsRef = collection(db, "users", userId, "applications");
    const q = query(appsRef, orderBy("dateApplied", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }
};
document.addEventListener("DOMContentLoaded", function() {
  const loginSection = document.getElementById("login-section");
  const mainSection = document.getElementById("main-section");
  const userPhoto = document.getElementById("user-photo");
  const userName = document.getElementById("user-name");
  const activityList = document.getElementById("activity-list");
  const googleLoginBtn = document.getElementById("google-login-btn");
  const dashboardBtn = document.getElementById("dashboard-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const autoFillBtn = document.getElementById("auto-fill-btn");
  const saveJobBtn = document.getElementById("save-job-btn");
  const handleAuthStateChange = (user) => {
    if (user) {
      loginSection.classList.add("hidden");
      mainSection.classList.remove("hidden");
      userPhoto.src = user.photoURL || "assets/default-avatar.png";
      userName.textContent = user.displayName || user.email;
      loadRecentActivity();
    } else {
      loginSection.classList.remove("hidden");
      mainSection.classList.add("hidden");
      activityList.innerHTML = "";
    }
  };
  googleLoginBtn.addEventListener("click", () => {
    authService.signInWithGoogle().catch((error) => console.error("Login failed:", error));
  });
  logoutBtn.addEventListener("click", () => {
    authService.signOut();
  });
  dashboardBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("dashboard/dashboard.html") });
  });
  autoFillBtn.addEventListener("click", () => {
    console.log("Popup: Auto-Fill button clicked. Sending message...");
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "autoFill" }, (response) => {
          if (chrome.runtime.lastError) {
            console.error("Message sending failed:", chrome.runtime.lastError.message);
          }
        });
      }
    });
  });
  saveJobBtn.addEventListener("click", () => {
    console.log("Popup: Save Job button clicked. Sending message...");
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "scanJobs" }, (response) => {
          if (chrome.runtime.lastError) {
            console.error("Message sending failed:", chrome.runtime.lastError.message);
          }
        });
      }
    });
  });
  async function loadRecentActivity() {
    activityList.innerHTML = "<li>Loading...</li>";
    try {
      const applications = await dataService.getRecentApplications();
      activityList.innerHTML = "";
      if (applications.length === 0) {
        activityList.innerHTML = "<li>No recent activity</li>";
        return;
      }
      applications.slice(0, 5).forEach((app2) => {
        const li = document.createElement("li");
        li.textContent = `Applied to ${app2.position} at ${app2.company}`;
        activityList.appendChild(li);
      });
    } catch (error) {
      console.error("Error loading activities:", error);
      activityList.innerHTML = "<li>Could not load activity.</li>";
    }
  }
  authService.onAuthStateChanged(handleAuthStateChange);
});
