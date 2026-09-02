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

// List of default demo IDs to purge permanently
const DEFAULT_DEMO_REPO_IDS = [
  'repo-c-1',
  'repo-c-2',
  'repo-py-1',
  'repo-java-1',
  'repo-java-2'
];

const DEFAULT_DEMO_QUESTION_IDS = [
  'q-c-1',
  'q-cpp-1',
  'q-cpp-2',
  'q-py-1',
  'q-java-1',
  'q-java-2'
];

// LocalStorage Keys
const LOCAL_STORAGE_REPOS_KEY = "hootminer_repos";
const LOCAL_STORAGE_QUESTIONS_KEY = "hootminer_questions";

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

// Fetch all Repositories (Filtering out demo IDs)
export async function fetchRepositories() {
  try {
    const reposRef = ref(rtdb, "repositories");
    const snapshot = await get(reposRef);
    if (snapshot.exists()) {
      const data = snapshot.val();
      const list = Object.values(data).filter(r => r && !DEFAULT_DEMO_REPO_IDS.includes(r.id));
      return list;
    } else {
      return [];
    }
  } catch (err) {
    console.warn("Error fetching repos from Firebase, checking local cache:", err);
    const local = localStorage.getItem(LOCAL_STORAGE_REPOS_KEY);
    if (local) {
      return JSON.parse(local).filter(r => r && !DEFAULT_DEMO_REPO_IDS.includes(r.id));
    }
    return [];
  }
}

// Fetch all Questions (Filtering out demo IDs)
export async function fetchQuestions() {
  try {
    const qRef = ref(rtdb, "questions_answers");
    const snapshot = await get(qRef);
    if (snapshot.exists()) {
      const data = snapshot.val();
      const list = Object.values(data).filter(q => q && !DEFAULT_DEMO_QUESTION_IDS.includes(q.id));
      return list;
    } else {
      return [];
    }
  } catch (err) {
    console.warn("Error fetching questions from Firebase, checking local cache:", err);
    const local = localStorage.getItem(LOCAL_STORAGE_QUESTIONS_KEY);
    if (local) {
      return JSON.parse(local).filter(q => q && !DEFAULT_DEMO_QUESTION_IDS.includes(q.id));
    }
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
    const repoRef = ref(rtdb, `repositories/${id}`);
    await set(repoRef, repoData);
  } catch (err) {
    console.warn("Firebase save error, writing to LocalStorage fallback:", err);
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
    const repoRef = ref(rtdb, `repositories/${repoId}`);
    await remove(repoRef);
    
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

// Clear All Repositories & Questions from Database
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
    const qRef = ref(rtdb, `questions_answers/${id}`);
    await set(qRef, questionData);
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
    const qRef = ref(rtdb, `questions_answers/${questionId}`);
    await remove(qRef);
  } catch (err) {
    console.warn("Firebase question delete error:", err);
  }

  const existing = await fetchQuestions();
  const filtered = existing.filter((q) => q.id !== questionId);
  localStorage.setItem(LOCAL_STORAGE_QUESTIONS_KEY, JSON.stringify(filtered));

  return true;
}

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
