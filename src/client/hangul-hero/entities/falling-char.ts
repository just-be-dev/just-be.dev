import type p5 from "p5";

export class FallingChar {
  x: number;
  y: number;
  char: string;
  speed: number;
  isBackground: boolean;
  color: string;
  size: number;
  opacity: number;
  toDelete: boolean;
  koreanPixelFont: p5.Font;
  isGrowing: boolean;
  growthStartTime: number;
  growthDuration: number;
  wasSuccessfullyHit: boolean;
  private p: p5;

  constructor(
    x: number,
    char: string,
    speed: number,
    koreanPixelFont: p5.Font,
    p: p5,
    isBackground = false,
  ) {
    this.x = x;
    this.y = -30;
    this.char = char;
    this.speed = speed;
    this.isBackground = isBackground;
    this.color = isBackground ? this.getRandomColor() : "#FFFFFF";
    this.size = isBackground ? 24 : 32;
    this.opacity = isBackground ? 0.3 : 1;
    this.toDelete = false;
    this.koreanPixelFont = koreanPixelFont;
    this.isGrowing = false;
    this.growthStartTime = 0;
    this.growthDuration = 200; // Duration of growth animation in ms
    this.wasSuccessfullyHit = false;
    this.p = p;
  }

  getRandomColor(): string {
    const colors = [
      "#00ff00", // Neon green
      "#ff0066", // Hot pink
      "#00ffff", // Cyan
      "#ffff00", // Yellow
      "#ff3399", // Pink
      "#33ccff", // Light blue
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  update(): void {
    this.y += this.speed;

    if (this.isGrowing) {
      const currentTime = performance.now();
      const elapsed = currentTime - this.growthStartTime;
      const progress = Math.min(elapsed / this.growthDuration, 1);

      // Ease out cubic function for smooth growth
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      this.size = 32 + easedProgress * 48; // Grow from 32 to 80

      // Interpolate color to green
      const startColor = this.p.color(this.color);
      const endColor = this.p.color("#00ff00");
      this.color = this.p.lerpColor(startColor, endColor, easedProgress).toString();

      if (progress >= 1) {
        this.toDelete = true;
      }
    }
  }

  startGrowth(): void {
    this.isGrowing = true;
    this.growthStartTime = performance.now();
  }

  draw(p: p5): void {
    p.push();
    p.textSize(this.size);
    p.textAlign(p.CENTER, p.CENTER);
    p.textStyle(p.BOLD);
    p.textFont(this.koreanPixelFont);

    // Draw outer glow
    if (!this.isBackground) {
      const glowColor = p.color(this.color);
      glowColor.setAlpha(this.opacity * 80);
      p.fill(glowColor);
      p.textSize(this.size + 4);
      p.text(this.char, this.x, this.y);

      // Draw middle glow
      glowColor.setAlpha(this.opacity * 120);
      p.fill(glowColor);
      p.textSize(this.size + 2);
      p.text(this.char, this.x, this.y);
    }

    // Draw main character
    const c = p.color(this.color);
    c.setAlpha(this.opacity * 255);
    p.fill(c);
    p.textSize(this.size);
    p.noStroke();
    p.text(this.char, this.x, this.y);

    // Draw inner highlight
    if (!this.isBackground) {
      const highlightColor = p.color("#ffffff");
      highlightColor.setAlpha(this.opacity * 180);
      p.fill(highlightColor);
      p.textSize(this.size * 0.9);
      p.text(this.char, this.x, this.y);
    }
    p.pop();
  }
}
