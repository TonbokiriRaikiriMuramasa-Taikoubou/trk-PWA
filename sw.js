// SPDX-License-Identifier: GPL-3.0-or-later
/* trk! offline shell: network first, cached same-origin app files as a fallback.
   Exception: the hash-pinned vendor files (assets/vendor, tools/vendor-lock.json) are cache-first,
   but a cached copy is used only when its SHA-384 matches the pin below. */
const CACHE = "trk-v2026.10.29-trk219";
const CACHE_PREFIX = "trk-";
const SCOPE = new URL(self.registration.scope);
const VENDOR_PREFIX = "assets/vendor/";
/* 📥 share_target（trk165）：OSの共有シートで受け取ったファイルの一時置き場。
   名前が trk- 始まりでもバージョン別キャッシュではないので、activate の掃除から除外する（下記）。
   中身は js/share-inbox.js が起動時に読んで、既存の取り込み経路へ渡したあと消す。 */
const SHARE_CACHE = "trk-share-inbox-v1";
const SHARE_PATH = new URL("share-target/", SCOPE).pathname;
const SHARE_INBOX_PREFIX = new URL("share-inbox/", SCOPE).pathname;

// BEGIN VENDOR PINS（tools/sw-vendor-pins.mjs が tools/vendor-lock.json から生成。手で編集しない）
const VENDOR_PINS = {
  "assets/vendor/@pixiv/three-vrm-animation@3.5.5/LICENSE": "UwKvHw1lgiV3ZFzt81XZs3FGkoYlpTRYQNdrdWuL5045ZGu4sCbTSigeN2K7nmGp",
  "assets/vendor/@pixiv/three-vrm-animation@3.5.5/lib/three-vrm-animation.module.js": "XE402mcX5aFIp/O2rRam4ThAYBooleJWzN7mwYS0dkwtRumMQERsRD7iCxhSMLVC",
  "assets/vendor/@pixiv/three-vrm@3.5.5/LICENSE": "UwKvHw1lgiV3ZFzt81XZs3FGkoYlpTRYQNdrdWuL5045ZGu4sCbTSigeN2K7nmGp",
  "assets/vendor/@pixiv/three-vrm@3.5.5/lib/three-vrm.module.min.js": "0eKYXVEzMZHC65jBi4pvegRrAJUf4hlPDrPJfp8j6Ra0wadM3lHq4eWmHi/u+y2f",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/LICENSE": "hq+S++J431JfkQ3UhnLjkCZ4C2gX1Jr6lQR62eMTRmsbJrC5mtadrQSri/klZEym",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/index.js": "NW1V+f2zHRh74bUy3FUOlnmmozIMhaBUcbKrITsHDjcBlalhqH7VTcChPMRitooS",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/parser/accessory/AccessoryParser.js": "/NHPwcLQiVpt5LK8OKKCAwDe9EnZ6vSSc7w+KJ6B0Tykr5lSe6Unz7ZKMqQeXnLj",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/parser/accessory/index.js": "56vSSyDyPkfUFcCdBPmv2ibKB/nHvRgQKJKfkHby26VUyKYA2hx2Lu4u+ezd5PT4",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/parser/binary/BinaryReader.js": "nBVRkXqIH6AS7zd+8FNVDw8tw8BPw9CWYQE9k6PHYwMd3lW79ukyaELqo9cBOwGQ",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/parser/binary/index.js": "93HaHxibgqg6lxB694ssWhowGJX8e+b0EeAv+saK0KDRIrUMbSFTrF7wgg7C/pg/",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/parser/formatDetection.js": "1EdnDURKg0Q6zcXWjJd4sWpa0GScyfHWFmadg9v1LoLWj9DGbld5bxbr1ktuDgoc",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/parser/index.js": "i3XL8KNkJKSFAdbVY9SvijZpuOmTzPc3b023iORrJXzggggI3bf2l4rf9eDPZs22",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/parser/model/PmdModelParser.js": "xULI8IHUYY84p+wc47bqV0nTbqv6gY9syEiMnOis1Q/T4TuUaZ/EwsOK2OUbMHDz",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/parser/model/PmxModelParser.js": "PZo9IFUMwEJ4MxYCfqSdU05WhAROUGdK1fKmSiotYiDjtEI6aQUW2gRvN1l+A3LR",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/parser/model/denseMorphProvider.js": "gA0iIpjju8gplLSJ3XAZAd//8TtbqORwm4Kwc17U1yJRsPLNjtBnyFcgCXSyHnN4",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/parser/model/diagnostics.js": "KI7YGvfEeTvRAsJS2iUiHcptxYDCN0BA5LNvnCi1llx9bq+jTRSw6D/QE6Jhj9+H",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/parser/model/normalSanitization.js": "mSSXQge/ma8UrgkSGL43GJzKHWyp7waVK3hEuLS2aLRA8w1L7KxKXkH7kerquk9j",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/parser/pmd/PmdMetadataParser.js": "ptHiO5qSGYPuUWuQpLuVB7RCdvqAOxrbTtXL/h43x7HESxkCGGp38R2Qy2CfIRaL",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/parser/pmd/index.js": "dwU77B/uRQkVeSyLKzB4If/BYcJjYnSCkpqgiN1UvriJW5JXh2IJSIymwaIgmse4",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/parser/pmm/PmmParser.js": "BuTHiOO2csUWeyaYZju2lt3OnU3L0EdwQLqeAa0q9xfiFE/ye0YEmy+8SSWLGctB",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/parser/pmm/index.js": "2Fatfodd/rLrgNtbpmrzJ+yEBv7ajOJzZvjFveduqhgvwa/rVfWlXrqGgIeP5U2Y",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/parser/pmx/PmxMetadataParser.js": "iln74ktK/2ccqOWeSM1e2Yac3oSzCJtsrngZrHKzDpKQ02qkLL5pujKmInnmedFH",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/parser/pmx/index.js": "O1/7WENVc/IUUED0rEx/FYIOjGWGlfXCgN5i0xJiXhyaVcqzo8a8nd6Kof88Vddn",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/parser/skeleton/index.js": "U9/RVxfOMmHEZ1jZ0zigGZFiV2J5Lnigd822aMkayD+aRQQXDpLxFAp0mLVRdPSk",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/parser/skeleton/standardBones.js": "qnIJe807T6Zep/NAk6ApD1zA6AqV/1XrqpCwGIzjxU64AurUTR4krGkazw36HKgB",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/parser/vmd/VmdMetadataParser.js": "QPo6I1ii0Rrj/au2omEgIrAnmJqXpizJWSY7oLPTLT1YeSMCxvUGkGmD4YaMa+83",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/parser/vmd/VmdParser.js": "HgcibYTYFVvaK554cHrtl69aWQJw0pBLD3iOM8Y60gvAMdYZ6WiEHUR2mh7gA9Ok",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/parser/vmd/index.js": "AB9m4J3knoPS4PyABG9Y8aMipJt8hw70kwahxJ0oRtq/3XaepQB60YqYHTtTuZcv",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/parser/vpd/VpdMetadataParser.js": "hX3Him6kVMZYbcAx/mY4aZPnskPDhbkOUsiWkGJ6UhsrLhhSE69Ux5hInkBtVodt",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/parser/vpd/VpdParser.js": "eE9MtWk5W8DonkkStGm3ctH0bSnKRoVgBXheJAkT8tM42Xi7v4TwFPLqQJDo/1Ee",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/parser/vpd/index.js": "Cs7SnnMXb5llk+8hjvbLiVojLUHxuRd3Gb2yAUnnHf2+VxQ1q+K19wmdoV+mn9Jo",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/parser/wasm/FallbackCore.js": "URe8VzwyQZ2HmnGjmsg6k+PjKIVP4fIWpw2mXYryTwkB+SMDB2PgRZmLa66YBQUS",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/parser/wasm/MmdAnimBackedCore.js": "IUbD9OZvR9qok9ZWyyujaduHWlsvtIQlXC8gb3fM4fufhtaGjMSEb2jWcxJ5urSI",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/parser/wasm/ParsedModel.js": "qdrMU3AKmOZVg+dhkkEFzUkcIRFBsqNG0cKlhSYsWXRgaXy4EcJ4ITLZPwX0Kfbq",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/parser/wasm/createParsedModel.js": "lUQ++jTAULjE/WR64k6f1CpMWIRc/YLJNyZhEqM8GcwMNJSZXBOq8pj7O3wGxmvV",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/parser/wasm/generated/mmd_anim_wasm.js": "323MEQNjrM52eXysnhS07h7cBYR8my520bw29dszMIfnKMvOWTcjPWJeXX0SBfCA",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/parser/wasm/generated/mmd_anim_wasm_bg.wasm": "n9EDMAlK5/lkkc2vZMQg4HvdD+epoPFNqRopsmL803iPQ5x0eTPiV964ObX5V1uZ",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/parser/wasm/index.js": "hxdAcazqdmoHclGeXPZF4I98cI3Gs/yrvm65cx6wrN+WpugcaEOoiFYadQXNk8W0",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/parser/wasm/modelMetadata.js": "AfDJf3woVF8BHeE3xHIhnYyqohLpKI6qUXBtaJ/2mAU2rp9dvvArPOyeMJrnHPdQ",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/physics/customBulletMmd.js": "qiOHNvyZDuqV0CVy2wk9i6CzFWjYSbt/qEg9eV5vsXgoOuDikTf9lTUPiOoP21M7",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/physics/index.js": "t8KiRIhUk4KtKgSkTj53wMDtlcTzD7UvLpGk35AfBnoNvkKnqJWLjfg9p+5CKeWX",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/physics/legacyPhysicsBridge.js": "v04s0r8JeUWLcBjYEmx+Bj2e5/t4t9AZH2v0nrUv+sezL0tHl4c5BzGRJvqOXnee",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/physics/mmdAnimBullet.js": "4kfJvI9ZwgYp/jpGmZiZDy4NqZJPwk5ZpfwA+y+GRV3EC63mHdzKn2rbBZhekMFc",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/runtime/animation.js": "9NZAptR8uH/Kpr4vgSRnzCQexwojRb+aEJptV4rWhEzREA1jWE71k/xuxtSM5qb2",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/runtime/append.js": "6yokXYrjzsbt+NWCliyzYBuvtS2QGYL2u4cyepV3C2Q3QleR1LfSZR6IKkgMa5Bx",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/runtime/core.js": "GziCD6p80TTTtVYszzp1D7m3Q7+NUm/qwZpuBzBsoiif5PqG7iOahA8wSyVzWU11",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/runtime/hostRigPhysics.js": "I9xYKCsWSDacCd+dOgnBw0kzF7Wp6m55Jq0ncnT6p9CsjJx18SkhQutfYlqnTuVU",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/runtime/ik-bridge.js": "JC2AxS3ehHTeS30MLoxJBEQWBmZymA8myBWXq9mOWGt5ISmIG3S5O2FAVe37rdbF",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/runtime/ik/CcdIkSolver.js": "kLOzEyQnBFkica8NAS7g6PCN0W8O976+R1YAGGsC4Tvo2jqntVdEPV19BLIIbcm8",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/runtime/ik/MmdIkChain.js": "UAT/In3jAb0Ig89tTNW8HmFi6hPFTAWnS/eUn9/Wb9pTOPXn+sku/9ytY+o6DnsA",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/runtime/ik/index.js": "Ll+BjrWpCXzvrxvVesuBFCcuHLQ5RJjeUVdfhwx3x83mdz/f7IgpQF1lUUaPVsA3",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/runtime/index.js": "PiZhvZBhdVOHxi4nx74pqWwaEZxgiYXlLzBcUwXlfyEiCHDIbMWjlQKN7xpBdwFT",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/runtime/math.js": "MiFzlaMi67gZ5HAx7fmA1/V0NzQBBY4mJFhPIG4xyHsWB5NtSdV8X29AjAj9OdlZ",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/runtime/mmdAnimRuntime.js": "tVDq38AzTdQqqX1a6kcRaF5ErBaN4HeRaAlAZVVjdD3I+SKXd6auGmXrDPxlA7VL",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/runtime/mmdAnimWasmParser.js": "1mBGsz9Qd3yCBJ/1ubYS2zLoDLZbpTcxtUd873sG4gf6wckEzNGwJVxAzmW8XO57",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/runtime/morphOverrides.js": "VCJzjQxq5z5pn5up7Kvek8DF5VAY57DNEuON7S65tIG5GV412UXyuCkdt1XYoMJ7",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/runtime/morphSplitSync.js": "TMSIdp6RARXN4ngG8YYMaHhzJmPpnXqEzddoW9uCTHgtKqk56Ssd3dqVWULkp8Bh",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/runtime/physics.js": "NQU7J8z/gzL3GHcRILK+4fSkv5bluVpsfKQlzm6zMThD/A7kwPJLDOMnS4XaFdkI",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/runtime/userData.js": "2GjMwUeiMjompzzwIspLXNaD12XL5cO/PnQn9WI5RkVEd/qsZvpyvcHxBJp/xPj5",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/three/assets.js": "25JY3N3Lf8yCWgDAuA3yllHO/oUnbfwpiQ1eqPKE9ZR1+dDwW2GNNC4b7JEhBwmt",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/three/assets/mmd/toon01.bmp": "2qOrpnRL4K2tp5Ep5F+L+8glE7jhuVF1TAktQqsIMLdwIh3SmKHLk0jMy22wazvI",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/three/assets/mmd/toon02.bmp": "wwsIV2WvVTAJJn/iJbtFLCMANDVJBdJN5DwR0p+FUTQk2tCE7myk+SGbSHiyUNav",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/three/assets/mmd/toon03.bmp": "T+rv7+9PWMixtgolXdjBHYzxUoC45IPbK5gLCX5zoIEo1HxIxEX8URbCjQ9+SvcE",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/three/assets/mmd/toon04.bmp": "wfZsoY7YAZUk1eJMxMKIaFs2F5q1BiKhderW9j/Wpa7FIZ0MRIg6+t4Gnj09zMSW",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/three/assets/mmd/toon05.bmp": "wSRWXIuh4bkzTtXmdKhBD0cIw+shxLAsW30VDc+jdZbD30WMG14VcmS0V31Heoiz",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/three/assets/mmd/toon06.bmp": "bv7nFXWYNh6jNhXNw3mUB9/umWyW4gmkpRMKI/sbA8x3tqqOMVyOjKIlDq5ntSM1",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/three/assets/mmd/toon07.bmp": "/4iqqsf7u4i9iy/l0tLmz6ho6XUS5yHddgL9dbJC1sbKwupanFP/xI/InGkcrGM+",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/three/assets/mmd/toon08.bmp": "/4iqqsf7u4i9iy/l0tLmz6ho6XUS5yHddgL9dbJC1sbKwupanFP/xI/InGkcrGM+",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/three/assets/mmd/toon09.bmp": "/4iqqsf7u4i9iy/l0tLmz6ho6XUS5yHddgL9dbJC1sbKwupanFP/xI/InGkcrGM+",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/three/assets/mmd/toon10.bmp": "/4iqqsf7u4i9iy/l0tLmz6ho6XUS5yHddgL9dbJC1sbKwupanFP/xI/InGkcrGM+",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/three/camera.js": "hFcbAykeDyrjRtDW+xFA1iIERpl/V2Ep1QnXXyJI8PswnnLS64whmLXZEGypQh7B",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/three/dispose.js": "EQ7QSJX0wrONwlB54dtU+1bV5T+5gNHeOCuFcR12Xs7z7liI0ZSsH7ulsAsvilpJ",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/three/folder.js": "sVeuCh4J8f+cN4/dvY3cNXbAiJQ78w96iIYLNI5XGiSkZmXwj0j+8uO2PKZRHj4J",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/three/geometry.js": "1O9i8QDS776nNb0c27zEY3KsbUFs/VYF48bwF9GVLkV8RT0JPTru8rqUYgEEIJci",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/three/index.js": "hjipyLKZj6OF4eDnfErrEQpUO1wOolvLEM6uPPLvf5AbT2qmeOguK0lx5E5slsm+",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/three/internal-morph-source.js": "qJZb/yrJEp2vsDLEp0qEDmlg4g6jcs6vGCwfftjhhPCwluj1sfvavRWxFOgZnI/G",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/three/internalModelData.js": "FdCqEshUFv85Nfj7FQDqs/GYbVYhUvhXn6qnzYUdwP1lMdtmuGDeAzkk1AvT/mCG",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/three/light.js": "xbiWRWFvHinPeRAHihEzmqsA9+sF67BWq06MXJ7DIwXpAvf/ArRvUCX9qq+7y3hQ",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/three/material/material-metadata.js": "1oPfBmXxb/U7HYntwtkuP2Oc1lOiUuoAtUrRDBYQkdGOWWto8tgCTH5QRKlQE2uq",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/three/material/material-qdef.js": "YcdgIZr7ZmU7fbDkvWXk2Wva4pAcnAvesf2o9suQ9ctwUBogG1uLC6slFLZbj89p",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/three/material/material-sdef.js": "nYueRlE4JGKmJp6elJItRvEAuuCVWd284JRWVuFDmOI4gBsZX/LlSh2oXrP8Jy0Z",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/three/material/material-shader-hooks.js": "vPTIJmuy7tP0A30zDrFiDurSokojRnTHF8j1FEIdxe234tVIy8H37Ql58KDmrbou",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/three/material/material-shadow.js": "erM1wWeyL5lTeORLVHQpmyUZCXlGUTlbk6D9Y7fCdZGK0COftpQnvyevy4b5mRbE",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/three/material/material-sync.js": "4THN+Z4wRL88WvLvnYEQrAIsqatIhH8h+tm7B0bvIhgEXL7JhcbRRruIgLzP6Lnw",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/three/material/material-texture-set.js": "u/TnwO6cunoaE/xGqIDFuHK0uf/yn+un46zUF7ZPwBc9DtBUJduMk8VGWZ89BdPe",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/three/materials.js": "ckI9Q9qWEw1/EnwMoy4emO1nm55Q4aWflA/JBnkfrjLrKhCuT9YwKR9rSpOR7t8Z",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/three/modelAssembly.js": "YOhg8yHGQvMyeghr/K7nuMD12n0vVCtV18FqKgu4vNbitjImt2h3CGz0Y5j1T8lC",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/three/modelSource.js": "yHmIapI/S2rFRKgdPTcUcLGa7F9NsqpfAANmn/fZ63PWDr8dpttQZ+mK/CrLlIWW",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/three/outline.js": "ti0VTgxcw1UYAXYUzjngySAb56pi+3EtIMw6KIdAwlKwX3TMlOv2N9nfGfQ60b6J",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/three/performance.js": "LG9tN4zw8be091nExwbkrKn+rhnQzMKM/IJp6TgcoQwsIRCD8YvC3xL/6o7Fu6DK",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/three/runtime-sync.js": "8OlroWzygOp0w3SOswd8tbC0dHGGdLb6N/4HYtUEhXBHwP7Bs/R/cHFpqZfVS+nx",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/three/shadow.js": "ySS7CUivfg2I5FrO5cZTS0z7qmYa2zkLT4aLeT6BWB2iWKJW2Oj6XIfPCwVHdp5N",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/three/skeleton.js": "oTVIcqJSJeif81A9ehu2k91zAoZ48zwMRPVTNY1aiJMBiQUmFs0TeVjKQdKeBmpK",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/three/textures.js": "4pTOdlGfF9DbjiVC0X8BPlKyhiEpz5cmLfoIm50F6EznO8gxJ6NXyWmjb5UnUdhD",
  "assets/vendor/@yohawing/three-mmd-loader@0.8.4/dist/three/utils.js": "Q8fKv9FMTizAcXZ9VRGMmsUcQysf+yUxKzdnYmD0RkVBOqoMcVmRp6BVzmcuQ2Rm",
  "assets/vendor/three@0.180.0/LICENSE": "YNsuLyd5utIGRg8x+dm9fQ6K3pcK5dQ3GooSZrlFnCUO8O/1hYiAjathJ56yE3HN",
  "assets/vendor/three@0.180.0/build/three.core.js": "r1q8Si7xFBrvMv3Q4yjQkKhkYZ2lp+wn/bPPzNZTsc8DY4uPJmm2vheuz1Yn+8m8",
  "assets/vendor/three@0.180.0/build/three.module.js": "wyxAlyAVVsyc7KN24a4+m1tMTC2BwrjQyLgLStDaUBDmwK+gWUMULWHSS0NRoZKv",
  "assets/vendor/three@0.180.0/examples/jsm/loaders/GLTFLoader.js": "s7nILfbc478eUC319/oD77M04rFg5QqywtMJEVMtUrlMIoGoUDSJ0gPPnLlw+bBy",
  "assets/vendor/three@0.180.0/examples/jsm/utils/BufferGeometryUtils.js": "Qy9m6qi71cTFsL476nB1aK+wPxxPgU6H6pn/++8gOgy4/vTtkDuFBfPo22hBhx36",
};
// END VENDOR PINS

self.addEventListener("install", event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE && key !== SHARE_CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

/* 🛡 セーフモード（?safe=1）のページでは、キャッシュしたアプリの殻を使いません。
   キャッシュはページ内で動くコード（アドオンなど）からも書けるため、汚染されたコピーを
   セーフモードで実行してしまわないようにするためです。通信できるときは今までどおりネットワーク優先、
   オフラインのときだけ「キャッシュを見ない」ぶん、安全側に倒します（§docs/SECURITY.md）。 */
const safeClients = new Set();
function safeWanted(url) {
  const params = new URLSearchParams(url.search);
  return params.has("safe") || params.has("safety") || String(url.hash || "").toLowerCase().includes("safe");
}

/* ハッシュ固定の vendor かどうか（SCOPE からの相対パスで判定し、VENDOR_PINS に載っているものだけ） */
function pinnedPath(url) {
  if (!url.pathname.startsWith(SCOPE.pathname)) return "";
  const rel = url.pathname.slice(SCOPE.pathname.length);
  return rel.startsWith(VENDOR_PREFIX) && Object.prototype.hasOwnProperty.call(VENDOR_PINS, rel) ? rel : "";
}

/* キャッシュの応答の本体が、固定された SHA-384 と一致するか。照合できない環境（暗号 API が無い等）は「一致しない」扱い */
async function pinnedMatches(response, rel) {
  try {
    if (!self.crypto || !self.crypto.subtle) return false;
    const digest = await self.crypto.subtle.digest("SHA-384", await response.clone().arrayBuffer());
    let binary = "";
    for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
    return btoa(binary) === VENDOR_PINS[rel];
  } catch {
    return false;
  }
}

/* 📥 share_target（trk165）：OSの共有シートはPOSTで届く（manifest.webmanifest の share_target）。
   ファイルは CacheStorage（trk-share-inbox-v1）に一時保存し、303でアプリ本体へ戻す。
   ページ側（js/share-inbox.js）が起動時に読んで、既存の取り込み経路（曲・CBZ・パック）へ渡す。
   検証も上限もすべて既存経路側＝ここは新しい入口を作らない。ファイルは端末から出さない。
   title/text/url のフィールドは無視する（trk! は外部リンクを取り込まない）。 */
async function handleShareTarget(request) {
  const home = new URL("index.html", SCOPE).href;
  try {
    const form = await request.formData();
    const files = [];
    for (const field of ["media", "packs", "books"]) {
      for (const value of form.getAll(field)) {
        /* FormData の値は文字列か File。File だけを拾う（instanceof は realm 差で外すことがあるので形で見分ける） */
        if (value && typeof value === "object" && typeof value.name === "string" && typeof value.size === "number") files.push(value);
      }
    }
    if (!files.length) return Response.redirect(`${home}?shared=empty`, 303);
    const cache = await caches.open(SHARE_CACHE);
    const stamp = Date.now();
    let saved = 0, failed = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const slot = new Request(new URL(`${SHARE_INBOX_PREFIX}${stamp}-${i}`, SCOPE).href);
        await cache.put(slot, new Response(file, { headers: {
          "Content-Type": file.type || "application/octet-stream",
          "X-Share-Name": encodeURIComponent(file.name)   /* ファイル名はヘッダーで運ぶ（URLに載せると壊れるため） */
        } }));
        saved++;
      } catch { failed++; }   /* 空き容量不足などは1件だけ失敗扱い（全体は止めない） */
    }
    return Response.redirect(`${home}?shared=${failed ? (saved ? "partial" : "error") : "1"}`, 303);
  } catch {
    return Response.redirect(`${home}?shared=error`, 303);
  }
}

self.addEventListener("fetch", event => {
  const request = event.request;
  /* 📥 share_target（trk165）：このパスへのPOSTだけ受け取る。ほかのPOSTは従来どおり関与しない */
  if (request.method === "POST") {
    const postUrl = new URL(request.url);
    if (postUrl.origin === SCOPE.origin && postUrl.pathname === SHARE_PATH) event.respondWith(handleShareTarget(request));
    return;
  }
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;

  /* ナビゲーションの要求では event.clientId は空（まだ無いページ）。そのページの id は resultingClientId にある */
  if (request.mode === "navigate" && safeWanted(url) && event.resultingClientId) safeClients.add(event.resultingClientId);
  /* 初回ナビゲーションでは clientId が空なので、URL 自体が safe を要求していればキャッシュを使わない */
  const safeClient = safeClients.has(event.clientId) || (request.mode === "navigate" && safeWanted(url));
  const pinned = pinnedPath(url);

  event.respondWith((async () => {
    /* セーフモードのクライアントは、固定された vendor でもキャッシュを読まない（F-19） */
    if (pinned && !safeClient) {
      try {
        const cache = await caches.open(CACHE);
        const hit = await cache.match(request);
        if (hit && await pinnedMatches(hit, pinned)) return hit;
      } catch { /* storage may be unavailable; go to the network */ }
    }
    try {
      /* Revalidate the browser's HTTP cache on each online request. CacheStorage remains the offline fallback. */
      const response = await fetch(request, { cache:"no-cache" });
      if (response.ok && response.type === "basic") {
        try {
          const cache = await caches.open(CACHE);
          await cache.put(request, response.clone());
        } catch { /* storage may be unavailable or full; the network response still works */ }
      }
      return response;
    } catch {
      if (safeClient) {
        return new Response("trk! is offline. Safe mode does not use the cached copy -- reconnect and reload.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      }
      const cached = await caches.match(request);
      /* 固定された vendor は、照合が合うものだけ（オフラインでも汚染されたコピーは返さない） */
      if (cached && (!pinned || await pinnedMatches(cached, pinned))) return cached;
      if (request.mode === "navigate") {
        const offlineHome = new URL("index.html", SCOPE).href;
        const fallback = await caches.match(offlineHome);
        if (fallback) return fallback;
      }
      return new Response("trk! is offline. Reconnect to load this file.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }
  })());
});
