import { sveltePreprocess } from "svelte-preprocess";

/**
 * This will add autocompletion if you're working with SvelteKit
 *
 * @type {import('@sveltejs/kit').Config}
 */
const config = {
	preprocess: sveltePreprocess({
		// ...svelte-preprocess options
	}),
	cache: false,
	compilerOptions: { css: "injected" },
	// ...other svelte options
};

export default config;
