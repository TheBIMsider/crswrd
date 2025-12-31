# Mobile and Tablet Support

CRSWRD is designed first and foremost as a **desktop crossword experience**.
Larger screens provide the visual stability and interaction clarity that crosswords require.

---

## Supported devices

### Desktop (primary)

- Fully supported
- Intended and tested experience
- Keyboard, focus, and layout behavior are stable

### Tablets (supported)

- Supported on modern browsers
- Best experience on larger tablets
- On-screen keyboard access is intentionally explicit
- Some platform-specific behavior (especially on Android Chromium) is unavoidable but playable

### Phones (best-effort)

- Not an officially supported target
- Basic gameplay may work
- Typing focus and interaction may feel constrained or inconsistent
- No guarantees are made for small-screen usability

---

## Why phones are best-effort

Crossword solving relies on:

- Persistent visual context
- Precise focus ownership
- Predictable typing feedback

On phones, these requirements conflict with:

- Limited screen real estate
- Touch scrolling vs tap ambiguity
- Platform keyboard rules, especially on Android Chromium browsers

In particular:

- Mobile browsers often require a **visible, focused input** to summon the on-screen keyboard
- Hidden or proxy inputs are unreliable by design
- Scrolling and tapping can unintentionally steal focus from the grid

These are **platform constraints**, not implementation bugs.

---

## Design decision

CRSWRD intentionally prioritizes:

- Desktop stability
- Tablet playability
- Readable, maintainable code

Rather than adding fragile workarounds or degrading the tablet and desktop experience, phone support is treated as best-effort.

This decision is intentional and documented.

---

## Future considerations

Phone-first support would require:

- A different interaction model
- Significant layout changes
- Separate UX rules from desktop and tablet

This is outside the scope of the current project version.
