// 词典段：types.ts 显示名专用（T06 维护：types.ts 显示名消费点 / util.ts renderSpecialTag）
// key 必须与英文原文一字不差（含大小写、省略号 "…"、结尾标点）；缺 key 自动回退英文。
// 这些 key 是 types.ts 数据本体（OrderKeyTag/OrderKeyItem/OrderDirection/enumShowListIn/
// tagDispDict）的英文显示值；消费点（main.ts / TagFolderViewBase.ts）只包 tr(标签值)，
// 词典统一收在本段，避免多线重复维护。
// 数据键（_untagged / _unlinked / _VIRTUAL_TAG_* 等）永不翻译；tagDispDict 显示值除外。
const dict: Record<string, string> = {
	// OrderKeyTag
	"Tag name": "标签名",
	"Count of items": "条目数",
	// OrderKeyItem
	"Displaying name": "显示名",
	"File name": "文件名",
	"Modified time": "修改时间",
	"Created time": "创建时间",
	"Fullpath of the file": "文件完整路径",
	// OrderDirection
	"Ascending": "升序",
	"Descending": "降序",
	// enumShowListIn
	"Sidebar": "侧边栏",
	"Current pane": "当前窗格",
	"New pane": "新窗格",
	// tagDispDict 显示值
	"📋 Canvas": "📋 画布",
};
export default dict;
