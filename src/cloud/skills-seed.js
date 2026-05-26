// First-party seed catalog for the skill marketplace (sub-project B).
//
// These are genuine, usable single-file skills published by Mia 官方. They
// are inserted only if absent (seedSkills never clobbers). install_count is
// NOT seeded — it starts at 0 and grows only as people actually install,
// so the marketplace never shows fabricated "X 万人添加" social proof.

const SKILLS_SEED = [
  {
    id: "commit-craft",
    name: "commit-craft",
    category: "办公学习",
    sourceLabel: "Mia 官方",
    description: "把零散改动整理成规范的 Conventional Commits 提交信息。",
    body: [
      "---",
      "name: commit-craft",
      "description: Turn a set of staged changes into a clean Conventional Commits message.",
      "---",
      "",
      "# Commit Craft",
      "",
      "When the user asks for a commit message, inspect the staged diff and write a",
      "Conventional Commits message.",
      "",
      "## Rules",
      "",
      "- Header: `type(scope): summary`, imperative mood, <= 72 chars.",
      "- Types: feat, fix, refactor, docs, test, chore, perf, build.",
      "- Body: explain the *why*, wrap at 72 cols. Omit if the header is enough.",
      "- One logical change per commit; suggest splitting if the diff mixes concerns.",
      "",
      "## Output",
      "",
      "Return only the commit message, ready to paste — no surrounding prose."
    ].join("\n")
  },
  {
    id: "weekly-report",
    name: "weekly-report",
    category: "办公学习",
    sourceLabel: "Mia 官方",
    description: "把一周零散笔记汇总成结构清晰的周报。",
    body: [
      "---",
      "name: weekly-report",
      "description: Turn rough weekly notes into a structured status report.",
      "---",
      "",
      "# Weekly Report",
      "",
      "Take the user's raw notes for the week and produce a concise report.",
      "",
      "## Sections",
      "",
      "1. **本周完成** — shipped work, framed by outcome not activity.",
      "2. **进行中** — in-flight items with current status and the next step.",
      "3. **风险 / 阻塞** — anything that needs a decision or help.",
      "4. **下周计划** — 3–5 concrete priorities.",
      "",
      "Keep each bullet one line. Merge duplicates. Drop filler."
    ].join("\n")
  },
  {
    id: "trip-planner",
    name: "trip-planner",
    category: "生活日常",
    sourceLabel: "Mia 官方",
    description: "根据目的地、天数和偏好排出一份可执行的行程。",
    body: [
      "---",
      "name: trip-planner",
      "description: Build a realistic day-by-day travel itinerary.",
      "---",
      "",
      "# Trip Planner",
      "",
      "Ask for (or infer) destination, dates/length, pace, and interests, then",
      "produce a day-by-day plan.",
      "",
      "## Each day",
      "",
      "- Morning / afternoon / evening blocks with 1–2 anchor activities each.",
      "- Group stops by neighborhood to minimize backtracking.",
      "- Note rough travel time between anchors and one food suggestion per day.",
      "- Flag anything that needs advance booking.",
      "",
      "Keep it realistic — do not over-pack a day."
    ].join("\n")
  }
];

module.exports = { SKILLS_SEED };
