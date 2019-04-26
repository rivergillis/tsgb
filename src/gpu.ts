// TODO: Change mode to be stringly typed or enum
class Gpu {
  ctx: CanvasRenderingContext2D = {} as CanvasRenderingContext2D;
  // Access pixel pos with y * frameBuffer.width + x
  frameBuffer: ImageData = {} as ImageData;

  vram: number[] = [];
  oam: number[] = [];

  // http://imrannazar.com/GameBoy-Emulation-in-JavaScript:-GPU-Timings
  mode: number = 0;         // the current GPU operating mode
  modeclock: number = 0;    // the number of clocks spent in the current mode
  line: number = 0;         // the current line being drawn

  reset = () => {
    // Clear out the vram and OAM
    for (let i = 0; i < 8192; i++) {
      this.vram[i] = 0;
    }
    for (let i = 0; i < 160; i++) {
      this.oam[i] = 0;
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
      // After the last hbalnk, push the framebuffer data to the canvas for display
      case 0:
        if (this.modeclock >= 204) {
          this.modeclock = 0;
          this.line++;
          if (this.line === 143) {
            // Enter vblank mode since we hit the last line, and write the framebuffer
            this.mode = 1;
            this.ctx.putImageData(this.frameBuffer, 0, 0);
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

  }
}

// If we're running in the browser, add this component to the window
if (typeof(window) !== 'undefined') {
  if ((window as any).GbComponents === undefined) {
    (window as any).GbComponents = {};
  }
  (window as any).GbComponents.gpu = new Gpu();
}

// If we're running under Node, export it for testing
if(typeof module !== 'undefined' && module.exports) {
  module.exports = new Gpu();
}