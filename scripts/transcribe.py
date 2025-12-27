#!/usr/bin/env python3
"""
Generate word-level transcript from audio/video using OpenAI Whisper.

Usage:
  python scripts/transcribe.py <input-file> <output-json> [model-size]

Example:
  python scripts/transcribe.py \
    public/assets/talks/codegen-in-rust/audio.m4a \
    public/transcripts/t2468.json \
    medium
"""

import sys
import json
from pathlib import Path

def transcribe_file(input_path: str, output_path: str, model_size: str = "base"):
    """
    Transcribe audio/video file with word-level timestamps.

    Args:
        input_path: Path to audio/video file
        output_path: Path to output JSON file
        model_size: Whisper model size (tiny, base, small, medium, large)
    """
    try:
        import whisper
    except ImportError:
        print("Error: openai-whisper is not installed.")
        print("Install it with: pip install openai-whisper")
        sys.exit(1)

    print(f"Loading Whisper model: {model_size}")
    model = whisper.load_model(model_size)

    print(f"Transcribing: {input_path}")
    print("This may take a while depending on file length and model size...")

    result = model.transcribe(
        input_path,
        word_timestamps=True,  # Critical for word-level highlighting
        language="en"  # Can be removed for auto-detection
    )

    # Build transcript structure
    transcript = {
        "language": result.get("language", "en"),
        "duration": 0,
        "segments": []
    }

    total_words = 0

    for segment in result.get("segments", []):
        seg_data = {
            "start": round(segment["start"], 3),
            "end": round(segment["end"], 3),
            "text": segment["text"].strip(),
            "words": []
        }

        # Extract word-level timestamps if available
        if "words" in segment:
            for word in segment["words"]:
                seg_data["words"].append({
                    "word": word["word"].strip(),
                    "start": round(word["start"], 3),
                    "end": round(word["end"], 3)
                })
                total_words += 1

        transcript["segments"].append(seg_data)
        transcript["duration"] = max(transcript["duration"], seg_data["end"])

    # Ensure output directory exists
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)

    # Write JSON
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(transcript, f, indent=2, ensure_ascii=False)

    print(f"\n✓ Transcript saved to: {output_path}")
    print(f"  Language: {transcript['language']}")
    print(f"  Duration: {transcript['duration']:.1f}s ({transcript['duration'] / 60:.1f}min)")
    print(f"  Segments: {len(transcript['segments'])}")
    print(f"  Words: {total_words}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2]
    model = sys.argv[3] if len(sys.argv) > 3 else "base"

    if not Path(input_file).exists():
        print(f"Error: Input file not found: {input_file}")
        sys.exit(1)

    transcribe_file(input_file, output_file, model)
