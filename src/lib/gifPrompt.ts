/**
 * GIF 生成提示词（融合版）
 * 移植自 nova-image-studio gif-prompt.ts：网格布局模板 + 一致性约束。
 */

export type GifLoopMode = 'linear' | 'loop'

const STRUCTURE_PREFIX = `Create a strict animation sprite sheet, not a labeled contact sheet.

Canvas: exactly 3264x2448 pixels.
Grid: exactly 4 columns and 3 rows, 12 panels total.
Each panel: exactly 816x816 pixels, square, edge-to-edge.
Panel order: left to right, top to bottom: row 1 = frames 1-4, row 2 = frames 5-8, row 3 = frames 9-12.

The grid must fill the entire canvas. No outer margin, no gutters, no spacing between panels, no rounded panels, no borders, no separators, no labels, no frame numbers, no text, no watermark, no annotations.
Each panel contains exactly one frame of the same animation sequence.
Keep the subject fully inside each 816x816 panel and centered on a stable anchor point.`;

const TEMPLATE_LOGIC =
  'The first uploaded image is a layout template only: use it strictly to determine the 4x3 panel boundaries and panel sizes. Do not copy any visible guide lines, grid strokes, labels, numbers, colors, borders, frames, watermarks, or any other template artifacts into the final image.';

const REF_LOGIC =
  'Use the remaining uploaded images only as visual references for character identity, outfit, color palette, object design, and rendering style. If a reference image is not square, treat it as if center-cropped to a 1:1 square. Do not reuse the reference background composition unless explicitly requested.';

const STYLE_LOGIC = `Maintain strict identity consistency across all 12 frames: same character, same outfit, same colors, same proportions, same object design, same camera angle, same lighting, same background, and same rendering style.

Only the intended animation motion may change between frames. Motion between adjacent frames must be small, gradual, and evenly spaced. Avoid sudden jumps, scale changes, camera movement, perspective changes, pose resets, duplicated unrelated characters, changing accessories, or changes in background layout. The subject anchor point and overall scale must stay stable across the whole sheet.`;

const NON_LOOP_LOGIC = `This is a linear 12-frame animation storyboard.
Frame 1 is the clear starting pose, frame 12 is the natural ending pose.
The transition between every adjacent frame must be smooth and gradual, with the same small motion step size.`;

const CLOSED_LOOP_LOGIC = `This is a seamless closed-loop animation.
Frames 1-12 represent evenly spaced phases of one continuous cycle.
Frame 12 must transition smoothly back to frame 1 with the same small motion step as all other adjacent frames.
Do not make frame 12 a static duplicate of frame 1; frame 12 should be the natural frame immediately before frame 1 in the loop.
The subject anchor point, scale, identity, lighting, and background must remain stable across the loop seam.`;

export function buildGifPrompt(userPrompt: string, refImageCount: number, loopMode: GifLoopMode): string {
  const parts: string[] = [STRUCTURE_PREFIX]
  if (refImageCount > 0) {
    parts.push(TEMPLATE_LOGIC, REF_LOGIC)
  }
  parts.push(STYLE_LOGIC, loopMode === 'loop' ? CLOSED_LOOP_LOGIC : NON_LOOP_LOGIC)
  parts.push(`User request for the animation: ${userPrompt}`)
  return parts.join('\n\n')
}
