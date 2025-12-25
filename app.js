// NOTE: Puzzle is only considered "solved" through user entry,
// not via Reveal helpers.

'use strict';
// Session 8: keep a reference to the currently loaded puzzle UI + state
let CURRENT = null;

let MOBILE_INPUT = null;

function isTouchLikely() {
  return (
    window.matchMedia('(pointer: coarse)').matches ||
    window.matchMedia('(max-width: 900px)').matches
  );
}

function getMobileInput() {
  if (MOBILE_INPUT) return MOBILE_INPUT;
  MOBILE_INPUT = document.getElementById('mobileInput');
  return MOBILE_INPUT;
}

function focusMobileInput() {
  const input = getMobileInput();
  if (!input) return;
  if (!isTouchLikely()) return;

  input.value = '';

  try {
    input.focus({ preventScroll: true });
  } catch {
    input.focus();
  }
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
  const form = $('configForm');

  if (!form) {
    console.error('CRSWRD: configForm not found. Check index.html IDs.');
    return;
  }

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
 * Phase 3: Packs (data-driven puzzles)
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
    // Phase 4: Word bank used by the generator (Across-only for now).
    // Each item can carry tone variants for clues.
    wordBank: [
      // ── 3-letter glue + fallback coverage (29)
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

      // ── 4-letter sweet spot (20)
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

      // ── 5-letter connectors (20)
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

      // ── 6-letter utility (16)
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

      // ── 7+ anchors (15)
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

function getSelectedPackId() {
  const sel = document.getElementById('pack');
  return sel ? sel.value : 'general';
}

function getSelectedTone() {
  const sel = document.getElementById('tone');
  return sel ? sel.value : 'serious';
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
 * Phase 4: Simple Across-only generator.
 * - Creates a square grid
 * - Places words left-to-right on rows with block separators
 * - Builds clue maps for Across and Down starts
 * - Returns a "puzzle-like" object that matches what buildCrosswordModel expects
 */
function generatePuzzleFromWordBank({ packId, tone, difficulty, timeLength }) {
  const pack = PACKS[packId] || PACKS.general;
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

  function getCellFromPointerEvent(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const btn = el ? el.closest('.cell') : null;
    if (!btn || btn.classList.contains('block')) return null;
    return { r: Number(btn.dataset.r), c: Number(btn.dataset.c) };
  }

  function cellDirs(r, c) {
    const k = keyRC(r, c);
    const a = model.acrossByCell && model.acrossByCell.has(k);
    const d = model.downByCell && model.downByCell.has(k);
    return { a, d, k };
  }

  host.addEventListener('pointerdown', (e) => {
    const pos = getCellFromPointerEvent(e);
    if (!pos) return;

    isDragging = true;
    host.setPointerCapture(e.pointerId);

    // If this cell is only one direction, force it
    const { a, d } = cellDirs(pos.r, pos.c);
    if (a && !d) state.direction = 'across';
    else if (d && !a) state.direction = 'down';

    setActiveCell(model, state, pos.r, pos.c, state.direction);
    syncUI(host, acrossList, downList, model, state);
    focusCellButton(host, pos.r, pos.c);
    setTimeout(() => focusMobileInput(), 0);
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
    const btn = e.target.closest('.cell');
    if (!btn || btn.classList.contains('block')) return;

    const r = Number(btn.dataset.r);
    const c = Number(btn.dataset.c);

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

    setActiveCell(model, state, r, c, state.direction);
    syncUI(host, acrossList, downList, model, state);
    focusCellButton(host, r, c);
    setTimeout(() => focusMobileInput(), 0);
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

    const dir = el.dataset.dir;
    const startKey = el.dataset.startKey;
    const entry = getEntryByStartKey(model, dir, startKey);
    if (!entry) return;

    state.direction = dir;
    setActiveCell(model, state, entry.start.r, entry.start.c, dir);
    syncUI(host, acrossList, downList, model, state);
    focusCellButton(host, entry.start.r, entry.start.c);
    setTimeout(() => focusMobileInput(), 0);
  }

  acrossList.addEventListener('click', (e) => handleClueActivate(e.target));
  downList.addEventListener('click', (e) => handleClueActivate(e.target));

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
  if (!dirEl || !clueEl) return;

  dirEl.textContent = state.direction === 'across' ? 'Across' : 'Down';

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
  if (activeLi) activeLi.classList.add('is-active');
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

    // Otherwise, keep the keyboard alive
    setTimeout(() => focusMobileInput(), 80);
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
// DEV ONLY — Word bank sanity checker
// Call from console: checkWordBank(PACKS.general)
// ─────────────────────────────────────────────
function checkWordBank(pack, requiredWords = []) {
  const words = pack.wordBank.map((w) => w.word.toUpperCase());
  const unique = new Set(words);

  const duplicates = words.filter((w, i) => words.indexOf(w) !== i);

  const lengths = {
    3: 0,
    4: 0,
    5: 0,
    6: 0,
    '7+': 0,
  };

  words.forEach((w) => {
    if (w.length <= 6) lengths[String(w.length)]++;
    else lengths['7+']++;
  });

  const missingRequired = requiredWords.filter(
    (w) => !unique.has(w.toUpperCase())
  );

  console.group(`🧩 WordBank Check: ${pack.name}`);
  console.log('Total words:', words.length);
  console.log('Unique words:', unique.size);
  console.log('Length distribution:', lengths);

  if (duplicates.length) {
    console.warn('Duplicate words:', [...new Set(duplicates)]);
  } else {
    console.log('No duplicates ✅');
  }

  if (requiredWords.length) {
    if (missingRequired.length) {
      console.warn('Missing required words:', missingRequired);
    } else {
      console.log('All required words present ✅');
    }
  }

  console.groupEnd();
}

// ─────────────────────────────────────────────
// Session 7 — Debug helper (console only)
// ─────────────────────────────────────────────

/**
 * Inspect recent-word memory for a pack.
 * Usage in DevTools:
 *   dumpRecentMemory('general')
 */
window.dumpRecentMemory = function dumpRecentMemory(packId) {
  const puzzles = recentWordMemoryByPack.get(packId);

  if (!puzzles || !puzzles.length) {
    console.log(`[CRSWRD] No recent memory for pack "${packId}".`);
    return;
  }

  console.log(`[CRSWRD] Recent word memory for "${packId}" (oldest → newest):`);

  puzzles.forEach((words, i) => {
    console.log(`  #${i + 1} (${words.length} words):`, words.join(', '));
  });
};
