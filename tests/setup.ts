declare global {
	interface Array<T> {
		contains(searchElement: T, fromIndex?: number): boolean;
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

if (!String.prototype.contains) {
	Object.defineProperty(String.prototype, "contains", {
		value: function contains(this: string, searchString: string, position?: number) {
			return this.includes(searchString, position);
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
