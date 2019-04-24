var add_byte_regs = ['a', 'b', 'c', 'd', 'e', 'h', 'l'];
var Cpu = (function () {
    function Cpu() {
        var _this = this;
        this.clock = { m: 0, t: 0 };
        this.r = { a: 0, b: 0, c: 0, d: 0, e: 0, h: 0, l: 0, f: 0, pc: 0, sp: 0, clock: { m: 0, t: 0 } };
        this.ADD_byte = function (reg) {
            if (add_byte_regs.indexOf(reg) <= -1) {
                console.error("Adding reg " + reg + " in ADD_byte, but " + reg + " not an approved reg");
                return;
            }
            _this.r.f = 0;
            var halfByteSum = (_this.r.a & 0xf) + (_this.r['reg'] & 0xf);
            if ((halfByteSum & 0x10) == 0x10) {
                _this.r.f |= 0x20;
            }
            _this.r.a += _this.r['reg'];
            if (!(_this.r.a & 255)) {
                _this.r.f |= 0x80;
            }
            if (_this.r.a > 255) {
                _this.r.f |= 0x10;
            }
            _this.r.a &= 255;
            _this.r.clock.m = 1;
            _this.r.clock.t = 4;
        };
        this.CPr_b = function () {
            var i = _this.r.a;
            i -= _this.r.b;
            _this.r.f |= 0x40;
            if (!(i & 255)) {
                _this.r.f |= 0x80;
            }
            if (i < 0) {
                _this.r.f |= 0x10;
            }
            _this.r.clock.m = 1;
            _this.r.clock.t = 4;
        };
        this.NOP = function () {
            _this.r.clock.m = 1;
            _this.r.clock.t = 4;
        };
        this.PUSHBC = function () {
            _this.r.sp--;
            mmu.wb(_this.r.sp, _this.r.b);
            _this.r.sp--;
            mmu.wb(_this.r.sp, _this.r.c);
            _this.r.clock.m = 3;
            _this.r.clock.t = 12;
        };
        this.POPHL = function () {
            _this.r.l = mmu.rb(_this.r.sp);
            _this.r.sp++;
            _this.r.h = mmu.rb(_this.r.sp);
            _this.r.sp++;
            _this.r.clock.m = 3;
            _this.r.clock.t = 12;
        };
        this.LDAmm = function () {
            var addr = mmu.rw(_this.r.pc);
            _this.r.pc += 2;
            _this.r.a = mmu.rb(addr);
            _this.r.clock.m = 4;
            _this.r.clock.t = 16;
        };
        this.reset = function () {
            _this.r.a = 0;
            _this.r.b = 0;
            _this.r.c = 0;
            _this.r.d = 0;
            _this.r.e = 0;
            _this.r.h = 0;
            _this.r.l = 0;
            _this.r.f = 0;
            _this.r.sp = 0;
            _this.r.pc = 0;
            _this.r.clock.m = 0;
            _this.r.clock.t = 0;
            _this.clock.m = 0;
            _this.clock.t = 0;
        };
    }
    return Cpu;
}());
var cpu = new Cpu();
console.log(cpu);
//# sourceMappingURL=cpu.js.map