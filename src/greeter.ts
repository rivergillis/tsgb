class Student {
  fullName: string;
  constructor(public firstName: string, public middleInitial: string, public lastName: string) {
      this.fullName = firstName + " " + middleInitial + " " + lastName;
  }
}

interface Person {
  firstName: string;
  lastName: string;
}

const greeter = (person: Person) => {
  return "Hello, " + person.firstName + " " + person.lastName;
}

let user = new Student("Jane", "M.", "User");

const canvas: HTMLCanvasElement = <HTMLCanvasElement> document.getElementById("screen");
const ctx: CanvasRenderingContext2D = canvas.getContext("2d");

ctx.moveTo(0, 0);
ctx.lineTo(200, 100);
ctx.stroke();