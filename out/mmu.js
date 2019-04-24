var Mmu = (function () {
    function Mmu() {
        var _this = this;
        this.inbios = true;
        this.bios = [];
        this.rom = [];
        this.wram = [];
        this.eram = [];
        this.zram = [];
        this.rb = function (addr, pc) {
            switch (addr & 0xF000) {
                case 0x0000:
                    if (_this.inbios) {
                        if (addr < 0x0100) {
                            return _this.bios[addr];
                        }
                        else if (pc === 0x0100) {
                            _this.inbios = false;
                        }
                    }
                    return _this.rom[addr];
                case 0x1000:
                case 0x2000:
                case 0x3000:
                    return _this.rom[addr];
            }
            return 0;
        };
        this.rw = function (addr) { return 0; };
        this.wb = function (addr, val) { };
        this.ww = function (addr, val) { };
    }
    return Mmu;
}());
if (typeof module !== 'undefined' && module.exports) {
    module.exports = new Mmu();
}
//# sourceMappingURL=mmu.js.map