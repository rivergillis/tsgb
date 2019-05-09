import React, { Component } from 'react';
import PureCanvas from './PureCanvas';
import Gameboy from './gb/gameboy';

// let z = 0;

// class Engine {
//   ctx: CanvasRenderingContext2D;
//   frameBuffer: ImageData;
//   constructor(ctx: CanvasRenderingContext2D) {
//     this.ctx = ctx;
//     this.frameBuffer = ctx.createImageData(ctx.canvas.width, ctx.canvas.height);
//   }
//   tick = () => {
//     // Iterate through every pixel
//     for (let i = 0; i < this.frameBuffer.data.length; i += 4) {
//       // Modify pixel data
//       this.frameBuffer.data[i + 0] = z; // R value
//       this.frameBuffer.data[i + 1] = z; // G value
//       this.frameBuffer.data[i + 2] = z; // B value
//       this.frameBuffer.data[i + 3] = 255; // A value
//     }
//     z++;
//     if (z > 255) {
//       z = 0;
//     }
//   };
//   drawFrame = () => {
//     this.ctx.putImageData(this.frameBuffer, 0, 0);
//   };
// }

interface AnimationState {
  frameId: number;
  gb: Gameboy | null;
}

class Animation extends Component<any, AnimationState> {
  state: AnimationState = {
    frameId: 0,
    gb: null,
  };

  componentDidMount() {
    this.setState({
      frameId: requestAnimationFrame(this.updateAnimationState),
    });
  }

  saveContext = (ctx: CanvasRenderingContext2D) => {
    this.setState({
      gb: new Gameboy(ctx),
    });
  };

  updateAnimationState = () => {
    const { gb } = this.state;
    if (gb) {
      // After tick() is finished, we have a frame to draw
      gb.tickFrame();
      gb.drawFrame();
    }
    // uncomment to render more than one line
    // requestAnimationFrame(this.updateAnimationState);
  };

  render() {
    return <PureCanvas contextRef={this.saveContext} />;
  }
}

export default Animation;
