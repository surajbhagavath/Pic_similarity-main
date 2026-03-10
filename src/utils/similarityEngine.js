import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as mobilenet from '@tensorflow-models/mobilenet';
import pixelmatch from 'pixelmatch';

let objectModel = null;
let featureModel = null;

// Load Models
export const loadModel = async () => {
    try {
        console.log("Loading models...");
        if (!objectModel) objectModel = await cocoSsd.load();
        if (!featureModel) featureModel = await mobilenet.load({ version: 2, alpha: 1.0 });
        console.log("Models loaded successfully");
        return true;
    } catch (error) {
        console.error("Failed to load models:", error);
        throw error;
    }
};

// 1. MobileNet Deep Features (Content/Texture)
const getDeepFeatures = async (imageElement) => {
    if (!featureModel) await loadModel();

    const logits = tf.tidy(() => {
        const img = tf.browser.fromPixels(imageElement);
        const processed = tf.image
            .resizeBilinear(img, [224, 224])
            .toFloat()
            .div(255)
            .expandDims(0);

        return featureModel.infer(processed, true);
    });

    const vector = await logits.data();
    logits.dispose();
    return vector;
};

// Cosine Similarity for Vectors
const cosineSimilarity = (vecA, vecB) => {
    const dotProduct = tf.tidy(() => {
        const a = tf.tensor1d(vecA);
        const b = tf.tensor1d(vecB);
        return tf.sum(tf.mul(a, b)).dataSync()[0];
    });

    const magnitudeA = Math.sqrt(vecA.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, val) => sum + val * val, 0));

    if (magnitudeA === 0 || magnitudeB === 0) return 0;

    return dotProduct / (magnitudeA * magnitudeB);
};

// 2. Global Color Histogram
const getHistogram = (imageElement) => {
    const canvas = document.createElement('canvas');
    canvas.width = imageElement.naturalWidth || imageElement.width;
    canvas.height = imageElement.naturalHeight || imageElement.height;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);

    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    const histogram = {
        r: new Array(256).fill(0),
        g: new Array(256).fill(0),
        b: new Array(256).fill(0)
    };

    const totalPixels = data.length / 4;

    for (let i = 0; i < data.length; i += 4) {
        if (i % 16 !== 0) continue;

        histogram.r[data[i]]++;
        histogram.g[data[i + 1]]++;
        histogram.b[data[i + 2]]++;
    }

    const normalize = (arr) => arr.map(v => v / (totalPixels / 4));

    return {
        r: normalize(histogram.r),
        g: normalize(histogram.g),
        b: normalize(histogram.b)
    };
};

const histogramIntersection = (hist1, hist2) => {
    let intersection = 0;

    for (let c of ['r', 'g', 'b']) {
        for (let i = 0; i < 256; i++) {
            intersection += Math.min(hist1[c][i], hist2[c][i]);
        }
    }

    return intersection / 3;
};

// 3. Object Detection
export const detectObjects = async (imageElement) => {
    if (!objectModel) await loadModel();
    return await objectModel.detect(imageElement);
};

// Extract dominant color from bounding box
export const extractColor = (imageElement, bbox) => {
    const [x, y, width, height] = bbox;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(imageElement, x, y, width, height, 0, 0, width, height);

    const imageData = ctx.getImageData(0, 0, width, height).data;

    let r = 0, g = 0, b = 0, count = 0;

    for (let i = 0; i < imageData.length; i += 4) {
        r += imageData[i];
        g += imageData[i + 1];
        b += imageData[i + 2];
        count++;
    }

    if (count === 0) return { r: 0, g: 0, b: 0 };

    return {
        r: Math.round(r / count),
        g: Math.round(g / count),
        b: Math.round(b / count)
    };
};

// Pixel Differences + Clustering
const computeDifferences = (img1, img2) => {

    const width = 500;
    const scale1 = width / img1.naturalWidth;
    const height1 = Math.round(img1.naturalHeight * scale1);

    const canvas1 = document.createElement('canvas');
    canvas1.width = width;
    canvas1.height = height1;
    const ctx1 = canvas1.getContext('2d');
    ctx1.drawImage(img1, 0, 0, width, height1);

    const canvas2 = document.createElement('canvas');
    canvas2.width = width;
    canvas2.height = height1;
    const ctx2 = canvas2.getContext('2d');
    ctx2.drawImage(img2, 0, 0, width, height1);

    const data1 = ctx1.getImageData(0, 0, width, height1).data;
    const data2 = ctx2.getImageData(0, 0, width, height1).data;

    const diffCanvas = document.createElement('canvas');
    diffCanvas.width = width;
    diffCanvas.height = height1;
    const diffCtx = diffCanvas.getContext('2d');
    const diffData = diffCtx.createImageData(width, height1);

    pixelmatch(data1, data2, diffData.data, width, height1, { threshold: 0.1 });

    const gridSize = 32;
    const cellW = width / gridSize;
    const cellH = height1 / gridSize;

    const cellCounts = [];

    for (let gy = 0; gy < gridSize; gy++) {
        for (let gx = 0; gx < gridSize; gx++) {

            let count = 0;

            const startX = Math.floor(gx * cellW);
            const startY = Math.floor(gy * cellH);
            const endX = Math.floor((gx + 1) * cellW);
            const endY = Math.floor((gy + 1) * cellH);

            for (let y = startY; y < endY; y++) {
                for (let x = startX; x < endX; x++) {

                    const idx = (y * width + x) * 4;

                    if (
                        diffData.data[idx] === 255 &&
                        diffData.data[idx + 1] === 0 &&
                        diffData.data[idx + 2] === 0
                    ) {
                        count++;
                    }
                }
            }

            if (count > (cellW * cellH * 0.05)) {
                cellCounts.push({
                    x: startX + cellW / 2,
                    y: startY + cellH / 2,
                    w: cellW,
                    h: cellH
                });
            }
        }
    }

    const finalScaleX = img2.naturalWidth / width;
    const finalScaleY = img2.naturalHeight / height1;

    return cellCounts.map(c => ({
        x: c.x * finalScaleX,
        y: c.y * finalScaleY,
        radius: Math.max(c.w * finalScaleX, c.h * finalScaleY) / 1.5
    }));
};

// MAIN SIMILARITY FUNCTION
export const calculateSimilarity = async (results1, results2, image1, image2) => {

    console.log("Starting similarity calculation...");

    try {

        // Deep Features
        const features1 = await getDeepFeatures(image1);
        const features2 = await getDeepFeatures(image2);

        const deepScore = cosineSimilarity(features1, features2);
        console.log("Deep Score:", deepScore);

        // Histogram
        const hist1 = getHistogram(image1);
        const hist2 = getHistogram(image2);

        const histScore = histogramIntersection(hist1, hist2);
        console.log("Histogram Score:", histScore);

        // Pixel Differences
        const diffCircles = computeDifferences(image1, image2);
        console.log("Diff Circles:", diffCircles.length);

        // Objects
        const enrich = (results, img) =>
            results.map(pred => ({
                ...pred,
                color: extractColor(img, pred.bbox)
            }));

        const data1 = enrich(results1 || [], image1);
        const data2 = enrich(results2 || [], image2);

        const classes1 = new Set(data1.map(d => d.class));
        const classes2 = new Set(data2.map(d => d.class));

        const intersection = new Set([...classes1].filter(x => classes2.has(x)));
        const union = new Set([...classes1, ...classes2]);

        const objectScore =
            union.size === 0
                ? (deepScore > 0.8 ? 1 : 0)
                : intersection.size / union.size;

        // Final Score: based on pixel differences (0 diffs = 100, max 1024 diffs = 0)
        const MAX_DIFF_CELLS = 1024; // 32x32 grid
        const finalScore = parseFloat(
            ((1 - diffCircles.length / MAX_DIFF_CELLS) * 100).toFixed(4)
        );

        return {
            score: finalScore,
            deepScore: Math.round(deepScore * 100),
            objectScore: Math.round(objectScore * 100),
            colorScore: Math.round(histScore * 100),
            diffCircles: diffCircles,
            details: {
                objects1: data1,
                objects2: data2,
                commonClasses: [...intersection]
            }
        };

    } catch (e) {
        console.error("Error in calculateSimilarity:", e);
        throw e;
    }
};