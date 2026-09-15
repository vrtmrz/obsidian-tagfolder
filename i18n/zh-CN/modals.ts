// 词典段：弹窗/工作流/建议专用（T05 维护：NoteLookupModal.svelte / note-lookup-modal.ts / new-note-workflow.ts / tag-tree-style-suggestions.ts）
// key 必须与英文原文一字不差（含大小写、省略号 "…"、结尾标点）；缺 key 自动回退英文。
const dict: Record<string, string> = {
	// ---- NoteLookupModal.svelte ----
	"Tags": "标签",
	"Note": "笔记",
	"Type a tag…": "输入标签…",
	"Add a tag…": "添加标签…",
	"Type a file name or path…": "输入文件名或路径…",
	"Tag conditions": "标签条件",
	"Tag completions": "标签补全",
	"Note name or path": "笔记名称或路径",
	"Matching notes": "匹配的笔记",
	"Remove tag {tag}": "移除标签 {tag}",
	"Remove excluded tag {tag}": "移除排除标签 {tag}",
	"Added tag {tag}": "已添加标签 {tag}",
	"Excluded tag {tag}": "已排除标签 {tag}",
	"Removed tag {tag}": "已移除标签 {tag}",
	"{count} note": "{count} 个笔记",
	"{count} notes": "{count} 个笔记",
	"Tab: switch field · ↑↓: select · Enter: open": "Tab：切换输入框 · ↑↓：选择 · Enter：打开",
	"No matching notes": "没有匹配的笔记",
	// ---- note-lookup-modal.ts ----
	"Note lookup": "笔记查找",
	// ---- new-note-workflow.ts ----
	"Type to search templates...": "输入以搜索模板…",
	// ---- tag-tree-style-suggestions.ts ----
	"Simple list": "简单列表",
	"Drill-down": "逐层下钻",
	"Full tree": "完整树形",
	"Show notes directly beneath each tag and display their other tags as labels.":
		"在每个标签下直接显示笔记，并将其余标签以标签形式显示。",
	"Use other tags as additional folders and show notes at the deepest matching level.":
		"将其他标签用作附加文件夹，并在最深的匹配层级显示笔记。",
	"Show notes at intermediate levels as well as within combinations of their tags.":
		"在中间层级以及各标签组合内也显示笔记。",
	"Sample notes": "示例笔记",
	"Rendered project branch": "渲染后的 project 分支",
};
export default dict;
