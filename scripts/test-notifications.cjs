// Run with: node --test scripts/test-notifications.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(relative, dependencies = {}) {
  const filename = path.join(__dirname, '..', relative);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: filename,
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', source)((name) => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  }, module, module.exports);
  return module.exports;
}

const routing = load('lib/notificationRouting.ts');
const accountA = { userId: 'a', huddleId: 'huddle-a', huddleName: 'Monday group' };
const accountB = { userId: 'b', huddleId: 'huddle-b', huddleName: 'Friday group' };

function hooks() {
  const values = [];
  let cursor = 0;
  let dirty = false;
  let effects = [];
  return {
    react: {
      useState(initial) {
        const index = cursor++;
        if (!(index in values)) values[index] = initial;
        return [values[index], (next) => {
          values[index] = typeof next === 'function' ? next(values[index]) : next;
          dirty = true;
        }];
      },
      useRef(initial) {
        const index = cursor++;
        values[index] ??= { current: initial };
        return values[index];
      },
      useEffect(effect, dependencies) {
        const index = cursor++;
        const previous = values[index];
        if (previous && dependencies.every((value, i) => Object.is(value, previous.dependencies[i]))) return;
        effects.push(() => {
          previous?.cleanup?.();
          values[index] = { dependencies, cleanup: effect() };
        });
      },
    },
    render(callback) {
      let attempts = 0;
      do {
        assert.ok(attempts++ < 20, 'Hook should settle without a render loop');
        dirty = false;
        cursor = 0;
        callback();
        const nextEffects = effects;
        effects = [];
        nextEffects.forEach((effect) => effect());
      } while (dirty);
    },
  };
}

function environment(storage = new Map()) {
  const renderer = hooks();
  const state = {
    accounts: [accountA, accountB], token: 'ExponentPushToken[first]', failAccount: null,
    registered: new Map(), reminders: new Map(), navigations: [], alerts: [],
    lastResponse: null, responseListener: null, tokenListener: null,
  };
  const notifications = {
    setNotificationHandler() {},
    IosAuthorizationStatus: { PROVISIONAL: 3, EPHEMERAL: 4 },
    AndroidImportance: { HIGH: 4 },
    SchedulableTriggerInputTypes: { WEEKLY: 'weekly' },
    setNotificationChannelAsync: async () => {},
    getPermissionsAsync: async () => ({ granted: true }),
    getExpoPushTokenAsync: async () => ({ data: state.token }),
    cancelScheduledNotificationAsync: async (identifier) => { state.reminders.delete(identifier); },
    scheduleNotificationAsync: async (reminder) => { state.reminders.set(reminder.identifier, reminder); },
    getLastNotificationResponse: () => state.lastResponse,
    clearLastNotificationResponse: () => { state.lastResponse = null; },
    addNotificationResponseReceivedListener: (listener) => {
      state.responseListener = listener;
      return { remove() {} };
    },
    addPushTokenListener: (listener) => {
      state.tokenListener = listener;
      return { remove() {} };
    },
  };
  const api = load('lib/notifications.native.ts', {
    '@react-native-async-storage/async-storage': {
      getItem: async (key) => storage.get(key) ?? null,
      setItem: async (key, value) => { storage.set(key, value); },
    },
    'expo-constants': { expoConfig: { extra: { eas: { projectId: 'project' } } } },
    'expo-notifications': notifications,
    'expo-router': { router: { push: (url) => state.navigations.push(url) } },
    react: renderer.react,
    'react-native': { Platform: { OS: 'ios' } },
    '@/lib/accounts': {
      readSavedAccounts: async () => state.accounts,
      withSavedAccountClient: async (userId, callback) => {
        assert.ok(state.accounts.some((account) => account.userId === userId), 'Account must still be saved');
        if (userId === state.failAccount) throw new Error('Session expired');
        return callback({ rpc: async (name, { p_token }) => {
          const tokens = state.registered.get(userId) ?? new Set();
          if (name === 'register_push_token') tokens.add(p_token);
          else if (name === 'unregister_push_token') tokens.delete(p_token);
          else throw new Error(`Unexpected RPC: ${name}`);
          state.registered.set(userId, tokens);
          return { error: null };
        } });
      },
    },
    '@/lib/dialogs': { showAlert: (...args) => state.alerts.push(args) },
    '@/lib/notificationRouting': routing,
    '@/lib/supabase': { isRemoteConfigured: true },
  });
  return { api, state, renderer, storage };
}

test('device token registers for both accounts and rolls over for both', async () => {
  const { api, state } = environment();
  await api.enablePushNotifications();
  assert.deepEqual([...state.registered.get('a')], [state.token]);
  assert.deepEqual([...state.registered.get('b')], [state.token]);
  state.token = 'ExponentPushToken[second]';
  await api.enablePushNotifications();
  assert.deepEqual([...state.registered.get('a')], [state.token]);
  assert.deepEqual([...state.registered.get('b')], [state.token]);
});

test('one expired account does not prevent the other account registering', async () => {
  const { api, state } = environment();
  state.failAccount = 'a';
  await assert.rejects(api.enablePushNotifications(), /Session expired/);
  assert.deepEqual([...state.registered.get('b')], [state.token]);
});

test('sign-out after restart removes only that account and keeps the other reminder', async () => {
  const original = environment();
  await original.api.enablePushNotifications();
  const restarted = environment(original.storage);
  restarted.state.registered = original.state.registered;
  const meeting = { time: '2026-10-30T10:00:00', location: 'Church' };
  await restarted.api.scheduleMeetingReminder(meeting, accountA);
  await restarted.api.scheduleMeetingReminder(meeting, accountB);
  assert.equal(restarted.state.reminders.size, 2);
  await restarted.api.disablePushNotifications('a');
  assert.equal(restarted.state.registered.get('a').size, 0);
  assert.equal(restarted.state.registered.get('b').size, 1);
  assert.deepEqual([...restarted.state.reminders.keys()], ['meeting-reminder:b']);
  assert.equal(restarted.state.reminders.get('meeting-reminder:b').content.data.userId, 'b');
});

test('refresh and stale reminder queued during sign-out cannot resurrect the removed account', async () => {
  const { api, state } = environment();
  await api.enablePushNotifications();
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const logout = api.disablePushNotifications('a', async () => {
    await gate;
    state.accounts = [accountB];
  });
  const refresh = api.enablePushNotifications();
  const staleReminder = api.scheduleMeetingReminder({ time: '2026-10-30T10:00:00' }, accountA);
  release();
  await Promise.all([logout, refresh, staleReminder]);
  assert.equal(state.registered.get('a').size, 0);
  assert.equal(state.registered.get('b').size, 1);
  assert.equal(state.reminders.has('meeting-reminder:a'), false);
});

test('routes match the recipient and reject external, ambiguous, missing, or mismatched destinations', () => {
  const accounts = [accountA, accountB];
  assert.deepEqual(routing.notificationTarget({ url: '/meetings', userId: 'b', huddleId: 'huddle-b' }, accounts, 'a'), { userId: 'b', url: '/meetings' });
  assert.equal(routing.notificationTarget({ url: '/', huddleId: 'huddle-b' }, accounts, 'a').userId, 'b');
  assert.equal(routing.notificationTarget({ url: '/' }, [accountA], 'a').userId, 'a');
  assert.throws(() => routing.notificationTarget({ url: '/' }, accounts, 'a'), /older notification/);
  assert.throws(() => routing.notificationTarget({ url: '/', userId: 'missing' }, accounts, 'a'), /no longer signed in/);
  assert.throws(() => routing.notificationTarget({ url: '/', userId: 'a', huddleId: 'huddle-b' }, accounts, 'a'), /no longer in/);
  for (const url of ['https://example.com', '//example.com', '/settings', '/progress?member=x&url=bad']) {
    assert.equal(routing.notificationDestination(url), null);
  }
});

test('cold-start tap waits for auth and account hydration before navigating', async () => {
  const { api, state, renderer } = environment();
  state.lastResponse = {
    actionIdentifier: 'default',
    notification: { date: 1, request: { identifier: 'meeting-reminder:b', content: { data: { url: '/meetings', userId: 'b', huddleId: 'huddle-b' } } } },
  };
  let release;
  const switches = [];
  const options = {
    ready: false, userId: 'a', accounts: state.accounts,
    switchAccount: async (userId) => { switches.push(userId); await new Promise((resolve) => { release = resolve; }); },
  };
  const render = () => renderer.render(() => api.useNotificationTaps(options));
  render();
  assert.equal(switches.length, 0);
  options.ready = true;
  render();
  assert.deepEqual(switches, ['b']);
  assert.deepEqual(state.navigations, []);
  release();
  for (let i = 0; i < 8; i++) await Promise.resolve();
  render();
  assert.deepEqual(state.navigations, []);
  options.userId = 'b';
  render();
  assert.deepEqual(state.navigations, ['/meetings']);
  state.responseListener({
    actionIdentifier: 'default',
    notification: { date: 2, request: { identifier: 'meeting-reminder:b', content: { data: { url: '/meetings', userId: 'b', huddleId: 'huddle-b' } } } },
  });
  render();
  assert.deepEqual(state.navigations, ['/meetings', '/meetings']);
});
