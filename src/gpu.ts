var LOG = (s?: any) => {
  // console.log(s);
};
var ERR = (s?: any) => {
  // console.error(s);
};
var LOGI = (s?: any) => {
  // console.info(s);
};
var LOGV = (s?: any) => {
  // console.debug(s);
};

// TODO: Change mode to be stringly typed or enum
class Gpu {
  ctx: CanvasRenderingContext2D = {} as CanvasRenderingContext2D;
  // Access pixel pos with y * frameBuffer.width + x
  frameBuffer: ImageData = {} as ImageData;

  vram: number[] = [];
  oam: number[] = [];

  // http://imrannazar.com/GameBoy-Emulation-in-JavaScript:-GPU-Timings
  mode: number = 2; // the current GPU operating mode
  modeclock: number = 0; // the number of clocks spent in the current mode
  line: number = 0; // the current line being drawn (0xFF44 Read)

  // We have 256+(256/2) = 384 total tiles
  // Okay but we're gonna emulate with 256+256=512 tiles I guess?
  // Each tile consists of 8x8 pixels
  // For each tile (tileset[i]), we have pixel P at point x,y (tileset[i][y][x])
  // So this holds bg0 and bg1 (the window?)
  tileset: number[][][] = [];

  scy: number = 0; // 0xFF42: Scroll-Y, RW
  scx: number = 0; // 0xFF43: Scroll-X, RW
  // Background palette reg consists of four 2-bit palette entries, emulated here.
  pal: number[][] = []; // OXFF47 write?

  // 0xFF40: LCD/GPU control
  // TODO: Figure out exactly what these do an give them better names
  switchbg: boolean = false;
  bgmap: boolean = false; // TODO: Figure this out
  bgtile: boolean = false; // (which tileset num?)
  switchlcd: boolean = false;

  reset = () => {
    // console.log('gpu reset');
    // Clear out the vram and OAM
    for (let i = 0; i < 8192; i++) {
      this.vram[i] = 0;
    }
    for (let i = 0; i < 160; i++) {
      this.oam[i] = 0;
    }
    // Set the linemode to OAM
    this.mode = 2;

    // Clear the tileset
    this.tileset = [];
    for (let i = 0; i < 512; i++) {
      this.tileset[i] = [];
      // For each tile (tileset[i]), we have pixel P at point j,k (tileset[i][j][k])
      for (let j = 0; j < 8; j++) {
        this.tileset[i][j] = [0, 0, 0, 0, 0, 0, 0, 0];
      }
    }

    for (let i = 0; i < 4; i++) {
      this.pal[i] = [0, 0, 0, 0];
    }

    // We're done if running tests on node
    if (typeof document === "undefined") {
      return;
    }

    // Then grab the contexts from the DOM and init the canvas
    const canvas: HTMLCanvasElement = <HTMLCanvasElement>(
      document.getElementById("screen")
    );
    if (canvas && canvas.getContext) {
      this.ctx = canvas.getContext("2d");
      if (this.ctx) {
        if (this.ctx.createImageData) {
          this.frameBuffer = this.ctx.createImageData(160, 144);
        } else if (this.ctx.getImageData) {
          this.frameBuffer = this.ctx.getImageData(0, 0, 160, 144);
        } else {
          // this.frameBuffer = {'width': 160, 'height': 144, 'data': new Array(160 * 144 * 4)};
          ERR("Could not initialize frameBuffer from canvas!");
        }
        // Init the canvas to white, then draw it once
        for (let i = 0; i < 160 * 144 * 4; i++) {
          // This iterates over r, g, b, a channels for each pixel
          this.frameBuffer.data[i] = 255;
        }
        this.ctx.putImageData(this.frameBuffer, 0, 0);
      }
    }
  };

  // @cpu_t is cpu.r.clock.t, the t time for the last instruction
  step = (cpu_last_t: number) => {
    this.modeclock += cpu_last_t;
    switch (this.mode) {
      // OAM read mode, scanline is active
      case 2:
        if (this.modeclock >= 80) {
          // Enter scanline mode 3 (vram), this mode is done
          this.modeclock = 0;
          this.mode = 3;
          LOG("enter vram");
        }
        break;
      // VRAM read mode, scanline is active
      // Treat end of mode 3 as the end of scanline
      case 3:
        if (this.modeclock >= 172) {
          // Scanline ends, enter hblank mode
          this.modeclock = 0;
          this.mode = 0;
          LOG("hblank (vram done), render line");
          // Write a scanline to the framebuffer since we just finished it
          this.renderScanline();
        }
        break;
      // Hblank period
      // After the last hblank, push the framebuffer data to the canvas for display
      case 0:
        if (this.modeclock >= 204) {
          this.modeclock = 0;
          this.line++;
          if (this.line === 143) {
            // Enter vblank mode since we hit the last line, and write the framebuffer
            this.mode = 1;
            LOG("screen done, draw and enter vblank");
            if (this.ctx.putImageData) {
              this.ctx.putImageData(this.frameBuffer, 0, 0);
            }
          } else {
            // Otherwise go back to OAM read mode for the start of the line
            LOG("line done, enter oam");
            this.mode = 2;
          }
        }
      // Vblank period, lasts 10 lines' worth of time (scan and blank)
      case 1:
        // Every time we pass a line's worth of time for scanning and blanking, up the line counter
        // Once we go beyond line 153, we can start scanning again.
        if (this.modeclock >= 456) {
          this.modeclock = 0;
          this.line++;

          // 10 lines beyond the last line, is this the best way to do this?
          // TODO: Also, should this be >= 153?
          if (this.line > 153) {
            LOG("vblank done, enter oam");
            // Restart scanning modes, go to OAM read
            this.mode = 2;
            this.line = 0;
          }
        }
        break;
    }
  };

  renderScanline = () => {
    // VRAM offset for the tile map
    let mapOffset = this.bgmap ? 0x1c00 : 0x1800;
    // Find which line of the tiles to use in the map
    mapOffset += ((this.line + this.scy) & 255) >> 3;
    // Find which tile to start with in the map line
    let lineOffset = this.scx >> 3;
    // Find which line of pixels to use in the tiles
    let y = (this.line + this.scy) & 7;
    // Find where in the tile line to start
    let x = this.scx & 7;
    // Find where to render on the canvas
    let canvasOffset = this.line * 160 * 4;

    // Read the tile index from the background map
    let color: number[];
    let tile = this.vram[mapOffset + lineOffset];

    // If the tile data set in use is #1, the
    // indices are signed; calc a real tile offset
    if (this.bgtile && tile < 128) {
      tile += 256;
    }

    // LOG(`tile index is ${tile}, y is ${y}, x is ${x}`);

    for (let i = 0; i < 160; i++) {
      // Re-map the tile pixel thru the palette
      color = this.pal[this.tileset[tile][y][x]];
      // Plot the pixel to the canvas framebuf
      this.frameBuffer.data[canvasOffset + 0] = color[0];
      this.frameBuffer.data[canvasOffset + 1] = color[1];
      this.frameBuffer.data[canvasOffset + 2] = color[2];
      this.frameBuffer.data[canvasOffset + 3] = color[3];
      canvasOffset += 4;

      // When this tile ends, read another
      x++;
      if (x === 8) {
        x = 0;
        lineOffset = (lineOffset + 1) & 31;
        tile = this.vram[mapOffset + lineOffset];
        if (this.bgtile && tile < 128) {
          tile += 256;
        }
      }
    }
  };

  // Takes a value written to VRAM and udpates the internal tile data set
  // TODO: understand this function
  updateTile = (addr: number) => {
    LOGV(`updating tile at addr ${addr.toString(16)}`);
    // Get the "base address" for this tile row
    addr &= 0x1ffe;
    // Figure out which tile and row was updated
    const tile = (addr >> 4) & 511;
    const y = (addr >> 1) & 7;

    LOGV(`tile ${tile.toString(16)} and row(y) ${y.toString(16)}`);

    let sx = 0;
    for (let x = 0; x < 8; x++) {
      sx = 1 << (7 - x); // this is just the bit mask used for the current pixel
      // Then finally update the tile set
      // If the vram pixel low byte is set, make it 1. If high byte, 2. If pixel word set, 3.
      this.tileset[tile][y][x] =
        (this.vram[addr] & sx ? 1 : 0) + (this.vram[addr + 1] & sx ? 2 : 0);
    }
    LOGV(this.tileset[y]);
  };

  rb = (addr: number): number => {
    switch (addr) {
      // LCD control
      case 0xff40:
        return (
          (this.switchbg ? 0x01 : 0x00) |
          (this.bgmap ? 0x08 : 0x00) |
          (this.bgtile ? 0x10 : 0x00) |
          (this.switchlcd ? 0x80 : 0x00)
        );
      case 0xff42:
        return this.scy;
      case 0xff43:
        return this.scx;
      case 0xff44:
        return this.line;
      default:
        ERR("Unimplemented in gb#rb");
        return 0;
    }
  };

  wb = (addr: number, val: number) => {
    switch (addr) {
      // LCD control
      case 0xff40:
        this.switchbg = val & 0x01 ? true : false;
        this.bgmap = val & 0x08 ? true : false;
        this.bgtile = val & 0x10 ? true : false;
        this.switchlcd = val & 0x80 ? true : false;
        break;
      case 0xff42:
        this.scy = val;
        break;
      case 0xff43:
        this.scx = val;
        break;
      // Background palette
      case 0xff47:
        for (let i = 0; i < 4; i++) {
          // TODO: Understand
          // prettier-ignore
          switch ((val >> (i * 2)) & 3) {
            case 0: this.pal[i] = [255, 255, 255, 255]; break;
            case 1: this.pal[i] = [192, 192, 192, 255]; break;
            case 2: this.pal[i] = [ 96,  96,  96,  96]; break;
            case 3: this.pal[i] = [  0,   0,   0,   0]; break;
            default:
              ERR("Bad bgpal in gpu#wb");
          }
        }
        break;
      default:
        ERR("Unimplemented in gbpu#wb");
    }
  };
}

// If we're running in the browser, add this component to the window
if (typeof window !== "undefined") {
  if ((window as any).GbComponents === undefined) {
    (window as any).GbComponents = {};
  }
  if ((window as any).GbComponents.cpu === undefined) {
    ERR("Incorrect load order, GPU.js must load after CPU.js is loaded!");
    (window as any).GbComponents.gpu = new Gpu();
  } else {
    // Attach ourselves to the CPU component
    (window as any).GbComponents.cpu.gpu = new Gpu();
  }
}

// If we're running under Node, export it for testing
if (typeof module !== "undefined" && module.exports) {
  module.exports = new Gpu();
}
