// ---- Background Step Tracker ----
// Conta passos mesmo com o app fechado usando Periodic Background Sync.
//
// Limitações da web:
//  - O Accelerometer API só funciona em foreground (página ativa).
//  - O geolocation funciona no SW mas é throttled (~30s mínimo).
//  - Periodic Background Sync só existe no Chrome Android (PWA instalada).
//  - O browser decide quando rodar o sync (mínimo ~15 min, mas pode mais).
//
// Estratégia:
//  1. App ativo: acelerômetro conta passos em tempo real (já existe).
//  2. App em background: SW acorda a cada ~15 min via Periodic Sync,
//     pega a localização, calcula distância desde a última posição,
//     estima passos e salva no IndexedDB.
//  3. App volta ao foreground: lê do IndexedDB e mescla com os passos
//     do acelerômetro.
//
// IndexedDB "bgSteps" store:
//  - { key: "current", date, steps, km, lastLat, lastLng, lastTs }
//  - { key: "history", entries: [{ date, steps, km, ts }] }

const DB_NAME = "system-bg-steps";
const DB_VERSION = 1;
const STORE = "bgSteps";

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no indexedDB"));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

const EARTH_KM = 6371;
const STRIDE_M = 0.75; // passo médio

function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(a));
}

function estimateStepsFromKm(km) {
  if (!(km > 0)) return 0;
  return Math.round((km * 1000) / STRIDE_M);
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---- API pública ----

/**
 * Obtém a posição atual via geolocation (Promise).
 * Funciona tanto no SW quanto no main thread.
 */
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("no geolocation"));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
  });
}

/**
 * Salva um checkpoint de posição (chamado pelo SW no periodic sync).
 * Calcula a distância desde a última posição, estima passos e acumula.
 * Retorna { steps, km, totalSteps } do dia.
 */
export async function savePositionAndCount(lat, lng) {
  const today = todayStr();
  let current = await dbGet("current");

  // Novo dia → reseta o contador diário
  if (!current || current.date !== today) {
    current = { date: today, steps: 0, km: 0, lastLat: lat, lastLng: lng, lastTs: Date.now() };
  }

  let addedSteps = 0;
  let addedKm = 0;

  if (current.lastLat != null && current.lastLng != null) {
    const dist = haversineKm(current.lastLat, current.lastLng, lat, lng);
    // Ignora movimentos < 10 m (estático / ruído GPS)
    if (dist >= 0.01) {
      addedKm = dist;
      addedSteps = estimateStepsFromKm(dist);
    }
  }

  const updated = {
    ...current,
    steps: current.steps + addedSteps,
    km: current.km + addedKm,
    lastLat: lat,
    lastLng: lng,
    lastTs: Date.now(),
  };

  await dbPut("current", updated);

  // Salva no histórico diário (mantém últimos 30 dias)
  let history = (await dbGet("history")) || { entries: [] };
  const existing = history.entries.findIndex((e) => e.date === today);
  if (existing >= 0) {
    history.entries[existing] = { date: today, steps: updated.steps, km: updated.km, ts: Date.now() };
  } else {
    history.entries.push({ date: today, steps: updated.steps, km: updated.km, ts: Date.now() });
  }
  // Poda: mantém 30 dias
  if (history.entries.length > 30) {
    history.entries = history.entries.slice(-30);
  }
  await dbPut("history", history);

  return { steps: updated.steps, km: updated.km, totalSteps: updated.steps, addedSteps };
}

/**
 * Lê o estado atual do tracker (passos/km do dia).
 * Usado pelo app principal ao retomar do background.
 */
export async function getBackgroundSteps() {
  const today = todayStr();
  const current = await dbGet("current");
  if (!current || current.date !== today) {
    return { steps: 0, km: 0, lastTs: null };
  }
  return { steps: current.steps, km: current.km, lastTs: current.lastTs };
}

/**
 * Retorna o histórico de passos dos últimos N dias.
 */
export async function getStepsHistory(days = 7) {
  const history = (await dbGet("history")) || { entries: [] };
  return history.entries.slice(-days);
}

/**
 * Limpa dados antigos do IndexedDB (chamado pelo SW periodicamente).
 */
export async function cleanOldData() {
  const today = todayStr();
  const history = (await dbGet("history")) || { entries: [] };
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;
  history.entries = history.entries.filter((e) => e.date >= cutoffStr);
  await dbPut("history", history);
}

/**
 * Registra o Periodic Background Sync no service worker.
 * Só funciona no Chrome Android com PWA instalada.
 */
export async function registerPeriodicSync(registration) {
  if (!("periodicSync" in registration)) {
    return { supported: false, reason: "Periodic Background Sync não suportado neste navegador" };
  }
  try {
    const status = await navigator.permissions.query({ name: "periodic-background-sync" });
    if (status.state !== "granted") {
      return { supported: true, granted: false, reason: "Permissão de Periodic Sync negada" };
    }
    await registration.periodicSync.register("bg-step-tracker", {
      minInterval: 15 * 60 * 1000, // 15 minutos (browser decide o intervalo real)
    });
    return { supported: true, granted: true };
  } catch (e) {
    return { supported: false, reason: e.message || "Falha ao registrar periodic sync" };
  }
}

/**
 * Verifica se o Periodic Background Sync está ativo.
 */
export async function isPeriodicSyncActive() {
  if (!("serviceWorker" in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg || !("periodicSync" in reg)) return false;
    const status = await navigator.permissions.query({ name: "periodic-background-sync" });
    return status.state === "granted";
  } catch {
    return false;
  }
}
