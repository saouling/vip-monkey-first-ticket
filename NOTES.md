# Build notes: what each pass changed

*For Nikos, not for VIP Monkey. The brief asks for a short log of the Impeccable passes.*

## 29 September 2026

**`/impeccable init`**
- Wrote `PRODUCT.md`. Platform is iOS; the stack is static HTML, CSS and JS.
- Recorded Nikos's decisions: Swedish and English, his monkey placement, Montserrat for titles and buttons with the system font for body text.

**Concept roll** (`concept-seed`, key d47112d2, mode operate)
- Seven layout ideas were listed before rolling. The dice dealt three: #3 the page is the ticket, #4 poster first, #2 one sheet.
- Nikos locked **#2 with #3's ending**: one checkout sheet over the event, which becomes the finished ticket.
- The direction contract is in `.impeccable/surfaces/prototype-index-html.md`.

**First build**
- 8 screens plus variant B, the tokens, and a language switch.
- The monkey mark was cut from the tab bar in screenshot IMG_5469 of the current app.
- Tabler icons.
- Fictional posters drawn as SVG.

**Mechanical detector** (`impeccable detect`)
- One finding: "overused font: Montserrat".
- Accepted on purpose: it's VIP Monkey's brand font and a binding commitment.

**`/impeccable critique`**, dual-agent: 28/40, with 3 P1 and 2 P2 issues. Snapshot in `.impeccable/critique/`. Nikos chose to fix three:

1. **The sheet hid the event, against the contract's promise.**
   - Now an iOS page sheet: the event page scales back to 92% with the poster still visible.
   - The event card is also in the Swish pane.
2. **Closing the sheet threw the purchase away.**
   - Closing checkout now keeps the hold, and the buy button says "Fortsätt köpet · 9:56 kvar".
   - Cancelling during Swish asks first, with an iOS alert.
   - The payment method and the 200 + 25 split sit right above the pay button.
   - The hold is neutral and only turns amber under 2 minutes.
   - The form error names the missing fields.
3. **Web controls in an iOS app.**
   - The date is three native pickers (iOS shows its wheel).
   - An iOS switch replaced the checkbox.
   - The stepper is gone ("1 biljett per person, arrangörens regel").
   - The Ja/Nej toggle is 44 pt.
   - Views change with an iOS push.
   - The disabled Profil tab now looks disabled.

Not fixed, by Nikos's choice (the brief isn't asking for a final solution):
- Issue 5: a receipt line on the confirmation, plus "works offline" and a door fallback on the ticket.
- The minor items: text showing through under the buy bar, the share button margin, the heavy ticket border, and extending the hold before it runs out.

Apple Pay is left out; the PDF will explain why.

**Not run yet:** `/impeccable audit`, `/impeccable polish`, the finish reviewer, and DESIGN.md. The direction contract's FINISH line says the build isn't finished until those have been done.

**`/impeccable audit`**, quick web audit: 16/20, Good. The native (Xcode) audit doesn't apply because this is HTML simulating iOS, so VoiceOver, Dynamic Type and gestures on a real phone are untested.

Fixed:
- **[P1]** Field and payment-option borders were too faint. They now use a new token, `--c-field-line` #8C8F93, at 3.25:1.
- **[P2]** Loading spinners kept turning slowly under reduced motion instead of freezing.
- **[P2]** The small link line in the chat mock-up went from 4.2:1 to 5.9:1.

Left as P3:
- The prototype demo buttons are 36 pt tall.
- The switch's pale track in the off state.
- The hold can only be renewed after it runs out.
