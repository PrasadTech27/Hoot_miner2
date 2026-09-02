import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, get, set, remove, onValue } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyA1QeDf1E_Kb1ZC15ahw1dY8hk3J0gXopY",
  authDomain: "thodu-65cb9.firebaseapp.com",
  databaseURL: "https://thodu-65cb9-default-rtdb.firebaseio.com",
  projectId: "thodu-65cb9",
  storageBucket: "thodu-65cb9.firebasestorage.app",
  messagingSenderId: "1070229943496",
  appId: "1:1070229943496:web:038e2e74c463e7acefa1fd",
  measurementId: "G-NF17LPGHWV"
};

const app = initializeApp(firebaseConfig);
export const rtdb = getDatabase(app);

// Default repositories and questions purging
const DEFAULT_DEMO_REPO_IDS = ['repo-c-1', 'repo-c-2', 'repo-py-1', 'repo-java-1', 'repo-java-2'];
const DEFAULT_DEMO_QUESTION_IDS = ['q-c-1', 'q-cpp-1', 'q-cpp-2', 'q-py-1', 'q-java-1', 'q-java-2'];

const LOCAL_STORAGE_REPOS_KEY = "hootminer_repos";
const LOCAL_STORAGE_QUESTIONS_KEY = "hootminer_questions";
const LOCAL_STORAGE_CONTESTS_KEY = "hootminer_contests";
const LOCAL_STORAGE_USER_KEY = "hootminer_current_user";
const LOCAL_STORAGE_APPLICATIONS_KEY = "hootminer_applications";

// Automatically purge pre-existing demo data from Firebase & LocalStorage
export async function seedInitialDataIfNeeded() {
  try {
    for (const id of DEFAULT_DEMO_REPO_IDS) {
      await remove(ref(rtdb, `repositories/${id}`));
    }
    for (const qId of DEFAULT_DEMO_QUESTION_IDS) {
      await remove(ref(rtdb, `questions_answers/${qId}`));
    }

    const localRepos = localStorage.getItem(LOCAL_STORAGE_REPOS_KEY);
    if (localRepos) {
      const parsed = JSON.parse(localRepos).filter(r => !DEFAULT_DEMO_REPO_IDS.includes(r.id));
      localStorage.setItem(LOCAL_STORAGE_REPOS_KEY, JSON.stringify(parsed));
    }

    const localQuestions = localStorage.getItem(LOCAL_STORAGE_QUESTIONS_KEY);
    if (localQuestions) {
      const parsedQ = JSON.parse(localQuestions).filter(q => !DEFAULT_DEMO_QUESTION_IDS.includes(q.id));
      localStorage.setItem(LOCAL_STORAGE_QUESTIONS_KEY, JSON.stringify(parsedQ));
    }
  } catch (err) {
    console.warn("Purge default demo data check:", err.message);
  }
}

// Fetch all Repositories
export async function fetchRepositories() {
  try {
    const reposRef = ref(rtdb, "repositories");
    const snapshot = await get(reposRef);
    if (snapshot.exists()) {
      const data = snapshot.val();
      return Object.values(data).filter(r => r && !DEFAULT_DEMO_REPO_IDS.includes(r.id));
    } else {
      return [];
    }
  } catch (err) {
    const local = localStorage.getItem(LOCAL_STORAGE_REPOS_KEY);
    if (local) return JSON.parse(local).filter(r => r && !DEFAULT_DEMO_REPO_IDS.includes(r.id));
    return [];
  }
}

// Fetch all Questions
export async function fetchQuestions() {
  try {
    const qRef = ref(rtdb, "questions_answers");
    const snapshot = await get(qRef);
    if (snapshot.exists()) {
      const data = snapshot.val();
      return Object.values(data).filter(q => q && !DEFAULT_DEMO_QUESTION_IDS.includes(q.id));
    } else {
      return [];
    }
  } catch (err) {
    const local = localStorage.getItem(LOCAL_STORAGE_QUESTIONS_KEY);
    if (local) return JSON.parse(local).filter(q => q && !DEFAULT_DEMO_QUESTION_IDS.includes(q.id));
    return [];
  }
}

// Repository CRUD
export async function saveRepository(repo) {
  const id = repo.id || `repo-${Date.now()}`;
  const now = new Date().toISOString();
  const repoData = {
    ...repo,
    id,
    createdAt: repo.createdAt || now,
    updatedAt: now,
    visibility: repo.visibility || "Published"
  };

  try {
    await set(ref(rtdb, `repositories/${id}`), repoData);
  } catch (err) {
    console.warn("Firebase save error:", err);
  }

  const existing = await fetchRepositories();
  const index = existing.findIndex((r) => r.id === id);
  if (index >= 0) existing[index] = repoData;
  else existing.push(repoData);
  localStorage.setItem(LOCAL_STORAGE_REPOS_KEY, JSON.stringify(existing));

  return repoData;
}

export async function deleteRepository(repoId) {
  try {
    await remove(ref(rtdb, `repositories/${repoId}`));
    const allQuestions = await fetchQuestions();
    const remainingQuestions = allQuestions.filter(q => q.repositoryId !== repoId);
    const qMap = {};
    remainingQuestions.forEach(q => { qMap[q.id] = q; });
    await set(ref(rtdb, "questions_answers"), qMap);
    localStorage.setItem(LOCAL_STORAGE_QUESTIONS_KEY, JSON.stringify(remainingQuestions));
  } catch (err) {
    console.warn("Firebase delete error:", err);
  }

  const existing = await fetchRepositories();
  const filtered = existing.filter((r) => r.id !== repoId);
  localStorage.setItem(LOCAL_STORAGE_REPOS_KEY, JSON.stringify(filtered));

  return true;
}

// Clear All Repositories
export async function clearAllRepositories() {
  try {
    await set(ref(rtdb, "repositories"), {});
    await set(ref(rtdb, "questions_answers"), {});
  } catch (err) {
    console.warn("Error clearing database:", err);
  }
  localStorage.removeItem(LOCAL_STORAGE_REPOS_KEY);
  localStorage.removeItem(LOCAL_STORAGE_QUESTIONS_KEY);
  return true;
}

// Question CRUD
export async function saveQuestion(question) {
  const id = question.id || `q-${Date.now()}`;
  const now = new Date().toISOString();
  const questionData = {
    ...question,
    id,
    displayOrder: Number(question.displayOrder) || 1,
    createdAt: question.createdAt || now
  };

  try {
    await set(ref(rtdb, `questions_answers/${id}`), questionData);
  } catch (err) {
    console.warn("Firebase question save error:", err);
  }

  const existing = await fetchQuestions();
  const index = existing.findIndex((q) => q.id === id);
  if (index >= 0) existing[index] = questionData;
  else existing.push(questionData);
  localStorage.setItem(LOCAL_STORAGE_QUESTIONS_KEY, JSON.stringify(existing));

  return questionData;
}

export async function deleteQuestion(questionId) {
  try {
    await remove(ref(rtdb, `questions_answers/${questionId}`));
  } catch (err) {
    console.warn("Firebase question delete error:", err);
  }

  const existing = await fetchQuestions();
  const filtered = existing.filter((q) => q.id !== questionId);
  localStorage.setItem(LOCAL_STORAGE_QUESTIONS_KEY, JSON.stringify(filtered));

  return true;
}

// Realtime Listener for Repos
export function subscribeToRepositories(callback) {
  const reposRef = ref(rtdb, "repositories");
  return onValue(reposRef, (snapshot) => {
    if (snapshot.exists()) {
      const list = Object.values(snapshot.val()).filter(r => r && !DEFAULT_DEMO_REPO_IDS.includes(r.id));
      callback(list);
    } else {
      callback([]);
    }
  }, (err) => {
    console.warn("Realtime listener error:", err);
  });
}

// --- CONTESTS DB OPERATIONS ---

// Fetch all Contests
export async function fetchContests() {
  try {
    const contestsRef = ref(rtdb, "contests");
    const snapshot = await get(contestsRef);
    if (snapshot.exists()) {
      return Object.values(snapshot.val());
    } else {
      return [];
    }
  } catch (err) {
    console.warn("Error fetching contests, using local fallback:", err);
    const local = localStorage.getItem(LOCAL_STORAGE_CONTESTS_KEY);
    return local ? JSON.parse(local) : [];
  }
}

// Save Contest (Create or Update)
export async function saveContest(contest) {
  const id = contest.id || `contest-${Date.now()}`;
  const now = new Date().toISOString();
  const contestData = {
    ...contest,
    id,
    createdAt: contest.createdAt || now,
    updatedAt: now,
    status: contest.status || "Active"
  };

  try {
    await set(ref(rtdb, `contests/${id}`), contestData);
  } catch (err) {
    console.warn("Firebase contest save error:", err);
  }

  const existing = await fetchContests();
  const idx = existing.findIndex(c => c.id === id);
  if (idx >= 0) existing[idx] = contestData;
  else existing.push(contestData);
  localStorage.setItem(LOCAL_STORAGE_CONTESTS_KEY, JSON.stringify(existing));

  return contestData;
}

// Delete Contest
export async function deleteContest(contestId) {
  try {
    await remove(ref(rtdb, `contests/${contestId}`));
  } catch (err) {
    console.warn("Firebase contest delete error:", err);
  }

  const existing = await fetchContests();
  const filtered = existing.filter(c => c.id !== contestId);
  localStorage.setItem(LOCAL_STORAGE_CONTESTS_KEY, JSON.stringify(filtered));
  return true;
}

// Subscribe to Contests
export function subscribeToContests(callback) {
  const contestsRef = ref(rtdb, "contests");
  return onValue(contestsRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(Object.values(snapshot.val()));
    } else {
      callback([]);
    }
  }, (err) => {
    console.warn("Contests listener error:", err);
  });
}

// --- CONTEST APPLICATIONS DB OPERATIONS ---

export async function submitContestApplication(application) {
  const id = `app-${Date.now()}`;
  const now = new Date().toISOString();
  const appData = {
    ...application,
    id,
    status: application.status || 'Pending', // 'Pending' | 'Accepted' | 'Rejected'
    appliedAt: now
  };

  try {
    await set(ref(rtdb, `contest_applications/${id}`), appData);
  } catch (err) {
    console.warn("Firebase application save error:", err);
  }

  const localApps = localStorage.getItem(LOCAL_STORAGE_APPLICATIONS_KEY);
  const parsedApps = localApps ? JSON.parse(localApps) : [];
  parsedApps.push(appData);
  localStorage.setItem(LOCAL_STORAGE_APPLICATIONS_KEY, JSON.stringify(parsedApps));

  return appData;
}

export async function fetchContestApplications() {
  try {
    const appsRef = ref(rtdb, "contest_applications");
    const snapshot = await get(appsRef);
    if (snapshot.exists()) {
      return Object.values(snapshot.val());
    } else {
      return [];
    }
  } catch (err) {
    const local = localStorage.getItem(LOCAL_STORAGE_APPLICATIONS_KEY);
    return local ? JSON.parse(local) : [];
  }
}

export async function updateApplicationStatus(appId, newStatus) {
  try {
    await set(ref(rtdb, `contest_applications/${appId}/status`), newStatus);
  } catch (err) {
    console.warn("Firebase status update warning:", err);
  }

  const localApps = localStorage.getItem(LOCAL_STORAGE_APPLICATIONS_KEY);
  if (localApps) {
    const parsed = JSON.parse(localApps);
    const idx = parsed.findIndex(a => a.id === appId);
    if (idx >= 0) {
      parsed[idx].status = newStatus;
      localStorage.setItem(LOCAL_STORAGE_APPLICATIONS_KEY, JSON.stringify(parsed));
    }
  }
  return true;
}

export function subscribeToApplications(callback) {
  const appsRef = ref(rtdb, "contest_applications");
  return onValue(appsRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(Object.values(snapshot.val()));
    } else {
      callback([]);
    }
  }, (err) => {
    console.warn("Applications listener error:", err);
  });
}

// --- USER AUTHENTICATION & PROFILE LOCALSTORAGE / FIREBASE ---

const LOCAL_STORAGE_USERS_KEY = "hootminer_all_users";

export function getCurrentUser() {
  const localUser = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
  return localUser ? JSON.parse(localUser) : null;
}

export async function saveUserProfile(user) {
  const userData = {
    fullName: user.fullName,
    aadharNo: user.aadharNo,
    educationDegree: user.educationDegree, // '1st yr', '2nd yr', '3rd yr'
    gender: user.gender, // 'Male' or 'Female'
    contactEmail: user.contactEmail.toLowerCase(),
    password: user.password || '',
    createdAt: user.createdAt || new Date().toISOString()
  };

  localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(userData));

  // Save to list of all users
  const localUsers = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
  const parsedUsers = localUsers ? JSON.parse(localUsers) : [];
  const idx = parsedUsers.findIndex(u => u.contactEmail.toLowerCase() === userData.contactEmail.toLowerCase());
  if (idx >= 0) parsedUsers[idx] = userData;
  else parsedUsers.push(userData);
  localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(parsedUsers));

  try {
    const safeKey = userData.contactEmail.replace(/[^a-zA-Z0-9]/g, "_");
    await set(ref(rtdb, `users/${safeKey}`), userData);
  } catch (err) {
    console.warn("Firebase user save warning:", err);
  }

  return userData;
}

export async function loginUserAccount(email, password) {
  const cleanEmail = email.trim().toLowerCase();
  
  try {
    const safeKey = cleanEmail.replace(/[^a-zA-Z0-9]/g, "_");
    const snapshot = await get(ref(rtdb, `users/${safeKey}`));
    if (snapshot.exists()) {
      const user = snapshot.val();
      if (user.password === password) {
        localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(user));
        return { success: true, user };
      } else {
        return { success: false, message: "Incorrect password. Please check your credentials." };
      }
    }
  } catch (e) {
    console.warn("Firebase login check fallback to local storage:", e);
  }

  // Fallback to local storage list
  const localUsers = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
  const parsedUsers = localUsers ? JSON.parse(localUsers) : [];
  const user = parsedUsers.find(u => u.contactEmail.toLowerCase() === cleanEmail);

  if (user) {
    if (user.password === password) {
      localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(user));
      return { success: true, user };
    } else {
      return { success: false, message: "Incorrect password. Please check your credentials." };
    }
  }

  return { success: false, message: "No account found with this email. Please create a new account." };
}

export function logoutUser() {
  localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
}

