import React, { Component } from 'react';

interface PureCanvasProps {
  contextRef: Function;
}

class PureCanvas extends Component<PureCanvasProps, any> {
  shouldComponentUpdate() {
    return false;
  }

  render() {
    return (
      <canvas
        width="160"
        height="144"
        ref={node =>
          node ? this.props.contextRef(node.getContext('2d')) : null
        }
      />
    );
  }
}

export default PureCanvas;
