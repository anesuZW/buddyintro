import { z } from "zod";

/** Accept proxy paths, /uploads paths, full URLs, or raw storage paths. */
export const storedMediaUrlSchema = z.union([
  z.string().url(),
  z.string().regex(/^\/api\/media\?path=/),
  z.string().regex(/^\/uploads\//),
  z.string().regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/(image|video|audio)\/.+/i
  ),
  z.string().regex(/^thumbnails\/[0-9a-f-]{36}\/(image|video|audio)\/.+/i),
  z.string().regex(/^(images|videos|audio)\/\d{4}\/\d{2}\/[0-9a-f-]{36}\/.+/i),
  z.string().regex(/^thumbnails\/\d{4}\/\d{2}\/[0-9a-f-]{36}\/.+/i),
]);

export const optionalStoredMediaUrlSchema = storedMediaUrlSchema.nullable().optional();
