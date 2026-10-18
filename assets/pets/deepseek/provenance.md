# deepseek default pet

Created for dsh-codex-mini-pet on 2026-10-18 from the user's character-design sheet (`codex-clipboard-11485148-6e9c-46ec-b9e1-9ada19211cd3.jpg`, SHA-256 `9d85b3da1eec644b294716da49c01cb09935f7f410c6442f87cad3b7cf4978c0`). It depicts a blue-haired chibi whale girl in a navy-and-white maid outfit, with whale details, a long tail, and front, side, back, and expression views.

The art was generated with the built-in `image_gen` tool. This run did not return a verifiable model-version identifier. The art is an AI-generated adaptation of the user-provided design, not official DeepSeek artwork or a claim of endorsement. `LicenseRef-ProjectAsset` distinguishes this art from the code's MIT license; it does not grant rights in the external reference sheet.

## Pose sources and redraw

The initial action sheet (`exec-83ab8dfa-41fc-430d-80c9-ec0ed33ddfd3.png`, SHA-256 `b35a19513f65d9c21dd37517e2b821b245490482f8e8c68620724ca54a27ff2b`) provided the nine state sequences. The initial gaze sheet (`exec-3c7e8729-9630-4914-90a3-1133cf41c91e.png`, SHA-256 `e0b7be3ce606e76db35aad24f5a09b0f9a45e2359ef2e134d9d02885a1840475`) provided sixteen head-and-eye directions.

The generated action sheet did not follow exact equal cell boundaries. Splitting it into equal rectangles clipped parts of shoes, hair, and tails. The repair detects each complete character across the whole source image before fitting it into a runtime cell. Alpha below 32 contains connected blue noise; the extractor uses the opaque character domains plus the nearest two-pixel antialias fringe. Regression tests cover irregular positions, characters crossing nominal grid lines, low-alpha bridges, and transparent edges.

After the full silhouettes were recovered, five additional image_gen edits redrew all 73 poses at higher detail. Inputs were the original character sheet and pose matrices containing 16, 16, 16, 9, and 16 figures. Pose order, expressions, clothing, gaze, and left/right directions were preserved. Requested canvases were 2048 square; the actual returned sheets are 1254 square. The redrawn figures are approximately 229–381 pixels tall before packing, compared with roughly 128–160 pixels in the original action source. Both delivered atlases use the new redrawn poses.

The generation prompt templates and their batch parameters are recorded in [hd-prompts.md](hd-prompts.md). The five final generation digests and dimensions are in `pet.json` under `source.highResolutionGenerations` and in `packing.json`.

## Atlas packing and display

`scripts/assemble-deepseek-hd.mjs` extracts complete character components without assuming uniform source cell boundaries. Source components touching the image edge are rejected. Each animation uses a consistent fitting scale and baseline; jumping has additional vertical room. Packing never crops a figure to make it fit.

- Standard atlas: `spritesheet.png`, 1536 × 2288, 192 × 208 cells, at least 12 pixels of transparent safety margin.
- Display atlas: `spritesheet-2x.png`, 3072 × 4576, 384 × 416 cells, at least 24 pixels of safety margin.
- Both contain 73 frames in row counts `6,8,8,4,5,8,6,6,6,8,8`; the remaining cells are transparent.
- Gaze order is clockwise in screen coordinates: up at 0, right at 4, down at 8, and left at 12.

The interface and Windows companion load the 2× atlas at the existing logical pet size. ZIP export uses the standard atlas to preserve the Codex v2 import/export contract. The standard PNG is downsampled from the display atlas, so both have identical poses and cell positions. `preview.png` is the first high-resolution cell.

All poses were inspected on a dark background, including the formerly clipped frames and the four cardinal gaze directions. The standard atlas passes structural validation, and packing checks enforce all transparent safety margins. The display PNG is below the 20 MiB desktop delivery budget. These are discrete AI-generated illustrations; fine costume details can vary between poses and gaze angles are visual approximations.

Standard SHA-256: `689c6660df0a4d44d2f482e9826ab96da3245812b7766a842cc1c4a8a846e47a`.

Display SHA-256: `a60d6726fde21d825a0b4e40adcd2a675f1642d67bb52b3a2eab1f8cb13b7020`.
