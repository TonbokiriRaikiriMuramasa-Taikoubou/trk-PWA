# Vendored third-party modules

These files are copies of published npm packages, kept here so trk! does not depend on a CDN.
Do not edit them by hand. Regenerate with `node tools/vendor-cdn.mjs` and verify with `npm run check:vendor`.

Source: npm registry tarballs

| package | files | size | license |
| --- | --- | --- | --- |
| @pixiv/three-vrm-animation@3.5.5 | 2 | 0.35 MB | MIT (three.js / three-vrm / three-mmd-loader) |
| @pixiv/three-vrm@3.5.5 | 2 | 0.15 MB | MIT (three.js / three-vrm / three-mmd-loader) |
| @yohawing/three-mmd-loader@0.8.4 | 91 | 2.42 MB | MIT (three.js / three-vrm / three-mmd-loader) |
| three@0.180.0 | 5 | 2.06 MB | MIT (three.js / three-vrm / three-mmd-loader) |

Licenses: three.js (MIT, (c) three.js authors), @pixiv/three-vrm (MIT, (c) pixiv Inc.),
@yohawing/three-mmd-loader (MIT, (c) yohawing). Their LICENSE files are next to the code.
The exact bytes are recorded in tools/vendor-lock.json.
