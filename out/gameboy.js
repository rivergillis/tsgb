if (typeof window === "undefined") {
    console.error("Stop trying to test gameboy.ts in mocha!");
}
if (typeof window.GbComponents === "undefined") {
    console.error("Incorrect load order, gameboy.js should be the last script loaded!");
}
var system = window.GbComponents;
var reset = function () {
    system.cpu.reset();
    console.log(system);
};
document.getElementById("fileInput").addEventListener("change", function (event) {
    var file = event.target.files[0];
    var reader = new FileReader();
    reader.onload = function (e) {
        var buf = e.target.result;
        var data = new Uint8Array(buf);
        system.cpu.mmu.loadRom(data);
    };
    reader.readAsArrayBuffer(file);
}, false);
var cpu = system.cpu;
var gpu = cpu.gpu;
var mmu = cpu.mmu;
var frame = function () {
    var fclk = system.cpu.clock.t + 70224;
    do {
        console.log(cpu.r);
        console.log("Executing " + mmu.rb(cpu.r.pc, cpu.r.pc, gpu).toString(16));
        var instr = cpu.instructionMap[mmu.rb(cpu.r.pc, cpu.r.pc, gpu)];
        cpu.r.pc++;
        cpu.r.pc &= 65535;
        instr();
        cpu.clock.m += cpu.r.clock.m;
        cpu.clock.t += cpu.r.clock.t;
        gpu.step(cpu.clock.t);
    } while (cpu.clock.t < fclk);
};
var interval = null;
var run = function () {
    if (!interval) {
        interval = setTimeout(frame, 1);
        document.getElementById("run").innerHTML = "pause";
    }
    else {
        clearInterval(interval);
        interval = null;
        document.getElementById("run").innerHTML = "run";
    }
};
window.onload = function () {
    document.getElementById("reset").onclick = reset;
    document.getElementById("run").onclick = run;
    reset();
};
//# sourceMappingURL=gameboy.js.map