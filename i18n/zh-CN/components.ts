// 词典段：Svelte 组件专用（T04 维护：TagFolderViewComponent.svelte / ScrollViewComponent.svelte /
// V2TreeFolderComponent.svelte / V2TreeItemComponent.svelte）
// key 必须与英文原文一字不差（含大小写、省略号 "…"、结尾标点）；缺 key 自动回退英文。
const dict: Record<string, string> = {
	// TagFolderViewComponent.svelte
	"New note": "新建笔记",
	"Change sort order": "更改排序方式",
	"Expand limit": "展开层级限制",
	"Search": "搜索",
	"Switch List/Tree": "切换列表/树",
	"Toggle Incoming": "切换入链",
	"Toggle Outgoing": "切换出链",
	"Toggle Incoming&Outgoing": "切换入链与出链",
	"Toggle Hide indirect notes": "切换隐藏间接笔记",
	"Collapse all": "全部折叠",
	"Clear search": "清除搜索",
	"Type to start search...": "输入以开始搜索…",
	"Tags": "标签",
	"Links": "链接",
	"Items: {title}": "条目：{title}",
	// ScrollViewComponent.svelte
	"Files with {tagPath}": "包含 {tagPath} 的文件",
	// V2TreeFolderComponent.svelte
	"Linked to {filename}": "链接到 {filename}",
};
export default dict;
