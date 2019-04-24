var Student = (function () {
    function Student(firstName, middleInitial, lastName) {
        this.firstName = firstName;
        this.middleInitial = middleInitial;
        this.lastName = lastName;
        this.fullName = firstName + " " + middleInitial + " " + lastName;
    }
    return Student;
}());
var greeter = function (person) {
    return "Hello, " + person.firstName + " " + person.lastName;
};
var user = new Student("Jane", "M.", "User");
var canvas = document.getElementById("screen");
var ctx = canvas.getContext("2d");
ctx.moveTo(0, 0);
ctx.lineTo(200, 100);
ctx.stroke();
//# sourceMappingURL=greeter.js.map