import axios from 'axios';
import {
  LL_BASE_URL,
  LL_API_KEY,
  LL_GAME_VERSION,
  LL_HEADERS,
  LEADERBOARD_KEY,
} from '@/constants/lootlocker';

// Persistent session storage so the token survives page reloads without
// requiring a full re-auth on every component mount.
const SESSION_KEY = 'll_session_token';
const PLAYER_ID_KEY = 'll_player_id';

const getStoredToken = () => sessionStorage.getItem(SESSION_KEY);
const getStoredPlayerId = () => sessionStorage.getItem(PLAYER_ID_KEY);

const persistSession = (token, playerId) => {
  sessionStorage.setItem(SESSION_KEY, token);
  sessionStorage.setItem(PLAYER_ID_KEY, String(playerId));
};

const client = axios.create({
  baseURL: LL_BASE_URL,
  headers: LL_HEADERS,
});

// Attach session token to every request automatically after login.
client.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) config.headers['x-session-token'] = token;
  config.headers['x-api-key'] = LL_API_KEY;
  return config;
});

/**
 * Start or resume a Guest Session with LootLocker.
 * Returns { sessionToken, playerId } on success.
 */
export async function startGuestSession() {
  const existingToken = getStoredToken();
  const existingPlayerId = getStoredPlayerId();

  // Reuse the cached session if available — avoids unnecessary round-trips.
  if (existingToken && existingPlayerId) {
    return { sessionToken: existingToken, playerId: existingPlayerId };
  }

  const { data } = await client.post('/v2/session/guest', {
    game_key: LL_API_KEY,
    game_version: LL_GAME_VERSION,
  });

  if (!data.success) throw new Error('LootLocker: Guest session failed');

  persistSession(data.session_token, data.player_id);
  return { sessionToken: data.session_token, playerId: data.player_id };
}

/**
 * Fetch the calling player's own entry from the high-score leaderboard.
 * Returns the numeric score, or 0 if no entry exists yet.
 */
export async function fetchMyHighScore() {
  const playerId = getStoredPlayerId();
  if (!playerId) return 0;

  try {
    const { data } = await client.get(
      `/leaderboards/${LEADERBOARD_KEY}/member/${playerId}`
    );
    return data?.member?.score ?? 0;
  } catch (err) {
    // 404 simply means no score submitted yet — not a hard failure.
    if (err.response?.status === 404) return 0;
    throw err;
  }
}

/**
 * Submit a new score. LootLocker keeps the personal best automatically.
 */
export async function submitScore(score) {
  const playerId = getStoredPlayerId();
  if (!playerId) throw new Error('LootLocker: No active session');

  const { data } = await client.post(`/leaderboards/${LEADERBOARD_KEY}/submit`, {
    member_id: String(playerId),
    score: Math.floor(score),
  });

  if (!data.success) throw new Error('LootLocker: Score submission failed');
  return data;
}

/**
 * Fetch the top-N global leaderboard entries.
 */
export async function fetchLeaderboard(count = 10) {
  const { data } = await client.get(
    `/leaderboards/${LEADERBOARD_KEY}/list?count=${count}`
  );
  return data?.items ?? [];
}
