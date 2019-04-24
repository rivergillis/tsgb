const cpu = require("../out/cpu");
const assert = require("chai").assert;

describe("Array", function() {
  describe("#indexOf()", function() {
    it("should return -1 when the value is not present", function() {
      console.log(cpu);
      assert.equal([1, 2, 3].indexOf(4), -1);
    });
  });
});
