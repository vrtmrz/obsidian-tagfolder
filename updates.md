## 0.18.11

Since 0.18.11, I have written this changelog as same as the Self-hosted LiveSync. It is quite useful for us.

### Fixes

-   Now `Disable narrowing down` works correctly again (#114).

### New features

-   Redirecting tags are applied to virtual tags (#110)
-   Collapse all expanded tags are implemented (#112)

### Digging the weeds

-   Many dependencies are updated to the latest version. And also the Svelte compiler is updated to the latest version.
-   Now `npm run check` implemented in the package.json. Runs tsc, eslint, svelte-check at once.
