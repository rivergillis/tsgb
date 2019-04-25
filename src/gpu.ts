class Gpu {
  vram: number[] = [];
  oam: number[] = [];

  reset = () => {
    for (let i = 0; i < 8192; i++) {
      this.vram[i] = 0;
    }
    for (let i = 0; i < 160; i++) {
      this.oam[i] = 0;
    }
  }
}

// If we're running in the browser, add this component to the window
if (typeof(window) !== 'undefined') {
  if ((window as any).GbComponents === undefined) {
    (window as any).GbComponents = {};
  }
  (window as any).GbComponents.Gpu = new Gpu();
}

// If we're running under Node, export it for testing
if(typeof module !== 'undefined' && module.exports) {
  module.exports = new Gpu();
}