# App Design System

This document defines the shared design direction for the apps in this repository. The Inztagram landing page is the current reference implementation.

The goal is not to make every app look identical. Each app should keep its own purpose and controls while sharing the same visual restraint, hierarchy, interaction quality, and overall product character.

## Landing and Front Pages

### Design principles

Landing pages should feel modern, calm, and immediately usable.

1. **Lead with the task.** The primary action should be obvious without requiring explanatory copy.
2. **Use fewer layers.** Avoid stacking a badge, product name, headline, subtitle, helper text, and composer when the headline and composer communicate enough.
3. **Keep color intentional.** Use neutral surfaces for most of the interface and reserve color for status, focus, or a meaningful accent.
4. **Make motion explain change.** Animation should clarify selection, entrance, loading, or navigation. It should not compete with the task.
5. **Prefer useful empty states.** If examples help users begin, show concise starter actions instead of more descriptive text.
6. **Preserve familiarity.** Shared controls should appear in predictable locations across apps.

### Recommended page hierarchy

Use this order for most app landing pages:

```text
App header
  History/menu button + app name                 Apps switcher

Primary task title

Primary input/composer
  Mode or input-type switcher, when needed
  Input area
  Secondary options                              Primary action

Optional starter ideas

Minimal footer
```

Do not add another content layer unless it helps the user make a decision or complete the task.

### App header

The header should be compact and visually quiet.

- Place the history or navigation button on the far left.
- Show the app name as plain text beside it.
- Place the apps switcher on the right.
- Use a translucent neutral background, subtle bottom border, and backdrop blur.
- Keep the interactive header height around `48–56px`.
- Use icon-only buttons for universally understood navigation actions and provide an accessible label.

Avoid:

- Decorative app icons beside the app name.
- Taglines such as “Diagram studio” in the header.
- Large logos or brand gradients.
- Multiple utility labels competing with the app name.

Reference: `src/app/inztagram/page.tsx` and `src/components/apps-header.tsx`.

### Main title

The title should state what the user can do, not describe the technology.

Good examples:

- `Create Instant Diagram`
- `Draft a Research Outline`
- `Search Scientific Literature`
- `Build an Interactive Lesson`
- `Animate a Chart`

Guidelines:

- Prefer one short line on desktop.
- Use title case or sentence case consistently within the app.
- Aim for approximately two to five words.
- Use a semibold weight with tight, deliberate letter spacing.
- Center the title when the composer is centered.
- Let it wrap naturally on narrow screens.

Do not add a badge or subtitle by default. Add supporting text only when users cannot understand what input is expected from the title, placeholder, and controls.

Avoid:

- Eyebrow badges such as “AI Diagram Studio.”
- Repeating the app name as the main title.
- Generic headlines such as “What can I help you with?” when a task-specific title is available.
- Marketing copy above the working interface.
- Gradient-filled headline text.

### Primary composer

The composer is the main visual and interactive surface. It should receive more emphasis than the title.

Recommended treatment:

- Maximum width around `640–680px` for text-oriented inputs.
- White or near-white surface in light mode.
- Elevated dark-neutral surface in dark mode.
- Corner radius around `22–24px`.
- Thin, low-contrast border.
- Soft layered shadow rather than a bright glow.
- Comfortable internal padding of `12–16px`.
- Clear focus feedback using a slightly stronger shadow or restrained accent ring.

The composer should usually contain:

1. An optional mode or input-type switcher.
2. A large, direct input area.
3. A bottom action row separated by a subtle divider.
4. Secondary options on the left and the primary action on the right.

Placeholders should tell users what to enter:

- `Describe the diagram you have in mind…`
- `Enter a topic or research question…`
- `Paste text or describe your source…`

Avoid placeholders that merely repeat the button label.

### Mode switchers

Use a compact segmented control when an app has two or three closely related modes.

- Place it at the top-left of the composer.
- Give the control a quiet neutral background and subtle border.
- Style the selected option like the primary action: near-black with white text in light mode, and the inverse in dark mode.
- Animate a shared selection surface between options rather than fading two independent backgrounds.
- Use a short, controlled spring transition.
- Keep inactive labels visible but subdued.

The Inztagram `Freeform / Mermaid` control is the reference behavior. It uses a Framer Motion `layoutId` to slide the selected surface between options.

Avoid:

- White selected controls on a white composer.
- Different accent colors for each mode.
- Large tabs that compete with the input.
- Animated text or bouncing controls.

Reference: `src/app/inztagram/components/DiagramInput.tsx`.

### Primary and secondary actions

The primary action should use a high-contrast neutral treatment:

- Near-black background and white text in light mode.
- Near-white background and dark text in dark mode.
- Compact rounded rectangle rather than a large pill.
- Short verb such as `Create`, `Search`, `Generate`, `Outline`, or `Continue`.
- Optional directional icon after the label.
- Clear disabled and loading states.

Use color sparingly for errors, progress, or a small focus accent. The primary action does not need a bright brand color to be prominent.

Secondary controls should use quiet borders, translucent neutral fills, and lower-contrast text. Keep them visually subordinate to the primary action.

Do not add helper copy such as “Enter to create” when the action is already conventional. Keyboard shortcuts can remain functional without permanent instructional text.

### Starter ideas

Starter ideas are optional. Use them when users benefit from seeing the expected scope or format of an input.

- Show two to four examples.
- Use concise category labels.
- Populate the input when selected; do not submit automatically unless the label makes that behavior explicit.
- Use monochrome icons inside quiet neutral containers.
- Keep cards below the composer and visually lighter than it.
- On mobile, stack them or allow an intentional horizontal scroll pattern.

Each example should demonstrate a meaningfully different use case rather than rephrasing the same prompt.

Avoid colorful category icons, promotional cards, or long example text on the initial page.

### Background and color

Use warm neutrals instead of pure white across the entire viewport.

Suggested starting tokens:

| Role | Light | Dark |
| --- | --- | --- |
| Page background | `#f7f7f5` | `#10100f` |
| Primary text | `#191918` | `#f2f2ef` |
| Composer surface | `#ffffff` | `#1b1b19` |
| Primary action | `#191918` | `#f2f2ef` |
| Muted text | Primary text at `38–55%` opacity | Primary text at `35–55%` opacity |
| Hairline border | Primary text at `5–8%` opacity | Primary text at `7–10%` opacity |

A faint dot field, radial light, or low-opacity accent glow may provide depth. It must remain nearly invisible during normal use.

Avoid:

- Multiple animated gradient blobs.
- Rainbow gradients.
- Bright glows around every card.
- Several unrelated accent colors.
- Grid patterns with enough contrast to interfere with text.

### Motion

Motion should be subtle and state-driven.

Recommended patterns:

- Stagger the title, composer, and starter ideas on first entrance.
- Use `400–550ms` eased entrances with small vertical offsets around `12–18px`.
- Use `150–250ms` color and shadow transitions for hover and focus.
- Use a restrained spring for segmented-control selection.
- Use a small upward movement, approximately `1–2px`, for hoverable starter cards and active buttons.
- Use a spinner or contained progress treatment while generating.

Always respect the operating system's reduced-motion preference. Remove repeating scale movement, entrance transforms, and decorative hover transforms when reduced motion is enabled.

Avoid:

- Continuous pulsing on multiple background elements.
- Large entrance travel.
- Bouncy springs.
- Motion on static explanatory text.
- Animations that delay input readiness.

### History sidebar

The history sidebar should feel like an extension of the page, not a separate colorful navigation system.

- Use the same warm neutral background as the page.
- Use a subtle right border and soft lateral shadow.
- Prefer a width around `272–288px` when history titles are descriptive.
- Use a concise heading such as `Recent diagrams`, `Recent searches`, or `Recent drafts`.
- Give each item a small monochrome icon container.
- Different glyphs may communicate item types, but keep them the same color.
- Use a quiet hover surface and a clear neutral active surface.
- Keep timestamps smaller and lower contrast than titles.
- Close the sidebar after navigation on compact screens.
- Use a light, minimally blurred backdrop on mobile.

Do not assign a different color to every history-item icon. A collection of blue, purple, green, orange, yellow, and pink icons breaks the otherwise restrained system and adds no useful hierarchy.

The opt-in `quiet` variant in `src/components/history-sidebar.tsx` and its use in `src/app/inztagram/components/InztagramHistorySidebar.tsx` are the current references.

### Spacing and composition

- Keep the content vertically balanced between the fixed header and footer.
- Prefer a maximum page width around `960–1024px`.
- Keep the composer at a narrower reading width inside that page container.
- Use approximately `24–28px` between the title and composer.
- Use approximately `20px` between the composer and starter ideas.
- Ensure the complete primary flow is visible at common laptop heights when practical.
- Allow vertical scrolling on short or narrow screens rather than clipping content.

Do not use large empty hero spacing that pushes the composer below the fold.

### Responsive behavior

Desktop:

- Keep the main title on one line when its length allows.
- Display starter ideas in a compact row.
- Keep secondary options and the primary action on the same composer row.

Mobile:

- Reduce outer padding while preserving the composer’s internal padding.
- Allow the title to wrap cleanly.
- Hide nonessential header labels.
- Stack starter ideas vertically.
- Ensure all tap targets are at least approximately `40px` high.
- Keep the primary action visible without horizontal overflow.
- Allow the page to scroll above the fixed footer.

Test at minimum:

- `375 × 667`
- `390 × 844`
- `768 × 1024`
- `1280 × 720`
- `1440 × 900`

### Accessibility

- Use a semantic `h1` for the task title.
- Give icon-only buttons an `aria-label`.
- Preserve visible keyboard focus states.
- Do not communicate selection or errors through color alone.
- Ensure muted text still meets appropriate contrast requirements.
- Keep native form submission behavior where possible.
- Support keyboard submission when it is useful, even if the shortcut is not permanently displayed.
- Mark decorative background elements with `aria-hidden="true"`.
- Respect reduced-motion settings.

### Content rules

Use direct, task-oriented language:

| Element | Pattern | Example |
| --- | --- | --- |
| Header | App name | `Inztagram` |
| Main title | Verb + output | `Create Instant Diagram` |
| Placeholder | Describe expected input | `Describe the diagram you have in mind…` |
| Primary action | Short verb | `Create` |
| History title | Recent + artifact | `Recent diagrams` |
| Empty history | Plain state | `No previous diagrams found.` |

Do not repeat the same idea across the header, title, subtitle, placeholder, and button.

### When deviation is appropriate

Not every app needs a large composer. Preserve the same principles while choosing a task-appropriate primary surface:

- Upload tools may use a drop zone in place of a textarea.
- Search tools may use a compact single-line input.
- Multi-source tools may use a source selector above the input.
- Apps requiring an important initial choice may show a small set of option cards.

A deviation is appropriate when it reduces uncertainty or is required to complete the task. It is not appropriate solely to make an app look more distinctive.

### Implementation approach

When updating another app:

1. Preserve its data fetching, submission, validation, loading, and routing behavior.
2. Replace only the landing-page shell and visual hierarchy first.
3. Use the existing shared `AppsHeader`, `AppsFooter`, and UI primitives where suitable.
4. Reuse the Inztagram page’s spacing, neutral palette, composer elevation, and motion timing.
5. Adapt the primary surface to the app’s input type.
6. Keep app-specific color to a small accent, if one is needed.
7. Test empty, filled, focused, disabled, loading, error, and mode-selection states.
8. Verify light mode, dark mode, reduced motion, keyboard use, and responsive layouts.

Reference implementation:

- `src/app/inztagram/page.tsx`
- `src/app/inztagram/components/DiagramInput.tsx`
- `src/app/inztagram/components/InztagramHistorySidebar.tsx`
- `src/components/history-sidebar.tsx`

### Review checklist

Before treating a landing page as complete, confirm:

- [ ] The header contains only necessary navigation, the app name, and the apps switcher.
- [ ] The main title is short, task-oriented, and preferably one line on desktop.
- [ ] There is no redundant badge, tagline, subtitle, or helper text.
- [ ] The primary input surface is the strongest visual element.
- [ ] The primary action uses the shared high-contrast neutral style.
- [ ] Mode selection is clearly visible and animates between values.
- [ ] Color is limited and meaningful.
- [ ] History icons use a consistent monochrome treatment.
- [ ] Motion is subtle and respects reduced-motion preferences.
- [ ] The main workflow fits common laptop viewports or scrolls without clipping.
- [ ] Mobile layout has no horizontal overflow.
- [ ] Empty, filled, loading, disabled, and error states are designed.
- [ ] Keyboard focus and icon-button labels are present.
- [ ] TypeScript and relevant application checks pass.

