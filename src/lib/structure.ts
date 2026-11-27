// Site structure: sections, types, tools, collections and lesson kinds.
// Kept free of Astro imports so content.config.ts can use it too.

/**
 * Site structure. Every product has one type (its `category` field); the type decides the section.
 * Sections and types appear in the menu, the section pages and the breadcrumbs. A type without
 * products shows as "Soon" in the menu, so you can announce it before the first item is live.
 */
export const sections = {
  graphics: {
    label: 'Graphics',
    all: 'All graphics',
    search: 'Search effects, textures, brushes…',
    title: 'Effects, textures and brushes',
    intro: 'One-click effects, hi-res textures and brushes for the printed, analog look. Made in Affinity Studio.',
  },
  templates: {
    label: 'Templates',
    all: 'All templates',
    search: 'Search social, brand, print, slides…',
    title: 'Start from a strong layout',
    intro: 'Social posts, brand kits, print layouts and slides. Swap in your content and ship.',
  },
  web: {
    label: 'Web',
    all: 'All web assets',
    search: 'Search WebGL, Framer, Webflow…',
    title: 'Effects and components for the web',
    intro: 'WebGL effects and drop-in components for Framer, Webflow and plain code.',
  },
} as const;

export type SectionKey = keyof typeof sections;

export const categories = {
  // Graphics
  effects: { section: 'graphics', nav: 'Effects & scripts', label: 'Effects & scripts', title: 'One click, printed look' },
  textures: { section: 'graphics', nav: 'Textures & overlays', label: 'Textures & overlays', title: 'Grit, grain and ink' },
  brushes: { section: 'graphics', nav: 'Brushes', label: 'Brushes', title: 'Mark-making that feels real' },
  icons: { section: 'graphics', nav: 'Icons & vectors', label: 'Icons & vectors', title: 'Shapes you can build with' },
  mockups: { section: 'graphics', nav: 'Mockups', label: 'Mockups', title: 'Show the work in context' },
  // Templates
  social: { section: 'templates', nav: 'Social media', label: 'Social media templates', title: 'Post-ready in minutes' },
  brand: { section: 'templates', nav: 'Brand kits', label: 'Brand kits', title: 'A system, not just a logo' },
  print: { section: 'templates', nav: 'Print & posters', label: 'Print & posters', title: 'Made to be printed' },
  presentations: { section: 'templates', nav: 'Presentations', label: 'Presentations & pitch decks', title: 'Slides that hold together' },
  // Web
  webgl: { section: 'web', nav: 'WebGL effects', label: 'WebGL effects', title: 'Motion that reacts to the cursor' },
  framer: { section: 'web', nav: 'Framer components', label: 'Framer components', title: 'Drop in, publish' },
  code: { section: 'web', nav: 'Webflow & code', label: 'Webflow & code', title: 'Copy, paste, customise' },
  sites: { section: 'web', nav: 'Website templates', label: 'Website templates', title: 'A whole site, ready to edit' },
} as const;

export type CategoryKey = keyof typeof categories;
export const categoryKeys = Object.keys(categories) as [CategoryKey, ...CategoryKey[]];

/** Types in one section, in menu order. */
export const typesIn = (section: SectionKey) =>
  (Object.keys(categories) as CategoryKey[]).filter((k) => categories[k].section === section);

/** The tools a product works with: the "Works with" filter. */
export const tools = {
  affinity: 'Affinity',
  canva: 'Canva',
  figma: 'Figma',
  framer: 'Framer',
  webflow: 'Webflow',
  code: 'HTML / React',
} as const;

export type ToolKey = keyof typeof tools;
export const toolKeys = Object.keys(tools) as [ToolKey, ...ToolKey[]];

export const collectionsInfo = {
  offset: {
    name: 'Offset',
    text: 'Print grit for screens: halftones, grain, misregistration and riso-style overlays.',
  },
  detach: {
    name: 'Detach',
    text: 'The starter kit for leaving Adobe: templates, swatches and shortcuts to get you working in Affinity on day one.',
  },
  glass: {
    name: 'Glass',
    text: 'Refraction, fluted glass and liquid glass: for your design files and your website.',
  },
} as const;

export type CollectionKey = keyof typeof collectionsInfo;
export const collectionKeys = Object.keys(collectionsInfo) as [CollectionKey, ...CollectionKey[]];

/** Learn: the kinds of lessons, each with its own page. */
export const lessonKinds = {
  tutorial: { nav: 'Tutorials', title: 'Tutorials', href: '/learn/tutorials/' },
  cheatsheet: { nav: 'Cheat sheets', title: 'Cheat sheets', href: '/learn/cheat-sheets/' },
  tip: { nav: 'Shortcuts & tips', title: 'Shortcuts & tips', href: '/learn/tips/' },
} as const;

export type LessonKind = keyof typeof lessonKinds;
