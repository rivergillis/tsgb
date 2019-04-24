var Mmu = (function () {
    function Mmu() {
        this.rb = function (addr) { return 0; };
        this.rw = function (addr) { return 0; };
        this.wb = function (addr, val) { };
        this.ww = function (addr, val) { };
    }
    return Mmu;
}());
var mmu = new Mmu();
//# sourceMappingURL=mmu.js.map