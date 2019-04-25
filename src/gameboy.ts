if (typeof(window) === 'undefined') {
  console.error("Stop trying to test gameboy.ts in mocha!")
}

if (typeof((window as any).GbComponents) === 'undefined') {
  console.error("Incorrect load order, gameboy.js should be the last script loaded!")
}

const system: any = (window as any).GbComponents;

console.log(system);