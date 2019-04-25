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

// If we're running under Node, export it for testing
if(typeof module !== 'undefined' && module.exports) {
  module.exports = new Gpu();
}