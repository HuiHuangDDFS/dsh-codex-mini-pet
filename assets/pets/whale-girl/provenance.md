# Whale-girl asset generation

Generated with the built-in image_gen tool on 2026-10-16. An original blue-white whale-themed chibi mascot, inspired by the user's DeepSeek whale-girl direction; this is not a claim that it is official DeepSeek artwork. The state sheet and head-gaze sheet were generated separately. Only deterministic cropping, scaling, positioning, and atlas assembly were used afterwards; no poses were fabricated by drawing code.

## State sheet prompt

Use case: stylized-concept
Asset type: production 2D transparent animated desktop pet sprite atlas, an ORIGINAL blue-and-white DeepSeek-inspired whale-girl chibi mascot for an independent desktop application.
Primary request: draw ONE clean portrait sprite sheet, exactly 8 columns by 11 rows, regular equal-size cells. Requested canvas 1536 x 2288 pixels; cells 192 x 208 pixels. Transparent RGBA background, no drawn grid or labels. All figures fully contained in their own cells with generous clear gutters.
Character: adorable small chibi girl, 2.5 heads tall, huge clear blue eyes, short soft navy-blue bob hair with a pale white fringe, blue whale-shaped hood with tiny side fins, white and cobalt-blue sailor-style coat-dress, navy shorts, blue boots, a little curved whale tail accessory behind. Modest childlike mascot design, friendly face. Original visual identity, no copying a specific existing person's character, no logos, no letters. Crisp polished kawaii anime cel shading with dark navy outlines. Entire body visible. Keep costume, face, hair, scale and baseline consistent across EVERY frame. About 145 pixels tall in each 208-high cell, head-to-feet, alpha margins on every side.
ANIMATION GRID: Fill left-to-right in each row and top-to-bottom. Mandatory 11 rows; do not merge or omit rows. Empty unused cells must be fully transparent.
Row 1: exactly 6 frames idle front-facing breathing and blink loop. Cells 7,8 empty.
Row 2: exactly 8 frames walking to the RIGHT, right-facing side/three-quarter view, alternating legs and arm swing through a real walk cycle.
Row 3: exactly 8 frames walking to the LEFT, left-facing side/three-quarter view, alternating legs and arm swing through a real walk cycle.
Row 4: exactly 4 frames front-facing hello wave: hand rises, waves left, waves right, lowers. Cells 5-8 empty.
Row 5: exactly 5 frames joyful jump: crouched anticipation, rising arms raised, airborne apex with knees bent and BOTH ARMS UP, landing, settle. Cells 6-8 empty.
Row 6: exactly 8 frames sad failure/recovery: head lowered, eyes closed, shoulders slumped, crouch with hands on knees, tired expression, sigh, head raises, returns.
Row 7: exactly 6 frames waiting for response: attentive front view, hands clasped before body, side glance, blink, gentle thinking finger on cheek, hopeful look. Cells 7,8 empty.
Row 8: exactly 6 frames working: focused front three-quarter view holding a small navy tablet, tapping it, reading, blinking, tapping, focused finish. Cells 7,8 empty.
Row 9: exactly 6 frames reviewing result: front view holding a white paper, scanning it, head tilts, smiles, nods, satisfied. Cells 7,8 empty.
Row 10: exactly 8 gaze/head-look frames, fixed front-facing torso, only HEAD AND EYES looking around at directions in screen coordinates, ordered 0:right, 1:down-right shallow, 2:down-right diagonal, 3:down steep, 4:straight down, 5:down-left steep, 6:down-left diagonal, 7:down-left shallow. The head/eyes are aimed progressively clockwise.
Row 11: exactly 8 more gaze/head-look frames, fixed front torso, only HEAD AND EYES aimed 8:left, 9:up-left shallow, 10:up-left diagonal, 11:up-left steep, 12:straight up, 13:up-right steep, 14:up-right diagonal, 15:up-right shallow.
Constraints: 73 character poses total, no text, no watermark, no gradients behind the character, no checkerboard baked into pixels, genuine alpha. Strict even 8x11 cell geometry, no overlap of sprites across cell borders, no drop shadows outside cells, no separate extra hero portrait. All figures same size except deliberate jump height. Preserve clean visible hands, two arms, two legs per figure.

## Gaze sheet prompt

Use case: identity-preserve
Asset type: 16-direction HEAD GAZE sprite sheet, transparent, original chibi whale-girl desktop mascot.
Input image 1 is a CHARACTER IDENTITY REFERENCE, not a layout target. Keep precisely her blue whale hoodie, navy bob with white fringe, sailor coat-dress, blue boots, big blue eyes, whale tail, rendering and colors.
Generate a NEW 4 columns x 4 rows grid containing exactly 16 equally spaced full-body sprites on transparent background. All 16 bodies face FRONT with hands clasped under chin, shoulders level, feet on the same baseline. Only head and pupils change. We need OBVIOUS head tilts and pupil positions for mouse-following. Large eyes must visibly point to targets. Preserve consistent scale, head size, costume, two arms, two legs.
Grid order left to right:
Row1 cell1: head turned strongly RIGHT, eyes to right.
Row1 cell2: head right and chin slightly down, eyes right/down 22.5 degrees.
Row1 cell3: head tilted diagonal down-right, eyes lower-right 45 degrees.
Row1 cell4: chin substantially lowered, head slightly right, eyes down-right 67.5 degrees.
Row2 cell1: chin tucked strongly DOWN, eyes toward bottom, forehead exposed.
Row2 cell2: chin substantially lowered, head slightly left, eyes down-left 112.5 degrees.
Row2 cell3: head tilted diagonal down-left, eyes lower-left 135 degrees.
Row2 cell4: head left and chin slightly down, eyes left/down 157.5 degrees.
Row3 cell1: head turned strongly LEFT, eyes to left.
Row3 cell2: head left and chin slightly UP, eyes left/up 202.5 degrees.
Row3 cell3: head angled UP-LEFT, chin raised visibly, eyes upper-left 225 degrees.
Row3 cell4: chin raised strongly, head slightly left, eyes upper-left 247.5 degrees.
Row4 cell1: face looking strongly UP, chin and underside of face visible, eyes toward top of head, mouth lower on face.
Row4 cell2: chin raised strongly, head slightly right, eyes upper-right 292.5 degrees.
Row4 cell3: head angled UP-RIGHT, chin raised visibly, eyes upper-right 315 degrees.
Row4 cell4: head right and chin slightly up, eyes right/up 337.5 degrees.
CRITICAL: All heads must not face forward. Fully distinguish head looking down from head looking up. Do not turn torsos; these are head gaze directions, not body rotation. Transparent background, no labels, no numbers, no lines, no extra art. Exactly four rows and four columns. Generous clear gutters, every pose complete and not cropped.

## Assembly and visual limits

The first generation returned ten irregularly spaced rows rather than the requested eleven. Its content was mapped by visible pose: row 9 supplied six attentive waiting poses; rows 7 and 8 supplied working-with-tablet and reviewing-with-paper poses. Sixteen direction poses came from the second generation. The gaze source starts at screen-right; its whole poses were reordered so the final atlas follows the standard clockwise order: screen-up at 0, screen-right at 4, screen-down at 8, screen-left at 12 (final index i receives source index (i + 12) modulo 16). Each pose was cropped and assembled into an exact 8-by-11 1536-by-2288 RGBA atlas, with 192-by-208 cells. Unused cells are fully transparent. The first nine rows contain 6, 8, 8, 4, 5, 8, 6, 6, 6 frames, followed by two eight-frame gaze rows.

The failed row uses source columns 1, 2, 3, 6, 6, 3, 7, 8 (one-based) so that its loop remains subdued instead of including the source's broad smiling poses. Tight crops detect solid-character bounds while retaining the original RGBA pixels inside those crops. Frames were scaled consistently within each state and the jump frames were positioned along a short vertical arc.

These are AI-generated illustrations, with subtle costume/face/hand variation between frames. Movement is discrete rather than hand-drawn tween animation. Gaze directions are visual approximations; 22.5-degree measurements are ordering targets, not calibrated 3D head rotations. The wait row is a calm hands-clasped idle variation; failed and waiting states can appear similar at small scales. Gaze frames retain the costume but have a somewhat different head proportion than the action frames. The asset has been visually inspected and structurally checked, not certified as an exact reproduction of any upstream pet.

Structural QA passed: 73 occupied cells, every required pose at least 64 pixels wide and high, all 15 unused cells fully transparent, RGBA PNG under 20 MiB. Final SHA-256: `dfdbe6c6120b95e95ebc4e387cf742267dcc1cd06994fc87f6bde2813727d24d`. The full assembled atlas and a contact sheet covering all nine states plus four cardinal gaze directions were inspected, including a dark-background composite to verify clean transparent edges. The four final cardinal poses visibly look up (0), right (4), down (8), and left (12).

`LicenseRef-ProjectAsset` identifies this project-generated artwork separately from the code license; it makes no claim to an official DeepSeek license or affiliation. `preview.png` is a resized preview of the first frame for the selector.
