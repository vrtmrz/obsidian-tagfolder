declare global {
	interface Array<T> {
		contains(searchElement: T, fromIndex?: number): boolean;
		first(): T | undefined;
	}

	interface String {
		contains(searchString: string, position?: number): boolean;
	}
}

if (!Array.prototype.contains) {
	Object.defineProperty(Array.prototype, "contains", {
		value: function contains<T>(this: T[], searchElement: T, fromIndex?: number) {
			return this.includes(searchElement, fromIndex);
		},
	});
}

if (!Array.prototype.first) {
	Object.defineProperty(Array.prototype, "first", {
		value: function first<T>(this: T[]) {
			return this[0];
		},
	});
}

if (!String.prototype.contains) {
	Object.defineProperty(String.prototype, "contains", {
		value: function contains(this: string, searchString: string, position?: number) {
			return this.includes(searchString, position);
		},
	});
}

for (const [method, tag] of [["createDiv", "div"], ["createSpan", "span"]] as const) {
	Object.defineProperty(HTMLElement.prototype, method, {
		configurable: true,
		writable: true,
		value: function (this: HTMLElement, options: { cls?: string; text?: string; attr?: Record<string, string> } = {}) {
			const element = this.ownerDocument.createElement(tag);
			if (options.cls) element.className = options.cls;
			if (options.text !== undefined) element.textContent = options.text;
			for (const [key, value] of Object.entries(options.attr ?? {})) element.setAttribute(key, value);
			this.append(element);
			return element;
		},
	});
}

if (!window.requestAnimationFrame) {
	window.requestAnimationFrame = (callback) => window.setTimeout(() => callback(performance.now()), 0);
}

if (!window.cancelAnimationFrame) {
	window.cancelAnimationFrame = (handle) => window.clearTimeout(handle);
}

export {};
