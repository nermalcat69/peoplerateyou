// Ported from FaceX's align.js (github.com/facex-engine/facex, Apache 2.0).
// Pure geometry — a similarity-transform warp to the standard ArcFace
// 112x112 reference frame — so unlike the embedding models, there's no
// licensing ambiguity here: nothing but arithmetic, and no model weights.
// facex_nano.onnx expects its input pre-aligned to this exact frame.

const REF_POINTS: [number, number][] = [
	[38.2946, 51.6963], // left eye
	[73.5318, 51.5014], // right eye
	[56.0252, 71.7366], // nose
	[41.5493, 92.3655], // left mouth corner
	[70.7299, 92.2041], // right mouth corner
];

const OUTPUT_SIZE = 112;

function similarityTransform(src: [number, number][], dst: [number, number][]) {
	const n = src.length;
	let sx = 0;
	let sy = 0;
	let dx = 0;
	let dy = 0;
	for (let i = 0; i < n; i++) {
		sx += src[i][0];
		sy += src[i][1];
		dx += dst[i][0];
		dy += dst[i][1];
	}
	sx /= n;
	sy /= n;
	dx /= n;
	dy /= n;

	let num1 = 0;
	let num2 = 0;
	let den = 0;
	for (let i = 0; i < n; i++) {
		const sxc = src[i][0] - sx;
		const syc = src[i][1] - sy;
		const dxc = dst[i][0] - dx;
		const dyc = dst[i][1] - dy;
		num1 += dxc * sxc + dyc * syc;
		num2 += dxc * syc - dyc * sxc;
		den += sxc * sxc + syc * syc;
	}

	const a = num1 / den;
	const b = num2 / den;
	const tx = dx - a * sx + b * sy;
	const ty = dy - b * sx - a * sy;
	return { a, b, tx, ty };
}

// Warps the source canvas to a 112x112 ArcFace-aligned crop using the 5
// keypoints (left eye, right eye, nose, left mouth corner, right mouth
// corner), in that order, in source-image pixel coordinates.
export function alignFace(
	srcCtx: CanvasRenderingContext2D,
	srcW: number,
	srcH: number,
	kps: [number, number][],
	dstCtx: CanvasRenderingContext2D,
): ImageData {
	const { a, b, tx, ty } = similarityTransform(kps, REF_POINTS);

	// Invert the transform: for each destination pixel, find the source pixel.
	const det = a * a + b * b;
	const ai = a / det;
	const bi = b / det;
	const txi = -(ai * tx + bi * ty);
	const tyi = bi * tx - ai * ty;

	const srcData = srcCtx.getImageData(0, 0, srcW, srcH);
	const dstData = dstCtx.createImageData(OUTPUT_SIZE, OUTPUT_SIZE);
	const src = srcData.data;
	const dst = dstData.data;

	for (let dy = 0; dy < OUTPUT_SIZE; dy++) {
		for (let dx = 0; dx < OUTPUT_SIZE; dx++) {
			const sx = ai * dx - bi * dy + txi;
			const sy = bi * dx + ai * dy + tyi;

			const x0 = Math.floor(sx);
			const y0 = Math.floor(sy);
			const x1 = x0 + 1;
			const y1 = y0 + 1;
			const fx = sx - x0;
			const fy = sy - y0;

			if (x0 >= 0 && x1 < srcW && y0 >= 0 && y1 < srcH) {
				const i00 = (y0 * srcW + x0) * 4;
				const i10 = (y0 * srcW + x1) * 4;
				const i01 = (y1 * srcW + x0) * 4;
				const i11 = (y1 * srcW + x1) * 4;
				const di = (dy * OUTPUT_SIZE + dx) * 4;

				for (let c = 0; c < 3; c++) {
					dst[di + c] = Math.round(
						src[i00 + c] * (1 - fx) * (1 - fy) +
							src[i10 + c] * fx * (1 - fy) +
							src[i01 + c] * (1 - fx) * fy +
							src[i11 + c] * fx * fy,
					);
				}
				dst[di + 3] = 255;
			}
		}
	}

	dstCtx.putImageData(dstData, 0, 0);
	return dstData;
}
