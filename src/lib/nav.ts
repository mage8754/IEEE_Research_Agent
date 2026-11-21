import {
  LayoutDashboard,
  Feather,
  Braces,
  PenLine,
  SpellCheck,
  ShieldCheck,
  FileSearch,
  Quote,
  Library,
  ClipboardCheck,
  History,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  to:
    | "/dashboard"
    | "/writing"
    | "/humanizer"
    | "/latex-improver"
    | "/grammar"
    | "/latex-shield"
    | "/pdf-analyzer"
    | "/citations"
    | "/literature-review"
    | "/reviewer"
    | "/history"
    | "/settings";
  icon: LucideIcon;
  description: string;
}

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", to: "/dashboard", icon: LayoutDashboard, description: "Your research at a glance" }],
  },
  {
    label: "Writing",
    items: [
      { title: "Writing Assistant", to: "/writing", icon: PenLine, description: "Formal, clear academic English" },
      { title: "AI Humanizer", to: "/humanizer", icon: Feather, description: "Natural, readable IEEE-style prose" },
      { title: "Grammar Checker", to: "/grammar", icon: SpellCheck, description: "Grammar, spelling and punctuation" },
      { title: "LaTeX Shield", to: "/latex-shield", icon: ShieldCheck, description: "Rewrite without touching LaTeX" },
      { title: "LaTeX Code Improver", to: "/latex-improver", icon: Braces, description: "Clean up LaTeX code safely" },
    ],
  },
  {
    label: "Research",
    items: [
      { title: "PDF Analyzer", to: "/pdf-analyzer", icon: FileSearch, description: "Structured paper summaries" },
      { title: "Citation Checker", to: "/citations", icon: Quote, description: "Citations vs. BibTeX consistency" },
      { title: "Literature Review", to: "/literature-review", icon: Library, description: "Compare papers, find gaps" },
      { title: "IEEE Reviewer", to: "/reviewer", icon: ClipboardCheck, description: "Reviewer-style feedback" },
    ],
  },
  {
    label: "Workspace",
    items: [
      { title: "History", to: "/history", icon: History, description: "Every analysis you have run" },
      { title: "Settings", to: "/settings", icon: Settings, description: "Profile, account and data" },
    ],
  },
];

export const ALL_NAV = NAV_GROUPS.flatMap((g) => g.items);

export const MODULE_ROUTE: Record<string, NavItem["to"]> = {
  grammar: "/grammar",
  writing: "/writing",
  humanizer: "/humanizer",
  latex: "/latex-shield",
  latexcode: "/latex-improver",
  pdf: "/pdf-analyzer",
  citations: "/citations",
  literature: "/literature-review",
  reviewer: "/reviewer",
};

export const MODULE_ICON: Record<string, LucideIcon> = {
  grammar: SpellCheck,
  writing: PenLine,
  humanizer: Feather,
  latex: ShieldCheck,
  latexcode: Braces,
  pdf: FileSearch,
  citations: Quote,
  literature: Library,
  reviewer: ClipboardCheck,
};
