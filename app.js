// NOTE: Puzzle is only considered "solved" through user entry,
// not via Reveal helpers.

'use strict';
// Session 8: keep a reference to the currently loaded puzzle UI + state
let CURRENT = null;

let MOBILE_INPUT = null;

function isTouchLikely() {
  // "Touch-first" device detection
  // Avoid treating desktop/laptop (even with touchscreen) as mobile.
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const noHover = window.matchMedia('(hover: none)').matches;
  return coarse && noHover;
}

function getMobileInput() {
  if (MOBILE_INPUT) return MOBILE_INPUT;
  MOBILE_INPUT = document.getElementById('mobileInput');
  return MOBILE_INPUT;
}

function focusMobileInput() {
  const input = $('mobileInput');
  if (!input) return;

  if (document.activeElement === input) return;

  const x = window.scrollX;
  const y = window.scrollY;

  try {
    input.focus({ preventScroll: true });
  } catch {
    input.focus();
  }

  requestAnimationFrame(() => window.scrollTo(x, y));
}

let MOBILE_FOCUS_LOCK_UNTIL = 0;

function suppressMobileRefocus(ms = 900) {
  MOBILE_FOCUS_LOCK_UNTIL = Date.now() + ms;
}

function isInteractiveControl(el) {
  if (!el) return false;
  const tag = (el.tagName || '').toUpperCase();
  if (
    tag === 'SELECT' ||
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'BUTTON' ||
    tag === 'A'
  ) {
    return true;
  }
  return Boolean(el.closest && el.closest('#configForm'));
}

function shouldAutoRefocusMobileInput() {
  if (!CURRENT) return false;
  if (!isTouchLikely()) return false;

  // If we recently interacted with controls, do NOT steal focus back yet.
  if (Date.now() < MOBILE_FOCUS_LOCK_UNTIL) return false;

  const ae = document.activeElement;

  // If a real control is focused (or we’re inside config), leave it alone.
  if (isInteractiveControl(ae)) return false;

  return true;
}

function $(id) {
  return document.getElementById(id);
}

// -----------------------------
// Theme
// -----------------------------
const THEME_STORAGE_KEY = 'crswrd_theme';

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function getStoredTheme() {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

function setStoredTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // If storage is blocked, we still allow toggling for this session.
  }
}

function updateThemeToggleLabel(theme) {
  const btn = $('themeToggleBtn');
  if (!btn) return;

  const isDark = theme === 'dark';

  // Show the CURRENT state (what you're in right now)
  btn.textContent = isDark ? '🌙 Dark' : '☀️ Light';

  // Keep aria-pressed tied to "dark mode is on"
  btn.setAttribute('aria-pressed', String(isDark));

  // Tooltip still explains the action
  btn.title = `Switch to ${isDark ? 'Light' : 'Dark'} mode`;
}

function applyTheme(theme) {
  // Use data-theme so CSS can switch tokens cleanly
  document.documentElement.setAttribute('data-theme', theme);

  // Keep the header button synced (icon + current theme name)
  updateThemeToggleLabel(theme);
}

function initTheme() {
  const stored = getStoredTheme();
  const initial = stored || getSystemTheme();
  applyTheme(initial);
  updateThemeToggleLabel(initial);

  // If user has NOT explicitly chosen a theme, follow system changes.
  if (!stored) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener?.('change', () => {
      if (!getStoredTheme()) applyTheme(getSystemTheme());
    });
  }

  const btn = $('themeToggleBtn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const current = document.documentElement.dataset.theme || getSystemTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setStoredTheme(next);
  });
}

// -----------------------------
// Preferences (Pack / Tone / Grid size)
// -----------------------------
const PREFS_STORAGE_KEY = 'crswrd_prefs_v1';

/**
 * Safe read of stored preferences.
 * Returns null if blocked/unavailable/corrupt.
 */
function getStoredPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Safe write of preferences. Silently no-ops if storage is blocked.
 */
function setStoredPrefs(prefs) {
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage might be blocked (private mode, strict settings, etc).
    // App still works without persistence.
  }
}

/**
 * Only set a <select> value if that option exists (prevents stale values).
 */
function setSelectIfValid(selectId, value) {
  const el = $(selectId);
  if (!el || typeof value !== 'string' || !value) return;

  const hasOption = Array.from(el.options).some((o) => o.value === value);
  if (hasOption) el.value = value;
}

/**
 * Read the current UI selections we care about for persistence.
 */
function readPrefsFromUI() {
  return {
    difficulty: $('difficulty')?.value || 'medium',
    pack: $('pack')?.value || 'general',
    tone: $('tone')?.value || 'serious',
    timeLength: $('timeLength')?.value || 'medium',
  };
}

/**
 * Apply stored preferences to the UI (if present and valid).
 */
function applyStoredPrefsToUI() {
  const prefs = getStoredPrefs();
  if (!prefs) return;

  setSelectIfValid('difficulty', prefs.difficulty);
  setSelectIfValid('pack', prefs.pack);
  setSelectIfValid('tone', prefs.tone);
  setSelectIfValid('timeLength', prefs.timeLength);
}

/**
 * Save current UI selections immediately.
 */
function persistPrefsFromUI() {
  setStoredPrefs(readPrefsFromUI());
}

/**
 * Wire dropdown changes so updates are persisted as soon as the user changes them.
 */
function wirePrefsPersistence() {
  const ids = ['difficulty', 'pack', 'tone', 'timeLength'];

  ids.forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('change', persistPrefsFromUI);
  });
}

function readConfig() {
  return {
    difficulty: $('difficulty').value,
    pack: $('pack').value,
    tone: $('tone').value,
    timeLength: $('timeLength').value,
  };
}

function logConfig(config) {
  console.group('CRSWRD | Generate Puzzle (Phase 1)');
  console.table(config);
  console.groupEnd();
}

function setStatus(message) {
  const el = document.getElementById('status');
  if (el) el.textContent = message;
}

function collapseConfigPanel(shouldCollapse) {
  const panel = document.querySelector('.panel');
  const toggleBtn = $('toggleConfigBtn');

  if (!panel || !toggleBtn) return;

  panel.classList.toggle('is-collapsed', shouldCollapse);
  toggleBtn.setAttribute('aria-expanded', String(!shouldCollapse));
}

function init() {
  initTheme();

  const form = $('configForm');

  if (!form) {
    console.error('CRSWRD: configForm not found. Check index.html IDs.');
    return;
  }

  // 1) Restore saved preferences before we generate anything.
  applyStoredPrefsToUI();

  // 2) Persist any changes as the user tweaks dropdowns.
  wirePrefsPersistence();

  // Mobile: allow settings controls (dropdowns) to open without us stealing focus back.
  form.addEventListener('pointerdown', () => suppressMobileRefocus(1200), true);

  form.addEventListener('focusin', () => suppressMobileRefocus(1200), true);

  // Settings toggle should be wired once (not on every submit)
  const toggleBtn = $('toggleConfigBtn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const panel = document.querySelector('.panel');
      const isCollapsed = panel?.classList.contains('is-collapsed') ?? false;
      collapseConfigPanel(!isCollapsed);
      setStatus(isCollapsed ? 'Settings opened.' : 'Settings hidden.');
    });
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const config = readConfig();
    logConfig(config);

    // Save selections even if the user didn't touch the dropdowns this time.
    persistPrefsFromUI();

    // Phase 3: Load puzzle from selected pack (data-driven)
    initCrosswordFromSelections();

    setStatus('Puzzle ready.');

    const stageText = document.querySelector('.stage-text');
    if (stageText) {
      stageText.textContent = `Puzzle generated. Grid size: ${config.timeLength}.`;
    }

    // Mobile behavior: collapse config panel after generate
    if (window.matchMedia('(max-width: 520px)').matches) {
      collapseConfigPanel(true);
      setStatus('Settings captured. Panel collapsed for gameplay.');
    }
  });

  // Keyboard sanity: Ctrl/Command + Enter submits, Escape clears focus
  document.addEventListener('keydown', (e) => {
    const isSubmitCombo = (e.ctrlKey || e.metaKey) && e.key === 'Enter';
    if (isSubmitCombo) {
      e.preventDefault();
      form.requestSubmit();
      return;
    }

    // Escape clears focus (useful if a dropdown gets “stuck” in focus
    if (e.key === 'Escape') {
      const active = document.activeElement;
      if (active && typeof active.blur === 'function') {
        active.blur();
        setStatus('Focus cleared.');
      }
    }
  });

  initCrosswordFromSelections();
  wireCheckButtons();
  wireMobileKeyboard();

  console.info('CRSWRD: Phase 2 UI loaded (static crossword, no generation).');
}

/**
 *  Packs (data-driven puzzles)
 *
 * Schema (per pack):
 * PACKS[packId] = {
 *   id: string,
 *   name: string,
 *   puzzles: [
 *     {
 *       id: string,
 *       title: string,
 *       grid: string[], // each string is a row, '#' = block
 *       clues: {
 *         serious: { across: Record<startKey, string>, down: Record<startKey, string> },
 *         funny:   { across: Record<startKey, string>, down: Record<startKey, string> }
 *       }
 *     }
 *   ]
 * }
 *
 * Note: startKey uses the Phase 2 convention: "r{row}c{col}" at the START of an entry.
 */
const PACKS = {
  general: {
    id: 'general',
    name: 'General',
    //  Word bank used by the generator (Across-only for now).
    // Each item can carry tone variants for clues.
    wordBank: [
      // ── 3-letter glue + fallback coverage
      {
        word: 'ERA',
        serious: 'Long period of time',
        funny: 'History’s chapter label',
      },
      { word: 'ORE', serious: 'Mined material', funny: 'Rock with goals' },
      {
        word: 'EMU',
        serious: 'Flightless bird',
        funny: 'Bird that chose legs over wings',
      },
      {
        word: 'ADO',
        serious: 'Commotion or fuss',
        funny: 'Noise with no payoff',
      },
      {
        word: 'EKE',
        serious: '___ out a living',
        funny: 'Barely making it work',
      },
      {
        word: 'AGE',
        serious: 'How old someone is',
        funny: 'Years since you had energy',
      },
      {
        word: 'ASP',
        serious: 'Egyptian snake',
        funny: 'Danger noodle, ancient edition',
      },
      { word: 'ICY', serious: 'Slippery or cold', funny: 'Cold with attitude' },
      {
        word: 'SPA',
        serious: 'Place for a massage',
        funny: 'Relaxation headquarters',
      },
      { word: 'USE', serious: 'To employ', funny: 'Put it to work' },
      { word: 'ODD', serious: 'Not even', funny: 'Math’s rebel' },
      { word: 'OLD', serious: 'Ancient', funny: 'Vintage, but tired' },
      { word: 'ANY', serious: 'Whichever one', funny: 'Dealer’s choice' },
      { word: 'OWN', serious: 'To possess', funny: 'Mine, officially' },
      {
        word: 'AXE',
        serious: 'Chopping tool',
        funny: 'Tree’s least favorite thing',
      },

      {
        word: 'CAT',
        serious: 'Feline friend',
        funny: 'Small boss with whiskers',
      },
      {
        word: 'DOG',
        serious: 'Canine companion',
        funny: 'Professional tail wag',
      },
      { word: 'TAR', serious: 'Sticky black substance', funny: 'Road glue' },
      { word: 'RAT', serious: 'Common rodent', funny: 'Tiny schemer' },
      {
        word: 'OWL',
        serious: 'Nocturnal bird of prey',
        funny: 'Night shift bird',
      },
      { word: 'SUN', serious: 'Daytime star', funny: 'Sky flashlight' },
      { word: 'MOON', serious: 'Night sky body', funny: 'Earth’s night lamp' },
      { word: 'SKY', serious: 'What’s above', funny: 'Cloud parking lot' },
      { word: 'SEA', serious: 'Saltwater body', funny: 'Big splash zone' },
      { word: 'ICE', serious: 'Frozen water', funny: 'Slippery trouble' },
      { word: 'FIR', serious: 'Evergreen tree', funny: 'Holiday scent source' },
      { word: 'TOR', serious: 'Rocky hill', funny: 'Nature’s speed bump' },
      {
        word: 'DAR',
        serious: 'Give (Spanish)',
        funny: 'To hand it over, en español',
      },
      { word: 'GOT', serious: 'Received', funny: 'Ended up with' },

      // ── 4-letter sweet spot
      {
        word: 'AREA',
        serious: 'Space or region',
        funny: 'A patch of somewhere',
      },
      { word: 'ECHO', serious: 'Repeated sound', funny: 'Sound’s copy-paste' },
      {
        word: 'ALOE',
        serious: 'Soothing plant',
        funny: 'Nature’s first aid gel',
      },
      {
        word: 'OPAL',
        serious: 'Iridescent gem',
        funny: 'Rock with a light show',
      },
      { word: 'IDEA', serious: 'A thought', funny: 'Brain spark' },
      {
        word: 'ICON',
        serious: 'Symbol on a screen',
        funny: 'Tiny picture with big responsibility',
      },
      { word: 'EXIT', serious: 'Way out', funny: 'The escape hatch' },
      { word: 'OMIT', serious: 'To leave out', funny: 'Delete with manners' },
      {
        word: 'ITEM',
        serious: 'Entry on a list',
        funny: 'One thing in the pile',
      },
      { word: 'ONCE', serious: 'Formerly', funny: 'Back when' },
      { word: 'EASY', serious: 'Not difficult', funny: 'Low-stress mode' },
      { word: 'ABLE', serious: 'Having the power', funny: 'Can do' },
      { word: 'ARID', serious: 'Very dry', funny: 'Moisture-free zone' },
      { word: 'ETCH', serious: 'To engrave', funny: 'Scratch with purpose' },
      {
        word: 'UNIT',
        serious: 'Single part',
        funny: 'One piece of the puzzle',
      },
      { word: 'SOLO', serious: 'By oneself', funny: 'Party of one' },
      { word: 'ORAL', serious: 'Spoken', funny: 'Said out loud' },
      { word: 'OPEN', serious: 'Not closed', funny: 'Unlocked vibes' },
      {
        word: 'USER',
        serious: 'One on a computer',
        funny: 'The person clicking everything',
      },
      { word: 'EDGE', serious: 'The brink', funny: 'Where things get spicy' },

      // ── 5-letter connectors
      { word: 'ADIEU', serious: 'French goodbye', funny: 'Fancy “see ya”' },
      {
        word: 'OCEAN',
        serious: 'The deep blue',
        funny: 'Planet’s splash zone',
      },
      {
        word: 'ALERT',
        serious: 'On one’s toes',
        funny: 'Eyes open, coffee engaged',
      },
      {
        word: 'ASIDE',
        serious: 'Stage whisper',
        funny: 'Quick off-to-the-side note',
      },
      {
        word: 'EVENT',
        serious: 'Happening',
        funny: 'Thing that interrupts your plans',
      },
      { word: 'USAGE', serious: 'Way of using', funny: 'How it gets used up' },
      { word: 'IMAGE', serious: 'Picture', funny: 'Visual proof' },
      { word: 'ALTER', serious: 'To change', funny: 'Switch it up' },
      { word: 'OUTER', serious: 'External', funny: 'On the outside' },
      {
        word: 'INPUT',
        serious: 'Computer data',
        funny: 'What you feed the machine',
      },
      {
        word: 'EXTRA',
        serious: 'More than needed',
        funny: 'Bonus for no reason',
      },
      { word: 'ABOUT', serious: 'Regarding', funny: 'Topic: this thing' },
      { word: 'BASIC', serious: 'Fundamental', funny: 'The starter pack' },
      { word: 'CLEAR', serious: 'Transparent', funny: 'See-through truth' },
      { word: 'DAILY', serious: 'Every day', funny: 'On repeat' },
      {
        word: 'FOCUS',
        serious: 'Center of attention',
        funny: 'Brain spotlight',
      },
      { word: 'GIANT', serious: 'Huge', funny: 'Big enough to notice' },
      { word: 'HAPPY', serious: 'Joyful', funny: 'Mood: up' },
      { word: 'INNER', serious: 'Inside', funny: 'Core zone' },
      { word: 'LEVEL', serious: 'Flat', funny: 'Even-steven' },

      // ── 6-letter utility
      { word: 'ACTION', serious: 'Movement', funny: 'Do the thing' },
      {
        word: 'ADVICE',
        serious: 'Guidance',
        funny: 'Free opinions, fresh today',
      },
      { word: 'COMMON', serious: 'Ordinary', funny: 'The default setting' },
      {
        word: 'DETAIL',
        serious: 'Specific point',
        funny: 'The part people argue about',
      },
      {
        word: 'ENERGY',
        serious: 'Vigor',
        funny: 'The thing coffee pretends to be',
      },
      { word: 'FUTURE', serious: 'Time to come', funny: 'Not here yet' },
      {
        word: 'GROWTH',
        serious: 'Increase',
        funny: 'Getting bigger on purpose',
      },
      { word: 'IMPACT', serious: 'Effect', funny: 'The “that mattered” part' },
      {
        word: 'METHOD',
        serious: 'Way of doing',
        funny: 'Steps that (sometimes) work',
      },
      { word: 'NATURE', serious: 'The outdoors', funny: 'Where bugs live' },
      { word: 'OBJECT', serious: 'Item', funny: 'Thing with a job' },
      { word: 'RESULT', serious: 'Outcome', funny: 'What you get at the end' },
      { word: 'SIMPLE', serious: 'Easy', funny: 'No drama required' },
      {
        word: 'UNIQUE',
        serious: 'One of a kind',
        funny: 'No duplicates allowed',
      },
      {
        word: 'AGENDA',
        serious: 'List of things to do',
        funny: 'Plans that will be ignored',
      },
      { word: 'AMOUNT', serious: 'Quantity', funny: 'How much we’re talking' },

      // ── 7+ anchors
      { word: 'EXAMPLE', serious: 'Instance', funny: 'Proof by showing' },
      {
        word: 'GENERAL',
        serious: 'Not specific',
        funny: 'Covers a lot of ground',
      },
      {
        word: 'HISTORY',
        serious: 'The past',
        funny: 'Everything that already happened',
      },
      {
        word: 'JOURNEY',
        serious: 'A long trip',
        funny: 'The scenic route of life',
      },
      {
        word: 'LIBRARY',
        serious: 'Place for books',
        funny: 'Quiet building full of stories',
      },
      {
        word: 'MESSAGE',
        serious: 'Communication',
        funny: 'Text with a mission',
      },
      {
        word: 'OPINION',
        serious: 'Personal view',
        funny: 'Belief with volume',
      },
      {
        word: 'PATTERN',
        serious: 'Regular design',
        funny: 'The repeat that gives it away',
      },
      {
        word: 'SCIENCE',
        serious: 'Study of nature',
        funny: 'Testing your assumptions',
      },
      {
        word: 'SERVICE',
        serious: 'Help provided',
        funny: 'Someone doing the thing for you',
      },
      { word: 'THOUGHT', serious: 'Mental product', funny: 'Brain note' },
      { word: 'UNKNOWN', serious: 'Not identified', funny: 'Mystery status' },
      { word: 'VARIETY', serious: 'A mix', funny: 'Not the same thing again' },
      { word: 'WEATHER', serious: 'Climate state', funny: 'Small talk fuel' },
      { word: 'BALANCE', serious: 'Stability', funny: 'Not falling over' },
    ],

    puzzles: [
      {
        id: 'gen-001',
        title: 'Tiny Animals',
        difficulty: 'easy',
        grid: ['CAT#DOG', 'A#O#A#O', 'TAR#RAT', '###A###', 'OWL#EMU'],
        clues: {
          serious: {
            across: {
              r0c0: 'Feline friend',
              r0c4: 'Canine companion',
              r2c0: 'Sticky black substance',
              r2c4: 'Common rodent',
              r4c0: 'Nocturnal bird of prey',
              r4c4: 'Australian bird (short name)',
            },
            down: {
              r0c0: 'A loud reaction to prices',
              r0c1: 'Second letter of the alphabet',
              r0c2: 'A warm drink starter (tea, for example)',
              r0c4: 'Not a cat (in this tiny grid)',
              r0c5: 'Round vowel',
              r0c6: 'Another round vowel',
            },
          },
          funny: {
            across: {
              r0c0: 'Soft roommate who judges you',
              r0c4: 'Walks you, not the other way around',
              r2c0: 'What your shoes find on fresh asphalt',
              r2c4: 'Kitchen gremlin with whiskers',
              r4c0: 'Feathered glare machine',
              r4c4: 'Bird that looks like it has opinions',
            },
            down: {
              r0c0: 'Noise you make when rent increases',
              r0c1: 'B’s quieter cousin',
              r0c2: 'Hot drink entry point',
              r0c4: 'Natural enemy of your clean floor',
              r0c5: 'O, but make it dramatic',
              r0c6: 'O again, because why not',
            },
          },
        },
      },

      {
        id: 'gen-002',
        title: 'Tiny Words',
        difficulty: 'medium',
        grid: ['SUN#MOON', 'A#I#E#A', 'SKY#SEA', '###O###', 'ICE#FIR'],
        clues: {
          serious: {
            across: {
              r0c0: 'Daytime star',
              r0c4: 'Nighttime companion',
              r2c0: 'What clouds live in',
              r2c4: 'Large body of saltwater',
              r4c0: 'Frozen water',
              r4c4: 'Type of tree',
            },
            down: {
              r0c0: 'Opposite of night',
              r0c1: 'First vowel',
              r0c2: 'Ninth letter',
            },
          },
          funny: {
            across: {
              r0c0: 'The thing that wakes you up',
              r0c4: 'Romantic rock in the sky',
              r2c0: 'Cloud apartment',
              r2c4: 'Big salty splash zone',
              r4c0: 'Slippery regret',
              r4c4: 'Tree that smells like Christmas',
            },
            down: {
              r0c0: 'When alarms happen',
              r0c1: 'A, but louder',
              r0c2: 'I, standing alone',
            },
          },
        },
      },
    ],
  },

  movies: {
    id: 'movies',
    name: 'Movies',
    wordBank: [
      // 3-letter glue
      {
        word: 'SET',
        serious: 'Where filming happens',
        funny: 'Workplace with fake walls',
      },
      {
        word: 'CAM',
        serious: 'Camera, short form',
        funny: 'The eye that never blinks',
      },
      {
        word: 'CUT',
        serious: 'Director’s shout',
        funny: 'Everyone freeze instantly',
      },
      {
        word: 'BIO',
        serious: 'Life story film',
        funny: 'Wikipedia with a budget',
      },
      { word: 'ACT', serious: 'A movie segment', funny: 'Drama in chunks' },
      {
        word: 'CUE',
        serious: 'Actor’s signal',
        funny: 'Your turn, don’t mess up',
      },
      { word: 'POP', serious: '___corn', funny: 'Snack sound effect' },
      { word: 'ACE', serious: 'Top performer', funny: 'Best at pretending' },
      { word: 'HIT', serious: 'Box office success', funny: 'Money printer' },
      {
        word: 'FIN',
        serious: 'The end, in French',
        funny: 'Fancy way to stop',
      },
      {
        word: 'SPY',
        serious: 'Secret agent type',
        funny: 'Trust issues with gadgets',
      },
      { word: 'RED', serious: 'Carpet color', funny: 'Celebrity runway' },
      {
        word: 'DUB',
        serious: 'Voice replacement',
        funny: 'Mouth doesn’t match',
      },
      { word: 'FAN', serious: 'Movie buff', funny: 'Claps during credits' },
      {
        word: 'ART',
        serious: 'Creative craft',
        funny: 'When it works, it’s magic',
      },
      { word: 'MAP', serious: 'A guide', funny: 'Directions for your brain' },

      // 4-letter sweet spot
      { word: 'PLOT', serious: 'Storyline', funny: 'Reason explosions happen' },
      { word: 'STAR', serious: 'Leading actor', funny: 'Paid to be noticed' },
      {
        word: 'CAST',
        serious: 'Film ensemble',
        funny: 'Group chat with trailers',
      },
      { word: 'ROLE', serious: 'Actor’s part', funny: 'Your fake job' },
      {
        word: 'FILM',
        serious: 'The medium',
        funny: 'Moving pictures, officially',
      },
      {
        word: 'LENS',
        serious: 'Camera glass',
        funny: 'Very expensive eyeball',
      },
      { word: 'EPIC', serious: 'Grand-scale movie', funny: 'Long and loud' },
      {
        word: 'NOIR',
        serious: 'Dark film genre',
        funny: 'Lights turned down, vibes turned up',
      },
      {
        word: 'CREW',
        serious: 'Film workers',
        funny: 'People who actually do things',
      },
      {
        word: 'PROP',
        serious: 'On-set object',
        funny: 'Fake thing with real rules',
      },
      { word: 'BOOM', serious: 'Sound mic', funny: 'Pole of awkwardness' },
      { word: 'TAKE', serious: 'Filmed attempt', funny: 'Try number many' },
      {
        word: 'RAVE',
        serious: 'Great review',
        funny: 'Critic enthusiasm spike',
      },
      {
        word: 'ICON',
        serious: 'Legendary star',
        funny: 'Famous enough to be a noun',
      },
      {
        word: 'EDIT',
        serious: 'Post-production cut',
        funny: 'Fix it later button',
      },
      {
        word: 'HERO',
        serious: 'Protagonist',
        funny: 'Bad decisions, good music',
      },
      {
        word: 'FLOP',
        serious: 'Box office failure',
        funny: 'Budget goes poof',
      },
      {
        word: 'CULT',
        serious: '___ classic',
        funny: 'Loved by exactly everyone online',
      },
      {
        word: 'SLOT',
        serious: 'Screening time',
        funny: 'Calendar square of hope',
      },

      // 5-letter connectors
      { word: 'OSCAR', serious: 'Film award', funny: 'Gold man of judgment' },
      {
        word: 'SCENE',
        serious: 'Single sequence',
        funny: 'One chunk of drama',
      },
      {
        word: 'GENRE',
        serious: 'Type of film',
        funny: 'Shelf label for vibes',
      },
      { word: 'DRAMA', serious: 'Serious movie', funny: 'Feelings turned up' },
      { word: 'SHORT', serious: 'Brief film', funny: 'Snack-sized cinema' },
      {
        word: 'CAMEO',
        serious: 'Brief appearance',
        funny: 'Celebrity jump-scare',
      },
      {
        word: 'INDIE',
        serious: 'Independent film',
        funny: 'Low budget, high feelings',
      },
      { word: 'STUNT', serious: 'Action feat', funny: 'Insurance paperwork' },
      { word: 'SCRIPT', serious: 'Written lines', funny: 'Plan before chaos' },
      {
        word: 'AWARD',
        serious: 'Trophy',
        funny: 'Shelf decoration with opinions',
      },
      {
        word: 'EXTRA',
        serious: 'Background actor',
        funny: 'Professional walker-by',
      },
      {
        word: 'SCORE',
        serious: 'Film music',
        funny: 'Emotional remote control',
      },
      {
        word: 'AUDIO',
        serious: 'Sound track',
        funny: 'The part you notice when it’s bad',
      },
      { word: 'MOVIE', serious: 'The flick', funny: 'Two hours of commitment' },
      { word: 'GUILD', serious: 'Actors’ union', funny: 'Rules with lawyers' },
      { word: 'THEME', serious: 'Main idea', funny: 'The point, allegedly' },
      { word: 'TITLE', serious: 'The name', funny: 'The hook before watching' },
      { word: 'HORROR', serious: 'Scary genre', funny: 'Lights on required' },
      {
        word: 'INTRO',
        serious: 'Opening section',
        funny: 'Where vibes are set',
      },
      {
        word: 'FINAL',
        serious: '___ cut',
        funny: 'The “we swear this is done” version',
      },

      // 6-letter utility
      {
        word: 'ACTION',
        serious: 'Director’s call',
        funny: 'Chaos begins here',
      },
      { word: 'SEQUEL', serious: 'Part two', funny: 'Because money' },
      { word: 'COMEDY', serious: 'Funny film', funny: 'Jokes per minute' },
      {
        word: 'SERIES',
        serious: 'Film franchise',
        funny: 'The never-ending story',
      },
      {
        word: 'CINEMA',
        serious: 'Movie theater',
        funny: 'Snack venue with seats',
      },
      {
        word: 'SCREEN',
        serious: 'Display surface',
        funny: 'The big rectangle',
      },
      { word: 'STUDIO', serious: 'Production house', funny: 'Budget funnel' },
      {
        word: 'REMAKE',
        serious: 'New version',
        funny: 'Same plot, new haircut',
      },
      {
        word: 'CAMERA',
        serious: 'Filming tool',
        funny: 'Reality capture device',
      },
      { word: 'EDITOR', serious: 'Cuts the film', funny: 'Fixer of mistakes' },
      {
        word: 'ACTING',
        serious: 'The craft',
        funny: 'Professional pretending',
      },
      { word: 'SCIFI', serious: 'Space genre', funny: 'Lasers and feelings' },
      { word: 'VISUAL', serious: '___ effects', funny: 'The shiny stuff' },
      {
        word: 'REVIEW',
        serious: 'Critic write-up',
        funny: 'Opinion with adjectives',
      },
      {
        word: 'CANNES',
        serious: 'Film festival',
        funny: 'Red carpet Olympics',
      },

      // 7+ anchors
      { word: 'DIRECTOR', serious: 'Person in charge', funny: 'Chief decider' },
      {
        word: 'PRODUCER',
        serious: 'Project manager',
        funny: 'Spreadsheet hero',
      },
      {
        word: 'TRAILER',
        serious: 'Movie preview',
        funny: 'Spoilers in two minutes',
      },
      {
        word: 'POPCORN',
        serious: 'Theater snack',
        funny: 'Audible commitment',
      },
      { word: 'WESTERN', serious: 'Cowboy genre', funny: 'Hats and dust' },
      { word: 'PREQUEL', serious: 'Origin story', funny: 'Before the thing' },
      {
        word: 'ANIMATED',
        serious: 'Cartoon style',
        funny: 'Drawings that move',
      },
      {
        word: 'BACKLOT',
        serious: 'Outdoor set',
        funny: 'Fake streets, real sun',
      },
      { word: 'SHOWTIME', serious: 'Starting hour', funny: 'Sit down now' },
      {
        word: 'PREMIERE',
        serious: 'Opening night',
        funny: 'Flashbulbs and nerves',
      },
      { word: 'NOMINEE', serious: 'Award hopeful', funny: 'Almost a winner' },
      {
        word: 'BOXOFFICE',
        serious: 'Ticket sales',
        funny: 'Wallet scoreboard',
      },
      {
        word: 'MUSICAL',
        serious: 'Singing film',
        funny: 'Feelings with choreography',
      },
      {
        word: 'THRILLER',
        serious: 'Suspense genre',
        funny: 'Edge-of-seat business',
      },
      {
        word: 'STARRING',
        serious: 'Featuring',
        funny: 'Name before the title',
      },
      {
        word: 'DIALOGUE',
        serious: 'Spoken words',
        funny: 'Talking, but scripted',
      },
      {
        word: 'VILLAIN',
        serious: 'Antagonist',
        funny: 'Bad plans, good outfits',
      },
      {
        word: 'CLIMAX',
        serious: 'Peak moment',
        funny: 'Everything explodes here',
      },
      { word: 'COSTUME', serious: 'Wardrobe', funny: 'Clothes with a job' },
      {
        word: 'MATINEE',
        serious: 'Daytime show',
        funny: 'Sunlight-friendly viewing',
      },
      {
        word: 'MONTAGE',
        serious: 'Fast-cut sequence',
        funny: 'Time compression magic',
      },
      {
        word: 'SUBTITLE',
        serious: 'On-screen text',
        funny: 'Reading while watching',
      },
      { word: 'BLOCKBUSTER', serious: 'Major hit', funny: 'Budget goes brrrr' },
      {
        word: 'SCREENPLAY',
        serious: 'Film script',
        funny: 'Stress in document form',
      },
      {
        word: 'TECHNICOLOR',
        serious: 'Early color film process',
        funny: 'Vintage saturation',
      },
      {
        word: 'DOCUMENTARY',
        serious: 'True story film',
        funny: 'Reality with edits',
      },
      {
        word: 'PROJECTOR',
        serious: 'Theater machine',
        funny: 'The real star of the room',
      },
      {
        word: 'SOUNDTRACK',
        serious: 'Movie songs',
        funny: 'The memory trigger',
      },
      {
        word: 'CASTING',
        serious: 'Hiring actors',
        funny: 'Choosing the chaos',
      },
      {
        word: 'CINEMATOGRAPHY',
        serious: 'Film visuals',
        funny: 'Making light look expensive',
      },
    ],

    puzzles: [
      {
        id: 'mov-001',
        title: 'Mini Movie Grid',
        difficulty: 'easy',
        grid: ['JAW#S', 'A#I#E', 'WSH#R', '###A#', 'UP##!'],
        clues: {
          serious: {
            across: {
              r0c0: 'Shark thriller (start)',
              r0c4: 'Plural letter',
              r2c0: 'Clean up with water (start)',
              r2c4: 'Pirate’s “Arrr” (short)',
              r4c0: 'Pixar film about lifting off',
              r4c4: 'Exclamation mark, literally',
            },
            down: {
              r0c0: 'First letter of the alphabet (again)',
              r0c2: 'Pronoun for self',
              r0c4: 'Fifth vowel',
            },
          },
          funny: {
            across: {
              r0c0: 'Movie that made beaches suspicious',
              r0c4: 'Letters, but more of them',
              r2c0: 'What you do after stepping in mud',
              r2c4: 'Pirate noise in text form',
              r4c0: 'The movie where the house said “yeet”',
              r4c4: 'Punctuation with attitude',
            },
            down: {
              r0c0: 'A, the original',
              r0c2: 'Me, myself, and I',
              r0c4: 'E, the underused vowel',
            },
          },
        },
      },
    ],
  },

  music: {
    id: 'music',
    name: 'Music',
    wordBank: [
      {
        word: 'AIR',
        serious: 'A melodic song or tune',
        funny: 'What a singer needs to avoid turning blue',
      },
      {
        word: 'ALT',
        serious: 'Prefix for a high rock genre',
        funny: 'The key next to "Control" and "Delete"',
      },
      {
        word: 'BAR',
        serious: 'A measure in music',
        funny: 'The only place a musician can find a drink',
      },
      {
        word: 'KEY',
        serious: 'Scale foundation',
        funny: 'What you lose in your pocket and on a piano',
      },
      {
        word: 'SOL',
        serious: 'Fifth note of the scale',
        funny: 'A sun-drenched musical syllable',
      },
      {
        word: 'SAX',
        serious: 'Jazz wind instrument',
        funny: "Bill Clinton's favorite brassy woodwind",
      },

      {
        word: 'ALTO',
        serious: 'Lower female voice',
        funny: 'The singer who lives in the basement of the staff',
      },
      {
        word: 'BASS',
        serious: 'Lowest musical range',
        funny: 'A deep sound or a fish with a rhythm',
      },
      {
        word: 'BEAT',
        serious: 'Rhythmic pulse',
        funny: 'What a drummer does for a living',
      },
      {
        word: 'CLEF',
        serious: 'Musical notation symbol',
        funny: 'A "Treble" maker\'s favorite sign',
      },
      {
        word: 'DUET',
        serious: 'Performance for two',
        funny: 'A musical "it takes two to tango"',
      },
      {
        word: 'ECHO',
        serious: 'Sound reflection',
        funny: 'The only person who talks back to a singer',
      },
      {
        word: 'FLAT',
        serious: 'Lowered by a semitone',
        funny: 'A singer’s nightmare or a tired tire',
      },
      {
        word: 'GONG',
        serious: 'Large metal percussion',
        funny: 'A loud way to tell a bad act to leave',
      },
      {
        word: 'HARP',
        serious: 'Plucked string instrument',
        funny: 'An angel’s preferred "heavy metal"',
      },
      {
        word: 'HYMN',
        serious: 'Religious song',
        funny: 'A song that’s strictly "for him"',
      },
      {
        word: 'JAZZ',
        serious: 'Improvisational genre',
        funny: 'Music where the wrong notes are "intentional"',
      },
      {
        word: 'LUTE',
        serious: 'Renaissance stringed instrument',
        funny: 'What a medieval rocker used to woo',
      },
      {
        word: 'LYRE',
        serious: 'Ancient Greek harp',
        funny: 'A musical instrument that sounds like a fibber',
      },
      {
        word: 'NOTE',
        serious: 'A single musical tone',
        funny: 'A written reminder or a sung pitch',
      },
      {
        word: 'OBOE',
        serious: 'Double-reed woodwind',
        funny: 'A "wooden ill-wind that nobody blows good"',
      },
      {
        word: 'OPUS',
        serious: 'A numbered musical work',
        funny: 'A composer\'s "big deal"',
      },
      {
        word: 'REED',
        serious: 'Vibrating part of a clarinet',
        funny: 'A thin piece of wood that tastes like spit',
      },
      {
        word: 'SOLO',
        serious: 'Performance for one',
        funny: 'Han’s favorite way to play music?',
      },
      {
        word: 'SONG',
        serious: 'Vocal composition',
        funny: 'What you get when you add lyrics to a tune',
      },
      {
        word: 'TRIO',
        serious: 'Group of three',
        funny: 'One more than a duet, one less than a quartet',
      },
      {
        word: 'TUNE',
        serious: 'Melody or pitch',
        funny: 'Something you can carry in a bucket',
      },
      {
        word: 'BRASS',
        serious: 'Trumpets, trombones, etc.',
        funny: 'Instruments that can wake the dead (politely)',
      },
      {
        word: 'TEMPO',
        serious: 'Speed of the music',
        funny: 'How fast the drummer is about to ruin your life',
      },
      {
        word: 'BANJO',
        serious: 'Plucked folk instrument',
        funny: 'A guitar that went to the bluegrass festival',
      },
      {
        word: 'CELLO',
        serious: 'Large string instrument',
        funny: 'A violin that hit a massive growth spurt',
      },
      {
        word: 'CHORD',
        serious: 'Three or more notes at once',
        funny: 'A musical "three’s company"',
      },
      {
        word: 'DANCE',
        serious: 'Rhythmic movement to music',
        funny: 'What you do when the beat is too good',
      },
      {
        word: 'DIRGE',
        serious: 'Somber, mournful song',
        funny: 'The ultimate "buzzkill" at a party',
      },
      {
        word: 'DRUMS',
        serious: 'Percussion set',
        funny: "The neighbors' least favorite Christmas gift",
      },
      {
        word: 'FLUTE',
        serious: 'High-pitched woodwind',
        funny: 'A silver stick you blow across, not into',
      },
      {
        word: 'GENRE',
        serious: 'Category of music',
        funny: 'A fancy word for "what kind of noise is this?"',
      },
      {
        word: 'GUILD',
        serious: 'Group of musicians',
        funny: 'A medieval union for lute players',
      },
      {
        word: 'LYRIC',
        serious: 'Words to a song',
        funny: 'The part of the song you usually get wrong',
      },
      {
        word: 'MAJOR',
        serious: 'Scale with a "happy" sound',
        funny: 'A scale that’s not a "minor" problem',
      },
      {
        word: 'METER',
        serious: 'Rhythmic structure',
        funny: 'A musical yardstick',
      },
      {
        word: 'MINOR',
        serious: 'Scale with a "sad" sound',
        funny: "A scale that isn't old enough to drive?",
      },
      {
        word: 'ORGAN',
        serious: 'Pipe-based keyboard',
        funny: "An instrument that's also a body part",
      },
      {
        word: 'PIANO',
        serious: '88-keyed instrument',
        funny: 'A very heavy piece of furniture that sings',
      },
      {
        word: 'RESTS',
        serious: 'Silence in a score',
        funny: 'The only time a musician can breathe',
      },
      {
        word: 'SHARP',
        serious: 'Raised by a semitone',
        funny: 'A smart-looking note or a knife’s edge',
      },
      {
        word: 'TONAL',
        serious: 'Having a definite key',
        funny: "Music that doesn't make your ears bleed",
      },
      {
        word: 'VOICE',
        serious: 'Vocal instrument',
        funny: 'The instrument you’re born with',
      },
      {
        word: 'WALTZ',
        serious: 'Music in 3/4 time',
        funny: 'A dance that\'s "one, two, three, oops!"',
      },
      {
        word: 'TUBA',
        serious: 'Largest brass instrument',
        funny: 'A golden radiator that "om-pahs"',
      },

      {
        word: 'ACCENT',
        serious: 'Emphasis on a note',
        funny: 'A musical way of showing where you’re from',
      },
      {
        word: 'BALLAD',
        serious: 'Slow, narrative song',
        funny: 'A song designed to make teenagers slow-dance',
      },
      {
        word: 'CHORUS',
        serious: 'Repeated part of a song',
        funny: 'The part everyone actually knows the words to',
      },
      {
        word: 'FIDDLE',
        serious: 'Folk term for a violin',
        funny: 'A violin with an attitude problem',
      },
      {
        word: 'GUITAR',
        serious: 'Six-stringed favorite',
        funny: 'The instrument of choice for campfire heroes',
      },
      {
        word: 'LEGATO',
        serious: 'Smooth, flowing style',
        funny: 'A style that sounds like musical butter',
      },
      {
        word: 'MEDLEY',
        serious: 'Series of song snippets',
        funny: 'A musical "all-you-can-eat" buffet',
      },
      {
        word: 'MODERN',
        serious: 'Contemporary era',
        funny: 'Music that sounds like a printer dying',
      },
      {
        word: 'PLAYER',
        serious: 'Musician or performer',
        funny: 'Someone who’s just "toying" with an instrument',
      },
      {
        word: 'QUAVER',
        serious: 'An eighth note',
        funny: 'A note that’s feeling a little shaky',
      },
      {
        word: 'RECORD',
        serious: 'Vinyl disc',
        funny: 'A big black circle that sounds "warm"',
      },
      {
        word: 'RHYTHM',
        serious: 'Pattern of sound',
        funny: "What you either have or you don't",
      },
      {
        word: 'SONATA',
        serious: 'Multi-movement composition',
        funny: 'A fancy piece for a solo "show-off"',
      },
      {
        word: 'STANCE',
        serious: "Performer's posture",
        funny: 'The "rock star pose" in front of the mirror',
      },
      {
        word: 'STRING',
        serious: 'Violin or guitar part',
        funny: 'A musical thread that snaps at the worst time',
      },
      {
        word: 'TABLET',
        serious: 'Modern sheet music host',
        funny: 'What replaced the heavy folder of paper',
      },
      {
        word: 'TALENT',
        serious: 'Musical ability',
        funny: "Something money can't buy, but auto-tune can fake",
      },
      {
        word: 'THRILL',
        serious: 'Musical trill (variation)',
        funny: 'What a great solo gives the audience',
      },
      {
        word: 'TREBLE',
        serious: 'Higher musical range',
        funny: 'The "clef" that’s always looking for trouble',
      },
      {
        word: 'VIOLIN',
        serious: 'Smallest string instrument',
        funny: 'A chin-rest that makes beautiful noises',
      },

      {
        word: 'ACADEMY',
        serious: 'School of music',
        funny: 'Where you go to learn how to be broke',
      },
      {
        word: 'ANTHEM',
        serious: 'Song of praise or loyalty',
        funny: 'A song everyone stands up for',
      },
      {
        word: 'BARITONE',
        serious: 'Mid-range male voice',
        funny: 'The "Goldilocks" of male singing voices',
      },
      {
        word: 'CADENCE',
        serious: 'Closing of a musical phrase',
        funny: 'The musical way of saying "The End"',
      },
      {
        word: 'CONCERT',
        serious: 'Live musical performance',
        funny: 'An expensive way to stand in a crowd',
      },
      {
        word: 'COUNTRY',
        serious: 'Genre of trucks and dogs',
        funny: 'Music that’s 10% talent and 90% heartbreak',
      },
      {
        word: 'DYNAMIC',
        serious: 'Level of volume',
        funny: 'The "loud and soft" of the situation',
      },
      {
        word: 'FALSETTO',
        serious: 'Artificially high voice',
        funny: 'The "Mickey Mouse" school of singing',
      },
      {
        word: 'HARMONY',
        serious: 'Blending of simultaneous notes',
        funny: 'When singers actually get along',
      },
      {
        word: 'LULLABY',
        serious: 'Song to induce sleep',
        funny: 'A musical way to say "Please stop crying"',
      },
      {
        word: 'MELODIC',
        serious: 'Having a pleasing tune',
        funny: "Music that doesn't sound like a construction site",
      },
      {
        word: 'MINSTREL',
        serious: 'Medieval traveling singer',
        funny: 'A wandering jukebox from the 1400s',
      },
      {
        word: 'MUSICAL',
        serious: 'Play with singing',
        funny: 'A story where people burst into song for no reason',
      },
      {
        word: 'OCTETTE',
        serious: 'Group of eight',
        funny: 'A musical "double quartet"',
      },
      {
        word: 'OPERA',
        serious: 'Staged musical drama',
        funny: 'A play where everyone is stabbed but keeps singing',
      },
      {
        word: 'ORCHESTRA',
        serious: 'Large ensemble of players',
        funny: 'A giant group led by a guy waving a stick',
      },
      {
        word: 'PITCHES',
        serious: 'Levels of sound',
        funny: 'What a singer throws and a baseball player misses',
      },
      {
        word: 'QUARTET',
        serious: 'Group of four',
        funny: 'A musical four-way street',
      },
      {
        word: 'REHEARSE',
        serious: 'Practice for a performance',
        funny: 'Doing it again until the neighbors complain',
      },
      {
        word: 'SOPRANO',
        serious: 'Highest female voice',
        funny: 'The singer who can shatter your wine glass',
      },
      {
        word: 'STACCATO',
        serious: 'Short, detached notes',
        funny: 'Music played by a very caffeinated person',
      },
      {
        word: 'SYMPHONY',
        serious: 'Elaborate orchestral work',
        funny: 'A very long piece of music with no commercial breaks',
      },
      {
        word: 'UKULELE',
        serious: 'Small Hawaiian guitar',
        funny: 'A guitar that shrunk in the wash',
      },
      {
        word: 'VIBRATO',
        serious: 'Pulsating change of pitch',
        funny: 'Musical shivering',
      },
      {
        word: 'WOODWIND',
        serious: 'Flutes, reeds, etc.',
        funny: 'Instruments made of trees and hot air',
      },

      {
        word: 'CODA',
        serious: 'Final passage of a piece',
        funny: 'The musical equivalent of "P.S. I\'m done now."',
      },
      {
        word: 'PICCOLO',
        serious: 'Tiny high-pitched flute',
        funny: 'A musical toothpick that screams',
      },
      {
        word: 'ETUDE',
        serious: 'Musical study or exercise',
        funny: 'A fancy word for "practice till your fingers hurt"',
      },
      {
        word: 'MAESTRO',
        serious: 'Distinguished conductor',
        funny: 'The person with the best hair and the biggest stick',
      },
      {
        word: 'ADAGIO',
        serious: 'Slow musical tempo',
        funny: 'Music moving at the speed of a snail in molasses',
      },
    ],
    puzzles: [],
  },

  transportation: {
    id: 'transportation',
    name: 'Transportation',
    wordBank: [
      {
        word: 'CAR',
        serious: 'Automobile',
        funny: 'Your personal metal shell for traffic jams',
      },
      {
        word: 'OAR',
        serious: 'Rowing implement',
        funny: 'A wooden spoon for a lake',
      },
      {
        word: 'OIL',
        serious: 'Engine lubricant',
        funny: 'The black juice that keeps the wheels turning',
      },
      {
        word: 'RIG',
        serious: 'Large semi-truck',
        funny: 'A 18-wheeler that owns the highway',
      },
      {
        word: 'SUB',
        serious: 'Underwater vessel',
        funny: 'A giant metal cigar that sinks on purpose',
      },
      {
        word: 'TAX',
        serious: 'Travel surcharge',
        funny: 'The government’s ticket for your ticket',
      },
      {
        word: 'TOW',
        serious: 'Vehicle recovery',
        funny: 'A "hook-up" you never want to have',
      },
      {
        word: 'VAN',
        serious: 'Boxy vehicle',
        funny: 'A car that’s basically a small room on wheels',
      },
      {
        word: 'SST',
        serious: 'Supersonic transport',
        funny: 'A plane that arrives before it leaves',
      },
      {
        word: 'AUTO',
        serious: 'Car, formally',
        funny: 'A vehicle that does the driving (almost)',
      },
      {
        word: 'AXLE',
        serious: 'Wheel connector',
        funny: 'The rod that keeps things spinning',
      },
      {
        word: 'BIKE',
        serious: 'Two-wheeled vehicle',
        funny: 'A gym membership you can ride to work',
      },
      {
        word: 'BOAT',
        serious: 'Watercraft',
        funny: 'A hole in the water you pour money into',
      },
      {
        word: 'CART',
        serious: 'Small horse-drawn vehicle',
        funny: 'What you push at the grocery store',
      },
      {
        word: 'DECK',
        serious: 'Ship floor',
        funny: "The part of the boat you shouldn't fall off",
      },
      {
        word: 'FARE',
        serious: 'Ticket price',
        funny: 'The "entrance fee" for a bus ride',
      },
      {
        word: 'FORD',
        serious: 'Shallow river crossing',
        funny: 'A way to cross water or a popular truck',
      },
      {
        word: 'FUEL',
        serious: 'Engine energy',
        funny: 'The expensive liquid that goes "vroom"',
      },
      {
        word: 'GEAR',
        serious: 'Transmission part',
        funny: 'The "teeth" of the machine',
      },
      {
        word: 'HELM',
        serious: 'Ship’s steering wheel',
        funny: 'Where the captain pretends to be in charge',
      },
      {
        word: 'HULL',
        serious: 'Body of a ship',
        funny: 'The part of the boat that touches the fish',
      },
      {
        word: 'JEEP',
        serious: 'Rugged 4x4',
        funny: 'A car that thinks it’s a mountain goat',
      },
      {
        word: 'KNOT',
        serious: 'Nautical mile per hour',
        funny: 'A measurement that’s always "tied" to the sea',
      },
      {
        word: 'LANE',
        serious: 'Road division',
        funny: "The strip of asphalt your neighbor can't stay in",
      },
      {
        word: 'RAFT',
        serious: 'Simple floating platform',
        funny: 'A boat for people who like to get wet',
      },
      {
        word: 'RAIL',
        serious: 'Train track',
        funny: 'The steel path for a "choo-choo"',
      },
      {
        word: 'ROAD',
        serious: 'Paved path',
        funny: 'The long gray ribbon under your tires',
      },
      {
        word: 'SHIP',
        serious: 'Large sea vessel',
        funny: 'A boat that’s too big to be called a boat',
      },
      {
        word: 'TAXI',
        serious: 'Yellow cab, often',
        funny: 'A car that’s always in a hurry',
      },
      {
        word: 'TIRE',
        serious: 'Rubber wheel part',
        funny: 'The only part of the car that should be tired',
      },
      {
        word: 'TRAM',
        serious: 'Streetcar',
        funny: 'A train that lives on the street',
      },
      {
        word: 'TYRE',
        serious: 'British wheel part',
        funny: 'A wheel with an extra "y" for flavor',
      },
      {
        word: 'BARGE',
        serious: 'Flat-bottomed boat',
        funny: 'A boat that’s not known for its speed',
      },
      {
        word: 'BRAKE',
        serious: 'Stopping mechanism',
        funny: 'The "oops-preventer"',
      },
      {
        word: 'CANOE',
        serious: 'Narrow paddled boat',
        funny: 'A tippy wooden banana',
      },
      {
        word: 'COACH',
        serious: 'Long-distance bus',
        funny: 'A bus that thinks it’s fancy',
      },
      {
        word: 'DEPOT',
        serious: 'Transport station',
        funny: 'The "home base" for trains and buses',
      },
      {
        word: 'DRIVE',
        serious: 'Operate a vehicle',
        funny: 'What you do on a parkway (ironically)',
      },
      {
        word: 'FERRY',
        serious: 'Water shuttle',
        funny: 'A bus that knows how to swim',
      },
      {
        word: 'FLIGHT',
        serious: 'Aerial journey',
        funny: 'A trip where you pay for tiny bags of peanuts',
      },
      {
        word: 'GLIDE',
        serious: 'Move without power',
        funny: 'Traveling like a paper airplane',
      },
      {
        word: 'HOOKS',
        serious: 'Towing equipment',
        funny: 'The "claws" of the tow truck',
      },
      {
        word: 'ELEVATOR',
        serious: 'Vertical transport in buildings',
        funny: 'A tiny room that judges you in silence',
      },
      {
        word: 'FORKLIFT',
        serious: 'Warehouse lifting vehicle',
        funny: 'A tiny truck that thinks it’s a strongman',
      },
      {
        word: 'METRO',
        serious: 'Subway system',
        funny: 'An underground city for commuters',
      },
      { word: 'MOTOR', serious: 'Engine', funny: 'The heart of the machine' },
      {
        word: 'PEDAL',
        serious: 'Foot lever',
        funny: 'The part of the bike you hate on uphill climbs',
      },
      {
        word: 'PILOT',
        serious: 'Aircraft operator',
        funny: 'The person who talks to you from the clouds',
      },
      {
        word: 'PLANE',
        serious: 'Fixed-wing aircraft',
        funny: 'A bus with wings and better views',
      },
      {
        word: 'RADAR',
        serious: 'Detection system',
        funny: 'The "eye" that catches you speeding',
      },
      {
        word: 'SEDAN',
        serious: 'Four-door car',
        funny: 'The "accountant" of the car world',
      },
      {
        word: 'SKATE',
        serious: 'Wheeled footwear',
        funny: 'Transportation for people who like to fall',
      },
      {
        word: 'SLOOP',
        serious: 'Type of sailboat',
        funny: 'A boat that sounds like a soup',
      },
      {
        word: 'STEER',
        serious: 'Direct a vehicle',
        funny: 'What you do with a wheel or a bull',
      },
      {
        word: 'TRAIN',
        serious: 'Linked rail cars',
        funny: 'A very long metal snake on tracks',
      },
      {
        word: 'TRUCK',
        serious: 'Hauling vehicle',
        funny: 'A car with a giant backpack',
      },
      {
        word: 'WHEEL',
        serious: 'Circular transport part',
        funny: 'The greatest invention since sliced bread',
      },
      {
        word: 'YACHT',
        serious: 'Luxury boat',
        funny: 'A floating palace for people with too much cash',
      },
      {
        word: 'TRIKE',
        serious: 'Three-wheeled cycle',
        funny: 'A bicycle for people with trust issues regarding gravity',
      },
      {
        word: 'AIRBUS',
        serious: 'Large jet manufacturer',
        funny: 'A giant flying city bus',
      },
      {
        word: 'AIRMEN',
        serious: 'Flight personnel',
        funny: 'People who spend their lives looking down',
      },
      {
        word: 'CONVOY',
        serious: 'Group of traveling vehicles',
        funny: 'A "parade" of trucks on the highway',
      },
      {
        word: 'CRUISE',
        serious: 'Leisurely voyage',
        funny: 'A floating buffet that occasionally docks',
      },
      {
        word: 'ENGINE',
        serious: 'Power plant',
        funny: 'The noisy box under the hood',
      },
      {
        word: 'FENDER',
        serious: 'Wheel cover',
        funny: 'The part that gets "bent" in a minor accident',
      },
      {
        word: 'GARAGE',
        serious: 'Vehicle shelter',
        funny: 'A bedroom for your car',
      },
      {
        word: 'GLIDER',
        serious: 'Engineless plane',
        funny: 'A plane that’s basically a giant kite',
      },
      {
        word: 'HELIUM',
        serious: 'Blimp filler',
        funny: 'The gas that makes blimps float and voices squeak',
      },
      {
        word: 'HYBRID',
        serious: 'Dual-power vehicle',
        funny: 'A car that can’t decide between gas and sparks',
      },
      {
        word: 'LORRY',
        serious: 'UK truck',
        funny: 'What a Brit calls a "semi"',
      },
      {
        word: 'PADDLE',
        serious: 'Rowing tool',
        funny: "What you're without when you're up a creek",
      },
      {
        word: 'ROCKET',
        serious: 'Space vehicle',
        funny: 'A giant firework with a cockpit',
      },
      {
        word: 'RUNWAY',
        serious: 'Aircraft landing strip',
        funny: 'A very long driveway for planes',
      },
      {
        word: 'SCOOT',
        serious: 'Move quickly',
        funny: 'What you do on a tiny motor-deck',
      },
      {
        word: 'SIGNAL',
        serious: 'Traffic light',
        funny: "The light that always turns red when you're late",
      },
      {
        word: 'TANKER',
        serious: 'Liquid-hauling ship',
        funny: 'A floating gas station',
      },
      {
        word: 'TICKET',
        serious: 'Travel authorization',
        funny: 'A piece of paper that costs a fortune',
      },
      {
        word: 'VESSEL',
        serious: 'Large ship',
        funny: 'A fancy word for something that floats',
      },
      {
        word: 'AIRLINE',
        serious: 'Flight company',
        funny: 'A business that specializes in losing luggage',
      },
      {
        word: 'AIRSHIP',
        serious: 'Dirigible or blimp',
        funny: 'A giant floating football',
      },
      {
        word: 'BICYCLE',
        serious: 'Two-wheeled transport',
        funny: 'A vehicle powered by sweat and gears',
      },
      {
        word: 'CHOPPER',
        serious: 'Helicopter',
        funny: 'A fan that’s strong enough to lift people',
      },
      {
        word: 'COMMUTE',
        serious: 'Daily travel to work',
        funny: 'The soul-crushing part of the morning',
      },
      {
        word: 'FREEWAY',
        serious: 'High-speed road',
        funny: 'A road that is rarely "free" of traffic',
      },
      {
        word: 'GONDOLA',
        serious: 'Venetian boat',
        funny: 'A floating sofa for romantic tourists',
      },
      {
        word: 'HARBOR',
        serious: 'Ship’s parking lot',
        funny: 'A safe place for boats to hang out',
      },
      {
        word: 'HIGHWAY',
        serious: 'Main public road',
        funny: 'A long stretch of asphalt and billboards',
      },
      {
        word: 'PONTOON',
        serious: 'Floating boat support',
        funny: 'A boat that’s basically a floating patio',
      },
      {
        word: 'PULLMAN',
        serious: 'Luxury railroad car',
        funny: 'A fancy hotel room on tracks',
      },
      {
        word: 'SCHOONER',
        serious: 'Large sailing vessel',
        funny: 'A boat that sounds like it should be a beer',
      },
      {
        word: 'STATION',
        serious: 'Transport hub',
        funny: 'The place where you wait... and wait...',
      },
      {
        word: 'SUBWAY',
        serious: 'Underground train',
        funny: 'A giant metal tube full of strangers',
      },
      {
        word: 'TRAILER',
        serious: 'Towed vehicle',
        funny: 'The "sidekick" of the truck',
      },
      {
        word: 'TROLLEY',
        serious: 'Streetcar or cart',
        funny: 'A train that rings a bell',
      },
      {
        word: 'UNICYCLE',
        serious: 'One-wheeled vehicle',
        funny: 'A bike for people with great balance and no fear',
      },
      {
        word: 'CABOOSE',
        serious: 'Last car on a train',
        funny: 'The literal "rear end" of the railroad',
      },
      {
        word: 'DIRIGIBLE',
        serious: 'Lighter-than-air craft',
        funny: 'A giant flying grape',
      },
      {
        word: 'TRANSIT',
        serious: 'Public travel system',
        funny: "The thing you're in while looking at your watch",
      },
      {
        word: 'BLIMP',
        serious: 'Goodyear vehicle',
        funny: 'A giant billboard in the sky',
      },
      {
        word: 'KAYAK',
        serious: 'Small closed canoe',
        funny: 'A boat you wear like a pair of pants',
      },
    ],
    puzzles: [],
  },

  eighties: {
    id: 'eighties',
    name: "The 80's",
    wordBank: [
      {
        word: 'ALF',
        serious: 'TV alien from Melmac',
        funny: 'The puppet who wanted to eat the cat',
      },
      {
        word: 'BIKES',
        serious: 'Iconic mode of transport in E.T.',
        funny: 'Proof that kids could outrun the government in the 80s',
      },
      {
        word: 'PAC',
        serious: 'Start of a dot-munching game',
        funny: "The first three letters of a ghost-hunter's diet",
      },
      {
        word: 'RAD',
        serious: '80s slang for "excellent"',
        funny: 'Short for "radical" and 100% tubular',
      },
      {
        word: 'SRI',
        serious: 'Part of "___ Lanka"',
        funny: 'A tropical setting for a neon-clad music video',
      },
      {
        word: 'MTV',
        serious: 'Music video channel',
        funny: 'Back when "M" actually stood for Music',
      },
      {
        word: 'MAX',
        serious: '80s digital host Headroom',
        funny: 'A stuttering digital head in a suit',
      },
      {
        word: 'DEVO',
        serious: '"Whip It" band',
        funny: 'The guys wearing red "energy domes" on their heads',
      },
      {
        word: 'FAME',
        serious: '1980 dance movie/show',
        funny: '"I\'m gonna live forever," but the leg warmers didn\'t',
      },
      {
        word: 'HAIR',
        serious: 'Big 80s trend',
        funny: 'What required three cans of Aqua Net per day',
      },
      {
        word: 'ICON',
        serious: 'Madonna or Prince',
        funny: 'Someone whose poster was definitely on your wall',
      },
      {
        word: 'INXS',
        serious: '"Need You Tonight" band',
        funny: 'A band name that sounds like a shopping spree',
      },
      {
        word: 'JOAN',
        serious: 'Rocker Jett',
        funny: 'The lady who "Loves Rock \'n\' Roll"',
      },
      {
        word: 'KONG',
        serious: 'Donkey ___ (1981)',
        funny: 'The giant ape who hated a plumber named Jumpman',
      },
      {
        word: 'LISA',
        serious: 'Cult hit "Weird Science" girl',
        funny: 'The dream girl created by a floppy disk',
      },
      {
        word: 'NEON',
        serious: 'Bright 80s color palette',
        funny: 'Colors that could be seen from outer space',
      },
      {
        word: 'PONY',
        serious: 'Ralph Lauren logo',
        funny: 'The little horse on every "Preppy" polo shirt',
      },
      {
        word: 'PUNK',
        serious: 'Underground 80s subculture',
        funny: 'Safety pins as jewelry and Mohawks as hats',
      },
      {
        word: 'REO',
        serious: '___ Speedwagon',
        funny: 'The band that kept on loving you',
      },
      {
        word: 'THOR',
        serious: 'Adventures in Babysitting idol',
        funny: 'The guy the kid thought the mechanic was',
      },
      {
        word: 'TRON',
        serious: '1982 Disney sci-fi film',
        funny: 'A movie that took place inside a calculator',
      },
      {
        word: 'ATARI',
        serious: 'Early gaming console',
        funny: 'The reason your parents’ TV had "burn-in"',
      },
      {
        word: 'BLOND',
        serious: 'Atomic ___ (Debbie Harry)',
        funny: 'The hair color of a "Heart of Glass" singer',
      },
      {
        word: 'BRATS',
        serious: 'The "___ Pack"',
        funny: 'A group of actors who spent a lot of time in detention',
      },
      {
        word: 'CASIO',
        serious: 'Digital watch brand',
        funny: 'The calculator on your wrist that made you look "cool"',
      },
      {
        word: 'DENIM',
        serious: 'Acid-washed fabric',
        funny: 'The material of choice for "Canadian Tuxedos"',
      },
      {
        word: 'DURAN',
        serious: '___ Duran',
        funny: 'The band so nice they named it twice',
      },
      {
        word: 'OZZY',
        serious: 'The "Prince of Darkness"',
        funny: 'The man who mistook a bat for a snack',
      },
      {
        word: 'PERMS',
        serious: 'Chemical hair curls',
        funny: 'The reason the 80s smelled like sulfur',
      },
      {
        word: 'PRINCE',
        serious: '"Purple Rain" star',
        funny: 'The artist who partied like it was 1999',
      },
      {
        word: 'QUEEN',
        serious: '"Live Aid" show-stealers',
        funny: 'Freddy’s group that rocked Wembley',
      },
      {
        word: 'SLICK',
        serious: 'Grace ___ (Starship)',
        funny: 'The singer who "Built This City" on Rock and Roll',
      },
      {
        word: 'VADER',
        serious: '"Empire Strikes Back" villain',
        funny: 'The guy with the galaxy’s worst "Father of the Year" award',
      },

      {
        word: 'WHAM',
        serious: "George Michael's duo",
        funny: 'The band that gave us "Wake Me Up Before You Go-Go"',
      },
      {
        word: 'AHA',
        serious: '"Take On Me" band',
        funny: 'The band that turned into a comic book sketch',
      },
      {
        word: 'ARCADE',
        serious: 'Where 80s kids hung out',
        funny: 'A dark room full of quarters and beeping noises',
      },
      {
        word: 'BEASTS',
        serious: '___ie Boys',
        funny: 'The trio who fought for their "Right to Party"',
      },
      {
        word: 'BOWIE',
        serious: 'The "Labyrinth" Goblin King',
        funny: 'A rock star with amazing leggings and even better hair',
      },
      {
        word: 'CYNDI',
        serious: 'Lauper of the 80s',
        funny: 'The girl with the orange hair and the "Bop"',
      },
      {
        word: 'FERRIS',
        serious: '___ Bueller',
        funny: 'The kid who proved one day off can be legendary',
      },
      {
        word: 'GIBSON',
        serious: 'Pop star Debbie',
        funny: 'The girl who wore "Electric Youth" perfume',
      },
      {
        word: 'GOONIES',
        serious: '1985 adventure film',
        funny: 'The kids who found a pirate ship in a cave',
      },
      {
        word: 'HOGAN',
        serious: '"Hulk" of the WWF',
        funny: 'The man who asked, "Whatcha gonna do, brother?"',
      },
      {
        word: 'PACMAN',
        serious: 'Yellow arcade icon',
        funny: 'A hungry circle who hates colorful ghosts',
      },
      {
        word: 'POLO',
        serious: 'Iconic 80s shirt',
        funny: 'The official uniform of the "Preppy" handbook',
      },
      {
        word: 'REAGAN',
        serious: '40th US President',
        funny: 'The "Great Communicator" and jelly bean fan',
      },
      {
        word: 'ROBOCOP',
        serious: '1987 cyborg lawman',
        funny: 'Part man, part machine, all 80s action',
      },
      {
        word: 'SMILEY',
        serious: 'Acid house logo',
        funny: 'The yellow face that was "All over" the 80s',
      },
      {
        word: 'TOPGUN',
        serious: '1986 Cruise movie',
        funny: 'A movie-length commercial for Ray-Bans',
      },
      {
        word: 'TEFLON',
        serious: 'Nickname for Reagan',
        funny: 'A non-stick pan or a very lucky politician',
      },
      {
        word: 'AQUANET',
        serious: 'Popular 80s hairspray',
        funny: 'The primary reason for the hole in the ozone layer',
      },
      {
        word: 'BETAMAX',
        serious: 'Failed VCR format',
        funny: 'The loser of the great 80s videotape war',
      },
      {
        word: 'BREAKDANCE',
        serious: 'Urban dance style',
        funny: 'Spinning on your head until you get dizzy',
      },
      {
        word: 'CASSETTE',
        serious: 'Magnetic tape format',
        funny: 'The thing you fixed with a yellow pencil',
      },
      {
        word: 'DYNASTY',
        serious: '80s prime-time soap',
        funny: 'A show featuring shoulder pads and fountain fights',
      },
      {
        word: 'FRAGGLE',
        serious: '___ Rock (Jim Henson)',
        funny: 'The creatures who lived down at the "Rock"',
      },
      {
        word: 'GENESIS',
        serious: "Phil Collins' band",
        funny: 'A band that was an "Invisible Touch" away from a hit',
      },
      {
        word: 'GREMLINS',
        serious: '1984 creature feature',
        funny: "Don't feed them after midnight!",
      },
      {
        word: 'LEGWARM',
        serious: 'Clothing for aerobics',
        funny: 'Sweaters for your shins',
      },
      {
        word: 'MADONNA',
        serious: 'The "Material Girl"',
        funny: 'The woman who wore her underwear on the outside',
      },
      {
        word: 'NINTENDO',
        serious: 'NES maker',
        funny: 'The "box" you had to blow into to make it work',
      },
      {
        word: 'OUTATIME',
        serious: 'DeLorean license plate',
        funny: 'What Marty McFly was, literally',
      },
      {
        word: 'RUBIKS',
        serious: '___ Cube',
        funny: 'The 3x3 puzzle that frustrated an entire generation',
      },
      {
        word: 'WALKMAN',
        serious: 'Portable Sony player',
        funny: 'The device that let you ignore people in 1983',
      },

      {
        word: 'GHOSTBUSTERS',
        serious: '1984 comedy hit',
        funny: "Who you're gonna call?",
      },
      {
        word: 'JOSHUA',
        serious: '"The ___ Tree" (U2)',
        funny: 'A desert tree or a 1987 mega-album',
      },
      {
        word: 'TEARS',
        serious: '"___ for Fears"',
        funny: 'The band that wanted to rule the world',
      },
      {
        word: 'SPIELBERG',
        serious: 'Director Steven',
        funny: 'The man who gave us ET and Indy',
      },
      {
        word: 'VOLTRON',
        serious: 'Robot lion cartoon',
        funny: 'Five lions that make one giant knight',
      },
      {
        word: 'HEMAN',
        serious: 'Master of the Universe',
        funny: 'The guy with the sword and the blonde bob',
      },
      {
        word: 'FRIDAY',
        serious: '___ the 13th',
        funny: 'Jason’s favorite day of the week',
      },
      {
        word: 'BONJOVI',
        serious: '"Livin\' on a Prayer" band',
        funny: 'The group that gave love a bad name',
      },
      {
        word: 'BEETLE',
        serious: '"___-juice"',
        funny: "Don't say his name three times!",
      },
      {
        word: 'RAMBO',
        serious: 'Stallone action hero',
        funny: 'A guy who really likes headbands and bows',
      },
      {
        word: 'POLTERGEIST',
        serious: '"___-geist"',
        funny: "They're hee-ere!",
      },
      {
        word: 'COKE',
        serious: 'New ___ (1985 flop)',
        funny: 'The biggest drink disaster of the decade',
      },
      {
        word: 'SMURFS',
        serious: 'Blue forest dwellers',
        funny: 'Tiny blue people led by a guy in a red hat',
      },
      {
        word: 'CHER',
        serious: '"If I Could Turn Back Time"',
        funny: 'The singer who shot a video on a battleship',
      },
      {
        word: 'STING',
        serious: 'Police frontman',
        funny: "The man who's watching every breath you take",
      },
      {
        word: 'TINA',
        serious: '"Private Dancer" Turner',
        funny: 'The queen of rock with the big hair and legs',
      },
      {
        word: 'JOURNEY',
        serious: '"Don\'t Stop Believin\'" band',
        funny: "The band you'll hear in every karaoke bar forever",
      },
      {
        word: 'BIG',
        serious: '1988 Tom Hanks movie',
        funny: 'The movie where a kid wishes to be an adult',
      },
      {
        word: 'PHOENIX',
        serious: 'River of the 80s',
        funny: 'A "Stand By Me" star',
      },
      {
        word: 'DUCKIE',
        serious: '"Pretty in Pink" sidekick',
        funny: 'The guy who was tragically "friend-zoned"',
      },
      {
        word: 'MULLEN',
        serious: 'Larry of U2',
        funny: 'The drummer of the biggest 80s Irish band',
      },
      {
        word: 'SIMPSONS',
        serious: '1989 debut family',
        funny: 'The yellow family that started as Tracy Ullman shorts',
      },

      {
        word: 'BIZARRE',
        serious: '"___ Love Triangle"',
        funny: 'A 1986 New Order dance floor classic',
      },
      {
        word: 'PSYCHO',
        serious: '"___ Killer" (Talking Heads)',
        funny: "Qu'est-ce que c'est?",
      },
      {
        word: 'VOX',
        serious: '80s synth brand',
        funny: 'A voice or a vintage amplifier',
      },
      {
        word: 'KEYTAR',
        serious: 'Shoulder-worn synth',
        funny: 'For the keyboardist who wants to be a guitarist',
      },
      {
        word: 'SCRUNCHI',
        serious: '80s hair tie',
        funny: 'A fabric donut for your ponytail',
      },
      {
        word: 'MULLET',
        serious: '80s hairstyle',
        funny: 'Business in the front, party in the back',
      },
      {
        word: 'SLOGAN',
        serious: '"Where\'s the beef?"',
        funny: 'A catchy phrase from an 80s ad',
      },
      {
        word: 'GNARLY',
        serious: '80s surfer slang',
        funny: "Something that's either very cool or very gross",
      },
      {
        word: 'TUBULAR',
        serious: '80s radical slang',
        funny: 'A word for a pipe or something awesome',
      },
      {
        word: 'BODACIOUS',
        serious: '80s "excellent" slang',
        funny: 'Something very impressive or bold',
      },
      {
        word: 'PREPPY',
        serious: '80s style',
        funny: 'Polos, loafers, and popped collars',
      },
      {
        word: 'MALL',
        serious: '80s hangout',
        funny: 'The place where you bought tapes and hung out',
      },
      {
        word: 'VHS',
        serious: 'Video tape format',
        funny: 'The winner of the war against Betamax',
      },
      {
        word: 'BOOMBOX',
        serious: 'Large portable radio',
        funny: 'A stereo you carry on your shoulder',
      },
    ],
    puzzles: [],
  },

  nineties: {
    id: 'nineties',
    name: "The 90's",
    wordBank: [
      {
        word: 'AOL',
        serious: 'Early internet giant',
        funny: 'The sound of "Goodbye" and "You\'ve Got Mail"',
      },
      {
        word: 'DOT',
        serious: 'Part of ".com"',
        funny: 'The tiny speck that started a billion-dollar bubble',
      },
      {
        word: 'FAX',
        serious: 'Common 90s office tech',
        funny: 'How we sent "PDFs" before email was cool',
      },
      {
        word: 'ICE',
        serious: 'Rapper Van Winkle',
        funny: 'The guy who told us to "Stop, collaborate and listen"',
      },
      {
        word: 'MAC',
        serious: 'Colorful 90s Apple computer',
        funny: 'The "i" maker that started with translucent cases',
      },
      {
        word: 'POG',
        serious: '90s cardboard disc game',
        funny: 'A game involving a "slammer" and zero skill',
      },
      {
        word: 'REM',
        serious: '"Losing My Religion" band',
        funny: 'The band that found their religion in the 90s',
      },
      {
        word: 'CHAD',
        serious: 'Disputed 2000 ballot piece',
        funny: 'The "hanging" villain of the decade\'s end',
      },
      {
        word: 'ELMO',
        serious: '1996\'s "Tickle Me" toy',
        funny: 'The red monster that caused parent riots at malls',
      },
      {
        word: 'GENX',
        serious: 'The 90s youth generation',
        funny: 'The group that perfected the sarcastic "Whatever"',
      },
      {
        word: 'JAVA',
        serious: 'Sun Microsystems tech',
        funny: 'Computer code or the fuel for 90s coffee shops',
      },
      {
        word: 'ROSS',
        serious: '"Friends" paleontologist',
        funny: 'The guy who was "ON A BREAK!"',
      },
      {
        word: 'SEGA',
        serious: 'Genesis maker',
        funny: 'The company that screamed its own name at the start',
      },
      {
        word: 'SURF',
        serious: 'To browse the Web',
        funny: 'Something you did on a board or a dial-up modem',
      },
      {
        word: 'YADA',
        serious: '"___, ___, ___" (Seinfeld)',
        funny: 'The 90s way of skipping the boring parts',
      },
      {
        word: 'AKIRA',
        serious: '1990s anime hit',
        funny: 'The movie that made kids think cartoons were scary',
      },
      {
        word: 'BJORK',
        serious: 'Icelandic singer',
        funny: 'The woman who wore a swan to the Oscars',
      },
      {
        word: 'DRE',
        serious: 'Dr. ___ ("The Chronic")',
        funny: 'The rapper who "Forgot" himself (per Eminem)',
      },
      {
        word: 'FURBY',
        serious: 'Robotic 1998 toy',
        funny: 'A fuzzy owl that talked in the middle of the night',
      },
      {
        word: 'HOMER',
        serious: 'Simpson patriarch',
        funny: 'The man who made "D\'oh!" a dictionary word',
      },
      {
        word: 'JERRY',
        serious: 'Talk show host Springer',
        funny: 'The guy whose guests were always throwing chairs',
      },
      {
        word: 'LOPEZ',
        serious: 'Jennifer ("Jenny from the...")',
        funny: 'The star who made "The Block" famous',
      },
      {
        word: 'MODEM',
        serious: 'Internet connector',
        funny: 'The box that made screaming noises to call the web',
      },
      {
        word: 'PAGER',
        serious: 'Pre-cell phone device',
        funny: 'The beeper that made you look like a 90s doctor',
      },
      {
        word: 'URKEL',
        serious: '"Family Matters" nerd',
        funny: 'The guy who asked, "Did I do that?"',
      },
      {
        word: 'BARNEY',
        serious: 'Purple TV dinosaur',
        funny: 'The creature who loved you, even if you hated him',
      },
      {
        word: 'COBAIN',
        serious: 'Nirvana frontman',
        funny: 'The man who made messy hair and cardigans iconic',
      },
      {
        word: 'DIANA',
        serious: 'Princess of Wales',
        funny: 'The "Candle in the Wind"',
      },
      {
        word: 'DIESEL',
        serious: 'Ripped jeans brand',
        funny: 'The pants that cost more because they had holes',
      },
      {
        word: 'FLANNEL',
        serious: 'Grunge fashion staple',
        funny: 'The official uniform of Seattle in 1992',
      },
      {
        word: 'JORDAN',
        serious: 'Bulls legend Michael',
        funny: 'The man who flew through the air in "Space Jam"',
      },
      {
        word: 'NAPSTER',
        serious: 'Music sharing site',
        funny: 'The site that made Lars Ulrich very, very angry',
      },
      {
        word: 'POTTER',
        serious: 'Book boy Harry (1997)',
        funny: 'The wizard who lived under the stairs',
      },
      {
        word: 'CLUELESS',
        serious: '1995 Alicia Silverstone film',
        funny: '"As if!" (The movie)',
      },
      {
        word: 'DIALUP',
        serious: 'Slow internet connection',
        funny: 'The noise of a robot choking on a phone line',
      },
      {
        word: 'DISCMAN',
        serious: 'Portable CD player',
        funny: 'The device that skipped if you breathed too hard',
      },
      {
        word: 'FORREST',
        serious: 'Gump of 1994',
        funny: 'The man who thought life was like a box of chocolates',
      },
      {
        word: 'GAMEBOY',
        serious: 'Nintendo handheld',
        funny: 'The gray brick that ate AA batteries for breakfast',
      },
      {
        word: 'SEINFELD',
        serious: '"Show about nothing"',
        funny: 'The reason we all know what "The Soup Nazi" is',
      },
      {
        word: 'TITANIC',
        serious: '1997 blockbuster',
        funny: 'The movie that proved there was room for Jack',
      },
      {
        word: 'TOYSTORY',
        serious: '1995 Pixar debut',
        funny: 'The movie that made you feel guilty for discarding Lego',
      },
      {
        word: 'XFILES',
        serious: 'Paranormal TV show',
        funny: 'The reason people started looking for "The Truth"',
      },

      {
        word: 'SKA',
        serious: 'Horn-heavy 90s genre',
        funny: 'Music for people who love checkers and jumping',
      },
      {
        word: 'TLC',
        serious: '"Waterfalls" R&B trio',
        funny: 'A group that strictly forbids chasing waterfalls',
      },
      {
        word: 'SLAM',
        serious: '___ dunk or ___ poetry',
        funny: 'A high-flying move or a 90s coffee house event',
      },
      {
        word: 'RACHEL',
        serious: 'Iconic 90s haircut',
        funny: 'The hairstyle that every woman took to the salon',
      },
      {
        word: 'GARTH',
        serious: 'Brooks or "Wayne\'s World" pal',
        funny: 'A country king or a guy with "excellent" glasses',
      },
      {
        word: 'BUFFY',
        serious: 'The Vampire Slayer',
        funny: 'The blonde teen who spent her nights in cemeteries',
      },
      {
        word: 'SMASH',
        serious: '"___ Mouth"',
        funny: 'The band that told us "All that glitters is gold"',
      },
      {
        word: 'NODOUBT',
        serious: "Gwen Stefani's band",
        funny: 'The group that told us "Don\'t Speak"',
      },
      {
        word: 'CRANBERRY',
        serious: 'Band behind "Zombie"',
        funny: 'The group that made sadness sound beautiful',
      },
      {
        word: 'GOOSEBUMPS',
        serious: 'R.L. Stine book series',
        funny: 'Stories that gave 90s kids a "fright"',
      },
      {
        word: 'BEAVIS',
        serious: "Butt-head's pal",
        funny: 'The guy who really wanted "TP for his bunghole"',
      },
      {
        word: 'JUMANJI',
        serious: '1995 board game movie',
        funny: "The game you shouldn't play in the jungle",
      },
      {
        word: 'COOLIO',
        serious: '"Gangsta\'s Paradise" rapper',
        funny: 'The man with the most gravity-defying hair',
      },
      {
        word: 'WILLS',
        serious: 'Prince of the 90s',
        funny: 'The elder son of Charles and Diana',
      },
      {
        word: 'ENYCE',
        serious: '90s streetwear',
        funny: 'The label on your oversized hoodie',
      },
      {
        word: 'SNES',
        serious: '16-bit Nintendo',
        funny: 'The console that gave us Super Mario World',
      },
      {
        word: 'LUGE',
        serious: '90s Winter Olympic sport',
        funny: 'Going down a frozen pipe on a cafeteria tray',
      },
      {
        word: 'NOEL',
        serious: 'A Gallagher brother',
        funny: "The Oasis member who wasn't Liam",
      },
      {
        word: 'ALANIS',
        serious: 'Morissette of 1995',
        funny: 'The singer who found a black fly in her Chardonnay',
      },
      {
        word: 'MORPH',
        serious: '"Mighty ___" Rangers',
        funny: 'What the Power Rangers did before a fight',
      },
      {
        word: 'GNOME',
        serious: 'Desktop environment (1997)',
        funny: 'A garden ornament or a 90s tech interface',
      },
      {
        word: 'KELSEY',
        serious: '"___ Grammer"',
        funny: 'The man who played Frasier Crane',
      },
      {
        word: 'ZIMA',
        serious: 'Clear 90s malt beverage',
        funny: 'The drink that tasted like lemon-lime static',
      },
      {
        word: 'SPICE',
        serious: '"___ Girls"',
        funny: 'The group that brought us "Girl Power"',
      },
      {
        word: 'JAMIRO',
        serious: '"___-quai"',
        funny: 'The guy in the giant hat dancing on moving floors',
      },
      {
        word: 'DOLCE',
        serious: '"___ & Gabbana"',
        funny: 'High fashion with extra sunglasses energy',
      },
      {
        word: 'KORN',
        serious: 'Nu-metal pioneers',
        funny: 'The band that put bagpipes in heavy metal',
      },

      {
        word: 'BECK',
        serious: '"Loser" singer',
        funny: 'The artist who had "two turntables and a microphone"',
      },
      {
        word: 'HOOTIE',
        serious: 'And the Blowfish',
        funny: 'The band that just wanted to be with you',
      },
      {
        word: 'SHANIA',
        serious: 'Twain of the 90s',
        funny: "The woman who wasn't impressed by your car",
      },
      {
        word: 'ENYA',
        serious: '"Orinoco Flow" singer',
        funny: 'The queen of 90s waiting room music',
      },
      {
        word: 'REDS',
        serious: '"___ Hot Chili Peppers"',
        funny: 'The band that gave it away (now!)',
      },
      {
        word: 'BLUR',
        serious: '"Song 2" band',
        funny: 'The Britpop group that went "Woo-hoo!"',
      },
      {
        word: 'OASIS',
        serious: '"Wonderwall" band',
        funny: 'The brothers who fought more than they sang',
      },
      {
        word: 'BUSH',
        serious: '"Glycerine" band',
        funny: 'The British band that sounded like they were from Seattle',
      },
      {
        word: 'GARBAGE',
        serious: "Shirley Manson's band",
        funny: 'The group that was "only happy when it rains"',
      },
      {
        word: 'SUBLIME',
        serious: '"Santeria" band',
        funny: "The band that didn't practice Santeria",
      },
      {
        word: 'PHISH',
        serious: '90s jam band',
        funny: 'The group with the most dedicated "phans"',
      },
      {
        word: 'CREED',
        serious: '"Higher" band',
        funny: 'The band that sang with arms wide open',
      },
      {
        word: 'JEWEL',
        serious: '"You Were Meant for Me"',
        funny: 'The singer who lived in her van before fame',
      },
      {
        word: 'USHER',
        serious: '90s R&B star',
        funny: 'The man who made "U Remind Me" a hit',
      },
      {
        word: 'BRANDY',
        serious: '"The Boy Is Mine" singer',
        funny: 'The singer who was also "Moesha"',
      },
      {
        word: 'MONICA',
        serious: '90s singer or Friend',
        funny: 'A pop star or the lady with the yellow door',
      },
      {
        word: 'AALIYAH',
        serious: '"Back & Forth" singer',
        funny: 'The "Princess of R&B"',
      },
      {
        word: 'SELENA',
        serious: 'Queen of Tejano',
        funny: 'The star played by J-Lo in 1997',
      },
      {
        word: 'TUPAC',
        serious: '2Pac',
        funny: 'The rapper with "Dear Mama" and "California Love"',
      },
      {
        word: 'BIGGIE',
        serious: 'Notorious B.I.G.',
        funny: 'The "Poppa" of East Coast rap',
      },
      {
        word: 'JAYZ',
        serious: '"Reasonable Doubt" rapper',
        funny: 'The man who had "99 Problems" later on',
      },
      {
        word: 'NAS',
        serious: '"Illmatic" rapper',
        funny: 'The man who said "The World Is Yours"',
      },

      {
        word: 'FOOS',
        serious: '"___ Fighters"',
        funny: "Dave Grohl's post-Nirvana project",
      },
      {
        word: 'WEEZER',
        serious: '"Buddy Holly" band',
        funny: 'The group that looked like four guys at a chess club',
      },
      {
        word: 'GREEN',
        serious: '"___ Day"',
        funny: 'The band that gave us the "Dookie" album',
      },
      {
        word: 'PANTERA',
        serious: '"___-a"',
        funny: 'The "Cowboys from Hell" metal band',
      },
      {
        word: 'RAGE',
        serious: '"___ Against the Machine"',
        funny: 'The band that did what they told ya',
      },
      {
        word: 'SUAVE',
        serious: '"Rico ___"',
        funny: 'The 90s one-hit wonder with the abs',
      },
      {
        word: 'HANSON',
        serious: '"MMMBop" brothers',
        funny: 'The trio that looked like girls but were brothers',
      },
      {
        word: 'MACARENA',
        serious: '90s dance craze',
        funny: 'The dance that involves touching your head and hips',
      },
      {
        word: 'GOOGOO',
        serious: '"___ Dolls"',
        funny: 'The band that sang "Iris" on every radio station',
      },
    ],
    puzzles: [],
  },

  worldevents: {
    id: 'worldevents',
    name: 'World Events',
    wordBank: [
      {
        word: 'APP',
        serious: 'Software for a smartphone',
        funny: "The reason you can't put your phone down",
      },
      {
        word: 'GSEVEN',
        serious: 'Group of world leaders',
        funny: 'A summit that sounds like a chess move',
      },

      {
        word: 'GPS',
        serious: 'Satellite navigation system',
        funny: 'The voice that tells you "Recalculating"',
      },
      {
        word: 'IRAQ',
        serious: '2003 invasion country',
        funny: 'Not your retirement account, the other four-letter one',
      },
      {
        word: 'RIO',
        serious: '2016 Olympics host city',
        funny: 'The city that threw a party for the whole world',
      },
      {
        word: 'TSN',
        serious: 'Network for 21st c. sports',
        funny: 'Three letters for sports fans',
      },
      {
        word: 'ARAB',
        serious: 'The "___ Spring"',
        funny: 'A 2011 season of political change',
      },
      {
        word: 'CERN',
        serious: 'Large Hadron Collider site',
        funny: 'The place where they play bumper cars with atoms',
      },
      {
        word: 'EURO',
        serious: 'Currency launched in 2002',
        funny: 'The money that made 20 countries share a wallet',
      },
      {
        word: 'GORE',
        serious: '2000 election candidate',
        funny: 'The guy who "invented the internet" and lost',
      },
      {
        word: 'IPAD',
        serious: '2010 Apple tablet debut',
        funny: 'An iPhone that ate a "Grow" mushroom',
      },
      {
        word: 'IRAN',
        serious: 'Target of 2015 nuclear deal',
        funny: "A country that's always in the news scroll",
      },
      {
        word: 'ISIS',
        serious: 'Militant group formed in 2000s',
        funny: 'An Egyptian goddess or a security threat',
      },
      {
        word: 'MARS',
        serious: 'Target of the "Curiosity" rover',
        funny: 'The "Red Planet" we\'re trying to move to',
      },
      {
        word: 'MASK',
        serious: 'Global 2020 fashion trend',
        funny: 'The cloth that hid our smiles for two years',
      },
      {
        word: 'MUSK',
        serious: 'SpaceX founder Elon',
        funny: 'The man who wants to retire on another planet',
      },
      {
        word: 'NATO',
        serious: 'Alliance expanded in 2004',
        funny: 'The group that grew after the Cold War',
      },
      {
        word: 'OSLO',
        serious: 'Nobel Peace Prize city',
        funny: 'Where the world\'s most peaceful "Gold Medal" is',
      },
      {
        word: 'WIKI',
        serious: 'Prefix for 21st c. "Leaks"',
        funny: 'The "fast" way to get information (and secrets)',
      },
      {
        word: 'CLOUD',
        serious: 'Online storage era',
        funny: 'Where your photos go to live forever',
      },
      {
        word: 'CRASH',
        serious: '2008 financial crisis',
        funny: 'What the housing market did in its sleep',
      },
      {
        word: 'DEBT',
        serious: 'Global "___ Crisis"',
        funny: 'The trillions of dollars the world owes itself',
      },
      {
        word: 'DRONE',
        serious: 'Unmanned aerial vehicle',
        funny: 'A flying camera that annoys neighbors',
      },
      {
        word: 'EBOLA',
        serious: '2014 West African outbreak',
        funny: 'A virus that made everyone reach for sanitizer',
      },
      {
        word: 'GREEK',
        serious: '2010s "___ Debt Crisis"',
        funny: 'A tragedy that started in Athens, not a theater',
      },
      {
        word: 'HAITI',
        serious: 'Site of massive 2010 quake',
        funny: 'A Caribbean nation that needs a break',
      },
      {
        word: 'KOREA',
        serious: '2018 "Peace Summit" site',
        funny: 'The peninsula with a very famous "DMZ"',
      },
      {
        word: 'OBAMA',
        serious: '44th US President',
        funny: 'The man whose slogan was "Yes We Can"',
      },
      {
        word: 'PUTIN',
        serious: 'Longtime Russian leader',
        funny: 'The man who loves shirtless horseback riding',
      },
      {
        word: 'QUAKE',
        serious: '2011 Japan disaster',
        funny: "Nature's way of shaking things up",
      },
      {
        word: 'SYRIA',
        serious: 'Site of ongoing 2011 conflict',
        funny: 'A Middle Eastern nation in the headlines',
      },
      {
        word: 'TWEET',
        serious: 'Post on "X" (formerly Twitter)',
        funny: 'A 140-character way to start an argument',
      },
      {
        word: 'VIRUS',
        serious: '2020 global disruption',
        funny: 'The tiny spike-ball that canceled the world',
      },
      {
        word: 'TEAMS',
        serious: 'Remote meeting platform',
        funny: 'Where meetings go to multiply like gremlins',
      },
      {
        word: 'WIFI',
        serious: 'Wireless networking tech',
        funny: 'The invisible magic that makes us panic',
      },

      {
        word: 'AFGHAN',
        serious: 'Site of 20-year US war',
        funny: 'A warm blanket or a very long conflict',
      },
      {
        word: 'BREXIT',
        serious: 'British exit from the EU',
        funny: 'A 4-year goodbye that felt like a lifetime',
      },
      {
        word: 'CENSUS',
        serious: 'Decennial population count',
        funny: 'The government\'s way of asking "Who\'s home?"',
      },
      {
        word: 'EMAILS',
        serious: 'Subject of 2016 controversy',
        funny: 'The version of "The dog ate my homework"',
      },
      {
        word: 'FRENCH',
        serious: '2015 Paris Accord nation',
        funny: 'People who take climate goals with a croissant',
      },
      {
        word: 'GIZMOS',
        serious: '21st c. tech gadgets',
        funny: 'The many "i-Things" filling our junk drawers',
      },
      {
        word: 'LONDON',
        serious: '2012 Summer Olympics host',
        funny: 'The city that brought Mary Poppins to the track',
      },
      {
        word: 'MERKEL',
        serious: 'Longtime German Chancellor',
        funny: 'The "Iron Lady" of the European Union',
      },
      {
        word: 'TIKTOK',
        serious: 'Video social giant',
        funny: 'The app that turned everyone into a dancer',
      },
      {
        word: 'SPACEX',
        serious: '2002 Musk venture',
        funny: 'A private taxi service for astronauts',
      },
      {
        word: 'TRUMP',
        serious: '45th US President',
        funny: 'A TV host who moved into the White House',
      },

      {
        word: 'AIRBNB',
        serious: '2008 home-sharing debut',
        funny: "Paying to sleep in a stranger's spare bedroom",
      },
      {
        word: 'FACEBOOK',
        serious: 'Social media giant (2004)',
        funny: 'A place to see what high school rivals had for lunch',
      },
      {
        word: 'FUKUSHIMA',
        serious: '2011 nuclear site',
        funny: 'The city that gave "glowing reviews" a bad name',
      },
      {
        word: 'HURRICANE',
        serious: 'Katrina (2005) or Sandy (2012)',
        funny: 'A very windy guest that overstays its welcome',
      },
      {
        word: 'NETFLIX',
        serious: 'Streaming giant (2007)',
        funny: "The reason you haven't seen the sun in days",
      },
      {
        word: 'OUTBREAK',
        serious: 'SARS (2003) or COVID (2019)',
        funny: 'A very bad "viral" moment',
      },
      {
        word: 'SAMSUNG',
        serious: "Apple's 21st c. rival",
        funny: 'The other phone that isn\'t a "fruit"',
      },
      {
        word: 'SNAPCHAT',
        serious: '2011 disappearing photo app',
        funny: 'Evidence that deletes itself in ten seconds',
      },
      {
        word: 'STIMULUS',
        serious: '2009/2020 economic aid',
        funny: 'The government "making it rain" to save banks',
      },
      {
        word: 'THUNBERG',
        serious: 'Climate activist Greta',
        funny: 'The teen who made world leaders feel guilty',
      },
      {
        word: 'TSUNAMI',
        serious: '2004 Indian Ocean event',
        funny: 'A wave that really knows how to enter',
      },
      {
        word: 'YOUTUBE',
        serious: '2005 video sharing site',
        funny: 'The place where "cat videos" became a career',
      },

      {
        word: 'ELLIOT',
        serious: 'Boy who befriended an alien in 1982',
        funny: 'The kid who proved bikes can fly',
      },

      {
        word: 'SMART',
        serious: 'Phone era starting in the 2000s',
        funny:
          "A device that knows everything except when you're trying to unlock it",
      },

      {
        word: 'METOO',
        serious: '2017 social movement',
        funny: 'A hashtag that changed workplace culture',
      },
      {
        word: 'BITCOIN',
        serious: 'Digital gold (2009)',
        funny: 'Money that exists if you remember the password',
      },
      {
        word: 'HUBBLE',
        serious: 'Telescope (updated 2009)',
        funny: 'The eye in the sky replaced by James Webb',
      },
      {
        word: 'WEBB',
        serious: 'James ___ Space Telescope',
        funny: 'The new gold-plated eye in the sky',
      },
      {
        word: 'DARPA',
        serious: '21st c. tech agency',
        funny: 'The "mad scientists" of the government',
      },
      {
        word: 'TALIBAN',
        serious: 'Afghan group (2021 return)',
        funny: 'The group that returned to power in Kabul',
      },
      {
        word: 'KATRINA',
        serious: '2005 New Orleans storm',
        funny: 'The hurricane that broke the levees',
      },
      {
        word: 'GILLARD',
        serious: 'First female AU Prime Minister',
        funny: 'A trailblazer from the Land Down Under',
      },
      {
        word: 'MALALA',
        serious: 'Nobel winner Yousafzai',
        funny: 'The girl who stood up to the Taliban',
      },
      {
        word: 'SWIPE',
        serious: 'Tinder movement',
        funny: 'How we find dates or pay for groceries',
      },
      {
        word: 'SELFIES',
        serious: '21st c. photo trend',
        funny: "Taking a picture of yourself at arm's length",
      },
      {
        word: 'CRYPTO',
        serious: 'Digital currency class',
        funny: "Money that's backed by math, not gold",
      },

      {
        word: 'BLOCKCHAIN',
        serious: 'Tech behind Bitcoin',
        funny: "The digital ledger that can't be erased",
      },
      {
        word: 'BREXITEER',
        serious: 'Supporter of UK exit',
        funny: 'Someone who wanted to leave the EU',
      },
      {
        word: 'MAGA',
        serious: '2016 campaign slogan',
        funny: 'Four letters on a red hat',
      },
      {
        word: 'CLIMATE',
        serious: 'Global 21st c. concern',
        funny: 'What we\'re trying to save from "warming"',
      },
      {
        word: 'TERROR',
        serious: 'War on ___ (2001-)',
        funny: 'A long global conflict against an abstract noun',
      },
      {
        word: 'REAPER',
        serious: 'Predator or Reaper',
        funny: 'A plane that flies itself (and never asks for snacks)',
      },
      {
        word: 'TURING',
        serious: '2021 UK banknote star',
        funny: 'The "Father of AI" on the 50-pound note',
      },
      {
        word: 'ENRON',
        serious: '2001 corporate scandal',
        funny: 'The company that cooked its books to a crisp',
      },
      {
        word: 'TESLA',
        serious: "Musk's electric car company",
        funny: 'A car that runs on batteries and hype',
      },
      {
        word: 'UBER',
        serious: '2009 ride-hailing debut',
        funny: 'The app that killed the taxi industry',
      },
      {
        word: 'VENMO',
        serious: '2009 payment app',
        funny: 'How you pay your friend back for pizza',
      },
      {
        word: 'OCASIO',
        serious: '"AOC" of Congress',
        funny: 'A young Bronx rep in the headlines',
      },
      {
        word: 'RECESSION',
        serious: 'The "Great" one of 2008',
        funny: 'A very bad time for the global economy',
      },
      {
        word: 'BINLADEN',
        serious: 'Target of 2011 raid',
        funny: 'The man in hiding found in a compound',
      },
      {
        word: 'CHIRAC',
        serious: '2000s French President',
        funny: 'A leader who said "Non" to the Iraq War',
      },
      {
        word: 'BLAIR',
        serious: 'UK PM during Iraq War',
        funny: "Bush's closest ally in the 2000s",
      },
      {
        word: 'POPE',
        serious: 'Francis or Benedict XVI',
        funny: 'The man in the white hat at the Vatican',
      },
      {
        word: 'CANCEL',
        serious: '___ Culture trend',
        funny: 'What happens when the internet turns on you',
      },
      {
        word: 'HASHTAG',
        serious: 'Social media label',
        funny: 'The pound sign that rules discourse',
      },
      {
        word: 'METAVERSE',
        serious: "Zuckerberg's 2021 vision",
        funny: 'A digital world where we all wear goggles',
      },
      {
        word: 'GENZ',
        serious: 'Current youth generation',
        funny: 'People born with a smartphone in their hand',
      },
      {
        word: 'COVID',
        serious: '2019-2022 pandemic',
        funny: 'The reason we all stayed home for a year',
      },
      {
        word: 'DELTA',
        serious: 'COVID variant',
        funny: 'A letter of the Greek alphabet or a virus',
      },
      {
        word: 'OMICRON',
        serious: '2021 COVID variant',
        funny: 'The last big wave of the pandemic',
      },
      {
        word: 'ZOOM',
        serious: 'Virtual meeting platform',
        funny: 'A word that means go fast or stay home',
      },
      {
        word: 'SPACE',
        serious: 'The New ___ Race',
        funny: 'Where Bezos, Branson, and Musk are headed',
      },
      {
        word: 'WALL',
        serious: '2016 border controversy',
        funny: 'A "Big Beautiful" structure that was debated',
      },
      {
        word: 'REFERENDUM',
        serious: '2016 UK vote',
        funny: 'A national coin-flip with opinions',
      },
    ],
    puzzles: [],
  },

  sports: {
    id: 'sports',
    name: 'Sports',
    wordBank: [
      // ── 3-letter glue (20)
      { word: 'FAN', serious: 'Supporter', funny: 'Yells at the TV' },
      { word: 'BAT', serious: 'Baseball tool', funny: 'Swing and hope' },
      { word: 'NET', serious: 'Scoring target', funny: 'Ball catcher' },
      { word: 'PAR', serious: 'Golf standard', funny: 'The expectation' },
      { word: 'GYM', serious: 'Workout spot', funny: 'Place of intentions' },
      { word: 'TIE', serious: 'Even score', funny: 'Nobody wins yet' },
      { word: 'LAP', serious: 'Track circuit', funny: 'One more around' },
      {
        word: 'SUB',
        serious: 'Replacement player',
        funny: 'Fresh legs incoming',
      },
      { word: 'REF', serious: 'Game official', funny: 'Blamed instantly' },
      { word: 'WIN', serious: 'Victory', funny: 'The whole point' },
      { word: 'CUP', serious: 'Trophy type', funny: 'Shiny bragging rights' },
      { word: 'SKI', serious: 'Snow sport gear', funny: 'Fast way downhill' },
      { word: 'ROW', serious: 'Boat motion', funny: 'Arms, repeat' },
      { word: 'PUCK', serious: 'Hockey disc', funny: 'Tiny chaos disk' },
      { word: 'JOG', serious: 'Slow run', funny: 'Running’s cousin' },
      { word: 'PAD', serious: 'Protective gear', funny: 'Impact insurance' },
      { word: 'TEE', serious: 'Golf peg', funny: 'Ball pedestal' },
      { word: 'RUN', serious: 'Baseball score', funny: 'Worth celebrating' },
      { word: 'PRO', serious: 'Expert player', funny: 'Gets paid for this' },
      { word: 'END', serious: '___ zone', funny: 'The goal line’s roommate' },

      // ── 4-letter sweet spot (25)
      { word: 'GOAL', serious: 'Scoring unit', funny: 'Reason people cheer' },
      { word: 'BALL', serious: 'Game essential', funny: 'The whole problem' },
      {
        word: 'TEAM',
        serious: 'Group of players',
        funny: 'Shared stress unit',
      },
      { word: 'RINK', serious: 'Ice surface', funny: 'Cold chaos pad' },
      { word: 'GOLF', serious: 'Links sport', funny: 'Walking with clubs' },
      { word: 'CLUB', serious: 'Golf stick', funny: 'Ball persuader' },
      { word: 'HOOP', serious: 'Basket target', funny: 'Circle of hope' },
      {
        word: 'DUNK',
        serious: 'High basket',
        funny: 'Gravity ignored briefly',
      },
      { word: 'PUNT', serious: 'Football kick', funny: 'Strategic surrender' },
      { word: 'BASE', serious: 'Diamond corner', funny: 'Safe square' },
      { word: 'SWIM', serious: 'Pool activity', funny: 'Fast splashing' },
      { word: 'RACE', serious: 'Speed contest', funny: 'First or forgotten' },
      { word: 'SHOT', serious: 'Scoring attempt', funny: 'Hope with force' },
      { word: 'SLAM', serious: 'Grand ___', funny: 'All-in hit' },
      { word: 'DRAW', serious: 'Tie game', funny: 'Everyone shrugs' },
      { word: 'LOSS', serious: 'Defeat', funny: 'Film review time' },
      { word: 'BUNT', serious: 'Soft hit', funny: 'Tiny betrayal' },
      { word: 'SAFE', serious: 'Umpire call', funny: 'The good word' },
      { word: 'FOUL', serious: 'Rule break', funny: 'Whistle magnet' },
      { word: 'KICK', serious: 'Foot strike', funny: 'Ball eviction notice' },
      { word: 'PASS', serious: 'Teammate toss', funny: 'Sharing is caring' },
      { word: 'BIKE', serious: 'Cyclist ride', funny: 'Leg-powered vehicle' },
      { word: 'MATS', serious: 'Wrestling floor', funny: 'Sweat sponge' },
      { word: 'SETS', serious: 'Tennis segments', funny: 'Scoreboard math' },
      { word: 'SEED', serious: 'Tournament rank', funny: 'Bracket destiny' },

      // ── 5-letter connectors (25)
      { word: 'SCORE', serious: 'Total points', funny: 'The receipt' },
      { word: 'COACH', serious: 'Team leader', funny: 'Clipboard philosopher' },
      { word: 'ARENA', serious: 'Large venue', funny: 'Echo chamber of hope' },
      { word: 'COURT', serious: 'Play surface', funny: 'Not a courtroom' },
      { word: 'FIELD', serious: 'Grass play area', funny: 'Mud potential' },
      { word: 'TRACK', serious: 'Running path', funny: 'Oval destiny' },
      { word: 'PITCH', serious: 'Thrown ball', funny: 'Fast negotiation' },
      { word: 'CATCH', serious: 'Glove action', funny: 'Please don’t drop' },
      {
        word: 'SERVE',
        serious: 'Start of play',
        funny: 'High-risk introduction',
      },
      { word: 'RALLY', serious: 'Long exchange', funny: 'Refusing to quit' },
      { word: 'MATCH', serious: 'Competition', funny: 'Scheduled stress' },
      { word: 'POINT', serious: 'Scoring unit', funny: 'Tiny victory' },
      { word: 'ROUGH', serious: 'Tall golf grass', funny: 'Ball graveyard' },
      { word: 'GREEN', serious: 'Putting area', funny: 'Precision lawn' },
      { word: 'EAGLE', serious: 'Two under par', funny: 'Golf brag moment' },
      { word: 'BOGIE', serious: 'One over par', funny: 'Quiet disappointment' },
      { word: 'RELAY', serious: 'Team race', funny: 'Don’t drop it' },
      { word: 'RUGBY', serious: 'Scrum sport', funny: 'Organized collision' },
      { word: 'MEDAL', serious: 'Award prize', funny: 'Neck bling' },
      { word: 'SKATE', serious: 'Ice footwear', funny: 'Blade shoes' },
      { word: 'CLEAT', serious: 'Shoe spike', funny: 'Traction weapon' },
      {
        word: 'DRAFT',
        serious: 'Player selection',
        funny: 'Future hope machine',
      },
      { word: 'STATS', serious: 'Performance data', funny: 'Argument fuel' },
      { word: 'BENCH', serious: 'Reserve area', funny: 'Thinking seat' },
      { word: 'FINAL', serious: 'Championship game', funny: 'No redo allowed' },

      // ── 6-letter utility (15)
      { word: 'SOCCER', serious: 'Global football', funny: 'World sport' },
      { word: 'TENNIS', serious: 'Racket sport', funny: 'Polite yelling' },
      { word: 'HOCKEY', serious: 'Puck sport', funny: 'Fast chaos on ice' },
      { word: 'PLAYER', serious: 'Participant', funny: 'Uniform wearer' },
      { word: 'LEAGUE', serious: 'Group of teams', funny: 'Organized rivalry' },
      { word: 'SERIES', serious: 'Set of games', funny: 'Extended stress' },
      { word: 'RECORD', serious: 'Best mark', funny: 'History line' },
      { word: 'BASKET', serious: 'Hoop score', funny: 'Two points of joy' },
      { word: 'HUDDLE', serious: 'Team circle', funny: 'Whisper strategy' },
      { word: 'FUMBLE', serious: 'Dropped ball', funny: 'Instant regret' },
      { word: 'FINISH', serious: 'End of race', funny: 'The last push' },
      { word: 'SEASON', serious: 'Game schedule', funny: 'Long commitment' },
      { word: 'KEEPER', serious: 'Goal defender', funny: 'Last hope' },
      { word: 'BATTER', serious: 'At the plate', funny: 'Swing specialist' },
      { word: 'JERSEY', serious: 'Team shirt', funny: 'Identity fabric' },

      // ── 7+ anchors (15)
      {
        word: 'BASEBALL',
        serious: 'Diamond sport',
        funny: 'America’s long game',
      },
      {
        word: 'FOOTBALL',
        serious: 'Gridiron game',
        funny: 'Strategic collisions',
      },
      { word: 'STADIUM', serious: 'Sports venue', funny: 'Concrete roar box' },
      { word: 'OFFENSE', serious: 'Scoring side', funny: 'Point hunters' },
      { word: 'DEFENSE', serious: 'Stopping side', funny: 'Hope killers' },
      { word: 'MARATHON', serious: '26.2 mile race', funny: 'Long promise' },
      { word: 'OLYMPICS', serious: 'Global games', funny: 'World flex event' },
      { word: 'ATHLETE', serious: 'Sports person', funny: 'Human machine' },
      { word: 'CHAMPION', serious: 'The winner', funny: 'Last one standing' },
      { word: 'OVERTIME', serious: 'Extra play', funny: 'Bonus stress' },
      {
        word: 'PENALTY',
        serious: 'Rule infraction',
        funny: 'Free points for someone',
      },
      {
        word: 'PLAYOFFS',
        serious: 'Post-season games',
        funny: 'Where nerves live',
      },
      {
        word: 'TOUCHDOWN',
        serious: 'Six-point score',
        funny: 'End zone party',
      },
      { word: 'HOMERUN', serious: 'Four-base hit', funny: 'Immediate joy' },
      {
        word: 'QUARTERBACK',
        serious: 'Signal caller',
        funny: 'Decision distributor',
      },
    ],

    puzzles: [
      {
        id: 'spo-001',
        title: 'Sports Mini Mix',
        difficulty: 'easy',
        grid: ['TEE#RUN', 'E#A#A#E', 'AIM#LET', 'M###L##', '###GYM#'],
        clues: {
          serious: {
            across: {
              r0c0: 'Golf ball stand',
              r0c4: 'Baseball score',
              r2c0: 'Take careful aim',
              r2c4: 'Allow',
              r4c3: 'Workout spot',
            },
            down: {
              r0c0: 'Group of players',
              r0c4: 'Sustained exchange in tennis',
              r0c6: 'Scoring target',
            },
          },
          funny: {
            across: {
              r0c0: 'Tiny golf pedestal',
              r0c4: 'The point of the inning',
              r2c0: 'Point your hopes carefully',
              r2c4: 'Give the green light',
              r4c3: 'Where resolutions go to sweat',
            },
            down: {
              r0c0: 'People you blame with you',
              r0c4: 'Volley marathon',
              r0c6: 'Where the ball gets caught',
            },
          },
        },
      },
    ],
  },

  animals: {
    id: 'animals',
    name: 'Animals',
    wordBank: [
      {
        word: 'APE',
        serious: 'Primate such as a gorilla',
        funny: "Guy who's all knuckles and no manners",
      },
      {
        word: 'BEE',
        serious: 'Pollinating insect',
        funny: 'A fuzzy pilot looking for a buzz',
      },
      {
        word: 'CAT',
        serious: 'Feline pet',
        funny: 'The real owner of your house',
      },
      {
        word: 'DOG',
        serious: 'Canis lupus familiaris',
        funny: 'A professional tail-wagger',
      },
      {
        word: 'ELK',
        serious: 'Large North American deer',
        funny: 'A deer with a very expensive hat',
      },
      {
        word: 'EMU',
        serious: 'Flightless Australian bird',
        funny: 'A giant feather duster on legs',
      },
      {
        word: 'EEL',
        serious: 'Moray or conger',
        funny: 'A slippery tube with teeth',
      },
      {
        word: 'FLY',
        serious: 'Common dipterous insect',
        funny: 'The uninvited guest at every picnic',
      },
      {
        word: 'HEN',
        serious: 'Female chicken',
        funny: 'A professional egg-layer',
      },
      {
        word: 'KOI',
        serious: 'Decorative carp',
        funny: 'A fish that’s too "shy" to speak?',
      },
      {
        word: 'OWL',
        serious: 'Nocturnal bird of prey',
        funny: 'A bird that gives a hoot',
      },
      {
        word: 'PIG',
        serious: 'Farm animal raised for pork',
        funny: 'A pink vacuum for table scraps',
      },
      { word: 'RAT', serious: 'Common rodent', funny: 'A mouse on steroids' },
      {
        word: 'YAK',
        serious: 'Shaggy-haired ox',
        funny: 'An animal that never stops talking?',
      },
      {
        word: 'BEAR',
        serious: 'Ursine mammal',
        funny: 'A forest-dweller who loves a long nap',
      },
      {
        word: 'BOAR',
        serious: 'Wild pig',
        funny: 'A swine that’s a real "snore" at parties',
      },
      {
        word: 'DEER',
        serious: 'Antlered ruminant',
        funny: 'Someone’s "fawn"ed over favorite',
      },
      {
        word: 'DOVE',
        serious: 'Symbol of peace',
        funny: 'A pigeon with a better PR agent',
      },
      {
        word: 'DUCK',
        serious: 'Quacking waterfowl',
        funny: 'An animal that tells you to lower your head',
      },
      {
        word: 'FROG',
        serious: 'Amphibian that leaps',
        funny: 'A prince who’s had a very bad day',
      },
      {
        word: 'GOAT',
        serious: 'Sure-footed ruminant',
        funny: 'An animal that will eat your homework',
      },
      {
        word: 'HARE',
        serious: 'Fast-running lagomorph',
        funny: 'A rabbit with a need for speed',
      },
      {
        word: 'IBIS',
        serious: 'Wading bird with a curved beak',
        funny: 'An Egyptian god’s favorite feather-head',
      },
      {
        word: 'LION',
        serious: 'King of the jungle',
        funny: 'A big cat with a very loud "hair"day',
      },
      {
        word: 'LYNX',
        serious: 'Tufted-ear wildcat',
        funny: 'A cat that’s missing its "u"',
      },
      {
        word: 'MOTH',
        serious: 'Nocturnal winged insect',
        funny: 'A butterfly that only dresses in gray',
      },
      {
        word: 'NEWT',
        serious: 'Small salamander',
        funny: 'What the witch turned me into (I got better)',
      },
      {
        word: 'ORYX',
        serious: 'Straight-horned antelope',
        funny: 'A desert animal with built-in skewers',
      },
      {
        word: 'SEAL',
        serious: 'Marine pinniped',
        funny: 'A slippery dog that loves raw fish',
      },
      {
        word: 'SWAN',
        serious: 'Long-necked waterbird',
        funny: "An ugly duckling's final form",
      },
      {
        word: 'TOAD',
        serious: 'Warty amphibian',
        funny: 'A frog with a serious skin condition',
      },
      {
        word: 'WOLF',
        serious: 'Pack-hunting canine',
        funny: 'The guy who keeps blowing houses down',
      },

      {
        word: 'ADDAX',
        serious: 'Sahara antelope',
        funny: 'A creature that sounds like a math problem',
      },
      {
        word: 'CHIMP',
        serious: 'Intelligent primate',
        funny: 'Your closest relative at the zoo',
      },
      {
        word: 'DINGO',
        serious: 'Wild Australian dog',
        funny: 'The canine that "ate the baby"',
      },
      {
        word: 'EGRET',
        serious: 'White-plumed heron',
        funny: 'A bird that sounds like a missed opportunity',
      },
      {
        word: 'HYENA',
        serious: 'Scavenging carnivore',
        funny: "The zoo's only stand-up comedian",
      },
      {
        word: 'LEMUR',
        serious: 'Madagascan primate',
        funny: 'A monkey wearing a striped mask',
      },
      {
        word: 'LLAMA',
        serious: 'Andean pack animal',
        funny: 'A camel that forgot its hump',
      },
      {
        word: 'MOUSE',
        serious: 'Small house rodent',
        funny: "A computer accessory's namesake",
      },
      {
        word: 'OKAPI',
        serious: 'Giraffe relative with zebra legs',
        funny: 'An animal designed by a committee',
      },
      {
        word: 'OTTER',
        serious: 'Semi-aquatic weasel',
        funny: 'A water-weasel that holds hands',
      },
      {
        word: 'PANDA',
        serious: 'Bamboo-eating bear',
        funny: 'A bear that’s strictly black and white',
      },
      {
        word: 'ROACH',
        serious: 'Common household pest',
        funny: 'The only thing that survives the apocalypse',
      },
      {
        word: 'SHEEP',
        serious: 'Wool-producing animal',
        funny: 'A cloud with legs that says "baa"',
      },
      {
        word: 'SHREW',
        serious: 'Tiny insectivorous mammal',
        funny: 'A tiny animal with a big temper',
      },
      { word: 'SNAKE', serious: 'Legless reptile', funny: 'A danger noodle' },
      {
        word: 'SQUID',
        serious: 'Ten-armed cephalopod',
        funny: 'An ink-jet printer with tentacles',
      },
      {
        word: 'TIGER',
        serious: 'Striped feline',
        funny: 'A cat that "grrr-eats" frosted flakes',
      },
      {
        word: 'WHALE',
        serious: 'Massive marine mammal',
        funny: 'A submarine made of blubber',
      },
      {
        word: 'ZEBRA',
        serious: 'Striped African equine',
        funny: "A horse in a referee's uniform",
      },

      {
        word: 'BABOON',
        serious: 'Large Old World monkey',
        funny: 'A primate with a colorful backside',
      },
      {
        word: 'BEAGLE',
        serious: 'Scent hound breed',
        funny: 'Snoopy’s actual species',
      },
      {
        word: 'COUGAR',
        serious: 'Puma or mountain lion',
        funny: 'A big cat or a dating stereotype',
      },
      {
        word: 'COYOTE',
        serious: 'North American wild dog',
        funny: 'ACME’s #1 customer',
      },
      {
        word: 'DONKEY',
        serious: 'Ass or beast of burden',
        funny: 'Shrek’s talkative sidekick',
      },
      {
        word: 'ERMINE',
        serious: 'Weasel in its white winter coat',
        funny: 'A rodent that’s also a royal robe',
      },
      {
        word: 'FALCON',
        serious: 'Fast-flying bird of prey',
        funny: 'A bird that’s also a Ford model',
      },
      {
        word: 'GIRAFFE',
        serious: 'Long-necked African mammal',
        funny: 'A horse that’s been stretched out',
      },
      {
        word: 'GOPHER',
        serious: 'Burrowing rodent',
        funny: 'The guy who "goes fer" coffee?',
      },
      {
        word: 'JACKAL',
        serious: 'Wild dog of Africa/Asia',
        funny: "A canine that's a bit of a scavenger",
      },
      {
        word: 'LIZARD',
        serious: 'Scaly reptile',
        funny: 'A small dinosaur living in your garden',
      },
      {
        word: 'MONKEY',
        serious: 'Arboreal primate',
        funny: 'The creature responsible for "business"',
      },
      {
        word: 'OCELOT',
        serious: 'Spotted wildcat',
        funny: 'A cat that’s "a lot" to handle',
      },
      {
        word: 'OYSTER',
        serious: 'Bivalve mollusk',
        funny: 'A rock that makes jewelry',
      },
      {
        word: 'PARROT',
        serious: 'Mimicking bird',
        funny: "A colorful bird that won't shut up",
      },
      {
        word: 'PYTHON',
        serious: 'Large constrictor snake',
        funny: 'A snake that’s also a coding language',
      },
      {
        word: 'RABBIT',
        serious: 'Long-eared burrower',
        funny: 'A professional carrot cruncher',
      },
      {
        word: 'SALMON',
        serious: 'Spawning river fish',
        funny: 'A fish that’s always swimming upstream',
      },
      {
        word: 'TOUCAN',
        serious: 'Large-billed tropical bird',
        funny: 'The bird that follows its nose',
      },
      {
        word: 'TURTLE',
        serious: 'Shelled reptile',
        funny: 'A mobile home with legs',
      },
      {
        word: 'URCHIN',
        serious: 'Spiny sea creature',
        funny: 'A prickly underwater pincushion',
      },
      {
        word: 'WALRUS',
        serious: 'Tusked marine mammal',
        funny: 'A seal with a serious mustache',
      },

      {
        word: 'AARDVARK',
        serious: 'African ant-eater',
        funny: 'The first animal in the dictionary',
      },
      {
        word: 'BUFFALO',
        serious: 'Large wild ox',
        funny: 'A city in NY or a hairy beast',
      },
      {
        word: 'CHEETAH',
        serious: 'Fastest land animal',
        funny: 'A feline that never plays fair',
      },
      {
        word: 'CHICKEN',
        serious: 'Common poultry',
        funny: 'The animal that crossed the road',
      },
      {
        word: 'DOLPHIN',
        serious: 'Intelligent marine mammal',
        funny: 'A porpoise with a purpose',
      },
      {
        word: 'ELEPHANT',
        serious: 'Largest land mammal',
        funny: 'The only one in the room nobody talks about',
      },
      {
        word: 'FLAMINGO',
        serious: 'Pink wading bird',
        funny: 'A bird that’s a lawn ornament',
      },
      {
        word: 'GAZELLE',
        serious: 'Graceful antelope',
        funny: 'A fast runner with thin legs',
      },
      {
        word: 'HAMSTER',
        serious: 'Small pet rodent',
        funny: 'A creature that lives in a wheel',
      },
      {
        word: 'KANGAROO',
        serious: 'Pouch-bearing marsupial',
        funny: 'An Australian with a built-in purse',
      },
      {
        word: 'LEOPARD',
        serious: 'Spotted big cat',
        funny: "An animal that can't change its spots",
      },
      {
        word: 'MANATEE',
        serious: 'Aquatic "sea cow"',
        funny: 'A floating potato that lives in Florida',
      },
      {
        word: 'MEERKAT',
        serious: 'Social African mongoose',
        funny: 'A sentry that’s always on its tiptoes',
      },
      {
        word: 'OSTRICH',
        serious: 'Largest flightless bird',
        funny: "An animal that thinks you can't see it",
      },
      {
        word: 'PANTHER',
        serious: 'Black wildcat',
        funny: "A cat that's very 'Pink' in movies",
      },
      {
        word: 'PELICAN',
        serious: 'Large-billed waterbird',
        funny: 'A bird whose beak holds more than its belly',
      },
      {
        word: 'PENGUIN',
        serious: 'Flightless Antarctic bird',
        funny: 'A bird in a permanent tuxedo',
      },
      {
        word: 'PLATYPUS',
        serious: 'Egg-laying mammal',
        funny: 'Nature’s weirdest mash-up',
      },
      {
        word: 'RACCOON',
        serious: 'Masked nocturnal mammal',
        funny: 'A "trash panda"',
      },

      {
        word: 'SCORPION',
        serious: 'Arachnid with a stinger',
        funny: 'A bug with a lethal tail-light',
      },
      {
        word: 'SQUIRREL',
        serious: 'Bushy-tailed rodent',
        funny: 'A nut-gathering park ninja',
      },
      {
        word: 'WARTHOG',
        serious: 'Tusked wild pig',
        funny: 'Pumbaa’s real-life relative',
      },
      {
        word: 'HERON',
        serious: 'Long-legged wading bird',
        funny: "A bird that looks like it's waiting for a bus that never comes",
      },
      {
        word: 'GUPPY',
        serious: 'Small freshwater fish',
        funny: 'The "starter" fish for every 5-year-old',
      },
      {
        word: 'BADGER',
        serious: 'Nocturnal burrowing mammal',
        funny: "An animal that really doesn't care",
      },
      {
        word: 'SLOTH',
        serious: 'Slow-moving tree dweller',
        funny: 'The official mascot of Monday mornings',
      },
      {
        word: 'MOOSE',
        serious: 'Large palmate-antlered deer',
        funny: 'A deer on a massive growth hormone',
      },
    ],

    // Safety net: one tiny built-in puzzle so pack never hard-fails if generation ever throws.
    puzzles: [
      {
        id: 'ani-001',
        title: 'Animals Mini',
        difficulty: 'easy',
        grid: ['CAT#DOG', 'A#O#A#O', 'TAR#RAT', '###A###', 'OWL#EMU'],
        clues: {
          serious: {
            across: {
              r0c0: 'Feline pet',
              r0c4: 'Canis lupus familiaris',
              r2c0: 'Sticky black substance',
              r2c4: 'Common rodent',
              r4c0: 'Nocturnal bird of prey',
              r4c4: 'Flightless Australian bird',
            },
            down: {
              r0c0: 'C, then A, then T (down)',
              r0c2: 'A short rocky peak (down)',
              r0c4: 'A quick dash (down)',
              r0c6: 'A small bird sound (down)',
            },
          },
          funny: {
            across: {
              r0c0: 'The real owner of your house',
              r0c4: 'A professional tail-wagger',
              r2c0: 'Road glue',
              r2c4: 'A mouse on steroids',
              r4c0: 'A bird that gives a hoot',
              r4c4: 'A giant feather duster on legs',
            },
            down: {
              r0c0: 'Down word: CAT (very on-brand)',
              r0c2: 'Down word: TOR (not an animal, sorry)',
              r0c4: 'Down word: DAR (tiny word, big dreams)',
              r0c6: 'Down word: GOT (what you’ll say when you solve it)',
            },
          },
        },
      },
    ],
  },

  holidays: {
    id: 'holidays',
    name: 'Holidays',
    wordBank: [
      // 3-letter glue
      { word: 'TIN', serious: 'Metal container', funny: 'Cookie housing unit' },
      { word: 'EAT', serious: 'Have a meal', funny: 'Holiday main sport' },
      {
        word: 'NOG',
        serious: 'Eggnog, for short',
        funny: 'Creamy holiday mischief',
      },
      { word: 'EVE', serious: 'Night before', funny: 'The pre-party page' },
      {
        word: 'IVY',
        serious: 'Evergreen plant',
        funny: 'Green that won’t quit',
      },
      {
        word: 'JOY',
        serious: 'Holiday feeling',
        funny: 'The vibe everyone’s chasing',
      },
      { word: 'TOY', serious: 'Gift item', funny: 'Kid magnet' },
      { word: 'ICE', serious: 'Frozen water', funny: 'Slippery regret' },
      {
        word: 'FIR',
        serious: 'Evergreen type',
        funny: 'Tree that smells like December',
      },
      {
        word: 'ELF',
        serious: 'Santa helper',
        funny: 'Tiny coworker with energy',
      },
      { word: 'LOG', serious: 'Yule ___', funny: 'Firewood with branding' },
      {
        word: 'INN',
        serious: 'Nativity setting',
        funny: 'No vacancy, historically',
      },
      { word: 'NIP', serious: 'Sharp bite of cold', funny: 'Winter saying hi' },
      {
        word: 'RED',
        serious: 'Holiday color',
        funny: 'The loudest color in December',
      },
      { word: 'TEA', serious: 'Cozy drink', funny: 'Warm mug of calm' },

      // 4-letter sweet spot
      {
        word: 'NOEL',
        serious: 'Holiday song word',
        funny: 'Seasonal word you hear in malls',
      },
      {
        word: 'STAR',
        serious: 'Tree topper',
        funny: 'Pointy reminder you own a ladder',
      },
      { word: 'GELT', serious: 'Hanukkah coins', funny: 'Chocolate currency' },
      {
        word: 'TREE',
        serious: 'Decorated evergreen',
        funny: 'The thing cats attack in December',
      },
      {
        word: 'SNOW',
        serious: 'Winter precipitation',
        funny: 'Cold sky confetti',
      },
      {
        word: 'GIFT',
        serious: 'Present',
        funny: 'Proof you remembered someone exists',
      },
      {
        word: 'SLED',
        serious: 'Winter ride',
        funny: 'Gravity-powered fun plank',
      },
      {
        word: 'BELL',
        serious: 'Jingling sound',
        funny: 'Noise that means shopping',
      },
      {
        word: 'PINE',
        serious: 'Evergreen tree',
        funny: 'Air freshener, but real',
      },
      {
        word: 'DEER',
        serious: 'Hoofed animal',
        funny: 'Forest runner with attitude',
      },
      {
        word: 'CARD',
        serious: 'Mailed greeting',
        funny: 'Paper update from your relatives',
      },
      {
        word: 'COLD',
        serious: 'Low temperature',
        funny: 'Weather that bites back',
      },
      { word: 'HYMN', serious: 'Church song', funny: 'Choir mode: activated' },
      {
        word: 'WRAP',
        serious: 'Cover a gift',
        funny: 'Tape-based engineering',
      },
      { word: 'GOLD', serious: 'Precious metal', funny: 'Shiny status symbol' },
      {
        word: 'BAKE',
        serious: 'Cook in an oven',
        funny: 'Turn dough into joy',
      },
      {
        word: 'FIRE',
        serious: 'Hearth warmth',
        funny: 'Indoor heat with drama',
      },
      {
        word: 'YULE',
        serious: 'Old Christmas season word',
        funny: 'Classic holiday vibe word',
      },
      { word: 'GLOW', serious: 'Soft light', funny: 'Light that’s trying' },
      {
        word: 'HOPE',
        serious: 'Holiday theme',
        funny: 'The emotional battery pack',
      },

      // 5-letter connectors
      {
        word: 'MERRY',
        serious: 'Common greeting word',
        funny: 'Cheer, in one word',
      },
      { word: 'JOLLY', serious: 'Cheerful', funny: 'Santa’s default setting' },
      {
        word: 'SANTA',
        serious: 'Gift-giver figure',
        funny: 'The big guy with the schedule',
      },
      {
        word: 'CAROL',
        serious: 'Holiday song',
        funny: 'Group singing, whether asked for or not',
      },
      {
        word: 'CANDY',
        serious: 'Sweet treat',
        funny: 'Dentist’s retirement plan',
      },
      {
        word: 'HOLLY',
        serious: 'Red-berried plant',
        funny: 'Christmas shrub with flair',
      },
      {
        word: 'PEACE',
        serious: 'Holiday wish',
        funny: 'What the house wants after guests leave',
      },
      {
        word: 'FROST',
        serious: 'Frozen coating',
        funny: 'Nature’s glitter, but cold',
      },
      {
        word: 'GLAZE',
        serious: 'Shiny coating',
        funny: 'Sugar’s glossy jacket',
      },
      {
        word: 'CIDER',
        serious: 'Hot spiced drink',
        funny: 'Apple juice with ambition',
      },
      {
        word: 'ANGEL',
        serious: 'Heavenly figure',
        funny: 'Tree topper with a tiny halo',
      },
      { word: 'TAPER', serious: 'Thin candle', funny: 'Candle on a diet' },
      {
        word: 'MYRRH',
        serious: 'Wise Men gift',
        funny: 'Ancient “thanks, I guess” gift',
      },
      { word: 'GRINCH', serious: 'Green villain', funny: 'CEO of side-eye' },
      {
        word: 'PARTY',
        serious: 'Festive gathering',
        funny: 'Snacks plus chaos',
      },
      {
        word: 'CLAUS',
        serious: 'Santa’s surname',
        funny: 'Last name with overtime',
      },
      { word: 'FAITH', serious: 'Belief', funny: 'Hope’s serious cousin' },
      {
        word: 'LIGHTS',
        serious: 'Holiday decorations',
        funny: 'Tiny bulbs refusing to cooperate',
      },
      {
        word: 'TOAST',
        serious: 'Celebration ritual',
        funny: 'Clink and promise things',
      },

      // 6-letter utility
      {
        word: 'WREATH',
        serious: 'Door decoration',
        funny: 'Door jewelry for December',
      },
      {
        word: 'WINTER',
        serious: 'Cold season',
        funny: 'The long loading screen',
      },
      {
        word: 'EGGNOG',
        serious: 'Spiced holiday drink',
        funny: 'Creamy courage in a cup',
      },
      { word: 'SLEIGH', serious: 'Holiday ride', funny: 'Uber, but airborne' },
      {
        word: 'SWEETS',
        serious: 'Sugary treats',
        funny: 'Snack tax of the season',
      },
      {
        word: 'ADVENT',
        serious: 'Countdown period',
        funny: 'Days-left hype machine',
      },
      { word: 'CANDLE', serious: 'Wax light', funny: 'Tiny controlled fire' },
      {
        word: 'DINNER',
        serious: 'Big meal',
        funny: 'The main event with dishes after',
      },
      {
        word: 'GIVING',
        serious: 'Holiday spirit',
        funny: 'Kindness with a bow',
      },
      { word: 'RIBBON', serious: 'Gift tie', funny: 'Bow-making fuel' },
      {
        word: 'TURKEY',
        serious: 'Holiday main course',
        funny: 'The bird with the spotlight',
      },
      { word: 'SPIRIT', serious: 'Holiday ___', funny: 'Mood in a word' },
      {
        word: 'SILVER',
        serious: 'Holiday color',
        funny: 'Shiny, but cooler than gold',
      },
      {
        word: 'FAMILY',
        serious: 'Relatives',
        funny: 'Group chat, but in person',
      },
      {
        word: 'GINGER',
        serious: 'Spice in baking',
        funny: 'Cookie personality ingredient',
      },

      // 7+ anchors from your list
      {
        word: 'SNOWMAN',
        serious: 'Figure made of snow',
        funny: 'Temporary outdoor roommate',
      },
      {
        word: 'HOLIDAY',
        serious: 'Festive time',
        funny: 'Calendar-approved break',
      },
      {
        word: 'COOKIES',
        serious: 'Baked treats',
        funny: 'Oven-made happiness',
      },
      {
        word: 'GARLAND',
        serious: 'Decorative greenery',
        funny: 'Tinsel’s leafy friend',
      },
      {
        word: 'CHIMNEY',
        serious: 'Fireplace vent',
        funny: 'Santa’s alleged entrance',
      },
      {
        word: 'FESTIVE',
        serious: 'Holiday spirited',
        funny: 'Sparkly and slightly chaotic',
      },
      {
        word: 'MISTLETOE',
        serious: 'Kissing plant tradition',
        funny: 'Ceiling-based social pressure',
      },
      {
        word: 'STOCKING',
        serious: 'Hanging gift sock',
        funny: 'Wall sock of mystery items',
      },
      { word: 'PRESENTS', serious: 'Gifts', funny: 'Proof of shopping panic' },
      {
        word: 'REINDEER',
        serious: 'Sleigh puller',
        funny: 'Team of nine, allegedly',
      },
      {
        word: 'DECEMBER',
        serious: 'Winter month',
        funny: 'The month that sprints',
      },
      {
        word: 'HANUKKAH',
        serious: 'Festival of Lights',
        funny: 'Eight nights, strong candle game',
      },
      {
        word: 'KWANZAA',
        serious: 'Cultural holiday',
        funny: 'Celebration with meaning and warmth',
      },
      {
        word: 'CELEBRATE',
        serious: 'Mark with joy',
        funny: 'Turn the day into a party',
      },
      {
        word: 'NATIVITY',
        serious: 'Manger scene',
        funny: 'Classic story setup',
      },
      {
        word: 'SNOWFLAKE',
        serious: 'Unique ice crystal',
        funny: 'One-of-a-kind cold speck',
      },
      {
        word: 'ORNAMENTS',
        serious: 'Tree baubles',
        funny: 'Glass decorations with risky jobs',
      },
      {
        word: 'FRUITCAKE',
        serious: 'Dense holiday cake',
        funny: 'The gift that keeps returning',
      },
      {
        word: 'PINECONE',
        serious: 'Cone from a pine tree',
        funny: 'Nature’s little grenade',
      },
      {
        word: 'MIDNIGHT',
        serious: '12:00 AM',
        funny: 'The “make a wish” time',
      },
      {
        word: 'FIREWORKS',
        serious: 'New Year show',
        funny: 'Loud sparkle physics',
      },
      {
        word: 'NUTCRACKER',
        serious: 'Holiday ballet and figure',
        funny: 'Wooden soldier with opinions',
      },
      {
        word: 'TRADITION',
        serious: 'Family custom',
        funny: 'We do this because we always do',
      },
      {
        word: 'MITTENS',
        serious: 'Hand warmers',
        funny: 'Gloves, but simpler',
      },
      {
        word: 'DREIDEL',
        serious: 'Spinning top',
        funny: 'Tiny toy with big energy',
      },

      // Fillers to reach 100, chosen for grid value
      {
        word: 'TINSEL',
        serious: 'Shiny tree decoration',
        funny: 'Sparkle spaghetti',
      },
      {
        word: 'ORNAMENT',
        serious: 'Tree decoration',
        funny: 'Bauble with a mission',
      },
      { word: 'FIREPLACE', serious: 'Hearth', funny: 'The warm brag corner' },
      {
        word: 'COUNTDOWN',
        serious: 'Time until an event',
        funny: 'Math with excitement',
      },
      {
        word: 'GINGERBREAD',
        serious: 'Spiced cookie',
        funny: 'Cookie that became architecture',
      },
      {
        word: 'NORTHPOLE',
        serious: 'Santa’s home',
        funny: 'Where the calendar lives',
      },
    ],

    puzzles: [
      {
        id: 'hol-001',
        title: 'Mini Holidays',
        difficulty: 'easy',
        grid: ['NOEL#', 'A#A#S', 'TREE#', '###E#', 'YULE#'],
        clues: {
          serious: {
            across: {
              r0c0: 'Holiday song word',
              r2c0: 'Decorated evergreen',
              r4c0: 'Old word for Christmas season',
            },
            down: {
              r0c0: 'Opposite of yes (start)',
              r0c1: 'Round vowel',
              r0c2: 'Fifth vowel',
            },
          },
          funny: {
            across: {
              r0c0: 'Seasonal word you hear in malls',
              r2c0: 'The thing cats attack in December',
              r4c0: 'Classic holiday vibe word',
            },
            down: {
              r0c0: 'What you say to more meetings',
              r0c1: 'O, shaped like a cookie',
              r0c2: 'E, as in “Eggnog?”',
            },
          },
        },
      },
    ],
  },
};

// ─────────────────────────────────────────────
// "Everything" pack support
// "Everything" is a virtual pack that pulls from all installed packs.
// This automatically includes future packs added to PACKS.
// ─────────────────────────────────────────────

const EVERYTHING_PACK_ID = 'everything';

function getInstalledPacks() {
  // Only real packs that live inside PACKS (future packs auto-included).
  return Object.values(PACKS).filter(
    (p) => p && p.id && p.id !== EVERYTHING_PACK_ID
  );
}

function buildEverythingWordBank() {
  // Merge all word banks, dedupe by normalized word.
  // If duplicates exist across packs, we keep the first one seen.
  const byWord = new Map();

  for (const pack of getInstalledPacks()) {
    const bank = Array.isArray(pack.wordBank) ? pack.wordBank : [];
    for (const item of bank) {
      const w = normalizeWord(item?.word);
      if (!w) continue;

      if (!byWord.has(w)) {
        byWord.set(w, {
          word: w,
          serious: item?.serious || '(Generated clue)',
          funny: item?.funny || item?.serious || '(Generated clue)',
        });
      }
    }
  }

  return Array.from(byWord.values());
}

function pickPuzzleFromAllPacks(difficulty) {
  // Build a pool of puzzles tagged with their source pack.
  const pool = [];

  for (const pack of getInstalledPacks()) {
    const puzzles = Array.isArray(pack.puzzles) ? pack.puzzles : [];
    for (const p of puzzles) {
      if (!p) continue;
      pool.push({ pack, puzzle: p });
    }
  }

  if (!pool.length) return null;

  // Prefer matching difficulty, otherwise fallback to any.
  const filtered = pool.filter(
    (x) => x.puzzle && x.puzzle.difficulty === difficulty
  );
  const chosen = pickRandom(filtered.length ? filtered : pool);

  return chosen || null;
}

function getSelectedPackId() {
  const sel = document.getElementById('pack');
  return sel ? sel.value : 'general';
}

function getSelectedTone() {
  const sel = document.getElementById('tone');
  const raw = sel ? sel.value : 'serious';

  // "random" resolves once per generated puzzle.
  // We resolve inside initCrosswordFromSelections() by calling this once,
  // so the entire puzzle stays consistent (no mid-game tone flipping).
  if (raw === 'random') {
    return Math.random() < 0.5 ? 'serious' : 'funny';
  }

  return raw;
}

function pickRandom(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const index = Math.floor(Math.random() * arr.length);
  return arr[index];
}

function pickRandomByDifficulty(puzzles, difficulty) {
  if (!Array.isArray(puzzles) || puzzles.length === 0) return null;

  const filtered = puzzles.filter((p) => p && p.difficulty === difficulty);
  return pickRandom(filtered) || pickRandom(puzzles);
}

function getSelectedDifficulty() {
  const sel = document.getElementById('difficulty');
  return sel ? sel.value : 'medium';
}

function getSelectedTimeLength() {
  const sel = document.getElementById('timeLength');
  return sel ? sel.value : 'medium';
}

// Grid size selection (small / medium / large).
// Internally still named "timeLength" for legacy reasons.
// Originally modeled puzzle duration, now maps to square grid size.
// Renaming later is safe once UI + generator are fully locked.

const TIME_LENGTH_TO_SIZE = {
  small: 11,
  medium: 13,
  large: 15,
};

// Basic utility
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function normalizeWord(raw) {
  return String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
}

/**
 * Pick up to n items from an array (random sample).
 */
function sample(arr, n) {
  if (!Array.isArray(arr)) return [];
  const copy = arr.slice();
  const out = [];

  while (copy.length && out.length < n) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

/**
 * Weighted sampling without replacement.
 * - items: array of items
 * - weights: array of positive numbers (same length as items)
 * - n: number to pick
 *
 * Why: lets us bias word lengths by difficulty without hard bans.
 */
function weightedSample(items, weights, n) {
  if (!Array.isArray(items) || !Array.isArray(weights)) return [];
  if (items.length !== weights.length) return [];
  if (n <= 0) return [];

  // Work on copies so we don't mutate the original arrays
  const poolItems = items.slice();
  const poolWeights = weights.slice();
  const out = [];

  while (poolItems.length && out.length < n) {
    let total = 0;
    for (const w of poolWeights) total += Math.max(0, w);

    // If all weights are zero (or negative), fall back to uniform random
    if (total <= 0) {
      const idx = Math.floor(Math.random() * poolItems.length);
      out.push(poolItems.splice(idx, 1)[0]);
      poolWeights.splice(idx, 1);
      continue;
    }

    let roll = Math.random() * total;
    let picked = 0;

    for (let i = 0; i < poolWeights.length; i++) {
      roll -= Math.max(0, poolWeights[i]);
      if (roll <= 0) {
        picked = i;
        break;
      }
    }

    out.push(poolItems.splice(picked, 1)[0]);
    poolWeights.splice(picked, 1);
  }

  return out;
}

/**
 * Difficulty "feel" weighting based on word length.
 * We bias selection, but do not hard-ban lengths (other than basic cleanup).
 */
function lengthWeight(len, difficulty) {
  // Guard: weird lengths get basically ignored
  if (!Number.isFinite(len) || len <= 0) return 0;

  if (difficulty === 'easy') {
    // Easy: prefer 3–5, allow longer as spice
    if (len <= 2) return 0.05;
    if (len === 3) return 6.0;
    if (len === 4) return 7.0;
    if (len === 5) return 6.5;
    if (len === 6) return 3.0;
    if (len === 7) return 1.8;
    if (len === 8) return 0.9;
    return 0.4; // 9+
  }

  if (difficulty === 'hard') {
    // Hard: prefer 7+, still allow shorter for crossings
    if (len <= 2) return 0.05;
    if (len === 3) return 0.7;
    if (len === 4) return 1.0;
    if (len === 5) return 1.8;
    if (len === 6) return 2.8;
    if (len === 7) return 5.0;
    if (len === 8) return 6.5;
    if (len === 9) return 7.0;
    return 7.5; // 10+
  }

  // Medium: balanced (a gentle "hill" around 5–7)
  if (len <= 2) return 0.05;
  if (len === 3) return 2.5;
  if (len === 4) return 4.0;
  if (len === 5) return 5.5;
  if (len === 6) return 6.0;
  if (len === 7) return 5.5;
  if (len === 8) return 3.8;
  if (len === 9) return 2.2;
  return 1.4; // 10+
}

// ─────────────────────────────────────────────
// Session 7 — Gameplay Variety: short-term memory
// Soft-penalize recently used words per pack (in-memory only).
// ─────────────────────────────────────────────

const RECENT_MEMORY_WINDOW = 4; // last N puzzles per pack
const RECENT_WEIGHT_PENALTIES = [0.1, 0.3, 0.5, 0.7]; // newest -> oldest

// Store: packId -> [ [wordsUsedInPuzzle], [wordsUsedInPuzzle], ... ]
const recentWordMemoryByPack = new Map();

function getRecentPuzzleLists(packId) {
  if (!recentWordMemoryByPack.has(packId)) {
    recentWordMemoryByPack.set(packId, []);
  }
  return recentWordMemoryByPack.get(packId);
}

/**
 * Returns a multiplier (0..1+) to reduce the chance of repeating a word.
 * - If a word appeared in the most recent puzzle: heavy penalty
 * - If it appeared 2–4 puzzles ago: lighter penalty
 * - Otherwise: no penalty
 */
function getRecencyWeightFactor(packId, word) {
  const puzzles = getRecentPuzzleLists(packId);
  if (!puzzles.length) return 1;

  // Check from most-recent backwards
  for (let back = 0; back < puzzles.length; back++) {
    const idx = puzzles.length - 1 - back;
    const usedWords = puzzles[idx];

    if (usedWords && usedWords.includes(word)) {
      return RECENT_WEIGHT_PENALTIES[back] ?? 0.75;
    }
  }

  return 1;
}

/**
 * Record words used in a successfully generated puzzle.
 * Keeps only the last RECENT_MEMORY_WINDOW puzzles per pack.
 */
function rememberPuzzleWords(packId, wordsUsed) {
  const puzzles = getRecentPuzzleLists(packId);

  // store unique, normalized words only
  const unique = Array.from(
    new Set((wordsUsed || []).map((w) => normalizeWord(w)).filter(Boolean))
  );

  puzzles.push(unique);

  // Trim to memory window
  while (puzzles.length > RECENT_MEMORY_WINDOW) {
    puzzles.shift();
  }
}

/**
 * Simple Across-only generator.
 * - Creates a square grid
 * - Places words left-to-right on rows with block separators
 * - Builds clue maps for Across and Down starts
 * - Returns a "puzzle-like" object that matches what buildCrosswordModel expects
 */
function generatePuzzleFromWordBank({ packId, tone, difficulty, timeLength }) {
  //  Everything pack is virtual and dynamic.
  const pack =
    packId === EVERYTHING_PACK_ID
      ? {
          id: EVERYTHING_PACK_ID,
          name: 'Everything',
          wordBank: buildEverythingWordBank(),
        }
      : PACKS[packId] || PACKS.general;

  const size = TIME_LENGTH_TO_SIZE[timeLength] || TIME_LENGTH_TO_SIZE.medium;

  const bank = Array.isArray(pack.wordBank) ? pack.wordBank : [];

  if (bank.length < 6) {
    throw new Error(`CRSWRD: wordBank too small for pack "${packId}"`);
  }

  // Keep basic sanitation only. Difficulty "feel" comes from weighting, not bans.
  const minLen = 3;
  const maxLen = size; // grid-limited

  const candidates = bank
    .map((x) => ({
      word: normalizeWord(x.word),
      serious: x.serious || '(Generated clue)',
      funny: x.funny || x.serious || '(Generated clue)',
    }))
    .filter((x) => x.word.length >= minLen && x.word.length <= maxLen);

  if (candidates.length < 6) {
    throw new Error(`CRSWRD: not enough candidate words for "${packId}"`);
  }

  // How many across entries should we try?
  // This is intentionally conservative.
  const targetWords = clamp(Math.floor(size * 0.75), 6, 12);

  // Try a few times with random selection
  const attempts = 30;

  for (let attempt = 0; attempt < attempts; attempt++) {
    // Weighted pick: makes Easy/Medium/Hard feel different without changing the algorithm.
    // Session 7: also soft-penalize recently used words (per pack) to improve variety.
    const weights = candidates.map((x) => {
      const base = lengthWeight(x.word.length, difficulty);
      const recency = getRecencyWeightFactor(pack.id, x.word);
      return base * recency;
    });

    const chosen = weightedSample(candidates, weights, targetWords);

    const grid = createEmptyGrid(size);

    const placedAcross = placeAcrossOnly(grid, chosen);

    if (placedAcross.length < 5) continue;

    // Use full candidate pool for Down placement
    const placedDown = placeDownWithCrossings(grid, candidates, placedAcross);

    // Require a minimum number of Down entries or retry
    const minDown =
      timeLength === 'small' ? 3 : timeLength === 'medium' ? 4 : 5;

    if (placedDown.length < minDown) {
      continue;
    }

    const placedAll = [...placedAcross, ...placedDown];
    const gridStrings = gridToStrings(grid);

    // Quality guard: reject accidental 2-letter (or otherwise too-short) entries
    // at the grid level, so they never show up as junk clues.
    if (gridHasTooShortEntries(gridStrings, 3)) {
      continue;
    }

    const clues = buildGeneratedClues({
      grid: gridStrings,
      placedWords: placedAll,
      tone,
    });

    // Session 7: remember words used so the next puzzles avoid immediate repeats.
    rememberPuzzleWords(
      pack.id,
      placedAll.map((p) => p.word)
    );

    return {
      grid: gridStrings,
      clues,
      meta: {
        packId: pack.id,
        puzzleId: `gen-${pack.id}-${Date.now()}`,
        title: `Generated (${pack.name})`,
        difficulty,
      },
    };
  }

  throw new Error(`CRSWRD: generation failed for pack "${packId}"`);
}

function createEmptyGrid(size) {
  // Fill with blocks by default, then carve open cells as we place words.
  const grid = [];
  for (let r = 0; r < size; r++) {
    const row = [];
    for (let c = 0; c < size; c++) row.push('#');
    grid.push(row);
  }
  return grid;
}

/**
 * Phase 4 – Step 1: Across placement (base layout)
 *
 * - Places words left-to-right only
 * - One word per row (if it fits)
 * - Start column varies per word (spreads letters across the grid)
 * - A block is placed before and after each word when possible
 * - Remaining cells stay as blocks
 *
 * This creates a better scaffold for Down placement and reduces accidental
 * "vertical chimneys" that produce nonsense Down entries.
 */
function placeAcrossOnly(grid, words) {
  const size = grid.length;
  const placed = [];
  const usedColumns = new Set();

  let row = 0;

  // Light shuffle so we don't always get the same layout.
  const shuffled = words.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  for (const item of shuffled) {
    if (row >= size) break;

    const w = item.word;
    if (!w || w.length > size) continue;

    // Choose a start column that allows the word to fit.
    // We keep at least 1 cell margin sometimes so blocks can separate entries.
    const maxStart = size - w.length;
    const startC =
      maxStart <= 0 ? 0 : Math.floor(Math.random() * (maxStart + 1));

    // If the cell before start is in-bounds, force it to a block to terminate any previous entry
    if (startC > 0) grid[row][startC - 1] = '#';

    // Place the word
    for (let i = 0; i < w.length; i++) {
      grid[row][startC + i] = w[i];
    }

    // If the cell after the word is in-bounds, force it to a block to terminate the entry
    const after = startC + w.length;
    if (after < size) grid[row][after] = '#';

    placed.push({
      dir: 'across',
      word: w,
      r: row,
      c: startC,
      serious: item.serious,
      funny: item.funny,
    });

    // Keep your existing row spacing rule
    row += size >= 11 ? 2 : 1;
  }

  return placed;
}

function buildLetterIndex(grid) {
  const idx = new Map(); // letter -> [{r,c}]
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[0].length; c++) {
      const ch = grid[r][c];
      if (ch === '#') continue;
      if (!idx.has(ch)) idx.set(ch, []);
      idx.get(ch).push({ r, c });
    }
  }
  return idx;
}

/**
 * Attempt to place Down words by crossing existing letters.
 * Rules:
 * - Must cross at least one existing letter.
 * - Can overwrite '#' cells, but cannot conflict with a different letter.
 * - The cell above start must be a block or edge.
 * - The cell below end must be a block or edge.
 */
function placeDownWithCrossings(grid, words, alreadyPlacedWords) {
  const size = grid.length;
  const placed = [];
  const used = new Set(alreadyPlacedWords.map((p) => p.word));

  // Track which columns we've started Down entries in, to reduce clumping.
  const usedColumns = new Set();

  // Index current letters for fast "where can we cross?" lookup
  let letterIndex = buildLetterIndex(grid);

  // Try longer words first to make Down entries feel real
  const sorted = words
    .filter((w) => w && w.word && !used.has(w.word))
    .slice()
    .sort((a, b) => b.word.length - a.word.length);

  const maxDown = clamp(Math.floor(size * 0.9), 5, 12);

  for (const item of sorted) {
    if (placed.length >= maxDown) break;

    const w = item.word;
    if (w.length > size) continue;

    // Find candidate crossings by letter
    const crossings = [];
    for (let i = 0; i < w.length; i++) {
      const ch = w[i];
      const spots = letterIndex.get(ch);
      if (!spots) continue;
      for (const spot of spots) {
        crossings.push({ wordIndex: i, r: spot.r, c: spot.c });
      }
    }

    // Shuffle crossings so we don't always generate the same look
    for (let i = crossings.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [crossings[i], crossings[j]] = [crossings[j], crossings[i]];
    }

    let placedThis = false;

    // Two-pass crossing tries:
    // Pass 1: prefer columns not near existing Down starts
    // Pass 2: allow anything (so we don’t tank generation success)
    for (let pass = 1; pass <= 2 && !placedThis; pass++) {
      for (const cross of crossings) {
        const startR = cross.r - cross.wordIndex;
        const startC = cross.c;

        if (pass === 1) {
          // Soft spacing rule: avoid stacking Down entries in same/adjacent columns
          if (
            usedColumns.has(startC) ||
            usedColumns.has(startC - 1) ||
            usedColumns.has(startC + 1)
          ) {
            continue;
          }
        }

        if (tryPlaceDown(grid, w, startR, startC)) {
          placed.push({
            dir: 'down',
            word: w,
            r: startR,
            c: startC,
            serious: item.serious,
            funny: item.funny,
          });

          usedColumns.add(startC);
          used.add(w);

          // Rebuild index after mutation (cheap at our grid sizes)
          letterIndex = buildLetterIndex(grid);
          placedThis = true;
          break;
        }
      }
    }

    if (!placedThis) {
      // skip silently, not every word will fit
    }
  }

  return placed;
}

function inBounds(r, c, size) {
  return r >= 0 && r < size && c >= 0 && c < size;
}

function tryPlaceDown(grid, word, startR, startC) {
  const size = grid.length;

  // Start must be in bounds and not forced into starting mid-word
  if (!inBounds(startR, startC, size)) return false;
  if (!inBounds(startR + word.length - 1, startC, size)) return false;

  // Above start must be block or edge
  if (startR > 0 && grid[startR - 1][startC] !== '#') return false;

  // Below end must be block or edge
  const endR = startR + word.length - 1;
  if (endR < size - 1 && grid[endR + 1][startC] !== '#') return false;

  // Check all cells fit and do not conflict
  let crossesExisting = false;

  for (let i = 0; i < word.length; i++) {
    const r = startR + i;
    const c = startC;
    const existing = grid[r][c];
    const ch = word[i];

    if (existing === '#') {
      // We are carving a new letter into a blocked cell.
      // Quality rule: don't allow carving that creates accidental Across entries.
      // So the carved cell must be horizontally isolated (neighbors are blocks or edges).
      const leftOpen = c > 0 && grid[r][c - 1] !== '#';
      const rightOpen = c < size - 1 && grid[r][c + 1] !== '#';

      if (leftOpen || rightOpen) return false;
      // ok to carve
    } else if (existing === ch) {
      crossesExisting = true;
    } else {
      return false;
    }
  }

  // Must cross at least one existing letter, otherwise it's boring and messy
  if (!crossesExisting) return false;

  // Apply placement
  for (let i = 0; i < word.length; i++) {
    const r = startR + i;
    grid[r][startC] = word[i];
  }

  return true;
}

function gridToStrings(grid) {
  return grid.map((row) => row.join(''));
}

/**
 * Phase 5 quality guard (applies to generated puzzles only):
 * Reject grids that contain too-short entries (ex: 2-letter Across/Down).
 *
 * Why: The UI model will detect 2-letter entries as real clues/answers.
 * We want to prevent those from existing in generated grids.
 */
function gridHasTooShortEntries(gridStrings, minLen) {
  const rows = gridStrings.length;
  const cols = gridStrings[0].length;

  const isBlockAt = (r, c) => gridStrings[r][c] === '#';

  function startsAcross(r, c) {
    if (isBlockAt(r, c)) return false;
    const leftIsBlock = c === 0 || isBlockAt(r, c - 1);
    const rightIsOpen = c + 1 < cols && !isBlockAt(r, c + 1);
    return leftIsBlock && rightIsOpen;
  }

  function startsDown(r, c) {
    if (isBlockAt(r, c)) return false;
    const upIsBlock = r === 0 || isBlockAt(r - 1, c);
    const downIsOpen = r + 1 < rows && !isBlockAt(r + 1, c);
    return upIsBlock && downIsOpen;
  }

  function readAcrossLen(r, c) {
    let cc = c;
    let len = 0;
    while (cc < cols && !isBlockAt(r, cc)) {
      len++;
      cc++;
    }
    return len;
  }

  function readDownLen(r, c) {
    let rr = r;
    let len = 0;
    while (rr < rows && !isBlockAt(rr, c)) {
      len++;
      rr++;
    }
    return len;
  }

  // Across scan
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!startsAcross(r, c)) continue;
      const len = readAcrossLen(r, c);
      if (len > 1 && len < minLen) return true;
    }
  }

  // Down scan
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      if (!startsDown(r, c)) continue;
      const len = readDownLen(r, c);
      if (len > 1 && len < minLen) return true;
    }
  }

  return false;
}

/**
 * Build clue maps for the generated grid by scanning the final grid.
 * This guarantees every Across/Down entry that the UI detects has a clue.
 */
function buildGeneratedClues({ grid, placedWords, tone }) {
  const rows = grid.length;
  const cols = grid[0].length;

  const isBlockAt = (r, c) => grid[r][c] === '#';

  // Map WORD -> clue text (based on tone). Used when we recognize an entry.
  const wordToClue = new Map();
  for (const p of placedWords) {
    const clue = tone === 'funny' ? p.funny : p.serious;
    if (p.word && clue) wordToClue.set(p.word, clue);
  }

  function startsAcross(r, c) {
    if (isBlockAt(r, c)) return false;
    const leftIsBlock = c === 0 || isBlockAt(r, c - 1);
    const rightIsOpen = c + 1 < cols && !isBlockAt(r, c + 1);
    return leftIsBlock && rightIsOpen;
  }

  function startsDown(r, c) {
    if (isBlockAt(r, c)) return false;
    const upIsBlock = r === 0 || isBlockAt(r - 1, c);
    const downIsOpen = r + 1 < rows && !isBlockAt(r + 1, c);
    return upIsBlock && downIsOpen;
  }

  function readAcrossWord(r, c) {
    let out = '';
    let cc = c;
    while (cc < cols && !isBlockAt(r, cc)) {
      out += grid[r][cc];
      cc++;
    }
    return out;
  }

  function readDownWord(r, c) {
    let out = '';
    let rr = r;
    while (rr < rows && !isBlockAt(rr, c)) {
      out += grid[rr][c];
      rr++;
    }
    return out;
  }

  const across = {};
  const down = {};

  // Across scan
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!startsAcross(r, c)) continue;

      const word = readAcrossWord(r, c);
      if (word.length < 3) continue;

      const startKey = `r${r}c${c}`;
      across[startKey] =
        wordToClue.get(word) ||
        (tone === 'funny'
          ? `Generated across: ${word}`
          : `Generated across entry (${word.length})`);
    }
  }

  // Down scan
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      if (!startsDown(r, c)) continue;

      const word = readDownWord(r, c);
      if (word.length < 3) continue;

      const startKey = `r${r}c${c}`;
      down[startKey] =
        wordToClue.get(word) ||
        (tone === 'funny'
          ? `Generated down: ${word}`
          : `Generated down entry (${word.length})`);
    }
  }

  return { across, down };
}

function getPuzzleFromPack(packId, tone, difficulty) {
  // Session 14: Everything pack fallback pulls from all packs' prebuilt puzzles.
  if (packId === EVERYTHING_PACK_ID) {
    const pick = pickPuzzleFromAllPacks(difficulty);

    // If we somehow have no puzzles anywhere, fall back to General.
    if (!pick) {
      return getPuzzleFromPack('general', tone, difficulty);
    }

    const { pack, puzzle } = pick;

    const clueSet =
      tone === 'funny'
        ? puzzle.clues.funny || puzzle.clues.serious
        : puzzle.clues.serious;

    return {
      grid: puzzle.grid,
      clues: clueSet,
      meta: {
        packId: pack.id,
        puzzleId: puzzle.id,
        title: puzzle.title,
        difficulty: puzzle.difficulty || 'unknown',
      },
    };
  }

  // Normal pack behavior
  const pack = PACKS[packId] || PACKS.general;
  const puzzle =
    pickRandomByDifficulty(pack.puzzles, difficulty) || pack.puzzles[0];

  if (!puzzle) {
    throw new Error(`CRSWRD: No puzzles found for pack "${packId}"`);
  }

  const clueSet =
    tone === 'funny'
      ? puzzle.clues.funny || puzzle.clues.serious
      : puzzle.clues.serious;

  return {
    grid: puzzle.grid,
    clues: clueSet,
    meta: {
      packId: pack.id,
      puzzleId: puzzle.id,
      title: puzzle.title,
      difficulty: puzzle.difficulty || 'unknown',
    },
  };
}

/**
 * Important: When regenerating, we must avoid stacking event listeners.
 * Easiest, safest approach: replace the grid + clue list nodes with clones.
 * Cloning drops all listeners, then we re-render + re-wire cleanly.
 */
function resetCrosswordMountPoints() {
  const host = document.getElementById('crossword');
  const acrossList = document.getElementById('acrossClues');
  const downList = document.getElementById('downClues');

  if (!host || !acrossList || !downList) return null;

  const hostFresh = host.cloneNode(false);
  host.parentNode.replaceChild(hostFresh, host);

  const acrossFresh = acrossList.cloneNode(false);
  acrossList.parentNode.replaceChild(acrossFresh, acrossList);

  const downFresh = downList.cloneNode(false);
  downList.parentNode.replaceChild(downFresh, downList);

  return { host: hostFresh, acrossList: acrossFresh, downList: downFresh };
}

function initCrosswordFromSelections() {
  const mounts = resetCrosswordMountPoints();
  if (!mounts) {
    console.warn(
      'CRSWRD: crossword UI containers not found. Not initializing puzzle.'
    );
    return;
  }

  const packId = getSelectedPackId();
  const tone = getSelectedTone();
  const difficulty = getSelectedDifficulty();
  const timeLength = getSelectedTimeLength();

  let puzzle = null;

  // Phase 4: try generating first
  try {
    puzzle = generatePuzzleFromWordBank({
      packId,
      tone,
      difficulty,
      timeLength,
    });
  } catch (err) {
    console.warn(String(err));

    // Fallback: Phase 3 prebuilt puzzles
    puzzle = getPuzzleFromPack(packId, tone, difficulty);
  }

  let model = null;

  try {
    model = buildCrosswordModel(puzzle);
  } catch (err) {
    console.warn(
      'CRSWRD: Generated puzzle invalid, falling back to prebuilt.',
      err
    );

    // Fallback to a known-good pack puzzle
    const fallback = getPuzzleFromPack(packId, tone, difficulty);
    model = buildCrosswordModel(fallback);
    puzzle = fallback;
  }

  const state = createCrosswordState(model);

  // Store "what am I playing?" info so the UI can display it.
  // We keep both:
  // - selectedPackId: what the user chose (ex: "everything")
  // - packId/packName: what actually got used (ex: "movies")
  const usedPackId = puzzle?.meta?.packId || packId;
  const usedPackName = (PACKS[usedPackId]?.name || usedPackId || '').trim();

  state.meta = {
    selectedPackId: packId,
    usedPackId,
    usedPackName,
    difficulty,
    tone,
    timeLength,
  };

  renderCrossword(mounts.host, model, state);
  renderClues(mounts.acrossList, mounts.downList, model, state);
  wireCrosswordInteractions(
    mounts.host,
    mounts.acrossList,
    mounts.downList,
    model,
    state
  );

  CURRENT = {
    host: mounts.host,
    acrossList: mounts.acrossList,
    downList: mounts.downList,
    model,
    state,
  };

  // Start at first non-block cell
  const first = model.cells.find((c) => !c.isBlock);
  if (first) {
    setActiveCell(model, state, first.r, first.c, 'across');
    syncUI(mounts.host, mounts.acrossList, mounts.downList, model, state);
    focusCellButton(mounts.host, first.r, first.c);
  }

  console.info(
    `CRSWRD: Loaded pack "${puzzle.meta.packId}" puzzle "${puzzle.meta.puzzleId}" (${puzzle.meta.title}) | difficulty: ${puzzle.meta.difficulty} | tone: ${tone}`
  );
}

/**
 * Build a computed model from the puzzle grid:
 * - cells with coordinates
 * - across/down entries with numbering
 * - lookup maps: cell -> entry, startKey -> entry, etc
 */
function buildCrosswordModel(puzzle) {
  const rows = puzzle.grid.length;
  const cols = puzzle.grid[0].length;

  // Validate rectangular grid
  for (const line of puzzle.grid) {
    if (line.length !== cols) {
      throw new Error('CRSWRD: SAMPLE_PUZZLE grid is not rectangular.');
    }
  }

  const cells = [];
  const isBlockAt = (r, c) => puzzle.grid[r][c] === '#';
  const solutionAt = (r, c) => (isBlockAt(r, c) ? null : puzzle.grid[r][c]);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({
        r,
        c,
        isBlock: isBlockAt(r, c),
        solution: solutionAt(r, c),
      });
    }
  }

  // Helper: does an entry start here?
  function startsAcross(r, c) {
    if (isBlockAt(r, c)) return false;
    const leftIsBlock = c === 0 || isBlockAt(r, c - 1);
    const rightIsOpen = c + 1 < cols && !isBlockAt(r, c + 1);
    return leftIsBlock && rightIsOpen;
  }

  function startsDown(r, c) {
    if (isBlockAt(r, c)) return false;
    const upIsBlock = r === 0 || isBlockAt(r - 1, c);
    const downIsOpen = r + 1 < rows && !isBlockAt(r + 1, c);
    return upIsBlock && downIsOpen;
  }

  // Numbering: assign a number if it starts an across or down entry
  const numberAt = new Map(); // key "r,c" -> number
  let nextNumber = 1;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (isBlockAt(r, c)) continue;

      if (startsAcross(r, c) || startsDown(r, c)) {
        numberAt.set(keyRC(r, c), nextNumber);
        nextNumber++;
      }
    }
  }

  // Build entries
  const acrossEntries = [];
  const downEntries = [];

  const entryByStartAcross = new Map(); // "r0c0" -> entry
  const entryByStartDown = new Map();

  // Cell membership maps: "r,c" -> entry
  const acrossByCell = new Map();
  const downByCell = new Map();

  // Across scan
  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      if (isBlockAt(r, c)) {
        c++;
        continue;
      }

      if (startsAcross(r, c)) {
        const startC = c;
        const cellsInEntry = [];
        while (c < cols && !isBlockAt(r, c)) {
          cellsInEntry.push({ r, c });
          c++;
        }

        const startKey = `r${r}c${startC}`;
        const number = numberAt.get(keyRC(r, startC));
        const clueText = puzzle.clues.across[startKey] || '(Clue missing)';

        const entry = {
          dir: 'across',
          number,
          start: { r, c: startC },
          cells: cellsInEntry,
          clue: clueText,
          startKey,
        };

        acrossEntries.push(entry);
        entryByStartAcross.set(startKey, entry);
        for (const pos of cellsInEntry) {
          acrossByCell.set(keyRC(pos.r, pos.c), entry);
        }
      } else {
        // Move forward until next block, but we still need to advance
        c++;
      }
    }
  }

  // Down scan
  for (let c = 0; c < cols; c++) {
    let r = 0;
    while (r < rows) {
      if (isBlockAt(r, c)) {
        r++;
        continue;
      }

      if (startsDown(r, c)) {
        const startR = r;
        const cellsInEntry = [];
        while (r < rows && !isBlockAt(r, c)) {
          cellsInEntry.push({ r, c });
          r++;
        }

        const startKey = `r${startR}c${c}`;
        const number = numberAt.get(keyRC(startR, c));
        const clueText = puzzle.clues.down[startKey] || '(Clue missing)';

        const entry = {
          dir: 'down',
          number,
          start: { r: startR, c },
          cells: cellsInEntry,
          clue: clueText,
          startKey,
        };

        downEntries.push(entry);
        entryByStartDown.set(startKey, entry);
        for (const pos of cellsInEntry) {
          downByCell.set(keyRC(pos.r, pos.c), entry);
        }
      } else {
        r++;
      }
    }
  }

  acrossEntries.sort((a, b) => a.number - b.number);
  downEntries.sort((a, b) => a.number - b.number);

  return {
    rows,
    cols,
    cells,
    numberAt,
    acrossEntries,
    downEntries,
    acrossByCell,
    downByCell,
  };
}

function createCrosswordState(model) {
  const filled = new Map(); // "r,c" -> letter
  const marks = new Map(); // "r,c" -> "correct" | "incorrect"

  return {
    active: { r: 0, c: 0 },
    direction: 'across',
    filled,
    marks,
    isSolved: false,

    // UI flags for mobile behavior
    ui: {
      scrollClueIntoView: false, // only true when user tapped a clue
    },
  };
}

function renderCrossword(host, model, state) {
  host.style.setProperty('--rows', String(model.rows));
  host.style.setProperty('--cols', String(model.cols));
  host.innerHTML = '';

  for (const cell of model.cells) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = cell.isBlock ? 'cell block' : 'cell';

    if (!cell.isBlock) {
      const k = keyRC(cell.r, cell.c);
      const mark = state.marks.get(k);

      if (mark === 'correct') btn.classList.add('is-correct');
      if (mark === 'incorrect') btn.classList.add('is-incorrect');
    }

    btn.dataset.r = String(cell.r);
    btn.dataset.c = String(cell.c);

    if (cell.isBlock) {
      btn.setAttribute('aria-label', 'Block');
      btn.disabled = true;
      host.appendChild(btn);
      continue;
    }

    const num = model.numberAt.get(keyRC(cell.r, cell.c));
    if (num) {
      const numEl = document.createElement('span');
      numEl.className = 'num';
      numEl.textContent = String(num);
      btn.appendChild(numEl);
    }

    const val = document.createElement('span');
    val.className = 'val';
    val.textContent = state.filled.get(keyRC(cell.r, cell.c)) || '';
    btn.appendChild(val);

    btn.setAttribute('role', 'gridcell');
    btn.setAttribute('aria-label', `Row ${cell.r + 1}, Column ${cell.c + 1}`);
    host.appendChild(btn);
  }
}

function renderClues(acrossList, downList, model, state) {
  acrossList.innerHTML = '';
  downList.innerHTML = '';

  for (const entry of model.acrossEntries) {
    acrossList.appendChild(makeClueItem(entry));
  }
  for (const entry of model.downEntries) {
    downList.appendChild(makeClueItem(entry));
  }

  // Initial active highlight
  syncClueHighlight(acrossList, downList, model, state);
}

function makeClueItem(entry) {
  const li = document.createElement('li');
  li.className = 'clue';
  li.dataset.dir = entry.dir;
  li.dataset.startKey = entry.startKey;

  li.textContent = `${entry.number}. ${entry.clue}`;
  li.tabIndex = 0; // allow keyboard selection
  li.setAttribute('role', 'button');
  li.setAttribute(
    'aria-label',
    `${entry.dir} clue ${entry.number}: ${entry.clue}`
  );
  return li;
}

function hasAcrossAt(model, r, c) {
  return model.acrossByCell.has(keyRC(r, c));
}

function hasDownAt(model, r, c) {
  return model.downByCell.has(keyRC(r, c));
}

function wireCrosswordInteractions(host, acrossList, downList, model, state) {
  // Pointer drag selection (mouse or touch)
  let isDragging = false;

  // Prevent pointerdown + click from both firing the same action (common on mobile)
  let lastPointerDownAt = 0;
  let lastPointerDownKey = '';

  function cellDirs(r, c) {
    const k = keyRC(r, c);
    const a = model.acrossByCell && model.acrossByCell.has(k);
    const d = model.downByCell && model.downByCell.has(k);
    return { a, d, k };
  }

  function resolveDirectionForCell({ r, c, isSameCell, isToggle }) {
    const { a, d } = cellDirs(r, c);

    // If only one direction exists, force it (always).
    if (a && !d) return 'across';
    if (d && !a) return 'down';

    // Intersection:
    // - Desktop toggles only on explicit toggle action (dblclick)
    // - Mobile toggles when tapping the same cell
    if (isToggle) {
      return state.direction === 'across' ? 'down' : 'across';
    }

    // Otherwise keep current direction
    return state.direction;
  }

  function getCellFromPointerEvent(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const btn = el ? el.closest('.cell') : null;
    if (!btn || btn.classList.contains('block')) return null;
    return { r: Number(btn.dataset.r), c: Number(btn.dataset.c) };
  }

  host.addEventListener('pointerdown', (e) => {
    // Touch: prevent the grid button from taking focus.
    // This keeps the hidden input as the single focus owner.
    if (isTouchLikely()) e.preventDefault();

    const pos = getCellFromPointerEvent(e);
    if (!pos) return;

    state.lastActivationSource = 'grid';
    if (state.ui) state.ui.scrollClueIntoView = false;

    console.log(
      'GRID pointerdown',
      'scrollClueIntoView =',
      state.ui?.scrollClueIntoView
    );

    isDragging = true;
    host.setPointerCapture(e.pointerId);

    lastPointerDownAt = Date.now();
    lastPointerDownKey = `${pos.r},${pos.c}`;

    // If this cell is only one direction, force it
    const { a, d } = cellDirs(pos.r, pos.c);
    if (a && !d) state.direction = 'across';
    else if (d && !a) state.direction = 'down';

    setActiveCell(model, state, pos.r, pos.c, state.direction);
    syncUI(host, acrossList, downList, model, state);
    focusCellButton(host, pos.r, pos.c);
    if (isTouchLikely()) focusMobileInput();
  });

  host.addEventListener('pointermove', (e) => {
    if (!isDragging) return;

    const pos = getCellFromPointerEvent(e);
    if (!pos) return;

    // If this cell is only one direction, force it
    const { a, d } = cellDirs(pos.r, pos.c);
    if (a && !d) state.direction = 'across';
    else if (d && !a) state.direction = 'down';

    if (state.active.r === pos.r && state.active.c === pos.c) return;

    setActiveCell(model, state, pos.r, pos.c, state.direction);
    syncUI(host, acrossList, downList, model, state);
    focusCellButton(host, pos.r, pos.c);
  });

  host.addEventListener('pointerup', () => {
    isDragging = false;
  });

  host.addEventListener('pointercancel', () => {
    isDragging = false;
  });

  // Click/tap on a cell
  host.addEventListener('click', (e) => {
    // Mobile selection is handled by pointerdown only.
    // Letting click run as well causes focus churn and keyboard flicker.
    if (isTouchLikely()) {
      // Prevent the browser from moving focus onto the grid button.
      if (e.target.closest('.cell')) e.preventDefault();
      return;
    }

    const btn = e.target.closest('.cell');
    if (!btn || btn.classList.contains('block')) return;

    const r = Number(btn.dataset.r);
    const c = Number(btn.dataset.c);

    const now = Date.now();
    const clickKey = `${r},${c}`;

    // If this click is just the "after pointerdown" click, ignore it.
    if (now - lastPointerDownAt < 320 && clickKey === lastPointerDownKey) {
      return;
    }

    const { a, d } = cellDirs(r, c);
    const isSameCell = state.active.r === r && state.active.c === c;

    if (!isDragging) {
      if (isTouchLikely()) {
        // Mobile: toggle only on intersections when tapping the same cell
        if (isSameCell && a && d) {
          state.direction = state.direction === 'across' ? 'down' : 'across';
        } else {
          // New cell: if only one direction, force it
          if (a && !d) state.direction = 'across';
          else if (d && !a) state.direction = 'down';
        }
      } else {
        // Desktop: never toggle on single click
        if (a && !d) state.direction = 'across';
        else if (d && !a) state.direction = 'down';
      }
    }

    state.lastActivationSource = 'cell';
    setActiveCell(model, state, r, c, state.direction);
    syncUI(host, acrossList, downList, model, state);
    focusCellButton(host, r, c);
    // Desktop only
  });

  // Desktop: double click toggles direction on intersections only
  host.addEventListener('dblclick', (e) => {
    if (isTouchLikely()) return; // ignore mobile double-tap weirdness
    const btn = e.target.closest('.cell');
    if (!btn || btn.classList.contains('block')) return;

    const r = Number(btn.dataset.r);
    const c = Number(btn.dataset.c);
    const { a, d } = cellDirs(r, c);

    if (a && d) {
      state.direction = state.direction === 'across' ? 'down' : 'across';
      setActiveCell(model, state, r, c, state.direction);
      syncUI(host, acrossList, downList, model, state);
      focusCellButton(host, r, c);
    }
  });

  // Keyboard input and navigation on the grid
  host.addEventListener('keydown', (e) => {
    const btn = e.target.closest('.cell');
    if (!btn || btn.classList.contains('block')) return;

    const r = Number(btn.dataset.r);
    const c = Number(btn.dataset.c);

    if (state.active.r !== r || state.active.c !== c) {
      setActiveCell(model, state, r, c, state.direction);
      syncUI(host, acrossList, downList, model, state);
    }

    const key = e.key;

    if (key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      const activeClue =
        document.querySelector('.clue.is-active') ||
        acrossList.querySelector('.clue') ||
        downList.querySelector('.clue');
      if (activeClue) activeClue.focus();
      return;
    }

    if (key.length === 1 && /[a-zA-Z]/.test(key)) {
      e.preventDefault();
      setCellValue(host, model, state, r, c, key.toUpperCase());
      moveNext(host, model, state);
      syncUI(host, acrossList, downList, model, state);
      return;
    }

    if (key === 'Backspace') {
      e.preventDefault();
      const currentKey = keyRC(r, c);
      const hasValue = Boolean(state.filled.get(currentKey));

      if (hasValue) setCellValue(host, model, state, r, c, '');
      else {
        movePrev(host, model, state);
        setCellValue(host, model, state, state.active.r, state.active.c, '');
      }

      syncUI(host, acrossList, downList, model, state);
      focusCellButton(host, state.active.r, state.active.c);
      return;
    }

    if (key === 'ArrowLeft') {
      e.preventDefault();
      state.direction = 'across';
      moveTo(host, model, state, state.active.r, state.active.c - 1, true);
      syncUI(host, acrossList, downList, model, state);
      return;
    }

    if (key === 'ArrowRight') {
      e.preventDefault();
      state.direction = 'across';
      moveTo(host, model, state, state.active.r, state.active.c + 1, true);
      syncUI(host, acrossList, downList, model, state);
      return;
    }

    if (key === 'ArrowUp') {
      e.preventDefault();
      state.direction = 'down';
      moveTo(host, model, state, state.active.r - 1, state.active.c, true);
      syncUI(host, acrossList, downList, model, state);
      return;
    }

    if (key === 'ArrowDown') {
      e.preventDefault();
      state.direction = 'down';
      moveTo(host, model, state, state.active.r + 1, state.active.c, true);
      syncUI(host, acrossList, downList, model, state);
      return;
    }
  });

  // Click on clues
  function handleClueActivate(target) {
    const el = target.closest('.clue');
    if (!el) return;

    state.lastActivationSource = 'clue';
    const dir = el.dataset.dir;
    const startKey = el.dataset.startKey;
    const entry = getEntryByStartKey(model, dir, startKey);
    if (!entry) return;

    state.direction = dir;
    setActiveCell(model, state, entry.start.r, entry.start.c, dir);
    state.ui.scrollClueIntoView = true;
    syncUI(host, acrossList, downList, model, state);
    focusCellButton(host, entry.start.r, entry.start.c);
    if (isTouchLikely()) focusMobileInput();
  }

  // Mobile: use pointerdown so the clue does not take focus first (reduces flicker)
  function handleCluePointerDown(e) {
    if (!isTouchLikely()) return;
    e.preventDefault();
    handleClueActivate(e.target);
  }

  acrossList.addEventListener('pointerdown', handleCluePointerDown);
  downList.addEventListener('pointerdown', handleCluePointerDown);

  acrossList.addEventListener('click', (e) => {
    if (isTouchLikely()) return;
    handleClueActivate(e.target);
  });
  downList.addEventListener('click', (e) => {
    if (isTouchLikely()) return;
    handleClueActivate(e.target);
  });

  acrossList.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    handleClueActivate(e.target);
  });

  downList.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    handleClueActivate(e.target);
  });
}

function syncUI(host, acrossList, downList, model, state) {
  syncGridHighlight(host, model, state);
  syncClueHighlight(acrossList, downList, model, state);
  syncActiveBar(model, state);
}

function syncActiveBar(model, state) {
  const dirEl = document.getElementById('activeDir');
  const clueEl = document.getElementById('activeClue');
  const metaEl = document.getElementById('activeMeta');
  if (!dirEl || !clueEl) return;

  dirEl.textContent = state.direction === 'across' ? 'Across' : 'Down';

  // Build the right-side meta string (pack, difficulty, tone, grid size).
  if (metaEl) {
    const m = state?.meta || {};
    const usedPackName = m.usedPackName || '';
    const diff = (m.difficulty || '').toString();
    const tone = (m.tone || '').toString();
    const size = (m.timeLength || '').toString();

    // If the user picked "Everything", but we used a specific pack, show both.
    const pickedEverything =
      m.selectedPackId === EVERYTHING_PACK_ID &&
      m.usedPackId &&
      m.usedPackId !== EVERYTHING_PACK_ID;

    const packPart = pickedEverything
      ? `Everything → ${usedPackName}`
      : usedPackName || 'Pack';

    const bits = [packPart, diff, tone, size].filter(Boolean);
    metaEl.textContent = bits.join(' · ');
  }

  const entry = getActiveEntry(model, state);
  if (!entry) {
    clueEl.textContent = 'Click any white cell to start.';
    return;
  }

  clueEl.textContent = `${entry.number}. ${entry.clue}`;
}

function syncGridHighlight(host, model, state) {
  const activeEntry = getActiveEntry(model, state);
  const activeCellKey = keyRC(state.active.r, state.active.c);

  const buttons = host.querySelectorAll('.cell');
  buttons.forEach((btn) => {
    btn.classList.remove('active', 'in-word');
    if (btn.classList.contains('block')) return;

    const r = Number(btn.dataset.r);
    const c = Number(btn.dataset.c);
    const k = keyRC(r, c);

    if (k === activeCellKey) btn.classList.add('active');

    if (activeEntry && activeEntry.cells.some((p) => keyRC(p.r, p.c) === k)) {
      btn.classList.add('in-word');
    }
  });
}

function syncClueHighlight(acrossList, downList, model, state) {
  const entry = getActiveEntry(model, state);
  const lists = [acrossList, downList];

  lists.forEach((list) => {
    list
      .querySelectorAll('.clue')
      .forEach((li) => li.classList.remove('is-active'));
  });

  if (!entry) return;

  const list = entry.dir === 'across' ? acrossList : downList;
  const activeLi = list.querySelector(
    `.clue[data-dir="${entry.dir}"][data-start-key="${entry.startKey}"]`
  );
  if (activeLi) {
    activeLi.classList.add('is-active');

    // Only auto-scroll the clue list when the user activated a clue.
    // Grid taps should NOT scroll the page away from the grid.
    const allowScroll =
      isTouchLikely() && state?.ui?.scrollClueIntoView === true;

    console.log(
      'syncClueHighlight',
      'allowScroll =',
      allowScroll,
      'source =',
      state.lastActivationSource,
      'flag =',
      state.ui?.scrollClueIntoView
    );

    if (allowScroll) {
      activeLi.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      // One-shot: reset after we perform the scroll
      state.ui.scrollClueIntoView = false;
    }
  }
}

function setCellValue(host, model, state, r, c, value) {
  const k = keyRC(r, c);
  if (value) state.filled.set(k, value);
  else state.filled.delete(k);

  // Editing a cell clears prior check feedback for that cell
  if (state.marks) state.marks.delete(k);

  if (state.isSolved) {
    // If they edit after solving, allow the puzzle to become "unsolved"
    state.isSolved = false;
    host.classList.remove('puzzle-solved');
    setCheckStatus('');
  }

  checkForSolved(host, model, state);

  const btn = host.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
  const val = btn ? btn.querySelector('.val') : null;
  if (val) val.textContent = value || '';
}

function setActiveCell(model, state, r, c, direction) {
  state.active = { r, c };
  state.direction = direction;
}

function moveNext(host, model, state) {
  const dr = state.direction === 'down' ? 1 : 0;
  const dc = state.direction === 'across' ? 1 : 0;
  moveTo(host, model, state, state.active.r + dr, state.active.c + dc, true);
}

function movePrev(host, model, state) {
  const dr = state.direction === 'down' ? -1 : 0;
  const dc = state.direction === 'across' ? -1 : 0;
  moveTo(host, model, state, state.active.r + dr, state.active.c + dc, true);
}

/**
 * Move focus to a target cell. If skipBlocks is true, keep stepping until
 * we find a non-block cell or hit the edge.
 */
function moveTo(host, model, state, r, c, skipBlocks = false) {
  // This version moves in a single direction only.
  // It avoids diagonal stepping and feels consistent on arrows + typing.

  const inBounds = (x, max) => x >= 0 && x < max;

  // Determine movement direction from the delta between target and current.
  const dr = r - state.active.r;
  const dc = c - state.active.c;

  // Only allow a single axis move at a time.
  const stepR = dr === 0 ? 0 : dr > 0 ? 1 : -1;
  const stepC = dc === 0 ? 0 : dc > 0 ? 1 : -1;

  // If both axes differ, prefer the axis with the larger magnitude.
  // This should almost never happen with our callers, but it makes it safe.
  let axisR = Math.abs(dr) >= Math.abs(dc) ? stepR : 0;
  let axisC = Math.abs(dc) > Math.abs(dr) ? stepC : 0;

  if (axisR === 0 && axisC === 0) return;

  let rr = state.active.r + axisR;
  let cc = state.active.c + axisC;

  while (inBounds(rr, model.rows) && inBounds(cc, model.cols)) {
    const cell = getCell(model, rr, cc);

    if (cell && !cell.isBlock) {
      setActiveCell(model, state, rr, cc, state.direction);
      focusCellButton(host, rr, cc);
      return;
    }

    if (!skipBlocks) return;

    rr += axisR;
    cc += axisC;
  }
}

function scrollCellIntoView(host, r, c) {
  const btn = host.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
  if (!btn) return;
  try {
    btn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  } catch {
    btn.scrollIntoView();
  }
}

function focusCellButton(host, r, c) {
  // On touch devices, do not focus grid buttons.
  // Keep focus management centralized (we focus the hidden input from click/clue).
  if (isTouchLikely()) return;

  const btn = host.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
  if (btn) btn.focus();
}

function getCell(model, r, c) {
  return model.cells.find((x) => x.r === r && x.c === c) || null;
}

function getActiveEntry(model, state) {
  const k = keyRC(state.active.r, state.active.c);
  return state.direction === 'across'
    ? model.acrossByCell.get(k) || null
    : model.downByCell.get(k) || null;
}

function getEntryByStartKey(model, dir, startKey) {
  const list = dir === 'across' ? model.acrossEntries : model.downEntries;
  return list.find((e) => e.startKey === startKey) || null;
}

function keyRC(r, c) {
  return `${r},${c}`;
}

// ─────────────────────────────────────────────
// Session 8 — Step 1: Answer checking (visual only)
// ─────────────────────────────────────────────

function setCheckStatus(text) {
  const el = document.getElementById('checkStatus');
  if (!el) return;

  const msg = text || '';
  el.textContent = msg;

  // Case-insensitive so "solved", "Solved!", "PUZZLE SOLVED" all work
  el.classList.toggle('is-win', /solved/i.test(msg));
}

function markCell(host, state, r, c, mark) {
  const k = keyRC(r, c);
  if (!state.marks) return;

  if (!mark) state.marks.delete(k);
  else state.marks.set(k, mark);

  const btn = host.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
  if (!btn) return;

  btn.classList.remove('is-correct', 'is-incorrect');
  if (mark === 'correct') btn.classList.add('is-correct');
  if (mark === 'incorrect') btn.classList.add('is-incorrect');
}

function checkCellAt(host, model, state, r, c) {
  const cell = getCell(model, r, c);
  if (!cell || cell.isBlock) return { checked: false };

  const k = keyRC(r, c);
  const entered = (state.filled.get(k) || '').toUpperCase();
  const solution = (cell.solution || '').toUpperCase();

  if (!entered) {
    markCell(host, state, r, c, null);
    return { checked: false };
  }

  const ok = entered === solution;
  markCell(host, state, r, c, ok ? 'correct' : 'incorrect');
  return { checked: true, ok };
}

function checkActiveLetter() {
  if (!CURRENT) return;

  const { host, model, state } = CURRENT;
  const r = state.active.r;
  const c = state.active.c;

  const res = checkCellAt(host, model, state, r, c);

  if (!res.checked) {
    setCheckStatus('Nothing to check.');
    return;
  }

  setCheckStatus(res.ok ? 'Correct ✅' : 'Incorrect ❌');
}

function checkActiveWord() {
  if (!CURRENT) return;

  const { host, model, state } = CURRENT;
  const entry = getActiveEntry(model, state);

  if (!entry) {
    setCheckStatus('No active word.');
    return;
  }

  let checked = 0;
  let correct = 0;

  for (const pos of entry.cells) {
    const res = checkCellAt(host, model, state, pos.r, pos.c);
    if (!res.checked) continue;
    checked++;
    if (res.ok) correct++;
  }

  if (checked === 0) {
    setCheckStatus('Nothing to check.');
    return;
  }

  setCheckStatus(
    correct === checked
      ? `Word correct ✅ (${checked})`
      : `${correct} of ${checked} correct`
  );
}

function checkWholePuzzle() {
  if (!CURRENT) return;

  const { host, model, state } = CURRENT;

  let checked = 0;
  let correct = 0;

  for (const cell of model.cells) {
    if (cell.isBlock) continue;

    const res = checkCellAt(host, model, state, cell.r, cell.c);
    if (!res.checked) continue;
    checked++;
    if (res.ok) correct++;
  }

  if (checked === 0) {
    setCheckStatus('Nothing to check yet.');
    return;
  }

  setCheckStatus(
    correct === checked
      ? `All checked letters correct ✅ (${checked})`
      : `${correct} of ${checked} correct`
  );
}

function wireCheckButtons() {
  const checkLetterBtn = document.getElementById('checkLetterBtn');
  const checkWordBtn = document.getElementById('checkWordBtn');
  const checkPuzzleBtn = document.getElementById('checkPuzzleBtn');

  const revealLetterBtn = document.getElementById('revealLetterBtn');
  const revealWordBtn = document.getElementById('revealWordBtn');
  const revealPuzzleBtn = document.getElementById('revealPuzzleBtn');

  const resetPuzzleBtn = document.getElementById('resetPuzzleBtn');
  const newPuzzleBtn = document.getElementById('newPuzzleBtn');

  if (checkLetterBtn)
    checkLetterBtn.addEventListener('click', checkActiveLetter);
  if (checkWordBtn) checkWordBtn.addEventListener('click', checkActiveWord);
  if (checkPuzzleBtn)
    checkPuzzleBtn.addEventListener('click', checkWholePuzzle);

  if (revealLetterBtn)
    revealLetterBtn.addEventListener('click', revealActiveLetter);
  if (revealWordBtn) revealWordBtn.addEventListener('click', revealActiveWord);
  if (revealPuzzleBtn)
    revealPuzzleBtn.addEventListener('click', revealWholePuzzle);

  if (resetPuzzleBtn) resetPuzzleBtn.addEventListener('click', resetPuzzle);
  if (newPuzzleBtn) newPuzzleBtn.addEventListener('click', generateNewPuzzle);
}

function wireMobileKeyboard() {
  const input = getMobileInput();
  if (!input) return;

  // beforeinput is the most reliable way to detect backspace on mobile keyboards
  input.addEventListener('beforeinput', (e) => {
    if (!CURRENT) return;

    if (e.inputType === 'deleteContentBackward') {
      e.preventDefault();

      const { host, model, state } = CURRENT;
      const r = state.active.r;
      const c = state.active.c;

      const currentKey = keyRC(r, c);
      const hasValue = Boolean(state.filled.get(currentKey));

      if (hasValue) {
        setCellValue(host, model, state, r, c, '');
      } else {
        movePrev(host, model, state);
        setCellValue(host, model, state, state.active.r, state.active.c, '');
      }

      syncUI(host, CURRENT.acrossList, CURRENT.downList, model, state);

      focusMobileInput();
    }
  });

  // input event catches actual typed characters on iOS/Android reliably
  input.addEventListener('input', () => {
    if (!CURRENT) return;

    const { host, model, state } = CURRENT;

    // Take the last typed character (mobile keyboards can send more than 1)
    const raw = input.value || '';
    const ch = raw.slice(-1).toUpperCase();

    // Clear immediately so next keystroke is clean
    input.value = '';

    if (!/^[A-Z]$/.test(ch)) {
      focusMobileInput();
      return;
    }

    setCellValue(host, model, state, state.active.r, state.active.c, ch);
    moveNext(host, model, state);
    syncUI(host, CURRENT.acrossList, CURRENT.downList, model, state);
    // Keep keyboard open
    focusMobileInput();
  });

  // Optional: keep arrow keys working if the keyboard provides them
  input.addEventListener('keydown', (e) => {
    if (!CURRENT) return;

    const { host, model, state } = CURRENT;

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      state.direction = 'across';
      moveTo(host, model, state, state.active.r, state.active.c - 1, true);
      syncUI(host, CURRENT.acrossList, CURRENT.downList, model, state);
      return;
    }

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      state.direction = 'across';
      moveTo(host, model, state, state.active.r, state.active.c + 1, true);
      syncUI(host, CURRENT.acrossList, CURRENT.downList, model, state);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      state.direction = 'down';
      moveTo(host, model, state, state.active.r - 1, state.active.c, true);
      syncUI(host, CURRENT.acrossList, CURRENT.downList, model, state);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      state.direction = 'down';
      moveTo(host, model, state, state.active.r + 1, state.active.c, true);
      syncUI(host, CURRENT.acrossList, CURRENT.downList, model, state);
      return;
    }
  });

  input.addEventListener('blur', () => {
    if (!CURRENT || !isTouchLikely()) return;

    // If the user is interacting with real UI controls, back off
    if (isInteractiveControl(document.activeElement)) return;
    if (Date.now() < MOBILE_FOCUS_LOCK_UNTIL) return;

    // Otherwise, keep the keyboard alive.
    // Use rAF instead of timers to avoid focus thrash during tap transitions.
    requestAnimationFrame(() => focusMobileInput());
  });
}

// ─────────────────────────────────────────────
// Session 8 — Step 2: Reveal helpers (fills correct letters)
// ─────────────────────────────────────────────

function setCellValueDirect(host, state, r, c, value) {
  const k = keyRC(r, c);

  if (value) state.filled.set(k, value);
  else state.filled.delete(k);

  // Update DOM
  const btn = host.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
  const val = btn ? btn.querySelector('.val') : null;
  if (val) val.textContent = value || '';
}

function revealCellAt(host, model, state, r, c) {
  const cell = getCell(model, r, c);
  if (!cell || cell.isBlock) return { revealed: false };

  const solution = (cell.solution || '').toUpperCase();
  if (!solution) return { revealed: false };

  setCellValueDirect(host, state, r, c, solution);
  markCell(host, state, r, c, 'correct');
  checkForSolved(host, model, state);
  return { revealed: true };
}

function revealActiveLetter() {
  if (!CURRENT) return;

  const { host, model, state } = CURRENT;
  const r = state.active.r;
  const c = state.active.c;

  const res = revealCellAt(host, model, state, r, c);
  setCheckStatus(res.revealed ? 'Letter revealed ✅' : 'Nothing to reveal.');
}

function revealActiveWord() {
  if (!CURRENT) return;

  const { host, model, state } = CURRENT;
  const entry = getActiveEntry(model, state);

  if (!entry) {
    setCheckStatus('No active word.');
    return;
  }

  let count = 0;
  for (const pos of entry.cells) {
    const res = revealCellAt(host, model, state, pos.r, pos.c);
    if (res.revealed) count++;
  }

  setCheckStatus(count ? `Word revealed ✅ (${count})` : 'Nothing to reveal.');
}

function revealWholePuzzle() {
  if (!CURRENT) return;

  const { host, model, state } = CURRENT;

  let count = 0;
  for (const cell of model.cells) {
    if (cell.isBlock) continue;
    const res = revealCellAt(host, model, state, cell.r, cell.c);
    if (res.revealed) count++;
  }

  setCheckStatus(
    count ? `Puzzle revealed ✅ (${count})` : 'Nothing to reveal.'
  );
}

// ─────────────────────────────────────────────
// Session 8 — Step 3A: Reset puzzle (clear user input)
// ─────────────────────────────────────────────

function resetPuzzle() {
  if (!CURRENT) return;

  const { host, model, state } = CURRENT;

  // Clear user-filled letters and correctness marks
  state.filled.clear();
  if (state.marks) state.marks.clear();

  // Clear DOM values + feedback
  for (const cell of model.cells) {
    if (cell.isBlock) continue;

    const btn = host.querySelector(
      `.cell[data-r="${cell.r}"][data-c="${cell.c}"]`
    );
    if (!btn) continue;

    const val = btn.querySelector('.val');
    if (val) val.textContent = '';

    btn.classList.remove('is-correct', 'is-incorrect');
  }

  // ── Step 2.6: clear solved state ──
  state.isSolved = false;
  host.classList.remove('puzzle-solved');
  setCheckStatus('');
}

function isPuzzleSolved(model, state) {
  for (const cell of model.cells) {
    if (cell.isBlock) continue;

    const k = keyRC(cell.r, cell.c);
    const entered = (state.filled.get(k) || '').toUpperCase();
    const solution = (cell.solution || '').toUpperCase();

    if (!entered) return false;
    if (entered !== solution) return false;
  }
  return true;
}

function checkForSolved(host, model, state) {
  if (state.isSolved) return;

  if (isPuzzleSolved(model, state)) {
    state.isSolved = true;

    // Add a subtle solved look
    host.classList.add('puzzle-solved');

    setCheckStatus('Solved! 🎉');

    // Optional: quick console brag
    console.info('CRSWRD: Puzzle solved.');
  }
}

// ─────────────────────────────────────────────
// Session 8 — Step 3B: New puzzle (regenerate)
// ─────────────────────────────────────────────

function generateNewPuzzle() {
  if (!CURRENT) return;

  // Clear status text
  setCheckStatus('');

  // Re-run the existing generation path
  initCrosswordFromSelections();
}

document.addEventListener('DOMContentLoaded', init);

// ─────────────────────────────────────────────
// DEV ONLY - Pack sanity + quick counts (console helpers)
// ─────────────────────────────────────────────

/**
 * Word bank sanity checker.
 * Usage:
 *   checkWordBank(PACKS.general)
 *   checkWordBank(PACKS.music)
 */
function checkWordBank(pack, requiredWords = []) {
  const words = (pack.wordBank || []).map((w) =>
    String(w.word || '').toUpperCase()
  );
  const unique = new Set(words);

  const duplicates = words.filter((w, i) => words.indexOf(w) !== i);

  const lengths = { 3: 0, 4: 0, 5: 0, 6: 0, '7+': 0 };
  words.forEach((w) => {
    if (w.length <= 6) lengths[String(w.length)]++;
    else lengths['7+']++;
  });

  const missingRequired = requiredWords.filter(
    (w) => !unique.has(String(w).toUpperCase())
  );

  console.log(`[CRSWRD] Pack: ${pack.id} (${pack.name})`);
  console.log(`Words: ${words.length} | Unique: ${unique.size}`);
  console.log('Length buckets:', lengths);

  if (duplicates.length) console.warn('Duplicates:', [...new Set(duplicates)]);
  if (missingRequired.length)
    console.warn('Missing required:', missingRequired);

  // Basic clue presence check
  const bad = (pack.wordBank || []).filter(
    (w) =>
      !w.word ||
      !w.serious ||
      !w.funny ||
      String(w.word).trim().length < 3 ||
      String(w.serious).trim().length < 2 ||
      String(w.funny).trim().length < 2
  );

  if (bad.length) {
    console.warn(
      `Bad entries (${bad.length}):`,
      bad.map((x) => x.word)
    );
  } else {
    console.log('All entries have word + serious + funny.');
  }
}

/**
 * Quick pack counts.
 * Usage:
 *   packCounts()
 */
window.packCounts = function packCounts() {
  const rows = Object.values(PACKS).map((p) => ({
    id: p.id,
    name: p.name,
    words: p.wordBank?.length || 0,
    puzzles: p.puzzles?.length || 0,
  }));
  rows.sort((a, b) => b.words - a.words);
  console.table(rows);
};

/**
 * Run sanity checks for the original baseline packs only (the 4 you started with).
 * Usage:
 *   checkAllWordBanks()
 */
window.checkAllWordBanks = function checkAllWordBanks() {
  const baseline = ['general', 'movies', 'sports', 'holidays'];

  baseline.forEach((id) => {
    const p = PACKS[id];
    if (!p) {
      console.warn(`[CRSWRD] Missing pack: ${id}`);
      return;
    }
    checkWordBank(p);
  });

  console.log('[CRSWRD] Done. Tip: run packCounts() for a quick summary.');
};

/**
 * Inspect recent-word memory for a pack.
 * Usage:
 *   dumpRecentMemory("music")
 */
window.dumpRecentMemory = function dumpRecentMemory(packId) {
  const puzzles = recentWordMemoryByPack.get(packId);

  if (!puzzles || !puzzles.length) {
    console.log(`[CRSWRD] No recent memory for pack "${packId}".`);
    return;
  }

  console.log(`[CRSWRD] Recent memory for "${packId}":`, puzzles);
};
