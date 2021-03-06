import paper from '@scratch/paper';
import log from '../log/log';
import {artBoardWidth, artBoardHeight, getCenter} from './view';
import {isGroupItem} from './item';

const CROSSHAIR_SIZE = 16;
const CROSSHAIR_FULL_OPACITY = 0.75;

const _getLayer = function (layerString) {
    for (const layer of paper.project.layers) {
        if (layer.data && layer.data[layerString]) {
            return layer;
        }
    }
};

const _getPaintingLayer = function () {
    return _getLayer('isPaintingLayer');
};

/**
 * Creates a canvas with width and height matching the art board size.
 * @param {?number} width Width of the canvas. Defaults to artBoardWidth().
 * @param {?number} height Height of the canvas. Defaults to artBoardHeight().
 * @return {HTMLCanvasElement} the canvas
 */
const createCanvas = function (width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width ? width : artBoardWidth();
    canvas.height = height ? height : artBoardHeight();
    canvas.getContext('2d').imageSmoothingEnabled = false;
    return canvas;
};

const clearRaster = function () {
    const layer = _getLayer('isRasterLayer');
    layer.removeChildren();

    // Generate blank raster
    const raster = new paper.Raster(createCanvas());
    raster.canvas.getContext('2d').imageSmoothingEnabled = false;
    raster.parent = layer;
    raster.guide = true;
    raster.locked = true;
    raster.position = new paper.Point(artBoardWidth() / 2, artBoardHeight() / 2);
};

const getRaster = function () {
    const layer = _getLayer('isRasterLayer');
    // Generate blank raster
    if (layer.children.length === 0) {
        clearRaster();
    }
    return _getLayer('isRasterLayer').children[0];
};

const getDragCrosshairLayer = function () {
    return _getLayer('isDragCrosshairLayer');
};

const getBackgroundGuideLayer = function () {
    return _getLayer('isBackgroundGuideLayer');
};

const _makeGuideLayer = function () {
    const guideLayer = new paper.Layer();
    guideLayer.data.isGuideLayer = true;
    return guideLayer;
};

const getGuideLayer = function () {
    let layer = _getLayer('isGuideLayer');
    if (!layer) {
        layer = _makeGuideLayer();
        _getPaintingLayer().activate();
    }
    return layer;
};

const setGuideItem = function (item) {
    item.locked = true;
    item.guide = true;
    if (isGroupItem(item)) {
        for (let i = 0; i < item.children.length; i++) {
            setGuideItem(item.children[i]);
        }
    }
};

/**
 * Removes the guide layers, e.g. for purposes of exporting the image. Must call showGuideLayers to re-add them.
 * @param {boolean} includeRaster true if the raster layer should also be hidden
 * @return {object} an object of the removed layers, which should be passed to showGuideLayers to re-add them.
 */
const hideGuideLayers = function (includeRaster) {
    const backgroundGuideLayer = getBackgroundGuideLayer();
    const dragCrosshairLayer = getDragCrosshairLayer();
    const guideLayer = getGuideLayer();
    dragCrosshairLayer.remove();
    guideLayer.remove();
    backgroundGuideLayer.remove();
    let rasterLayer;
    if (includeRaster) {
        rasterLayer = _getLayer('isRasterLayer');
        rasterLayer.remove();
    }
    return {
        dragCrosshairLayer: dragCrosshairLayer,
        guideLayer: guideLayer,
        backgroundGuideLayer: backgroundGuideLayer,
        rasterLayer: rasterLayer
    };
};

/**
 * Add back the guide layers removed by calling hideGuideLayers. This must be done before any editing operations are
 * taken in the paint editor.
 * @param {!object} guideLayers object of the removed layers, which was returned by hideGuideLayers
 */
const showGuideLayers = function (guideLayers) {
    const backgroundGuideLayer = guideLayers.backgroundGuideLayer;
    const dragCrosshairLayer = guideLayers.dragCrosshairLayer;
    const guideLayer = guideLayers.guideLayer;
    const rasterLayer = guideLayers.rasterLayer;
    if (rasterLayer && !rasterLayer.index) {
        paper.project.addLayer(rasterLayer);
        rasterLayer.sendToBack();
    }
    if (!backgroundGuideLayer.index) {
        paper.project.addLayer(backgroundGuideLayer);
        backgroundGuideLayer.sendToBack();
    }
    if (!dragCrosshairLayer.index) {
        paper.project.addLayer(dragCrosshairLayer);
        dragCrosshairLayer.bringToFront();
    }
    if (!guideLayer.index) {
        paper.project.addLayer(guideLayer);
        guideLayer.bringToFront();
    }
    if (paper.project.activeLayer !== _getPaintingLayer()) {
        log.error(`Wrong active layer`);
        log.error(paper.project.activeLayer.data);
    }
};

const _makePaintingLayer = function () {
    const paintingLayer = new paper.Layer();
    paintingLayer.data.isPaintingLayer = true;
    return paintingLayer;
};

const _makeRasterLayer = function () {
    const rasterLayer = new paper.Layer();
    rasterLayer.data.isRasterLayer = true;
    clearRaster();
    return rasterLayer;
};

const _makeBackgroundPaper = function (width, height, color) {
    // creates a checkerboard path of width * height squares in color on white
    let x = 0;
    let y = 0;
    const pathPoints = [];
    while (x < width) {
        pathPoints.push(new paper.Point(x, y));
        x++;
        pathPoints.push(new paper.Point(x, y));
        y = y === 0 ? height : 0;
    }
    y = height - 1;
    x = width;
    while (y > 0) {
        pathPoints.push(new paper.Point(x, y));
        x = (x === 0 ? width : 0);
        pathPoints.push(new paper.Point(x, y));
        y--;
    }
    const vRect = new paper.Shape.Rectangle(new paper.Point(0, 0), new paper.Point(width, height));
    vRect.fillColor = '#fff';
    vRect.guide = true;
    vRect.locked = true;
    const vPath = new paper.Path(pathPoints);
    vPath.fillRule = 'evenodd';
    vPath.fillColor = color;
    vPath.guide = true;
    vPath.locked = true;
    const vGroup = new paper.Group([vRect, vPath]);
    return vGroup;
};

// Helper function for drawing a crosshair
const _makeCrosshair = function (opacity, parent) {
    const crosshair = new paper.Group();

    const vLine2 = new paper.Path.Line(new paper.Point(0, -7), new paper.Point(0, 7));
    vLine2.strokeWidth = 6;
    vLine2.strokeColor = 'white';
    vLine2.strokeCap = 'round';
    crosshair.addChild(vLine2);
    const hLine2 = new paper.Path.Line(new paper.Point(-7, 0), new paper.Point(7, 0));
    hLine2.strokeWidth = 6;
    hLine2.strokeColor = 'white';
    hLine2.strokeCap = 'round';
    crosshair.addChild(hLine2);
    const circle2 = new paper.Shape.Circle(new paper.Point(0, 0), 5.5);
    circle2.strokeWidth = 6;
    circle2.strokeColor = 'white';
    crosshair.addChild(circle2);

    const vLine = new paper.Path.Line(new paper.Point(0, -7), new paper.Point(0, 7));
    vLine.strokeWidth = 2;
    vLine.strokeColor = 'black';
    vLine.strokeCap = 'round';
    crosshair.addChild(vLine);
    const hLine = new paper.Path.Line(new paper.Point(-7, 0), new paper.Point(7, 0));
    hLine.strokeWidth = 2;
    hLine.strokeColor = 'black';
    hLine.strokeCap = 'round';
    crosshair.addChild(hLine);
    const circle = new paper.Shape.Circle(new paper.Point(0, 0), 5.5);
    circle.strokeWidth = 2;
    circle.strokeColor = 'black';
    crosshair.addChild(circle);

    setGuideItem(crosshair);
    crosshair.position = getCenter();
    crosshair.opacity = opacity;
    crosshair.parent = parent;
    crosshair.applyMatrix = false;
    parent.dragCrosshair = crosshair;
    crosshair.scale(CROSSHAIR_SIZE / crosshair.bounds.width / paper.view.zoom);

};

const _makeDragCrosshairLayer = function () {
    const dragCrosshairLayer = new paper.Layer();
    _makeCrosshair(CROSSHAIR_FULL_OPACITY, dragCrosshairLayer);
    dragCrosshairLayer.data.isDragCrosshairLayer = true;
    dragCrosshairLayer.visible = false;
    return dragCrosshairLayer;
};

const _makeBackgroundGuideLayer = function () {
    const guideLayer = new paper.Layer();
    guideLayer.locked = true;

    const vBackground = _makeBackgroundPaper(artBoardWidth() / 8, artBoardHeight() / 8, '#E5E5E5');
    vBackground.position = new paper.Point(artBoardWidth() / 2, artBoardHeight() / 2);
    vBackground.scaling = new paper.Point(8, 8);
    vBackground.guide = true;
    vBackground.locked = true;

    _makeCrosshair(0.16, guideLayer);

    guideLayer.data.isBackgroundGuideLayer = true;
    return guideLayer;
};

const setupLayers = function () {
    const backgroundGuideLayer = _makeBackgroundGuideLayer();
    _makeRasterLayer();
    const paintLayer = _makePaintingLayer();
    const dragCrosshairLayer = _makeDragCrosshairLayer();
    const guideLayer = _makeGuideLayer();
    backgroundGuideLayer.sendToBack();
    dragCrosshairLayer.bringToFront();
    guideLayer.bringToFront();
    paintLayer.activate();
};

export {
    CROSSHAIR_SIZE,
    CROSSHAIR_FULL_OPACITY,
    createCanvas,
    hideGuideLayers,
    showGuideLayers,
    getDragCrosshairLayer,
    getGuideLayer,
    getBackgroundGuideLayer,
    clearRaster,
    getRaster,
    setGuideItem,
    setupLayers
};
