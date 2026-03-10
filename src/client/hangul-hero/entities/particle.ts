import type p5 from "p5";

export class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  size: number;
  color: string;
  koreanPixelFont: p5.Font;

  constructor(
    x: number,
    y: number,
    char: string,
    koreanPixelFont: p5.Font,
    isSuccess: boolean = false,
  ) {
    this.x = x;
    this.y = y;
    // Increase velocity range for more explosive effect
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 8 + 4; // Random speed between 4 and 12
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed - 2; // Initial upward boost
    this.alpha = 1;
    // Fixed pixel sizes for sharper look
    this.size = Math.floor(Math.random() * 3) * 2 + 2; // 2, 4, or 6 pixels
    // Get a random neon color based on success/failure
    this.color = this.getRandomColor(isSuccess);
    this.koreanPixelFont = koreanPixelFont;
  }

  getRandomColor(isSuccess: boolean): string {
    if (isSuccess) {
      // Success colors - bright, positive colors
      const successColors = [
        "#00ff00", // Neon green
        "#00ffff", // Cyan
        "#ffff00", // Yellow
        "#33ccff", // Light blue
        "#4ECDC4", // Teal
      ];
      return successColors[Math.floor(Math.random() * successColors.length)];
    } else {
      // Failure colors - reds and pinks
      const failureColors = [
        "#ff0066", // Hot pink
        "#ff3399", // Pink
        "#FF6B6B", // Pink/Red
        "#ff0000", // Pure red
        "#ff3366", // Bright pink
      ];
      return failureColors[Math.floor(Math.random() * failureColors.length)];
    }
  }

  update(): boolean {
    // Apply gravity
    this.vy += 0.3;

    // Add some horizontal drift
    this.vx *= 0.99;

    // Update position
    this.x += this.vx;
    this.y += this.vy;

    // Fade out faster for sharper disappearance
    this.alpha -= 0.03;

    // Return true if particle is still alive
    return this.alpha > 0;
  }

  draw(p: p5): void {
    p.push();
    p.noStroke();

    // Calculate pixel-perfect position
    const pixelX = Math.round(this.x);
    const pixelY = Math.round(this.y);

    // Draw main pixel
    const mainColor = p.color(this.color);
    mainColor.setAlpha(this.alpha * 255);
    p.fill(mainColor);
    p.rect(pixelX - this.size / 2, pixelY - this.size / 2, this.size, this.size);

    // Draw white highlight pixel in corner (1px)
    const highlightColor = p.color("#ffffff");
    highlightColor.setAlpha(this.alpha * 255);
    p.fill(highlightColor);
    p.rect(pixelX - this.size / 2, pixelY - this.size / 2, 1, 1);

    // Draw dark edge on bottom-right (1px)
    const shadowColor = p.color(0, 0, 0);
    shadowColor.setAlpha(this.alpha * 255);
    p.fill(shadowColor);
    p.rect(pixelX + this.size / 2 - 1, pixelY + this.size / 2 - 1, 1, 1);

    p.pop();
  }
}
