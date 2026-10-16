import { sveltePreprocess } from "svelte-preprocess";

const config = {
	preprocess: sveltePreprocess({
		// ...svelte-preprocess options
	}),
	cache: false,
	compilerOptions: { css: "injected" },
	// ...other svelte options
};

export default config;
