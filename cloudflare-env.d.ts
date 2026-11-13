declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    PIZZA_HOST_EMAIL?: string;
    PIZZA_STANDALONE?: "1";
    PIZZA_HOST_PASSWORD?: string;
    BUCKET?: R2Bucket;
  }
}
