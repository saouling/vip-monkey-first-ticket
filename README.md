# The first ticket: a VIP Monkey design proposal

A clickable prototype of one flow for the VIP Monkey iPhone app: from an event link shared in a group chat to a ticket in the app, on the first try. Swedish and English.

**Designed by Nikos Saoulidis. Prototype built with Claude Code.** This is an unsolicited concept for a job application, not VIP Monkey's app. The VIP Monkey name and monkey mark belong to VIP-Monkey AB and appear here only because the proposal is addressed to them. All events, venues, organisers and people are invented.

## Run it

Plain HTML, CSS and JavaScript, with no build step and no dependencies (fonts load from Google Fonts).

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765. `system.html` shows the design tokens and components.

- Steps can be opened directly: `#chat`, `#web`, `#open`, `#event`, `#checkout`, `#swish`, `#done`, `#tickets`, `#ticket`, and `#b1` / `#b2` for variant B.
- `?lang=en` switches to English.
- `?shot=1` shows only the phone, which is how the PDF screenshots were made.

## Files

| File | What it is |
|---|---|
| `index.html` | All screens, inside a 390 × 844 phone frame |
| `tokens.css` | Design tokens: colour roles, type, space, shape, motion |
| `app.css` | Components and screens |
| `app.js` | Navigation, the checkout sheet, hold timer, validation, language switch |
| `i18n.js` | Every UI string, in Swedish and English |
| `system.html` | The design-system slice |
| `assets/` | The monkey mark, taken from the current app's tab bar |

Icons are from [Tabler Icons](https://tabler.io/icons) (MIT licence).
