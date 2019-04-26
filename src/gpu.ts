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

  // @cpu_t is Z80.r.clock.t, the t time for the last instruction
  step = (cpu_last_t: number) => {
    this.modeclock += cpu_last_t;
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