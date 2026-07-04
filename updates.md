## 0.18.16

### Fixes

-   Fixed nested tag collection when rendering a subtree with a previous trail, so relative child tags are matched against their full tag path correctly.
-   Fixed archive tag filtering at the root tree so descendant archive branches remain visible while archived notes are hidden from unrelated root folders.

### Digging the weeds

-   Added CI for pull requests and pushes to `main`.
-   Added automated tests for TagFolder template rendering, tag tree collection, archive filtering, and utility functions.
-   Added coverage reporting for the new test suite.

## ~~0.18.12~~ 0.18.13

(0.18.12 was skipped due to a versioning mistake)

### Fixes

-   Support the click-to-search function in the attribute list (#98, #128)
    -   Thank you for your contribution, @sunzhi0000-sys!

### Improved

-   Dependencies are updated to the latest version.
-   Small minor improvements have been made.

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
