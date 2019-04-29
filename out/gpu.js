var Gpu = (function () {
    function Gpu() {
        var _this = this;
        this.ctx = {};
        this.frameBuffer = {};
        this.vram = [];
        this.oam = [];
        this.mode = 2;
        this.modeclock = 0;
        this.line = 0;
        this.tileset = [];
        this.scy = 0;
        this.scx = 0;
        this.pal = [];
        this.switchbg = false;
        this.bgmap = false;
        this.bgtile = false;
        this.switchlcd = false;
        this.reset = function () {
            for (var i = 0; i < 8192; i++) {
                _this.vram[i] = 0;
            }
            for (var i = 0; i < 160; i++) {
                _this.oam[i] = 0;
            }
            _this.mode = 2;
            _this.tileset = [];
            for (var i = 0; i < 384; i++) {
                _this.tileset[i] = [];
                for (var j = 0; j < 8; j++) {
                    _this.tileset[i][j] = [0, 0, 0, 0, 0, 0, 0, 0];
                }
            }
            if (typeof document === "undefined") {
                return;
            }
            var canvas = (document.getElementById("screen"));
            if (canvas && canvas.getContext) {
                _this.ctx = canvas.getContext("2d");
                if (_this.ctx) {
                    if (_this.ctx.createImageData) {
                        _this.frameBuffer = _this.ctx.createImageData(160, 144);
                    }
                    else if (_this.ctx.getImageData) {
                        _this.frameBuffer = _this.ctx.getImageData(0, 0, 160, 144);
                    }
                    else {
                        console.error("Could not initialize frameBuffer from canvas!");
                    }
                    for (var i = 0; i < 160 * 144 * 4; i++) {
                        _this.frameBuffer.data[i] = 255;
                    }
                    _this.ctx.putImageData(_this.frameBuffer, 0, 0);
                }
            }
        };
        this.step = function (cpu_last_t) {
            _this.modeclock += cpu_last_t;
            switch (_this.mode) {
                case 2:
                    if (_this.modeclock >= 80) {
                        _this.modeclock = 0;
                        _this.mode = 3;
                    }
                    break;
                case 3:
                    if (_this.modeclock >= 172) {
                        _this.modeclock = 0;
                        _this.mode = 0;
                        _this.renderScanline();
                    }
                    break;
                case 0:
                    if (_this.modeclock >= 204) {
                        _this.modeclock = 0;
                        _this.line++;
                        if (_this.line === 143) {
                            _this.mode = 1;
                            if (_this.ctx.putImageData) {
                                _this.ctx.putImageData(_this.frameBuffer, 0, 0);
                            }
                        }
                        else {
                            _this.mode = 2;
                        }
                    }
                case 1:
                    if (_this.modeclock >= 456) {
                        _this.modeclock = 0;
                        _this.line++;
                        if (_this.line > 153) {
                            _this.mode = 2;
                            _this.line = 0;
                        }
                    }
                    break;
            }
        };
        this.renderScanline = function () {
            var mapOffset = _this.bgmap ? 0x1c00 : 0x1800;
            mapOffset += ((_this.line + _this.scy) & 255) >> 3;
            var lineOffset = _this.scx >> 3;
            var y = (_this.line + _this.scy) & 7;
            var x = _this.scx & 7;
            var canvasOffset = _this.line * 160 * 4;
            var color;
            var tile = _this.vram[mapOffset + lineOffset];
            if (_this.bgtile && tile < 128) {
                tile += 256;
            }
            for (var i = 0; i < 160; i++) {
                color = _this.pal[_this.tileset[tile][y][x]];
                _this.frameBuffer.data[canvasOffset + 0] = color[0];
                _this.frameBuffer.data[canvasOffset + 1] = color[1];
                _this.frameBuffer.data[canvasOffset + 2] = color[2];
                _this.frameBuffer.data[canvasOffset + 3] = color[3];
                canvasOffset += 4;
                x++;
                if (x === 8) {
                    x = 0;
                    lineOffset = (lineOffset + 1) & 31;
                    tile = _this.vram[mapOffset + lineOffset];
                    if (_this.bgtile && tile < 128) {
                        tile += 256;
                    }
                }
            }
        };
        this.updateTile = function (addr) {
            addr &= 0x1ffe;
            var tile = (addr >> 4) & 511;
            var y = (addr >> 1) & 7;
            var sx = 0;
            for (var x = 0; x < 8; x++) {
                sx = 1 << (7 - x);
                _this.tileset[tile][y][x] =
                    (_this.vram[addr] & sx ? 1 : 0) + (_this.vram[addr + 1] & sx ? 2 : 0);
            }
        };
        this.rb = function (addr) {
            switch (addr) {
                case 0xff40:
                    return ((_this.switchbg ? 0x01 : 0x00) |
                        (_this.bgmap ? 0x08 : 0x00) |
                        (_this.bgtile ? 0x10 : 0x00) |
                        (_this.switchlcd ? 0x80 : 0x00));
                case 0xff42:
                    return _this.scy;
                case 0xff43:
                    return _this.scx;
                case 0xff44:
                    return _this.line;
                default:
                    console.error("Unimplemented in gbpu#rb");
                    return 0;
            }
        };
        this.wb = function (addr, val) {
            switch (addr) {
                case 0xff40:
                    _this.switchbg = val & 0x01 ? true : false;
                    _this.bgmap = val & 0x08 ? true : false;
                    _this.bgtile = val & 0x10 ? true : false;
                    _this.switchlcd = val & 0x80 ? true : false;
                    break;
                case 0xff42:
                    _this.scy = val;
                    break;
                case 0xff43:
                    _this.scx = val;
                    break;
                case 0xff47:
                    for (var i = 0; i < 4; i++) {
                        switch ((val >> (i * 2)) & 3) {
                            case 0:
                                _this.pal[i] = [255, 255, 255, 255];
                                break;
                            case 1:
                                _this.pal[i] = [192, 192, 192, 255];
                                break;
                            case 2:
                                _this.pal[i] = [96, 96, 96, 96];
                                break;
                            case 3:
                                _this.pal[i] = [0, 0, 0, 0];
                                break;
                            default:
                                console.error("Bad bgpal in gpu#wb");
                        }
                    }
                    break;
                default:
                    console.error("Unimplemented in gbpu#wb");
            }
        };
    }
    return Gpu;
}());
if (typeof window !== "undefined") {
    if (window.GbComponents === undefined) {
        window.GbComponents = {};
    }
    if (window.GbComponents.cpu === undefined) {
        console.error("Incorrect load order, GPU.js must load after CPU.js is loaded!");
        window.GbComponents.gpu = new Gpu();
    }
    else {
        window.GbComponents.cpu.gpu = new Gpu();
    }
}
if (typeof module !== "undefined" && module.exports) {
    module.exports = new Gpu();
}
//# sourceMappingURL=gpu.js.map