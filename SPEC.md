# Engineering Calc — Site Spec

A personal web app that collects small engineering calculators, organized in groups, accessible from a left sidebar. Built to grow over time: scaffold the shell now, fill in calculators one at a time.

---

## 1. Goals & non-goals

**Goals**
- A "go-to" personal site for quick engineering calculations.
- Easy to add a new calculator (drop in a new page/component, add a sidebar entry).
- Results that look nice on screen **and** copy cleanly into Word / Excel.
- Deployable to GitHub Pages with zero ongoing cost.

**Non-goals (for now)**
- No accounts, no backend, no database.
- No multi-user / sharing features.
- No mobile-first design — desktop is the primary target (but it should not break on mobile).

---

## 2. Tech stack

| Concern | Choice |
|---|---|
| Framework | **Next.js 14+ (App Router)** with `output: 'export'` for static export |
| Styling | **Tailwind CSS** |
| Language | TypeScript |
| Math rendering | **KaTeX** for on-screen formulas (looks nice). Results shown as plain numbers/units for easy copy. A "Copy" button on each result produces clean text suitable for Word/Excel paste. |
| Icons | `lucide-react` |
| State | React state + `localStorage` for user prefs (theme) |
| Package manager | `npm` (or `pnpm` — preference?) |
| Node | LTS (20+) |

### GitHub Pages constraints
- `next.config.js` needs `output: 'export'`, `images.unoptimized: true`, and `basePath: '/engineering-calc'`.
- All `<Link>` and asset paths must respect `basePath`.
- A `.nojekyll` file in the output to bypass Jekyll processing.
- Deploy via GitHub Actions workflow that runs `next build` and publishes the `out/` directory.

---

## 3. Hosting & repo

- **Repo:** `engineering-calc` (project page).
- **URL:** `https://mod-lumb.github.io/engineering-calc/`
- **GitHub username:** `MoD-Lumb` (URLs are case-insensitive)
- **Domain:** none initially; custom domain optional later.

---

## 4. Visual design

**Style:** Minimal modern. Lots of whitespace, sans-serif (system stack or Inter), simple cards, subtle borders, rounded corners. Reference vibe: Linear / Vercel docs.

**Theme**
- Light and dark mode, toggle in the header. Persists in `localStorage` under key `ec-theme`.
- Tailwind `darkMode: 'class'`.

**Color palette (initial proposal — adjust later)**
- Light: neutral white/gray surface, slate text, single accent (blue or teal) for links/actions.
- Dark: near-black background (`#0b0c0e`), light gray text, same accent at reduced saturation.

**Typography**
- Body: Inter / system sans.
- Mono (for inputs, numbers, code): JetBrains Mono / `ui-monospace`.

---

## 5. Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  Header:  Engineering Calc          [search? ]   [🌙 theme]       │
├──────────┬───────────────────────────────────────────────────────┤
│ Sidebar  │  Main content                                          │
│          │                                                        │
│ search   │  (home: category cards grid)                           │
│ ▼ Mech.. │  (calculator: tabbed view)                             │
│   • A    │                                                        │
│   • B    │                                                        │
│ ▼ Civil. │                                                        │
│   • X    │                                                        │
└──────────┴───────────────────────────────────────────────────────┘
```

### Header
- Site name "Engineering Calc" (left), links to home.
- Theme toggle (right).
- Sidebar collapse button on small screens.

### Sidebar (left)
- **Behavior:** collapsible groups + filter/search box at top.
- Search filters calculator names across all groups; matching groups auto-expand.
- Active calculator is highlighted.
- Each group: chevron + name; click to expand/collapse.
- Each calculator entry: name + optional "WIP" badge for stubs.
- State of expanded/collapsed groups persists in `localStorage` (key `ec-sidebar`).

### Main content
- **Home page** (`/`): grid of category cards. Each card = group name, short description, count of calculators inside. Click → category index page (or just expand sidebar group).
- **Calculator page** (`/[category]/[slug]`): tabbed layout — three tabs:
  1. **Calculator** — inputs + live results + copy buttons.
  2. **Theory** — formula(s) rendered with KaTeX, derivation notes, assumptions.
  3. **Examples** — worked examples with given values and expected results.
- **Stub pages** show a "Coming soon" badge in the Calculator tab, with the planned formula already rendered in Theory.

---

## 6. Calculator page anatomy

A calculator is a self-contained module. Each one exports:
- `meta`: `{ slug, name, category, description, status: 'live' | 'wip', tags }`
- A React component for the **Calculator** tab.
- An MDX or React component for **Theory**.
- An MDX or React component for **Examples**.

### Calculator tab content
- Title + 1-line description.
- Input fields (labeled, with unit suffix, default values).
- Live-computed results (no "Calculate" button — recompute on input change).
- Each result has a **Copy** button that copies a clean string like `σ = 12.5 MPa` (configurable per result). A "Copy all" copies an Excel-pasteable table (tab-separated).
- "Reset to defaults" link.

### Theory tab content
- Formula(s) rendered with KaTeX.
- Variable definitions table.
- Assumptions / valid range.
- Source / reference (book, standard, link).

### Examples tab content
- 1–3 worked examples per calculator. Each shows: problem statement, input values, computed result, optional commentary.

### Copy-to-Word/Excel behavior
- **Numbers:** plain Unicode strings, e.g. `σ = 12.5 MPa`. No HTML entities.
- **Tables:** tab-separated text for Excel paste compatibility.
- **Formulas:** Theory tab will have a "Copy as text" button next to each KaTeX-rendered formula that copies a readable plain-text form (e.g. `sigma = F / A`) since rendered KaTeX doesn't paste well into Word.

---

## 7. Units

- **SI only** across the site (mm, N, MPa, kW, °C, m³/h, etc.).
- Units are displayed as suffixes on inputs/outputs.
- No unit conversion logic in calculators themselves — inputs are SI, outputs are SI.
- A dedicated **Unit converter** calculator can live under the Civil / Utilities group for the rare conversion needs.

---

## 8. Initial content scaffolding

### Categories (top-level groups in sidebar)
1. **Mechanical / Strength of materials**
2. **Civil / Structural / Unit converters**

### Stub calculators (2–3 per category, all status `wip`)

> Names are placeholders — you can rename freely. Each ships as a "Coming soon" page with the planned formula rendered in the Theory tab.

**Mechanical / Strength of materials**
- `axial-stress` — Axial stress (σ = F / A)
- `beam-deflection-simple` — Simply supported beam, center point load
- `bolt-shear` — Bolt shear capacity

**Civil / Structural / Unit converters**
- `concrete-volume` — Concrete volume from dimensions
- `unit-converter-length` — Length unit converter (mm ↔ cm ↔ m)
- `unit-converter-pressure` — Pressure unit converter (Pa ↔ kPa ↔ MPa ↔ bar)

You can confirm / replace these names before scaffolding, or accept and edit later.

---

## 9. Routes

```
/                                        Home (category cards)
/mechanical                              Category index (optional)
/mechanical/axial-stress                 Calculator
/mechanical/beam-deflection-simple       Calculator
/mechanical/bolt-shear                   Calculator
/civil                                   Category index (optional)
/civil/concrete-volume                   Calculator
/civil/unit-converter-length             Calculator
/civil/unit-converter-pressure           Calculator
```

Category index pages are optional — initially the sidebar group expand can be enough, and the home page already lists everything.

---

## 10. File / folder structure

```
engineering-calc/
├─ app/
│  ├─ layout.tsx              # Header + sidebar shell
│  ├─ page.tsx                # Home: category grid
│  ├─ [category]/
│  │  └─ [slug]/
│  │     └─ page.tsx          # Dynamic calculator route
│  └─ globals.css
├─ components/
│  ├─ Sidebar.tsx
│  ├─ Header.tsx
│  ├─ ThemeToggle.tsx
│  ├─ CalcTabs.tsx            # Tabbed layout for calculator pages
│  ├─ CopyButton.tsx
│  └─ Formula.tsx             # KaTeX wrapper
├─ calculators/
│  ├─ index.ts                # Registry: imports all meta + components
│  ├─ mechanical/
│  │  ├─ axial-stress/
│  │  │  ├─ meta.ts
│  │  │  ├─ Calculator.tsx
│  │  │  ├─ Theory.tsx
│  │  │  └─ Examples.tsx
│  │  └─ ...
│  └─ civil/
│     └─ ...
├─ lib/
│  ├─ format.ts               # Number formatting, copy helpers
│  └─ categories.ts           # Category metadata
├─ public/
│  └─ .nojekyll
├─ .github/workflows/deploy.yml
├─ next.config.js
├─ tailwind.config.ts
├─ tsconfig.json
└─ package.json
```

A central **registry** (`calculators/index.ts`) imports each calculator's `meta` so the sidebar, search, and home page can be built from a single source of truth. Adding a new calculator = create the folder + import in the registry.

---

## 11. Features (initial set)

- [x] Left sidebar with collapsible groups + search.
- [x] Dark / light theme toggle (persisted).
- [x] Tabbed calculator pages (Calculator / Theory / Examples).
- [x] KaTeX rendering for formulas.
- [x] Copy buttons that produce Word/Excel-friendly text.
- [x] Home grid of category cards.
- [x] Stubs with "Coming soon" + planned formula visible.

**Deferred (not in v1)**
- Save inputs per calculator (`localStorage`).
- Favorites / pinning.
- PDF / print stylesheet.
- Per-input unit dropdowns.
- Imperial unit toggle.
- Sharing a calculation via URL params.

---

## 12. Deployment

GitHub Action on push to `main`:
1. Checkout, set up Node 20.
2. `npm ci`
3. `npm run build` (which runs `next build` with `output: 'export'`).
4. Upload `out/` as Pages artifact.
5. Deploy via `actions/deploy-pages`.

---

## 13. Decisions log

- GitHub username: **Mod-Lumb** → deploy URL `https://mod-lumb.github.io/engineering-calc/`.
- Stub calculator names: **accept the placeholders in §8** (can rename later).
- Package manager: **npm**.
- Accent color: **blue**.

---

## 14. Calculator authoring (v2 — YAML spec + Excel-like layout + MDX theory)

This extension lets each "real" calculator be authored as a small YAML spec + an MDX theory file, instead of writing React. The goal: port an Excel calculation by transcribing it into the spec.

### 14.1 Calculator folder structure (v2)

```
calculators/mechanical/axial-stress/
├─ calc.yaml            # inputs, computed cells, layout, side notes
├─ theory.mdx           # Theoretical explanation (easy to edit)
├─ examples.mdx         # Worked examples (easy to edit)
└─ index.ts             # Thin loader: imports the YAML/MDX and registers meta
```

The existing `.tsx`-only pattern stays valid for calculators that need custom UI; the YAML+MDX pattern is the default for new ones.

### 14.2 `calc.yaml` schema

```yaml
slug: axial-stress
name: Axial stress
category: mechanical
description: Normal stress under uniaxial loading.
status: live

# Rows are evaluated top-to-bottom. Each row has either:
#  - `input:` (user-editable number)  OR
#  - `formula:` (math.js expression referencing other rows by `id`)
rows:
  - id: F
    label: Axial force
    input: 1000
    unit: N
    note: Positive in tension, negative in compression.

  - id: A
    label: Cross-section area
    input: 100
    unit: mm²
    note: Net area, gross holes deducted.

  - id: sigma
    label: Normal stress
    formula: F / A
    unit: MPa
    note: σ = F / A   (1 N / 1 mm² = 1 MPa)
    highlight: true   # styled as a result row
```

- `input` rows render as editable number fields with a unit suffix.
- `formula` rows recompute live (math.js evaluation, sandboxed — no arbitrary JS).
- `note:` per row populates the right-side notes column.
- Optional `highlight: true` marks a final/result row visually.
- All values are SI in the spirit of §7; if a calculator needs internal unit conversions, do them inside the formula.

### 14.3 Page layout (per calculator)

```
┌─ Tabs: Calculator | Theory | Examples ─────────────────────────┐
│ Calculator tab:                                                  │
│ ┌─────────────────────────────────┬─────────────────────────────┐│
│ │  Parameter        Value   Unit  │  Notes                       ││
│ │  Axial force F    [1000]  N     │  Positive in tension…        ││
│ │  Area A           [100]   mm²   │  Net area, gross holes…      ││
│ │  ─────────────────────────────  │  σ = F / A                   ││
│ │  Normal stress σ  10.0    MPa   │  (1 N / 1 mm² = 1 MPa)       ││
│ │  [Copy result] [Copy as table]  │                              ││
│ └─────────────────────────────────┴─────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

- **Left:** datasheet-style row grid (label / value / unit), result rows visually distinguished.
- **Right:** sticky notes column populated from `note:` fields, aligned to its row when scrolling.
- **Bottom:** copy buttons (result, all rows as TSV for Excel paste).

### 14.4 Theory & examples (MDX)

`theory.mdx` and `examples.mdx` are plain markdown with two helper components available without import:

```mdx
# Axial stress

Normal stress for a prismatic bar loaded along its centroidal axis:

<Formula tex="\sigma = \dfrac{F}{A}" />

## Variables

| Symbol | Meaning              | Unit |
|--------|----------------------|------|
| σ      | Normal stress        | MPa  |
| F      | Axial force          | N    |
| A      | Cross-sectional area | mm²  |

## Assumptions

- Linear elastic material.
- Uniform stress distribution across the section.
```

Editing flow: open `theory.mdx` in any editor (VS Code, Notepad++), save, refresh — done. No React knowledge required.

### 14.5 Excel → spec workflow (manual port)

1. Look at the Excel calculator.
2. List the named inputs, then the intermediate and result cells in evaluation order.
3. Copy each formula, replacing cell references (`=B3/B4`) with the row `id`s you chose (`F / A`). math.js accepts most Excel-style operators and functions (`SQRT`, `IF`, `MIN`, `MAX`, `^`, etc.).
4. Add a one-line `note:` per row drawn from the Excel comments / column to the right.
5. Drop screenshots or derivations into `theory.mdx`.

A future enhancement (not v2) can add a `.xlsx → calc.yaml` build-time converter using SheetJS, once the spec format proves itself on a few hand-ported calculators.

### 14.6 Dependencies to add

| Package | Why |
|---|---|
| `mathjs` | Safe formula evaluation in the browser |
| `js-yaml` | Parse `calc.yaml` at build time |
| `@next/mdx` + `@mdx-js/loader` + `@mdx-js/react` | MDX support for theory/examples |
| `remark-gfm` | GitHub-flavored markdown (tables) inside MDX |

### 14.7 New components

- `SpecGrid.tsx` — renders the input/result row grid from a parsed spec, live-recomputes on input change, persists inputs to `localStorage` (key `ec-inputs-<slug>`).
- `NotesColumn.tsx` — right-side sticky column of per-row notes.
- `MdxProvider.tsx` — wires up `<Formula>` and any other helpers as default MDX components.
- The existing `Theory.tsx`/`Examples.tsx` per calculator are replaced with imports of the corresponding `.mdx` for new calculators.

### 14.8 Proof of concept

`axial-stress` will be the first calculator built with the v2 pattern, end-to-end:
- `calc.yaml` with F, A, σ rows (as shown above)
- `theory.mdx` with the formula, variable table, assumptions
- `examples.mdx` with one worked example
- Status flipped from `wip` → `live`

The other 5 stubs stay as-is until each is ported.

---

## 15. Build order (proposed)

1. Bootstrap Next.js + Tailwind + KaTeX, configure for static export & GitHub Pages.
2. Build app shell: header, sidebar, theme toggle, layout.
3. Implement calculator registry + dynamic route.
4. Build `CalcTabs`, `CopyButton`, `Formula` components.
5. Scaffold the 2 categories + 6 stub calculators (all `wip`, planned formula in Theory).
6. Build home grid.
7. Set up GitHub Actions deploy workflow.
8. First deploy to GitHub Pages, verify URLs work under `basePath`.

After that, each new calculator is just: add folder under `calculators/<category>/`, register it, flip `status` to `live` when ready.
