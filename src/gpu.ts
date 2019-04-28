// TODO: Change mode to be stringly typed or enum
class Gpu {
  ctx: CanvasRenderingContext2D = {} as CanvasRenderingContext2D;
  // Access pixel pos with y * frameBuffer.width + x
  frameBuffer: ImageData = {} as ImageData;

  vram: number[] = [];
  oam: number[] = [];

  // http://imrannazar.com/GameBoy-Emulation-in-JavaScript:-GPU-Timings
  mode: number = 2;         // the current GPU operating mode
  modeclock: number = 0;    // the number of clocks spent in the current mode
  line: number = 0;         // the current line being drawn

  // We have 256+(256/2) = 384 total tiles
  // Each tile consists of 8x8 pixels
  // For each tile (tileset[i]), we have pixel P at point x,y (tileset[i][y][x])
  tileset: number[][][] = [];

  bgmap: boolean = false; // TODO: Figure this out
  scy: number = 0;        // AND this
  scx: number = 0;        // AND this
  bgtile: number = 0;     // AND this, (which tileset num?)
  pal: number[][] = [];     // AND this

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
    for (let i = 0; i < 384; i++) {
      this.tileset[i] = [];
      // For each tile (tileset[i]), we have pixel P at point j,k (tileset[i][j][k])
      for (let j = 0; j < 8; j++) {
        this.tileset[i][j] = [0,0,0,0,0,0,0,0];
      }
    }

    // We're done if running tests on node
    if (typeof(document) === 'undefined') {
      return;
    }

    // Then grab the contexts from the DOM and init the canvas
    const canvas: HTMLCanvasElement = <HTMLCanvasElement> document.getElementById("screen");
    if (canvas && canvas.getContext) {
      this.ctx = canvas.getContext("2d");
      if (this.ctx) {
        if (this.ctx.createImageData) {
          this.frameBuffer = this.ctx.createImageData(160, 144);
        } else if (this.ctx.getImageData) {
          this.frameBuffer = this.ctx.getImageData(0,0,160,144);
        } else {
          // this.frameBuffer = {'width': 160, 'height': 144, 'data': new Array(160 * 144 * 4)};
          console.error("Could not initialize frameBuffer from canvas!")
        }
        // Init the canvas to white, then draw it once
        for(let i = 0; i < 160*144*4; i++) {
          // This iterates over r, g, b, a channels for each pixel
          this.frameBuffer.data[i] = 255;
        }
        this.ctx.putImageData(this.frameBuffer, 0, 0);
      }
    }
  }

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
        }
        break;
      // VRAM read mode, scanline is active
      // Treat end of mode 3 as the end of scanline
      case 3:
        if (this.modeclock >= 172) {
          // Scanline ends, enter hblank mode
          this.modeclock = 0;
          this.mode = 0;
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
            if (this.ctx.putImageData) {
              this.ctx.putImageData(this.frameBuffer, 0, 0);
            }
          } else {
            // Otherwise go back to OAM read mode for the start of the line
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
            // Restart scanning modes, go to OAM read
            this.mode = 2;
            this.line = 0;
          }
        }
        break;
    }
  }

  renderScanline = () => {
    // VRAM offset for the tile map
    let mapOffset = this.bgmap ? 0x1C00 : 0x1800;
    // Find which line of the tiles to use in the map
    mapOffset += ((this.line + this.scy) & 255) >> 3;
    // Find which tile to start with in the map line
    let lineOffset = (this.scx >> 3);
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
    if (this.bgtile === 1 && tile < 128) {
      tile += 256;
    }

    for (let i = 0; i < 160; i++) {
      // Re-map the tile pixel thru the palette
      color = this.pal[this.tileset[tile][y][x]];
      // Plot the pixel to the canvas framebuf
      this.frameBuffer.data[canvasOffset+0] = color[0];
      this.frameBuffer.data[canvasOffset+1] = color[1];
      this.frameBuffer.data[canvasOffset+2] = color[2];
      this.frameBuffer.data[canvasOffset+3] = color[3];
      canvasOffset += 4;

      // When this tile ends, read another
      x++;
      if (x === 8) {
        x = 0;
        lineOffset = (lineOffset + 1) & 31;
        tile = this.vram[mapOffset + lineOffset];
        if (this.bgtile === 1 && tile < 128) {
          tile += 256;
        }
      }
    }
  }

  // Takes a value written to VRAM and udpates the internal tile data set
  // TODO: understand this function
  updateTile = (addr: number) => {
    // Get the "base address" for this tile row
    addr &= 0x1FFE;
    // Figure out which tile and row was updated
    const tile = (addr >> 4) & 511;
    const y = (addr >> 1) & 7;

    let sx = 0;
    for (let x = 0; x < 8; x++) {
      // FInd bit index for this pixel
      sx = 1 << (7-x);
      // Then finally update the tile set
      this.tileset[tile][y][x] = 
        ((this.vram[addr] & sx) ? 1 : 0) +
        ((this.vram[addr+1] & sx) ? 2: 0);
    }
  }
}

// If we're running in the browser, add this component to the window
if (typeof(window) !== 'undefined') {
  if ((window as any).GbComponents === undefined) {
    (window as any).GbComponents = {};
  }
  if ((window as any).GbComponents.cpu === undefined) {
    console.error("Incorrect load order, GPU.js must load after CPU.js is loaded!");
    (window as any).GbComponents.gpu = new Gpu();
  } else {
    // Attach ourselves to the CPU component
    (window as any).GbComponents.cpu.gpu = new Gpu();
  }
}

// If we're running under Node, export it for testing
if(typeof module !== 'undefined' && module.exports) {
  module.exports = new Gpu();
}