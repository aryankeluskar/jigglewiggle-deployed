/**
 * Types shared between compare logic and UI components.
 */

export type ComparisonResult = {
  /** Overall similarity 0-100 (100 = perfect match) */
  similarity: number;
  /** Per-body-part scores */
  parts: {
    arms: number;
    legs: number;
    torso: number;
  };
  /** Specific feedback on what to fix */
  feedback: string[];
};
