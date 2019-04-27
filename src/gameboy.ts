if (typeof(window) === 'undefined') {
  console.error("Stop trying to test gameboy.ts in mocha!")
}

if (typeof((window as any).GbComponents) === 'undefined') {
  console.error("Incorrect load order, gameboy.js should be the last script loaded!")
}

const system: any = (window as any).GbComponents;

// Todo: reset the rest in the correct order
system.mmu.reset();
system.cpu.reset();
system.gpu.reset();

console.log(system);
