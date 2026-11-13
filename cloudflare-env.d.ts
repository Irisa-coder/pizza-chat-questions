declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    PIZZA_HOST_EMAIL?: string;
    BUCKET?: R2Bucket;
  }
}
