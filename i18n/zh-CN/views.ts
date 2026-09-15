// 词典段：视图层 TS 专用（T03 维护：TagFolderViewBase.ts / TagFolderView.ts / TagFolderList.ts / ScrollView.ts）
// key 必须与英文原文一字不差（含大小写、省略号 "…"、结尾标点）；缺 key 自动回退英文。
// 注：OrderKeyItem / OrderKeyTag / OrderDirection 的显示值 key 归 T06（i18n/zh-CN/types.ts），
//     视图层消费点只包 tr()，此处不收录，避免跨任务重复 key。
const dict: Record<string, string> = {
	// TagFolderViewBase.ts · showOrder()
	"Tags": "标签",
	"Items": "条目",
	// TagFolderViewBase.ts · showLevelSelect()
	"Level {n}": "层级 {n}",
	"No limit": "无限制",
	// TagFolderViewBase.ts · showMenu()
	"Copy tags:{tags}": "复制标签：{tags}",
	"Copied": "已复制",
	"New note in here": "在此新建笔记",
	"New note as like this": "照此新建笔记",
	"Rename #{tag}": "重命名 #{tag}",
	"Unpin": "取消置顶",
	"Pin": "置顶",
	"Set an alternative label": "设置替代标签名",
	"Change the mark": "更改标记",
	"Redirect this tag to ...": "将此标签重定向到…",
	"Open scroll view": "打开滚动视图",
	"Open list": "打开列表",
	"Open in new tab": "在新标签页中打开",
	"Open to the right": "在右侧打开",
	// TagFolderView.ts · getDisplayText()
	"Tag Folder": "标签文件夹",
	"Link Folder": "链接文件夹",
	// TagFolderList.ts · onPaneMenu / getDisplayText()
	"Files with {title}": "包含 {title} 的文件",
	// ScrollView.ts · getDisplayText() 兜底
	"Tags scroll": "标签滚动视图",
};
export default dict;
