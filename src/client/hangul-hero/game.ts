import type p5 from "p5";
import { HANGUL_CHARS, isHangul } from "./constants";
import { FallingChar, ScoreAnimation, Particle, LifeCharacter, WarningMessage } from "./entities";

export class Game {
  private static readonly MAX_LIVES = 3;
  private p: p5;
  public isPlaying: boolean;
  public isPaused: boolean;
  private score: number;
  private lives: number;
  private fallingChars: FallingChar[];
  private backgroundChars: FallingChar[];
  private speed: number;
  private lastTypedChar: string | null;
  private lastTypedCharColor: string;
  private lastTypedCharTime: number;
  private startTextOpacity: number;
  private startTextFading: number;
  public columnWidth: number;
  public numColumns: number;
  private minBackgroundSpacing: number;
  private columnLastY: number[];
  private gameStartTime: number;
  private lastSpawnTime: number;
  private initialSpawnInterval: number;
  private minSpawnInterval: number;
  private maxActiveChars: number;
  private initialSpeed: number;
  private maxSpeed: number;
  private pauseTextOpacity: number;
  private pauseTextFading: number;
  private pixelFont: p5.Font;
  private koreanPixelFont: p5.Font;
  private scoreAnimations: ScoreAnimation[];
  private scoreColor: p5.Color;
  private scoreColorTransitionStart: number;
  private scoreColorTransitionDuration: number;
  private particles: Particle[];
  private flashStartTime: number;
  private isFlashing: boolean;
  private flashDuration: number;
  private flashCount: number;
  private maxFlashCount: number;
  private lifeCharacters: LifeCharacter[];
  private wasScoreZero: boolean;
  public sounds: {
    explosions: p5.SoundFile[];
    buttonPressed: p5.SoundFile;
    buttonReleased: p5.SoundFile;
    gameOver: p5.SoundFile;
    intro: p5.SoundFile;
    success: p5.SoundFile[];
    gameMusic: p5.SoundFile[]; // Changed to array
    gameOverSong: p5.SoundFile;
  };
  private audioContextInitialized: boolean;
  // Add new power state properties
  public isPowered: boolean;
  private screenPowerTransitionStart: number;
  private screenPowerTransitionDuration: number;
  public buttonPressStartTime: number;
  public longPressThreshold: number;
  public isLongPress: boolean;
  private currentGameMusicIndex: number = 0; // Add index tracking
  private warningMessages: WarningMessage[] = [];

  constructor(
    p: p5,
    pixelFont: p5.Font,
    koreanPixelFont: p5.Font,
    sounds: {
      explosions: p5.SoundFile[];
      buttonPressed: p5.SoundFile;
      buttonReleased: p5.SoundFile;
      gameOver: p5.SoundFile;
      intro: p5.SoundFile;
      success: p5.SoundFile[];
      gameMusic: p5.SoundFile[]; // Changed to array
      gameOverSong: p5.SoundFile;
    },
  ) {
    this.p = p;
    this.pixelFont = pixelFont;
    this.koreanPixelFont = koreanPixelFont;
    this.sounds = sounds;
    this.isPlaying = false;
    this.isPaused = false;
    this.score = 0;
    this.lives = Game.MAX_LIVES;
    this.fallingChars = [];
    this.backgroundChars = [];
    this.speed = 1;
    this.lastTypedChar = null;
    this.lastTypedCharColor = "#FFFFFF";
    this.lastTypedCharTime = 0;
    this.columnWidth = 40;
    this.numColumns = 0;
    this.startTextOpacity = 0;
    this.startTextFading = 1;
    this.minBackgroundSpacing = 60;
    this.columnLastY = [];
    this.gameStartTime = 0;
    this.lastSpawnTime = 0;
    this.initialSpawnInterval = 3000;
    this.minSpawnInterval = 500;
    this.maxActiveChars = 1;
    this.initialSpeed = 1;
    this.maxSpeed = 4;
    this.pauseTextOpacity = 0.3;
    this.pauseTextFading = 1;
    this.scoreAnimations = [];
    this.scoreColor = p.color("#00ff00");
    this.scoreColorTransitionStart = 0;
    this.scoreColorTransitionDuration = 500;
    this.particles = [];
    this.flashStartTime = 0;
    this.isFlashing = false;
    this.flashDuration = 1200;
    this.flashCount = 0;
    this.maxFlashCount = 1;
    this.lifeCharacters = [];
    this.wasScoreZero = false;
    this.audioContextInitialized = false;
    // Initialize power state properties
    this.isPowered = false;
    this.screenPowerTransitionStart = 0;
    this.screenPowerTransitionDuration = 1000;
    this.buttonPressStartTime = 0;
    this.longPressThreshold = 5000; // 5 seconds
    this.isLongPress = false;
    this.warningMessages = [];
  }

  private async initializeAudioContext(): Promise<void> {
    if (this.audioContextInitialized) return;

    try {
      await this.p.userStartAudio();
      this.audioContextInitialized = true;
    } catch (error) {
      console.warn("Audio context initialization failed:", error);
    }
  }

  public async playSound(
    sound: p5.SoundFile,
    options: {
      rate?: number;
      volume?: number;
      loop?: boolean;
      /** Delay in seconds */
      delay?: number;
    } = {},
  ): Promise<void> {
    if (!this.audioContextInitialized) {
      await this.initializeAudioContext();
    }
    const startTime = options.delay ?? 0;

    if (sound && this.audioContextInitialized) {
      try {
        if (options.rate) {
          sound.rate(options.rate);
        }
        if (options.volume) {
          sound.setVolume(options.volume);
        }

        if (options.loop) {
          sound.loop(startTime);
        } else {
          sound.play(startTime);
        }
      } catch (error) {
        console.warn("Failed to play sound:", error);
      }
    } else {
      console.warn("Sound not found or audio context not initialized");
    }
  }

  setupInput(): void {
    const input = document.getElementById("korean-input") as HTMLInputElement;
    if (!input) return;

    // Add space bar handler for pause
    document.addEventListener("keydown", (e) => {
      if (e.code === "Space" && this.isPlaying) {
        e.preventDefault(); // Prevent space from triggering input
        this.togglePause();
      }
    });

    // Focus input when game container is clicked
    const container = document.getElementById("game-container");
    if (container) {
      container.addEventListener("click", () => {
        input.focus({ preventScroll: true });
      });
    }

    // Handle input events
    input.addEventListener("input", (e) => {
      if (!this.isPlaying || this.isPaused || !this.isPowered) return; // Don't process input when powered off or paused

      const inputValue = (e.target as HTMLInputElement).value;
      if (inputValue) {
        // Decompose the input value into its constituent parts
        inputValue
          .split("")
          .filter(Boolean)
          .flatMap((char) => char.normalize("NFD").split(""))
          .forEach((char) => {
            this.handleKeyPress(char);
          });
        // Clear the input for the next character
        (e.target as HTMLInputElement).value = "";
      }
    });

    // Keep input focused when typing
    input.addEventListener("blur", () => {
      if (this.isPlaying && !this.isPaused && this.isPowered) {
        input.focus({ preventScroll: true });
      }
    });
  }

  togglePause(): void {
    this.isPaused = !this.isPaused;
    const input = document.getElementById("korean-input") as HTMLInputElement;
    const startButton = document.getElementById("start-button");
    if (this.isPaused) {
      input?.blur(); // Remove focus from input when paused
      startButton?.classList.remove("active");
      // Pause current game music track
      if (this.sounds.gameMusic && this.sounds.gameMusic[this.currentGameMusicIndex]) {
        this.sounds.gameMusic[this.currentGameMusicIndex].pause();
      }
    } else {
      input?.focus({ preventScroll: true }); // Restore focus when unpaused
      startButton?.classList.add("active");
      // Resume current game music track
      if (this.sounds.gameMusic && this.sounds.gameMusic[this.currentGameMusicIndex]) {
        this.sounds.gameMusic[this.currentGameMusicIndex].play();
      }
    }
  }

  start(): void {
    if (this.isPlaying) return;

    // Stop intro music when game starts
    if (this.sounds.intro) {
      this.sounds.intro.stop();
    }

    // Stop game over song if it's playing
    if (this.sounds.gameOverSong) {
      this.sounds.gameOverSong.stop();
    }

    // Reset music index and start first track
    this.currentGameMusicIndex = 0;
    if (this.sounds.gameMusic && this.sounds.gameMusic.length > 0) {
      this.playNextGameMusicTrack();
    }

    this.isPlaying = true;
    this.isPaused = false;
    this.score = 0;
    this.lives = Game.MAX_LIVES;
    this.fallingChars = [];
    this.speed = this.initialSpeed;
    this.columnLastY = new Array(this.numColumns).fill(-this.minBackgroundSpacing);
    this.gameStartTime = this.p.millis();
    this.lastSpawnTime = this.gameStartTime;
    this.scoreColor = this.p.color("#00ff00"); // Reset to green when starting
    this.wasScoreZero = false; // Reset the flag when starting

    // Initialize life characters with random non-repeating colors
    this.lifeCharacters = [];
    const startX = this.p.width - 20 - 35 * 2;
    const startY = this.p.height - 30;

    // Create a copy of available colors and shuffle them
    const availableColors = [...LifeCharacter.LIFE_COLORS];
    for (let i = 0; i < Game.MAX_LIVES; i++) {
      this.lifeCharacters.push(
        new LifeCharacter(startX + i * 35, startY, this.koreanPixelFont, availableColors),
      );
      // Remove the used color from available colors
      availableColors.splice(availableColors.indexOf(this.lifeCharacters[i].color), 1);
    }

    // Focus the input when game starts
    const input = document.getElementById("korean-input") as HTMLInputElement;
    const startButton = document.getElementById("start-button");
    if (input) {
      input.focus({ preventScroll: true });
    }
    if (startButton) {
      startButton.classList.add("active");
    }
  }

  private playNextGameMusicTrack(): void {
    if (!this.sounds.gameMusic || this.sounds.gameMusic.length === 0) return;

    // Stop current track if it's playing
    if (this.sounds.gameMusic[this.currentGameMusicIndex]) {
      this.sounds.gameMusic[this.currentGameMusicIndex].stop();
    }

    // Play next track
    this.playSound(this.sounds.gameMusic[this.currentGameMusicIndex], {
      volume: 0.08,
    });

    // Set up event listener for when this track ends
    this.sounds.gameMusic[this.currentGameMusicIndex].onended = () => {
      // Move to next track
      this.currentGameMusicIndex = (this.currentGameMusicIndex + 1) % this.sounds.gameMusic.length;
      // Play the next track
      this.playNextGameMusicTrack();
    };
  }

  gameOver(): void {
    this.isPlaying = false;
    this.isPaused = false;

    // Stop current game music track
    if (this.sounds.gameMusic && this.sounds.gameMusic[this.currentGameMusicIndex]) {
      this.sounds.gameMusic[this.currentGameMusicIndex].stop();
    }

    // Play game over sound
    if (this.sounds.gameOver) {
      this.playSound(this.sounds.gameOver, { rate: 0.5, volume: 0.1 }).then(() => {
        // After game over sound finishes, play the game over song
        if (this.sounds.gameOverSong) {
          this.playSound(this.sounds.gameOverSong, {
            volume: 0.1,
            loop: true,
            delay: 1,
          });
        }
      });
    }

    // Create explosions for all remaining falling characters simultaneously
    this.fallingChars.forEach((char) => {
      this.createExplosion(char.x, char.y, char.char, false);
    });

    // Clear falling chars immediately since we don't need to wait for staggered explosions
    this.fallingChars.forEach((char) => {
      char.toDelete = true;
    });
    this.fallingChars = [];

    this.lastTypedChar = null;
    const startButton = document.getElementById("start-button");
    if (startButton) {
      startButton.classList.remove("active");
    }
  }

  private calculateDifficulty(): void {
    const gameTime = this.p.millis() - this.gameStartTime;
    const minutes = gameTime / 60000; // Convert to minutes

    // Gradually increase speed based on time
    this.speed = Math.min(this.maxSpeed, this.initialSpeed + minutes * 0.5);

    // Gradually increase max active characters
    this.maxActiveChars = Math.min(5, 1 + Math.floor(minutes));

    // Calculate current spawn interval
    const spawnIntervalDecrease = Math.min(
      this.initialSpawnInterval - this.minSpawnInterval,
      minutes * 500,
    );
    this.initialSpawnInterval = Math.max(
      this.initialSpawnInterval - spawnIntervalDecrease,
      this.minSpawnInterval,
    );
  }

  createExplosion(x: number, y: number, char: string, isSuccess: boolean = false): void {
    // Create more particles for a denser explosion effect
    const numParticles = 20;
    for (let i = 0; i < numParticles; i++) {
      this.particles.push(new Particle(x, y, char, this.koreanPixelFont, isSuccess));
    }
    if (isSuccess) {
      // Play random success sound
      const randomIndex = Math.floor(Math.random() * this.sounds.success.length);
      const successSound = this.sounds.success[randomIndex];
      if (successSound) {
        this.playSound(successSound, { rate: 1.2, volume: 0.1 });
      }
    } else {
      // Play random failure explosion sound
      const randomIndex = Math.floor(Math.random() * (this.sounds.explosions.length - 1)) + 1;
      const failureSound = this.sounds.explosions[randomIndex];
      if (failureSound) {
        this.playSound(failureSound, { rate: 1.3, volume: 0.08 });
      }
    }
  }

  update(): void {
    // Update power state
    this.updatePowerState();

    // Update start text opacity for pulsing effect
    this.startTextOpacity += 0.05 * this.startTextFading;
    if (this.startTextOpacity >= 1) {
      this.startTextFading = -1;
    } else if (this.startTextOpacity <= 0.3) {
      this.startTextFading = 1;
    }

    // Don't update game state if powered off
    if (!this.isPowered) return;

    // Rest of the update logic...

    // Update pause text opacity for flashing effect
    if (this.isPaused) {
      this.pauseTextOpacity += 0.03 * this.pauseTextFading;
      if (this.pauseTextOpacity >= 1) {
        this.pauseTextFading = -1;
      } else if (this.pauseTextOpacity <= 0.3) {
        this.pauseTextFading = 1;
      }
    }

    // Don't update game state if paused
    if (this.isPaused) return;

    if (this.isPlaying) {
      this.calculateDifficulty();

      // Add new falling characters based on current difficulty
      const currentTime = this.p.millis();
      if (
        this.fallingChars.length < this.maxActiveChars &&
        currentTime - this.lastSpawnTime >= this.initialSpawnInterval
      ) {
        const char = HANGUL_CHARS[Math.floor(this.p.random(HANGUL_CHARS.length))];
        const column = Math.floor(this.p.random(this.numColumns));
        const x = column * this.columnWidth + this.columnWidth / 2;
        this.fallingChars.push(new FallingChar(x, char, this.speed, this.koreanPixelFont, this.p));
        this.lastSpawnTime = currentTime;
      }

      // Update life characters
      this.lifeCharacters.forEach((char) => char.update(this.p, currentTime));
    }

    // Update falling characters and handle life loss
    this.fallingChars = this.fallingChars.filter((char) => {
      char.update();
      if (char.y >= this.p.height || char.toDelete) {
        if (!char.isBackground) {
          if (this.isPlaying) {
            // Only count as a miss if the character hit the bottom (not a successful hit)
            if (char.y >= this.p.height && !char.wasSuccessfullyHit) {
              // Set the lost character for the current life
              if (this.lives > 0 && this.lives <= this.lifeCharacters.length) {
                this.lifeCharacters[this.lives - 1].setLostChar(char.char);
              }
              this.lives--;
              if (this.lives <= 0) {
                this.gameOver();
              }
              this.startFlashEffect();
            }
            // Create explosion for both successful hits and misses
            if (!char.wasSuccessfullyHit) {
              this.createExplosion(char.x, char.y, char.char, false);
            }
          }
        }
        return false;
      }
      return true;
    });

    // Update and filter particles
    this.particles = this.particles.filter((particle) => particle.update());

    // Background characters
    // Initialize column tracking if not already done
    if (this.columnLastY.length !== this.numColumns) {
      this.columnLastY = new Array(this.numColumns).fill(-this.minBackgroundSpacing);
    }

    // Add new background characters with spacing check
    for (let col = 0; col < this.numColumns; col++) {
      if (this.p.random(1) < 0.01) {
        // Check if there's enough space in this column
        const lastY = this.columnLastY[col];
        const existingCharsInColumn = this.backgroundChars.filter(
          (char) => Math.abs(char.x - (col * this.columnWidth + this.columnWidth / 2)) < 1,
        );

        const nearestCharY = existingCharsInColumn.reduce((nearest, char) => {
          return char.y < 0 && char.y > nearest ? char.y : nearest;
        }, -Infinity);

        if (nearestCharY === -Infinity || nearestCharY < -this.minBackgroundSpacing) {
          const char = HANGUL_CHARS[Math.floor(this.p.random(HANGUL_CHARS.length))];
          const x = col * this.columnWidth + this.columnWidth / 2;
          this.backgroundChars.push(
            new FallingChar(x, char, 0.5, this.koreanPixelFont, this.p, true),
          );
          this.columnLastY[col] = -30; // Update last Y position for this column
        }
      }
    }

    // Update background characters and their column positions
    this.backgroundChars = this.backgroundChars.filter((char) => {
      char.update();
      // Update column tracking
      const col = Math.floor(char.x / this.columnWidth);
      if (col >= 0 && col < this.numColumns) {
        this.columnLastY[col] = Math.max(this.columnLastY[col], char.y);
      }
      return char.y < this.p.height + 30; // Allow characters to go slightly below screen before being removed
    });

    // Update flash effect
    if (this.isFlashing) {
      const elapsed = this.p.millis() - this.flashStartTime;
      if (elapsed >= this.flashDuration) {
        this.isFlashing = false;
      }
    }
  }

  draw(): void {
    this.p.background(0);

    // Handle screen power transition
    if (this.screenPowerTransitionStart > 0) {
      const elapsed = this.p.millis() - this.screenPowerTransitionStart;
      const progress = Math.min(1, elapsed / this.screenPowerTransitionDuration);

      if (this.isPowered) {
        // Power on transition
        const brightness = this.p.map(progress, 0, 1, 0, 255);
        this.p.fill(0, 0, 0, 255 - brightness);
        this.p.rect(0, 0, this.p.width, this.p.height);
      } else {
        // Power off transition
        const brightness = this.p.map(progress, 0, 1, 255, 0);
        this.p.fill(0, 0, 0, brightness);
        this.p.rect(0, 0, this.p.width, this.p.height);
      }
    }

    // Don't draw game content if powered off
    if (!this.isPowered) return;

    // Rest of the draw logic...

    // Create CRT-style radial background with flash effect
    const centerX = this.p.width / 2;
    const centerY = this.p.height / 2;
    const maxDist = Math.sqrt(Math.pow(this.p.width / 2, 2) + Math.pow(this.p.height / 2, 2));

    for (let i = 0; i < 4; i++) {
      const gradient = this.p.drawingContext.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        maxDist * (1.4 - i * 0.15),
      );

      if (this.isFlashing) {
        const elapsed = this.p.millis() - this.flashStartTime;
        const flashProgress =
          (elapsed % (this.flashDuration / this.maxFlashCount)) /
          (this.flashDuration / this.maxFlashCount);
        const flashIntensity = Math.sin(flashProgress * Math.PI);

        if (i === 0) {
          gradient.addColorStop(0, `rgba(${192 + 63 * flashIntensity}, ${0}, ${0}, 0.25)`);
          gradient.addColorStop(0.85, `rgba(${64 + 63 * flashIntensity}, ${0}, ${0}, 0.15)`);
          gradient.addColorStop(1, "rgba(0, 0, 0, 0.3)");
        } else {
          gradient.addColorStop(0, `rgba(${192 + 63 * flashIntensity}, ${0}, ${0}, 0.06)`);
          gradient.addColorStop(0.85, `rgba(${64 + 63 * flashIntensity}, ${0}, ${0}, 0.03)`);
          gradient.addColorStop(1, "rgba(0, 0, 0, 0.08)");
        }
      } else {
        if (i === 0) {
          gradient.addColorStop(0, "rgba(96, 0, 192, 0.25)");
          gradient.addColorStop(0.85, "rgba(32, 0, 64, 0.15)");
          gradient.addColorStop(1, "rgba(0, 0, 0, 0.3)");
        } else {
          gradient.addColorStop(0, "rgba(96, 0, 192, 0.06)");
          gradient.addColorStop(0.85, "rgba(32, 0, 64, 0.03)");
          gradient.addColorStop(1, "rgba(0, 0, 0, 0.08)");
        }
      }

      this.p.drawingContext.fillStyle = gradient;
      this.p.noStroke();

      // Create bulge effect by using ellipse with larger bulge
      const bulgeAmount = 1.2 - i * 0.015;
      this.p.ellipse(centerX, centerY, this.p.width * bulgeAmount, this.p.height * bulgeAmount);
    }

    // Draw background characters
    this.backgroundChars.forEach((char) => char.draw(this.p));

    // Draw falling characters
    this.fallingChars.forEach((char) => char.draw(this.p));

    // Draw particles
    this.particles.forEach((particle) => particle.draw(this.p));

    // Draw score and lives
    if (this.isPlaying) {
      this.p.push();
      this.p.textFont(this.pixelFont);

      // Draw score on bottom left
      this.p.textAlign(this.p.LEFT, this.p.BOTTOM);
      this.p.textSize(16);

      // Calculate score color based on transition
      let currentScoreColor = this.scoreColor;
      if (this.scoreColorTransitionStart > 0) {
        const elapsed = this.p.millis() - this.scoreColorTransitionStart;
        const progress = Math.min(1, elapsed / this.scoreColorTransitionDuration);

        if (progress < 1) {
          // Interpolate between red and normal color
          const normalColor = this.p.color("#00ff00"); // Use green as normal color
          const redColor = this.p.color("#FF0000");
          currentScoreColor = this.p.lerpColor(redColor, normalColor, progress);
        } else {
          this.scoreColorTransitionStart = 0;
          currentScoreColor = this.p.color("#00ff00");
        }
      }

      // Score outer glow
      this.p.fill(currentScoreColor);
      this.p.fill(
        this.p.red(currentScoreColor),
        this.p.green(currentScoreColor),
        this.p.blue(currentScoreColor),
        100,
      );
      this.p.text(`SCORE ${this.score}`, 25, this.p.height - 20);

      // Score middle glow
      this.p.fill(
        this.p.red(currentScoreColor),
        this.p.green(currentScoreColor),
        this.p.blue(currentScoreColor),
        150,
      );
      this.p.text(`SCORE ${this.score}`, 25, this.p.height - 20);

      // Score inner text
      this.p.fill(
        this.p.red(currentScoreColor),
        this.p.green(currentScoreColor),
        this.p.blue(currentScoreColor),
        255,
      );
      this.p.text(`SCORE ${this.score}`, 25, this.p.height - 20);

      // Draw score animations
      this.scoreAnimations = this.scoreAnimations.filter((animation) => {
        const isActive = animation.update();
        if (isActive) {
          animation.draw(this.p, this.pixelFont);
        }
        return isActive;
      });

      // Draw lives as Korean characters
      this.lifeCharacters.forEach((char) => char.draw(this.p));

      this.p.pop();

      // Draw pause overlay if paused
      if (this.isPlaying && this.isPaused) {
        this.p.push();

        // Semi-transparent background
        this.p.fill(0, 0, 0, 100);
        this.p.rect(0, 0, this.p.width, this.p.height);

        // Draw pause text in Korean with colors and wave effect
        this.p.textAlign(this.p.CENTER, this.p.CENTER);
        this.p.textSize(60);
        this.p.textFont(this.koreanPixelFont); // Use koreanPixelFont for Korean pause text
        this.p.textStyle(this.p.BOLD);

        const pauseText = "\uC77C\uC2DC\uC815\uC9C0";
        const colors = [
          "#FF6B6B", // Pink/Red
          "#4ECDC4", // Teal
          "#45B7D1", // Light Blue
          "#96CEB4", // Sage
        ];

        // Calculate total width of text for centering
        const totalWidth = pauseText
          .split("")
          .reduce((width, char) => width + this.p.textWidth(char), 0);
        let currentX = this.p.width / 2 - totalWidth / 2 + 20;

        // Draw each character with animation
        pauseText.split("").forEach((char, i) => {
          const color = colors[i % colors.length];
          const yOffset = Math.sin(this.p.millis() / 600 + i * 0.5) * 20;

          // Outer glow
          const rgb = this.p.color(color);
          this.p.fill(color + "99"); // Reduce to 60% alpha
          for (let offset = 3; offset >= 1; offset--) {
            this.p.text(char, currentX, this.p.height / 2 + yOffset - offset);
            this.p.text(char, currentX, this.p.height / 2 + yOffset + offset);
            this.p.text(char, currentX - offset, this.p.height / 2 + yOffset);
            this.p.text(char, currentX + offset, this.p.height / 2 + yOffset);
          }

          // Main character
          this.p.fill(255, 255, 255);
          this.p.text(char, currentX, this.p.height / 2 + yOffset);
          this.p.fill(color + "FF");
          this.p.text(char, currentX, this.p.height / 2 + yOffset);

          currentX += this.p.textWidth(char) + 5; // Add small spacing between characters
        });

        // Subtitle with flashing effect and special glow for button text
        this.p.textSize(20);
        this.p.textFont(this.pixelFont);
        this.p.textAlign(this.p.CENTER, this.p.CENTER);

        const pressText = "PRESS ";
        const buttonText = "\uC2DC\uC791";
        const toResumeText = " TO RESUME";

        // Calculate total width for centering
        const resumeTextWidth = this.p.textWidth(pressText + buttonText + toResumeText);
        const startX = this.p.width / 2 - resumeTextWidth / 2;

        this.p.textAlign(this.p.LEFT, this.p.CENTER);

        // Increased spacing by moving the subtitle down a bit more
        const subtitleY = this.p.height / 2 + 80; // Increased from 60 to 80

        // Draw "PRESS" with normal opacity
        this.p.fill(255, 255, 255, this.pauseTextOpacity * 255);
        this.p.text(pressText, startX, subtitleY);

        // Draw button text with arcade button glow effect
        const buttonX = startX + this.p.textWidth(pressText);

        // Use Arial for Korean button text
        this.p.textFont("Arial");
        this.p.textStyle(this.p.BOLD);

        // Calculate button dimensions
        const buttonPadding = 10;
        const buttonHeight = 30;
        const buttonWidth = this.p.textWidth(buttonText) + buttonPadding * 2;
        const buttonY = subtitleY - buttonHeight / 2;

        // Draw button base (shadow)
        this.p.fill(44, 132, 76, this.pauseTextOpacity * 255); // Darker green
        this.p.noStroke();
        this.p.rect(buttonX, buttonY + 4, buttonWidth, buttonHeight, 6);

        // Draw button surface
        this.p.fill(74, 222, 128, this.pauseTextOpacity * 255); // Light green
        this.p.rect(buttonX, buttonY, buttonWidth, buttonHeight, 6);

        // Add highlight to button
        const gradientHeight = buttonHeight * 0.4;
        this.p.fill(255, 255, 255, this.pauseTextOpacity * 40);
        this.p.rect(buttonX, buttonY, buttonWidth, gradientHeight, 6, 6, 0, 0);

        // Outer button glow
        this.p.fill(74, 222, 128, this.pauseTextOpacity * 80); // Light green glow
        for (let offset = 2; offset >= 1; offset--) {
          this.p.text(
            buttonText,
            buttonX + buttonPadding - offset,
            buttonY + buttonHeight / 2 + 4 - offset,
          );
          this.p.text(
            buttonText,
            buttonX + buttonPadding + offset,
            buttonY + buttonHeight / 2 + 4 + offset,
          );
        }

        // Inner button text
        this.p.fill(255, 255, 255, this.pauseTextOpacity * 255);
        this.p.text(buttonText, buttonX + buttonPadding, buttonY + buttonHeight / 2);

        // Draw "TO RESUME" with normal opacity
        this.p.textFont(this.pixelFont);
        this.p.fill(255, 255, 255, this.pauseTextOpacity * 255);
        this.p.text(toResumeText, buttonX + buttonWidth + 5, subtitleY);

        this.p.pop();
      }
    }

    // Draw start/game over text
    if (!this.isPlaying) {
      this.p.push();
      this.p.textAlign(this.p.CENTER, this.p.CENTER);

      // Draw title text with wave animation
      const titleText = this.lives <= 0 ? "GAME OVER" : "\uD55C\uAE00 HERO";
      const colors = [
        "#FF6B6B", // Pink/Red
        "#4ECDC4", // Teal
        "#45B7D1", // Light Blue
        "#96CEB4", // Sage
        "#FFEEAD", // Light Yellow
        "#D4A5A5", // Light Pink
      ];

      if (this.lives <= 0) {
        // Game Over text
        this.p.textSize(40);
        this.p.textFont(this.pixelFont);

        // Draw text glow
        const glowColor = this.p.color("#ff0066");
        glowColor.setAlpha(this.startTextOpacity * 100);
        this.p.fill(glowColor);
        this.p.textSize(42);
        this.p.text(titleText, this.p.width / 2, this.p.height / 2 - 20);

        // Draw main text
        this.p.fill(255, 255, 255, this.startTextOpacity * 255);
        this.p.textSize(40);
        this.p.text(titleText, this.p.width / 2, this.p.height / 2 - 20);

        // Draw final score
        this.p.textSize(24);
        this.p.textAlign(this.p.CENTER, this.p.CENTER);

        // Score glow effect
        const scoreGlowColor = this.p.color("#00ff00");
        scoreGlowColor.setAlpha(this.startTextOpacity * 100);
        this.p.fill(scoreGlowColor);
        this.p.textSize(26);
        this.p.text(`FINAL SCORE: ${this.score}`, this.p.width / 2, this.p.height / 2 + 40);

        // Main score text
        this.p.fill(255, 255, 255, this.startTextOpacity * 255);
        this.p.textSize(24);
        this.p.text(`FINAL SCORE: ${this.score}`, this.p.width / 2, this.p.height / 2 + 40);
      } else {
        // 한글 HERO title with wave animation
        this.p.textSize(60);

        // Calculate total width for centering
        const chars = titleText.split("");
        let totalWidth = 0;
        chars.forEach((char) => {
          if (isHangul(char)) {
            this.p.textFont("Arial");
          } else {
            this.p.textFont(this.pixelFont);
          }
          totalWidth += this.p.textWidth(char) + 5; // Account for spacing in width calculation
        });

        let currentX = this.p.width / 2 - totalWidth / 2;

        // Draw each character with animation
        chars.forEach((char, i) => {
          const color = colors[i % colors.length];
          const yOffset = Math.sin(this.p.millis() / 600 + i * 0.5) * 20;
          const xOffset = isHangul(char) ? 60 : 26;

          if (isHangul(char)) {
            this.p.textFont("Arial");
          } else {
            this.p.textFont(this.pixelFont);
          }

          // Outer glow
          this.p.fill(color + "99");
          for (let offset = 3; offset >= 1; offset--) {
            this.p.text(char, currentX + xOffset, this.p.height / 2 - 20 + yOffset - offset);
            this.p.text(char, currentX + xOffset, this.p.height / 2 - 20 + yOffset + offset);
            this.p.text(char, currentX + xOffset - offset, this.p.height / 2 - 20 + yOffset);
            this.p.text(char, currentX + xOffset + offset, this.p.height / 2 - 20 + yOffset);
          }

          // Main character
          this.p.fill(255, 255, 255);
          this.p.text(char, currentX + xOffset, this.p.height / 2 - 20 + yOffset);
          this.p.fill(color + "FF");
          this.p.text(char, currentX + xOffset, this.p.height / 2 - 20 + yOffset);

          currentX += this.p.textWidth(char) + 5; // Add small spacing between characters
        });
      }

      // Draw subtitle with button reference
      this.p.textSize(20);
      this.p.textAlign(this.p.CENTER, this.p.CENTER);

      const pressText = "PRESS ";
      const buttonText = "\uC2DC\uC791";
      const toStartText = this.lives <= 0 ? " TO TRY AGAIN" : " TO PLAY";

      // Calculate total width for centering
      const startTextWidth = this.p.textWidth(pressText + buttonText + toStartText);
      const startX = this.p.width / 2 - startTextWidth / 2;

      this.p.textAlign(this.p.LEFT, this.p.CENTER);

      // Draw "PRESS" with normal opacity
      this.p.fill(255, 255, 255, this.startTextOpacity * 255);
      this.p.text(pressText, startX, this.p.height / 2 + 90);

      // Draw button text with arcade button glow effect
      const buttonX = startX + this.p.textWidth(pressText);

      // Use Arial for Korean button text
      this.p.textFont("Arial");
      this.p.textStyle(this.p.BOLD);

      // Calculate button dimensions
      const buttonPadding = 10;
      const buttonHeight = 30;
      const buttonWidth = this.p.textWidth(buttonText) + buttonPadding * 2;
      const buttonY = this.p.height / 2 + 90 - buttonHeight / 2;

      // Draw button base (shadow)
      this.p.fill(44, 132, 76, this.startTextOpacity * 255);
      this.p.noStroke();
      this.p.rect(buttonX, buttonY + 4, buttonWidth, buttonHeight, 6);

      // Draw button surface
      this.p.fill(74, 222, 128, this.startTextOpacity * 255);
      this.p.rect(buttonX, buttonY, buttonWidth, buttonHeight, 6);

      // Add highlight to button
      const gradientHeight = buttonHeight * 0.4;
      this.p.fill(255, 255, 255, this.startTextOpacity * 40);
      this.p.rect(buttonX, buttonY, buttonWidth, gradientHeight, 6, 6, 0, 0);

      // Outer button glow
      this.p.fill(74, 222, 128, this.startTextOpacity * 80);
      for (let offset = 2; offset >= 1; offset--) {
        this.p.text(
          buttonText,
          buttonX + buttonPadding - offset,
          buttonY + buttonHeight / 2 + 4 - offset,
        );
        this.p.text(
          buttonText,
          buttonX + buttonPadding + offset,
          buttonY + buttonHeight / 2 + 4 + offset,
        );
      }

      // Inner button text
      this.p.fill(255, 255, 255, this.startTextOpacity * 255);
      this.p.text(buttonText, buttonX + buttonPadding, buttonY + buttonHeight / 2);

      // Draw "TO START/RESTART" with normal opacity
      this.p.textFont(this.pixelFont);
      this.p.fill(255, 255, 255, this.startTextOpacity * 255);
      this.p.text(toStartText, buttonX + buttonWidth + 5, this.p.height / 2 + 90);

      this.p.pop();
    }

    // Draw last typed character with enhanced arcade effect
    if (this.lastTypedChar && this.isPlaying && !this.isPaused) {
      const timeSinceTyped = this.p.millis() - this.lastTypedCharTime;
      const fadeTime = 1000;
      if (timeSinceTyped < fadeTime) {
        this.p.push();
        const baseSize = 50;
        this.p.textAlign(this.p.CENTER, this.p.CENTER);
        const opacity = this.p.map(timeSinceTyped, 0, fadeTime, 255, 0);

        // Use koreanPixelFont for Korean characters
        if (isHangul(this.lastTypedChar)) {
          this.p.textFont(this.koreanPixelFont);
          this.p.textStyle(this.p.BOLD);
        } else {
          this.p.textFont(this.pixelFont);
        }

        // Draw outer glow
        const glowColor = this.p.color(this.lastTypedCharColor);
        glowColor.setAlpha(opacity * 0.3);
        this.p.fill(glowColor);
        this.p.textSize(baseSize + 6);
        this.p.text(this.lastTypedChar, this.p.width / 2, this.p.height - 50);

        // Draw middle glow
        glowColor.setAlpha(opacity * 0.6);
        this.p.fill(glowColor);
        this.p.textSize(baseSize + 3);
        this.p.text(this.lastTypedChar, this.p.width / 2, this.p.height - 50);

        // Draw main character
        const c = this.p.color(this.lastTypedCharColor);
        c.setAlpha(opacity);
        this.p.fill(c);
        this.p.textSize(baseSize);
        this.p.text(this.lastTypedChar, this.p.width / 2, this.p.height - 50);

        // Draw inner highlight
        const highlightColor = this.p.color("#ffffff");
        highlightColor.setAlpha(opacity * 0.7);
        this.p.fill(highlightColor);
        this.p.textSize(baseSize * 0.9);
        this.p.text(this.lastTypedChar, this.p.width / 2, this.p.height - 50);

        this.p.pop();
      } else {
        this.lastTypedChar = null;
      }
    }

    // Draw warning messages
    this.warningMessages = this.warningMessages.filter((message) => {
      const isActive = message.update();
      if (isActive) {
        message.draw(this.p, this.pixelFont);
      }
      return isActive;
    });
  }

  handleKeyPress(key: string): void {
    if (!this.isPlaying) return;

    // Check if the key is an English character
    if (/^[a-zA-Z]$/.test(key)) {
      // Add warning message and pause the game
      this.warningMessages.push(new WarningMessage(this.p, "Enable the Korean keyboard to play"));
      if (!this.isPaused) {
        this.togglePause();
      }
      return;
    }

    // Don't process input if paused
    if (this.isPaused) return;

    const charIndex = this.fallingChars.findIndex(
      (char) =>
        char.char.toLowerCase() === key.toLowerCase() &&
        !char.isBackground &&
        !char.wasSuccessfullyHit,
    );

    this.lastTypedChar = key;
    this.lastTypedCharTime = this.p.millis();

    if (charIndex !== -1) {
      // Matched a falling character - use neon colors for success
      this.lastTypedCharColor = "#00ff00";
      const matchedChar = this.fallingChars[charIndex];
      matchedChar.startGrowth(); // Start the growth animation
      matchedChar.wasSuccessfullyHit = true; // Mark as successfully hit
      this.score += 10;
      // If score was zero and we're adding points, transition back to green
      if (this.wasScoreZero) {
        this.scoreColor = this.p.color("#00ff00");
        this.wasScoreZero = false;
      }

      // Create success explosion
      setTimeout(() => {
        this.createExplosion(matchedChar.x, matchedChar.y, matchedChar.char, true);
      }, 100); // 50ms delay
    } else {
      // No match found - use hot pink for errors and reduce score
      this.lastTypedCharColor = "#ff0066";
      if (this.score > 0) {
        this.score = Math.max(0, this.score - 1);
        // Calculate position for score reduction animation
        const scoreText = `SCORE ${this.score}`;
        const scoreWidth = this.p.textWidth(scoreText);
        const numberStart = 25 + this.p.textWidth("SCORE "); // Position after "SCORE "
        const numberWidth = this.p.textWidth(this.score.toString());
        const centerOfNumber = numberStart + numberWidth / 2;

        // Add score reduction animation centered over the number
        this.scoreAnimations.push(new ScoreAnimation(centerOfNumber, this.p.height - 40, "-1"));

        // If score reaches zero, set it to red immediately and mark that it was due to point loss
        if (this.score === 0) {
          this.scoreColor = this.p.color("#FF0000");
          this.wasScoreZero = true;
          // Reset any ongoing color transition
          this.scoreColorTransitionStart = 0;
        } else {
          // Only start the color transition if we're not at zero
          this.scoreColorTransitionStart = this.p.millis();
        }
      }
    }
  }

  startFlashEffect(): void {
    this.isFlashing = true;
    this.flashStartTime = this.p.millis();
    this.flashCount = 0;
    // Set maxFlashCount based on how many mistakes were made (MAX_LIVES - current lives)
    this.maxFlashCount = Game.MAX_LIVES - this.lives;
    // Adjust flash duration based on number of flashes to keep consistent timing per flash
    this.flashDuration = this.maxFlashCount * 600; // 600ms per flash
  }

  // Add new power state methods
  public handlePowerToggle(): void {
    if (!this.isLongPress) {
      // Normal press - turn on if off, start game if on
      if (!this.isPowered) {
        this.turnOn();
      } else if (!this.isPlaying) {
        this.start();
      } else {
        this.togglePause();
      }
    } else {
      // Long press - turn off if on
      if (this.isPowered) {
        this.turnOff();
      }
    }
  }

  private turnOn(): void {
    this.isPowered = true;
    this.screenPowerTransitionStart = this.p.millis();
    // Play power on sound
    if (this.sounds.buttonPressed) {
      this.playSound(this.sounds.buttonPressed, { volume: 1.5, rate: 0.8 });
    }
    // Play intro music in a loop
    if (this.sounds.intro) {
      this.playSound(this.sounds.intro, { volume: 0.1, loop: true });
    }
    // Add powered class to LED housing and remove off class from button
    const ledHousing = document.querySelector(".led-housing");
    const startButton = document.getElementById("start-button");
    if (ledHousing) {
      ledHousing.classList.add("powered");
    }
    if (startButton) {
      startButton.classList.remove("off");
    }
  }

  private turnOff(): void {
    this.isPowered = false;
    this.isPlaying = false;
    this.isPaused = false;
    this.screenPowerTransitionStart = this.p.millis();

    // Stop intro music if it's playing
    if (this.sounds.intro) {
      this.sounds.intro.stop();
    }

    // Stop current game music track
    if (this.sounds.gameMusic && this.sounds.gameMusic[this.currentGameMusicIndex]) {
      this.sounds.gameMusic[this.currentGameMusicIndex].stop();
    }

    // Stop game over song if it's playing
    if (this.sounds.gameOverSong) {
      this.sounds.gameOverSong.stop();
    }

    // Reset game state
    this.score = 0;
    this.lives = Game.MAX_LIVES;
    this.fallingChars = [];
    this.backgroundChars = [];
    this.particles = [];
    this.scoreAnimations = [];
    this.speed = this.initialSpeed;
    this.lastTypedChar = null;
    this.lastTypedCharColor = "#FFFFFF";
    this.lastTypedCharTime = 0;
    this.startTextOpacity = 0;
    this.startTextFading = 1;
    this.pauseTextOpacity = 0.3;
    this.pauseTextFading = 1;
    this.scoreColor = this.p.color("#00ff00");
    this.scoreColorTransitionStart = 0;
    this.wasScoreZero = false;
    this.flashStartTime = 0;
    this.isFlashing = false;
    this.flashCount = 0;
    this.maxFlashCount = 1;
    this.lifeCharacters = [];
    this.columnLastY = new Array(this.numColumns).fill(-this.minBackgroundSpacing);
    this.gameStartTime = 0;
    this.lastSpawnTime = 0;
    this.initialSpawnInterval = 3000;
    this.maxActiveChars = 1;
    this.currentGameMusicIndex = 0; // Reset music index

    // Play power off sound
    if (this.sounds.buttonReleased) {
      this.playSound(this.sounds.buttonReleased, { volume: 1.5, rate: 0.8 });
    }
    // Remove powered class from LED housing and add off class to button
    const ledHousing = document.querySelector(".led-housing");
    const startButton = document.getElementById("start-button");
    if (ledHousing) {
      ledHousing.classList.remove("powered");
    }
    if (startButton) {
      startButton.classList.add("off");
    }
  }

  private updatePowerState(): void {
    // Update screen power transition
    if (this.screenPowerTransitionStart > 0) {
      const elapsed = this.p.millis() - this.screenPowerTransitionStart;
      const progress = Math.min(1, elapsed / this.screenPowerTransitionDuration);

      if (progress >= 1) {
        this.screenPowerTransitionStart = 0;
      }
    }
  }
}
