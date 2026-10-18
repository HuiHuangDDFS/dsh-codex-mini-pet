# High-resolution redraw prompts

Tool: built-in `image_gen`, transparent background enabled, 2026-10-18. Each edit uses the user-provided design sheet as image 1 and a complete-pose matrix as image 2. Requested dimensions describe the prompt; actual outputs are recorded separately in `pet.json`.

## Batches actions-1 and actions-2

```text
Use case: identity-preserve.
Asset type: HIGH DEFINITION transparent animation sprite sheet for the desktop companion named deepseek.
Input image 1 is the authoritative CHARACTER DESIGN reference (blue-haired whale maid). Input image 2 is the EDIT TARGET defining the exact poses, expression, camera direction, ordering, and grid layout.
Re-render input image 2 at a genuinely higher drawing resolution: requested final canvas 2048 x 2048 pixels, exactly 4 columns by 4 rows, 16 complete sprites. Each sprite should be about 360-400 pixels tall within its 512 x 512 cell. Redraw crisp fine navy linework, hair strands, clear eyes and pupils, apron frills, hands, and shoe details using image 1. This is a clean high-resolution redraw, not a blurred enlargement.
Preserve the same cute chibi proportions, cobalt long hair fading to lighter blue tips, big blue eyes, white maid headband, little blue hair bow, navy and white maid dress, whale apron emblem, black shoes, and dark blue whale tail. Preserve each individual pose and expression from input 2 in its same cell, including left/right facing direction. Exactly two arms and two legs in every pose. Keep consistent character size and costume throughout.
CRITICAL FOR PACKING: generous fully transparent clear gutters around each whole character. ALL hair, hands, shoes and the complete whale tail must be visible and strictly inside their cell, at least 40 pixels from every cell edge. Separate neighboring sprites completely. Do not let sprites touch or overlap. Do not crop a silhouette at a straight horizontal/vertical line.
Genuine transparent RGBA background. No text, no numbers, no labels, no grid lines, no background, no checkerboard, no cast shadow, no extra portrait. Keep the original pose matrix exactly.
```

## Batches actions-3, actions-4, and gaze

The template below was instantiated with these parameters:

| Batch | Count | Columns / rows | Pose constraint |
| --- | --- | --- | --- |
| actions-3 | 16 | 4 / 4 | Preserve the gestures, arms, legs, sitting/standing poses and held tablet or white paper in each cell. |
| actions-4 | 9 | 3 / 3 | Preserve the gestures, arms, legs, sitting/standing poses and held tablet or white paper in each cell. |
| gaze | 16 | 4 / 4 | This is a 16-direction gaze matrix; preserve the different head-and-pupil directions in every cell. Do not replace them with identical forward-looking poses. Keep torso pose stable. |

```text
Use case: identity-preserve.
Asset type: HIGH DEFINITION transparent sprite sheet for the desktop companion deepseek.
Input image 1 is the CHARACTER DESIGN reference. Input image 2 is the EDIT TARGET, which fixes each pose, expression, gaze, cell position and ordering.
Re-render the second image at a genuinely higher drawing resolution. Requested canvas 2048 x 2048, exactly {columns} columns by {columns} rows containing exactly {count} separate complete sprites. Each sprite must occupy about 75% of cell height, so every character has hundreds of pixels of crisp original detail. Redraw sharp clean navy outlines, clear glossy blue eyes and distinct pupils, fine blue hair strands, apron frills and lace, visible hands, complete shoes, and the entire whale tail. Not a blurry upscale.
Keep the cute chibi girl from input 1: long deep-blue hair with pale-blue tips, huge blue eyes, white maid headband, small blue hair bow, dark navy and white maid dress with whale emblem on apron, black shoes and dark-blue whale tail. Keep consistent costume, chibi proportions and size. Strictly preserve each pose and expression from input 2 in the same cell. {pose constraint}
Every character must be fully visible with generous empty transparent gutters. ALL hair tips, hands, shoes and tail tips must stay at least 40 pixels inside their own cell borders. Never crop characters, never overlap neighboring figures. Two arms and two legs, clean anatomy.
Genuine transparent RGBA background. No labels, numbers, text, drawn grid, checkerboard, background, shadows, watermark or extra portrait.
```
