import { z } from "zod";

export const positionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export type Position = z.infer<typeof positionSchema>;

export const sizeSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
});

export type Size = z.infer<typeof sizeSchema>;
