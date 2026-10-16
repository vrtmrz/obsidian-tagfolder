// 词典段：main.ts 专用（T02 维护）
// key 必须与英文原文一字不差（含大小写、省略号 "…"、结尾标点）；缺 key 自动回退英文。
// 术语表见 foreman/EXEC_PROMPT_插件汉化.md：Tag Folder=标签文件夹、Link Folder=链接文件夹、
// tag=标签、nested tags=嵌套标签、pin/pinning=置顶、incoming/outgoing=入链/出链、pane=窗格、
// frontmatter 不译、Disguised tags=伪装标签；{name}/{path} 占位符与示例路径保留英文。
const dict: Record<string, string> = {
	// ── 命令（addCommand）─────────────────────────────
	"Show Tag Folder": "显示标签文件夹",
	"Show Link Folder": "显示链接文件夹",
	"Force Rebuild": "强制重建",
	"Create a new note with the same tags": "创建包含相同标签的新笔记",
	"Open note by tags": "按标签打开笔记",
	"Open note with similar tags": "按相似标签打开笔记",

	// ── 通知（Notice）────────────────────────────────
	"No templates found. Add a template, then try again.": "未找到模板。请先添加模板，然后重试。",
	"Template not found: {path}": "未找到模板：{path}",
	"Copied to clipboard": "已复制到剪贴板",
	"Applied '{name}' settings.": "已应用「{name}」的设置。",

	// ── HideItemsType 下拉值（键名 NONE 等为存储值，不译）──
	"Hide nothing": "不隐藏",
	"Only intermediates of nested tags": "仅嵌套标签的中间层级",
	"All intermediates": "所有中间层级",

	// ── 分节 heading ─────────────────────────────────
	"Behavior": "行为",
	"Files": "文件",
	"Tags": "标签",
	"Actions": "操作",
	"Arrangements": "排列",
	"Link Folder": "链接文件夹",
	"Filters": "筛选",
	"Misc": "杂项",
	"Utilities": "工具",

	// ── 语言设置（新增项）──────────────────────────────
	"Language": "语言",
	"UI language. 'Auto' follows the Obsidian interface language and falls back to English when unmatched.":
		"界面语言。选择「Auto」时跟随 Obsidian 界面语言，无法匹配时回退为英文。",

	// ── Behavior 分节 ────────────────────────────────
	"Always Open": "始终打开",
	"Place TagFolder on the left pane and activate it at every Obsidian launch":
		"将标签文件夹放置在左侧窗格，并在每次启动 Obsidian 时自动激活",
	"Use pinning": "使用置顶",
	"When this feature is enabled, the pin information is saved in the file set in the next configuration.":
		"启用此功能后，置顶信息将保存在下一项配置所设置的文件中。",
	"Pin information file": "置顶信息文件",
	"Disable narrowing down": "禁用层级收窄",
	"When this feature is enabled, relevant tags will be shown with the title instead of making a sub-structure.":
		"启用此功能后，相关标签将连同标题并列显示，而不再生成子结构。",

	// ── Files 分节 ───────────────────────────────────
	"Display method": "显示方式",
	"How to show a title of files": "如何显示文件标题",
	"Order method": "排序方式",
	"how to order items": "条目的排序方式",
	"how to order tags": "标签的排序方式",
	"Prioritize items which are not contained in sub-folder": "优先显示不包含在子文件夹中的条目",
	"If this has been enabled, the items which have no more extra tags are first.":
		"启用后，没有更多额外标签的条目将排在前面。",
	"Use title": "使用标题",
	"Use value in the frontmatter or first level one heading for `NAME`.":
		"「NAME」显示方式将使用 frontmatter 中的值或第一个一级标题。",
	"Frontmatter path": "Frontmatter 路径",

	// ── Tags 分节 ────────────────────────────────────
	"Suggested tag tree style": "推荐标签树样式",
	"Apply a suggested combination of tag tree settings.": "应用一组推荐的标签树设置组合。",
	"Select a style": "选择样式",
	"Apply": "应用",
	"Use virtual tags": "使用虚拟标签",
	"Display folder as tag": "将文件夹显示为标签",
	"Store tags in frontmatter for new notes": "将新笔记的标签存入 frontmatter",
	"When enabled, tags are written to the note Properties. If no new-note template is selected, TagFolder still creates the note and stores tags here instead of as #hashtags.":
		"启用后，标签将写入笔记的属性（Properties）。如果未选择新笔记模板，TagFolder 仍会创建笔记，并把标签存到这里，而不是作为 #hashtags 写入正文。",
	"Template for new notes": "新笔记模板",
	"When set to a valid markdown file path, new notes use this template without opening the template picker. The .md extension is optional.":
		"设置为有效的 Markdown 文件路径后，新笔记将直接使用该模板，而不再打开模板选择器。.md 扩展名可省略。",

	// ── Actions 分节 ─────────────────────────────────
	"Search tags inside TagFolder when clicking tags": "点击标签时在标签文件夹内搜索该标签",
	"List files in a separated pane": "在独立窗格中列出文件",
	"Show list in": "列表显示位置",
	"This option applies to the newly opened list": "此选项应用于新打开的列表",

	// ── Arrangements 分节 ────────────────────────────
	"Hide Items": "隐藏条目",
	"Hide items on the landing or nested tags": "隐藏位于着陆标签或嵌套标签下的条目",
	"Merge redundant combinations": "合并冗余组合",
	"When this feature is enabled, a/b and b/a are merged into a/b if there is no intermediates.":
		"启用此功能后，若无中间层级，a/b 与 b/a 将合并为 a/b。",
	"Do not simplify empty folders": "不简化空文件夹",
	"Keep empty folders, even if they can be simplified.": "保留空文件夹，即使其可被简化。",
	"Do not treat nested tags as dedicated levels": "不将嵌套标签视为独立层级",
	"Treat nested tags as normal tags": "将嵌套标签视为普通标签",
	"Reduce duplicated parents in nested tags": "减少嵌套标签中的重复父级",
	"If enabled, #web/css, #web/javascript will merged into web -> css -> javascript":
		"启用后，#web/css、#web/javascript 将合并为 web -> css -> javascript",
	"Keep untagged items on the root": "将未打标签的条目保留在根目录",

	// ── Link Folder 分节 ─────────────────────────────
	"Use Incoming": "使用入链",
	"Use Outgoing": "使用出链",
	"Hide indirectly linked notes": "隐藏间接链接的笔记",
	"Connect linked tree": "连接链接树",

	// ── Filters 分节 ─────────────────────────────────
	"Target Folders": "目标文件夹",
	"If configured, the plugin will only target files in it.": "配置后，插件将只处理其中的文件。",
	"Ignore Folders": "忽略文件夹",
	"Ignore documents in specific folders.": "忽略特定文件夹中的文档。",
	"Ignore note Tag": "忽略笔记标签",
	"If the note has the tag listed below, the note would be treated as there was not.":
		"若笔记带有下列标签，则视同该笔记没有这些标签。",
	"Ignore Tag": "忽略标签",
	"Tags in the list would be treated as there were not.": "列表中的标签将被视同不存在。",
	"Archive tags": "归档标签",
	"If configured, notes with these tags will be moved under the tag.": "配置后，带有这些标签的笔记将被归入该标签之下。",

	// ── Misc 分节 ────────────────────────────────────
	"Tag scanning delay": "标签扫描延迟",
	"Sets the delay for reflecting metadata changes to the tag tree. (Plugin reload is required.)":
		"设置元数据变更反映到标签树的延迟。（需要重新加载插件。）",
	"Disable dragging tags": "禁用拖拽标签",
	"The `Dragging tags` is using internal APIs. If something happens, please disable this once and try again.":
		"「拖拽标签」功能使用了内部 API。如果出现问题，请临时禁用后重试。",

	// ── Utilities 分节 ───────────────────────────────
	"Dumping tags for reporting bugs": "导出标签用于报告 Bug",
	"If you want to open an issue to the GitHub, this information can be useful. and, also if you want to keep secrets about names of tags, you can use `disguised`.":
		"若要向 GitHub 提交 issue，这些信息会很有用。另外，若不想公开标签名称，可以使用「disguised」。",
	"Copy tags": "复制标签",
	"Copy disguised tags": "复制伪装标签",
};
export default dict;
