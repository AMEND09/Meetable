# Meetable — Design Guidelines
### Chrome Extension for Deaf & Hard-of-Hearing Meeting Accessibility

---

## 1. Brand Identity

**Product name:** Meetable  
**Tagline:** Every word, every speaker, every meeting.  
**Voice:** Clear, calm, and empowering. Meetable never talks down to users or overexplains. It communicates with quiet confidence — like a well-designed assistive tool should.

---

## 2. Design Principles

**Accessibility first.** The product exists for users with hearing loss. Every design decision — contrast ratios, font sizes, motion — must hold up against WCAG 2.1 AA at minimum, AAA where possible.

**Reduce cognitive load.** Meetings are already demanding. The UI should fade into the background and surface only what matters, when it matters.

**Trust through transparency.** Privacy and accuracy are central to the product. The interface should communicate status (transcribing, offline, uncertain speaker) clearly and honestly, never hiding ambiguity.

**Density with breathing room.** Captions need to be readable at a glance. Give text space. Avoid crowding controls near content the user is actively reading.

**Consistent, not surprising.** Icons, colors, and interactions should behave the same way everywhere. No clever one-offs.

---

## 3. Color System

The palette is built around high contrast and legibility, with semantic colors for real-time accessibility signals.

### Base Palette

| Token | Hex | Usage |
|---|---|---|
| `surface-base` | `#0F1117` | Extension panel background |
| `surface-raised` | `#1A1D27` | Cards, caption windows |
| `surface-overlay` | `#252836` | Modals, dropdowns |
| `border-subtle` | `#2E3244` | Dividers, input borders |
| `text-primary` | `#F0F2F7` | Body text, captions |
| `text-secondary` | `#8B91A8` | Labels, timestamps, metadata |
| `text-disabled` | `#4A5068` | Inactive states |
| `brand-teal` | `#2DD4BF` | Primary interactive elements, focus rings |
| `brand-teal-dim` | `#1A8A7C` | Hover states |

### Semantic / Accessibility Signals

| Token | Hex | Usage |
|---|---|---|
| `signal-overlap` | `#F87171` | Talk-over detection warning, caption highlights |
| `signal-uncertain` | `#FBBF24` | Low-confidence speaker label |
| `signal-active` | `#34D399` | Active speaker border, live transcription indicator |
| `signal-info` | `#60A5FA` | Action item highlights, question detection |

### Caption Background Opacity
Caption overlays use `rgba(15, 17, 23, N)` where N is user-configurable from 0.6–1.0. Default: 0.85.

### Light Mode
A high-contrast light theme is available for users who prefer it. Light mode maps `surface-base` → `#FFFFFF`, `surface-raised` → `#F5F6FA`, `text-primary` → `#0F1117`. Signal colors remain unchanged.

---

## 4. Typography

Legibility at small sizes and high contrast are non-negotiable for caption text.

### Typefaces

| Role | Typeface | Fallback |
|---|---|---|
| UI / Interface | Inter | system-ui, sans-serif |
| Captions | Inter | system-ui, sans-serif |
| Monospace (transcripts, timestamps) | JetBrains Mono | monospace |

Use a single typeface family (Inter) throughout the UI. Avoid decorative or display fonts entirely.

### Scale

| Token | Size | Weight | Line Height | Usage |
|---|---|---|---|---|
| `caption-lg` | 22px | 500 | 1.5 | Default caption display |
| `caption-md` | 18px | 500 | 1.5 | Compact caption mode |
| `caption-sm` | 14px | 400 | 1.5 | Caption history / scrollback |
| `ui-label` | 12px | 600 | 1.4 | Section labels, control labels |
| `ui-body` | 14px | 400 | 1.5 | Settings panels, descriptions |
| `ui-heading` | 16px | 600 | 1.3 | Panel headings |
| `ui-mono` | 13px | 400 | 1.5 | Timestamps, transcript export |

### Caption Typography Rules

- Minimum caption font size: 14px. Default: 22px. User-configurable up to 48px.
- Line length for captions: max 72 characters per line to prevent fatigue.
- Never use italics for caption text — it impairs readability for dyslexic users.
- Speaker names use `font-weight: 700` and the assigned speaker color.
- Filler words and filtered content render in `text-disabled` before being removed from view.

---

## 5. Iconography

**Use Lucide icons exclusively.** Do not mix icon sets. Do not use emoji as icons.

### Icon Sizes

| Context | Size |
|---|---|
| Toolbar / compact controls | 16px |
| Standard UI controls | 20px |
| Feature headers / primary actions | 24px |

### Stroke Width
All Lucide icons use `strokeWidth={1.75}`. Thicker than default for readability at small sizes, without appearing heavy.

### Key Icon Mappings

| Feature | Lucide Icon |
|---|---|
| Live captions | `Captions` |
| Speaker / diarization | `Users` |
| Active speaker | `User` |
| Talk-over / overlap | `AlertTriangle` |
| Face focus / lip reading | `ScanFace` |
| Visual alerts | `Bell` |
| Meeting intelligence | `BrainCircuit` |
| Transcript / history | `ScrollText` |
| Export | `Download` |
| Search | `Search` |
| Settings / customize | `Settings2` |
| Privacy / on-device | `ShieldCheck` |
| Lock speaker focus | `Lock` |
| Unlock | `LockOpen` |
| Pause captions | `PauseCircle` |
| Resume captions | `PlayCircle` |
| Mark moment | `Bookmark` |
| Drag / reposition | `GripVertical` |
| Close / dismiss | `X` |
| Minimize panel | `Minimize2` |
| Expand panel | `Maximize2` |
| Confidence low | `AlertCircle` |
| Confidence high | `CheckCircle2` |
| Offline mode | `WifiOff` |
| Action item | `CheckSquare` |
| Question detected | `HelpCircle` |
| Speaker timeline | `BarChart2` |
| Microphone / audio | `Mic` |
| Microphone off | `MicOff` |
| Picture-in-picture | `PictureInPicture` |
| Keyboard shortcut | `Keyboard` |

---

## 6. Spacing & Layout

Use an 8px base grid. All spacing values are multiples of 4px.

| Token | Value | Usage |
|---|---|---|
| `space-1` | 4px | Icon-to-label gaps, tight inline spacing |
| `space-2` | 8px | Control padding, list item gaps |
| `space-3` | 12px | Card internal padding |
| `space-4` | 16px | Section spacing, panel padding |
| `space-6` | 24px | Between major sections |
| `space-8` | 32px | Panel header margins |

### Extension Panel Width
- Default side panel: 320px
- Compact mode: 280px
- Expanded / transcript view: 420px
- Floating caption window: user-resizable, min 280px × 80px

### Caption Overlay Placement Options
1. **Bottom overlay** — full-width bar anchored to bottom of video, 16px from edge
2. **Side panel** — fixed right panel, does not obstruct video
3. **Floating window** — draggable, remembers last position per meeting platform

---

## 7. Component Patterns

### Caption Block
The caption block is the most critical component. It must be readable mid-meeting without interaction.

- Background: `surface-overlay` at configured opacity
- Border-radius: 8px (floating window), 0px (bottom overlay)
- Speaker name: `text-sm`, `font-bold`, speaker color, displayed inline before text
- Caption text: `caption-lg` by default, `text-primary`
- Timestamp: `text-secondary`, `ui-mono`, right-aligned or end of line
- Overlap state: left border 3px `signal-overlap`, caption text tinted `signal-overlap`

### Speaker Tag
A small pill-shaped label that appears beside each speaker's caption line.

- Height: 20px, padding: 4px 8px
- Background: speaker color at 20% opacity
- Text: speaker color at 100%, `ui-label` size
- Border: 1px solid speaker color at 40% opacity
- Unidentified speaker: `text-secondary` with `User` icon

### Speaker Activity Bar
A compact horizontal bar showing relative talk time per speaker.

- Render in the extension side panel header
- Each speaker: thin bar segment in their assigned color
- Currently speaking: segment pulses with a subtle scale animation (scale 1.0 → 1.05, 600ms ease-in-out loop)
- Labels appear on hover/focus only to reduce clutter

### Overlap Warning Banner
Appears at the top of the caption area when simultaneous speech is detected.

- Background: `rgba(248, 113, 113, 0.15)`
- Border: 1px solid `signal-overlap`
- Icon: `AlertTriangle` 16px in `signal-overlap`
- Text: "Multiple people speaking" in `signal-overlap`, `ui-label`
- Dismisses automatically when overlap ends

### Flash Alert
For name-called or speaker-change notifications.

- Thin (4px) border flash around the caption window
- Color: `signal-active` for speaker change, `brand-teal` for name called
- Duration: 400ms fade in, 600ms hold, 400ms fade out
- Never blocks caption text
- Respects OS reduced-motion settings — if enabled, use a static badge instead

### Confidence Indicator
When speaker diarization confidence is below 80%, show a small indicator.

- Icon: `AlertCircle` 14px in `signal-uncertain`
- Tooltip: "Uncertain who said this"
- Does not interrupt caption flow; appears at line end

### Settings Panel
- Sections separated by `border-subtle` dividers
- Each section has an `ui-heading` label with the relevant Lucide icon at 20px
- Toggle controls use a custom switch (not browser default) — 40px wide, 22px tall
- Sliders for font size and opacity use `brand-teal` fill on the track
- Profiles (Lip-reader, Caption-only, Minimal) display as selectable cards with a brief description

---

## 8. Motion & Animation

Keep motion minimal and purposeful. Users are already managing a live meeting.

| Element | Animation | Duration | Easing |
|---|---|---|---|
| Caption text appearing | Fade in from 0 → 1 opacity | 120ms | ease-out |
| Overlap warning | Slide in from top | 180ms | ease-out |
| Flash alert | Border opacity pulse | 1400ms total | ease-in-out |
| Active speaker badge | Scale pulse | 600ms loop | ease-in-out |
| Panel open/close | Slide from edge | 220ms | ease-in-out |
| Face focus zoom | Smooth zoom | 300ms | ease-in-out |
| Tooltip | Fade in | 150ms | ease-out |

**Reduced motion:** When `prefers-reduced-motion: reduce` is set, disable all animations except caption fade-in (reduce to 60ms). Replace pulse animations with static color changes.

---

## 9. Accessibility Standards

- **Color contrast:** All text on backgrounds meets WCAG AA (4.5:1 for normal text, 3:1 for large text). Signal colors checked against all surface tokens.
- **Focus rings:** All interactive elements show a visible focus ring — 2px solid `brand-teal`, 2px offset. Never suppress focus outlines.
- **Keyboard navigation:** Full keyboard operability for all controls. Tab order matches visual order.
- **Screen reader support:** All icon-only buttons have `aria-label`. Dynamic caption content uses `aria-live="polite"`. Overlap warnings use `aria-live="assertive"`.
- **Hotkeys:** Defaults are configurable and displayed in settings. Default set: `Alt+P` pause captions, `Alt+L` lock face focus, `Alt+M` mark moment.
- **Target size:** All interactive controls have a minimum tap/click target of 40×40px, regardless of visual size.

---

## 10. Platform Contexts

Meetable operates inside third-party video platforms. The extension UI must coexist without visual conflict.

| Platform | Primary color | Notes |
|---|---|---|
| Google Meet | `#1A73E8` | Avoid competing blue; use teal to differentiate |
| Microsoft Teams | `#6264A7` | Dark extension panel contrasts well |
| Slack | `#4A154B` | Teal brand color reads clearly on Slack's palette |
| Discord | `#5865F2` | Use `surface-base` for panels to avoid blend |
| Zoom | `#2D8CFF` | Floating caption window performs best |

The extension panel and caption overlay must not obstruct participant video tiles or control bars. Caption placement defaults should be tested against each platform's standard layout.

---

## 11. States Reference

Every interactive and live element should have defined states:

| State | Visual treatment |
|---|---|
| Default | Base color and opacity as defined |
| Hover | Background lightens by 8%, cursor: pointer |
| Active / pressed | Background darkens by 12% |
| Focus | `brand-teal` focus ring, 2px solid, 2px offset |
| Disabled | `text-disabled` color, 50% opacity, cursor: not-allowed |
| Loading | Skeleton shimmer using `border-subtle` → `surface-overlay` gradient |
| Error | `signal-overlap` color, `AlertTriangle` icon |
| Success | `signal-active` color, `CheckCircle2` icon |
| Live / transcribing | Subtle `signal-active` dot pulse in panel header |
| Offline | `WifiOff` icon in `text-secondary`, banner in panel |

---

## 12. Do / Don't

**Do:**
- Use Lucide icons at consistent sizes and stroke widths
- Reserve red (`signal-overlap`) exclusively for talk-over and error states — never decorative use
- Show speaker names consistently using their assigned color everywhere they appear
- Default to the user's last-used caption placement and size on each session
- Test all caption and panel layouts against actual meeting UI at 100% and 125% browser zoom

**Don't:**
- Use emoji anywhere in the UI
- Animate caption text or make it move — scrolling history is fine, but new captions should appear in place
- Show notifications or banners that cover the speaker's face in the video feed
- Use more than 6 distinct speaker colors in a single session — reuse with differentiation (color + name label)
- Store raw audio or full transcripts without explicit user consent and clear indication in the UI