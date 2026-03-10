import type p5 from "p5";

export class ScoreAnimation {
  x: number;
  y: number;
  opacity: number;
  startTime: number;
  duration: number;
  text: string;

  constructor(x: number, y: number, text: string) {
    this.x = x + 54;
    this.y = y;
    this.opacity = 1;
    this.startTime = performance.now();
    this.duration = 1000; // Animation duration in milliseconds
    this.text = text;
  }

  update(): boolean {
    const elapsed = performance.now() - this.startTime;
    const progress = elapsed / this.duration;

    if (progress >= 1) {
      return false; // Animation is complete
    }

    this.opacity = 1 - progress;
    this.y -= 1; // Move upward
    return true;
  }

  draw(p: p5, font: p5.Font): void {
    p.push();
    p.textFont(font);
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(16);
    p.fill(255, 0, 0, this.opacity * 255);
    p.text(this.text, this.x, this.y);
    p.pop();
  }
}
